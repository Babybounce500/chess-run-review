// Logiktests ohne Browser: node tests/sim-test.mjs
// Die Wandprüfung rechnet mit einem eigenen Gitter und eigener Geometrie, nicht mit den Spielfunktionen.
import fs from 'node:fs';
import { createWorld } from '../src/world.js';
import { createState, step, serialize, restore, recover, allCars } from '../src/sim.js';
import { createCar, drive, moveCar, carFree, carOverlap, forwardSpeed, sideSpeed, speedOf, wrapAngle } from '../src/vehicles.js';
import { createPlayer, stepPlayer, exitSpot } from '../src/player.js';
import { createCamera, updateCamera } from '../src/camera.js';
import { createRng } from '../src/rng.js';
import { SEED, DT, CAR, PLAYER, MAP } from '../src/config.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra).slice(0, 500) : '')); } };
const section = (t) => console.log('\n' + t);
const world = createWorld(SEED);

/* ---------- Unabhängige Prüfgeometrie ---------- */
const CELL = 12, index = new Map();
for (const c of world.colliders) {
  const x0 = c.t ? c.x - c.r : c.x0, x1 = c.t ? c.x + c.r : c.x1, z0 = c.t ? c.z - c.r : c.z0, z1 = c.t ? c.z + c.r : c.z1;
  for (let i = Math.floor((x0 - 2) / CELL); i <= Math.floor((x1 + 2) / CELL); i++) for (let j = Math.floor((z0 - 2) / CELL); j <= Math.floor((z1 + 2) / CELL); j++) { const k = i + ':' + j; if (!index.has(k)) index.set(k, []); index.get(k).push(c); }
}
const near = (x, z) => index.get(Math.floor(x / CELL) + ':' + Math.floor(z / CELL)) || [];
// Eindringtiefe eines kleinen Kreises (r < 2)
function depthAt(x, z, r) {
  let worst = 0;
  for (const c of near(x, z)) {
    let d;
    if (c.t) d = r + c.r - Math.hypot(x - c.x, z - c.z);
    else if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) d = r + Math.min(x - c.x0, c.x1 - x, z - c.z0, c.z1 - z);
    else d = r - Math.hypot(x - Math.max(c.x0, Math.min(c.x1, x)), z - Math.max(c.z0, Math.min(c.z1, z)));
    if (d > worst) worst = d;
  }
  return worst;
}
const carDepth = (car) => Math.max(...CAR.offsets.map((o) => depthAt(car.x + Math.sin(car.h) * o, car.z + Math.cos(car.h) * o, CAR.radius)));
const centerInSolid = (x, z) => near(x, z).some((c) => (c.t ? Math.hypot(x - c.x, z - c.z) < c.r : x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1));
function pathThroughSolid(ax, az, bx, bz) {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.05));
  for (let k = 0; k <= n; k++) if (centerInSolid(ax + (bx - ax) * k / n, az + (bz - az) * k / n)) return true;
  return false;
}
const insideMap = (x, z) => Math.abs(x) < MAP.edge && Math.abs(z) < MAP.edge && !(x < MAP.harbourX && z > MAP.seaZ) && !(x > MAP.pierX1 && z > MAP.harbourZ);

