// Reine Spiellogik ohne Grafik und DOM: Ball, Spieler, Mannschaftsverhalten, Torhüter, Regeln, Computergegner.
// Fester Takt (60 Hz), Zufall nur aus dem Startwert im Zustand, Zustand ist reines JSON.
// Achsen: x = Längsrichtung (Tore bei ±52,5), z = Querrichtung, y = Höhe.
import { emit } from './kit/realtime.js';
import { PITCH, MATCH, BALL, MOVE, KICK, TACKLE, LEVELS, FORMATION } from './config.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const hyp = (x, z) => Math.sqrt(x * x + z * z);
const dist = (a, b) => hyp(a.x - b.x, a.z - b.z);
const r2 = (v) => Math.round(v * 100) / 100;
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export const N = 22;
export const ACT = { run: 0, kick: 1, slide: 2, down: 3, dive: 4, stumble: 5, header: 6, cheer: 7, throw: 8 };
export const PHASES = ['set', 'play', 'goal', 'half', 'over'];
export const RESTARTS = ['kickoff', 'throw', 'goalkick', 'corner'];
export const KINDS = ['pass', 'through', 'shoot'];
export const EVENTS = ['restart', 'pass', 'shot', 'header', 'tackle', 'slide', 'save', 'catch', 'post', 'goal', 'out', 'half', 'final', 'switch', 'miss'];
// Aufgaben der Mannschaftslogik
export const JOB = { slot: 0, press: 1, cover: 2, mark: 3, receive: 4, support: 5, chase: 6 };

export const teamOf = (i) => (i < 11 ? 0 : 1);
export const roleOf = (i) => i % 11;
export const isKeeper = (i) => i % 11 === 0;
// Angriffsrichtung einer Mannschaft (+1 oder -1); zur Halbzeit werden die Seiten getauscht
export const dirOf = (s, team) => (team === 0 ? 1 : -1) * (s.half === 1 ? 1 : -1);
export const ownerTeam = (s) => (s.ball.own >= 0 ? teamOf(s.ball.own) : -1);
const lvOf = (s, team) => LEVELS[s.lv[team]] || LEVELS.normal;

