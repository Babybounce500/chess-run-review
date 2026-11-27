// Online-Test: zwei getrennte Browserprofile verbinden sich wie echte Nutzer und spielen eine Partie.
//   node tests/online-test.mjs [https://.../]      Optional SHOT_DIR=<ordner>. Verbindung lokal ohne STUN (?ice=none).
import { harness } from './harness.mjs';
const T = await harness();
const { ok, until, shell, sim, sleep, shot } = T;
const view = (p) => p.evaluate(() => window.__game.view());
// Szene beim Gastgeber stellen (er rechnet das Spiel)
const place = (p, cfg) => p.evaluate((c) => {
  const s = window.__game.sim();
  Object.assign(s, { phase: 'live', off: c.own, need: !!c.need, clock: 14, time: 170, final: null, slow: 0, freeze: 0, winner: null });
  Object.assign(s.ball, { own: c.own, mode: 'drib', live: false, loose: 0, by: -1 });
  for (let k = 0; k < 2; k++) Object.assign(s.p[k], { y: 0, vy: 0, vx: 0, vz: 0, at: 0, act: 'free', st: 1, tired: false, ba: 0, bb: 0, cd: 0, scd: 0, ch: 0 }, c.p[k]);
  for (const k of c.still || []) Object.assign(s.p[k], { act: 'recover', at: -5 });                 // nicht kleiner: das Netzformat erlaubt ab -5
}, cfg);
const same = (x, y) => x.score.join() === y.score.join();
const guestSees = (b, pred, ms = 6000, what = '') => until(async () => { const s = await sim(b); return s && pred(s) && s; }, ms, what);

