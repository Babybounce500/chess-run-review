/* Offline-Speicher. Netz zuerst, damit Updates sofort ankommen; ohne Netz (oder nach 4 s) die gespeicherte Fassung.
   VERSION und SHELL werden von tools/update-sw.mjs geschrieben. */
const PREFIX = 'shadowboxer-';
const VERSION = PREFIX + 'db1a53dead';
const SHELL = ["./","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable.png","index.html","manifest.webmanifest","src/career.js","src/config.js","src/hud.js","src/kit/audio.js","src/kit/controls.js","src/kit/net.js","src/kit/realtime.js","src/kit/shell.js","src/main.js","src/online.js","src/punchpad.js","src/rank.js","src/reaction.js","src/show.js","src/sim.js","src/sounds.js","src/training.js","src/view.js","style.css","vendor/three.module.js"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith(PREFIX) && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
async function answer(r) {
  const c = await caches.open(VERSION);
  const hit = await c.match(r, { ignoreSearch: true });
  const net = fetch(r).then((res) => { if (res.status === 200) c.put(r, res.clone()).catch(() => {}); return res; });
  if (hit) return Promise.race([net.catch(() => hit), new Promise((ok) => setTimeout(() => ok(hit), 4000))]);
  return net.catch(async () => (r.mode === 'navigate' && (await c.match('./'))) || Response.error());
}
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(answer(r));
});
