// Reine Spiellogik: Regeln, Bewegung, Pässe, Tacklings und Computergegner. Läuft ohne Grafik auch in Node.
// Der Angriff läuft immer Richtung +z. Zustand ist reines JSON, Zufall kommt aus dem Startwert.
import { emit } from './kit/realtime.js';
import { FIELD, MATCH, TIME, ROLES, SPEED, MOVE, ACT, ACTION, PASS, FORMATIONS, HUDDLE_DEF, LINEUP, PLAYS, HANDOFF_AT, TARGETS, CPU } from './config.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const hyp = (x, z) => Math.sqrt(x * x + z * z);
const dist = (a, b) => hyp(a.x - b.x, a.z - b.z);
const r2 = (v) => Math.round(v * 100) / 100;
const OFF = [0, 1, 2, 3], DEF = [4, 5, 6, 7], BTN = ['a', 'b', 'c', 'd'], MAN = { man1: 1, man2: 2, man3: 3 };
const EVENT_FIELDS = ['s', 'k', 'x', 'z', 'p', 'high'];
export const PHASES = ['pick', 'set', 'live', 'dead', 'over'];
export const RESULTS = ['td', 'tackle', 'sack', 'oob', 'incomplete', 'swat', 'int', 'timeout'];
const EVENTS = ['pickStart', 'lock', 'set', 'snap', 'handoff', 'throw', 'catch', 'swat', 'int', 'drop', 'tackle', 'grab', 'juke', 'stiff', 'shed', 'dive', 'miss', 'jump', 'switch', 'block', 'td', 'sack', 'oob', 'incomplete', 'timeout', 'first', 'downs', 'drive', 'overtime', 'final'];

