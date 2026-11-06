/* Orbitron Game: Spielbare Brett-Karten im Chat (Partie vs Stockfish / Gemini), Patzer-Check, Mattjaeger.
 * Abhaengigkeiten: chess.js 0.10.x (window.Chess), orbitron-game-core.js, Chat-Seite gemini-chat.html.
 * chess.js entscheidet immer ueber die Legalitaet. Engine und Gemini liefern nur Zugvorschlaege.
 */
(function () {
  'use strict';
  const K = window.OrbitronGameCore, C = window.Chess;
  if (!K || !C) { console.warn('Orbitron Game: Core oder chess.js fehlt'); return; }

  const SF_URL = 'https://cdn.jsdelivr.net/npm/stockfish.js@10/stockfish.js';
  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const SAVE_KEY = 'orbitron_game_v1';
  const STATS_KEY = 'orbitron_mate_stats_v1';
  const FILES = 'abcdefgh';

  // ---------- Stil ----------
  const css = `
.og-card{container-type:inline-size;border:1px solid var(--border,#e0e4e8);border-radius:16px;background:var(--card-bg,#fff);padding:12px;max-width:860px;width:100%;box-shadow:var(--shadow-sm,none);font-family:inherit}
.og-title{font-weight:700;font-size:1rem;display:flex;align-items:center;gap:8px;margin-bottom:8px}
.og-badge{font-size:.68rem;font-weight:600;padding:2px 8px;border-radius:999px;background:var(--active-bg,#d3e3fd);color:var(--active-text,#0842a0)}
.og-row{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;align-items:center}
.og-row label{font-size:.78rem;color:var(--text-muted,#5e5e5e);margin-right:4px}
.og-btn{border:1px solid var(--border,#e0e4e8);background:var(--hover-bg,#eef3fe);color:var(--text,#1f1f1f);border-radius:10px;padding:7px 11px;font:inherit;font-size:.8rem;cursor:pointer}
.og-btn:hover:not(:disabled){border-color:var(--accent,#1a73e8)}
.og-btn:disabled{opacity:.45;cursor:default}
.og-btn.on{background:var(--accent,#1a73e8);color:#fff;border-color:transparent}
.og-btn.primary{background:var(--accent,#1a73e8);color:#fff;border-color:transparent;font-weight:600}
.og-select{border:1px solid var(--border,#e0e4e8);background:var(--input-bg,#f0f4f9);color:var(--text,#1f1f1f);border-radius:10px;padding:7px 9px;font:inherit;font-size:.8rem}
.og-note{font-size:.76rem;color:var(--text-muted,#5e5e5e);line-height:1.4}
.og-status{font-size:.85rem;font-weight:600;margin:6px 0}
.og-play{display:grid;grid-template-columns:min(500px,max(260px,calc(100dvh - 345px))) minmax(0,1fr);gap:14px;align-items:start}
.og-left,.og-right{min-width:0}
.og-right .og-status{margin-top:0}
@container (max-width:560px){.og-play{grid-template-columns:minmax(0,1fr)}.og-left{width:100%;max-width:max(240px,calc(100dvh - 300px));margin:0 auto}}
.analysis-context.collapsed{padding:6px 14px!important;margin-bottom:8px!important}.analysis-context.collapsed .analysis-context-status{display:none}
.og-board{position:relative;display:grid;grid-template-columns:repeat(8,1fr);aspect-ratio:1/1;width:100%;max-width:100%;border-radius:8px;overflow:hidden;user-select:none;touch-action:none;margin:0 auto}
.og-sq{position:relative;display:flex;align-items:center;justify-content:center;container-type:size;cursor:default}
.og-sq.l{background:#f0d9b5}.og-sq.d{background:#b58863}
.og-sq.last::before{content:"";position:absolute;inset:0;background:rgba(255,215,0,.38)}
.og-sq.sel::before{content:"";position:absolute;inset:0;background:rgba(20,130,255,.45)}
.og-sq.chk::before{content:"";position:absolute;inset:0;background:radial-gradient(circle,rgba(255,0,0,.75),rgba(255,0,0,0) 72%)}
.og-sq.og-bad::after{content:"";position:absolute;inset:2px;border:3px solid #e53935;border-radius:6px}
.og-sq.og-good::after{content:"";position:absolute;inset:2px;border:3px solid #2e9d4f;border-radius:6px}
.og-sq.og-hint::after{content:"";position:absolute;inset:2px;border:3px dashed #8e24aa;border-radius:6px}
.og-sq.tgt::after{content:"";position:absolute;width:30%;height:30%;border-radius:50%;background:rgba(20,20,20,.28)}
.og-sq.tgt.cap::after{width:84%;height:84%;background:transparent;border:5px solid rgba(20,20,20,.28)}
.og-sq .og-coord{position:absolute;font-size:9px;line-height:1;opacity:.6;color:#000;pointer-events:none}
.og-sq .og-coord.f{right:2px;bottom:2px}.og-sq .og-coord.r{left:2px;top:2px}
.og-piece.img{width:92%;height:92%;font-size:0;display:flex;align-items:center;justify-content:center}
.og-piece.img img{width:100%;height:100%;pointer-events:none;-webkit-user-drag:none;filter:drop-shadow(0 1.5px 1.2px rgba(0,0,0,.38))}
.og-piece{position:relative;z-index:2;font-size:78cqmin;line-height:1;display:block;text-align:center;font-family:"Segoe UI Symbol","Noto Sans Symbols 2","Apple Symbols",sans-serif}
.og-piece.w{color:#fff;-webkit-text-stroke:1.3px #222;text-shadow:0 1px 2px rgba(0,0,0,.35)}
.og-piece.b{color:#161616;-webkit-text-stroke:.6px #000}
.og-ghost{position:fixed;z-index:99999;pointer-events:none;transform:translate(-50%,-50%);line-height:1}
.og-promo{position:absolute;inset:0;z-index:5;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;gap:8px}
.og-promo button{width:64px;height:64px;font-size:44px;border-radius:12px;border:2px solid #fff;background:#f0d9b5;cursor:pointer}
.og-say{margin:10px 0 4px;padding:9px 11px;border-left:3px solid var(--accent,#1a73e8);background:var(--hover-bg,#eef3fe);border-radius:8px;font-size:.84rem;line-height:1.45}
.og-say b{display:block}
.og-say .og-sub{display:block;color:var(--text-muted,#5e5e5e);margin-top:2px}
.og-moves{font-size:.74rem;color:var(--text-muted,#5e5e5e);margin-top:6px;word-break:break-word}
.og-panel{margin-top:8px;padding:8px 10px;border:1px dashed var(--border,#e0e4e8);border-radius:10px;font-size:.8rem}
.og-panel li{margin:2px 0}
.og-input{width:100%;box-sizing:border-box;border:1px solid var(--border,#e0e4e8);background:var(--input-bg,#f0f4f9);color:var(--text,#1f1f1f);border-radius:10px;padding:8px 10px;font:inherit;font-size:.8rem}
.og-win{color:#2e9d4f}.og-lose{color:#e53935}
/* ---- Mobil und Touch ---- */
.og-card{-webkit-text-size-adjust:100%;text-size-adjust:100%}
.og-btn,.og-select,.og-promo button{touch-action:manipulation}
@media(max-width:600px){
 .og-card{padding:8px;border-radius:12px}
 .og-title{font-size:.9rem;flex-wrap:wrap;gap:6px}
 .og-btn{padding:8px 10px;font-size:.8rem;min-height:38px}
 .og-row{gap:5px}
 .og-board{border-radius:6px}
 .og-sq .og-coord{font-size:8px}
 .og-say{font-size:.82rem;padding:8px 9px}
 .og-moves{font-size:.7rem;max-height:3.6em;overflow:auto}
 .og-promo button{width:54px;height:54px}
 .og-panel{font-size:.78rem}
}
@media(max-width:380px){
 .og-card{padding:6px}
 .og-btn{padding:7px 8px;font-size:.76rem}
 .og-row .og-btn{flex:1 1 calc(50% - 5px)}
 .og-title .og-badge{font-size:.62rem}
}
@media(hover:none) and (pointer:coarse){
 .og-btn{min-height:44px}
 .og-select{min-height:44px}
 .og-sq.tgt::after{width:34%;height:34%}
 .og-input{font-size:16px}
}
@media(orientation:landscape) and (max-height:520px){
 .og-card{padding:6px}
 .og-title{margin-bottom:4px}
 .og-title{display:none}
 .og-play{grid-template-columns:min(max(170px,calc(100dvh - 215px)),52%) minmax(0,1fr)}
 .og-left{max-width:none!important}
 .og-say{margin:6px 0 2px}
}
@media(max-width:700px),(max-height:560px){body.og-active .analysis-context{display:none!important}}
@supports(padding:max(0px)){.og-card{padding-bottom:max(12px,env(safe-area-inset-bottom))}}
`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // ---------- Hilfen ----------
  const $ = (id) => document.getElementById(id);
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* privater Modus */ } }
  function parseFen(fen) {
    const map = {}; const rows = fen.split(' ')[0].split('/');
    rows.forEach((row, r) => { let f = 0; for (const ch of row) { if (/\d/.test(ch)) f += +ch; else { map[FILES[f] + (8 - r)] = { type: ch.toLowerCase(), color: ch === ch.toUpperCase() ? 'w' : 'b' }; f++; } } });
    return map;
  }
  const PIECE_URL = 'https://chessboardjs.com/img/chesspieces/wikipedia/{p}.png';
  // Bildsatz wie in den uebrigen Seiten. Faellt das Bild aus (offline), springt das Unicode-Zeichen ein.
  function pieceSpan(p, extra) {
    const code = p.color + p.type.toUpperCase(); const glyph = GLYPH[p.type] + '︎';
    return `<span class="og-piece img ${p.color}"${extra ? ' style="' + extra + '"' : ''}><img alt="${glyph}" draggable="false" src="${PIECE_URL.replace('{p}', code)}" onerror="this.parentNode.classList.remove('img');this.parentNode.textContent=this.alt"></span>`;
  }

  function addCard(node) {
    const stream = $('chatStream');
    const home = $('homeView'); if (home) home.style.display = 'none';
    try { if (window.__orbitronBridge) window.__orbitronBridge.ensureConvo(); } catch (e) { /* ignorieren */ }
    const row = el('div', 'msg assistant', '<div class="msg-avatar"><i class="bi bi-stars"></i></div><div class="msg-bubble"></div>');
    row.querySelector('.msg-bubble').appendChild(node);
    stream.appendChild(row);
    try { const ap = $('analysisContext'); if (ap && !ap.classList.contains('collapsed') && window.toggleAnalysisContext) window.toggleAnalysisContext(); } catch (e) { /* ignorieren */ }
    try { requestAnimationFrame(() => row.scrollIntoView({ block: 'start', behavior: 'smooth' })); } catch (e) { /* ignorieren */ }
    try { if (typeof closeSidebar === 'function') closeSidebar(); } catch (e) { /* ignorieren */ }
    return row;
  }
  function pushHistory(text) {
    try { if (window.__orbitronBridge) window.__orbitronBridge.pushHistory('assistant', text); } catch (e) { /* ignorieren */ }
  }

  // ---------- Engine ----------
  const Engine = {
    worker: null, bootP: null, failed: false, chain: Promise.resolve(),
    boot() {
      if (this.bootP) return this.bootP;
      this.bootP = (async () => {
        try {
          const r = await fetch(SF_URL); if (!r.ok) throw new Error('CDN ' + r.status);
          const code = await r.text();
          const w = new Worker(URL.createObjectURL(new Blob([code], { type: 'application/javascript' })));
          await new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error('uciok Timeout')), 8000);
            w.onmessage = (e) => { if (typeof e.data === 'string' && e.data.includes('uciok')) { clearTimeout(t); resolve(); } };
            w.onerror = (e) => { clearTimeout(t); reject(e); };
            w.postMessage('uci');
          });
          w.postMessage('isready');
          this.worker = w; return true;
        } catch (e) { this.failed = true; this.err = String(e && e.message || e); return false; }
      })();
      return this.bootP;
    },
    async available() { return !!(await this.boot()); },
    search(fen, o) {
      const run = async () => {
        if (!(await this.boot())) return null;
        const w = this.worker; const movetime = o.movetime || 300;
        return new Promise((resolve) => {
          let last = { cp: null, mate: null };
          const hard = setTimeout(() => { try { w.postMessage('stop'); } catch (e) { /* ignorieren */ } setTimeout(() => resolve(null), 3000); }, movetime + 6000);
          w.onmessage = (e) => {
            const s = typeof e.data === 'string' ? e.data : '';
            if (s.startsWith('info') && s.includes(' score ')) {
              const m = s.match(/score (cp|mate) (-?\d+)/);
              if (m) last = m[1] === 'cp' ? { cp: +m[2], mate: null } : { cp: null, mate: +m[2] };
            }
            if (s.startsWith('bestmove')) { clearTimeout(hard); const u = s.split(' ')[1]; resolve({ uci: u && u !== '(none)' ? u : null, cp: last.cp, mate: last.mate }); }
          };
          w.postMessage('setoption name Skill Level value ' + (o.skill == null ? 20 : o.skill));
          w.postMessage('position fen ' + fen);
          w.postMessage('go movetime ' + movetime);
        });
      };
      this.chain = this.chain.catch(() => { }).then(run);
      return this.chain;
    }
  };

  function fallbackMove(chess, easy) {
    const ms = chess.moves({ verbose: true });
    const score = (m) => (/#/.test(m.san) ? 1000 : 0) + (m.captured ? 10 * K.VAL[m.captured] - (easy ? 0 : K.VAL[m.piece]) : 0) + (/\+/.test(m.san) ? 3 : 0) + Math.random() * (easy ? 12 : 4);
    ms.sort((a, b) => score(b) - score(a));
    const m = ms[0]; return { uci: m.from + m.to + (m.promotion || ''), cp: null, mate: null, fallback: true };
  }

  async function askGemini(prompt, opts) {
    opts = opts || {};
    const api = window.API;
    if (!api || !api.geminiInteraction) throw new Error('Gemini-Schnittstelle nicht verfügbar');
    const model = (window.__orbitronBridge && window.__orbitronBridge.model()) || 'gemini-3.1-flash-lite';
    const p = api.geminiInteraction({
      model, input: [{ type: 'user_input', content: [{ type: 'text', text: prompt }] }],
      systemInstruction: opts.system || 'Du bist Deep Orbitron, ein Schachpartner. Antworte kurz und auf Deutsch.',
      generationConfig: { max_output_tokens: opts.tokens || 300 }
    });
    return Promise.race([p.then(r => (r && r.text) || ''), new Promise((_, rej) => setTimeout(() => rej(new Error('Zeitüberschreitung')), opts.timeout || 20000))]);
  }

  // ---------- Brett ----------
  function makeBoard(o) {
    const root = el('div', 'og-board');
    const S = { fen: '', flip: false, last: null, check: null, sel: null, targets: [], marks: {}, map: {} };
    const sqEls = {};
    let drag = null;

    function order() { const rs = [], fs = []; for (let i = 0; i < 8; i++) { rs.push(S.flip ? i + 1 : 8 - i); fs.push(S.flip ? 7 - i : i); } return { rs, fs }; }
    function build() {
      root.innerHTML = ''; const { rs, fs } = order();
      rs.forEach((r, ri) => fs.forEach((f, fi) => {
        const sq = FILES[f] + r; const d = el('div', 'og-sq ' + ((f + r) % 2 === 1 ? 'd' : 'l')); d.dataset.sq = sq; sqEls[sq] = d;
        if (fi === 0) d.appendChild(el('span', 'og-coord r', r)); if (ri === 7) d.appendChild(el('span', 'og-coord f', FILES[f]));
        root.appendChild(d);
      }));
    }
    function paint() {
      for (const sq in sqEls) {
        const d = sqEls[sq]; const p = S.map[sq];
        d.className = 'og-sq ' + (((FILES.indexOf(sq[0]) + +sq[1]) % 2 === 1) ? 'd' : 'l');
        if (S.last && (S.last[0] === sq || S.last[1] === sq)) d.classList.add('last');
        if (S.sel === sq) d.classList.add('sel');
        if (S.check === sq) d.classList.add('chk');
        if (S.targets.includes(sq)) { d.classList.add('tgt'); if (p) d.classList.add('cap'); }
        if (S.marks[sq]) d.classList.add(S.marks[sq]);
        d.querySelectorAll('.og-piece').forEach(x => x.remove());
        if (p) d.insertAdjacentHTML('beforeend', pieceSpan(p));
      }
    }
    function set(next, anim) {
      let fromRect = null;
      if (anim && sqEls[anim.from]) { const pe = sqEls[anim.from].querySelector('.og-piece'); if (pe) fromRect = pe.getBoundingClientRect(); }
      const flipChanged = next.flip != null && next.flip !== S.flip;
      Object.assign(S, next);
      if (next.fen) S.map = parseFen(next.fen);
      if (flipChanged || !Object.keys(sqEls).length) build();
      paint();
      if (fromRect && anim && sqEls[anim.to]) {
        const pe = sqEls[anim.to].querySelector('.og-piece');
        if (pe) {
          const nr = pe.getBoundingClientRect(); const dx = fromRect.left - nr.left, dy = fromRect.top - nr.top;
          pe.style.transition = 'none'; pe.style.transform = `translate(${dx}px,${dy}px)`; pe.style.zIndex = 4;
          void pe.offsetWidth; pe.style.transition = 'transform .22s ease'; pe.style.transform = '';
          setTimeout(() => { pe.style.zIndex = ''; pe.style.transition = ''; }, 260);
        }
      }
    }
    function sqFromPoint(x, y) { const e = document.elementFromPoint(x, y); const s = e && e.closest && e.closest('.og-sq'); return s && root.contains(s) ? s.dataset.sq : null; }
    function clearGhost() { if (drag && drag.ghost) drag.ghost.remove(); drag = null; }
    function select(sq) { S.sel = sq; S.targets = o.getTargets ? o.getTargets(sq) : []; paint(); }
    function deselect() { S.sel = null; S.targets = []; paint(); }

    root.addEventListener('pointerdown', (e) => {
      if (!o.getTargets) return;
      const sq = sqFromPoint(e.clientX, e.clientY); if (!sq) return;
      if (S.sel && S.targets.includes(sq)) { const from = S.sel; deselect(); o.onMove(from, sq); return; }
      const targets = o.getTargets(sq);
      if (targets && targets.length) {
        select(sq);
        const pe = sqEls[sq].querySelector('.og-piece');
        if (pe) { drag = { from: sq, x: e.clientX, y: e.clientY, moved: false, ghost: null, html: pe.outerHTML, size: pe.getBoundingClientRect().width }; try { root.setPointerCapture(e.pointerId); } catch (err) { /* ignorieren */ } }
      } else deselect();
    });
    root.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) {
        drag.moved = true; const g = el('div', 'og-ghost', drag.html); g.firstChild.style.fontSize = drag.size * 0.95 + 'px'; g.firstChild.style.width = g.firstChild.style.height = drag.size + 'px'; g.firstChild.classList.contains('img') && (g.firstChild.style.fontSize = '0');
        document.body.appendChild(g); drag.ghost = g;
        const pe = sqEls[drag.from].querySelector('.og-piece'); if (pe) pe.style.opacity = '.3';
      }
      if (drag.ghost) { drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px'; }
    });
    root.addEventListener('pointercancel', () => { if (!drag) return; const f = drag.from; clearGhost(); const pe = sqEls[f] && sqEls[f].querySelector('.og-piece'); if (pe) pe.style.opacity = ''; });
    root.addEventListener('pointerup', (e) => {
      if (!drag) return; const d = drag; const moved = d.moved;
      const to = moved ? sqFromPoint(e.clientX, e.clientY) : null;
      clearGhost();
      const pe = sqEls[d.from] && sqEls[d.from].querySelector('.og-piece'); if (pe) pe.style.opacity = '';
      if (moved && to && to !== d.from && S.targets.includes(to)) { deselect(); o.onMove(d.from, to); }
    });
    build();
    return { el: root, set, state: S, sqEls, promo(color) { return new Promise((resolve) => {
      const ov = el('div', 'og-promo'); ['q', 'r', 'b', 'n'].forEach(t => { const b = el('button', null, pieceSpan({ color, type: t }, 'width:52px;height:52px')); b.onclick = () => { ov.remove(); resolve(t); }; ov.appendChild(b); });
      root.appendChild(ov);
    }); } };
  }

  // ---------- Partie ----------
  function newCard() { const c = el('div', 'og-card'); return c; }

  function openSetup(preMode) {
    const card = newCard();
    const cfg = { mode: preMode === 'gemini' ? 'gemini' : 'stockfish', color: 'w', level: 'l3' };
    const saved = lsGet(SAVE_KEY, null);
    function draw() {
      card.innerHTML = `<div class="og-title"><i class="bi bi-controller"></i> Partie spielen <span class="og-badge">Brett im Chat</span></div>
      <div class="og-row"><label>Wer zieht für den Bot?</label>
        <button class="og-btn ${cfg.mode === 'stockfish' ? 'on' : ''}" data-mode="stockfish">Stockfish zieht, Gemini sagt an</button>
        <button class="og-btn ${cfg.mode === 'gemini' ? 'on' : ''}" data-mode="gemini">Gemini zieht selbst</button></div>
      <div class="og-note">${cfg.mode === 'stockfish' ? 'Die Engine wählt den Zug, Gemini erklärt ihn in einem Satz. Ansage und Zug passen immer zusammen.' : 'Gemini sucht den Zug aus der Liste der erlaubten Züge. Wenn Gemini etwas Ungültiges nennt, fragt der Bot nach und nimmt zur Not einen leichten Ersatzzug von Stockfish.'}</div>
      <div class="og-row"><label>Deine Farbe</label>
        ${[['w', 'Weiß'], ['b', 'Schwarz'], ['r', 'Zufall']].map(([v, t]) => `<button class="og-btn ${cfg.color === v ? 'on' : ''}" data-color="${v}">${t}</button>`).join('')}</div>
      ${cfg.mode === 'stockfish' ? `<div class="og-row"><label>Stärke</label><select class="og-select" data-level>${K.LEVELS.map(l => `<option value="${l.id}" ${cfg.level === l.id ? 'selected' : ''}>${l.label} (ca. ${l.elo})</option>`).join('')}</select></div>` : ''}
      <div class="og-row"><button class="og-btn primary" data-start><i class="bi bi-play-fill"></i> Partie starten</button>
      ${saved && !saved.over ? '<button class="og-btn" data-resume>Laufende Partie fortsetzen</button>' : ''}</div>`;
      card.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { cfg.mode = b.dataset.mode; draw(); });
      card.querySelectorAll('[data-color]').forEach(b => b.onclick = () => { cfg.color = b.dataset.color; draw(); });
      const sel = card.querySelector('[data-level]'); if (sel) sel.onchange = () => { cfg.level = sel.value; };
      card.querySelector('[data-start]').onclick = () => startGame(card, { mode: cfg.mode, color: cfg.color === 'r' ? (Math.random() < .5 ? 'w' : 'b') : cfg.color, level: cfg.level });
      const rs = card.querySelector('[data-resume]'); if (rs) rs.onclick = () => startGame(card, { resume: saved });
    }
    draw(); addCard(card); return card;
  }

  function startGame(card, o) {
    const S = { mode: 'stockfish', human: 'w', level: 'l3', chess: new C(), busy: false, over: false, speak: false, last: null, marks: {}, ply: 0, disposed: false, resigned: false, note: '' };
    if (o.resume) {
      const r = o.resume; S.mode = r.mode; S.human = r.human; S.level = r.level;
      if (!S.chess.load_pgn(r.pgn || '')) S.chess = new C();
      const h = S.chess.history({ verbose: true }); if (h.length) { const m = h[h.length - 1]; S.last = [m.from, m.to]; }
    } else { S.mode = o.mode; S.human = o.color; S.level = o.level; }
    S.bot = S.human === 'w' ? 'b' : 'w';
    const lv = K.levelById(S.level);

    card.innerHTML = `<div class="og-title"><i class="bi bi-controller"></i> Partie gegen Orbitron <span class="og-badge">${S.mode === 'gemini' ? 'Gemini zieht' : 'Stockfish zieht · ' + esc(lv.label)}</span></div>
      <div class="og-play"><div class="og-left" data-boardwrap></div><div class="og-right"><div class="og-status" data-status></div>
      <div class="og-say" data-say><b>Viel Erfolg!</b><span class="og-sub">Zieh mit Klick oder Ziehen. Der Bot sagt jeden Zug an.</span></div>
      <div class="og-row" data-tools>
        <button class="og-btn" data-flip title="Brett drehen"><i class="bi bi-arrow-down-up"></i></button>
        <button class="og-btn" data-speak title="Ansage vorlesen"><i class="bi bi-volume-mute"></i></button>
        <button class="og-btn" data-check title="Hängende Figuren und Mattdrohungen prüfen"><i class="bi bi-shield-check"></i> Patzer-Check</button>
        <button class="og-btn" data-back>Zug zurück</button>
        <button class="og-btn" data-draw>Remis anbieten</button>
        <button class="og-btn" data-resign>Aufgeben</button></div>
      <div data-panel></div><div class="og-moves" data-moves></div><div data-end></div></div></div>`;
    const q = (s) => card.querySelector(s);
    const board = makeBoard({
      getTargets: (sq) => {
        if (S.busy || S.over || S.chess.turn() !== S.human) return [];
        const p = S.chess.get(sq); if (!p || p.color !== S.human) return [];
        return S.chess.moves({ square: sq, verbose: true }).map(m => m.to);
      },
      onMove: (from, to) => humanMove(from, to)
    });
    q('[data-boardwrap]').appendChild(board.el);

    function kingSquare(color) { const mp = parseFen(S.chess.fen()); for (const sq in mp) if (mp[sq].type === 'k' && mp[sq].color === color) return sq; return null; }
    function refresh(anim) {
      board.set({ fen: S.chess.fen(), flip: S.flipped != null ? S.flipped : S.human === 'b', last: S.last, check: S.chess.in_check() ? kingSquare(S.chess.turn()) : null, marks: S.marks, sel: null, targets: [] }, anim);
      const n = Math.floor(S.chess.history().length / 2) + 1;
      let t;
      if (S.over) t = S.resultText || 'Partie beendet';
      else if (S.busy) t = 'Orbitron denkt …';
      else t = (S.chess.in_check() ? 'Schach! ' : '') + `Zug ${n}, du bist am Zug (${K.COLOR[S.human]})`;
      q('[data-status]').textContent = t;
      const hist = S.chess.history(); let mv = '';
      hist.forEach((s, i) => { mv += (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + s + ' '; });
      q('[data-moves]').textContent = mv.trim();
      ['[data-back]', '[data-draw]', '[data-resign]', '[data-check]'].forEach(s => { const b = q(s); if (b) b.disabled = S.over || (s !== '[data-check]' && S.busy); });
      persist();
    }
    function persist() { lsSet(SAVE_KEY, { mode: S.mode, human: S.human, level: S.level, pgn: S.chess.pgn(), over: S.over }); }
    function say(main, sub) {
      q('[data-say]').innerHTML = `<b>${esc(main)}</b>${sub ? `<span class="og-sub">${esc(sub)}</span>` : ''}`;
      if (S.speak && 'speechSynthesis' in window) { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance([main, sub].filter(Boolean).join('. ')); u.lang = 'de-DE'; speechSynthesis.speak(u); } catch (e) { /* ignorieren */ } }
    }
    function scrollIntoChat() { try { if (window.__orbitronBridge) window.__orbitronBridge.scrollBottom(); } catch (e) { /* ignorieren */ } }

    async function humanMove(from, to) {
      if (S.busy || S.over || S.chess.turn() !== S.human) return;
      const cands = S.chess.moves({ verbose: true }).filter(m => m.from === from && m.to === to);
      if (!cands.length) return;
      let promo; if (cands[0].promotion) promo = await board.promo(S.human);
      const m = S.chess.move({ from, to, promotion: promo }); if (!m) return;
      S.marks = {}; q('[data-panel]').innerHTML = ''; S.last = [m.from, m.to]; S.ply++;
      refresh({ from: m.from, to: m.to });
      if (S.chess.game_over()) return finish();
      botTurn();
    }

    async function engineMove() {
      const res = await Engine.search(S.chess.fen(), { skill: S.mode === 'gemini' ? 0 : lv.skill, movetime: S.mode === 'gemini' ? 80 : lv.movetime });
      if (!res || !res.uci) return Object.assign(fallbackMove(S.chess, S.level === 'l1' || S.level === 'l2'), { note: 'Engine nicht verfügbar, einfacher Notfall-Zug.' });
      return res;
    }
    async function geminiMove() {
      let bad = '';
      for (let a = 1; a <= 3; a++) {
        try {
          const prompt = K.geminiPrompt(S.chess, S.bot) + (bad ? `\nDein letzter Vorschlag "${bad}" war nicht erlaubt. Nimm einen Zug exakt aus der Liste.` : '');
          const text = await askGemini(prompt, { timeout: 25000, tokens: 200, system: 'Du bist ein Schachspieler. Du antwortest ausschließlich mit dem verlangten JSON.' });
          const pick = K.pickFromReply(C, S.chess.fen(), text);
          if (pick) return { uci: pick.from + pick.to + (pick.promotion || ''), say: pick.say, cp: null, mate: null, tries: a, viaGemini: true };
          bad = (String(text).match(/"move"\s*:\s*"([^"]+)"/) || [])[1] || String(text).slice(0, 12);
        } catch (e) { bad = ''; if (a === 3) break; await sleep(400); }
      }
      const r = await Engine.search(S.chess.fen(), { skill: 0, movetime: 80 });
      const res = (r && r.uci) ? r : fallbackMove(S.chess, true);
      return Object.assign(res, { note: 'Gemini hat keinen erlaubten Zug geliefert, deshalb ein leichter Ersatzzug von Stockfish.' });
    }

    async function botTurn() {
      if (S.over || S.busy || S.disposed) return;
      S.busy = true; refresh();
      const ply0 = S.chess.history().length;
      let res;
      try { res = S.mode === 'gemini' ? await geminiMove() : await engineMove(); } catch (e) { res = Object.assign(fallbackMove(S.chess, true), { note: 'Fehler bei der Zugsuche, Notfall-Zug.' }); }
      if (S.chess.history().length !== ply0 || S.disposed) { S.busy = false; return; }
      let m = S.chess.move({ from: res.uci.slice(0, 2), to: res.uci.slice(2, 4), promotion: res.uci[4] });
      if (!m) { const f = fallbackMove(S.chess, true); m = S.chess.move({ from: f.uci.slice(0, 2), to: f.uci.slice(2, 4), promotion: f.uci[4] }); res = Object.assign(f, { note: 'Der vorgeschlagene Zug war nicht erlaubt, Notfall-Zug.' }); }
      S.busy = false; S.last = [m.from, m.to]; S.ply++; const myPly = S.ply;
      refresh({ from: m.from, to: m.to });
      const main = 'Ich spiele: ' + K.describeMove(m) + '.';
      const sub0 = res.say || (res.viaGemini ? '' : K.evalWords(res.cp, res.mate));
      say(main, [sub0, res.note].filter(Boolean).join(' '));
      if (S.chess.game_over()) return finish();
      if (!res.viaGemini && !res.fallback) {
        askGemini(K.geminiAnnouncePrompt(S.chess, m, res), { timeout: 7000, tokens: 120 }).then(t => {
          t = String(t || '').replace(/^["„“\s]+|["“”\s]+$/g, '').replace(/\s+/g, ' ');
          if (t && t.length < 280 && S.ply === myPly && !S.over) say(main, [t, res.note].filter(Boolean).join(' '));
        }).catch(() => { /* Ansage bleibt die einfache Fassung */ });
      }
    }

    function finish(resigned) {
      S.over = true; S.busy = false; S.resigned = !!resigned;
      const rt = resigned ? 'Du hast aufgegeben.' : K.resultText(S.chess, S.human);
      S.resultText = rt;
      const res = K.pgnResult(S.chess, S.human, resigned);
      const d = new Date(); const date = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
      const bot = S.mode === 'gemini' ? 'Orbitron (Gemini)' : 'Orbitron (Stockfish ' + lv.label + ')';
      S.chess.header('Event', 'Orbitron Chess', 'Date', date, 'White', S.human === 'w' ? 'Du' : bot, 'Black', S.human === 'b' ? 'Du' : bot, 'Result', res);
      const pgn = S.chess.pgn();
      refresh();
      const win = res === (S.human === 'w' ? '1-0' : '0-1');
      q('[data-say]').innerHTML = `<b class="${win ? 'og-win' : res === '1/2-1/2' ? '' : 'og-lose'}">${esc(rt)}</b><span class="og-sub">Ergebnis ${esc(res)}. Die Partie steht jetzt im Chat. Du kannst sie analysieren lassen.</span>`;
      const end = q('[data-end]');
      end.innerHTML = `<div class="og-row"><button class="og-btn primary" data-analyse><i class="bi bi-graph-up"></i> Partie analysieren</button><button class="og-btn" data-again>Revanche</button><button class="og-btn" data-copy>PGN kopieren</button></div>`;
      end.querySelector('[data-analyse]').onclick = () => { const inp = $('promptInput'); inp.value = pgn; if (typeof autoResize === 'function') autoResize(inp); if (typeof updateSendBtn === 'function') updateSendBtn(); window.sendMessage(); };
      end.querySelector('[data-again]').onclick = () => openSetup(S.mode);
      end.querySelector('[data-copy]').onclick = () => { try { navigator.clipboard.writeText(pgn); } catch (e) { /* ignorieren */ } };
      pushHistory('Partie gegen Orbitron beendet: ' + rt + '\n\n' + pgn);
      persist();
    }

    q('[data-flip]').onclick = () => { S.flipped = !(S.flipped != null ? S.flipped : S.human === 'b'); refresh(); };
    q('[data-speak]').onclick = (e) => { S.speak = !S.speak; e.currentTarget.innerHTML = `<i class="bi bi-volume-${S.speak ? 'up' : 'mute'}"></i>`; e.currentTarget.classList.toggle('on', S.speak); if (!S.speak && 'speechSynthesis' in window) speechSynthesis.cancel(); };
    q('[data-check]').onclick = () => {
      const r = K.patzerCheck(C, S.chess.fen()); S.marks = {};
      r.hangingMine.forEach(h => S.marks[h.sq] = 'og-bad'); r.hangingTheirs.forEach(h => S.marks[h.sq] = 'og-good');
      q('[data-panel]').innerHTML = `<div class="og-panel"><b>Patzer-Check für ${K.COLOR[r.turn]}</b><ul>${r.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul><span class="og-note">Rot: deine Figur in Gefahr. Grün: gegnerische Figur zum Mitnehmen.</span></div>`;
      refresh();
    };
    q('[data-back]').onclick = () => {
      if (S.busy || S.over) return;
      const h = S.chess.history().length; const need = S.chess.turn() === S.human ? 2 : 1;
      if (h < need || (S.human === 'b' && h <= 1)) { say('Zurücknehmen geht hier nicht.', 'Es gibt keinen eigenen Zug mehr zum Zurücknehmen.'); return; }
      for (let i = 0; i < need; i++) S.chess.undo();
      const hh = S.chess.history({ verbose: true }); S.last = hh.length ? [hh[hh.length - 1].from, hh[hh.length - 1].to] : null; S.marks = {}; S.ply++;
      q('[data-panel]').innerHTML = ''; refresh(); say('Zug zurückgenommen.', 'Du bist wieder dran.');
    };
    q('[data-draw]').onclick = async () => {
      if (S.busy || S.over) return;
      S.busy = true; refresh(); say('Ich prüfe dein Remis-Angebot …', '');
      const r = await Engine.search(S.chess.fen(), { skill: 20, movetime: 400 });
      S.busy = false;
      if (!r || (r.cp == null && r.mate == null)) { refresh(); say('Ich lehne ab.', 'Ohne Engine-Prüfung nehme ich kein Remis an.'); return; }
      let cp = r.mate != null ? (r.mate > 0 ? 10000 : -10000) : r.cp; if (S.chess.turn() !== S.bot) cp = -cp;
      if (cp <= 40) { S.chess.header('Termination', 'Remis vereinbart'); S.resultText = 'Remis vereinbart.'; finishDraw(); } else { refresh(); say('Ich lehne ab.', 'Ich sehe mich etwas besser. Spiel weiter.'); }
    };
    function finishDraw() {
      S.over = true; refresh(); const pgn = S.chess.pgn();
      q('[data-say]').innerHTML = '<b>Remis vereinbart.</b><span class="og-sub">Der Bot hat dein Angebot angenommen.</span>';
      pushHistory('Partie gegen Orbitron beendet: Remis vereinbart.\n\n' + pgn); persist();
      q('[data-end]').innerHTML = '<div class="og-row"><button class="og-btn" data-again>Revanche</button></div>'; q('[data-end] [data-again]').onclick = () => openSetup(S.mode);
    }
    q('[data-resign]').onclick = () => { if (S.over || S.busy) return; finish(true); };

    refresh();
    if (S.chess.history().length === 0 && S.human === 'b') botTurn();
    else if (S.chess.turn() === S.bot && !S.chess.game_over()) botTurn();
    else if (S.chess.game_over()) finish();
    // Fuer Tests
    card.__og = { S, board, humanMove, botTurn, engine: Engine };
    return card;
  }

  // ---------- Patzer-Check Karte ----------
  function openPatzerCheck(fen) {
    const card = newCard();
    card.innerHTML = `<div class="og-title"><i class="bi bi-shield-check"></i> Patzer-Check <span class="og-badge">vor dem Zug</span></div>
      <div class="og-note">Stellung als FEN oder PGN einfügen. Der Check sucht hängende Figuren, Mattdrohungen und ein Matt in 1 für die Seite am Zug. Das ist dein häufigster Fehlerbereich.</div>
      <textarea class="og-input" rows="2" data-in placeholder="FEN oder PGN einfügen"></textarea>
      <div class="og-row"><button class="og-btn primary" data-go>Prüfen</button><button class="og-btn" data-start>Startstellung</button><button class="og-btn" data-flip><i class="bi bi-arrow-down-up"></i></button></div>
      <div class="og-play"><div class="og-left" data-boardwrap></div><div class="og-right" data-out></div></div>`;
    const q = (s) => card.querySelector(s);
    const board = makeBoard({}); q('[data-boardwrap]').appendChild(board.el);
    let flip = false;
    function run() {
      const raw = q('[data-in]').value.trim(); let g;
      try {
        g = new C();
        if (/[rnbqkpRNBQKP1-8]+\/[rnbqkpRNBQKP1-8/]+ [wb]/.test(raw)) { const m = raw.match(/([rnbqkpRNBQKP1-8]+(?:\/[rnbqkpRNBQKP1-8]+){7}\s+[wb]\s+\S+\s+\S+(?:\s+\d+\s+\d+)?)/); if (!m || !g.load(m[1].trim())) throw new Error('FEN ungültig'); }
        else if (raw) { if (!g.load_pgn(raw, { sloppy: true })) throw new Error('PGN ungültig'); }
      } catch (e) { q('[data-out]').innerHTML = `<div class="og-panel">${esc(e.message || 'Eingabe nicht lesbar')}</div>`; return; }
      const r = K.patzerCheck(C, g.fen()); const marks = {};
      r.hangingMine.forEach(h => marks[h.sq] = 'og-bad'); r.hangingTheirs.forEach(h => marks[h.sq] = 'og-good');
      board.set({ fen: g.fen(), flip, marks, last: null, check: null });
      q('[data-out]').innerHTML = `<div class="og-panel"><b>${K.COLOR[r.turn]} ist am Zug</b><ul>${r.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul><span class="og-note">Rot: Figur der Seite am Zug in Gefahr. Grün: gegnerische Figur zum Mitnehmen.</span></div>`;
    }
    q('[data-go]').onclick = run; q('[data-start]').onclick = () => { q('[data-in]').value = new C().fen(); run(); };
    q('[data-flip]').onclick = () => { flip = !flip; run(); };
    board.set({ fen: new C().fen(), flip: false });
    if (fen) { q('[data-in]').value = fen; run(); }
    addCard(card); card.__og = { run }; return card;
  }

  // ---------- Mattjaeger ----------
  function openMateTrainer() {
    const all = (window.ORBITRON_MATE_PUZZLES || []).slice();
    const card = newCard();
    const stats = lsGet(STATS_KEY, { solved: 0, tried: 0, streak: 0, best: 0 });
    let filter = 0, pool = [], cur = null, chess = null, remaining = 0, fails = 0, done = false, busy = false;
    card.innerHTML = `<div class="og-title"><i class="bi bi-bullseye"></i> Mattjäger <span class="og-badge">aus deinen Partien</span></div>
      <div class="og-note">Stellungen aus deinen eigenen Partien, in denen ein Matt in 1 bis 3 Zügen möglich war. Finde den Zug.</div>
      <div class="og-row" data-filter></div><div class="og-play"><div class="og-left" data-boardwrap></div><div class="og-right"><div class="og-status" data-status></div>
      <div class="og-say" data-say><b>Los geht's</b><span class="og-sub">Wähle eine Aufgabe.</span></div>
      <div class="og-row"><button class="og-btn" data-hint>Hinweis</button><button class="og-btn" data-sol>Lösung</button><button class="og-btn primary" data-next>Nächste Aufgabe</button></div><div class="og-note" data-stats></div></div></div>`;
    const q = (s) => card.querySelector(s);
    function sayT(a, b) { q('[data-say]').innerHTML = `<b>${esc(a)}</b>${b ? `<span class="og-sub">${esc(b)}</span>` : ''}`; }
    const board = makeBoard({
      getTargets: (sq) => { if (busy || done || !chess) return []; const p = chess.get(sq); if (!p || p.color !== chess.turn()) return []; return chess.moves({ square: sq, verbose: true }).map(m => m.to); },
      onMove: (f, t) => tryMove(f, t)
    });
    q('[data-boardwrap]').appendChild(board.el);
    function drawFilter() { q('[data-filter]').innerHTML = [[0, 'Alle'], [1, 'Matt in 1'], [2, 'Matt in 2'], [3, 'Matt in 3']].map(([v, t]) => `<button class="og-btn ${filter === v ? 'on' : ''}" data-f="${v}">${t}</button>`).join(''); q('[data-filter]').querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = +b.dataset.f; drawFilter(); next(); }); }
    function showStats() { q('[data-stats]').textContent = `Gelöst: ${stats.solved} von ${stats.tried} · Serie: ${stats.streak} · Beste Serie: ${stats.best}`; }
    async function next() {
      const eng = await Engine.available();
      pool = all.filter(p => (!filter || p.n === filter) && (eng || p.n === 1));
      if (!pool.length) { sayT('Keine Aufgaben', 'Für diese Auswahl gibt es keine Aufgaben (ohne Engine nur Matt in 1).'); return; }
      cur = pool[Math.floor(Math.random() * pool.length)]; chess = new C(cur.f); remaining = cur.n; fails = 0; done = false; busy = false; stats.tried++; lsSet(STATS_KEY, stats);
      board.set({ fen: chess.fen(), flip: cur.s === 'b', last: null, check: null, marks: {} });
      q('[data-status]').textContent = `Matt in ${cur.n}, ${K.COLOR[cur.s]} ist am Zug`;
      sayT('Finde das Matt', `Du hast ${cur.n} ${cur.n === 1 ? 'Zug' : 'Züge'}. Tipp: erst alle Schachs prüfen.`); showStats();
    }
    function fail(msg) { fails++; if (stats.streak) { stats.streak = 0; lsSet(STATS_KEY, stats); showStats(); } sayT('Nicht ganz', msg); }
    async function tryMove(from, to) {
      if (busy || done || !chess) return; busy = true;
      const cands = chess.moves({ verbose: true }).filter(m => m.from === from && m.to === to); if (!cands.length) { busy = false; return; }
      let promo; if (cands[0].promotion) promo = await board.promo(chess.turn());
      const m = chess.move({ from, to, promotion: promo }); const uci = m.from + m.to + (m.promotion || '');
      board.set({ fen: chess.fen(), last: [m.from, m.to], marks: {}, check: null }, { from: m.from, to: m.to });
      if (chess.in_checkmate()) return solved();
      let ok = false, reply = null;
      if (remaining > 1 && await Engine.available()) {
        const r = await Engine.search(chess.fen(), { skill: 20, movetime: 450 });
        ok = !!(r && r.mate != null && r.mate < 0 && Math.abs(r.mate) <= remaining - 1); reply = r && r.uci;
      } else if (remaining === 1) ok = false;
      if (!ok) { await sleep(500); chess.undo(); board.set({ fen: chess.fen(), last: null }); busy = false; fail(remaining > 1 ? 'Das führt nicht zum erzwungenen Matt in der vorgegebenen Zügezahl. Versuch es nochmal.' : 'Das ist kein Matt. Prüfe alle Schachs.'); return; }
      await sleep(350);
      const dm = chess.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] });
      if (!dm) { busy = false; return; }
      remaining--; board.set({ fen: chess.fen(), last: [dm.from, dm.to], check: null }, { from: dm.from, to: dm.to });
      sayT('Richtig, weiter!', `Noch ${remaining} ${remaining === 1 ? 'Zug' : 'Züge'} bis zum Matt.`); busy = false;
    }
    function solved() { done = true; busy = false; stats.solved++; stats.streak++; stats.best = Math.max(stats.best, stats.streak); lsSet(STATS_KEY, stats); showStats(); sayT('Matt!', fails ? 'Gelöst nach ' + (fails + 1) + ' Versuchen.' : 'Beim ersten Versuch gelöst.'); }
    async function bestHere() {
      if (cur && chess.fen() === cur.f) return cur.b;
      const r = await Engine.search(chess.fen(), { skill: 20, movetime: 400 }); return r && r.uci;
    }
    q('[data-hint]').onclick = async () => { if (!chess || done || busy) return; const b = await bestHere(); if (!b) return; board.set({ marks: { [b.slice(0, 2)]: 'og-hint' } }); sayT('Hinweis', 'Die markierte Figur macht den Mattzug.'); };
    q('[data-sol]').onclick = async () => { if (!chess || done || busy) return; const b = await bestHere(); if (!b) return; const t = new C(chess.fen()).move({ from: b.slice(0, 2), to: b.slice(2, 4), promotion: b[4] }); board.set({ marks: { [b.slice(0, 2)]: 'og-hint', [b.slice(2, 4)]: 'og-hint' } }); sayT('Lösung', t ? K.describeMove(t) : b); if (stats.streak) { stats.streak = 0; lsSet(STATS_KEY, stats); showStats(); } };
    q('[data-next]').onclick = next;
    drawFilter(); showStats(); next();
    addCard(card); card.__og = { next, tryMove, board }; return card;
  }

  // ---------- Chat-Ausloeser ----------
  function matchTrigger(t) {
    if (!t) return null; const s = t.toLowerCase();
    // Bewusst eng gefasst, damit normale Fragen ("check diese Partie", "Partie analysieren") nie abgefangen werden.
    if (/^\/matt\b|^mattj(ä|ae)ger\b/.test(s)) return { fn: 'mate' };
    if (/^\/check\b|^patzer-?check\b/.test(s)) return { fn: 'check', fen: (t.match(/([rnbqkpRNBQKP1-8]+(?:\/[rnbqkpRNBQKP1-8]+){7}\s+[wb]\s+\S+\s+\S+(?:\s+\d+\s+\d+)?)/) || [])[1] };
    if (/^\/(spiel|play|game|partie)\b/.test(s) || /^(spiel(e)? mit mir|lass uns (eine partie )?spielen|wollen wir (eine partie )?spielen|spielen wir|partie spielen|ich will spielen|ich möchte spielen)\b/.test(s)) return { fn: 'game', mode: /gemini/.test(s) ? 'gemini' : 'stockfish' };
    return null;
  }
  const origSend = window.sendMessage;
  if (typeof origSend === 'function') {
    window.sendMessage = function () {
      const inp = $('promptInput'); const t = inp ? inp.value.trim() : '';
      const m = matchTrigger(t);
      if (m && t.length < 80 + (m.fen ? 100 : 0)) {
        inp.value = ''; try { autoResize(inp); updateSendBtn(); } catch (e) { /* ignorieren */ }
        if (m.fn === 'game') openSetup(m.mode); else if (m.fn === 'mate') openMateTrainer(); else openPatzerCheck(m.fen);
        return;
      }
      return origSend.apply(this, arguments);
    };
  }

  (function watch() {
    const stream = $('chatStream'); if (!stream) return;
    const upd = () => document.body.classList.toggle('og-active', !!stream.querySelector('.og-card'));
    new MutationObserver(upd).observe(stream, { childList: true, subtree: false }); upd();
  })();

  window.OrbitronGame = { openSetup, openPatzerCheck, openMateTrainer, Engine, matchTrigger, version: '1.0' };
})();
