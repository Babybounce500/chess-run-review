// Prüft das Spiel im (unsichtbaren) Browser: Ablauf, Steuerung, Bildschirmgrößen, Kamera, Töne, Offline.
//   node tests/browser-test.mjs [https://.../]      Optional SHOT_DIR=<ordner>
import { harness } from './harness.mjs';
const T = await harness();
const { ok, until, shell, sim, sleep, shot } = T;
const view = (p) => p.evaluate(() => window.__game.view());
const hud = (p) => p.evaluate(() => window.__game.hud());
const controls = (p) => p.evaluate(() => window.__game.controls());
const live = (p, ms = 20000) => until(async () => { const s = await sim(p); return s && s.phase === 'live' && s; }, ms, 'live');
// Szene stellen (nur solo): Positionen setzen; "still" hält eine Figur fest
const place = (p, cfg) => p.evaluate((c) => {
  const s = window.__game.sim();
  Object.assign(s, { phase: 'live', off: c.own, need: !!c.need, clock: 14, time: 170, final: null, slow: 0, freeze: 0 });
  Object.assign(s.ball, { own: c.own, mode: 'drib', live: false, loose: 0 });
  for (let k = 0; k < 2; k++) Object.assign(s.p[k], { y: 0, vy: 0, vx: 0, vz: 0, at: 0, act: 'free', st: 1, tired: false, ba: 0, bb: 0, cd: 0, scd: 0 }, c.p[k]);
  for (const k of c.still || []) Object.assign(s.p[k], { act: 'recover', at: -60 });
}, cfg);
// WURF halten und in der Seite selbst bei "at" loslassen (ohne Verzögerung durch die Fernsteuerung)
async function releaseAt(p, at = 0.62) {
  await p.keyboard.down('Space');
  await p.evaluate((at) => new Promise((res) => { const t0 = performance.now(); (function tick() { const q = window.__game.sim().p[0]; if ((q.act === 'gather' && q.ch >= at) || q.act === 'follow' || performance.now() - t0 > 6000) { dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })); return res(); } requestAnimationFrame(tick); })(); }), at);
  await p.keyboard.up('Space');
}
const overlaps = (pt, r) => pt.x >= r[0] && pt.x <= r[2] && pt.y >= r[1] && pt.y <= r[3];