function rand(s) { s.rng = (s.rng + 0x6d2b79f5) >>> 0; let t = s.rng; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
// Fester "Würfelwurf" aus Zahlen: Entscheidungen des Computers bleiben innerhalb eines Zeitfensters gleich
export function hash(...v) { let h = 2166136261; for (const n of v) { h = Math.imul(h ^ (n | 0), 16777619); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; } return (h >>> 0) / 4294967296; }

/* ---------- Abfragen (auch für die Anzeige) ---------- */
export const defTeam = (s) => 1 - s.off;
export const holder = (s) => (s.ball.m === 'held' ? s.ball.own : -1);
export function controlled(s, side) { if (side === s.off) return s.ball.m === 'air' ? s.ball.tgt : s.ball.m === 'held' && s.ball.own < 4 ? s.ball.own : 0; return s.dc; }
export const isRunPlay = (s) => s.call.o >= 0 && s.call.o < PLAYS.length && !!PLAYS[s.call.o].run;
export const canPass = (s) => s.ph === 'live' && s.ball.m === 'held' && s.ball.own === 0 && !s.scr && !isRunPlay(s);
export function rushLeft(s) { const f = FORMATIONS[s.call.d]; return s.ph === 'live' && f && !s.scr && s.ball.m === 'held' ? Math.max(0, f.rushWait - s.pt) : 0; }
const teamOf = (s, i) => (i < 4 ? s.off : 1 - s.off);
const botOf = (s, i) => (s.bot && s.bot[teamOf(s, i)]) || null;
const lvOf = (s, i) => CPU[botOf(s, i) || 'normal'];
function maxSpeed(s, i) {
  const bot = botOf(s, i); let v = SPEED[ROLES[i]] * (bot ? CPU[bot].pace : 1);
  if (holder(s) === i) v *= MOVE.carry;
  if (s.pl[i].blk > 0) v *= 0.28;
  return v;
}
// Wie frei ist Passziel k? Abstand zum nächsten Verteidiger kurz im Voraus; Verteidiger in der Wurfbahn zählen mit.
export function openness(s, k) {
  const r = s.pl[TARGETS[k]], q = s.pl[0], T = 0.4, rx = r.x + r.vx * T, rz = r.z + r.vz * T; let best = 9;
  const lx = rx - q.x, lz = rz - q.z, len2 = lx * lx + lz * lz || 1;
  for (const i of DEF) {
    const d = s.pl[i]; if (d.act === ACT.down) continue;
    const dx = d.x + d.vx * T, dz = d.z + d.vz * T; best = Math.min(best, hyp(dx - rx, dz - rz));
    const u = ((dx - q.x) * lx + (dz - q.z) * lz) / len2;
    if (u > 0.3 && u < 0.92) { const off = hyp(dx - q.x - lx * u, dz - q.z - lz * u); if (off < 1.1) best = Math.min(best, 0.5 + off); }
  }
  return best;
}
export const openClass = (v) => (v >= 2.4 ? 2 : v >= 1.4 ? 1 : 0);

/* ---------- Aufbau ---------- */
const newPlayer = (x, z, f) => ({ x, z, vx: 0, vz: 0, f, act: ACT.run, at: 0, dur: 0, st: 1, cd: 0, cd2: 0, ax: 0, az: 1, wp: 0, blk: 0, tried: 0 });
function setupPlay(s) {
  s.play++; s.ph = 'pick'; s.pt = 0; s.call = { o: -1, d: -1 }; s.res = null; s.scr = false; s.grab = 0; s.used = 0; s.slow = 0; s.stop = 0; s.catchT = 0;
  s.touched = [false, false]; s.idle = [9, 9]; s.hold = { k: -1, t: 0 }; s.toss = null; s.dc = 7; s.moved = false; s.passed = false; s.pending = null;
  s.pl = ROLES.map((role, i) => { const spot = i < 4 ? LINEUP[i] : HUDDLE_DEF[i - 4]; return newPlayer(spot[0], s.los + spot[1], i < 4 ? 0 : Math.PI); });
  s.ball = { m: 'held', x: 0, y: 0.2, z: s.los, own: 0, tgt: -1, t: 0, T: 1, fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0, apex: 0, high: false, vx: 0, vy: 0, vz: 0 };
  emit(s, 'pickStart', { s: s.off });
}
function newDrive(s, off) {
  s.off = off; s.los = s.ot ? MATCH.otStart : MATCH.start; s.down = 1; s.line = s.ot ? FIELD.goal : Math.min(FIELD.goal, s.los + MATCH.gain); s.plays = 0;
  emit(s, 'drive', { s: off }); setupPlay(s);
}
// Steht der Sieger fest? Bei Gleichstand beginnt hier die nächste Verlängerung.
export function decide(s) {
  const quota = MATCH.drives + s.ot, rem = [quota - s.drv[0], quota - s.drv[1]], [a, b] = s.sc;
  const byYards = () => { s.yardWin = true; return s.yd[0] > s.yd[1] + 0.05 ? 0 : s.yd[1] > s.yd[0] + 0.05 ? 1 : -1; };
  if (a > b + Math.max(0, rem[1])) return 0;
  if (b > a + Math.max(0, rem[0])) return 1;
  if (s.t > MATCH.timeCap) return a > b ? 0 : b > a ? 1 : byYards();
  if (rem[0] <= 0 && rem[1] <= 0) {
    if (a !== b) return a > b ? 0 : 1;
    if (s.ot < MATCH.otRounds) { s.ot++; emit(s, 'overtime', { k: s.ot }); return null; }
    return byYards();
  }
  return null;
}

/* ---------- Bewegung ---------- */
const angTo = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
// Gewünschte Richtung (Länge höchstens 1) mit Beschleunigung, Bremsweg und Wenderadius verfolgen
function steer(p, dx, dz, top, dt) {
  let ex = dx * top - p.vx, ez = dz * top - p.vz; const sp = hyp(p.vx, p.vz);
  if (sp < 1.2) { const l = hyp(ex, ez), m = MOVE.accel * dt; if (l > m) { ex *= m / l; ez *= m / l; } }
  else {
    const ux = p.vx / sp, uz = p.vz / sp; let along = ex * ux + ez * uz, side = ex * -uz + ez * ux;
    along = clamp(along, -MOVE.brake * dt, MOVE.accel * dt * clamp(1.15 - (sp / (top + 0.01)) * 0.5, 0.4, 1));
    side = clamp(side, -MOVE.turn * dt, MOVE.turn * dt);
    ex = ux * along - uz * side; ez = uz * along + ux * side;
  }
  p.vx += ex; p.vz += ez;
}
function face(p, x, z, dt, rate = 12) { if (hyp(x, z) < 0.05) return; p.f += angTo(p.f, Math.atan2(x, z)) * Math.min(1, dt * rate); if (p.f > Math.PI) p.f -= Math.PI * 2; if (p.f < -Math.PI) p.f += Math.PI * 2; }
// Zu einem Punkt laufen und rechtzeitig bremsen. Ergebnis: Stickrichtung
function toward(p, tx, tz, arrive = 0.9) { const dx = tx - p.x, dz = tz - p.z, d = hyp(dx, dz); if (d < 0.12) return [0, 0]; const k = Math.min(1, d / arrive); return [(dx / d) * k, (dz / d) * k]; }
function act(p, a, dur) { p.act = a; p.at = 0; p.dur = dur; }
function stumble(p, dur = ACTION.stumble) { act(p, ACT.stumble, dur); p.vx *= 0.25; p.vz *= 0.25; }
// Laufende Aktion weiterführen. Ergebnis true, wenn die Figur dabei weiter laufen darf
function actions(s, i, dt) {
  const p = s.pl[i];
  p.cd = Math.max(0, p.cd - dt); p.cd2 = Math.max(0, p.cd2 - dt); p.blk = Math.max(0, p.blk - dt);
  if (p.act === ACT.run) return true;
  p.at += dt;
  if (p.act === ACT.dive) {
    if (p.at < ACTION.dive.windup) { p.vx *= 0.9; p.vz *= 0.9; }
    else if (p.at < ACTION.dive.hitEnd) { const k = 1 - ((p.at - ACTION.dive.windup) / ACTION.dive.dur) * 0.55; p.vx = p.ax * ACTION.dive.speed * k; p.vz = p.az * ACTION.dive.speed * k; }
    else { const f = Math.exp(-dt * 7); p.vx *= f; p.vz *= f; }
    if (p.at >= p.dur && s.ph === 'live') { act(p, ACT.down, ACTION.dive.ground); emit(s, 'miss', { k: i, x: r2(p.x), z: r2(p.z) }); }
    return false;
  }
  if (p.act === ACT.down) { const f = Math.exp(-dt * 6); p.vx *= f; p.vz *= f; if (p.at >= p.dur && s.ph === 'live') act(p, ACT.run, 0); return false; }
  if (p.act === ACT.stumble) { const f = Math.exp(-dt * 3); p.vx *= f; p.vz *= f; if (p.at >= p.dur) act(p, ACT.run, 0); return false; }
  if (p.act === ACT.cheer) { const f = Math.exp(-dt * 3); p.vx *= f; p.vz *= f; return false; }
  if (p.at >= p.dur) { act(p, ACT.run, 0); return true; }
  return p.act === ACT.stiff || p.act === ACT.catch || p.act === ACT.jump;
}
function move(s, i, dx, dz, sprint, dt) {
  const p = s.pl[i]; let l = hyp(dx, dz); if (l > 1) { dx /= l; dz /= l; l = 1; }
  if (p.act === ACT.juke) return;
  let top = maxSpeed(s, i);
  const run = sprint && p.st > 0.02 && l > 0.3 && p.blk <= 0;
  if (run) { top *= MOVE.sprint; p.st = Math.max(0, p.st - MOVE.drain * dt); } else p.st = Math.min(1, p.st + MOVE.regen * dt * (l < 0.3 ? 1.6 : 1));
  if (p.act === ACT.stiff) top *= ACTION.stiff.slow;
  if (p.act === ACT.jump) top *= 0.6;
  steer(p, dx, dz, top, dt);
}

/* ---------- Laufwege ---------- */
export function routePoints(play, los, i) {
  const r = PLAYS[play] && PLAYS[play].routes[i]; if (!r || !r.pts) return null;
  const sx = LINEUP[i][0], sz = los + LINEUP[i][1], base = los - 0.2;
  return [[sx, sz], ...r.pts.map(([dx, dz]) => [clamp(sx + dx, -FIELD.halfW + 1.2, FIELD.halfW - 1.2), Math.min(FIELD.goal + FIELD.endDepth - 1.5, base + dz)])];
}
function routeDir(s, i, p) {
  const pts = routePoints(s.call.o, s.los, i); if (!pts) return [0, 0];
  const stop = PLAYS[s.call.o].routes[i].stop, n = pts.length - 1;
  while (p.wp + 1 < n && hyp(pts[p.wp + 1][0] - p.x, pts[p.wp + 1][1] - p.z) < 1.0) p.wp++;
  const last = pts[n], prev = pts[n - 1];
  if (p.wp >= n || (p.wp === n - 1 && hyp(last[0] - p.x, last[1] - p.z) < 1.0)) {
    p.wp = n;
    if (stop) return toward(p, last[0], last[1], 2.2);
    let dx = last[0] - prev[0], dz = last[1] - prev[1]; const l = hyp(dx, dz) || 1; dx /= l; dz /= l;
    return toward(p, clamp(p.x + dx * 3, -FIELD.halfW + 1.2, FIELD.halfW - 1.2), Math.min(FIELD.goal + FIELD.endDepth - 1.5, p.z + dz * 3), 3);
  }
  const t = pts[p.wp + 1]; return toward(p, t[0], t[1], stop && p.wp + 1 === n ? 2.0 : 0.3);
}
// Wo ist der Receiver in T Sekunden? Gleiche Bewegung wie im Spiel, nur auf einer Kopie
export function predict(s, i, T) {
  const p = Object.assign({}, s.pl[i]), top = maxSpeed(s, i), h = 1 / 30;
  for (let t = h / 2; t < T; t += h) { const d = routeDir(s, i, p); steer(p, d[0], d[1], top, h); p.x = clamp(p.x + p.vx * h, -FIELD.halfW + 0.4, FIELD.halfW - 0.4); p.z += p.vz * h; }
  return p;
}

/* ---------- Pass ---------- */
export function ballArc(b, u) { return { x: b.fx + (b.tx - b.fx) * u, z: b.fz + (b.tz - b.fz) * u, y: b.fy + (b.ty - b.fy) * u + b.apex * 4 * u * (1 - u) }; }
export function passPlan(s, k, high) {
  const q = s.pl[0], r = TARGETS[k], kind = high ? PASS.high : PASS.flat; let T = 0.6, pr = s.pl[r], d = 0;
  for (let n = 0; n < 4; n++) { pr = predict(s, r, T); d = hyp(pr.x - q.x, pr.z - q.z); T = Math.max(kind.min, d / kind.speed); }
  return { x: pr.x, z: pr.z, T, d, apex: kind.apex + d * kind.apexPerM };
}
function release(s) {
  const q = s.pl[0], { k, high } = s.toss, r = TARGETS[k], plan = passPlan(s, k, high), bot = botOf(s, 0);
  let pressure = 0; for (const i of DEF) { const d = dist(q, s.pl[i]); if (s.pl[i].act !== ACT.down && d < 2.8) pressure = Math.max(pressure, (2.8 - d) / 2.8); }
  const err = (PASS.scatter + pressure * 1.1 + hyp(q.vx, q.vz) * 0.065 + plan.d * 0.011) * (bot ? CPU[bot].aim : 1);
  const a = rand(s) * Math.PI * 2, m = err * rand(s);
  const b = s.ball; b.m = 'air'; b.own = -1; b.tgt = r; b.t = 0; b.T = plan.T; b.high = high; b.apex = plan.apex;
  b.fx = q.x; b.fy = PASS.release; b.fz = q.z; b.tx = clamp(plan.x + Math.cos(a) * m, -FIELD.halfW - 0.5, FIELD.halfW + 0.5); b.tz = Math.min(FIELD.goal + FIELD.endDepth - 0.5, plan.z + Math.sin(a) * m); b.ty = PASS.catchY;
  b.x = b.fx; b.y = b.fy; b.z = b.fz; s.toss = null; s.throwId++; s.passed = true;
  const D = 1 - s.off; s.touched[D] = s.idle[D] < 0.15;                              // wer den Stick ruhen lässt, wird zum Ball geführt
  emit(s, 'throw', { k, high: high ? 1 : 0, x: r2(q.x), z: r2(q.z) });
}
function startThrow(s, k) {
  const q = s.pl[0]; s.toss = { k, high: s.hold.t >= PASS.highAfter }; s.hold = { k: -1, t: 0 };
  act(q, ACT.throw, PASS.windup + 0.28); const r = s.pl[TARGETS[k]]; q.f = Math.atan2(r.x - q.x, r.z - q.z); q.vx *= 0.35; q.vz *= 0.35;
}
function caught(s, i) {
  const p = s.pl[i], b = s.ball; b.m = 'held'; b.own = i; s.scr = true; s.catchT = s.pt; s.touched[s.off] = false; s.grab = 0;
  act(p, ACT.catch, 0.28); s.slow = 0.3;
  emit(s, 'catch', { k: i, x: r2(p.x), z: r2(p.z) });
  autoSwitch(s);
  if (p.z >= FIELD.goal) finish(s, 'td', FIELD.goal, i);
}
function intercepted(s, i) {
  const p = s.pl[i], b = s.ball; b.m = 'held'; b.own = i; s.dc = i; s.slow = 0.7; act(p, ACT.catch, 0.3);
  emit(s, 'int', { k: i, x: r2(p.x), z: r2(p.z), s: 1 - s.off }); finish(s, 'int', s.los, i);
}
function loose(s, vx, vy, vz) { const b = s.ball; b.m = 'loose'; b.own = -1; b.vx = vx; b.vy = vy; b.vz = vz; }
function swatted(s, i) {
  const b = s.ball; emit(s, 'swat', { k: i, x: r2(b.x), z: r2(b.z) });
  loose(s, (rand(s) - 0.5) * 5, 1.5 + rand(s) * 2, (rand(s) - 0.5) * 5); finish(s, 'swat', s.los, i);
}
const jumping = (p) => p.act === ACT.jump && p.at >= ACTION.jump.from && p.at <= ACTION.jump.to;
const busy = (p) => p.act === ACT.down || p.act === ACT.stumble;
function flyBall(s, dt) {
  const b = s.ball; b.t += dt; const u = Math.min(1, b.t / b.T), q = ballArc(b, u); b.x = q.x; b.y = q.y; b.z = q.z;
  // Unterwegs: wer in der Bahn steht, kommt an den Ball (hohe Bälle fliegen darüber)
  if (u > 0.14 && u < 0.84) for (const i of DEF) {
    const p = s.pl[i]; if (busy(p) || p.tried === s.throwId) continue;
    const jump = jumping(p), reach = jump ? 3.15 : 2.25;
    if (b.y > reach || hyp(p.x - b.x, p.z - b.z) > (jump ? 1.0 : 0.7)) continue;
    p.tried = s.throwId; const roll = rand(s);
    if (roll < (jump ? 0.24 : 0.025)) return intercepted(s, i);
    if (roll < (jump ? 0.92 : 0.36)) return swatted(s, i);
  }
  if (u < 1) return;
  const r = s.pl[b.tgt], rd = busy(r) ? 99 : hyp(r.x - b.tx, r.z - b.tz);
  let best = -1, bd = 99, bj = false;
  for (const i of DEF) { const p = s.pl[i]; if (busy(p)) continue; const j = jumping(p), d = hyp(p.x - b.tx, p.z - b.tz); if (d > (j ? ACTION.jump.reach : 1.05)) continue; if (best < 0 || (j && !bj) || (j === bj && d < bd)) { best = i; bd = d; bj = j; } }
  const inBounds = Math.abs(r.x) <= FIELD.halfW && r.z <= FIELD.goal + FIELD.endDepth;
  if (best >= 0) {
    const roll = rand(s), front = bd < rd + 0.6;
    const pi = bj ? (front ? 0.27 : 0.1) : bd < rd - 0.35 ? 0.09 : 0.01, ps = bj ? 0.6 : b.high ? 0.13 : 0.16;
    if (roll < pi) return intercepted(s, best);
    if (roll < pi + ps) return swatted(s, best);
  }
  const reachable = rd <= PASS.catchReach && inBounds;
  if (reachable && rand(s) < (b.high ? 0.93 : 0.96)) return caught(s, b.tgt);
  emit(s, reachable ? 'drop' : 'incomplete', { x: r2(b.x), z: r2(b.z) });
  loose(s, ((b.tx - b.fx) / b.T) * 0.35, -1, ((b.tz - b.fz) / b.T) * 0.35); finish(s, 'incomplete', s.los, -1);
}

/* ---------- Computer-Verhalten (auch für die Mitspieler) ---------- */
// Wunsch eines Verteidigers i: { x, z, sprint, dive, jump }. Er sieht Gegner nur leicht verspätet.
export function defenderPlan(s, i) {
  const p = s.pl[i], L = lvOf(s, i), form = FORMATIONS[s.call.d] || FORMATIONS[0], job = form.job[i - 4], out = { x: 0, z: 0, sprint: false, dive: false, jump: false };
  const set = (tx, tz, arrive) => { const d = toward(p, tx, tz, arrive); out.x = d[0]; out.z = d[1]; };
  const b = s.ball, h = holder(s);
  if (s.ph !== 'live') return out;
  if (b.m === 'air' && b.t >= L.react) {
    const d = hyp(p.x - b.tx, p.z - b.tz), left = b.T - b.t;
    if (d < 9.5 || dist(p, s.pl[b.tgt]) < 4) { set(b.tx, b.tz + 0.35, 0.8); out.sprint = true; }
    else set(b.tx * 0.5, b.tz + 3, 2);
    const will = hash(s.seed, s.throwId, i, 7) < L.jump, when = 0.2 + (hash(s.seed, s.throwId, i, 8) - 0.5) * L.react * 0.7;
    if (will && left < when + 0.08 && d < 2.0) out.jump = true;
    return out;
  }
  if (h >= 0 && h < 4) {
    const c = s.pl[h], rushing = job === 'rush' && s.pt >= form.rushWait;
    const open = s.scr && s.pt - s.catchT >= L.react;
    if (rushing || open) {
      const d = dist(p, c), T = Math.min(1.1, d / SPEED[ROLES[i]]) * L.lead;
      let tx = c.x + c.vx * T, tz = c.z + c.vz * T;
      if (d > 4.5 && ROLES[i] !== 'rush') { tx += i === 5 ? -1.1 : i === 6 ? 1.1 : 0; tz += i === 7 ? 1.4 : 0; }
      set(clamp(tx, -FIELD.halfW, FIELD.halfW), tz, 0.25); out.sprint = d < 9 && (p.st > 0.35 || d < 4);
      if (d < ACTION.dive.aim * 0.62 && d > 0.7 && p.cd <= 0 && hash(s.seed, s.play, i, Math.floor(s.t * 8)) < L.dive / 8) out.dive = true;
      return out;
    }
    if (job === 'rush') { set(clamp(c.x * 0.8, -4, 4), s.los + 1.1, 1); return out; }
    if (s.scr) return out;                                                          // Reaktionszeit läuft
  }
  // Deckung
  if (MAN[job]) {
    const r = s.pl[MAN[job]], px = r.x - r.vx * L.react * 0.85, pz = r.z - r.vz * L.react * 0.25;   // Haken sieht er spät, Läufe nach vorn ahnt er
    const cushion = job === 'man3' ? 1.6 : Math.max(0.9, 2.8 - s.pt * 0.65);
    set(px * 0.96, Math.max(s.los + 1.2, pz + cushion), 0.8); out.sprint = hyp(px - p.x, pz - p.z) > 3.2 && p.st > 0.25;
  } else if (job === 'zone' || job === 'deep') {
    const zx = form.spots[i - 4][0], zz = s.los + form.spots[i - 4][1] + (job === 'deep' ? 0 : Math.min(2.5, s.pt));
    let tx = zx, tz = zz, best = 5.2, deepest = -99;
    for (const k of [1, 2, 3]) {
      const r = s.pl[k], px = r.x - r.vx * L.react, pz = r.z - r.vz * L.react, d = hyp(px - zx, pz - zz);
      if (job === 'deep') { if (pz > deepest) { deepest = pz; tx = px * 0.65; tz = Math.max(zz, pz + 2.2); } }
      else if (d < best) { best = d; tx = zx * 0.25 + px * 0.75; tz = zz * 0.25 + (pz + 0.8) * 0.75; }
    }
    set(tx, Math.min(FIELD.goal + FIELD.endDepth - 1, tz), 1.1);
  } else set(s.pl[0].x, s.los + 1.1, 1);
  return out;
}
// Wunsch des Ballträgers (nur für den Computer)
function carrierPlan(s, i, L) {
  const p = s.pl[i], out = { x: 0, z: 1, sprint: false, juke: false, stiff: false }; let vx = 0, vz = 1.2, near = 99, nd = null;
  for (const j of DEF) {
    const d = s.pl[j]; if (d.act === ACT.down) continue;
    const dx = p.x - (d.x + d.vx * 0.2 * L.lead), dz = p.z - (d.z + d.vz * 0.2 * L.lead), l = hyp(dx, dz) || 0.1;
    if (l < near) { near = l; nd = d; }
    if (l < 6.5) { const ahead = d.z > p.z - 0.6 ? 1 : 0.35, w = (ahead * 2.6) / (l * l * 0.35 + 0.6); vx += (dx / l) * w * 1.25; vz += (dz / l) * w * 0.45; }
  }
  const ahead = p.x + p.vx * 0.4, edge = FIELD.halfW - 2.6; if (Math.abs(ahead) > edge) vx -= Math.sign(ahead) * (Math.abs(ahead) - edge) * 2.4;
  vz = Math.max(vz, FIELD.goal - p.z < 4 ? 0.9 : -0.25);
  const l = hyp(vx, vz) || 1; out.x = vx / l; out.z = vz / l; out.sprint = near < 7 && p.st > 0.2;
  if (nd && near < 2.7) {
    const closing = (p.x - nd.x) * (nd.vx - p.vx) + (p.z - nd.z) * (nd.vz - p.vz) > 0, roll = hash(s.seed, s.play, i, Math.floor(s.t * 5));
    if (closing && (nd.act === ACT.dive || near < 1.9) && roll < L.juke) out.juke = true;
    else if (near < 1.7 && nd.z > p.z && roll > 1 - L.juke * 0.7) out.stiff = true;
  }
  return out;
}

/* ---------- Aktionen auslösen ---------- */
function press(s, side, k) { if (s.buf[side][k] > 0) { s.buf[side][k] = 0; return true; } return false; }
const ready = (p) => p.act === ACT.run || p.act === ACT.catch;
function doDive(s, i, dx, dz) {
  const p = s.pl[i]; if (!ready(p) || p.cd > 0 || p.blk > 0) return false;
  let ax = dx, az = dz; if (hyp(ax, az) < 0.2) { ax = Math.sin(p.f); az = Math.cos(p.f); }
  let l = hyp(ax, az) || 1; ax /= l; az /= l;
  const h = holder(s);                                                              // sanfte Zielhilfe auf den Ballträger
  if (h >= 0 && h < 4) {
    const c = s.pl[h], d = dist(p, c), tx = c.x + c.vx * 0.2 - p.x, tz = c.z + c.vz * 0.2 - p.z, tl = hyp(tx, tz) || 1;
    if (d < ACTION.dive.aim && ((tx * ax + tz * az) / tl > ACTION.dive.cone || d < 1.8)) { const mix = botOf(s, i) ? lvOf(s, i).lead : 0.85; ax = ax * (1 - mix) + (tx / tl) * mix; az = az * (1 - mix) + (tz / tl) * mix; l = hyp(ax, az) || 1; ax /= l; az /= l; }
  }
  p.ax = ax; p.az = az; p.f = Math.atan2(ax, az); act(p, ACT.dive, ACTION.dive.dur); p.cd = ACTION.dive.cool + ACTION.dive.dur;
  emit(s, 'dive', { k: i, x: r2(p.x), z: r2(p.z) }); return true;
}
function doJump(s, i) { const p = s.pl[i]; if (!ready(p) || p.cd > 0) return false; act(p, ACT.jump, ACTION.jump.dur); p.cd = ACTION.jump.dur + ACTION.jump.cool; const b = s.ball; if (b.m === 'air') p.f = Math.atan2(b.x - p.x, b.z - p.z); emit(s, 'jump', { k: i }); return true; }
function doJuke(s, i, dx) {
  const p = s.pl[i]; if (!ready(p) || p.cd > 0) return false;
  const sp = hyp(p.vx, p.vz), fx = sp > 1 ? p.vx / sp : Math.sin(p.f), fz = sp > 1 ? p.vz / sp : Math.cos(p.f);
  let sx = fz, sz = -fx;                                                            // quer zur Laufrichtung
  let want = dx * sx; if (Math.abs(want) < 0.15) { let near = 99; for (const j of DEF) { const d = s.pl[j], l = dist(p, d); if (l < near) { near = l; want = -((d.x - p.x) * sx + (d.z - p.z) * sz); } } }
  if (want < 0) { sx = -sx; sz = -sz; }
  const keep = Math.max(2.5, sp * 0.65); p.vx = fx * keep + sx * ACTION.juke.side; p.vz = fz * keep + sz * ACTION.juke.side; p.ax = sx; p.az = sz;
  act(p, ACT.juke, ACTION.juke.dur); p.cd = ACTION.juke.cool; s.grab = 0; emit(s, 'juke', { k: i, x: r2(p.x), z: r2(p.z) }); return true;
}
function doStiff(s, i) { const p = s.pl[i]; if (!ready(p) || p.cd2 > 0) return false; act(p, ACT.stiff, ACTION.stiff.dur); p.cd2 = ACTION.stiff.cool; emit(s, 'stiff', { k: i }); return true; }
function switchTo(s, i) { if (i === s.dc) return; s.dc = i; s.touched[1 - s.off] = false; emit(s, 'switch', { k: i }); }
function focusPoint(s) { const b = s.ball; if (b.m === 'air') return { x: b.tx, z: b.tz }; const h = holder(s); return h >= 0 && s.ph !== 'set' ? s.pl[h] : { x: b.x, z: b.z }; }
export function switchDefender(s) {
  if (s.ph === 'set') return switchTo(s, 4 + ((s.dc - 3) % 4));
  const f = focusPoint(s), order = DEF.filter((i) => s.pl[i].act !== ACT.down).sort((a, b) => dist(s.pl[a], f) - dist(s.pl[b], f) || a - b);
  const pick = order[0] === s.dc ? order[1] : order[0]; if (pick !== undefined) switchTo(s, pick);
}
function autoSwitch(s) { const f = focusPoint(s); if (dist(s.pl[s.dc], f) <= 7 && s.pl[s.dc].act !== ACT.down) return; let best = s.dc, bd = 99; for (const i of DEF) { const d = dist(s.pl[i], f); if (d < bd && s.pl[i].act !== ACT.down) { bd = d; best = i; } } switchTo(s, best); }

/* ---------- Ergebnis eines Spielzugs ---------- */
function finish(s, type, spot, who) {
  if (s.ph !== 'live') return;
  const off = s.off, los = s.los; s.ph = 'dead'; s.pt = 0; s.hold = { k: -1, t: 0 }; s.toss = null; s.plays++;
  const r = { type, spot: r2(spot), gain: 0, first: false, over: false, who };
  if (type === 'td') { r.spot = FIELD.goal; r.gain = r2(FIELD.goal - los); s.yd[off] = r2(s.yd[off] + r.gain); s.sc[off]++; r.over = true; emit(s, 'td', { s: off, k: who, x: r2(s.pl[who].x), z: r2(s.pl[who].z) }); s.slow = 0.9; for (const i of OFF) if (!busy(s.pl[i])) act(s.pl[i], ACT.cheer, 9); }
  else if (type === 'int') { r.over = true; r.spot = r2(clamp(s.pl[who].z, 0, FIELD.goal + FIELD.endDepth)); for (const i of DEF) if (i !== who && !busy(s.pl[i])) act(s.pl[i], ACT.cheer, 9); }
  else {
    const dead = type === 'incomplete' || type === 'swat';
    r.spot = r2(dead ? los : clamp(spot, 2, FIELD.goal - 0.5)); r.gain = r2(r.spot - los); s.yd[off] = r2(s.yd[off] + r.gain); s.los = r.spot;
    if (type === 'sack') emit(s, 'sack', { s: off }); else if (type === 'oob') emit(s, 'oob', { s: off }); else if (type === 'timeout') emit(s, 'timeout', { s: off });
    if (!dead && r.spot >= s.line - 0.01) { r.first = true; s.down = 1; s.line = Math.min(FIELD.goal, r2(r.spot + MATCH.gain)); emit(s, 'first', { s: off }); }
    else if (s.down >= MATCH.downs) { r.over = true; emit(s, 'downs', { s: off }); }
    else s.down++;
    if (!r.over && (s.plays >= MATCH.maxDrivePlays || s.t > MATCH.timeCap)) { r.over = true; emit(s, 'downs', { s: off }); }
  }
  s.res = r;
  if (r.over) { s.drv[off]++; s.pending = decide(s); }
}
function tackled(s, c, d) {
  const p = s.pl[c], q = s.pl[d];
  // Schwung: Ballträger und Verteidiger schieben den Punkt weiter oder zurück
  const mx = p.vx * 0.62 + q.vx * 0.38, mz = p.vz * 0.62 + q.vz * 0.38, power = hyp(p.vx - q.vx, p.vz - q.vz);
  const spot = p.z + clamp(mz * 0.17, -0.8, 1.3);
  act(p, ACT.down, 9); p.vx = mx * 0.8; p.vz = mz * 0.8; if (q.act !== ACT.dive) act(q, ACT.down, ACTION.dive.ground); q.vx = mx * 0.5; q.vz = mz * 0.5;
  s.stop = 0.075;
  emit(s, 'tackle', { k: d, p: r2(Math.min(1, power / 12)), x: r2(p.x), z: r2(p.z), s: s.off });
  if (spot >= FIELD.goal) return finish(s, 'td', FIELD.goal, c);
  finish(s, c === 0 && spot < s.los && !s.passed ? 'sack' : 'tackle', spot, d);
}
function contacts(s, dt) {
  const c = holder(s); if (c < 0 || c > 3) return;
  const p = s.pl[c]; let first = -1, count = 0;
  for (const i of DEF) {
    const d = s.pl[i], l = dist(p, d); if (busy(d)) continue;
    const dx = (d.x - p.x) / (l || 1), dz = (d.z - p.z) / (l || 1), front = Math.sin(p.f) * dx + Math.cos(p.f) * dz;
    if (p.act === ACT.stiff && l < ACTION.stiff.reach && front > 0.15 && d.tried !== -s.play) {
      d.tried = -s.play;
      if (rand(s) < (d.act === ACT.dive ? 0.7 : 0.88)) { stumble(d); d.vx = dx * 4; d.vz = dz * 4; act(p, ACT.run, 0); s.grab = 0; s.stop = 0.05; emit(s, 'shed', { k: i, x: r2(d.x), z: r2(d.z) }); continue; }
    }
    const safe = p.act === ACT.juke && p.at < ACTION.juke.safe;
    if (d.act === ACT.dive) { if (d.at >= ACTION.dive.windup && d.at < ACTION.dive.hitEnd && l < ACTION.dive.reach && !safe) return tackled(s, c, i); continue; }
    if (l < ACTION.grab.reach && !safe && d.blk <= 0) { if (first < 0) first = i; count++; }
  }
  if (count) {
    if (s.grab <= 0) emit(s, 'grab', { k: first });
    s.grab += dt * (count > 1 ? 2 : 1);
    const f = Math.exp(-dt * 9); if (hyp(p.vx, p.vz) > SPEED[ROLES[c]] * ACTION.grab.slow) { p.vx *= f; p.vz *= f; }
    if (s.grab >= ACTION.grab.need) tackled(s, c, first);
  } else s.grab = Math.max(0, s.grab - dt * 1.5);
}
function separate(s) {
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
    const a = s.pl[i], b = s.pl[j]; if (a.act === ACT.down || b.act === ACT.down || a.act === ACT.dive || b.act === ACT.dive) continue;
    const dx = b.x - a.x, dz = b.z - a.z, l = hyp(dx, dz); if (l >= MOVE.radius || l < 1e-4) continue;
    const k = ((MOVE.radius - l) / l) * 0.5; a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k;
  }
}
function integrate(s, dt) {
  for (let i = 0; i < 8; i++) {
    const p = s.pl[i]; p.x += p.vx * dt; p.z += p.vz * dt;
    const m = holder(s) === i && s.ph === 'live' ? 1.2 : 0.4;
    p.x = clamp(p.x, -FIELD.halfW - m, FIELD.halfW + m); p.z = clamp(p.z, -2, FIELD.goal + FIELD.endDepth - 0.6);
  }
}

