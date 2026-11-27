// Online-Duell mit zwei getrennten Browserprofilen und echter Direktverbindung.   node tests/online-test.mjs [https://.../]
// netlag verzögert jede ausgehende Nachricht um so viele Millisekunden (nur mit ?test).
import { harness } from './harness.mjs';
const T = await harness();
const { ok, until, shell, sim, sleep, shot, pair } = T;
const net = (p) => p.evaluate(() => window.__game.online());
const show = (p) => p.evaluate(() => window.__game.show());
const set = (p, o) => p.evaluate((o) => window.__game.set(o), o);
const text = (p, sel) => p.evaluate((sel) => { const e = document.querySelector(sel); return !e || e.hidden ? '' : e.textContent; }, sel);
const press = async (p, code) => { await p.bringToFront(); await p.keyboard.down(code); await sleep(60); await p.keyboard.up(code); };
const fighting = (a, b) => until(async () => (await sim(a))?.phase === 'fight' && (await sim(b))?.phase === 'fight', 20000, 'kampf');
// Der Gastgeber schlägt den Gast nieder (seine Eingaben kommen verzögert an, deshalb mehrere Versuche)
async function floorGuest(a, b) {
  for (let i = 0; i < 20; i++) {
    const s = await sim(a); if (s.phase === 'down') break; if (s.phase !== 'fight') return false;
    await set(a, { gap: 1.15, hp: [100, 3], clock: 55 }); await press(a, 'KeyK');
    if (await until(async () => (await sim(a)).phase === 'down', 1200, 'unten')) break;
  }
  return !!(await until(async () => (await sim(b)).phase === 'down' && (await sim(b)).down.who === 1, 5000, 'beim Gast unten'));
}
// im Browser des Gasts: drücken, wenn die Marke bei ihm sichtbar im Feld steht
const autoGetup = (p) => p.evaluate(() => { const tick = () => { const s = window.__game.sim(); if (!s || s.phase !== 'down') return; const D = s.down; if (Math.abs(D.m - D.zone) < 0.05) { dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })), 60); setTimeout(tick, 330); } else requestAnimationFrame(tick); }; tick(); });
try {
  for (const [label, query, laptop, phone] of [
    ['ohne Verzögerung', '?ice=none&nosw&test', { width: 1100, height: 700 }, { width: 390, height: 780, isMobile: true, hasTouch: true }],
    ['mit 80 ms je Richtung', '?ice=none&nosw&test&netlag=80', { width: 1100, height: 700 }, { width: 844, height: 390, isMobile: true, hasTouch: true }]
  ]) {
    console.log('Duell ' + label);
    const { a, b, started } = await pair(query, laptop, phone);
    ok('Verbindung steht, beide im Kampf', !!started);
    const sa = await shell(a), sb = await shell(b);
    ok('Namen und Ecken stimmen', sa.me === 0 && sb.me === 1 && sa.names.join() === 'Anna,Ben' && sb.names.join() === 'Anna,Ben', [sa.names, sb.names]);
    ok('Beide sehen den Einmarsch', !!(await until(async () => (await show(a)).walk !== null && (await show(b)).walk !== null, 6000, 'einmarsch')));
    await b.bringToFront(); await until(() => b.evaluate(() => !document.getElementById('lower').hidden), 6000, 'bauchbinde'); await sleep(500);
    ok('Bauchbinde nennt Mitspieler', /Anna|Ben/.test(await text(b, '#lower b'))); await shot(b, label.split(' ')[0] + '-gast-einmarsch');
    await a.bringToFront(); await a.click('#btnSkipShow');
    ok('Wer überspringt, wartet auf den anderen', !!(await until(async () => /Warte auf deinen Gegner/.test(await text(a, '#hint')), 4000, 'hinweis')));
    await sleep(1200); ok('Der Kampf steht still, solange einer noch zuschaut', (await sim(a)).t === 0, (await sim(a)).t);
    await b.bringToFront(); await b.click('#btnSkipShow');
    ok('Dann beginnt er bei beiden', !!(await fighting(a, b)));
    ok('Hinweis ist wieder weg', !/Warte/.test(await text(a, '#hint')));
    ok('Online-Tempo gilt', (await sim(a)).pace === 1.25, (await sim(a)).pace);
    await until(async () => (await net(a)).rtt !== null && (await net(a)).lag > 0, 8000, 'ping'); await sleep(2500);
    const na = await net(a), nb = await net(b), wanted = Math.min(0.22, na.rtt + 0.07);
    ok('Laufzeit gemessen', na.rtt !== null && (label.startsWith('mit') ? na.rtt > 0.15 && na.rtt < 0.35 : na.rtt < 0.1), na.rtt);
    ok('Gastgeber bekommt passenden Ausgleich', Math.abs(na.lag - wanted) < 0.04, [na.lag, wanted]);
    ok('Beide sehen den Ping beim Rundenstand', /Runde 1\/3 · \d:\d\d · \d+ ms/.test(await text(a, '#sub')) && /· \d+ ms$/.test(await text(b, '#sub')), [await text(a, '#sub'), await text(b, '#sub')]);
    ok('Der Gast kennt den Ausgleich des Gastgebers', Math.abs((await net(b)).peerLag - (await net(a)).lag) < 0.03, [(await net(b)).peerLag, (await net(a)).lag]);
    const fits = (p) => p.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(), hit = (x, y) => x.left < y.right - 1 && x.right > y.left + 1 && x.top < y.bottom - 1 && x.bottom > y.top + 1, sc = r('.score'), sub = r('#sub'), t = r('.tools'); return sub.left >= sc.left - 1 && sub.right <= sc.right + 1 && !hit(sc, t) && !hit(r('#bars'), t) && t.right <= innerWidth + 0.5; });
    ok('Spielstand, Knöpfe und Balken überlappen nicht', (await fits(a)) && (await fits(b)));
    ok('Balken stehen wie der Spielstand', await b.evaluate(() => [...document.querySelectorAll('.fbar .who b')].map((e) => e.textContent).join() === 'Anna,Ben'));
    await shot(b, label.split(' ')[0] + '-gast-kampf'); await shot(a, label.split(' ')[0] + '-gastgeber-kampf');
    // Eingaben beider Seiten
    let act = null;
    for (let i = 0; i < 6 && !act; i++) { await set(a, { gap: 1.9, hp: [100, 100], clock: 55 }); await press(b, 'KeyK'); act = await until(async () => (await sim(a)).f[1].act, 900, 'gastschlag'); }
    ok('Schlag des Gasts kommt beim Gastgeber an, im Online-Tempo', !!act && act.k === 'cross' && act.slow >= 1.24, act);
    // Verzögerung des Gastgebers: Zeit vom Tastendruck bis zum Ausholen
    await sleep(800); await a.bringToFront();
    const delay = await a.evaluate(() => new Promise((res) => { const t0 = performance.now(); dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' })); setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyJ' })), 50); (function f() { const x = window.__game.sim().f[0].act; if (x) res((performance.now() - t0) / 1000); else if (performance.now() - t0 > 1500) res(null); else requestAnimationFrame(f); })(); }));
    ok('Eingabe des Gastgebers wirkt um den Ausgleich später', delay !== null && delay > na.lag - 0.03 && delay < na.lag + 0.12, [delay, na.lag]);
    ok('Gast sieht den Schlag des Gastgebers', !!(await until(async () => (await sim(b)).f[0].stats.thrown >= 1, 4000, 'sichtbar')));
    // Niederschlag und Aufstehen beim Gast
    const down = await floorGuest(a, b);
    ok('Gast geht zu Boden und sieht seinen Aufsteh-Balken', down && !!(await until(() => b.evaluate(() => !document.getElementById('getup').hidden), 4000, 'balken')));
    await shot(b, label.split(' ')[0] + '-gast-boden');
    await b.bringToFront(); await autoGetup(b);
    ok('Gast kommt mit Timing wieder hoch', !!(await until(async () => { const s = await sim(a); return s.phase === 'fight' && s.f[1].downs >= 1; }, 16000, 'auf')), (await sim(a)).down);
    ok('Beide zählen den Niederschlag gleich', !!(await until(async () => (await shell(a)).score.join() === '1,0' && (await shell(b)).score.join() === '1,0', 4000, 'stand')));
    // Chat
    await b.bringToFront(); await b.click('#btnChat'); await b.type('#chatIn', 'Guter Treffer'); await b.keyboard.press('Enter');
    ok('Chat kommt an, Leertaste lässt sich tippen', !!(await until(async () => (await shell(a)).chat.includes('er: Guter Treffer'), 5000, 'chat'))); await b.click('#chatClose');
    // Rundenpause
    await until(async () => (await sim(a)).phase === 'fight', 15000, 'weiter'); await set(a, { clock: 0.3 });
    ok('Rundenpause mit Statistik bei beiden', !!(await until(async () => (await show(a)).panel === 'rest' && (await show(b)).panel === 'rest', 12000, 'pause')));
    await b.bringToFront(); await sleep(200); await shot(b, label.split(' ')[0] + '-gast-pause');
    // letzter Kampfabschnitt: Entscheidung nach Punkten, der Gastgeber führt
    await until(async () => (await sim(a)).phase === 'fight' && (await sim(a)).round === 2, 20000, 'runde2'); await set(a, { round: 3, clock: 0.4 });
    ok('Richterspruch bei beiden', !!(await until(async () => (await show(a)).panel === 'decision' && (await show(b)).panel === 'decision', 12000, 'richter')));
    ok('Beide landen auf dem Abschlussbild', !!(await until(async () => (await shell(a)).screen === 'end' && (await shell(b)).screen === 'end', 25000, 'ende')));
    await sleep(400); const ea = await text(a, '#endScore'), eb = await text(b, '#endScore'), win = (await shell(a)).winner;
    ok('Gleicher Sieger und Serienstand', win === (await shell(b)).winner && /Serie bis 2 Siege: Anna \d : \d Ben/.test(ea) && ea.match(/Serie.*/)[0] === eb.match(/Serie.*/)?.[0], [win, ea, eb]);
    await b.bringToFront(); await shot(b, label.split(' ')[0] + '-gast-ende'); await a.bringToFront(); await shot(a, label.split(' ')[0] + '-gastgeber-ende');
    const before = (await net(a)).series.slice();
    // Revanche
    await a.click('#btnAgain'); await b.bringToFront(); await b.waitForFunction(() => /annehmen/.test(document.getElementById('btnAgain').textContent), { timeout: 5000 }); await b.click('#btnAgain');
    ok('Revanche: beide wieder beim Einmarsch', !!(await until(async () => (await show(a)).walk !== null && (await show(b)).walk !== null && (await sim(a)).t === 0, 8000, 'revanche')));
    ok('Serie läuft weiter', (await net(a)).series.join() === before.join() && (await net(b)).series.join() === before.join(), [before, (await net(a)).series, (await net(b)).series]);
    await a.bringToFront(); await a.click('#btnSkipShow'); await b.bringToFront(); await b.click('#btnSkipShow'); ok('Zweiter Kampf beginnt', !!(await fighting(a, b)));
    // Verlassen
    await b.bringToFront(); await b.click('#btnPause'); await b.click('#btnQuit');
    ok('Gast geht: Gastgeber erfährt es', !!(await until(async () => (await shell(a)).screen === 'lost', 8000, 'weg')));
    await a.bringToFront(); await sleep(300);
    ok('Keine Einblendung bleibt hängen', (await a.evaluate(() => ['lower', 'tale', 'replay', 'panel', 'ticker', 'btnSkipShow'].filter((id) => !document.getElementById(id).hidden))).length === 0);
    await a.click('#lostMenu'); await a.click('#btnSolo');
    ok('Danach wieder allein spielbar, ohne Ausgleich und Online-Tempo', !!(await until(async () => (await shell(a)).mode === 'solo' && (await show(a)).walk !== null, 6000, 'solo')) && !(await sim(a)).pace && (await net(a)).lag === 0);
    ok('Keine Fehler', !a.errors.length && !b.errors.length && !a.external.length && !b.external.length, [a.errors, b.errors, a.external]);
    await a.browserContext().close(); await b.browserContext().close();
  }
} catch (e) { T.abort(e); }
await T.done();
