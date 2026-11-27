// Reine Spiellogik ohne Grafik. Läuft im Browser und in Node.
// Wichtig für das Online-Spiel: Hier werden nur + - * / und Math.sqrt benutzt, die in jedem Browser bitgleich rechnen.
// Ein Schuss wird vollständig vorberechnet; die Darstellung liest nur ab. Dadurch spielt die Bildrate keine Rolle.
import { FIELD, SHOT, KEEPER, MATCH, CPU, STEP } from './config.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeDive = (t) => t * t * (3 - 2 * t);              // anlaufen, strecken, ausklingen

// Zufall mit Startwert (mulberry32): gleicher Startwert, gleiche Folge
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
export function cleanShot(s) {
  s = s || {};
  return {
    aimX: clamp(num(s.aimX, 0), -SHOT.maxAimX, SHOT.maxAimX),
    aimY: clamp(num(s.aimY, 0.3), 0, SHOT.maxAimY),
    power: clamp(num(s.power, 0.5), 0, 1),
    curve: clamp(num(s.curve, 0), -1, 1)
  };
}
// Torwart-Entscheidung: x von -1 (links) bis 1 (rechts), y von 0 (flach) bis 1 (hoch), start = Absprung relativ zum Schuss
export function cleanDive(d) {
  d = d || {};
  return {
    x: clamp(num(d.x, 0), -1, 1),
    y: clamp(num(d.y, 0.35), 0, 1),
    start: clamp(num(d.start, KEEPER.onlineStart), KEEPER.earliest, 5)
  };
}

// Haltung des Torwarts zum Zeitpunkt t: Körpermitte, Füße, Hände. Die Grafik benutzt dieselben Werte wie die Trefferprüfung.
export function keeperPose(dive, t) {
  const k = clamp((t - dive.start) / KEEPER.diveTime, 0, 1), e = easeDive(k);
  const tx = dive.x * KEEPER.reachX, ty = lerp(KEEPER.minY, KEEPER.maxY, dive.y);
  const stand = { x: 0, y: 1.0 };
  const cx = lerp(stand.x, tx, e), cy = lerp(stand.y, ty, e);
  // Streckrichtung: im Stand nach oben, im Sprung zum Ziel
  let dx = lerp(0, tx - stand.x, e), dy = lerp(1, ty - stand.y + 0.35, e);
  const len = Math.sqrt(dx * dx + dy * dy) || 1; dx /= len; dy /= len;
  const stretch = 0.55 + KEEPER.arm * e;
  return {
    k, e, cx, cy, dx, dy,
    handX: cx + dx * stretch, handY: Math.max(0.12, cy + dy * stretch),
    footX: cx - dx * 0.85, footY: Math.max(0.1, cy - dy * 0.85)
  };
}

function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
  const t = l2 > 0 ? clamp(((px - ax) * vx + (py - ay) * vy) / l2, 0, 1) : 0;
  const x = ax + vx * t - px, y = ay + vy * t - py;
  return Math.sqrt(x * x + y * y);
}
export function keeperTouches(pose, x, y) {
  const body = segDist(x, y, pose.footX, pose.footY, pose.handX, pose.handY) <= KEEPER.bodyR + FIELD.ballR;
  const hx = x - pose.handX, hy = y - pose.handY;
  return body || Math.sqrt(hx * hx + hy * hy) <= KEEPER.handR + FIELD.ballR;
}

