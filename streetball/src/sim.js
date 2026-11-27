// Spiellogik ohne Grafik und DOM (läuft auch in Node). Fester Takt, Zufall nur aus dem Startwert im Zustand.
import { emit } from './kit/realtime.js';
import { COURT, HOOP, BALL, PLAYER, SHOT, MOVES, MATCH } from './config.js';
import { cpuInput, newMind } from './cpu.js';
import { clamp, lerp, hyp, hoopDist, smooth, angleStep, angleLerp, rand, forward, sideVec } from './math.js';

export { hoopDist };
export const ACTS = ['free', 'gather', 'follow', 'layup', 'dunk', 'steal', 'recover', 'block', 'land', 'cross', 'stumble'];
export const MODES = ['drib', 'hold', 'shot', 'loose', 'net'];
const SHOOTING = ['gather', 'layup', 'dunk'];
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/* ---------- Aufbau ---------- */
function newPlayer() {
  return { x: 0, z: 6, y: 0, vx: 0, vz: 0, vy: 0, f: Math.PI, st: 1, tired: false, act: 'free', at: 0, cd: 0, scd: 0, hand: 1, hx: 1, hs: 0, drib: 0,
    ch: 0, gr: SHOT.green, done: false, sx: 0, sz: 0, tx: 0, tz: 0, sq: 0, ha: false, hb: false, ba: 0, bb: 0, three: false, mood: 0 };
}
function newBall() { return { x: 0, y: 1, z: 7, vx: 0, vy: 0, vz: 0, own: 0, mode: 'drib', by: -1, pts: 2, rim: false, board: false, live: false, kind: 'jump', perfect: false, age: 0, nograb: 0, rest: 0, loose: 0, last: 0 }; }

// Check: Ball oben am Bogen, Verteidiger davor
export function setupCheck(s, off) {
  for (let k = 0; k < 2; k++) {
    const p = s.p[k], o = k === off, st = Math.min(1, p.st + 0.45), ha = p.ha, hb = p.hb;
    Object.assign(p, newPlayer(), { x: 0, z: HOOP.z + (o ? 6.25 : 4.8), f: o ? Math.PI : 0, st, ha, hb });
  }
  Object.assign(s.ball, newBall(), { own: off, last: off });
  s.off = off; s.need = false; s.clock = MATCH.shotClock; s.phase = 'check'; s.pt = MATCH.check; s.slow = 0; s.freeze = 0; s.slowed = false;
  carryBall(s);
  emit(s, 'check', { side: off });
}

function create(seed, { level } = {}) {
  const s = { rng: (seed >>> 0) % 2147483646 + 1, airng: ((seed >>> 0) ^ 0x2f6b3a1) % 2147483646 + 1, t: 0, phase: 'check', pt: 0, off: 0, need: false,
    clock: MATCH.shotClock, time: MATCH.time, sudden: false, score: [0, 0], winner: null, final: null, next: 0, slow: 0, freeze: 0, slowed: false,
    p: [newPlayer(), newPlayer()], ball: newBall(), ai: [newMind(), newMind()], events: [], eventId: 0 };
  s.level = level === 'easy' || level === 'hard' ? level : 'normal';
  for (let i = 0; i < 4; i++) rand(s);
  setupCheck(s, rand(s) < 0.5 ? 0 : 1);
  return s;
}

/* ---------- Eingaben ---------- */
function cleanInput(i) {
  let x = clamp(num(i && i.x), -1, 1), y = clamp(num(i && i.y), -1, 1);
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  const m = i && typeof i.m === 'number' && Number.isFinite(i.m) ? clamp(i.m, -1, 1.2) : -1;
  return { x, y, a: !!(i && i.a), b: !!(i && i.b), c: !!(i && i.c), m };
}

