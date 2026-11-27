// Arcade-Fahrphysik und Fahrzeug-Kollision. Reine Logik, fester Takt, kein Zufall.
// Blickrichtung h: vorwärts = (sin h, cos h), rechts = (-cos h, sin h). Lenkung +1 = rechts.
import { CAR } from './config.js';
import { deepest, touch, crossesSolid } from './world.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export function createCar(x, z, h, color = 0) {
  return { x, z, h, vx: 0, vz: 0, w: 0, steer: 0, drift: 0, damage: 0, braking: false, reversing: false, color };
}
export const forwardSpeed = (c) => c.vx * Math.sin(c.h) + c.vz * Math.cos(c.h);
export const sideSpeed = (c) => -c.vx * Math.cos(c.h) + c.vz * Math.sin(c.h);   // + = rutscht nach rechts
export const speedOf = (c) => Math.hypot(c.vx, c.vz);
export const powerOf = (damage) => 1 - 0.5 * clamp((damage - 40) / 60, 0, 1);

// Fahrdynamik: Eingaben -> Geschwindigkeit und Drehrate (noch keine Bewegung)
export function drive(car, input, dt) {
  const gas = clamp(+input.gas || 0, 0, 1), brake = clamp(+input.brake || 0, 0, 1), hand = !!input.hand, target = clamp(+input.steer || 0, -1, 1);
  const rate = Math.abs(target) > Math.abs(car.steer) && target * car.steer >= 0 ? CAR.steerIn : CAR.steerBack;
  car.steer += clamp(target - car.steer, -rate * dt, rate * dt);

  const s = Math.sin(car.h), c = Math.cos(car.h);
  let u = car.vx * s + car.vz * c, v = -car.vx * c + car.vz * s;
  const power = powerOf(car.damage);

  // Längsrichtung
  car.braking = false; car.reversing = false;
  if (brake > 0 && u > 0.6) { u = Math.max(0, u - CAR.brake * brake * dt); car.braking = true; }
  else if (brake > 0 && gas === 0 && !hand) { u -= CAR.reverseAccel * power * brake * dt; if (u < -CAR.reverseMax) u = -CAR.reverseMax; car.reversing = true; }
  else if (gas > 0 && u < -0.6) { u = Math.min(0, u + CAR.brake * gas * dt); car.braking = true; }
  else if (brake > 0) { u -= Math.sign(u) * Math.min(Math.abs(u), CAR.brake * dt); car.braking = true; }
  else if (gas > 0) u += CAR.engine * power * gas * Math.max(0, 1 - Math.pow(Math.max(0, u) / CAR.topParam, 1.6)) * (hand ? 0.45 : 1) * dt;
  let resist = (CAR.roll + CAR.drag * u * u) * (gas > 0 || car.reversing ? (u > 8 ? 1 : 0.2) : 1) + (hand ? CAR.handDecel : 0);
  u -= Math.sign(u) * Math.min(Math.abs(u), resist * dt);
  if (gas === 0 && brake === 0 && Math.abs(u) < 0.25) u = 0;

  // Rutschzustand: Handbremse setzt ihn, Gas im Rutschen hält ihn länger
  const slip = Math.atan2(v, Math.max(1, Math.abs(u)));
  if (hand && Math.abs(u) > 4) car.drift = Math.min(1, car.drift + dt * 8);
  else {
    const hold = gas > 0.5 && Math.abs(slip) > 0.22 && Math.abs(target) > 0.2 ? 0.35 : 1;
    car.drift = Math.max(0, car.drift - CAR.driftRecover * hold * dt);
  }
  const d = car.drift;

  // Seitenführung: seitliches Tempo abbauen, ein Teil davon bleibt als Schwung erhalten
  const sideRate = CAR.sideRate + (CAR.driftRate - CAR.sideRate) * d, sideMax = CAR.sideMax + (CAR.driftMax - CAR.sideMax) * d;
  const dv = clamp(-v * Math.min(1, sideRate * dt), -sideMax * dt, sideMax * dt);
  const before = Math.hypot(u, v);
  v += dv;
  // Schwung erhalten, aber dadurch nie schneller werden als vorher
  if (gas > 0 && u > 3) u = Math.min(u + Math.abs(dv) * 0.45 * gas, Math.max(u, Math.sqrt(Math.max(0, before * before - v * v))));

  // Drehrate
  const t = clamp(Math.abs(u) / CAR.steerFadeSpeed, 0, 1);
  const angle = car.steer * (CAR.steerLow + (CAR.steerHigh - CAR.steerLow) * t);
  let wGrip = -(u / CAR.wheelbase) * Math.tan(angle);
  const limit = CAR.latGrip / Math.max(6, Math.abs(u));
  wGrip = clamp(wGrip, -limit, limit);
  let wTarget = wGrip;
  const speed = Math.hypot(u, v);
  if (d > 0 && u > 2) {
    const toVel = wrapAngle(Math.atan2(car.vx, car.vz) - car.h);                 // Selbstausrichtung zur Fahrtrichtung
    const wDrift = -car.steer * CAR.driftYaw * clamp(speed / 10, 0, 1) + toVel * (hand ? 0.7 : 2.1);
    wTarget = wGrip + (wDrift - wGrip) * d;
  }
  // Dreher begrenzen: ab großem Schwimmwinkel zurück zur Fahrtrichtung ziehen
  if (speed > 5 && u > -1) {
    const toVel = wrapAngle(Math.atan2(car.vx, car.vz) - car.h);
    if (Math.abs(toVel) > 0.85) wTarget = wTarget * 0.25 + toVel * 3.2;
  }
  const resp = CAR.yawResponse + (CAR.yawResponseDrift - CAR.yawResponse) * d;
  car.w += (wTarget - car.w) * Math.min(1, resp * dt);
  if (Math.abs(u) < 0.05 && speed < 0.2) car.w *= 0.8;

  car.vx = u * s - v * c; car.vz = u * c + v * s;
  const total = Math.hypot(car.vx, car.vz);
  if (total > CAR.maxSpeed) { car.vx *= CAR.maxSpeed / total; car.vz *= CAR.maxSpeed / total; }
}

