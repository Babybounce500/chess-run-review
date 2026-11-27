// Online-Test: zwei getrennte Browserprofile spielen ein ganzes Elfmeterschießen gegeneinander (Code-Austausch wie bei echten Nutzern).
//   node tests/online-test.mjs [https://.../]
// Optional SHOT_DIR=<ordner>. Verbindung läuft lokal ohne STUN (?ice=none).
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
let server = null, base = LIVE;
if (!LIVE) { ({ server } = await import('../server.js')); await new Promise((r) => server.listen(0, '127.0.0.1', r)); base = 'http://127.0.0.1:' + server.address().port + '/'; }
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', protocolTimeout: 90000, args: ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader', '--disable-features=WebRtcHideLocalIpsWithMdns', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const st = (p) => p.evaluate(() => window.__penalty && window.__penalty.state());
async function until(p, pred, ms = 20000, what = '') { const t0 = Date.now(); let s; while (Date.now() - t0 < ms) { try { s = await st(p); if (s && pred(s)) return s; } catch (e) { /* lädt */ } await sleep(60); } console.log('    (Zeitüberschreitung: ' + what + ' bei ' + p.label + ' ' + JSON.stringify(s && { screen: s.screen, phase: s.phase, k: s.k, shooter: s.shooter, conn: s.conn, committed: s.committed }) + ')'); return null; }
async function player(label, vp, query) {
  const c = await browser.createBrowserContext(); const p = await c.newPage(); p.label = label; p.errors = [];
  p.on('pageerror', (e) => p.errors.push(e.message)); await p.setViewport(vp);
  await p.goto(base + query, { waitUntil: 'load' }); await p.waitForFunction(() => window.__penalty, { timeout: 30000 }); return p;
}
const shot = async (p, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, name + '.png') }); } };
const Q = '?ice=none&nosw&speed=2';
async function pair(query = Q) {
  const a = await player('Anna', { width: 1100, height: 700 }, query);
  await a.bringToFront(); await a.$eval('#nameIn', (e) => { e.value = 'Anna'; }); await a.click('#btnHost');
  await a.waitForFunction(() => document.getElementById('link').value.includes('#m='), { timeout: 20000 });
  const link = await a.$eval('#link', (e) => e.value);
  const b = await player('Ben', { width: 390, height: 780, isMobile: true, hasTouch: true }, query + link.slice(link.indexOf('#')));
  await b.bringToFront(); await b.waitForSelector('#joinBtn', { visible: true }); await b.$eval('#nameIn', (e) => { e.value = 'Ben'; });
  await shot(b, '20-invite-phone');
  const inviter = await b.$eval('#inviter', (e) => e.textContent);
  await b.click('#joinBtn'); await b.waitForFunction(() => document.getElementById('answerOut').value.length > 80, { timeout: 20000 });
  const answer = await b.$eval('#answerOut', (e) => e.value);
  await a.bringToFront(); await a.$eval('#answerIn', (e, v) => { e.value = v; }, answer); await a.click('#connectBtn');
  return { a, b, link, answer, inviter };
}
const total = (s) => s.kicks[0].length + s.kicks[1].length;