/* ---------- Wurf ---------- */
// Wie stark der Verteidiger den Werfer bedrängt (0 = frei, 1 = Hand im Gesicht)
export function pressure(s, k) {
  const p = s.p[k], d = s.p[1 - k], dx = d.x - p.x, dz = d.z - p.z, dist = hyp(dx, dz);
  if (dist > 2.2) return 0;
  const hx = HOOP.x - p.x, hz = HOOP.z - p.z, hl = hyp(hx, hz) || 1, front = Math.max(0, (dx * hx + dz * hz) / ((dist || 1) * hl));
  let v = clamp((2.2 - dist) / 1.55, 0, 1) * (0.35 + 0.65 * front);
  if (d.act === 'block' && d.y > 0.1) v *= 1.2;
  if (d.act === 'stumble') v *= 0.3; else if (d.act === 'recover') v *= 0.65;
  return clamp(v, 0, 1);
}
// Halbe Breite der grünen Zone: Distanz, eigene Bewegung, Druck und Ausdauer
export function greenZone(s, k) {
  const p = s.p[k], d = hoopDist(p.x, p.z), speed = hyp(p.vx, p.vz);
  const far = d <= 2 ? 1 : d <= COURT.threeR ? lerp(1, 0.68, (d - 2) / (COURT.threeR - 2)) : d <= 7 ? lerp(0.68, 0.45, (d - COURT.threeR) / (7 - COURT.threeR)) : lerp(0.45, 0.2, clamp((d - 7) / 2, 0, 1));
  return Math.max(SHOT.greenMin, SHOT.green * far * (1 - 0.34 * Math.min(1, speed / 3.5)) * (1 - 0.55 * pressure(s, k)) * (0.82 + 0.18 * p.st));
}
// Ballbahn vom Abwurf zu einem Zielpunkt in Ringhöhe
export function launch(from, tx, tz, arc) {
  const top = Math.max(from.y, HOOP.y) + arc, up = Math.sqrt((2 * (top - from.y)) / BALL.g), down = Math.sqrt((2 * (top - HOOP.y)) / BALL.g), T = up + down;
  return { vx: (tx - from.x) / T, vy: BALL.g * up, vz: (tz - from.z) / T, T };
}
function fire(s, k, from, tx, tz, arc, kind, pts, perfect) {
  const b = s.ball, v = launch(from, tx, tz, arc);
  Object.assign(b, { x: from.x, y: from.y, z: from.z, vx: v.vx, vy: v.vy, vz: v.vz, own: -1, mode: 'shot', by: k, last: k, pts, rim: false, board: false, live: true, kind, perfect, age: 0, nograb: 0.3, rest: 0, loose: 0 });
  emit(s, 'release', { side: k, kind, perfect });
  tryBlock(s, 1 - k);
}
function releaseShot(s, k, charge) {
  const p = s.p[k], pr = pressure(s, k), err = Math.abs(charge - SHOT.ideal), green = p.gr;
  const dist = hoopDist(p.x, p.z), perfect = err <= green + 0.004;
  let chance;
  if (perfect) chance = (0.99 - 0.16 * pr) * (dist > 7 ? 0.75 : 1);
  else {
    const base = dist <= 2 ? 0.7 : dist <= COURT.threeR ? lerp(0.7, 0.45, (dist - 2) / (COURT.threeR - 2)) : lerp(0.45, 0.2, clamp((dist - COURT.threeR) / 2.5, 0, 1));
    chance = base * Math.max(0, 1 - (err - green) / 0.2) * (1 - 0.55 * pr);
  }
  const [fx, fz] = forward(p.f), from = { x: p.x + fx * 0.22, y: PLAYER.reach + 0.05 + p.y, z: Math.max(HOOP.boardZ + 0.2, p.z + fz * 0.22) };
  let dx = HOOP.x - from.x, dz = HOOP.z - from.z; const l = hyp(dx, dz) || 1; dx /= l; dz /= l;
  let tx = HOOP.x, tz = HOOP.z;
  const make = rand(s) < chance;
  if (make) { tx += (rand(s) - 0.5) * 0.06; tz += (rand(s) - 0.5) * 0.06; }
  else if (err > 0.27) { const o = charge < SHOT.ideal ? -(0.5 + rand(s) * 0.3) : 0.4 + rand(s) * 0.2; const side = (rand(s) - 0.5) * 0.35; tx += dx * o - dz * side; tz += dz * o + dx * side; }
  else { const along = (charge < SHOT.ideal ? -1 : 1) * (0.5 + rand(s) * 0.5), side = (rand(s) - 0.5) * 1.5, n = hyp(along, side), o = 0.235 + rand(s) * 0.1; tx += ((dx * along - dz * side) / n) * o; tz += ((dz * along + dx * side) / n) * o; }
  p.act = 'follow'; p.at = 0; p.done = true; p.ch = charge;
  emit(s, 'shot', { side: k, pts: p.three ? 3 : 2, perfect });
  fire(s, k, from, tx, tz, clamp(0.75 + dist * 0.16, 0.85, 1.9), 'jump', p.three ? 3 : 2, perfect);
}
function startShot(s, k) {
  const p = s.p[k], dist = hoopDist(p.x, p.z);
  const dx = HOOP.x - p.x, dz = HOOP.z - p.z, l = hyp(dx, dz) || 1, toward = (p.vx * dx + p.vz * dz) / l;
  p.three = dist >= COURT.threeR; p.done = false; p.at = 0; p.ch = 0; p.sx = p.x; p.sz = p.z;
  const close = dist < 2.0 || (dist < MOVES.layupRange && toward > 1.2) || (dist < MOVES.dunkRange && toward > MOVES.dunkSpeed);
  if (close) {
    const dunk = dist < MOVES.dunkRange && dist > 0.8 && toward > MOVES.dunkSpeed && p.st > 0.2 && pressure(s, k) < 0.6;
    p.act = dunk ? 'dunk' : 'layup';
    // Absprungziel knapp vor dem Ring, auf der Seite, von der man kommt
    let ux = -dx / l, uz = -dz / l; if (uz < 0.15) { uz = 0.15; const n = hyp(ux, uz); ux /= n; uz /= n; }
    const gap = dunk ? 0.42 : 0.72;
    p.tx = HOOP.x + ux * gap; p.tz = HOOP.z + uz * gap;
    if (dunk) p.st = Math.max(0, p.st - 0.15);
    p.vy = 0; s.ball.mode = 'hold';
    emit(s, 'jump', { side: k, kind: p.act });
    return;
  }
  p.act = 'gather'; s.ball.mode = 'hold'; p.gr = greenZone(s, k);
}
function layupRelease(s, k) {
  const p = s.p[k], pr = pressure(s, k), make = rand(s) < 0.95 - 0.5 * pr;
  const dx = HOOP.x - p.x, dz = HOOP.z - p.z, l = hyp(dx, dz) || 1, out = Math.max(0.6, l);
  const from = { x: HOOP.x - (dx / l) * out, y: 2.38 + p.y, z: Math.max(HOOP.boardZ + 0.2, HOOP.z - (dz / l) * out) };
  let tx = HOOP.x + (rand(s) - 0.5) * 0.05, tz = HOOP.z + (rand(s) - 0.5) * 0.05;
  if (!make) { const a = rand(s) * Math.PI * 2; tx = HOOP.x + Math.cos(a) * 0.27; tz = HOOP.z + Math.abs(Math.sin(a)) * 0.27; }
  p.done = true; emit(s, 'shot', { side: k, pts: p.three ? 3 : 2, kind: 'layup' });
  fire(s, k, from, tx, tz, Math.max(0.5, HOOP.y + 0.55 - Math.max(HOOP.y, from.y)), 'layup', p.three ? 3 : 2, false);
}
function dunkSlam(s, k) {
  const p = s.p[k], b = s.ball, make = rand(s) < 0.98 - 0.35 * pressure(s, k);
  p.done = true;
  Object.assign(b, { own: -1, mode: 'shot', by: k, last: k, pts: p.three ? 3 : 2, rim: !make, board: false, live: true, kind: 'dunk', perfect: false, age: 0, nograb: 0.35, rest: 0, loose: 0 });
  if (make) Object.assign(b, { x: HOOP.x, y: HOOP.y + 0.16, z: HOOP.z, vx: 0, vy: -5.5, vz: 0 });
  else { const dx = p.x - HOOP.x, dz = p.z - HOOP.z, l = hyp(dx, dz) || 1; Object.assign(b, { x: HOOP.x + (dx / l) * 0.3, y: HOOP.y + 0.2, z: HOOP.z + (dz / l) * 0.3, vx: (dx / l) * 3 + (rand(s) - 0.5) * 2, vy: 2.6, vz: Math.abs(dz / l) * 3 + 0.8, mode: 'loose' }); emit(s, 'rim', { v: 5 }); }
  s.freeze = 0.07;
  emit(s, 'dunk', { side: k, perfect: make });
}

