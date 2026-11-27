// Verdrahtung: Menü (Baukasten), Steuerung, Kampflogik, Darstellung, Ton.
import { createShell } from './kit/shell.js';
import { createRealtime } from './kit/realtime.js';
import { createControls } from './kit/controls.js';
import { createAudio } from './kit/audio.js';
import { sim, TYPES, totals } from './sim.js';
import { MATCH, PUNCH } from './config.js';
import { createView, CORNER } from './view.js';
import { createPunchPad } from './punchpad.js';
import { createHud } from './hud.js';
import { SOUNDS } from './sounds.js';

const qs = new URLSearchParams(location.search);
const SPEED = Math.min(10, Math.max(0.1, Number(qs.get('speed')) || 1));          // nur für Tests
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const audio = createAudio('shadowboxer', SOUNDS);

let view;
try { view = createView(document.getElementById('stage'), { reducedMotion: calm }); }
catch (e) { document.getElementById('boot').textContent = 'Dieser Browser kann die 3D-Grafik nicht darstellen.'; throw e; }

const controls = createControls({ buttons: [
  { id: 'block', label: 'DECKUNG', keys: ['Space'], pad: 4, color: '#38bdf8' },
  { id: 'duck', label: 'DUCKEN', keys: ['KeyQ', 'ControlLeft'], pad: 6, color: '#2ee59d' },
  { id: 'body', label: 'KÖRPER', keys: ['ShiftLeft', 'ShiftRight'], pad: 5, color: '#ffd34d' },
  { id: 'jab', label: 'JAB', keys: ['KeyJ', 'Digit1'], pad: 2, color: '#ff8a30' },
  { id: 'cross', label: 'CROSS', keys: ['KeyK', 'Digit2'], pad: 3, color: '#ff6a50' },
  { id: 'hook', label: 'HAKEN', keys: ['KeyL', 'Digit3'], pad: 1, color: '#ff4d5e' },
  { id: 'upper', label: 'UPPER', keys: ['KeyE', 'Digit4'], pad: 0, color: '#d946ef' }
] });
const queue = [];                                   // Schläge aus Wischgesten
let tap = false;                                    // Tipp auf die Schlagfläche zählt beim Aufstehen wie „Deckung“
const pad = createPunchPad({ onPunch: (p) => { audio.unlock(); if (queue.length < 3) queue.push(p); }, onTap: () => { const s = rt.state(); if (s && s.phase === 'down') tap = true; } });
const hud = createHud();

let swipe = true; try { swipe = localStorage.getItem('shadowboxer_swipe') !== '0'; } catch (e) { /* ok */ }
let rt, slow = 0, slowScale = 0.35, lastSide = -1;
const shell = createShell({
  id: 'shadowboxer', title: ['SHADOW', 'BOXER'], tagline: 'Title Night · drei Runden um den Gürtel', audio, colors: CORNER,
  help: `<p><b>Handy:</b> links der Stick (zur Seite = ausweichen, hoch und runter = Abstand). Rechts auf freier Fläche schlagen: <b>tippen</b> Jab, <b>hoch</b> Cross, <b>zur Seite</b> Haken, <b>runter</b> Uppercut. DECKUNG, DUCKEN und KÖRPER halten.</p>
  <p><b>Tastatur:</b> WASD, Leertaste Deckung, Q ducken, Shift Körper, J Jab, K Cross, L Haken, E Uppercut, V Kamera.</p>
  <p>Die große Zahl oben zählt die Niederschläge.</p>
  <p><b>So gewinnst du:</b> Ausweichen und sofort kontern macht viel Schaden. Deckung im letzten Moment ist eine Parade. Wildes Schlagen macht müde. Seitschritt hilft gegen gerade Schläge, Ducken gegen Haken, der Uppercut bestraft das Ducken.</p>`,
  onSolo: ({ seed, level }) => { begin(); rt.solo(seed, level); }, onOnline: ({ role, seed }) => { begin(); rt.online(role, seed); },
  onMenu: () => { rt.stop(); view.reset(); }, onLost: () => rt.stop()
});
function begin() { view.reset(); queue.length = 0; slow = 0; tap = false; layout(); }

