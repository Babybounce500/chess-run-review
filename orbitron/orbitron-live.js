/* Orbitron Live: Auto-Coach. Holt deine neuen Chess.com-Partien (oeffentliche Schnittstelle), analysiert sie mit Stockfish im Browser
 * und macht daraus neue Aufgaben (Fehler, Bullet, verpasste Matts, Zeitnot) und frische Zahlen fuer Rating-Hebel und Mattbild-Atlas.
 * Alles bleibt im Browser (localStorage). Die Analyse ist flacher als eine Analyse auf dem Rechner: kurze Bedenkzeit, Verdacht ab 200 cp,
 * Bestaetigung mit laengerer Bedenkzeit ab 300 cp. Maia-Werte gibt es hier nicht.
 */
(function () {
  'use strict';
  const K = window.OrbitronGameCore, C = window.Chess; if (!K || !C) return;
  let kit = null;
  function ready(fn) { if (window.OrbitronGame && window.OrbitronGame._kit) { kit = window.OrbitronGame._kit; fn(); } else document.addEventListener('orbitron-game-ready', () => { kit = window.OrbitronGame._kit; fn(); }, { once: true }); }
  const KEY = 'orbitron_live_v1', USER_KEY = 'orbitron_cc_user_v1';
  const MAXG = 12, FAST = 90, DEEP = 450;
  const fkey = (f) => String(f).split(' ').slice(0, 4).join(' ');
  const clamp = (x) => Math.max(-1000, Math.min(1000, x));
  const DRAW = ['agreed', 'repetition', 'stalemate', 'insufficient', 'timevsinsufficient', '50move'];

  function load() { let s = null; try { s = kit.lsGet(KEY, null); } catch (e) { s = null; } if (!s || typeof s !== 'object') s = {}; s.tasks = s.tasks || {}; for (const k of ['blunder', 'bullet', 'ownmate', 'zeit']) s.tasks[k] = s.tasks[k] || []; s.games = s.games || []; s.done = s.done || 0; s.since = s.since || 0; s.log = s.log || []; return s; }
  function save(s) { try { kit.lsSet(KEY, s); } catch (e) { /* Speicher voll oder gesperrt: ohne Speichern weiter */ } }

  // ---------- Mattfigur (wie in der Auswertung des Archivs) ----------
  const DIRS = { n: [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]], k: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]], b: [[1, 1], [1, -1], [-1, 1], [-1, -1]], r: [[1, 0], [-1, 0], [0, 1], [0, -1]] };
  const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  function attacks(bd, r, c) {
    const p = bd[r][c]; if (!p) return []; const out = [];
    if (p.type === 'p') { const dr = p.color === 'w' ? -1 : 1; for (const dc of [-1, 1]) if (inB(r + dr, c + dc)) out.push([r + dr, c + dc]); return out; }
    if (p.type === 'n' || p.type === 'k') { for (const [a, b] of DIRS[p.type]) if (inB(r + a, c + b)) out.push([r + a, c + b]); return out; }
    const ds = p.type === 'b' ? DIRS.b : p.type === 'r' ? DIRS.r : DIRS.b.concat(DIRS.r);
    for (const [a, b] of ds) { let y = r + a, x = c + b; while (inB(y, x)) { out.push([y, x]); if (bd[y][x]) break; y += a; x += b; } }
    return out;
  }
  function classify(h) {
    const g = new C(); for (const m of h) g.move(m); const last = h[h.length - 1]; const mater = last.color; const bd = g.board(); let KS = null;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = bd[r][c]; if (p && p.type === 'k' && p.color !== mater) KS = [r, c]; }
    if (!KS) return 'Sonstiges';
    const checkers = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = bd[r][c]; if (p && p.color === mater && attacks(bd, r, c).some(([a, b]) => a === KS[0] && b === KS[1])) checkers.push({ p, r, c }); }
    const sq = (r, c) => 'abcdefgh'[c] + (8 - r); const nbrs = DIRS.k.map(([a, b]) => [KS[0] + a, KS[1] + b]).filter(([a, b]) => inB(a, b));
    const allOwn = nbrs.filter(([a, b]) => bd[a][b] && bd[a][b].color !== mater).length === nbrs.length; const backRank = mater === 'w' ? KS[0] === 0 : KS[0] === 7; const n = Math.ceil(h.length / 2);
    if (checkers.length >= 2) return 'Doppelschach'; const c0 = checkers[0]; if (!c0) return 'Sonstiges';
    if (c0.p.type !== last.piece) return 'Abzug';
    if (c0.p.type === 'n' && allOwn) return 'Erstickt';
    if ((c0.p.type === 'q' || c0.p.type === 'r') && backRank && c0.r === KS[0]) return 'Grundreihe';
    if (c0.p.type === 'q' && n <= 10 && ['f7', 'f2'].includes(sq(c0.r, c0.c))) return 'Schäfermatt';
    if (c0.p.type === 'q') {
      const sup = new Set(); for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = bd[r][c]; if (p && p.color === mater && !(r === c0.r && c === c0.c) && attacks(bd, r, c).some(([a, b]) => a === c0.r && b === c0.c)) sup.add(p.type); }
      const s = [...sup]; if (!s.length) return 'Dame allein'; if (s.length > 1) return 'Dame + mehrere';
      return { r: 'Dame + Turm', b: 'Dame + Läufer', n: 'Dame + Springer', p: 'Dame + Bauer', k: 'Dame + König', q: 'Dame + Dame' }[s[0]];
    }
    return { p: 'Bauer', n: 'Springer', b: 'Läufer', r: 'Turm', k: 'Sonstiges' }[c0.p.type];
  }

  // ---------- Analyse einer Partie ----------
  const val = (r) => !r ? null : r.mate != null ? (r.mate > 0 ? 10000 : -10000) : r.cp;
  const phaseOf = (fen) => { const parts = fen.split(' '); const pcs = (parts[0].match(/[a-zA-Z]/g) || []).length; const n = parseInt(parts[5], 10) || 1; return pcs <= 12 ? 'e' : n < 12 ? 'o' : 'm'; };
  function clocks(pgn) { const out = []; const re = /\[%clk (\d+):(\d+):(\d+(?:\.\d+)?)\]/g; let m; while ((m = re.exec(pgn))) out.push(+m[1] * 3600 + +m[2] * 60 + parseFloat(m[3])); return out; }
  async function search(fen, ms) { const r = await kit.Engine.search(fen, { skill: 20, movetime: ms }); return r; }

  async function analyzeGame(g, user, ctl) {
    const out = { blunder: [], ownmate: [], zeit: [], plies: 0, err: null };
    const c = new C(); if (!c.load_pgn(g.pgn, { sloppy: true })) { out.err = 'PGN nicht lesbar'; return out; }
    const hdr = c.header(); const startFen = hdr.FEN && hdr.SetUp === '1' ? hdr.FEN : undefined;
    const h = c.history({ verbose: true }); const L = h.length; const meW = g.white.username.toLowerCase() === user; const me = meW ? 'w' : 'b';
    const b = startFen ? new C(startFen) : new C(); const fens = [b.fen()]; const games = [new C(b.fen())]; for (const m of h) { b.move(m); fens.push(b.fen()); }
    const num = (fen) => parseInt(fen.split(' ')[5], 10) || 1; const first = fens.findIndex((f, i) => i < L && h[i].color === me && num(f) >= 6); if (first < 0) return out;
    const clk = clocks(g.pgn); const ev = new Array(L + 1).fill(null); const fastRes = new Array(L + 1).fill(null);
    for (let i = first; i <= L; i++) {
      if (ctl.stop) return out; const gg = new C(fens[i]); if (gg.game_over()) continue;
      const r = await search(fens[i], FAST); if (!r) throw new Error('Engine nicht erreichbar'); fastRes[i] = r; ev[i] = val(r); out.plies++; if (ctl.onPly) ctl.onPly(i, L);
    }
    let zeitDone = false;
    for (let i = first; i < L; i++) {
      if (h[i].color !== me || ev[i] == null) continue; const eU = ev[i], eO = ev[i + 1]; if (eO == null) continue; const played = h[i].from + h[i].to + (h[i].promotion || '');
      const fr = fastRes[i]; const bestFast = fr && fr.uci; const fen = fens[i]; const n = num(fen);
      // verpasstes Matt
      if (fr && fr.mate != null && fr.mate > 0 && fr.mate <= 6 && bestFast !== played && !(fastRes[i + 1] && fastRes[i + 1].mate != null && fastRes[i + 1].mate < 0)) {
        const d1 = await search(fen, DEEP); if (d1 && d1.mate != null && d1.mate > 0 && d1.mate <= 6 && d1.uci && d1.uci !== played) {
          const d2 = await search(fens[i + 1], DEEP); if (!(d2 && d2.mate != null && d2.mate < 0)) {
            const mv = new C(fen).move({ from: d1.uci.slice(0, 2), to: d1.uci.slice(2, 4), promotion: d1.uci[4] });
            out.ownmate.push([fen, d1.uci, played, h[i].piece.toUpperCase(), phaseOf(fen), d1.mate, 9000, n, 'Matt in ' + d1.mate, null, 1, mv ? mv.san : '']); continue;
          }
        }
      }
      const loss = clamp(eU) + clamp(eO);
      if (loss >= 200 && clamp(eU) > -800 && bestFast !== played) {
        const d1 = await search(fen, DEEP); const d2 = await search(fens[i + 1], DEEP); const e1 = val(d1), e2 = val(d2);
        if (d1 && d1.uci && d1.uci !== played && e1 != null && e2 != null) { const l2 = clamp(e1) + clamp(e2); if (l2 >= 300 && clamp(e1) > -800) out.blunder.push([fen, d1.uci, played, h[i].piece.toUpperCase(), phaseOf(fen), l2, Math.max(-9000, Math.min(9000, e1)), n, '', null, 1, '']); }
      }
      // Zeitnot: wenig Zeit auf der Uhr, aber klar besser
      if (!zeitDone && i >= 2 && clk[i - 2] != null && clk[i - 2] <= 15 && eU >= 400 && (g.time_class === 'bullet' || g.time_class === 'blitz') && fr && fr.uci) {
        zeitDone = true; const mv = new C(fen).move({ from: fr.uci.slice(0, 2), to: fr.uci.slice(2, 4), promotion: fr.uci[4] });
        out.zeit.push([fen, fr.uci, played, h[i].piece.toUpperCase(), phaseOf(fen), Math.max(0, loss), Math.min(eU, 9000), n, 'Vorteil sichern', null, Math.max(1, Math.floor(clk[i - 2])), mv ? mv.san : '']);
      }
    }
    return out;
  }
  function profileRow(g, user) {
    const meW = g.white.username.toLowerCase() === user; const mine = meW ? g.white : g.black, opp = meW ? g.black : g.white;
    const res = mine.result === 'win' ? 'W' : DRAW.includes(mine.result) ? 'D' : 'L'; const row = { t: g.end_time, tc: g.time_class, res, end: res === 'W' ? opp.result : mine.result, fig: null };
    if (row.end === 'checkmated' && g.pgn) { try { const c = new C(); if (c.load_pgn(g.pgn, { sloppy: true })) { const h = c.history({ verbose: true }); const last = h[h.length - 1]; if (last && /#/.test(last.san)) row.fig = classify(h); } } catch (e) { /* egal */ } }
    return row;
  }

  // ---------- Daten in die Trainer und das Profil einmischen ----------
  const TARGET = { blunder: 'ORBITRON_BLUNDERS', bullet: 'ORBITRON_BULLET', ownmate: 'ORBITRON_OWNMATES', zeit: 'ORBITRON_ZEITNOT' };
  function mergeTasks() {
    const s = load(); let added = 0;
    for (const [k, name] of Object.entries(TARGET)) { const arr = window[name] = window[name] || []; const seen = new Set(arr.map((a) => fkey(a[0]))); for (const t of s.tasks[k]) { const key = fkey(t[0]); if (!seen.has(key)) { arr.push(t); seen.add(key); added++; } } }
    return added;
  }
  function applyProfile() {
    const D = window.ORBITRON_PROFILE_DATA; if (!D) return 0; const s = load(); D.__applied = D.__applied || 0; let n = 0;
    for (let i = D.__applied; i < s.games.length; i++) {
      const g = s.games[i]; n++;
      for (const key of ['alle', 'letzte500']) {
        const d = D[key]; const b = d.byClass[g.tc]; if (!b) continue; d.games++; b.n++; if (g.res === 'W') b.w++; else if (g.res === 'D') b.d++; else b.l++;
        if (g.fig) { const a = d.atlas[g.fig] = d.atlas[g.fig] || { won: 0, lost: 0 }; if (g.res === 'W') a.won++; else if (g.res === 'L') a.lost++; }
        if (g.res === 'L') { const e = g.end; if (e === 'timeout') b.loss.zeit++; else if (e === 'resigned') b.loss.aufgabe++; else if (e === 'abandoned') b.loss.verlassen++; else if (e === 'checkmated') { const f = g.fig || 'Sonstiges'; b.loss.matt[f] = (b.loss.matt[f] || 0) + 1; } else b.loss.sonst++; }
      }
    }
    D.__applied = s.games.length; return n;
  }

  // ---------- Import ----------
  async function getJSON(url) { const r = await fetch(url); if (r.status === 404) return null; if (!r.ok) throw new Error('Chess.com antwortet mit Fehler ' + r.status); return r.json(); }
  async function fetchNew(user, since) {
    const idx = await getJSON(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/archives`); if (!idx) throw new Error('Benutzer nicht gefunden.');
    const urls = (idx.archives || []).slice(-2); let games = [];
    for (const u of urls) { const j = await getJSON(u); if (j && j.games) games = games.concat(j.games); }
    return games.filter((g) => g.rules === 'chess' && g.pgn && ['bullet', 'blitz', 'rapid'].includes(g.time_class) && g.end_time > since).sort((a, b) => a.end_time - b.end_time);
  }
  // Alle neuen Partien fliessen in die Statistik (billig). Die Engine-Analyse laeuft nur fuer die neuesten n Partien (neueste zuerst).
  async function runImport(user, ui, opts) {
    opts = opts || {}; const nA = Math.max(1, Math.min(100, opts.n || MAXG));
    user = String(user || '').trim().toLowerCase(); if (!user) throw new Error('Bitte den Chess.com-Namen eingeben.');
    const s = load(); if (s.user && s.user !== user) { s.tasks = { blunder: [], bullet: [], ownmate: [], zeit: [] }; s.games = []; s.done = 0; s.analyzed = 0; s.since = 0; }
    s.user = user; if (!s.since) s.since = (window.ORBITRON_PROFILE_DATA && window.ORBITRON_PROFILE_DATA.lastEnd) || Math.floor(Date.now() / 1000) - 7 * 86400; save(s);
    ui.say('Lade Partien …'); const all = await fetchNew(user, s.since);
    if (!all.length) { ui.say('Nichts Neues', 'Seit der letzten Analyse gibt es keine neuen Partien.'); return { games: 0, counted: 0, added: 0, sum: { blunder: 0, bullet: 0, ownmate: 0, zeit: 0, errs: 0 } }; }
    ui.say('Zähle ' + all.length + ' neue Partien …');
    { const st = load(); for (const g of all) st.games.push(profileRow(g, user)); if (st.games.length > 3000) st.games = st.games.slice(-3000); st.done = (st.done || 0) + all.length; st.since = all[all.length - 1].end_time; save(st); applyProfile(); }
    const batch = all.slice(-nA).reverse(); const ctl = { stop: false }; ui.ctl(ctl); let addedTasks = 0, gi = 0; const sum = { blunder: 0, bullet: 0, ownmate: 0, zeit: 0, errs: 0 };
    for (const g of batch) {
      if (ctl.stop) break; gi++; ui.progress(gi, batch.length, 0, 1);
      ctl.onPly = (i, L) => ui.progress(gi, batch.length, i, L);
      let res; try { res = await analyzeGame(g, user, ctl); } catch (e) { if (/Engine/.test(e.message)) { ui.say('Engine nicht erreichbar', 'Stockfish konnte nicht geladen werden. Prüfe deine Verbindung und versuche es nochmal.'); break; } res = { blunder: [], ownmate: [], zeit: [], err: e.message }; sum.errs++; }
      if (ctl.stop) break;
      const st = load(); st.analyzed = (st.analyzed || 0) + 1;
      const bucket = g.time_class === 'bullet' ? 'bullet' : 'blunder'; for (const t of res.blunder) st.tasks[bucket].push(t); for (const t of res.ownmate) st.tasks.ownmate.push(t); for (const t of res.zeit) st.tasks.zeit.push(t);
      sum[bucket] += res.blunder.length; sum.ownmate += res.ownmate.length; sum.zeit += res.zeit.length;
      for (const k of Object.keys(st.tasks)) if (st.tasks[k].length > 400) st.tasks[k] = st.tasks[k].slice(-400);
      st.log.push({ t: g.end_time, tc: g.time_class, b: res.blunder.length, m: res.ownmate.length, z: res.zeit.length }); if (st.log.length > 60) st.log = st.log.slice(-60);
      save(st); addedTasks += mergeTasks();
    }
    return { games: gi, counted: all.length, added: addedTasks, sum };
  }

  // ---------- Karte ----------
  function openCoach() {
    const card = kit.newCard(); let user = ''; try { user = kit.lsGet(USER_KEY, '') || ''; } catch (e) { user = ''; } const s0 = load(); if (!user && s0.user) user = s0.user;
    card.innerHTML = `<div class="og-title"><i class="bi bi-arrow-repeat"></i> Auto-Coach <span class="og-badge" data-badge></span></div>
      <div class="og-note og-desc">Holt deine neuen Chess.com-Partien (öffentliche Daten) und analysiert sie mit Stockfish direkt im Browser. Daraus entstehen neue Aufgaben in Fehler-Trainer, Bullet, Mattjäger und Zeitnot-Trainer, und der Rating-Hebel und das Mattbild werden aktualisiert. Alle neuen Partien zählen in der Statistik, die Engine analysiert die neuesten 6 bis 50 (eine Partie dauert etwa 10 bis 15 Sekunden). Die Analyse ist flacher als auf dem Rechner (kurze Bedenkzeit), und es gibt keine Maia-Werte.</div>
      <div class="og-row"><input class="og-input" data-user placeholder="Chess.com-Benutzername" style="max-width:240px" value="${kit.esc(user)}"><label class="og-note" for="og-cn">Neueste</label><select class="og-select" id="og-cn" data-n>${[6, 12, 25, 50].map((n) => `<option value="${n}" ${n === 12 ? 'selected' : ''}>${n} Partien</option>`).join('')}</select><button class="og-btn primary" data-run>Neue Partien analysieren</button><button class="og-btn" data-stop style="display:none">Stopp</button></div>
      <div class="og-say" data-say><b>Bereit</b><span class="og-sub">Mit dem Knopf holst du die Partien seit deiner letzten Analyse.</span></div>
      <div style="height:8px;border-radius:6px;background:rgba(128,128,128,.25);overflow:hidden;display:none" data-barwrap><div data-bar style="height:100%;width:0;background:#1a73e8"></div></div>
      <div data-summary></div>
      <div class="og-row"><button class="og-btn" data-t="blunder">Fehler-Trainer</button><button class="og-btn" data-t="bullet">Bullet-Aufgaben</button><button class="og-btn" data-t="ownmate">Mattjäger</button><button class="og-btn" data-t="zeit">Zeitnot-Trainer</button><button class="og-btn" data-t="hebel">Rating-Hebel</button><button class="og-btn" data-reset>Auto-Coach zurücksetzen</button></div>`;
    const q = (x) => card.querySelector(x); let ctl = null; let running = false;
    function say(a, b) { q('[data-say]').innerHTML = `<b>${kit.esc(a)}</b>${b ? `<span class="og-sub">${kit.esc(b)}</span>` : ''}`; }
    function drawSummary() {
      const s = load(); const n = (k) => s.tasks[k].length;
      q('[data-badge]').textContent = s.done ? `${s.done} Partien gezählt` : 'noch nichts importiert';
      q('[data-summary]').innerHTML = s.done ? `<div class="og-note">${s.analyzed || 0} Partien analysiert. Neue Aufgaben: <b>${n('blunder')}</b> Fehler, <b>${n('bullet')}</b> Bullet, <b>${n('ownmate')}</b> verpasste Matts, <b>${n('zeit')}</b> Zeitnot. Letzte Partie: ${s.since ? new Date(s.since * 1000).toLocaleDateString('de-DE') : '-'}.</div>` : '';
    }
    q('[data-stop]').onclick = () => { if (ctl) ctl.stop = true; say('Stoppe …', 'Die bisherigen Ergebnisse bleiben gespeichert.'); };
    q('[data-run]').onclick = async () => {
      if (running) return; running = true; const u = q('[data-user]').value; try { kit.lsSet(USER_KEY, String(u).trim().toLowerCase()); } catch (e) { /* egal */ }
      q('[data-run]').disabled = true; q('[data-stop]').style.display = ''; q('[data-barwrap]').style.display = '';
      const ui = { say, ctl: (c) => { ctl = c; }, progress: (gi, gn, i, L) => { q('[data-bar]').style.width = Math.round(((gi - 1) + (L ? i / L : 0)) / gn * 100) + '%'; say(`Partie ${gi} von ${gn}`, `Zug ${Math.ceil(i / 2)} von ${Math.ceil(L / 2)} wird geprüft.`); } };
      try {
        const r = await runImport(u, ui, { n: +q('[data-n]').value }); card.__coach.last = r;
        if (r.counted) say(`${r.counted} neue Partien gezählt, ${r.games} analysiert`, `${r.sum.blunder + r.sum.bullet} neue Fehler, ${r.sum.ownmate} verpasste Matts, ${r.sum.zeit} Zeitnot-Stellungen. Rating-Hebel und Mattbild sind aktualisiert.${r.sum.errs ? ` ${r.sum.errs} Partie(n) ließen sich nicht lesen.` : ''}`);
      } catch (e) { say('Das hat nicht geklappt', e.message || 'Unbekannter Fehler.'); }
      running = false; q('[data-run]').disabled = false; q('[data-stop]').style.display = 'none'; q('[data-bar]').style.width = '100%'; drawSummary();
    };
    q('[data-reset]').onclick = () => { try { kit.lsSet(KEY, null); } catch (e) { /* egal */ } drawSummary(); say('Zurückgesetzt', 'Die neuen Aufgaben verschwinden nach dem nächsten Neuladen der Seite.'); };
    card.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { const k = b.dataset.t; if (k === 'hebel') { if (window.OrbitronProfile) window.OrbitronProfile.openProfile('lever'); return; } const T = window.OrbitronTrain; if (T) T.openBlunderTrainer(k === 'blunder' ? {} : { set: k }); });
    card.__coach = { run: (u) => runImport(u, { say, ctl: () => { }, progress: () => { } }), state: load, last: null };
    kit.addCard(card); drawSummary(); return card;
  }
  function match(t) {
    if (!t) return null; const s = t.toLowerCase();
    if (/^[/](coach|autocoach|auto-coach|update|aktualisieren)\b|^auto-?coach\b/.test(s)) return { run: openCoach };
    return null;
  }
  ready(() => { mergeTasks(); applyProfile(); window.OrbitronLive = { openCoach, runImport, analyzeGame, classify, mergeTasks, applyProfile, match, load, version: '1.0' }; });
})();
