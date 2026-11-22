/* Orbitron Time: Zeit-Heatmap. Zeigt Zug fuer Zug, wo du die Uhr verbrennst (Bullet 1+0 und Blitz 5+0 getrennt).
 * Daten: orbitron-timeheat.js (aus den [%clk]-Angaben deiner Chess.com-Partien). Gezeichnet wird mit Canvas, keine Bibliothek.
 */
(function () {
  'use strict';
  const K = window.OrbitronGameCore; if (!K) return;
  let kit = null;
  function ready(fn) { if (window.OrbitronGame && window.OrbitronGame._kit) { kit = window.OrbitronGame._kit; fn(); } else document.addEventListener('orbitron-game-ready', () => { kit = window.OrbitronGame._kit; fn(); }, { once: true }); }
  const NAME = { bullet: 'Bullet 1+0', blitz: 'Blitz 5+0' };
  const fmt = (x, d) => (+x).toFixed(d == null ? 1 : d).replace('.', ',');
  const lerp = (a, b, t) => a + (b - a) * t;
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  function ramp(stops, t) { t = Math.max(0, Math.min(1, t)); const n = stops.length - 1, i = Math.min(n - 1, Math.floor(t * n)), f = t * n - i; const a = hex(stops[i]), b = hex(stops[i + 1]); return `rgb(${Math.round(lerp(a[0], b[0], f))},${Math.round(lerp(a[1], b[1], f))},${Math.round(lerp(a[2], b[2], f))})`; }
  const THINK = ['#fbf5df', '#fdd49e', '#fc8d59', '#d7301f', '#7f0000'];
  const REST_OK = ['#fee08b', '#a6d96a', '#1a9850'];
  const RES_COL = { W: '#2e9d4f', L: '#e53935', D: '#888888' };
  const HOW = { timeout: 'Zeit', checkmated: 'Matt', resigned: 'Aufgabe', abandoned: 'Verlassen', repetition: 'Wiederholung', stalemate: 'Patt', agreed: 'Einigung', insufficient: 'zu wenig Material', timevsinsufficient: 'Zeit gegen zu wenig Material', '50move': '50 Züge' };

  function openHeat() {
    const D = window.ORBITRON_TIMEHEAT; const card = kit.newCard();
    if (!D) { card.innerHTML = '<div class="og-title"><i class="bi bi-clock-history"></i> Zeit-Heatmap</div><div class="og-note">Die Zeitdaten konnten nicht geladen werden.</div>'; kit.addCard(card); return card; }
    const S = { cls: D.bullet ? 'bullet' : 'blitz', mode: 'think', scope: 'all', rows: 60, sel: null };
    card.innerHTML = `<div class="og-title"><i class="bi bi-clock-history"></i> Zeit-Heatmap <span class="og-badge" data-badge></span></div>
      <div class="og-note og-desc">Jede Zeile ist eine deiner Partien (neueste oben), jede Spalte ein eigener Zug. <b>Zeit pro Zug</b>: je dunkler, desto länger hast du gedacht. <b>Restzeit</b>: grün viel Zeit, rot unter 15 Sekunden. Der Balken links zeigt das Ergebnis (grün Sieg, rot Niederlage, grau Remis). Tippe auf eine Zeile für die Einzelansicht.</div>
      <div class="og-row" data-ctl></div>
      <div class="og-say" data-ins></div>
      <div data-heatwrap style="width:100%"><canvas data-heat style="width:100%;display:block;border-radius:8px"></canvas></div>
      <div class="og-note" data-tip style="min-height:20px"></div>
      <div data-detail style="display:none"></div>
      <div class="og-title" style="font-size:15px;margin-top:10px">Durchschnitt pro Zugnummer</div>
      <div class="og-note" data-aggnote></div>
      <canvas data-agg style="width:100%;display:block"></canvas>
      <div data-tables></div>`;
    const q = (s) => card.querySelector(s);
    const cssColor = () => { const c = getComputedStyle(card).color; return c || '#444'; };
    const cur = () => D[S.cls];
    function drawCtl() {
      q('[data-ctl]').innerHTML = [['bullet', NAME.bullet], ['blitz', NAME.blitz]].filter(([k]) => D[k]).map(([k, t]) => `<button class="og-btn ${S.cls === k ? 'on' : ''}" data-cls="${k}">${t} (${D[k].all.n})</button>`).join('') + '<span style="width:8px"></span>'
        + [['think', 'Zeit pro Zug'], ['rest', 'Restzeit']].map(([k, t]) => `<button class="og-btn ${S.mode === k ? 'on' : ''}" data-mode="${k}">${t}</button>`).join('') + '<span style="width:8px"></span>'
        + [['all', 'Durchschnitt: alle Partien'], ['recent', 'Durchschnitt: letzte 100']].map(([k, t]) => `<button class="og-btn ${S.scope === k ? 'on' : ''}" data-scope="${k}">${t}</button>`).join('') + '<span style="width:8px"></span>'
        + `<select class="og-select" data-nrows aria-label="Anzahl Partien">${[30, 60, 100, 150].map((n) => `<option value="${n}" ${S.rows === n ? 'selected' : ''}>Letzte ${n} Partien</option>`).join('')}</select>`;
      q('[data-ctl]').querySelectorAll('[data-cls]').forEach((b) => b.onclick = () => { S.cls = b.dataset.cls; S.sel = null; render(); });
      q('[data-ctl]').querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => { S.mode = b.dataset.mode; render(); });
      q('[data-ctl]').querySelectorAll('[data-scope]').forEach((b) => b.onclick = () => { S.scope = b.dataset.scope; render(); });
      q('[data-nrows]').onchange = (e) => { S.rows = +e.target.value; S.sel = null; render(); };
    }
    // ----- Heatmap -----
    let geo = null;
    function drawHeat() {
      const cv = q('[data-heat]'), c = cur(), base = c.base; const rows = c.rows.slice(0, S.rows); const cols = S.cls === 'bullet' ? 50 : 60;
      const W = Math.max(280, q('[data-heatwrap]').clientWidth || 600); const left = 14, top = 18, axisH = 16, rh = W < 480 ? 6 : 8; const cw = (W - left) / cols; const H = top + rows.length * rh + axisH;
      const dpr = window.devicePixelRatio || 1; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px';
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(128,128,128,.10)'; g.fillRect(0, 0, W, H);
      g.font = '10px sans-serif'; g.fillStyle = cssColor(); g.textBaseline = 'top';
      for (let k = 0; k < cols; k++) if (k === 0 || (k + 1) % 5 === 0) g.fillText(String(k + 1), left + k * cw + (k === 0 ? 0 : -2), 3);
      rows.forEach((r, ri) => {
        const y = top + ri * rh; g.fillStyle = RES_COL[r[2]]; g.fillRect(0, y, 10, rh - 1);
        let cum = 0; const spent = r[5];
        for (let k = 0; k < cols; k++) {
          if (k >= spent.length) break; const s = spent[k] / 10; cum += s; const rem = base - cum;
          g.fillStyle = S.mode === 'think' ? ramp(THINK, Math.sqrt(Math.min(1, s / (base * 0.1)))) : (rem < 5 ? '#7f0000' : rem < 15 ? '#d73027' : ramp(REST_OK, (rem - 15) / (base - 15)));
          g.fillRect(left + k * cw, y, Math.max(1, cw - 0.6), rh - 1);
        }
        if (S.sel === ri) { g.strokeStyle = cssColor(); g.lineWidth = 1.5; g.strokeRect(0.5, y - 0.5, W - 1, rh); }
      });
      geo = { left, top, cw, rh, cols, n: rows.length, W };
      const kind = S.mode === 'think' ? 'Zeit pro Zug (Wurzel-Skala bis ' + (base * 0.1) + ' s)' : 'Restzeit (rot: unter 15 s)'; q('[data-badge]').textContent = `${NAME[S.cls]} · ${rows.length} Partien`; g.fillStyle = cssColor(); g.fillText(kind, W - g.measureText(kind).width - 4, H - 13);
      q('[data-heat]').__rows = rows;
    }
    function locate(ev) { const rect = q('[data-heat]').getBoundingClientRect(); const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left, y = (ev.touches ? ev.touches[0].clientY : ev.clientY) - rect.top; if (!geo) return null; const ri = Math.floor((y - geo.top) / geo.rh), k = Math.floor((x - geo.left) / geo.cw); if (ri < 0 || ri >= geo.n) return null; return { ri, k }; }
    function tip(p) {
      const t = q('[data-tip]'); if (!p) { t.textContent = ''; return; } const r = cur().rows[p.ri]; const base = cur().base; const spent = r[5];
      let cum = 0; for (let i = 0; i <= Math.min(p.k, spent.length - 1); i++) cum += spent[i] / 10;
      const d = new Date(r[1] * 1000); const when = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      t.textContent = p.k >= 0 && p.k < spent.length ? `${when} · ${r[4] === 'w' ? 'Weiß' : 'Schwarz'} · ${r[2] === 'W' ? 'Sieg' : r[2] === 'L' ? 'Niederlage' : 'Remis'} (${HOW[r[3]] || r[3]}) · Zug ${p.k + 1}: ${fmt(spent[p.k] / 10)} s gedacht, Restzeit ${fmt(Math.max(0, base - cum))} s` : `${when} · ${r[4] === 'w' ? 'Weiß' : 'Schwarz'} · ${r[2] === 'W' ? 'Sieg' : r[2] === 'L' ? 'Niederlage' : 'Remis'} (${HOW[r[3]] || r[3]}) · ${spent.length} Züge`;
    }
    // ----- Einzelansicht -----
    function drawDetail() {
      const box = q('[data-detail]'); if (S.sel == null) { box.style.display = 'none'; return; }
      const c = cur(), r = c.rows[S.sel], base = c.base; const spent = r[5].map((x) => x / 10); let cum = 0; const rem = spent.map((s) => { cum += s; return base - cum; });
      const first = rem.findIndex((x) => x < 15); const longest = r[6];
      box.style.display = ''; box.innerHTML = `<div class="og-say"><b>Einzelansicht: ${r[2] === 'W' ? 'Sieg' : r[2] === 'L' ? 'Niederlage' : 'Remis'} (${kit.esc(HOW[r[3]] || r[3])}) mit ${r[4] === 'w' ? 'Weiß' : 'Schwarz'}, ${spent.length} Züge</b><span class="og-sub">${first >= 0 ? 'Unter 15 Sekunden ab Zug ' + (first + 1) + '. ' : 'Du bist nie unter 15 Sekunden gefallen. '}Längste Denkpausen: ${longest.map((t) => `Zug ${t[0]}${t[1] ? ' ' + kit.esc(t[1]) : ''} (${fmt(t[2])} s)`).join(', ')}. Restzeit am Ende: ${fmt(Math.max(0, rem[rem.length - 1]))} s.</span></div>
        <canvas data-line style="width:100%;height:120px;display:block"></canvas>
        <div class="og-row"><a class="og-btn" href="https://www.chess.com/game/live/${kit.esc(r[0])}" target="_blank" rel="noopener">Partie auf Chess.com öffnen</a><button class="og-btn" data-close>Schließen</button></div>`;
      const cv = box.querySelector('[data-line]'); const W = Math.max(280, box.clientWidth || 600), H = 120; const dpr = window.devicePixelRatio || 1; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const px = (k) => 26 + k / Math.max(1, rem.length - 1) * (W - 34), py = (v) => 8 + (1 - Math.max(0, v) / base) * (H - 24);
      g.fillStyle = 'rgba(215,48,39,.15)'; g.fillRect(26, py(15), W - 34, H - 16 - py(15)); g.strokeStyle = '#d73027'; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(26, py(15)); g.lineTo(W - 8, py(15)); g.stroke(); g.setLineDash([]);
      g.strokeStyle = RES_COL[r[2]]; g.lineWidth = 2; g.beginPath(); rem.forEach((v, k) => { const x = px(k), y = py(v); if (k === 0) g.moveTo(x, y); else g.lineTo(x, y); }); g.stroke();
      g.fillStyle = cssColor(); g.font = '10px sans-serif'; g.fillText(String(base) + ' s', 0, 6); g.fillText('0', 12, H - 14); g.fillText('15 s', 0, py(15) - 6); g.fillText('Zug 1', 26, H - 12); g.fillText('Zug ' + rem.length, W - 40, H - 12);
      box.querySelector('[data-close]').onclick = () => { S.sel = null; render(); };
    }
    // ----- Durchschnitt -----
    function drawAgg() {
      const c = cur(), A = c[S.scope], cv = q('[data-agg]'); const cols = S.cls === 'bullet' ? 50 : 60; const W = Math.max(280, q('[data-heatwrap]').clientWidth || 600), H = 150; const dpr = window.devicePixelRatio || 1; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px';
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); const left = 28, bw = (W - left - 4) / cols; const maxSp = Math.max(1, ...A.sp.slice(0, cols));
      g.fillStyle = 'rgba(128,128,128,.10)'; g.fillRect(left, 6, W - left - 4, H - 28);
      for (let k = 0; k < cols; k++) { if (!A.reach[k] || A.reach[k] < 5) continue; const h = A.sp[k] / maxSp * (H - 32); g.fillStyle = ramp(THINK, Math.min(1, A.sp[k] / maxSp)); g.fillRect(left + k * bw, H - 22 - h, Math.max(1, bw - 1), h); }
      g.strokeStyle = '#d73027'; g.lineWidth = 2; g.beginPath(); let first = true; for (let k = 0; k < cols; k++) { if (!A.reach[k] || A.reach[k] < 5) continue; const x = left + k * bw + bw / 2, y = 6 + (1 - A.u15[k] / 100) * (H - 28); if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y); } g.stroke();
      g.fillStyle = cssColor(); g.font = '10px sans-serif'; for (let k = 0; k < cols; k++) if (k === 0 || (k + 1) % 5 === 0) g.fillText(String(k + 1), left + k * bw - 2, H - 12); g.fillText('100 %', 0, 8); g.fillText('0', 12, H - 22);
      q('[data-aggnote]').innerHTML = `Balken: durchschnittliche Zeit pro Zug in % deiner Gesamtzeit (größter Balken: ${fmt(maxSp)} %). <span style="color:#d73027"><b>Rote Linie</b></span>: Anteil der Partien, in denen du bei diesem Zug unter 15 Sekunden hast.`;
    }
    function insights() {
      const c = cur(), A = c[S.scope], R = c.recent, L = c.all; const ph = A.phase, names = ['Zug 1 bis 10', 'Zug 11 bis 20', 'Zug 21 bis 30', 'ab Zug 31']; const mx = ph.indexOf(Math.max(...ph));
      const kmax = A.sp.indexOf(Math.max(...A.sp.slice(0, 50)));
      const lines = [
        `Du fällst in <span style="font-weight:700">${A.zeitnot} %</span> deiner ${NAME[S.cls]}-Partien unter 15 Sekunden${A.t15med ? ', im Median ab <span style="font-weight:700">Zug ' + A.t15med + '</span>' : ''}.`,
        `Zeitverbrauch: ${names.map((n, i) => `${n}: ${fmt(ph[i], 0)} %`).join(' · ')}. Die meiste Zeit gibst du in <span style="font-weight:700">${names[mx]}</span> aus. Am längsten denkst du bei Zug ${kmax + 1} (Ø ${fmt(A.sp[kmax])} % deiner Gesamtzeit).`,
        `<span style="font-weight:700">${A.lostTime} von ${A.losses}</span> Niederlagen (${A.losses ? Math.round(A.lostTime / A.losses * 100) : 0} %) kamen durch die Uhr; ${A.wonTime} von ${A.wins} Siegen hast du auf Zeit gewonnen.`,
        `Punkte je nach Zeitverlauf: nie unter 15 s ${A.grp.nie[1] ? Math.round(A.grp.nie[0] / A.grp.nie[1] * 100) + ' %' : '-'} (${A.grp.nie[1]} Partien) · erst nach Zug 28 ${A.grp.spaet[1] ? Math.round(A.grp.spaet[0] / A.grp.spaet[1] * 100) + ' %' : '-'} (${A.grp.spaet[1]}) · schon vor Zug 28 ${A.grp.frueh[1] ? Math.round(A.grp.frueh[0] / A.grp.frueh[1] * 100) + ' %' : '-'} (${A.grp.frueh[1]}).`
      ];
      if (S.scope === 'all') lines.push(`Letzte 100 Partien: Zeitnot in ${R.zeitnot} % (alle: ${L.zeitnot} %), Median ab Zug ${R.t15med == null ? '-' : R.t15med}.`);
      q('[data-ins]').innerHTML = `<b>Auswertung ${NAME[S.cls]}</b><span class="og-sub">${lines.join('<br>')}</span>`;
    }
    function render() { drawCtl(); insights(); drawHeat(); drawDetail(); drawAgg(); }
    const cv = q('[data-heat]');
    cv.addEventListener('mousemove', (e) => tip(locate(e)));
    cv.addEventListener('click', (e) => { const p = locate(e); if (p) { S.sel = p.ri; tip(p); drawHeat(); drawDetail(); const d = q('[data-detail]'); if (d.scrollIntoView) d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } });
    cv.addEventListener('touchstart', (e) => tip(locate(e)), { passive: true });
    window.addEventListener('resize', () => { if (card.isConnected) { drawHeat(); drawAgg(); } });
    card.__time = { state: S, render, pick: (ri) => { S.sel = ri; drawHeat(); drawDetail(); }, geo: () => geo };
    kit.addCard(card); render(); setTimeout(() => { if (card.isConnected) render(); }, 150); return card;
  }

  function match(t) {
    if (!t) return null; const s = t.toLowerCase();
    if (/^[/]zeit\b|^[/]heatmap\b|^[/]uhr\b|^zeit-?heatmap\b/.test(s)) return { run: openHeat };
    return null;
  }
  ready(() => { window.OrbitronTime = { openHeat, match, version: '1.0' }; });
})();