/* ---------- Welt ---------- */
section('Stadt');
{
  const again = createWorld(SEED), other = createWorld(SEED + 1);
  ok('gleicher Startwert ergibt dieselbe Stadt', JSON.stringify(again) === JSON.stringify(world));
  ok('anderer Startwert ergibt eine andere Stadt', JSON.stringify(other) !== JSON.stringify(world));
  const src = ['world.js', 'vehicles.js', 'player.js', 'sim.js', 'camera.js', 'rng.js'].map((f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')).join('\n');
  ok('Logik ohne Math.random, Uhrzeit oder DOM', !/Math\.random|Date\.now|performance\.|document\.|window\.|from '.*three/.test(src));
  console.log(`    ${world.buildings.length} Gebäude, ${world.props.length} Inventar, ${world.signs.length} Schilder, ${world.parked.length} geparkte Autos, ${world.containers.length} Container, ${world.roads.segs.length} Straßenabschnitte`);
  ok('dichtes Viertel: mindestens 200 Gebäude und 60 Schilder', world.buildings.length >= 200 && world.signs.length >= 60);
  const over = (a, b, e = 0.01) => a.x0 < b.x1 - e && a.x1 > b.x0 + e && a.z0 < b.z1 - e && a.z1 > b.z0 + e;
  let bad = 0; for (const b of world.buildings) for (const s of world.roads.segs) if (over(b, s.rect)) bad++;
  ok('kein Gebäude auf einer Straße', bad === 0, bad);
  bad = 0; for (let i = 0; i < world.buildings.length; i++) for (let j = i + 1; j < world.buildings.length; j++) if (over(world.buildings[i], world.buildings[j])) bad++;
  ok('Gebäude überschneiden sich nicht', bad === 0, bad);
  bad = world.props.filter((p) => world.roads.segs.some((s) => p.x > s.rect.x0 + 0.05 && p.x < s.rect.x1 - 0.05 && p.z > s.rect.z0 + 0.05 && p.z < s.rect.z1 - 0.05));
  ok('kein Inventar auf der Fahrbahn', bad.length === 0, bad.slice(0, 4));
  const st = createState(world);
  ok('Startplätze frei', carDepth(st.car) <= 0 && depthAt(st.player.x, st.player.z, PLAYER.radius) <= 0);
  ok('geparkte Autos stehen frei', st.parked.every((c) => carDepth(c) <= 0.001), st.parked.filter((c) => carDepth(c) > 0.001).map((c) => [c.x, c.z]));
  ok('geparkte Autos überlappen nicht', st.parked.every((a) => allCars(st).every((b) => a === b || carOverlap(a, b) <= 0)));
}

/* ---------- Erreichbarkeit ---------- */
section('Erreichbarkeit');
{
  const R = world.roads, seen = new Set([0]), todo = [0];
  while (todo.length) { const n = todo.pop(); for (const s of R.segs) { const m = s.a === n ? s.b : s.b === n ? s.a : -1; if (m >= 0 && !seen.has(m)) { seen.add(m); todo.push(m); } } }
  ok('Straßennetz zusammenhängend (' + seen.size + '/' + R.nodes.length + ' Kreuzungen)', seen.size === R.nodes.length);
  const st = createState(world);
  const flood = (step, radius, extra) => {
    const N = Math.round(600 / step), free = new Uint8Array(N * N), got = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = -300 + (i + 0.5) * step, z = -300 + (j + 0.5) * step; free[j * N + i] = depthAt(x, z, radius) <= 0 && insideMap(x, z) && !extra(x, z) ? 1 : 0; }
    const at = (x, z) => Math.floor((z + 300) / step) * N + Math.floor((x + 300) / step);
    const q = [at(world.spawn.player.x, world.spawn.player.z + (radius > 1 ? -4 : 0))]; got[q[0]] = free[q[0]];
    while (q.length) { const k = q.pop(), i = k % N; for (const m of [i > 0 ? k - 1 : -1, i < N - 1 ? k + 1 : -1, k - N, k + N]) if (m >= 0 && m < N * N && free[m] && !got[m]) { got[m] = 1; q.push(m); } }
    return { free, got, at, N };
  };
  const car = flood(1, 1.2, (x, z) => st.parked.some((p) => Math.abs(p.x - x) < 6 && Math.abs(p.z - z) < 6 && CAR.offsets.some((o) => Math.hypot(p.x + Math.sin(p.h) * o - x, p.z + Math.cos(p.h) * o - z) < 2.2)));
  let samples = 0, miss = 0;
  for (const s of R.segs) { const len = Math.hypot(s.bx - s.ax, s.bz - s.az); for (let t = 0; t <= len; t += 3) { samples++; const x = s.ax + (s.bx - s.ax) * t / len, z = s.az + (s.bz - s.az) * t / len; if (!car.got[car.at(x, z)]) miss++; } }
  ok('jede Straße mit dem Auto erreichbar (' + samples + ' Messpunkte, auch an geparkten Autos vorbei)', miss === 0, miss);
  const foot = flood(0.5, PLAYER.radius, () => false);
  let f = 0, g = 0; for (let k = 0; k < foot.free.length; k++) { f += foot.free[k]; g += foot.got[k]; }
  console.log(`    zu Fuß: ${g} von ${f} freien Zellen erreichbar (0,5-m-Raster)`);
  ok('zu Fuß keine abgeschlossenen Taschen (höchstens 0,1 % unerreichbar)', (f - g) / f < 0.001, f - g);
  ok('Hafensteg zu Fuß erreichbar', !!foot.got[foot.at(219, 275)]);
}

/* ---------- Rundfahrt mit echter Physik ---------- */
section('Rundfahrt über alle Straßenabschnitte');
{
  const R = world.roads, st = createState(world); st.mode = 'car'; st.parked = createState(world).parked;
  const adj = R.nodes.map(() => []); for (const s of R.segs) { adj[s.a].push({ to: s.b, s }); adj[s.b].push({ to: s.a, s }); }
  const todo = new Set(R.segs);
  const bottom = R.hz.length - 1; let at = R.nodes.findIndex((n) => n.j === bottom && n.x > st.car.x), ticks = 0, crashes = 0, stuck = false;
  const goTo = (x, z, slowAt) => {
    let t = 0;
    while (t++ < 60 * 40) {
      const dx = x - st.car.x, dz = z - st.car.z, d = Math.hypot(dx, dz);
      if (d < 3.2) return true;
      const diff = wrapAngle(Math.atan2(dx, dz) - st.car.h), u = forwardSpeed(st.car);
      const want = Math.abs(diff) > 0.5 ? 3.5 : Math.min(15, 4 + Math.max(0, d - slowAt) * 0.45);
      const ev = step(world, st, { steer: Math.max(-1, Math.min(1, -diff * 2.4)), gas: u < want ? 0.8 : 0, brake: u > want + 1.2 ? 0.8 : 0 }); ticks++;
      crashes += ev.filter((e) => e.type === 'crash' && e.speed > 6).length;
    }
    return false;
  };
  const lane = (s, from, t) => { const A = R.nodes[from], B = R.nodes[from === s.a ? s.b : s.a], dx = Math.sign(B.x - A.x), dz = Math.sign(B.z - A.z), len = Math.hypot(B.x - A.x, B.z - A.z); const u = Math.max(0, Math.min(len, t < 0 ? len + t : t)); return [A.x + dx * u - dz * 1.6, A.z + dz * u + dx * 1.6]; };
  goTo(R.nodes[at].x, R.nodes[at].z, 8);
  while (todo.size && !stuck) {
    // kürzester Weg zum nächsten noch offenen Abschnitt
    const prev = new Map([[at, null]]), q = [at]; let goal = null;
    while (q.length && !goal) { const n = q.shift(); for (const e of adj[n]) { if (todo.has(e.s)) { goal = { n, e }; break; } if (!prev.has(e.to)) { prev.set(e.to, { n, e }); q.push(e.to); } } }
    const path = [goal]; let n = goal.n; while (prev.get(n)) { path.unshift(prev.get(n)); n = prev.get(n).n; }
    for (const leg of path) {
      const s = leg.e.s, len = Math.hypot(s.bx - s.ax, s.bz - s.az);
      const points = [lane(s, leg.n, 10)]; for (let t = 30; t < len - 14; t += 20) points.push(lane(s, leg.n, t)); points.push(lane(s, leg.n, -9));
      for (const p of points) if (!goTo(p[0], p[1], 6)) { stuck = { x: st.car.x, z: st.car.z, target: p }; break; }
      if (stuck) break;
      todo.delete(s); at = leg.e.to;
    }
  }
  console.log(`    ${R.segs.length - todo.size}/${R.segs.length} Abschnitte in ${(ticks / 60 / 60).toFixed(1)} Spielminuten, ${(st.odometer / 1000).toFixed(1)} km, ${crashes} härtere Stöße`);
  ok('Autopilot befährt jeden Straßenabschnitt', todo.size === 0 && !stuck, { offen: todo.size, stuck });
}

/* ---------- Fahrgefühl ---------- */
section('Fahrgefühl (offene Fläche, nur Fahrdynamik)');
const free = (input, ticks, car) => { for (let i = 0; i < ticks; i++) { drive(car, typeof input === 'function' ? input(i) : input, DT); car.x += car.vx * DT; car.z += car.vz * DT; car.h = wrapAngle(car.h + car.w * DT); } return car; };
const atSpeed = (v) => { const c = createCar(0, 0, 0); c.vz = v; return c; };
{
  let c = createCar(0, 0, 0), t = 0; while (forwardSpeed(c) < 27.78 && t < 900) { free({ gas: 1 }, 1, c); t++; }
  const t100 = t / 60; free({ gas: 1 }, 1200, c); const top = forwardSpeed(c) * 3.6;
  console.log(`    0-100 km/h: ${t100.toFixed(2)} s, Höchsttempo ${top.toFixed(0)} km/h`);
  ok('0-100 km/h zwischen 2,5 und 5,5 s', t100 > 2.5 && t100 < 5.5, t100);
  ok('Höchsttempo 115 bis 160 km/h', top > 115 && top < 160, top);
  c = atSpeed(27.78); let d = 0, n = 0; while (forwardSpeed(c) > 0.3 && n < 600) { const z = c.z; free({ brake: 1 }, 1, c); d += c.z - z; n++; }
  console.log(`    Bremsweg aus 100 km/h: ${d.toFixed(1)} m in ${(n / 60).toFixed(2)} s`);
  ok('Bremsweg aus 100 km/h unter 22 m', d < 22 && d > 8, d);
  c = atSpeed(0); free({ brake: 1 }, 120, c);
  ok('Rückwärtsfahren mit gehaltener Bremse', forwardSpeed(c) < -6 && c.reversing, forwardSpeed(c));
  free({ gas: 1 }, 40, c); ok('Gas beim Rückwärtsfahren bremst und fährt vor', forwardSpeed(c) > 0, forwardSpeed(c));
  c = atSpeed(20); free({}, 600, c); ok('ohne Gas rollt das Auto aus', speedOf(c) < 8);
  c = atSpeed(3); free({}, 400, c); ok('und bleibt ganz stehen', speedOf(c) === 0, speedOf(c));
  c = atSpeed(12); free({ steer: 1, gas: 0.5 }, 60, c); ok('Lenkung rechts dreht nach rechts (x wird negativ)', c.x < -1 && c.h < -0.5, [c.x, c.h]);
  c = atSpeed(14); let maxSlip = 0; free(() => ({ steer: 1, gas: forwardSpeed(c) < 13.9 ? 0.5 : 0 }), 120, c); const gripSlip = Math.abs(Math.atan2(sideSpeed(c), forwardSpeed(c))) * 57.3;
  const radius = speedOf(c) / Math.abs(c.w);
  console.log(`    Wendekreis bei ${(speedOf(c) * 3.6).toFixed(0)} km/h: Radius ${radius.toFixed(1)} m, Schwimmwinkel ${gripSlip.toFixed(1)}°`);
  ok('normales Lenken ohne Rutschen (unter 10°)', gripSlip < 10, gripSlip);
  ok('Kurvenradius bei Stadttempo passt zu 12-m-Straßen (6 bis 16 m)', radius > 6 && radius < 16, radius);
  c = atSpeed(32); free({ steer: 1, gas: 1 }, 90, c); ok('bei hohem Tempo ruhigere Lenkung, kein Dreher', Math.abs(c.w) < 1.0 && Math.abs(sideSpeed(c)) < 4, [c.w, sideSpeed(c)]);
  c = atSpeed(20); let turned = 0, h0 = c.h;
  for (let i = 0; i < 48; i++) { free({ steer: 1, hand: true }, 1, c); maxSlip = Math.max(maxSlip, Math.abs(Math.atan2(sideSpeed(c), Math.abs(forwardSpeed(c))))); }
  turned = Math.abs(wrapAngle(c.h - h0)) * 57.3;
  console.log(`    Handbremse bei 72 km/h, 0,8 s: Schwimmwinkel bis ${(maxSlip * 57.3).toFixed(0)}°, gedreht ${turned.toFixed(0)}°, Tempo danach ${(speedOf(c) * 3.6).toFixed(0)} km/h`);
  ok('Handbremse erzeugt einen Drift (über 20°)', maxSlip * 57.3 > 20, maxSlip * 57.3);
  ok('Drift bleibt beherrschbar (unter 75°) und behält Schwung', maxSlip * 57.3 < 75 && speedOf(c) > 9, [maxSlip * 57.3, speedOf(c)]);
  let rec = -1; for (let i = 0; i < 180; i++) { free({ gas: 0.6 }, 1, c); if (Math.abs(Math.atan2(sideSpeed(c), Math.abs(forwardSpeed(c)))) < 0.09 && Math.abs(c.w) < 0.3) { rec = i / 60; break; } }
  console.log(`    wieder gerade nach ${rec.toFixed(2)} s`);
  ok('nach Loslassen fängt sich das Auto (unter 1,6 s)', rec >= 0 && rec < 1.6, rec);
  c = atSpeed(22); free({ steer: 1, hand: true, gas: 1 }, 30, c); let held = 0; for (let i = 0; i < 90; i++) { free({ steer: 0.8, gas: 1 }, 1, c); if (Math.abs(sideSpeed(c)) > 2) held++; }
  ok('mit Gas und Lenkeinschlag läuft der Drift weiter (über 0,3 s)', held > 18, held / 60);
  c = atSpeed(25); let worst = 0; free((i) => ({ steer: i % 80 < 40 ? 1 : -1, hand: i % 50 < 20, gas: 1 }), 900, c); worst = Math.abs(c.w); ok('wildes Lenken bleibt endlich', Number.isFinite(c.x + c.z + c.h + c.vx) && worst < 4);
  c = createCar(0, 0, 0); c.damage = 100; free({ gas: 1 }, 180, c); const slow = forwardSpeed(c); c = createCar(0, 0, 0); free({ gas: 1 }, 180, c);
  ok('Schaden kostet Leistung, aber nie alles', slow < forwardSpeed(c) * 0.75 && slow > 8, [slow, forwardSpeed(c)]);
}

/* ---------- Aufprall ---------- */
section('Aufprall mit Höchsttempo');
{
  let tests = 0, bad = [], damaged = 0;
  const rng = createRng(7);
  const crash = (car, vx, vz, ticks, label, input) => {
    car.vx = vx; car.vz = vz;
    for (let i = 0; i < ticks; i++) {
      const px = car.x, pz = car.z;
      drive(car, input || { gas: 1 }, DT); const r = moveCar(world, car, [car], DT); if (r.impact > CAR.damageFrom) damaged++;
      if (carDepth(car) > 0.025 || pathThroughSolid(px, pz, car.x, car.z) || !insideMap(car.x, car.z)) { bad.push({ label, x: car.x, z: car.z, d: carDepth(car) }); return; }
    }
  };
  // jede Gebäudeseite, von der aus Platz zum Anlauf ist, in mehreren Winkeln
  for (const c of world.colliders.filter((o) => !o.t)) {
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const skew of [0, 0.45, -1.2]) {
      const fx = nx > 0 ? c.x1 : nx < 0 ? c.x0 : rng.range(c.x0, c.x1), fz = nz > 0 ? c.z1 : nz < 0 ? c.z0 : rng.range(c.z0, c.z1);
      const out = Math.atan2(nx, nz) + skew, x = fx + Math.sin(out) * 5, z = fz + Math.cos(out) * 5, h = wrapAngle(out + Math.PI);
      if (Math.abs(x) > 295 || Math.abs(z) > 295 || !carFree(world, x, z, h)) continue;
      tests++; crash(createCar(x, z, h), Math.sin(h) * 40, Math.cos(h) * 40, 90, c.kind);
    }
  }
  ok(tests + ' Anläufe gegen Wände, Container, Kai und Kartenrand: nichts durchfahren', bad.length === 0, bad.slice(0, 5));
  let thin = 0; bad = [];
  for (const c of world.colliders.filter((o) => o.t)) for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 + 0.13, off = rng.range(-1.3, 1.3), x = c.x + Math.sin(a) * 6 + Math.cos(a) * off, z = c.z + Math.cos(a) * 6 - Math.sin(a) * off, h = wrapAngle(a + Math.PI);
    if (!carFree(world, x, z, h)) continue;
    thin++; crash(createCar(x, z, h), Math.sin(h) * 40, Math.cos(h) * 40, 60, c.kind);
  }
  ok(thin + ' Anläufe gegen Palmen, Laternen, Poller, Brunnen: nichts durchfahren', bad.length === 0, bad.slice(0, 5));
  ok('harte Treffer erzeugen Schaden (' + damaged + ')', damaged > 200);
  const st = createState(world), a = st.parked[0], h = a.h + Math.PI / 2, mover = createCar(a.x - Math.sin(h) * 4.6, a.z - Math.cos(h) * 4.6, h);
  const b = createCar(a.x - Math.sin(a.h) * 12, a.z - Math.cos(a.h) * 12, a.h); const target = carFree(world, b.x, b.z, b.h) ? b : mover;
  const ax = a.x, az = a.z; target.vx = Math.sin(target.h) * 15; target.vz = Math.cos(target.h) * 15;
  let pushed = 0; for (let i = 0; i < 120; i++) { drive(target, { gas: 0.5 }, DT); const r = moveCar(world, target, [target, ...st.parked], DT); if (r.kind === 'car') pushed = Math.max(pushed, r.impact); }
  ok('geparktes Auto lässt sich anstoßen', pushed > 3 && Math.hypot(a.x - ax, a.z - az) > 0.3, [pushed, Math.hypot(a.x - ax, a.z - az)]);
}

