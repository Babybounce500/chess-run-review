// Spielablauf: Menü, Solo gegen den Computer, Online gegen Freunde.
import { MATCH, KEEPER } from './config.js';
import { resolveKick, createMatch, recordKick, shooterOf, winnerOf, goalsOf, suddenDeath, cpuShot, cpuDive, cleanShot, cleanDive } from './sim.js';
import { createView, RUNUP } from './view.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createNet, decode, cleanText, sha256, randomHex } from './net.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const SPEED = Math.min(8, Math.max(0.25, Number(qs.get('speed')) || 1));            // nur für Tests schneller
const CHOICE = Number(qs.get('choice')) || MATCH.choiceSeconds;
const store = { get(k, d) { try { const v = localStorage.getItem('penalty_' + k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('penalty_' + k, v); } catch (e) { /* ok */ } } };
const STAND = { x: 0, y: 0.35, start: 99 };
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

let view;
try { view = createView($('stage'), { reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches }); }
catch (e) { $('fatal').hidden = false; throw e; }
const audio = createAudio();
const net = createNet({ game: 'penalty', ice: qs.get('ice') === 'none' ? [] : undefined });

const G = {
  screen: 'menu', mode: 'solo', level: store.get('level', 'normal'), name: store.get('name', ''), me: 0, names: ['Du', 'Computer'],
  match: createMatch(0), phase: 'idle', t: null, result: null, dive: null, paused: false, hold: 0, wait: 0, last: null,
  online: { host: false, k: 0, msgs: {}, mine: null, deadline: 0, rematchMine: false, rematchPeer: false, started: false, chat: [], unread: 0, mute: false, chatTimes: [] }
};

const input = createInput($('stage'), view, {
  preview(shot, points) { if (G.phase !== 'choose') return; view.aim(shot); setPower(shot ? shot.power : 0); drawTrail(points); },
  shoot(shot) { drawTrail(null); onShot(shot); },
  dive(d) { onDive(d); }
});

/* ---------- Anzeige ---------- */
function show(screen) {
  G.screen = screen;
  for (const id of ['menu', 'lobby', 'pause', 'end', 'lost']) $(id).hidden = id !== screen;
  const playing = screen === 'play' || screen === 'pause' || screen === 'end' || screen === 'lost';
  $('hud').hidden = !playing;
  $('btnChat').hidden = G.mode !== 'online';
  if (screen !== 'play') { $('hint').hidden = true; $('powerBox').hidden = true; }
}
function hint(text) { $('hint').hidden = !text; $('hint').textContent = text || ''; }
function banner(text, cls, ms) {
  const b = $('banner'); b.className = cls || ''; b.textContent = text || ''; b.hidden = !text;
  clearTimeout(banner.t); if (text && ms) banner.t = setTimeout(() => { b.hidden = true; }, ms / SPEED);
}
function toast(text) { const e = $('toast'); e.textContent = text; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { e.hidden = true; }, 2600); }
function setPower(p) { $('powerFill').style.height = Math.round(p * 100) + '%'; $('powerBox').dataset.zone = p > 0.82 ? 'over' : p >= 0.55 ? 'good' : 'soft'; }
function scoreboard() {
  const m = G.match;
  for (let p = 0; p < 2; p++) {
    $('name' + p).textContent = G.names[p]; $('goals' + p).textContent = goalsOf(m, p);
    const dots = $('dots' + p), k = m.kicks[p], from = Math.max(0, k.length - (k.length > MATCH.kicks || (suddenDeath(m) && k.length === MATCH.kicks) ? 4 : MATCH.kicks));
    const slots = Math.max(MATCH.kicks, k.length - from + (winnerOf(m) === null && suddenDeath(m) ? 1 : 0));
    dots.textContent = '';
    for (let i = 0; i < slots; i++) { const d = document.createElement('i'), v = k[from + i]; d.className = v === undefined ? (winnerOf(m) === null && shooterOf(m) === p && from + i === k.length ? 'next' : '') : v ? 'hit' : 'miss'; dots.appendChild(d); }
    $('side' + p).classList.toggle('active', winnerOf(m) === null && shooterOf(m) === p);
  }
  const n = Math.min(m.kicks[0].length, m.kicks[1].length);
  $('round').textContent = winnerOf(m) !== null ? 'Ende' : suddenDeath(m) ? 'K.-o.-Runde' : 'Schuss ' + Math.min(MATCH.kicks, n + 1) + '/' + MATCH.kicks;
}
const trailCtx = $('swipe').getContext('2d');
function drawTrail(points) {
  const c = $('swipe'), r = Math.min(devicePixelRatio || 1, 2);
  if (c.width !== Math.round(innerWidth * r)) { c.width = Math.round(innerWidth * r); c.height = Math.round(innerHeight * r); }
  trailCtx.clearRect(0, 0, c.width, c.height);
  if (!points || points.length < 2) return;
  trailCtx.lineCap = 'round'; trailCtx.lineJoin = 'round';
  for (let i = 1; i < points.length; i++) { const a = i / points.length; trailCtx.strokeStyle = `rgba(255,211,77,${0.15 + a * 0.75})`; trailCtx.lineWidth = (3 + a * 9) * r; trailCtx.beginPath(); trailCtx.moveTo(points[i - 1].x * r, points[i - 1].y * r); trailCtx.lineTo(points[i].x * r, points[i].y * r); trailCtx.stroke(); }
}

