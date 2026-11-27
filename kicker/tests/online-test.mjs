// Online-Test: zwei getrennte Browserprofile verbinden sich wie echte Nutzer (Link hin, Antwort-Code zurück).
//   node tests/online-test.mjs [https://.../]      SHOT_DIR=<ordner> speichert Bilder
import { harness } from './harness.mjs';
import { RODS, OWN, MATCH } from '../src/config.js';

const T = await harness();
const { ok, until, shell, sim, sleep, shot } = T;
const inp = (p) => p.evaluate(() => window.__game.input());
const proj = (p, x, y, z) => p.evaluate((a, b, c) => window.__game.project(a, b, c), x, y, z);
const axes = (p, rod) => p.evaluate((r) => window.__game.axes(r), rod);
const front = async (p) => { await p.bringToFront(); };
const playing = (a, b) => until(async () => (await sim(a)) && (await sim(b)) && (await shell(a)).screen === 'play' && (await shell(b)).screen === 'play', 30000, 'beide im Spiel');

// Gast steuert: Tastatur oder Finger; gemessen wird beim Gastgeber
async function guestControls(a, b, label, touch) {
  await front(b);
  await b.$eval('#pause .autoToggle', (e) => { if (e.getAttribute('aria-pressed') === 'true') e.click(); });
  await (touch ? b.tap('#rodbar [data-rod="1"]') : b.click('#rodbar [data-rod="1"]'));
  const g = OWN[1][1]; await sleep(700);
  const y0 = (await sim(a)).rods[g].y, dir = y0 > 0 ? -1 : 1, ax = await axes(b, g), vp = b.viewport();
  if (touch) {
    const sx = vp.width / 2, sy = vp.height * 0.55, t = await b.touchscreen.touchStart(sx, sy);
    for (let i = 1; i <= 8; i++) { await t.move(sx + (ax.slide.x * dir * 90 * i) / 8, sy + (ax.slide.y * dir * 90 * i) / 8); await sleep(30); } await t.end();
  } else {
    // Taste passend zur Bildschirmrichtung der Stange
    const key = Math.abs(ax.slide.y) > Math.abs(ax.slide.x) ? (ax.slide.y * dir > 0 ? 'ArrowDown' : 'ArrowUp') : ax.slide.x * dir > 0 ? 'ArrowRight' : 'ArrowLeft';
    await b.keyboard.down(key); await sleep(450); await b.keyboard.up(key);
  }
  const moved = await until(async () => ((await sim(a)).rods[g].y - y0) * dir > 0.7, 8000, 'stange');
  ok(label + ': Gast schiebt seine Stange beim Gastgeber', !!moved, [y0, (await sim(a)).rods[g].y, dir]);
  const own = await inp(b); await sleep(600);
  ok(label + ': Gast sieht dieselbe Stellung', Math.abs((await sim(b)).rods[g].y - (await sim(a)).rods[g].y) < 0.25 && Math.abs((await sim(b)).rods[g].y - own.y) < 0.25, [(await sim(a)).rods[g].y, (await sim(b)).rods[g].y, own.y]);
  // Ausholen und Schuss: beim Gastgeber Bild für Bild mitschreiben (unabhängig von der Auslastung des Testrechners)
  await a.evaluate((g) => { const w = (window.__watch = { wound: false, struck: false }); const f = () => { const s = window.__game.sim(); if (s) { const r = s.rods[g]; if (r.a < -0.9) w.wound = true; if (w.wound && (r.a > 0.4 || r.m === 2 || r.m === 3)) w.struck = true; } if (!w.struck) requestAnimationFrame(f); }; f(); }, g);
  if (touch) { const bb = await (await b.$('#touch .act[data-act="a"]')).boundingBox(), t = await b.touchscreen.touchStart(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(700); await t.end(); }
  else { await b.keyboard.down('Space'); await sleep(700); await b.keyboard.up('Space'); }
  await until(async () => (await a.evaluate(() => window.__watch)).struck, 8000, 'schuss');
  const w = await a.evaluate(() => window.__watch);
  ok(label + ': Ausholen und Schuss des Gasts wirken beim Gastgeber', w.wound && w.struck, w);
}

try {
  console.log('1  Verbinden (Gastgeber Rechner, Gast Handy)');
  const { a, b, link, started } = await T.pair('?ice=none&nosw&speed=1');
  ok('Einladungslink führt auf diese Seite', link.startsWith(T.base) && link.includes('#m='));
  ok('Beide sind im Spiel', !!started && !!(await playing(a, b)));
  const sa = await shell(a), sb = await shell(b);
  ok('Rollen und Namen stimmen', sa.me === 0 && sb.me === 1 && sa.names.join() === 'Anna,Ben' && sb.names.join() === 'Anna,Ben' && sa.conn === 'open' && sb.conn === 'open', [sa, sb]);
  await front(b); await sleep(900);
  const bo = await proj(b, 7, 0.3, 0), be = await proj(b, -7, 0.3, 0);
  ok('Gast (Hochformat) sieht sein Tor unten', bo.y > be.y + 200, [bo, be]);
  await front(a); await sleep(500);
  const ao = await proj(a, -7, 0.3, 0), ae = await proj(a, 7, 0.3, 0);
  ok('Gastgeber (Querformat) sieht sein Tor links', ao.x < ae.x - 250, [ao, ae]);
  await front(b); await sleep(300);
  const names = (p) => p.evaluate(() => [0, 1].map((k) => Math.round(document.getElementById('name' + k).getBoundingClientRect().left)));
  const nb = await names(b), na = await names(a);
  ok('Anzeige: jeder sieht seinen Namen auf seiner Seite (links)', nb[1] < nb[0] && na[0] < na[1], [na, nb]);
  await front(a); await shot(a, '20-online-host'); await front(b); await shot(b, '21-online-guest');

  console.log('2  Eingaben');
  await guestControls(a, b, 'Handy als Gast', true);
  await front(a); await a.$eval('#pause .autoToggle', (e) => { if (e.getAttribute('aria-pressed') === 'true') e.click(); });
  await a.keyboard.press('Digit2'); await sleep(300); const h0 = (await sim(a)).rods[OWN[0][1]].y, hk = h0 > 0 ? 'ArrowUp' : 'ArrowDown';
  await a.keyboard.down(hk); await sleep(400); await a.keyboard.up(hk); await sleep(300); const h1 = (await sim(a)).rods[OWN[0][1]].y;
  await front(b); await sleep(700);
  ok('Eingaben des Gastgebers kommen beim Gast an', Math.abs(h1 - h0) > 0.7 && Math.abs((await sim(b)).rods[OWN[0][1]].y - (await sim(a)).rods[OWN[0][1]].y) < 0.3, [h0, h1, (await sim(b)).rods[OWN[0][1]].y]);
  await front(a); await a.keyboard.press('Space', { delay: 200 });
  await front(b);
  ok('Gast hört Töne vom Tisch', !!(await until(async () => { const s = await b.evaluate(() => window.__game.sounds()); return s.includes('whistle') && (s.includes('clack') || s.includes('bank') || s.includes('shot') || s.includes('throwin')); }, 20000, 'töne')));
  const s1 = await sim(a), s2 = await sim(b);
  ok('Beide sehen denselben Verlauf', Math.abs(s1.t - s2.t) < 1.5 && Math.abs(s1.time - s2.time) < 1.5, [s1.t, s2.t]);

  console.log('3  Chat und Pause');
  await b.click('#btnChat'); await b.type('#chatIn', 'Viel Glück'); await b.click('#chatSend');
  ok('Chat kommt an', !!(await until(async () => (await shell(a)).chat.includes('er: Viel Glück'), 8000, 'chat'))); await b.click('#chatClose');
  await front(a); await a.click('#btnPause'); const t0 = (await sim(a)).t; await sleep(600); ok('Online läuft das Spiel während der Pause weiter', (await sim(a)).t > t0 + 0.3); await a.click('#btnResume');

  console.log('4  Verlassen');
  await front(b); await b.click('#btnPause'); await b.click('#btnQuit');
  await front(a); ok('Verlassen wird beim Gastgeber gemeldet', !!(await until(async () => (await shell(a)).screen === 'lost', 10000, 'weg')));
  ok('Gast ist wieder im Menü', (await shell(b)).screen === 'menu');
  await a.click('#lostMenu'); ok('Gastgeber zurück im Menü', (await shell(a)).screen === 'menu');
  ok('Keine Fehler', !a.errors.length && !b.errors.length && !a.external.length && !b.external.length, [a.errors, b.errors]);
  await a.browserContext().close(); await b.browserContext().close();

  console.log('5  Umgekehrt: Gastgeber Handy, Gast Rechner');
  const r = await T.pair('?ice=none&nosw&speed=1', { width: 844, height: 390, isMobile: true, hasTouch: true }, { width: 1280, height: 720 });
  ok('Verbunden', !!r.started && !!(await playing(r.a, r.b)));
  await front(r.b); await sleep(900);
  const lo = await proj(r.b, 7, 0.3, 0), le = await proj(r.b, -7, 0.3, 0);
  ok('Gast (Querformat) sieht sein Tor links', lo.x < le.x - 300, [lo, le]);
  await guestControls(r.a, r.b, 'Rechner als Gast', false); await front(r.b); await shot(r.b, '22-online-guest-desktop');
  ok('Keine Fehler', !r.a.errors.length && !r.b.errors.length, [r.a.errors, r.b.errors]);
  await r.a.browserContext().close(); await r.b.browserContext().close();

  console.log('6  Ganze Partie und Revanche');
  const m = await T.pair('?ice=none&nosw&speed=4');
  ok('Verbunden', !!m.started);
  const end = await until(async () => (await shell(m.a)).screen === 'end' && (await shell(m.b)).screen === 'end', (MATCH.time + MATCH.golden) * 1000, 'ende');
  const ea = await shell(m.a), eb = await shell(m.b);
  ok('Partie endet bei beiden', !!end);
  ok('Beide sehen dasselbe Ergebnis', ea.winner === eb.winner && ea.score.join() === eb.score.join() && ea.winner !== null, [ea.winner, ea.score, eb.winner, eb.score]);
  const text = async (p) => p.$eval('#endTitle', (e) => e.textContent), ta = await text(m.a), tb = await text(m.b);
  ok('Sieger und Verlierer werden richtig angezeigt', ea.winner === -1 ? ta === tb : /Gewonnen/.test(ea.winner === 0 ? ta : tb) && /Verloren/.test(ea.winner === 0 ? tb : ta), [ta, tb]);
  await front(m.b); await shot(m.b, '23-online-end-guest');
  await m.b.click('#btnAgain'); await sleep(600);
  ok('Revanche wird angeboten', await m.a.$eval('#btnAgain', (e) => /annehmen/i.test(e.textContent)));
  await front(m.a); await m.a.click('#btnAgain');
  const again = await until(async () => { const x = await shell(m.a), y = await shell(m.b), p = await sim(m.a), q = await sim(m.b); return x.screen === 'play' && y.screen === 'play' && p && q && p.score.join() === '0,0' && q.score.join() === '0,0' && q.time > MATCH.time - 60; }, 15000, 'revanche');
  ok('Revanche startet bei beiden bei 0:0', !!again);
  await front(m.b); const g = OWN[1][(await inp(m.b)).rod]; await sleep(300); const k = (await inp(m.b)).k; await m.b.keyboard.press('Space', { delay: 250 }); await sleep(200);
  ok('In der Revanche wirken die Eingaben des Gasts', (await inp(m.b)).k > k && RODS[g].side === 1);
  console.log('7  Verbindungsabbruch');
  await m.b.close();
  ok('Abbruch wird gemeldet', !!(await until(async () => (await shell(m.a)).screen === 'lost', 40000, 'abbruch')), await shell(m.a));
  ok('Keine Fehler', !m.a.errors.length, m.a.errors);
} catch (e) { T.abort(e); }
await T.done();
