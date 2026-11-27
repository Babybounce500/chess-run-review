// Browser-Test (headless): Tasten, Finger, Gamepad, Anzeige in fünf Bildschirmgrößen, Bildrate.
//   node tests/browser-test.mjs [https://.../]      Bildschirmfotos: SHOT_DIR=<ordner>
import { harness } from './harness.mjs';
const T = await harness();
const { ok, until, shell, sim, sleep, shot } = T;
const view = (p) => p.evaluate(() => window.__game.view());
const set = (p, code) => p.evaluate((c) => window.__game.set(c), code);
const playing = (p) => until(async () => (await shell(p)).screen === 'play' && !!(await sim(p)), 20000, 'spiel');
const SIZES = [
  ['320x568', { width: 320, height: 568, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ['390x844', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ['844x390', { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ['768x1024', { width: 768, height: 1024, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }],
  ['1280x720', { width: 1280, height: 720 }]
];
// laufende Partie, freier Ball weit weg vom Anstoß: eigener Spieler am Ball an gewünschter Stelle
const give = (x, z, i = 7) => `const d = (s.half === 1 ? 1 : -1); s.ph = 'play'; s.rs = null; s.pass = null; s.shot = null; const p = s.pl[${i}]; p.x = ${x} * d; p.z = ${z}; p.vx = p.vz = 0; p.act = 0; p.cd = 0; p.f = d > 0 ? 0 : Math.PI;
  for (let k = 11; k < 22; k++) { const q = s.pl[k]; if (Math.hypot(q.x - p.x, q.z - p.z) < 14) { q.x = p.x - d * 20; q.z = (k % 2 ? 28 : -28); } }
  s.ball.own = ${i}; s.ball.last = ${i}; s.ball.hands = false; s.ball.x = p.x + d * 0.5; s.ball.z = p.z; s.ball.y = 0.11; s.ctl[0] = ${i}; s.poss = 0; s.imm = s.t + 30; s.chg[0] = { k: '', t: 0 }; s.brain[0] = {};`;
const rects = (p) => p.evaluate(() => {
  const out = {};
  const add = (name, el) => { if (!el || el.hidden) return; const r = el.getBoundingClientRect(); if (r.width && r.height && getComputedStyle(el).display !== 'none') out[name] = { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  add('score', document.querySelector('#hud .score')); add('tools', document.querySelector('#hud .tools')); add('radar', document.getElementById('radar')); add('tag', document.getElementById('tag')); add('stick', document.getElementById('stickBase'));
  for (const b of document.querySelectorAll('#touch .act')) add(b.dataset.act, b);
  return out;
});
const overlap = (a, b) => a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1;
async function finger(p) {
  const c = await p.createCDPSession(), pts = new Map();
  const send = (type) => c.send('Input.dispatchTouchEvent', { type, touchPoints: [...pts].map(([id, q]) => ({ x: q.x, y: q.y, id })) });
  return {
    async down(id, x, y) { pts.set(id, { x, y }); await send('touchStart'); },
    async move(id, x, y) { pts.set(id, { x, y }); await send('touchMove'); },
    async up(id) { const q = pts.get(id); pts.delete(id); await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [...pts].map(([i, v]) => ({ x: v.x, y: v.y, id: i })) }); return q; }
  };
}
const mid = (r) => [(r.x + r.r) / 2, (r.y + r.b) / 2];

try {
  console.log('Desktop und Tastatur');
  const p = await T.open({ width: 1280, height: 720 }, '?speed=1&nosw&test');
  ok('Menü: Spiel gegen den Computer, drei Stufen', await p.evaluate(() => !!document.getElementById('btnSolo') && document.querySelectorAll('[data-level]').length === 3));
  ok('Online-Knöpfe sind ausgeblendet', await p.evaluate(() => ['btnHost', 'btnJoinLink'].every((id) => getComputedStyle(document.getElementById(id)).display === 'none')));
  await sleep(800); await shot(p, 'menu-1280x720');
  await p.click('[data-level="easy"]'); await p.click('#btnSolo');
  ok('Spiel startet', !!(await playing(p)));
  ok('Anzeige: Radar und Uhr', (await p.evaluate(() => window.__game.hud().radar && /1\. Halbzeit · 0:0/.test(document.getElementById('sub').textContent))));
  // Anstoß: eigener oder gegnerischer, danach läuft der Ball
  await set(p, "s.ph='set'; s.pt=1; const b=s.ball; s.rs={k:'kickoff',team:0,taker:9,x:0,z:0}; s.pl[9].x=-0.45; s.pl[9].z=0.25; s.pl[9].act=0; b.own=9; b.x=0; b.z=0; b.hands=false; s.ctl[0]=9; s.prev[0]={pass:false,through:false,shoot:false,switch:false}; s.brain=[{},{}];");
  const before = (await sim(p)).stats.pas[0];
  await p.keyboard.press('KeyJ', { delay: 60 });
  ok('J: Anstoßpass', !!(await until(async () => { const s = await sim(p); return s.ph === 'play' && s.stats.pas[0] > before; }, 5000, 'anstoss')));
  await set(p, give(-10, 0)); await sleep(150);
  let a = (await sim(p)).pl[7]; await p.keyboard.down('KeyD'); await sleep(700); await p.keyboard.up('KeyD'); let b = (await sim(p)).pl[7];
  ok('D: läuft nach rechts', b.x > a.x + 1.5, [a.x, b.x]);
  a = b; await p.keyboard.down('KeyW'); await sleep(600); await p.keyboard.up('KeyW'); b = (await sim(p)).pl[7]; ok('W: läuft nach oben (vom Betrachter weg)', b.z < a.z - 1, [a.z, b.z]);
  await set(p, give(-30, 0) + 'p.st = 1;'); await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyD'); await sleep(900); const st = (await sim(p)).pl[7].st; await p.keyboard.up('KeyD'); await p.keyboard.up('ShiftLeft'); ok('Shift: Sprint verbraucht Ausdauer', st < 0.97, st);
  for (const [code, name, check] of [['KeyJ', 'J: Pass', (s, n) => s.stats.pas[0] > n.pas], ['KeyI', 'I: Steilpass', (s, n) => s.stats.pas[0] > n.pas]]) {
    await set(p, give(-10, 0)); await sleep(200); const n = { pas: (await sim(p)).stats.pas[0] }; await p.keyboard.press(code, { delay: 120 });
    ok(name, !!(await until(async () => check(await sim(p), n), 3000, name)));
  }
  await set(p, give(36, 4, 9)); await sleep(250); const sh = (await sim(p)).stats.sh[0]; await p.keyboard.down('KeyD'); await p.keyboard.down('KeyK'); await sleep(380); await shot(p, 'schuss-laden-1280x720'); await p.keyboard.up('KeyK'); await p.keyboard.up('KeyD');
  ok('K halten und loslassen: Schuss', !!(await until(async () => (await sim(p)).stats.sh[0] > sh, 3000, 'schuss')));
  await set(p, "const d = s.half===1?1:-1; s.ph='play'; s.rs=null; s.ball.own=15; s.ball.hands=false; s.pl[15].act=0; s.pl[15].x=0; s.pl[15].z=0; s.ball.x=0; s.ball.z=0; s.ctl[0]=2; s.pl[2].x=-30*d; s.pl[6].x=-3*d; s.pl[6].z=1; s.imm=s.t+30; s.man=[-9,-9];");
  await sleep(40); const c0 = (await sim(p)).ctl[0]; await p.keyboard.press('Space', { delay: 60 }); await sleep(150); const c1 = (await sim(p)).ctl[0];
  ok('Leertaste: Spielerwechsel', c1 !== c0 || c1 === 6, [c0, c1]);
  console.log('Gamepad');
  await p.evaluate(() => { window.__pad = { axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false })) }; navigator.getGamepads = () => [window.__pad]; });
  await set(p, give(-10, 0)); a = (await sim(p)).pl[7]; await p.evaluate(() => { window.__pad.axes[0] = 1; }); await sleep(600); await p.evaluate(() => { window.__pad.axes[0] = 0; }); b = (await sim(p)).pl[7]; ok('Stick bewegt', b.x > a.x + 1, [a.x, b.x]);
  for (const [btn, name, key] of [[0, 'A: Pass', 'pas'], [3, 'Y: Steilpass', 'pas'], [1, 'B: Schuss', 'sh']]) {
    await set(p, give(key === 'sh' ? 35 : -10, 0)); await sleep(200); const n = (await sim(p)).stats[key][0];
    await p.evaluate((i) => { window.__pad.buttons[i] = { pressed: true }; }, btn); await sleep(160); await p.evaluate((i) => { window.__pad.buttons[i] = { pressed: false }; }, btn);
    ok(name, !!(await until(async () => (await sim(p)).stats[key][0] > n, 3000, name)));
  }
  await p.evaluate(() => { navigator.getGamepads = () => []; });
  console.log('Pause, Halbzeit, Ende');
  await p.click('#btnPause'); await sleep(300); const t1 = (await sim(p)).t; await sleep(400); ok('Pause hält an', (await sim(p)).t === t1); await shot(p, 'pause-1280x720'); await p.click('#btnResume');
  await set(p, "s.clock = 179.9; s.ph='play'; s.rs=null; s.shot=null;");
  ok('Halbzeit mit Statistik', !!(await until(async () => (await sim(p)).ph === 'half' && (await p.evaluate(() => window.__game.hud().panel)), 6000, 'halbzeit')));
  await sleep(500); await shot(p, 'halbzeit-1280x720');
  ok('zweite Halbzeit beginnt', !!(await until(async () => (await sim(p)).half === 2, 9000, 'hz2')));
  await set(p, "s.sc = [2, 1]; s.clock = 179.9; s.ph='play'; s.rs=null; s.shot=null;");
  ok('Ergebnisbild', !!(await until(async () => (await shell(p)).screen === 'end', 12000, 'ende')));
  ok('Ergebnis mit Statistik', await p.evaluate(() => document.querySelectorAll('#endStats tr').length >= 6 && /2 : 1/.test(document.getElementById('endScore').textContent)));
  await sleep(300); await shot(p, 'ende-1280x720');
  await p.click('#btnAgain'); ok('Noch einmal: neues Spiel', !!(await until(async () => { const s = await sim(p); return s && s.half === 1 && s.sc[0] === 0 && (await shell(p)).screen === 'play'; }, 8000, 'neu')));
  const sounds = await p.evaluate(() => window.__game.sounds()); ok('Töne nur bei Ereignissen', sounds.length > 0 && sounds.every((n) => ['kick', 'tackle', 'slide', 'head', 'blip', 'save', 'post', 'net', 'cheer', 'groan', 'whistle', 'ui'].includes(n)), [...new Set(sounds)]);
  await p.click('#btnPause'); await p.click('#btnQuit'); await sleep(300); const quiet = (await p.evaluate(() => window.__game.sounds())).length; await sleep(1500);
  ok('im Menü ist es still', (await p.evaluate(() => window.__game.sounds())).length === quiet && (await sim(p)) === null);
  ok('keine Fehler, keine fremden Anfragen', !p.errors.length && !p.external.length && !p.bad.length, [p.errors, p.external, p.bad]);
  await p.close();

  for (const [name, vp] of SIZES) {
    console.log('Bildschirm ' + name);
    const q = await T.open(vp, '?speed=1&nosw&test');
    const menu = await q.evaluate(() => { const c = document.querySelector('#menu .card').getBoundingClientRect(), s = document.getElementById('menu'), btn = document.getElementById('btnSolo').getBoundingClientRect(); return { wide: c.left >= -0.5 && c.right <= innerWidth + 0.5, start: btn.bottom <= innerHeight, scroll: s.scrollHeight - s.clientHeight }; });
    ok('Menü passt in die Breite, Startknopf sichtbar', menu.wide && menu.start, menu);
    await sleep(500); await shot(q, 'menu-' + name);
    await q.click('#btnSolo'); await playing(q);
    const touch = !!vp.hasTouch;
    await sleep(2600); await set(q, give(-6, 3)); await sleep(1200);
    const r = await rects(q), names = Object.keys(r);
    ok('Anzeige vollständig' + (touch ? ' mit Stick und vier Knöpfen' : ''), ['score', 'tools', 'radar', 'tag'].every((n) => r[n]) && (touch ? ['stick', 'pass', 'shoot', 'sprint', 'switch'].every((n) => r[n]) && !r.through : !r.pass), names);
    const out = names.filter((n) => r[n].x < -0.5 || r[n].y < -0.5 || r[n].r > vp.width + 0.5 || r[n].b > vp.height + 0.5);
    ok('nichts ragt aus dem Bild', !out.length, out.map((n) => [n, r[n]]));
    const hits = []; for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) if (overlap(r[names[i]], r[names[j]])) hits.push(names[i] + '/' + names[j]);
    ok('keine Überlappungen', !hits.length, hits);
    if (touch) ok('Tippflächen mindestens 48 px', ['pass', 'shoot', 'sprint', 'switch'].every((n) => r[n] && r[n].w >= 48 && r[n].h >= 48));
    await shot(q, 'spiel-' + name);
    // Ball und eigener Spieler bleiben sichtbar und liegen nicht unter Anzeige oder Knöpfen (laufendes Spiel)
    await set(q, "s.idle=[9,9];");
    let n = 0, covered = 0, gone = 0; const where = {};
    for (let k = 0; k < 60; k++) {
      await sleep(150);
      const s = await sim(q); if (!s || s.ph !== 'play') continue;
      const at = await q.evaluate(() => { const s = window.__game.sim(); return window.__game.project(s.ball.x, s.ball.y, s.ball.z); }); n++;
      if (at.x < 0 || at.x > vp.width || at.y < 0 || at.y > vp.height) gone++;
      for (const [key, v] of Object.entries(await rects(q))) if (at.x > v.x && at.x < v.r && at.y > v.y && at.y < v.b) { covered++; where[key] = (where[key] || 0) + 1; break; }
    }
    ok('Ball im Bild (' + (n - gone) + '/' + n + ')', n > 10 && gone / n <= 0.04, [gone, n]);
    ok('Ball selten verdeckt (' + covered + '/' + n + ')', covered / n <= 0.1, where);
    await set(q, give(30, -6, 9)); await sleep(1000); await shot(q, 'angriff-' + name);
    if (touch) {
      const f = await finger(q), c = await rects(q);
      await set(q, give(-12, 0)); await sleep(300);
      const s0 = (await sim(q)).pl[7]; const [sx, sy] = mid(c.stick);
      await f.down(1, sx, sy); await f.move(1, sx + 60, sy); await sleep(700); const i = await q.evaluate(() => window.__game.input()); await f.up(1); const s1 = (await sim(q)).pl[7];
      const portrait = vp.height > vp.width, dx = s1.x - s0.x, dz = s1.z - s0.z;
      ok('Stick nach rechts läuft im Bild nach rechts', portrait ? dz > 1 : dx > 1, [portrait, dx, dz, i]);
      await set(q, give(-12, 0)); await sleep(300); const u0 = (await sim(q)).pl[7]; await f.down(1, sx, sy); await f.move(1, sx, sy - 60); await sleep(700); await f.up(1); const u1 = (await sim(q)).pl[7];
      ok('Stick nach oben läuft im Bild nach oben', portrait ? u1.x - u0.x > 1 : u0.z - u1.z > 1, [u1.x - u0.x, u1.z - u0.z]);
      await set(q, give(-10, 0)); await sleep(250); let n0 = (await sim(q)).stats.pas[0]; await f.down(2, ...mid(c.pass)); await sleep(90); await f.up(2);
      ok('Tipp auf PASS spielt ab', !!(await until(async () => (await sim(q)).stats.pas[0] > n0, 3000, 'tipp')));
      await set(q, give(-10, 0)); await sleep(250); n0 = (await sim(q)).stats.pas[0]; const [px, py] = mid(c.pass); await f.down(2, px, py); await sleep(60); await f.move(2, px, py - 22); await f.move(2, px, py - 50); await sleep(120);
      const kind = (await sim(q)).chg[0].k; await f.up(2);
      ok('PASS nach oben wischen lädt einen Steilpass', kind === 'through' && !!(await until(async () => (await sim(q)).stats.pas[0] > n0, 3000, 'wisch')), kind);
      await set(q, give(34, 0, 9)); await sleep(250); const n1 = (await sim(q)).stats.sh[0];
      await f.down(1, sx, sy); await f.move(1, sx + (portrait ? 0 : 60), sy - (portrait ? 60 : 0)); await f.down(2, ...mid(c.shoot)); await sleep(350); const both = await sim(q); await shot(q, 'laden-' + name); await f.up(2); await f.up(1);
      ok('zwei Finger: laufen und Schuss laden', both.chg[0].k === 'shoot' && Math.hypot(both.pl[9].vx, both.pl[9].vz) > 1, [both.chg[0], both.pl[9].vx]);
      ok('Schuss per Finger', !!(await until(async () => (await sim(q)).stats.sh[0] > n1, 3000, 'schuss')));
      await set(q, "s.ph='play'; s.rs=null; s.ball.own=15; s.pl[15].act=0; s.imm=s.t+30;"); await sleep(200);
      ok('ohne Ball heißen die Knöpfe DRUCK und GRÄTSCHE', await q.evaluate(() => document.querySelector('[data-act=pass]').textContent === 'DRUCK' && document.querySelector('[data-act=shoot]').textContent === 'GRÄTSCHE'));
      await shot(q, 'abwehr-' + name);
    }
    await set(q, "s.clock = 179.9; s.ph='play'; s.rs=null; s.shot=null;"); await until(async () => (await sim(q)).ph === 'half', 6000, 'hz'); await sleep(700); await shot(q, 'halbzeit-' + name);
    ok('Halbzeitbild passt', await q.evaluate(() => { const r = document.getElementById('panel').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }));
    await until(async () => (await sim(q)).half === 2, 9000, 'hz2'); await set(q, "s.sc=[1,0]; s.clock = 179.9; s.ph='play'; s.rs=null; s.shot=null;"); await until(async () => (await shell(q)).screen === 'end', 12000, 'ende'); await sleep(300); await shot(q, 'ende-' + name);
    ok('Ergebnisbild: beide Knöpfe ohne Rollen sichtbar', await q.evaluate(() => ['btnAgain', 'btnMenu'].every((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.height >= 40; })));
    ok('keine Fehler', !q.errors.length && !q.external.length && !q.bad.length, [q.errors, q.external, q.bad]);
    await q.close();
  }

  console.log('Ganzes Spiel im Browser (Zeitraffer, Mensch greift nicht ein)');
  const g = await T.open({ width: 1280, height: 720 }, '?speed=8&nosw&test'); await g.click('#btnSolo'); await playing(g);
  const goalSeen = await until(async () => (await sim(g))?.ph === 'goal', 90000, 'tor');
  if (goalSeen) { await sleep(120); await shot(g, 'tor-1280x720'); }
  ok('ein Tor fällt, Netzton ist zu hören', !!goalSeen && !!(await until(() => g.evaluate(() => window.__game.sounds().includes('net')), 3000, 'netz')));
  ok('Spiel läuft bis zum Ergebnisbild', !!(await until(async () => (await shell(g)).screen === 'end', 150000, 'ende')));
  const fin = await sim(g);
  ok('Endstand passt zur Anzeige, Statistik gefüllt', fin.ph === 'over' && (await shell(g)).score.join() === fin.sc.join() && fin.stats.pas[0] + fin.stats.pas[1] > 20, [fin.sc, fin.stats.pas]);
  ok('keine Fehler während des ganzen Spiels', !g.errors.length && !g.bad.length, g.errors);
  await g.close();

  console.log('Leistung (mit Grafikkarte, headless)');
  for (const [name, vp] of [['1280x720', { width: 1280, height: 720 }], ['390x844 (2x)', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
    const q = await T.open(vp, '?speed=1&nosw&test'); await q.click('#btnSolo'); await playing(q); await sleep(2500);
    const m = await q.evaluate(() => new Promise((res) => { const gaps = []; let last = performance.now(); const start = last; const step = (now) => { gaps.push(now - last); last = now; if (now - start < 12000) requestAnimationFrame(step); else { gaps.sort((a, b) => a - b); res({ fps: gaps.length / ((now - start) / 1000), p95: gaps[Math.floor(gaps.length * 0.95)], max: gaps[gaps.length - 1], view: window.__game.view() }); } }; requestAnimationFrame(step); }));
    console.log('    ' + name + ': ' + m.fps.toFixed(1) + ' Bilder/s, 95 % unter ' + m.p95.toFixed(1) + ' ms, längstes Bild ' + m.max.toFixed(0) + ' ms, ' + m.view.calls + ' Zeichenaufrufe, ' + m.view.triangles + ' Dreiecke, Pixelverhältnis ' + m.view.ratio + ', ' + m.view.gpu);
    ok(name + ': unter 60 Zeichenaufrufe (' + m.view.calls + ')', m.view.calls < 60);
    ok(name + ': mindestens 55 Bilder/s (' + m.fps.toFixed(1) + ')', m.fps >= 55);
    await q.close();
  }

  console.log('Ohne Netz');
  const o = await T.open({ width: 900, height: 600 }, '?speed=1');
  ok('Offline-Speicher aktiv', !!(await until(() => o.evaluate(() => navigator.serviceWorker.ready.then(() => !!navigator.serviceWorker.controller)), 20000, 'sw')));
  await T.offline(o); await o.reload({ waitUntil: 'load' }); await o.waitForFunction(() => window.__game, { timeout: 30000 }); await o.click('#btnSolo');
  ok('ohne Netz spielbar', !!(await playing(o)));
} catch (e) { T.abort(e); }
await T.done();
