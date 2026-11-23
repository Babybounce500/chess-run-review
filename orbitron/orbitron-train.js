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
        <button class="og-btn" data-t="today"><i class="bi bi-calendar-check"></i> Training heute: Tagesplan, Wiederholung und Serie</button>
        <button class="og-btn primary" data-t="blunder"><i class="bi bi-lightning-charge"></i> Fehler-Trainer: finde den besseren Zug</button>
        <button class="og-btn" data-t="open"><i class="bi bi-book"></i> Eröffnungs-Trainer: deine Fehler in den ersten Zügen</button>
        <button class="og-btn" data-t="end"><i class="bi bi-flag"></i> Endspiel-Fehler: nur deine Fehler aus Endspielen (Turm, Bauern, Dame ...)</button>
        <button class="og-btn" data-t="bullet"><i class="bi bi-stopwatch"></i> Bullet-Aufgaben: Fehler und verpasste Matts aus deiner Session</button>
        <button class="og-btn" data-t="sac"><i class="bi bi-gem"></i> Opfer-Trainer: finde das Opfer, das die Stellung verbessert</button>
        <button class="og-btn" data-t="tactic"><i class="bi bi-bullseye"></i> Taktik-Muster: Gabel, Spieß, Abzug und Co. aus deinen Patzern</button>
        <button class="og-btn" data-t="tempo"><i class="bi bi-lightning-charge"></i> Matt-Tempo: deine verpassten Matts in 1 bis 4, mit knapper Uhr</button>
        <button class="og-btn" data-t="labor"><i class="bi bi-eyedropper"></i> Eröffnungs-Labor: Ampel je Eröffnung, Fehlerstellungen üben</button>
        <button class="og-btn" data-t="backup"><i class="bi bi-archive"></i> Sichern und Wiederherstellen: Fortschritt als Datei</button>
        <button class="og-btn" data-t="coach"><i class="bi bi-arrow-repeat"></i> Auto-Coach: neue Partien holen, analysieren und neue Aufgaben bekommen</button>
        <button class="og-btn" data-t="scan"><i class="bi bi-binoculars"></i> Drohungs-Scanner: in wenigen Sekunden sehen, was hängt oder droht</button>
        <button class="og-btn" data-t="hebel"><i class="bi bi-graph-up-arrow"></i> Rating-Hebel: was dich am meisten Rating kostet, mit Wochenfokus</button>
        <button class="og-btn" data-t="mattbild"><i class="bi bi-grid-3x3"></i> Mattbild-Atlas: welche Mattfiguren du setzt und erleidest</button>
        <button class="og-btn" data-t="mfig"><i class="bi bi-grid-3x3-gap"></i> Matt-Figuren: Grundreihe, Turm, Abzug, Springer und Matt verhindern</button>
        <button class="og-btn" data-t="dmatt"><i class="bi bi-bounding-box"></i> Damenmatt-Muster: deine Matts mit Dame und Läufer-Diagonale</button>
        <button class="og-btn" data-t="basics"><i class="bi bi-mortarboard"></i> Endspiel-Grundlagen: Lucena, Philidor, Schlüsselfeld, Grundmatts</button>
        <button class="og-btn" data-t="play"><i class="bi bi-play-circle"></i> Stellung ausspielen: gegen Stockfish zu Ende spielen, mit Auswertung</button>
        <button class="og-btn" data-t="zeit"><i class="bi bi-hourglass-split"></i> Zeitnot-Trainer: Gewinn nach Hause bringen (mit Uhr)</button>
        <button class="og-btn" data-t="ownmate"><i class="bi bi-stopwatch"></i> Mattjäger: deine verpassten Matts (mit Uhr)</button>
        <button class="og-btn" data-t="rep"><i class="bi bi-diagram-3"></i> Eröffnungs-Prüfer: Varianten nachspielen, Buchzüge sehen</button>
        <button class="og-btn" data-t="traps"><i class="bi bi-bug"></i> Eröffnungs-Fallen: stellen und erkennen</button>
        <button class="og-btn" data-t="time"><i class="bi bi-clock-history"></i> Zeit-Heatmap: wo du die Uhr verbrennst (Bullet und Blitz)</button>
        <button class="og-btn" data-t="mate"><i class="bi bi-crosshair"></i> Mattjäger: Matt in 1 bis 3</button>
        <button class="og-btn" data-t="check"><i class="bi bi-shield-check"></i> Patzer-Check: hängende Figuren und Mattdrohungen</button>
      </div>`;
    card.querySelector('[data-t="today"]').onclick = () => window.OrbitronDaily && window.OrbitronDaily.openToday();
    card.querySelector('[data-t="blunder"]').onclick = () => openBlunderTrainer();
    card.querySelector('[data-t="open"]').onclick = () => openBlunderTrainer({ phase: 'o' });
    card.querySelector('[data-t="end"]').onclick = () => openBlunderTrainer({ set: 'endgame' });
    card.querySelector('[data-t="bullet"]').onclick = () => openBlunderTrainer({ set: 'bullet' });
    card.querySelector('[data-t="sac"]').onclick = () => openBlunderTrainer({ set: 'sac' });
    card.querySelector('[data-t="tactic"]').onclick = () => openBlunderTrainer({ set: 'tactic' });
    card.querySelector('[data-t="tempo"]').onclick = () => openBlunderTrainer({ set: 'tempo' });
    card.querySelector('[data-t="labor"]').onclick = () => window.OrbitronLabor && window.OrbitronLabor.openLabor();
    card.querySelector('[data-t="backup"]').onclick = () => window.OrbitronBackup && window.OrbitronBackup.openBackup();
    card.querySelector('[data-t="coach"]').onclick = () => window.OrbitronLive && window.OrbitronLive.openCoach();
    card.querySelector('[data-t="scan"]').onclick = () => window.OrbitronScan && window.OrbitronScan.openScan();
    card.querySelector('[data-t="hebel"]').onclick = () => window.OrbitronProfile && window.OrbitronProfile.openProfile('lever');
    card.querySelector('[data-t="mattbild"]').onclick = () => window.OrbitronProfile && window.OrbitronProfile.openProfile('atlas');
    card.querySelector('[data-t="mfig"]').onclick = () => openBlunderTrainer({ set: 'mfig' });
    card.querySelector('[data-t="dmatt"]').onclick = () => openBlunderTrainer({ set: 'dmatt' });
    card.querySelector('[data-t="basics"]').onclick = () => openBlunderTrainer({ set: 'basics' });
    card.querySelector('[data-t="play"]').onclick = () => window.OrbitronPlay && window.OrbitronPlay.openPicker();
    card.querySelector('[data-t="zeit"]').onclick = () => openBlunderTrainer({ set: 'zeit' });
    card.querySelector('[data-t="ownmate"]').onclick = () => openBlunderTrainer({ set: 'ownmate' });
    card.querySelector('[data-t="rep"]').onclick = () => window.OrbitronOpen && window.OrbitronOpen.openRepertoire();
    card.querySelector('[data-t="traps"]').onclick = () => window.OrbitronOpen && window.OrbitronOpen.openTraps();
    card.querySelector('[data-t="time"]').onclick = () => window.OrbitronTime && window.OrbitronTime.openHeat();
    card.querySelector('[data-t="mate"]').onclick =() => window.OrbitronGame.openMateTrainer();
    card.querySelector('[data-t="check"]').onclick = () => window.OrbitronGame.openPatzerCheck();
    kit.addCard(card);
  }

  // ---------------- PGN-Export (Lichess-Studie, Chessbase, andere Programme) ----------------
  function toPgn(tasks, title, withLoss, own) {
    const d = new Date(); const date = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0'); const out = [];
    for (const c of tasks) {
      try {
        const g = new C(c.f); const m = g.move({ from: c.b.slice(0, 2), to: c.b.slice(2, 4), promotion: c.b[4] }); if (!m) continue;
        const pg = new C(c.f); const pm = pg.move({ from: c.p.slice(0, 2), to: c.p.slice(2, 4), promotion: c.p[4] });
        const num = parseInt(c.f.split(' ')[5], 10) || 1; const clean = (x) => String(x).replace(/[{}\[\]]/g, '');
        const note = ['Bester Zug.', own === false ? '' : pm ? (c.p === c.b ? 'Das hast du in deiner Partie gespielt.' : 'In deiner Partie: ' + pm.san + (withLoss && c.l ? ' (Verlust etwa ' + bp(c.l) + ' Bauern)' : '') + '.') : '', c.tag ? 'Thema: ' + c.tag + '.' : '', c.line ? 'Mögliche Folge: ' + c.line + '.' : ''].filter(Boolean).join(' ');
        out.push('[Event "' + clean('Orbitron: ' + title) + '"]\n[Site "Orbitron Chess"]\n[Date "' + date + '"]\n[Round "-"]\n[White "?"]\n[Black "?"]\n[Result "*"]\n[SetUp "1"]\n[FEN "' + c.f + '"]\n\n' + (g.turn() === 'b' ? num + '... ' : num + '. ') + m.san + ' {' + clean(note) + '} *\n');
      } catch (e) { /* defekte Aufgabe ueberspringen */ }
    }
    return out.join('\n');
  }
  function downloadText(name, text) {
    try { const blob = new Blob([text], { type: 'application/x-chess-pgn' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); return true; } catch (e) { return false; }
  }

  // ---------------- Fehler-Trainer ----------------
  function openBlunderTrainer(opts) {
    opts = opts || {};
    const SAC = opts.set === 'sac', ZEIT = opts.set === 'zeit', TEMPO = opts.set === 'tempo', OWNM = opts.set === 'ownmate' || TEMPO, ENDG = opts.set === 'endgame', DMAT = opts.set === 'dmatt', MFIG = opts.set === 'mfig', LAB = opts.set === 'labor', TACT = opts.set === 'tactic' || DMAT || MFIG || LAB, BASC = opts.set === 'basics', TIMED = ZEIT || OWNM;
    const SETNAME = opts.set || (opts.phase ? 'phase-' + opts.phase : 'blunder');
    const TITLE = SAC ? 'Opfer-Trainer' : ENDG ? 'Endspiel-Fehler' : LAB ? 'Eröffnungs-Labor' : MFIG ? 'Matt-Figuren' : DMAT ? 'Damenmatt-Muster' : TACT ? 'Taktik-Muster' : BASC ? 'Endspiel-Grundlagen' : ZEIT ? 'Zeitnot-Trainer' : TEMPO ? 'Matt-Tempo' : OWNM ? 'Mattjäger' : opts.set === 'bullet' ? 'Bullet-Aufgaben' : 'Fehler-Trainer';
    const raw = (SAC ? window.ORBITRON_SACS : LAB ? window.ORBITRON_LABOR_TASKS : MFIG ? window.ORBITRON_MFIG : DMAT ? window.ORBITRON_DMATT : TACT ? window.ORBITRON_TACTICS : BASC ? window.ORBITRON_BASICS : ZEIT ? window.ORBITRON_ZEITNOT : TEMPO ? window.ORBITRON_TEMPO : OWNM ? window.ORBITRON_OWNMATES : ENDG ? window.ORBITRON_ENDGAME : opts.set === 'bullet' ? window.ORBITRON_BULLET : window.ORBITRON_BLUNDERS) || [];
    const all = raw.map(a => ({ f: a[0], b: a[1], p: a[2], ps: a[3], ph: a[4], l: a[5], e: a[6], n: a[7], tag: a[8] || '', pr: typeof a[9] === 'number' ? a[9] : null, mine: SAC ? a[10] !== 0 : true, secs: ZEIT && typeof a[10] === 'number' ? a[10] : null, goal: BASC ? a[10] : null, line: a[11] || '' }));
    const EXPL = TACT || BASC; // Aufgaben mit Erklaerung statt Partie-Vergleich
    // Uhr (Zeitnot-Trainer und Mattjaeger): Zeitlimit je Aufgabe, tickt herunter
    const limitOf = (c) => TEMPO ? [5, 8, 12, 15][Math.max(0, Math.min(3, c.l - 1))] : ZEIT ? Math.min(15, Math.max(8, c.secs == null ? 15 : c.secs)) : (c.l <= 2 ? 10 : c.l <= 4 ? 15 : 20);
    let clockT = null, clockEnd = 0, clockLim = 0;
    function stopClock() { if (clockT) { clearInterval(clockT); clockT = null; } }
    function drawClock(left) { const c = card.querySelector('[data-clock]'); if (!c) return; c.textContent = '⏱ ' + Math.max(0, left).toFixed(1).replace('.', ',') + ' s'; c.classList.toggle('og-clock-low', left < 4); }
    function startClock() {
      stopClock(); if (!TIMED || !cur) return; clockLim = limitOf(cur); clockEnd = Date.now() + clockLim * 1000; drawClock(clockLim);
      clockT = setInterval(() => {
        if (!card.isConnected) { stopClock(); return; }
        const left = (clockEnd - Date.now()) / 1000; drawClock(left);
        if (left <= 0) { stopClock(); timeUp(); }
      }, 100);
    }
    // Maia-Einordnung: wie wahrscheinlich ist der Fehlzug auf deinem Niveau?
    const kindOf = (pr) => pr == null ? '' : pr >= 10 ? 'typ' : pr >= 3 ? 'sel' : 'aus'; // bei Opfern: leicht / mittel / schwer (so oft findet Maia den Zug)
    const KIND_NAME = { typ: 'Typischer Fehler', sel: 'Seltener Fehler', aus: 'Ausrutscher' };
    const KIND_NAME2 = { typ: 'Leicht zu finden', sel: 'Mittelschwer', aus: 'Schwer zu finden' };
    const prTxt = (pr) => pr < 1 ? 'unter 1' : String(Math.round(pr));
    const card = kit.newCard();
    const stats = kit.lsGet(STATS_KEY, {});
    const F = { piece: (opts.phase || opts.set) ? 'all' : 'weak', phase: opts.phase || 'all', tag: opts.tag || 'all', kind: 'all' };
    let cur = null, chess = null, fails = 0, done = false, busy = false, order = [];
    card.innerHTML = `<div class="og-title"><i class="bi bi-lightning-charge"></i> ${SAC ? 'Opfer-Trainer' : ENDG ? 'Endspiel-Fehler' : LAB ? 'Eröffnungs-Labor' : MFIG ? 'Matt-Figuren' : DMAT ? 'Damenmatt-Muster' : TACT ? 'Taktik-Muster' : BASC ? 'Endspiel-Grundlagen' : ZEIT ? 'Zeitnot-Trainer' : TEMPO ? 'Matt-Tempo' : OWNM ? 'Mattjäger: deine verpassten Matts' : opts.set === 'bullet' ? 'Bullet-Aufgaben' : 'Fehler-Trainer'} <span class="og-badge">${all.length} Aufgaben ${BASC ? 'mit Stockfish geprüft' : 'aus deinen ' + (opts.set === 'bullet' || TIMED ? 'Bullet- und Blitz-Partien' : 'Partien')}</span></div>
      <div class="og-note og-desc">${TEMPO ? 'Stellungen aus deinen letzten Partien, in denen du ein erzwungenes Matt (in 1 bis 4) hattest und es nicht gespielt hast. Du hast wenig Zeit: Matt in 1 fünf Sekunden, in 2 acht, in 3 zwölf, in 4 fünfzehn. Übe dabei die feste Reihenfolge: erst alle Schachs, dann alle Schlagzüge, dann Drohungen. Stand 23.11.: Du siehst Matt in 1 zu 76 %, Matt in 2 nur zu 45 %.' : LAB ? 'Fehlerstellungen aus deinen Eröffnungen: Fehler, die du in deinen Partien mehrfach gemacht hast oder die sehr groß waren, jeweils in der Stellung vor deinem Zug. Wähle oben die Eröffnung und finde den besseren Zug. Danach steht, wie oft und wie teuer der Fehler war.' : MFIG ? 'Mattfiguren aus deinen Partien: Bei „Setzen“ findest du das Matt (Grundreihe, Turm, Abzug, Doppelschach, Springer, Läufer, Bauer, erstickt). Bei „Verhindern“ droht dir Matt, und du findest die Verteidigung (Luft schaffen, Mattfeld besetzen, Figur decken), die in deiner Partie gefehlt hat. Wähle oben die Figur und Setzen oder Verhindern.' : DMAT ? 'Alle Stellungen stammen aus deinen Partien, die du mit einem Damenmatt gewonnen hast. Finde das erzwungene Matt (meist in 2 Zügen). Wähle ein Muster, zum Beispiel Dame und Läufer auf der Diagonale oder Matt auf dem Fianchetto-Feld. Nach der Lösung steht, warum das Matt klappte und wie es in deiner Partie lief.' : TACT ? 'Hier hast du in deiner Partie ein Muster übersehen: Gabel, Spieß, Fesselung, Abzug oder eine hängende Figur. Wähle ein Muster und finde den besten Zug. Nach der Lösung steht dabei, worin das Muster bestand. Das Muster wird automatisch erkannt und mit einer Materialprobe bestätigt.' : BASC ? 'Lehrbuchstellungen, die jeder kennen sollte: Lucena, Philidor, Schlüsselfeld, Turm gegen Bauer und Grundmatts. Finde den richtigen Zug; danach erklärt die Karte die Idee. Mit „Ausspielen“ kannst du die Stellung gegen Stockfish zu Ende spielen.' : ''}${TACT || BASC ? '' : ENDG ? 'Nur Fehler aus deinen Endspielen (wenig Material: höchstens 12 Figuren inklusive Bauern oder insgesamt höchstens 20 Punkte Figurenwert, also auch lange Turmendspiele mit vielen Bauern): verspielter Gewinn, verpasste Rettung oder verschenktes Remis. Wähle die Endspielart und finde den besseren Zug. Alle Stellungen stammen aus deinen eigenen Partien und sind mit Stockfish geprüft.' : SAC ? 'In jeder Stellung ist ein Opfer der beste Zug: Du gibst Material her und bekommst dafür eine bessere Stellung, einen Angriff oder Matt. Alle Stellungen stammen aus deinen Partien.' : ZEIT ? 'Du stehst klar auf Gewinn, aber deine Uhr läuft. Finde in wenigen Sekunden einen Zug, der den Vorsprung sichert (Tausch, Vereinfachen) oder Matt setzt. Die Uhr tickt ab Aufgabenstart; läuft sie ab, wird die Lösung gezeigt.' : OWNM ? 'Das sind Stellungen, in denen du in deiner Partie ein Matt verpasst hast. Setze es, bevor die Uhr abläuft (Matt in 1 bis 2: 10 Sekunden, in 3 bis 4: 15, länger: 20).' : 'Du siehst eine Stellung aus einer deiner Partien, in der du einen großen Fehler gemacht hast. Finde den besseren Zug.'}</div>
      <div class="og-play"><div class="og-left" data-boardwrap></div><div class="og-right">${TIMED ? '<div class="og-clock" data-clock style="font-size:26px;font-weight:700;font-variant-numeric:tabular-nums"></div>' : ''}<div class="og-row" data-fp></div><div class="og-status" data-status></div>
      <div class="og-say" data-say><b>Los geht's</b><span class="og-sub">Wähle einen Schwerpunkt.</span></div>
      <div class="og-row"><button class="og-btn" data-hint>Hinweis</button><button class="og-btn" data-sol>Lösung</button><button class="og-btn primary" data-next>Nächste Aufgabe</button><button class="og-btn" data-pgn title="Alle Aufgaben dieser Auswahl als PGN speichern (zum Beispiel für eine Lichess-Studie)">PGN</button><button class="og-btn" data-play title="Diese Stellung gegen Stockfish zu Ende spielen">Ausspielen</button></div>
      <div class="og-note" data-stats></div></div></div>`;
    const q = (s) => card.querySelector(s);
    function sayT(a, b) { q('[data-say]').innerHTML = `<b>${kit.esc(a)}</b>${b ? `<span class="og-sub">${kit.esc(b)}</span>` : ''}`; }
    const board = kit.makeBoard({
      getTargets: (sq) => { if (busy || done || !chess) return []; const p = chess.get(sq); if (!p || p.color !== chess.turn()) return []; return chess.moves({ square: sq, verbose: true }).map(m => m.to); },
      onMove: (f, t) => tryMove(f, t)
    });
    q('[data-boardwrap]').appendChild(board.el);
    function tagsFor(ph) { const c = {}; for (const a of all) if ((ph == null || a.ph === ph) && a.tag) c[a.tag] = (c[a.tag] || 0) + 1; return Object.entries(c).sort((x, y) => y[1] - x[1]); }
    function drawFilters() {
      const pOpts = [['weak', 'Schwerpunkt: Dame, König, Turm'], ['all', 'Alle Figuren'], ['Q', 'Dame'], ['K', 'König'], ['R', 'Turm'], ['N', 'Springer'], ['B', 'Läufer'], ['P', 'Bauer']];
      const hOpts = [['all', 'Alle Phasen'], ['o', 'Eröffnung'], ['m', 'Mittelspiel'], ['e', 'Endspiel']];
      const tg = (SAC || TIMED || ENDG || TACT || BASC) ? tagsFor(null) : (F.phase === 'o' || F.phase === 'e') ? tagsFor(F.phase) : [];
      q('[data-fp]').innerHTML = '<select class="og-select" data-sp aria-label="Figur">' + pOpts.map(([v, t]) => `<option value="${v}" ${F.piece === v ? 'selected' : ''}>${t}</option>`).join('') + '</select><select class="og-select" data-sh aria-label="Phase">' + hOpts.map(([v, t]) => `<option value="${v}" ${F.phase === v ? 'selected' : ''}>${t}</option>`).join('') + '</select><select class="og-select" data-sk aria-label="' + (SAC ? 'Schwierigkeit' : 'Fehlerart') + '">' + (SAC ? [['all', 'Alle Schwierigkeiten'], ['typ', 'Leicht'], ['sel', 'Mittel'], ['aus', 'Schwer']] : [['all', 'Alle Fehlerarten'], ['typ', 'Typische Fehler'], ['sel', 'Seltene Fehler'], ['aus', 'Ausrutscher']]).map(([v, t]) => `<option value="${v}" ${F.kind === v ? 'selected' : ''}>${t}</option>`).join('') + '</select>' + (tg.length ? '<select class="og-select" data-st aria-label="Thema"><option value="all">' + (SAC ? 'Alle Opferarten' : TACT ? 'Alle Muster' : BASC ? 'Alle Themen' : ENDG ? 'Alle Endspielarten und Fehler' : TIMED ? 'Alle Themen' : F.phase === 'o' ? 'Alle Eröffnungen' : 'Alle Endspielarten') + '</option>' + tg.map(([v, c]) => `<option value="${kit.esc(v)}" ${F.tag === v ? 'selected' : ''}>${kit.esc(v)} (${c})</option>`).join('') + '</select>' : '');
      if (TIMED) { q('[data-sk]').style.display = 'none'; q('[data-sp]').style.display = 'none'; }
      if (ENDG) { q('[data-sk]').style.display = 'none'; q('[data-sh]').style.display = 'none'; }
      if (TACT || BASC) { q('[data-sk]').style.display = 'none'; q('[data-sp]').style.display = 'none'; q('[data-sh]').style.display = 'none'; }
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
    function bump(k, ok) { stats[k] = stats[k] || { s: 0, t: 0 }; stats[k].t++; if (ok) stats[k].s++; kit.lsSet(STATS_KEY, stats); showStats(); try { if (window.OrbitronDaily && cur) window.OrbitronDaily.record(SETNAME, cur.f, ok); } catch (e) { /* egal */ } }
    function next() {
      const p = pool();
      if (!p.length) { sayT('Keine Aufgaben', 'Für diese Auswahl gibt es keine Aufgaben.'); return; }
      if (!order.length || order.pool !== p.length + F.piece + F.phase + F.tag + F.kind) { order = p.map((_, i) => i).sort(() => Math.random() - .5); order.pool = p.length + F.piece + F.phase + F.tag + F.kind; }
      const i = order.pop(); cur = p[i]; { const df = window.OrbitronDaily && window.OrbitronDaily.due ? window.OrbitronDaily.due(SETNAME, p.map((c) => c.f)) : null; if (df) { const j = p.findIndex((c) => c.f === df); if (j >= 0) cur = p[j]; } } chess = new C(cur.f); fails = 0; done = false; busy = false;
      const side = chess.turn();
      board.set({ fen: chess.fen(), flip: side === 'b', last: null, check: null, marks: {} });
      q('[data-status]').textContent = ZEIT ? `${K.COLOR[side]} ist am Zug · Zug ${cur.n} · du hast klar Vorteil` : OWNM ? `${K.COLOR[side]} ist am Zug · Zug ${cur.n} · Matt in ${cur.l}` : `${K.COLOR[side]} ist am Zug · ${PHASE_NAME[cur.ph]}, Zug ${cur.n}${cur.tag && !SAC && !ENDG && !TACT ? ' · ' + cur.tag : ''}`;
      if (LAB) sayT('Finde den besseren Eröffnungszug', 'Hier hast du in deinen Partien einen Fehler gemacht. Welcher Zug ist besser?'); else if (MFIG) { if (/^Verhindern/.test(cur.tag)) sayT('Verhindere das Matt', 'Dein Gegner droht Matt. Welcher Zug verteidigt?'); else sayT('Setze Matt', 'Hier gibt es ein erzwungenes Matt. Welcher Zug führt dorthin?'); } else if (DMAT) sayT('Finde das Damenmatt', 'In dieser Stellung gibt es ein erzwungenes Matt mit der Dame. Welcher Zug führt dorthin?'); else if (BASC) sayT(cur.goal === 2 ? 'Finde den Mattweg' : cur.goal === 0 ? 'Halte das Remis' : 'Finde den Gewinnzug', 'Thema: ' + cur.tag + '. Welcher Zug ist richtig?'); else if (TACT) sayT('Finde das Muster', 'Hier gibt es einen Zug, der Material gewinnt. Welcher?'); else if (ZEIT) sayT('Sichere den Gewinn', 'Die Uhr läuft. Vereinfache, tausche oder setze Matt, aber gib den Vorteil nicht her.'); else if (OWNM) sayT('Setze Matt', `Es gibt ein Matt in ${cur.l}. Finde den Zug, bevor die Uhr abläuft.`); else if (SAC) sayT('Finde das Opfer', 'Hier ist ein Opfer der beste Zug. Welcher Zug gibt Material her und bringt trotzdem die bessere Stellung?'); else if (ENDG) sayT('Finde den besseren Endspielzug', `Hier hast du in deiner Partie etwa ${bp(cur.l)} Bauern verloren. Welcher Zug ist besser?`); else sayT('Finde den besseren Zug', `Hier hast du einen Fehler gemacht, der etwa ${bp(cur.l)} Bauern gekostet hat. Welcher Zug ist besser?`); showStats();
      startClock();
    }
    function timeUp() {
      if (!cur || done) return; done = true; busy = false;
      const g2 = new C(cur.f); const m = g2.move({ from: cur.b.slice(0, 2), to: cur.b.slice(2, 4), promotion: cur.b[4] });
      board.set({ marks: { [cur.b.slice(0, 2)]: 'og-hint', [cur.b.slice(2, 4)]: 'og-hint' } });
      if (fails === 0) bump(cur.ps, false); fails = Math.max(fails, 1);
      sayT('Zeit abgelaufen', 'Lösung: ' + (m ? K.describeMove(m) : cur.b) + (cur.line ? ' · Mögliche Folge: ' + cur.line : ''));
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
      if (!ok && await kit.Engine.available()) { const ev = await evalAfter(chess.fen()); ok = ev != null && (OWNM || (ZEIT && cur.tag === 'Matt setzen') ? ev >= 9000 : ZEIT ? ev >= Math.max(cur.e - 150, 400) : ev >= cur.e - (SAC ? 20 : 80)); }
      if (ok) {
        done = true; busy = false;
        if (fails === 0) bump(cur.ps, true);
        const gm = new C(cur.f); const pm = gm.move({ from: cur.p.slice(0, 2), to: cur.p.slice(2, 4), promotion: cur.p[4] });
        if (TIMED) { stopClock(); const used = clockLim - Math.max(0, (clockEnd - Date.now()) / 1000); sayT(OWNM ? 'Matt gefunden!' : 'Vorteil gesichert!', `${fails === 0 ? 'Beim ersten Versuch' : 'Nach ' + fails + ' Fehlversuch(en)'} in ${used.toFixed(1).replace('.', ',')} s. ${cur.line ? 'Mögliche Folge: ' + cur.line + '. ' : ''}${cur.p === cur.b ? 'Das hast du in deiner Partie auch gespielt.' : 'In deiner Partie hast du ' + (pm ? K.describeMove(pm) : 'einen anderen Zug') + ' gespielt' + (ZEIT && cur.l > 50 ? ' und etwa ' + bp(cur.l) + ' Bauern verschenkt' : '') + '.'}`); return; }
        if (EXPL) { sayT(TACT ? 'Richtig: ' + cur.tag + '!' : 'Richtig!', (fails === 0 ? 'Beim ersten Versuch. ' : '') + cur.line + (TACT ? ' ' + (cur.p === cur.b ? 'Das hast du in deiner Partie auch gespielt.' : 'In deiner Partie hast du ' + (pm ? K.describeMove(pm) : 'einen anderen Zug') + ' gespielt' + (cur.l ? ', das hat etwa ' + bp(cur.l) + ' Bauern gekostet' : '') + '.') : '')); return; }
        if (SAC) { sayT('Richtig, das Opfer ist der beste Zug!', `${fails === 0 ? 'Beim ersten Versuch. ' : ''}${cur.tag ? cur.tag + '. ' : ''}${cur.line ? 'Mögliche Folge: ' + cur.line + '. ' : ''}${cur.p === cur.b ? (cur.mine ? 'Das hast du in deiner Partie auch gespielt.' : 'Das wurde in der Partie gespielt.') : (cur.mine ? `In deiner Partie hast du ${pm ? K.describeMove(pm) : 'einen anderen Zug'} gespielt.` : 'In der Partie wurde es nicht gespielt.')}${cur.pr != null ? ` ${KIND_NAME2[kindOf(cur.pr)]}: Dieses Opfer finden auf deinem Niveau etwa ${prTxt(cur.pr)} % der Spieler.` : ''}`); return; }
        sayT('Richtig!', `${fails === 0 ? 'Beim ersten Versuch. ' : ''}In deiner Partie hast du ${pm ? K.describeMove(pm) : 'einen anderen Zug'} gespielt. Das hat etwa ${bp(cur.l)} Bauern gekostet.${ENDG && cur.line ? ' Mögliche Folge: ' + cur.line + '.' : ''}${cur.pr != null ? ` ${KIND_NAME[kindOf(cur.pr)]}: Diesen Zug spielen auf deinem Niveau etwa ${prTxt(cur.pr)} % der Spieler.` : ''}`);
        return;
      }
      await kit.sleep(500); chess.undo(); board.set({ fen: chess.fen(), last: null });
      busy = false; fails++;
      if (fails === 1) bump(cur.ps, false);
      sayT('Nicht ganz', 'Dieser Zug ist schlechter als der beste. Versuch es nochmal oder nimm einen Hinweis.');
    }
    q('[data-hint]').onclick = () => { if (!cur || done || busy) return; board.set({ marks: { [cur.b.slice(0, 2)]: 'og-hint' } }); sayT('Hinweis', `Die markierte Figur macht den besten Zug (${PIECE_NAME[new C(cur.f).get(cur.b.slice(0, 2)).type.toUpperCase()] || 'Figur'}).`); };
    q('[data-sol]').onclick = () => {
      if (!cur || done || busy) return; stopClock(); const g2 = new C(cur.f); const m = g2.move({ from: cur.b.slice(0, 2), to: cur.b.slice(2, 4), promotion: cur.b[4] });
      board.set({ marks: { [cur.b.slice(0, 2)]: 'og-hint', [cur.b.slice(2, 4)]: 'og-hint' } });
      if (fails === 0) bump(cur.ps, false); fails = Math.max(fails, 1);
      sayT('Lösung', (m ? K.describeMove(m) : cur.b) + ((SAC || TIMED || ENDG) && cur.line ? ' · Mögliche Folge: ' + cur.line : '') + (EXPL && cur.line ? ' · ' + cur.line : ''));
    };
    q('[data-next]').onclick = next;
    const exportPgn = () => toPgn(pool(), TITLE, !(OWNM || SAC || BASC), !BASC);
    q('[data-play]').onclick = () => { const P = window.OrbitronPlay; if (!P || !cur) { sayT('Ausspielen nicht verfügbar', 'Die Funktion konnte nicht geladen werden.'); return; } stopClock(); P.openPlay({ fen: cur.f, goal: BASC ? (cur.goal === 2 ? 'mate' : cur.goal === 0 ? 'draw' : 'win') : null, e0: cur.e, title: TITLE }); };
    q('[data-pgn]').onclick = () => { const p = exportPgn(); if (!p) { sayT('Nichts zu exportieren', 'Für diese Auswahl gibt es keine Aufgaben.'); return; } const ok = downloadText('orbitron-' + SETNAME + '-' + new Date().toISOString().slice(0, 10) + '.pgn', p); sayT(ok ? 'PGN gespeichert' : 'Speichern nicht möglich', ok ? pool().length + ' Aufgaben als PGN in deinem Download-Ordner. In einer Lichess-Studie kannst du die Datei importieren.' : 'Der Browser hat das Speichern blockiert.'); };
    drawFilters(); showStats(); next();
    kit.addCard(card); card.__og = { exportPgn, next, tryMove, board, getCur: () => cur, timeUp, getClock: () => ({ lim: clockLim, running: !!clockT }) }; return card;
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
    if (/^[/]matt-?figuren\b|^matt-?figuren\b/.test(s)) return { run: () => openBlunderTrainer({ set: 'mfig' }) };
    if (/^[/]damenmatt\b|^damenmatt-?(muster|trainer)\b|^[/]diagonale\b/.test(s)) return { run: () => openBlunderTrainer({ set: 'dmatt' }) };
    if (window.OrbitronOpen && window.OrbitronOpen.match) { const r = window.OrbitronOpen.match(t); if (r) return r; }
    if (window.OrbitronTime && window.OrbitronTime.match) { const r = window.OrbitronTime.match(t); if (r) return r; }
    if (window.OrbitronDaily && window.OrbitronDaily.match) { const r = window.OrbitronDaily.match(t); if (r) return r; }
    if (/^[/](tempo|matt-?tempo)\b|^matt-?tempo\b/.test(s)) return { run: () => openBlunderTrainer({ set: 'tempo' }) };
    if (window.OrbitronLabor && window.OrbitronLabor.match) { const r = window.OrbitronLabor.match(t); if (r) return r; }
    if (window.OrbitronBackup && window.OrbitronBackup.match) { const r = window.OrbitronBackup.match(t); if (r) return r; }
    if (window.OrbitronLive && window.OrbitronLive.match) { const r = window.OrbitronLive.match(t); if (r) return r; }
    if (window.OrbitronScan && window.OrbitronScan.match) { const r = window.OrbitronScan.match(t); if (r) return r; }
    if (window.OrbitronProfile && window.OrbitronProfile.match) { const r = window.OrbitronProfile.match(t); if (r) return r; }
    if (window.OrbitronPlay && window.OrbitronPlay.match) { const r = window.OrbitronPlay.match(t); if (r) return r; }
    if (/^[/]taktik\b|^taktik-?(muster|trainer)\b/.test(s)) return { run: () => openBlunderTrainer({ set: 'tactic' }) };
    if (/^[/]grundlagen\b|^endspiel-?grundlagen\b/.test(s)) return { run: () => openBlunderTrainer({ set: 'basics' }) };
    if (/^[/]zeitnot\b|^zeitnot-?trainer\b/.test(s)) return { run: () => openBlunderTrainer({ set: 'zeit' }) };
    if (/^[/]matt(j[aä]ger|e)?\b|^mattj[aä]ger\b/.test(s)) return { run: () => openBlunderTrainer({ set: 'ownmate' }) };
    if (/^[/]opfer\b|^opfer-?trainer\b/.test(s)) return { run: () => openBlunderTrainer({ set: 'sac' }) };
    if (/^\/bullet\b|^bullet-?aufgaben\b/.test(s)) return { run: () => openBlunderTrainer({ set: 'bullet' }) };
    if (/^\/fehler\b|^fehler-?trainer\b/.test(s)) return { run: openBlunderTrainer };
    if (/^\/partien\b|^meine partien\b|^\/chesscom\b/.test(s)) return { run: () => openChessCom() };
    if (/^\/er[oö]+ffnung\b|^\/eroeffnung\b|^er[oö]ffnungs-?trainer\b/.test(s)) return { run: () => openBlunderTrainer({ phase: 'o' }) };
    if (/^[/]endspiel(-?fehler)?\b|^endspiel-?(trainer|fehler)\b/.test(s)) return { run: () => openBlunderTrainer({ set: 'endgame' }) };
    if (/^\/training\b|^training\b$/.test(s)) return { run: openMenu };
    return null;
  }

  // Direktlinks: gemini-chat.html#/zeitnot, #/matt, #/opfer, #/bullet, #/fehler, #/repertoire, #/fallen, #/training, #/partien
  function openFromHash() {
    let h = ''; try { h = decodeURIComponent((location.hash || '').replace(/^#/, '')); } catch (e) { return; }
    if (!/^[/]/.test(h)) return; const m = match(h); if (m && m.run) m.run();
  }
  ready(() => {
    window.OrbitronTrain = { openBlunderTrainer, openChessCom, openMenu, match, openFromHash, toPgn, version: '1.3' };
    setTimeout(openFromHash, 900);
    window.addEventListener('hashchange', openFromHash);
  });
})();