/* ---------- Verteidigung ---------- */
function stumble(s, k, t) { const p = s.p[k]; p.act = 'stumble'; p.at = MOVES.stumble - (t || MOVES.stumble); p.vx *= 0.3; p.vz *= 0.3; }
// Block: nur in der Luft, nur am Ball, nur bei einem Wurf auf dem Weg nach oben bzw. beim Dunk vor dem Stopfen
function tryBlock(s, k) {
  const d = s.p[k], b = s.ball;
  if (d.act !== 'block' || d.y < 0.16 || d.done === false || d.vy < -0.6) return false;        // schon im Fallen: verpasst
  const o = 1 - k, a = s.p[o];
  const dunking = b.own === o && a.act === 'dunk' && !a.done && a.at > 0.14;
  const flying = b.mode === 'shot' && b.by === o && b.live && b.age < 0.42 && b.vy > -0.6 && !b.rim && b.kind !== 'dunk';
  if (!dunking && !flying) return false;
  const [fx, fz] = forward(d.f), hx = d.x + fx * 0.28, hz = d.z + fz * 0.28, hy = PLAYER.reach + d.y;
  const near = hyp(b.x - hx, b.z - hz);
  if (near > (dunking ? 0.8 : 0.56) || b.y - hy > (dunking ? 0.28 : 0.14) || hy - b.y > (dunking ? 0.8 : 0.55)) return false;
  let ax = b.x - HOOP.x, az = b.z - HOOP.z; const l = hyp(ax, az) || 1; ax /= l; az /= l;
  Object.assign(b, { own: -1, mode: 'loose', live: false, last: k, nograb: 0.28, rest: 0, loose: 0, vx: ax * 2.6 + (rand(s) - 0.5) * 3.4, vz: Math.max(-0.5, az * 2.6) + rand(s) * 1.2, vy: dunking ? 1.2 : 2.2 });
  if (dunking) { a.done = true; stumble(s, o, 0.45); }
  s.freeze = 0.09; s.slow = 0;
  emit(s, 'block', { side: k, x: b.x, y: b.y, z: b.z });
  return true;
}
function stealCheck(s, k) {
  const p = s.p[k], b = s.ball, o = b.own;
  if (o < 0 || o === k || p.done) return;
  const a = s.p[o];
  if (hyp(a.x - p.x, a.z - p.z) > 1.9) return;
  if (a.act === 'cross' && a.at < MOVES.crossProtect) { p.done = true; stumble(s, k); emit(s, 'ankle', { side: o }); return; }
  const exposed = (b.mode === 'drib' && b.y < MOVES.stealHeight) || (a.act === 'gather' && a.ch < SHOT.fake) || (b.mode === 'drib' && Math.abs(a.hx) < 0.5 && b.y < 1.05);
  if (!exposed) return;
  const [fx, fz] = forward(p.f), rx = p.x + fx * MOVES.stealReach, rz = p.z + fz * MOVES.stealReach;
  if (hyp(b.x - rx, b.z - rz) > MOVES.stealRadius) return;
  if (hyp(b.x - p.x, b.z - p.z) > hyp(a.x - p.x, a.z - p.z) + 0.14) return;            // Körper schirmt den Ball ab
  p.done = true; a.act = 'recover'; a.at = -0.12; a.ch = 0;
  s.freeze = 0.07;
  emit(s, 'steal', { side: k, x: b.x, y: b.y, z: b.z });
  p.act = 'land'; p.at = 0; p.ba = 0; p.bb = 0;
  give(s, k, 'steal');
}

/* ---------- Ballbesitz ---------- */
function violation(s, side) { if (s.phase !== 'live') return; s.phase = 'dead'; s.pt = MATCH.dead; s.next = 1 - side; emit(s, 'violation', { side }); }
function give(s, k, how) {
  const b = s.ball, p = s.p[k], changed = s.off !== k;
  if (!changed && s.clock <= 0 && !b.rim) return violation(s, k);
  const rim = b.rim;
  Object.assign(b, { own: k, mode: p.y > 0.05 ? 'hold' : 'drib', live: false, by: -1, vx: 0, vy: 0, vz: 0, rest: 0, loose: 0, last: k, rim: false, board: false });
  p.drib = 0; p.hs = 0;
  if (changed) { s.off = k; s.need = hoopDist(p.x, p.z) < COURT.threeR; s.clock = MATCH.shotClock; s.slowed = false; emit(s, 'turnover', { side: k, kind: how }); }
  else { if (rim) s.clock = MATCH.shotClock; emit(s, 'rebound', { side: k }); }
}

/* ---------- Spieler ---------- */
function startCross(s, k, inp) {
  const p = s.p[k], d = s.p[1 - k];
  let hx = HOOP.x - p.x, hz = HOOP.z - p.z; const l = hyp(hx, hz) || 1; hx /= l; hz /= l;
  const rx = -hz, rz = hx, mag = hyp(inp.x, inp.y);
  const fwd = mag > 0.3 ? (inp.x * hx + inp.y * hz) / mag : 0, lat = mag > 0.3 ? (inp.x * rx + inp.y * rz) / mag : 0;
  let dx, dz;
  if (fwd < -0.75) { dx = -hx; dz = -hz; }                                             // Schritt zurück
  else {
    let side = Math.abs(lat) > 0.15 ? Math.sign(lat) : -Math.sign((d.x - p.x) * rx + (d.z - p.z) * rz) || (p.hand > 0 ? 1 : -1);
    dx = rx * side + hx * Math.max(0, fwd) * 0.75; dz = rz * side + hz * Math.max(0, fwd) * 0.75;
    const n = hyp(dx, dz) || 1; dx /= n; dz /= n;
  }
  const [vx, vz] = sideVec(p.f), w = dx * vx + dz * vz;
  p.hand = Math.abs(w) > 0.1 ? Math.sign(w) : -p.hand; p.hs = 0;
  p.act = 'cross'; p.at = 0; p.sx = dx; p.sz = dz; p.cd = MOVES.crossCooldown; p.drib = 0.1; p.st = Math.max(0, p.st - 0.08);
  emit(s, 'cross', { side: k });
  // Wer in die falsche Richtung unterwegs ist, bleibt stehen
  if (hyp(d.x - p.x, d.z - p.z) < 2.2 && d.y < 0.05 && d.act !== 'stumble' && d.vx * dx + d.vz * dz < -1.3) { stumble(s, 1 - k); emit(s, 'ankle', { side: k }); }
}

