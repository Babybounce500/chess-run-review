// Übertragung: Einmarsch, Wiederholung, Rundenstatistik, Richter, Ergebnisblatt.   node tests/show-test.mjs [https://.../]
import { harness } from './harness.mjs';
const T = await harness();
const { ok, until, shell, sim, sleep, shot } = T;
const info = (p) => p.evaluate(() => window.__game.show());
const view = (p) => p.evaluate(() => window.__game.view());
const set = (p, o) => p.evaluate((o) => window.__game.set(o), o);
const visible = (p, id) => p.evaluate((id) => { const e = document.getElementById(id); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, id);
const box = (p, id) => p.evaluate((id) => { const b = document.getElementById(id).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: innerWidth, h: innerHeight }; }, id);
const inside = (g) => g.l >= -0.5 && g.t >= -0.5 && g.r <= g.w + 0.5 && g.b <= g.h + 0.5;
// Gegner mit dem Cross niederschlagen (er kann ausweichen, dann neuer Versuch)
async function floorRival(p) {
  for (let i = 0; i < 30; i++) {
    const s = await sim(p); if (s.phase === 'down' && s.down.who === 1) return true;
    if (s.phase === 'fight' && !s.f[0].act) { await set(p, { gap: 1.15, hp: [100, 3], clock: 55 }); await p.keyboard.press('KeyK'); }
    if (await until(async () => (await sim(p)).phase === 'down' && (await sim(p)).down.who === 1, 700, 'unten')) return true;
  }
  return false;
}
try {
  for (const [n, vp] of [['desktop', { width: 1280, height: 720 }], ['hoch', { width: 390, height: 844, isMobile: true, hasTouch: true }], ['quer', { width: 844, height: 390, isMobile: true, hasTouch: true }]]) {
    console.log('Einmarsch ' + n);
    const p = await T.open(vp, '?speed=1&nosw');
    ok(n + ': Übertragung ist an und abschaltbar', (await p.$eval('#btnShow', (e) => e.textContent)) === 'TV-Übertragung: an');
    await p.click('[data-level="normal"]'); await p.click('#btnSolo');
    ok(n + ': Einmarsch beginnt mit dem Gegner', !!(await until(async () => (await info(p)).walk === 0, 5000, 'walk0')));
    ok(n + ': Kampf wartet währenddessen', (await sim(p)).t === 0 && (await sim(p)).phase === 'intro');
    ok(n + ': Steuerung und Kampfanzeige sind ausgeblendet', await p.evaluate(() => document.getElementById('bars').hidden && (document.getElementById('touch').hidden || getComputedStyle(document.getElementById('touch')).display === 'none')));
    await until(() => visible(p, 'lower'), 5000, 'bauchbinde'); await sleep(600);          // Einflug abwarten
    const name = await p.$eval('#lower b', (e) => e.textContent); let g = await box(p, 'lower');
    ok(n + ': Bauchbinde nennt den Gegner, im Bild', name === 'Viktor Sand' && g.l > -40 && g.r <= g.w + 1 && g.b <= g.h, [name, g]);
    const z0 = (await view(p)).z[1]; await sleep(900); const v = await view(p);
    ok(n + ': Der Gegner läuft über den Steg zum Ring, der andere wartet unsichtbar', Math.abs(v.z[1]) < Math.abs(z0) - 0.8 && v.shown[0] === false && v.shot.startsWith('walk'), [z0, v.z, v.shown]);
    await shot(p, n + '-1-einmarsch');
    ok(n + ': dann kommst du', !!(await until(async () => (await info(p)).walk === 1, 8000, 'walk1')));
    await sleep(2300); await shot(p, n + '-2-einmarsch-ich');
    ok(n + ': Kämpfervergleich beim Blickduell', !!(await until(async () => (await info(p)).walk === 2 && (await visible(p, 'tale')), 8000, 'tale')));
    await sleep(700); g = await box(p, 'tale');
    ok(n + ': Vergleich vollständig im Bild mit sechs Zeilen', inside(g) && (await p.$$eval('#tale tr', (l) => l.length)) === 6, g);
    await shot(p, n + '-3-vergleich');
    ok(n + ': Danach läutet Runde 1 von selbst', !!(await until(async () => (await sim(p)).phase === 'fight', 12000, 'kampf')) && (await info(p)).walk === null);
    ok(n + ': Gegner heißt in der Anzeige beim Namen', (await shell(p)).names[1] === 'Viktor Sand' && (await p.$eval('.fbar.f1 .who b', (e) => e.textContent)) === 'Viktor Sand');

    console.log('Wiederholung ' + n);
    // Gegner liegen lassen, solange die Wiederholung geprüft wird: sonst steht er je nach Zufall schon nach gut 1,2 s auf.
    // need höchstens 20, größere Werte verwirft sim.unpack und dann wird nichts mehr aufgezeichnet.
    await p.evaluate(() => { window.__hold = true; const f = () => { if (!window.__hold) return; const s = window.__game.sim(); if (s && s.phase === 'down' && s.down.who === 1) { if (s.down.keep === undefined) s.down.keep = s.down.need; s.down.need = 20; } requestAnimationFrame(f); }; f(); });
    const down = await floorRival(p);
    ok(n + ': Niederschlag löst die sofortige Wiederholung aus', down && !!(await until(async () => (await info(p)).replay?.kind === 'down', 4000, 'replay')), await info(p));
    await sleep(500);
    // alles in einem Zug lesen, das Bildschirmfoto dauert sonst dazwischen
    const probe = () => p.evaluate(() => ({ i: window.__game.show(), pt: window.__game.sim().pt, phase: window.__game.sim().phase, shot: window.__game.view().shot, ui: !document.getElementById('replay').hidden, now: performance.now() }));
    const r1 = await probe(); await sleep(500); const r2 = await probe();
    ok(n + ': Wiederholung läuft in Zeitlupe, Anzählen geht weiter', [r1, r2].every((q) => q.phase === 'down' && q.i.replay?.kind === 'down' && q.ui && q.shot.startsWith('replay')) && r1.pt > 0.3 && r2.pt > r1.pt, [r1, r2]);
    const pace = r2.i.replay && r2.i.replay.angle === r1.i.replay.angle ? (r2.i.replay.t - r1.i.replay.t) / ((r2.now - r1.now) / 1000) : null;
    ok(n + ': etwa 0,4-faches Tempo', pace !== null && pace > 0.25 && pace < 0.55, pace);
    await shot(p, n + '-4-wiederholung');
    const skippable = await visible(p, 'btnSkipShow'); if (skippable) { await p.click('#btnSkipShow'); await sleep(200); }
    ok(n + ': Überspringen beendet die Wiederholung', skippable && (await info(p)).replay === null);
    await p.evaluate(() => { window.__hold = false; const s = window.__game.sim(); if (s.down) s.down.need = s.down.keep; });

    console.log('Rundenpause ' + n);
    await until(async () => (await sim(p)).phase !== 'down', 20000, 'weiter');
    if ((await sim(p)).phase === 'fight') {
      await set(p, { clock: 0.3 });
      ok(n + ': Rundenpause', !!(await until(async () => (await sim(p)).phase === 'rest', 5000, 'rest')));
      ok(n + ': Statistik und drei Punktzettel erscheinen', !!(await until(async () => (await info(p)).panel === 'rest', 8000, 'panel')) && (await p.$$eval('#panel .cards tr', (l) => l.length)) === 4 && (await p.$$eval('#panel .stats tr', (l) => l.length)) === 7);
      g = await box(p, 'panel'); ok(n + ': Tafel passt ins Bild', inside(g), g); await shot(p, n + '-5-pause');
      ok(n + ': Danach Runde 2 ohne Tafel', !!(await until(async () => { const s = await sim(p); return s.round === 2 && s.phase === 'fight' && (await info(p)).panel === null; }, 20000, 'runde2')));
    } else ok(n + ': Rundenpause prüfbar', false, (await sim(p)).phase);
    ok(n + ': keine Fehler', !p.errors.length && !p.bad.length, [p.errors, p.bad]);
    await p.browserContext().close();
  }
  console.log('Richterspruch und Ergebnisblatt');
  const d = await T.open({ width: 1024, height: 768 }, '?speed=1&nosw');
  await d.click('#btnSolo'); await until(async () => (await info(d)).walk === 0, 5000, 'walk');
  await d.keyboard.press('Enter'); ok('Enter überspringt den Einmarsch', (await info(d)).walk === null);
  await until(async () => (await sim(d)).phase === 'fight', 8000, 'f'); await set(d, { round: 3, clock: 0.4, hp: [100, 100] });
  ok('Nach der letzten Runde: Richterspruch', !!(await until(async () => (await info(d)).panel === 'decision', 8000, 'dec')));
  await sleep(300); const hidden = await d.$$eval('#panel .cards tr.hidden', (l) => l.length); await shot(d, 'richter-verdeckt');
  ok('Karten werden nacheinander aufgedeckt', hidden >= 2, hidden);
  ok('Am Ende steht der Sieger', !!(await until(() => d.$eval('#panel h3', (e) => /Sieger|Unentschieden/.test(e.textContent)).catch(() => false), 8000, 'sieger'))); await shot(d, 'richter-offen');
  ok('Ergebnisblatt mit Statistik und Punktzetteln', !!(await until(async () => (await shell(d)).screen === 'end' && (await d.$$eval('#fightCard table', (l) => l.length)) === 2, 20000, 'ende')));
  await sleep(300); await shot(d, 'ergebnis');
  const overlays = () => d.evaluate(() => ['lower', 'tale', 'replay', 'panel', 'ticker', 'btnSkipShow'].filter((id) => !document.getElementById(id).hidden));
  ok('Auf dem Abschlussbild liegt keine Einblendung mehr', (await overlays()).length === 0, await overlays());
  await d.setViewport({ width: 667, height: 375 }); await sleep(300);
  const again = await d.evaluate(() => { const b = document.getElementById('btnAgain'); b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 0.5; });
  ok('Auch auf kleinem Querformat ist „Noch einmal“ erreichbar', again); await shot(d, 'ergebnis-klein'); await d.setViewport({ width: 1024, height: 768 });
  await d.click('#btnAgain'); ok('Neuer Kampf: neuer Einmarsch, Blatt leer', !!(await until(async () => (await info(d)).walk === 0, 5000, 'neu')) && (await d.$eval('#fightCard', (e) => e.textContent)) === '');
  await d.keyboard.press('Escape'); await sleep(300);
  const paused = (await shell(d)).screen === 'pause', walkAt = (await info(d)).walk; await sleep(4500);
  ok('Pause hält den Einmarsch an', paused && (await info(d)).walk === walkAt && (await overlays()).length === 0, [paused, walkAt]);
  if (paused) await d.keyboard.press('Escape'); await sleep(300);
  await d.click('#btnSkipShow'); await until(async () => (await sim(d)).phase === 'fight', 8000, 'f2');
  console.log('K. o. und abgeschaltete Übertragung');
  let over = false;
  for (let k = 0; k < 4 && !over; k++) { await d.evaluate(() => { const s = window.__game.sim(); s.f[1].downs = 2; s.f[1].roundDowns = 2; }); if (await floorRival(d)) over = !!(await until(async () => (await sim(d)).phase === 'over', 8000, 'tko')); }
  ok('Technischer K. o. mit Schlusswiederholung', over && !!(await until(async () => (await info(d)).replay !== null, 6000, 'koreplay')), await info(d));
  await shot(d, 'ko-wiederholung');
  ok('Ergebnisblatt ohne Punktzettel beim K. o.', !!(await until(async () => (await shell(d)).screen === 'end', 25000, 'end2')) && (await d.$$eval('#fightCard table', (l) => l.length)) === 1);
  await d.click('#btnMenu'); await d.click('#btnShow'); await d.click('#btnSolo'); await sleep(500);
  ok('Abgeschaltet: kein Einmarsch, Kampf beginnt sofort', (await info(d)).walk === null && !!(await until(async () => (await sim(d)).phase === 'fight', 6000, 'sofort')));
  await d.reload(); await d.waitForFunction(() => window.__game); ok('Einstellung wird gemerkt', (await d.$eval('#btnShow', (e) => e.textContent)) === 'TV-Übertragung: aus');
  ok('Keine Fehler', !d.errors.length, d.errors);
} catch (e) { T.abort(e); }
await T.done();