/* ---------- 1000 Zufallsfahrten ---------- */
section('1000 Zufallsfahrten (je 25 s)');
const endStates = [];
{
  const t0 = Date.now(), rng = createRng(99);
  const poses = [];
  while (poses.length < 1000) {
    const s = rng.pick(world.roads.segs), f = rng();
    const x = poses.length % 3 ? s.ax + (s.bx - s.ax) * f + rng.range(-3, 3) : rng.range(-285, 285), z = poses.length % 3 ? s.az + (s.bz - s.az) * f + rng.range(-3, 3) : rng.range(-285, 255), h = rng.range(-3.14, 3.14);
    if (carFree(world, x, z, h) && insideMap(x, z) && createState(world).parked.every((p) => carOverlap(createCar(x, z, h), p) <= 0)) poses.push([x, z, h]);
  }
  let pen = 0, tunnel = 0, outside = 0, jump = 0, parkedBad = 0, overlapMax = 0, ticks = 0, km = 0, crashes = 0, maxKmh = 0, stuck = [], checks = 0;
  const fresh = createState(world);
  for (let run = 0; run < 1000; run++) {
    const st = { ...fresh, tick: 0, odometer: 0, mode: 'car', car: createCar(...poses[run]), player: createPlayer(0, 0, 0), parked: fresh.parked.map((p) => ({ ...p })) };
    let input = {}, hold = 0; const eager = run % 2;
    for (let i = 0; i < 1500; i++) {
      if (hold-- <= 0) { hold = rng.int(10, 100); const reverse = rng.chance(0.14); input = { gas: reverse ? 0 : rng.chance(eager ? 0.95 : 0.7) ? 1 : 0, brake: reverse || rng.chance(0.06) ? 1 : 0, steer: rng.chance(0.35) ? 0 : rng.chance(0.5) ? rng.range(-1, 1) : rng.chance(0.5) ? 1 : -1, hand: rng.chance(0.14) }; }
      const px = st.car.x, pz = st.car.z;
      const ev = step(world, st, input); ticks++;
      for (const e of ev) if (e.type === 'crash') crashes++;
      const c = st.car;
      if (carDepth(c) > 0.025) pen++;
      if (pathThroughSolid(px, pz, c.x, c.z)) tunnel++;
      if (!insideMap(c.x, c.z) || !Number.isFinite(c.x + c.z + c.h)) outside++;
      if (Math.hypot(c.x - px, c.z - pz) > 1.2) jump++;
      maxKmh = Math.max(maxKmh, speedOf(c) * 3.6);
      if (i % 30 === 0) for (const p of st.parked) { overlapMax = Math.max(overlapMax, carOverlap(c, p)); if (speedOf(p) > 0.01 && (carDepth(p) > 0.025 || !insideMap(p.x, p.z))) parkedBad++; }
      // Festhänger-Probe: aus dieser Lage muss man wieder wegkommen
      if (i % 500 === 499) {
        checks++; let best = 0;
        for (const test of [{ brake: 1 }, { gas: 1 }, { brake: 1, steer: 1 }, { brake: 1, steer: -1 }, { gas: 1, steer: 1 }, { gas: 1, steer: -1 }]) {
          const copy = structuredClone(st); copy.car.vx = copy.car.vz = copy.car.w = 0; const x = copy.car.x, z = copy.car.z;
          for (let k = 0; k < 150 && best < 3; k++) { step(world, copy, test); best = Math.max(best, Math.hypot(copy.car.x - x, copy.car.z - z)); }
          if (best >= 3) break;
        }
        if (best < 3) stuck.push({ run, x: +st.car.x.toFixed(2), z: +st.car.z.toFixed(2), h: +st.car.h.toFixed(2), best: +best.toFixed(2) });
      }
    }
    for (const p of st.parked) if (carDepth(p) > 0.025) parkedBad++;
    km += st.odometer / 1000;
    endStates.push(st);
  }
  console.log(`    ${(ticks / 1e6).toFixed(2)} Mio. Takte, ${km.toFixed(0)} km, ${crashes} Stöße, Spitze ${maxKmh.toFixed(0)} km/h, ${((Date.now() - t0) / 1000).toFixed(0)} s Rechenzeit`);
  ok('nie in einer Wand (Toleranz 2,5 cm)', pen === 0, pen);
  ok('nie durch ein Hindernis gefahren', tunnel === 0, tunnel);
  ok('nie die Karte verlassen', outside === 0, outside);
  ok('keine Sprünge (höchstens 1,2 m je Takt)', jump === 0, jump);
  ok('angestoßene Autos bleiben außerhalb von Wänden', parkedBad === 0, parkedBad);
  console.log(`    größte Überlappung Auto/Auto: ${(overlapMax * 100).toFixed(0)} cm`);
  ok('Autos schieben sich nicht ineinander (unter 40 cm)', overlapMax < 0.4, overlapMax);
  ok(`kein Festhänger (${checks} Proben: aus jeder Lage 3 m wegkommen)`, stuck.length === 0, { anzahl: stuck.length, beispiele: stuck.slice(0, 6) });
}

