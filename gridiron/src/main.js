// Verdrahtung: Hülle, Netz/Takt, Steuerung, Ton und Darstellung.
import { createShell } from './kit/shell.js';
import { createRealtime } from './kit/realtime.js';
import { createControls } from './kit/controls.js';
import { createAudio } from './kit/audio.js';
import { sim, canPass, controlled } from './sim.js';
import { TIME, PLAYS, FORMATIONS, TARGETS } from './config.js';
import { createView, TAG } from './view.js';
import { createHud, callout } from './hud.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const SPEED = Math.min(8, Math.max(0.25, Number(qs.get('speed')) || 1));            // nur für Tests

const audio = createAudio('gridiron', {
  snap: (a, { tone, hiss }) => { hiss(1500, 1.4, 0.4, 0.05); tone(240, 120, 0.25, 0.08, 'square'); },
  pass: (a, { tone, hiss }) => { hiss(a ? 900 : 1700, 1.6, 0.35, a ? 0.4 : 0.22, 'bandpass', 0, 0.04); tone(180, 90, 0.2, 0.09, 'triangle'); },
  catch: (a, { tone, hiss }) => { hiss(700, 0.9, 0.55, 0.08); tone(330, 520, 0.2, 0.12, 'triangle', 0.02); },
  swat: (a, { tone, hiss }) => { hiss(2200, 1.2, 0.5, 0.07); tone(190, 80, 0.3, 0.1, 'square'); },
  tackle: (p, { tone, hiss }) => { const k = 0.6 + (p || 0) * 0.5; tone(120, 38, 0.7 * k, 0.22); hiss(380, 0.7, 0.55 * k, 0.16); hiss(2600, 1, 0.18 * k, 0.04, 'bandpass', 0.03); },
  juke: (a, { hiss }) => hiss(1100, 2.2, 0.25, 0.14, 'bandpass', 0, 0.03),
  jump: (a, { tone }) => tone(260, 520, 0.12, 0.14, 'sine'),
  rush: (a, { tone }) => { tone(520, 520, 0.12, 0.09, 'square'); tone(780, 780, 0.1, 0.09, 'square', 0.11); },
  tick: (a, { tone }) => tone(990, 990, 0.08, 0.04, 'triangle'),
  sting: (a, { tone }) => [196, 247, 294].forEach((f, i) => tone(f, f * 0.98, 0.18, 0.3, 'sawtooth', i * 0.07)),
  fanfare: (a, { tone }) => [523, 659, 784, 659, 1047].forEach((f, i) => tone(f, f, 0.14, i === 4 ? 0.5 : 0.14, 'square', 0.12 + i * 0.11))
});
const controls = createControls({ buttons: [
  { id: 'a', label: 'SNAP', keys: ['Space', 'KeyJ', 'Digit1'], pad: 0 },
  { id: 'b', label: 'B', keys: ['KeyK', 'KeyE', 'Digit2'], pad: 1 },
  { id: 'c', label: 'C', keys: ['KeyL', 'KeyQ', 'Digit3'], pad: 2 },
  { id: 'd', label: 'SPRINT', keys: ['ShiftLeft', 'ShiftRight'], pad: 7 }
] });
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let view;
try { view = createView($('stage'), { reducedMotion: reduced.matches }); }
catch (e) { $('boot').textContent = '3D wird von diesem Browser nicht unterstützt (WebGL fehlt).'; throw e; }

// Örtlicher Zustand: nur Bedienung, nichts davon entscheidet das Spiel
const ui = { sel: 0, locked: false, play: -1, tag: -1, playing: false, insets: { top: 60, bottom: 20, left: 0, right: 0 }, call: null, seen: {}, last: [0, 0] };
let rt, current = null;
const hud = createHud({
  onPick(i) { if (ui.locked || !current || current.ph !== 'pick') return; audio.unlock(); if (ui.sel === i && ui.touched) return confirm(); ui.sel = i; ui.touched = true; audio.play('tick'); },      // erst das zweite Antippen legt fest
  onConfirm: confirm,
  onTag(k, down) { if (down) { ui.tag = k; audio.unlock(); } else if (ui.tag === k) ui.tag = -1; }
});
function confirm() { if (!current || current.ph !== 'pick' || ui.locked || !ui.playing) return; ui.locked = true; audio.play('ui'); }
const options = () => (current && current.off === shell.state.me ? PLAYS.length : FORMATIONS.length);