/* ---------- Phasen ---------- */
const clearButtons = (s) => { for (const b of s.buf) for (const k in b) b[k] = 0; };
function stepPick(s, inputs) {
  const o = inputs[s.off], d = inputs[1 - s.off];
  if (s.call.o < 0 && o.n === s.play && o.p >= 0 && o.p < PLAYS.length) { s.call.o = o.p; emit(s, 'lock', { s: s.off }); }
  if (s.call.d < 0 && d.n === s.play && d.p >= 0 && d.p < FORMATIONS.length) { s.call.d = d.p; emit(s, 'lock', { s: 1 - s.off }); }
  if ((s.call.o >= 0 && s.call.d >= 0) || s.pt >= TIME.pick) {
    if (s.call.o < 0) s.call.o = Math.floor(rand(s) * PLAYS.length);
    if (s.call.d < 0) s.call.d = Math.floor(rand(s) * FORMATIONS.length);
    s.ph = 'set'; s.pt = 0; s.dc = 7; s.moved = false; clearButtons(s); emit(s, 'set', { s: s.off });
  }
}
function stepSet(s, inputs, dt) {
  const D = 1 - s.off, d = inputs[D], form = FORMATIONS[s.call.d];
  if (press(s, D, 'b')) { switchDefender(s); s.moved = false; }
  const own = hyp(d.x, d.z) > 0.15; if (own) s.moved = true;
  for (const i of DEF) {
    const p = s.pl[i];
    const v = i === s.dc && s.moved ? (own ? [d.x, d.z] : [0, 0]) : toward(p, form.spots[i - 4][0], s.los + form.spots[i - 4][1], 1.6);
    move(s, i, v[0], v[1], false, dt);
  }
  integrate(s, dt); separate(s);
  for (const i of DEF) { const p = s.pl[i]; if (p.z < s.los + 1) { p.z = s.los + 1; p.vz = Math.max(0, p.vz); } p.x = clamp(p.x, -FIELD.halfW + 0.4, FIELD.halfW - 0.4); face(p, 0.001, -1, dt, 8); }
  if ((s.pt >= TIME.setMin && press(s, s.off, 'a')) || s.pt >= TIME.setMax) {
    s.ph = 'live'; s.pt = 0; s.touched = [false, false]; s.idle = [9, 9]; s.hold = { k: -1, t: 0 }; clearButtons(s); emit(s, 'snap', { s: s.off, x: 0, z: r2(s.los) });
  }
}
function stepLive(s, inputs, dt) {
  const O = s.off, D = 1 - O, io = inputs[O], id = inputs[D], run = isRunPlay(s);
  if (run && s.ball.m === 'held' && s.ball.own === 0 && s.pt >= HANDOFF_AT) { s.ball.own = 3; s.scr = true; s.catchT = s.pt; s.touched[O] = false; emit(s, 'handoff', { k: 3 }); autoSwitch(s); }
  if (s.ball.m === 'held' && s.ball.own === 0 && !s.scr && s.pl[0].z > s.los + 0.15) { s.scr = true; s.catchT = s.pt; s.hold = { k: -1, t: 0 }; }
  const free = []; for (let i = 0; i < 8; i++) free[i] = actions(s, i, dt);
  const h = holder(s), userO = h >= 0 && h < 4 && !(run && h === 0) ? h : -1;
  // Angriff: gesteuerte Figur
  if (userO >= 0) {
    const p = s.pl[userO]; if (hyp(io.x, io.z) > 0.12) s.touched[O] = true;
    const passing = canPass(s);
    if (passing) {
      const held = (k) => (k === 0 && io.a) || (k === 1 && io.b) || (k === 2 && io.c) || io.r === k;
      if (s.toss) { if (p.act !== ACT.throw) s.toss = null; }
      else if (s.hold.k < 0) {
        if (s.pt >= PASS.ready && p.act === ACT.run) { let k = -1; for (let n = 0; n < 3 && k < 0; n++) if (press(s, O, BTN[n])) k = n; if (k < 0 && s.buf[O].r > 0) { k = s.buf[O].rk; s.buf[O].r = 0; } if (k >= 0) s.hold = { k, t: 0 }; }
      } else { s.hold.t += dt; if (!held(s.hold.k) || s.hold.t >= PASS.maxHold) startThrow(s, s.hold.k); }
    } else if (free[userO]) {
      if (press(s, O, 'a')) doJuke(s, userO, io.x);
      if (press(s, O, 'b')) doStiff(s, userO);
    }
    if (p.act === ACT.run || p.act === ACT.stiff || p.act === ACT.catch) {
      let dx = io.x, dz = io.z;
      if (!s.touched[O] && userO !== 0) { const ahead = p.x + p.vx * 0.4; dx = Math.abs(ahead) > 5.4 ? clamp(-(ahead - Math.sign(ahead) * 5.4) * 0.7, -1, 1) : 0; dz = 1; }   // nach dem Fang läuft er von selbst, bis du übernimmst
      const winding = passing && s.hold.k >= 0;
      move(s, userO, winding ? dx * 0.6 : dx, winding ? dz * 0.6 : dz, io.d && !winding, dt);
    }
  }
  if (s.toss && s.pl[0].at >= PASS.windup) release(s);
  // Angriff: alle anderen
  for (const i of OFF) {
    if (i === userO) continue; const p = s.pl[i]; if (!free[i]) continue;
    const b = s.ball, plan = PLAYS[s.call.o].routes[i];
    if (b.m === 'air' && b.tgt === i) { const d = toward(p, b.tx, b.tz, 0.7), need = hyp(b.tx - p.x, b.tz - p.z) / Math.max(0.1, b.T - b.t); move(s, i, d[0], d[1], need > maxSpeed(s, i) * 0.9, dt); }
    else if (plan && plan.block !== undefined) {
      const q = s.pl[plan.block], d = toward(p, q.x + q.vx * 0.15, q.z + q.vz * 0.15 - 0.4, 0.4); move(s, i, d[0], d[1], false, dt);
      if (dist(p, q) < 1.15 && !(s.used & (1 << i)) && !busy(q) && q.act !== ACT.dive) { s.used |= 1 << i; q.blk = ACTION.blockHold; q.vx *= 0.2; q.vz *= 0.2; emit(s, 'block', { k: plan.block, x: r2(q.x), z: r2(q.z) }); }
    } else if (plan && (h === 0 || b.m === 'air' || run)) { const d = routeDir(s, i, p); move(s, i, d[0], d[1], false, dt); }
    else if (h >= 0 && h < 4 && h !== i) { const c = s.pl[h], d = toward(p, clamp(p.x, -6.5, 6.5), c.z + 3, 3); move(s, i, d[0] * 0.7, d[1] * 0.7, false, dt); }
    else move(s, i, 0, 0, false, dt);
  }
  // Verteidigung
  if (press(s, D, 'b')) switchDefender(s);
  const stickD = hyp(id.x, id.z) > 0.12;
  s.idle[D] = stickD ? 0 : s.idle[D] + dt; if (stickD) s.touched[D] = true;
  for (const i of DEF) {
    const p = s.pl[i], mine = i === s.dc, auto = !mine || !s.touched[D] || s.idle[D] > 0.5, plan = defenderPlan(s, i);
    if (mine) { if (press(s, D, 'a')) doDive(s, i, id.x, id.z); if (press(s, D, 'c')) doJump(s, i); }
    else { if (plan.dive) doDive(s, i, plan.x, plan.z); if (plan.jump) doJump(s, i); }
    if (p.act === ACT.run || p.act === ACT.jump || p.act === ACT.catch) { if (auto) move(s, i, plan.x, plan.z, plan.sprint, dt); else move(s, i, id.x, id.z, id.d, dt); }
  }
  integrate(s, dt); separate(s);
  // Blickrichtung
  for (let i = 0; i < 8; i++) {
    const p = s.pl[i]; if (p.act === ACT.dive || p.act === ACT.down || p.act === ACT.throw) continue;
    const sp = hyp(p.vx, p.vz);
    if (i >= 4 && canPass(s) && p.vz > -0.5 && sp < 6.4) face(p, s.pl[0].x - p.x, s.pl[0].z - p.z, dt, 7);      // Rückwärtslauf: Blick zum Werfer
    else if (s.ball.m === 'air' && dist(p, s.ball) < 5 && s.ball.t / s.ball.T > 0.55) face(p, s.ball.x - p.x, s.ball.z - p.z, dt, 9);
    else if (sp > 0.8) face(p, p.vx, p.vz, dt);
    else if (i === 0 && canPass(s)) face(p, 0.001, 1, dt, 5);
  }
  if (s.ball.m === 'air') flyBall(s, dt);
  else if (s.ball.m === 'held') {
    contacts(s, dt);
    const c = holder(s);
    if (s.ph === 'live' && c >= 0 && c < 4) {
      const p = s.pl[c];
      if (p.z >= FIELD.goal && Math.abs(p.x) <= FIELD.halfW + 0.05) finish(s, 'td', FIELD.goal, c);
      else if (Math.abs(p.x) > FIELD.halfW) finish(s, 'oob', p.z, c);
    }
  }
  if (s.ph === 'live' && s.pt >= TIME.live) { const c = holder(s), mine = c >= 0 && c < 4; finish(s, mine ? 'timeout' : 'incomplete', mine ? s.pl[c].z : s.los, c); }
}
function stepDead(s, dt) {
  for (let i = 0; i < 8; i++) { const p = s.pl[i]; actions(s, i, dt); if (p.act === ACT.run || p.act === ACT.catch || p.act === ACT.jump || p.act === ACT.stiff || p.act === ACT.juke) steer(p, 0, 0, 1, dt * 0.6); }
  integrate(s, dt); separate(s);
  if (s.pt >= (s.res && (s.res.type === 'td' || s.res.over) ? TIME.deadBig : TIME.dead)) {
    if (s.res.over) {
      if (s.pending !== null && s.pending !== undefined) { s.win = s.pending; s.ph = 'over'; s.pt = 0; emit(s, 'final', { s: Math.max(0, s.win) }); }
      else newDrive(s, 1 - s.off);
    } else setupPlay(s);
  }
}
function ballFollow(s, dt) {
  const b = s.ball;
  if (b.m === 'held') {
    if (s.ph === 'pick' || s.ph === 'set') { b.x = 0; b.y = 0.2; b.z = s.los; return; }
    const p = s.pl[b.own], fx = Math.sin(p.f), fz = Math.cos(p.f);
    const x = p.x + fx * 0.32 - fz * 0.34, z = p.z + fz * 0.32 + fx * 0.34, y = p.act === ACT.down ? 0.35 : p.act === ACT.throw ? 2.0 : 1.15;
    if (s.ph === 'live' && s.pt < 0.22 && b.own === 0) { const u = s.pt / 0.22; b.x = x * u; b.z = s.los + (z - s.los) * u; b.y = 0.2 + (y - 0.2) * u; }
    else { b.x = x; b.y = y; b.z = z; }
  } else if (b.m === 'loose') {
    b.vy -= 14 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.y < 0.16) { b.y = 0.16; if (b.vy < 0) { b.vy = -b.vy * 0.42; b.vx *= 0.65; b.vz *= 0.65; if (b.vy < 0.7) b.vy = 0; } }
  }
}