/* ---------- Aussteigen ---------- */
section('Aussteigen');
{
  const rng = createRng(5); let tries = 0, none = 0, bad = [], walkFail = [];
  const check = (st) => {
    st.mode = 'car'; st.car.vx = st.car.vz = st.car.w = 0; tries++;
    const ev = step(world, st, { use: true });
    if (st.mode !== 'foot') { none++; return; }
    const p = st.player;
    if (depthAt(p.x, p.z, PLAYER.radius) > 0.001 || pathThroughSolid(st.car.x, st.car.z, p.x, p.z)) bad.push({ x: p.x, z: p.z });
    let best = 0;
    for (let a = 0; a < 8 && best < 3; a++) { const copy = structuredClone(st), x = copy.player.x, z = copy.player.z; for (let k = 0; k < 90; k++) step(world, copy, { mx: Math.sin(a * Math.PI / 4), mz: Math.cos(a * Math.PI / 4) }); best = Math.max(best, Math.hypot(copy.player.x - x, copy.player.z - z)); }
    if (best < 3) walkFail.push({ x: p.x, z: p.z, car: [st.car.x, st.car.z, st.car.h], best });
    const copy = structuredClone(st); const back = step(world, copy, { use: true }); if (copy.mode !== 'car') walkFail.push({ noReentry: [p.x, p.z], car: [st.car.x, st.car.z] });
    return ev;
  };
  for (const st of endStates) check(structuredClone(st));
  // an Wände, in Ecken und Gassen gedrückt
  let pressed = 0;
  const base = createState(world);
  const rects = world.colliders.filter((o) => !o.t);
  while (pressed < 2500) {
    const c = rng.pick(rects), side = rng.int(0, 3);
    const x = side === 0 ? c.x1 + 1.02 : side === 1 ? c.x0 - 1.02 : rng.range(c.x0 - 1, c.x1 + 1), z = side === 2 ? c.z1 + 1.02 : side === 3 ? c.z0 - 1.02 : rng.range(c.z0 - 1, c.z1 + 1);
    let h = side < 2 ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? 1 : -1) * Math.PI / 2; if (rng.chance(0.4)) h += rng.range(-1.5, 1.5);
    if (!insideMap(x, z) || !carFree(world, x, z, h)) continue;
    const st = structuredClone(base); st.car = createCar(x, z, h); if (st.parked.some((p) => carOverlap(st.car, p) > 0)) continue;
    pressed++; check(st);
  }
  ok(tries + ' Ausstiege: immer eine freie Stelle gefunden', none === 0, none);
  ok('nie in Geometrie ausgestiegen oder durch eine Wand versetzt', bad.length === 0, bad.slice(0, 5));
  ok('danach immer weggehen und wieder einsteigen können', walkFail.length === 0, { anzahl: walkFail.length, beispiele: walkFail.slice(0, 4) });
  const st = createState(world); st.mode = 'car'; st.car.vz = 0; st.car.vx = 15; const ev = step(world, st, { use: true });
  ok('während schneller Fahrt kein Ausstieg', st.mode === 'car' && ev.some((e) => e.type === 'tooFast'));
  const far = createState(world); far.player.x -= 12; step(world, far, { use: true }); ok('aus der Ferne kein Einsteigen', far.mode === 'foot');
  const close = createState(world); for (let i = 0; i < 90; i++) step(world, close, { mx: 0.75, mz: -0.65 }); const e2 = step(world, close, { use: true });
  ok('vom Start zum Auto gehen und einsteigen', close.mode === 'car' && e2.some((e) => e.type === 'enter'), [close.player.x, close.player.z, close.car.x, close.car.z]);
}

