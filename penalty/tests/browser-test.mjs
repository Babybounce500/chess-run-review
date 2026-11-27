// Browser-Test (headless): echte Wischgesten, Tipps und Tasten.
//   node tests/browser-test.mjs                 startet den Server selbst
//   node tests/browser-test.mjs https://.../    prüft eine veröffentlichte Fassung
// Braucht puppeteer-core (npm install) und Chrome (Variable CHROME). SHOT_DIR=<ordner> speichert Bilder.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const LIVE = process.argv[2] || '';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOTS = process.env.SHOT_DIR || '';
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  -> ' + JSON.stringify(x) : '')); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Echte Grafikkarte, falls vorhanden (auch unsichtbar); GL=swiftshader rechnet alles auf dem Prozessor
const GPU = process.env.GL === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader'];
let server = null, base = LIVE, browser;
const sockets = new Set();
if (!LIVE) { ({ server } = await import('../server.js')); server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); }); await new Promise((r) => server.listen(0, '127.0.0.1', r)); base = 'http://127.0.0.1:' + server.address().port + '/'; }
browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', protocolTimeout: 90000, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', ...GPU] });

const st = (p) => p.evaluate(() => window.__penalty && window.__penalty.state());
async function until(p, pred, ms = 20000, what = '') { const t0 = Date.now(); let s; while (Date.now() - t0 < ms) { try { s = await st(p); if (s && pred(s)) return s; } catch (e) { /* lädt */ } await sleep(60); } console.log('    (Zeitüberschreitung: ' + what + ' ' + JSON.stringify(s && { screen: s.screen, phase: s.phase, shooter: s.shooter, kicks: s.kicks, t: s.t }) + ')'); return null; }
async function open(vp, query = '?speed=1', ctx) {
  const c = ctx || (await browser.createBrowserContext()); const p = await c.newPage(); p.errors = []; p.bad = []; p.external = [];
  p.on('pageerror', (e) => p.errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') p.errors.push(m.text()); });
  p.on('response', (r) => { if (r.status() >= 400) p.bad.push(r.status() + ' ' + r.url()); });
  p.on('request', (r) => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== new URL(base).origin) p.external.push(r.url()); });
  await p.setViewport(vp); await p.goto(base + query, { waitUntil: 'load' }); await p.waitForFunction(() => window.__penalty, { timeout: 30000 });
  return p;
}
const shot = async (p, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, name + '.png') }); } };
// Echter Wisch: dx/dy als Anteil der Bezugsgröße, Dauer in ms, bend = seitlicher Bogen
async function swipe(p, dx, dy, ms, bend = 0, touch = false) {
  const v = p.viewport(), unit = Math.min(v.width * 1.25, v.height), x0 = v.width / 2, y0 = v.height * 0.82, n = 14;
  const pt = (i) => { const u = i / n; return [x0 + dx * unit * u + Math.sin(u * Math.PI) * bend * unit, y0 - dy * unit * u]; };
  if (touch) { const t = await p.touchscreen.touchStart(...pt(0)); for (let i = 1; i <= n; i++) { await sleep(ms / n); await t.move(...pt(i)); } await t.end(); }
  else { await p.mouse.move(...pt(0)); await p.mouse.down(); for (let i = 1; i <= n; i++) { await sleep(ms / n); await p.mouse.move(...pt(i)); } await p.mouse.up(); }
}
async function tapGoal(p, x, y, touch) { const s = await p.evaluate((x, y) => window.__penalty.project(x, y, -10.65), x, y); if (touch) await p.touchscreen.tap(s.x, s.y); else await p.mouse.click(s.x, s.y); return s; }
const total = (s) => s.kicks[0].length + s.kicks[1].length;

