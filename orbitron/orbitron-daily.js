/* Orbitron Daily: Tagesplan ("Training heute"), Wiederholungsplan fuer falsch geloeste Aufgaben, Serie und Session-Waechter.
 * Alles bleibt im Browser (localStorage). Der Session-Waechter liest nur die oeffentliche Chess.com-Schnittstelle und ist abschaltbar.
 * Hooks: orbitron-train.js ruft record(set, fen, ok) nach jeder Aufgabe auf und fragt due(set, fens) fuer faellige Wiederholungen.
 */
(function () {
  'use strict';
  const K = window.OrbitronGameCore; if (!K) return;
  let kit = null;
  function ready(fn) { if (window.OrbitronGame && window.OrbitronGame._kit) { kit = window.OrbitronGame._kit; fn(); } else document.addEventListener('orbitron-game-ready', () => { kit = window.OrbitronGame._kit; fn(); }, { once: true }); }
  const KEY = 'orbitron_daily_v1', GUARD_KEY = 'orbitron_guard_v1', USER_KEY = 'orbitron_cc_user_v1';
  const STEPS = [1, 3, 7, 14]; // Tage bis zur naechsten Wiederholung
  const STATIONS = [
    { set: 'ownmate', name: 'Mattjäger', target: 3, icon: 'bi-stopwatch', note: 'Matt in 1 bis 6 mit Uhr' },
    { set: 'zeit', name: 'Zeitnot-Trainer', target: 3, icon: 'bi-hourglass-split', note: 'Gewinn nach Hause bringen' },
    { set: 'sac', name: 'Opfer-Trainer', target: 2, icon: 'bi-gem', note: 'das Opfer finden' },
    { set: 'endgame', name: 'Endspiel-Fehler', target: 2, icon: 'bi-flag', note: 'deine Endspielfehler' },
    { set: 'tactic', name: 'Taktik-Muster', target: 2, icon: 'bi-bullseye', note: 'Gabel, Spieß, Abzug erkennen' },
    { set: 'scan', name: 'Drohungs-Scanner', target: 3, icon: 'bi-binoculars', note: 'in Sekunden sehen, was hängt oder droht' },
    { set: 'mfig', name: 'Matt-Figuren', target: 2, icon: 'bi-grid-3x3-gap', note: 'Matt setzen und verhindern' },
    { set: 'dmatt', name: 'Damenmatt-Muster', target: 2, icon: 'bi-bounding-box', note: 'Dame und Läufer-Diagonale' },
    { set: 'basics', name: 'Endspiel-Grundlagen', target: 1, icon: 'bi-mortarboard', note: 'Lucena, Philidor, Schlüsselfeld' },
    { set: 'bullet', name: 'Bullet-Aufgaben', target: 2, icon: 'bi-lightning-charge', note: 'Fehler aus Bullet' },
    { set: 'blunder', name: 'Fehler-Trainer', target: 2, icon: 'bi-lightning-charge', note: 'Fehler aus Blitz' }
  ];
  const SET_NAME = Object.fromEntries(STATIONS.map((s) => [s.set, s.name]));
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d) => { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const epochDay = (d) => { d = d || new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); };
  const fkey = (fen) => String(fen).split(' ').slice(0, 4).join(' ');
  let focus = null;

  function load() { let s = null; try { s = kit && kit.lsGet(KEY, null); } catch (e) { s = null; } if (!s || typeof s !== 'object') s = {}; s.days = s.days || {}; s.srs = s.srs || {}; s.goal = s.goal || 5; s.mastered = s.mastered || 0; return s; }
  function save(s) { try { kit.lsSet(KEY, s); } catch (e) { /* Speicher gesperrt: ohne Speichern weiterarbeiten */ } }

  // Wird von den Trainern nach jeder Aufgabe aufgerufen (nur das Ergebnis des ersten Versuchs).
  function record(set, fen, ok) {
    try {
      const s = load(); const dk = dayKey(); const day = s.days[dk] || (s.days[dk] = { total: 0, ok: 0, bySet: {} });
      day.total++; if (ok) day.ok++; const b = day.bySet[set] || (day.bySet[set] = [0, 0]); b[0]++; if (ok) b[1]++;
      const k = fkey(fen), today = epochDay(); const e = s.srs[k];
      if (!ok) s.srs[k] = { set, step: 0, due: today + STEPS[0], fails: (e ? e.fails : 0) + 1 };
      else if (e) { e.step++; if (e.step >= STEPS.length) { delete s.srs[k]; s.mastered++; } else e.due = today + STEPS[e.step]; }
      // alte Tage aufraeumen (180 Tage behalten)
      const keep = Object.keys(s.days).sort().slice(-180); for (const d of Object.keys(s.days)) if (!keep.includes(d)) delete s.days[d];
      save(s);
    } catch (e) { /* nie die Aufgabe stoeren */ }
  }
  // Liefert die FEN einer faelligen Wiederholung aus dieser Aufgabenliste (oder null).
  function due(set, fens) {
    try {
      const s = load(), today = epochDay(); const p = (focus && focus.set === set && Date.now() < focus.until) ? 1 : 0.4; if (Math.random() >= p) return null;
      const keys = new Set(fens.map(fkey)); let best = null;
      for (const [k, e] of Object.entries(s.srs)) if (e.set === set && e.due <= today && keys.has(k) && (!best || e.due < best.due)) best = { k, due: e.due };
      if (!best) return null; return fens.find((f) => fkey(f) === best.k) || null;
    } catch (e) { return null; }
  }
  function srsStats() {
    const s = load(), today = epochDay(); const by = {}; let dueN = 0; for (const e of Object.values(s.srs)) { if (e.due <= today) { dueN++; by[e.set] = (by[e.set] || 0) + 1; } }
    return { due: dueN, total: Object.keys(s.srs).length, mastered: s.mastered, dueBySet: by };
  }
  function streak(s) {
    const goal = s.goal; let n = 0; const d = new Date(); const todayDone = (s.days[dayKey(d)] || { total: 0 }).total >= goal; if (!todayDone) d.setDate(d.getDate() - 1);
    for (let i = 0; i < 400; i++) { const day = s.days[dayKey(d)]; if (day && day.total >= goal) { n++; d.setDate(d.getDate() - 1); } else break; }
    return { n, todayDone };
  }

  // ---------------- Session-Waechter ----------------
  async function guardCheck(user) {
    const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const urls = [`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/${now.getFullYear()}/${pad(now.getMonth() + 1)}`];
    if (now.getDate() === 1) { const p = new Date(now.getFullYear(), now.getMonth() - 1, 1); urls.unshift(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/${p.getFullYear()}/${pad(p.getMonth() + 1)}`); }
    let games = [];
    for (const u of urls) { const r = await fetch(u); if (r.status === 404) continue; if (!r.ok) throw new Error('Chess.com antwortet mit Fehler ' + r.status); const j = await r.json(); games = games.concat(j.games || []); }
    const me = user.toLowerCase(); const DR = ['agreed', 'repetition', 'stalemate', 'insufficient', 'timevsinsufficient', '50move'];
    const today = games.filter((g) => g.rules === 'chess' && g.end_time * 1000 >= start).sort((a, b) => a.end_time - b.end_time).map((g) => { const w = g.white.username.toLowerCase() === me; const m = w ? g.white : g.black; return { r: m.result === 'win' ? 'W' : DR.includes(m.result) ? 'D' : 'L', t: g.end_time * 1000, rating: m.rating, cls: g.time_class }; });
    const out = { n: today.length, W: 0, D: 0, L: 0, lossRun: 0, maxLossRun: 0, last60: 0, first: today.length ? today[0].t : null, ratingDelta: 0, cls: '', peakDrop: 0 };
    let run = 0; for (const g of today) { out[g.r]++; if (g.r === 'L') { run++; out.maxLossRun = Math.max(out.maxLossRun, run); } else run = 0; } out.lossRun = run;
    out.last60 = today.filter((g) => Date.now() - g.t <= 3600000).length;
    const cnt = {}; for (const g of today) cnt[g.cls] = (cnt[g.cls] || 0) + 1; out.cls = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || '';
    const rs = today.filter((g) => g.cls === out.cls && typeof g.rating === 'number').map((g) => g.rating); if (rs.length) { out.ratingDelta = rs[rs.length - 1] - rs[0]; out.peakDrop = Math.max(...rs) - rs[rs.length - 1]; }
    return out;
  }
  function guardText(g) {
    if (!g.n) return { kind: 'ok', head: 'Heute noch keine Partie gespielt.', text: 'Ein guter Moment für ein paar Aufgaben.' };
    const base = `Heute: ${g.n} Partien (${g.W} Siege, ${g.D} Remis, ${g.L} Niederlagen)${g.cls ? ', meistens ' + g.cls : ''}. Rating ${g.ratingDelta >= 0 ? '+' : ''}${g.ratingDelta} seit der ersten Partie${g.peakDrop >= 40 ? `, ${g.peakDrop} unter dem Tageshoch` : ''}.`;
    if (g.lossRun >= 3) return { kind: 'warn', head: `${g.lossRun} Niederlagen in Folge`, text: base + ' Nach mehreren Niederlagen hintereinander passieren die meisten Patzer. Mach eine kurze Pause oder 5 Aufgaben, bevor die nächste Partie startet.' };
    if (g.n >= 40) return { kind: 'warn', head: `Schon ${g.n} Partien heute`, text: base + ' Das ist viel. Eine Pause tut dem Spiel meist gut.' };
    if (g.last60 >= 20) return { kind: 'warn', head: `${g.last60} Partien in der letzten Stunde`, text: base + ' Du spielst ohne Pause. Zwischendurch zehn Minuten Abstand helfen.' };
    return { kind: 'ok', head: 'Alles im Rahmen', text: base };
  }

  // ---------------- Dashboard ----------------
  function openToday() {
    const card = kit.newCard(); const s0 = load();
    card.innerHTML = `<div class="og-title"><i class="bi bi-calendar-check"></i> Training heute <span class="og-badge" data-streak></span></div>
      <div class="og-note og-desc">Dein Tagesplan: kleine Aufgaben statt noch eine Partie. Fehler, die du nicht im ersten Versuch löst, kommen automatisch nach 1, 3, 7 und 14 Tagen wieder.</div>
      <div class="og-say" data-prog></div>
      <div class="og-say" data-focus style="display:none"></div>
      <div class="og-row"><label class="og-note" for="og-goal">Tagesziel</label><select class="og-select" id="og-goal" data-goal>${[5, 10, 20].map((n) => `<option value="${n}" ${s0.goal === n ? 'selected' : ''}>${n} Aufgaben</option>`).join('')}</select><button class="og-btn" data-refresh>Aktualisieren</button></div>
      <div data-stations></div>
      <div class="og-say" data-srs></div>
      <div class="og-title" style="font-size:15px;margin-top:10px"><i class="bi bi-shield-check"></i> Session-Wächter</div>
      <div class="og-note">Schaut in deine heutigen Chess.com-Partien (öffentliche Daten) und sagt dir, wann eine Pause sinnvoll ist. Du kannst ihn jederzeit ausschalten.</div>
      <div class="og-row" data-guardctl></div><div class="og-say" data-guard style="display:none"></div>`;
    const q = (x) => card.querySelector(x);
    function draw() {
      const s = load(), today = s.days[dayKey()] || { total: 0, ok: 0, bySet: {} }; const st = streak(s); const pct = Math.min(100, Math.round(today.total / s.goal * 100));
      q('[data-streak]').textContent = st.n ? `Serie: ${st.n} ${st.n === 1 ? 'Tag' : 'Tage'}` : 'Noch keine Serie';
      q('[data-prog]').innerHTML = `<b>Heute: ${today.total} von ${s.goal} Aufgaben${st.todayDone ? ' ✓ Tagesziel erreicht' : ''}</b><span class="og-sub">${today.total ? today.ok + ' davon im ersten Versuch richtig. ' : ''}${st.todayDone ? 'Gut gemacht, die Serie läuft weiter.' : `Noch ${Math.max(0, s.goal - today.total)} bis zum Tagesziel${st.n ? ', dann wird deine Serie ' + (st.n + 1) + ' Tage lang' : ''}.`}</span><div style="height:8px;border-radius:6px;background:rgba(128,128,128,.25);margin-top:6px;overflow:hidden"><div data-bar style="height:100%;width:${pct}%;background:${st.todayDone ? '#2e9d4f' : '#1a73e8'}"></div></div>`;
      const rot = epochDay() % STATIONS.length; const rec = new Set([0, 1, 2, 3].map((i) => STATIONS[(rot + i) % STATIONS.length].set)); const sr = srsStats();
      { const P = window.OrbitronProfile; const f = P && P.getFocus ? P.getFocus() : null; const fb = q('[data-focus]'); if (f) { rec.add(f.set); const ft = P.focusText(f); fb.style.display = ''; fb.innerHTML = `<b>Wochenfokus: ${kit.esc(f.name)}</b><span class="og-sub">${kit.esc(ft.line)}</span><div class="og-row"><button class="og-btn primary" data-fgo>Fokus üben</button><button class="og-btn" data-fall>Rating-Hebel ansehen</button></div>`; fb.querySelector('[data-fgo]').onclick = () => P.openFocusTrainer(f); fb.querySelector('[data-fall]').onclick = () => P.openProfile('lever'); } else if (fb) { fb.style.display = P && window.ORBITRON_PROFILE_DATA ? '' : 'none'; if (P && window.ORBITRON_PROFILE_DATA) { fb.innerHTML = '<b>Noch kein Wochenfokus</b><span class="og-sub">Der Rating-Hebel zeigt, was dich am meisten Rating kostet, und macht daraus deinen Fokus für die Woche.</span><div class="og-row"><button class="og-btn primary" data-fall>Rating-Hebel öffnen</button></div>'; fb.querySelector('[data-fall]').onclick = () => P.openProfile('lever'); } } }
      q('[data-stations]').innerHTML = STATIONS.map((x) => { const d = today.bySet[x.set] || [0, 0]; const fin = d[0] >= x.target; const dueN = sr.dueBySet[x.set] || 0; return `<button class="og-btn" style="display:block;width:100%;text-align:left;margin:4px 0" data-st="${x.set}"><i class="bi ${x.icon}"></i> <b>${x.name}</b> <span class="og-note">${x.note} · ${d[0]}/${x.target} heute${fin ? ' ✓' : ''}${rec.has(x.set) && !fin ? ' · heute empfohlen' : ''}${dueN ? ` · ${dueN} Wiederholung${dueN > 1 ? 'en' : ''} fällig` : ''}</span></button>`; }).join('');
      q('[data-stations]').querySelectorAll('[data-st]').forEach((b) => b.onclick = () => openSet(b.dataset.st));
      q('[data-srs]').innerHTML = `<b>Wiederholung</b><span class="og-sub">${sr.due ? `<b>${sr.due}</b> Aufgabe${sr.due > 1 ? 'n' : ''} heute fällig` : 'Heute ist nichts fällig'} · ${sr.total} insgesamt im Wiederholungsplan · ${sr.mastered} gemeistert.</span>${sr.due ? '<div class="og-row"><button class="og-btn primary" data-due>Fällige Aufgaben jetzt wiederholen</button></div>' : ''}`;
      const db = q('[data-due]'); if (db) db.onclick = () => { const top = Object.entries(sr.dueBySet).sort((a, b) => b[1] - a[1])[0]; if (top) { focus = { set: top[0], until: Date.now() + 30 * 60000 }; openSet(top[0]); } };
    }
    function openSet(set) { if (set === 'scan') { if (window.OrbitronScan) window.OrbitronScan.openScan(); return; } const T = window.OrbitronTrain; if (!T) return; T.openBlunderTrainer(set === 'blunder' ? {} : { set }); }
    q('[data-goal]').onchange = (e) => { const s = load(); s.goal = +e.target.value; save(s); draw(); };
    q('[data-refresh]').onclick = () => { draw(); };
    // Waechter
    const gs = () => { let g = null; try { g = kit.lsGet(GUARD_KEY, null); } catch (e) { g = null; } return g || { off: false }; };
    function drawGuard() {
      const g = gs(), user = (() => { try { return kit.lsGet(USER_KEY, '') || ''; } catch (e) { return ''; } })();
      q('[data-guardctl]').innerHTML = g.off ? '<button class="og-btn" data-on>Wächter einschalten</button>' : `<input class="og-input" data-user placeholder="Chess.com-Benutzername" style="max-width:230px" value="${kit.esc(user)}"><button class="og-btn primary" data-check>Heute prüfen</button><button class="og-btn" data-off>Ausschalten</button>`;
      const on = q('[data-on]'); if (on) on.onclick = () => { try { kit.lsSet(GUARD_KEY, { off: false }); } catch (e) { /* egal */ } drawGuard(); };
      const off = q('[data-off]'); if (off) off.onclick = () => { try { kit.lsSet(GUARD_KEY, { off: true }); } catch (e) { /* egal */ } q('[data-guard]').style.display = 'none'; drawGuard(); };
      const ck = q('[data-check]'); if (ck) ck.onclick = run;
    }
    async function run() {
      const inp = q('[data-user]'); const user = (inp ? inp.value : '').trim().toLowerCase(); const box = q('[data-guard]'); if (!user) { box.style.display = ''; box.innerHTML = '<b>Benutzername fehlt</b><span class="og-sub">Gib deinen Chess.com-Namen ein.</span>'; return; }
      try { kit.lsSet(USER_KEY, user); } catch (e) { /* egal */ }
      box.style.display = ''; box.innerHTML = '<b>Lade heutige Partien ...</b>';
      try { const g = await guardCheck(user); const t = guardText(g); box.innerHTML = `<b>${kit.esc(t.head)}</b><span class="og-sub">${kit.esc(t.text)}</span>`; box.dataset.kind = t.kind; box.style.borderLeftColor = t.kind === 'warn' ? '#e53935' : '#2e9d4f'; card.__daily.guard = g; }
      catch (e) { box.innerHTML = `<b>Nicht erreichbar</b><span class="og-sub">${kit.esc(e.message || 'Die Chess.com-Daten konnten nicht geladen werden.')}</span>`; box.dataset.kind = 'err'; }
    }
    card.__daily = { draw, run, guard: null, state: () => load() };
    kit.addCard(card); draw(); drawGuard();
    if (!gs().off) { let u = ''; try { u = kit.lsGet(USER_KEY, '') || ''; } catch (e) { u = ''; } if (u) run(); }
    return card;
  }
  function match(t) {
    if (!t) return null; const s = t.toLowerCase();
    if (/^[/](heute|tagesplan|wiederholung|serie)\b|^training heute\b/.test(s)) return { run: openToday };
    return null;
  }
  ready(() => { window.OrbitronDaily = { days: () => load().days, openToday, record, due, srsStats, streak, guardText, guardCheck, match, version: '1.0' }; });
})();