const shell = createShell({
  id: 'gridiron', title: ['NEON', 'GRIDIRON'], tagline: 'Straßen-Football unter Flutlicht: angreifen und verteidigen', colors: ['#ff8a30', '#3fb8ff'], audio,
  help: `<p><b>Ziel:</b> Jede Seite hat zwei Angriffsserien. Vier Versuche bringen dich zur gelben Linie, dann gibt es vier neue. Jeder Touchdown zählt 1. Bei Gleichstand folgt die Verlängerung.</p>
  <p><b>Angriff:</b> Spielzug wählen, SNAP. Pass: Knopf 1, 2, 3 oder den Empfänger antippen. Kurz = flach und schnell, halten = hoch über die Abwehr. Grün ist frei. Als Läufer: HAKEN weicht aus, STOSS schiebt Gegner weg.</p>
  <p><b>Abwehr:</b> Aufstellung verdeckt wählen. HECHT tackelt, BALL! kurz vor der Ankunft fängt oder blockt den Pass, WECHSEL nimmt den Verteidiger am Ball. Ohne Stick läuft dein Mann von selbst mit.</p>
  <p><b>Tastatur:</b> WASD/Pfeile laufen, Leertaste/J, K, L (oder 1, 2, 3) für die Knöpfe, Shift Sprint. <b>Gamepad:</b> Stick, A, B, X, rechter Trigger.</p>`,
  onSolo: ({ seed, level }) => { fresh(); rt.solo(seed, level); },
  onOnline: ({ role, seed }) => { fresh(); rt.online(role, seed); },
  onMenu: () => stop(), onLost: () => stop()
});
function fresh() { ui.sel = 0; ui.touched = false; ui.locked = false; ui.play = -1; ui.tag = -1; ui.call = null; ui.seen = {}; view.reset(); }
function stop() { rt.stop(); current = null; hud.setVisible(false); view.reset(); }

// Stick und Knöpfe -> Logik: Die Richtung folgt dem Bild. Der Angriff blickt nach +z, die Abwehr nach -z.
function readInput() {
  const c = controls.read(), s = current, flip = s && s.off !== shell.state.me ? -1 : 1;
  return { x: c.x * flip, z: -c.y * flip, a: c.a, b: c.b, c: c.c, d: c.d, r: ui.playing ? ui.tag : -1, p: s && s.ph === 'pick' && ui.locked && ui.play === s.play ? ui.sel : -1, n: s ? s.play : 0 };
}

const mineOrNear = (e, s) => e.k !== undefined && controlled(s, shell.state.me) === e.k;
function onEvent(e, s) {
  const me = shell.state.me; view.event(e, s);
  const sounds = { snap: ['snap'], handoff: ['catch'], throw: ['pass', e.high], catch: ['catch'], swat: ['swat'], int: ['swat'], tackle: ['tackle', e.p], shed: ['tackle', 0.1], block: ['tackle', 0], juke: ['juke'], stiff: ['juke'], dive: ['juke'], jump: ['jump'], switch: ['tick'], lock: ['tick'], drop: ['swat'] }[e.type];
  if (sounds) audio.play(sounds[0], sounds[1]);
  if (e.type === 'td') { audio.play('whistle'); audio.play(e.s === me ? 'cheer' : 'groan'); if (e.s === me) audio.play('fanfare'); audio.vibrate([40, 50, 90]); }
  else if (e.type === 'int') { audio.play('sting'); audio.play(s.off !== me ? 'cheer' : 'groan'); audio.vibrate(70); }
  else if (e.type === 'tackle') { audio.play('whistle'); if (mineOrNear(e, s) || s.off === me) audio.vibrate(Math.round(30 + (e.p || 0) * 60)); }
  else if (['oob', 'incomplete', 'swat', 'drop', 'timeout'].includes(e.type)) audio.play('whistle');
  else if (e.type === 'first') audio.play(e.s === me ? 'cheer' : 'groan');
  const c = callout(e, s, me);
  if (c && (!ui.call || c[0] >= ui.call[0])) { if (!ui.call) queueMicrotask(() => { const x = ui.call; ui.call = null; if (x && shell.playing()) shell.banner(x[1], x[2], x[3] / SPEED); }); ui.call = c; }
}
rt = createRealtime({ shell, sim, readInput, onEvent });

