// Verdrahtung: fester Takt, Eingaben, Kamera, Anzeige, Speichern.
import { createShell } from './kit/shell.js';
import { createControls } from './kit/controls.js';
import { createAudio } from './kit/audio.js';
import { createWorld } from './world.js';
import { createState, step, serialize, restore, recover, canEnter, canExit, speedOf } from './sim.js';
import { createCamera, updateCamera } from './camera.js';
import { createView } from './view.js';
import { createMinimap } from './minimap.js';
import { wrapAngle } from './vehicles.js';
import { SEED, DT } from './config.js';

const qs = new URLSearchParams(location.search);
const TEST = qs.has('test');
const audio = createAudio('neonbay');
const world = createWorld(SEED);
const stage = document.getElementById('stage');

let state = createState(world), prev = null, acc = 0, playing = false, saveT = 0, hintShown = false;
let cam = createCamera(state.player.h);
const pending = { use: false, jump: false, horn: false };

function loadSave() { try { return restore(world, JSON.parse(shell.store.get('save', ''))); } catch (e) { return null; } }
function save() { if (playing) shell.store.set('save', JSON.stringify(serialize(state))); }
function place(next) { state = next; prev = null; acc = 0; cam = createCamera(state.mode === 'car' ? state.car.h : state.player.h); if (view) view.reset(); }

let view = null, controls = null;
const shell = createShell({
  id: 'neonbay', audio,
  help: `<p><b>Zu Fuß:</b> Stick oder WASD laufen, SPRINT (Umschalt), SPRUNG (Leertaste), beim Auto EINSTEIGEN (E).</p>
    <p><b>Im Auto:</b> links lenken (A/D), GAS (W), BREMSE und rückwärts (S), DRIFT = Handbremse (Leertaste), langsam AUSSTEIGEN (E), Hupe (H).</p>
    <p><b>Umschauen:</b> über das Bild ziehen oder J/L. <b>Pause:</b> Esc oder P.</p>
    <p><b>Gamepad:</b> linker Stick, RT Gas, LT Bremse, A Handbremse/Sprung, B Sprint, Y ein/aus, Start Pause.</p>`,
  hasSave: () => !!(playing || loadSave()),
  onStart(fresh) {
    if (fresh) { shell.store.del('save'); place(createState(world)); }
    else if (!playing) { const s = loadSave(); place(s || createState(world)); }
    playing = true; hintShown = false; last = performance.now(); save();
  },
  onPause(p) { if (p) { save(); audio.engine(null); } controls.clear(); },
  onMenu() { save(); playing = false; audio.engine(null); },
  onRecover() { if (recover(world, state)) { prev = null; if (state.mode === 'car') cam = createCamera(state.car.h); view.reset(); shell.toast('Dein Auto steht repariert auf der nächsten Straße.'); save(); } },
  onQuality(q) { auto.reset(); view.setQuality(q === 'auto' ? auto.level : q); }
});

// Grafikstufe "Auto": am Handy mit Mittel beginnen und bei zu wenig Bildern eine Stufe herunter
const coarse = matchMedia('(pointer: coarse)').matches;
const auto = {
  level: coarse ? 'medium' : 'high', frames: 0, time: 0, grace: 3,
  reset() { this.level = coarse ? 'medium' : 'high'; this.frames = this.time = 0; this.grace = 3; },
  tick(dt) {
    if (this.grace > 0) { this.grace -= dt; return; }
    this.frames++; this.time += dt; if (this.time < 4) return;
    const fps = this.frames / this.time; this.frames = this.time = 0;
    if (fps < 40 && this.level !== 'low') { this.level = this.level === 'high' ? 'medium' : 'low'; view.setQuality(this.level); this.grace = 2; }
  }
};

controls = createControls({ surface: stage, onPause: () => shell.setPaused(shell.state.screen !== 'pause') });
view = createView(stage, world, shell.state.quality === 'auto' ? auto.level : shell.state.quality);
const minimap = createMinimap(shell.$('mini'), world);
controls.onTouchChange(() => view.resize());
addEventListener('resize', () => view.resize());
if (window.visualViewport) visualViewport.addEventListener('resize', () => view.resize());
addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); audio.engine(null); } });

