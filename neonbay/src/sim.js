// Spielzustand und Regeln. Reines JSON, fester Takt (60 Hz), ohne DOM und Grafik.
import { DT, MAP, PLAYER } from './config.js';
import { isFree, roadPoses } from './world.js';
import { createCar, stepCar, stepParked, speedOf, forwardSpeed, sideSpeed, carFree, carPenetration, carOverlap } from './vehicles.js';
import { createPlayer, stepPlayer, distanceToCar, exitSpot, penetrationOnFoot } from './player.js';

export const SAVE_VERSION = 1;
const SAVED = 0.021;                                   // so viel Berührung lässt die laufende Simulation höchstens zu
export const allCars = (st) => [st.car, ...st.parked];

export function createState(world) {
  const s = world.spawn;
  return {
    tick: 0, seed: world.seed, mode: 'foot',
    car: createCar(s.car.x, s.car.z, s.car.h),
    player: createPlayer(s.player.x, s.player.z, s.player.h),
    parked: world.parked.map((p) => createCar(p.x, p.z, p.h, p.color)),
    drifting: false, driftCool: 0, odometer: 0
  };
}

export const canEnter = (st) => st.mode === 'foot' && st.player.grounded && speedOf(st.car) <= PLAYER.enterMaxSpeed && distanceToCar(st.car, st.player.x, st.player.z) <= PLAYER.enterRange;
export const canExit = (st) => st.mode === 'car' && speedOf(st.car) <= PLAYER.exitMaxSpeed;

function enter(world, st, events) {
  if (!canEnter(st)) return false;
  st.mode = 'car'; st.player.vx = st.player.vz = 0; st.player.sprinting = false; events.push({ type: 'enter' }); return true;
}
function leave(world, st, events) {
  if (st.mode !== 'car') return false;
  if (!canExit(st)) { events.push({ type: 'tooFast' }); return false; }
  const q = exitSpot(world, st.car, allCars(st));
  if (!q) { events.push({ type: 'noExit' }); return false; }
  const car = st.car; car.vx = car.vz = car.w = 0; car.steer = 0; car.drift = 0; car.braking = car.reversing = false;
  st.player = Object.assign(createPlayer(q.x, q.z, car.h), { walked: st.player.walked });
  st.mode = 'foot'; st.drifting = false; events.push({ type: 'exit' }); return true;
}

// input: { mx, mz, sprint, jump, use, gas, brake, steer, hand, horn }  (jump/use/horn: einmaliger Druck)
export function step(world, st, input = {}) {
  const events = [];
  st.tick++;
  if (input.use) { if (st.mode === 'foot') enter(world, st, events); else leave(world, st, events); }
  const cars = allCars(st);
  if (st.mode === 'car') {
    const px = st.car.x, pz = st.car.z;
    stepCar(world, st.car, input, cars, DT, events);
    st.odometer += Math.hypot(st.car.x - px, st.car.z - pz);
    st.player.x = st.car.x; st.player.z = st.car.z; st.player.h = st.car.h; st.player.y = 0;
    if (input.horn) events.push({ type: 'horn' });
    st.driftCool = Math.max(0, st.driftCool - DT);
    const sliding = Math.abs(sideSpeed(st.car)) > 3.5 && speedOf(st.car) > 7;
    if (sliding && !st.drifting && st.driftCool === 0) { events.push({ type: 'screech' }); st.driftCool = 0.9; }
    st.drifting = sliding;
  } else {
    // Das stehende Auto rollt gegebenenfalls aus
    stepParked(world, st.car, cars, DT);
    stepPlayer(world, st.player, input, cars, DT, events);
  }
  for (const p of st.parked) stepParked(world, p, cars, DT);
  return events;
}

// Auto auf die nächste freie Straßenstelle holen und reparieren; zu Fuß steht man daneben.
export function recover(world, st) {
  const from = st.mode === 'car' ? st.car : st.player;
  for (const q of roadPoses(world, from.x, from.z)) {
    const probe = createCar(q.x, q.z, q.h);
    if (!carFree(world, q.x, q.z, q.h) || st.parked.some((o) => carOverlap(probe, o) > 0)) continue;
    if (st.mode === 'foot') {
      const spot = exitSpot(world, probe, [probe, ...st.parked]);
      if (!spot) continue;
      st.car = probe; st.player = Object.assign(createPlayer(spot.x, spot.z, q.h), { walked: st.player.walked });
    } else { st.car = probe; st.player.x = q.x; st.player.z = q.z; st.player.h = q.h; }
    st.drifting = false;
    return true;
  }
  return false;
}

/* ---------- Speicherstand ---------- */
const r2 = (v) => Math.round(v * 1000) / 1000;
export function serialize(st) {
  return { v: SAVE_VERSION, seed: st.seed, mode: st.mode, p: [r2(st.player.x), r2(st.player.z), r2(st.player.h)], car: [r2(st.car.x), r2(st.car.z), r2(st.car.h), r2(st.car.damage)], parked: st.parked.map((c) => [r2(c.x), r2(c.z), r2(c.h)]), km: r2(st.odometer) };
}
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const pose = (a) => Array.isArray(a) && a.length >= 3 && num(a[0]) && num(a[1]) && num(a[2]) && Math.abs(a[0]) < MAP.edge && Math.abs(a[1]) < MAP.edge;
// Prüft streng; gibt bei Unsinn null. Ungültige Einzelwerte fallen auf den Start zurück.
export function restore(world, data) {
  if (!data || typeof data !== 'object' || data.v !== SAVE_VERSION || data.seed !== world.seed || !pose(data.p) || !pose(data.car)) return null;
  const st = createState(world);
  const parkedOk = Array.isArray(data.parked) && data.parked.length === st.parked.length && data.parked.every((a) => pose(a) && carPenetration(world, a[0], a[1], a[2]) <= SAVED);
  if (parkedOk) data.parked.forEach((a, i) => Object.assign(st.parked[i], { x: a[0], z: a[1], h: a[2] }));
  const car = createCar(data.car[0], data.car[1], data.car[2]);
  if (carPenetration(world, car.x, car.z, car.h) <= SAVED && st.parked.every((o) => carOverlap(car, o) < 0.25)) st.car = car;
  st.car.damage = num(data.car[3]) ? Math.max(0, Math.min(100, data.car[3])) : 0;
  st.odometer = num(data.km) && data.km >= 0 ? data.km : 0;
  if (data.mode === 'car') { st.mode = 'car'; st.player = createPlayer(st.car.x, st.car.z, st.car.h); }
  else {
    const [x, z, h] = data.p;
    if (isFree(world, x, z, PLAYER.radius - 0.02) && penetrationOnFoot(world, allCars(st), x, z) < 0.05) st.player = createPlayer(x, z, h);
    else { const q = exitSpot(world, st.car, allCars(st)); if (q) st.player = createPlayer(q.x, q.z, st.car.h); }
  }
  return st;
}
export { speedOf, forwardSpeed, sideSpeed };
