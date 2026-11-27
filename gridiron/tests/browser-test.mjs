// Browser-Test (headless): Solo mit Maus, Tastatur, Finger und Gamepad, alle Bildschirmgrößen, Ton, Offline.
//   node tests/browser-test.mjs [https://.../]      SHOT_DIR=<ordner> speichert Bilder
import { harness } from './harness.mjs';
import { sim as logic } from '../src/sim.js';

const T = await harness();
const { ok, until, shell, sim, sleep, shot } = T;
const seedFor = (off) => { for (let s = 1; ; s++) if (logic.create(s).off === off) return s; };
const view = (p) => p.evaluate(() => window.__game.view());
const input = (p) => p.evaluate(() => window.__game.input());
const sounds = (p) => p.evaluate(() => window.__game.sounds());
const cond = (p, f, ms = 30000, what = '') => until(async () => { const s = await sim(p); return s && f(s) ? s : null; }, ms, what);
const at = (p, ph, ms = 30000, what = ph) => cond(p, (s) => s.ph === ph, ms, what);
const had = (s, type, f = () => true) => !!s && s.events.some((e) => e.type === type && f(e));
// Der nächste Start nimmt einen festen Startwert, damit klar ist, wer beginnt
async function start(p, off, touch) {
  await p.evaluate((seed) => { const real = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = (a) => { if (a instanceof Uint32Array && a.length === 1) { a[0] = seed; crypto.getRandomValues = real; return a; } return real(a); }; }, seedFor(off));
  if (touch) await p.tap('#btnSolo'); else await p.click('#btnSolo');
  return cond(p, (s) => s.ph === 'pick', 20000, 'start');
}
// Rechtecke der Anzeigen und Knöpfe und die Figurenpunkte auf dem Bildschirm
const geometry = (p) => p.evaluate(() => {
  const rect = (e) => { if (!e || e.hidden || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const all = (q) => [...document.querySelectorAll(q)].map(rect).filter(Boolean);
  return { w: innerWidth, h: innerHeight, score: rect(document.querySelector('#hud .score')), tools: rect(document.querySelector('#hud .tools')), chip: rect(document.getElementById('chip')), panel: rect(document.getElementById('plays')), stick: rect(document.getElementById('stickBase')),
    acts: all('#touch .act'), cards: all('.pcard'), go: rect(document.getElementById('btnPick')), tags: all('.tag'), v: window.__game.view(), s: window.__game.sim() };
});
const overlap = (a, b) => !!a && !!b && a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
const inside = (g, a) => !!a && a.l >= -0.5 && a.t >= -0.5 && a.r <= g.w + 0.5 && a.b <= g.h + 0.5;
// Welche Figuren (Körpermitte) liegen außerhalb oder unter einer Anzeige oder einem Knopf?
function hidden(g, list) {
  const covers = [g.score, g.tools, g.chip, g.panel, ...g.acts].filter(Boolean); if (g.acts.length && g.stick) covers.push(g.stick);
  return list.map((i) => { const q = g.v.players[i], x = (q.feet.x + q.head.x) / 2, y = (q.feet.y + q.head.y) / 2; const out = x < 0 || y < 0 || x > g.w || y > g.h, under = covers.find((c) => x > c.l && x < c.r && y > c.t && y < c.b); return out || under ? { i, x: Math.round(x), y: Math.round(y), out, under } : null; }).filter(Boolean);
}
const size = (g, i) => Math.abs(g.v.players[i].feet.y - g.v.players[i].head.y);
const labels = (p) => p.$$eval('#touch .act', (l) => l.filter((e) => !e.hidden).map((e) => e.textContent).join());

try {
  console.log('1  Menü');
  const p = await T.open({ width: 1280, height: 720 }, '?speed=1&nosw');
  ok('Menü sichtbar, Titel richtig', (await shell(p)).screen === 'menu' && (await p.title()) === 'Neon Gridiron');
  await sleep(500); await shot(p, '01-menu-desktop');
  await p.$eval('#nameIn', (e) => { e.value = 'Dom'; }); await p.click('[data-level="easy"]');
  ok('Schwierigkeit wählbar', await p.$eval('[data-level="easy"]', (e) => e.getAttribute('aria-pressed') === 'true'));

  console.log('2  Angriff mit Maus und Tastatur');
  let s = await start(p, 0);
  ok('Solo startet, ich greife an', !!s && s.off === 0 && (await shell(p)).names[0] === 'Dom');
  await p.waitForSelector('.pcard', { visible: true });
  ok('Vier Spielzüge zur Wahl, mit Skizze', (await p.$$eval('.pcard svg', (l) => l.length)) === 4);
  await p.click('.pcard[data-pick="2"]'); await sleep(250);
  ok('Erster Klick zeigt die Vorschau, legt noch nicht fest', (await view(p)).sel === 2 && !(await view(p)).locked && (await sim(p)).call.o === -1);
  await shot(p, '02-wahl-desktop');
  await p.click('#btnPick');
  s = await cond(p, (x) => x.ph === 'set' || x.ph === 'live', 20000, 'set');
  ok('„Festlegen“ übernimmt genau diesen Spielzug', !!s && s.call.o === 2, s && s.call);
  await sleep(1400); await p.keyboard.press('Space');
  s = await at(p, 'live', 8000, 'snap'); ok('Leertaste: Snap', !!s && s.pt < 1.5);
  const q0 = (await sim(p)).pl[0];
  await p.keyboard.down('ArrowRight'); await sleep(380); const i1 = await input(p), s1 = await sim(p), v1 = await view(p); await p.keyboard.up('ArrowRight');
  const sx = (v1.players[2].feet.x - v1.players[1].feet.x) * (s1.pl[2].x - s1.pl[1].x);
  ok('Angriff: Pfeil rechts läuft auf dem Bild nach rechts', i1.x > 0.9 && s1.pl[0].x > q0.x + 0.3 && sx > 0 && v1.side === 1, [i1.x, q0.x, s1.pl[0].x, sx]);
  await p.keyboard.down('KeyK'); await sleep(100); await shot(p, '03-ausholen-desktop'); await p.keyboard.up('KeyK');
  s = await cond(p, (x) => had(x, 'throw'), 5000, 'wurf');
  const thr = s && s.events.find((e) => e.type === 'throw');
  ok('Taste K wirft auf Empfänger 2', !!thr && thr.k === 1, thr);
  await sleep(250); await shot(p, '04-flug-desktop');

  // Zweiter Spielzug: Zahlentasten und Empfänger mit der Maus
  s = await cond(p, (x) => x.ph === 'pick' || x.ph === 'over', 30000, 'naechste wahl');
  await sleep(200); await p.keyboard.press('Digit2'); await sleep(120); await p.keyboard.press('Digit1'); await sleep(120); await p.keyboard.press('Digit1');
  s = await cond(p, (x) => x.ph === 'set', 20000, 'set2'); ok('Zahlentaste wählt, zweites Drücken legt fest', !!s && s.call.o === 0, s && s.call);
  await sleep(1400); await p.keyboard.press('Space'); await at(p, 'live', 8000, 'snap2'); await sleep(600);
  const tg = await p.$('.tag[data-tag="2"]'), bb = tg && await tg.boundingBox();
  ok('Schilder über den Empfängern zeigen, wer frei ist', !!bb && (await p.$$eval('.tag', (l) => l.every((e) => /FREI|ENG|ZU/.test(e.textContent)))), await p.$$eval('.tag', (l) => l.map((e) => e.textContent)));
  if (bb) { await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await sleep(400); await p.mouse.up(); }
  s = await cond(p, (x) => had(x, 'throw', (e) => e.k === 2 && e.high === 1), 4000, 'hoch');
  ok('Empfänger anklicken und halten: hoher Pass auf ihn', !!s, (await sim(p)).events.slice(-5));
  await p.click('#btnPause'); const t0 = (await sim(p)).t; await sleep(400); ok('Pause hält an', (await sim(p)).t === t0 && (await shell(p)).screen === 'pause');
  await shot(p, '05-pause'); await p.click('#btnResume'); ok('Weiter', !!(await cond(p, (x) => x.t > t0 + 0.2, 8000, 'weiter')));
  await p.click('#btnSound'); ok('Ton abschaltbar und gemerkt', await p.evaluate(() => localStorage.getItem('gridiron_sound') === '0')); await p.click('#btnSound');
  const v = await view(p); ok('Wenige Zeichenaufrufe (unter 110)', v.calls > 10 && v.calls < 110, [v.calls, v.tris]);
  ok('Jede Figur hat ihre eigene Schrittphase', new Set(v.phases).size >= 7, v.phases);
  await p.click('#btnPause'); await p.click('#btnQuit'); await sleep(150);
  ok('Zurück ins Menü, keine Reste der Spielanzeigen', (await shell(p)).screen === 'menu' && (await p.$$eval('#plays, #chip, .tag', (l) => l.every((e) => !e.getClientRects().length))));

  console.log('3  Verteidigung mit Tastatur');
  s = await start(p, 1); ok('Jetzt verteidige ich', !!s && s.off === 1);
  await p.waitForSelector('.pcard', { visible: true }); ok('Drei Aufstellungen zur Wahl', (await p.$$eval('.pcard', (l) => l.length)) === 3);
  await p.keyboard.press('ArrowRight'); await sleep(80); ok('Pfeiltasten blättern', (await view(p)).sel === 1);
  await shot(p, '06-aufstellung-desktop'); await p.keyboard.press('Space');
  s = await cond(p, (x) => x.ph === 'set', 20000, 'set def'); ok('Leertaste legt die Aufstellung fest', !!s && s.call.d === 1, s && s.call);
  await sleep(200); const dc = (await sim(p)).dc; await p.keyboard.press('KeyK'); s = await cond(p, (x) => x.dc !== dc, 3000, 'wechsel'); ok('K wechselt den Verteidiger', !!s);
  await at(p, 'live', 15000, 'live def');
  await p.keyboard.down('ArrowRight'); await sleep(450); const i2 = await input(p), s2 = await sim(p), v2 = await view(p); await p.keyboard.up('ArrowRight');
  const sx2 = (v2.players[6].feet.x - v2.players[5].feet.x) * (s2.pl[6].x - s2.pl[5].x), d1 = s2.pl[s2.dc];
  ok('Abwehr: Pfeil rechts läuft auf dem Bild nach rechts (Kamera von der anderen Seite)', i2.x < -0.9 && d1.vx < -1 && sx2 < 0 && v2.side === -1, [i2.x, d1.vx, sx2]);
  await p.keyboard.down('ArrowUp'); await sleep(80); const i3 = await input(p); await p.keyboard.up('ArrowUp'); ok('Abwehr: Pfeil hoch läuft dem Angriff entgegen', i3.z < -0.9, i3);
  await sleep(100); await p.keyboard.press('Space'); s = await cond(p, (x) => had(x, 'dive'), 3000, 'dive'); ok('Leertaste: Hechtsprung', !!s);
  await shot(p, '07-abwehr-desktop');
  await p.click('#btnPause'); await p.click('#btnQuit');
  ok('Keine Fehler, keine fremden Anfragen', !p.errors.length && !p.bad.length && !p.external.length, [p.errors, p.bad, p.external]);
  await p.browserContext().close();

  console.log('4  Ganze Partie');
  const g = await T.open({ width: 960, height: 600 }, '?speed=4&nosw');
  await start(g, 0);
  let plays = 0, last = -1, shotTd = false; const banners = new Set(), t1 = Date.now();
  while (Date.now() - t1 < 300000) {
    const sc = await shell(g); if (sc.screen === 'end') break;
    const x = await sim(g); if (!x) break;
    const b = await g.evaluate(() => { const e = document.getElementById('banner'); return e.hidden ? '' : e.textContent; }); if (b) banners.add(b);
    if (!shotTd && b === 'TOUCHDOWN!') { shotTd = true; await shot(g, '08-touchdown'); }
    if (x.play !== last) { last = x.play; plays++; }
    const off = x.off === 0;
    if (x.ph === 'set' && off && x.pt > 1.1) await g.keyboard.press('Space');
    else if (x.ph === 'live' && off && x.ball.m === 'held' && x.ball.own === 0 && x.pt > 1.1) await g.keyboard.press(['Space', 'KeyK', 'KeyL'][x.play % 3]);
    else if (x.ph === 'live' && off) { await g.keyboard.down('ArrowUp'); await sleep(90); await g.keyboard.up('ArrowUp'); }
    else if (x.ph === 'live') await g.keyboard.press(x.ball.m === 'air' ? 'KeyL' : 'Space');
    await sleep(70);
  }
  await until(async () => (await shell(g)).screen === 'end', 20000, 'ergebnis');
  const end = await shell(g);
  console.log('    Spielzüge: ' + plays + ', Stand ' + end.score.join(':') + ', Ausrufe: ' + [...banners].join(' | '));
  ok('Partie endet mit Sieger und Ergebnisbild', end.screen === 'end' && end.over && plays >= 4, [end, plays]);
  const final = await sim(g); ok('Beide haben angegriffen', final.drv[0] >= 1 && final.drv[1] >= 1, final.drv);
  const heard = new Set(await sounds(g)); ok('Töne: Snap, Pass, Pfiff und Jubel oder Raunen', ['snap', 'pass', 'whistle'].every((n) => heard.has(n)) && (heard.has('cheer') || heard.has('groan')), [...heard]);
  ok('Ausrufe erscheinen', banners.size >= 3, [...banners]);
  ok('Bilanz wird gemerkt', /Siege: [0-9]/.test(await g.$eval('#endRecord', (e) => e.textContent)));
  await shot(g, '09-ende');
  await g.click('#btnAgain'); ok('„Noch einmal“ startet neu', !!(await cond(g, (x) => x.ph === 'pick' && x.sc.join() === '0,0' && x.t < 8, 10000, 'neu')) && (await shell(g)).screen === 'play');
  ok('Keine Skriptfehler', !g.errors.length && !g.bad.length, [g.errors, g.bad]);
  await g.browserContext().close();

  console.log('5  Gamepad');
  const gp = await T.open({ width: 900, height: 600 }, '?speed=1&nosw');
  await gp.evaluate(() => { window.__pad = { axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false })) }; Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [window.__pad] }); });
  const press = async (i, ms = 150) => { await gp.evaluate((k) => { window.__pad.buttons[k].pressed = true; }, i); await sleep(ms); await gp.evaluate((k) => { window.__pad.buttons[k].pressed = false; }, i); };
  await start(gp, 0); await gp.waitForSelector('.pcard', { visible: true }); await sleep(200);
  await gp.evaluate(() => { window.__pad.axes[0] = 1; }); await sleep(250); await gp.evaluate(() => { window.__pad.axes[0] = 0; }); await sleep(150);
  ok('Gamepad: Stick blättert durch die Karten', (await view(gp)).sel === 1, (await view(gp)).sel);
  await press(0);
  ok('Gamepad: A legt fest', !!(await cond(gp, (x) => x.call.o === 1, 15000, 'pad')));
  await at(gp, 'set', 15000); await sleep(1400); await press(0);
  ok('Gamepad: A ist der Snap', !!(await cond(gp, (x) => x.ph === 'live' && x.pt < 1.5, 4000, 'pad snap')));
  await sleep(500); await gp.evaluate(() => { window.__pad.axes[0] = -1; window.__pad.buttons[7].pressed = true; }); await sleep(150); const pi = await input(gp);
  await gp.evaluate(() => { window.__pad.axes[0] = 0; window.__pad.buttons[7].pressed = false; }); await press(2, 100);
  ok('Gamepad: Stick und rechter Trigger', pi.x < -0.9 && pi.d === true, pi);
  ok('Gamepad: X wirft auf Empfänger 3', !!(await cond(gp, (x) => had(x, 'throw', (e) => e.k === 2), 4000, 'pad pass')));
  await gp.browserContext().close();

  console.log('6  Bildschirmgrößen');
  const SIZES = [['320x568', 320, 568, true], ['390x844', 390, 844, true], ['844x390', 844, 390, true], ['768x1024', 768, 1024, true], ['1024x768', 1024, 768, true], ['1280x720', 1280, 720, false], ['1920x1080', 1920, 1080, false]];
  for (const [n, w, h, touch] of SIZES) {
    const m = await T.open({ width: w, height: h, isMobile: touch, hasTouch: touch }, '?speed=1&nosw');
    const menu = await m.evaluate(() => { const c = document.querySelector('#menu .card').getBoundingClientRect(), b = document.getElementById('btnSolo').getBoundingClientRect(); return { w: document.documentElement.scrollWidth <= innerWidth, card: c.left >= 0 && c.right <= innerWidth + 1, solo: b.bottom <= innerHeight + 1 && b.top >= 0, small: [...document.querySelectorAll('#menu button')].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 40).length }; });
    ok(n + ': Menü passt, Startknopf sichtbar, große Knöpfe', menu.w && menu.card && menu.solo && !menu.small, menu);
    await shot(m, n + '-a-menue');
    // Angriff
    await start(m, 0, touch); await m.waitForSelector('.pcard', { visible: true }); await sleep(1200);
    let G = await geometry(m);
    ok(n + ' Wahl: Karten im Bild, mindestens 48 px, ohne Überlappung', G.cards.length === 4 && G.cards.every((c) => inside(G, c) && c.w >= 48 && c.h >= 48) && inside(G, G.go) && G.go.h >= 47.5 && !G.cards.some((a, i) => G.cards.some((b, j) => i < j && overlap(a, b))) && !G.cards.some((c) => overlap(c, G.go)) && !overlap(G.panel, G.score), [G.cards, G.go]);
    let miss = hidden(G, [0, 1, 2, 3, 4, 5, 6]);
    ok(n + ' Wahl: Figuren sichtbar, nicht unter Karten oder Anzeige', miss.length === 0, miss);
    await shot(m, n + '-b-wahl');
    if (touch) { await m.tap('.pcard[data-pick="0"]'); await m.tap('#btnPick'); } else await m.click('#btnPick');
    await at(m, 'set', 15000); await sleep(750); G = await geometry(m);
    miss = hidden(G, [0, 1, 2, 3, 4, 5, 6, 7]);
    ok(n + ' Aufstellung: alle acht Figuren sichtbar und lesbar groß', miss.length === 0 && size(G, 0) > (h < 600 ? 24 : 34), [miss, size(G, 0)]);
    await shot(m, n + '-c-aufstellung'); await sleep(400);
    if (touch) {
      const need = [G.stick, ...G.acts];
      ok(n + ' Touch: Stick und Snap im Bild, groß, ohne Überlappung', G.acts.length === 1 && need.every((r) => inside(G, r)) && G.acts[0].w >= 60 && !overlap(G.stick, G.acts[0]), need);
      const b0 = await (await m.$('#touch .act[data-act="a"]')).boundingBox(); await m.touchscreen.tap(b0.x + b0.width / 2, b0.y + b0.height / 2);
    } else await m.keyboard.press('Space');
    ok(n + ': Snap', !!(await at(m, 'live', 6000, 'snap ' + n)));
    await cond(m, (x) => x.pt > 0.9, 8000, 'pass ' + n);
    G = await geometry(m);
    const passing = G.s.ph === 'live' && G.s.ball.m === 'held' && G.s.ball.own === 0 && !G.s.scr;
    miss = hidden(G, [0, 1, 2, 3]);
    ok(n + ' Pass: Quarterback und alle drei Empfänger sichtbar, nichts verdeckt', passing && miss.length === 0, [passing, miss]);
    ok(n + ' Pass: Empfänger-Schilder im Bild, mindestens 48 px, unter der Anzeige, nicht übereinander', G.tags.length === 3 && G.tags.every((r) => inside(G, r) && r.w >= 48 && r.h >= 47.5 && !overlap(r, G.score)) && !G.tags.some((a, i) => G.tags.some((b, j) => i < j && overlap(a, b))), G.tags);
    await shot(m, n + '-d-pass');
    if (touch) {
      const need = [G.stick, ...G.acts];
      ok(n + ' Touch: vier Knöpfe, im Bild, mindestens 60 px, ohne Überlappung', G.acts.length === 4 && need.every((r) => inside(G, r)) && G.acts.every((r) => r.w >= 60 && r.h >= 60) && !need.some((a, i) => need.some((b, j) => i < j && overlap(a, b))), need);
      ok(n + ' Touch: Beschriftung passt zum Passspiel', (await labels(m)) === 'PASS 1,PASS 2,PASS 3,SPRINT', await labels(m));
      // Stick und Empfänger-Schild gleichzeitig
      const st = await (await m.$('#stickBase')).boundingBox(); const f1 = await m.touchscreen.touchStart(st.x + st.width / 2, st.y + st.height / 2); await f1.move(st.x + st.width / 2 + 60, st.y + st.height / 2); await sleep(80);
      const tb = await (await m.$('.tag[data-tag="1"]')).boundingBox(); const f2 = await m.touchscreen.touchStart(tb.x + tb.width / 2, tb.y + tb.height / 2); await sleep(80);
      const both = await input(m); ok(n + ' Touch: Stick und Empfänger gleichzeitig (Mehrfinger)', both.x > 0.5 && both.r === 1, both);
      await f2.end();
      const thrown = await cond(m, (x) => had(x, 'throw') || x.ph !== 'live', 4000, 'wurf ' + n);
      ok(n + ' Touch: Antippen wirft auf diesen Empfänger', had(thrown, 'throw', (e) => e.k === 1), thrown && thrown.events.slice(-4));
      await f1.end(); await sleep(80); const rel = await input(m); ok(n + ' Touch: Loslassen setzt zurück', rel.x === 0 && rel.r === -1 && !rel.a, rel);
    } else await m.keyboard.press('Space');
    await cond(m, (x) => x.ball.m === 'air' || x.ph !== 'live', 4000, 'flug ' + n); await sleep(250); await shot(m, n + '-e-flug');
    await cond(m, (x) => x.ph === 'dead' || x.ph === 'pick', 15000, 'ende ' + n); await sleep(300); await shot(m, n + '-f-ergebnis');
    // Verteidigung
    await m.click('#btnPause'); await m.click('#btnQuit');
    await start(m, 1, touch); await m.waitForSelector('.pcard', { visible: true }); await sleep(1000); G = await geometry(m);
    ok(n + ' Abwehr-Wahl: drei Karten im Bild, Figuren sichtbar', G.cards.length === 3 && G.cards.every((c) => inside(G, c) && c.h >= 48) && hidden(G, [0, 1, 2, 3, 4, 5, 6]).length === 0, [G.cards, hidden(G, [0, 1, 2, 3, 4, 5, 6])]);
    await shot(m, n + '-g-abwehrwahl');
    await at(m, 'live', 25000, 'abwehr live'); await cond(m, (x) => x.pt > 0.8, 6000, 'a');
    G = await geometry(m); miss = hidden(G, G.s.ball.m === 'held' ? [G.s.dc, G.s.ball.own] : [G.s.dc]);
    ok(n + ' Abwehr: eigener Verteidiger und Ballträger sichtbar', miss.length === 0 && G.v.side === -1, miss);
    if (touch) ok(n + ' Abwehr: Knöpfe heißen HECHT, WECHSEL, BALL!, SPRINT', (await labels(m)) === 'HECHT,WECHSEL,BALL!,SPRINT', await labels(m));
    await shot(m, n + '-h-abwehr');
    // Sicht während des Spielzugs verfolgen: der Ball bleibt im Bild
    let out = 0, samples = 0;
    for (let k = 0; k < 30; k++) { const z = await m.evaluate(() => ({ s: window.__game.sim(), v: window.__game.view(), w: innerWidth, h: innerHeight })); if (!z.s || z.s.ph !== 'live') break; samples++; if (z.v.ball.x < -5 || z.v.ball.x > z.w + 5 || z.v.ball.y < -5 || z.v.ball.y > z.h + 5) out++; await sleep(110); }
    ok(n + ': Ball bleibt im Spielzug im Bild', out <= 1, [out, samples]);
    ok(n + ': keine Fehler, keine fremden Anfragen', !m.errors.length && !m.bad.length && !m.external.length, [m.errors, m.bad, m.external]);
    await m.browserContext().close();
  }

  console.log('7  Wenig Bewegung und Offline');
  const r = await T.open({ width: 800, height: 600 }, '?speed=3&nosw'); await r.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await r.reload({ waitUntil: 'load' }); await r.waitForFunction(() => window.__game);
  await r.click('#btnSolo'); ok('prefers-reduced-motion: läuft ohne Fehler', !!(await cond(r, (x) => x.ph === 'dead', 40000, 'rm')) && !r.errors.length, r.errors);
  await r.browserContext().close();
  const o = await T.open({ width: 800, height: 600 }, '');
  ok('Offline-Speicher wird angelegt', !!(await until(() => o.evaluate(async () => { await navigator.serviceWorker.ready; const k = await caches.keys(); return k.length === 1 && k[0].startsWith('gridiron-') && (await (await caches.open(k[0])).keys()).length >= 15; }), 30000, 'cache')));
  await sleep(500); await T.offline(o); o.errors.length = 0; await o.reload({ waitUntil: 'load' }); await o.waitForFunction(() => window.__game, { timeout: 30000 }); await o.click('#btnSolo');
  ok('Ohne Netz spielbar', !!(await cond(o, (x) => x.t > 0.5, 20000, 'offline')) && !o.errors.length, o.errors);
} catch (e) { T.abort(e); }
await T.done();
