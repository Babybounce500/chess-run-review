// Lokaler Server fuer die Lc0-Seite: startet lc0.exe (UCI) und stellt die Engine per HTTP bereit.
//   node lc0-server.js [port]     (Standard 8791, nur auf diesem Rechner erreichbar)
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const ROOT = __dirname, ENG = path.join(ROOT, 'engine'), PORT = +(process.argv[2] || process.env.PORT || 8791);
const NETS = {
  'maia-1100': { file: 'maia-1100.pb.gz', name: 'Maia 1100 (Spieler wie du bei Bullet)', human: true },
  'maia-1500': { file: 'maia-1500.pb.gz', name: 'Maia 1500 (Spieler wie du bei Blitz)', human: true },
  'maia-1900': { file: 'maia-1900.pb.gz', name: 'Maia 1900 (starker Vereinsspieler)', human: true },
  'strong': { file: '791556.pb.gz', name: 'Lc0 stark (Netz 791556, langsam auf der CPU)', human: false }
};
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml' };

// ---- Ein Lc0-Prozess je Netz, Anfragen laufen nacheinander ----
const procs = {};
function getProc(key) {
  if (procs[key]) return procs[key];
  const net = NETS[key]; const p = spawn(path.join(ENG, 'lc0.exe'), [], { cwd: ENG, stdio: ['pipe', 'pipe', 'ignore'] });
  const st = { p, buf: '', wait: null, queue: Promise.resolve(), ready: null };
  p.stdout.on('data', (d) => { st.buf += d; let i; while ((i = st.buf.indexOf('\n')) >= 0) { const l = st.buf.slice(0, i).trim(); st.buf = st.buf.slice(i + 1); if (st.wait) st.wait(l); } });
  p.on('exit', () => { delete procs[key]; });
  st.send = (s) => p.stdin.write(s + '\n');
  st.until = (cmd, test) => new Promise((res) => { const acc = []; st.wait = (l) => { acc.push(l); if (test(l)) { st.wait = null; res(acc); } }; if (cmd) st.send(cmd); });
  st.ready = (async () => {
    await st.until('uci', (l) => l === 'uciok');
    st.send('setoption name WeightsFile value ' + net.file); st.send('setoption name VerboseMoveStats value true'); st.send('setoption name Threads value 2');
    await st.until('isready', (l) => l === 'readyok');
  })();
  return (procs[key] = st);
}
function cpOf(q) { return Math.round(90 * Math.tan(1.5637541897 * Math.max(-0.9999, Math.min(0.9999, q)))); }
function go(key, fen, nodes, movetime) {
  const st = getProc(key);
  const job = st.queue.then(async () => {
    await st.ready;
    st.send('position fen ' + fen);
    const out = await st.until('go ' + (movetime ? 'movetime ' + movetime : 'nodes ' + nodes), (l) => l.startsWith('bestmove'));
    const moves = []; let root = null, nps = null;
    for (const l of out) {
      const m = l.match(/^info string (\w{4,5})\s+\(\d+\s*\)\s+N:\s*(\d+).*\(P:\s*([\d.]+)%\)\s+\(WL:\s*(-?[\d.]+|-\.-+)\).*\(Q:\s*(-?[\d.]+)\)/);
      if (m) moves.push({ uci: m[1], n: +m[2], p: +m[3], q: +m[5] });
      const r = l.match(/^info string node\s+\(\s*\d+\)\s+N:\s*(\d+).*\(WL:\s*(-?[\d.]+)\)\s+\(D:\s*([\d.]+)\)/); if (r) root = { n: +r[1], wl: +r[2], d: +r[3] };
      const s = l.match(/ nps (\d+)/); if (s) nps = +s[1];
    }
    // Rochade steht bei Lc0 als "Koenig schlaegt eigenen Turm" (e1h1); in normale Schreibweise umwandeln
    const fix = { e1h1: 'e1g1', e1a1: 'e1c1', e8h8: 'e8g8', e8a8: 'e8c8' };
    const board = fen.split(' ')[0].split('/'); const kingSq = (u) => { const f = u.charCodeAt(0) - 97, r = 8 - +u[1]; let c = 0; for (const ch of board[r]) { if (/\d/.test(ch)) c += +ch; else { if (c === f) return ch; c++; } } return null; };
    const norm = (u) => (fix[u] && /[Kk]/.test(kingSq(u) || '') ? fix[u] : u);
    for (const m of moves) m.uci = norm(m.uci);
    moves.sort((a, b) => b.n - a.n || b.p - a.p);
    let bm = out.find((l) => l.startsWith('bestmove')).split(' ')[1]; bm = norm(bm);
    // Bewertung aus Sicht des Spielers am Zug (WL -1..1)
    const q = root ? root.wl : (moves[0] ? moves[0].q : 0);
    return { bestmove: bm, moves, q, cp: cpOf(q), win: Math.round((1 + q) * 50), draw: root ? root.d : null, nodes: root ? root.n : null, nps };
  });
  st.queue = job.catch(() => {});
  return job;
}

