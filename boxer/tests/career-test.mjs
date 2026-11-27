// Karriere, Rang, Training, Höhepunkt und Reaktionszeit im Browser.   node tests/career-test.mjs [https://.../]
import { harness } from './harness.mjs';
const T = await harness();
const { ok, until, shell, sim, sleep, shot } = T;
const set = (p, o) => p.evaluate((o) => window.__game.set(o), o);
const info = (p) => p.evaluate(() => window.__game.show());
const train = (p) => p.evaluate(() => window.__game.training());
const text = (p, sel) => p.evaluate((sel) => { const e = document.querySelector(sel); return !e || e.hidden ? '' : e.textContent; }, sel);
const visible = (p, sel) => p.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; const b = e.getBoundingClientRect(), s = getComputedStyle(e); return b.width > 0 && s.display !== 'none' && s.visibility !== 'hidden'; }, sel);
const rows = (p) => p.$$eval('#careerList li', (l) => l.map((e) => ({ cls: e.className, name: e.querySelector('b').textContent, disabled: e.querySelector('button').disabled })));
const store = (p, k) => p.evaluate((k) => localStorage.getItem('shadowboxer_' + k), k);
const ended = (p) => until(async () => (await shell(p)).screen === 'end', 20000, 'ende');
const fighting = (p) => until(async () => (await sim(p))?.phase === 'fight', 20000, 'kampf');
try {
  for (const [n, vp] of [['desktop', { width: 1280, height: 720 }], ['hoch', { width: 390, height: 844, isMobile: true, hasTouch: true }], ['quer', { width: 844, height: 390, isMobile: true, hasTouch: true }], ['klein', { width: 320, height: 568, isMobile: true, hasTouch: true }]]) {
    console.log('Menü und Karriere ' + n);
    const p = await T.open(vp, '?speed=4&nosw&show=0');
    ok(n + ': Menü zeigt Rang, Karriere und Training', /Bronze · 0 Punkte/.test(await text(p, '#rankBadge')) && (await visible(p, '#btnCareer')) && (await visible(p, '#btnTrain')));
    const menu = await p.evaluate(() => { const c = document.querySelector('#menu .card').getBoundingClientRect(); const b = document.getElementById('btnSolo'); b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return c.left >= 0 && c.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 0.5; });
    ok(n + ': Menü passt', menu); await shot(p, n + '-menu');
    await p.click('#btnCareer');
    let l = await rows(p);
    ok(n + ': fünf Gegner, nur der erste offen', l.length === 5 && l[0].cls === 'open' && !l[0].disabled && l.slice(1).every((r) => r.cls === 'locked' && r.disabled) && /Ilja Stahl/.test(l[4].name), l);
    const fit = await p.evaluate(() => { const c = document.querySelector('#career .card').getBoundingClientRect(); const wide = [...document.querySelectorAll('#careerList li')].every((e) => e.scrollWidth <= e.clientWidth + 1); const b = document.getElementById('careerBack'); b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); document.querySelector('#career .card').scrollTop = 0; return c.left >= 0 && c.right <= innerWidth + 1 && wide && r.bottom <= innerHeight + 0.5; });
    ok(n + ': Liste passt, „Zurück“ erreichbar', fit); await shot(p, n + '-karriere');
    await p.click('#careerBack'); ok(n + ': Zurück führt ins Menü', (await visible(p, '#menu')) && !(await visible(p, '#career')));
    await p.click('#btnCareer'); await p.click('#careerList button[data-key=k1]');
    ok(n + ': Karrierekampf gegen Rocco Brandt', !!(await fighting(p)) && (await shell(p)).names[1] === 'Rocco Brandt' && (await shell(p)).level === 'k1');
    await set(p, { win: 0 }); ok(n + ': Sieg', !!(await ended(p))); await sleep(400);
    const line = await text(p, '#rankLine');
    ok(n + ': Rangpunkte und nächster Gegner', /Bronze · \+18 Punkte · 18\/100/.test(line) && /Milan Kord wartet/.test(line) && (await visible(p, '#btnNext')), line);
    ok(n + ': Bilanz nennt den Gegner', /Bilanz gegen Rocco Brandt · Siege: 1/.test(await text(p, '#endRecord')), await text(p, '#endRecord'));
    const reach = await p.evaluate(() => ['btnNext', 'btnAgain', 'btnMenu'].every((id) => { const b = document.getElementById(id); b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 0.5; }));
    ok(n + ': alle Knöpfe erreichbar', reach); await shot(p, n + '-karriere-sieg');
    await p.click('#btnNext');
    ok(n + ': „Nächster Gegner“ startet Kampf zwei', !!(await fighting(p)) && (await shell(p)).names[1] === 'Milan Kord' && !(await visible(p, '#btnNext')));
    await set(p, { win: 1 }); await ended(p); await sleep(400);
    ok(n + ': Niederlage: Tipp, kein Fortschritt, Punktabzug', /Tipp: Er schlägt selten/.test(await text(p, '#rankLine')) && /−12 Punkte/.test(await text(p, '#rankLine')) && (await store(p, 'career')) === '1' && !(await visible(p, '#btnNext')), await text(p, '#rankLine'));
    await p.click('#btnMenu');
    ok(n + ': Menü: Punkte gespeichert, Schwierigkeit wieder normal', /6 Punkte/.test(await text(p, '#rankBadge')) && (await shell(p)).level === 'normal', [await text(p, '#rankBadge'), (await shell(p)).level]);
    await p.reload(); await p.waitForFunction(() => window.__game); await p.click('#btnCareer'); l = await rows(p);
    ok(n + ': Fortschritt übersteht Neuladen', l[0].cls === 'beaten' && l[1].cls === 'open' && l[2].cls === 'locked', l.map((r) => r.cls));
    await p.click('#careerReset'); const first = (await store(p, 'career')); await p.click('#careerReset');
    ok(n + ': Neu beginnen erst beim zweiten Tippen', first === '1' && (await store(p, 'career')) === '0' && (await rows(p))[0].cls === 'open');
    // Titelkampf
    await p.evaluate(() => localStorage.setItem('shadowboxer_career', '4')); await p.click('#careerBack'); await p.click('#btnCareer'); await p.click('#careerList button[data-key=k5]'); await fighting(p);
    await set(p, { win: 0 }); await ended(p); await sleep(400);
    ok(n + ': Titelgewinn', /TITEL GEWONNEN/.test(await text(p, '#rankLine')) && !(await visible(p, '#btnNext'))); await shot(p, n + '-titel');
    await p.click('#btnMenu'); ok(n + ': Menü nennt den Gürtelträger', /Gürtelträger/.test(await text(p, '#rankBadge')));
    await p.click('#btnSolo'); await fighting(p); ok(n + ': normaler Kampf danach wie gewohnt', (await shell(p)).names[1] === 'Viktor Sand' && (await shell(p)).level === 'normal');
    ok(n + ': keine Fehler', !p.errors.length && !p.bad.length, [p.errors, p.bad]); await p.browserContext().close();

    console.log('Training ' + n);
    const q = await T.open(vp, '?speed=1&nosw');
    await q.click('#btnTrain');
    ok(n + ': Training beginnt sofort, ohne Einmarsch', !!(await fighting(q)) && (await info(q)).walk === null && (await shell(q)).names[1] === 'Partner' && (await visible(q, '#train')));
    ok(n + ': Anzeige nennt Training', (await text(q, '#sub')) === 'Training');
    await sleep(900);
    const lay = await q.evaluate(() => { const r = (e) => e.getBoundingClientRect(), t = r(document.getElementById('train')), hit = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
      const others = [...document.querySelectorAll('#touch .act'), document.getElementById('stickBase'), document.getElementById('bars'), document.querySelector('.tools'), document.querySelector('.score')].filter((e) => e && !e.hidden && r(e).width > 0);
      const head = window.__game.view().heads[1];
      return { inside: t.left >= 0 && t.right <= innerWidth + 0.5 && t.top >= 0 && t.bottom <= innerHeight + 0.5, clash: others.filter((e) => hit(t, r(e))).map((e) => e.id || e.dataset.act || e.className), head: head.x > t.left && head.x < t.right && head.y > t.top && head.y < t.bottom, t: [t.left, t.top, t.right, t.bottom] }; });
    ok(n + ': Trainingstafel im Bild, ohne Überlappung, Gegnerkopf frei', lay.inside && !lay.clash.length && !lay.head, lay);
    await shot(q, n + '-training');
    await q.evaluate(() => { window.__msgs = []; new MutationObserver(() => window.__msgs.push(document.getElementById('trainMsg').textContent)).observe(document.getElementById('trainMsg'), { childList: true, characterData: true, subtree: true }); });
    // Parade nach Leiste: drücken, sobald die Marke im grünen Feld ist
    await q.evaluate(() => { const loop = () => { if (!window.__game.training().active) return; const s = window.__game.sim(), a = s.f[1].act; if (a && !a.done) { const left = ({ jab: 0.14, cross: 0.25, hook: 0.28, upper: 0.32 })[a.k] * a.slow - a.t; if (left < 0.1 && left > 0 && !window.__held) { window.__held = true; dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); setTimeout(() => { dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })); window.__held = false; }, 260); } } requestAnimationFrame(loop); }; loop(); });
    ok(n + ': im grünen Feld gedrückt gibt eine Parade mit Zeitangabe', !!(await until(async () => (await train(q)).parries >= 2, 16000, 'parade')) , await train(q));
    const msgs = await q.evaluate(() => window.__msgs); ok(n + ': Rückmeldung nennt Millisekunden', msgs.some((m) => /Parade! Deckung \d+ ms vor dem Treffer/.test(m)), msgs.slice(-4));
    await shot(q, n + '-training-parade');
    await q.click('[data-drill=free]'); await sleep(2600);
    const before = (await sim(q)).f[1].stats.thrown; await sleep(2600);
    ok(n + ': „Frei“: Partner schlägt nicht, Leiste weg', (await sim(q)).f[1].stats.thrown === before && !(await visible(q, '#trainBar')));
    await q.click('[data-drill=counter]'); await q.click('#trainPunch'); await q.click('#trainSlow');
    const o = (await train(q)).opt; ok(n + ': Schlag und Tempo wählbar', o.mode === 'counter' && o.k === 'cross' && o.slow === false && (await sim(q)).pace === 1, o);
    await q.click('#btnPause'); await sleep(200); ok(n + ': Pause blendet die Tafel aus', !(await visible(q, '#train'))); await q.click('#btnQuit');
    ok(n + ': Zurück im Menü: Training beendet, keine Punkte', !(await visible(q, '#train')) && !(await train(q)).active && /Bronze · 0/.test(await text(q, '#rankBadge')) && (await shell(q)).level === 'normal');
    await q.click('#btnSolo'); await until(async () => (await sim(q)) && (await info(q)).walk !== null, 5000, 'einmarsch');
    ok(n + ': danach normaler Kampf mit Einmarsch, ohne Übungsregeln', !(await sim(q)).drill && !(await sim(q)).pace);
    ok(n + ': keine Fehler', !q.errors.length, q.errors); await q.browserContext().close();
  }
  console.log('Höhepunkt und Reaktionszeit');
  const h = await T.open({ width: 1280, height: 720 }, '?speed=1&nosw');
  await h.click('#btnSolo'); await sleep(500); await h.keyboard.press('Enter'); await fighting(h);
  for (let i = 0; i < 20 && !(await info(h)).frames; i++) await sleep(100);
  for (let i = 0; i < 12; i++) { const s = await sim(h); if (s.phase !== 'fight') break; await set(h, { gap: 1.15, hp: [100, 90], clock: 55 }); await h.keyboard.press('KeyK'); await sleep(900); if ((await info(h)).best >= 8.5) break; }
  // ausweichen, sobald der Gegner ausholt, bis eine Reaktion gemessen ist
  await h.evaluate(() => { let n = -1; const loop = () => { const s = window.__game.sim(); if (!s || window.__game.reaction() !== null || s.phase === 'over') return; if (s.phase === 'fight') { window.__game.set({ hp: [100, 100], clock: 55, gap: 1.2 }); const a = s.f[1].act; if (a && s.f[1].stats.thrown !== n) { n = s.f[1].stats.thrown; setTimeout(() => { for (const c of ['Space']) dispatchEvent(new KeyboardEvent('keydown', { code: c })); setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })), 200); }, Math.max(0, ({ jab: 0.14, cross: 0.25, hook: 0.28, upper: 0.32 })[a.k] * 1000 - 110)); } } requestAnimationFrame(loop); }; loop(); });
  const quick = await until(() => h.evaluate(() => window.__game.reaction()), 40000, 'reaktion');
  ok('Reaktionszeit wird gemessen', quick >= 80 && quick <= 600, quick);
  await until(async () => (await sim(h)).phase === 'fight', 15000, 'frei'); await set(h, { win: 0 });
  ok('Abschlussbild', !!(await ended(h))); await sleep(500);
  ok('Ergebnis nennt die schnellste Reaktion', /Schnellste Reaktion: \d+ ms/.test(await text(h, '#endScore')), await text(h, '#endScore'));
  ok('Höhepunkt wird angeboten', await visible(h, '#btnHigh')); await h.click('#btnHigh'); await sleep(700);
  ok('Höhepunkt läuft, Ergebnis ist solange ausgeblendet', (await info(h)).replay?.kind === 'highlight' && !(await visible(h, '#end .card')) && (await visible(h, '#replay b')), await info(h)); await shot(h, 'hoehepunkt');
  await h.click('#btnSkipShow'); await sleep(400);
  ok('Überspringen bringt das Ergebnis zurück', (await info(h)).replay === null && (await visible(h, '#btnAgain')) && !(await visible(h, '#btnSkipShow')));
  await h.click('#btnHigh'); ok('Er läuft auch von selbst zu Ende', !!(await until(async () => (await info(h)).replay === null && (await visible(h, '#btnAgain')), 20000, 'ende')));
  await h.click('#btnHigh'); await sleep(300); await h.keyboard.press('Enter'); await sleep(300); ok('Enter überspringt ihn', (await info(h)).replay === null);
  await h.click('#btnAgain'); ok('Neuer Kampf ohne alten Höhepunkt', !!(await until(async () => (await info(h)).walk !== null, 5000, 'neu')) && !(await visible(h, '#btnHigh')));
  ok('Keine Fehler', !h.errors.length, h.errors);
  console.log('Korrekturen aus der Gegenprüfung');
  const k = await T.open({ width: 1280, height: 720 }, '?speed=1&nosw&show=0');
  await k.click('#btnTrain'); await fighting(k);
  await k.evaluate(() => { let n = -1; const loop = () => { if (!window.__game.training().active || window.__game.reaction() !== null) return; const s = window.__game.sim(), a = s.f[1].act; if (a && s.f[1].stats.thrown !== n) { n = s.f[1].stats.thrown; setTimeout(() => { dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })), 300); }, Math.max(0, ({ jab: 0.14, cross: 0.25, hook: 0.28, upper: 0.32 })[a.k] * a.slow * 1000 - 100)); } requestAnimationFrame(loop); }; loop(); });
  ok('Training misst die Reaktionszeit', !!(await until(() => k.evaluate(() => window.__game.reaction()), 20000, 'reaktion')) && !!(await until(async () => /Reaktion \d+ ms/.test(await text(k, '#trainStats')), 4000, 'anzeige')), await text(k, '#trainStats'));
  await k.click('#btnPause'); await k.click('#btnQuit');
  // verlassen, nachdem entschieden ist, aber vor dem Abschlussbild
  await k.click('#btnSolo'); await fighting(k); await set(k, { win: 1 }); await sleep(600);
  await k.click('#btnPause'); await k.click('#btnQuit'); await sleep(300);
  ok('Vor dem Abschlussbild gegangen: Niederlage zählt trotzdem, genau einmal', JSON.parse(await store(k, 'cpu_normal') || '{}').l === 1, await store(k, 'cpu_normal'));
  await k.click('#btnSolo'); await fighting(k); await set(k, { win: 0 }); await sleep(600);
  await k.click('#btnPause'); await k.click('#btnQuit'); await sleep(300);
  const rec = JSON.parse(await store(k, 'cpu_normal') || '{}');
  ok('Ebenso ein Sieg mit Rangpunkten', rec.w === 1 && rec.l === 1 && Number(await store(k, 'rank')) === 30, [rec, await store(k, 'rank')]);
  await k.click('#btnSolo'); await fighting(k); await set(k, { win: 0 }); await ended(k); await sleep(500); await k.click('#btnMenu');
  ok('Normaler Weg zählt nicht doppelt', JSON.parse(await store(k, 'cpu_normal')).w === 2 && Number(await store(k, 'rank')) === 60, [await store(k, 'cpu_normal'), await store(k, 'rank')]);
  // Pause in der letzten Sekunde
  await k.click('#btnShow'); await k.click('#btnSolo'); await sleep(500); await k.keyboard.press('Enter'); await fighting(k);
  for (let i = 0; i < 14; i++) { await set(k, { gap: 1.15, hp: [100, 90], clock: 55 }); await k.keyboard.press('KeyK'); await sleep(800); if ((await info(k)).best >= 8.5) break; }
  await set(k, { win: 0 }); await until(async () => (await sim(k)).pt > 6.7, 12000, 'kurz vor ende'); await k.keyboard.press('Escape');
  ok('Abschlussbild nach Pause: nicht eingefroren', !!(await ended(k)) && !(await shell(k)).paused, await shell(k));
  await sleep(300); if (await visible(k, '#btnHigh')) { await k.click('#btnHigh'); await sleep(500); const a1 = (await info(k)).replay; await sleep(500); const a2 = (await info(k)).replay; ok('Höhepunkt läuft danach weiter', !!a1 && (!a2 || a2.t !== a1.t || a2.angle !== a1.angle), [a1, a2]); } else ok('Höhepunkt vorhanden', false, await info(k));
  await k.evaluate(() => localStorage.setItem('shadowboxer_career', '5')); await k.reload(); await k.waitForFunction(() => window.__game);
  await k.click('#btnCareer'); await k.click('#careerReset'); await k.click('#careerReset'); await k.click('#careerBack');
  ok('Nach „Karriere neu beginnen“ kein Gürtelträger mehr im Menü', !/Gürtelträger/.test(await text(k, '#rankBadge')), await text(k, '#rankBadge'));
  ok('Keine Fehler', !k.errors.length, k.errors); await k.browserContext().close();
} catch (e) { T.abort(e); }
await T.done();
