// Verdrahtung: Menü (Baukasten), Steuerung, Spiellogik, Darstellung, Ton.
import { createShell } from './kit/shell.js';
import { createRealtime } from './kit/realtime.js';
import { createControls } from './kit/controls.js';
import { createAudio } from './kit/audio.js';
import { sim, teamOf, RESTARTS } from './sim.js';
import { TEAMS } from './config.js';
import { createView } from './view.js';
import { createHud, clockText, statTable } from './hud.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const SPEED = Math.min(10, Math.max(0.1, Number(qs.get('speed')) || 1));          // nur für Tests
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Töne nur bei Ereignissen, kein Dauergeräusch
const audio = createAudio('elevennights', {
  tackle: (p, { tone, hiss }) => { tone(130, 45, p ? 0.55 : 0.28, 0.18); hiss(420, 0.8, p ? 0.4 : 0.2, 0.12); },
  slide: (a, { hiss }) => hiss(900, 0.9, 0.22, 0.3, 'bandpass', 0, 0.04),
  head: (a, { tone, hiss }) => { tone(300, 120, 0.3, 0.09, 'triangle'); hiss(900, 1, 0.2, 0.05); },
  blip: (a, { tone }) => tone(720, 1040, 0.07, 0.06, 'triangle')
});
// Online kommt in einer späteren Phase: ein Einladungslink wird hier noch nicht angenommen
if (/^#m=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);

let view;
try { view = createView($('stage'), { reducedMotion: calm }); }
catch (e) { $('boot').textContent = 'Dieser Browser kann die 3D-Grafik nicht darstellen.'; throw e; }

const controls = createControls({ buttons: [
  { id: 'pass', label: 'PASS', keys: ['KeyJ'], pad: 0, color: '#2ee59d' },
  { id: 'shoot', label: 'SCHUSS', keys: ['KeyK'], pad: 1, color: '#ff5a6e' },
  { id: 'sprint', label: 'SPRINT', keys: ['ShiftLeft', 'ShiftRight'], pad: 7, color: '#ffd34d' },
  { id: 'switch', label: 'WECHSEL', keys: ['Space'], pad: 4, color: '#38bdf8' },
  { id: 'through', label: 'STEIL', keys: [], pad: 3, color: '#38bdf8' }
] });
controls.showButton('through', false);                       // am Handy: PASS nach oben wischen
// Steilpass auf Taste I (der Baukasten kennt die Taste nicht) und als Wisch auf PASS
let keyI = false, tapI = false, swipe = false, swipeFrom = null;
const typing = (e) => e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
addEventListener('keydown', (e) => { if (e.code !== 'KeyI' || typing(e)) return; keyI = true; if (!e.repeat) tapI = true; });
addEventListener('keyup', (e) => { if (e.code === 'KeyI') keyI = false; });
addEventListener('blur', () => { keyI = tapI = false; });
const passButton = document.querySelector('#touch [data-act=pass]');
passButton.addEventListener('pointerdown', (e) => { swipe = false; swipeFrom = { id: e.pointerId, y: e.clientY, x: e.clientX }; passButton.classList.remove('steil'); });
passButton.addEventListener('pointermove', (e) => { if (!swipeFrom || e.pointerId !== swipeFrom.id || swipe) return; if (swipeFrom.y - e.clientY > 24 && Math.abs(e.clientX - swipeFrom.x) < (swipeFrom.y - e.clientY) * 1.4) { swipe = true; passButton.classList.add('steil'); audio.play('blip'); } });
for (const n of ['pointerup', 'pointercancel']) passButton.addEventListener(n, (e) => { if (swipeFrom && e.pointerId === swipeFrom.id) { swipeFrom = null; passButton.classList.remove('steil'); } });

let rt, aim = { x: 0, z: 0 }, hud;
const shell = createShell({
  id: 'elevennights', title: ['ELEVEN', 'NIGHTS'], tagline: 'Flutlichtfußball · elf gegen elf · zweimal drei Minuten', audio, colors: ['#ff5a36', '#2f7dff'],
  help: `<p><b>Ziel:</b> mehr Tore in zwei Halbzeiten zu je drei Minuten. Du führst die roten ${TEAMS[0].name}, der Ring und der gelbe Pfeil zeigen deinen Spieler.</p>
  <p><b>Mit Ball:</b> PASS kurz tippen, länger halten spielt weiter. PASS nach oben wischen = Steilpass. SCHUSS halten lädt die Stärke; mit dem Stick zielst du auf eine Ecke. SPRINT kostet Ausdauer.</p>
  <p><b>Ohne Ball:</b> DRUCK halten läuft den Gegner an, kurz tippen greift an. GRÄTSCHE ist weit, aber wer danebenrutscht, liegt kurz am Boden. WECHSEL nimmt den Spieler näher am Ball.</p>
  <p><b>Tastatur:</b> WASD oder Pfeile laufen, J Pass/Druck, I Steilpass, K Schuss/Grätsche, Shift Sprint, Leertaste Wechsel. <b>Gamepad:</b> Stick, A Pass, B Schuss, Y Steilpass, LB Wechsel, RT Sprint.</p>
  <p>Ohne Eingabe läuft dein Spieler von selbst mit. Standards (Einwurf, Ecke, Abstoß) führt nach einigen Sekunden der Computer aus.</p>`,
  onSolo: ({ seed, level }) => { begin(); rt.solo(seed, level); },
  onOnline: ({ role, seed }) => { begin(); rt.online(role, seed); },
  onMenu: () => stop(), onLost: () => stop()
});
hud = createHud(view);
const statBox = document.createElement('div'); statBox.id = 'endStats'; $('endScore').after(statBox);
let statsShown = false, lastLabel = null;
function begin() { view.reset(); statsShown = false; lastLabel = null; keyI = tapI = swipe = false; statBox.textContent = ''; hud.names = shell.state.names.slice(); }
function stop() { rt.stop(); view.reset(); shell.hint(''); }

// Stick und Knöpfe -> Logik: Die Richtung folgt dem Bild
function readInput() {
  const c = controls.read(), m = view.mapStick(c.x, c.y);
  const steil = c.through || keyI || tapI || (swipe && c.pass);
  tapI = false;
  const i = { x: m.x, z: m.z, pass: c.pass && !swipe, through: !!steil, shoot: c.shoot, sprint: c.sprint, switch: c.switch };
  if (!c.pass && !swipeFrom) swipe = false;
  aim = { x: m.x, z: m.z };
  return i;
}

const RESTART_TEXT = { kickoff: 'Anstoß', throw: 'Einwurf', goalkick: 'Abstoß', corner: 'Ecke' };
function onEvent(e, s) {
  const me = shell.state.me, mine = e.s === me;
  view.event(e, s);
  if (e.type === 'pass') audio.play('kick', e.p * 0.4);
  else if (e.type === 'shot') audio.play('kick', 0.5 + e.p * 0.5);
  else if (e.type === 'header') audio.play('head');
  else if (e.type === 'tackle') { audio.play('tackle', e.p); if (e.k === s.ctl[me]) audio.vibrate(18); }
  else if (e.type === 'slide') audio.play('slide');
  else if (e.type === 'save') { audio.play('save'); shell.banner(mine ? 'GEHALTEN!' : 'PARADE', mine ? 'good' : '', 700); }
  else if (e.type === 'catch') audio.play('tackle', 0);
  else if (e.type === 'post') { audio.play('post'); shell.banner('PFOSTEN!', '', 800); }
  else if (e.type === 'switch') { if (mine) audio.play('blip'); }
  else if (e.type === 'goal') {
    audio.play('net'); audio.play(mine ? 'cheer' : 'groan'); audio.vibrate([70, 40, 140]);
    const who = e.k >= 0 ? view.name(e.k) : '';
    shell.banner(e.p ? 'EIGENTOR' : 'TOR!', mine ? 'good' : 'bad', 2400); shell.hint(who ? (e.p ? 'Eigentor von ' : 'Torschütze: ') + who : ''); setTimeout(() => shell.hint(''), 2600);
  } else if (e.type === 'restart') {
    const kind = RESTARTS[e.k]; if (!kind) return;
    if (kind === 'kickoff') { audio.play('whistle'); shell.banner(s.half === 2 && s.clock < 1 ? '2. HALBZEIT' : 'ANSTOSS', 'role', 1300); } else shell.banner(RESTART_TEXT[kind].toUpperCase(), 'role', 800);
    shell.hint(mine ? RESTART_TEXT[kind] + ': zielen und PASS' + (kind === 'corner' ? ' oder SCHUSS (Flanke)' : '') : ''); if (mine) setTimeout(() => shell.hint(''), 3200);
  } else if (e.type === 'half') { audio.play('whistle'); shell.banner(''); shell.hint(''); }          // die Statistiktafel sagt alles
  else if (e.type === 'final') { shell.banner('ABPFIFF', 'role', 1400); shell.hint(''); }
}
rt = createRealtime({ shell, sim, readInput, onEvent });

// Beschriftung der Knöpfe folgt der Lage: mit Ball angreifen, ohne Ball verteidigen
function labels(s) {
  const me = shell.state.me, b = s.ball, have = (b.own >= 0 && teamOf(b.own) === me) || (b.own < 0 && s.pl && s.rs && s.rs.team === me);
  const attack = have || (b.own < 0 && b.last >= 0 && teamOf(b.last) === me);
  if (attack === lastLabel) return; lastLabel = attack;
  controls.setLabel('pass', attack ? 'PASS ↑STEIL' : 'DRUCK'); controls.setLabel('shoot', attack ? 'SCHUSS' : 'GRÄTSCHE');
  document.body.dataset.ball = attack ? 'mine' : 'theirs';
}

let last = performance.now();
addEventListener('resize', () => view.resize()); view.resize();
function loop(now) {
  const real = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
  const playing = shell.state.screen === 'play';
  controls.setEnabled(playing);
  const s = rt.update(real * SPEED), live = rt.state();
  if (live) {
    shell.setSub(clockText(live)); labels(live);
    if (live.ph === 'over' && shell.state.over && !statsShown) { statsShown = true; statBox.textContent = ''; statBox.appendChild(statTable(live, shell.state.me, shell.state.names)); }
  }
  view.frame(shell.paused() ? 0 : real * Math.min(SPEED, 3), s, { me: shell.state.me, aim, real });
  hud.update(s, shell.state.me, !!live && (playing || shell.state.screen === 'pause'));
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
shell.start();
window.__game = {
  shell: () => shell.snapshot(), sim: () => rt.state(), controls: () => controls.read(), sounds: () => audio.log.slice(),
  view: () => view.info(), hud: () => hud.visible(), project: (x, y, z) => view.project(x, y, z), input: () => aim,
  // nur für Tests: Zustand gezielt herstellen (nur mit ?test und gegen den Computer)
  set: (fn) => { const s = rt.state(); if (!s || !qs.has('test') || rt.mode() !== 'solo') return false; new Function('s', fn)(s); return true; }
};
