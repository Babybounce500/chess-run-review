// Online-Test: zwei getrennte Browserprofile spielen eine ganze Partie (Code-Austausch wie bei echten Nutzern).
//   node tests/online-test.mjs [https://.../]     SHOT_DIR=<ordner> speichert Bilder
// Die Verbindung läuft lokal ohne STUN (?ice=none).
import { harness } from './harness.mjs';

const T = await harness();
const { ok, until, shell, sim, sleep, shot } = T;
const cond = (p, f, ms = 30000, what = '') => until(async () => { const s = await sim(p); return s && f(s) ? s : null; }, ms, what);
const view = (p) => p.evaluate(() => window.__game.view());
const had = (s, type, f = () => true) => !!s && s.events.some((e) => e.type === type && f(e));

try {
  console.log('1  Verbinden');
  const { a, b, link, started } = await T.pair('?ice=none&nosw&speed=1');
  ok('Einladungslink führt auf diese Seite', link.startsWith(T.base) && link.includes('#m='));
  ok('Beide sind im Spiel und verbunden', !!started && (await shell(a)).conn === 'open' && (await shell(b)).conn === 'open');
  ok('Namen und Rollen auf beiden Seiten richtig', !!(await until(async () => (await shell(a)).names.join() === 'Anna,Ben' && (await shell(b)).names.join() === 'Anna,Ben', 8000, 'namen')) && (await shell(a)).me === 0 && (await shell(b)).me === 1);
  const P = [a, b];                                                                  // Index = Spielernummer
  let s = await cond(a, (x) => x.ph === 'pick', 20000, 'wahl'); await cond(b, (x) => x.ph === 'pick' && x.play === s.play && x.off === s.off, 8000, 'wahl b');
  ok('Beide sehen dieselbe Angriffsseite', (await sim(b)).off === s.off);
  ok('Gast sieht die Karten seiner Rolle', (await b.$$eval('.pcard', (l) => l.length)) === (s.off === 1 ? 4 : 3) && (await a.$$eval('.pcard', (l) => l.length)) === (s.off === 0 ? 4 : 3));

  console.log('2  Verdeckte Wahl');
  const key = (off, k) => (off === k ? 'o' : 'd');
  await a.bringToFront(); await a.click('.pcard[data-pick="2"]'); await sleep(120); await a.click('#btnPick');
  const h1 = await cond(a, (x) => x.call[key(s.off, 0)] === 2, 4000, 'host wahl');
  const g1 = await cond(b, (x) => x.call[key(s.off, 0)] !== -1, 4000, 'gast merkt');
  ok('Gastgeber legt fest, der Gast erfährt die Wahl nicht', !!h1 && !!g1 && g1.ph === 'pick' && g1.call[key(s.off, 0)] === 9, [h1 && h1.call, g1 && g1.call]);
  ok('Beim Gast ist nichts davon zu sehen', !(await view(b)).locked && (await view(b)).sel === 0);
  await b.bringToFront(); await shot(b, '20-wahl-gast'); await b.tap('.pcard[data-pick="1"]'); await sleep(120); await b.tap('#btnPick');
  const h2 = await cond(a, (x) => x.ph === 'set', 8000, 'set a'), g2 = await cond(b, (x) => x.ph === 'set', 8000, 'set b');
  ok('Gast wählt: beide Wahlen gelten und sind auf beiden Seiten gleich', !!h2 && !!g2 && h2.call[key(s.off, 0)] === 2 && h2.call[key(s.off, 1)] === 1 && JSON.stringify(h2.call) === JSON.stringify(g2.call), [h2 && h2.call, g2 && g2.call]);

  console.log('3  Ganze Partie mit Eingaben beider Seiten');
  const proof = { gSnap: false, hSnap: false, gThrow: false, hThrow: false, gDef: false, hDef: false, gDive: false, hDive: false, gSwitch: false };
  let agree = true, compared = 0, lastPlay = -1, lastCmp = -1, shots = 0; const results = [], roles = new Set(), done = {}, t0 = Date.now(), bad = [];
  while (Date.now() - t0 < 420000) {
    const sa = await sim(a); if (!sa) break;
    if ((await shell(a)).screen === 'end') break;
    const off = sa.off, def = 1 - off, O = P[off], D = P[def]; roles.add(off);
    if (sa.play !== lastPlay) { lastPlay = sa.play; for (const k in done) delete done[k]; }
    if (sa.ph === 'set' && !done.set && sa.pt > 1.15) {
      done.set = true; await O.bringToFront();
      const sb = await cond(O, (x) => x.ph !== 'set' || x.pt > 1.05, 3000, 'set sicht');
      if (sb && sb.ph === 'set') {
        if (off === 1 && !proof.gSwitch) { await D.bringToFront(); const dc = (await sim(a)).dc; await D.keyboard.press('KeyK'); await sleep(120); await O.bringToFront(); }
        if (def === 1 && !proof.gSwitch) { await D.bringToFront(); const dc = (await sim(a)).dc; await D.keyboard.press('KeyK'); proof.gSwitch = !!(await cond(a, (x) => x.dc !== dc, 2500, 'gast wechselt')); await O.bringToFront(); }
        const before = (await sim(a)).pt; await O.keyboard.press('Space');
        const l = await cond(a, (x) => x.ph !== 'set', 2000, 'snap');
        if (l && l.ph === 'live' && before < 3.0) proof[off ? 'gSnap' : 'hSnap'] = true;
      }
    } else if (sa.ph === 'live') {
      if (!done.def && sa.pt > 0.35) {
        // Abwehr: Pfeil rechts. Beim Gastgeber heißt das +x oder -x je nach Blickrichtung der Abwehr
        done.def = true; await D.bringToFront(); await D.keyboard.down('ArrowRight');
        const moved = await cond(a, (x) => x.ph !== 'live' || x.pl[x.dc].vx < -2.5, 900, 'abwehr lauf');
        if (moved && moved.ph === 'live' && moved.pl[moved.dc].vx < -2.5 && (await view(D)).side === -1) proof[def ? 'gDef' : 'hDef'] = true;
        await D.keyboard.up('ArrowRight');
        const now = await sim(a);
        if (now.ph === 'live') { await D.keyboard.press('Space'); if (await cond(a, (x) => had(x, 'dive', (e) => e.k === x.dc), 900, 'hecht')) proof[def ? 'gDive' : 'hDive'] = true; }
      } else if (done.def && !done.pass && sa.ball.m === 'held' && sa.ball.own === 0 && !sa.scr && sa.call.o !== 3) {
        done.pass = true; await O.bringToFront(); const k = sa.play % 3, key_ = ['Space', 'KeyK', 'KeyL'][k];
        await O.keyboard.press(key_);
        const t = await cond(a, (x) => had(x, 'throw', (e) => e.k === k) || x.ph !== 'live', 1500, 'wurf');
        if (t && had(t, 'throw', (e) => e.k === k)) { proof[off ? 'gThrow' : 'hThrow'] = true; if (shots++ === 0) { await sleep(200); await shot(a, '21-flug-gastgeber'); await shot(b, '22-flug-gast'); } }
      } else if (sa.ball.m === 'held' && sa.ball.own > 0 && sa.ball.own < 4) { await O.keyboard.down('ArrowUp'); await sleep(150); await O.keyboard.up('ArrowUp'); }
    } else if (sa.ph === 'dead' && sa.play !== lastCmp && sa.pt > 0.4) {
      lastCmp = sa.play; const sb = await cond(b, (x) => x.play === sa.play && (x.ph === 'dead' || x.ph === 'over'), 2500, 'ergebnis gast'), now = await sim(a);
      if (sb && now.play === sa.play) {
        compared++; results.push(now.res.type);
        const f = (x) => JSON.stringify([x.res, x.sc, x.down, x.los, x.line, x.drv, x.off]);
        if (f(sb) !== f(now)) { agree = false; bad.push([f(now), f(sb)]); }
        if (compared === 1) { await b.bringToFront(); await shot(b, '23-ergebnis-gast'); }
      }
    }
    await sleep(60);
  }
  console.log('    Ergebnisse: ' + results.join(', '));
  ok('Beide Seiten haben angegriffen', roles.size === 2, [...roles]);
  ok('Gast-Eingabe wirkt: Snap', proof.gSnap, proof);
  ok('Gast-Eingabe wirkt: Pass auf den gewählten Empfänger', proof.gThrow, proof);
  ok('Gast-Eingabe wirkt: Verteidiger laufen (aus seiner Blickrichtung)', proof.gDef, proof);
  ok('Gast-Eingabe wirkt: Hechtsprung', proof.gDive, proof);
  ok('Gast-Eingabe wirkt: Verteidiger wechseln', proof.gSwitch, proof);
  ok('Gastgeber ebenso: Snap, Pass, Abwehr, Hechtsprung', proof.hSnap && proof.hThrow && proof.hDef && proof.hDive, proof);
  ok('Beide Browser zeigen bei jedem Spielzug dasselbe Ergebnis', agree && compared >= 4, [compared, bad.slice(0, 2)]);
  const ended = await until(async () => (await shell(a)).screen === 'end' && (await shell(b)).screen === 'end', 60000, 'ende');
  const ea = await shell(a), eb = await shell(b);
  ok('Spiel endet bei beiden mit demselben Sieger und Stand', !!ended && ea.winner === eb.winner && ea.score.join() === eb.score.join(), [ea, eb]);
  const ta = await a.$eval('#endTitle', (e) => e.textContent), tb = await b.$eval('#endTitle', (e) => e.textContent);
  ok('Titel passen zusammen', ea.winner < 0 ? ta === tb : /Gewonnen/.test(ta) !== /Gewonnen/.test(tb), [ta, tb]);
  ok('Bilanz gegen den Freund', /Bilanz gegen Ben/.test(await a.$eval('#endRecord', (e) => e.textContent)));
  await b.bringToFront(); await shot(b, '24-ende-gast');

  console.log('4  Revanche, Chat, Unsinn');
  await b.click('#btnAgain'); ok('Gast fragt Revanche an, Gastgeber sieht das', !!(await until(() => a.evaluate(() => /annehmen/.test(document.getElementById('btnAgain').textContent)), 8000, 'anfrage')));
  await a.bringToFront(); await a.click('#btnAgain');
  const ra = await cond(a, (x) => x.ph === 'pick' && x.sc.join() === '0,0' && x.t < 6, 15000, 'revanche a'), rb = await cond(b, (x) => x.ph === 'pick' && x.sc.join() === '0,0' && x.t < 6, 15000, 'revanche b');
  ok('Revanche startet bei beiden bei 0 : 0', !!ra && !!rb && ra.off === rb.off && (await shell(a)).screen === 'play' && (await shell(b)).screen === 'play');
  await b.bringToFront(); await b.click('#btnChat'); await b.type('#chatIn', 'Los <b>gehts</b>'); await b.click('#chatSend');
  ok('Chat kommt an, HTML wird nicht ausgeführt', !!(await until(async () => (await shell(a)).chat.includes('er: Los bgehts/b'), 5000, 'chat')) && (await a.$$eval('#chatList b', (l) => l.length)) === 0);
  await b.click('#chatClose');
  await a.bringToFront(); const before = await sim(a);
  await b.evaluate(() => { const r = window.__game.raw; r({ t: 'i', in: { x: 1e9, z: 'a', a: 'x', p: 99, r: 'x' } }); r({ t: 'i', in: null }); r({ t: 'start', seed: 5 }); r({ t: 's', n: 1e9, s: { v: 1 } }); r({ t: 'rematch' }); r({ t: 'quatsch' }); });
  await a.evaluate(() => { const r = window.__game.raw; r({ t: 's', n: 999999999, s: { v: 1, ph: 99 } }); r({ t: 's', n: 'x', s: null }); r({ t: 'i', in: { x: 1 } }); });
  await sleep(900); const after = await sim(a), guest = await sim(b);
  ok('Unsinnige Nachrichten ändern nichts', after.t > before.t && after.sc.join() === '0,0' && (await shell(a)).screen === 'play' && Math.abs(guest.t - after.t) < 1 && after.pl.every((q) => Number.isFinite(q.x + q.z)) && !a.errors.length && !b.errors.length, [a.errors, b.errors, after.t, guest.t]);
  ok('Gast läuft dem Gastgeber höchstens knapp hinterher', Math.abs(guest.t - (await sim(a)).t) < 1, [guest.t, after.t]);

  console.log('5  Verlassen');
  await b.bringToFront(); await b.click('#btnPause'); await b.click('#btnQuit');
  ok('Verlassen wird dem anderen gemeldet', !!(await until(async () => (await shell(a)).screen === 'lost', 10000, 'weg')) && /Ben hat das Spiel verlassen/.test(await a.$eval('#lostText', (e) => e.textContent)));
  await a.bringToFront(); await a.click('#lostMenu'); await sleep(150);
  ok('Zurück ins Menü ohne Reste', (await shell(a)).screen === 'menu' && (await a.$$eval('#plays, #chip, .tag', (l) => l.every((e) => !e.getClientRects().length))));
  ok('Keine Skriptfehler, keine fremden Anfragen', !a.errors.length && !b.errors.length && !a.external.length && !b.external.length, [a.errors, b.errors]);
} catch (e) { T.abort(e); }
await T.done();