function moveToward(p, tx, tz, dt) {
  const dvx = tx - p.vx, dvz = tz - p.vz, dv = hyp(dvx, dvz);
  if (dv < 1e-6) return;
  const speed = hyp(p.vx, p.vz), want = hyp(tx, tz);
  const braking = want < speed - 0.05 || p.vx * tx + p.vz * tz < 0;
  const max = (braking ? PLAYER.brake : PLAYER.accel) * dt, f = Math.min(1, max / dv);
  p.vx += dvx * f; p.vz += dvz * f;
}

function updatePlayer(s, k, inp, dt) {
  const p = s.p[k], o = s.p[1 - k], b = s.ball;
  let has = b.own === k;
  p.at += dt; p.cd = Math.max(0, p.cd - dt); p.scd = Math.max(0, p.scd - dt); p.sq = Math.max(0, p.sq - dt);
  // Aktionen aus dem Eingabepuffer
  if (p.act === 'free' && p.y <= 0.001) {
    if (p.ba > 0) {
      if (has) { p.ba = 0; if (s.need) emit(s, 'needclear', { side: k }); else startShot(s, k); }
      else { p.ba = 0; p.act = 'block'; p.at = 0; p.done = false; }
    } else if (p.bb > 0) {
      if (has) { if (p.cd <= 0) { p.bb = 0; startCross(s, k, inp); } }
      else if (p.scd <= 0) { p.bb = 0; p.act = 'steal'; p.at = 0; p.done = false; p.scd = MOVES.stealCooldown;
        const tx = b.own >= 0 ? b.x : o.x, tz = b.own >= 0 ? b.z : o.z, dx = tx - p.x, dz = tz - p.z, l = hyp(dx, dz) || 1;
        if (l < 2) { p.f = Math.atan2(dx, dz); p.vx = p.vx * 0.35 + (dx / l) * Math.min(2.2, l * 1.6); p.vz = p.vz * 0.35 + (dz / l) * Math.min(2.2, l * 1.6); }
        emit(s, 'reach', { side: k });
      }
    }
  }
  has = b.own === k;
  const mag = hyp(inp.x, inp.y);
  const sprinting = inp.c && !p.tired && p.st > 0 && mag > 0.35 && p.act === 'free';
  if (sprinting) { p.st = Math.max(0, p.st - PLAYER.drain * dt); if (p.st <= 0) p.tired = true; }
  else p.st = Math.min(1, p.st + (mag < 0.2 ? PLAYER.regenStill : PLAYER.regen) * dt);
  if (p.tired && p.st >= PLAYER.tired) p.tired = false;
  let top = (sprinting ? PLAYER.sprint : PLAYER.speed) * (has ? PLAYER.ballFactor : 1);
  if (p.tired) top *= 0.86;

  const scripted = p.act === 'layup' || p.act === 'dunk';
  if (!scripted) {
    let factor = 1;
    if (p.act === 'gather') factor = PLAYER.gatherSpeed; else if (p.act === 'recover') factor = 0.28; else if (p.act === 'stumble') factor = 0.08;
    else if (p.act === 'block') factor = 0.35; else if (p.act === 'land') factor = 0.6; else if (p.act === 'follow') factor = 0.4;
    if (p.act === 'cross') {
      const v = MOVES.crossSpeed * (1 - 0.55 * clamp(p.at / MOVES.crossTime, 0, 1));
      moveToward(p, p.sx * v, p.sz * v, dt * 2.2);
    } else if (p.act === 'steal') { const f = Math.exp(-5 * dt); p.vx *= f; p.vz *= f; }
    else if (p.y > 0.02) {                                                             // in der Luft: Schwung bleibt, kaum Steuerung
      const f = Math.exp(-0.9 * dt); p.vx = p.vx * f + inp.x * 2.2 * dt; p.vz = p.vz * f + inp.y * 2.2 * dt;
    } else {
      const speed = hyp(p.vx, p.vz), tx = inp.x * top * factor, tz = inp.y * top * factor;
      if (speed > 3.1 && p.sq <= 0 && (mag < 0.2 || (p.vx * tx + p.vz * tz) / (speed * (hyp(tx, tz) || 1)) < 0.35)) { p.sq = 0.7; emit(s, 'squeak', { side: k }); }
      moveToward(p, tx, tz, dt);
    }
    p.x += p.vx * dt; p.z += p.vz * dt;
    // senkrecht
    if (p.y > 0 || p.vy > 0) {
      p.vy -= BALL.g * dt; p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; emit(s, 'land', { side: k }); if (p.act === 'block' || p.act === 'follow') { p.act = 'land'; p.at = 0; } if (b.own === k && b.mode === 'hold' && p.act !== 'gather') { b.mode = 'drib'; p.drib = 0; } }
    }
  } else {
    const dunk = p.act === 'dunk', T = dunk ? MOVES.dunkTime : MOVES.layupTime, ox = p.x, oz = p.z;
    const u = smooth(0, dunk ? MOVES.dunkSlam : T * 0.8, p.at);
    p.x = lerp(p.sx, p.tx, u); p.z = lerp(p.sz, p.tz, u);
    p.vx = (p.x - ox) / dt; p.vz = (p.z - oz) / dt;
    if (dunk) p.y = p.at < MOVES.dunkSlam ? 1.12 * Math.sin((Math.PI / 2) * clamp(p.at / MOVES.dunkSlam, 0, 1)) : 1.12 * (1 - smooth(MOVES.dunkSlam + 0.18, T, p.at));
    else p.y = 0.78 * Math.sin(Math.PI * clamp(p.at / T, 0, 1));
    if (dunk) {
      if (!s.slowed && p.at > 0.24 && !p.done) { s.slow = 0.55; s.slowed = true; }
      if (!p.done && b.own === k && p.at >= MOVES.dunkSlam) dunkSlam(s, k);
    } else if (!p.done && b.own === k && p.at >= MOVES.layupRelease) layupRelease(s, k);
    if (p.at >= T) { p.y = 0; p.vy = 0; p.vx *= 0.15; p.vz *= 0.15; p.act = 'land'; p.at = 0; emit(s, 'land', { side: k }); if (b.own === k) b.mode = 'drib'; }
  }
  // Grenzen
  const mx = COURT.halfW, ox = p.x, oz = p.z;
  p.x = clamp(p.x, -mx, mx); p.z = clamp(p.z, COURT.minZ, COURT.maxZ);
  if (Math.abs(p.x) < 1.05 && p.z < HOOP.boardZ + 0.25) p.z = HOOP.boardZ + 0.25;           // nicht hinter das Brett
  if (p.x !== ox) p.vx = 0; if (p.z !== oz) p.vz = 0;

  // Zustandswechsel
  if (p.act === 'gather') {
    if (b.own !== k) { p.act = 'land'; p.at = 0; }
    else {
      p.ch = Math.min(1, p.at / SHOT.full);
      p.gr += (greenZone(s, k) - p.gr) * Math.min(1, dt * 14);
      if (!inp.a) {
        const seen = inp.m >= 0 && Math.abs(inp.m - p.ch) < 0.3 ? inp.m : p.ch;              // online: der Wert, den der Gast gesehen hat
        if (seen < SHOT.fake) { p.act = 'land'; p.at = 0; if (p.y <= 0.001) b.mode = 'drib'; emit(s, 'fake', { side: k }); }
        else releaseShot(s, k, seen);
      } else if (p.ch >= 1) releaseShot(s, k, 1);
      else if (p.ch >= SHOT.fake + 0.02 && !p.done) { p.done = true; p.vy = PLAYER.shotJumpV; emit(s, 'jump', { side: k, kind: 'shot' }); }
    }
  } else if (p.act === 'follow') { if (p.y <= 0 && p.at > 0.3) { p.act = 'free'; p.at = 0; } }
  else if (p.act === 'cross') { if (p.at >= MOVES.crossTime) { p.act = 'free'; p.at = 0; } }
  else if (p.act === 'steal') {
    if (p.at >= MOVES.stealFrom && p.at <= MOVES.stealTo) stealCheck(s, k);
    if (p.act === 'steal' && p.at >= MOVES.stealTime) { if (!p.done) emit(s, 'stealmiss', { side: k }); p.act = p.done ? 'free' : 'recover'; p.at = 0; }
  } else if (p.act === 'recover') { if (p.at >= MOVES.stealRecover) { p.act = 'free'; p.at = 0; } }
  else if (p.act === 'block') {
    if (!p.done && p.at >= MOVES.blockWindup) { p.done = true; p.vy = PLAYER.jumpV; p.y = 0.001; emit(s, 'jump', { side: k, kind: 'block' }); }
  } else if (p.act === 'land') { if (p.at >= 0.14) { p.act = 'free'; p.at = 0; if (b.own === k && p.y <= 0.001) b.mode = 'drib'; } }
  else if (p.act === 'stumble') { if (p.at >= MOVES.stumble) { p.act = 'free'; p.at = 0; } }

  // Blickrichtung
  has = b.own === k;
  const speed = hyp(p.vx, p.vz);
  let look = null;
  if (p.act === 'gather' || p.act === 'follow' || p.act === 'layup' || p.act === 'dunk') look = Math.atan2(HOOP.x - p.x, HOOP.z - p.z);
  else if (p.act === 'stumble' || p.act === 'steal') look = null;
  else if (has) look = speed > 1.2 && p.act !== 'cross' ? Math.atan2(p.vx, p.vz) : Math.atan2(HOOP.x - p.x, HOOP.z - p.z);
  else {
    const tx = b.own >= 0 ? o.x : b.x, tz = b.own >= 0 ? o.z : b.z, d = hyp(tx - p.x, tz - p.z);
    look = d < 3.4 || speed < 1 ? Math.atan2(tx - p.x, tz - p.z) : Math.atan2(p.vx, p.vz);
  }
  if (look !== null) p.f = angleStep(p.f, look, PLAYER.turn * dt);

  // Dribbling: Ball auf die Seite weg vom Gegner, mit kurzer Verzögerung
  if (has && b.mode === 'drib') {
    const [vx, vz] = sideVec(p.f), w = (o.x - p.x) * vx + (o.z - p.z) * vz;
    if (p.act === 'free' && hyp(o.x - p.x, o.z - p.z) < 2.2 && Math.abs(w) > 0.3 && Math.sign(w) === p.hand) { p.hs += dt; if (p.hs > 0.34) { p.hand = -p.hand; p.hs = 0; } } else p.hs = 0;
    const period = p.act === 'cross' ? 0.36 : 0.62 - 0.16 * Math.min(1, speed / PLAYER.sprint), before = p.drib;
    p.drib = (p.drib + dt / period) % 1;
    if (before < 0.5 && p.drib >= 0.5) emit(s, 'bounce', { side: k });
  }
  p.hx += clamp(p.hand - p.hx, -dt * (p.act === 'cross' ? 8 : 5), dt * (p.act === 'cross' ? 8 : 5));
}