/* ---------- Ablauf eines Schusses ---------- */
function startMatch(first) {
  G.match = createMatch(first); G.result = null; G.t = null; G.dive = null; G.paused = false;
  show('play'); audio.play('whistle'); nextKick();
}
const iShoot = () => shooterOf(G.match) === G.me;
function nextKick() {
  G.phase = 'choose'; G.t = null; G.result = null; G.dive = null; G.pending = null; G.hold = 0;
  view.reset(); view.aim(null); view.marker(null); setPower(0); drawTrail(null);
  const shooter = shooterOf(G.match);
  view.setTeams(shooter); view.setView(iShoot() ? 'shooter' : 'keeper'); scoreboard();
  banner(iShoot() ? 'DU SCHIESST' : 'DU HÄLTST', iShoot() ? 'role' : 'role keep', 1100);
  $('powerBox').hidden = !iShoot();
  input.setMode(iShoot() ? 'shoot' : 'dive');
  if (G.mode === 'online') {
    G.online.mine = null; G.online.deadline = Date.now() + (CHOICE * 1000) / SPEED;
    hint(iShoot() ? 'Wisch zum Tor: Richtung zielt, Tempo ist Kraft, Bogen gibt Effet' : 'Tippe aufs Tor: dorthin springst du');
    pumpOnline();
  } else if (iShoot()) {
    hint(matchMedia('(pointer: coarse)').matches ? 'Wisch zum Tor: Richtung zielt, Tempo ist Kraft, Bogen gibt Effet' : 'Mit der Maus zum Tor wischen · oder Pfeile zielen, Leertaste halten');
  } else {
    // Der Computer läuft nach kurzer Pause an; du springst, wann du willst
    G.cpu = { seed: randomSeed() }; G.cpu.shot = cpuShot(G.level, G.cpu.seed);
    hint(matchMedia('(pointer: coarse)').matches ? 'Tippe aufs Tor, um zu springen. Nicht zu früh, nicht zu spät' : 'Aufs Tor klicken zum Springen · oder Q W E / A S D');
    G.wait = 1.3;
  }
}
function begin(result) {                                          // Anlauf starten
  G.result = result; G.t = -RUNUP; G.phase = 'play'; view.aim(null); $('powerBox').hidden = true; audio.excite(0.5);
}
function onShot(shot) {
  if (G.phase !== 'choose' || !iShoot() || G.paused) return;
  const s = cleanShot(shot); audio.play('ui');
  if (G.mode === 'online') return commit(s);
  const seed = randomSeed();
  hint(''); begin(resolveKick(s, cpuDive(G.level, s, seed), (seed ^ 0x5bd1e995) >>> 0)); input.setMode('none');
}
function onDive(d) {
  if (G.paused || iShoot()) return;
  if (G.mode === 'online') {
    if (G.phase !== 'choose' || G.online.mine) return;
    const c = cleanDive({ x: d.x, y: d.y, start: KEEPER.onlineStart }); view.marker({ x: c.x * 2.3, y: 0.5 + c.y * 1.5 }); audio.play('ui');
    return commit({ x: c.x, y: c.y });
  }
  if (G.dive) return;
  if (G.phase === 'choose') { G.dive = cleanDive({ x: d.x, y: d.y, start: KEEPER.earliest }); G.wait = Math.min(G.wait, 0.25); input.setMode('none'); hint(''); return; }
  if (G.phase !== 'play' || G.t >= G.result.tKeeper) return;
  G.dive = cleanDive({ x: d.x, y: d.y, start: Math.max(KEEPER.earliest, G.t) });
  G.result = resolveKick(G.cpu.shot, G.dive, G.cpu.seed); input.setMode('none'); hint(''); view.marker(null);
}
const TEXT = {
  goal: (mine, p) => (mine ? (p ? 'TRAUMTOR!' : 'TOR!') : 'KASSIERT'),
  save: (mine) => (mine ? 'GEHALTEN' : 'PARADE!'),
  post: () => 'PFOSTEN!', wide: (mine) => (mine ? 'DANEBEN' : 'VORBEI!'), over: (mine) => (mine ? 'DRÜBER' : 'DRÜBER!')
};
function advance(dt) {
  const r = G.result, prev = G.t;
  if (G.hold > 0) { G.hold -= dt; return; }
  const near = Math.abs(G.t - r.tEvent) < 0.12;
  G.t += dt * (near ? 0.4 : 1);                                    // Zeitlupe im entscheidenden Moment
  const crossed = (x) => prev < x && G.t >= x;
  for (const s of [-0.62, -0.42, -0.2]) if (crossed(s)) audio.play('step');
  if (crossed(0)) { audio.play('kick', r.shot.power); audio.vibrate(18); G.hold = 0.05; view.marker(null); }
  if (crossed(r.tEvent)) {
    view.impact(r);
    const mine = iShoot(), goodForMe = r.goal === mine;
    if (r.outcome === 'goal') { audio.play('net'); audio.play(goodForMe ? 'cheer' : 'groan'); audio.vibrate([40, 40, 80]); }
    else if (r.outcome === 'save') { audio.play('save'); audio.play(goodForMe ? 'cheer' : 'groan'); audio.vibrate(60); }
    else if (r.outcome === 'post') { audio.play('post'); audio.play(goodForMe ? 'cheer' : 'groan'); audio.vibrate(90); }
    else audio.play(goodForMe ? 'cheer' : 'groan');
    banner(TEXT[r.outcome](mine, r.perfect), goodForMe ? 'good' : 'bad', 1500);
  }
  if (G.t >= r.tEvent + 1.75) finishKick();
}
function finishKick() {
  G.phase = 'done'; audio.excite(0); input.setMode('none');
  G.last = { outcome: G.result.outcome, shooter: shooterOf(G.match), shot: G.result.shot, dive: G.result.dive };
  recordKick(G.match, G.result.goal); scoreboard();
  if (G.mode === 'online') { delete G.online.msgs[G.online.k]; G.online.k++; }
  if (winnerOf(G.match) !== null) return endMatch();
  nextKick();
}
function endMatch() {
  const w = winnerOf(G.match), won = w === G.me;
  G.phase = 'over'; banner(''); view.marker(null); audio.play('whistle'); if (won) audio.play('cheer');
  $('endTitle').textContent = won ? '🏆 Gewonnen!' : 'Verloren'; $('endTitle').className = won ? 'good' : 'bad';
  $('endScore').textContent = G.names[0] + '  ' + goalsOf(G.match, 0) + ' : ' + goalsOf(G.match, 1) + '  ' + G.names[1];
  let line = '';
  const key = G.mode === 'online' ? 'friend_' + G.names[1 - G.me].toLowerCase() : 'cpu_' + G.level;
  let rec = { w: 0, l: 0 }; try { rec = JSON.parse(store.get(key, '')) || rec; } catch (e) { /* neu */ }
  rec[won ? 'w' : 'l']++; store.set(key, JSON.stringify(rec));
  line = (G.mode === 'online' ? 'Bilanz gegen ' + G.names[1 - G.me] : 'Bilanz gegen den Computer (' + { easy: 'leicht', normal: 'normal', hard: 'schwer' }[G.level] + ')') + ' · Siege: ' + rec.w + ' · Niederlagen: ' + rec.l;
  $('endRecord').textContent = line;
  G.online.rematchMine = false; endButtons(); show('end');
}
function endButtons() { const o = G.online; $('btnAgain').textContent = G.mode !== 'online' ? 'Noch einmal' : o.rematchMine ? 'Warte auf Antwort …' : o.rematchPeer ? 'Revanche annehmen' : 'Revanche'; $('btnAgain').disabled = G.mode === 'online' && o.rematchMine; }