/* ---------- Zu Fuß ---------- */
section('Zu Fuß');
{
  let st = createState(world); st.player = createPlayer(40, 190, 0);
  for (let i = 0; i < 120; i++) step(world, st, { mx: 0, mz: 1 });
  const walk = Math.hypot(st.player.vx, st.player.vz); for (let i = 0; i < 60; i++) step(world, st, { mx: 0, mz: 1, sprint: true }); const run = Math.hypot(st.player.vx, st.player.vz);
  ok('Gehen und Sprinten (' + walk.toFixed(1) + ' / ' + run.toFixed(1) + ' m/s)', Math.abs(walk - PLAYER.walk) < 0.3 && Math.abs(run - PLAYER.sprint) < 0.3, [walk, run]);
  for (let i = 0; i < 30; i++) step(world, st, {}); step(world, st, { jump: true }); let top = 0, t = 0; while (!st.player.grounded && t < 120) { step(world, st, {}); top = Math.max(top, st.player.y); t++; }
  ok('Sprung (' + top.toFixed(2) + ' m, ' + (t / 60).toFixed(2) + ' s)', top > 0.6 && top < 1.3 && st.player.grounded);
  const rng = createRng(31); let pen = 0, tunnel = 0, out = 0;
  for (let run = 0; run < 400; run++) {
    st = createState(world);
    for (let tries = 0; tries < 200; tries++) { const x = rng.range(-290, 290), z = rng.range(-290, 255); if (depthAt(x, z, 0.5) <= 0 && insideMap(x, z)) { st.player = createPlayer(x, z, 0); break; } }
    let input = {}, hold = 0;
    for (let i = 0; i < 1200; i++) {
      if (hold-- <= 0) { hold = rng.int(20, 200); const a = rng.range(0, 6.28); input = { mx: Math.sin(a), mz: Math.cos(a), sprint: rng.chance(0.6) }; }
      input.jump = rng.chance(0.02);
      const px = st.player.x, pz = st.player.z; step(world, st, input);
      if (depthAt(st.player.x, st.player.z, PLAYER.radius) > 0.04) pen++;
      if (pathThroughSolid(px, pz, st.player.x, st.player.z)) tunnel++;
      if (!insideMap(st.player.x, st.player.z)) out++;
    }
  }
  ok('400 Zufallsläufe: nie in Wänden, nie hindurch, nie außerhalb', pen === 0 && tunnel === 0 && out === 0, [pen, tunnel, out]);
}

