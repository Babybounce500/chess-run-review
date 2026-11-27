// Verdrahtung von Neon Kicker: Hülle, Echtzeit, Szene, Bedienung, Töne.
import { createShell } from './kit/shell.js';
import { createRealtime, STEP } from './kit/realtime.js';
import { createControls } from './kit/controls.js';
import { createAudio } from './kit/audio.js';
import { sim } from './sim.js';
import { createView } from './view.js';
import { createInput } from './input.js';
import { sounds } from './sounds.js';
import { createHud } from './hud.js';
import { COLORS, OWN, RODS, SLIDE } from './config.js';

const qs = new URLSearchParams(location.search);
const SPEED = Math.min(8, Math.max(0.25, Number(qs.get('speed')) || 1));          // nur für Tests
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const audio = createAudio('neonkicker', sounds);
const controls = createControls({
  stick: false,
  buttons: [
    { id: 'a', label: 'SCHUSS', keys: ['Space', 'KeyJ'], pad: 0, color: '#ffd34d' },
    { id: 'b', label: 'KLEMMEN', keys: ['ShiftLeft', 'ShiftRight', 'KeyK'], pad: 2, color: '#a78bfa' },
    { id: 'prev', label: '‹', pad: 4 },               // Q und E behandelt input.js (auch sehr kurze Tipper)
    { id: 'next', label: '›', pad: 5 }
  ]
});
controls.showButton('prev', false); controls.showButton('next', false);

let view;
try { view = createView(document.getElementById('stage'), { reducedMotion }); }
catch (e) { document.getElementById('boot').textContent = 'Dieses Spiel braucht WebGL. Bitte einen aktuellen Browser verwenden.'; throw e; }

let rt, input, hud, shownSide = 0, slow = 0, guestY = null;
const shell = createShell({
  id: 'neonkicker', title: ['NEON', 'KICKER'], tagline: 'Tischfußball. Fünf Tore gewinnen.', colors: COLORS, audio,
  help: '<p><b>Handy:</b> Mit dem Daumen irgendwo ziehen, die leuchtende Stange folgt. Schnell nach vorn wischen oder SCHUSS drücken (länger halten = härter). Zurückziehen holt aus. KLEMMEN nimmt den Ball an; seitlich schieben und loslassen passt.</p>'
    + '<p><b>Tastatur:</b> Pfeile oder WASD schieben, Leertaste schießt, Shift klemmt, Q und E oder 1 bis 4 wählen die Stange. <b>Maus:</b> ziehen, klicken, rechte Taste klemmt, Rad wechselt. <b>Gamepad:</b> Stick, A, X, LB und RB.</p>'
    + '<p>Fünf Tore gewinnen. Nach drei Minuten zählt die Führung, bei Gleichstand entscheidet das nächste Tor (höchstens eine Minute).</p>',
  onSolo: ({ seed, level }) => start(() => rt.solo(seed, level)),
  onOnline: ({ role, seed }) => start(() => rt.online(role, seed)),
  onMenu: () => stop(), onLost: () => stop()
});
function start(begin) {
  begin(); input.reset(); view.reset(); guestY = null; slow = 0; shownSide = shell.state.me; view.setSide(shownSide);
  audio.excite(-0.36); hud.start(); layout(true);
}
function stop() { rt.stop(); input.reset(); view.reset(); view.setSide((shownSide = 0)); hud.stop(); }

const playing = () => shell.state.screen === 'play' && rt.mode() !== 'off';
input = createInput({ stage: document.getElementById('stage'), view, controls, state: () => rt && rt.state(), side: () => shell.state.me, playing });
hud = createHud({ shell, input, audio });

function onEvent(e) {
  const me = shell.state.me; view.event(e);
  if (e.type === 'kick') { audio.play('shot', e.p); if (e.side === me) audio.vibrate(Math.round(8 + e.p * 22)); if (e.p > 0.65 && !reducedMotion && rt.mode() === 'solo') slow = 0.07; }
  else if (e.type === 'hit') audio.play('clack', e.p);
  else if (e.type === 'wall') audio.play('bank', e.p);
  else if (e.type === 'post') audio.play('post');
  else if (e.type === 'trap') { audio.play('trap'); if (e.side === me) audio.vibrate(12); }
  else if (e.type === 'throw') { audio.play('throwin'); if (rt.state() && rt.state().t > 2) shell.banner('EINWURF', 'role', 700); }
  else if (e.type === 'goal') { audio.play('goal'); audio.play(e.side === me ? 'cheer' : 'groan'); audio.vibrate([40, 40, 90]); shell.banner(e.side === me ? 'TOR!' : 'GEGENTOR', e.side === me ? 'good' : 'bad', 1400); }
  else if (e.type === 'golden') { audio.play('whistle'); shell.banner('GOLDEN GOAL', 'role', 1600); }
}
rt = createRealtime({ shell, sim, readInput: () => input.read(), onEvent });