try {
  console.log('1  Verbinden');
  const { a, b, link, inviter } = await pair();
  ok('Einladungslink führt auf diese Seite', link.startsWith(base) && link.includes('#m='));
  ok('Gast sieht, wer einlädt', /Anna fordert dich/.test(inviter), inviter);
  let x = await until(a, (s) => s.screen === 'play' && s.phase === 'choose', 25000, 'start'), y = await until(b, (s) => s.screen === 'play' && s.phase === 'choose', 25000, 'start');
  ok('Beide sind im Spiel und verbunden', !!x && !!y && x.conn === 'open' && y.conn === 'open');
  ok('Namen auf beiden Seiten gleich', !!x && !!y && x.names.join() === 'Anna,Ben' && y.names.join() === 'Anna,Ben', [x && x.names, y && y.names]);
  ok('Einer schießt, der andere hält', x.shooter === y.shooter && x.input !== y.input && [x.input, y.input].sort().join() === 'dive,shoot', [x.input, y.input]);

  console.log('2  Chat');
  await b.bringToFront(); await b.click('#btnChat'); await b.type('#chatIn', 'Los <b>gehts</b>'); await b.click('#chatSend');
  x = await until(a, (s) => s.chat.length === 1, 5000, 'chat');
  ok('Nachricht kommt an, HTML wird nicht ausgeführt', !!x && x.chat[0] === 'er: Los bgehts/b' && x.unread === 1 && (await a.$$eval('#chatList b', (l) => l.length)) === 0, x && x.chat);
  await b.click('#chatClose'); await a.bringToFront(); await a.click('#btnChat'); await a.click('[data-q="GG"]');
  ok('Schnellantwort kommt an', !!(await until(b, (s) => s.chat.includes('er: GG'), 5000, 'gg')));
  await a.click('#chatClose');

  console.log('3  Ganzes Spiel');
  let kicks = 0, agreed = true, waited = false, hidden = true, results = [];
  while (kicks < 30) {
    x = await until(a, (s) => (s.phase === 'choose' && total(s) === kicks) || s.winner !== null, 30000, 'a ' + kicks);
    y = await until(b, (s) => (s.phase === 'choose' && total(s) === kicks) || s.winner !== null, 30000, 'b ' + kicks);
    if (!x || !y || x.winner !== null) break;
    const shooter = x.shooter === 0 ? a : b, keeper = x.shooter === 0 ? b : a;
    // abwechselnd legt mal der Schütze, mal der Torwart zuerst fest
    const doShoot = () => shooter.evaluate((i) => window.__penalty.shoot({ aimX: [0.75, -0.7, 0.5, -0.3, 0.9][i % 5], aimY: [0.2, 0.6, 0.45, 0.15, 0.3][i % 5], power: 0.68, curve: 0 }), kicks);
    const doDive = () => keeper.evaluate((i) => window.__penalty.dive({ x: [-0.8, -0.7, 0.2, 0.8, 0.9][i % 5], y: 0.25 }), kicks);
    const first = kicks % 2 ? [doDive, keeper, doShoot, shooter] : [doShoot, shooter, doDive, keeper];
    await first[1].bringToFront(); await first[0]();
    if (!waited) {
      await sleep(700); const w = await st(first[1]), o = await st(first[3]);
      ok('Erste Wahl wartet verdeckt auf die zweite', w.committed && w.phase === 'choose' && o.phase === 'choose' && !o.committed && w.outcome === null, [w.phase, o.phase]);
      ok('Der Wartende sieht noch nichts vom Ergebnis', o.outcome === null && o.last === null); waited = true;
      await shot(first[1], '21-warten');
    }
    await first[3].bringToFront(); await first[2]();
    if (kicks === 0) { await until(a, (s) => s.phase === 'play' && s.t > 0.3, 10000, 'flug'); await shot(a, '22-flight-host'); await b.bringToFront(); await shot(b, '23-flight-guest'); }
    x = await until(a, (s) => total(s) > kicks, 30000, 'wertung a'); y = await until(b, (s) => total(s) > kicks, 30000, 'wertung b');
    if (!x || !y) break;
    if (JSON.stringify(x.kicks) !== JSON.stringify(y.kicks) || x.last.outcome !== y.last.outcome || JSON.stringify(x.last.shot) !== JSON.stringify(y.last.shot) || JSON.stringify(x.last.dive) !== JSON.stringify(y.last.dive)) { agreed = false; console.log('    Abweichung', x.last, y.last); }
    results.push(x.last.outcome); kicks++;
  }
  console.log('    Ausgänge: ' + results.join(', '));
  ok('Beide Browser kommen bei jedem Schuss zum selben Ergebnis', agreed && kicks >= 6, kicks);
  x = await until(a, (s) => s.screen === 'end', 20000, 'ende a'); y = await until(b, (s) => s.screen === 'end', 20000, 'ende b');
  ok('Spiel endet bei beiden mit demselben Sieger', !!x && !!y && x.winner === y.winner, [x && x.winner, y && y.winner]);
  const ta = await a.$eval('#endTitle', (e) => e.textContent), tb = await b.$eval('#endTitle', (e) => e.textContent);
  ok('Einer gewinnt, einer verliert', /Gewonnen/.test(ta) !== /Gewonnen/.test(tb), [ta, tb]);
  ok('Bilanz gegen den Freund', /Bilanz gegen Ben/.test(await a.$eval('#endRecord', (e) => e.textContent)));
  await shot(b, '24-end-guest');

  console.log('4  Revanche und Fälschungen');
  const firstBefore = (await st(a)).kicks;
  await b.bringToFront(); await b.click('#btnAgain');
  ok('Gast fragt Revanche an, Host sieht das', !!(await until(a, () => true, 100)) && !!(await a.waitForFunction(() => /annehmen/.test(document.getElementById('btnAgain').textContent), { timeout: 8000 })));
  await a.bringToFront(); await a.click('#btnAgain');
  x = await until(a, (s) => s.phase === 'choose' && total(s) === 0, 10000, 'revanche a'); y = await until(b, (s) => s.phase === 'choose' && total(s) === 0, 10000, 'revanche b');
  ok('Revanche startet bei beiden bei 0 : 0', !!x && !!y && x.shooter === y.shooter, [firstBefore.map((k) => k.length)]);
  // Unsinn ändert nichts
  await b.evaluate(() => { const r = window.__penalty.raw; r({ t: 'reveal', k: 0, c: 'x', n: 'y' }); r({ t: 'commit', k: 99, h: 'a'.repeat(64) }); r({ t: 'start', first: 5 }); r({ t: 'rematch' }); r({ t: 'chat', x: 123456 }); r({ t: 'quatsch' }); });
  await sleep(500); x = await st(a);
  ok('Unsinnige Nachrichten ändern nichts', x.phase === 'choose' && total(x) === 0 && x.screen === 'play' && !a.errors.length, [x.phase, x.screen, a.errors]);
  // Gefälschte Aufdeckung: Prüfsumme passt nicht
  const hostShoots = x.shooter === 0;
  await a.bringToFront(); await a.evaluate((s) => (s ? window.__penalty.shoot({ aimX: 0.5, aimY: 0.3, power: 0.6 }) : window.__penalty.dive({ x: 0, y: 0.3 })), hostShoots);
  await b.evaluate(() => { window.__penalty.raw({ t: 'commit', k: 0, h: 'b'.repeat(64) }); window.__penalty.raw({ t: 'reveal', k: 0, c: '{"aimX":1,"aimY":1,"power":1}', n: 'a'.repeat(32) }); });
  x = await until(a, (s) => s.screen === 'lost', 8000, 'betrug');
  ok('Aufdeckung passt nicht zur Prüfsumme: Partie wird abgebrochen', !!x && /Prüfsumme/.test(await a.$eval('#lostText', (e) => e.textContent)));
  ok('Keine Skriptfehler', !a.errors.length && !b.errors.length, [a.errors, b.errors]);
  await a.browserContext().close(); await b.browserContext().close();

  console.log('5  Zeitlimit und Verlassen');
  const p2 = await pair('?ice=none&nosw&speed=2&choice=4');
  x = await until(p2.a, (s) => total(s) >= 1, 40000, 'auto'); y = await until(p2.b, (s) => total(s) >= 1, 40000, 'auto b');
  ok('Ohne Eingabe wird nach Ablauf automatisch gespielt, bei beiden gleich', !!x && !!y && x.last.outcome === y.last.outcome, [x && x.last, y && y.last]);
  await p2.b.bringToFront(); await p2.b.click('#btnPause'); await p2.b.click('#btnQuit');
  x = await until(p2.a, (s) => s.screen === 'lost', 8000, 'weg');
  ok('Verlassen wird dem anderen gemeldet', !!x && /Ben hat das Spiel verlassen/.test(await p2.a.$eval('#lostText', (e) => e.textContent)));
  await p2.a.bringToFront(); await p2.a.click('#lostMenu'); ok('Zurück ins Menü', (await st(p2.a)).screen === 'menu' && !p2.a.errors.length && !p2.b.errors.length);

  console.log('6  Verbindungsabbruch und falscher Code');
  const c = await player('Cleo', { width: 900, height: 700 }, Q);
  await c.click('#btnHost'); await c.waitForFunction(() => document.getElementById('link').value.includes('#m='), { timeout: 20000 });
  await c.$eval('#answerIn', (e) => { e.value = 'quatsch'; }); await c.click('#connectBtn'); await sleep(300);
  ok('Falscher Antwort-Code wird erklärt', /kein gültiger Antwort-Code/.test(await c.$eval('#lobbyErr', (e) => e.textContent)));
  const p3 = await pair();
  await until(p3.a, (s) => s.screen === 'play', 25000, 'p3'); await until(p3.b, (s) => s.screen === 'play', 25000, 'p3b');
  await p3.b.evaluate(() => window.__penalty.drop());
  ok('Abgerissene Verbindung wird erkannt', !!(await until(p3.a, (s) => s.screen === 'lost', 30000, 'abbruch')));
} catch (e) { fail++; console.log('ABBRUCH', e.stack); }
await browser.close(); if (server) server.close();
console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