try {
  console.log('1  Start und Menü (Desktop)');
  const p = await open({ width: 1280, height: 720 });
  let s = await st(p);
  ok('Menü sichtbar, Spiel läuft im Hintergrund', s.screen === 'menu' && !(await p.$eval('#menu', (e) => e.hidden)));
  await shot(p, '01-menu-desktop');
  await p.$eval('#nameIn', (e) => { e.value = 'Dom'; }); await p.click('[data-level="easy"]');
  ok('Schwierigkeit wählbar', await p.$eval('[data-level="easy"]', (e) => e.getAttribute('aria-pressed') === 'true'));
  await p.click('#btnSolo');
  s = await until(p, (x) => x.screen === 'play' && x.phase === 'choose', 15000, 'start');
  ok('Solo startet', !!s && s.mode === 'solo' && s.names[0] === 'Dom');

  console.log('2  Ganzes Spiel mit echten Gesten');
  let shots = 0, dives = 0, swiped = null, curveSeen = false, keyShot = false, keyDive = false, guard = 0, imgShoot = false, imgKeep = false;
  while (guard++ < 40) {
    s = await until(p, (x) => (x.phase === 'choose') || x.winner !== null, 30000, 'naechster schuss');
    if (!s || s.winner !== null) break;
    const before = total(s);
    if (s.shooter === 0) {
      shots++;
      if (shots === 1) { await sleep(500); await shot(p, '02-shoot-desktop'); await swipe(p, 0.14, 0.2, 130); swiped = 'mouse'; }
      else if (shots === 2) { await swipe(p, -0.12, 0.17, 150, 0.07); curveSeen = true; }
      else if (shots === 3) { await p.keyboard.down('ArrowLeft'); await sleep(200); await p.keyboard.up('ArrowLeft'); await p.keyboard.down('Space'); await sleep(260); await p.keyboard.up('Space'); keyShot = true; }
      else await swipe(p, 0.1, 0.18, 140);
      if (!imgShoot) { await until(p, (x) => x.phase === 'play' && x.t > 0.25, 8000, 'flug'); await shot(p, '03-flight-desktop'); await until(p, (x) => x.phase !== 'play' || x.t > 1.0, 8000, 'nach'); await shot(p, '04-after-desktop'); imgShoot = true; }
    } else {
      dives++;
      if (dives === 1) { await sleep(150); await shot(p, '05-keep-desktop'); await tapGoal(p, 1.6, 0.8); }
      else if (dives === 2) { await sleep(120); await p.keyboard.press('KeyQ'); keyDive = true; }
      else await tapGoal(p, -1.4, 0.5);
      if (!imgKeep) { const d = await until(p, (x) => x.phase === 'play' && x.t > 0.4, 8000, 'parade'); await shot(p, '06-dive-desktop'); imgKeep = !!d; }
    }
    s = await until(p, (x) => total(x) > before || x.winner !== null, 20000, 'gewertet');
    if (!s) break;
    if (s.shooter !== undefined && shots === 1 && s.last && s.last.shooter === 0) { ok('Maus-Wisch nach oben rechts schießt nach rechts', s.last.shot.aimX > 0.2 && s.last.shot.power > 0.08, s.last.shot); shots = 1.0001; shots = 1; }
    if (curveSeen && s.last && s.last.shooter === 0 && shots === 2) { ok('Gebogener Wisch gibt Effet', Math.abs(s.last.shot.curve) > 0.25 && s.last.shot.aimX < -0.15, s.last.shot); curveSeen = false; }
    if (keyShot && s.last && s.last.shooter === 0 && shots === 3) { ok('Tastatur: Pfeil zielt links, Leertaste lädt', s.last.shot.aimX < -0.15 && s.last.shot.power > 0.05 && s.last.shot.power < 0.9, s.last.shot); keyShot = false; }
    if (dives === 1 && s.last && s.last.shooter === 1) { ok('Klick aufs Tor lässt den Torwart dorthin springen', s.last.dive.x > 0.4 && s.last.dive.x < 0.95 && s.last.dive.start < 3, s.last.dive); }
    if (keyDive && s.last && s.last.shooter === 1 && dives === 2) { ok('Taste Q springt oben auf die linke Bildschirmseite', s.last.dive.y > 0.7 && s.last.dive.x > 0.7, s.last.dive); keyDive = false; }
  }
  s = await until(p, (x) => x.screen === 'end', 20000, 'ende');
  ok('Spiel endet mit Sieger und Ergebnisbild', !!s && s.winner !== null && total(s) >= 6, s && s.kicks);
  const sounds = await p.evaluate(() => window.__penalty.sounds());
  ok('Ton: Pfiff, Schritte, Schuss', ['whistle', 'step', 'kick'].every((n) => sounds.includes(n)), [...new Set(sounds)]);
  ok('Bilanz wird gemerkt', /Siege: [0-9]/.test(await p.$eval('#endRecord', (e) => e.textContent)));
  await shot(p, '07-end-desktop');
  await p.click('#btnAgain'); s = await until(p, (x) => x.screen === 'play' && x.phase === 'choose' && total(x) === 0, 10000, 'nochmal');
  ok('„Noch einmal“ startet neu', !!s);
  await p.click('#btnPause'); s = await st(p);
  const t0 = await p.evaluate(() => document.getElementById('pause').hidden);
  ok('Pause hält an', s.screen === 'pause' && s.paused && !t0);
  await p.click('#btnResume'); ok('Weiter', (await st(p)).screen === 'play' && !(await st(p)).paused);
  await p.click('#btnSound'); ok('Ton abschaltbar und gemerkt', await p.evaluate(() => localStorage.getItem('penalty_sound') === '0'));
  await p.click('#btnSound'); await p.click('#btnPause'); await p.click('#btnQuit'); ok('Zurück ins Menü', (await st(p)).screen === 'menu');
  ok('Keine Skriptfehler, keine fehlenden Dateien', !p.errors.length && !p.bad.length, [p.errors, p.bad]);
  ok('Keine Anfragen an fremde Server', !p.external.length, p.external);

  await p.close();

  console.log('3  Handy (Touch)');
  for (const [name, vp] of [['hoch', { width: 390, height: 844, isMobile: true, hasTouch: true }], ['quer', { width: 844, height: 390, isMobile: true, hasTouch: true }], ['klein', { width: 320, height: 568, isMobile: true, hasTouch: true }]]) {
    const m = await open(vp);
    const menu = await m.evaluate(() => { const c = document.querySelector('#menu .card').getBoundingClientRect(), b = document.getElementById('btnSolo').getBoundingClientRect(); return { w: document.documentElement.scrollWidth <= innerWidth, card: c.left >= 0 && c.right <= innerWidth + 1, solo: b.bottom <= innerHeight + 1, small: [...document.querySelectorAll('#menu button')].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 40).length }; });
    ok(name + ': Menü passt, Startknopf sichtbar, große Knöpfe', menu.w && menu.card && menu.solo && !menu.small, menu);
    await shot(m, '10-menu-' + name);
    await m.tap('#btnSolo');
    let x = await until(m, (v) => v.screen === 'play' && v.phase === 'choose', 15000, 'start ' + name);
    const geo = async () => m.evaluate(() => { const P = window.__penalty.project; const a = P(-3, 2.4, -11), b = P(3, 0, -11), ball = P(0, 0.14, 0); const h = document.querySelector('.score').getBoundingClientRect(); return { l: a.x, r: b.x, top: a.y, bottom: b.y, bx: ball.x, by: ball.y, w: innerWidth, h: innerHeight, hud: h.bottom, goalW: b.x - a.x }; });
    await sleep(600);
    let done = { shoot: false, keep: false };
    for (let i = 0; i < 4 && !(done.shoot && done.keep); i++) {
      x = await until(m, (v) => v.phase === 'choose' || v.winner !== null, 30000, 'kick ' + name); if (!x || x.winner !== null) break;
      await sleep(250); const g = await geo(), before = total(x), shooting = x.shooter === 0;
      if (!done[shooting ? 'shoot' : 'keep']) {
        ok(name + (shooting ? ' schießen' : ' halten') + ': ganzes Tor sichtbar, unter der Anzeige, mindestens 55 % breit' + (name === 'quer' ? ' (quer 28 %)' : ''), Math.min(g.l, g.r) >= -2 && Math.max(g.l, g.r) <= g.w + 2 && g.top > g.hud - 4 && g.bottom < g.h && Math.abs(g.goalW) / g.w > (name === 'quer' ? 0.28 : 0.55), g);
        if (shooting) ok(name + ' schießen: Ball sichtbar', g.bx > 0 && g.bx < g.w && g.by > 0 && g.by < g.h, g);
        await shot(m, '11-' + (shooting ? 'shoot' : 'keep') + '-' + name);
      }
      if (shooting) await swipe(m, 0.12, 0.19, 130, 0, true); else await tapGoal(m, 1.2, 0.7, true);
      if (!shooting && !done.keep) { await until(m, (v) => v.phase === 'play' && v.t > 0.45, 8000, 'dive'); await shot(m, '12-dive-' + name); }
      if (shooting && !done.shoot) { await until(m, (v) => v.phase === 'play' && v.t > 0.55, 8000, 'goal'); await shot(m, '12-shot-' + name); }
      x = await until(m, (v) => total(v) > before, 20000, 'wertung ' + name);
      if (x) { ok(name + (shooting ? ': Finger-Wisch schießt' : ': Antippen springt'), shooting ? x.last.shot.aimX > 0.1 : x.last.dive.x > 0.2, x.last); done[shooting ? 'shoot' : 'keep'] = true; }
    }
    ok(name + ': Schießen und Halten geprüft, keine Fehler', done.shoot && done.keep && !m.errors.length, [done, m.errors]);
    await m.close();
  }

  console.log('4  Bildrate und Offline');
  const f = await open({ width: 800, height: 600 }, '?speed=1');
  await sleep(4000);
  ok('Offline-Speicher wird angelegt', await f.evaluate(async () => { await navigator.serviceWorker.ready; const k = await caches.keys(); if (!k.length) return false; return (await (await caches.open(k[0])).keys()).length >= 12; }));
  if (!LIVE) { server.close(); sockets.forEach((x) => x.destroy()); } else await f.setOfflineMode(true);
  await sleep(300); f.errors.length = 0;
  await f.reload({ waitUntil: 'load', timeout: 30000 }); await f.waitForFunction(() => window.__penalty, { timeout: 30000 });
  await f.click('#btnSolo'); ok('Ohne Netz: Spiel startet und läuft', !!(await until(f, (v) => v.screen === 'play' && v.phase === 'choose', 15000, 'offline')) && !f.errors.length, f.errors);
} catch (e) { fail++; console.log('ABBRUCH', e.stack); }
await browser.close(); if (server && server.listening) server.close();
console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