/* ---------- Anzeige je Phase ---------- */
const root = document.body;
function buttons(s, offense) {
  const set = (id, label) => { controls.showButton(id, !!label); if (label) controls.setLabel(id, label); };
  let mode = 'def', labels = ['HECHT', 'WECHSEL', 'BALL!', 'SPRINT'];
  if (offense) {
    if (s.ph === 'set' || s.ph === 'pick') { mode = 'set'; labels = ['SNAP', '', '', '']; }
    else if (canPass(s)) { mode = 'pass'; labels = ['PASS 1', 'PASS 2', 'PASS 3', 'SPRINT']; }
    else { mode = 'run'; labels = ['HAKEN', 'STOSS', '', 'SPRINT']; }
  } else if (s.ph === 'set' || s.ph === 'pick') { mode = 'defset'; labels = ['', 'WECHSEL', '', '']; }
  if (s.ph === 'dead' && root.dataset.pad) return;
  ['a', 'b', 'c', 'd'].forEach((id, i) => set(id, labels[i])); root.dataset.pad = mode;
}
function hint(s, offense) {
  const touch = controls.touchVisible() || matchMedia('(pointer: coarse)').matches, count = (k) => { if (ui.seen[k] === undefined || ui.seen[k] === s.play) { ui.seen[k] = s.play; return true; } ui.seen[k + 'n'] = ui.seen[k + 'n'] || new Set(); ui.seen[k + 'n'].add(s.play); return ui.seen[k + 'n'].size < 2; };
  let k = '', t = '';
  if (s.ph === 'pick' && !touch) { k = 'pick'; t = 'Tasten 1–' + (offense ? 4 : 3) + ' oder Pfeile, Leertaste legt fest'; }
  else if (s.ph === 'set') { k = offense ? 'set' : 'dset'; t = offense ? (touch ? 'SNAP, wenn du bereit bist' : 'Leertaste: Snap') : 'Du steuerst die Figur mit dem Pfeil'; }
  else if (s.ph === 'live' && offense) { if (canPass(s)) { k = 'pass'; t = touch ? 'Pass kurz = flach · halten = hoch' : '1, 2, 3 kurz = flach · halten = hoch'; } else if (s.ball.m === 'held') { k = 'run'; t = 'HAKEN weicht aus · STOSS schiebt weg'; } }
  else if (s.ph === 'live') { k = s.ball.m === 'air' ? 'ball' : 'tackle'; t = s.ball.m === 'air' ? 'BALL! kurz vor der Ankunft' : 'HECHT zum Tackeln · WECHSEL zum Ball'; }
  shell.hint(k && count(k) ? t : '');
}
function measure(s) {
  const w = innerWidth, h = innerHeight, I = { top: 8, bottom: 14, left: 8, right: 8 };
  const box = (e) => (e && !e.hidden && e.offsetParent !== null ? e.getBoundingClientRect() : null);
  for (const e of [document.querySelector('#hud .score'), hud.chip, w < h ? $('hint') : null]) {
    const r = e && !e.hidden ? e.getBoundingClientRect() : null; if (!r || !r.height) continue;
    if (r.top < h * 0.4 && !(w > h && r.right < w * 0.25)) I.top = Math.max(I.top, r.bottom + 6);   // Feld in der Ecke verdeckt nichts Wichtiges
  }
  const panel = box(hud.panel) || (!hud.panel.hidden ? hud.panel.getBoundingClientRect() : null);
  if (panel && panel.height) I.bottom = h - panel.top + 6;
  else if (controls.touchVisible() && s && s.ph !== 'pick') {
    const stick = $('stickBase').getBoundingClientRect(), acts = [...document.querySelectorAll('#touch .act')].filter((e) => !e.hidden).map((e) => e.getBoundingClientRect());
    const aTop = Math.min(h - 190, ...acts.map((r) => r.top)), aLeft = Math.min(w - 180, ...acts.map((r) => r.left));
    if (w / h > 1.2) { I.left = Math.min(w * 0.22, stick.right + 4); I.right = Math.min(w * 0.24, w - aLeft + 4); }
    else I.bottom = h - Math.min(stick.top, aTop) + 4;
  }
  if (w >= 900 && h >= 600 && !controls.touchVisible()) { I.left = I.right = 20; }
  return I;
}