const hit = { nx: 0, nz: 0, depth: 0, c: null }, probe = { nx: 0, nz: 0, depth: 0 };

// Tiefste Berührung eines Autos mit festen Hindernissen
export function carPenetration(world, x, z, h, out) {
  const s = Math.sin(h), c = Math.cos(h); let best = 0;
  for (const off of CAR.offsets) {
    const d = deepest(world, x + s * off, z + c * off, CAR.radius, hit);
    if (d > best) { best = d; if (out) { out.nx = hit.nx; out.nz = hit.nz; out.depth = d; out.off = off; out.kind = hit.c.kind; } }
  }
  return best;
}
export const carFree = (world, x, z, h) => carPenetration(world, x, z, h) <= 0.001;

// Zwei Autos: tiefste Überlappung, Normale zeigt von b nach a
export function carOverlap(a, b, out) {
  if (Math.abs(a.x - b.x) > 6.5 || Math.abs(a.z - b.z) > 6.5) return 0;
  const as = Math.sin(a.h), ac = Math.cos(a.h), bs = Math.sin(b.h), bc = Math.cos(b.h); let best = 0;
  for (const i of CAR.offsets) for (const j of CAR.offsets) {
    const dx = a.x + as * i - b.x - bs * j, dz = a.z + ac * i - b.z - bc * j, d2 = dx * dx + dz * dz, sum = CAR.radius * 2;
    if (d2 >= sum * sum) continue;
    const d = Math.sqrt(d2), depth = sum - d;
    if (depth > best) { best = depth; if (out) { out.nx = d > 1e-6 ? dx / d : 1; out.nz = d > 1e-6 ? dz / d : 0; out.depth = depth; out.offA = i; out.offB = j; } }
  }
  return best;
}
const maxOverlap = (car, others) => { let m = 0; for (const o of others) if (o !== car) m = Math.max(m, carOverlap(car, o)); return m; };

// Aus festen Hindernissen herausschieben und Geschwindigkeit anpassen. Gibt die Aufprallstärke zurück.
function resolveStatic(world, car) {
  let impact = 0, kind = '';
  const n = {};
  for (let iter = 0; iter < 10; iter++) {
    if (carPenetration(world, car.x, car.z, car.h, n) <= 0.001) break;
    const tx = Math.cos(car.h), tz = -Math.sin(car.h);                          // Bewegung eines Punktes bei Drehung
    const lever = n.nx * tx + n.nz * tz, turn = n.off * lever;
    const push = n.depth + 0.0008;
    car.x += (n.nx - tx * lever * 0.3) * push; car.z += (n.nz - tz * lever * 0.3) * push;
    car.h += clamp(lever * push * 0.3 / n.off, -0.035, 0.035);
    const pvx = car.vx + tx * car.w * n.off, pvz = car.vz + tz * car.w * n.off;
    const vn = pvx * n.nx + pvz * n.nz;
    if (vn < 0) {
      const j = -(1 + CAR.restitution) * vn;
      car.vx += n.nx * j * (1 - 0.25 * Math.abs(lever)); car.vz += n.nz * j * (1 - 0.25 * Math.abs(lever));
      car.w = clamp(car.w * 0.9 + clamp(turn, -1, 1) * j * 0.11, -3.2, 3.2);
      // Reibung entlang der Wand
      const sx = -n.nz, sz = n.nx, vs = car.vx * sx + car.vz * sz, f = Math.sign(vs) * Math.min(Math.abs(vs), -vn * 0.18);
      car.vx -= sx * f; car.vz -= sz * f;
      if (-vn > impact) { impact = -vn; kind = n.kind; }
    }
  }
  return { impact, kind };
}

