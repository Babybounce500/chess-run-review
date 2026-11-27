// Verdrahtung: Baukasten, Spiellogik, 3D-Szene, Töne und Anzeigen.
import { createShell } from './kit/shell.js';
import { createRealtime } from './kit/realtime.js';
import { createControls } from './kit/controls.js';
import { createAudio } from './kit/audio.js';
import { sim } from './sim.js';
import { createView } from './view.js';
import { createHud } from './hud.js';
import { createFeedback } from './feedback.js';
import { SOUNDS } from './sounds.js';
import { TEAM_CSS } from './config.js';

const qs = new URLSearchParams(location.search);
const SPEED = Math.min(8, Math.max(0.25, Number(qs.get('speed')) || 1));          // nur für Tests
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = document.getElementById('stage');
let view;
try { view = createView(stage, { reducedMotion }); }
catch (e) { document.getElementById('boot').textContent = 'Dieses Gerät kann die 3D-Grafik nicht anzeigen.'; throw e; }

const audio = createAudio('blacktop', SOUNDS);
const controls = createControls({
  buttons: [
    { id: 'a', label: 'WURF', keys: ['Space', 'KeyJ'], pad: 0, color: '#ff8a30' },
    { id: 'b', label: 'TRICK', keys: ['KeyK', 'KeyE'], pad: 2, color: '#52e0a4' },
    { id: 'c', label: 'SPRINT', keys: ['ShiftLeft', 'ShiftRight', 'KeyL'], pad: 7, color: '#46bfff' }
  ]
});
const hud = createHud(view);
let rt, feedback, held = false, seen = -1;

const stop = () => { rt.stop(); view.reset(); hud.reset(); };
function begin(start) { start(); view.setSide(shell.state.me); view.reset(); hud.reset(); feedback.reset(); held = false; seen = -1; layout(); }
const shell = createShell({
  id: 'blacktop', title: ['BLACKTOP', 'HOOPS'], tagline: '1 gegen 1 auf dem Asphalt · bis 11', colors: TEAM_CSS, audio,
  help: '<p><b>Angriff:</b> WURF halten und im grünen Bereich loslassen. Kurz antippen ist eine Wurffinte. In Korbnähe wird daraus ein Korbleger, im Sprint ein Dunk. TRICK bricht seitlich oder nach hinten aus.</p>'
    + '<p><b>Verteidigung:</b> KLAU im Moment, in dem der Ball unten und auf deiner Seite ist. Daneben greifen kostet Zeit. BLOCK beim Absprung des Gegners. Mit dem Körper ausboxen.</p>'
    + '<p>Nach Ballgewinn erst hinter die Dreierlinie. 2 und 3 Punkte, 14 Sekunden Wurfuhr, wer zuerst 11 hat, gewinnt.</p>'
    + '<p><b>Tastatur:</b> Pfeile/WASD, Leertaste Wurf/Block, K Trick/Klau, Umschalt Sprint. <b>Gamepad:</b> Stick, A, X, RT.</p>',
  onSolo: ({ seed, level }) => begin(() => rt.solo(seed, level)), onOnline: ({ role, seed }) => begin(() => rt.online(role, seed)), onMenu: stop, onLost: stop
});
feedback = createFeedback({ shell, audio, view, hud, controls });

function readInput() {
  const i = controls.read(), w = view.stickToWorld(i.x, i.y);
  let m = -1;
  if (rt.mode() === 'guest') {                                   // Gast: den gesehenen Anzeigewert beim Loslassen mitschicken
    const p = rt.state() && rt.state().p[1];
    if (held && !i.a) seen = p && p.act === 'gather' ? Math.round(p.ch * 100) / 100 : -1;
    if (i.a) seen = -1;
    held = i.a; m = seen;
  }
  return { x: w.x, y: w.y, a: i.a, b: i.b, c: i.c, m };
}
rt = createRealtime({ shell, sim, readInput, onEvent: (e, s) => feedback.event(e, s) });

// Freie Bildfläche für die Kamera: unter der Anzeige, über bzw. zwischen den Knöpfen
function layout() {
  const W = stage.clientWidth || innerWidth, H = stage.clientHeight || innerHeight, rect = (s) => { const e = document.querySelector(s); return e && e.getBoundingClientRect(); };
  const score = rect('#hud .score'), tools = rect('#hud .tools'), insets = { top: score && score.height ? score.bottom + 14 : Math.min(90, H * 0.14), bottom: Math.max(18, H * 0.06), left: 8, right: 8 };
  if (tools && tools.height && tools.left < W * 0.74) insets.top = Math.max(insets.top, tools.bottom + 12);      // Hochformat: Brett unter den Knöpfen halten
  if (controls.touchVisible()) {
    const stick = rect('#stickBase'), acts = [...document.querySelectorAll('#touch .act')].map((e) => e.getBoundingClientRect()).filter((r) => r.width);
    if (stick && stick.width && acts.length) {
      const left = Math.min(...acts.map((r) => r.left)), top = Math.min(stick.top, ...acts.map((r) => r.top));
      if (W / H < 1.15) insets.bottom = H - top + 4;
      else { insets.left = stick.right * 0.9; insets.right = (W - left) * 0.9; insets.bottom = Math.max(34, H * 0.05); }
    }
  } else if (document.body.dataset.screen === 'menu') insets.top = 10;
  view.setInsets(insets);
}
function resize() { view.resize(); layout(); }
addEventListener('resize', resize); resize();

let last = performance.now(), layoutKey = '', layoutAt = 0;
(function loop(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
  const screen = shell.state.screen;
  controls.setEnabled(screen === 'play');
  const key = screen + controls.touchVisible() + innerWidth + 'x' + innerHeight;
  if (key !== layoutKey || now - layoutAt > 400) { layoutKey = key; layoutAt = now; layout(); }      // Anzeige kann ihre Höhe ändern
  const s = rt.update(dt * SPEED);
  view.frame(shell.paused() ? 0 : dt * Math.min(SPEED, 3), s);
  hud.update(dt * SPEED, s, shell.state.me, screen === 'play');
  feedback.frame(dt, s);
  requestAnimationFrame(loop);
})(last);
shell.start();
window.__game = { shell: () => shell.snapshot(), sim: () => rt.state(), controls: () => controls.read(), sounds: () => audio.log.slice(), view: () => view.info(), hud: () => hud.info() };
