// Gemeinsames Testgerüst (headless). Das Spiel stellt window.__game bereit:
//   __game.shell()  -> shell.snapshot()
//   __game.sim()    -> aktueller Spielzustand (JSON) oder null
// Nutzung: const T = await harness(); const p = await T.open({width:1280,height:720}); ... await T.done();
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

export async function harness(url = process.argv[2] || '') {
  let pass = 0, fail = 0, server = null, base = url;
  const sockets = new Set();
  if (!base) { ({ server } = await import('../server.js')); server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); }); await new Promise((r) => server.listen(0, '127.0.0.1', r)); base = 'http://127.0.0.1:' + server.address().port + '/'; }
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', protocolTimeout: 120000,
    args: ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--disable-features=WebRtcHideLocalIpsWithMdns', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 600) : '')); } return !!c; };
  const shell = (p) => p.evaluate(() => window.__game && window.__game.shell());
  const sim = (p) => p.evaluate(() => window.__game && window.__game.sim());
  async function until(fn, ms = 20000, what = '') { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { try { v = await fn(); if (v) return v; } catch (e) { /* lädt */ } await sleep(80); } console.log('    (Zeitüberschreitung: ' + what + ')'); return null; }
  async function open(viewport, query = '?speed=1') {
    const c = await browser.createBrowserContext(), p = await c.newPage(); p.errors = []; p.bad = []; p.external = [];
    p.on('pageerror', (e) => p.errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') p.errors.push(m.text()); });
    p.on('response', (r) => { if (r.status() >= 400) p.bad.push(r.status() + ' ' + r.url()); });
    p.on('request', (r) => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== new URL(base).origin) p.external.push(r.url()); });
    await p.setViewport(viewport); await p.goto(base + query, { waitUntil: 'load' }); await p.waitForFunction(() => window.__game, { timeout: 30000 }); return p;
  }
  async function shot(p, name) { const d = process.env.SHOT_DIR; if (d) { fs.mkdirSync(d, { recursive: true }); await p.screenshot({ path: path.join(d, name + '.png') }); } }
  // Zwei getrennte Browserprofile verbinden, genau wie echte Nutzer (Link hin, Antwort-Code zurück)
  async function pair(query = '?ice=none&nosw', vpA = { width: 1100, height: 700 }, vpB = { width: 390, height: 780, isMobile: true, hasTouch: true }) {
    const a = await open(vpA, query);
    await a.bringToFront(); await a.$eval('#nameIn', (e) => { e.value = 'Anna'; }); await a.click('#btnHost');
    await a.waitForFunction(() => document.getElementById('link').value.includes('#m='), { timeout: 20000 });
    const link = await a.$eval('#link', (e) => e.value);
    const b = await open(vpB, query + link.slice(link.indexOf('#')));
    await b.bringToFront(); await b.waitForSelector('#joinBtn', { visible: true }); await b.$eval('#nameIn', (e) => { e.value = 'Ben'; }); await b.click('#joinBtn');
    await b.waitForFunction(() => document.getElementById('answerOut').value.length > 80, { timeout: 20000 });
    const answer = await b.$eval('#answerOut', (e) => e.value);
    await a.bringToFront(); await a.$eval('#answerIn', (e, v) => { e.value = v; }, answer); await a.click('#connectBtn');
    const started = await until(async () => (await shell(a)).screen === 'play' && (await shell(b)).screen === 'play', 25000, 'beide im Spiel');
    return { a, b, link, started };
  }
  const offline = async (p) => { if (server) { server.close(); sockets.forEach((s) => s.destroy()); } else await p.setOfflineMode(true); await sleep(300); };
  async function done() { await browser.close(); if (server && server.listening) server.close(); console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`); process.exit(fail ? 1 : 0); }
  return { ok, open, shot, until, sleep, shell, sim, pair, offline, done, base, browser, abort: (e) => { fail++; console.log('ABBRUCH', e.stack); } };
}
