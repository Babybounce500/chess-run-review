/* Orbitron Offline-Speicher.
   Beim Bauen (scripts/build-live.mjs) werden CACHE_NAME (mit Inhalts-Prüfsumme) und SHELL (alle ausgelieferten Dateien) ersetzt.
   Die Liste hier gilt nur für den Betrieb direkt aus dem Quellordner. */
const CACHE_NAME='orbitron-chess-live-b1446be9ef';
const SHELL=["./CLAUDE-ADDONS/checkmate-library.html","./CLAUDE-ADDONS/eco-explorer.html","./CLAUDE-ADDONS/library-index.html","./CLAUDE-ADDONS/master-library.html","./CLAUDE-ADDONS/orbitron-eco-data.js","./CLAUDE-ADDONS/orbitron-rag-data.js","./chat/icon-192.png","./chat/icon-512.png","./chat/index.html","./chat/manifest.webmanifest","./chess-center.html","./chess-player-core.js","./chess-puzzles.html","./chess1v1.html","./duell/icon-192.png","./duell/icon-512.png","./duell/img/bB.png","./duell/img/bK.png","./duell/img/bN.png","./duell/img/bP.png","./duell/img/bQ.png","./duell/img/bR.png","./duell/img/board/holz-dunkel.jpg","./duell/img/board/holz-hell.jpg","./duell/img/flat/bB.png","./duell/img/flat/bK.png","./duell/img/flat/bN.png","./duell/img/flat/bP.png","./duell/img/flat/bQ.png","./duell/img/flat/bR.png","./duell/img/flat/wB.png","./duell/img/flat/wK.png","./duell/img/flat/wN.png","./duell/img/flat/wP.png","./duell/img/flat/wQ.png","./duell/img/flat/wR.png","./duell/img/wB.png","./duell/img/wK.png","./duell/img/wN.png","./duell/img/wP.png","./duell/img/wQ.png","./duell/img/wR.png","./duell/index.html","./duell/manifest.webmanifest","./duell/vendor/chess.js","./engine/data.js","./engine/img/bB.png","./engine/img/bK.png","./engine/img/bN.png","./engine/img/bP.png","./engine/img/bQ.png","./engine/img/bR.png","./engine/img/wB.png","./engine/img/wK.png","./engine/img/wN.png","./engine/img/wP.png","./engine/img/wQ.png","./engine/img/wR.png","./engine/index.html","./engine/vendor/GPL-3.0.txt","./engine/vendor/LICENSES.md","./engine/vendor/chess.js","./engine/vendor/stockfish.js","./engine/vendor/stockfish.wasm","./engine/vendor/stockfish.wasm.js","./gemini-chat.html","./gemini-player.html","./index.html","./mobile-chess.html","./neural-chess-mobile.html","./neural-chess.html","./orbitron-backup.js","./orbitron-basics.js","./orbitron-blunders.js","./orbitron-bullet.js","./orbitron-daily.js","./orbitron-dmatt.js","./orbitron-endgame.js","./orbitron-game-core.js","./orbitron-game.js","./orbitron-icon-192.png","./orbitron-icon-512.png","./orbitron-icon.svg","./orbitron-labor-data.js","./orbitron-labor.js","./orbitron-light.css","./orbitron-live.js","./orbitron-manifest.webmanifest","./orbitron-mate-puzzles.js","./orbitron-mfig.js","./orbitron-open.js","./orbitron-ownmates.js","./orbitron-play.js","./orbitron-profile-data.js","./orbitron-profile.js","./orbitron-repertoire.js","./orbitron-sacs.js","./orbitron-scan.js","./orbitron-tactics.js","./orbitron-tempo.js","./orbitron-time.js","./orbitron-timeheat.js","./orbitron-train.js","./orbitron-traps.js","./orbitron-zeitnot.js","./vendor/GPL-3.0.txt","./vendor/LICENSES.md","./vendor/bootstrap-icons/bootstrap-icons.min.css","./vendor/bootstrap-icons/fonts/bootstrap-icons.woff","./vendor/bootstrap-icons/fonts/bootstrap-icons.woff2","./vendor/chart.umd.js","./vendor/chess.min.js","./vendor/chessboardjs/chessboard-1.0.0.min.css","./vendor/chessboardjs/chessboard-1.0.0.min.js","./vendor/chessboardjs/img/bB.png","./vendor/chessboardjs/img/bK.png","./vendor/chessboardjs/img/bN.png","./vendor/chessboardjs/img/bP.png","./vendor/chessboardjs/img/bQ.png","./vendor/chessboardjs/img/bR.png","./vendor/chessboardjs/img/wB.png","./vendor/chessboardjs/img/wK.png","./vendor/chessboardjs/img/wN.png","./vendor/chessboardjs/img/wP.png","./vendor/chessboardjs/img/wQ.png","./vendor/chessboardjs/img/wR.png","./vendor/fonts/files/0338551ca1e9ae1d.woff2","./vendor/fonts/files/0a0d3f54f0b06ac9.woff2","./vendor/fonts/files/190c6cf9d95ff76a.woff2","./vendor/fonts/files/32420de8f0c67f83.woff2","./vendor/fonts/files/4a440f59a6bae9d2.woff2","./vendor/fonts/files/56df260a53225040.woff2","./vendor/fonts/files/6ffc02b6c5fc9ed6.woff2","./vendor/fonts/files/8214618b900de375.woff2","./vendor/fonts/files/8e4a09d010c5e94a.woff2","./vendor/fonts/files/a061760fd17d7860.woff2","./vendor/fonts/files/a9d11b3ffe7aa537.woff2","./vendor/fonts/files/adc5e3736f60deb9.woff2","./vendor/fonts/files/c7e4769c671876f1.woff2","./vendor/fonts/files/e10a82d0c6f86371.woff2","./vendor/fonts/files/e1f73fef40074ae6.woff2","./vendor/fonts/files/e3237528af752eed.woff2","./vendor/fonts/files/f5ace5d1121532d3.woff2","./vendor/fonts/inter.css","./vendor/fonts/orbitron-900.css","./vendor/fonts/orbitron-app.css","./vendor/fonts/orbitron.css","./vendor/highlight/atom-one-dark.min.css","./vendor/highlight/highlight.min.js","./vendor/jquery-3.6.0.min.js","./vendor/stockfish.js","./vendor/tailwind-3.4.17.js"];
const PREFIX='orbitron-chess-';                 // nur eigene Speicher anfassen: auf derselben Adresse liegen auch Chat und Duell
const TIMEOUT=5000;                             // schwaches Netz: nach 5 s die gespeicherte Fassung zeigen