// Zustand zwischen zwei Takten weich anzeigen
const snap = (st) => ({ car: { x: st.car.x, z: st.car.z, h: st.car.h }, player: { x: st.player.x, y: st.player.y, z: st.player.z, h: st.player.h, walked: st.player.walked }, parked: st.parked.map((c) => [c.x, c.z, c.h]), mode: st.mode });
function blend(k) {
  const mix = (a, b) => a + (b - a) * k, ang = (a, b) => a + wrapAngle(b - a) * k;
  if (!prev || prev.mode !== state.mode) return { mode: state.mode, car: state.car, player: state.player, parked: state.parked };
  const c = state.car, p = state.player;
  return {
    mode: state.mode,
    car: { ...c, x: mix(prev.car.x, c.x), z: mix(prev.car.z, c.z), h: ang(prev.car.h, c.h) },
    player: { ...p, x: mix(prev.player.x, p.x), y: mix(prev.player.y, p.y), z: mix(prev.player.z, p.z), h: ang(prev.player.h, p.h), walked: mix(prev.player.walked, p.walked) },
    parked: state.parked.map((o, i) => ({ x: mix(prev.parked[i][0], o.x), z: mix(prev.parked[i][1], o.z), h: ang(prev.parked[i][2], o.h), color: o.color }))
  };
}

function onEvent(e) {
  if (e.type === 'enter' || e.type === 'exit') { audio.play('door'); audio.vibrate(15); prev = null; save(); if (e.type === 'enter' && !hintShown) { hintShown = true; shell.toast(controls.isTouch() ? 'Links lenken, rechts GAS. DRIFT für enge Kurven.' : 'W Gas, S Bremse, A/D lenken, Leertaste driften.'); } }
  else if (e.type === 'tooFast') shell.toast('Erst anhalten, dann aussteigen.');
  else if (e.type === 'noExit') shell.toast('Hier ist kein Platz. Fahr ein Stück weiter.');
  else if (e.type === 'crash') {
    if (e.speed > 3.5) { audio.play('crash', e.speed); view.crash(e.speed, state.car); }
    if (e.speed > 8) audio.vibrate(Math.min(90, e.speed * 4));
    if (state.car.damage >= 100 && !onEvent.broken) { onEvent.broken = true; shell.toast('Auto schwer beschädigt. Pause → Auto herholen und reparieren.'); }
    if (state.car.damage < 100) onEvent.broken = false;
  } else if (e.type === 'screech') audio.play('screech');
  else if (e.type === 'jump') audio.play('jump');
  else if (e.type === 'land') { audio.play('land'); view.dust(state.player.x, state.player.z); }
  else if (e.type === 'horn') audio.play('horn');
}

let hudT = 0, mapT = 0;
function hud(vs, dt) {
  const driving = state.mode === 'car', $ = shell.$;
  controls.setMode(state.mode);
  document.body.dataset.mode = state.mode;
  const enterable = canEnter(state);
  controls.showButton('enter', enterable); controls.showButton('exit', driving && canExit(state));
  shell.prompt(controls.isTouch() ? '' : enterable ? (controls.source() === 'pad' ? 'Y' : 'E') + ' · Einsteigen' : driving && canExit(state) && speedOf(state.car) < 0.5 ? (controls.source() === 'pad' ? 'Y' : 'E') + ' · Aussteigen' : '');
  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.1; $('gauge').hidden = !driving;
    if (driving) { const v = String(Math.round(speedOf(state.car) * 3.6)); if ($('kmh').textContent !== v) $('kmh').textContent = v; const h = Math.round(100 - state.car.damage); $('health').style.width = h + '%'; $('health').dataset.s = h > 60 ? 'good' : h > 25 ? 'warn' : 'bad'; $('health').parentElement.setAttribute('aria-label', 'Zustand ' + h + ' Prozent'); }
  }
  mapT -= dt;
  if (mapT <= 0) { mapT = 1 / 30; minimap.draw(vs.mode === 'car' ? vs.car : vs.player, vs.car, cam.yaw + cam.orbit, !driving, $('mapBox').classList.contains('big') ? 190 : driving ? 105 : 72); }
}