function readInput() {
  const c = controls.read(), i = { x: c.x, y: c.y, block: c.block || tap, duck: c.duck, body: c.body, side: lastSide };
  tap = false;
  for (const k of TYPES) i[k] = c[k];
  const p = queue.shift(); if (p) { i[p.k] = true; lastSide = i.side = p.side; } else if (c.hook) i.side = lastSide = -1;
  return i;
}

function onEvent(e, s) {
  const me = shell.state.me, solo = rt.mode() === 'solo';
  view.event(e, s);
  if (e.type === 'swing') audio.play('whoosh');
  else if (e.type === 'hit') {
    audio.play(e.body ? 'bodyshot' : 'thud', e.p);
    if (e.side !== me) { hud.hit(e.p); audio.vibrate(Math.round(15 + e.p * 4)); } else if (e.p > 8) audio.vibrate(14);
    if (e.counter) shell.banner(e.side === me ? 'KONTER!' : 'ERWISCHT', e.side === me ? 'good' : 'bad', 700);
    else if (e.combo >= 3 && e.side === me) shell.banner(e.combo + 'ER-KOMBO', 'good', 650);
    if (solo && !calm && (e.counter || e.p >= 12)) { slow = 0.16; slowScale = 0.3; }
    if (e.p >= 13) audio.play('cheer');
  } else if (e.type === 'block') audio.play('guard');
  else if (e.type === 'parry') { audio.play('parry'); shell.banner(e.side === me ? 'PARIERT!' : 'PARADE', e.side === me ? 'good' : 'bad', 750); if (solo && !calm) { slow = 0.22; slowScale = 0.35; } }
  else if (e.type === 'evade') { if (e.side === me) shell.hint('Daneben! Jetzt kontern'), setTimeout(() => shell.hint(''), 700); }
  else if (e.type === 'break') shell.banner('DECKUNG GEBROCHEN', e.side === me ? 'bad' : 'good', 900);
  else if (e.type === 'gassed') { if (e.side === me) audio.play('miss'); }
  else if (e.type === 'down') { audio.play('floor'); audio.play('cheer'); audio.vibrate([60, 40, 120]); shell.banner(e.tko ? 'ABBRUCH!' : e.side === me ? 'DU BIST UNTEN' : 'NIEDERSCHLAG!', e.side === me ? 'bad' : 'good', 1500); if (solo && !calm) { slow = 0.9; slowScale = 0.3; } queue.length = 0; }
  else if (e.type === 'count') audio.play('count', e.n);
  else if (e.type === 'getup') audio.play(e.ok ? 'tick' : 'miss');
  else if (e.type === 'up') { audio.play('cheer'); shell.banner(e.side === me ? 'DU STEHST!' : 'WIEDER OBEN', e.side === me ? 'good' : '', 1000); }
  else if (e.type === 'bell') audio.play('bell', e.end ? 3 : 1);
  else if (e.type === 'over') { audio.play('bell', 3); audio.play('cheer'); const how = { ko: 'K. O.!', tko: 'TECHNISCHER K. O.' }[e.how] || 'NACH PUNKTEN'; shell.banner(how, '', 2200); }
}
rt = createRealtime({ shell, sim, readInput, onEvent });

// Ergebnistext: Art des Sieges und Punktzettel
function verdict(s) {
  const me = shell.state.me, names = shell.state.names, st = s.f[me].stats;
  const how = s.how === 'ko' ? 'K. o. in Runde ' + s.round : s.how === 'tko' ? 'Technischer K. o. in Runde ' + s.round : 'Punktentscheidung (' + s.how + ')';
  const cards = s.how === 'ko' || s.how === 'tko' ? '' : '\nRichter: ' + totals(s).map((c) => c[me] + ':' + c[1 - me]).join(' · ');
  return how + cards + '\nDeine Treffer: ' + st.landed + ' von ' + st.thrown + ' · Konter: ' + st.counters + ' · Paraden: ' + st.parries;
}

