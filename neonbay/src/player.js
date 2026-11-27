// Figur zu Fuß: laufen, sprinten, springen, Kollision; sichere Ausstiegsstellen.
import { CAR, PLAYER } from './config.js';
import { deepest, touch, isFree, crossesSolid } from './world.js';
import { wrapAngle } from './vehicles.js';

export function createPlayer(x, z, h) { return { x, z, y: 0, vx: 0, vy: 0, vz: 0, h, walked: 0, buffer: 0, grounded: true, sprinting: false }; }

const tmp = {}, one = {};
function deepestAll(world, cars, x, z, r, out) {
  let best = deepest(world, x, z, r, out);
  for (const car of cars) {
    if (Math.abs(car.x - x) > 5 || Math.abs(car.z - z) > 5) continue;
    const s = Math.sin(car.h), c = Math.cos(car.h);
    for (const off of CAR.offsets) {
      one.t = 1; one.x = car.x + s * off; one.z = car.z + c * off; one.r = CAR.radius;
      const d = touch(one, x, z, r, tmp);
      if (d > best) { best = d; out.nx = tmp.nx; out.nz = tmp.nz; out.depth = d; }
    }
  }
  return best;
}
export const penetrationOnFoot = (world, cars, x, z, r = PLAYER.radius) => deepestAll(world, cars, x, z, r, {});

export function stepPlayer(world, p, input, cars, dt, events) {
  let mx = +input.mx || 0, mz = +input.mz || 0;
  const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
  p.sprinting = !!input.sprint && len > 0.25;
  const top = p.sprinting ? PLAYER.sprint : PLAYER.walk;
  const dvx = mx * top - p.vx, dvz = mz * top - p.vz, dl = Math.hypot(dvx, dvz), max = PLAYER.accel * (p.grounded ? 1 : 0.35) * dt;
  if (dl > max) { p.vx += dvx / dl * max; p.vz += dvz / dl * max; } else { p.vx += dvx; p.vz += dvz; }
  if (len > 0.15) p.h = wrapAngle(p.h + wrapAngle(Math.atan2(mx, mz) - p.h) * Math.min(1, PLAYER.turn * dt));

  p.buffer = input.jump ? PLAYER.jumpBuffer : Math.max(0, p.buffer - dt);
  if (p.buffer > 0 && p.grounded) { p.vy = PLAYER.jump; p.grounded = false; p.buffer = 0; if (events) events.push({ type: 'jump' }); }
  if (!p.grounded) { p.vy -= PLAYER.gravity * dt; p.y += p.vy * dt; if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; if (events) events.push({ type: 'land' }); } }

  const px = p.x, pz = p.z;
  p.x += p.vx * dt; p.z += p.vz * dt;
  const n = {};
  for (let i = 0; i < 8; i++) {
    if (deepestAll(world, cars, p.x, p.z, PLAYER.radius, n) <= 0.001) break;
    p.x += n.nx * (n.depth + 0.0005); p.z += n.nz * (n.depth + 0.0005);
    const vn = p.vx * n.nx + p.vz * n.nz; if (vn < 0) { p.vx -= n.nx * vn; p.vz -= n.nz * vn; }
  }
  if (deepestAll(world, cars, p.x, p.z, PLAYER.radius, n) > 0.03 || crossesSolid(world, px, pz, p.x, p.z)) { p.x = px; p.z = pz; p.vx = p.vz = 0; }
  p.walked += Math.hypot(p.x - px, p.z - pz);
}

// Abstand eines Punkts zum Auto-Umriss
export function distanceToCar(car, x, z) {
  const dx = x - car.x, dz = z - car.z, s = Math.sin(car.h), c = Math.cos(car.h);
  const along = dx * s + dz * c, side = -dx * c + dz * s;
  return Math.hypot(Math.max(0, Math.abs(along) - CAR.length / 2), Math.max(0, Math.abs(side) - CAR.width / 2));
}

// Kann man von hier aus wirklich weggehen? Mindestens eine Richtung ist 1,6 m weit frei.
function canWalk(world, cars, x, z) {
  for (let a = 0; a < 16; a++) {
    const dx = Math.sin(a * Math.PI / 8), dz = Math.cos(a * Math.PI / 8); let ok = true;
    for (let t = 0.2; t <= 1.6 && ok; t += 0.2) ok = deepestAll(world, cars, x + dx * t, z + dz * t, PLAYER.radius, {}) <= 0.001;
    if (ok) return true;
  }
  return false;
}

// Freie Stelle neben dem Auto: Fahrertür, Beifahrertür, hinten, vorn, dann in Ringen.
export function exitSpot(world, car, cars) {
  const s = Math.sin(car.h), c = Math.cos(car.h);
  const at = (side, along) => ({ x: car.x - c * side + s * along, z: car.z + s * side + c * along });
  const list = [at(-1.75, 0.2), at(1.75, 0.2), at(-1.75, -1.1), at(1.75, -1.1), at(0, -3.1), at(0, 3.1)];
  for (let r = 2.2; r <= 9; r += 0.6) for (let a = 0; a < 24; a++) { const w = car.h - Math.PI / 2 + a * Math.PI / 12; list.push({ x: car.x + Math.sin(w) * r, z: car.z + Math.cos(w) * r }); }
  for (const q of list) {
    if (!isFree(world, q.x, q.z, PLAYER.radius + 0.08)) continue;
    if (deepestAll(world, cars, q.x, q.z, PLAYER.radius + 0.05, {}) > 0) continue;
    if (crossesSolid(world, car.x, car.z, q.x, q.z)) continue;
    if (!canWalk(world, cars, q.x, q.z)) continue;
    return q;
  }
  return null;
}