/* ---------- Netz ---------- */
const PICK_HIDDEN = 9;
const fin = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
const int = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
const BALLS = ['held', 'air', 'loose'];

export const sim = {
  create(seed) {
    const s = { seed: seed >>> 0, rng: ((seed >>> 0) ^ 0x9e3779b9) >>> 0, tick: 0, t: 0, ph: 'pick', pt: 0, play: 0, off: 0, first: 0, drv: [0, 0], sc: [0, 0], yd: [0, 0], ot: 0, down: 1, los: MATCH.start, line: 0, plays: 0, win: null, yardWin: false, pending: null,
      bot: [null, null], prev: [{}, {}], buf: [{ a: 0, b: 0, c: 0, d: 0, r: 0, rk: 0 }, { a: 0, b: 0, c: 0, d: 0, r: 0, rk: 0 }], events: [], eventId: 0, throwId: 0 };
    s.first = rand(s) < 0.5 ? 0 : 1; newDrive(s, s.first); return s;
  },
  cleanInput(i) {
    const o = i && typeof i === 'object' ? i : {}; let x = clamp(num(o.x), -1, 1), z = clamp(num(o.z), -1, 1); const l = hyp(x, z); if (l > 1) { x /= l; z /= l; }
    return { x, z, a: o.a === true, b: o.b === true, c: o.c === true, d: o.d === true, r: int(o.r, 0, 2) ? o.r : -1, p: int(o.p, 0, 3) ? o.p : -1, n: int(o.n, 0, 100000) ? o.n : 0 };
  },
  step(s, inputs, dt) {
    if (s.win !== null) return;
    for (let k = 0; k < 2; k++) {
      const i = inputs[k], p = s.prev[k], b = s.buf[k];
      for (const n of BTN) { if (i[n] && !p[n]) b[n] = TIME.buffer; else b[n] = Math.max(0, b[n] - dt); }
      if (i.r >= 0 && !(p.r >= 0)) { b.r = TIME.buffer; b.rk = i.r; } else b.r = Math.max(0, b.r - dt);
      s.prev[k] = { a: i.a, b: i.b, c: i.c, d: i.d, r: i.r };
    }
    s.tick++;
    if (s.stop > 0) { s.stop -= dt; return; }                                       // kurzer Stopp beim Treffer
    if (s.slow > 0) { s.slow -= dt; dt *= 0.42; }                                   // Zeitlupe bei Fang und Touchdown
    s.t += dt; s.pt += dt;
    if (s.ph === 'pick') stepPick(s, inputs);
    else if (s.ph === 'set') stepSet(s, inputs, dt);
    else if (s.ph === 'live') stepLive(s, inputs, dt);
    else if (s.ph === 'dead') stepDead(s, dt);
    ballFollow(s, dt);
  },
  // Eingabe des Computers: dieselben Knöpfe wie ein Mensch, mit Reaktionszeit und Fehlern
  cpu(s, side, level) {
    const lv = CPU[level] ? level : 'normal', L = CPU[lv]; if (s.bot) s.bot[side] = lv;
    const out = { x: 0, z: 0, a: false, b: false, c: false, d: false, r: -1, p: -1, n: s.play };
    const offense = side === s.off, togo = s.line - s.los;
    if (s.ph === 'pick') {
      if (s.pt >= 0.5 + L.think + hash(s.seed, s.play, side, 1) * 0.9) {
        const roll = hash(s.seed, s.play, side, 2);
        if (offense) out.p = pickW(togo < 4.5 ? [0.1, 0.35, 0.2, 0.35] : togo > 8 ? [0.34, 0.3, 0.24, 0.12] : [0.24, 0.3, 0.26, 0.2], roll);
        else out.p = pickW(togo < 4.5 ? [0.45, 0.2, 0.35] : togo > 8 ? [0.35, 0.47, 0.18] : [0.42, 0.34, 0.24], roll);
      }
      return out;
    }
    if (s.ph === 'set') { if (offense && s.pt >= 1.1 + hash(s.seed, s.play, 3) * 0.8) out.a = true; return out; }
    if (s.ph !== 'live') return out;
    if (!offense) {
      const plan = defenderPlan(s, s.dc); out.x = plan.x; out.z = plan.z; out.d = plan.sprint; out.a = plan.dive; out.c = plan.jump;
      if (s.tick % 30 === 0 && s.pt > 0.8) { const f = focusPoint(s), mine = dist(s.pl[s.dc], f); if (mine > 6 && DEF.some((i) => s.pl[i].act !== ACT.down && dist(s.pl[i], f) < mine - 3)) out.b = true; }
      return out;
    }
    const h = holder(s); if (h < 0 || h > 3 || (isRunPlay(s) && h === 0)) return out;
    const q = s.pl[h];
    if (canPass(s)) {
      let near = 99, from = null; for (const i of DEF) { const d = dist(q, s.pl[i]); if (s.pl[i].act !== ACT.down && d < near) { near = d; from = s.pl[i]; } }
      if (s.pt < 0.75) { const d = toward(q, 0, s.los - 5.4, 1.2); out.x = d[0]; out.z = d[1]; }
      else if (near < 3.6 && from) { const dx = q.x - from.x, dz = q.z - from.z, l = hyp(dx, dz) || 1; out.x = clamp(dx / l + (Math.abs(q.x) > 5 ? -Math.sign(q.x) * 1.2 : 0), -1, 1); out.z = clamp(dz / l, -0.6, 0.3); out.d = near < 2.4; }
      if (s.hold.k >= 0) {
        const lob = laneBlocked(s, s.hold.k) && (lv === 'hard' || hash(s.seed, s.play, 11) < (lv === 'normal' ? 0.7 : 0.35));
        if (s.hold.t < (lob ? PASS.highAfter + 0.07 : 0.03)) out.r = s.hold.k;
        return out;
      }
      if (s.toss || q.act !== ACT.run) return out;
      const pressed = near < 2.9, slot = Math.floor(s.pt / L.think);
      if ((s.pt >= L.throwAt + hash(s.seed, s.play, 5) * 0.6 || (pressed && s.pt > L.react + 0.6)) && s.tick % 5 === 0) {
        let best = 0, score = -99, value = 0;
        for (let k = 0; k < 3; k++) {
          const r = s.pl[TARGETS[k]], o = Math.min(5, openness(s, k)), deep = clamp((r.z - s.los) / 14, -0.3, 1), err = (hash(s.seed, s.play, k, slot) - 0.5) * 2 * L.noise;
          const v = o + deep * (togo > 6 ? 1.1 : 0.5) + (r.z >= s.line ? 0.5 : 0) + err;
          if (v > score) { score = v; best = k; value = o + err * 0.5; }
        }
        if (value >= L.need || (pressed && value > L.need * 0.45) || s.pt > 3.6) out.r = best;
        else if (pressed && near < 2.2) { out.z = 1; out.x = clamp(-q.x * 0.1 + (from && from.x > q.x ? -0.8 : 0.8), -1, 1); out.d = true; }
      }
      return out;
    }
    if (s.pt - s.catchT < L.react * 0.5) { out.z = 1; return out; }
    const plan = carrierPlan(s, h, L); out.x = plan.x; out.z = plan.z; out.d = plan.sprint; out.a = plan.juke; out.b = plan.stiff;
    return out;
  },
  pack(s) {
    const b = s.ball, call = [s.call.o, s.call.d];
    // Verdeckte Wahl: Solange gewählt wird, geht die Wahl des Gastgebers (Spieler 0) nicht an den Gast
    if (s.ph === 'pick') { const k = s.off === 0 ? 0 : 1; if (call[k] >= 0) call[k] = PICK_HIDDEN; }
    return {
      v: 1, k: s.tick, t: r2(s.t), ph: PHASES.indexOf(s.ph), pt: r2(s.pt), n: s.play, o: s.off, f: s.first, dr: s.drv.slice(), sc: s.sc.slice(), yd: [r2(s.yd[0]), r2(s.yd[1])], ot: s.ot, dn: s.down, los: r2(s.los), ln: r2(s.line), call,
      dc: s.dc, scr: s.scr ? 1 : 0, h: [s.hold.k, r2(s.hold.t)], win: s.win, yw: s.yardWin ? 1 : 0,
      b: [BALLS.indexOf(b.m), r2(b.x), r2(b.y), r2(b.z), b.own, b.tgt, r2(b.t), r2(b.T), r2(b.fx), r2(b.fy), r2(b.fz), r2(b.tx), r2(b.ty), r2(b.tz), r2(b.apex), b.high ? 1 : 0],
      res: s.res ? [RESULTS.indexOf(s.res.type), s.res.spot, s.res.gain, s.res.first ? 1 : 0, s.res.over ? 1 : 0, s.res.who] : null,
      p: s.pl.map((p) => [r2(p.x), r2(p.z), r2(p.vx), r2(p.vz), r2(p.f), p.act, r2(p.at), r2(p.st), r2(p.blk), r2(p.cd), r2(p.cd2), p.wp]),
      eid: s.eventId, ev: (s.events || []).map((e) => Object.assign({}, e))
    };
  },
  unpack(d) {
    try {
      if (!d || d.v !== 1 || !int(d.ph, 0, 4) || !int(d.o, 0, 1) || !int(d.f, 0, 1) || !int(d.n, 0, 100000) || !int(d.k, 0, 1e9) || !fin(d.t, 0, 1e5) || !fin(d.pt, 0, 1e4)) return null;
      if (![d.dr, d.sc].every((a) => Array.isArray(a) && a.length === 2 && a.every((v) => int(v, 0, 99))) || !Array.isArray(d.yd) || d.yd.length !== 2 || !d.yd.every((v) => fin(v, -999, 999))) return null;
      if (!int(d.ot, 0, 9) || !int(d.dn, 1, 4) || !fin(d.los, -5, 60) || !fin(d.ln, -5, 60) || !int(d.dc, 4, 7) || !(d.win === null || int(d.win, -1, 1))) return null;
      if (!Array.isArray(d.call) || d.call.length !== 2 || !d.call.every((v) => int(v, -1, PICK_HIDDEN))) return null;
      if (d.ph > 0 && d.ph < 4 && !(int(d.call[0], 0, PLAYS.length - 1) && int(d.call[1], 0, FORMATIONS.length - 1))) return null;
      if (!Array.isArray(d.h) || d.h.length !== 2 || !int(d.h[0], -1, 2) || !fin(d.h[1], 0, 9)) return null;
      const b = d.b; if (!Array.isArray(b) || b.length !== 16 || !b.every((v) => fin(v, -200, 200)) || !int(b[0], 0, 2) || !int(b[4], -1, 7) || !int(b[5], -1, 3) || !(b[7] > 0)) return null;
      if ((b[0] === 0 && b[4] < 0) || (b[0] === 1 && b[5] < 0)) return null;
      if (!Array.isArray(d.p) || d.p.length !== 8) return null;
      const pl = [];
      for (const q of d.p) {
        if (!Array.isArray(q) || q.length !== 12 || !q.every((v) => fin(v, -100, 100)) || !int(q[5], 0, 9) || !int(q[11], 0, 9)) return null;
        pl.push({ x: q[0], z: q[1], vx: q[2], vz: q[3], f: q[4], act: q[5], at: q[6], dur: 0, st: q[7], blk: q[8], cd: q[9], cd2: q[10], ax: 0, az: 1, wp: q[11], tried: 0 });
      }
      let res = null;
      if (d.res !== null) { const r = d.res; if (!Array.isArray(r) || r.length !== 6 || !int(r[0], 0, RESULTS.length - 1) || !fin(r[1], -10, 60) || !fin(r[2], -99, 99) || !int(r[5], -1, 7)) return null; res = { type: RESULTS[r[0]], spot: r[1], gain: r[2], first: !!r[3], over: !!r[4], who: r[5] }; }
      if (!int(d.eid, 0, 1e9) || !Array.isArray(d.ev) || d.ev.length > 12) return null;
      const events = [];
      for (const e of d.ev) {
        if (!e || !int(e.id, 1, 1e9) || !EVENTS.includes(e.type)) return null;
        const c = {};                                                            // nur bekannte Felder übernehmen
        for (const k of Object.keys(e)) { if (k === 'id' || k === 'type') c[k] = e[k]; else if (EVENT_FIELDS.includes(k)) { if (!fin(e[k], -200, 200)) return null; c[k] = e[k]; } }
        events.push(c);
      }
      return { tick: d.k, t: d.t, ph: PHASES[d.ph], pt: d.pt, play: d.n, off: d.o, first: d.f, drv: d.dr.slice(), sc: d.sc.slice(), yd: d.yd.slice(), ot: d.ot, down: d.dn, los: d.los, line: d.ln, call: { o: d.call[0], d: d.call[1] }, dc: d.dc, scr: !!d.scr, hold: { k: d.h[0], t: d.h[1] }, win: d.win, yardWin: !!d.yw, res,
        ball: { m: BALLS[b[0]], x: b[1], y: b[2], z: b[3], own: b[4], tgt: b[5], t: b[6], T: b[7], fx: b[8], fy: b[9], fz: b[10], tx: b[11], ty: b[12], tz: b[13], apex: b[14], high: !!b[15], vx: 0, vy: 0, vz: 0 },
        pl, eventId: d.eid, events, bot: [null, null] };
    } catch (e) { return null; }
  },
  lerp(a, b, t) {
    if (!a || !b) return b || a;
    if (a.play !== b.play || a.ph !== b.ph) return b;
    const m = (x, y) => x + (y - x) * t;
    const pl = b.pl.map((q, i) => { const p = a.pl[i]; return Object.assign({}, q, { x: m(p.x, q.x), z: m(p.z, q.z), vx: m(p.vx, q.vx), vz: m(p.vz, q.vz), f: p.f + angTo(p.f, q.f) * t, at: p.act === q.act ? m(p.at, q.at) : q.at }); });
    const same = a.ball.m === b.ball.m && a.ball.own === b.ball.own;
    const ball = same ? Object.assign({}, b.ball, { x: m(a.ball.x, b.ball.x), y: m(a.ball.y, b.ball.y), z: m(a.ball.z, b.ball.z), t: m(a.ball.t, b.ball.t) }) : b.ball;
    return Object.assign({}, b, { t: m(a.t, b.t), pt: m(a.pt, b.pt), pl, ball });
  },
  score(s) { return s.sc; },
  winner(s) { return s.win; }
};
function pickW(w, roll) { let sum = 0; for (let i = 0; i < w.length; i++) { sum += w[i]; if (roll < sum) return i; } return w.length - 1; }
function laneBlocked(s, k) { const q = s.pl[0], r = s.pl[TARGETS[k]], lx = r.x - q.x, lz = r.z - q.z, len2 = lx * lx + lz * lz || 1; return DEF.some((i) => { const d = s.pl[i], u = ((d.x - q.x) * lx + (d.z - q.z) * lz) / len2; return u > 0.2 && u < 0.85 && hyp(d.x - q.x - lx * u, d.z - q.z - lz * u) < 1.3; }); }