/* ---------- Oberfläche ---------- */
const camBtn = document.createElement('button'); camBtn.type = 'button'; camBtn.id = 'btnCam'; camBtn.textContent = '🎥'; camBtn.setAttribute('aria-label', 'Kamera wechseln');
document.querySelector('#hud .tools').prepend(camBtn);
let first = false; try { first = localStorage.getItem('shadowboxer_cam') === 'first'; } catch (e) { /* ok */ }
const setCam = (f) => { first = f; view.setCamera(f ? 'first' : 'shoulder'); try { localStorage.setItem('shadowboxer_cam', f ? 'first' : 'shoulder'); } catch (e) { /* ok */ } };
camBtn.onclick = () => { setCam(!first); shell.toast(first ? 'Ich-Sicht' : 'Schulterblick'); };
addEventListener('keydown', (e) => { if (e.code === 'KeyV' && !e.repeat && !/INPUT|TEXTAREA/.test(e.target.tagName)) camBtn.click(); });
setCam(first);
const modeBtn = document.createElement('button'); modeBtn.type = 'button'; modeBtn.id = 'btnSwipe'; modeBtn.className = 'ghost';
const modeLabel = () => { modeBtn.textContent = 'Schlagen am Handy: ' + (swipe ? 'Wischen' : 'Knöpfe'); };
modeBtn.onclick = () => { swipe = !swipe; try { localStorage.setItem('shadowboxer_swipe', swipe ? '1' : '0'); } catch (e) { /* ok */ } modeLabel(); layout(); };
document.querySelector('#menu details').before(modeBtn); modeLabel();
function layout() { for (const k of TYPES) controls.showButton(k, !swipe); document.body.dataset.punch = swipe ? 'swipe' : 'buttons'; }
layout();

let last = performance.now(), frames = 0, told = false;
addEventListener('resize', () => view.resize()); view.resize();
function loop(now) {
  const real = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now; frames++;
  const playing = shell.state.screen === 'play';
  controls.setEnabled(playing); pad.setEnabled(playing && swipe);
  if (slow > 0) slow -= real;
  const rate = slow > 0 && rt.mode() === 'solo' ? slowScale : 1;
  const s = rt.update(real * SPEED * rate);
  const live = rt.state();
  if (live) {
    shell.setSub(live.phase === 'rest' ? 'Pause' : 'Runde ' + live.round + '/' + MATCH.rounds + ' · ' + Math.floor(Math.ceil(live.clock) / 60) + ':' + String(Math.ceil(live.clock) % 60).padStart(2, '0'));
    if (live.phase === 'intro' && live.pt < 0.2 && playing && !told) { told = true; shell.banner('RUNDE ' + live.round, 'role', 1700); } else if (live.phase !== 'intro') told = false;
    if (shell.state.over) { const e = document.getElementById('endScore'), t = verdict(live); if (e.textContent !== t) e.textContent = t; }
  }
  view.frame(shell.paused() ? 0 : real * Math.min(SPEED, 3) * rate, s, { me: shell.state.me });
  hud.update(real, s, shell.state.me, shell.state.names, shell.state.screen === 'play' || shell.state.screen === 'pause');
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
shell.start();
window.__game = {
  shell: () => shell.snapshot(), sim: () => rt.state(), controls: () => controls.read(), sounds: () => audio.log.slice(), net: () => shell.net,
  view: () => Object.assign(view.info(), { frames, swipe }),
  // nur für Tests: Zustand gezielt herstellen
  set: (patch) => { const s = rt.state(); if (!s || rt.mode() !== 'solo') return false; if (patch.gap) s.gap = patch.gap; if (patch.clock !== undefined) s.clock = patch.clock; if (patch.hp) patch.hp.forEach((v, i) => { if (v !== null) s.f[i].hp = v; }); if (patch.round) s.round = patch.round; return true; },
  ranges: () => Object.fromEntries(TYPES.map((k) => [k, PUNCH[k].range]))
};