/* ---------- Online: erst verdeckt festlegen (Prüfsumme), dann aufdecken ---------- */
const slot = (k) => (G.online.msgs[k] = G.online.msgs[k] || {});
async function commit(choice) {
  if (G.online.mine) return;
  const k = G.online.k, c = JSON.stringify(choice), n = randomHex();
  G.online.mine = { k, c, n, revealed: false }; input.setMode('none'); view.aim(null); $('powerBox').hidden = true;
  hint('Festgelegt. Warte auf ' + G.names[1 - G.me] + ' …');
  const h = await sha256(k + '|' + c + '|' + n);
  net.send({ t: 'commit', k, h }); G.online.mine.sent = true; pumpOnline();
}
async function pumpOnline() {
  const o = G.online, mine = o.mine;
  if (G.mode !== 'online' || G.phase !== 'choose' || !mine || !mine.sent || mine.k !== o.k) return;
  const s = slot(o.k);
  if (s.commit && !mine.revealed) { mine.revealed = true; net.send({ t: 'reveal', k: o.k, c: mine.c, n: mine.n }); }
  if (!s.commit || !s.reveal || !mine.revealed || s.busy) return;
  s.busy = true;
  const k = o.k, { c, n } = s.reveal;
  if ((await sha256(k + '|' + c + '|' + n)) !== s.commit) return abortOnline('Die Daten des Gegners passen nicht zur Prüfsumme. Partie beendet.');
  let theirs; try { theirs = JSON.parse(c); } catch (e) { return abortOnline('Ungültige Daten vom Gegner. Partie beendet.'); }
  const shooting = iShoot(), shot = cleanShot(shooting ? JSON.parse(mine.c) : theirs), d = shooting ? theirs : JSON.parse(mine.c);
  // Der Zufall (Streuung) entsteht aus beiden geheimen Zahlen: keiner kann ihn allein bestimmen
  const seed = parseInt((await sha256((shooting ? mine.n : n) + '|' + (shooting ? n : mine.n) + '|' + k)).slice(0, 8), 16);
  if (G.phase !== 'choose' || o.k !== k) return;
  hint(''); view.marker(null);
  begin(resolveKick(shot, cleanDive({ x: d.x, y: d.y, start: KEEPER.onlineStart }), seed));
}
function abortOnline(text) { net.leave(); G.phase = 'idle'; input.setMode('none'); $('lostText').textContent = text; show('lost'); }
function onMsg(d) {
  const o = G.online;
  if (d.t === 'hello') {
    G.names[1 - G.me] = cleanText(d.name, 16) || (o.host ? 'Gast' : 'Gastgeber');
    if (o.host && !o.started) startOnline(randomSeed() % 2); else if (!o.host) net.send({ t: 'ready' });
    return;
  }
  if (d.t === 'ready') return;
  if (d.t === 'start') { if (!o.host && (d.first === 0 || d.first === 1)) beginOnline(d.first); return; }
  if (d.t === 'chat') return onChat(d);
  if (d.t === 'rematch') { if (G.phase !== 'over') return; o.rematchPeer = true; if (o.rematchMine && o.host) startOnline(1 - G.match.first); else endButtons(); return; }
  if ((d.t === 'commit' || d.t === 'reveal') && Number.isInteger(d.k) && d.k >= o.k && d.k < o.k + 3) {
    const s = slot(d.k);
    if (d.t === 'commit' && !s.commit && typeof d.h === 'string' && /^[0-9a-f]{64}$/.test(d.h)) s.commit = d.h;
    if (d.t === 'reveal' && !s.reveal && typeof d.c === 'string' && d.c.length < 300 && typeof d.n === 'string' && /^[0-9a-f]{32}$/.test(d.n)) s.reveal = { c: d.c, n: d.n };
    pumpOnline();
  }
}
function startOnline(first) { G.online.started = true; net.send({ t: 'start', first }); beginOnline(first); }
function beginOnline(first) { const o = G.online; o.k = 0; o.msgs = {}; o.mine = null; o.rematchMine = o.rematchPeer = false; o.started = true; startMatch(first); }
net.on('msg', onMsg).on('state', (s) => {
  $('conn').textContent = { off: '', wait: 'wartet', connecting: 'verbinde …', open: 'verbunden', lost: 'unterbrochen', failed: 'fehlgeschlagen', left: 'Gegner weg' }[s] || '';
  $('conn').dataset.s = s; chatUi();
  if (s === 'open') { net.send({ t: 'hello', name: G.name || (G.online.host ? 'Gastgeber' : 'Gast') }); toast('Verbunden'); }
  if (G.mode !== 'online' || G.screen === 'lost') return;          // die erste Erklärung bleibt stehen
  if (s === 'left' || ((s === 'lost' || s === 'failed') && G.online.started)) { G.phase = 'idle'; input.setMode('none'); $('lostText').textContent = s === 'left' ? G.names[1 - G.me] + ' hat das Spiel verlassen.' : 'Die Verbindung ist weg.'; show('lost'); }
  else if (s === 'failed') $('lobbyErr').textContent = 'Verbindung fehlgeschlagen. In strengen Netzen klappt die Direktverbindung nicht. Neu versuchen oder anderes Netz.';
});
// hello kann verloren gehen, bevor der andere zuhört: bis zum Start wiederholen
setInterval(() => { if (G.mode === 'online' && !G.online.started && net.state() === 'open') net.send({ t: 'hello', name: G.name || (G.online.host ? 'Gastgeber' : 'Gast') }); }, 1200);