try {
  console.log('1  Verbinden');
  const { a, b, link, started } = await T.pair('?ice=none&nosw');
  ok('Einladungslink führt auf diese Seite', link.startsWith(T.base) && link.includes('#m='));
  ok('Verbunden, beide im Spiel', !!started && (await shell(a)).conn === 'open' && (await shell(b)).conn === 'open');
  const sa = await shell(a), sb = await shell(b);
  ok('Rollen und Namen stimmen', sa.me === 0 && sb.me === 1 && sa.names.join() === 'Anna,Ben' && sb.names.join() === 'Anna,Ben', [sa, sb]);
  ok('Jeder sieht seine eigene Figur markiert', (await view(a)).me === 0 && (await view(b)).me === 1);
  ok('Beide starten mit demselben Ballbesitz', !!(await until(async () => { const x = await sim(a), y = await sim(b); return x && y && y.t > 0.2 && x.off === y.off; }, 8000, 'start')));

  console.log('2  Eingaben des Gasts');
  await until(async () => (await sim(a)).phase === 'live', 10000, 'live');
  await place(a, { own: 1, p: [{ x: -4, z: 9 }, { x: -1, z: 7.5 }], still: [0] }); await sleep(600);
  await b.bringToFront(); const x0 = (await sim(a)).p[1].x, f0 = (await view(b)).players[1].feet.x;
  await b.keyboard.down('ArrowRight'); await sleep(700); const x1 = (await sim(a)).p[1].x, f1 = (await view(b)).players[1].feet; await shot(b, 'online-gast-lauf'); await b.keyboard.up('ArrowRight');
  ok('Gast läuft: beim Gastgeber nach rechts, auch auf seinem eigenen Bildschirm in Stickrichtung', x1 > x0 + 1 && f1.x > 0 && Number.isFinite(f0), [x0, x1, f0, f1]);
  await sleep(500); const hs = await sim(a), gs = await sim(b);
  ok('Beide sehen dieselbe Stellung', Math.hypot(hs.p[1].x - gs.p[1].x, hs.p[1].z - gs.p[1].z) < 0.25 && Math.hypot(hs.p[0].x - gs.p[0].x, hs.p[0].z - gs.p[0].z) < 0.25, [hs.p, gs.p]);
  // Touch beim Gast (Handy): Stick
  const st = await b.evaluate(() => { const r = document.getElementById('stickBase').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const z0 = (await sim(a)).p[1].z, t1 = await b.touchscreen.touchStart(st[0], st[1]); await t1.move(st[0], st[1] - 70); await sleep(600); const z1 = (await sim(a)).p[1].z; await t1.end();
  ok('Gast steuert per Daumen: Stick hoch heißt zum Korb', z1 < z0 - 0.8, [z0, z1]);

  console.log('3  Wurf des Gasts');
  let perfect = 0, scored = false, charges = [];
  for (let n = 0; n < 4 && !(perfect && scored); n++) {
    await until(async () => (await sim(a)).phase === 'live', 10000, 'live');
    await place(a, { own: 1, p: [{ x: -5, z: 9.5 }, { x: 0, z: 6.2, f: 3.14 }], still: [0] });
    await guestSees(b, (s) => s.ball.own === 1 && s.p[1].act === 'free' && Math.abs(s.p[1].z - 6.2) < 0.1, 5000, 'szene');
    const before = (await sim(a)).score[1];
    await b.bringToFront(); await b.keyboard.down('Space');
    const got = await b.waitForFunction(() => window.__game.sim().p[1].act === 'gather' && window.__game.sim().p[1].ch >= 0.64, { polling: 'raf', timeout: 6000 }).catch(() => null);
    if (!got) console.log('    (Versuch ' + (n + 1) + ': Anzeige im Testbrowser verpasst, neuer Versuch)');
    await b.keyboard.up('Space'); const seen = await b.evaluate(() => window.__game.sim().p[1].ch);
    const rel = await until(async () => { const s = await sim(a); return s.p[1].act !== 'gather' && s; }, 4000, 'abwurf');
    if (rel) { charges.push([+seen.toFixed(2), +rel.p[1].ch.toFixed(2)]); if (Math.abs(rel.p[1].ch - 0.68) <= rel.p[1].gr + 0.01) perfect++; }
    scored = !!(await until(async () => (await sim(a)).score[1] > before, 4000, 'korb')) || scored;
  }
  ok('Beim Gastgeber zählt der Anzeigewert, den der Gast beim Loslassen sah', charges.length && charges.every(([g, h]) => Math.abs(g - h) <= 0.09), charges);
  ok('Gast kann im Grünen treffen', perfect > 0 && scored, [perfect, scored, charges]);
  ok('Beide sehen denselben Spielstand', !!(await until(async () => same(await sim(a), await sim(b)) && (await sim(b)).score[1] > 0, 5000, 'stand')) && same(await shell(a), await shell(b)), [(await shell(a)).score, (await shell(b)).score]);
  const heard = await b.evaluate(() => window.__game.sounds()); ok('Gast hört die Spieltöne', heard.includes('swoosh') && heard.includes('net'), heard);

  console.log('4  Verteidigung des Gasts und Angriff des Gastgebers');
  await until(async () => (await sim(a)).phase === 'live', 10000, 'live');
  await place(a, { own: 0, p: [{ x: 0, z: 6.5 }, { x: 0.1, z: 4.2, f: 0 }] }); await sleep(250);
  await b.bringToFront(); await b.keyboard.press('Space', { delay: 150 });
  ok('Gast springt zum Block', !!(await until(async () => (await sim(a)).p[1].y > 0.3, 3000, 'block')));
  await sleep(1200); await place(a, { own: 0, p: [{ x: 4, z: 8 }, { x: -4, z: 5 }], still: [0] }); await sleep(250); await b.keyboard.press('KeyK', { delay: 150 });
  ok('Gast greift nach dem Ball', !!(await until(async () => (await sim(a)).p[1].scd > 0.3, 3000, 'klau')));
  await sleep(900); await a.bringToFront(); await place(a, { own: 0, p: [{ x: 1.2, z: 6.4, f: 3.4 }, { x: -5, z: 9.5 }], still: [1] }); await sleep(300);
  const hb = (await sim(a)).score[0];
  await a.keyboard.down('Space'); await a.waitForFunction(() => window.__game.sim().p[0].ch >= 0.64, { polling: 'raf', timeout: 8000 }); await a.keyboard.up('Space');
  await sleep(250); await shot(a, 'online-host-wurf'); await shot(b, 'online-gast-sieht-wurf');
  const hit = await until(async () => (await sim(a)).score[0] > hb, 5000, 'host-korb');
  ok('Gastgeber wirft, der Gast sieht denselben Ausgang', !!(await until(async () => same(await sim(a), await sim(b)), 5000, 'gleich')), [hit, (await sim(a)).score, (await sim(b)).score]);
  const paket = await a.evaluate(async () => { const { sim } = await import('./src/sim.js'); return JSON.stringify({ t: 's', n: 999999, s: sim.pack(window.__game.sim()) }).length; });
  ok('Netzpaket unter 4 kB (' + paket + ' Byte)', paket < 4000, paket);
  await a.click('#btnPause'); const p0 = (await sim(a)).t; await sleep(600); ok('Pause hält die Online-Partie nicht an', (await sim(a)).t > p0 + 0.2); await a.click('#btnResume');
  await b.click('#btnChat'); await b.type('#chatIn', 'Starker Wurf'); await b.click('#chatSend');
  ok('Chat kommt an', !!(await until(async () => (await shell(a)).chat.includes('er: Starker Wurf'), 5000, 'chat'))); await b.click('#chatClose');

  console.log('5  Ende, Revanche, Verlassen');
  await until(async () => (await sim(a)).phase === 'live', 10000, 'live');
  await a.evaluate(() => { const s = window.__game.sim(); s.score = [8, 10]; });
  let end = null;
  for (let n = 0; n < 4 && !end; n++) {
    await until(async () => (await sim(a)).phase === 'live' || (await shell(a)).screen === 'end', 10000, 'live');
    if ((await shell(a)).screen === 'end') break;
    await place(a, { own: 1, p: [{ x: -5, z: 9.5 }, { x: 0, z: 3.0, f: 3.14 }], still: [0] });
    await guestSees(b, (s) => s.ball.own === 1 && s.p[1].act === 'free', 5000, 'szene');
    await b.bringToFront(); await b.keyboard.press('Space', { delay: 150 });
    end = await until(async () => (await shell(a)).screen === 'end' && (await shell(b)).screen === 'end', 7000, 'ende');
  }
  const ea = await shell(a), eb = await shell(b);
  ok('Partie endet bei beiden mit demselben Sieger und Stand', ea.screen === 'end' && eb.screen === 'end' && ea.winner === 1 && eb.winner === 1 && same(ea, eb), [ea, eb]);
  const ta = await a.$eval('#endTitle', (e) => e.textContent), tb = await b.$eval('#endTitle', (e) => e.textContent);
  ok('Gast gewinnt, Gastgeber verliert', /Gewonnen/.test(tb) && /Verloren/.test(ta), [ta, tb]);
  ok('Bilanz gegen den Freund', /Bilanz gegen Ben/.test(await a.$eval('#endRecord', (e) => e.textContent))); await shot(b, 'online-gast-ende');
  await b.bringToFront(); await b.click('#btnAgain');
  ok('Gastgeber sieht die Revanche-Anfrage', !!(await until(() => a.$eval('#btnAgain', (e) => /annehmen/.test(e.textContent)), 8000, 'anfrage')));
  await a.bringToFront(); await a.click('#btnAgain');
  ok('Revanche startet bei beiden bei 0 : 0', !!(await until(async () => (await shell(a)).screen === 'play' && (await shell(b)).screen === 'play' && (await sim(a)).score.join() === '0,0' && (await sim(b)) && (await sim(b)).score.join() === '0,0' && (await sim(b)).t < 15, 12000, 'revanche')));
  await b.bringToFront(); await sleep(800); await shot(b, 'online-gast-revanche');
  await b.click('#btnPause'); await b.click('#btnQuit');
  ok('Verlassen wird dem anderen gemeldet', !!(await until(async () => (await shell(a)).screen === 'lost', 8000, 'weg')) && /Ben hat das Spiel verlassen/.test(await a.$eval('#lostText', (e) => e.textContent)));
  await a.bringToFront(); await a.click('#lostMenu'); ok('Zurück ins Menü', (await shell(a)).screen === 'menu' && (await sim(a)) === null);
  ok('Keine Fehler, keine fremden Anfragen', !a.errors.length && !b.errors.length && !a.external.length && !b.external.length, [a.errors, b.errors, a.external, b.external]);
  await a.browserContext().close(); await b.browserContext().close();

  console.log('6  Ganze Strecke ohne Eingriffe (beschleunigt)');
  const p2 = await T.pair('?ice=none&nosw&speed=4');
  const done = await until(async () => (await shell(p2.a)).screen === 'end' && (await shell(p2.b)).screen === 'end', 140000, 'ganz');
  const x = await shell(p2.a), y = await shell(p2.b);
  ok('Auch ohne jede Eingabe endet die Online-Partie bei beiden gleich', !!done && x.winner === y.winner && same(x, y) && !p2.a.errors.length && !p2.b.errors.length, [x, y, p2.a.errors, p2.b.errors]);
} catch (e) { T.abort(e); }
await T.done();
