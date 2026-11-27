// Browser-Test (headless): echte Maus-, Finger- und Tastatureingaben, alle Bildschirmgrößen, Offline.
//   node tests/browser-test.mjs [https://.../]      SHOT_DIR=<ordner> speichert Bilder
import { harness } from './harness.mjs';
import { RODS, OWN, INPUT } from '../src/config.js';
import { bestRod } from '../src/sim.js';

const T = await harness();
const { ok, until, shell, sim, sleep, shot } = T;
const inp = (p) => p.evaluate(() => window.__game.input());
const view = (p) => p.evaluate(() => window.__game.view());
const ctl = (p) => p.evaluate(() => window.__game.controls());
const sounds = (p) => p.evaluate(() => window.__game.sounds());
const axes = (p, rod) => p.evaluate((r) => window.__game.axes(r), rod);
const proj = (p, x, y, z) => p.evaluate((a, b, c) => window.__game.project(a, b, c), x, y, z);
const started = (p) => until(async () => { const s = await sim(p); return s && s.phase === 'play' && (await shell(p)).screen === 'play'; }, 30000, 'Ball im Spiel');
const rodY = async (p, i) => (await sim(p)).rods[i].y;
const frames = (p, n = 3) => p.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const rects = (p) => p.evaluate(() => {
  const r = (e) => { if (!e || e.hidden || getComputedStyle(e).display === 'none') return null; const b = e.getBoundingClientRect(); return b.width ? [b.left, b.top, b.right, b.bottom] : null; };
  const all = (s) => [...document.querySelectorAll(s)].map(r).filter(Boolean);
  return { w: innerWidth, h: innerHeight, score: r(document.querySelector('.score')), tools: all('#hud .tools button'), chips: all('#rodbar button'), acts: all('#touch:not([hidden]) .act'), scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight] };
});
const overlap = (a, b) => a && b && a[0] < b[2] - 0.5 && b[0] < a[2] - 0.5 && a[1] < b[3] - 0.5 && b[1] < a[3] - 0.5;
// Von Hand wählen, damit die Automatik die Messung nicht stört
const autoOff = async (p) => { await p.$eval('#menu .autoToggle', (e) => { if (e.getAttribute('aria-pressed') === 'true') e.click(); }); };

