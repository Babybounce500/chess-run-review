/* Orbitron Labor: Eroeffnungs-Labor und Eroeffnungs-Ampel.
 * Zeigt je Farbe deine Eroeffnungen mit Form der letzten 30 Partien (gruen, gelb, rot), Ergebnis nach Variante, Bewertung nach Zug 10
 * und deine wiederkehrenden Fehlerstellungen (als Uebung im Trainer: Menue "Eroeffnungs-Labor").
 * Neue Partien aus dem Auto-Coach fliessen in Ergebnis und Form ein (Bewertung und Fehlerstellungen stammen vom Datenstand).
 * Hinweis: Als Weiss zeigt der Eroeffnungsname meist die Verteidigung des Gegners ("Sicilian Defense" heisst: du hast gegen Sizilianisch gespielt).
 */
(function () {
  'use strict';
  const K = window.OrbitronGameCore; if (!K) return;
  let kit = null;
  function ready(fn) { if (window.OrbitronGame && window.OrbitronGame._kit) { kit = window.OrbitronGame._kit; fn(); } else document.addEventListener('orbitron-game-ready', () => { kit = window.OrbitronGame._kit; fn(); }, { once: true }); }
  const pct = (w, d, n) => n ? Math.round((w + d / 2) / n * 100) : 0;
  const COL = { green: '#2e9d4f', yellow: '#f5a623', red: '#e53935', grey: '#888' };

  // Ergebnisse je Familie: Datenstand plus neue Partien aus dem Auto-Coach
  function effective() {
    const D = window.ORBITRON_LABOR_DATA; if (!D) return null; let live = []; try { live = window.OrbitronLive ? window.OrbitronLive.load().games : []; } catch (e) { live = []; }
    live = live.filter((g) => g.fam && g.col && g.t > D.lastEnd).sort((a, b) => a.t - b.t);
    return D.fams.map((f) => {
      const add = live.filter((g) => g.col === f.col && g.fam === f.fam); const o = Object.assign({}, f, { rec: f.rec + add.map((g) => g.res).join(''), newN: add.length });
      for (const g of add) { o.n++; o[g.res]++; } return o;
    });
  }
  function form(f) {
    const r = f.rec.slice(-30); const n = r.length; const w = (r.match(/W/g) || []).length, d = (r.match(/D/g) || []).length, l = (r.match(/L/g) || []).length;
    const sc = pct(w, d, n); const color = n < 10 ? 'grey' : sc >= 55 ? 'green' : sc >= 45 ? 'yellow' : 'red';
    return { n, w, d, l, sc, color };
  }
  function openLabor(opts) {
    opts = opts || {}; const card = kit.newCard(); const S = { col: opts.col || 'white', fam: opts.fam || null };
    card.innerHTML = `<div class="og-title"><i class="bi bi-eyedropper"></i> Eröffnungs-Labor <span class="og-badge" data-badge></span></div>
      <div class="og-note og-desc">Je Farbe deine Eröffnungen mit der Form der letzten 30 Partien (Ampel), dem Ergebnis nach Variante, der Bewertung nach Zug 10 und den Fehlern, die sich wiederholen. Als Weiß steht der Name meist für die Verteidigung deines Gegners („Sicilian Defense“ heißt: Du hast gegen Sizilianisch gespielt). Die Bewertung nach Zug 10 und die Fehlerstellungen stammen vom Datenstand, Ergebnis und Form enthalten auch neue Partien aus dem Auto-Coach.</div>
      <div class="og-row"><button class="og-btn" data-col="white">Weiß</button><button class="og-btn" data-col="black">Schwarz</button></div><div data-body></div>`;
    const q = (s) => card.querySelector(s); const D = window.ORBITRON_LABOR_DATA;
    function dot(c) { return `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${COL[c]};vertical-align:middle;margin-right:6px"></span>`; }
    function squares(rec) { return rec.slice(-30).split('').map((c) => `<span title="${c}" style="display:inline-block;width:9px;height:14px;margin-right:2px;border-radius:2px;background:${c === 'W' ? COL.green : c === 'L' ? COL.red : COL.grey}"></span>`).join(''); }
    function draw() {
      card.querySelectorAll('[data-col]').forEach((b) => b.classList.toggle('primary', b.dataset.col === S.col));
      if (!D) { q('[data-body]').innerHTML = '<div class="og-note">Die Labor-Daten konnten nicht geladen werden.</div>'; return; }
      q('[data-badge]').textContent = 'Stand ' + D.generiert; const all = effective();
      if (S.fam) { const f = all.find((x) => x.col === S.col && x.fam === S.fam); if (f) { drawDetail(f); return; } S.fam = null; }
      const list = all.filter((f) => f.col === S.col).sort((a, b) => b.n - a.n);
      q('[data-body]').innerHTML = `<div class="og-note">${list.length} Eröffnungen mit mindestens 8 Partien. Tippe eine an für Details und Übung.</div>` + list.map((f, i) => { const fm = form(f); return `<button class="og-btn" style="display:block;width:100%;text-align:left;margin:4px 0" data-fam="${i}"><b>${dot(fm.color)}${kit.esc(f.fam)}</b> <span class="og-note">${f.n} Partien${f.newN ? ' (' + f.newN + ' neu)' : ''} · insgesamt ${pct(f.W, f.D, f.n)} % · Form ${fm.n >= 10 ? fm.sc + ' % (' + fm.w + '-' + fm.d + '-' + fm.l + ' in ' + fm.n + ')' : 'zu wenig Partien'}${f.e10 && f.e10.n ? ' · nach Zug 10: ' + (f.e10.avg >= 0 ? '+' : '−') + (Math.abs(f.e10.avg) / 100).toFixed(1).replace('.', ',') : ''}</span></button>`; }).join('');
      q('[data-body]').querySelectorAll('[data-fam]').forEach((b) => b.onclick = () => { S.fam = list[+b.dataset.fam].fam; draw(); });
    }
    function drawDetail(f) {
      const fm = form(f); const e = f.e10 || {}; const fmt = (v) => v == null ? '–' : (v >= 0 ? '+' : '−') + (Math.abs(v) / 100).toFixed(1).replace('.', ',');
      const tasks = (window.ORBITRON_LABOR_TASKS || []).filter((t) => t[8] === f.tag).length;
      q('[data-body]').innerHTML = `<div class="og-row"><button class="og-btn" data-back>Zurück zur Liste</button></div>
        <div class="og-say"><b>${dot(fm.color)}${kit.esc(f.fam)} als ${f.col === 'white' ? 'Weiß' : 'Schwarz'}</b><span class="og-sub">${f.n} Partien: ${f.W} Siege, ${f.D} Remis, ${f.L} Niederlagen (${pct(f.W, f.D, f.n)} %). Form der letzten ${fm.n}: ${fm.w} Siege, ${fm.d} Remis, ${fm.l} Niederlagen (${fm.sc} %).${f.newN ? ` Darin ${f.newN} neue Partie(n) aus dem Auto-Coach.` : ''}</span><div style="margin-top:6px">${squares(f.rec)}</div></div>
        ${e.n ? `<div class="og-note"><b>Bewertung nach Zug 10</b> (aus deiner Sicht, ${e.n} Partien analysiert): im Mittel ${fmt(e.avg)}. Nach Ergebnis: Siege ${fmt(e.W)}, Remis ${fmt(e.D)}, Niederlagen ${fmt(e.L)}. ${e.good} Partien mit mehr als +1,5, ${e.bad} mit weniger als −1,5. ${e.L != null && e.L > -100 ? 'Du verlierst diese Partien also meist erst später, im Mittelspiel, nicht in der Eröffnung.' : ''}</div>` : '<div class="og-note">Für diese Eröffnung gibt es noch keine Engine-Analyse (zu wenige Partien).</div>'}
        <div class="og-note"><b>Varianten</b></div>${f.variants.map((v) => `<div class="og-row" style="margin:2px 0;justify-content:space-between;flex-wrap:nowrap"><span>${kit.esc(v.name)}</span><span class="og-note">${v.n} · ${v.W}-${v.D}-${v.L} · ${pct(v.W, v.D, v.n)} %</span></div>`).join('')}
        <div class="og-row"><button class="og-btn primary" data-practice ${tasks ? '' : 'disabled'}>Meine Fehlerstellungen üben (${tasks})</button></div>
        ${f.analyzed ? `<div class="og-note">${f.errs} der ${f.analyzed} analysierten Partien haben einen eigenen Fehler ab 1,5 Bauern in den ersten 15 Zügen. Aufgaben entstehen aus Fehlern, die sich wiederholen (ab 2-mal) oder sehr groß sind (ab 3 Bauern).</div>` : ''}`;
      q('[data-back]').onclick = () => { S.fam = null; draw(); };
      const pb = q('[data-practice]'); if (pb) pb.onclick = () => { const T = window.OrbitronTrain; if (T) T.openBlunderTrainer({ set: 'labor', tag: f.tag }); };
    }
    card.querySelectorAll('[data-col]').forEach((b) => b.onclick = () => { S.col = b.dataset.col; S.fam = null; draw(); });
    card.__labor = { S, draw, list: () => effective(), form };
    kit.addCard(card); draw(); return card;
  }
  function match(t) {
    if (!t) return null; const s = t.toLowerCase();
    if (/^[/](labor|eroeffnungs-?labor|eröffnungs-?labor|ampel|eroeffnungen|eröffnungen)\b|^er[oö]ffnungs-?(labor|ampel)\b/.test(s)) return { run: () => openLabor() };
    return null;
  }
  ready(() => { window.OrbitronLabor = { openLabor, effective, form, match, version: '1.0' }; });
})();
