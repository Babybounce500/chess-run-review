// Browser-Test (headless): echte Tasten und Fingergesten.   node tests/browser-test.mjs [https://.../]
import { harness } from './harness.mjs';
const T = await harness();
const { ok, until, shell, sim, sleep, shot } = T;
const view = (p) => p.evaluate(() => window.__game.view());
const set = (p, o) => p.evaluate((o) => window.__game.set(o), o);
const fighting = (p, ms = 20000) => until(async () => (await sim(p))?.phase === 'fight', ms, 'kampf');
const calm = async (p, gap = 1.2) => { await until(async () => { const s = await sim(p); return s.phase === 'fight' && !s.f[0].act && s.f[0].stun <= 0; }, 8000, 'ruhe'); await set(p, { gap, hp: [100, 100], clock: 55 }); };
// Schlag auslösen und warten, bis er gezählt ist (der Gegner kann dazwischenhauen, dann neuer Versuch)
async function punched(p, act, kind) {
  for (let i = 0; i < 5; i++) {
    await calm(p); await act();
    if (await until(async () => { const s = await sim(p); return s.f[0].act && s.f[0].act.k === kind; }, 900, 'schlag ' + kind)) return true;
  }
  return false;
}
try {
  console.log('Desktop und Tastatur');
  const p = await T.open({ width: 1280, height: 720 }, '?speed=1&nosw&show=0');
  ok('Menü ohne Online-Knöpfe (folgt in Phase 3)', await p.evaluate(() => ['btnHost', 'btnJoinLink'].every((id) => getComputedStyle(document.getElementById(id)).display === 'none')));
  await shot(p, 'menu-desktop');
  await p.click('[data-level="easy"]'); await p.click('#btnSolo');
  ok('Runde 1 beginnt', !!(await fighting(p)));
  for (const [code, kind] of [['KeyJ', 'jab'], ['KeyK', 'cross'], ['KeyL', 'hook'], ['KeyE', 'upper']]) ok(code + ' schlägt ' + kind, await punched(p, () => p.keyboard.press(code), kind));
  await calm(p); await p.keyboard.down('Space'); const g1 = await until(async () => (await sim(p)).f[0].guard === 1, 3000, 'deckung'); await p.keyboard.up('Space'); ok('Leertaste: Deckung', !!g1);
  await calm(p); await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyK'); const b = await until(async () => (await sim(p)).f[0].act?.body === 1, 2000, 'körper'); await p.keyboard.up('KeyK'); await p.keyboard.up('ShiftLeft'); ok('Shift: Schlag zum Körper', !!b);
  await calm(p); await p.keyboard.down('KeyQ'); const d = await until(async () => (await sim(p)).f[0].duck > 0.7, 3000, 'ducken'); await p.keyboard.up('KeyQ'); ok('Q: ducken', !!d);
  await calm(p); await p.keyboard.down('KeyD'); const l = await until(async () => (await sim(p)).f[0].lean > 0.7, 3000, 'seite'); await p.keyboard.up('KeyD'); ok('D: Ausweichen nach rechts', !!l);
  await calm(p, 2.0); await p.keyboard.down('KeyW'); await sleep(350); await p.keyboard.up('KeyW'); ok('W: Schritt nach vorn', (await sim(p)).gap < 1.85, (await sim(p)).gap);
  // Handschuh erreicht den Kopf
  let reach = null;
  for (let i = 0; i < 8 && reach === null; i++) {
    await calm(p, 1.35); await p.keyboard.press('KeyJ');
    const t0 = Date.now(); while (Date.now() - t0 < 1500) { const r = await p.evaluate(() => { const s = window.__game.sim(), v = window.__game.view(), a = s.f[0].act; if (!a || a.k !== 'jab' || !a.done || a.miss || a.t > 0.2) return null; const g = v.gloves[0][0], h = v.headW[1]; return Math.hypot(g[0] - h[0], g[1] - h[1], g[2] - h[2]); }); if (r !== null) { reach = r; break; } await sleep(8); }
  }
  ok('Beim Treffer liegt der Handschuh am gegnerischen Kopf', reach !== null && reach < 0.42, reach);
  const before = (await view(p)).camera; await p.click('#btnCam'); await sleep(500); const after = await view(p);
  ok('Kamera wechselt (Schulterblick und Ich-Sicht)', before !== after.camera, [before, after.camera]); await shot(p, 'ich-sicht'); await p.keyboard.press('KeyV');
  const t0 = (await sim(p)).t; await p.click('#btnPause'); await sleep(300); const t1 = (await sim(p)).t; await sleep(300); ok('Pause hält an', (await sim(p)).t === t1 && t1 >= t0); await p.click('#btnResume');
  const barNames = await p.evaluate(() => (document.getElementById('bars').hidden ? 'verdeckt' : [...document.querySelectorAll('.fbar .who b')].map((e) => e.textContent).join()));
  ok('Anzeige: zwei Balken mit Namen', /^Du,(Rocco Brandt|Viktor Sand|Ilja Stahl)$/.test(barNames), barNames);
  const s = await sim(p); ok('Wenige Zeichenaufrufe', (await view(p)).calls < 200, (await view(p)).calls);
  const fps = await p.evaluate(() => new Promise((res) => { let n = 0; const t = performance.now(); (function f() { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else res(n / ((performance.now() - t) / 1000)); })(); }));
  console.log('    Bilder je Sekunde (headless): ' + fps.toFixed(1)); ok('Läuft flüssig (mindestens 40 Bilder/s)', fps >= 40, fps);
  ok('Töne: Gong, Ausholen', (await p.evaluate(() => window.__game.sounds())).some((x) => x === 'whoosh') );
  ok('Keine Fehler, keine fremden Anfragen', !p.errors.length && !p.bad.length && !p.external.length, [p.errors, p.bad, p.external]);

  console.log('Niederschlag und Aufstehen');
  let down = false;
  for (let i = 0; i < 25 && !down; i++) { await calm(p, 1.15); await set(p, { hp: [100, 3] }); await p.keyboard.press('KeyK'); down = !!(await until(async () => (await sim(p)).phase === 'down', 900, 'unten')); }
  ok('Niederschlag: Zähler erscheint', down && !!(await until(() => p.evaluate(() => !document.getElementById('count').hidden), 4000, 'zähler')));
  await shot(p, 'niederschlag');
  await until(async () => (await sim(p)).phase !== 'down', 20000, 'nach unten');
  if ((await sim(p)).phase === 'fight') {
    let mine = false;
    for (let i = 0; i < 40 && !mine; i++) { const x = await sim(p); if (x.phase !== 'fight') break; await set(p, { gap: 1.1, hp: [2, 100] }); await p.keyboard.down('KeyD'); await p.keyboard.up('KeyD'); mine = !!(await until(async () => (await sim(p)).phase === 'down' && (await sim(p)).down.who === 0, 1500, 'ich unten')); }
    ok('Selbst am Boden: Aufsteh-Balken', mine && (await p.evaluate(() => !document.getElementById('getup').hidden)));
    await shot(p, 'aufstehen');
    // im richtigen Moment drücken, in der Seite getaktet
    await p.evaluate(() => { const tick = () => { const s = window.__game.sim(); if (!s || s.phase !== 'down') return; const D = s.down; if (Math.abs(D.m - D.zone) < 0.05) { dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })), 40); setTimeout(tick, 260); } else requestAnimationFrame(tick); }; tick(); });
    ok('Im grünen Feld drücken: wieder auf den Beinen', !!(await until(async () => { const x = await sim(p); return x.phase === 'fight' && x.f[0].downs >= 1; }, 15000, 'auf')), (await sim(p)).down);
  } else ok('(Computer blieb liegen, Aufstehen im nächsten Abschnitt nicht prüfbar)', false, (await sim(p)).phase);
  await p.browserContext().close();

  console.log('Ganzer Kampf bis zum Ergebnis');
  const m = await T.open({ width: 1024, height: 768 }, '?speed=8&nosw&show=0');
  await m.click('[data-level="hard"]'); await m.click('#btnSolo');
  ok('Kampf endet', !!(await until(async () => (await shell(m)).screen === 'end', 120000, 'ende')));
  await sleep(300); const txt = await m.$eval('#endScore', (e) => e.textContent);
  ok('Ergebnis nennt Art des Sieges und Treffer', /(K\. o\.|Punktentscheidung)/.test(txt) && /Deine Treffer: \d+ von \d+/.test(txt), txt);
  await shot(m, 'ende');
  await m.click('#btnAgain'); ok('Neuer Kampf beginnt frisch', !!(await until(async () => { const x = await sim(m); return x.round === 1 && x.f[0].downs === 0 && (await shell(m)).screen === 'play'; }, 10000, 'neu')));
  ok('Keine Fehler', !m.errors.length, m.errors); await m.browserContext().close();

  console.log('Handy: Gesten und Bildschirmgrößen');
  for (const [n, w, h] of [['320x568', 320, 568], ['390x844', 390, 844], ['844x390', 844, 390], ['768x1024', 768, 1024], ['1024x768', 1024, 768]]) {
    const q = await T.open({ width: w, height: h, isMobile: true, hasTouch: true }, '?speed=1&nosw&show=0');
    const menu = await q.evaluate(() => { const b = document.getElementById('btnSolo').getBoundingClientRect(), c = document.querySelector('#menu .card').getBoundingClientRect(); return b.bottom <= innerHeight && b.top >= 0 && c.left >= 0 && c.right <= innerWidth + 1; });
    ok(n + ': Menü passt', menu); await q.tap('#btnSolo'); await fighting(q); await sleep(900);
    const g = await q.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      return { w: innerWidth, h: innerHeight, stick: r('#stickBase'), acts: [...document.querySelectorAll('#touch .act')].filter((e) => !e.hidden).map((e) => { const b = e.getBoundingClientRect(); return { id: e.dataset.act, l: b.left, t: b.top, r: b.right, b: b.bottom }; }), bars: r('#bars'), tools: r('.tools'), score: r('.score'), zone: r('#punchZone'), heads: window.__game.view().heads }; });
    const inside = (a) => a && a.l >= -0.5 && a.t >= -0.5 && a.r <= g.w + 0.5 && a.b <= g.h + 0.5, hit = (a, c) => a && c && a.l < c.r - 1 && a.r > c.l + 1 && a.t < c.b - 1 && a.b > c.t + 1;
    ok(n + ': drei Knöpfe und Stick im Bild, groß, ohne Überlappung', g.acts.length === 3 && [g.stick, ...g.acts].every(inside) && g.acts.every((a) => a.r - a.l >= 56) && !g.acts.some((a, i) => hit(a, g.stick) || g.acts.some((c, j) => i < j && hit(a, c))), g.acts);
    ok(n + ': Balken überdecken weder Knöpfe oben noch Spielstand', inside(g.bars) && !hit(g.bars, g.tools) && !hit(g.bars, g.score), [g.bars, g.tools, g.score]);
    const oh = g.heads[1]; ok(n + ': Kopf des Gegners frei sichtbar', oh.x > 0 && oh.x < g.w && oh.y > g.bars.b && oh.y < g.h * 0.75 && !g.acts.some((a) => oh.x > a.l && oh.x < a.r && oh.y > a.t && oh.y < a.b), [oh, g.bars.b]);
    await shot(q, n + '-kampf');
    // Wischgesten auf freier Fläche rechts
    const x = g.zone.l + (g.zone.r - g.zone.l) * 0.55, y = g.zone.t + (g.zone.b - g.zone.t) * 0.3, len = Math.max(50, Math.min(w, h) * 0.14);
    const gesture = async (dx, dy) => { const t = await q.touchscreen.touchStart(x, y); if (dx || dy) { await t.move(x + dx * 0.5, y + dy * 0.5); await t.move(x + dx, y + dy); } await t.end(); };
    for (const [nm, dx, dy, kind] of [['Tippen', 0, 0, 'jab'], ['Wisch hoch', 0, -len, 'cross'], ['Wisch seitwärts', -len, 4, 'hook'], ['Wisch runter', 0, len, 'upper']]) ok(n + ': ' + nm + ' = ' + kind, await punched(q, () => gesture(dx, dy), kind));
    await calm(q);
    const bk = await (await q.$('#touch .act[data-act=block]')).boundingBox(); const f1 = await q.touchscreen.touchStart(bk.x + bk.width / 2, bk.y + bk.height / 2);
    const st = await (await q.$('#stickBase')).boundingBox(); const f2 = await q.touchscreen.touchStart(st.x + st.width / 2, st.y + st.height / 2); await f2.move(st.x + st.width / 2 + 60, st.y + st.height / 2); await sleep(120);
    const c = await q.evaluate(() => window.__game.controls()); ok(n + ': Deckung und Stick gleichzeitig', c.block && c.x > 0.5, c); await f2.end(); await f1.end();
    ok(n + ': keine Fehler', !q.errors.length, q.errors); await q.browserContext().close();
  }
  console.log('Knöpfe statt Wischen, und offline');
  const r = await T.open({ width: 390, height: 844, isMobile: true, hasTouch: true }, '?show=0');
  await r.tap('#btnSwipe'); await r.tap('#btnSolo'); await fighting(r); await sleep(500);
  ok('Knopfmodus: sieben Knöpfe, keine Wischfläche', await r.evaluate(() => [...document.querySelectorAll('#touch .act')].filter((e) => !e.hidden).length === 7 && document.getElementById('punchZone').hidden));
  const ov = await r.evaluate(() => { const l = [...document.querySelectorAll('#touch .act'), document.getElementById('stickBase')].map((e) => e.getBoundingClientRect()); return l.every((a, i) => a.left >= 0 && a.right <= innerWidth + 0.5 && a.bottom <= innerHeight + 0.5 && l.every((b, j) => i === j || a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1)); });
  ok('Knopfmodus: nichts überlappt', ov); await shot(r, 'knopfmodus');
  ok('Knopf Haken schlägt', await punched(r, async () => { const bb = await (await r.$('#touch .act[data-act=hook]')).boundingBox(); await r.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }, 'hook'));
  await sleep(2500); await T.offline(r); r.errors.length = 0; await r.reload({ waitUntil: 'load' }); await r.waitForFunction(() => window.__game, { timeout: 20000 }); await r.tap('#btnSolo');
  ok('Ohne Netz spielbar', !!(await fighting(r)) && !r.errors.length, r.errors);
} catch (e) { T.abort(e); }
await T.done();