/* ---------- Kamera ---------- */
section('Kamera');
{
  const solids = world.colliders.filter((c) => c.occlude);
  const inside = (p, m) => solids.some((c) => p[0] > c.x0 - m && p[0] < c.x1 + m && p[2] > c.z0 - m && p[2] < c.z1 + m && p[1] < c.h + m);
  const rng = createRng(11); let frames = 0, bad = 0, blocked = 0, close = 0, distSum = 0, minDist = 99;
  const run = (st, ticks, input, scale) => {
    const cam = createCamera(st.mode === 'car' ? st.car.h : st.player.h);
    for (let i = 0; i < ticks; i++) {
      step(world, st, input(i));
      if (i % 2) continue;
      updateCamera(cam, world, st, { dx: rng.chance(0.15) ? rng.range(-0.25, 0.25) : 0, dy: rng.chance(0.05) ? rng.range(-0.2, 0.2) : 0 }, DT * 2, scale);
      const t = st.mode === 'car' ? st.car : st.player, piv = [t.x, st.mode === 'car' ? 1.7 : 1.6, t.z]; frames++;
      if (inside(cam.pos, 0.3)) bad++;
      for (let k = 1; k <= 30; k++) { const f = k / 30, q = [piv[0] + (cam.pos[0] - piv[0]) * f, piv[1] + (cam.pos[1] - piv[1]) * f, piv[2] + (cam.pos[2] - piv[2]) * f]; if (inside(q, 0.12)) { blocked++; break; } }
      const d = Math.hypot(cam.pos[0] - t.x, cam.pos[1] - piv[1], cam.pos[2] - t.z); distSum += d; minDist = Math.min(minDist, d); if (d < 2.5) close++;
    }
  };
  for (let k = 0; k < 400; k++) run(structuredClone(endStates[k]), 180, (i) => ({ gas: i < 120 ? 1 : 0, brake: i >= 120 ? 1 : 0, steer: Math.sin(i / 17 + k) }), k % 2 ? 1 : 1.25);
  for (let k = 400; k < 900; k++) { const st = structuredClone(endStates[k]); step(world, st, {}); st.car.vx = st.car.vz = 0; step(world, st, { use: true }); const a = rng.range(0, 6.28); run(st, 160, (i) => ({ mx: Math.sin(a + i / 50), mz: Math.cos(a + i / 50), sprint: i % 100 < 50 }), 1); }
  console.log(`    ${frames} Bilder, mittlerer Abstand ${(distSum / frames).toFixed(1)} m, kleinster ${minDist.toFixed(2)} m, unter 2,5 m: ${(close / frames * 100).toFixed(2)} %`);
  ok('Kamera nie in einem Gebäude', bad === 0, bad);
  ok('Sichtlinie zur Figur nie durch ein Gebäude', blocked === 0, blocked);
  ok('Kamera nur selten sehr nah (unter 2 % der Bilder)', close / frames < 0.02, close / frames);
}

