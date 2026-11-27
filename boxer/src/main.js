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
import { createShow, RIVALS } from './show.js';
import { createOnline, NET } from './online.js';
import { createCareer, byKey } from './career.js';
import { createTraining } from './training.js';
import { createReaction } from './reaction.js';
import { applyFight, tierOf, readPoints, rankText } from './rank.js';

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
  <p><b>Karriere:</b> fünf Gegner mit eigenem Stil bis zum Titel. <b>Training:</b> die Leiste zeigt, wann du für eine Parade drücken musst. <b>Rang:</b> Kämpfe bringen Punkte von Bronze bis Champion, gespeichert nur auf diesem Gerät.</p>
  <p><b>Online:</b> beide haben dieselben Werte. Alle Schläge sind etwas langsamer, und der Gastgeber bekommt so viel Verzögerung, wie der Gast durch die Leitung verliert (oben rechts angezeigt). Serie bis zwei Siege.</p>
  <p><b>So gewinnst du:</b> Ausweichen und sofort kontern macht viel Schaden. Deckung im letzten Moment ist eine Parade. Wildes Schlagen macht müde. Seitschritt hilft gegen gerade Schläge, Ducken gegen Haken, der Uppercut bestraft das Ducken.</p>`,
  onSolo: ({ seed, level }) => {
    begin(); rt.solo(seed, level);
    if (level === 'train') { const s = rt.state(); s.phase = 'fight'; s.gap = 1.4; training.start(s); shell.banner('TRAINING', 'role', 1200); }
  },
  onOnline: ({ role, seed }) => { online.reset(); begin(); rt.online(role, seed); rt.state().pace = NET.pace; },
  onMenu: () => { leaveFight(); rt.stop(); show.stop(); online.stop(); training.stop(); view.reset(); shell.state.level = shell.store.get('level', 'normal'); rankBadge(); }, onLost: () => { leaveFight(); rt.stop(); show.stop(); online.stop(); training.stop(); }
});
const online = createOnline({ shell, testLag: qs.has('test') ? Math.min(500, Number(qs.get('netlag')) || 0) : 0 });
const show = createShow({ view, audio, shell, onSkip: () => { told = false; } });
let showOn = true; try { showOn = localStorage.getItem('shadowboxer_show') !== '0'; } catch (e) { /* ok */ }
if (qs.get('show') === '0') showOn = false;
show.setEnabled(showOn);
function begin() {
  view.reset(); queue.length = 0; slow = 0; tap = false; layout();
  // der Gegner bekommt Namen und Gesicht
  const level = shell.state.level, names = shell.state.names;
  if (shell.state.mode === 'solo') { names[1] = level === 'train' ? 'Partner' : (RIVALS[level] || RIVALS.normal).name; document.getElementById('name1').textContent = names[1]; }
  const record = (key) => { try { const r = JSON.parse(shell.store.get(key, '')); return { w: r.w || 0, l: r.l || 0 }; } catch (e) { return { w: 0, l: 0 }; } };
  let w = 0, l = 0, duel = null;
  if (shell.state.mode === 'online') {                    // Bilanz gegeneinander, aus beiden Blickwinkeln
    const me = shell.state.me, r = record('friend_' + names[1 - me].toLowerCase());
    duel = []; duel[me] = r.w + ' – ' + r.l; duel[1 - me] = r.l + ' – ' + r.w;
  } else for (const k of ['easy', 'normal', 'hard', 'k1', 'k2', 'k3', 'k4', 'k5']) { const r = record('cpu_' + k); w += r.w; l += r.l; }
  show.reset(level, names, w + ' – ' + l, duel); document.getElementById('fightCard').textContent = ''; carded = false; pressAt = 0; wasBlock = false;
  training.stop(); reaction.reset(); career.close(); nextKey = null; for (const id of ['rankLine', 'btnNext', 'btnHigh']) document.getElementById(id).hidden = true;
  if (level === 'train' && shell.state.mode === 'solo') show.stop();
  // festhalten, was für die Wertung zählt: beim Verlassen hat der Baukasten schon umgestellt
  fight = { online: shell.state.mode === 'online', level, me: shell.state.me, names: names.slice(), training: shell.state.mode === 'solo' && level === 'train' }; done = null;
}
let fight = null, done = null;
let pressAt = 0, wasBlock = false;

function readInput() {
  const c = controls.read(), i = { x: c.x, y: c.y, block: c.block || tap, duck: c.duck, body: c.body, side: lastSide };
  tap = false;
  for (const k of TYPES) i[k] = c[k];
  const p = queue.shift(); if (p) { i[p.k] = true; lastSide = i.side = p.side; } else if (c.hook) i.side = lastSide = -1;
  // welchen Augenblick man beim Drücken gesehen hat (Reaktionszeit, Training, online das Aufstehen)
  const s = rt.state();
  if (s) { reaction.input(s.t, i.block || i.duck || Math.abs(i.x) > 0.35); if (i.block && !wasBlock) { pressAt = s.t; training.press(s.t); } }
  wasBlock = i.block;
  if (shell.state.mode !== 'online') return i;
  i.at = i.block ? pressAt : 0;
  return shell.state.role === 'host' ? online.own(i) : i;
}

function onEvent(e, s) {
  const me = shell.state.me, solo = rt.mode() === 'solo';
  view.event(e, s);
  if (training.active()) training.event(e, s);
  else { show.event(e, s); if ((e.type === 'evade' || e.type === 'parry') && e.side === me) reaction.success(); }
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
  else if (e.type === 'over') { audio.play('bell', 3); audio.play('cheer'); const how = { ko: 'K. O.!', tko: 'TECHNISCHER K. O.' }[e.how] || 'NACH PUNKTEN'; shell.banner(how, '', 1600); }
}
rt = createRealtime({ shell: online.link, sim, readInput, onEvent, delay: NET.delay, sendEvery: NET.sendEvery });

const reaction = createReaction();
const training = createTraining({ reaction });
const career = createCareer({ store: shell.store, onFight: startFight, onClose: () => rankBadge() });
// Kampf gegen einen bestimmten Gegner oder Training: Stufe setzen und den Startknopf des Baukastens benutzen
function startFight(level, button = 'btnSolo') { shell.state.level = level; document.getElementById(button).click(); }
const fightCard = document.createElement('div'); fightCard.id = 'fightCard'; document.getElementById('endScore').after(fightCard);
let carded = false;
// Ergebnistext: Art des Sieges und Punktzettel
function verdict(s) {
  const me = shell.state.me, names = shell.state.names, st = s.f[me].stats;
  const how = s.how === 'ko' ? 'K. o. in Runde ' + s.round : s.how === 'tko' ? 'Technischer K. o. in Runde ' + s.round : 'Punktentscheidung (' + s.how + ')';
  const cards = s.how === 'ko' || s.how === 'tko' ? '' : '\nRichter: ' + totals(s).map((c) => c[me] + ':' + c[1 - me]).join(' · ');
  const quick = reaction.best() === null ? '' : '\nSchnellste Reaktion: ' + reaction.best() + ' ms';
  const series = quick + (shell.state.mode === 'online' ? '\n' + online.seriesText(names) : '');
  return how + cards + '\nDeine Treffer: ' + st.landed + ' von ' + st.thrown + ' · Konter: ' + st.counters + ' · Paraden: ' + st.parries + series;
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
const showBtn = document.createElement('button'); showBtn.type = 'button'; showBtn.id = 'btnShow'; showBtn.className = 'ghost';
const showLabel = () => { showBtn.textContent = 'TV-Übertragung: ' + (show.enabled() ? 'an' : 'aus'); };
showBtn.onclick = () => { show.setEnabled(!show.enabled()); try { localStorage.setItem('shadowboxer_show', show.enabled() ? '1' : '0'); } catch (e) { /* ok */ } showLabel(); };
modeBtn.after(showBtn); showLabel();
document.getElementById('btnSkipShow').onclick = () => show.skip();
// Enter oder Leertaste überspringen Einmarsch und Wiederholung
addEventListener('keydown', (e) => { if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat && !/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName) && (show.info().walk !== null || show.info().replay) && (shell.state.screen === 'play' || show.info().replay?.kind === 'highlight')) { e.preventDefault(); show.skip(); } });
// Rang, Karriere und Training im Menü; auf dem Abschlussbild Rangzeile, nächster Gegner und Höhepunkt
const badge = document.createElement('p'); badge.id = 'rankBadge'; document.getElementById('tagline').after(badge);
function rankBadge() { const p = readPoints(shell.store), t = tierOf(p); badge.textContent = t.icon + ' ' + t.name + ' · ' + p + ' Punkte' + (career.progress() >= 5 ? ' · Gürtelträger' : ''); badge.style.setProperty('--share', Math.round(t.share * 100) + '%'); }
const modes = document.createElement('div'); modes.className = 'row modes';
for (const [id, label, fn] of [['btnCareer', '🏆 Karriere', () => career.open()], ['btnTrain', '🎯 Training', () => startFight('train')]]) { const b = document.createElement('button'); b.type = 'button'; b.id = id; b.className = 'ghost'; b.textContent = label; b.onclick = () => { audio.unlock(); fn(); }; modes.appendChild(b); }
document.getElementById('btnSolo').after(modes);
const rankLine = document.createElement('p'); rankLine.id = 'rankLine'; rankLine.hidden = true; document.getElementById('endTitle').after(rankLine);
let nextKey = null;
for (const [id, label, cls, fn] of [['btnHigh', '▶ Höhepunkt ansehen', 'ghost', () => show.highlight()], ['btnNext', 'Nächster Gegner ▸', 'primary', () => { if (nextKey) startFight(nextKey, 'btnAgain'); }]]) { const b = document.createElement('button'); b.type = 'button'; b.id = id; b.className = cls; b.textContent = label; b.hidden = true; b.onclick = () => { b.blur(); fn(); }; document.getElementById('btnAgain').before(b); }
// Kampf werten, sobald er entschieden ist (nicht erst beim Abschlussbild): Rangpunkte, Serie, Karriere
function commit(s) {
  if (done || !fight || fight.training) return;
  const me = fight.me, level = fight.level, result = s.win === me ? 'win' : s.win === 1 - me ? 'loss' : 'draw';
  const key = fight.online ? 'friend_' + fight.names[1 - me].toLowerCase() : 'cpu_' + level;
  done = { key, result, before: shell.store.get(key, ''), next: null, champion: false, rival: null, shown: false };
  if (fight.online) online.result(s.win);
  const r = applyFight(readPoints(shell.store), fight.online ? 'online' : level, result, s.how === 'ko' || s.how === 'tko', s.f[me].stats.thrown); shell.store.set('rank', String(r.points));
  done.text = rankText(r);
  const o = !fight.online && byKey(level);
  if (o) { const c = career.result(level, result === 'win'); done.text += '\n' + c.text; done.next = c.next ? c.next.key : null; done.champion = c.champion; done.rival = o.name; }
}
// Verlässt jemand vor dem Abschlussbild, trägt der Baukasten die Bilanz nicht mehr ein: das holen wir nach
function leaveFight() {
  const s = rt.state(); if (s && s.phase === 'over') commit(s);
  if (!done || done.shown) return;
  done.shown = true;
  if (done.result === 'draw' || shell.store.get(done.key, '') !== done.before) return;
  let rec = { w: 0, l: 0 }; try { rec = JSON.parse(done.before) || rec; } catch (e) { /* neu */ }
  rec[done.result === 'win' ? 'w' : 'l']++; shell.store.set(done.key, JSON.stringify(rec));
}
// Abschlussbild füllen
function showResult(s) {
  commit(s); if (!done) return;
  done.shown = true; nextKey = done.next;
  if (done.rival) {
    let rec = { w: 0, l: 0 }; try { rec = JSON.parse(shell.store.get(done.key, '')) || rec; } catch (e) { /* neu */ }
    document.getElementById('endRecord').textContent = 'Bilanz gegen ' + done.rival + ' · Siege: ' + rec.w + ' · Niederlagen: ' + rec.l;
  }
  if (done.champion) { audio.play('fanfare'); view.excite(1); }
  rankLine.textContent = done.text; rankLine.hidden = false;
  document.getElementById('btnNext').hidden = !nextKey;
  document.getElementById('btnHigh').hidden = !show.hasHighlight();
}
function layout() { for (const k of TYPES) controls.showButton(k, !swipe); document.body.dataset.punch = swipe ? 'swipe' : 'buttons'; }
layout();

let last = performance.now(), frames = 0, told = false;
addEventListener('resize', () => view.resize()); view.resize();
function loop(now) {
  const real = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now; frames++;
  const playing = shell.state.screen === 'play';
  const dir = show.update(shell.paused() ? 0 : real * Math.min(SPEED, 4), rt.state(), playing && !training.active());
  document.body.classList.toggle('highlight', show.info().replay?.kind === 'highlight');
  // während Einmarsch und Wiederholung stört keine Steuerung
  controls.setEnabled(playing && !dir.busy); pad.setEnabled(playing && swipe && !dir.busy);
  document.body.classList.toggle('broadcast', !!dir.busy);
  const gate = online.update(real, show.info().walk !== null);
  if (slow > 0) slow -= real;
  const rate = slow > 0 && rt.mode() === 'solo' ? slowScale : 1;
  // der Gast rechnet nichts selbst, bei ihm läuft die Zeit immer weiter
  const s = rt.update(rt.mode() === 'guest' ? real : dir.hold || gate.waiting ? 0 : real * SPEED * rate);
  const live = rt.state();
  training.update(s, shell.state.screen === 'play');
  if (playing && !dir.busy) reaction.update(live, shell.state.me);
  if (live && live.phase === 'over') commit(live);
  if (live && training.active()) shell.setSub('Training');
  else if (live) {
    shell.setSub(live.phase === 'rest' ? 'Pause' : 'Runde ' + live.round + '/' + MATCH.rounds + ' · ' + Math.floor(Math.ceil(live.clock) / 60) + ':' + String(Math.ceil(live.clock) % 60).padStart(2, '0') + online.status());
    if (!dir.hold && !gate.waiting && live.phase === 'intro' && live.pt < 0.2 && playing && !told) { told = true; shell.banner(live.round === MATCH.rounds ? 'LETZTE RUNDE' : 'RUNDE ' + live.round, 'role', 1700); } else if (live.phase !== 'intro') told = false;
    if (shell.state.over) {
      if (!carded) { carded = true; show.resultSheet(fightCard, live); showResult(live); }
      const e = document.getElementById('endScore'), t = verdict(live); if (e.textContent !== t) e.textContent = t;
    }
  }
  const rep = dir.view && dir.view.mode === 'replay' ? dir.view : null;
  view.frame(shell.paused() ? 0 : rep ? rep.dt : real * Math.min(SPEED, 3) * rate, rep ? rep.state : s, { me: shell.state.me, director: dir.view });
  hud.update(real, s, shell.state.me, shell.state.names, (shell.state.screen === 'play' || shell.state.screen === 'pause') && !dir.busy);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
rankBadge();
shell.start();
window.__game = {
  shell: () => shell.snapshot(), sim: () => rt.state(), controls: () => controls.read(), sounds: () => audio.log.slice(), net: () => shell.net,
  view: () => Object.assign(view.info(), { frames, swipe }), show: () => show.info(), online: () => online.info(), training: () => training.info(), reaction: () => reaction.best(),
  // nur für Tests: Zustand gezielt herstellen
  set: (patch) => { const s = rt.state(); if (!s || (rt.mode() !== 'solo' && !(rt.mode() === 'host' && qs.has('test')))) return false; if (patch.gap) s.gap = patch.gap; if (patch.clock !== undefined) s.clock = patch.clock; if (patch.hp) patch.hp.forEach((v, i) => { if (v !== null) s.f[i].hp = v; }); if (patch.round) s.round = patch.round; if (patch.win !== undefined) { s.phase = 'over'; s.pt = 0; s.win = patch.win; s.how = 'ko'; s.down = null; } return true; },
  ranges: () => Object.fromEntries(TYPES.map((k) => [k, PUNCH[k].range]))
};