// Wohin und wie schnell geht der Ball? (mit Streuung aus dem Startwert)
export function flight(shotIn, seed, exact = false) {   // exact: ohne Streuung (Zielvorschau)
  const s = cleanShot(shotIn), r = rng(seed);
  const over = clamp((s.power - SHOT.sweet[1]) / (1 - SHOT.sweet[1]), 0, 1);
  const soft = clamp((SHOT.sweet[0] - s.power) / SHOT.sweet[0], 0, 1);
  const spread = exact ? 0 : SHOT.spreadBase + SHOT.spreadOver * over * over + SHOT.spreadSoft * soft;
  const ex = (r() + r() - 1) * spread, ey = (r() + r() - 1) * spread * 0.7;
  const tx = (s.aimX + ex) * FIELD.goalW / 2;
  const ty = Math.max(FIELD.ballR, (s.aimY + ey + (exact ? 0 : SHOT.liftOver * over * over)) * FIELD.goalH);
  const T = lerp(SHOT.timeSlow, SHOT.timeFast, s.power);
  const x0 = 0, y0 = FIELD.ballR, z0 = FIELD.spotZ;
  const ax = s.curve * SHOT.curveAccel;                      // Effet: erst nach außen, dann zurück ins Ziel
  const vx = (tx - x0 + 0.5 * ax * T * T) / T;
  const vy = (ty - y0 + 0.5 * FIELD.g * T * T) / T;
  const vz = (FIELD.goalZ - z0) / T;
  return { T, tx, ty, x0, y0, z0, vx, vy, vz, ax: -ax, perfect: over === 0 && soft === 0, over };
}
export function ballOnPath(f, t) {
  return {
    x: f.x0 + f.vx * t + 0.5 * f.ax * t * t,
    y: f.y0 + f.vy * t - 0.5 * FIELD.g * t * t,
    z: f.z0 + f.vz * t
  };
}

// Pfosten, Latte, Tor oder daneben, an der Torlinie
export function classify(x, y) {
  const hw = FIELD.goalW / 2, H = FIELD.goalH, reach = FIELD.post + FIELD.ballR;
  const ax = x < 0 ? -x : x;
  const nearPost = Math.abs(ax - hw) < reach * 0.8 && y < H + reach * 0.8;
  const nearBar = Math.abs(y - H) < reach * 0.8 && ax < hw + reach * 0.8;
  if (nearPost || nearBar) return 'post';
  if (ax < hw && y < H) return 'goal';
  return y >= H && ax < hw ? 'over' : 'wide';
}

// Kompletter Schuss: Ergebnis plus Ballbahn in festen Schritten
export function resolveKick(shotIn, diveIn, seed) {
  const shot = cleanShot(shotIn), dive = cleanDive(diveIn), f = flight(shot, seed), r = rng((seed ^ 0x9e3779b9) >>> 0);
  const tKeeper = (FIELD.keeperZ - f.z0) / f.vz, atK = ballOnPath(f, tKeeper), pose = keeperPose(dive, tKeeper);
  let outcome, tEvent, p, v;
  const vel = (t) => ({ x: f.vx + f.ax * t, y: f.vy - FIELD.g * t, z: f.vz });
  if (keeperTouches(pose, atK.x, atK.y)) {
    outcome = 'save'; tEvent = tKeeper; p = atK; v = vel(tKeeper);
    const side = atK.x - pose.cx >= 0 ? 1 : -1;
    v = { x: v.x * 0.25 + side * (2 + r() * 3.5), y: 2 + r() * 3, z: -v.z * (0.18 + r() * 0.14) };
  } else {
    const g = ballOnPath(f, f.T);
    outcome = classify(g.x, g.y); tEvent = f.T; p = g; v = vel(f.T);
    if (outcome === 'post') {
      const hitBar = Math.abs(g.y - FIELD.goalH) < Math.abs((g.x < 0 ? -g.x : g.x) - FIELD.goalW / 2);
      v = hitBar ? { x: v.x * 0.5, y: -Math.abs(v.y) * 0.4 + 1.5, z: -v.z * 0.35 } : { x: -v.x * 0.55 + (g.x > 0 ? -2 : 2) * r(), y: v.y * 0.4 + 1, z: -v.z * 0.35 };
    }
  }
  // Nachlauf in festen Schritten
  const pre = Math.ceil(tEvent / STEP), post = Math.ceil(1.8 / STEP), path = new Float64Array((pre + post + 1) * 3);
  for (let i = 0; i < pre; i++) { const b = ballOnPath(f, i * STEP); path[i * 3] = b.x; path[i * 3 + 1] = b.y; path[i * 3 + 2] = b.z; }
  let x = p.x, y = p.y, z = p.z, vx = v.x, vy = v.y, vz = v.z;
  const netBack = FIELD.goalZ - 1.25, hw = FIELD.goalW / 2;
  for (let i = pre; i <= pre + post; i++) {
    path[i * 3] = x; path[i * 3 + 1] = y; path[i * 3 + 2] = z;
    vy -= FIELD.g * STEP; x += vx * STEP; y += vy * STEP; z += vz * STEP;
    if (outcome === 'goal') {                                  // im Netz abbremsen
      if (z < netBack) { z = netBack; vz = 0; vx *= 0.25; vy *= 0.4; }
      if (z < FIELD.goalZ - 0.2) { if (x > hw - 0.15) { x = hw - 0.15; vx *= -0.2; } if (x < -hw + 0.15) { x = -hw + 0.15; vx *= -0.2; } if (y > FIELD.goalH - 0.15) { y = FIELD.goalH - 0.15; vy = 0; } }
      vz *= 0.995;
    } else if (outcome === 'wide' || outcome === 'over') {
      if (z < -14.6) { z = -14.6; vz *= -0.3; vx *= 0.5; }     // Käfigwand
    }
    if (y < FIELD.ballR) { y = FIELD.ballR; vy = vy < -0.6 ? -vy * 0.5 : 0; vx *= 0.9; vz *= 0.9; }
  }
  return { outcome, goal: outcome === 'goal', tEvent, tKeeper, flight: f, shot, dive, path, duration: (pre + post) * STEP, perfect: f.perfect };
}
// Ballposition zu beliebiger Zeit (zwischen den Schritten geglättet)
export function ballAt(res, t) {
  const last = res.path.length / 3 - 1, u = clamp(t / STEP, 0, last), i = Math.min(Math.floor(u), last - 1), q = u - i, P = res.path;
  return { x: lerp(P[i * 3], P[i * 3 + 3], q), y: lerp(P[i * 3 + 1], P[i * 3 + 4], q), z: lerp(P[i * 3 + 2], P[i * 3 + 5], q) };
}