try {
  console.log('Menü und Solo (Rechner)');
  const p = await T.open({ width: 1280, height: 720 }, '?speed=1');
  ok('Menü sichtbar, Titel stimmt', (await shell(p)).screen === 'menu' && (await p.title()) === 'Neon Kicker');
  await sleep(1200); await shot(p, '01-menu-1280');
  await p.click('#menu summary'); ok('Anleitung ausklappbar', await p.$eval('#help', (e) => /Leertaste/.test(e.textContent) && e.offsetHeight > 0)); await p.click('#menu summary');
  ok('Schalter für automatische Stangenwahl im Menü', await p.$eval('#menu .autoToggle', (e) => /automatisch/.test(e.textContent)));
  await autoOff(p); ok('Schalter wirkt', await p.$eval('#menu .autoToggle', (e) => /von Hand/.test(e.textContent)));
  await p.type('#nameIn', 'Dom'); await p.click('#btnSolo');
  ok('Solo startet, Ball kommt ins Spiel', !!(await started(p)) && (await shell(p)).names[0] === 'Dom');
  ok('Töne: Anpfiff und Einwurf', (await sounds(p)).includes('whistle') && (await sounds(p)).includes('throwin'), await sounds(p));
  ok('Uhr läuft in der Anzeige', /^[0-3]:\d\d$/.test(await p.$eval('#sub', (e) => e.textContent)));

  console.log('Tastatur und Maus');
  await p.keyboard.press('Digit3'); await frames(p); ok('Taste 3 wählt das Mittelfeld', (await inp(p)).rod === 2);
  await p.keyboard.press('KeyE'); await frames(p, 4); const e1 = (await inp(p)).rod; await p.keyboard.press('KeyQ'); await frames(p, 4); await p.keyboard.press('KeyQ'); await frames(p, 4);
  ok('Q und E wechseln die Stange', e1 === 3 && (await inp(p)).rod === 1, [e1, (await inp(p)).rod]);
  let g = (await inp(p)).global;
  await p.keyboard.down('ArrowUp'); await sleep(420); await p.keyboard.up('ArrowUp'); await sleep(250);      // erst weg vom Anschlag
  let y0 = await rodY(p, g);
  await p.keyboard.down('ArrowDown'); await sleep(260); await p.keyboard.up('ArrowDown'); await sleep(250); const y1 = await rodY(p, g);
  await p.keyboard.down('KeyW'); await sleep(420); await p.keyboard.up('KeyW'); await sleep(250); const y2 = await rodY(p, g);
  ok('Pfeil und WASD schieben die Stange', y1 > y0 + 0.5 && y2 < y1 - 0.8, [y0, y1, y2]);
  await p.keyboard.down('Space'); await sleep(750); const mid = await inp(p), a1 = (await sim(p)).rods[g].a; await p.keyboard.up('Space'); await sleep(40);
  const after = await inp(p);
  ok('Leertaste halten holt aus', mid.charge === 1 && a1 < -1.1, [mid.charge, a1]);
  ok('Loslassen schießt mit voller Kraft', after.k > mid.k && after.p > 0.95 && after.lastShot.how === 'knopf', after.lastShot);
  await sleep(400); await p.keyboard.press('Space', { delay: 60 }); await frames(p, 4); const tapShot = (await inp(p)).lastShot;
  ok('Kurzer Druck schießt sanfter', tapShot.p < 0.65, tapShot);
  await p.keyboard.down('ShiftLeft'); await frames(p, 4); const tr = await inp(p); await p.keyboard.up('ShiftLeft'); await frames(p, 4);
  ok('Shift klemmt, Loslassen löst', tr.trap === true && (await inp(p)).trap === false);
  // Maus: ziehen 1:1
  await p.keyboard.press('Digit2'); await sleep(300); g = (await inp(p)).global;
  await p.evaluate(() => 0); let ax = await axes(p, g); y0 = (await inp(p)).y;
  const dir = y0 > 0 ? -1 : 1, px = 90;
  await p.mouse.move(640, 400 - dir * 40); await p.mouse.down(); for (let i = 1; i <= 15; i++) { await p.mouse.move(640 + ax.slide.x * dir * px * i / 15, 400 - dir * 40 + ax.slide.y * dir * px * i / 15); await sleep(16); } await p.mouse.up(); await sleep(300);
  const want = (px / ax.slide.px) * INPUT.dragGain, got = ((await rodY(p, g)) - y0) * dir;
  ok('Maus ziehen schiebt die Stange im Maßstab des Fingers', Math.abs(got - want) < want * 0.12 + 0.05, [got, want]);
  const flick = async (dx, dy, steps, wait) => { await p.mouse.move(700, 380); await p.mouse.down(); for (let i = 1; i <= steps; i++) { await p.mouse.move(700 + (dx * i) / steps, 380 + (dy * i) / steps); if (wait) await sleep(wait); } await p.mouse.up(); await frames(p, 3); };
  let k0 = (await inp(p)).k; await flick(220, 0, 4, 0); let f = await inp(p);
  ok('Maus-Wisch zum Gegner schießt', f.k > k0 && f.lastShot.how === 'wisch', f.lastShot);
  await sleep(500); k0 = (await inp(p)).k; const gap = await proj(p, 1.75, 0.5, -1); await p.mouse.click(gap.x, gap.y); await frames(p, 3);
  ok('Klick auf den Tisch schießt', (await inp(p)).k > k0 && (await inp(p)).lastShot.how === 'klick', (await inp(p)).lastShot);
  const st = await proj(p, RODS[5].x, 0.5, 3.6); await p.mouse.click(st.x, st.y); await frames(p, 3);
  ok('Klick auf eine eigene Stange wählt sie', (await inp(p)).rod === 3, (await inp(p)).rod);
  await p.mouse.move(640, 400); await p.mouse.down({ button: 'right' }); await frames(p, 3); const r1 = (await inp(p)).trap; await p.mouse.up({ button: 'right' }); await frames(p, 3);
  ok('Rechte Maustaste klemmt', r1 === true && (await inp(p)).trap === false);
  await p.mouse.wheel({ deltaY: 120 }); await frames(p, 4); ok('Mausrad wechselt die Stange', (await inp(p)).rod === 2);
  await p.click('#rodbar [data-rod="0"]'); await frames(p, 3); ok('Stangenleiste wählt', (await inp(p)).rod === 0 && await p.$eval('#rodbar [data-rod="0"]', (e) => e.getAttribute('aria-pressed') === 'true'));
  await sleep(300); await shot(p, '02-play-1280');

  console.log('Gamepad (nachgestellt)');
  await p.evaluate(() => { window.__pad = { axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false })) }; navigator.getGamepads = () => [window.__pad]; });
  await p.keyboard.press('Digit2'); await sleep(200); g = (await inp(p)).global; await p.evaluate(() => { window.__pad.axes[1] = -1; }); await sleep(700); await p.evaluate(() => { window.__pad.axes[1] = 0; }); await sleep(200);
  ok('Stick schiebt', (await rodY(p, g)) < -2, await rodY(p, g));
  k0 = (await inp(p)).k; await p.evaluate(() => { window.__pad.buttons[0].pressed = true; }); await sleep(200); await p.evaluate(() => { window.__pad.buttons[0].pressed = false; }); await frames(p, 4);
  ok('Taste A schießt', (await inp(p)).k > k0);
  await p.evaluate(() => { window.__pad.buttons[5].pressed = true; }); await frames(p, 4); await p.evaluate(() => { window.__pad.buttons[5].pressed = false; }); await frames(p, 4);
  await p.evaluate(() => { window.__pad.buttons[2].pressed = true; }); await frames(p, 4); const padTrap = (await inp(p)).trap; await p.evaluate(() => { window.__pad.buttons[2].pressed = false; });
  ok('RB wechselt, X klemmt', (await inp(p)).rod === 2 && padTrap, [(await inp(p)).rod, padTrap]);
  await p.evaluate(() => { navigator.getGamepads = () => []; });

  console.log('Pause, Ton, Automatik');
  await p.click('#btnPause'); await sleep(150); const t0 = (await sim(p)).t; await shot(p, '03-pause-1280'); await sleep(400);
  ok('Pause hält die Partie an', (await sim(p)).t === t0 && (await shell(p)).screen === 'pause');
  await p.click('#pause .autoToggle'); await p.click('#btnResume'); ok('Weiter, Automatik wieder an', !!(await until(async () => (await sim(p)).t > t0 && (await inp(p)).auto, 5000, 'weiter')));
  let match = 0, total = 0;
  await p.keyboard.press('Digit1'); await sleep(INPUT.manualHold * 1000 + 500);
  for (let i = 0; i < 45; i++) { const [s, c] = await p.evaluate(() => [window.__game.sim(), window.__game.input()]); if (!s || s.phase !== 'play') { await sleep(100); continue; } total++; if (c.rod === bestRod(s.ball, 0) || s.hold) match++; await sleep(110); }
  ok('Automatik wählt die zuständige Stange (' + match + ' von ' + total + ')', total > 10 && match / total > 0.6, [match, total]);
  await p.keyboard.press('Space', { delay: 80 }); await sleep(100);
  const snd = await sounds(p);
  ok('Töne: Schuss und Klacken oder Bande', snd.includes('shot') && (snd.includes('clack') || snd.includes('bank')), [...new Set(snd)]);
  await p.click('#btnSound'); const n0 = (await sounds(p)).length; await sleep(600); ok('Ton lässt sich abschalten', (await sounds(p)).length === n0); await p.click('#btnSound');
  const fps = await p.evaluate(() => new Promise((res) => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else res(n / ((performance.now() - t) / 1000)); }; requestAnimationFrame(f); }));
  const v = await view(p);
  ok('Wenige Zeichenaufrufe (' + v.calls + ')', v.calls < 130, v);
  console.log('    Bilder je Sekunde (headless, geteilter Rechner): ' + fps.toFixed(1));
  ok('Läuft flüssig genug (mindestens 20 Bilder/s im Test)', fps >= 20, fps);
  ok('Keine Fehler, keine fremden Anfragen', !p.errors.length && !p.bad.length && !p.external.length, [p.errors, p.bad, p.external]);
  await p.browserContext().close();

  console.log('Ganze Partie bis zum Ende');
  const m = await T.open({ width: 1024, height: 768 }, '?speed=8&nosw');
  await m.click('[data-level="hard"]'); await m.click('#btnSolo'); await started(m);
  ok('Ein Tor fällt und wird gezeigt', !!(await until(async () => { const s = await sim(m); return s && s.phase === 'goal'; }, 90000, 'tor')));
  await sleep(40); await shot(m, '04-goal-1024');
  ok('Partie endet mit Ergebnis', !!(await until(async () => (await shell(m)).screen === 'end', 150000, 'ende')), await shell(m));
  const end = await shell(m); await shot(m, '05-end-1024');
  ok('Ergebnis passt zum Spielstand', end.winner === -1 ? end.score[0] === end.score[1] : end.score[end.winner] > end.score[1 - end.winner], end);
  ok('Töne: Tor', (await sounds(m)).includes('goal'));
  await m.click('#btnAgain'); ok('Noch einmal beginnt bei 0:0', !!(await until(async () => (await shell(m)).screen === 'play' && (await sim(m)).score.join() === '0,0' && (await sim(m)).time > 170, 15000, 'neu')));
  ok('Eingaben sind zurückgesetzt', (await inp(m)).k === 0 && (await inp(m)).rod >= 0);
  await m.click('#btnPause'); await m.click('#btnQuit'); ok('Ins Menü', (await shell(m)).screen === 'menu' && (await sim(m)) === null);
  ok('Keine Fehler', !m.errors.length, m.errors);
  await m.browserContext().close();

  console.log('Bildschirmgrößen');
  const sizes = [[320, 568, true], [390, 844, true], [844, 390, true], [768, 1024, true], [1024, 768, true], [1280, 720, false], [1920, 1080, false]];
  for (const [width, height, touch] of sizes) {
    const n = width + 'x' + height, q = await T.open({ width, height, isMobile: touch, hasTouch: touch }, '?speed=1&nosw');
    await sleep(500); await shot(q, 'size-' + n + '-menu');
    const menu = await q.evaluate(() => { const c = document.querySelector('#menu .card').getBoundingClientRect(), s = document.getElementById('menu'); const small = [...s.querySelectorAll('button')].filter((b) => b.offsetHeight && b.offsetHeight < 40).length; return { l: c.left, r: c.right, w: innerWidth, small }; });
    ok(n + ': Menü passt in die Breite', menu.l >= 0 && menu.r <= menu.w + 0.5 && !menu.small, menu);
    await (touch ? q.tap('#btnSolo') : q.click('#btnSolo')); await started(q); await sleep(900);
    const r = await rects(q), vw = await view(q), b = vw.bounds, controls = [...r.chips, ...r.acts], portrait = height > width;
    ok(n + ': Tisch ganz im Bild', b[0] >= -0.5 && b[1] >= -0.5 && b[2] <= width + 0.5 && b[3] <= height + 0.5, b);
    const covered = [r.score, ...r.tools, ...controls].filter((c) => overlap(c, b));
    ok(n + ': nichts liegt auf der Spielfläche', !covered.length, { b, covered });
    let hit = 0; for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) if (overlap(controls[i], controls[j])) hit++;
    const big = controls.concat(r.tools).every((c) => c[2] - c[0] >= 47.5 && c[3] - c[1] >= 47.5), inside = controls.concat(r.tools, [r.score]).every((c) => c[0] >= -0.5 && c[1] >= -0.5 && c[2] <= width + 0.5 && c[3] <= height + 0.5);
    ok(n + ': Bedienflächen mindestens 48 px, im Bild, ohne Überlappung', r.chips.length === 4 && (touch ? r.acts.length === 2 : r.acts.length === 0) && big && inside && !hit && !r.tools.some((t) => overlap(t, r.score) || controls.some((c) => overlap(c, t))), r);
    const own = await proj(q, -7, 0.3, 0), other = await proj(q, 7, 0.3, 0);
    ok(n + (portrait ? ': Hochformat, Tisch längs, eigenes Tor unten' : ': Querformat, eigenes Tor links'), portrait ? own.y > other.y + 150 && Math.abs(own.x - other.x) < 3 : own.x < other.x - 250 && Math.abs(own.y - other.y) < 3, [own, other]);
    let out = 0; for (let i = 0; i < 8; i++) for (const f of RODS[i].fig) for (const s of [-1, 1]) { const c = await proj(q, RODS[i].x, 0.4, f + s * RODS[i].range); if (c.x < 0 || c.x > width || c.y < r.score[3] || c.y > height) out++; }
    ok(n + ': alle Figuren in jeder Stellung sichtbar', out === 0, out);
    ok(n + ': Tisch nutzt den Platz', portrait ? (b[2] - b[0]) / width > 0.55 || (b[3] - b[1]) / height > 0.5 : (b[2] - b[0]) / width > 0.42, [(b[2] - b[0]) / width, (b[3] - b[1]) / height]);
    await shot(q, 'size-' + n + '-play');
    ok(n + ': keine Fehler', !q.errors.length, q.errors);
    await q.browserContext().close();
  }

  console.log('Finger (Mehrfinger)');
  for (const [name, vp] of [['hoch', { width: 390, height: 844 }], ['quer', { width: 844, height: 390 }], ['klein', { width: 320, height: 568 }]]) {
    const q = await T.open({ ...vp, isMobile: true, hasTouch: true }, '?speed=1&nosw'); await autoOff(q); await q.tap('#btnSolo'); await started(q); await frames(q, 10);
    await q.tap('#rodbar [data-rod="1"]'); await sleep(350);
    const g = (await inp(q)).global, a = await axes(q, g), y0 = (await inp(q)).y, dir = y0 > 0 ? -1 : 1;
    const sx = vp.width / 2, sy = vp.height * 0.55, len = 64, at = (u, fw = 0) => [sx + a.slide.x * dir * u + a.forward.x * fw, sy + a.slide.y * dir * u + a.forward.y * fw];
    const one = await q.touchscreen.touchStart(...at(0));
    for (let i = 1; i <= 8; i++) { await one.move(...at((len * i) / 8)); await sleep(30); } await sleep(300);
    const got = ((await rodY(q, g)) - y0) * dir, want = (len / a.slide.px) * INPUT.dragGain;
    ok(name + ': Daumen zieht die Stange direkt (1:1, gut dosierbar)', Math.abs(got - want) < want * 0.14 + 0.06, [got, want, a.slide.px]);
    // zweiter Finger auf SCHUSS, während der erste liegen bleibt
    const k0 = (await inp(q)).k, bb = await (await q.$('#touch .act[data-act="a"]')).boundingBox();
    const two = await q.touchscreen.touchStart(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(220);
    await one.move(...at(len - 22)); await sleep(200); const both = await inp(q), c = await ctl(q); await two.end(); await sleep(100);
    const y3 = await rodY(q, g);
    ok(name + ': Ziehen und Schussknopf gleichzeitig', c.a === true && both.charge > 0.2 && (await inp(q)).k > k0 && ((y3 - y0) * dir) < got - 0.1, [c, both.charge, got, (y3 - y0) * dir]);
    const bt = await (await q.$('#touch .act[data-act="b"]')).boundingBox(), three = await q.touchscreen.touchStart(bt.x + bt.width / 2, bt.y + bt.height / 2); await sleep(120);
    const tr = (await inp(q)).trap; await three.end(); await sleep(100); ok(name + ': KLEMMEN neben dem Ziehfinger', tr === true && (await inp(q)).trap === false);
    await one.end(); await sleep(450);
    // Wisch nach vorn: schnell härter als langsam
    // Wisch mit festen Zeitstempeln: so hängt das Tempo nicht von der Auslastung des Testrechners ab
    const cdp = await q.createCDPSession();
    const wisch = async (dist, steps, ms) => {
      const before = (await inp(q)).k, t0 = Date.now() / 1000 - (steps * ms) / 1000 - 0.05;
      const send = (type, fw, i) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: at(0, fw)[0], y: at(0, fw)[1], id: 7 }], timestamp: t0 + (i * ms) / 1000 });
      await send('touchStart', -30, 0); for (let i = 1; i <= steps; i++) await send('touchMove', -30 + (dist * i) / steps, i); await send('touchEnd', 0, steps); await sleep(150); await frames(q, 3);
      const n = await inp(q); return n.k > before ? n.lastShot : null;
    };
    const fast = await wisch(170, 4, 16); await sleep(450); const slow = await wisch(130, 8, 20); await sleep(450); const crawl = await wisch(40, 8, 60);
    ok(name + ': schneller Wisch schießt', !!fast && fast.how === 'wisch' && fast.p > 0.75, fast);
    ok(name + ': ruhigerer Wisch schießt sanfter', !!slow && slow.p < fast.p, [fast, slow]);
    ok(name + ': langsames Ziehen schießt nicht', crawl === null, crawl);
    await sleep(450);
    const pull = await q.touchscreen.touchStart(...at(0, 20)); for (let i = 1; i <= 8; i++) { await sleep(35); await pull.move(...at(0, 20 - i * 12)); } await sleep(250);
    const wound = await inp(q), ang = (await sim(q)).rods[g].a, kk = wound.k; await shot(q, 'touch-' + name + '-ausholen'); await pull.end(); await frames(q, 3);
    ok(name + ': Zurückziehen holt aus, Loslassen schießt', wound.wind > 0.9 && ang < -1 && (await inp(q)).k > kk && (await inp(q)).lastShot.how === 'zwille', [wound.wind, ang, (await inp(q)).lastShot]);
    // Zweiter Finger tippt = Schuss
    await sleep(450); const hold = await q.touchscreen.touchStart(...at(0)); await sleep(60); const k2 = (await inp(q)).k; await q.touchscreen.tap(...at(-70, 40)); await frames(q, 3);
    ok(name + ': Tipp mit zweitem Finger schießt', (await inp(q)).k > k2 && (await inp(q)).lastShot.how === 'tipp', (await inp(q)).lastShot); await hold.end();
    const rp = await proj(q, RODS[OWN[0][2]].x, 0.5, 2.1); await q.touchscreen.tap(rp.x, rp.y); await frames(q, 3);
    ok(name + ': Tipp auf eine eigene Stange wählt sie', (await inp(q)).rod === 2, (await inp(q)).rod);
    ok(name + ': keine Fehler', !q.errors.length, q.errors);
    await q.browserContext().close();
  }

  console.log('Wenig Bewegung');
  const rm = await T.open({ width: 800, height: 600 }, '?speed=2&nosw'); await rm.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await rm.reload({ waitUntil: 'load' }); await rm.waitForFunction(() => window.__game);
  await rm.click('#btnSolo'); ok('prefers-reduced-motion: Spiel läuft', !!(await started(rm)) && !rm.errors.length, rm.errors); await rm.browserContext().close();

  console.log('Offline');
  const o = await T.open({ width: 800, height: 600 }, ''); await o.evaluate(() => navigator.serviceWorker.ready.then(() => 1)); await sleep(1500);
  await T.offline(o); o.errors.length = 0; await o.reload({ waitUntil: 'load' }); await o.waitForFunction(() => window.__game, { timeout: 30000 }); await o.click('#btnSolo');
  ok('Ohne Netz spielbar', !!(await started(o)) && !o.errors.length, o.errors);
} catch (e) { T.abort(e); }
await T.done();
