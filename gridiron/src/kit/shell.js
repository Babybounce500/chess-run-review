// Gemeinsame Hülle aller Spiele: Menü, Anzeige, Online-Lobby, Chat, Pause, Ergebnis, Bilanz.
// Das Spiel liefert nur Rückrufe; die Hülle baut ihre Oberfläche selbst.
import { createNet, decode, cleanText } from './net.js';

const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

export function createShell(cfg) {
  // cfg: { id, title: [oben, unten], tagline, help (festes HTML), colors: [a, b], audio, onSolo(info), onOnline(info), onMenu(), onPause(paused) }
  const qs = new URLSearchParams(location.search);
  const store = { get(k, d) { try { const v = localStorage.getItem(cfg.id + '_' + k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(cfg.id + '_' + k, v); } catch (e) { /* ok */ } } };
  const S = { screen: 'menu', mode: 'solo', role: null, me: 0, names: ['Du', 'Computer'], level: store.get('level', 'normal'), name: store.get('name', ''), score: [0, 0], paused: false, started: false, over: false, winner: null, chat: [], unread: 0, mute: false, chatTimes: [], rematchMine: false, rematchPeer: false, seed: 0 };
  const colors = cfg.colors || ['#2ee59d', '#38bdf8'];
  document.documentElement.style.setProperty('--team0', colors[0]); document.documentElement.style.setProperty('--team1', colors[1]);
  const root = el('<div id="shell"></div>');
  root.innerHTML = `
  <header id="hud" hidden>
    <div class="score">
      <div class="side" id="side0"><span class="nm" id="name0"></span></div>
      <div class="mid"><b><span id="score0">0</span><i>:</i><span id="score1">0</span></b><small id="sub"></small></div>
      <div class="side right" id="side1"><span class="nm" id="name1"></span></div>
    </div>
    <div class="tools"><span id="conn"></span>
      <button id="btnChat" type="button" aria-label="Chat" hidden>💬<b id="badge" hidden>0</b></button>
      <button id="btnSound" type="button" aria-label="Ton">🔊</button>
      <button id="btnPause" type="button" aria-label="Pause">⏸</button>
    </div>
  </header>
  <div id="banner" hidden role="status"></div>
  <p id="hint" hidden></p>
  <p id="toast" hidden></p>
  <section id="menu" class="sheet"><div class="card">
    <h1><span id="t0"></span><em id="t1"></em></h1><p class="sub" id="tagline"></p>
    <label for="nameIn">Spitzname</label><input id="nameIn" type="text" maxlength="16" autocomplete="off" placeholder="Dein Name">
    <div class="seg" role="group" aria-label="Schwierigkeit"><button type="button" data-level="easy">Leicht</button><button type="button" data-level="normal">Normal</button><button type="button" data-level="hard">Schwer</button></div>
    <button id="btnSolo" class="primary" type="button">Gegen den Computer</button>
    <button id="btnHost" class="friend" type="button">👥 Freund herausfordern</button>
    <div class="row"><button id="btnJoinLink" class="ghost" type="button">Link einfügen</button><button id="menuSound" class="ghost" type="button">Ton: an</button></div>
    <div id="pasteBox" hidden><input id="pasteIn" type="text" autocomplete="off" placeholder="Einladungslink hier einfügen" aria-label="Einladungslink"><button id="pasteGo" class="primary" type="button">Öffnen</button></div>
    <details><summary>So wird gespielt</summary><div id="help"></div></details>
  </div></section>
  <section id="lobby" class="sheet" hidden><div class="card">
    <h2>Gegen einen Freund</h2>
    <div id="hostBox"><label for="link">1. Diesen Link verschicken</label>
      <div class="row"><input id="link" type="text" readonly placeholder="Link wird erzeugt …"><button id="copyLink" type="button">Kopieren</button><button id="shareLink" type="button" hidden>Teilen</button></div>
      <label for="answerIn">2. Antwort-Code deines Freundes hier einfügen</label><textarea id="answerIn" rows="3" placeholder="Dein Freund bekommt nach dem Annehmen einen Code"></textarea>
      <button id="connectBtn" class="primary" type="button">Verbinden</button></div>
    <div id="guestBox" hidden><p id="inviter"></p><button id="joinBtn" class="primary" type="button">Annehmen</button>
      <div id="answerBox" hidden><label for="answerOut">Diesen Code zurückschicken</label><textarea id="answerOut" rows="3" readonly></textarea><button id="copyAnswer" type="button">Code kopieren</button><p class="note">Sobald dein Freund ihn eingefügt hat, geht es los. Lass diese Seite offen.</p></div></div>
    <p id="lobbyErr" class="err" role="alert"></p>
    <p class="note">Die Verbindung läuft direkt zwischen euren Browsern, ohne Spielserver. Kein Betrugsschutz: nur mit Leuten spielen, denen du vertraust.</p>
    <button id="lobbyBack" class="ghost" type="button">Zurück</button>
  </div></section>
  <section id="pause" class="sheet dim" hidden><div class="card small"><h2>Pause</h2><p class="note" id="pauseNote"></p><button id="btnResume" class="primary" type="button">Weiter</button><button id="btnQuit" class="ghost" type="button">Ins Menü</button></div></section>
  <section id="end" class="sheet dim" hidden><div class="card small"><h2 id="endTitle"></h2><p id="endScore"></p><p class="note" id="endRecord"></p><button id="btnAgain" class="primary" type="button">Noch einmal</button><button id="btnMenu" class="ghost" type="button">Ins Menü</button></div></section>
  <section id="lost" class="sheet dim" hidden><div class="card small"><h2>Verbindung beendet</h2><p id="lostText"></p><button id="lostMenu" class="primary" type="button">Ins Menü</button></div></section>
  <aside id="chat" hidden aria-label="Chat">
    <div class="head"><b>Chat</b><span><button id="chatMute" type="button" aria-pressed="false">Stumm</button><button id="chatClose" type="button" aria-label="Chat schließen">✕</button></span></div>
    <div id="chatList" aria-live="polite"></div>
    <div class="quick"><button type="button" data-q="👍">👍</button><button type="button" data-q="GG">GG</button><button type="button" data-q="Stark!">Stark!</button><button type="button" data-q="Revanche?">Revanche?</button></div>
    <form id="chatForm" autocomplete="off"><input id="chatIn" type="text" maxlength="200" placeholder="Nachricht …" aria-label="Nachricht"><button id="chatSend" type="submit">Senden</button></form>
  </aside>`;
  document.body.appendChild(root);
  const $ = (id) => document.getElementById(id);
  $('t0').textContent = cfg.title[0]; $('t1').textContent = cfg.title[1]; $('tagline').textContent = cfg.tagline || ''; $('help').innerHTML = cfg.help || '';

  const audio = cfg.audio;
  const net = createNet({ game: cfg.id, ice: qs.get('ice') === 'none' ? [] : undefined });
  let gameMsg = null, offer = null;

  function show(screen) {
    S.screen = screen;
    for (const id of ['menu', 'lobby', 'pause', 'end', 'lost']) $(id).hidden = id !== screen;
    const playing = screen === 'play' || screen === 'pause' || screen === 'end' || screen === 'lost';
    $('hud').hidden = !playing; $('btnChat').hidden = S.mode !== 'online';
    if (screen !== 'play') $('hint').hidden = true;
    document.body.dataset.screen = screen;
  }
  function toast(text) { const e = $('toast'); e.textContent = text; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { e.hidden = true; }, 2600); }
  function banner(text, cls, ms) { const b = $('banner'); b.className = cls || ''; b.textContent = text || ''; b.hidden = !text; clearTimeout(banner.t); if (text && ms) banner.t = setTimeout(() => { b.hidden = true; }, ms); }
  function hint(text) { $('hint').hidden = !text; $('hint').textContent = text || ''; }
  function setScore(a, b) { if (S.score[0] === a && S.score[1] === b && $('score0').textContent === String(a)) return; S.score = [a, b]; $('score0').textContent = a; $('score1').textContent = b; }
  function setSub(t) { if ($('sub').textContent !== t) $('sub').textContent = t; }
  function setNames(n) { S.names = n; $('name0').textContent = n[0]; $('name1').textContent = n[1]; }

  /* ---------- Partie ---------- */
  function begin() { S.over = false; S.winner = null; S.paused = false; S.rematchMine = S.rematchPeer = false; S.score = [-1, -1]; setScore(0, 0); banner(''); show('play'); if (audio) audio.play('whistle'); }
  function solo() { readName(); if (audio) audio.unlock(); S.mode = 'solo'; S.role = null; S.me = 0; setNames([S.name || 'Du', 'Computer']); S.seed = crypto.getRandomValues(new Uint32Array(1))[0]; begin(); cfg.onSolo({ level: S.level, seed: S.seed }); }
  function beginOnline(seed) { S.started = true; S.seed = seed; begin(); cfg.onOnline({ role: S.role, me: S.me, seed }); }
  function startOnline() { const seed = crypto.getRandomValues(new Uint32Array(1))[0]; net.send({ t: 'start', seed }); beginOnline(seed); }
  function end({ winner, text }) {
    if (S.over) return; S.over = true; S.winner = winner;
    const won = winner === S.me, draw = winner === null || winner === undefined || winner < 0;
    $('endTitle').textContent = draw ? 'Unentschieden' : won ? '🏆 Gewonnen!' : 'Verloren'; $('endTitle').className = draw ? '' : won ? 'good' : 'bad';
    $('endScore').textContent = text || S.names[0] + '  ' + S.score[0] + ' : ' + S.score[1] + '  ' + S.names[1];
    const key = S.mode === 'online' ? 'friend_' + S.names[1 - S.me].toLowerCase() : 'cpu_' + S.level;
    let rec = { w: 0, l: 0 }; try { rec = JSON.parse(store.get(key, '')) || rec; } catch (e) { /* neu */ }
    if (!draw) { rec[won ? 'w' : 'l']++; store.set(key, JSON.stringify(rec)); }
    $('endRecord').textContent = (S.mode === 'online' ? 'Bilanz gegen ' + S.names[1 - S.me] : 'Bilanz gegen den Computer (' + { easy: 'leicht', normal: 'normal', hard: 'schwer' }[S.level] + ')') + ' · Siege: ' + rec.w + ' · Niederlagen: ' + rec.l;
    if (audio) { audio.play('whistle'); if (won) audio.play('cheer'); }
    banner(''); endButtons(); show('end');
  }
  function endButtons() { $('btnAgain').textContent = S.mode !== 'online' ? 'Noch einmal' : S.rematchMine ? 'Warte auf Antwort …' : S.rematchPeer ? 'Revanche annehmen' : 'Revanche'; $('btnAgain').disabled = S.mode === 'online' && S.rematchMine; }
  function toMenu() {
    if (S.mode === 'online' && net.state() !== 'off') net.leave();
    S.mode = 'solo'; S.started = false; S.over = false; S.paused = false; S.chat = []; S.unread = 0; $('chat').hidden = true; $('conn').textContent = ''; banner('');
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    show('menu'); if (cfg.onMenu) cfg.onMenu();
  }

  /* ---------- Online ---------- */
  const hello = () => net.send({ t: 'hello', name: S.name || (S.role === 'host' ? 'Gastgeber' : 'Gast') });
  net.on('msg', (d) => {
    if (d.t === 'hello') { const other = cleanText(d.name, 16) || (S.role === 'host' ? 'Gast' : 'Gastgeber'); const n = S.names.slice(); n[1 - S.me] = other; setNames(n); if (S.role === 'host') { if (!S.started) startOnline(); } return; }
    if (d.t === 'start') { if (S.role === 'guest' && Number.isInteger(d.seed)) beginOnline(d.seed >>> 0); return; }
    if (d.t === 'chat') return onChat(d);
    if (d.t === 'rematch') { if (!S.over) return; S.rematchPeer = true; if (S.rematchMine && S.role === 'host') startOnline(); else endButtons(); return; }
    if (gameMsg && S.started) gameMsg(d);
  }).on('state', (s) => {
    $('conn').textContent = { off: '', wait: 'wartet', connecting: 'verbinde …', open: 'verbunden', lost: 'unterbrochen', failed: 'fehlgeschlagen', left: 'Gegner weg' }[s] || '';
    $('conn').dataset.s = s; chatUi();
    if (s === 'open') { hello(); toast('Verbunden'); }
    if (S.mode !== 'online' || S.screen === 'lost') return;
    if (s === 'left' || ((s === 'lost' || s === 'failed') && S.started)) { lost(s === 'left' ? S.names[1 - S.me] + ' hat das Spiel verlassen.' : 'Die Verbindung ist weg.'); }
    else if (s === 'failed') $('lobbyErr').textContent = 'Verbindung fehlgeschlagen. In strengen Netzen klappt die Direktverbindung nicht. Neu versuchen oder anderes Netz.';
  });
  setInterval(() => { if (S.mode === 'online' && !S.started && net.state() === 'open') hello(); }, 1200);
  function lost(text) { S.started = false; $('lostText').textContent = text; show('lost'); if (cfg.onLost) cfg.onLost(); }

  function readName() { S.name = cleanText($('nameIn').value, 16); store.set('name', S.name); }
  async function host() {
    readName(); if (audio) audio.unlock(); S.mode = 'online'; S.role = 'host'; S.me = 0; S.started = false; S.chat = []; S.unread = 0; setNames([S.name || 'Du', 'Gegner']); chatUi();
    show('lobby'); $('hostBox').hidden = false; $('guestBox').hidden = true; $('link').value = ''; $('answerIn').value = ''; $('lobbyErr').textContent = '';
    try { const code = await net.host({ name: S.name || 'Gastgeber' }); $('link').value = location.origin + location.pathname + location.search + '#m=' + code; }
    catch (e) { if (e.message !== 'abgebrochen') $('lobbyErr').textContent = 'Konnte keinen Link erzeugen. Seite neu laden.'; }
  }
  function prepare(text) {
    offer = decode(text, cfg.id);
    if (!offer) { toast('Der Link ist ungültig oder gehört zu einem anderen Spiel.'); return false; }
    S.mode = 'online'; S.role = 'guest'; show('lobby'); $('hostBox').hidden = true; $('guestBox').hidden = false; $('lobbyErr').textContent = '';
    $('inviter').textContent = (cleanText(offer.info && offer.info.name, 16) || 'Jemand') + ' fordert dich heraus.'; $('answerBox').hidden = true; $('joinBtn').hidden = false; return true;
  }
  async function join() {
    readName(); if (audio) audio.unlock(); S.me = 1; S.started = false; S.chat = []; S.unread = 0; setNames([cleanText(offer.info && offer.info.name, 16) || 'Gegner', S.name || 'Du']); chatUi(); $('joinBtn').hidden = true;
    try { $('answerOut').value = await net.join(offer); $('answerBox').hidden = false; } catch (e) { $('lobbyErr').textContent = 'Der Link ist abgelaufen. Bitte um einen neuen.'; $('joinBtn').hidden = false; }
  }
  const copy = (id, btn) => { const f = $(id); f.select(); try { navigator.clipboard.writeText(f.value).then(() => { const o = btn.textContent; btn.textContent = 'Kopiert ✓'; setTimeout(() => (btn.textContent = o), 1400); }, () => {}); } catch (e) { /* Feld ist markiert */ } };

  /* ---------- Chat ---------- */
  function onChat(d) {
    const now = Date.now(); if (S.mute) return; const text = cleanText(d.x, 200); if (!text) return;
    S.chatTimes = S.chatTimes.filter((x) => now - x < 10000); if (S.chatTimes.length >= 8) return; S.chatTimes.push(now);
    addChat(false, text); if (audio) audio.play('msg'); if ($('chat').hidden) toast(S.names[1 - S.me] + ': ' + text);
  }
  function addChat(me, text) { S.chat.push({ me, text }); if (S.chat.length > 50) S.chat.shift(); if (!me && $('chat').hidden) S.unread++; chatUi(); }
  function sendChat(text) { text = cleanText(text, 200); if (!text || !net.send({ t: 'chat', x: text })) return false; addChat(true, text); return true; }
  function chatUi() {
    const list = $('chatList'); list.textContent = '';
    if (!S.chat.length) { const e = document.createElement('p'); e.textContent = 'Nur ihr zwei seht diesen Chat.'; list.appendChild(e); }
    for (const m of S.chat) { const e = document.createElement('div'); e.className = m.me ? 'me' : 'opp'; e.textContent = m.text; list.appendChild(e); }
    list.scrollTop = list.scrollHeight; $('badge').hidden = !S.unread; $('badge').textContent = S.unread;
    const on = net.state() === 'open'; $('chatIn').disabled = !on; $('chatSend').disabled = !on; $('chatMute').setAttribute('aria-pressed', String(S.mute));
  }

  /* ---------- Bedienung ---------- */
  function setPaused(p) { if (p) { if (S.screen !== 'play') return; S.paused = S.mode === 'solo'; $('pauseNote').textContent = S.mode === 'online' ? 'Online läuft das Spiel weiter.' : ''; show('pause'); } else { if (S.screen !== 'pause') return; S.paused = false; show('play'); } if (cfg.onPause) cfg.onPause(S.screen === 'pause'); }
  $('nameIn').value = S.name;
  for (const b of root.querySelectorAll('[data-level]')) { b.onclick = () => { S.level = b.dataset.level; store.set('level', S.level); for (const x of root.querySelectorAll('[data-level]')) x.setAttribute('aria-pressed', String(x === b)); if (audio) audio.play('ui'); }; b.setAttribute('aria-pressed', String(b.dataset.level === S.level)); }
  $('btnSolo').onclick = solo; $('btnHost').onclick = host;
  $('btnJoinLink').onclick = () => { $('pasteBox').hidden = !$('pasteBox').hidden; if (!$('pasteBox').hidden) $('pasteIn').focus(); };
  $('pasteGo').onclick = () => prepare($('pasteIn').value); $('joinBtn').onclick = join;
  $('connectBtn').onclick = async () => { try { await net.accept($('answerIn').value); $('lobbyErr').textContent = ''; } catch (e) { $('lobbyErr').textContent = 'Das ist kein gültiger Antwort-Code (oder er passt nicht zu diesem Link).'; } };
  $('copyLink').onclick = () => copy('link', $('copyLink')); $('copyAnswer').onclick = () => copy('answerOut', $('copyAnswer'));
  if (navigator.share) { $('shareLink').hidden = false; $('shareLink').onclick = () => navigator.share({ title: cfg.title.join(' '), text: 'Spiel gegen mich:', url: $('link').value }).catch(() => {}); }
  $('lobbyBack').onclick = toMenu;
  const soundLabel = () => { const on = !audio || audio.enabled(); $('btnSound').textContent = on ? '🔊' : '🔇'; $('btnSound').setAttribute('aria-pressed', String(on)); $('menuSound').textContent = on ? 'Ton: an' : 'Ton: aus'; };
  $('btnSound').onclick = $('menuSound').onclick = () => { if (audio) audio.toggle(); soundLabel(); }; soundLabel();
  $('btnPause').onclick = () => setPaused(S.screen !== 'pause'); $('btnResume').onclick = () => setPaused(false);
  $('btnQuit').onclick = toMenu; $('btnMenu').onclick = toMenu; $('lostMenu').onclick = toMenu;
  $('btnAgain').onclick = () => { if (S.mode !== 'online') return solo(); S.rematchMine = true; endButtons(); net.send({ t: 'rematch' }); if (S.rematchPeer && S.role === 'host') startOnline(); };
  $('btnChat').onclick = () => { $('chat').hidden = !$('chat').hidden; S.unread = 0; chatUi(); };
  $('chatClose').onclick = () => { $('chat').hidden = true; };
  $('chatMute').onclick = () => { S.mute = !S.mute; chatUi(); };
  $('chatForm').onsubmit = (e) => { e.preventDefault(); if (sendChat($('chatIn').value)) $('chatIn').value = ''; };
  for (const b of root.querySelectorAll('[data-q]')) b.onclick = () => sendChat(b.dataset.q);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!$('chat').hidden) $('chat').hidden = true; else if (S.screen === 'play' || S.screen === 'pause') setPaused(S.screen !== 'pause'); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.mode === 'solo' && S.screen === 'play') setPaused(true); });
  document.addEventListener('contextmenu', (e) => { if (!/INPUT|TEXTAREA/.test(e.target.tagName)) e.preventDefault(); });
  addEventListener('hashchange', () => { if (/^#m=/.test(location.hash)) location.reload(); });

  show('menu'); chatUi();
  return {
    state: S, net, store,
    start() { if (/^#m=/.test(location.hash)) prepare(location.hash); const b = $('boot'); if (b) b.remove(); if (window.isSecureContext && 'serviceWorker' in navigator && !qs.has('nosw')) navigator.serviceWorker.register('sw.js').catch(() => {}); },
    onGame(fn) { gameMsg = fn; }, send: (o) => net.send(o),
    banner, hint, toast, setScore, setSub, end, toMenu, setPaused, abort(text) { S.started = false; net.leave(); lost(text); },
    paused: () => S.paused, playing: () => (S.screen === 'play' || S.screen === 'pause') && !S.over,
    snapshot: () => ({ screen: S.screen, mode: S.mode, role: S.role, me: S.me, names: S.names.slice(), level: S.level, score: S.score.slice(), over: S.over, winner: S.winner, paused: S.paused, conn: net.state(), chat: S.chat.map((m) => (m.me ? 'ich: ' : 'er: ') + m.text), unread: S.unread })
  };
}