self.addEventListener('install',event=>{
  // Alles oder nichts: fehlt eine Datei, bleibt die bisherige Fassung aktiv und der Browser versucht es später erneut
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key))
  )).then(()=>self.clients.claim()));
});

async function stored(cache,request){
  const hit=await cache.match(request,{ignoreSearch:true});
  if(hit)return hit;
  const url=new URL(request.url);
  if(url.pathname.endsWith('/'))return cache.match(url.pathname+(url.pathname===new URL(self.registration.scope).pathname?'gemini-chat.html':'index.html'));
  return undefined;
}

function offlinePage(){
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Offline</title><body style="font-family:system-ui;padding:24px"><h1>Offline</h1><p>Diese Seite ist nicht gespeichert.</p><p><a href="'+self.registration.scope+'gemini-chat.html">Zurück zu Orbitron</a></p>',
    {status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
}

async function answer(request){
  const cache=await caches.open(CACHE_NAME);
  const hit=await stored(cache,request);
  // Mitgelieferte Bibliotheken (Stockfish, Schriften …) ändern sich nur zusammen mit dem Speichernamen: sofort aus dem Speicher
  if(hit&&new URL(request.url).pathname.includes('/vendor/'))return hit;      // gilt auch für engine/vendor/ (Stockfish WebAssembly)
  const net=fetch(request).then(response=>{
    if(response.status===200)cache.put(request,response.clone()).catch(()=>{});
    return response;
  });
  if(hit)return Promise.race([net.catch(()=>hit),new Promise(resolve=>setTimeout(()=>resolve(hit),TIMEOUT))]);
  // Nie eine Seite anstelle eines Skripts oder Bildes liefern
  return net.catch(()=>request.mode==='navigate'?offlinePage():Response.error());
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  event.respondWith(answer(request));
});

// Die Seite fragt: Wie viel ist gespeichert?
self.addEventListener('message',event=>{
  if(event.data!=='offline-status'||!event.ports[0])return;
  event.waitUntil(caches.open(CACHE_NAME).then(async cache=>{
    let cached=0;
    for(const url of SHELL)if(await cache.match(url,{ignoreSearch:true}))cached++;
    event.ports[0].postMessage({cached,total:SHELL.length,version:CACHE_NAME});
  }));
});