// Körper stoßen sich ab: Wer steht, hält seinen Platz (Ausboxen)
function collide(s) {
  const a = s.p[0], b = s.p[1];
  if (Math.abs(a.y - b.y) > 0.75) return;
  let dx = b.x - a.x, dz = b.z - a.z, d = hyp(dx, dz); const min = PLAYER.radius * 2;
  if (d >= min) return;
  if (d < 1e-4) { dx = 0; dz = 1; d = 1e-4; }
  const nx = dx / (d || 1), nz = dz / (d || 1), over = min - Math.min(d, min);
  const fixed = (p) => p.act === 'layup' || p.act === 'dunk';
  const mass = (p) => (fixed(p) ? 50 : 1 + 1.8 * Math.max(0, 1 - hyp(p.vx, p.vz) / 1.8) - (p.act === 'cross' ? 0.5 : 0) - (p.act === 'stumble' ? 0.4 : 0));
  const ma = mass(a), mb = mass(b), sa = mb / (ma + mb), sb = ma / (ma + mb);
  a.x -= nx * over * sa; a.z -= nz * over * sa; b.x += nx * over * sb; b.z += nz * over * sb;
  const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  if (rel < 0) { if (!fixed(a)) { a.vx += nx * rel * sa; a.vz += nz * rel * sa; } if (!fixed(b)) { b.vx -= nx * rel * sb; b.vz -= nz * rel * sb; } }
  for (const p of [a, b]) { p.x = clamp(p.x, -COURT.halfW, COURT.halfW); p.z = clamp(p.z, COURT.minZ, COURT.maxZ); }
}

