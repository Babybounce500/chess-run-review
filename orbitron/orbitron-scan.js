/* Orbitron Scan: Drohungs-Scanner. Stellungen aus deinen Partien kurz vor einem Patzer: Du hast wenige Sekunden und tippst an, was haengt
 * (eigene und gegnerische Figuren) und ob Matt droht. Die Loesung kommt vom Patzer-Check (hangingFor, Matt in einem Zug fuer den Gegner).
 * Trainiert die Gewohnheit "erst schauen, dann ziehen". Nur fuer Training, nicht fuer laufende Partien gedacht.
 */
(function () {
  'use strict';
  const K = window.OrbitronGameCore, C = window.Chess; if (!K || !C) return;
  let kit = null;
  function ready(fn) { if (window.OrbitronGame && window.OrbitronGame._kit) { kit = window.OrbitronGame._kit; fn(); } else document.addEventListener('orbitron-game-ready', () => { kit = window.OrbitronGame._kit; fn(); }, { once: true }); }
  const KEY = 'orbitron_scan_v1', ROUNDS = 10;
  const bp = (x) => (Math.abs(x) / 100).toFixed(1).replace('.', ',');

  function tasks() {
    const out = [];
    for (const [v, nm] of [['ORBITRON_BLUNDERS', 'Fehler'], ['ORBITRON_BULLET', 'Bullet'], ['ORBITRON_MFIG', 'Matt']]) for (const a of (window[v] || [])) { if (nm === 'Matt' && !/^Verhindern/.test(a[8] || '')) continue; out.push({ f: a[0], b: a[1], p: a[2], l: a[5], src: nm }); }
    return out;
  }
  // Loesung einer Stellung: Felder mit gefaehrdeten Figuren (beide Seiten) und Mattdrohung
  function truthOf(fen) {
    let r; try { r = K.patzerCheck(C, fen); } catch (e) { return null; }
    if (!r || r.over || r.inCheck) return null;
    const sqs = new Set([...r.hangingMine.map((h) => h.sq), ...r.hangingTheirs.map((h) => h.sq)]);
    return { sqs, mate: r.threatMate.length > 0, lines: r.lines, turn: r.turn, n: sqs.size + (r.threatMate.length ? 1 : 0) };
  }
  function pick(all, wantQuiet) {
    for (let i = 0; i < 80; i++) {
      const mt = !wantQuiet && Math.random() < 0.2 ? all.filter((x) => x.src === 'Matt') : null; const src = mt && mt.length ? mt : all; const t = src[Math.floor(Math.random() * src.length)]; const tr = truthOf(t.f); if (!tr) continue;
      if (wantQuiet ? tr.n === 0 : (tr.n >= 1 && tr.n <= 5)) return { task: t, truth: tr };
    }
    return null;
  }
  function loadStats() { let s = null; try { s = kit.lsGet(KEY, null); } catch (e) { s = null; } return s && typeof s === 'object' ? s : { runs: 0, best: 0, rounds: 0, perfect: 0, hit: 0, miss: 0, fa: 0, mateMiss: 0 }; }
  function saveStats(s) { try { kit.lsSet(KEY, s); } catch (e) { /* ohne Speichern weiter */ } }

  function openScan(opts) {
    opts = opts || {}; const all = tasks(); const card = kit.newCard();
    const S = { round: 0, secs: opts.secs || 5, res: [], cur: null, timer: null, endAt: 0, over: false, run: 0 };
    card.innerHTML = `<div class="og-title"><i class="bi bi-binoculars"></i> Drohungs-Scanner <span class="og-badge" data-badge>${ROUNDS} Runden</span></div>
      <div class="og-note og-desc">Du siehst eine Stellung aus einer deiner Partien kurz vor einem Patzer. Tippe in wenigen Sekunden alle Figuren an, die hängen oder angegriffen werden (deine und gegnerische). Droht dir Matt in einem Zug, tippe „Matt droht“. Passiert nichts, tippst du nichts an und drückst „Fertig“. So übst du, vor dem Ziehen zu schauen.</div>
      <div class="og-play"><div class="og-left" data-boardwrap></div><div class="og-right">
      <div class="og-row"><label class="og-note" for="og-scs">Zeit</label><select class="og-select" id="og-scs" data-secs>${[3, 5, 8, 12].map((n) => `<option value="${n}" ${S.secs === n ? 'selected' : ''}>${n} Sekunden</option>`).join('')}</select></div>
      <div class="og-clock" data-clock style="font-size:24px;font-weight:700;font-variant-numeric:tabular-nums"></div>
      <div class="og-status" data-status></div>
      <div class="og-say" data-say><b>Bereit?</b><span class="og-sub">Mit „Start“ beginnt die erste Runde.</span></div>
      <div class="og-row"><button class="og-btn primary" data-start>Start</button><button class="og-btn" data-mate disabled>Matt droht</button><button class="og-btn" data-done disabled>Fertig</button><button class="og-btn" data-next style="display:none">Nächste Runde</button></div>
      <div class="og-note" data-stats></div></div></div>`;
    const q = (s) => card.querySelector(s);
    const board = kit.makeBoard({});
    q('[data-boardwrap]').appendChild(board.el);
    function say(a, b) { q('[data-say]').innerHTML = `<b>${kit.esc(a)}</b>${b ? `<span class="og-sub">${kit.esc(b)}</span>` : ''}`; }
    function drawStats() { const s = loadStats(); q('[data-stats]').textContent = s.rounds ? `Bisher ${s.rounds} Runden, davon ${s.perfect} fehlerfrei (${Math.round(s.perfect / s.rounds * 100)} %). Bester Lauf: ${s.best} von ${ROUNDS}.` : 'Noch keine Runde gespielt.'; }
    function stopTimer() { if (S.timer) { clearInterval(S.timer); S.timer = null; } }
    function marksNow() { const m = {}; if (S.cur) for (const sq of S.cur.marks) m[sq] = 'og-hint'; return m; }
    function drawClock(left) { const c = q('[data-clock]'); c.textContent = '⏱ ' + Math.max(0, left).toFixed(1).replace('.', ',') + ' s'; c.classList.toggle('og-clock-low', left < 2); }
    function startRound() {
      stopTimer(); const quiet = Math.random() < 0.2; const p = pick(all, quiet) || pick(all, false); if (!p) { say('Keine Stellung gefunden', 'Die Aufgaben konnten nicht geladen werden.'); return; }
      S.round++; S.over = false; S.cur = { task: p.task, truth: p.truth, marks: new Set(), mate: false, done: false, quiet: p.truth.n === 0 };
      const turn = p.truth.turn; board.set({ fen: p.task.f, flip: turn === 'b', last: null, check: null, marks: {}, sel: null, targets: [] });
      q('[data-status]').textContent = `Runde ${S.round} von ${ROUNDS} · ${K.COLOR[turn]} ist am Zug`;
      say('Was hängt oder droht?', 'Tippe die Figuren an. Mit „Matt droht“ meldest du eine Mattdrohung des Gegners.');
      q('[data-start]').style.display = 'none'; q('[data-next]').style.display = 'none'; const m = q('[data-mate]'); m.disabled = false; m.classList.remove('on'); q('[data-done]').disabled = false;
      S.endAt = Date.now() + S.secs * 1000; drawClock(S.secs);
      S.timer = setInterval(() => { if (!card.isConnected) { stopTimer(); return; } const left = (S.endAt - Date.now()) / 1000; drawClock(left); if (left <= 0) finishRound(true); }, 100);
    }
    function tap(sq) {
      if (!S.cur || S.cur.done) return; const p = board.state.map[sq]; if (!p) return;
      if (S.cur.marks.has(sq)) S.cur.marks.delete(sq); else S.cur.marks.add(sq); board.set({ marks: marksNow() });
    }
    board.el.addEventListener('pointerdown', (e) => { const el = document.elementFromPoint(e.clientX, e.clientY); const s = el && el.closest && el.closest('.og-sq'); if (s && board.el.contains(s)) tap(s.dataset.sq); });
    function finishRound(timeout) {
      if (!S.cur || S.cur.done) return; stopTimer(); const c = S.cur; c.done = true;
      const hits = [...c.marks].filter((s) => c.truth.sqs.has(s)), fa = [...c.marks].filter((s) => !c.truth.sqs.has(s)), miss = [...c.truth.sqs].filter((s) => !c.marks.has(s));
      const mateOk = c.mate === c.truth.mate; const perfect = !fa.length && !miss.length && mateOk;
      const m = {}; for (const s of hits) m[s] = 'og-good'; for (const s of miss) m[s] = 'og-bad'; for (const s of fa) m[s] = 'og-hint'; board.set({ marks: m });
      const r = { perfect, hit: hits.length, miss: miss.length, fa: fa.length, mateMiss: c.truth.mate && !c.mate ? 1 : 0, mateFalse: !c.truth.mate && c.mate ? 1 : 0, timeout: !!timeout }; S.res.push(r); c.result = r;
      let note = ''; try { const g = new C(c.task.f); const pm = g.move({ from: c.task.p.slice(0, 2), to: c.task.p.slice(2, 4), promotion: c.task.p[4] }); const g2 = new C(c.task.f); const bm = g2.move({ from: c.task.b.slice(0, 2), to: c.task.b.slice(2, 4), promotion: c.task.b[4] }); if (pm && c.task.p !== c.task.b) note = ` In deiner Partie hast du ${K.describeMove(pm)} gespielt${c.task.l ? ' (Verlust etwa ' + bp(c.task.l) + ' Bauern)' : ''}. Besser war ${bm ? K.describeMove(bm) : c.task.b}.`; } catch (e) { note = ''; }
      const parts = []; if (hits.length) parts.push(`${hits.length} richtig gefunden`); if (miss.length) parts.push(`${miss.length} übersehen (rot)`); if (fa.length) parts.push(`${fa.length} Fehlalarm`); if (c.truth.mate && !c.mate) parts.push('Mattdrohung übersehen'); if (!c.truth.mate && c.mate) parts.push('„Matt droht“ war falsch');
      say(perfect ? (c.quiet ? 'Richtig: hier droht nichts' : 'Fehlerfrei!') : timeout ? 'Zeit abgelaufen' : 'Nicht ganz', (parts.join(', ') || 'Alles gefunden') + '. ' + c.truth.lines.join(' ') + note);
      try { if (window.OrbitronDaily) window.OrbitronDaily.record('scan', c.task.f, perfect); } catch (e) { /* egal */ }
      q('[data-mate]').disabled = true; q('[data-done]').disabled = true;
      const nx = q('[data-next]'); nx.style.display = ''; nx.textContent = S.round >= ROUNDS ? 'Auswertung' : 'Nächste Runde';
    }
    function summary() {
      stopTimer(); const R = S.res; const perf = R.filter((r) => r.perfect).length; const sum = (k) => R.reduce((a, r) => a + (r[k] || 0), 0);
      const st = loadStats(); st.runs++; st.best = Math.max(st.best, perf); st.rounds += R.length; st.perfect += perf; st.hit += sum('hit'); st.miss += sum('miss'); st.fa += sum('fa'); st.mateMiss += sum('mateMiss'); saveStats(st);
      const weak = sum('miss') >= sum('fa') ? (sum('miss') > 0 ? 'Du übersiehst eher Figuren, als dass du zu viel meldest. Geh vor dem Zug bewusst alle Figuren durch.' : '') : 'Du meldest oft zu viel. Prüfe, ob die Figur wirklich angegriffen und ungedeckt ist.';
      q('[data-status]').textContent = 'Lauf beendet'; q('[data-clock]').textContent = '';
      say(`${perf} von ${R.length} Runden fehlerfrei`, `${sum('hit')} Gefahren gefunden, ${sum('miss')} übersehen, ${sum('fa')} Fehlalarme, ${sum('mateMiss')} Mattdrohung(en) übersehen. ${weak}`);
      const nx = q('[data-next]'); nx.style.display = 'none'; const sb = q('[data-start]'); sb.style.display = ''; sb.textContent = 'Neuer Lauf'; S.round = 0; S.res = []; S.over = true; drawStats(); card.__scan.last = { perf, n: R.length };
    }
    q('[data-start]').onclick = () => { S.run++; S.res = []; S.round = 0; startRound(); };
    q('[data-next]').onclick = () => { if (S.round >= ROUNDS) summary(); else startRound(); };
    q('[data-done]').onclick = () => finishRound(false);
    q('[data-mate]').onclick = (e) => { if (!S.cur || S.cur.done) return; S.cur.mate = !S.cur.mate; e.currentTarget.classList.toggle('on', S.cur.mate); };
    q('[data-secs]').onchange = (e) => { S.secs = +e.target.value; };
    card.__scan = { S, tap, finish: (t) => finishRound(t), start: () => q('[data-start]').click(), next: () => q('[data-next]').click(), truth: () => S.cur && S.cur.truth, board, last: null, toggleMate: () => q('[data-mate]').click() };
    kit.addCard(card); drawStats(); return card;
  }
  function match(t) {
    if (!t) return null; const s = t.toLowerCase();
    if (/^[/](scanner|scan|drohung|drohungen|drohungs-?scanner)\b|^drohungs-?scanner\b/.test(s)) return { run: () => openScan() };
    return null;
  }
  ready(() => { window.OrbitronScan = { openScan, truthOf, match, version: '1.0' }; });
})();