/* ---------- Chat ---------- */
function onChat(d) {
  const o = G.online, now = Date.now(); if (o.mute) return;
  const text = cleanText(d.x, 200); if (!text) return;
  o.chatTimes = o.chatTimes.filter((x) => now - x < 10000); if (o.chatTimes.length >= 8) return; o.chatTimes.push(now);
  addChat(false, text); audio.play('msg'); if ($('chat').hidden) toast(G.names[1 - G.me] + ': ' + text);
}
function addChat(me, text) { const o = G.online; o.chat.push({ me, text }); if (o.chat.length > 50) o.chat.shift(); if (!me && $('chat').hidden) o.unread++; chatUi(); }
function sendChat(text) { text = cleanText(text, 200); if (!text || !net.send({ t: 'chat', x: text })) return false; addChat(true, text); return true; }
function chatUi() {
  const o = G.online, list = $('chatList'); list.textContent = '';
  if (!o.chat.length) { const e = document.createElement('p'); e.textContent = 'Nur ihr zwei seht diesen Chat.'; list.appendChild(e); }
  for (const m of o.chat) { const e = document.createElement('div'); e.className = m.me ? 'me' : 'opp'; e.textContent = m.text; list.appendChild(e); }
  list.scrollTop = list.scrollHeight; $('badge').hidden = !o.unread; $('badge').textContent = o.unread;
  const on = net.state() === 'open'; $('chatIn').disabled = !on; $('chatSend').disabled = !on;
  $('chatMute').setAttribute('aria-pressed', String(o.mute));
}