/* ---------- Tastatur und Gamepad für die Kartenwahl ---------- */
function move(step) { if (ui.locked) return; ui.sel = (ui.sel + step + options()) % options(); audio.play('tick'); }
addEventListener('keydown', (e) => {
  if (!ui.playing || !current || current.ph !== 'pick' || /INPUT|TEXTAREA/.test(e.target.tagName) || e.repeat) return;
  const d = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
  if (d) { const i = Number(d[1]) - 1; if (i < options() && !ui.locked) { if (ui.sel === i && ui.touched) confirm(); else { ui.sel = i; ui.touched = true; audio.play('tick'); } } e.preventDefault(); }
  else if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowUp' || e.code === 'KeyW') { move(-1); e.preventDefault(); }
  else if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'ArrowDown' || e.code === 'KeyS') { move(1); e.preventDefault(); }
  else if ((e.code === 'Space' || e.code === 'Enter') && !(e.target.closest && e.target.closest('button'))) { confirm(); e.preventDefault(); }
});
let padPrev = { x: 0, a: false };
function gamepadPick() {
  const gp = (navigator.getGamepads ? [...navigator.getGamepads()] : []).find(Boolean); if (!gp) return;
  const x = gp.axes[0] > 0.5 || (gp.buttons[15] && gp.buttons[15].pressed) ? 1 : gp.axes[0] < -0.5 || (gp.buttons[14] && gp.buttons[14].pressed) ? -1 : 0, a = !!(gp.buttons[0] && gp.buttons[0].pressed);
  if (x && x !== padPrev.x) move(x); if (a && !padPrev.a) confirm(); padPrev = { x, a };
}

/* ---------- Schleife ---------- */
const backdrop = sim.create(4);                                                      // Aufstellung als Kulisse hinter dem Menü
addEventListener('resize', () => view.resize()); view.resize();
let last = performance.now(), frames = 0, stepDist = 0, lastPos = null, lastRush = 0;
function loop(now) {
  const real = Math.max(0, (now - last) / 1000), dt = Math.min(0.1, real); last = now; frames++;
  const screen = shell.state.screen, me = shell.state.me;
  ui.playing = screen === 'play';
  const picking = !!current && current.ph === 'pick';
  controls.setEnabled(ui.playing && !picking);
  const s = rt.update(Math.min(0.25, real) * SPEED); current = s;
  if (s) {
    const offense = s.off === me;
    if (s.play !== ui.play && s.ph === 'pick') { ui.play = s.play; ui.locked = false; ui.touched = false; ui.tag = -1; ui.sel = offense ? (s.off === ui.last[0] ? ui.last[1] : 0) : 0; if (ui.sel >= options()) ui.sel = 0; }
    if (s.ph === 'pick' && ui.playing) { gamepadPick(); if (s.pt >= TIME.pick - 0.7) confirm(); }      // sonst gilt die markierte Karte
    if (s.ph !== 'pick' && offense && s.call.o < PLAYS.length) ui.last = [s.off, s.call.o];
    if (ui.playing) { buttons(s, offense); hint(s, offense); }
    const series = hud.update(s, me, view, ui); shell.setSub(series);
    if (screen !== 'play' && screen !== 'pause') hud.setVisible(false);
    // Geräusche aus dem Verlauf: Schritte der eigenen Figur, Signal wenn der Rusher losdarf, Stimmung
    const p = s.pl[controlled(s, me)];
    if (p && s.ph === 'live' && lastPos) { const d = Math.hypot(p.x - lastPos[0], p.z - lastPos[1]); if (d < 1) stepDist += d; if (stepDist > 1.5) { stepDist = 0; audio.play('step'); } }
    lastPos = p ? [p.x, p.z] : null;
    const rushing = s.ph === 'live' && canPass(s) && s.call.d >= 0 && s.pt >= FORMATIONS[s.call.d].rushWait ? 1 : 0; if (rushing && !lastRush) audio.play('rush'); lastRush = rushing;
    audio.excite(s.ph === 'live' ? (s.ball.m === 'air' ? 1 : 0.5) : s.ph === 'dead' && s.res && s.res.type === 'td' ? 0.9 : 0.1);
  } else { hud.setVisible(false); shell.hint(''); }
  ui.insets = measure(s);
  const shown = s || backdrop;
  view.frame(shell.paused() ? 0 : dt * (s ? Math.min(SPEED, 2) : 1), shown, { me: s ? me : 0, insets: ui.insets, preview: s && s.ph === 'pick' ? ui.sel : null });
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
shell.start();

/* Zugang für Tests: ablesen; raw schickt eine Nachricht an den Mitspieler, um Unsinn zu prüfen */
window.__game = {
  shell: () => shell.snapshot(), sim: () => rt.state(), controls: () => controls.read(), sounds: () => audio.log.slice(),
  view: () => {
    const s = current || backdrop, me = current ? shell.state.me : 0;
    return Object.assign(view.info(), { frames, sel: ui.sel, locked: ui.locked, controlled: controlled(s, me), targets: TARGETS.slice(), colors: TAG.slice(),
      players: s.pl.map((p) => ({ feet: view.project(p.x, 0, p.z), head: view.project(p.x, 2.4, p.z) })), ball: view.project(s.ball.x, s.ball.y, s.ball.z) });
  },
  input: () => readInput(), raw: (o) => shell.send(o)
};
