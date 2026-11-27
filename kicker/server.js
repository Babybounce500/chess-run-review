// Kleiner Webserver ohne Abhängigkeiten (lokal oder auf Replit). Start: node server.js   Port: $PORT oder 5000
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };
// Nur diese Bereiche sind öffentlich
const PUBLIC = /^\/(index\.html|style\.css|sw\.js|manifest\.webmanifest|(src|vendor|icons|assets)(\/[\w-][\w.-]*)+)$/;

export const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (p === '/healthz') return res.end('ok');
  if (p === '/') p = '/index.html';
  if ((req.method !== 'GET' && req.method !== 'HEAD') || !PUBLIC.test(p) || p.includes('..')) { res.writeHead(404); return res.end('nicht gefunden'); }
  fs.readFile(path.join(ROOT, p), (err, data) => {
    if (err) { res.writeHead(404); return res.end('nicht gefunden'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});
if (process.argv[1] === fileURLToPath(import.meta.url)) { const port = Number(process.env.PORT) || 5000; server.listen(port, '0.0.0.0', () => console.log('Spiel läuft auf http://localhost:' + port)); }