/* ---------- Menüs ---------- */
function readName() { G.name = cleanText($('nameIn').value, 16); store.set('name', G.name); return G.name; }
function toMenu() {
  if (G.mode === 'online' && net.state() !== 'off') net.leave();
  G.mode = 'solo'; G.phase = 'idle'; G.t = null; G.result = null; G.online.started = false; G.online.chat = []; G.online.unread = 0; $('chat').hidden = true; $('conn').textContent = '';
  input.setMode('none'); view.reset(); view.setView('shooter'); view.aim(null); view.marker(null); banner('');
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  show('menu');
}
function soloStart() { readName(); audio.unlock(); G.mode = 'solo'; G.me = 0; G.names = [G.name || 'Du', 'Computer']; startMatch(randomSeed() % 2); }
async function hostStart() {
  readName(); audio.unlock(); G.mode = 'online'; G.me = 0; G.names = [G.name || 'Du', 'Gegner'];
  Object.assign(G.online, { host: true, started: false, chat: [], unread: 0, rematchPeer: false }); chatUi();
  show('lobby'); $('hostBox').hidden = false; $('guestBox').hidden = true; $('link').value = ''; $('answerIn').value = ''; $('lobbyErr').textContent = '';
  try { const code = await net.host({ name: G.name || 'Gastgeber' }); $('link').value = location.origin + location.pathname + location.search + '#m=' + code; }
  catch (e) { if (e.message !== 'abgebrochen') $('lobbyErr').textContent = 'Konnte keinen Link erzeugen. Seite neu laden.'; }
}
let offer = null;
function guestPrepare(text) {
  offer = decode(text, 'penalty');
  if (!offer) { toast('Der Link ist ungültig oder unvollständig.'); return false; }
  G.mode = 'online'; show('lobby'); $('hostBox').hidden = true; $('guestBox').hidden = false; $('lobbyErr').textContent = '';
  $('inviter').textContent = (cleanText(offer.info && offer.info.name, 16) || 'Jemand') + ' fordert dich zum Elfmeterschießen heraus.';
  $('answerBox').hidden = true; $('joinBtn').hidden = false; return true;
}
async function guestJoin() {
  readName(); audio.unlock(); G.me = 1; G.names = ['Gegner', G.name || 'Du'];
  Object.assign(G.online, { host: false, started: false, chat: [], unread: 0, rematchPeer: false }); chatUi();
  G.names[0] = cleanText(offer.info && offer.info.name, 16) || 'Gegner'; $('joinBtn').hidden = true;
  try { const code = await net.join(offer); $('answerOut').value = code; $('answerBox').hidden = false; }
  catch (e) { $('lobbyErr').textContent = 'Der Link ist abgelaufen. Bitte um einen neuen.'; $('joinBtn').hidden = false; }
}
function copy(id, btn) { const el = $(id); el.select(); const done = () => { const o = btn.textContent; btn.textContent = 'Kopiert ✓'; setTimeout(() => (btn.textContent = o), 1400); }; try { navigator.clipboard.writeText(el.value).then(done, () => {}); } catch (e) { /* Feld ist markiert */ } }

