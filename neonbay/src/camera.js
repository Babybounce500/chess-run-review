// Verfolgerkamera als reine Rechnung (ohne Grafik, dadurch testbar). Bleibt immer außerhalb der Gebäude.
import { clearFraction, occluderGap } from './world.js';
import { wrapAngle, speedOf, forwardSpeed } from './vehicles.js';

export function createCamera(yaw = 0) { return { yaw, orbit: 0, pitch: 0, idle: 9, dist: 8, lift: 0, mode: '', reverse: 0, pos: [0, 5, 0], look: [0, 1, 0], clipped: false }; }

const PAD = 0.45;
// Kandidaten: [Abstandsfaktor, Höhe über dem Drehpunkt]; erster mit genügend Platz gewinnt.
const TRIES = [[1, 0], [0.85, 1.4], [0.65, 3.2], [0.45, 5.2], [0.22, 6.5], [0.05, 7.5]];

export function updateCamera(cam, world, st, look, dt, viewScale = 1) {
  const car = st.mode === 'car', t = car ? st.car : st.player;
  if (cam.mode !== st.mode) { cam.mode = st.mode; cam.orbit = 0; cam.idle = 9; }
  // Eigenes Umschauen (Ziehen, rechter Stick)
  if (look.dx || look.dy) { cam.idle = 0; if (car) cam.orbit = wrapAngle(cam.orbit - look.dx); else cam.yaw = wrapAngle(cam.yaw - look.dx); cam.pitch = Math.max(-0.6, Math.min(1.6, cam.pitch + look.dy)); }
  else cam.idle += dt;

  let base, height, pivotY, ahead;
  if (car) {
    const u = forwardSpeed(st.car), sp = speedOf(st.car);
    cam.reverse = u < -2 ? cam.reverse + dt : 0;
    let want = st.car.h;
    if (u > 5) want = st.car.h + wrapAngle(Math.atan2(st.car.vx, st.car.vz) - st.car.h) * 0.55;       // beim Driften in Fahrtrichtung schauen
    if (cam.reverse > 1.1 && cam.idle > 1) want = st.car.h + Math.PI;
    cam.yaw = wrapAngle(cam.yaw + wrapAngle(want - cam.yaw) * Math.min(1, dt * (sp < 1 ? 1.6 : 4.5)));
    if (cam.idle > 1.6) { cam.orbit *= Math.max(0, 1 - dt * 2.5); cam.pitch *= Math.max(0, 1 - dt * 2); }
    base = (7.4 + Math.min(2.2, sp * 0.065)) * viewScale; height = 1.7 + cam.pitch * 2.5; pivotY = 1.7; ahead = 2.2;
  } else {
    const sp = Math.hypot(st.player.vx, st.player.vz);
    if (cam.idle > 1.2 && sp > 1) { const diff = wrapAngle(Math.atan2(st.player.vx, st.player.vz) - cam.yaw); if (Math.abs(diff) < 2.3) cam.yaw = wrapAngle(cam.yaw + diff * Math.min(1, dt * 1.1)); }
    cam.orbit = 0;
    base = 5.2 * viewScale; height = 1.1 + cam.pitch * 2.5; pivotY = 1.6 + st.player.y * 0.6; ahead = 0.8;
  }
  const yaw = cam.yaw + cam.orbit, s = Math.sin(yaw), c = Math.cos(yaw);
  const px = t.x, pz = t.z;
  const pad = Math.max(0.05, Math.min(PAD, occluderGap(world, px, pz, 1) - 0.03));
  const need = car ? 5.4 : 3.6;
  let best = null;
  for (const [f, up] of TRIES) {
    const d = base * f, ex = px - s * d, ez = pz - c * d, ey = Math.max(0.7, pivotY + height * Math.max(0.35, f) + up);
    const free = clearFraction(world, px, pivotY, pz, ex, ey, ez, pad);
    const len = Math.hypot(ex - px, ey - pivotY, ez - pz), usable = len * Math.max(0, free - 0.002);
    const cand = { ex, ey, ez, len, usable, free, up };
    if (!best || usable > best.usable + 0.3) best = cand;
    if (usable >= Math.min(len, need)) { best = cand; break; }
  }
  // Weich herausfahren, sofort heranfahren
  const wantDist = best.len * Math.min(1, Math.max(0, best.free - 0.002));
  cam.lift += (best.up - cam.lift) * Math.min(1, dt * 5);
  cam.dist = wantDist < cam.dist ? wantDist : cam.dist + (wantDist - cam.dist) * Math.min(1, dt * 3);
  const aim = (lift) => {
    const ex = best.ex, ey = best.ey - best.up + lift, ez = best.ez, full = Math.hypot(ex - px, ey - pivotY, ez - pz) || 1;
    return { ex, ey, ez, full, free: Math.max(0, clearFraction(world, px, pivotY, pz, ex, ey, ez, pad) - 0.002) };
  };
  let v = aim(cam.lift);
  // Ist der weiche Zwischenweg verbaut, sofort auf die freie Höhe springen
  if (v.full * v.free < Math.min(cam.dist, wantDist) - 0.3) { cam.lift = best.up; v = aim(cam.lift); }
  const { ex, ey, ez, full } = v;
  const k = Math.min(cam.dist / full, v.free, 1);
  cam.clipped = k < 0.98;
  cam.pos = [px + (ex - px) * k, pivotY + (ey - pivotY) * k, pz + (ez - pz) * k];
  const near = Math.min(1, (full * k) / 3);                              // ganz nah: auf die Figur schauen statt voraus
  cam.look = [px + s * ahead * near, pivotY * 0.75 + (1 - near) * 0.2, pz + c * ahead * near];
  return cam;
}
