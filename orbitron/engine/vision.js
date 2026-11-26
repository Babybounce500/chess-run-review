/*
 * Bretterkennung für Screenshots digitaler Schachbretter, komplett im Browser (kein Server, das Bild verlässt das Gerät nicht).
 * 1. Brett finden: gleichmäßiges 8x8-Muster aus zwei Feldfarben.  2. Jedes Feld: leer? weiß oder schwarz? welche Figur?
 * Verglichen wird mit den mitgelieferten Figurensätzen und mit allem, was aus bestätigten Korrekturen gelernt wurde.
 * Nicht für Fotos von echten Brettern (keine Entzerrung).
 */
(function () {
  'use strict';
  const N = 40, M = 20, G = 10, STORE = 'orbitron_lab_vision_v2', MAXLEARN = 240;
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const ctx2 = (c) => c.getContext('2d', { willReadFrequently: true });
  const med = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const dist = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

  /* ---------- 1. Brett finden ---------- */
  function findBoard(src) {
    const scale = Math.min(1, 900 / Math.max(src.width, src.height)), w = Math.round(src.width * scale), h = Math.round(src.height * scale);
    const c = canvas(w, h), g = ctx2(c); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    const gray = new Float32Array(w * h); for (let i = 0; i < w * h; i++) gray[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    // Kantenprofile: Gitterlinien laufen über das ganze Brett; Kappen verhindert, dass Text alles überstimmt
    const P = new Float64Array(w), Q = new Float64Array(h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; P[x] += Math.min(30, Math.abs(gray[i + 1] - gray[i - 1])); Q[y] += Math.min(30, Math.abs(gray[i + w] - gray[i - w])); }
    const at = (A, v) => { const i = Math.round(v); return Math.max(A[i - 1] || 0, A[i] || 0, A[i + 1] || 0); };
    const lineScore = (A, o, s) => { const v = []; for (let k = 1; k < 8; k++) v.push(at(A, o + k * s)); v.sort((a, b) => a - b); return v[0] + v[1] + v[2] + v[3] + v[4]; };
    const px = (x, y) => { const xi = x < 0 ? 0 : x >= w ? w - 1 : x | 0, yi = y < 0 ? 0 : y >= h ? h - 1 : y | 0, i = (yi * w + xi) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    function checker(x0, y0, s) {
      if (x0 < -3 || y0 < -3 || x0 + 8 * s > w + 3 || y0 + 8 * s > h + 3) return { score: 0 };
      const cols = [], cls = [[[], [], []], [[], [], []]];
      for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
        const pts = [[0.07, 0.07], [0.93, 0.07], [0.07, 0.93], [0.93, 0.93]].map(([u, v]) => px(x0 + (f + u) * s, y0 + (r + v) * s));
        const col = [0, 1, 2].map((k) => med(pts.map((p) => p[k]))); cols.push(col); const k = (r + f) & 1; for (let j = 0; j < 3; j++) cls[k][j].push(col[j]);
      }
      const m = cls.map((c2) => c2.map(med)), diff = dist(m[0], m[1]);
      if (diff < 14) return { score: 0 };
      let inl = 0; cols.forEach((col, i) => { const k = ((i >> 3) + (i & 7)) & 1; if (dist(col, m[k]) < Math.min(34, diff * 0.55)) inl++; });
      return { score: Math.sqrt(diff) * Math.pow(inl / 64, 7), inl, diff, colors: m };
    }
    const minS = Math.max(10, Math.floor(Math.min(w, h) / 22)), maxS = Math.min(w, h) / 8 + 0.5;
    let best = null; const top = (A, len, s) => { const list = []; for (let o = -2; o <= len - 8 * s + 2; o += 1) list.push([lineScore(A, o, s), o]); list.sort((a, b) => b[0] - a[0]); const out = []; for (const e of list) { if (out.every((q) => Math.abs(q[1] - e[1]) > 3)) out.push(e); if (out.length === 6) break; } return out; };
    let emax = 1;
    const found = [];
    for (let s = minS; s <= maxS; s += 0.5) {
      const xs = top(P, w, s), ys = top(Q, h, s);
      for (const [sx, x0] of xs) for (const [sy, y0] of ys) { const c2 = checker(x0, y0, s); if (c2.score > 0.2) { const e = sx + sy; if (e > emax) emax = e; found.push({ x0, y0, s, c: c2.score, e }); } }
    }
    if (!found.length) return null;
    found.forEach((f) => { f.total = f.c * (0.55 + 0.45 * f.e / emax) * Math.pow(f.s / maxS, 0.12); });
    found.sort((a, b) => b.total - a.total); best = found[0];
    // Feinjustierung an den scharfen Linien
    const exact = (A, o, s) => { let t = 0; for (let k = 0; k <= 8; k++) { const i = Math.round(o + k * s); t += A[Math.max(0, Math.min(A.length - 1, i))] || 0; } return t; };
    let fine = null;
    for (let s = best.s - 1.5; s <= best.s + 1.5; s += 0.125) for (let dx = -3; dx <= 3; dx += 0.5) for (let dy = -3; dy <= 3; dy += 0.5) {
      const x0 = best.x0 + dx, y0 = best.y0 + dy, c2 = checker(x0, y0, s); if (c2.score < best.c * 0.9) continue;
      const v = (exact(P, x0, s) + exact(Q, y0, s)) * (0.5 + c2.score / (best.c * 2 || 1)); if (!fine || v > fine.v) fine = { x0, y0, s, v, c: c2 };
    }
    const f = fine || { x0: best.x0, y0: best.y0, s: best.s, c: checker(best.x0, best.y0, best.s) };
    if ((f.c.inl || 0) < 40) return null;
    return Object.assign(align(src, { x: f.x0 / scale, y: f.y0 / scale, size: 8 * f.s / scale }), { inliers: f.c.inl });
  }
  // Pixelgenau nachrichten (volle Auflösung, nur der Brettbereich): eine Feldgrenze ist eine Kante, die fast über das ganze Brett läuft.
  // Schon 3 Pixel Versatz ziehen einen Streifen vom Nachbarfeld in jedes Feld und verderben die Figurenform.
  function align(src, r) {
    const pad = Math.ceil(r.size / 40) + 4, ox = Math.floor(r.x) - pad, oy = Math.floor(r.y) - pad, W = Math.ceil(r.size) + 2 * pad;
    const c = canvas(W, W), g = ctx2(c); g.drawImage(src, -ox, -oy);
    const d = g.getImageData(0, 0, W, W).data, V = new Float32Array(W), H = new Float32Array(W);
    const diff = (i, j) => Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]);
    const from = pad + 2, to = W - pad - 2;
    for (let k = 1; k < W; k++) { let a = 0, b = 0; for (let m = from; m < to; m++) { if (diff((m * W + k) * 4, (m * W + k - 1) * 4) > 24) a++; if (diff((k * W + m) * 4, ((k - 1) * W + m) * 4) > 24) b++; } V[k] = a / (to - from); H[k] = b / (to - from); }
    const at = (A, v) => { const i = Math.floor(v), q = v - i; return (A[i] || 0) * (1 - q) + (A[i + 1] || 0) * q; };
    const sizes = []; for (let s = r.size - 8; s <= r.size + 8; s += 0.5) sizes.push(s);
    let best = null;
    for (const size of sizes) {
      const one = (A, start) => { let top = null; for (let o = start - pad + 1; o <= start + pad - 1; o += 0.5) { let v = 0; for (let k = 0; k <= 8; k++) v += at(A, o + k * size / 8) * (k === 0 || k === 8 ? 0.5 : 1); v -= Math.abs(o - start) * 0.002; if (!top || v > top.v) top = { v, o }; } return top; };
      const x = one(V, r.x - ox), y = one(H, r.y - oy), v = x.v + y.v - Math.abs(size - r.size) * 0.002;
      if (!best || v > best.v) best = { v, x: x.o + ox, y: y.o + oy, size };
    }
    return best && best.v > 5 ? { x: best.x, y: best.y, size: best.size } : r;
  }

  /* ---------- 2. Ein Feld lesen ---------- */
  function features(sq) {                                  // sq: Canvas N x N mit genau einem Feld
    const d = ctx2(sq).getImageData(0, 0, N, N).data, n = N * N;
    const patch = (x, y) => { const v = [[], [], []]; for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const p = ((y + j) * N + x + i) * 4; for (let k = 0; k < 3; k++) v[k].push(d[p + k]); } return v.map(med); };
    const pts = [patch(1, 1), patch(N - 4, 1), patch(1, N - 4), patch(N - 4, N - 4), patch((N >> 1) - 1, 0), patch(0, (N >> 1) - 1), patch(N - 3, (N >> 1) - 1)];
    const bg = [0, 1, 2].map((k) => med(pts.map((p) => p[k])));
    let mask = new Uint8Array(n); const lum = new Float32Array(n);
    for (let i = 0; i < n; i++) { const p = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]; lum[i] = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]; const x = i % N, y = (i / N) | 0; if (x > 0 && y > 0 && x < N - 1 && y < N - 1 && dist(p, bg) > 30) mask[i] = 1; }
    // Löcher füllen (helle Figur auf hellem Feld: nur die Kontur hebt sich ab)
    const out = new Uint8Array(n), st = []; const push = (i) => { if (!out[i] && !mask[i]) { out[i] = 1; st.push(i); } };
    for (let k = 0; k < N; k++) { push(k); push(n - N + k); push(k * N); push(k * N + N - 1); }
    while (st.length) { const i = st.pop(), x = i % N; if (x > 0) push(i - 1); if (x < N - 1) push(i + 1); if (i >= N) push(i - N); if (i < n - N) push(i + N); }
    for (let i = 0; i < n; i++) if (!out[i]) mask[i] = 1;
    // kleine Flecken (Koordinaten, Markierungspunkte) entfernen
    const seen = new Uint8Array(n), keep = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (!mask[i] || seen[i]) continue; const comp = [i]; seen[i] = 1;
      for (let q = 0; q < comp.length; q++) { const j = comp[q], x = j % N; [x > 0 ? j - 1 : -1, x < N - 1 ? j + 1 : -1, j - N, j + N].forEach((k) => { if (k >= 0 && k < n && mask[k] && !seen[k]) { seen[k] = 1; comp.push(k); } }); }
      let x0 = N, x1 = 0, y0 = N, y1 = 0; comp.forEach((j) => { const x = j % N, y = (j / N) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
      const corner = (x1 < N * 0.3 || x0 > N * 0.7) && (y1 < N * 0.3 || y0 > N * 0.7);
      if (comp.length >= n * 0.012 && !corner) comp.forEach((j) => { keep[j] = 1; });
    }
    mask = keep;
    let area = 0, x0 = N, x1 = -1, y0 = N, y1 = -1; for (let i = 0; i < n; i++) if (mask[i]) { area++; const x = i % N, y = (i / N) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (area < n * 0.09 || bh < N * 0.4 || bw < N * 0.2) return null;                // leer
    if ((bh >= N - 3 && bw < N * 0.4) || (bw >= N - 3 && bh < N * 0.4)) return null;  // Pfeil quer durchs Feld
    if ((bw < N * 0.3 && (y0 <= 1 || y1 >= N - 2)) || (bh < N * 0.3 && (x0 <= 1 || x1 >= N - 2))) return null;  // Anfang oder Ende eines Pfeils
    // Farbe: Helligkeit im Inneren der Figur
    const inner = []; for (let i = N + 1; i < n - N - 1; i++) if (mask[i] && mask[i - 1] && mask[i + 1] && mask[i - N] && mask[i + N] && mask[i - 2] && mask[i + 2]) inner.push(lum[i]);
    const light = med(inner.length > 20 ? inner : [...lum].filter((_, i) => mask[i]));
    const m = new Uint8Array(M * M), side = Math.max(bw, bh), ox = x0 - (side - bw) / 2, oy = y0 - (side - bh) / 2;
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) { const x = Math.floor(ox + (i + 0.5) * side / M), y = Math.floor(oy + (j + 0.5) * side / M); m[j * M + i] = x >= 0 && y >= 0 && x < N && y < N && mask[y * N + x] ? 1 : 0; }
    const gv = []; for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { let s = 0, c = 0; for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) { const x = Math.floor(ox + (i + (a + 0.5) / 2) * side / G), y = Math.floor(oy + (j + (b + 0.5) / 2) * side / G); if (x >= 0 && y >= 0 && x < N && y < N && mask[y * N + x]) { s += lum[y * N + x]; c++; } } gv.push(c ? Math.round(s / c) : 0); }
    return { color: light > 128 ? 'w' : 'b', m, g: gv, a: bw / bh, h: bh / N, w: bw / N };
  }
  function norm(g, m) { const idx = []; for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) if (m[(j * 2) * M + i * 2] || m[(j * 2 + 1) * M + i * 2 + 1]) idx.push(j * G + i); return idx; }
  function compare(f, t) {
    let inter = 0, uni = 0; for (let i = 0; i < M * M; i++) { if (f.m[i] && t.m[i]) inter++; if (f.m[i] || t.m[i]) uni++; }
    const idx = norm(f.g, f.m).filter((i) => t.g[i] > 0 && f.g[i] > 0); let corr = 0;
    if (idx.length > 8) { const mf = idx.reduce((s, i) => s + f.g[i], 0) / idx.length, mt = idx.reduce((s, i) => s + t.g[i], 0) / idx.length; let a = 0, b = 0, c = 0; idx.forEach((i) => { const x = f.g[i] - mf, y = t.g[i] - mt; a += x * y; b += x * x; c += y * y; }); corr = b && c ? a / Math.sqrt(b * c) : 0; }
    return (1 - inter / (uni || 1)) * 1.6 + Math.abs(f.a - t.a) * 0.7 + Math.abs(f.h - t.h) * 0.9 + Math.abs(f.w - t.w) * 0.5 + (1 - corr) * 0.22;
  }

  /* ---------- Vorlagen ---------- */
  let templates = null;
  const loadImg = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = u; });
  async function buildTemplates(sets) {
    const out = [];
    const add = (draw, code) => { for (const bg of ['#f0d9b5', '#b58863', '#eeeed2', '#769656']) { const c = canvas(N, N), g = ctx2(c); g.fillStyle = bg; g.fillRect(0, 0, N, N); g.imageSmoothingQuality = 'high'; draw(g); const f = features(c); if (f) out.push(Object.assign(f, { code })); } };
    for (const dir of sets) for (const col of 'wb') for (const t of 'KQRBNP') {
      const im = await loadImg(dir + col + t + '.png'); if (!im) continue;
      for (const sc of (dir.includes('flat') ? [1] : [0.92, 1])) add((g) => g.drawImage(im, N * (1 - sc) / 2, N * (1 - sc) / 2, N * sc, N * sc), col + t);
    }
    return out;
  }
  const learned = () => { try { return JSON.parse(localStorage.getItem(STORE) || '[]').filter((t) => /^[wb][KQRBNP]$/.test(t.code) && t.m && t.m.length === M * M && t.g.length === G * G).map((t) => Object.assign({}, t, { m: Uint8Array.from(t.m, (ch) => ch === '1' ? 1 : 0), own: true })); } catch (e) { return []; } };
  async function ready(sets) { if (!templates) templates = await buildTemplates(sets || ['img/', 'img/flat/']); return templates; }

  function classify(f, list) {
    const best = {};
    for (const t of list) { if (t.code[0] !== f.color) continue; let v = compare(f, t); if (t.own && v < 0.45) v *= 0.6; if (!(t.code in best) || v < best[t.code].v) best[t.code] = { v, own: t.own }; }
    const order = Object.entries(best).sort((a, b) => a[1].v - b[1].v);
    if (!order.length) return null;
    const [code, top] = order[0], second = order[1] ? order[1][1].v : 9;
    return { code, d: top.v, margin: second - top.v, sure: (top.own && top.v < 0.25) || (top.v < 0.75 && second - top.v > 0.09) };
  }
  function cells(src, rect) {
    const out = [], s = rect.size / 8;
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { const c = canvas(N, N), g = ctx2(c); g.imageSmoothingQuality = 'high'; g.drawImage(src, rect.x + (f + 0.025) * s, rect.y + (r + 0.025) * s, s * 0.95, s * 0.95, 0, 0, N, N); out.push(features(c)); }
    return out;
  }
  // Ergebnis in Bildschirm-Reihenfolge (oben links zuerst). rect fehlt: Brett selbst suchen.
  async function recognize(src, opt) {
    opt = opt || {};
    const list = (await ready(opt.sets)).concat(opt.ignoreLearned ? [] : learned());
    const rect = opt.rect || findBoard(src);
    if (!rect) return null;
    const feats = cells(src, rect);
    const squares = feats.map((f) => { if (!f) return { code: null, sure: true }; const c = classify(f, list); return c ? { code: c.code, sure: c.sure, d: c.d } : { code: null, sure: false }; });
    return { rect, squares };
  }
  // Bestätigte Stellung als Vorlage merken (codes in Bildschirm-Reihenfolge)
  function learn(src, rect, codes) {
    const feats = cells(src, rect), old = learned(); let added = 0;
    codes.forEach((code, i) => {
      const f = feats[i]; if (!code || !f) return;
      if (old.some((t) => t.code === code && compare(f, t) < 0.2)) return;
      old.push({ code, m: f.m, g: f.g, a: f.a, h: f.h, w: f.w }); added++;
    });
    try { localStorage.setItem(STORE, JSON.stringify(old.slice(-MAXLEARN).map((t) => ({ code: t.code, m: Array.from(t.m, (v) => v ? '1' : '0').join(''), g: t.g, a: +t.a.toFixed(3), h: +t.h.toFixed(3), w: +t.w.toFixed(3) })))); } catch (e) { /* Speicher voll */ }
    return added;
  }
  window.BoardVision = { findBoard, recognize, learn, learnedCount: () => learned().length, forget: () => { try { localStorage.removeItem(STORE); } catch (e) { /* ok */ } } };
})();