$('nameIn').value = G.name;
for (const b of document.querySelectorAll('[data-level]')) { b.onclick = () => { G.level = b.dataset.level; store.set('level', G.level); for (const x of document.querySelectorAll('[data-level]')) x.setAttribute('aria-pressed', String(x === b)); audio.play('ui'); }; b.setAttribute('aria-pressed', String(b.dataset.level === G.level)); }
$('btnSolo').onclick = soloStart; $('btnHost').onclick = hostStart;
$('btnJoinLink').onclick = () => { $('pasteBox').hidden = !$('pasteBox').hidden; if (!$('pasteBox').hidden) $('pasteIn').focus(); };
$('pasteGo').onclick = () => guestPrepare($('pasteIn').value);
$('joinBtn').onclick = guestJoin;
$('connectBtn').onclick = async () => { try { await net.accept($('answerIn').value); $('lobbyErr').textContent = ''; } catch (e) { $('lobbyErr').textContent = 'Das ist kein gültiger Antwort-Code (oder er passt nicht zu diesem Link).'; } };
$('copyLink').onclick = () => copy('link', $('copyLink')); $('copyAnswer').onclick = () => copy('answerOut', $('copyAnswer'));
if (navigator.share) { $('shareLink').hidden = false; $('shareLink').onclick = () => navigator.share({ title: 'Elfmeterschießen', text: 'Schieß gegen mich:', url: $('link').value }).catch(() => {}); }
$('lobbyBack').onclick = toMenu;
const soundLabel = () => { $('btnSound').textContent = audio.enabled() ? '🔊' : '🔇'; $('btnSound').setAttribute('aria-pressed', String(audio.enabled())); $('menuSound').textContent = audio.enabled() ? 'Ton: an' : 'Ton: aus'; };
$('btnSound').onclick = $('menuSound').onclick = () => { audio.toggle(); soundLabel(); }; soundLabel();
$('btnPause').onclick = () => { if (G.screen === 'pause') return resume(); if (G.screen !== 'play') return; G.paused = G.mode === 'solo'; $('pauseNote').textContent = G.mode === 'online' ? 'Online läuft das Spiel weiter.' : ''; show('pause'); };
function resume() { G.paused = false; show('play'); if (G.phase === 'choose') { $('powerBox').hidden = !iShoot(); } }
$('btnResume').onclick = resume; $('btnQuit').onclick = toMenu; $('btnMenu').onclick = toMenu; $('lostMenu').onclick = toMenu;
$('btnAgain').onclick = () => {
  if (G.mode !== 'online') return startMatch(1 - G.match.first);
  const o = G.online; o.rematchMine = true; endButtons(); net.send({ t: 'rematch' });
  if (o.rematchPeer && o.host) startOnline(1 - G.match.first);
};
$('btnChat').onclick = () => { $('chat').hidden = !$('chat').hidden; G.online.unread = 0; chatUi(); };
$('chatClose').onclick = () => { $('chat').hidden = true; };
$('chatMute').onclick = () => { G.online.mute = !G.online.mute; chatUi(); };
$('chatForm').onsubmit = (e) => { e.preventDefault(); if (sendChat($('chatIn').value)) $('chatIn').value = ''; };
for (const b of document.querySelectorAll('[data-q]')) b.onclick = () => sendChat(b.dataset.q);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!$('chat').hidden) $('chat').hidden = true; else if (G.screen === 'play' || G.screen === 'pause') $('btnPause').click(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'solo' && G.screen === 'play') $('btnPause').click(); });
document.addEventListener('contextmenu', (e) => { if (!/INPUT|TEXTAREA/.test(e.target.tagName)) e.preventDefault(); });

