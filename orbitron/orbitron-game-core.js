/* Orbitron Game Core: reine Logik ohne DOM (laeuft im Browser und in Node).
 * chess.js (0.10.x) entscheidet immer ueber die Legalitaet. Engine und Gemini liefern nur Vorschlaege.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OrbitronGameCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const NAMES = { p: 'Bauer', n: 'Springer', b: 'Läufer', r: 'Turm', q: 'Dame', k: 'König' };
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  const COLOR = { w: 'Weiß', b: 'Schwarz' };

  // Staerkestufen: Skill Level (0-20) und Bedenkzeit je Stufe. Die Elo-Angabe ist nur ein grober Richtwert.
  const LEVELS = [
    { id: 'l1', label: 'Anfänger', elo: 800, skill: 0, movetime: 60 },
    { id: 'l2', label: 'Einsteiger', elo: 1000, skill: 3, movetime: 100 },
    { id: 'l3', label: 'Dein Niveau', elo: 1300, skill: 7, movetime: 200 },
    { id: 'l4', label: 'Fortgeschritten', elo: 1600, skill: 12, movetime: 300 },
    { id: 'l5', label: 'Stark', elo: 1900, skill: 16, movetime: 500 },
    { id: 'l6', label: 'Meister', elo: 2300, skill: 20, movetime: 800 }
  ];
  function levelById(id) { return LEVELS.find(l => l.id === id) || LEVELS[2]; }

  function sqName(sq) { return sq; }

  // Zug in Alltagssprache ohne Notation, Beispiel: "Springer von g1 nach f3"
  function describeMove(m) {
    const p = NAMES[m.piece] || 'Figur';
    if (m.flags && /k/.test(m.flags)) return 'Kurze Rochade (König und Turm tauschen die Seite)';
    if (m.flags && /q/.test(m.flags)) return 'Lange Rochade (König und Turm tauschen die Seite)';
    let t = `${p} von ${m.from} nach ${m.to}`;
    if (m.captured) t += `, schlägt ${NAMES[m.captured] || 'Figur'}`;
    if (m.flags && /e/.test(m.flags)) t += ' (en passant)';
    if (m.promotion) t += `, wird zur ${NAMES[m.promotion]}`;
    if (/#/.test(m.san || '')) t += ' und setzt Matt';
    else if (/\+/.test(m.san || '')) t += ' und gibt Schach';
    return t;
  }

  function evalWords(cp, mate, forColor) {
    // cp und mate aus Sicht des Bots
    if (mate != null) return mate > 0 ? `Ich sehe ein Matt in ${mate}.` : `Ich sehe, dass du in ${Math.abs(mate)} Zügen Matt setzen kannst.`;
    if (cp == null) return '';
    const a = Math.abs(cp) / 100;
    if (a < 0.3) return 'Die Stellung ist ausgeglichen.';
    const side = cp > 0 ? 'Ich stehe' : 'Du stehst';
    if (a < 1) return `${side} etwas besser.`;
    if (a < 3) return `${side} klar besser.`;
    return `${side} auf Gewinn.`;
  }

  // Satz, der auch ohne Gemini funktioniert (Ansage-Fallback)
  function templateAnnounce(m, ev) {
    const s = `Ich spiele: ${describeMove(m)}.`;
    const w = ev ? evalWords(ev.cp, ev.mate) : '';
    return w ? `${s} ${w}` : s;
  }

  function legalSans(chess) { return chess.moves(); }

  // Antwort des Modells in einen legalen Zug uebersetzen. Gibt null zurueck, wenn nichts Legales gefunden wurde.
  function pickFromReply(C, fen, text) {
    if (!text) return null;
    let say = '', cand = [];
    const j = String(text).match(/\{[\s\S]*\}/);
    if (j) {
      try {
        const o = JSON.parse(j[0]);
        if (o.say) say = String(o.say);
        if (o.move) cand.push(String(o.move));
      } catch (e) { /* Text ohne gueltiges JSON, unten Regex-Suche */ }
    }
    const moveRe = /\b(O-O-O|O-O|0-0-0|0-0|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)\b/g;
    let m;
    while ((m = moveRe.exec(String(text)))) cand.push(m[1]);
    const seen = new Set();
    for (const c of cand) {
      const k = c.replace(/0/g, 'O');
      if (seen.has(k)) continue; seen.add(k);
      const g = new C(fen);
      const r = g.move(k, { sloppy: true });
      if (r) return { san: r.san, from: r.from, to: r.to, promotion: r.promotion, say: say.trim() };
    }
    return null;
  }

  function geminiPrompt(chess, color) {
    const moves = chess.moves();
    return [
      `Du spielst Schach als ${COLOR[color]}. Du bist am Zug.`,
      `Stellung (FEN): ${chess.fen()}`,
      `Bisherige Partie (PGN): ${chess.pgn() || '(Partiebeginn)'}`,
      `Erlaubte Züge (SAN): ${moves.join(', ')}`,
      'Wähle genau EINEN Zug aus der Liste der erlaubten Züge, den du für den besten hältst.',
      'Antworte ausschließlich mit JSON ohne Zusatztext, so: {"move":"<Zug exakt aus der Liste>","say":"<ein Satz auf Deutsch in Alltagssprache ohne Zugnotation, höchstens 25 Wörter, nur über die Stellung, keine Engine-Zahlen>"}'
    ].join('\n');
  }

  function geminiAnnouncePrompt(chess, m, ev) {
    return [
      'Du bist ein Schachtrainer und kommentierst deinen eigenen Zug in einem Satz.',
      `Stellung nach deinem Zug (FEN): ${chess.fen()}`,
      `Dein Zug: ${describeMove(m)}`,
      ev ? `Engine-Einschätzung aus deiner Sicht: ${ev.mate != null ? 'Matt in ' + ev.mate : (ev.cp / 100).toFixed(2) + ' Bauerneinheiten'}.` : '',
      'Schreibe genau einen deutschen Satz (höchstens 22 Wörter) in Alltagssprache, nenne den Zug mit Figur und Feld ohne Zugnotation und sage kurz den Plan dahinter. Nutze nur die genannte Engine-Einschätzung, erfinde keine Zahlen und keine Varianten.'
    ].filter(Boolean).join('\n');
  }

  // ---------- Patzer-Check ----------
  function swapTurn(fen) {
    const p = fen.split(' ');
    p[1] = p[1] === 'w' ? 'b' : 'w';
    p[3] = '-';
    return p.join(' ');
  }

  // Wer greift die Figur auf sq an, und wer deckt sie? (aus Sicht der Farbe der Figur)
  function attackInfo(C, fen, sq) {
    const base = new C(fen);
    const piece = base.get(sq);
    if (!piece) return null;
    const opp = piece.color === 'w' ? 'b' : 'w';
    let attackers = [], defenders = [];
    try {
      const a = new C(piece.color === base.turn() ? swapTurn(fen) : fen);
      attackers = a.moves({ verbose: true }).filter(m => m.to === sq && m.captured).map(m => m.piece);
    } catch (e) { /* ungueltige Zwischenstellung */ }
    try {
      const d = new C(fen);
      // billigster Angreifer schlaegt zuerst: Verteidiger duerfen danach zurueckschlagen
      const first = new C(piece.color === base.turn() ? swapTurn(fen) : fen).moves({ verbose: true }).filter(m => m.to === sq && m.captured).sort((x, y) => VAL[x.piece] - VAL[y.piece])[0];
      if (first) d.remove(first.from);
      d.remove(sq);
      d.put({ type: 'p', color: opp }, sq);
      const f = d.fen().split(' ');
      f[1] = piece.color; f[3] = '-';
      const d2 = new C(f.join(' '));
      defenders = d2.moves({ verbose: true }).filter(m => m.to === sq && m.captured).map(m => m.piece);
    } catch (e) { /* ignorieren */ }
    return { piece, attackers, defenders };
  }

  function hangingFor(C, fen, color) {
    const g = new C(fen);
    const out = [];
    const board = g.board();
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const x = board[r][f];
      if (!x || x.color !== color || x.type === 'k') continue;
      const sq = 'abcdefgh'[f] + (8 - r);
      const info = attackInfo(C, fen, sq);
      if (!info || !info.attackers.length) continue;
      const cheapest = Math.min(...info.attackers.map(t => VAL[t]));
      if (!info.defenders.length) out.push({ sq, type: x.type, why: 'ungedeckt', by: info.attackers });
      else if (cheapest < VAL[x.type]) out.push({ sq, type: x.type, why: 'billiger', by: info.attackers });
    }
    return out;
  }

  function patzerCheck(C, fen) {
    const g = new C(fen);
    const me = g.turn(), opp = me === 'w' ? 'b' : 'w';
    const res = { turn: me, lines: [], mateInOne: [], threatMate: [], hangingMine: [], hangingTheirs: [], inCheck: g.in_check(), over: g.game_over() };
    if (res.over) { res.lines.push(g.in_checkmate() ? 'Die Partie ist beendet: Matt.' : 'Die Partie ist beendet.'); return res; }
    res.mateInOne = g.moves({ verbose: true }).filter(m => /#/.test(m.san)).map(m => m.san);
    if (res.mateInOne.length) res.lines.push(`Du kannst Matt setzen: ${res.mateInOne.join(' oder ')}.`);
    res.hangingMine = hangingFor(C, fen, me);
    res.hangingTheirs = hangingFor(C, fen, opp);
    if (!g.in_check()) {
      try {
        const t = new C(swapTurn(fen));
        res.threatMate = t.moves({ verbose: true }).filter(m => /#/.test(m.san)).map(m => m.san);
      } catch (e) { /* ignorieren */ }
      if (res.threatMate.length) res.lines.push(`Achtung: Der Gegner droht Matt in 1 (${res.threatMate.join(' oder ')}). Prüfe, ob dein König Luft hat.`);
    }
    for (const h of res.hangingMine) res.lines.push(`Deine ${NAMES[h.type]} auf ${h.sq} ist ${h.why === 'ungedeckt' ? 'ungedeckt und angegriffen' : 'angegriffen von einer billigeren Figur'}.`);
    for (const h of res.hangingTheirs) res.lines.push(`Gegnerische ${NAMES[h.type]} auf ${h.sq}: ${h.why === 'ungedeckt' ? 'ungedeckt und angegriffen, du kannst sie nehmen' : 'angegriffen von einer billigeren Figur'}.`);
    if (!res.lines.length) res.lines.push('Keine hängenden Figuren und keine Mattdrohung in einem Zug gefunden.');
    return res;
  }

  function resultText(g, humanColor) {
    if (g.in_checkmate()) {
      const loser = g.turn();
      return loser === humanColor ? 'Matt, du hast verloren.' : 'Matt, du hast gewonnen.';
    }
    if (g.in_stalemate()) return 'Patt, Remis.';
    if (g.insufficient_material()) return 'Zu wenig Material, Remis.';
    if (g.in_threefold_repetition()) return 'Dreifache Stellungswiederholung, Remis.';
    if (g.in_draw()) return 'Remis (50-Züge-Regel).';
    return '';
  }

  function pgnResult(g, humanColor, resigned) {
    if (resigned) return humanColor === 'w' ? '0-1' : '1-0';
    if (g.in_checkmate()) return g.turn() === 'w' ? '0-1' : '1-0';
    if (g.in_draw() || g.in_stalemate() || g.insufficient_material() || g.in_threefold_repetition()) return '1/2-1/2';
    return '*';
  }

  return { NAMES, VAL, COLOR, LEVELS, levelById, describeMove, evalWords, templateAnnounce, legalSans, pickFromReply, geminiPrompt, geminiAnnouncePrompt, patzerCheck, hangingFor, swapTurn, resultText, pgnResult, sqName };
});