/* ---------- Ball ---------- */
export function carryBall(s) {
  const b = s.ball; if (b.own < 0) return;
  const p = s.p[b.own], [fx, fz] = forward(p.f), [vx, vz] = sideVec(p.f), ox = b.x, oy = b.y, oz = b.z;
  if (p.act === 'gather') { const u = smooth(0, 0.32, p.ch); b.x = p.x + fx * 0.3 + vx * 0.12 * (1 - u); b.z = p.z + fz * 0.3 + vz * 0.12 * (1 - u); b.y = lerp(0.95, PLAYER.reach + 0.02, u) + p.y; }
  else if (p.act === 'layup' || p.act === 'dunk') { const u = smooth(0, 0.28, p.at); b.x = p.x + fx * 0.3; b.z = p.z + fz * 0.3; b.y = lerp(1.1, PLAYER.reach + (p.act === 'dunk' ? 0.12 : 0.05), u) + p.y; }
  else if (b.mode === 'hold') { b.x = p.x + fx * 0.34; b.z = p.z + fz * 0.34; b.y = 1.3 + p.y; }
  else {
    const h = Math.pow(Math.abs(Math.cos(Math.PI * p.drib)), 0.65), top = p.act === 'cross' ? 0.68 : 1.06;
    const side = p.hx * 0.45, front = p.act === 'cross' ? 0.5 : 0.28 + 0.2 * (1 - Math.abs(p.hx));
    b.x = p.x + vx * side + fx * front; b.z = p.z + vz * side + fz * front; b.y = BALL.r + (top - BALL.r) * h;
  }
  b.vx = clamp((b.x - ox) * 60, -9, 9); b.vy = clamp((b.y - oy) * 60, -9, 9); b.vz = clamp((b.z - oz) * 60, -9, 9);
}

function bounceOff(b, nx, ny, nz, e) {
  const dot = b.vx * nx + b.vy * ny + b.vz * nz;
  if (dot >= 0) return 0;
  b.vx -= (1 + e) * dot * nx; b.vy -= (1 + e) * dot * ny; b.vz -= (1 + e) * dot * nz;
  return -dot;
}
// Ein Rechenschritt der freien Ballbahn, in Teilschritten geprüft (Ring, Brett, Korb, Boden, Käfig)
export function ballFlight(s, dt) {
  const b = s.ball, n = BALL.sub, h = dt / n, R = BALL.r;
  for (let i = 0; i < n; i++) {
    const px = b.x, py = b.y, pz = b.z;
    b.vy -= BALL.g * h; b.x += b.vx * h; b.y += (b.vy + BALL.g * h * 0.5) * h; b.z += b.vz * h;
    // Brett (Quader), auch beim Durchqueren der Ebene
    const zf = HOOP.boardZ, zb = zf - 0.05;
    if (pz - R >= zf && b.z - R < zf) {
      const u = (pz - R - zf) / Math.max(1e-9, pz - b.z), cx = lerp(px, b.x, u), cy = lerp(py, b.y, u);
      if (Math.abs(cx) <= HOOP.boardHalfW && cy >= HOOP.boardY0 && cy <= HOOP.boardY1) { b.z = zf + R; const v = bounceOff(b, 0, 0, 1, BALL.boardBounce); if (v > 0.6) { b.board = true; emit(s, 'board', { v: Math.round(v) }); } }
    }
    const qx = clamp(b.x, -HOOP.boardHalfW, HOOP.boardHalfW), qy = clamp(b.y, HOOP.boardY0, HOOP.boardY1), qz = clamp(b.z, zb, zf);
    let dx = b.x - qx, dy = b.y - qy, dz = b.z - qz, d = Math.hypot(dx, dy, dz);
    if (d < R && d > 1e-6) { dx /= d; dy /= d; dz /= d; b.x = qx + dx * R; b.y = qy + dy * R; b.z = qz + dz * R; const v = bounceOff(b, dx, dy, dz, BALL.boardBounce); if (v > 0.6) { b.board = true; emit(s, 'board', { v: Math.round(v) }); } }
    // Ring (Wulst um die Korbmitte)
    const rx = b.x - HOOP.x, rz = b.z - HOOP.z, rl = hyp(rx, rz);
    if (rl > 1e-6 && Math.abs(b.y - HOOP.y) < R + HOOP.tube) {
      const cx = HOOP.x + (rx / rl) * HOOP.r, cz = HOOP.z + (rz / rl) * HOOP.r;
      let ex = b.x - cx, ey = b.y - HOOP.y, ez = b.z - cz, e = Math.hypot(ex, ey, ez);
      const min = R + HOOP.tube;
      if (e < min && e > 1e-6) {
        ex /= e; ey /= e; ez /= e; b.x = cx + ex * min; b.y = HOOP.y + ey * min; b.z = cz + ez * min;
        const v = bounceOff(b, ex, ey, ez, BALL.rimBounce);
        if (v > 0.35) { b.rim = true; b.vx *= 0.94; b.vz *= 0.94; emit(s, 'rim', { v: Math.round(v) }); }
      }
    }
    // Korb: Ringebene von oben durchquert
    if (py >= HOOP.y && b.y < HOOP.y && b.vy < 0) {
      const u = (py - HOOP.y) / Math.max(1e-9, py - b.y), cx = lerp(px, b.x, u), cz = lerp(pz, b.z, u);
      if (b.live && hyp(cx - HOOP.x, cz - HOOP.z) < HOOP.r - 0.045) scoreBasket(s);
    }
    // Netz bremst und zentriert
    if (b.mode === 'net' && b.y < HOOP.y && b.y > HOOP.y - 0.5) { b.vx += (HOOP.x - b.x) * 60 * h; b.vz += (HOOP.z - b.z) * 60 * h; b.vx *= 1 - 6 * h; b.vz *= 1 - 6 * h; if (b.vy < -2.4) b.vy = -2.4; }
    if (b.y < R) {
      b.y = R; const v = -b.vy;
      if (v > 0.7) { b.vy = v * BALL.floorBounce; b.vx *= 0.84; b.vz *= 0.84; if (v > 1.6) emit(s, 'floor', { v: Math.round(v) }); } else { b.vy = 0; b.vx *= 1 - 1.6 * h; b.vz *= 1 - 1.6 * h; }
      if (b.mode === 'shot') { b.mode = 'loose'; b.live = false; }
    }
    if (Math.abs(b.x) > COURT.wallX - R) { b.x = Math.sign(b.x) * (COURT.wallX - R); b.vx = -b.vx * 0.55; }
    if (b.z < COURT.wallZ0 + R) { b.z = COURT.wallZ0 + R; b.vz = Math.abs(b.vz) * 0.55; }
    if (b.z > COURT.wallZ1 - R) { b.z = COURT.wallZ1 - R; b.vz = -Math.abs(b.vz) * 0.55; }
  }
}
function scoreBasket(s) {
  const b = s.ball, k = b.by;
  if (k < 0 || s.phase !== 'live') return;
  const buzzer = s.clock <= 0 || s.time <= 0, kind = b.kind === 'jump' ? (!b.rim && !b.board ? 'swish' : 'jump') : b.kind;
  s.score[k] += b.pts; b.live = false; b.mode = 'net';
  if (b.kind !== 'dunk') { b.vx *= 0.25; b.vz *= 0.25; b.vy *= 0.5; } else b.vy = -3;
  emit(s, 'net', {});
  emit(s, 'score', { side: k, pts: b.pts, kind, perfect: b.perfect, buzzer });
  s.phase = 'dead'; s.next = 1 - k;
  if (s.score[k] >= MATCH.target || s.sudden) { s.final = k; s.pt = MATCH.finalDead; } else if (s.time <= 0) { timeUp(s); } else s.pt = MATCH.dead;
}
function timeUp(s) {
  s.phase = 'dead'; s.pt = MATCH.finalDead;
  if (s.score[0] !== s.score[1]) { s.final = s.score[0] > s.score[1] ? 0 : 1; emit(s, 'timeup', {}); }
  else if (!s.sudden) { s.sudden = true; s.time = MATCH.sudden; s.next = rand(s) < 0.5 ? 0 : 1; emit(s, 'sudden', {}); }
  else { s.final = -1; emit(s, 'timeup', {}); }
}