let last = performance.now(), menuTime = 0, lastInput = null;
const frames = [];
function loop(now) {
  requestAnimationFrame(loop);
  const raw = Math.max(0, (now - last) / 1000), dt = Math.min(0.1, raw); last = now;
  if (TEST) { frames.push(raw * 1000); if (frames.length > 4000) frames.shift(); }
  const screen = shell.state.screen;
  controls.setEnabled(screen === 'play');
  const input = controls.read(dt); if (screen === 'play') lastInput = input;
  let vs;
  if (screen === 'play') {
    pending.use = pending.use || input.use; pending.jump = pending.jump || input.jump; pending.horn = pending.horn || input.horn;
    acc = Math.min(acc + dt, DT * 6);
    while (acc >= DT) {
      acc -= DT;
      // Laufrichtung relativ zur Kamera
      const yaw = cam.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
      const sim = { mx: rx * input.x - fx * input.y, mz: rz * input.x - fz * input.y, sprint: input.sprint, jump: pending.jump, use: pending.use, horn: pending.horn, gas: input.gas, brake: input.brake, hand: input.hand, steer: input.x };
      pending.use = pending.jump = pending.horn = false;
      prev = snap(state);
      for (const e of step(world, state, sim)) onEvent(e);
    }
    vs = blend(acc / DT); vs.gas = input.gas;
    updateCamera(cam, world, vs, { dx: input.lookDx, dy: input.lookDy }, dt, view.camera.aspect < 0.8 ? 1.12 : 1);
    saveT += dt; if (saveT > 2) { saveT = 0; save(); }
    if (state.mode === 'car') { const sp = speedOf(state.car), gear = Math.min(3, Math.floor(sp / 10)); audio.engine(Math.min(1, (sp - gear * 7) / 17 + 0.05), input.gas); } else audio.engine(null);
    if (shell.state.quality === 'auto' && !TEST) auto.tick(raw);
  } else {
    pending.use = pending.jump = pending.horn = false; acc = 0; prev = null; audio.engine(null);
    vs = blend(1);
    if (screen === 'menu' && !playing) {
      menuTime += dt; const t = createState(world), sway = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Math.sin(menuTime * 0.12) * 0.35;
      vs = { mode: 'foot', car: t.car, player: t.player, parked: t.parked };
      const c = t.car; cam.pos = [c.x - 11 * Math.cos(sway * 0.5), 3.3, c.z + 2.2 + sway * 3]; cam.look = [c.x + 14, 3.2, c.z - 5]; cam.yaw = Math.PI / 2;
    }
  }
  view.render(vs, cam, screen === 'pause' ? 0 : dt);
  if (screen !== 'menu') hud(vs, dt);
}
requestAnimationFrame(loop);
view.resize();
shell.start();

window.__game = {
  shell: () => shell.snapshot(),
  sim: () => JSON.parse(JSON.stringify(state)),
  controls: () => lastInput,
  sounds: () => audio.log.slice(),
  engine: () => ({ enabled: audio.engineEnabled(), running: audio.engineRunning() }),
  view: () => ({ ...view.stats(), camera: { pos: cam.pos.slice(), yaw: cam.yaw, clipped: cam.clipped } })
};
// Nur für Tests (?test): Lagen setzen, Messwerte lesen
if (TEST) {
  window.__test = {
    world: () => world,
    frames: () => frames.splice(0),
    set(patch) { Object.assign(state.car, patch.car || {}); Object.assign(state.player, patch.player || {}); if (patch.mode) state.mode = patch.mode; prev = null; if (patch.yaw !== undefined) { cam.yaw = patch.yaw; cam.mode = state.mode; cam.idle = 0; cam.dist = 20; } },
    screen: (x, y, z) => view.project(x, y, z)
  };
}