/* ---------- Speicherstand ---------- */
section('Speicherstand');
{
  const st = structuredClone(endStates[3]); st.car.vx = st.car.vz = 0; step(world, st, { use: true }); st.car.damage = 37;
  const data = JSON.parse(JSON.stringify(serialize(st))), back = restore(world, data);
  ok('Position, Fahrzeug und Schaden kommen zurück', back && back.mode === st.mode && Math.hypot(back.player.x - st.player.x, back.player.z - st.player.z) < 0.05 && Math.hypot(back.car.x - st.car.x, back.car.z - st.car.z) < 0.05 && back.car.damage === 37, back && [back.mode, back.player.x, st.player.x]);
  let lost = 0; for (const e of endStates) { const b = restore(world, serialize(e)); if (!b || Math.hypot(b.car.x - e.car.x, b.car.z - e.car.z) > 0.05) lost++; }
  console.log(`    ${1000 - lost}/1000 Fahr-Endlagen exakt wiederhergestellt`);
  ok('mindestens 98 % aller Endlagen exakt wiederherstellbar', lost <= 20, lost);
  ok('Unsinn wird abgelehnt', [null, 1, 'x', {}, { ...data, v: 9 }, { ...data, seed: 1 }, { ...data, p: [NaN, 0, 0] }, { ...data, car: [9999, 0, 0] }].every((d) => restore(world, d) === null));
  const wall = world.buildings[0], hostile = restore(world, { ...data, mode: 'foot', p: [(wall.x0 + wall.x1) / 2, (wall.z0 + wall.z1) / 2, 0], car: [(wall.x0 + wall.x1) / 2, (wall.z0 + wall.z1) / 2, 0, -5], parked: 'x' });
  ok('Positionen in Wänden werden ersetzt', hostile && carDepth(hostile.car) <= 0.001 && depthAt(hostile.player.x, hostile.player.z, PLAYER.radius) <= 0.001 && hostile.car.damage === 0);
}

/* ---------- Zurückholen ---------- */
section('Auto zurückholen');
{
  let bad = 0;
  for (let k = 0; k < 300; k++) { const st = structuredClone(endStates[k]); st.mode = k % 2 ? 'car' : 'foot'; if (st.mode === 'foot') { st.player = createPlayer(st.car.x, st.car.z, 0); } st.car.damage = 80; if (!recover(world, st) || carDepth(st.car) > 0.001 || st.car.damage !== 0 || (st.mode === 'foot' && depthAt(st.player.x, st.player.z, PLAYER.radius) > 0.001)) bad++; }
  ok('300-mal: Auto steht repariert und frei auf der Straße', bad === 0, bad);
  const a = createState(world), b = createState(world); for (let i = 0; i < 900; i++) { const input = { use: i === 100, gas: 1, steer: Math.sin(i / 30), mx: 0.7, mz: -0.7 }; step(world, a, input); step(world, b, input); }
  ok('Simulation ist deterministisch', JSON.stringify(a) === JSON.stringify(b));
}

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
