/* Orbitron Profile: Rating-Hebel (welche Schwaeche kostet dich am meisten), Wochenfokus mit Messung und Mattbild-Atlas.
 * Datenbasis: ORBITRON_PROFILE_DATA (Zahlen aus deinem Chess.com-Archiv). Der Fokus liegt im Browser (localStorage).
 * Die Elo-Angabe ist eine grobe Faustformel: halbierte Niederlagen, die Haelfte davon wird Sieg oder Remis (0,75 Punkte), 1 Prozentpunkt Ergebnis ~ 7 Elo.
 */
(function () {
  'use strict';
  const K = window.OrbitronGameCore; if (!K) return;
  let kit = null;
  function ready(fn) { if (window.OrbitronGame && window.OrbitronGame._kit) { kit = window.OrbitronGame._kit; fn(); } else document.addEventListener('orbitron-game-ready', () => { kit = window.OrbitronGame._kit; fn(); }, { once: true }); }
  const FKEY = 'orbitron_focus_v1';
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const epochDay = (d) => { d = d || new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); };
  const fromEpoch = (e) => { const d = new Date(e * 86400000); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
  const sumKeys = (m, f) => Object.keys(m || {}).filter(f).reduce((a, k) => a + m[k], 0);

  const CAUSES = [
    { id: 'zeit', name: 'Auf Zeit verloren', pick: (L) => L.zeit, set: 'zeit', tag: null, tip: 'Du stehst oft gut und verlierst die Uhr. Der Zeitnot-Trainer übt, einen Vorsprung schnell nach Hause zu bringen; die Zeit-Heatmap zeigt, wo du Zeit verbrennst.' },
    { id: 'grund', name: 'Grundreihenmatt erlitten', pick: (L) => L.matt['Grundreihe'] || 0, set: 'mfig', tag: 'Verhindern: Grundreihe', tip: 'Schaffe Luft (h3 oder g3), bevor Türme auf die Reihe kommen, und prüfe vor jedem Zug die Grundreihe.' },
    { id: 'dame', name: 'Damenmatt erlitten', pick: (L) => sumKeys(L.matt, (k) => /^Dame|^Schäfer/.test(k)), set: 'mfig', tag: 'Verhindern: Damenmatt', tip: 'Prüfe vor jedem Zug, wohin die gegnerische Dame Schach geben kann, besonders auf g2, g7, h2 und h7.' },
    { id: 'turm', name: 'Turm-Matt erlitten', pick: (L) => L.matt['Turm'] || 0, set: 'mfig', tag: 'Verhindern: Turm-Matt', tip: 'Gegnerische Türme auf offenen Linien und der 7. Reihe im Blick behalten.' },
    { id: 'mattx', name: 'Anderes Matt erlitten', pick: (L) => sumKeys(L.matt, (k) => !/^Dame|^Schäfer|^Grundreihe$|^Turm$/.test(k)), set: 'mfig', tag: 'Verhindern: Abzug und Doppelschach', tip: 'Abzugsmatt, Doppelschach, Springer-Matts: Schachs und Abzüge des Gegners vorher durchzählen.' },
    { id: 'aufgabe', name: 'Aufgegeben (meist nach Figurenverlust)', pick: (L) => L.aufgabe, set: 'scan', tag: null, tip: 'Hier ging vorher meist etwas verloren. Der Drohungs-Scanner übt das Hinsehen vor dem Zug (was hängt, was droht).' },
    { id: 'sonst', name: 'Sonstiges (Verlassen, andere)', pick: (L) => (L.verlassen || 0) + (L.sonst || 0), set: null, tag: null, tip: '' }
  ];
  const SET_LABEL = { zeit: 'Zeitnot-Trainer', mfig: 'Matt-Figuren', blunder: 'Fehler-Trainer', scan: 'Drohungs-Scanner' };

  function dataset(period) { const D = window.ORBITRON_PROFILE_DATA; return D ? (period === 'recent' ? D.letzte500 : D.alle) : null; }
  function total(period, tc) {
    const d = dataset(period); if (!d) return null; const o = { games: 0, w: 0, d: 0, l: 0, loss: { zeit: 0, aufgabe: 0, verlassen: 0, sonst: 0, matt: {} } };
    for (const c of (tc === 'all' ? ['bullet', 'blitz', 'rapid'] : [tc])) { const b = d.byClass[c]; if (!b) continue; o.games += b.n; o.w += b.w; o.d += b.d; o.l += b.l; for (const k of ['zeit', 'aufgabe', 'verlassen', 'sonst']) o.loss[k] += b.loss[k] || 0; for (const [k, v] of Object.entries(b.loss.matt || {})) o.loss.matt[k] = (o.loss.matt[k] || 0) + v; }
    return o;
  }
  // Hebel je Ursache: Verluste, Anteil, je 100 Partien und geschaetzter Elo-Gewinn bei halbierter Haeufigkeit
  function levers(period, tc) {
    const t = total(period, tc); if (!t || !t.games) return null;
    const rows = CAUSES.map((c) => { const n = c.pick(t.loss); const per100 = n / t.games * 100; const pp = per100 * 0.5 * 0.75; return { c, n, share: t.l ? n / t.l * 100 : 0, per100, elo: pp * 7 }; });
    rows.sort((a, b) => b.n - a.n); return { t, rows, score: t.games ? (t.w + t.d / 2) / t.games * 100 : 0 };
  }

  // ---------------- Wochenfokus ----------------
  function getFocus() { let f = null; try { f = kit && kit.lsGet(FKEY, null); } catch (e) { f = null; } return f && f.id ? f : null; }
  function setFocus(id) {
    const c = CAUSES.find((x) => x.id === id); if (!c || !c.set) return null; const f = { id, name: c.name, set: c.set, tag: c.tag, start: epochDay(), perDay: 5 };
    try { kit.lsSet(FKEY, f); } catch (e) { /* ohne Speichern weiter */ } return f;
  }
  function clearFocus() { try { kit.lsSet(FKEY, null); } catch (e) { /* egal */ } }
  function daysData() { try { return window.OrbitronDaily && window.OrbitronDaily.days ? window.OrbitronDaily.days() : {}; } catch (e) { return {}; } }
  // Messung: Erfolgsquote im ersten Versuch in dieser Station, diese Woche gegen alle Tage davor
  function focusStats(f) {
    const days = daysData(); const today = epochDay(); let n = 0, ok = 0, bn = 0, bok = 0, active = 0;
    for (const [k, v] of Object.entries(days)) { const m = k.split('-').map(Number); const e = epochDay(new Date(m[0], m[1] - 1, m[2])); const b = v.bySet && v.bySet[f.set]; if (!b) continue; if (e >= f.start) { n += b[0]; ok += b[1]; if (b[0] > 0) active++; } else { bn += b[0]; bok += b[1]; } }
    const day = Math.min(8, today - f.start + 1);
    return { day, n, ok, quota: n ? Math.round(ok / n * 100) : null, bn, bquota: bn ? Math.round(bok / bn * 100) : null, active, goal: f.perDay * 7, done: day > 7 };
  }
  function focusText(f) {
    const s = focusStats(f); const parts = [];
    parts.push(s.done ? 'Wochenfokus abgeschlossen' : `Tag ${s.day} von 7`);
    parts.push(`${s.n} von ${s.goal} Aufgaben`);
    parts.push(s.quota == null ? 'noch keine Quote' : `Erfolgsquote ${s.quota} %` + (s.bquota != null ? ` (davor ${s.bquota} %)` : ''));
    return { s, line: parts.join(' · ') };
  }
  function focusSet() { const f = getFocus(); return f ? f.set : null; }
  function openFocusTrainer(f) { if (f.set === 'scan') { if (window.OrbitronScan) window.OrbitronScan.openScan(); return; } const T = window.OrbitronTrain; if (!T) return; const o = f.set === 'blunder' ? {} : { set: f.set }; if (f.tag) o.tag = f.tag; T.openBlunderTrainer(o); }

  // ---------------- Karte ----------------
  const ATLAS = [
    { name: 'Grundreihenmatt', keys: ['Grundreihe'], wAct: { set: 'mfig', tag: 'Setzen: Grundreihenmatt' }, lAct: { set: 'mfig', tag: 'Verhindern: Grundreihe' } },
    { name: 'Dame + Turm', keys: ['Dame + Turm'], wAct: { set: 'dmatt' }, lAct: { set: 'mfig', tag: 'Verhindern: Damenmatt' } },
    { name: 'Dame + Läufer', keys: ['Dame + Läufer'], wAct: { set: 'dmatt', tag: 'Dame und Läufer auf der Diagonale' }, lAct: { set: 'mfig', tag: 'Verhindern: Damenmatt' } },
    { name: 'Dame + Springer', keys: ['Dame + Springer'], wAct: { set: 'dmatt' }, lAct: { set: 'mfig', tag: 'Verhindern: Damenmatt' } },
    { name: 'Dame + Bauer', keys: ['Dame + Bauer'], wAct: { set: 'dmatt' }, lAct: { set: 'mfig', tag: 'Verhindern: Damenmatt' } },
    { name: 'Dame allein', keys: ['Dame allein'], wAct: { set: 'dmatt' }, lAct: { set: 'mfig', tag: 'Verhindern: Damenmatt' } },
    { name: 'Dame + König', keys: ['Dame + König'], wAct: { set: 'dmatt' }, lAct: { set: 'mfig', tag: 'Verhindern: Damenmatt' } },
    { name: 'Dame + mehrere', keys: ['Dame + mehrere', 'Dame + Dame'], wAct: { set: 'dmatt' }, lAct: { set: 'mfig', tag: 'Verhindern: Damenmatt' } },
    { name: 'Turm-Matt', keys: ['Turm'], wAct: { set: 'mfig', tag: 'Setzen: Turm-Matt' }, lAct: { set: 'mfig', tag: 'Verhindern: Turm-Matt' } },
    { name: 'Abzugsmatt', keys: ['Abzug'], wAct: { set: 'mfig', tag: 'Setzen: Abzugsmatt' }, lAct: { set: 'mfig', tag: 'Verhindern: Abzug und Doppelschach' } },
    { name: 'Doppelschach', keys: ['Doppelschach'], wAct: { set: 'mfig', tag: 'Setzen: Doppelschach-Matt' }, lAct: { set: 'mfig', tag: 'Verhindern: Abzug und Doppelschach' } },
    { name: 'Springer-Matt', keys: ['Springer'], wAct: { set: 'mfig', tag: 'Setzen: Springer-Matt' }, lAct: { set: 'mfig', tag: 'Verhindern: Sonstiges Matt' } },
    { name: 'Läufer-Matt', keys: ['Läufer'], wAct: { set: 'mfig', tag: 'Setzen: Läufer-Matt' }, lAct: { set: 'mfig', tag: 'Verhindern: Sonstiges Matt' } },
    { name: 'Bauernmatt', keys: ['Bauer'], wAct: { set: 'mfig', tag: 'Setzen: Bauernmatt' }, lAct: { set: 'mfig', tag: 'Verhindern: Sonstiges Matt' } },
    { name: 'Ersticktes Matt', keys: ['Erstickt'], wAct: { set: 'mfig', tag: 'Setzen: Ersticktes Matt' }, lAct: { set: 'mfig', tag: 'Verhindern: Sonstiges Matt' } },
    { name: 'Schäfermatt', keys: ['Schäfermatt'], wAct: { set: 'mfig', tag: 'Setzen: Schäfermatt' }, lAct: { set: 'mfig', tag: 'Verhindern: Sonstiges Matt' } }
  ];
  function atlas(period) {
    const d = dataset(period); if (!d) return null;
    return ATLAS.map((r) => { let won = 0, lost = 0; for (const k of r.keys) { const a = d.atlas[k]; if (a) { won += a.won; lost += a.lost; } } const tot = won + lost; const verdict = tot < 5 ? 'selten' : lost >= won * 1.3 ? 'Schwäche' : won >= lost * 1.3 ? 'Stärke' : 'ausgeglichen'; return Object.assign({}, r, { won, lost, verdict }); });
  }

  function openProfile(tab) {
    const card = kit.newCard(); const S = { tab: tab === 'atlas' ? 'atlas' : tab === 'time' ? 'time' : 'lever', tc: 'all', period: 'all' };
    card.innerHTML = `<div class="og-title"><i class="bi bi-graph-up-arrow"></i> Rating-Hebel und Mattbild <span class="og-badge" data-badge></span></div>
      <div class="og-row"><button class="og-btn" data-tab="lever">Rating-Hebel</button><button class="og-btn" data-tab="atlas">Mattbild-Atlas</button><button class="og-btn" data-tab="time">Wann Fehler</button></div>
      <div class="og-row" data-ctl></div><div data-body></div>`;
    const q = (s) => card.querySelector(s);
    const D = window.ORBITRON_PROFILE_DATA;
    function sel(id, label, opts, val) { return `<select class="og-select" data-${id} aria-label="${label}">${opts.map(([v, t]) => `<option value="${v}" ${val === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`; }
    function draw() {
      card.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('primary', b.dataset.tab === S.tab));
      q('[data-ctl]').innerHTML = (S.tab === 'lever' ? sel('tc', 'Zeitklasse', [['all', 'Alle Zeitklassen'], ['bullet', 'Bullet'], ['blitz', 'Blitz'], ['rapid', 'Rapid']], S.tc) : S.tab === 'time' ? sel('tc', 'Zeitklasse', [['all', 'Bullet und Blitz'], ['bullet', 'Bullet'], ['blitz', 'Blitz und Rapid']], S.tc) : '') + (S.tab === 'time' ? '' : sel('period', 'Zeitraum', [['all', 'Alle Partien'], ['recent', 'Letzte 500 Partien']], S.period));
      const t = q('[data-tc]'); if (t) t.onchange = (e) => { S.tc = e.target.value; draw(); }; const pe = q('[data-period]'); if (pe) pe.onchange = (e) => { S.period = e.target.value; draw(); };
      if (!D) { q('[data-body]').innerHTML = '<div class="og-note">Die Profil-Daten konnten nicht geladen werden.</div>'; return; }
      q('[data-badge]').textContent = 'Stand ' + D.generiert;
      q('[data-body]').innerHTML = S.tab === 'lever' ? drawLever() : S.tab === 'time' ? drawTime() : drawAtlas();
      wire();
    }
    function bar(pct, color) { return `<div style="height:8px;border-radius:5px;background:rgba(128,128,128,.22);overflow:hidden;margin:3px 0"><div style="height:100%;width:${Math.max(2, Math.min(100, pct))}%;background:${color}"></div></div>`; }
    function drawLever() {
      const L = levers(S.period, S.tc); if (!L) return '<div class="og-note">Keine Partien in dieser Auswahl.</div>';
      const f = getFocus(); let html = '';
      if (f) { const ft = focusText(f); html += `<div class="og-say" data-focusbox><b>Dein Wochenfokus: ${kit.esc(f.name)}</b><span class="og-sub">${kit.esc(ft.line)}${ft.s.done ? '. Setze einen neuen Fokus oder verlängere.' : ''}</span><div class="og-row"><button class="og-btn primary" data-fpractice>Jetzt üben (${kit.esc(SET_LABEL[f.set] || f.set)})</button><button class="og-btn" data-fclear>Fokus beenden</button></div></div>`; }
      const D0 = window.ORBITRON_PROFILE_DATA; const ext = D0 && D0.__applied ? ` (davon ${D0.__applied} neue aus dem Auto-Coach)` : '';
      html += `<div class="og-note"><b>${L.t.games} Partien</b>${ext} · ${L.t.w} Siege, ${L.t.d} Remis, ${L.t.l} Niederlagen · Punkte ${L.score.toFixed(1).replace('.', ',')} %. Der Hebel zeigt, was dich in den Niederlagen entschieden hat.</div>`;
      const maxN = Math.max(1, ...L.rows.map((r) => r.n)); let rank = 0;
      html += L.rows.map((r) => { const top = !rank && r.c.set && r.n > 0; if (top) rank = 1; return `<div style="padding:6px 0;border-bottom:1px solid var(--border,#e0e4e8)"><div class="og-row" style="margin:0;justify-content:space-between;flex-wrap:nowrap"><div style="min-width:0"><b>${top ? '1. ' : ''}${kit.esc(r.c.name)}</b> <span class="og-note">${r.n} Niederlagen (${r.share.toFixed(0)} % aller) · ${r.per100.toFixed(1).replace('.', ',')} je 100 Partien${r.c.set ? ' · Hebel etwa +' + Math.round(r.elo) + ' Elo' : ''}</span></div></div>${bar(r.n / maxN * 100, top ? '#e53935' : '#1a73e8')}${r.c.tip ? `<div class="og-note">${kit.esc(r.c.tip)}</div>` : ''}${r.c.set && r.n ? `<div class="og-row"><button class="og-btn${top && !f ? ' primary' : ''}" data-focus="${r.c.id}">Als Wochenfokus</button><button class="og-btn" data-open="${r.c.id}">Üben</button></div>` : ''}</div>`; }).join('');
      html += '<div class="og-note">Die Elo-Zahl ist eine grobe Faustformel (Niederlagen halbieren, die Hälfte davon wird Sieg oder Remis). Verlässlicher ist die Reihenfolge der Ursachen.</div>';
      return html;
    }
    // Wann passieren die grossen Patzer (Verlust ab 3 Bauern): nach Zugnummer, aus den Fehler-Aufgaben
    function timeBuckets(tc) {
      const src = tc === 'bullet' ? [window.ORBITRON_BULLET] : tc === 'blitz' ? [window.ORBITRON_BLUNDERS] : [window.ORBITRON_BLUNDERS, window.ORBITRON_BULLET];
      const B = [['Zug 1 bis 10', 1, 10], ['Zug 11 bis 20', 11, 20], ['Zug 21 bis 30', 21, 30], ['Zug 31 bis 40', 31, 40], ['ab Zug 41', 41, 999]].map(([name, a, b]) => ({ name, a, b, n: 0, loss: 0 })); let total = 0;
      for (const arr of src) for (const t of (arr || [])) { if (t[8] === 'Matt verpasst') continue; const m = t[7] || 0; const b = B.find((x) => m >= x.a && m <= x.b); if (b) { b.n++; b.loss += t[5] || 0; total++; } }
      return { B, total };
    }
    function drawTime() {
      const { B, total } = timeBuckets(S.tc === 'all' ? 'all' : S.tc); if (!total) return '<div class="og-note">Keine Fehler-Aufgaben in dieser Auswahl.</div>';
      const maxN = Math.max(...B.map((b) => b.n)); const top = B.slice().sort((a, b) => b.n - a.n)[0]; const early = B[0].n + B[1].n;
      return `<div class="og-note"><b>${total} große Patzer</b> (Verlust ab 3 Bauern, ohne verpasste Matts), aus deinen Fehler-Aufgaben. Gezählt wird, in welchem Zug du den Fehler gemacht hast. Neue Partien aus dem Auto-Coach sind enthalten.</div>` + B.map((b) => `<div style="padding:6px 0;border-bottom:1px solid var(--border,#e0e4e8)"><div class="og-row" style="margin:0;justify-content:space-between;flex-wrap:nowrap"><b>${b.name}</b><span class="og-note">${b.n} (${Math.round(b.n / total * 100)} %) · Ø Verlust ${b.n ? (b.loss / b.n / 100).toFixed(1).replace('.', ',') : '0,0'} Bauern</span></div>${bar(b.n / maxN * 100, b === top ? '#e53935' : '#1a73e8')}</div>`).join('') + `<div class="og-say"><b>Die meisten Patzer fallen in ${top.name.toLowerCase()}</b><span class="og-sub">${Math.round(early / total * 100)} % deiner großen Patzer passieren in den ersten 20 Zügen. ${top.a <= 10 ? 'Dort hilft der Eröffnungs-Prüfer und das Eröffnungs-Labor.' : top.a <= 20 ? 'Das ist die Phase nach der Eröffnung: Drohungs-Scanner und Fehler-Trainer.' : 'Spät im Spiel liegt es oft an Müdigkeit und Zeitnot: Zeitnot-Trainer und Endspiel-Fehler.'}</span></div>`;
    }
    function drawAtlas() {
      const rows = atlas(S.period); if (!rows) return ''; const maxN = Math.max(1, ...rows.map((r) => Math.max(r.won, r.lost)));
      const col = { 'Schwäche': '#e53935', 'Stärke': '#2e9d4f', ausgeglichen: '#f5a623', selten: '#888' };
      return `<div class="og-note">Deine Mattfiguren: wie oft du sie setzt und wie oft du sie erleidest. „Schwäche“ heißt: erlitten mindestens 1,3-mal so oft wie gesetzt (ab 5 Fällen).</div>` + rows.map((r, i) => `<div style="padding:6px 0;border-bottom:1px solid var(--border,#e0e4e8)"><div class="og-row" style="margin:0;justify-content:space-between;flex-wrap:nowrap"><div><b>${kit.esc(r.name)}</b> <span class="og-note">gesetzt ${r.won} · erlitten ${r.lost}</span></div><b style="color:${col[r.verdict]};white-space:nowrap;margin-left:8px">${r.verdict}</b></div>${bar(r.won / maxN * 100, '#2e9d4f')}${bar(r.lost / maxN * 100, '#e53935')}<div class="og-row"><button class="og-btn" data-atlas="${i}:won"${r.won ? '' : ' disabled'}>Setzen üben</button><button class="og-btn${r.verdict === 'Schwäche' ? ' primary' : ''}" data-atlas="${i}:lost"${r.lost ? '' : ' disabled'}>Verhindern üben</button></div></div>`).join('');
    }
    function openTrainer(t) { if (t.set === 'scan') { if (window.OrbitronScan) window.OrbitronScan.openScan(); return; } const T = window.OrbitronTrain; if (!T) return; const o = t.set === 'blunder' ? {} : { set: t.set }; if (t.tag) o.tag = t.tag; T.openBlunderTrainer(o); }
    function wire() {
      card.querySelectorAll('[data-focus]').forEach((b) => b.onclick = () => { setFocus(b.dataset.focus); draw(); });
      card.querySelectorAll('[data-open]').forEach((b) => b.onclick = () => { const c = CAUSES.find((x) => x.id === b.dataset.open); if (c) openTrainer(c); });
      card.querySelectorAll('[data-atlas]').forEach((b) => b.onclick = () => { const [i, k] = b.dataset.atlas.split(':'); openTrainer(ATLAS[+i][k === 'won' ? 'wAct' : 'lAct']); });
      const fp = q('[data-fpractice]'); if (fp) fp.onclick = () => { const f = getFocus(); if (f) openFocusTrainer(f); };
      const fc = q('[data-fclear]'); if (fc) fc.onclick = () => { clearFocus(); draw(); };
    }
    card.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { S.tab = b.dataset.tab; draw(); });
    card.__profile = { S, draw, levers: () => levers(S.period, S.tc), atlas: () => atlas(S.period) };
    kit.addCard(card); draw(); return card;
  }

  function match(t) {
    if (!t) return null; const s = t.toLowerCase();
    if (/^[/](hebel|rating-?hebel|rating|fokus|wochenfokus)\b|^rating-?hebel\b/.test(s)) return { run: () => openProfile('lever') };
    if (/^[/](wann|fehlerprofil|fehlerzeit)|^wann fehler/.test(s)) return { run: () => openProfile('time') };
    if (/^[/](mattbild|atlas|mattatlas)\b|^mattbild-?atlas\b/.test(s)) return { run: () => openProfile('atlas') };
    return null;
  }
  ready(() => { window.OrbitronProfile = { openProfile, levers, atlas, total, getFocus, setFocus, clearFocus, focusStats, focusText, focusSet, openFocusTrainer, match, version: '1.0' }; });
})();