function looseBall(s, dt) {
  const b = s.ball;
  b.age += dt; b.nograb = Math.max(0, b.nograb - dt);
  ballFlight(s, dt);
  if (s.phase !== 'live') return;
  if (b.mode === 'shot' && b.vy < 0 && b.y < HOOP.y - 0.35) { b.mode = 'loose'; b.live = false; }
  if (b.mode !== 'shot') {
    b.loose += dt;
    const still = Math.hypot(b.vx, b.vy, b.vz) < 0.35;
    b.rest = still && b.y > 1.8 ? b.rest + dt : 0;
    if (b.rest > 0.6) { b.vz = 1.6; b.vx = b.x >= 0 ? 0.9 : -0.9; b.vy = 1; b.rest = 0; }
  }
  // Buzzer-Zeitlupe: letzter Wurf kurz vor dem Korb
  if (b.mode === 'shot' && !s.slowed && (s.clock <= 0.05 || s.time <= 0.05) && b.vy < 0 && b.y < HOOP.y + 0.9 && hoopDist(b.x, b.z) < 1.3) { s.slow = 0.7; s.slowed = true; emit(s, 'buzzer', {}); }
  if (b.nograb > 0 || b.mode === 'net') return;
  // Wer kommt an den Ball? Ein Wurf darf erst nach Ringberührung oder tief unten gefangen werden
  if (b.mode === 'shot' && !((b.rim || b.board) && b.vy < 0.5 && b.age > 0.35 && (b.y < HOOP.y - 0.12 || hoopDist(b.x, b.z) > 0.6))) return;
  let best = -1, score = 9;
  for (let k = 0; k < 2; k++) {
    const p = s.p[k];
    if (p.act === 'stumble' || p.act === 'recover' || p.act === 'layup' || p.act === 'dunk') continue;
    const air = p.y > 0.12, d = hyp(b.x - p.x, b.z - p.z);
    const top = air ? PLAYER.reach + 0.18 + p.y : 1.75;
    if (d > (air ? 0.78 : 0.68) || b.y > top) continue;
    const q = d - (air && b.y > 1.6 ? 0.35 : 0) + rand(s) * 0.08;
    if (q < score) { score = q; best = k; }
  }
  if (best >= 0) give(s, best, 'rebound');
}

/* ---------- Takt ---------- */
function step(s, inputs, dt) {
  if (s.winner !== null) return;
  const inp = [cleanInput(inputs && inputs[0]), cleanInput(inputs && inputs[1])];
  for (let k = 0; k < 2; k++) {                                    // Flanken zuerst, damit kein Tippen verloren geht
    const p = s.p[k];
    if (inp[k].a && !p.ha) p.ba = PLAYER.buffer;
    if (inp[k].b && !p.hb) p.bb = PLAYER.buffer;
    p.ha = inp[k].a; p.hb = inp[k].b;
  }
  if (s.freeze > 0) { s.freeze -= dt; return; }
  s.t += dt;
  if (s.slow > 0) { s.slow = Math.max(0, s.slow - dt); dt *= 0.38; }

  if (s.phase === 'check') {
    s.pt -= dt;
    const p = s.p[s.off], before = p.drib; p.drib = (p.drib + dt / 0.7) % 1; if (before < 0.5 && p.drib >= 0.5) emit(s, 'bounce', { side: s.off });
    carryBall(s);
    if (s.pt <= 0) { s.phase = 'live'; s.pt = 0; for (const q of s.p) { q.ba = 0; q.bb = 0; } }
  } else if (s.phase === 'dead') {
    s.pt -= dt;
    const calm = cleanInput({});
    for (let k = 0; k < 2; k++) {
      const p = s.p[k], scorer = s.final !== null ? s.final : 1 - s.next;
      p.mood = s.final === -1 ? 0 : k === scorer ? 1 : -1;
      if (p.act === 'gather' || p.act === 'steal' || p.act === 'cross') { p.act = 'land'; p.at = 0; }
      p.ba = 0; p.bb = 0; updatePlayer(s, k, calm, dt);
    }
    collide(s);
    if (s.ball.own >= 0) carryBall(s); else ballFlight(s, dt);
    if (s.pt <= 0) {
      if (s.final !== null) { s.winner = s.final; emit(s, 'end', { side: s.final }); }
      else setupCheck(s, s.next);
    }
  } else {
    s.pt += dt;
    for (let k = 0; k < 2; k++) updatePlayer(s, k, inp[k], dt);
    collide(s);
    if (s.ball.own >= 0) carryBall(s);
    for (let k = 0; k < 2; k++) tryBlock(s, k);
    if (s.ball.own < 0) looseBall(s, dt);
    if (s.phase !== 'live') return;
    // Befreien hinter der Dreierlinie
    if (s.need && s.ball.own >= 0) { const p = s.p[s.ball.own]; if (hoopDist(p.x, p.z) >= COURT.threeR + 0.08) { s.need = false; emit(s, 'clear', { side: s.ball.own }); } }
    s.clock = Math.max(0, s.clock - dt); s.time = Math.max(0, s.time - dt);
    const b = s.ball, owner = b.own >= 0 ? s.p[b.own] : null, busy = owner && SHOOTING.includes(owner.act);
    if ((s.clock <= 0 || s.time <= 0) && owner && owner.act === 'gather') { releaseShot(s, b.own, owner.ch); return; }
    if (s.time <= 0) { if (b.mode !== 'shot' && !busy) timeUp(s); }
    else if (s.clock <= 0) { if (owner && !busy) violation(s, b.own); else if (!owner && b.mode !== 'shot' && !b.rim) violation(s, s.off); }
    if (s.phase === 'live' && b.own < 0 && b.loose > MATCH.looseMax) violation(s, b.last);
  }
}