/* ---------- Elfmeterschießen ---------- */
export function createMatch(first = 0) { return { first, kicks: [[], []] }; }
export function shooterOf(m) { const n = m.kicks[0].length + m.kicks[1].length; return n % 2 === 0 ? m.first : 1 - m.first; }
export const goalsOf = (m, p) => m.kicks[p].filter(Boolean).length;
export function winnerOf(m) {
  const a = goalsOf(m, 0), b = goalsOf(m, 1), na = m.kicks[0].length, nb = m.kicks[1].length, N = MATCH.kicks;
  if (na <= N && nb <= N) {                                    // reguläre Schüsse: Schluss, sobald uneinholbar
    if (a > b + (N - nb)) return 0;
    if (b > a + (N - na)) return 1;
    if (na < N || nb < N) return null;
  }
  if (na === nb && a !== b) return a > b ? 0 : 1;              // K.-o.-Runde: nach gleich vielen Schüssen
  return null;
}
export function recordKick(m, goal) {
  if (winnerOf(m) !== null) return m;
  m.kicks[shooterOf(m)].push(!!goal);
  return m;
}
export const suddenDeath = (m) => winnerOf(m) === null && Math.min(m.kicks[0].length, m.kicks[1].length) >= MATCH.kicks;

/* ---------- Computergegner ---------- */
export function cpuShot(level, seed) {
  const c = CPU[level] || CPU.normal, r = rng(seed);
  const side = r() < 0.5 ? -1 : 1, corner = r() < c.corner;
  const aimX = corner ? side * (0.55 + r() * 0.3) : (r() - 0.5) * 0.9;
  const aimY = r() < 0.55 ? 0.08 + r() * 0.22 : 0.45 + r() * 0.35;
  return cleanShot({
    aimX: aimX + (r() - 0.5) * 2 * c.aimErr, aimY: aimY + (r() - 0.5) * c.aimErr,
    power: 0.5 + r() * 0.38 + (r() < c.aimErr ? 0.12 : 0), curve: r() < 0.3 ? (r() - 0.5) * 1.2 : 0
  });
}
export function cpuDive(level, shotIn, seed) {
  const c = CPU[level] || CPU.normal, r = rng(seed), f = flight(shotIn, (seed ^ 0x5bd1e995) >>> 0);
  const reads = r() < c.read * (f.perfect ? 0.75 : 1.15);
  let x, y;
  if (reads) { x = f.tx / (FIELD.goalW / 2) + (r() - 0.5) * c.err; y = (f.ty / FIELD.goalH) + (r() - 0.5) * c.err * 0.6; }
  else { x = (Math.floor(r() * 3) - 1) * (0.55 + r() * 0.35); y = r() * 0.8; }
  return cleanDive({ x, y, start: c.start[0] + r() * (c.start[1] - c.start[0]) });
}
