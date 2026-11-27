// Browsertest (headless): node tests/browser-test.mjs    Bildschirmfotos mit SHOT_DIR=<ordner>
import { harness } from './harness.mjs';
const T = await harness();
const { ok, sleep, until, shot } = T;
const game = (p) => p.evaluate(() => ({ s: window.__game.sim(), sh: window.__game.shell() }));
const sim = (p) => T.sim(p);
const set = (p, patch) => p.evaluate((x) => window.__test.set(x), patch);
const speed = (c) => Math.hypot(c.vx, c.vz);
const hold = async (p, keys, ms) => { for (const k of keys) await p.keyboard.down(k); await sleep(ms); for (const k of keys.slice().reverse()) await p.keyboard.up(k); };
// Warten, bis eine Bedingung auf dem Spielzustand gilt (der Rechner kann langsam sein)
const when = (p, fn, what, ms = 15000) => until(async () => fn(await sim(p)), ms, what);

try {
  console.log('\nStart und zu Fuß (1280×720)');
  const p = await T.open({ width: 1280, height: 720 }, '?test&nosw');
  await sleep(1200); await shot(p, '01-menue-1280');
  ok('Menü sichtbar', (await T.shell(p)).screen === 'menu' && await p.$eval('#menu h1', (e) => e.textContent.replace(/\s+/g, '') === 'NEONBAY'));
  ok('Motorgeräusch standardmäßig aus', (await p.evaluate(() => window.__game.engine())).enabled === false);
  ok('im Menü kein Ton', (await p.evaluate(() => window.__game.sounds())).length === 0);
  await p.click('#btnPlay'); await sleep(800);
  ok('Spiel läuft', (await T.shell(p)).screen === 'play' && await when(p, (s) => s.tick > 20, 'Takte'));
  await shot(p, '02-start-1280');
  const paint = () => p.evaluate(() => { const c = document.getElementById('mini'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, colors = new Set(); for (let i = 0; i < d.length; i += 44) if (d[i + 3] > 200) colors.add((d[i] >> 4) + '.' + (d[i + 1] >> 4) + '.' + (d[i + 2] >> 4)); return { n: colors.size, url: c.toDataURL() }; });
  const map1 = await paint(); ok('Minikarte zeigt die Stadt', map1.n >= 5, map1.n);
  let a = await sim(p); await hold(p, ['KeyW'], 700); let b = await sim(p);
  ok('W läuft in Blickrichtung (nach Osten)', b.player.x - a.player.x > 1.2 && Math.abs(b.player.z - a.player.z) < 0.5, [b.player.x - a.player.x, b.player.z - a.player.z]);
  await p.keyboard.down('KeyW'); await p.keyboard.down('ShiftLeft'); const sprint = await when(p, (s) => Math.hypot(s.player.vx, s.player.vz) > 5.8, 'Sprint'); await p.keyboard.up('ShiftLeft'); await p.keyboard.up('KeyW');
  ok('Umschalt sprintet', !!sprint);
  await sleep(300); await p.keyboard.press('Space'); ok('Leertaste springt', !!(await when(p, (s) => s.player.y > 0.3, 'Sprung', 3000))); await when(p, (s) => s.player.grounded, 'Landung');
  ok('Töne bei Ereignissen (Sprung)', (await p.evaluate(() => window.__game.sounds())).includes('jump'));
  ok('Minikarte bewegt sich mit', (await paint()).url !== map1.url);
  const yaw0 = (await p.evaluate(() => window.__game.view())).camera.yaw;
  await p.mouse.move(800, 300); await p.mouse.down(); await p.mouse.move(560, 310, { steps: 8 }); await p.mouse.up(); await sleep(200);
  const yaw1 = (await p.evaluate(() => window.__game.view())).camera.yaw;
  ok('Maus ziehen dreht die Kamera', Math.abs(yaw1 - yaw0) > 0.3, [yaw0, yaw1]);

  console.log('\nEinsteigen und Fahren');
  await p.keyboard.press('KeyE'); await sleep(300);
  a = await sim(p); ok('zu weit weg: kein Einsteigen', a.mode === 'foot');
  await set(p, { player: { x: a.car.x - 0.5, z: a.car.z + 2.2, vx: 0, vz: 0 } }); await sleep(400);
  ok('Hinweis „Einsteigen“ erscheint am Auto', await p.$eval('#prompt', (e) => !e.hidden && e.textContent.includes('Einsteigen')));
  await p.keyboard.press('KeyE'); ok('E steigt ein', !!(await when(p, (s) => s.mode === 'car', 'einsteigen')));
  await sleep(400); ok('Tachoanzeige sichtbar', await p.$eval('#gauge', (e) => !e.hidden));
  a = await sim(p); await p.keyboard.down('KeyW'); ok('W gibt Gas (über 50 km/h)', !!(await when(p, (s) => speed(s.car) > 14, 'Gas'))); await shot(p, '03-fahren-1280');
  await p.keyboard.down('KeyA'); await p.keyboard.down('Space'); const drift = await until(async () => { const c = (await sim(p)).car; return Math.abs(-c.vx * Math.cos(c.h) + c.vz * Math.sin(c.h)) > 3.5; }, 4000, 'Drift');
  ok('Leertaste + Lenken driftet', !!drift); await sleep(150); await shot(p, '04-drift-1280');
  await p.keyboard.up('Space'); await p.keyboard.up('KeyA'); await p.keyboard.up('KeyW');
  ok('Quietschen beim Driften', (await p.evaluate(() => window.__game.sounds())).includes('screech'));
  await p.keyboard.down('KeyS'); ok('S bremst und fährt rückwärts', !!(await when(p, (s) => s.car.reversing, 'rückwärts'))); await p.keyboard.up('KeyS');
  await set(p, { car: { x: 20, z: 184.6, h: Math.PI / 2, vx: 20, vz: 0, w: 0 } }); await hold(p, ['KeyW'], 300); await p.keyboard.press('KeyE'); await sleep(200);
  ok('bei Tempo kein Aussteigen, Hinweis', (await sim(p)).mode === 'car' && await p.$eval('#toast', (e) => !e.hidden && e.textContent.includes('anhalten')));
  // gegen eine Hauswand
  const wall = await p.evaluate(() => { const w = window.__test.world(); const bs = w.buildings.filter((b) => b.type === 'shore' && Math.abs(b.z1 - (w.roads.hz.at(-1) - w.roads.hw.at(-1) / 2 - 4)) < 0.1); const b = bs[Math.floor(bs.length / 2)]; return { x: (b.x0 + b.x1) / 2, z: b.z1 }; });
  await set(p, { car: { x: wall.x, z: wall.z + 14, h: Math.PI, vx: 0, vz: -22, w: 0, damage: 0 }, yaw: Math.PI });
  ok('Aufprall: Schaden und Krachen', !!(await when(p, (s) => s.car.damage > 5, 'Schaden', 5000)) && (await p.evaluate(() => window.__game.sounds())).includes('crash'));
  await sleep(500); await shot(p, '05-aufprall-1280'); a = await sim(p); ok('Auto bleibt vor der Wand', a.car.z - 2.1 > wall.z - 0.1, [a.car.z, wall.z]);
  ok('Kamera frei trotz Wand', (await p.evaluate(() => window.__game.view())).camera.pos.every(Number.isFinite));
  await p.keyboard.press('KeyH'); await sleep(200); ok('Hupe', (await p.evaluate(() => window.__game.sounds())).includes('horn'));

  console.log('\nMotor, Pause, Einstellungen');
  ok('Motor läuft nicht, solange aus', (await p.evaluate(() => window.__game.engine())).running === false);
  await p.keyboard.press('Escape'); await sleep(200);
  const t0 = (await sim(p)).tick; await sleep(500);
  ok('Esc pausiert, Spielzeit steht', (await T.shell(p)).screen === 'pause' && (await sim(p)).tick === t0);
  await shot(p, '06-pause-1280');
  await p.click('#pause .setEngine'); await p.click('#btnResume'); await sleep(500);
  ok('Motor eingeschaltet: läuft beim Fahren', (await p.evaluate(() => window.__game.engine())).running === true);
  await p.keyboard.press('KeyP'); await sleep(250);
  ok('in der Pause schweigt der Motor', (await T.shell(p)).screen === 'pause' && (await p.evaluate(() => window.__game.engine())).running === false);
  await p.keyboard.press('KeyP'); await sleep(250); ok('P setzt fort', (await T.shell(p)).screen === 'play'); await p.keyboard.press('KeyP'); await sleep(200);
  await p.click('#pause .setEngine'); ok('Motor wieder aus', (await p.evaluate(() => window.__game.engine())).enabled === false);
  const q = [];
  for (let i = 0; i < 4; i++) { await p.click('#pause .setQuality'); await sleep(250); const v = await p.evaluate(() => window.__game.view()); q.push([await p.$eval('#pause .setQuality', (e) => e.textContent), v.quality, v.size[0]]); }
  ok('Grafikstufen umschaltbar (Niedrig rechnet weniger Bildpunkte)', q[0][1] === 'low' && q[0][2] < q[2][2] && q[3][0] === 'Grafik: Auto', q);
  await p.click('#btnRecover'); await sleep(300);
  a = await sim(p); ok('„Auto herholen“ repariert', a.car.damage === 0 && (await T.shell(p)).screen === 'play');

  console.log('\nAussteigen und Speichern');
  await when(p, (s) => speed(s.car) < 0.2, 'Stillstand'); await p.keyboard.press('KeyE');
  ok('E steigt aus', !!(await when(p, (s) => s.mode === 'foot', 'aussteigen')));
  await hold(p, ['KeyW'], 500); await sleep(2400); a = await sim(p);
  await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__game, { timeout: 30000 }); await sleep(600);
  ok('nach Neuladen „Weiterspielen“', await p.$eval('#btnPlay', (e) => e.textContent === 'Weiterspielen'));
  await p.click('#btnPlay'); await sleep(500); b = await sim(p);
  ok('Position von Figur und Auto gespeichert', Math.hypot(a.player.x - b.player.x, a.player.z - b.player.z) < 0.3 && Math.hypot(a.car.x - b.car.x, a.car.z - b.car.z) < 0.3 && b.mode === 'foot', [a.player, b.player]);
  await p.keyboard.press('Escape'); await p.click('#btnQuit'); await sleep(300);
  await p.click('#btnNew'); ok('Neu beginnen fragt nach', (await T.shell(p)).screen === 'menu'); await p.click('#btnNew'); await sleep(400); b = await sim(p);
  ok('Neu beginnen setzt zum Start zurück', Math.abs(b.player.x + 2.2) < 8 && b.tick < 120 && b.mode === 'foot', [b.player.x, b.tick]);
  await p.evaluate(() => localStorage.setItem('neonbay_save', '{kaputt')); await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__game); await p.click('#btnPlay'); await sleep(300);
  ok('kaputter Spielstand: sauberer Neustart', (await sim(p)).mode === 'foot' && p.errors.length === 0);
  ok('keine Fehler, keine fremden Anfragen, nichts fehlt', !p.errors.length && !p.external.length && !p.bad.length, [p.errors, p.external, p.bad]);
  await p.browserContext().close();

  console.log('\nHandy und Bildschirmgrößen');
  const sizes = [[320, 568, true], [390, 844, true], [844, 390, true], [768, 1024, true], [1280, 720, false], [1280, 720, true]];
  for (const [w, h, touch] of sizes) {
    const name = w + 'x' + h + (touch ? '' : '-pc');
    const m = await T.open({ width: w, height: h, isMobile: touch && w < 1000, hasTouch: touch, deviceScaleFactor: touch && w < 600 ? 2 : 1 }, '?test&nosw');
    await sleep(700); await shot(m, 'L-' + name + '-menue');
    const menu = await m.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const b = r('#btnPlay'), c = r('#menu .card'); return { play: b.top >= 0 && b.bottom <= innerHeight && b.height >= 48, wide: c.left >= -1 && c.right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth }; });
    ok(name + ': Menü passt, Startknopf sichtbar', menu.play && menu.wide, menu);
    if (touch) await m.tap('#btnPlay'); else await m.click('#btnPlay');
    await sleep(600);
    if (touch && w >= 1000) { await m.evaluate(() => window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' }))); await sleep(200); }
    for (const mode of ['foot', 'car']) {
      if (mode === 'foot') { const s = await sim(m); await set(m, { player: { x: s.car.x - 1.2, z: s.car.z + 2.3 } }); } else await set(m, { mode: 'car' });
      await sleep(900);
      // Hinweise ausblenden lassen, dann auch den ungünstigsten Fall mit Hinweis prüfen
      const lay = await m.evaluate((mode) => {
        const vis = (e) => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && !e.closest('[hidden]') && e.getBoundingClientRect().width > 0; };
        const items = [...document.querySelectorAll('#touch .act, #stickBase, #mapBox, .tools button, #gauge, #prompt')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { id: e.dataset.act || e.id || e.parentElement.className, x: r.left, y: r.top, w: r.width, h: r.height, round: e.matches('.act,#mapBox') || e.id === 'stickBase' && mode === 'foot', button: e.tagName === 'BUTTON' }; });
        const bad = [];
        for (const i of items) { if (i.x < -0.5 || i.y < -0.5 || i.x + i.w > innerWidth + 0.5 || i.y + i.h > innerHeight + 0.5) bad.push('außerhalb ' + i.id); if (i.button && Math.min(i.w, i.h) < 47.5) bad.push('zu klein ' + i.id + ' ' + i.w); }
        for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
          const p = items[a], q = items[b];
          if (p.round && q.round) { if (Math.hypot(p.x + p.w / 2 - q.x - q.w / 2, p.y + p.h / 2 - q.y - q.h / 2) < (p.w + q.w) / 2 + 1) bad.push(p.id + ' / ' + q.id); }
          else if (p.x < q.x + q.w - 1 && p.x + p.w > q.x + 1 && p.y < q.y + q.h - 1 && p.y + p.h > q.y + 1) bad.push(p.id + ' / ' + q.id);
        }
        // die eigene Figur bzw. das Auto darf nicht unter Anzeige oder Knöpfen liegen
        const s = window.__game.sim(), t = mode === 'car' ? s.car : s.player, pts = [window.__test.screen(t.x, mode === 'car' ? 0.8 : 1.0, t.z)];
        for (const pt of pts) { if (!pt.front || pt.x < 0 || pt.x > innerWidth || pt.y < 0 || pt.y > innerHeight) bad.push('Ziel nicht im Bild'); for (const i of items) if (pt.x > i.x && pt.x < i.x + i.w && pt.y > i.y && pt.y < i.y + i.h) bad.push('Ziel verdeckt von ' + i.id); }
        return { bad, ids: items.map((i) => i.id), target: pts[0] };
      }, mode);
      const need = touch ? (mode === 'foot' ? ['jump', 'sprint', 'enter', 'stickBase', 'mapBox'] : ['gas', 'brake', 'hand', 'exit', 'stickBase', 'mapBox', 'gauge']) : (mode === 'foot' ? ['mapBox', 'prompt'] : ['mapBox', 'gauge']);
      const missing = need.filter((id) => !lay.ids.includes(id)), wrong = lay.ids.filter((id) => (mode === 'foot' ? ['gas', 'brake', 'hand', 'exit'] : ['jump', 'sprint', 'enter']).includes(id));
      ok(`${name} ${mode === 'foot' ? 'zu Fuß' : 'im Auto'}: alles im Bild, nichts überlappt, ≥ 48 px, Ziel frei`, !lay.bad.length && !missing.length && !wrong.length, { bad: lay.bad, missing, wrong });
      await shot(m, 'L-' + name + '-' + mode);
    }
    await m.tap('#btnPause').catch(() => m.click('#btnPause')); await sleep(300); await shot(m, 'L-' + name + '-pause');
    const pause = await m.evaluate(() => { const c = document.querySelector('#pause .card').getBoundingClientRect(), r = document.getElementById('btnResume').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && c.left >= -1 && c.right <= innerWidth + 1; });
    ok(name + ': Pause bedienbar', pause);
    ok(name + ': fehlerfrei', !m.errors.length, m.errors);
    await m.browserContext().close();
  }

  console.log('\nMehrfinger (390×844)');
  const m = await T.open({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, '?test&nosw');
  await m.tap('#btnPlay'); await sleep(600);
  ok('weit vom Auto kein Einsteigen-Knopf', await m.$eval('[data-act=enter]', (e) => getComputedStyle(e).display === 'none'));
  const cdp = await m.createCDPSession();
  const center = (sel) => m.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const touches = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  let st = await sim(m), stick = await center('#stickBase');
  await touches('touchStart', [{ ...stick, id: 1 }]); await touches('touchMove', [{ x: stick.x, y: stick.y - 60, id: 1 }]); await sleep(800);
  let st2 = await sim(m); await touches('touchEnd', []);
  ok('Stick läuft nach vorn', st2.player.x - st.player.x > 1, st2.player.x - st.player.x);
  await set(m, { player: { x: st.car.x - 0.5, z: st.car.z + 2.2, vx: 0, vz: 0 } }); await sleep(500);
  await m.tap('[data-act=enter]'); ok('Einsteigen per Knopf', !!(await when(m, (s) => s.mode === 'car', 'einsteigen'))); await sleep(500);
  const gas = await center('[data-act=gas]'); stick = await center('#stickBase'); const h0 = (await sim(m)).car.h;
  await touches('touchStart', [{ ...gas, id: 2 }]); await sleep(500); await touches('touchStart', [{ ...gas, id: 2 }, { ...stick, id: 3 }]); await touches('touchMove', [{ ...gas, id: 2 }, { x: stick.x - 55, y: stick.y - 30, id: 3 }]); await sleep(600);
  const both = await m.evaluate(() => window.__game.controls()); st2 = await sim(m);
  ok('Gas und Lenken gleichzeitig', both.gas === 1 && both.x < -0.7 && speed(st2.car) > 4 && st2.car.h - h0 > 0.15, [both, speed(st2.car), st2.car.h - h0]);
  await shot(m, '07-handy-fahren'); await touches('touchEnd', []); await sleep(200);
  ok('Loslassen beendet Gas und Lenken', await m.evaluate(() => { const c = window.__game.controls(); return c.gas === 0 && c.x === 0; }));
  const brake = await center('[data-act=brake]'); await touches('touchStart', [{ ...brake, id: 4 }]); await when(m, (s) => speed(s.car) < 0.5 || s.car.reversing, 'Bremsen'); await touches('touchEnd', []);
  await set(m, { car: { vx: 0, vz: 0, w: 0 } }); await sleep(400); await m.tap('[data-act=exit]');
  ok('Aussteigen per Knopf', !!(await when(m, (s) => s.mode === 'foot', 'aussteigen')));
  await sleep(400); const j = await center('[data-act=jump]'); await touches('touchStart', [{ ...j, id: 5 }]); const air = await when(m, (s) => s.player.y > 0.3, 'Sprung', 3000); await touches('touchEnd', []);
  ok('Sprung-Knopf', !!air);
  await m.tap('#mapBox'); await sleep(250); ok('Minikarte vergrößerbar', await m.$eval('#mapBox', (e) => e.getBoundingClientRect().width > 200)); await shot(m, '08-handy-karte');
  ok('große Karte schließt sich von selbst', !!(await until(() => m.$eval('#mapBox', (e) => !e.classList.contains('big')), 12000, 'Karte')));
  ok('Handy: fehlerfrei', !m.errors.length, m.errors);
  await m.browserContext().close();

  console.log('\nGamepad (nachgestellt)');
  const g = await T.open({ width: 1000, height: 640 }, '?test&nosw');
  await g.evaluate(() => { const pad = { axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }; window.__pad = pad; Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true }); });
  await g.click('#btnPlay'); await sleep(400);
  const press = (i, on) => g.evaluate((i, on) => { window.__pad.buttons[i] = { pressed: on, value: on ? 1 : 0 }; }, i, on);
  await set(g, { mode: 'car' }); await press(7, true); const padGas = await when(g, (s) => speed(s.car) > 8, 'RT');
  const h1 = (await sim(g)).car.h; await g.evaluate(() => { window.__pad.axes[0] = 1; }); await sleep(500); const h2 = (await sim(g)).car.h;
  await press(7, false); await g.evaluate(() => { window.__pad.axes[0] = 0; });
  ok('RT gibt Gas, Stick lenkt nach rechts', !!padGas && h2 < h1 - 0.1, [h1, h2]);
  await press(6, true); await when(g, (s) => s.car.reversing || speed(s.car) < 0.5, 'LT'); await press(6, false); await set(g, { car: { x: 20, z: 184.6, h: 1.5708, vx: 0, vz: 0, w: 0 } }); await sleep(300);
  await press(3, true); const padOut = await when(g, (s) => s.mode === 'foot', 'Y'); await press(3, false); ok('Y steigt aus', !!padOut);
  await sleep(300); await press(0, true); const hop = await when(g, (s) => s.player.y > 0.3, 'A', 3000); await press(0, false); ok('A springt', !!hop);
  await sleep(200); await press(9, true); await sleep(300); await press(9, false); await sleep(200); const paused = (await T.shell(g)).screen; await press(9, true); await sleep(300); await press(9, false); await sleep(200);
  ok('Start pausiert und setzt fort', paused === 'pause' && (await T.shell(g)).screen === 'play', paused);
  ok('Gamepad: fehlerfrei', !g.errors.length, g.errors);
  await g.browserContext().close();

  console.log('\nSchauplätze (Sichtprüfung)');
  const v = await T.open({ width: 1280, height: 720 }, '?test&nosw');
  await v.click('#btnPlay'); await sleep(500);
  for (const [n, x, z, h] of [['allee', -37, 60, Math.PI], ['hochhaeuser', -37, -120, Math.PI], ['promenade', -60, 214, 0.9], ['hafen', 190, 206, 1.1], ['steg', 219, 238, 0], ['altstadt', -210, await v.evaluate(() => window.__test.world().roads.hz[3] + 2), 1.5708]]) {
    await set(v, { mode: 'car', car: { x, z, h, vx: 0, vz: 0, w: 0 }, yaw: h }); await sleep(800); await shot(v, 'S-' + n);
  }
  await set(v, { mode: 'foot', player: { x: 20, z: 200, h: 0.3 }, yaw: 0.3 }); await sleep(800); await shot(v, 'S-zu-fuss');
  ok('Schauplätze ohne Fehler', !v.errors.length, v.errors);
  await v.browserContext().close();

  console.log('\nOffline');
  const o = await T.open({ width: 900, height: 600 }, '');
  const ready = await o.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 20000))]));
  await sleep(800); await T.offline(o); await o.reload({ waitUntil: 'load' }); await o.waitForFunction(() => window.__game, { timeout: 30000 }); await o.click('#btnPlay'); await sleep(600);
  ok('läuft ohne Netz aus dem Offline-Speicher', ready && (await T.shell(o)).screen === 'play' && !o.errors.filter((e) => !/Failed to load|ERR_/.test(e)).length, o.errors);
} catch (e) { T.abort(e); }
await T.done();
