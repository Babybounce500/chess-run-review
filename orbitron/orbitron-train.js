/* Orbitron Train: Fehler-Trainer (eigene Patzer als Aufgaben), "Meine Partien" (Chess.com direkt) und Trainings-Menue.
 * Baut auf orbitron-game.js auf (Brett, Engine, Karten im Chat). chess.js entscheidet immer ueber die Legalitaet.
 */
(function () {
  'use strict';
  const K = window.OrbitronGameCore, C = window.Chess;
  if (!K || !C) return;
  let kit = null;
  const STATS_KEY = 'orbitron_blunder_stats_v1';
  const USER_KEY = 'orbitron_cc_user_v1';
  const PIECE_NAME = { Q: 'Dame', K: 'König', R: 'Turm', N: 'Springer', B: 'Läufer', P: 'Bauer' };
  const PHASE_NAME = { o: 'Eröffnung', m: 'Mittelspiel', e: 'Endspiel' };

  function ready(fn) {
    if (window.OrbitronGame && window.OrbitronGame._kit) { kit = window.OrbitronGame._kit; fn(); } else document.addEventListener('orbitron-game-ready', () => { kit = window.OrbitronGame._kit; fn(); }, { once: true });
  }
  const $ = (id) => document.getElementById(id);
  const bp = (x) => (Math.abs(x) / 100).toFixed(1).replace('.', ',');

  // ---------------- Trainings-Menue ----------------
  function openMenu() {
    const card = kit.newCard();
    card.innerHTML = `<div class="og-title"><i class="bi bi-crosshair"></i> Training <span class="og-badge">aus deinen Partien</span></div>
      <div class="og-note">Alle Aufgaben stammen aus deinen eigenen Partien. Sie sind mit Stockfish geprüft.</div>
      <div class="og-row" style="flex-direction:column;align-items:stretch">
        <button class="og-btn primary" data-t="blunder"><i class="bi bi-lightning-charge"></i> Fehler-Trainer: finde den besseren Zug</button>
        <button class="og-btn" data-t="open"><i class="bi bi-book"></i> Eröffnungs-Trainer: deine Fehler in den ersten Zügen</button>
        <button class="og-btn" data-t="end"><i class="bi bi-flag"></i> Endspiel-Trainer: Gewinn halten, Remis retten</button>
        <button class="og-btn" data-t="bullet"><i class="bi bi-stopwatch"></i> Bullet-Aufgaben: Fehler und verpasste Matts aus deiner Session</button>
        <button class="og-btn" data-t="mate"><i class="bi bi-crosshair"></i> Mattjäger: Matt in 1 bis 3</button>
        <button class="og-btn" data-t="check"><i class="bi bi-shield-check"></i> Patzer-Check: hängende Figuren und Mattdrohungen</button>
      </div>`;
    card.querySelector('[data-t="blunder"]').onclick = () => openBlunderTrainer();
    card.querySelector('[data-t="open"]').onclick = () => openBlunderTrainer({ phase: 'o' });
    card.querySelector('[data-t="end"]').onclick = () => openBlunderTrainer({ phase: 'e' });
    card.querySelector('[data-t="bullet"]').onclick = () => openBlunderTrainer({ set: 'bullet' });
    card.querySelector('[data-t="mate"]').onclick =() => window.OrbitronGame.openMateTrainer();
    card.querySelector('[data-t="check"]').onclick = () => window.OrbitronGame.openPatzerCheck();
    kit.addCard(card);
  }

  // ---------------- Fehler-Trainer ----------------
  function openBlunderTrainer(opts) {
    opts = opts || {};
    const raw = (opts.set === 'bullet' ? window.ORBITRON_BULLET : window.ORBITRON_BLUNDERS) || [];
    const all = raw.map(a => ({ f: a[0], b: a[1], p: a[2], ps: a[3], ph: a[4], l: a[5], e: a[6], n: a[7], tag: a[8] || '', pr: typeof a[9] === 'number' ? a[9] : null }));
    // Maia-Einordnung: wie wahrscheinlich ist der Fehlzug auf deinem Niveau?
    const kindOf = (pr) => pr == null ? '' : pr >= 10 ? 'typ' : pr >= 3 ? 'sel' : 'aus';
    const KIND_NAME = { typ: 'Typischer Fehler', sel: 'Seltener Fehler', aus: 'Ausrutscher' };
    const prTxt = (pr) => pr < 1 ? 'unter 1' : String(Math.round(pr));
    const card = kit.newCard();
    const stats = kit.lsGet(STATS_KEY, {});
    const F = { piece: (opts.phase || opts.set) ? 'all' : 'weak', phase: opts.phase || 'all', tag: 'all', kind: 'all' };
    let cur = null, chess = null, fails = 0, done = false, busy = false, order = [];
    card.innerHTML = `<div class="og-title"><i class="bi bi-lightning-charge"></i> ${opts.set === 'bullet' ? 'Bullet-Aufgaben' : 'Fehler-Trainer'} <span class="og-badge">${all.length} Aufgaben aus deinen ${opts.set === 'bullet' ? 'Bullet-Partien' : 'Partien'}</span></div>
      <div class="og-note og-desc">Du siehst eine Stellung aus einer deiner Partien, in der du einen großen Fehler gemacht hast. Finde den besseren Zug.</div>
      <div class="og-play"><div class="og-left" data-boardwrap></div><div class="og-right"><div class="og-row" data-fp></div><div class="og-status" data-status></div>
      <div class="og-say" data-say><b>Los geht's</b><span class="og-sub">Wähle einen Schwerpunkt.</span></div>
      <div class="og-row"><button class="og-btn" data-hint>Hinweis</button><button class="og-btn" data-sol>Lösung</button><button class="og-btn primary" data-next>Nächste Aufgabe</button></div>
      <div class="og-note" data-stats></div></div></div>`;
    const q = (s) => card.querySelector(s);
    function sayT(a, b) { q('[data-say]').innerHTML = `<b>${kit.esc(a)}</b>${b ? `<span class="og-sub">${kit.esc(b)}</span>` : ''}`; }
    const board = kit.makeBoard({
      getTargets: (sq) => { if (busy || done || !chess) return []; const p = chess.get(sq); if (!p || p.color !== chess.turn()) return []; return chess.moves({ square: sq, verbose: true }).map(m => m.to); },
      onMove: (f, t) => tryMove(f, t)
    });
    q('[data-boardwrap]').appendChild(board.el);
    function tagsFor(ph) { const c = {}; for (const a of all) if (a.ph === ph && a.tag) c[a.tag] = (c[a.tag] || 0) + 1; return Object.entries(c).sort((x, y) => y[1] - x[1]); }
    function drawFilters() {
      const pOpts = [['weak', 'Schwerpunkt: Dame, König, Turm'], ['all', 'Alle Figuren'], ['Q', 'Dame'], ['K', 'König'], ['R', 'Turm'], ['N', 'Springer'], ['B', 'Läufer'], ['P', 'Bauer']];
      const hOpts = [['all', 'Alle Phasen'], ['o', 'Eröffnung'], ['m', 'Mittelspiel'], ['e', 'Endspiel']];
      const tg = (F.phase === 'o' || F.phase === 'e') ? tagsFor(F.phase) : [];
      q('[data-fp]').innerHTML = '<select class="og-select" data-sp aria-label="Figur">' + pOpts.map(([v, t]) => `<option value="${v}" ${F.piece === v ? 'selected' : ''}>${t}</option>`).join('') + '</select><select class="og-select" data-sh aria-label="Phase">' + hOpts.map(([v, t]) => `<option value="${v}" ${F.phase === v ? 'selected' : ''}>${t}</option>`).join('') + '</select><select class="og-select" data-sk aria-label="Fehlerart">' + [['all', 'Alle Fehlerarten'], ['typ', 'Typische Fehler'], ['sel', 'Seltene Fehler'], ['aus', 'Ausrutscher']].map(([v, t]) => `<option value="${v}" ${F.kind === v ? 'selected' : ''}>${t}</option>`).join('') + '</select>' + (tg.length ? '<select class="og-select" data-st aria-label="Thema"><option value="all">' + (F.phase === 'o' ? 'Alle Eröffnungen' : 'Alle Endspielarten') + '</option>' + tg.map(([v, c]) => `<option value="${kit.esc(v)}" ${F.tag === v ? 'selected' : ''}>${kit.esc(v)} (${c})</option>`).join('') + '</select>' : '');
      q('[data-sp]').onchange = (e) => { F.piece = e.target.value; next(); };
      q('[data-sh]').onchange = (e) => { F.phase = e.target.value; F.tag = 'all'; drawFilters(); next(); };
      q('[data-sk]').onchange = (e) => { F.kind = e.target.value; next(); };
      const st = q('[data-st]'); if (st) st.onchange = (e) => { F.tag = e.target.value; next(); };
    }
    function pool() { return all.filter(c => (F.piece === 'all' || (F.piece === 'weak' ? 'QKR'.includes(c.ps) : c.ps === F.piece)) && (F.phase === 'all' || c.ph === F.phase) && (F.tag === 'all' || c.tag === F.tag) && (F.kind === 'all' || kindOf(c.pr) === F.kind)); }
    function showStats() {
      const rows = ['Q', 'K', 'R', 'N', 'B', 'P'].map(k => { const s = stats[k] || { s: 0, t: 0 }; return s.t ? `${PIECE_NAME[k]} ${s.s}/${s.t}` : null; }).filter(Boolean);
      q('[data-stats]').textContent = rows.length ? 'Beim ersten Versuch gelöst: ' + rows.join(' · ') : 'Noch keine Aufgabe gelöst.';
    }
    function bump(k, ok) { stats[k] = stats[k] || { s: 0, t: 0 }; stats[k].t++; if (ok) stats[k].s++; kit.lsSet(STATS_KEY, stats); showStats(); }
    function next() {
      const p = pool();
      if (!p.length) { sayT('Keine Aufgaben', 'Für diese Auswahl gibt es keine Aufgaben.'); return; }
      if (!order.length || order.pool !== p.length + F.piece + F.phase + F.tag + F.kind) { order = p.map((_, i) => i).sort(() => Math.random() - .5); order.pool = p.length + F.piece + F.phase + F.tag + F.kind; }
      const i = order.pop(); cur = p[i]; chess = new C(cur.f); fails = 0; done = false; busy = false;
      const side = chess.turn();
      board.set({ fen: chess.fen(), flip: side === 'b', last: null, check: null, marks: {} });
      q('[data-status]').textContent = `${K.COLOR[side]} ist am Zug · ${PHASE_NAME[cur.ph]}, Zug ${cur.n}${cur.tag ? ' · ' + cur.tag : ''}`;
      sayT('Finde den besseren Zug', `Hier hast du einen Fehler gemacht, der etwa ${bp(cur.l)} Bauern gekostet hat. Welcher Zug ist besser?`); showStats();
    }
    async function evalAfter(fen) {
      const r = await kit.Engine.search(fen, { skill: 20, movetime: 450 });
      if (!r) return null;
      // Sicht des Spielers, der gerade gezogen hat = Gegenteil des Zugrechts
      if (r.mate != null) return r.mate > 0 ? -9000 : 9000;
      return -r.cp;
    }
    async function tryMove(from, to) {
      if (busy || done || !chess) return; busy = true;
      const cands = chess.moves({ verbose: true }).filter(m => m.from === from && m.to === to);
      if (!cands.length) { busy = false; return; }
      let promo; if (cands[0].promotion) promo = await board.promo(chess.turn());
      const m = chess.move({ from, to, promotion: promo }); const uci = m.from + m.to + (m.promotion || '');
      board.set({ fen: chess.fen(), last: [m.from, m.to], marks: {}, check: null }, { from: m.from, to: m.to });
      let ok = uci === cur.b;
      if (!ok && await kit.Engine.available()) { const ev = await evalAfter(chess.fen()); ok = ev != null && ev >= cur.e - 80; }
      if (ok) {
        done = true; busy = false;
        if (fails === 0) bump(cur.ps, true);
        const gm = new C(cur.f); const pm = gm.move({ from: cur.p.slice(0, 2), to: cur.p.slice(2, 4), promotion: cur.p[4] });
        sayT('Richtig!', `${fails === 0 ? 'Beim ersten Versuch. ' : ''}In deiner Partie hast du ${pm ? K.describeMove(pm) : 'einen anderen Zug'} gespielt. Das hat etwa ${bp(cur.l)} Bauern gekostet.${cur.pr != null ? ` ${KIND_NAME[kindOf(cur.pr)]}: Diesen Zug spielen auf deinem Niveau etwa ${prTxt(cur.pr)} % der Spieler.` : ''}`);
        return;
      }
      await kit.sleep(500); chess.undo(); board.set({ fen: chess.fen(), last: null });
      busy = false; fails++;
      if (fails === 1) bump(cur.ps, false);
      sayT('Nicht ganz', 'Dieser Zug ist schlechter als der beste. Versuch es nochmal oder nimm einen Hinweis.');
    }
    q('[data-hint]').onclick = () => { if (!cur || done || busy) return; board.set({ marks: { [cur.b.slice(0, 2)]: 'og-hint' } }); sayT('Hinweis', `Die markierte Figur macht den besten Zug (${PIECE_NAME[new C(cur.f).get(cur.b.slice(0, 2)).type.toUpperCase()] || 'Figur'}).`); };
    q('[data-sol]').onclick = () => {
      if (!cur || done || busy) return; const g2 = new C(cur.f); const m = g2.move({ from: cur.b.slice(0, 2), to: cur.b.slice(2, 4), promotion: cur.b[4] });
      board.set({ marks: { [cur.b.slice(0, 2)]: 'og-hint', [cur.b.slice(2, 4)]: 'og-hint' } });
      if (fails === 0) bump(cur.ps, false); fails = Math.max(fails, 1);
      sayT('Lösung', m ? K.describeMove(m) : cur.b);
    };
    q('[data-next]').onclick = next;
    drawFilters(); showStats(); next();
    kit.addCard(card); card.__og = { next, tryMove, board, getCur: () => cur }; return card;
  }

  // ---------------- Meine Partien (Chess.com) ----------------
  const END_DE = { checkmated: 'Matt', timeout: 'Zeit', resigned: 'Aufgabe', abandoned: 'Verlassen', repetition: 'Wiederholung', stalemate: 'Patt', agreed: 'Einigung', insufficient: 'zu wenig Material', timevsinsufficient: 'Zeit gegen zu wenig Material', '50move': '50 Züge', win: 'Sieg' };
  const DRAWS = ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'];
  function openChessCom(prefUser) {
    const card = kit.newCard();
    let user = prefUser || kit.lsGet(USER_KEY, '') || '';
    let games = [], months = [], shown = 40;
    const F = { tc: 'all', res: 'all' };
    card.innerHTML = `<div class="og-title"><i class="bi bi-cloud-download"></i> Meine Partien <span class="og-badge">direkt von Chess.com</span></div>
      <div class="og-note">Gib deinen Chess.com-Namen ein. Die Partien werden direkt von der öffentlichen Schnittstelle geladen, nichts wird gespeichert außer dem Namen in deinem Browser.</div>
      <div class="og-row"><input class="og-input" data-user placeholder="Chess.com-Benutzername" style="max-width:240px" value="${kit.esc(user)}"><button class="og-btn primary" data-load>Laden</button><select class="og-select" data-month style="display:none"></select></div>
      <div class="og-row" data-filters style="display:none"></div>
      <div data-list></div>`;
    const q = (s) => card.querySelector(s);
    const status = (t) => { q('[data-list]').innerHTML = `<div class="og-note">${kit.esc(t)}</div>`; };
    async function getJSON(url) { const r = await fetch(url); if (r.status === 404) throw new Error('Benutzer oder Monat nicht gefunden.'); if (!r.ok) throw new Error('Chess.com antwortet mit Fehler ' + r.status); return r.json(); }
    async function load() {
      user = q('[data-user]').value.trim().toLowerCase(); if (!user) { status('Bitte einen Benutzernamen eingeben.'); return; }
      kit.lsSet(USER_KEY, user); status('Lade Monatsliste …');
      try {
        const a = await getJSON(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/archives`);
        months = (a.archives || []).slice().reverse();
        if (!months.length) { status('Für diesen Namen gibt es keine Partien.'); return; }
        const sel = q('[data-month]'); sel.style.display = '';
        sel.innerHTML = months.map(u => { const p = u.split('/'); return `<option value="${u}">${p[p.length - 2]}-${p[p.length - 1]}</option>`; }).join('');
        sel.onchange = () => loadMonth(sel.value); await loadMonth(months[0]);
      } catch (e) { status(e.message || 'Laden fehlgeschlagen. Prüfe deine Verbindung.'); }
    }
    async function loadMonth(url) {
      status('Lade Partien …'); shown = 40;
      try { const j = await getJSON(url); games = (j.games || []).filter(g => g.rules === 'chess' && g.pgn).sort((a, b) => b.end_time - a.end_time); drawFilters(); render(); }
      catch (e) { status(e.message || 'Laden fehlgeschlagen.'); }
    }
    function mine(g) { return g.white.username.toLowerCase() === user ? 'white' : 'black'; }
    function outcome(g) { const r = g[mine(g)].result; return r === 'win' ? 'W' : DRAWS.includes(r) ? 'D' : 'L'; }
    function drawFilters() {
      const f = q('[data-filters]'); f.style.display = '';
      f.innerHTML = [['all', 'Alle'], ['bullet', 'Bullet'], ['blitz', 'Blitz'], ['rapid', 'Rapid']].map(([v, t]) => `<button class="og-btn ${F.tc === v ? 'on' : ''}" data-tc="${v}">${t}</button>`).join('') + '<span style="width:8px"></span>' + [['all', 'Alle Ergebnisse'], ['W', 'Siege'], ['L', 'Niederlagen'], ['D', 'Remis']].map(([v, t]) => `<button class="og-btn ${F.res === v ? 'on' : ''}" data-rs="${v}">${t}</button>`).join('');
      f.querySelectorAll('[data-tc]').forEach(b => b.onclick = () => { F.tc = b.dataset.tc; shown = 40; drawFilters(); render(); });
      f.querySelectorAll('[data-rs]').forEach(b => b.onclick = () => { F.res = b.dataset.rs; shown = 40; drawFilters(); render(); });
    }
    function opening(g) { const m = (g.pgn || '').match(/\[ECOUrl "[^"]*openings\/([^"]*)"/); return m ? m[1].replace(/-/g, ' ').split(/ \d/)[0].split(' ').slice(0, 4).join(' ') : ''; }
    function render() {
      const list = games.filter(g => (F.tc === 'all' || g.time_class === F.tc) && (F.res === 'all' || outcome(g) === F.res));
      if (!list.length) { status('Keine Partien für diese Auswahl.'); return; }
      const rows = list.slice(0, shown).map((g, i) => {
        const side = mine(g), opp = g[side === 'white' ? 'black' : 'white'], me = g[side]; const o = outcome(g);
        const d = new Date(g.end_time * 1000); const ds = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        const why = o === 'W' ? (END_DE[opp.result] || opp.result) : (END_DE[me.result] || me.result);
        const col = o === 'W' ? '#2e9d4f' : o === 'L' ? '#e53935' : '#888';
        return `<div class="og-row" style="border-bottom:1px solid var(--border,#e0e4e8);padding:5px 0;margin:0;flex-wrap:nowrap;justify-content:space-between"><div style="min-width:0"><b style="color:${col}">${o === 'W' ? 'Sieg' : o === 'L' ? 'Niederlage' : 'Remis'}</b> <span class="og-note">${kit.esc(why)} · ${kit.esc(g.time_class)} · ${side === 'white' ? 'Weiß' : 'Schwarz'} gegen ${kit.esc(opp.username)} (${opp.rating}) · ${ds}</span><div class="og-note">${kit.esc(opening(g))}</div></div><button class="og-btn" data-an="${i}">Analysieren</button></div>`;
      }).join('');
      const more = list.length > shown ? `<div class="og-row"><button class="og-btn" data-more>Mehr anzeigen (${list.length - shown} weitere)</button></div>` : '';
      q('[data-list]').innerHTML = `<div class="og-note">${list.length} Partien</div>${rows}${more}`;
      q('[data-list]').querySelectorAll('[data-an]').forEach(b => b.onclick = () => analyse(list[+b.dataset.an]));
      const mb = q('[data-more]'); if (mb) mb.onclick = () => { shown += 40; render(); };
    }
    function analyse(g) {
      const inp = $('promptInput'); if (!inp) return;
      inp.value = g.pgn; try { inp.dispatchEvent(new Event('input')); } catch (e) { /* ignorieren */ }
      window.sendMessage();
    }
    q('[data-load]').onclick = load;
    q('[data-user]').addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
    kit.addCard(card);
    if (user) load();
    card.__og = { load, analyse, getGames: () => games }; return card;
  }

  function match(t) {
    if (!t) return null; const s = t.toLowerCase();
    if (/^\/bullet\b|^bullet-?aufgaben\b/.test(s)) return { run: () => openBlunderTrainer({ set: 'bullet' }) };
    if (/^\/fehler\b|^fehler-?trainer\b/.test(s)) return { run: openBlunderTrainer };
    if (/^\/partien\b|^meine partien\b|^\/chesscom\b/.test(s)) return { run: () => openChessCom() };
    if (/^\/er[oö]+ffnung\b|^\/eroeffnung\b|^er[oö]ffnungs-?trainer\b/.test(s)) return { run: () => openBlunderTrainer({ phase: 'o' }) };
    if (/^\/endspiel\b|^endspiel-?trainer\b/.test(s)) return { run: () => openBlunderTrainer({ phase: 'e' }) };
    if (/^\/training\b|^training\b$/.test(s)) return { run: openMenu };
    return null;
  }

  ready(() => { window.OrbitronTrain = { openBlunderTrainer, openChessCom, openMenu, match, version: '1.0' }; });
})();