/* ---------- Netz: kompakt packen und streng prüfen ---------- */
const NUM = (a, b) => (v) => (typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b ? v : undefined);
const INT = (a, b) => (v) => (Number.isInteger(v) && v >= a && v <= b ? v : undefined);
const BOOL = (v) => (typeof v === 'boolean' ? v : undefined);
const ONE = (list) => (v) => (list.includes(v) ? v : undefined);
const FAR = NUM(-60, 60), T = NUM(-5, 1000);
const PLAYER_SCHEMA = { x: FAR, z: FAR, y: NUM(-1, 6), vx: FAR, vz: FAR, vy: FAR, f: NUM(-7, 7), st: NUM(0, 1), tired: BOOL, act: ONE(ACTS), at: T, cd: T, scd: T, hand: ONE([-1, 1]), hx: NUM(-1, 1), hs: T, drib: NUM(0, 1), ch: NUM(0, 1.2), gr: NUM(0, 1), done: BOOL, sx: FAR, sz: FAR, tx: FAR, tz: FAR, sq: T, ha: BOOL, hb: BOOL, ba: T, bb: T, three: BOOL, mood: INT(-1, 1) };
const BALL_SCHEMA = { x: FAR, y: FAR, z: FAR, vx: FAR, vy: FAR, vz: FAR, own: INT(-1, 1), mode: ONE(MODES), by: INT(-1, 1), pts: ONE([2, 3]), rim: BOOL, board: BOOL, live: BOOL, kind: ONE(['jump', 'layup', 'dunk']), perfect: BOOL, age: T, nograb: T, rest: T, loose: T, last: INT(-1, 1) };
const STATE_SCHEMA = { rng: INT(0, 4294967295), t: NUM(0, 100000), phase: ONE(['check', 'live', 'dead']), pt: T, off: INT(0, 1), need: BOOL, clock: T, time: T, sudden: BOOL, winner: (v) => (v === null || (Number.isInteger(v) && v >= -1 && v <= 1) ? v : undefined), final: (v) => (v === null || (Number.isInteger(v) && v >= -1 && v <= 1) ? v : undefined), next: INT(0, 1), slow: T, freeze: T, slowed: BOOL, eventId: INT(0, 1e9) };
export const EVENTS = ['check', 'release', 'shot', 'rim', 'board', 'dunk', 'block', 'ankle', 'steal', 'violation', 'turnover', 'rebound', 'needclear', 'cross', 'reach', 'stealmiss', 'squeak', 'land', 'jump', 'fake', 'bounce', 'floor', 'net', 'score', 'timeup', 'sudden', 'buzzer', 'clear', 'end'];
const EVENT_FIELDS = { side: INT(-1, 1), pts: INT(0, 3), v: NUM(0, 99), x: FAR, y: FAR, z: FAR, perfect: BOOL, buzzer: BOOL, kind: ONE(['jump', 'swish', 'layup', 'dunk', 'shot', 'block', 'steal', 'rebound']) };
function take(src, schema) {
  if (!src || typeof src !== 'object') return null;
  const out = {};
  for (const key in schema) { const v = schema[key](src[key]); if (v === undefined) return null; out[key] = v; }
  return out;
}
const round = (o) => { const r = {}; for (const k in o) { const v = o[k]; r[k] = typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v; } return r; };
function pack(s) {
  const o = {}; for (const k in STATE_SCHEMA) o[k] = s[k];
  const r = round(o); r.score = s.score.slice(); r.p = s.p.map(round); r.ball = round(s.ball); r.events = (s.events || []).map(round);
  return r;
}
function unpack(d) {
  const s = take(d, STATE_SCHEMA);
  if (!s || !Array.isArray(d.score) || d.score.length !== 2 || !d.score.every((v) => Number.isInteger(v) && v >= 0 && v < 100)) return null;
  if (!Array.isArray(d.p) || d.p.length !== 2 || !Array.isArray(d.events) || d.events.length > 12) return null;
  s.score = d.score.slice(); s.p = d.p.map((p) => take(p, PLAYER_SCHEMA)); s.ball = take(d.ball, BALL_SCHEMA);
  if (!s.p[0] || !s.p[1] || !s.ball) return null;
  s.events = [];
  for (const e of d.events) {
    if (!e || !EVENTS.includes(e.type) || !Number.isInteger(e.id)) return null;
    const c = { id: e.id, type: e.type };
    for (const key in EVENT_FIELDS) if (e[key] !== undefined) { const v = EVENT_FIELDS[key](e[key]); if (v === undefined) return null; c[key] = v; }
    s.events.push(c);
  }
  return s;
}
function mixState(a, b, t) {
  if (!a || !b) return b || a;
  const out = Object.assign({}, b);
  out.p = b.p.map((q, k) => {
    const p = a.p[k], r = Object.assign({}, q);
    if (Math.hypot(q.x - p.x, q.z - p.z) > 1.2) return r;                              // Versetzen (Check) nicht gleiten
    for (const key of ['x', 'z', 'y', 'vx', 'vz', 'hx', 'st', 'gr']) r[key] = lerp(p[key], q[key], t);
    r.f = angleLerp(p.f, q.f, t);
    if (p.act === q.act) { r.at = lerp(p.at, q.at, t); if (q.act === 'gather') r.ch = lerp(p.ch, q.ch, t); }
    return r;
  });
  out.ball = Object.assign({}, b.ball);
  if (Math.hypot(b.ball.x - a.ball.x, b.ball.y - a.ball.y, b.ball.z - a.ball.z) < 1.6) for (const key of ['x', 'y', 'z']) out.ball[key] = lerp(a.ball[key], b.ball[key], t);
  if (a.phase === b.phase) { out.clock = lerp(a.clock, b.clock, t); out.time = lerp(a.time, b.time, t); }
  return out;
}

export const sim = {
  create, step, cleanInput, pack, unpack, lerp: mixState,
  cpu: (s, side, level, dt) => cpuInput(s, side, level, dt),
  score: (s) => s.score,
  winner: (s) => s.winner
};
