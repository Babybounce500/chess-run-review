/* Orbitron Open: Eroeffnungs-Pruefer (Varianten nachspielen, Buchzuege sehen, deine Bilanz) und Eroeffnungs-Fallen (stellen und erkennen).
 * Baut auf orbitron-game.js (Brett, Engine, Karten) und orbitron-train.js (Menue) auf. chess.js entscheidet immer ueber die Legalitaet.
 * Buchzuege: Lichess-ECO-Daten (CLAUDE-ADDONS/orbitron-eco-data.js, wird bei Bedarf nachgeladen). Deine Bilanz: orbitron-repertoire.js. Fallen: orbitron-traps.js.
 */
(function () {
  'use strict';
  const K = window.OrbitronGameCore, C = window.Chess;
  if (!K || !C) return;
  let kit = null;
  const TRAP_KEY = 'orbitron_trap_stats_v1', REP_KEY = 'orbitron_rep_stats_v1';
  function ready(fn) {
    if (window.OrbitronGame && window.OrbitronGame._kit) { kit = window.OrbitronGame._kit; fn(); } else document.addEventListener('orbitron-game-ready', () => { kit = window.OrbitronGame._kit; fn(); }, { once: true });
  }
  const norm = (s) => String(s).replace(/[+#!?]/g, '');
  const pct = (x) => Math.round(x) + ' %';
  const COLOR_DE = { w: 'Weiß', b: 'Schwarz' };
  const numbered = (sans) => { let o = [], n = 1; for (let i = 0; i < sans.length; i++) { o.push((i % 2 === 0 ? n + '.' : '') + sans[i]); if (i % 2 === 1) n++; } return o.join(' '); };
  const numberedFrom = (sans, startColor) => { // Zugnummern bei beliebigem Startrecht
    return numbered(sans);
  };

  // ---------------- ECO-Daten (Lichess, CC0) ----------------
  let ECO = null, NEXT = null, BYLEN = null, ecoP = null;
  function prepEco() {
    if (ECO) return ECO;
    ECO = window.ORBITRON_ECO_DATA.map((e) => ({ eco: e[0], name: e[1], m: e[2].split(' ').map(norm) }));
    NEXT = new Map();
    for (const e of ECO) for (let i = 0; i < e.m.length; i++) { const k = e.m.slice(0, i).join(' '); if (!NEXT.has(k)) NEXT.set(k, new Set()); NEXT.get(k).add(e.m[i]); }
    BYLEN = ECO.slice().sort((a, b) => b.m.length - a.m.length);
    return ECO;
  }
  function loadEco() {
    if (ECO) return Promise.resolve(ECO);
    if (window.ORBITRON_ECO_DATA) return Promise.resolve(prepEco());
    if (!ecoP) ecoP = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'CLAUDE-ADDONS/orbitron-eco-data.js';
      s.onload = () => res(prepEco()); s.onerror = () => { ecoP = null; rej(new Error('Die Eröffnungsdaten konnten nicht geladen werden. Prüfe deine Verbindung.')); };
      document.head.appendChild(s);
    });
    return ecoP;
  }
  function classify(moves) { for (const e of BYLEN) { if (e.m.length > moves.length) continue; let ok = true; for (let i = 0; i < e.m.length; i++) if (e.m[i] !== moves[i]) { ok = false; break; } if (ok) return e; } return null; }
  function longestWithPrefix(prefix) { for (const e of BYLEN) { if (e.m.length < prefix.length) continue; let ok = true; for (let i = 0; i < prefix.length; i++) if (e.m[i] !== prefix[i]) { ok = false; break; } if (ok) return e; } return null; }
  // Kurze Linien (zum Beispiel nur 1.e4 d6) werden auf eine echte Variante der gleichen Familie verlaengert (hoechstens 16 Halbzuege)
  function extendShort(e, pref) {
    if (e.m.length >= 8) return e; const fam = e.name.split(':')[0]; let best = null, bs = 1e9;
    for (const x of ECO) {
      if (x.m.length <= e.m.length || x.m.length > 16 || !x.name.startsWith(fam)) continue; let ok = true; for (let i = 0; i < e.m.length; i++) if (x.m[i] !== e.m[i]) { ok = false; break; } if (!ok) continue;
      const sc = Math.abs(x.m.length - 10) - (pref && pref.has(x.name) ? 4 : 0); if (sc < bs) { bs = sc; best = x; }
    }
    return best || e;
  }
  const guessColor = (name) => /Defen[cs]e|Declined|Indian|Benoni|Sicilian|French|Caro|Pirc|Modern|Scandinavian|Alekhine|Dutch|Nimzowitsch|Philidor|Petrov|Petroff|Slav|Gr[uü]nfeld|Budapest|Benko|Englund|Albin|Czech|Owen|St\. George|Latvian/.test(name) ? 'b' : 'w';

  // ---------------- gemeinsames Spielbrett ----------------
  function mkBoard(card, st) {
    const board = kit.makeBoard({
      getTargets: (sq) => { if (st.busy || st.done || !st.chess || st.chess.turn() !== st.user) return []; const p = st.chess.get(sq); if (!p || p.color !== st.chess.turn()) return []; return st.chess.moves({ square: sq, verbose: true }).map((m) => m.to); },
      onMove: (f, t) => st.onMove && st.onMove(f, t)
    });
    return board;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function marksFor(chess, san) { try { const t = new C(chess.fen()); const m = t.move(san, { sloppy: true }); return m ? { [m.from]: 'og-hint', [m.to]: 'og-hint' } : {}; } catch (e) { return {}; } }

  // ---------------- Eroeffnungs-Pruefer ----------------
  function openRepertoire() {
    const card = kit.newCard();
    const REP = (window.ORBITRON_REPERTOIRE && window.ORBITRON_REPERTOIRE.rows) || [];
    const repN = (window.ORBITRON_REPERTOIRE && window.ORBITRON_REPERTOIRE.games) || 0;
    const stats = kit.lsGet(REP_KEY, {}); const REPNAMES = new Set(REP.filter((r) => r[3] >= 5).map((r) => r[0]));
    const F = { tab: REP.length ? 'mine' : 'all', col: 'all', q: '' };
    card.innerHTML = `<div class="og-title"><i class="bi bi-diagram-3"></i> Eröffnungs-Prüfer <span class="og-badge">${REP.length ? 'aus ' + repN + ' deiner Partien' : 'Buchzüge'}</span></div>
      <div class="og-note og-desc">Wähle eine Eröffnung und spiele sie Zug für Zug nach. Du siehst die Buchzüge (Lichess-ECO), und für deine eigenen Eröffnungen deine Bilanz und die Stelle, an der du das Buch verlässt.</div>
      <div data-listview><div class="og-row" data-tabs></div><div class="og-row" data-fl></div><div data-list></div></div>
      <div data-playview style="display:none"><div class="og-play"><div class="og-left" data-boardwrap></div><div class="og-right">
        <div class="og-status" data-status></div><div class="og-note" data-name></div>
        <div class="og-say" data-say><b>Los geht's</b></div>
        <div class="og-row"><button class="og-btn" data-mode></button><button class="og-btn" data-side></button></div>
        <div class="og-row"><button class="og-btn" data-hint>Hinweis</button><button class="og-btn" data-sol>Buchzug zeigen</button><button class="og-btn" data-restart>Neu starten</button><button class="og-btn primary" data-back>Zur Liste</button></div>
        <div class="og-note" data-info></div></div></div></div>`;
    const q = (s) => card.querySelector(s);
    const st = { chess: null, user: 'w', busy: false, done: false, onMove: null };
    const S = { entry: null, line: [], ply: 0, mode: 'lernen', fails: 0, mistakes: 0, row: null, gen: 0 };
    const board = mkBoard(card, st); q('[data-boardwrap]').appendChild(board.el);
    function sayT(a, b) { q('[data-say]').innerHTML = `<b>${kit.esc(a)}</b>${b ? `<span class="og-sub">${kit.esc(b)}</span>` : ''}`; }
    const score = (r) => (r[4] + r[5] / 2) / r[3] * 100;

    // Empfehlung: staerkste und schwaechste Eroeffnung je Farbe (mindestens 20 Partien)
    function recBlock() {
      const part = ['w', 'b'].map((col) => {
        const arr = REP.filter((r) => r[2] === col && r[3] >= 20).sort((a, b) => score(b) - score(a)); if (arr.length < 2) return '';
        const best = arr[0], worst = arr[arr.length - 1]; const btn = (r) => `<button class="og-btn" data-i="${REP.indexOf(r)}" title="Diese Eröffnung üben">${kit.esc(r[0])} (${pct(score(r))}, ${r[3]} Partien)</button>`;
        return `<div class="og-row" style="align-items:center"><span class="og-note"><b>Mit ${COLOR_DE[col]}:</b> spiel heute</span>${btn(best)}<span class="og-note">· vorsichtig mit</span>${btn(worst)}</div>`;
      }).join('');
      return part ? `<div class="og-say"><b>Empfehlung aus deinen Partien</b><span class="og-sub">Nur Eröffnungen mit mindestens 20 Partien, alle Bedenkzeiten zusammen. Tippe auf eine Eröffnung, um sie zu üben.</span>${part}</div>` : '';
    }
    // Liste
    function drawList() {
      q('[data-tabs]').innerHTML = (REP.length ? `<button class="og-btn ${F.tab === 'mine' ? 'on' : ''}" data-tab="mine">Meine Eröffnungen (${REP.length})</button>` : '') + `<button class="og-btn ${F.tab === 'all' ? 'on' : ''}" data-tab="all">Alle Eröffnungen (Buch)</button>`;
      q('[data-tabs]').querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { F.tab = b.dataset.tab; drawList(); });
      const fl = q('[data-fl]'), list = q('[data-list]');
      if (F.tab === 'mine') {
        fl.innerHTML = [['all', 'Alle'], ['w', 'Mit Weiß'], ['b', 'Mit Schwarz']].map(([v, t]) => `<button class="og-btn ${F.col === v ? 'on' : ''}" data-col="${v}">${t}</button>`).join('');
        fl.querySelectorAll('[data-col]').forEach((b) => b.onclick = () => { F.col = b.dataset.col; drawList(); });
        const rows = REP.filter((r) => F.col === 'all' || r[2] === F.col);
        list.innerHTML = (F.col === 'all' ? recBlock() : '') + rows.slice(0, 80).map((r, i) => {
          const lv = r[8][0]; const dev = lv ? `<div class="og-note">Du verlässt das Buch oft nach <b>${kit.esc(numbered(lv[0].split(' ').filter(Boolean)))}</b> mit <b>${kit.esc(lv[1])}</b> (Buch: ${kit.esc(lv[2].join(', '))}) · ${lv[3]}× · ${pct(lv[4])} Punkte</div>` : '';
          const done = stats[r[0] + '|' + r[2]] ? ` · ✓ ${stats[r[0] + '|' + r[2]]}×` : '';
          return `<button class="og-btn" style="display:block;width:100%;text-align:left;margin:4px 0" data-i="${REP.indexOf(r)}"><b>${kit.esc(r[0])}</b> <span class="og-note">${r[1]} · ${COLOR_DE[r[2]]} · ${r[3]} Partien · ${r[4]}/${r[5]}/${r[6]} (${pct(score(r))}) · Buchtiefe im Schnitt ${Math.max(1, Math.round(r[7] / 2))} Züge${done}</span>${dev}</button>`;
        }).join('') || '<div class="og-note">Keine Eröffnungen.</div>';
        list.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => { const r = REP[+b.dataset.i]; const e = ECO.find((x) => x.name === r[0] && x.eco === r[1]) || ECO.find((x) => x.name === r[0]); if (e) startPlay(e, r[2], r); });
      } else {
        fl.innerHTML = `<input class="og-input" data-q placeholder="Eröffnung suchen, zum Beispiel Pirc, Scotch, Sizilianisch ..." value="${kit.esc(F.q)}" style="min-width:260px">`;
        const inp = fl.querySelector('[data-q]'); inp.oninput = () => { F.q = inp.value; drawMatches(); }; setTimeout(() => inp.focus(), 50);
        drawMatches();
      }
    }
    function drawMatches() {
      const list = q('[data-list]'); const s = F.q.trim().toLowerCase();
      const en = { sizilianisch: 'sicilian', franz: 'french', spanisch: 'ruy lopez', italienisch: 'italian', schottisch: 'scotch', skandinavisch: 'scandinavian', holl: 'dutch', königsindisch: 'king\'s indian', damengambit: 'queen\'s gambit', englisch: 'english', russisch: 'petrov', aljechin: 'alekhine', nimzowitsch: 'nimzo', moderne: 'modern' };
      let key = s; for (const [de, e] of Object.entries(en)) if (s.startsWith(de)) key = e + s.slice(de.length);
      const hits = (key ? ECO.filter((e) => e.name.toLowerCase().includes(key)) : ECO.filter((e) => e.m.length >= 4 && e.m.length <= 14 && !e.name.includes(':')).slice(0, 60)).slice().sort((a, b) => a.name.length - b.name.length || a.m.length - b.m.length).slice(0, 60);
      list.innerHTML = hits.map((e, i) => `<button class="og-btn" style="display:block;width:100%;text-align:left;margin:3px 0" data-e="${ECO.indexOf(e)}"><b>${kit.esc(e.name)}</b> <span class="og-note">${e.eco} · ${e.m.length} Halbzüge · ${kit.esc(numbered(e.m.slice(0, 8)))}${e.m.length > 8 ? ' ...' : ''}</span></button>`).join('') || '<div class="og-note">Nichts gefunden.</div>';
      list.querySelectorAll('[data-e]').forEach((b) => b.onclick = () => { const e = ECO[+b.dataset.e]; startPlay(e, guessColor(e.name), REP.find((r) => r[0] === e.name) || null); });
    }

    // Spiel
    function showPlay(on) { q('[data-listview]').style.display = on ? 'none' : ''; q('[data-playview]').style.display = on ? '' : 'none'; }
    function updName() { const h = st.chess.history().map(norm); const e = h.length ? classify(h) : null; q('[data-name]').textContent = e ? `${e.name} (${e.eco})` : (h.length ? 'Keine bekannte Eröffnung' : ''); }
    function refresh(last) {
      board.set({ fen: st.chess.fen(), flip: st.user === 'b', last: last || null, check: st.chess.in_check() ? kingSq(st.chess) : null, marks: S.mode === 'lernen' && !st.done && st.chess.turn() === st.user && S.ply < S.line.length ? marksFor(st.chess, S.line[S.ply]) : {} });
      updName();
      q('[data-info]').textContent = `Zug ${Math.floor(S.ply / 2) + 1} von ${Math.ceil(S.line.length / 2)} · Linie: ${S.entry.name} (${S.entry.eco})`;
    }
    function kingSq(c) { const b = c.board(); for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { const p = b[r][f]; if (p && p.type === 'k' && p.color === c.turn()) return 'abcdefgh'[f] + (8 - r); } return null; }
    function startPlay(entry, col, row) {
      entry = extendShort(entry, REPNAMES); S.gen++; S.entry = entry; S.line = entry.m.slice(); S.ply = 0; S.fails = 0; S.mistakes = 0; S.row = row; st.user = col; st.done = false; st.busy = false;
      st.chess = new C(); showPlay(true); q('[data-mode]').textContent = 'Modus: ' + (S.mode === 'lernen' ? 'Lernen (Buchzug wird gezeigt)' : 'Prüfen (ohne Hilfe)'); q('[data-side]').textContent = 'Ich spiele: ' + COLOR_DE[st.user];
      q('[data-status]').textContent = entry.name + ' · ' + COLOR_DE[st.user] + ' spielen';
      sayT('Los geht\'s', S.mode === 'lernen' ? 'Der Buchzug ist markiert. Spiele ihn.' : 'Spiele die Eröffnung aus dem Gedächtnis. Nach zwei Fehlern zeige ich den Buchzug.');
      refresh(); oppMoves();
    }
    async function oppMoves() {
      const gen = S.gen;
      while (!st.done && S.ply < S.line.length && st.chess.turn() !== st.user) {
        st.busy = true; await sleep(420); if (!card.isConnected || gen !== S.gen) return;
        const m = st.chess.move(S.line[S.ply], { sloppy: true }); if (!m) { st.done = true; sayT('Fehler in den Daten', 'Dieser Zug ist in der Datenbank nicht spielbar.'); return; }
        S.ply++; refresh([m.from, m.to]);
      }
      st.busy = false;
      if (S.ply >= S.line.length) finish(); else if (st.chess.turn() === st.user) refresh(st.chess.history({ verbose: true }).slice(-1).map((m) => [m.from, m.to])[0] || null);
    }
    st.onMove = async (from, to) => {
      if (st.busy || st.done || !st.chess || st.chess.turn() !== st.user) return;
      const cands = st.chess.moves({ verbose: true }).filter((m) => m.from === from && m.to === to); if (!cands.length) return;
      let promo; if (cands[0].promotion) promo = await board.promo(st.chess.turn());
      const m = st.chess.move({ from, to, promotion: promo }); const san = norm(m.san); const exp = S.line[S.ply];
      if (san === exp) { S.ply++; sayT('Buchzug!', S.mode === 'lernen' ? '' : 'Richtig.'); refresh([m.from, m.to]); if (S.ply >= S.line.length) { finish(); return; } oppMoves(); return; }
      const alts = NEXT.get(S.line.slice(0, S.ply).join(' '));
      if (alts && alts.has(san)) {
        const e2 = longestWithPrefix(S.line.slice(0, S.ply).concat([san]));
        S.entry = e2 || S.entry; if (e2) S.line = e2.m.slice(); S.ply++;
        sayT('Auch ein Buchzug', 'Das ist eine andere Variante: ' + (e2 ? e2.name : '') + '.'); refresh([m.from, m.to]); if (S.ply >= S.line.length) { finish(); return; } oppMoves(); return;
      }
      // kein Buchzug
      st.busy = true; board.set({ fen: st.chess.fen(), last: [m.from, m.to], marks: {} }); await sleep(450); st.chess.undo(); st.busy = false;
      S.fails++; S.mistakes++;
      const showIt = S.mode === 'lernen' || S.fails >= 2;
      sayT('Kein Buchzug', showIt ? `Der Buchzug ist ${exp}.` : 'Versuch es noch einmal oder nimm einen Hinweis.');
      board.set({ fen: st.chess.fen(), last: null, marks: showIt ? marksFor(st.chess, exp) : {} });
    };
    function finish() {
      st.done = true; const e = S.entry; const key = e.name + '|' + st.user; if (S.mistakes === 0) { stats[key] = (stats[key] || 0) + 1; kit.lsSet(REP_KEY, stats); }
      let extra = '';
      const row = S.row || REP.find((r) => r[0] === e.name && r[2] === st.user);
      if (row) { extra = ` Deine Bilanz in dieser Eröffnung: ${row[3]} Partien, ${row[4]} Siege, ${row[5]} Remis, ${row[6]} Niederlagen (${pct(score(row))}). Im Schnitt hältst du das Buch ${Math.max(1, Math.round(row[7] / 2))} Züge lang.`; const lv = row[8][0]; if (lv) extra += ` Häufigste Abweichung: nach ${numbered(lv[0].split(' ').filter(Boolean))} spielst du ${lv[1]} statt ${lv[2].join(' oder ')} (${lv[3]}×, ${pct(lv[4])} Punkte).`; }
      sayT(S.mistakes === 0 ? 'Fehlerfrei durch die Linie!' : 'Linie geschafft', `${e.name} (${e.eco}): ${S.mistakes === 0 ? 'ohne Fehler' : S.mistakes + ' Fehlversuche'}.${extra}`);
      board.set({ marks: {} });
    }
    q('[data-hint]').onclick = () => { if (st.done || st.busy || !st.chess || st.chess.turn() !== st.user) return; const mk = marksFor(st.chess, S.line[S.ply]); const from = Object.keys(mk)[0]; board.set({ marks: from ? { [from]: 'og-hint' } : {} }); sayT('Hinweis', 'Die markierte Figur macht den Buchzug.'); };
    q('[data-sol]').onclick = () => { if (st.done || st.busy || !st.chess || st.chess.turn() !== st.user) return; S.mistakes++; board.set({ marks: marksFor(st.chess, S.line[S.ply]) }); sayT('Buchzug', S.line[S.ply]); };
    q('[data-restart]').onclick = () => startPlay(S.entry, st.user, S.row);
    q('[data-mode]').onclick = () => { S.mode = S.mode === 'lernen' ? 'pruefen' : 'lernen'; startPlay(S.entry, st.user, S.row); };
    q('[data-side]').onclick = () => { st.user = st.user === 'w' ? 'b' : 'w'; startPlay(S.entry, st.user, S.row); };
    q('[data-back]').onclick = () => { st.done = true; showPlay(false); drawList(); };
    card.__open = { startPlay: (name, col) => { const e = ECO.find((x) => x.name === name); if (e) startPlay(e, col || guessColor(e.name), REP.find((r) => r[0] === name) || null); }, state: () => ({ S, st }), list: () => F };
    kit.addCard(card);
    loadEco().then(() => { if (!card.isConnected && false) return; drawList(); }).catch((e) => { q('[data-list]').innerHTML = `<div class="og-note">${kit.esc(e.message)}</div>`; });
    return card;
  }

  // ---------------- Eroeffnungs-Fallen ----------------
  function openTraps() {
    const card = kit.newCard();
    const TR = (window.ORBITRON_TRAPS || []).slice();
    const stats = kit.lsGet(TRAP_KEY, {});
    const F = { src: 'all', side: 'all', mode: 'stellen' };
    const id = (t) => t.n + '|' + t.p.split(' ').length + '|' + t.b;
    card.innerHTML = `<div class="og-title"><i class="bi bi-bug"></i> Eröffnungs-Fallen <span class="og-badge">${TR.length} Fallen</span></div>
      <div class="og-note og-desc">Zwei Übungen: <b>Falle stellen</b>: du spielst die Eröffnung bis zum Köder, der Gegner tappt hinein, und du findest den Gewinnzug. <b>Falle erkennen</b>: du spielst die Seite, die hineinfallen soll, und musst den Köder-Zug vermeiden. Alle Fallen sind mit Stockfish geprüft.</div>
      <div data-listview><div class="og-row" data-fl></div><div data-list></div></div>
      <div data-playview style="display:none"><div class="og-play"><div class="og-left" data-boardwrap></div><div class="og-right">
        <div class="og-status" data-status></div><div class="og-say" data-say><b>Los geht's</b></div>
        <div class="og-row"><button class="og-btn" data-hint>Hinweis</button><button class="og-btn" data-sol>Lösung</button><button class="og-btn" data-restart>Neu starten</button><button class="og-btn primary" data-back>Zur Liste</button></div>
        <div class="og-note" data-info></div></div></div></div>`;
    const q = (s) => card.querySelector(s);
    const st = { chess: null, user: 'w', busy: false, done: false, onMove: null };
    const board = mkBoard(card, st); q('[data-boardwrap]').appendChild(board.el);
    function sayT(a, b) { q('[data-say]').innerHTML = `<b>${kit.esc(a)}</b>${b ? `<span class="og-sub">${kit.esc(b)}</span>` : ''}`; }
    const SRC = { k: 'Klassisch', g: 'Dein Gegner fiel rein', m: 'Du bist reingefallen' };
    function drawList() {
      const fl = q('[data-fl]');
      fl.innerHTML = [['stellen', 'Falle stellen'], ['erkennen', 'Falle erkennen']].map(([v, t]) => `<button class="og-btn ${F.mode === v ? 'on' : ''}" data-mode="${v}">${t}</button>`).join('') + '<span style="width:8px"></span>'
        + [['all', 'Alle Fallen'], ['k', 'Klassisch'], ['g', 'Aus deinen Partien: Gegner'], ['m', 'Aus deinen Partien: du']].map(([v, t]) => `<button class="og-btn ${F.src === v ? 'on' : ''}" data-src="${v}">${t}</button>`).join('') + '<span style="width:8px"></span>'
        + [['all', 'Beide Seiten'], ['w', 'Weiß stellt'], ['b', 'Schwarz stellt']].map(([v, t]) => `<button class="og-btn ${F.side === v ? 'on' : ''}" data-side="${v}">${t}</button>`).join('');
      fl.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => { F.mode = b.dataset.mode; drawList(); });
      fl.querySelectorAll('[data-src]').forEach((b) => b.onclick = () => { F.src = b.dataset.src; drawList(); });
      fl.querySelectorAll('[data-side]').forEach((b) => b.onclick = () => { F.side = b.dataset.side; drawList(); });
      const rows = TR.filter((t) => (F.src === 'all' || t.src === F.src) && (F.side === 'all' || t.t === F.side));
      q('[data-list]').innerHTML = rows.slice(0, 300).map((t) => { const s = stats[id(t)]; return `<button class="og-btn" style="display:block;width:100%;text-align:left;margin:3px 0" data-i="${TR.indexOf(t)}"><b>${kit.esc(t.n)}</b> <span class="og-note">${SRC[t.src]} · ${COLOR_DE[t.t]} stellt die Falle${t.eco ? ' · ' + t.eco : ''}${s ? ` · geschafft ${s.s}/${s.t}` : ''}</span></button>`; }).join('') || '<div class="og-note">Keine Fallen für diese Auswahl.</div>';
      q('[data-list]').querySelectorAll('[data-i]').forEach((b) => b.onclick = () => start(TR[+b.dataset.i]));
    }
    const T = { t: null, pre: [], l: [], i: 0, j: 0, phase: 'prefix', fails: 0, scored: false, gen: 0 };
    function showPlay(on) { q('[data-listview]').style.display = on ? 'none' : ''; q('[data-playview]').style.display = on ? '' : 'none'; }
    function bump(ok) { if (T.scored) return; T.scored = true; const k = id(T.t); const s = stats[k] || { s: 0, t: 0 }; s.t++; if (ok) s.s++; stats[k] = s; kit.lsSet(TRAP_KEY, stats); }
    function idea(t) { return t.x || (t.src === 'g' ? 'Dein Gegner hat hier ' + t.b + ' gespielt und damit etwa ' + (Math.min(Math.abs(t.cp), 900) / 100).toFixed(1).replace('.', ',') + ' Bauern abgegeben. Besser war ' + t.s + '.' : 'Hier hast du ' + t.b + ' gespielt. Das hat dich etwa ' + (Math.min(Math.abs(t.cp), 900) / 100).toFixed(1).replace('.', ',') + ' Bauern gekostet. Besser war ' + t.s + '.'); }
    function refresh(last) { board.set({ fen: st.chess.fen(), flip: st.user === 'b', last: last || null, check: null, marks: {} }); }
    function start(t) {
      T.gen++; T.t = t; T.pre = t.p.split(' ').filter(Boolean); T.l = t.l.split(' ').filter(Boolean); T.i = 0; T.j = 0; T.phase = 'prefix'; T.fails = 0; T.scored = false;
      st.user = F.mode === 'stellen' ? t.t : (t.t === 'w' ? 'b' : 'w'); st.chess = new C(); st.done = false; st.busy = false; showPlay(true);
      q('[data-status]').textContent = `${t.n} · du spielst ${COLOR_DE[st.user]} (${F.mode === 'stellen' ? 'du stellst die Falle' : 'du sollst nicht hineinfallen'})`;
      sayT(F.mode === 'stellen' ? 'Spiele die Eröffnung' : 'Spiele die Eröffnung mit', F.mode === 'stellen' ? 'Spiele die Züge, die zur Falle führen. Mit „Hinweis“ siehst du die Figur.' : 'Die Züge bis zum entscheidenden Moment laufen automatisch.');
      q('[data-info]').textContent = (SRC[t.src]) + (t.eco ? ' · ECO ' + t.eco : '');
      refresh(); drive();
    }
    async function playSan(san) { const m = st.chess.move(san, { sloppy: true }); if (!m) { st.done = true; sayT('Fehler in den Daten', 'Dieser Zug ist nicht spielbar: ' + san); return null; } refresh([m.from, m.to]); return m; }
    // Automatik: spielt alle Zuege, die nicht der Spieler macht
    async function drive() {
      const gen = T.gen;
      while (!st.done && gen === T.gen) {
        if (T.phase === 'prefix') {
          if (T.i >= T.pre.length) { T.phase = 'bait'; continue; }
          const mover = st.chess.turn();
          if (F.mode === 'stellen' && mover === st.user) { st.busy = false; return; } // Spieler ist dran
          st.busy = true; await sleep(F.mode === 'erkennen' ? 260 : 420); if (!card.isConnected || gen !== T.gen) return; if (!(await playSan(T.pre[T.i]))) return; T.i++; continue;
        }
        if (T.phase === 'bait') {
          if (F.mode === 'erkennen') { st.busy = false; sayT('Dein Zug', 'Jetzt bist du dran. Spiele einen guten Zug und vermeide den Köder.'); return; }
          st.busy = true; await sleep(600); if (!card.isConnected || gen !== T.gen) return; if (!(await playSan(T.t.b))) return; T.phase = 'punish'; T.j = 0; sayT('Der Gegner tappt in die Falle!', 'Finde jetzt den Gewinnzug.'); continue;
        }
        if (T.phase === 'punish') {
          if (T.j >= T.l.length) { finishOk(); return; }
          const mover = st.chess.turn();
          if (F.mode === 'stellen' && mover === st.user) { st.busy = false; return; }
          st.busy = true; await sleep(520); if (!card.isConnected || gen !== T.gen) return; if (!(await playSan(T.l[T.j]))) return; T.j++; continue;
        }
        if (T.phase === 'reveal') { // Erkennen: Koeder wurde gespielt, Strafe laeuft ab
          if (T.j >= T.l.length) { st.done = true; return; }
          st.busy = true; await sleep(600); if (!card.isConnected || gen !== T.gen) return; if (!(await playSan(T.l[T.j]))) return; T.j++; continue;
        }
        return;
      }
    }
    function finishOk() { st.done = true; st.busy = false; bump(T.fails === 0); const t = T.t; sayT(F.mode === 'stellen' ? 'Falle zugeschnappt!' : 'Falle erkannt!', idea(t) + ' Die Variante: ' + t.b + ' ' + t.l + '.' + (T.fails ? ' (Fehlversuche: ' + T.fails + ')' : '')); }
    async function evAfter(fen) { const r = await kit.Engine.search(fen, { skill: 20, movetime: 450 }); if (!r) return null; if (r.mate != null) return r.mate > 0 ? -9000 : 9000; return -r.cp; }
    st.onMove = async (from, to) => {
      if (st.busy || st.done || !st.chess || st.chess.turn() !== st.user) return;
      const cands = st.chess.moves({ verbose: true }).filter((m) => m.from === from && m.to === to); if (!cands.length) return;
      let promo; if (cands[0].promotion) promo = await board.promo(st.chess.turn());
      const m = st.chess.move({ from, to, promotion: promo }); const san = norm(m.san); const uci = m.from + m.to + (m.promotion || '');
      const t = T.t; st.busy = true;
      if (F.mode === 'stellen') {
        if (T.phase === 'prefix') {
          if (san === norm(T.pre[T.i])) { refresh([m.from, m.to]); T.i++; sayT('Richtig', ''); st.busy = false; drive(); return; }
          refresh([m.from, m.to]); await sleep(450); st.chess.undo(); refresh(); T.fails++; st.busy = false; sayT('Nicht die Falle', 'Hier führt ' + T.pre[T.i] + ' zur Falle. Probiere es noch einmal oder nimm einen Hinweis.'); return;
        }
        // Gewinnzug (punish)
        let ok = san === norm(T.l[T.j]);
        if (!ok && T.j === 0 && await kit.Engine.available()) { const ev = await evAfter(st.chess.fen()); ok = ev != null && (t.cp >= 9000 ? ev >= 9000 : ev >= Math.min(t.cp - 80, t.cp)); }
        if (ok) { refresh([m.from, m.to]); if (san !== norm(T.l[T.j])) { T.l = []; T.j = 0; finishOk(); return; } T.j++; st.busy = false; drive(); return; }
        refresh([m.from, m.to]); await sleep(450); st.chess.undo(); refresh(); T.fails++; st.busy = false; sayT('Nicht ganz', 'Das ist nicht der stärkste Zug. Suche nach dem Zug, der die Falle ausnutzt.'); return;
      }
      // erkennen: Spieler ist am Zug an der Koeder-Stelle
      refresh([m.from, m.to]);
      if (san === norm(t.b)) { T.fails++; bump(false); T.phase = 'reveal'; T.j = 0; sayT('In die Falle getappt!', idea(t) + ' Der sichere Zug war ' + t.s + '.'); st.busy = false; drive(); return; }
      let good = san === norm(t.s);
      if (!good && await kit.Engine.available()) { const ev = await evAfter(st.chess.fen()); good = ev != null && ev >= t.sc - 100; }
      if (good) { st.done = true; st.busy = false; bump(T.fails === 0); sayT('Falle erkannt!', idea(t) + ' Du hast den Köder ' + t.b + ' vermieden.' + (san !== norm(t.s) ? ' (Der Bestzug wäre ' + t.s + ' gewesen.)' : '')); return; }
      await sleep(450); st.chess.undo(); refresh(); T.fails++; st.busy = false; sayT('Nicht ganz', 'Dieser Zug ist schwächer. Der sichere Zug ist ' + t.s + '. Versuche es noch einmal.');
    };
    q('[data-hint]').onclick = () => { if (st.done || st.busy || !st.chess || st.chess.turn() !== st.user) return; const san = T.phase === 'prefix' ? T.pre[T.i] : T.phase === 'punish' ? T.l[T.j] : T.t.s; const mk = marksFor(st.chess, san); const from = Object.keys(mk)[0]; board.set({ marks: from ? { [from]: 'og-hint' } : {} }); sayT('Hinweis', 'Die markierte Figur macht den gesuchten Zug.'); };
    q('[data-sol]').onclick = () => { if (st.done || st.busy || !st.chess || st.chess.turn() !== st.user) return; T.fails++; const san = T.phase === 'prefix' ? T.pre[T.i] : T.phase === 'punish' ? T.l[T.j] : T.t.s; board.set({ marks: marksFor(st.chess, san) }); sayT('Lösung', san); bump(false); };
    q('[data-restart]').onclick = () => start(T.t);
    q('[data-back]').onclick = () => { st.done = true; showPlay(false); drawList(); };
    card.__open = { start: (i) => start(TR[i]), state: () => ({ T, st }), setMode: (m) => { F.mode = m; }, count: () => TR.length };
    kit.addCard(card); drawList(); return card;
  }

  function match(t) {
    if (!t) return null; const s = t.toLowerCase();
    if (/^[/]fallen?\b|^[/]traps?\b|^er[oö]ffnungs-?fallen\b|^fallen-?trainer\b/.test(s)) return { run: openTraps };
    if (/^[/]repertoire\b|^[/]buch\b|^[/]er[oö]ffnungen\b|^er[oö]ffnungs-?pr[uü]fer\b|^repertoire\b/.test(s)) return { run: openRepertoire };
    return null;
  }
  ready(() => { window.OrbitronOpen = { openRepertoire, openTraps, match, loadEco, version: '1.0' }; });
})();