/* ---------- Schleife ---------- */
addEventListener('resize', () => view.resize()); view.resize(); view.setView('shooter');
let last = performance.now(), frames = 0;
function loop(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)) * SPEED; last = now; frames++;
  if (!G.paused) {
    input.update(dt / SPEED);
    if (G.phase === 'choose') {
      if (G.mode === 'solo' && !iShoot()) { G.wait -= dt; if (G.wait <= 0) begin(resolveKick(G.cpu.shot, G.dive || STAND, G.cpu.seed)); }
      if (G.mode === 'online' && !G.online.mine) {
        const left = Math.ceil(((G.online.deadline - Date.now()) * SPEED) / 1000);
        $('timer').textContent = left <= 10 ? Math.max(0, left) + ' s' : '';
        if (left <= 0) commit(iShoot() ? { aimX: 0, aimY: 0.2, power: 0.35, curve: 0 } : { x: 0, y: 0.3 });
      } else $('timer').textContent = '';
    } else $('timer').textContent = '';
    if (G.phase === 'play') advance(dt);
  }
  view.frame(G.paused ? 0 : dt, { t: G.phase === 'play' || G.phase === 'done' || G.phase === 'over' ? G.t : null, result: G.result, dive: G.dive });
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

const hm = location.hash.match(/^#m=/);
show('menu'); if (hm) guestPrepare(location.hash);
addEventListener('hashchange', () => { if (/^#m=/.test(location.hash)) location.reload(); });
$('boot').remove();

/* Zugang für Tests: nur ablesen und dieselben Aktionen wie die Bedienung */
window.__penalty = {
  state: () => ({ screen: G.screen, mode: G.mode, phase: G.phase, t: G.t, me: G.me, names: G.names.slice(), shooter: winnerOf(G.match) === null ? shooterOf(G.match) : null, kicks: G.match.kicks.map((k) => k.slice()), winner: winnerOf(G.match), last: G.last, outcome: G.result && G.result.outcome, dive: G.dive, input: input.mode(), paused: G.paused, conn: net.state(), k: G.online.k, committed: !!G.online.mine, chat: G.online.chat.map((m) => (m.me ? 'ich: ' : 'er: ') + m.text), unread: G.online.unread, frames }),
  shoot: onShot, dive: onDive, project: (x, y, z) => view.project(x, y, z), view: () => view.info(), sounds: () => audio.log.slice(),
  raw: (o) => net.send(o), drop: () => net.drop()
};
if (window.isSecureContext && 'serviceWorker' in navigator && !qs.has('nosw')) navigator.serviceWorker.register('sw.js').catch(() => {});
