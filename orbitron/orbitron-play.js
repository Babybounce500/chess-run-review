/* Orbitron Play: "Stellung ausspielen". Eine Stellung aus einem Trainer (oder aus der Auswahl) wird gegen Stockfish in einstellbarer Stärke zu Ende gespielt.
 * Am Ende gibt es eine Auswertung: Ergebnis, Ziel erreicht?, größter Einbruch in der Bewertung. Alles läuft im Browser.
 * Hinweis: Maia läuft nur lokal mit Lc0; im Browser spielt Stockfish mit abgeschwächter Stufe (wie bei "Partie spielen").
 */
(function () {
  'use strict';
  const K = window.OrbitronGameCore, C = window.Chess; if (!K || !C) return;
  let kit = null;
  function ready(fn) { if (window.OrbitronGame && window.OrbitronGame._kit) { kit = window.OrbitronGame._kit; fn(); } else document.addEventListener('orbitron-game-ready', () => { kit = window.OrbitronGame._kit; fn(); }, { once: true }); }
  const sgn = (x) => (x >= 0 ? '+' : '−') + (Math.abs(x) / 100).toFixed(1).replace('.', ',');
  const fmt = (ev) => Math.abs(ev) >= 9000 ? (ev > 0 ? 'Matt für dich' : 'Matt gegen dich') : sgn(ev);
  const clampEv = (x) => Math.max(-1000, Math.min(1000, x));
  const GOAL = {
    win: { name: 'Gewinnen', sub: 'Du stehst auf Gewinn. Bring ihn nach Hause: Matt setzen oder die Gewinnstellung halten.' },
    draw: { name: 'Remis halten oder besser', sub: 'Die Stellung ist ausgeglichen oder ein Remis. Verliere nicht.' },
    hold: { name: 'Schlimmeres verhindern', sub: 'Du stehst schlechter. Versuche, ein Remis zu retten.' },
    mate: { name: 'Matt setzen', sub: 'Setze den Gegner matt.' }
  };
  const SOURCES = [
    { id: 'basics', name: 'Endspiel-Grundlagen (Lucena, Philidor, Grundmatts)', get: () => window.ORBITRON_BASICS, goal: (a) => a[10] === 2 ? 'mate' : a[10] === 0 ? 'draw' : 'win' },
    { id: 'endgame', name: 'Deine Endspiel-Fehler', get: () => window.ORBITRON_ENDGAME },
    { id: 'zeit', name: 'Zeitnot-Stellungen (Gewinn halten)', get: () => window.ORBITRON_ZEITNOT },
    { id: 'blunder', name: 'Fehler-Trainer-Stellungen', get: () => window.ORBITRON_BLUNDERS },
    { id: 'tactic', name: 'Taktik-Muster-Stellungen', get: () => window.ORBITRON_TACTICS }
  ];
  const goalFromEval = (e) => e >= 150 ? 'win' : e <= -150 ? 'hold' : 'draw';

  function kingSq(chess, color) { const b = chess.board(); for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = b[r][c]; if (p && p.type === 'k' && p.color === color) return 'abcdefgh'[c] + (8 - r); } return null; }

  // o: { fen, goal, e0, title, level }
  function openPlay(o) {
    const chess = new C(o.fen); const goal = GOAL[o.goal] ? o.goal : goalFromEval(o.e0 || 0);
    const S = { human: chess.turn(), level: o.level || 'l3', busy: false, over: false, last: null, evs: [{ ev: goal === 'win' ? 300 : goal === 'hold' ? -300 : goal === 'mate' ? 900 : 0, san: '' }], tips: 0, token: 0, resigned: false };
    const card = kit.newCard();
    function moveText(hist) { let nn = parseInt(o.fen.split(' ')[5], 10) || 1, isW = o.fen.split(' ')[1] === 'w', t = ''; for (let i = 0; i < hist.length; i++) { t += (isW ? nn + '. ' : (i === 0 ? nn + '... ' : '')) + hist[i] + ' '; if (!isW) nn++; isW = !isW; } return t; }
    card.innerHTML = `<div class="og-title"><i class="bi bi-play-circle"></i> Stellung ausspielen <span class="og-badge">${kit.esc(o.title || 'Aufgabe')}</span></div>
      <div class="og-note og-desc"><b>Ziel: ${GOAL[goal].name}.</b> ${GOAL[goal].sub} Du spielst ${K.COLOR[S.human]}. Der Gegner ist Stockfish in der gewählten Stärke (nicht Maia, die läuft nur lokal).</div>
      <div class="og-play"><div class="og-left" data-boardwrap></div><div class="og-right"><div class="og-row"><label class="og-note" for="og-plv">Stärke</label><select class="og-select" id="og-plv" data-level>${K.LEVELS.map((l) => `<option value="${l.id}" ${S.level === l.id ? 'selected' : ''}>${l.label} (ca. ${l.elo})</option>`).join('')}</select></div>
      <div class="og-status" data-status></div><div class="og-say" data-say><b>Los geht's</b><span class="og-sub">Zieh mit Klick oder Ziehen.</span></div>
      <div class="og-row"><button class="og-btn" data-tip>Tipp</button><button class="og-btn" data-back>Zug zurück</button><button class="og-btn primary" data-eval>Auswerten</button><button class="og-btn" data-restart>Neu starten</button><button class="og-btn" data-other>Andere Stellung</button></div>
      <div class="og-moves" data-moves></div><div data-end></div></div></div>`;
    const q = (s) => card.querySelector(s);
    const board = kit.makeBoard({
      getTargets: (sq) => { if (S.busy || S.over || chess.turn() !== S.human) return []; const p = chess.get(sq); if (!p || p.color !== S.human) return []; return chess.moves({ square: sq, verbose: true }).map((m) => m.to); },
      onMove: (f, t) => humanMove(f, t)
    });
    q('[data-boardwrap]').appendChild(board.el);
    function say(a, b) { q('[data-say]').innerHTML = `<b>${kit.esc(a)}</b>${b ? `<span class="og-sub">${kit.esc(b)}</span>` : ''}`; }
    function refresh(anim, marks) {
      board.set({ fen: chess.fen(), flip: S.human === 'b', last: S.last, check: chess.in_check() ? kingSq(chess, chess.turn()) : null, marks: marks || {}, sel: null, targets: [] }, anim);
      q('[data-moves]').textContent = moveText(chess.history()).trim();
      q('[data-status]').textContent = S.over ? (S.resultText || 'Beendet') : S.busy ? 'Der Gegner denkt …' : (chess.in_check() ? 'Schach! ' : '') + `${K.COLOR[chess.turn()]} ist am Zug · du bist ${K.COLOR[S.human]}`;
      ['[data-tip]', '[data-back]', '[data-eval]'].forEach((s) => { const b = q(s); if (b) b.disabled = S.over || S.busy; });
    }
    const humanEv = (r, turn) => { if (!r) return null; if (r.mate != null) { const forTurn = r.mate > 0 ? 9000 : -9000; return turn === S.human ? forTurn : -forTurn; } return turn === S.human ? r.cp : -r.cp; };
    function outcome() { if (!chess.game_over()) return null; if (chess.in_checkmate()) return chess.turn() === S.human ? 'L' : 'W'; return 'D'; }
    async function humanMove(from, to) {
      if (S.busy || S.over || chess.turn() !== S.human) return;
      const cands = chess.moves({ verbose: true }).filter((m) => m.from === from && m.to === to); if (!cands.length) return;
      let promo; if (cands[0].promotion) promo = await board.promo(S.human);
      const m = chess.move({ from, to, promotion: promo }); if (!m) return;
      S.last = [m.from, m.to]; q('[data-end]').innerHTML = ''; refresh({ from: m.from, to: m.to });
      if (chess.game_over()) return finish();
      botTurn(m.san);
    }
    async function botTurn(humanSan) {
      if (S.over || S.busy) return; S.busy = true; const tok = ++S.token; refresh();
      const lv = K.levelById(S.level); let ev = null;
      try {
        // Bewertung der Stellung nach deinem Zug (volle Staerke), damit die Auswertung ehrlich ist
        const r0 = await kit.Engine.search(chess.fen(), { skill: 20, movetime: 160 }); if (tok !== S.token) return; ev = humanEv(r0, chess.turn());
      } catch (e) { ev = null; }
      if (ev != null) S.evs.push({ ev, san: humanSan || '', ply: chess.history().length });
      let res = null; try { res = await kit.Engine.search(chess.fen(), { skill: lv.skill, movetime: lv.movetime }); } catch (e) { res = null; }
      if (tok !== S.token || S.over) return;
      let mv = null; if (res && res.uci) mv = chess.move({ from: res.uci.slice(0, 2), to: res.uci.slice(2, 4), promotion: res.uci[4] });
      if (!mv) { const ms = chess.moves({ verbose: true }); ms.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0)); const f = ms[0]; mv = chess.move({ from: f.from, to: f.to, promotion: f.promotion }); }
      S.busy = false; S.last = [mv.from, mv.to]; refresh({ from: mv.from, to: mv.to });
      say('Gegenzug: ' + K.describeMove(mv) + '.', ev != null ? 'Bewertung nach deinem letzten Zug: ' + fmt(ev) + '.' : '');
      if (chess.game_over()) return finish();
    }
    async function finalEval() {
      if (chess.game_over()) { const o2 = outcome(); return o2 === 'W' ? 9000 : o2 === 'L' ? -9000 : 0; }
      const r = await kit.Engine.search(chess.fen(), { skill: 20, movetime: 700 }); const e = humanEv(r, chess.turn()); return e == null ? null : e;
    }
    async function finish(how) {
      if (S.over) return; S.token++; S.busy = true; refresh(); say('Ich werte aus …', '');
      const out = how === 'resign' ? 'L' : outcome(); let fe = how === 'resign' ? -9000 : await finalEval(); S.busy = false; S.over = true; S.resigned = how === 'resign';
      const hist = chess.history(); const n = Math.ceil(hist.length / 2);
      // groesster Einbruch (Bewertung aus deiner Sicht, nach deinen Zuegen)
      let worst = null; for (let i = 1; i < S.evs.length; i++) { const d = clampEv(S.evs[i - 1].ev) - clampEv(S.evs[i].ev); if (d >= 150 && (!worst || d > worst.d)) worst = { d, from: S.evs[i - 1].ev, to: S.evs[i].ev, san: S.evs[i].san, ply: S.evs[i].ply }; }
      let ok, verdict;
      if (goal === 'mate') { ok = out === 'W'; verdict = ok ? 'Matt gesetzt, Ziel erreicht.' : 'Das Matt ist nicht gelungen.'; }
      else if (goal === 'win') { ok = out === 'W' || (out == null && fe != null && fe >= 200); verdict = out === 'W' ? 'Gewonnen, Ziel erreicht.' : ok ? 'Die Gewinnstellung ist gehalten (' + fmt(fe) + '). Ziel erreicht.' : out === 'D' ? 'Remis: der Gewinn ist verspielt.' : out === 'L' ? 'Verloren: der Gewinn ist verspielt.' : 'Der Vorteil ist weg (' + fmt(fe) + '). Ziel nicht erreicht.'; }
      else if (goal === 'draw') { ok = out === 'W' || out === 'D' || (out == null && fe != null && fe >= -80); verdict = out === 'W' ? 'Sogar gewonnen.' : out === 'D' ? 'Remis gehalten, Ziel erreicht.' : out === 'L' ? 'Verloren: Ziel nicht erreicht.' : ok ? 'Die Stellung steht (' + fmt(fe) + '). Ziel erreicht.' : 'Du stehst jetzt schlechter (' + fmt(fe) + '). Ziel nicht erreicht.'; }
      else { ok = out === 'W' || out === 'D' || (out == null && fe != null && fe >= -150); verdict = out === 'W' ? 'Sogar gewonnen, stark!' : out === 'D' ? 'Remis gerettet, Ziel erreicht.' : out === 'L' ? 'Leider verloren.' : ok ? 'Du hast die Stellung gerettet (' + fmt(fe) + '). Ziel erreicht.' : 'Die Stellung ist weiter schlecht (' + fmt(fe) + ').'; }
      S.resultText = how === 'resign' ? 'Aufgegeben' : out === 'W' ? 'Du hast gewonnen' : out === 'L' ? 'Du hast verloren' : out === 'D' ? 'Remis' : 'Ausgewertet';
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.'); const res = out === 'W' ? (S.human === 'w' ? '1-0' : '0-1') : out === 'L' ? (S.human === 'w' ? '0-1' : '1-0') : out === 'D' ? '1/2-1/2' : '*';
      const pgn = `[Event "Orbitron: ${String(o.title || 'Stellung ausspielen').replace(/["\\]/g, '')}"]\n[Date "${date}"]\n[White "${S.human === 'w' ? 'Du' : 'Stockfish'}"]\n[Black "${S.human === 'b' ? 'Du' : 'Stockfish'}"]\n[Result "${res}"]\n[SetUp "1"]\n[FEN "${o.fen}"]\n\n${moveText(hist)}${res}`;
      const col = ok ? '#2e9d4f' : '#e53935';
      q('[data-say]').innerHTML = `<b style="color:${col}">${kit.esc(verdict)}</b><span class="og-sub">${kit.esc(S.resultText)} nach ${n} Zügen.${fe != null && !chess.game_over() && how !== 'resign' ? ' Bewertung der Endstellung: ' + fmt(fe) + ' aus deiner Sicht.' : ''}${worst ? ` Größter Einbruch: nach ${worst.san || 'deinem Zug'} (Bewertung von ${fmt(worst.from)} auf ${fmt(worst.to)}).` : ' Keinen großen Einbruch gehabt.'}${S.tips ? ' Tipps genutzt: ' + S.tips + '.' : ''}</span>`;
      q('[data-end]').innerHTML = '<div class="og-row"><button class="og-btn primary" data-again>Nochmal</button><button class="og-btn" data-analyse>Partie analysieren</button><button class="og-btn" data-copy>PGN kopieren</button></div>';
      q('[data-end] [data-again]').onclick = restart;
      q('[data-end] [data-analyse]').onclick = () => { const inp = document.getElementById('promptInput'); if (!inp) return; inp.value = pgn; try { inp.dispatchEvent(new Event('input')); } catch (e) { /* egal */ } if (window.sendMessage) window.sendMessage(); };
      q('[data-end] [data-copy]').onclick = () => { try { navigator.clipboard.writeText(pgn); } catch (e) { /* egal */ } };
      card.__play.result = { out, fe, ok, verdict, worst, pgn, goal };
      refresh();
    }
    function restart() { S.token++; chess.load(o.fen); S.over = false; S.busy = false; S.last = null; S.evs.length = 1; S.tips = 0; S.resultText = ''; q('[data-end]').innerHTML = ''; say('Neu gestartet', 'Zieh mit Klick oder Ziehen.'); refresh(); card.__play.result = null; if (chess.turn() !== S.human) botTurn(''); }
    q('[data-level]').onchange = (e) => { S.level = e.target.value; };
    q('[data-restart]').onclick = restart;
    q('[data-other]').onclick = () => openPicker();
    q('[data-eval]').onclick = () => finish();
    q('[data-tip]').onclick = async () => {
      if (S.busy || S.over || chess.turn() !== S.human) return; S.busy = true; refresh(); const r = await kit.Engine.search(chess.fen(), { skill: 20, movetime: 500 }); S.busy = false; refresh();
      if (r && r.uci) { S.tips++; refresh(null, { [r.uci.slice(0, 2)]: 'og-hint', [r.uci.slice(2, 4)]: 'og-hint' }); const m = new C(chess.fen()).move({ from: r.uci.slice(0, 2), to: r.uci.slice(2, 4), promotion: r.uci[4] }); say('Tipp', 'Die Engine empfiehlt: ' + (m ? K.describeMove(m) : r.uci) + '.'); } else say('Kein Tipp möglich', 'Die Engine ist nicht erreichbar.');
    };
    q('[data-back]').onclick = () => {
      if (S.busy || S.over) return; const h = chess.history().length; const need = chess.turn() === S.human ? 2 : 1; if (h < need) { say('Zurücknehmen geht nicht', 'Es gibt keinen eigenen Zug mehr zum Zurücknehmen.'); return; }
      for (let i = 0; i < need; i++) chess.undo(); S.token++; S.evs.length = Math.max(1, S.evs.length - 1); const hh = chess.history({ verbose: true }); S.last = hh.length ? [hh[hh.length - 1].from, hh[hh.length - 1].to] : null; refresh(); say('Zug zurückgenommen', 'Du bist wieder dran.');
    };
    card.__play = { S, chess, humanMove, finish, restart, board, result: null };
    kit.addCard(card); refresh(); say('Los geht\'s', GOAL[goal].sub);
    if (chess.turn() !== S.human) botTurn('');
    return card;
  }

  function openPicker() {
    const card = kit.newCard(); let level = 'l3';
    card.innerHTML = `<div class="og-title"><i class="bi bi-play-circle"></i> Stellung ausspielen <span class="og-badge">gegen Stockfish</span></div>
      <div class="og-note og-desc">Wähle eine Stellung und spiele sie zu Ende, zum Beispiel einen gewonnenen Turmendspiel-Fall oder einen Fehler aus deiner Partie. Am Ende bekommst du eine Auswertung: Ziel erreicht, größter Einbruch.</div>
      <div data-list></div>
      <div class="og-row"><label class="og-note" for="og-plv2">Stärke</label><select class="og-select" id="og-plv2" data-level>${K.LEVELS.map((l) => `<option value="${l.id}" ${level === l.id ? 'selected' : ''}>${l.label} (ca. ${l.elo})</option>`).join('')}</select></div>`;
    card.querySelector('[data-level]').onchange = (e) => { level = e.target.value; };
    card.querySelector('[data-list]').innerHTML = SOURCES.map((s) => { const n = (s.get() || []).length; return `<button class="og-btn" style="display:block;width:100%;text-align:left;margin:4px 0" data-src="${s.id}" ${n ? '' : 'disabled'}><b>${kit.esc(s.name)}</b> <span class="og-note">${n} Stellungen · zufällige Stellung</span></button>`; }).join('');
    card.querySelectorAll('[data-src]').forEach((b) => b.onclick = () => startFrom(b.dataset.src, level));
    kit.addCard(card); card.__pick = { start: (id) => startFrom(id, level) }; return card;
  }
  function startFrom(id, level) {
    const s = SOURCES.find((x) => x.id === id); const arr = (s && s.get()) || []; if (!arr.length) return null;
    const a = arr[Math.floor(Math.random() * arr.length)]; const g = s.goal ? s.goal(a) : goalFromEval(a[6]);
    return openPlay({ fen: a[0], goal: g, e0: a[6], title: s.name.replace(/ \(.*$/, ''), level });
  }
  function match(t) {
    if (!t) return null; const s = t.toLowerCase();
    if (/^[/]ausspielen\b|^stellung ausspielen\b/.test(s)) return { run: openPicker };
    return null;
  }
  ready(() => { window.OrbitronPlay = { openPlay, openPicker, startFrom, match, goalFromEval, version: '1.0' }; });
})();