try {
  console.log('1  Menü und Solo am Rechner');
  const p = await T.open({ width: 1280, height: 720 }, '?nosw');
  ok('Menü mit Titel und Anleitung', (await shell(p)).screen === 'menu' && (await p.title()) === 'Blacktop Hoops' && /Wurffinte/.test(await p.$eval('#help', (e) => e.textContent)));
  await sleep(600); await shot(p, 'desktop-menu');
  ok('Hinter dem Menü läuft die 3D-Szene', (await view(p)).calls > 40 && (await sim(p)) === null);
  await p.click('#btnSolo');
  ok('Partie beginnt mit dem Check', !!(await until(async () => { const s = await sim(p); return s && s.events.some((e) => e.type === 'check') && s.score.join() === '0,0'; }, 30000, 'check')) && (await shell(p)).names.join() === 'Du,Computer');
  ok('Dann läuft das Spiel', !!(await live(p)));
  ok('Anzeige mit Spielzeit und Wurfuhr', /\d:\d\d .*Uhr \d+/.test(await p.$eval('#sub', (e) => e.textContent)), await p.$eval('#sub', (e) => e.textContent));

  await place(p, { own: 0, p: [{ x: -2, z: 7.5 }, { x: 5, z: 3 }], still: [1] }); await sleep(900);
  const a0 = await view(p), z0 = (await sim(p)).p[0];
  await p.keyboard.down('ArrowRight'); await sleep(60); const early = (await sim(p)).p[0].vx; const s1 = (await until(async () => { const q = await sim(p); return q.p[0].x > z0.x + 0.9 && q.p[0].vx > 3.2 && q; }, 6000, 'lauf')) || await sim(p); const a1 = await view(p); await p.keyboard.up('ArrowRight');
  ok('Pfeil rechts: Figur beschleunigt und läuft auf dem Bildschirm nach rechts', s1.p[0].x > z0.x + 0.8 && early < s1.p[0].vx && s1.p[0].vx > 3, [early, s1.p[0].vx, s1.p[0].x]);
  ok('Schrittphase läuft mit dem Weg', Math.abs(a1.strides[0] - a0.strides[0]) > 1.5, [a0.strides, a1.strides]);
  await place(p, { own: 0, p: [{ x: -2, z: 8.5 }, { x: 5, z: 3 }], still: [1] }); await sleep(900);
  const b0 = (await view(p)).players[0].feet; await p.keyboard.down('KeyW'); await sleep(600); const s2 = await sim(p); const b1 = (await view(p)).players[0].feet; await p.keyboard.up('KeyW');
  ok('Taste W: zum Korb, auf dem Bildschirm nach oben', s2.p[0].z < 7.2 && b1.y < b0.y - 5, [s2.p[0].z, b0, b1]);
  await place(p, { own: 0, p: [{ x: -4, z: 8 }, { x: 5, z: 3 }], still: [1] });
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('ArrowRight'); await sleep(800); const s3 = await sim(p); await shot(p, 'desktop-sprint'); await p.keyboard.up('ArrowRight'); await p.keyboard.up('ShiftLeft');
  ok('Umschalt sprintet und kostet Ausdauer', s3.p[0].vx > 5 && s3.p[0].st < 0.9, [s3.p[0].vx, s3.p[0].st]);

  const shotScene = { own: 0, p: [{ x: -1.5, z: 6, f: 2.8 }, { x: 5, z: 9 }], still: [1] };
  await place(p, shotScene); await sleep(900);
  await p.keyboard.down('Space');
  await until(async () => (await sim(p)).p[0].ch > 0.3, 5000, 'laden');
  const h = await hud(p), v = await view(p); await shot(p, 'desktop-meter');
  ok('Wurfanzeige mit grüner Zone direkt an der Figur', h.meter && parseFloat(h.green) > 8 && Math.abs(h.rect.x - v.players[0].head.x) < 200, [h, v.players[0].head]);
  await p.keyboard.up('Space');
  let verdict = '', scored = false, flying = false, net = 0, tries = 0;
  while (!scored && tries++ < 6) {                                // der Testrechner ruckelt manchmal: bis zu sechs Würfe
    await sleep(2500); await live(p); await place(p, shotScene); await sleep(500);
    const before = (await shell(p)).score[0];
    await releaseAt(p); await sleep(120);
    const h2 = await hud(p), s4 = await sim(p); verdict = h2.label; flying = flying || (h2.meter && /PERFEKT|ZU FRÜH|ZU SPÄT/.test(h2.label) && s4.ball.own === -1);
    await shot(p, 'desktop-flight');
    const seen = await p.evaluate((before) => new Promise((res) => { const t0 = performance.now(); let net = 0, at = 0; (function tick() { const sc = window.__game.shell().score[0]; if (sc > before) { at = at || performance.now(); net = Math.max(net, window.__game.view().net); } if ((at && performance.now() - at > 350) || performance.now() - t0 > 7000) return res({ scored: sc > before, net }); requestAnimationFrame(tick); })(); }), before);
    scored = seen.scored; net = seen.net;
  }
  ok('Rückmeldung nach dem Loslassen', flying, verdict);
  ok('Wurf landet im Korb und zählt (' + tries + '. Versuch)', scored, [await shell(p), verdict]);
  await shot(p, 'desktop-score');
  ok('Das Netz bewegt sich', net > 0.05, net);
  const sounds = await p.evaluate(() => window.__game.sounds());
  ok('Töne: Dribbeln, Wurf, Netz, Jubel', ['dribble', 'swoosh', 'net', 'cheer', 'check'].every((n) => sounds.includes(n)), [...new Set(sounds)]);
  ok('Ton lässt sich abschalten', await p.evaluate(() => { document.getElementById('btnSound').click(); const off = document.getElementById('btnSound').textContent; document.getElementById('btnSound').click(); return off === '🔇'; }));

  await place(p, { own: 0, need: true, p: [{ x: 0, z: 4.5 }, { x: 5, z: 9 }], still: [1] }); await sleep(500);
  ok('Befreien: Dreierlinie leuchtet, Hinweis erscheint', (await view(p)).arc && /Dreierlinie/.test(await p.$eval('#hint', (e) => (e.hidden ? '' : e.textContent))));
  await shot(p, 'desktop-clear');
  await place(p, { own: 0, p: [{ x: 0.2, z: 5.2, vz: -5.5 }, { x: 5, z: 9 }], still: [1] });
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('ArrowUp');
  await p.waitForFunction(() => { const q = window.__game.sim().p[0]; return Math.hypot(q.x, q.z - 1.35) < 2.75; }, { polling: 'raf', timeout: 8000 });
  await p.keyboard.press('Space', { delay: 150 }); await p.keyboard.up('ArrowUp'); await p.keyboard.up('ShiftLeft');
  const dk = await until(async () => { const s = await sim(p); return s.p[0].act === 'dunk' && s.p[0].at > 0.3 && s; }, 4000, 'dunk'); await shot(p, 'desktop-dunk');
  ok('Dunk aus dem Sprint mit Zeitlupe', !!dk && dk.slowed, dk && dk.p[0]);
  ok('Dunk-Ton', !!(await until(async () => (await p.evaluate(() => window.__game.sounds())).includes('dunk'), 5000, 'dunkton')));
  await live(p);
  await place(p, { own: 1, p: [{ x: -0.7, z: 6 }, { x: 0, z: 6.5, f: 3.14 }], still: [1] }); await sleep(200);
  await p.keyboard.press('KeyK', { delay: 150 }); ok('Taste K greift nach dem Ball', !!(await until(async () => (await p.evaluate(() => window.__game.sounds().slice(-8))).some((n) => n === 'steal' || n === 'whiff'), 3000, 'klau')));
  await sleep(1000); await live(p); await place(p, { own: 1, p: [{ x: 0, z: 5 }, { x: 0, z: 7 }], still: [1] }); await sleep(150); await p.keyboard.down('Space');
  const jumped = await p.waitForFunction(() => window.__game.sim().p[0].y > 0.3, { polling: 'raf', timeout: 5000 }).catch(() => null); await p.keyboard.up('Space');
  ok('Leertaste springt zum Block', !!jumped);

  console.log('2  Gamepad, Pause, Ende');
  await place(p, { own: 0, p: [{ x: -2, z: 7.5 }, { x: 5, z: 3 }], still: [1] });
  await p.evaluate(() => { window.__pad = { axes: [-1, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) }; navigator.getGamepads = () => [window.__pad]; });
  await sleep(500); const g1 = await sim(p);
  await p.evaluate(() => { window.__pad.axes = [0, 0]; window.__pad.buttons[0].pressed = true; }); const gp = await until(async () => (await sim(p)).p[0].act === 'gather', 3000, 'pad-a');
  await p.evaluate(() => { window.__pad.buttons[0].pressed = false; window.__pad.buttons[7].pressed = true; window.__pad.buttons[2].pressed = true; }); const c = await controls(p);
  await p.evaluate(() => { navigator.getGamepads = () => []; });
  ok('Gamepad: Stick läuft, A wirft, X Trick, RT Sprint', g1.p[0].x < -2.5 && !!gp && c.b && c.c, [g1.p[0].x, c]);
  await sleep(300); await p.click('#btnPause'); const t0 = (await sim(p)).t; await sleep(500);
  ok('Pause hält an', (await sim(p)).t === t0 && (await shell(p)).screen === 'pause'); await shot(p, 'desktop-pause');
  await p.keyboard.press('Escape'); ok('Esc setzt fort', !!(await until(async () => (await sim(p)).t > t0 + 0.3, 5000, 'weiter')));
  await p.evaluate(() => { const s = window.__game.sim(); s.score = [9, 6]; });
  let end = null;
  for (let n = 0; n < 6 && !end; n++) {
    await live(p);
    await p.evaluate(() => { window.__game.sim().score = [9, 6]; });
    await place(p, { own: 0, p: [{ x: 0, z: 6.5, f: 3.14 }, { x: 5, z: 9 }], still: [1] }); await sleep(300);
    await releaseAt(p);
    end = await until(async () => (await shell(p)).screen === 'end', 8000, 'ende');
  }
  ok('Ergebnis nach Erreichen von 11', !!end && (await shell(p)).winner === 0 && (await shell(p)).score[0] >= 11, await shell(p));
  ok('Bilanz wird gezeigt', /Bilanz gegen den Computer/.test(await p.$eval('#endRecord', (e) => e.textContent))); await shot(p, 'desktop-end');
  await p.click('#btnAgain'); ok('Noch einmal startet bei 0 : 0', !!(await until(async () => (await shell(p)).screen === 'play' && (await sim(p)).score.join() === '0,0', 5000, 'neu')));
  await p.click('#btnPause'); await p.click('#btnQuit'); ok('Zurück ins Menü', (await shell(p)).screen === 'menu' && (await sim(p)) === null);
  ok('Keine Fehler, keine fremden Anfragen', !p.errors.length && !p.bad.length && !p.external.length, [p.errors, p.bad, p.external]);
  await p.browserContext().close();

  console.log('3  Ganze Partien gegen den Computer (beschleunigt)');
  for (const level of ['easy', 'hard']) {
    const q = await T.open({ width: 900, height: 600 }, '?nosw&speed=8');
    await q.click(`[data-level=${level}]`); await q.click('#btnSolo'); const t = Date.now();
    const done = await until(async () => (await shell(q)).screen === 'end', 150000, 'partie ' + level);
    const sh = await shell(q);
    ok(`Stufe ${level}: Computer spielt die Partie zu Ende (${sh.score.join(':')}, ${Math.round((Date.now() - t) / 1000)} s)`, !!done && sh.winner === 1 && sh.level === level && !q.errors.length, [sh, q.errors]);
    await q.browserContext().close();
  }

  console.log('4  Bildschirmgrößen, Kamera, Berührung');
  const SIZES = [['320x568', 320, 568, 1, 52], ['390x844', 390, 844, 1, 75], ['844x390', 844, 390, 1, 44], ['768x1024', 768, 1024, 1, 100], ['1024x768', 1024, 768, 1, 75], ['1280x720', 1280, 720, 0, 85], ['1920x1080', 1920, 1080, 0, 125]];
  const SCENES = [
    ['Check', { own: 0, p: [{ x: 0, z: 7.6, f: 3.14 }, { x: 0, z: 6.15, f: 0 }], still: [0, 1] }],
    ['Ecken', { own: 0, p: [{ x: 6.2, z: 1.2 }, { x: -6.2, z: 9 }], still: [0, 1] }],
    ['hinten', { own: 1, p: [{ x: -6, z: 10.8 }, { x: 6, z: 10.8 }], still: [0, 1] }],
    ['Korb', { own: 0, p: [{ x: -1.1, z: 1.8 }, { x: 0.6, z: 2.4 }], still: [0, 1] }],
    ['Zweikampf', { own: 1, p: [{ x: 2.4, z: 4.4 }, { x: 2.9, z: 5.3 }], still: [0, 1] }]
  ];
  for (const [name, width, height, touch, minSize] of SIZES) {
    const m = await T.open({ width, height, isMobile: !!touch, hasTouch: !!touch }, '?nosw');
    const menu = await m.evaluate(() => { const bad = [...document.querySelectorAll('#menu button, #menu input')].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 40).map((e) => e.textContent); const c = document.querySelector('#menu .card').getBoundingClientRect(); return { bad, w: c.width, over: document.documentElement.scrollWidth > innerWidth }; });
    ok(name + ': Menü passt, Knöpfe groß genug', !menu.bad.length && menu.w <= width && !menu.over, menu);
    await shot(m, name + '-menu');
    await (touch ? m.tap('#btnSolo') : m.click('#btnSolo')); await live(m);
    const problems = [], sizes = [];
    for (const [scene, cfg] of SCENES) {
      await place(m, cfg); await sleep(1500); await place(m, cfg); await sleep(250);
      const g = await view(m);
      const rects = await m.evaluate(() => [...document.querySelectorAll('#hud .score, #hud .tools button, #touch:not([hidden]) .act, #touch:not([hidden]) #stickBase')].map((e) => e.getBoundingClientRect()).filter((r) => r.width).map((r) => [r.left, r.top, r.right, r.bottom]));
      const points = [['Brett links', g.board[0]], ['Brett rechts', g.board[1]], ['Ring', g.rim], ['Ball', g.ball], ...g.players.flatMap((q, k) => [['Kopf ' + k, q.head], ['Füße ' + k, q.feet]])];
      for (const [what, pt] of points) {
        if (pt.x < 0 || pt.y < 0 || pt.x > width || pt.y > height) problems.push(scene + ': ' + what + ' außerhalb ' + Math.round(pt.x) + '/' + Math.round(pt.y));
        else if (rects.some((r) => overlaps(pt, r))) problems.push(scene + ': ' + what + ' verdeckt ' + Math.round(pt.x) + '/' + Math.round(pt.y));
      }
      if (scene === 'Check' || scene === 'Zweikampf') sizes.push(Math.round(Math.max(...g.players.map((q) => q.feet.y - q.head.y))));
      await shot(m, name + '-' + scene);
      if (g.calls > 190) problems.push('Zeichenaufrufe ' + g.calls);
    }
    ok(name + ': Korb, beide Spieler und Ball immer sichtbar und unverdeckt', !problems.length, problems);
    ok(name + ': Figuren groß genug (' + sizes.join(', ') + ' px, mindestens ' + minSize + ')', sizes.every((s) => s >= minSize), sizes);
    if (touch) {
      await place(m, { own: 0, p: [{ x: 0, z: 7.6, f: 3.14 }, { x: 4, z: 3 }], still: [1] }); await sleep(300);
      const g = await m.evaluate(() => { const r = (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }; return { stick: r(document.getElementById('stickBase')), acts: [...document.querySelectorAll('#touch .act')].map(r), labels: [...document.querySelectorAll('#touch .act')].map((e) => e.textContent), tools: [...document.querySelectorAll('#hud .tools button')].filter((e) => e.offsetParent).map(r) }; });
      const inside = (b) => b[0] >= 0 && b[1] >= 0 && b[2] <= width + 0.5 && b[3] <= height + 0.5, apart = (a, b) => a[2] <= b[0] + 1 || b[2] <= a[0] + 1 || a[3] <= b[1] + 1 || b[3] <= a[1] + 1;
      const all = [g.stick, ...g.acts, ...g.tools];
      ok(name + ': Stick und drei Knöpfe im Bild, mindestens 48 px, ohne Überlappung', g.acts.length === 3 && all.every(inside) && all.every((b) => b[2] - b[0] >= 47.5 && b[3] - b[1] >= 47.5) && all.every((a, i) => all.every((b, j) => i === j || apart(a, b))), all);
      ok(name + ': Beschriftung im Angriff', g.labels[0] === 'WURF 3' && g.labels[1] === 'TRICK' && g.labels[2] === 'SPRINT', g.labels);
      const st = await (await m.$('#stickZone')).boundingBox(), sb = g.stick, cx = (sb[0] + sb[2]) / 2, cy = (sb[1] + sb[3]) / 2;
      const x0 = (await sim(m)).p[0].x, t1 = await m.touchscreen.touchStart(cx, cy); await t1.move(cx + 70, cy); await sleep(350);
      const sprint = g.acts[2], t2 = await m.touchscreen.touchStart((sprint[0] + sprint[2]) / 2, (sprint[1] + sprint[3]) / 2); await sleep(250);
      const c1 = await controls(m), x1 = (await sim(m)).p[0].x;
      ok(name + ': Stick und Sprint gleichzeitig, Figur läuft nach rechts', st.width > 0 && c1.x > 0.8 && c1.c && !c1.a && x1 > x0 + 0.5, [c1, x0, x1]);
      const wurf = g.acts[0], t3 = await m.touchscreen.touchStart((wurf[0] + wurf[2]) / 2, (wurf[1] + wurf[3]) / 2); await sleep(280);
      const s = await sim(m); await shot(m, name + '-wurf-laden');
      const meter = await hud(m);
      ok(name + ': dritter Finger wirft, während man weiterläuft, Anzeige im Bild', s.p[0].act === 'gather' && meter.meter && meter.rect.left >= 0 && meter.rect.right <= width && meter.rect.top >= 0 && meter.rect.bottom <= height, [s.p[0].act, meter]);
      await t3.end(); await t2.end(); await t1.end(); await sleep(80);
      const c2 = await controls(m); ok(name + ': Loslassen setzt alles zurück', !c2.x && !c2.y && !c2.a && !c2.b && !c2.c, c2);
      await live(m); await place(m, { own: 1, p: [{ x: 0, z: 5 }, { x: 0, z: 7.4 }], still: [0, 1] }); await sleep(250);
      const def = await m.$$eval('#touch .act', (l) => l.map((e) => e.textContent));
      await place(m, { own: 1, p: [{ x: 0, z: 5 }, { x: 0, z: 7.4 }], still: [0, 1] }); await m.evaluate(() => { const q = window.__game.sim(); Object.assign(q.ball, { own: -1, mode: 'loose', x: 2, y: 3, z: 5, vy: 3 }); }); await sleep(100);
      const loose = await m.$$eval('#touch .act', (l) => l.map((e) => e.textContent));
      ok(name + ': Beschriftung wechselt (Verteidigung, freier Ball)', def[0] === 'BLOCK' && def[1] === 'KLAU' && loose[0] === 'SPRUNG', [def, loose]);
    }
    ok(name + ': keine Fehler', !m.errors.length && !m.bad.length && !m.external.length, [m.errors, m.bad, m.external]);
    await m.browserContext().close();
  }

  console.log('5  Bildrate, reduzierte Bewegung, Offline');
  const f = await T.open({ width: 1280, height: 720 }, '?nosw'); await f.click('#btnSolo'); await live(f);
  const fps = await f.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); (function tick() { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res((n * 1000) / (performance.now() - t0)); })(); }));
  const info = await view(f);
  ok(`Flüssig genug im Testbrowser (${fps.toFixed(0)} Bilder/s, ${info.calls} Zeichenaufrufe, ${info.tris} Dreiecke)`, fps > 20 && info.calls <= 190, [fps, info.calls]);
  await f.browserContext().close();
  const rm = await T.open({ width: 800, height: 600 }, '?nosw'); await rm.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await rm.reload(); await rm.waitForFunction(() => window.__game); await rm.click('#btnSolo');
  ok('Mit reduzierter Bewegung spielbar', !!(await live(rm)) && !rm.errors.length, rm.errors); await rm.browserContext().close();
  const o = await T.open({ width: 800, height: 600 }, '');
  await until(() => o.evaluate(async () => !!(navigator.serviceWorker && navigator.serviceWorker.controller) && (await caches.keys()).some((k) => k.startsWith('blacktop-'))), 20000, 'sw'); await sleep(1500);
  await T.offline(o); o.errors.length = 0; await o.reload({ waitUntil: 'load' }); await o.waitForFunction(() => window.__game, { timeout: 30000 }); await o.click('#btnSolo');
  ok('Ohne Netz spielbar', !!(await live(o, 25000)) && !o.errors.length, o.errors);
} catch (e) { T.abort(e); }
await T.done();
