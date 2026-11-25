/* Orbitron Chat: Offline-Speicher. Netz zuerst, damit Änderungen sofort ankommen; ohne Netz (oder nach 5 s) die gespeicherte Fassung. */
const PREFIX = 'chat-shell-';                       // nur eigene Speicher anfassen: auf derselben Adresse liegen auch andere Apps
const C = PREFIX + 'v2';
const SHELL = ["./","manifest.webmanifest","icon-192.png","icon-512.png"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(C).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith(PREFIX) && k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
async function answer(r) {
  const c = await caches.open(C);
  let hit = await c.match(r, { ignoreSearch: true });
  if (!hit) { const p = new URL(r.url).pathname; if (p.endsWith('/index.html')) hit = await c.match(p.slice(0, -10)); }
  const net = fetch(r).then((res) => { if (res.status === 200) c.put(r, res.clone()).catch(() => {}); return res; });
  if (hit) return Promise.race([net.catch(() => hit), new Promise((ok) => setTimeout(() => ok(hit), 5000))]);
  // nie eine Seite anstelle eines Skripts oder Bildes liefern
  return net.catch(async () => (r.mode === 'navigate' && (await c.match('./'))) || Response.error());
}
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(answer(r));
});
self.addEventListener('message', (e) => {
  if (e.data !== 'offline-status' || !e.ports[0]) return;
  e.waitUntil(caches.open(C).then(async (c) => { let n = 0; for (const u of SHELL) if (await c.match(u, { ignoreSearch: true })) n++; e.ports[0].postMessage({ cached: n, total: SHELL.length, version: C }); }));
});