function body(req) { return new Promise((res, rej) => { let b = ''; req.on('data', (d) => { b += d; if (b.length > 1e6) rej(new Error('zu gross')); }); req.on('end', () => { try { res(JSON.parse(b || '{}')); } catch (e) { rej(e); } }); }); }
const FEN_RE = /^[rnbqkpRNBQKP1-8/]+ [wb] (-|[KQkqA-Ha-h]+) (-|[a-h][36]) \d+ \d+$/;

// Erlaubt sind nur die eigene Seite, localhost und die GitHub-Pages-Seite (damit die veroeffentlichte Seite die lokale Engine nutzen kann).
const ORIGIN_OK = (o) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o || '') || o === 'https://babybounce500.github.io';
http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const origin = req.headers.origin; const cors = ORIGIN_OK(origin) ? { 'access-control-allow-origin': origin, 'access-control-allow-private-network': 'true', 'vary': 'Origin' } : {};
  if (req.method === 'OPTIONS') { res.writeHead(ORIGIN_OK(origin) ? 204 : 403, { ...cors, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' }); return res.end(); }
  if (origin && !ORIGIN_OK(origin)) { res.writeHead(403); return res.end(); }
  const json = (c, o) => { res.writeHead(c, { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)); };
  try {
    if (req.method === 'GET' && url === '/api/nets') return json(200, Object.entries(NETS).map(([k, v]) => ({ id: k, name: v.name, human: v.human, ok: fs.existsSync(path.join(ENG, v.file)) })));
    if (req.method === 'POST' && url === '/api/go') {
      const b = await body(req);
      if (!NETS[b.net] || !FEN_RE.test(String(b.fen || ''))) return json(400, { error: 'Ungueltige Anfrage' });
      const nodes = Math.max(1, Math.min(20000, +b.nodes || 1)), movetime = b.movetime ? Math.max(100, Math.min(30000, +b.movetime)) : 0;
      return json(200, await go(b.net, b.fen, nodes, movetime));
    }
    if (req.method === 'GET') {
      const rel = url === '/' ? '/lc0-live.html' : decodeURIComponent(url); const f = path.join(ROOT, rel);
      if (!f.startsWith(ROOT) || f.startsWith(ENG) || path.basename(f) === 'lc0-server.js' || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nicht gefunden'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); return fs.createReadStream(f).pipe(res);
    }
    res.writeHead(404); res.end();
  } catch (e) { json(500, { error: String(e.message || e) }); }
}).listen(PORT, '127.0.0.1', () => console.log('Lc0-Seite: http://localhost:' + PORT + '/'));
process.on('exit', () => { for (const k in procs) try { procs[k].p.kill(); } catch (e) { /* ignorieren */ } });