/* ---------- Bildaufbau ---------- */
let layoutKey = '', layoutT = 0;
// Freie Fläche zwischen Anzeige und Knöpfen: dorthin passt die Kamera den ganzen Tisch ein
function layout(force) {
  const w = innerWidth, h = innerHeight, portrait = h > w, inGame = shell.state.screen !== 'menu' && shell.state.screen !== 'lobby';
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? r : null; };
  const insets = { top: 8, right: 8, bottom: 8, left: 8 };
  if (inGame) {
    const score = box('#hud .score'), tools = box('#hud .tools'), rods = box('#rodbar'), act = box('#touch #actions');
    if (score) insets.top = score.bottom + 6;
    if (tools && score && tools.top > score.bottom - 4 && tools.left < w * 0.5 + 40) insets.top = tools.bottom + 4;
    else if (tools && portrait) insets.top = Math.max(insets.top, tools.bottom + 4);
    if (portrait) insets.bottom = Math.max(8, rods ? h - rods.top + 6 : 0, act ? h - act.top + 6 : 0);
    else {
      const side = Math.max(rods ? rods.right + 8 : 0, act ? w - act.left + 8 : 0, 8);
      insets.left = insets.right = side; insets.bottom = 8;
    }
  }
  const key = [w, h, insets.top, insets.right, insets.bottom, insets.left].map(Math.round).join();
  if (force || key !== layoutKey) { layoutKey = key; view.resize(insets); }
}
addEventListener('resize', () => layout(true));

// Hinter dem Menü spielen zwei Computer
let demo = sim.create(20260101, {}), demoAcc = 0;
function demoFrame(dt) {
  demoAcc = Math.min(0.1, demoAcc + dt);
  while (demoAcc >= STEP) { demoAcc -= STEP; sim.step(demo, [sim.cleanInput(sim.cpu(demo, 0, 'normal', STEP)), sim.cleanInput(sim.cpu(demo, 1, 'normal', STEP))], STEP); if (demo.win !== null) demo = sim.create(demo.rng, {}); }
  return demo;
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
  if (shell.state.me !== shownSide && rt.mode() !== 'off') view.setSide((shownSide = shell.state.me));
  controls.setEnabled(shell.state.screen === 'play');
  document.body.classList.toggle('mirror', rt.mode() === 'guest');      // Anzeige passt zur eigenen Tischseite
  hud.update(rt.state(), dt);
  if ((layoutT -= dt) <= 0) { layoutT = 0.2; layout(false); }
  input.update(dt);
  let factor = SPEED; if (slow > 0) { slow -= dt; factor *= 0.2; }                  // kurzer Stopp beim harten Schuss
  let s = rt.update(dt * factor), rod = -1;
  if (s) {
    if (playing()) {
      rod = OWN[shell.state.me][input.state.rod];
      if (rt.mode() === 'guest') {
        // Eigene Stange sofort zeigen, ohne auf die Antwort des Gastgebers zu warten
        if (!guestY || guestY.rod !== rod) guestY = { rod, y: s.rods[rod].y };
        guestY.y += Math.max(-SLIDE.max * dt, Math.min(SLIDE.max * dt, Math.max(-RODS[rod].range, Math.min(RODS[rod].range, input.state.y)) - guestY.y));
        s = Object.assign({}, s, { rods: s.rods.map((o, i) => (i === rod ? Object.assign({}, o, { y: guestY.y }) : o)) });
      }
    }
  } else if (shell.state.screen === 'menu' || shell.state.screen === 'lobby') { s = demoFrame(reducedMotion ? 0 : dt); }
  view.frame(dt, s, { rod });
  requestAnimationFrame(loop);
}
layout(true); requestAnimationFrame(loop);
shell.start();
window.__game = {
  shell: () => shell.snapshot(), sim: () => rt.state(), controls: () => controls.read(), sounds: () => audio.log.slice(),
  input: () => Object.assign({}, input.state, { global: OWN[shell.state.me][input.state.rod] }),
  view: () => Object.assign(view.info(), { bounds: view.bounds() }),
  axes: (rod) => view.axes(rod), project: (a, b, c) => view.project(a, b, c)
};