// Stoß zwischen zwei Autos (gleiche Masse)
function bump(a, b, n) {
  const atx = Math.cos(a.h), atz = -Math.sin(a.h), btx = Math.cos(b.h), btz = -Math.sin(b.h);
  const rvx = a.vx + atx * a.w * n.offA - b.vx - btx * b.w * n.offB, rvz = a.vz + atz * a.w * n.offA - b.vz - btz * b.w * n.offB;
  const vn = rvx * n.nx + rvz * n.nz;
  if (vn >= 0) return 0;
  const j = -(1 + 0.2) * vn / 2;
  a.vx += n.nx * j; a.vz += n.nz * j; b.vx -= n.nx * j; b.vz -= n.nz * j;
  a.w = clamp(a.w + (n.nx * atx + n.nz * atz) * n.offA * j * 0.07, -3.2, 3.2);
  b.w = clamp(b.w - (n.nx * btx + n.nz * btz) * n.offB * j * 0.1, -3.2, 3.2);
  return -vn;
}

// Ein Auto bewegen: in kleinen Teilschritten, nie in feste Hindernisse hinein.
export function moveCar(world, car, others, dt) {
  const reach = speedOf(car) * dt + Math.abs(car.w) * 1.6 * dt;
  const steps = Math.max(1, Math.min(6, Math.ceil(reach / 0.18)));
  const h = dt / steps;
  let impact = 0, kind = '';
  const n = {};
  for (let k = 0; k < steps; k++) {
    const px = car.x, pz = car.z, ph = car.h;
    const before = maxOverlap(car, others);
    car.x += car.vx * h; car.z += car.vz * h; car.h += car.w * h;
    for (const o of others) {
      if (o === car || carOverlap(car, o, n) <= 0.001) continue;
      const v = bump(car, o, n); if (v > impact) { impact = v; kind = 'car'; }
      const ox = o.x, oz = o.z, push = n.depth + 0.001;
      o.x -= n.nx * push * 0.5; o.z -= n.nz * push * 0.5;
      let share = 0.5;
      if (carPenetration(world, o.x, o.z, o.h) > 0.001 || maxOverlap(o, others) > 0.12) { o.x = ox; o.z = oz; share = 1; o.vx = o.vz = 0; }
      car.x += n.nx * push * share; car.z += n.nz * push * share;
    }
    const r = resolveStatic(world, car); if (r.impact > impact) { impact = r.impact; kind = r.kind; }
    // Sicherheitsnetz: ist die Lage nicht sauber lösbar, zurück zur letzten freien Lage
    if (carPenetration(world, car.x, car.z, car.h) > 0.02 || crossesSolid(world, px, pz, car.x, car.z) || maxOverlap(car, others) > Math.max(0.22, before + 0.01)) {
      car.x = px; car.z = pz; car.h = ph; car.vx *= -0.12; car.vz *= -0.12; car.w = 0;
    }
  }
  car.h = wrapAngle(car.h);
  return { impact, kind };
}

export function stepCar(world, car, input, others, dt, events) {
  drive(car, input, dt);
  const { impact, kind } = moveCar(world, car, others, dt);
  if (impact > 2.5) {
    if (impact > CAR.damageFrom) car.damage = Math.min(100, car.damage + (impact - CAR.damageFrom) * CAR.damagePer);
    if (events) events.push({ type: 'crash', speed: impact, kind, x: car.x, z: car.z });
  }
}

// Angestoßene geparkte Autos rollen aus
export function stepParked(world, car, all, dt) {
  const sp = speedOf(car);
  if (sp < 0.05 && Math.abs(car.w) < 0.05) { car.vx = car.vz = car.w = 0; return false; }
  const s = Math.sin(car.h), c = Math.cos(car.h);
  let u = car.vx * s + car.vz * c, v = -car.vx * c + car.vz * s;
  u -= Math.sign(u) * Math.min(Math.abs(u), 4 * dt); v -= Math.sign(v) * Math.min(Math.abs(v), 16 * dt);
  car.vx = u * s - v * c; car.vz = u * c + v * s;
  car.w -= Math.sign(car.w) * Math.min(Math.abs(car.w), 4 * dt);
  moveCar(world, car, all, dt);
  return true;
}
export { touch, probe };