function rand(s) { s.rng = (s.rng + 0x6d2b79f5) >>> 0; let t = s.rng; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const spread = (s) => rand(s) + rand(s) - 1;                       // Dreiecksverteilung -1..1
function event(s, type, data) { emit(s, type, Object.assign({ k: -1, s: -1, x: r2(s.ball.x), z: r2(s.ball.z), p: 0 }, data, { t: r2(s.t) })); }

/* ---------- Aufbau ---------- */
const newPlayer = () => ({ x: 0, z: 0, vx: 0, vz: 0, f: 0, act: ACT.run, at: 0, dur: 0, cd: 0, st: 1, tx: 0, tz: 0, sp: 0, job: 0, ax: 0, az: 0, near: 0, hit: 0 });
const noButtons = () => ({ pass: false, through: false, shoot: false, switch: false });
const emptyStats = () => ({ pas: [0, 0], cmp: [0, 0], sh: [0, 0], on: [0, 0], pos: [0, 0], sav: [0, 0], tkl: [0, 0], cor: [0, 0] });

function create(seed, opts = {}) {
  const level = LEVELS[opts.level] ? opts.level : 'normal';
  const s = {
    rng: seed >>> 0, t: 0, tick: 0, ph: 'set', pt: 0, half: 1, clock: 0, sc: [0, 0],
    lv: opts.levels ? opts.levels.slice(0, 2) : ['normal', level],
    ko: 0, first: 0, win: null, poss: 0,
    ball: { x: 0, y: BALL.r, z: 0, vx: 0, vy: 0, vz: 0, own: -1, last: -1, hands: false, held: 0 },
    pl: Array.from({ length: N }, newPlayer), ctl: [9, 20], rs: null, pass: null, shot: null,
    chg: [{ k: '', t: 0 }, { k: '', t: 0 }], prev: [noButtons(), noButtons()], buf: [null, null], idle: [9, 9], lock: [null, null],
    man: [-9, -9], swAt: [0, 0], think: [0, 0.05], brain: [{}, {}], kp: [-1, -1], imm: 0, press: [0, 0], aim: [[0, 0], [0, 0]],
    stats: emptyStats(), events: [], eventId: 0
  };
  s.first = rand(s) < 0.5 ? 0 : 1; s.ko = s.first;
  kickoff(s, s.ko);
  return s;
}

function kickoffSpot(s, i, team) {
  const t = teamOf(i), d = dirOf(s, t), f = FORMATION[roleOf(i)];
  let ax = roleOf(i) === 0 ? -50 : Math.min(-1.5, f.x * 0.82 - 8), az = f.z;
  if (t === team) { if (roleOf(i) === 9) { ax = -0.45; az = 0.25; } else if (roleOf(i) === 10) { ax = -2.5; az = 7; } }
  else if (hyp(ax, az) < PITCH.circle + 1) ax = -PITCH.circle - 1.5;
  return [ax * d, az * d];
}
function kickoff(s, team) {
  for (let i = 0; i < N; i++) {
    const p = s.pl[i], [x, z] = kickoffSpot(s, i, team);
    p.x = x; p.z = z; p.vx = 0; p.vz = 0; p.f = dirOf(s, teamOf(i)) > 0 ? 0 : Math.PI; p.act = ACT.run; p.at = 0; p.dur = 0; p.cd = 0; p.tx = x; p.tz = z; p.sp = 0; p.job = 0; p.near = 0;
    if (s.pt === 0 && s.clock === 0) p.st = 1;
  }
  restart(s, 'kickoff', team, 0, 0);
}

// Standardsituation: Ball liegt, der Ausführende steht bereit, Gegner halten Abstand
function restart(s, kind, team, x, z) {
  const d = dirOf(s, team), base = team * 11;
  let taker = base + 9;
  if (kind === 'goalkick') taker = base;
  else if (kind === 'throw' || kind === 'corner') {
    let best = 1e9;
    for (let k = 1; k < 11; k++) {
      if (kind === 'corner' && FORMATION[k].r !== 'mid') continue;
      const q = s.pl[base + k], v = hyp(q.x - x, q.z - z); if (v < best) { best = v; taker = base + k; }
    }
  }
  s.ph = 'set'; s.pt = 0; s.rs = { k: kind, team, taker, x, z };
  s.pass = null; s.shot = null; s.buf = [null, null]; s.lock = [null, null]; s.kp = [-1, -1]; s.brain = [{}, {}];
  s.chg = [{ k: '', t: 0 }, { k: '', t: 0 }];
  const b = s.ball; b.x = x; b.z = z; b.y = BALL.r; b.vx = b.vy = b.vz = 0; b.own = taker; b.last = taker; b.hands = kind === 'throw'; b.held = 0; s.poss = team;
  const t = s.pl[taker];
  let fx = d, fz = 0;
  if (kind === 'throw') { fx = 0; fz = -Math.sign(z || 1); }
  else if (kind === 'corner') { fx = -Math.sign(x) * 0.35; fz = -Math.sign(z); }
  t.f = Math.atan2(fz, fx); t.vx = t.vz = 0; t.act = ACT.run; t.cd = 0;
  t.x = x - Math.cos(t.f) * 0.5; t.z = z - Math.sin(t.f) * 0.5;
  if (kind === 'goalkick') { b.x = x; b.z = z; }
  s.ctl[team] = taker;
  think(s, 0); think(s, 1);
  if (kind === 'corner' || kind === 'goalkick') {
    for (let i = 0; i < N; i++) if (i !== taker) { const p = s.pl[i]; p.x = p.tx; p.z = p.tz; p.vx = p.vz = 0; p.act = ACT.run; p.f = Math.atan2(b.z - p.z, b.x - p.x); }
    separate(s);
  }
  s.ctl[1 - team] = nearest(s, 1 - team, x, z);
  event(s, 'restart', { k: RESTARTS.indexOf(kind), s: team });
}

function nearest(s, team, x, z, not = -1) {
  let best = team * 11 + 1, v = 1e9;
  for (let k = 1; k < 11; k++) { const i = team * 11 + k; if (i === not) continue; const q = s.pl[i], d = hyp(q.x - x, q.z - z) + (q.act === ACT.down || q.act === ACT.slide ? 6 : 0); if (d < v) { v = d; best = i; } }
  return best;
}

/* ---------- Ball ---------- */
function integrate(b, dt) {
  const ground = b.y <= BALL.r + 0.02 && Math.abs(b.vy) < 0.6;
  if (ground) {
    b.y = BALL.r; b.vy = 0; const v = hyp(b.vx, b.vz);
    if (v > 0) { const nv = Math.max(0, v - (BALL.roll + BALL.drag * v) * dt); b.vx *= nv / v; b.vz *= nv / v; }
  } else {
    b.vy -= BALL.g * dt; const f = 1 - 0.05 * dt; b.vx *= f; b.vz *= f; b.y += b.vy * dt;
    if (b.y < BALL.r) { b.y = BALL.r; if (b.vy < -1.4) { b.vy = -b.vy * BALL.bounce; b.vx *= BALL.grip; b.vz *= BALL.grip; } else b.vy = 0; }
  }
  b.x += b.vx * dt; b.z += b.vz * dt;
}
// Voraussichtliche Bahn in Zehntelsekunden
export function ballPath(s, n = 30) {
  const b = Object.assign({}, s.ball), out = [{ x: b.x, y: b.y, z: b.z, t: 0 }];
  for (let k = 1; k <= n; k++) {
    integrate(b, 0.05); integrate(b, 0.05);
    b.x = clamp(b.x, -PITCH.halfL, PITCH.halfL); b.z = clamp(b.z, -PITCH.halfW, PITCH.halfW);
    out.push({ x: b.x, y: b.y, z: b.z, t: k * 0.1 });
  }
  return out;
}
function intercept(path, p, speed, react) {
  for (const q of path) if (q.y < 1.9 && hyp(q.x - p.x, q.z - p.z) <= speed * Math.max(0, q.t - react) + 0.7) return q;
  const q = path[path.length - 1]; return { x: q.x, z: q.z, y: q.y, t: q.t + Math.max(0, hyp(q.x - p.x, q.z - p.z) / speed - q.t) };
}

/* ---------- Beurteilungen ---------- */
// Abstand des nächsten Gegners zu einem Punkt
function space(s, team, x, z) { let v = 99; const o = (1 - team) * 11; for (let k = 0; k < 11; k++) { const q = s.pl[o + k]; const d = hyp(q.x - x, q.z - z); if (d < v) v = d; } return v; }
// Wie sicher ist die Linie? 0 = zugestellt, 1 = frei. Gegner nahe der Linie zählen umso mehr, je länger der Ball dorthin braucht.
export function lane(s, team, x0, z0, x1, z1) {
  const lx = x1 - x0, lz = z1 - z0, len = hyp(lx, lz) || 1; let safe = 1; const o = (1 - team) * 11;
  for (let k = 0; k < 11; k++) {
    const q = s.pl[o + k]; let u = ((q.x - x0) * lx + (q.z - z0) * lz) / (len * len);
    if (u < 0.06 || u > 1.05) continue; u = Math.min(1, u);
    const off = hyp(q.x - x0 - lx * u, q.z - z0 - lz * u), reach = 0.9 + u * len * 0.13;
    if (off < reach) safe = Math.min(safe, off / reach);
  }
  return safe;
}

/* ---------- Mannschaftslogik ---------- */
const LIMIT = { def: [-46, 16], mid: [-40, 36], fwd: [-24, 44] };
// Linie des vorletzten Gegners in Angriffskoordinaten: so weit rücken Angreifer ohne Ball höchstens vor
function lastLine(s, team) {
  const d = dirOf(s, team); let a = -99, b = -99;
  for (let k = 0; k < 11; k++) { const v = s.pl[(1 - team) * 11 + k].x * d; if (v > a) { b = a; a = v; } else if (v > b) b = v; }
  return b;
}
export function think(s, team) {
  const d = dirOf(s, team), base = team * 11, other = (1 - team) * 11, b = s.ball, lv = lvOf(s, team), set = s.ph === 'set' ? s.rs : null;
  const own = ownerTeam(s), attacking = set ? set.team === team : own === team || (own < 0 && (s.pass ? s.pass.team === team : s.poss === team));
  const bax = b.x * d, baz = b.z * d, line = Math.max(0, bax, lastLine(s, team));
  // 1. Grundordnung: jede Rolle hat eine Zone, die mit dem Ball wandert
  for (let k = 1; k < 11; k++) {
    const p = s.pl[base + k], f = FORMATION[k], lim = LIMIT[f.r];
    let ax, az;
    if (attacking) { ax = f.x + bax * 0.62 + (f.r === 'def' ? 8 : 11); az = f.z * 1.08 + baz * 0.16; }
    else { ax = f.x + bax * 0.6 - 3; az = f.z * 0.74 + baz * 0.36; }
    ax = clamp(ax, lim[0], lim[1]);
    if (!attacking && f.r === 'def') ax = Math.max(-46, Math.min(ax, bax - 3));
    if (attacking && f.r !== 'def') ax = Math.min(ax, line + 0.2);
    p.tx = ax * d; p.tz = clamp(az, -PITCH.halfW + 2, PITCH.halfW - 2) * d; p.job = JOB.slot; p.sp = 0;
  }
  if (set) return setPieces(s, team);
  const ownGoal = -d * PITCH.halfL;
  if (own < 0) {
    // freier Ball: der Passempfänger und höchstens ein weiterer Spieler gehen hin
    const path = ballPath(s); let best = -1, bt = 99, spot = null;
    for (let k = 1; k < 11; k++) {
      const i = base + k, p = s.pl[i]; if (p.act === ACT.down) continue;
      const q = intercept(path, p, MOVE.speed[FORMATION[k].r] * 1.12, 0.1);
      if (q.t < bt) { bt = q.t; best = i; spot = q; }
    }
    let rec = -1, rt = 99;
    if (s.pass && s.pass.team === team && s.pass.to >= 0 && !isKeeper(s.pass.to)) {
      rec = s.pass.to; const p = s.pl[rec], q = intercept(path, p, MOVE.speed[FORMATION[roleOf(rec)].r] * 1.1, 0.05);
      rt = q.t; p.tx = q.x; p.tz = q.z; p.job = JOB.receive; p.sp = hyp(q.x - p.x, q.z - p.z) > 2.5 ? 1 : 0;
    }
    if (best >= 0 && best !== rec && (rec < 0 || bt < rt - 0.35)) { const p = s.pl[best]; p.tx = spot.x; p.tz = spot.z; p.job = JOB.chase; p.sp = 1; }
  }
  if (own >= 0 && own !== team) {
    const c = s.pl[b.own]; let first = -1, second = -1, v1 = 1e9, v2 = 1e9;
    const cx = c.x + c.vx * 0.35, cz = c.z + c.vz * 0.35;
    for (let k = 1; k < 11; k++) {
      const i = base + k, p = s.pl[i]; if (p.act === ACT.down || p.act === ACT.slide) continue;
      const v = hyp(p.x - cx, p.z - cz) + ((p.x - cx) * d > 1 ? 3.5 : 0);             // wer schon überlaufen ist, kommt später
      if (v < v1) { second = first; v2 = v1; first = i; v1 = v; } else if (v < v2) { second = i; v2 = v; }
    }
    if (first >= 0) {
      const p = s.pl[first], lead = Math.min(0.5, v1 / 14) * lv.sense, held = isKeeper(b.own) && b.hands;
      p.tx = c.x + c.vx * lead - d * (v1 > 3 ? 0.8 : 0); p.tz = c.z + c.vz * lead; p.job = JOB.press; p.sp = v1 > lv.press * 0.5 && v1 < 25 && p.st > 0.25 ? 1 : 0;
      if (held) { p.tx = c.x - d * 18; p.job = JOB.slot; p.sp = 0; }
    }
    if (second >= 0 && bax < 12) {
      const p = s.pl[second], gx = ownGoal - c.x, gz = -c.z, l = hyp(gx, gz) || 1, off = Math.min(7, l * 0.45);
      p.tx = c.x + (gx / l) * off; p.tz = c.z + (gz / l) * off; p.job = JOB.cover; p.sp = hyp(p.tx - p.x, p.tz - p.z) > 6 ? 1 : 0;
    }
    // Decken: Gegner in der eigenen Hälfte bekommen den nächsten freien Spieler torseitig
    const used = new Set([first, second]);
    const threats = [];
    for (let k = 1; k < 11; k++) { const i = other + k; if (i !== b.own && s.pl[i].x * d < 4) threats.push(i); }
    threats.sort((a, z) => s.pl[a].x * d - s.pl[z].x * d || a - z);
    for (const i of threats) {
      const o = s.pl[i]; let who = -1, v = 14;
      for (let k = 1; k < 11; k++) { const j = base + k; if (used.has(j)) continue; const p = s.pl[j], q = hyp(p.tx - o.x, p.tz - o.z); if (q < v) { v = q; who = j; } }
      if (who < 0) continue; used.add(who);
      const p = s.pl[who], w = 0.45 + 0.45 * lv.sense, gx = ownGoal - o.x, gz = -o.z, l = hyp(gx, gz) || 1;
      const mx = o.x + o.vx * 0.3 * lv.sense + (gx / l) * 1.7, mz = o.z + o.vz * 0.3 * lv.sense + (gz / l) * 1.7;
      p.tx += (mx - p.tx) * w; p.tz += (mz - p.tz) * w; p.job = JOB.mark; p.sp = hyp(p.tx - p.x, p.tz - p.z) > 5 ? 1 : 0;
    }
  }
  if (own === team) {
    const c = s.pl[b.own], list = [];
    for (let k = 1; k < 11; k++) { const i = base + k; if (i !== b.own) list.push(i); }
    list.sort((a, z) => dist(s.pl[a], c) - dist(s.pl[z], c) || a - z);
    // Anbieten: die zwei nächsten suchen freie Räume mit freier Passlinie
    const taken = [];
    for (const i of list.slice(0, 3)) {
      const p = s.pl[i], f = FORMATION[roleOf(i)]; if (f.r === 'def' && bax > 10) continue;
      let bx = p.tx, bz = p.tz, bv = -1e9;
      for (let n = 0; n < 9; n++) {
        const a = n * 0.785, r = n === 8 ? 0 : 7.5;
        const x = clamp(p.tx * 0.5 + p.x * 0.5 + Math.cos(a) * r, -PITCH.halfL + 3, PITCH.halfL - 3), z = clamp(p.tz * 0.5 + p.z * 0.5 + Math.sin(a) * r, -PITCH.halfW + 2, PITCH.halfW - 2);
        const cd = hyp(x - c.x, z - c.z);
        let v = Math.min(8, space(s, team, x, z)) * 0.7 + lane(s, team, c.x, c.z, x, z) * 5 - hyp(x - p.tx, z - p.tz) * 0.18 + (x - c.x) * d * 0.07 - (cd < 8 ? (8 - cd) * 1.2 : 0) - Math.max(0, cd - 24) * 0.3 - (x * d > line ? 4 : 0);
        for (const q of taken) { const g = hyp(x - q[0], z - q[1]); if (g < 11) v -= (11 - g) * 0.6; }
        if (v > bv) { bv = v; bx = x; bz = z; }
      }
      p.tx = bx; p.tz = bz; p.job = JOB.support; p.sp = hyp(bx - p.x, bz - p.z) > 7 ? 1 : 0; taken.push([bx, bz]);
    }
    // Spitzen laufen in die Tiefe
    for (const k of [9, 10, 5, 8]) {
      const i = base + k, p = s.pl[i]; if (i === b.own || p.job !== JOB.slot || bax < -18) continue;
      if (((s.t * 0.37 + k * 0.29) % 1) < 0.5) continue;
      const ax = Math.min(line + 0.2, bax + (k > 8 ? 22 : 15), 45);
      if (ax > p.tx * d) { p.tx = ax * d; if (ax > 30) p.tz *= 0.7; p.sp = ax - p.x * d > 6 ? 1 : 0; }
    }
  }
  // Abstand halten: Ziele von Mitspielern nicht übereinander
  for (let a = base + 1; a < base + 11; a++) for (let z = a + 1; z < base + 11; z++) {
    const p = s.pl[a], q = s.pl[z]; let dx = q.tx - p.tx, dz = q.tz - p.tz; const l = hyp(dx, dz), min = 8;
    if (l >= min) continue;
    const pf = p.job === JOB.press || p.job === JOB.receive || p.job === JOB.chase, qf = q.job === JOB.press || q.job === JOB.receive || q.job === JOB.chase;
    if (l < 0.01) { dx = 0; dz = a % 2 ? 1 : -1; } else { dx /= l; dz /= l; }
    const m = min - l;
    if (!pf) { const w = qf ? 1 : 0.5; p.tx -= dx * m * w; p.tz -= dz * m * w; }
    if (!qf) { const w = pf ? 1 : 0.5; q.tx += dx * m * w; q.tz += dz * m * w; }
  }
  for (let i = base + 1; i < base + 11; i++) { const p = s.pl[i]; p.tx = clamp(p.tx, -PITCH.halfL + 0.5, PITCH.halfL - 0.5); p.tz = clamp(p.tz, -PITCH.halfW + 0.5, PITCH.halfW - 0.5); }
}
const CORNER_SPOTS = [[-6, -3], [-9, 3.5], [-12, -7], [-7, 8], [-15, 1]];       // Abstand zur Grundlinie, seitlich
const CORNER_MEN = [9, 10, 2, 3, 6];
function setPieces(s, team) {
  const r = s.rs, d = dirOf(s, team), base = team * 11, mine = r.team === team;
  if (r.k === 'kickoff') { for (let k = 1; k < 11; k++) { const i = base + k, p = s.pl[i], [x, z] = kickoffSpot(s, i, r.team); p.tx = x; p.tz = z; } return; }
  if (r.k === 'corner') {
    const gx = Math.sign(r.x) * PITCH.halfL, dirx = Math.sign(r.x);
    for (let n = 0; n < CORNER_MEN.length; n++) {
      let k = CORNER_MEN[n]; const spot = CORNER_SPOTS[n];
      if (mine && base + k === r.taker) k = 7;
      const p = s.pl[base + k], x = gx + dirx * spot[0], z = spot[1];
      if (mine) { p.tx = x; p.tz = z; } else { p.tx = x + dirx * 1.2; p.tz = z + (z > 0 ? -0.7 : 0.7); }
      p.job = mine ? JOB.support : JOB.mark;
    }
    if (!mine) { const p = s.pl[base + (r.z * d > 0 ? 4 : 1)]; p.tx = gx - dirx * 1; p.tz = Math.sign(r.z) * 4.5; }
  }
  if (r.k === 'goalkick') {
    const gx = Math.sign(r.x) * PITCH.halfL;
    if (mine) {
      for (const [k, ax, az] of [[1, -38, -24], [2, -40, -13], [3, -40, 13], [4, -38, 24]]) { const p = s.pl[base + k]; p.tx = ax * d; p.tz = az * d; }
    } else for (let k = 1; k < 11; k++) { const p = s.pl[base + k]; if (Math.abs(gx - p.tx) < PITCH.boxDepth + 3) p.tx = gx - Math.sign(gx) * (PITCH.boxDepth + 3 + k * 0.3); }
  }
  if (r.k === 'throw') {
    if (mine) {
      const near = []; for (let k = 1; k < 11; k++) if (base + k !== r.taker) near.push(base + k);
      near.sort((a, z) => hyp(s.pl[a].x - r.x, s.pl[a].z - r.z) - hyp(s.pl[z].x - r.x, s.pl[z].z - r.z) || a - z);
      const inz = -Math.sign(r.z);
      [[7 * d, 6], [-6 * d, 8], [1 * d, 15]].forEach(([dx, dz], n) => { const p = s.pl[near[n]]; p.tx = clamp(r.x + dx, -PITCH.halfL + 2, PITCH.halfL - 2); p.tz = r.z + inz * dz; p.sp = 1; p.job = JOB.support; });
    }
  }
  const keep = r.k === 'throw' ? 5 : PITCH.circle + 0.3;
  for (let k = 1; k < 11; k++) {
    const i = base + k, p = s.pl[i]; if (i === r.taker) continue;
    p.tx = clamp(p.tx, -PITCH.halfL + 0.5, PITCH.halfL - 0.5); p.tz = clamp(p.tz, -PITCH.halfW + 0.5, PITCH.halfW - 0.5);
    if (mine) continue;
    let dx = p.tx - r.x, dz = p.tz - r.z; const l = hyp(dx, dz);
    if (l < keep) { if (l < 0.1) { dx = -d; dz = 0; } else { dx /= l; dz /= l; } if (r.k === 'corner') { dx = -Math.sign(r.x) * 0.7; dz = -Math.sign(r.z) * 0.7; } p.tx = r.x + dx * keep; p.tz = r.z + dz * keep; }
  }
}

/* ---------- Ballbesitz ---------- */
function endPass(s, receiver) {
  const p = s.pass; if (!p) return;
  if (receiver >= 0 && receiver !== p.from && teamOf(receiver) === p.team) s.stats.cmp[p.team]++;
  s.pass = null;
}
function give(s, i, hands = false) {
  const team = teamOf(i), changed = s.poss !== team, b = s.ball;
  const from = s.pass && s.pass.team === team ? s.pass.from : -1;
  endPass(s, i); s.shot = null; s.kp = [-1, -1];
  b.own = i; b.last = i; b.hands = hands; b.held = 0; s.poss = team; s.imm = s.t + TACKLE.immune;
  if (hands) { b.vy = 0; s.imm = s.t + 99; }
  s.ctl[team] = i; s.lock[team] = null; s.brain[team] = { from };
  const other = 1 - team; s.chg[other] = { k: '', t: 0 }; s.buf[other] = null;
  if (changed) { s.swAt[other] = s.t + 0.25; s.think[team] = Math.min(s.think[team], lvOf(s, team).react); s.think[other] = Math.min(s.think[other], lvOf(s, other).react); }
  else s.think[team] = Math.min(s.think[team], 0.1);
  // früh gedrückt: die Aktion wird beim ersten Ballkontakt ausgeführt
  const q = s.buf[team];
  if (q && q.i === i && s.t - q.t <= KICK.buffer && !hands) startKick(s, i, q.k, q.power, q.x, q.z);
  s.buf[team] = null;
}
function loose(s, i, vx, vy, vz) {
  const b = s.ball; b.own = -1; b.hands = false; b.last = i; b.vx = vx; b.vy = vy; b.vz = vz;
  s.think[0] = Math.min(s.think[0], lvOf(s, 0).react); s.think[1] = Math.min(s.think[1], lvOf(s, 1).react);
}

/* ---------- Schüsse und Pässe ---------- */
// Ziel eines Passes: Mitspieler in Stickrichtung, bevorzugt in passender Entfernung und frei
export function passTarget(s, i, dx, dz, power, through) {
  const p = s.pl[i], team = teamOf(i), d = dirOf(s, team);
  let len = hyp(dx, dz); if (len < 0.25) { dx = Math.cos(p.f); dz = Math.sin(p.f); len = 1; } else { dx /= len; dz /= len; }
  const aim = Math.atan2(dz, dx), want = 9 + power * 32;
  let best = -1, bv = -1e9;
  for (let k = 0; k < 11; k++) {
    const j = team * 11 + k; if (j === i) continue;
    const q = s.pl[j], x = q.x + q.vx * 0.5 + (through ? d * 6 : 0), z = q.z + q.vz * 0.5, l = hyp(x - p.x, z - p.z);
    if (l < 3 || l > 55) continue;
    const off = Math.abs(angDiff(aim, Math.atan2(z - p.z, x - p.x))); if (off > 1.15) continue;
    let v = -off * 4.2 - Math.abs(l - want) / 22 + lane(s, team, p.x, p.z, x, z) * 0.9 + Math.min(6, space(s, team, x, z)) * 0.08;
    if (k === 0) v -= 1.6; if (through) v += (q.x - p.x) * d * 0.03;
    if (v > bv) { bv = v; best = j; }
  }
  return { j: best, dx, dz, want };
}
function pressureOn(s, i) { const p = s.pl[i]; return clamp((3.2 - space(s, teamOf(i), p.x, p.z)) / 2.6, 0, 1); }
function doPass(s, i, kind, power, sx, sz) {
  const p = s.pl[i], team = teamOf(i), d = dirOf(s, team), b = s.ball, set = s.ph === 'set' ? s.rs : null, through = kind === 'through';
  const aim = passTarget(s, i, sx, sz, power, through);
  const q = aim.j >= 0 ? s.pl[aim.j] : null;
  let tx, tz;
  const cross = set && set.k === 'corner' && (kind === 'shoot' || !q || Math.abs(q.x) > PITCH.halfL - PITCH.boxDepth);
  if (cross) {
    const gx = Math.sign(set.x) * PITCH.halfL;
    if (kind === 'shoot' || !q) { tx = gx - Math.sign(gx) * (6 + power * 6); tz = clamp(sz * 5, -7, 7) * 0.8; } else { tx = q.x; tz = q.z; }
  } else if (!q) { tx = p.x + aim.dx * aim.want; tz = p.z + aim.dz * aim.want; }
  else {
    let l = dist(p, q); const lead = through ? 5 + power * 8 : 0;
    for (let n = 0; n < 2; n++) {
      const T = l / (through ? 12 : 13);
      tx = q.x + q.vx * T * (through ? 0.6 : 0.75) + d * lead; tz = q.z + q.vz * T * (through ? 0.4 : 0.75);
      l = hyp(tx - p.x, tz - p.z);
    }
  }
  tx = clamp(tx, -PITCH.halfL + 1.5, PITCH.halfL - 1.5); tz = clamp(tz, -PITCH.halfW + 1.2, PITCH.halfW - 1.2);
  let ang = Math.atan2(tz - b.z, tx - b.x); const l = Math.max(2, hyp(tx - b.x, tz - b.z));
  const turn = Math.abs(angDiff(p.f, ang)) / Math.PI, bot = s.bot && s.bot[team] ? lvOf(s, team).aim : 1;
  const err = KICK.passErr * (set ? 0.5 : 1 + pressureOn(s, i) * 1.6 + turn * 1.4 + hyp(p.vx, p.vz) * 0.06 + l / 45) * bot;
  ang += spread(s) * err * 1.7;
  const wob = 1 + spread(s) * err * 0.9, hands = b.hands;
  const lofted = cross || (hands ? true : l > KICK.loftFrom || (set && set.k === 'goalkick' && l > 22) || (!through && l > 18 && lane(s, team, p.x, p.z, tx, tz) < 0.35));
  let v, vy;
  if (lofted) {
    const T = clamp(l / (hands ? 14 : 18), hands ? 0.6 : 0.95, 2.3);
    v = (l * (hands ? 0.97 : 0.9) / T) * (1 + 0.025 * T) * wob; vy = (BALL.g * T) / 2 - (b.y - BALL.r) / T;
    if (hands && set) { v = Math.min(v, 17); vy = Math.min(vy, 7); }
  } else {
    const end = KICK.passEnd + (through ? -1.2 : power * 2);
    v = Math.min(30, Math.sqrt(end * end + 2 * (BALL.roll + BALL.drag * (end + 3)) * l)) * wob; vy = 0; b.y = BALL.r;
  }
  loose(s, i, Math.cos(ang) * v, vy, Math.sin(ang) * v);
  b.x += Math.cos(ang) * 0.25; b.z += Math.sin(ang) * 0.25;
  p.cd = 0.45; p.f = ang;
  s.stats.pas[team]++; s.pass = { team, from: i, to: aim.j, x: tx, z: tz, t: s.t };
  s.shot = null;
  if (aim.j >= 0) {
    const r = s.pl[aim.j]; r.job = JOB.receive; r.tx = tx; r.tz = tz; r.sp = hyp(tx - r.x, tz - r.z) > 3 ? 1 : 0;
    if (!isKeeper(aim.j)) { s.ctl[team] = aim.j; s.lock[team] = { x: sx, z: sz, t: 0.9 }; s.brain[team] = {}; }
  }
  s.swAt[1 - team] = s.t + 0.2;
  event(s, 'pass', { k: i, s: team, p: r2(clamp(v / 30, 0, 1)) });
}
function doShot(s, i, power, sx, sz) {
  const p = s.pl[i], team = teamOf(i), d = dirOf(s, team), b = s.ball, gx = d * PITCH.halfL, keeper = s.pl[(1 - team) * 11];
  const l = hyp(gx - b.x, b.z);
  if (l > 40 || (p.x * d < 0)) {                                   // aus der eigenen Hälfte: Befreiungsschlag
    let dx = hyp(sx, sz) > 0.25 ? sx : d, dz = hyp(sx, sz) > 0.25 ? sz : 0; const n = hyp(dx, dz) || 1; dx /= n; dz /= n;
    const ang = Math.atan2(dz, dx) + spread(s) * 0.15, v = 19 + power * 9;
    loose(s, i, Math.cos(ang) * v, 6 + power * 4, Math.sin(ang) * v); p.cd = 0.45; s.pass = null; s.shot = null; s.swAt[1 - team] = s.t + 0.2;
    event(s, 'shot', { k: i, s: team, p: r2(power) }); return;
  }
  let aimz = Math.abs(sz) > 0.25 ? clamp(sz * 1.4, -1, 1) * 2.95 : (keeper.z > p.z * 0.08 ? -2.7 : 2.7);
  const dxg = gx - b.x, dzg = aimz - b.z;
  const bot = s.bot && s.bot[team] ? lvOf(s, team).aim : 1;
  const turn = Math.abs(angDiff(p.f, Math.atan2(dzg, dxg))) / Math.PI;
  const err = KICK.shotErr * (1 + pressureOn(s, i) * 1.2 + turn * 1.2 + l / 35 + (1 - p.st) * 0.4 + Math.max(0, power - 0.85) * 2.5) * bot;
  const ang = Math.atan2(dzg, dxg) + spread(s) * err * 1.6;
  const v = KICK.shotMin + (KICK.shotMax - KICK.shotMin) * power;
  const T = hyp(dxg, dzg) / (v * 0.94), aimy = 0.25 + power * 1.45 + Math.max(0, power - 0.9) * 5;
  const vy = (aimy - b.y + 0.5 * BALL.g * T * T) / T + spread(s) * err * v * 0.42;
  loose(s, i, Math.cos(ang) * v, Math.max(0, vy), Math.sin(ang) * v);
  p.cd = 0.5; p.f = ang; s.pass = null;
  s.stats.sh[team]++; s.shot = { team, from: i, t: s.t, on: false }; s.kp = [-1, -1];
  s.swAt[1 - team] = s.t + 0.2;
  event(s, 'shot', { k: i, s: team, p: r2(power) });
}
function startKick(s, i, kind, power, x, z) {
  const p = s.pl[i]; if (p.act !== ACT.run) return;
  p.act = s.ball.hands ? ACT.throw : ACT.kick; p.at = 0; p.dur = KICK.windup + 0.25; p.hit = 0;
  const team = teamOf(i); s.brain[team].kick = { i, kind, power, x, z };
  s.chg[team] = { k: '', t: 0 };
}
function strike(s, i) {
  const team = teamOf(i), k = s.brain[team].kick; s.brain[team].kick = null;
  if (!k || k.i !== i || s.ball.own !== i) return;
  const set = s.ph === 'set';
  if (k.kind === 'shoot' && !(set && s.rs.k !== 'kickoff') && !s.ball.hands) doShot(s, i, k.power, k.x, k.z);
  else if (k.kind === 'shoot' && set && s.rs.k === 'corner') doPass(s, i, 'shoot', k.power, k.x, k.z);
  else doPass(s, i, k.kind === 'through' ? 'through' : 'pass', k.power, k.x, k.z);
  if (set) { s.ph = 'play'; s.pt = 0; s.rs = null; s.think[0] = s.think[1] = 0.05; }
}
// Kopfball: wer den hohen Ball erreicht, entscheidet nach Lage auf dem Feld
function header(s, i) {
  const p = s.pl[i], team = teamOf(i), d = dirOf(s, team), b = s.ball;
  endPass(s, i); s.poss = team; p.act = ACT.header; p.at = 0; p.dur = 0.45; p.cd = 0.6; s.shot = null;
  const gd = hyp(d * PITCH.halfL - p.x, p.z);
  if (gd < 15) {
    const aimz = (rand(s) < 0.5 ? -1 : 1) * (1 + rand(s) * 2.2), ang = Math.atan2(aimz - b.z, d * PITCH.halfL - b.x) + spread(s) * 0.22, v = 12 + rand(s) * 5;
    loose(s, i, Math.cos(ang) * v, -1.5 + spread(s) * 2.2, Math.sin(ang) * v);
    s.stats.sh[team]++; s.shot = { team, from: i, t: s.t, on: false }; s.kp = [-1, -1];
  } else if (p.x * d < -20) {
    const ang = (d > 0 ? 0 : Math.PI) + spread(s) * 1.0, v = 10 + rand(s) * 5;
    loose(s, i, Math.cos(ang) * v, 3 + rand(s) * 3, Math.sin(ang) * v);
  } else {
    const aim = passTarget(s, i, d, spread(s), 0.2, false), q = aim.j >= 0 ? s.pl[aim.j] : null;
    const ang = (q ? Math.atan2(q.z - b.z, q.x - b.x) : Math.atan2(aim.dz, aim.dx)) + spread(s) * 0.3, v = 7 + rand(s) * 4;
    loose(s, i, Math.cos(ang) * v, 1 + rand(s) * 2, Math.sin(ang) * v);
  }
  event(s, 'header', { k: i, s: team });
}

/* ---------- Eingaben der geführten Spieler ---------- */
function manualSwitch(s, team) {
  const b = s.ball, path = b.own < 0 ? ballPath(s, 8)[8] : b, list = [];
  for (let k = 1; k < 11; k++) list.push(team * 11 + k);
  list.sort((a, z) => dist(s.pl[a], path) - dist(s.pl[z], path) || a - z);
  const cur = s.ctl[team];
  const next = list[0] !== cur ? list[0] : list[1];
  s.ctl[team] = next; s.man[team] = s.t; s.lock[team] = null; s.chg[team] = { k: '', t: 0 };
  event(s, 'switch', { k: next, s: team });
}
function bestDefender(s, team) {
  const b = s.ball, d = dirOf(s, team);
  const spot = b.own >= 0 ? s.pl[b.own] : s.pass ? s.pass : ballPath(s, 6)[6];
  let best = -1, v = 1e9;
  for (let k = 1; k < 11; k++) {
    const i = team * 11 + k, p = s.pl[i];
    const q = hyp(p.x - spot.x, p.z - spot.z) + ((p.x - spot.x) * d > 1.5 ? 4 : 0) + (p.act === ACT.down || p.act === ACT.slide ? 8 : 0);
    if (q < v) { v = q; best = i; }
  }
  return { i: best, v };
}
function autoSwitch(s, team) {
  if (s.ph !== 'play') return;
  // den Torwart führt man nur, solange er den Ball hat
  if (isKeeper(s.ctl[team]) && s.ball.own !== s.ctl[team]) { const q = s.pass && s.pass.team === team ? s.pass : s.ball; s.ctl[team] = nearest(s, team, q.x, q.z); return; }
  if (ownerTeam(s) === team) return;
  if (s.pass && s.pass.team === team) return;
  const due = s.swAt[team] > 0 && s.t >= s.swAt[team];
  if (!due && s.tick % 20 !== team * 10) return;
  if (due) s.swAt[team] = 0;
  const best = bestDefender(s, team), cur = s.ctl[team], b = s.ball, p = s.pl[cur];
  const spot = b.own >= 0 ? s.pl[b.own] : s.pass ? s.pass : b;
  const gap = isKeeper(cur) ? 99 : dist(p, spot) - best.v;
  if (best.i === cur) return;
  // wer gerade selbst steuert, behält seinen Spieler; nur nach einem Ereignis oder ohne Eingabe wird gewechselt
  if ((due && gap > 2.5 && s.t - s.man[team] > 1.2) || (s.idle[team] > 0.25 && gap > 9 && s.t - s.man[team] > 2.5)) { s.ctl[team] = best.i; s.lock[team] = null; }
}
function control(s, team, inp, dt) {
  const was = s.prev[team], i = s.ctl[team], p = s.pl[i], b = s.ball, has = b.own === i, c = s.chg[team];
  const pressed = (k) => inp[k] && !was[k];
  const any = inp.pass || inp.through || inp.shoot || inp.switch || inp.sprint || inp.x || inp.z;
  s.idle[team] = any ? 0 : s.idle[team] + dt;
  s.press[team] = 0; s.aim[team] = [inp.x, inp.z];
  const l = s.lock[team];
  if (l) {                                       // nach einem Pass führt kurz die Hilfe den Empfänger
    l.t -= dt; const a = hyp(inp.x, inp.z);
    if (l.t <= 0 || has || (a > 0.35 && (hyp(l.x, l.z) < 0.35 || Math.abs(angDiff(Math.atan2(l.z, l.x), Math.atan2(inp.z, inp.x))) > 0.7))) s.lock[team] = null;
  }
  if (pressed('switch') && s.ph === 'play' && !has) manualSwitch(s, team);
  const live = s.ph === 'play' || (s.ph === 'set' && s.rs.team === team && s.pt >= MATCH.setMin);
  // „unterwegs zu mir“: angespielt oder ein eigener Abpraller direkt vor den Füßen
  const incoming = !has && b.own < 0 && s.ph === 'play' && ((s.pass && s.pass.team === team && s.pass.to === i) || (s.poss === team && hyp(p.x - b.x, p.z - b.z) < 3));
  const kick = inp.shoot ? 'shoot' : inp.through ? 'through' : inp.pass ? 'pass' : '';
  if ((has && live && p.act === ACT.run) || (incoming && (kick || c.k))) {
    if (kick) {
      // nur ein frischer Druck beginnt das Aufladen (eine gehaltene Taste schießt nicht von selbst)
      if (!c.k) { if (pressed(kick) || (incoming && !c.k)) { c.k = kick; c.t = 0; } }
      else { if (kick === 'through' && c.k === 'pass') c.k = 'through'; c.t += dt; }
    }
    if (c.k && (!kick || c.t >= KICK.full + 0.6)) {
      const power = clamp(c.t / KICK.full, 0, 1);
      if (has) startKick(s, i, c.k, power, inp.x, inp.z);
      else s.buf[team] = { i, k: c.k, power, x: inp.x, z: inp.z, t: s.t };
      s.chg[team] = { k: '', t: 0 };
    }
  } else {
    if (c.k) s.chg[team] = { k: '', t: 0 };
    if (!has && s.ph === 'play' && !incoming) {
      if (inp.pass) s.press[team] = 1;
      if (pressed('pass') && p.act === ACT.run && p.cd <= 0 && b.own >= 0 && teamOf(b.own) !== team && !b.hands && hyp(p.x - b.x, p.z - b.z) < 2.1) {
        const dx = b.x - p.x, dz = b.z - p.z, n = hyp(dx, dz) || 1; p.vx += (dx / n) * 3; p.vz += (dz / n) * 3; tackle(s, i, 0.1);
      }
      if (pressed('shoot') && p.act === ACT.run && p.cd <= 0 && !isKeeper(i)) slide(s, i, inp.x, inp.z);
    }
  }
  was.pass = inp.pass; was.through = inp.through; was.shoot = inp.shoot; was.switch = inp.switch;
}

/* ---------- Zweikampf ---------- */
function tackle(s, i, bonus) {
  const c = s.ball.own; if (c < 0 || s.t < s.imm) return;
  const o = s.pl[i], p = s.pl[c], dx = o.x - p.x, dz = o.z - p.z, n = hyp(dx, dz) || 1, front = (Math.cos(p.f) * dx + Math.sin(p.f) * dz) / n;
  let q = TACKLE.base + bonus + (front > 0.35 ? TACKLE.front : front < -0.4 ? TACKLE.behind : 0) + (hyp(p.vx, p.vz) > 7 ? TACKLE.sprinting : 0);
  o.cd = TACKLE.cooldown; o.near = 0;
  const team = teamOf(i);
  if (rand(s) < q) {
    s.stats.tkl[team]++; p.cd = 0.55; p.act = ACT.stumble; p.at = 0; p.dur = 0.35; s.chg[teamOf(c)] = { k: '', t: 0 };
    if (rand(s) < 0.6) give(s, i);
    else { const a = Math.atan2(-dz, -dx) + spread(s) * 1.6, v = 4 + rand(s) * 4; loose(s, i, Math.cos(a) * v, 0, Math.sin(a) * v); o.cd = 0.2; s.pass = null; }
    event(s, 'tackle', { k: i, s: team, p: 1 });
  } else { o.act = ACT.stumble; o.at = 0; o.dur = 0.28; event(s, 'tackle', { k: i, s: team, p: 0 }); }
}
function slide(s, i, x, z) {
  const p = s.pl[i]; let dx = x, dz = z; if (hyp(dx, dz) < 0.25) { dx = s.ball.x - p.x; dz = s.ball.z - p.z; }
  const n = hyp(dx, dz) || 1; p.ax = dx / n; p.az = dz / n; p.f = Math.atan2(p.az, p.ax);
  p.act = ACT.slide; p.at = 0; p.dur = TACKLE.slideTime; p.hit = 0; event(s, 'slide', { k: i, s: teamOf(i) });
}
function tackles(s, dt) {
  const b = s.ball, c = b.own; if (c < 0 || b.hands || s.ph !== 'play') return;
  const team = teamOf(c);
  for (let k = 0; k < 11; k++) {
    const i = (1 - team) * 11 + k, o = s.pl[i];
    if (o.act !== ACT.run || o.cd > 0) continue;
    if (hyp(o.x - b.x, o.z - b.z) > TACKLE.reach) { o.near = 0; continue; }
    o.near += dt;
    const human = s.ctl[1 - team] === i && s.idle[1 - team] < 0.35 && !(s.bot && s.bot[1 - team]);
    const wait = human ? 0.18 : 0.12 + lvOf(s, 1 - team).tackleWait;
    if (o.near >= wait) {
      if (k === 0) { if (Math.abs(o.x) > PITCH.halfL - PITCH.boxDepth && Math.abs(o.z) < PITCH.boxHalf && rand(s) < 0.7) { give(s, i, true); o.cd = 0.3; event(s, 'catch', { k: i, s: 1 - team }); } else tackle(s, i, 0.1); }
      else tackle(s, i, 0);
      if (s.ball.own !== c) return;
    }
  }
}

/* ---------- Torhüter ---------- */
function keeper(s, team, dt) {
  const i = team * 11, p = s.pl[i], b = s.ball, d = dirOf(s, team), gx = -d * PITCH.halfL, lv = lvOf(s, team);
  p.job = JOB.support;
  if (b.own === i) { p.tx = p.x; p.tz = p.z; if (s.ph === 'play') { p.tx = clamp(p.x + d * 2, -PITCH.halfL + 1, PITCH.halfL - 1); if (Math.abs(p.x - gx) > 13) p.tx = p.x; } return; }
  if (s.ph === 'set') { const dx = b.x - gx, dz = b.z, l = hyp(dx, dz) || 1, depth = clamp(l * 0.1, 0.8, 3); p.tx = gx + (dx / l) * depth; p.tz = clamp((dz / l) * depth, -3, 3); p.sp = 1; return; }
  const toward = b.vx * -d;                          // Tempo des Balls in Richtung eigenes Tor
  if (b.own < 0 && toward > 7 && Math.abs(b.x - gx) < 38) {
    const tp = (p.x - b.x) / b.vx, tg = (gx - b.x) / b.vx;
    if (tg > 0 && tg < 1.8 && Math.abs(b.z + b.vz * tg) < PITCH.goalHalf + 1.4) {
      if (s.kp[team] < 0) s.kp[team] = s.t;
      if (s.t - s.kp[team] < lv.keeper) { p.sp = 0; p.tx = p.x; p.tz = p.z; return; }
      const when = clamp(tp > 0 ? tp : 0.05, 0.05, 1.6), z = b.z + b.vz * when, y = b.y + b.vy * when - 0.5 * BALL.g * when * when, gap = z - p.z;
      if (p.act === ACT.run && Math.abs(gap) > 0.6 && when < 0.55 && y < 3.0) { p.act = ACT.dive; p.at = 0; p.dur = 0.75; p.az = Math.sign(gap) * Math.min(7.2, Math.abs(gap) / Math.max(0.16, when)); p.ax = 0; p.cd = 0; }
      else { p.tx = p.x; p.tz = z; p.sp = 1; }
      return;
    }
  }
  s.kp[team] = -1;
  const inBox = Math.abs(b.x - gx) < PITCH.boxDepth && Math.abs(b.z) < PITCH.boxHalf - 1;
  if (b.own < 0 && inBox && hyp(b.vx, b.vz) < 13 && !(s.pass && s.pass.team === team && s.pass.to !== i)) {
    const mine = hyp(b.x - p.x, b.z - p.z); let opp = 99;
    for (let k = 1; k < 11; k++) { const q = s.pl[(1 - team) * 11 + k]; opp = Math.min(opp, hyp(b.x - q.x, b.z - q.z)); }
    if (mine < opp + 1.5) { p.tx = b.x + b.vx * 0.25; p.tz = b.z + b.vz * 0.25; p.sp = 1; return; }
  }
  if (b.own >= 0 && teamOf(b.own) !== team && inBox && hyp(b.x - gx, b.z) < 13) {
    const c = s.pl[b.own]; let near = 99; for (let k = 1; k < 11; k++) near = Math.min(near, dist(s.pl[team * 11 + k], c));
    if (near > 2.5 && dist(p, c) < 9 * (0.5 + lv.sense * 0.5)) { p.tx = b.x; p.tz = b.z; p.sp = 1; return; }
  }
  const dx = b.x - gx, dz = b.z, l = hyp(dx, dz) || 1, depth = clamp(l * 0.11, 0.7, 5.5);
  p.tx = gx + (dx / l) * depth; p.tz = clamp((dz / l) * depth * 1.15, -3.4, 3.4); p.sp = hyp(p.tx - p.x, p.tz - p.z) > 2 ? 1 : 0;
}
// Berührt der Ball auf seinem Weg einen Torhüter? Dann Parade, Fangen oder durchgerutscht.
function saves(s, ox, oz) {
  const b = s.ball;
  for (let team = 0; team < 2; team++) {
    const i = team * 11, p = s.pl[i], d = dirOf(s, team), gx = -d * PITCH.halfL;
    if (p.cd > 0 || p.act === ACT.down || b.y > 2.65) continue;
    if (Math.abs(p.x - gx) > PITCH.boxDepth || Math.abs(p.z) > PITCH.boxHalf) continue;
    const dive = p.act === ACT.dive, ext = dive ? Math.sign(p.az) * Math.min(0.9, p.at * 4) : 0;
    const sx = b.x - ox, sz = b.z - oz, len2 = sx * sx + sz * sz;
    let best = 99;
    for (const kz of [p.z, p.z + ext]) { const u = len2 > 0 ? clamp(((p.x - ox) * sx + (kz - oz) * sz) / len2, 0, 1) : 0; best = Math.min(best, hyp(ox + sx * u - p.x, oz + sz * u - kz)); }
    const reach = dive ? 1.05 : 0.95;
    if (best > reach) continue;
    const v = hyp(b.vx, b.vz), shot = s.shot && s.shot.team !== team;
    const own = s.pass && s.pass.team === team;
    if (v < 10 || own) { give(s, i, true); event(s, 'catch', { k: i, s: team }); return true; }
    const q = clamp(1.04 - Math.max(0, v - 15) * 0.017 - (best / reach) * 0.26 - (b.y > 1.7 ? 0.12 : 0), 0.15, 0.97);
    if (shot && !s.shot.on) { s.shot.on = true; s.stats.on[s.shot.team]++; }
    if (rand(s) < q) {
      s.stats.sav[team]++;
      if (v < 21 && rand(s) < 0.6) { give(s, i, true); p.cd = 0.2; event(s, 'save', { k: i, s: team, p: 1 }); }
      else {
        const side = Math.sign(b.z - p.z) || (rand(s) < 0.5 ? -1 : 1);
        endPass(s, -1);
        loose(s, i, d * (v * 0.12 + rand(s) * 4 - 1.2), 2 + rand(s) * 3.5, side * (4 + rand(s) * 7)); p.cd = 0.55;
        b.x = p.x + d * 0.35; s.kp = [-1, -1]; event(s, 'save', { k: i, s: team, p: 0 });
      }
      return true;
    }
    p.cd = 0.5;
  }
  return false;
}

/* ---------- Bewegung ---------- */
export function topSpeed(s, i, sprint) {
  const p = s.pl[i], f = FORMATION[roleOf(i)]; let v = MOVE.speed[f.r];
  if (sprint && p.st > 0.03) v *= MOVE.sprint;
  if (p.st < 0.15) v *= MOVE.tired;
  if (s.ball.own === i) v *= sprint ? MOVE.carry * MOVE.carrySprint + 0.04 : MOVE.carry;
  return v;
}
function steer(s, i, dx, dz, sprint, dt) {
  const p = s.pl[i]; let l = hyp(dx, dz); if (l > 1) { dx /= l; dz /= l; l = 1; }
  const run = sprint && p.st > 0.03 && l > 0.3;
  if (run) p.st = Math.max(0, p.st - MOVE.drain * dt); else p.st = Math.min(1, p.st + MOVE.regen * dt * (l < 0.3 ? 1.7 : 1));
  const top = topSpeed(s, i, run), ex = dx * top - p.vx, ez = dz * top - p.vz, e = hyp(ex, ez);
  const rate = (ex * p.vx + ez * p.vz < 0 ? MOVE.brake : MOVE.accel) * dt;
  if (e > rate) { p.vx += (ex / e) * rate; p.vz += (ez / e) * rate; } else { p.vx += ex; p.vz += ez; }
}
function face(p, a, dt, rate) { p.f += angDiff(p.f, a) * Math.min(1, dt * rate); if (p.f > Math.PI) p.f -= Math.PI * 2; else if (p.f < -Math.PI) p.f += Math.PI * 2; }
function goTo(s, i, tx, tz, sprint, dt, arrive = 1.6) {
  const p = s.pl[i], dx = tx - p.x, dz = tz - p.z, l = hyp(dx, dz);
  if (l < 0.25) return steer(s, i, 0, 0, false, dt);
  let k = Math.min(1, l / arrive);
  if (!sprint && l < 5 && p.job === JOB.slot) k *= 0.7;
  steer(s, i, (dx / l) * k, (dz / l) * k, sprint, dt);
}
function movePlayer(s, i, inputs, dt) {
  const p = s.pl[i], team = teamOf(i), b = s.ball;
  p.cd = Math.max(0, p.cd - dt);
  if (p.act !== ACT.run) {
    p.at += dt;
    if (p.act === ACT.slide) {
      const k = 1 - (p.at / p.dur) * 0.65; p.vx = p.ax * TACKLE.slideSpeed * k; p.vz = p.az * TACKLE.slideSpeed * k;
      if (!p.hit && p.at < p.dur * 0.8 && s.ph === 'play' && !b.hands && b.y < 0.8 && hyp(b.x - p.x - p.ax * 0.5, b.z - p.z - p.az * 0.5) < TACKLE.slideReach && (b.own < 0 || (teamOf(b.own) !== team && s.t >= s.imm))) {
        p.hit = 1;
        if (b.own >= 0) { const c = s.pl[b.own]; c.act = ACT.stumble; c.at = 0; c.dur = 0.55; c.cd = 0.7; s.chg[teamOf(b.own)] = { k: '', t: 0 }; s.stats.tkl[team]++; }
        endPass(s, -1); s.shot = null; s.poss = team;
        const v = 7 + rand(s) * 4, a = Math.atan2(p.az, p.ax) + spread(s) * 0.7; loose(s, i, Math.cos(a) * v, rand(s) * 1.5, Math.sin(a) * v); p.cd = 0.5;
        event(s, 'tackle', { k: i, s: team, p: 1 });
      }
      if (p.at >= p.dur) { p.act = ACT.down; p.at = 0; p.dur = p.hit ? TACKLE.slideDown * 0.6 : TACKLE.slideDown; }
    } else if (p.act === ACT.dive) {
      if (p.at < 0.42) { p.vx *= 0.8; p.vz = p.az; } else { p.vx *= 0.85; p.vz *= 0.85; }
      if (p.at >= p.dur) p.act = ACT.run;
    } else if (p.act === ACT.kick || p.act === ACT.throw) {
      p.vx *= 1 - 3 * dt; p.vz *= 1 - 3 * dt;
      if (!p.hit && p.at >= KICK.windup) { p.hit = 1; strike(s, i); }
      if (p.at >= p.dur) p.act = ACT.run;
    } else {
      if (p.act !== ACT.header) { const f = 1 - Math.min(1, dt * (p.act === ACT.cheer ? 0.8 : 4)); p.vx *= f; p.vz *= f; }
      if (p.at >= p.dur) p.act = ACT.run;
    }
  } else {
    const inp = inputs[team], mine = s.ctl[team] === i && (s.idle[team] < 0.35 || b.own === i) && !s.lock[team];
    const taker = s.ph === 'set' && s.rs.taker === i;
    if (taker) {
      p.vx = p.vz = 0;
      if (mine && hyp(inp.x, inp.z) > 0.3) face(p, Math.atan2(inp.z, inp.x), dt, 8);
    } else if (s.ph === 'goal') {
      goTo(s, i, p.tx, p.tz, false, dt, 3);
    } else if (mine && s.ph !== 'set') {
      if (s.press[team] && b.own >= 0 && teamOf(b.own) !== team && hyp(inp.x, inp.z) < 0.25) { const c = s.pl[b.own]; goTo(s, i, b.x + c.vx * 0.15, b.z + c.vz * 0.15, inp.sprint, dt, 0.8); }
      else steer(s, i, inp.x, inp.z, inp.sprint, dt);
    } else {
      if (p.job === JOB.press && b.own >= 0 && teamOf(b.own) !== team && hyp(b.x - p.x, b.z - p.z) < 3.5) goTo(s, i, b.x, b.z, !!p.sp, dt, 0.5);
      else if (!isKeeper(i) && (p.job === JOB.receive || p.job === JOB.chase) && b.own < 0 && b.y < 1.6 && hyp(b.x - p.x, b.z - p.z) < 3) goTo(s, i, b.x + b.vx * 0.12, b.z + b.vz * 0.12, true, dt, 0.4);
      else goTo(s, i, p.tx, p.tz, !!p.sp, dt);
    }
    const v = hyp(p.vx, p.vz);
    if (!taker) { if (v > 1.2) face(p, Math.atan2(p.vz, p.vx), dt, s.ball.own === i ? 11 : 9); else if (s.ball.own !== i) face(p, Math.atan2(b.z - p.z, b.x - p.x), dt, 6); }
    if (s.ctl[team] === i && s.chg[team].k && hyp(inp.x, inp.z) > 0.3) face(p, Math.atan2(inp.z, inp.x), dt, 10);
  }
  p.x = clamp(p.x + p.vx * dt, -PITCH.halfL - 2, PITCH.halfL + 2);
  p.z = clamp(p.z + p.vz * dt, -PITCH.halfW - 1.5, PITCH.halfW + 1.5);
  if (b.own === i && b.hands && s.ph === 'play' && isKeeper(i)) {        // mit Ball in der Hand bleibt der Torwart im Strafraum
    const gx = -dirOf(s, team) * PITCH.halfL, sg = Math.sign(gx);
    p.x = sg > 0 ? clamp(p.x, gx - PITCH.boxDepth + 0.5, gx - 0.5) : clamp(p.x, gx + 0.5, gx + PITCH.boxDepth - 0.5);
    p.z = clamp(p.z, -PITCH.boxHalf + 0.5, PITCH.boxHalf - 0.5);
  }
}
function separate(s) {
  const min = MOVE.bump;
  for (let a = 0; a < N; a++) {
    const p = s.pl[a];
    for (let z = a + 1; z < N; z++) {
      const q = s.pl[z], dx = q.x - p.x; if (dx > min || dx < -min) continue;
      const dz = q.z - p.z; if (dz > min || dz < -min) continue;
      const l = hyp(dx, dz); if (l >= min) continue;
      const ux = l > 0.01 ? dx / l : 1, uz = l > 0.01 ? dz / l : 0, m = (min - l) * 0.5;
      const pf = s.ph === 'set' && s.rs.taker === a, qf = s.ph === 'set' && s.rs.taker === z;
      if (!pf) { p.x -= ux * m; p.z -= uz * m; } if (!qf) { q.x += ux * m; q.z += uz * m; }
    }
  }
}

/* ---------- Ball im Spiel ---------- */
function goal(s, team) {
  const b = s.ball, shot = s.shot;
  if (shot && shot.team === team && !shot.on) s.stats.on[team]++;
  endPass(s, -1); s.sc[team]++; s.ph = 'goal'; s.pt = 0; s.ko = 1 - team; s.chg = [{ k: '', t: 0 }, { k: '', t: 0 }]; s.buf = [null, null];
  const last = b.last, own = !(shot && shot.team === team) && last >= 0 && teamOf(last) !== team, who = shot && shot.team === team ? shot.from : last;
  if (b.own >= 0) { b.vx = s.pl[b.own].vx; b.vz = s.pl[b.own].vz; b.own = -1; b.hands = false; }
  s.shot = null;
  const hero = who >= 0 && !own ? who : team * 11 + 9, h = s.pl[hero];
  for (let i = 0; i < N; i++) {
    const p = s.pl[i], k = i - hero; if (isKeeper(i)) { p.tx = p.x; p.tz = p.z; continue; }
    if (teamOf(i) === team && i !== hero && dist(p, h) < 30) { p.tx = h.x + Math.cos(k) * 3; p.tz = h.z + Math.sin(k) * 3; }
    else { const [x, z] = kickoffSpot(s, i, s.ko); p.tx = x; p.tz = z; }
    p.job = 0;
  }
  if (!own) { h.act = ACT.cheer; h.at = 0; h.dur = MATCH.goalPause; h.tx = h.x; h.tz = h.z; }
  event(s, 'goal', { k: who, s: team, p: own ? 1 : 0 });
}
function outOfPlay(s, x, z) {
  const b = s.ball, lastTeam = b.last >= 0 ? teamOf(b.last) : s.poss;
  endPass(s, -1); s.shot = null;
  event(s, 'out', { s: lastTeam, x: r2(x), z: r2(z) });
  if (Math.abs(x) <= PITCH.halfL) {
    restart(s, 'throw', 1 - lastTeam, clamp(x, -PITCH.halfL + 1, PITCH.halfL - 1), Math.sign(z) * PITCH.halfW);
  } else {
    const sx = Math.sign(x), defending = dirOf(s, 0) === -sx ? 0 : 1;            // wessen Tor liegt hier?
    if (lastTeam === defending) { s.stats.cor[1 - defending]++; restart(s, 'corner', 1 - defending, sx * (PITCH.halfL - 0.3), (Math.sign(z) || 1) * (PITCH.halfW - 0.3)); }
    else restart(s, 'goalkick', defending, sx * (PITCH.halfL - PITCH.sixDepth), (Math.sign(z) || 1) * 5);
  }
}
function boundaries(s, ox, oy, oz) {
  const b = s.ball;
  if (Math.abs(b.x) > PITCH.halfL + BALL.r) {
    const sx = Math.sign(b.x), line = sx * (PITCH.halfL + BALL.r), u = Math.abs(b.x - ox) > 1e-6 ? clamp((line - ox) / (b.x - ox), 0, 1) : 0;
    const z = oz + (b.z - oz) * u, y = oy + (b.y - oy) * u;
    if (Math.abs(z) < PITCH.goalHalf - BALL.r * 0.5 && y < PITCH.goalH) goal(s, dirOf(s, 0) === sx ? 0 : 1);
    else outOfPlay(s, b.x, z);
    return true;
  }
  if (Math.abs(b.z) > PITCH.halfW + BALL.r) { outOfPlay(s, b.x, b.z); return true; }
  return false;
}
function frame(s) {
  const b = s.ball; if (Math.abs(Math.abs(b.x) - PITCH.halfL) > 0.6 || Math.abs(b.z) > 4.2 || b.y > 3) return;
  const sx = Math.sign(b.x) * PITCH.halfL, R = BALL.r + BALL.postR;
  const hit = (nx, ny, nz, l) => {
    nx /= l; ny /= l; nz /= l; const vn = b.vx * nx + b.vy * ny + b.vz * nz; if (vn >= 0) return;
    b.vx -= 1.65 * vn * nx; b.vy -= 1.65 * vn * ny; b.vz -= 1.65 * vn * nz;
    if (s.shot && !s.shot.on) s.shot.post = true;
    if (-vn > 4) event(s, 'post', { p: r2(clamp(-vn / 25, 0, 1)) });
  };
  if (b.y < PITCH.goalH + R) for (const pz of [-PITCH.goalHalf, PITCH.goalHalf]) { const dx = b.x - sx, dz = b.z - pz, l = hyp(dx, dz); if (l < R && l > 0.001) { hit(dx, 0, dz, l); b.x = sx + (dx / l) * R; b.z = pz + (dz / l) * R; } }
  if (Math.abs(b.z) < PITCH.goalHalf) { const dx = b.x - sx, dy = b.y - PITCH.goalH, l = hyp(dx, dy); if (l < R && l > 0.001) { hit(dx, dy, 0, l); b.x = sx + (dx / l) * R; b.y = PITCH.goalH + (dy / l) * R; } }
}
// Wer erreicht den freien Ball?
function claim(s) {
  const b = s.ball; if (b.y > 2.45) return;
  let best = -1, bv = 99;
  for (let i = 0; i < N; i++) {
    const p = s.pl[i]; if (p.cd > 0 || (p.act !== ACT.run && p.act !== ACT.kick) || isKeeper(i) && Math.abs(p.x) > PITCH.halfL - PITCH.boxDepth && b.y > 1.2) continue;
    const dx = b.x - p.x; if (dx > 1 || dx < -1) continue;
    const receiver = s.pass && s.pass.to === i;
    const v = hyp(dx, b.z - p.z), reach = b.y > 1.35 ? 0.75 : receiver ? 0.98 : 0.78;
    if (v < reach && v - (receiver ? 0.15 : 0) < bv) { bv = v - (receiver ? 0.15 : 0); best = i; }
  }
  if (best < 0) return;
  const p = s.pl[best], team = teamOf(best);
  if (b.y > 1.35) {       // Kopfball nur, wenn es darauf ankommt; freie Spieler lassen den Ball herunterkommen
    const goalNear = hyp(Math.abs(p.x) - PITCH.halfL, p.z) < 15;
    if (goalNear || (b.y > 1.6 && space(s, team, p.x, p.z) < 2)) header(s, best);
    return;
  }
  const rel = hyp(b.vx - p.vx, b.vz - p.vz), receiver = s.pass && s.pass.to === best, mate = s.pass && s.pass.team === team;
  // erster Kontakt: schnelle Bälle prallen ab, Gegner haben es schwerer als der angespielte Mann
  const q = receiver ? clamp(1.38 - rel / 34, 0.45, 1) : mate || !s.pass ? clamp(1.25 - rel / 24, 0.25, 1) : clamp(1.02 - rel / 21 - bv * 0.25 + (lvOf(s, team).sense - 0.75) * 0.18, 0.06, 0.95);
  if (rand(s) < q) {
    if (s.shot && s.shot.team !== team) { s.shot = null; }
    give(s, best);
  } else {
    endPassOnTouch(s, team);
    const a = Math.atan2(b.vz, b.vx) + spread(s) * 1.2, v = hyp(b.vx, b.vz) * (0.3 + rand(s) * 0.35);
    loose(s, best, Math.cos(a) * v, rand(s) * 2, Math.sin(a) * v); p.cd = 0.5; s.poss = team;
  }
}
// Berührt ein Gegner den Pass, ist er noch nicht verloren; erst der nächste Besitz zählt
function endPassOnTouch(s, team) { if (s.pass && s.pass.team !== team) s.pass.to = -1; }

function ball(s, dt) {
  const b = s.ball;
  if (b.own >= 0) {
    const p = s.pl[b.own]; b.held += dt;
    const reach = b.hands ? 0.35 : 0.55 + hyp(p.vx, p.vz) * 0.035;
    const tx = p.x + Math.cos(p.f) * reach, tz = p.z + Math.sin(p.f) * reach, k = Math.min(1, dt * 18);
    const ox = b.x, oz = b.z;
    if (s.ph !== 'set') { b.x += (tx - b.x) * k; b.z += (tz - b.z) * k; }
    b.y = b.hands ? (s.ph === 'set' ? 2.0 : 1.15) : BALL.r; b.vx = p.vx; b.vz = p.vz; b.vy = 0;
    if (s.ph === 'play') {
      if (!b.hands) boundaries(s, ox, b.y, oz);
      else { b.x = clamp(b.x, -PITCH.halfL, PITCH.halfL); if (b.held > 7) startKick(s, b.own, 'pass', 0.8, dirOf(s, teamOf(b.own)), 0); }
    }
    return;
  }
  const n = hyp(b.vx, b.vz) > 12 || Math.abs(b.vy) > 12 ? 3 : 1, h = dt / n;
  for (let k = 0; k < n; k++) {
    const ox = b.x, oy = b.y, oz = b.z;
    integrate(b, h);
    if (s.ph === 'goal') {                       // Ball bleibt im Netz
      const lim = PITCH.halfL + PITCH.goalDepth - BALL.r;
      if (Math.abs(b.x) > lim) { b.x = Math.sign(b.x) * lim; b.vx *= -0.15; b.vz *= 0.5; }
      if (Math.abs(b.x) > PITCH.halfL && Math.abs(b.z) > PITCH.goalHalf - BALL.r) { b.z = Math.sign(b.z) * (PITCH.goalHalf - BALL.r); b.vz *= -0.2; }
      if (Math.abs(b.x) > PITCH.halfL) { b.vx *= 0.96; b.vz *= 0.96; }
      continue;
    }
    if (s.ph !== 'play') continue;
    frame(s);
    if (saves(s, ox, oz) && b.own >= 0) return;
    if (boundaries(s, ox, oy, oz)) return;
    claim(s); if (b.own >= 0) return;
  }
}

/* ---------- Takt ---------- */
function endHalf(s) {
  s.chg = [{ k: '', t: 0 }, { k: '', t: 0 }]; s.buf = [null, null]; s.pass = null; s.shot = null; s.rs = null;
  if (s.half === 1) { s.ph = 'half'; s.pt = 0; s.clock = MATCH.half; s.ball.own = -1; s.ball.vx = s.ball.vy = s.ball.vz = 0; event(s, 'half', {}); }
  else { s.ph = 'over'; s.pt = 0; s.clock = MATCH.half; s.win = s.sc[0] > s.sc[1] ? 0 : s.sc[1] > s.sc[0] ? 1 : -1; s.ball.own = -1; event(s, 'final', { s: s.win }); }
}
function step(s, inputs, dt) {
  if (s.ph === 'over') { for (let i = 0; i < N; i++) { const p = s.pl[i]; p.vx *= 0.9; p.vz *= 0.9; p.x += p.vx * dt; p.z += p.vz * dt; } return; }
  s.tick++; s.t += dt; s.pt += dt;
  const inp = [cleanInput(inputs[0]), cleanInput(inputs[1])];
  if (s.ph === 'half') {
    for (let i = 0; i < N; i++) { s.pl[i].vx = s.pl[i].vz = 0; s.pl[i].act = ACT.run; }
    if (s.pt >= MATCH.halfPause) { s.half = 2; s.clock = 0; s.pt = 0; s.ko = 1 - s.first; for (const p of s.pl) p.st = 1; kickoff(s, s.ko); }
    return;
  }
  if (s.ph === 'goal') {
    for (let i = 0; i < N; i++) movePlayer(s, i, inp, dt);
    separate(s); ball(s, dt);
    if (s.pt >= MATCH.goalPause) { if (s.clock >= MATCH.half) endHalf(s); else { s.pt = 0.001; kickoff(s, s.ko); } }
    return;
  }
  if (s.ph === 'play' || s.rs.k !== 'kickoff') s.clock += dt;
  if (s.clock >= MATCH.half) {
    const danger = s.ph === 'play' && s.shot && s.t - s.shot.t < 1.5;
    if (!danger || s.clock >= MATCH.half + MATCH.stoppage) return endHalf(s);
  }
  if (s.ph === 'play' && s.ball.own >= 0) s.stats.pos[ownerTeam(s)] += dt;
  for (let team = 0; team < 2; team++) { s.think[team] -= dt; if (s.think[team] <= 0) { think(s, team); s.think[team] = lvOf(s, team).think; } }
  for (let team = 0; team < 2; team++) { control(s, team, inp[team], dt); autoSwitch(s, team); }
  keeper(s, 0, dt); keeper(s, 1, dt);
  for (let i = 0; i < N; i++) movePlayer(s, i, inp, dt);
  separate(s);
  if (s.ph === 'set' && s.pt >= MATCH.setAuto) { const t = s.rs.taker; if (s.pl[t].act === ACT.run) { const d = dirOf(s, s.rs.team); startKick(s, t, s.rs.k === 'corner' ? 'shoot' : 'pass', 0.3, s.rs.k === 'throw' ? d * 0.5 : s.rs.k === 'corner' ? 0 : d, s.rs.k === 'throw' ? -Math.sign(s.rs.z) : 0); } }
  ball(s, dt);
  if (s.ph === 'play') {
    tackles(s, dt);
    if (s.shot && s.t - s.shot.t > 2.5) s.shot = null;
    if (s.pass && s.t - s.pass.t > 5) endPass(s, -1);
  }
}

/* ---------- Computergegner ---------- */
// Der Computer bedient nur die Eingaben seines geführten Spielers (wie ein Mensch). Neutrale Eingabe = Mannschaftslogik.
function cpu(s, side) {
  (s.bot || (s.bot = [false, false]))[side] = true;
  const out = { x: 0, z: 0, pass: false, through: false, shoot: false, sprint: false, switch: false };
  if (s.ph !== 'play' && s.ph !== 'set') return out;
  const i = s.ctl[side], p = s.pl[i], b = s.ball, lv = lvOf(s, side), br = s.brain[side], d = dirOf(s, side);
  if (b.own === i) {
    if (s.ph === 'set') {
      if (s.rs.team !== side) return out;
      if (br.at === undefined) br.at = MATCH.setMin + 0.2 + rand(s) * 0.7;
      if (!br.k && s.pt < br.at) return out;
    }
    if (p.act !== ACT.run) return out;
    if (br.k) {
      let x = br.x, z = br.z;
      if (br.j >= 0) { const q = s.pl[br.j], dx = q.x + q.vx * 0.5 + (br.k === 'through' ? d * 6 : 0) - p.x, dz = q.z + q.vz * 0.5 - p.z, n = hyp(dx, dz) || 1; x = dx / n; z = dz / n; }
      out.x = x; out.z = z;
      if (s.t < br.until) out[br.k] = true; else { br.k = null; br.next = s.t + 0.3; }
      return out;
    }
    if (br.next === undefined) br.next = s.t + (b.hands ? 0.6 + rand(s) * 0.8 : lv.react + 0.05);
    if (s.t >= br.next) { decide(s, side, br); br.next = s.t + Math.max(0.12, lv.think); }
    if (br.k) { out[br.k] = true; out.x = br.x; out.z = br.z; return out; }
    if (s.ph === 'set' || b.hands) return out;
    out.x = br.mx === undefined ? d * 0.5 : br.mx; out.z = br.mz || 0; out.sprint = !!br.sp;
    return out;
  }
  // ohne Ball: nur grätschen, wenn der Gegner sonst durchbricht; alles andere erledigt die Mannschaftslogik
  if (s.ph === 'play' && b.own >= 0 && teamOf(b.own) !== side && !b.hands && p.act === ACT.run && p.cd <= 0) {
    const c = s.pl[b.own], gap = hyp(b.x - p.x, b.z - p.z), behind = (p.x - c.x) * d > 0.6;
    if (behind && gap > 1.3 && gap < 2.6 && s.t >= (br.slideAt || 0)) {
      br.slideAt = s.t + 0.8;
      if (rand(s) < 0.12 + lv.sense * 0.2) { out.shoot = true; out.x = (b.x + c.vx * 0.2 - p.x) / gap; out.z = (b.z + c.vz * 0.2 - p.z) / gap; }
    }
  }
  return out;
}
function decide(s, side, br) {
  const i = s.ctl[side], p = s.pl[i], b = s.ball, lv = lvOf(s, side), d = dirOf(s, side), gx = d * PITCH.halfL, set = s.ph === 'set' ? s.rs : null;
  const noise = () => spread(s) * lv.noise;
  const goalDist = hyp(gx - p.x, p.z), pressure = space(s, side, p.x, p.z);
  const act = (k, power, x, z, j = -1) => { br.k = k; br.j = j; br.x = x; br.z = z; br.until = s.t + Math.max(0.04, power * KICK.full); };
  if (set && set.k === 'corner' && rand(s) < 0.8) return act('shoot', rand(s) * 0.7, 0, spread(s));
  // Torschuss
  if (!set && !b.hands && goalDist < lv.shotRange + noise() * 5 && (gx - p.x) * d > 1.5) {
    const open = lane(s, side, p.x + (gx - p.x) * 0.08, p.z * 0.92, gx - d * 4, p.z * 0.2), angle = Math.abs(gx - p.x) / (goalDist || 1);
    const want = (goalDist < 13 ? 0.95 : goalDist < 19 ? 0.6 : 0.28) * (0.35 + open * 0.65) * (angle > 0.4 ? 1 : 0.3) + (br.held > 2 ? 0.2 : 0) + noise() * 0.2;
    if (rand(s) < want) {
      const k = s.pl[(1 - side) * 11], corner = lv.sense > 0.5 ? (k.z > p.z * 0.08 ? -1 : 1) : (rand(s) < 0.5 ? -1 : 1);
      return act('shoot', clamp(0.3 + goalDist / 55 + noise() * 0.25, 0.1, 0.95), d * 0.7, corner * 0.72);
    }
  }
  // Pässe bewerten
  let best = null;
  for (let k = 0; k < 11; k++) {
    const j = side * 11 + k; if (j === i) continue;
    const q = s.pl[j], x = q.x + q.vx * 0.5, z = q.z + q.vz * 0.5, l = hyp(x - p.x, z - p.z);
    if (l < 5 || l > 45) continue;
    const gain = (x - p.x) * d, free = Math.min(7, space(s, side, x, z)), safe = lane(s, side, p.x, p.z, x, z);
    const through = k >= 5 && gain > 4 && q.vx * d > 2.5 && space(s, side, x + d * 8, z) > 5;
    const near = Math.max(0, 30 - hyp(gx - x, z)) * 0.14;
    let v = safe * 5.5 + free * 0.55 + gain * 0.11 + near - Math.max(0, l - 24) * 0.12 - (l < 9 ? 1 : 0) - (k === 0 ? 4 : 0) + noise() * 4.5;
    if (j === br.from) v -= 1.2;
    if (through) v += safe * 1.4;
    if (!best || v > best.v) best = { v, j, l, through, safe, gain };
  }
  // Dribbeln: welche Richtung hat Platz und bringt voran?
  let drib = null;
  const base = Math.atan2(-p.z * (goalDist < 30 ? 1 : 0.15), gx - p.x);
  for (const off of [0, -0.5, 0.5, -1.0, 1.0, -1.7, 1.7, 2.6]) {
    const a = base + off, x = p.x + Math.cos(a) * 5, z = p.z + Math.sin(a) * 5;
    const room = Math.min(space(s, side, p.x + Math.cos(a) * 2.5, p.z + Math.sin(a) * 2.5), space(s, side, x, z));
    let v = Math.min(6, room) * 0.9 + Math.cos(off) * 2.6 + noise() * 1.2;
    if (Math.abs(z) > PITCH.halfW - 2 || Math.abs(x) > PITCH.halfL - 2) v -= 8;
    if (br.a !== undefined) v -= Math.abs(angDiff(br.a, a)) * 0.35;
    if (!drib || v > drib.v) drib = { v, a, room };
  }
  br.a = drib.a; br.mx = Math.cos(drib.a); br.mz = Math.sin(drib.a); br.sp = drib.room > 4.5 && p.st > 0.25;
  br.held = b.held;
  const mustPass = set || b.hands || b.held > 3.2 + rand(s) || (pressure < 2.4 + lv.sense && b.held > lv.react);
  const eager = best && best.v > drib.v + 3.2 - Math.min(2.4, b.held * 1.1) && b.held > 0.25 + lv.react;
  if (best && (mustPass || eager) && (best.safe > 0.25 * lv.sense || set || b.hands)) {
    return act(best.through ? 'through' : 'pass', clamp((best.l - 12) / 34, 0.05, 0.85), (s.pl[best.j].x - p.x) / best.l, (s.pl[best.j].z - p.z) / best.l, best.j);
  }
  if (mustPass && p.x * d < -22 && pressure < 2.8) return act('shoot', 0.5 + rand(s) * 0.4, d, spread(s) * 0.6);         // Befreiungsschlag
  if (set && best) return act('pass', 0.4, (s.pl[best.j].x - p.x) / best.l, (s.pl[best.j].z - p.z) / best.l, best.j);
  if (set || b.hands) return act('pass', 0.6, d, 0);
}

/* ---------- Eingaben und Netz ---------- */
function cleanInput(o) {
  const v = o && typeof o === 'object' ? o : {};
  let x = clamp(num(v.x), -1, 1), z = clamp(num(v.z), -1, 1); const l = hyp(x, z); if (l > 1) { x /= l; z /= l; }
  return { x: r2(x), z: r2(z), pass: v.pass === true, through: v.through === true, shoot: v.shoot === true, sprint: v.sprint === true, switch: v.switch === true };
}
const STAT_KEYS = ['pas', 'cmp', 'sh', 'on', 'pos', 'sav', 'tkl', 'cor'];
function pack(s) {
  const c = (v) => Math.round(v * 100), p = [];
  for (const q of s.pl) p.push(c(q.x), c(q.z), Math.round(q.vx * 10), Math.round(q.vz * 10), c(q.f), q.act, Math.min(999, c(q.at)), c(q.st));
  const b = s.ball, r = s.rs, e = [];
  for (const v of s.events) if (s.t - v.t < 0.5) e.push([v.id, EVENTS.indexOf(v.type), v.k, v.s, Math.round(v.x * 10), Math.round(v.z * 10), c(v.p), c(v.t)]);
  const st = []; for (const k of STAT_KEYS) st.push(Math.round(s.stats[k][0]), Math.round(s.stats[k][1]));
  return {
    v: 1, h: [PHASES.indexOf(s.ph), c(s.pt), s.half, c(s.clock), s.sc[0], s.sc[1], s.ctl[0], s.ctl[1], s.ko, s.tick, s.eventId, s.win === null ? 9 : s.win, c(s.t)],
    b: [c(b.x), c(b.y), c(b.z), c(b.vx), c(b.vy), c(b.vz), b.own, b.last, b.hands ? 1 : 0],
    p, r: r ? [RESTARTS.indexOf(r.k), r.team, r.taker, c(r.x), c(r.z)] : 0,
    c: [KINDS.indexOf(s.chg[0].k), c(s.chg[0].t), KINDS.indexOf(s.chg[1].k), c(s.chg[1].t)], s: st, e
  };
}
const ints = (a, ranges) => Array.isArray(a) && a.length === ranges.length && a.every((v, i) => Number.isInteger(v) && v >= ranges[i][0] && v <= ranges[i][1]);
const R = (n) => [-n, n], U = (n) => [0, n];
const H_RANGE = [U(4), U(100000), [1, 2], U(100000), U(99), U(99), U(21), U(21), U(1), U(1e9), U(1e9), [-1, 9], U(1e8)];
const B_RANGE = [R(7000), [-100, 20000], R(5000), R(10000), R(10000), R(10000), [-1, 21], [-1, 21], U(1)];
const P_RANGE = [R(7000), R(5000), R(300), R(300), R(630), U(8), U(999), U(100)];
const PL_RANGE = Array.from({ length: N }, () => P_RANGE).flat();
const E_RANGE = [U(1e9), U(EVENTS.length - 1), [-1, 21], [-1, 3], R(800), R(500), [-200, 200], U(1e8)];
function unpack(d) {
  if (!d || typeof d !== 'object' || d.v !== 1) return null;
  const { h, b, p, r, c, s: st, e } = d;
  if (!ints(h, H_RANGE) || !ints(b, B_RANGE) || !ints(p, PL_RANGE)) return null;
  if (h[11] > 1 && h[11] !== 9) return null;
  if (r !== 0 && !ints(r, [U(3), U(1), U(21), R(7000), R(5000)])) return null;
  if (h[0] === 0 && r === 0) return null;
  if (!ints(c, [[-1, 2], U(1000), [-1, 2], U(1000)]) || !ints(st, Array.from({ length: STAT_KEYS.length * 2 }, () => U(100000)))) return null;
  if (!Array.isArray(e) || e.length > 12 || !e.every((v) => ints(v, E_RANGE))) return null;
  const pl = [];
  for (let i = 0; i < N; i++) { const o = i * 8; pl.push({ x: p[o] / 100, z: p[o + 1] / 100, vx: p[o + 2] / 10, vz: p[o + 3] / 10, f: p[o + 4] / 100, act: p[o + 5], at: p[o + 6] / 100, st: p[o + 7] / 100 }); }
  const stats = {}; STAT_KEYS.forEach((k, i) => { stats[k] = [st[i * 2], st[i * 2 + 1]]; });
  return {
    ph: PHASES[h[0]], pt: h[1] / 100, half: h[2], clock: h[3] / 100, sc: [h[4], h[5]], ctl: [h[6], h[7]], ko: h[8], tick: h[9], eventId: h[10], win: h[11] === 9 ? null : h[11], t: h[12] / 100,
    ball: { x: b[0] / 100, y: b[1] / 100, z: b[2] / 100, vx: b[3] / 100, vy: b[4] / 100, vz: b[5] / 100, own: b[6], last: b[7], hands: !!b[8] },
    pl, rs: r === 0 ? null : { k: RESTARTS[r[0]], team: r[1], taker: r[2], x: r[3] / 100, z: r[4] / 100 },
    chg: [{ k: KINDS[c[0]] || '', t: c[1] / 100 }, { k: KINDS[c[2]] || '', t: c[3] / 100 }], stats,
    events: e.map((v) => ({ id: v[0], type: EVENTS[v[1]], k: v[2], s: v[3], x: v[4] / 10, z: v[5] / 10, p: v[6] / 100, t: v[7] / 100 }))
  };
}
function lerp(a, b, t) {
  if (!a || !b) return b || a;
  const mix = (u, v) => (Math.abs(v - u) > 4 ? v : u + (v - u) * t);          // Sprünge (Anstoß, Ecke) nicht verschleifen
  const pl = b.pl.map((q, i) => { const p = a.pl[i]; return Object.assign({}, q, { x: mix(p.x, q.x), z: mix(p.z, q.z), f: p.f + angDiff(p.f, q.f) * t }); });
  const ball = Object.assign({}, b.ball, { x: mix(a.ball.x, b.ball.x), y: mix(a.ball.y, b.ball.y), z: mix(a.ball.z, b.ball.z) });
  return Object.assign({}, b, { pl, ball });
}

export const sim = { create, step, cpu: (s, side) => cpu(s, side), cleanInput, pack, unpack, lerp, score: (s) => s.sc.slice(), winner: (s) => (s.ph === 'over' ? s.win : null) };
