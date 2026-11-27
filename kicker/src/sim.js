// Spiellogik von Neon Kicker: Physik, Regeln und Computergegner. Ohne Grafik und DOM, läuft auch in Node.
// Fester Takt 60 Hz mit Zwischenschritten; Zufall kommt nur aus dem Startwert im Zustand.
import { emit } from './kit/realtime.js';
import { TABLE, BALL, FIG, RODS, OWN, SLIDE, SPIN_ROD, SHOT, TRAP, MATCH, CPU } from './config.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const HL = TABLE.L / 2, HW = TABLE.W / 2, GH = TABLE.goalHalf, R = BALL.r, REACH = FIG.hx + FIG.round + R;
export const dirOf = (side) => (side === 0 ? 1 : -1);
function rand(s) { s.rng = Math.imul(s.rng, 48271) >>> 0; s.rng = (s.rng % 2147483647) || 1; return s.rng / 2147483647; }
const footX = (rod, a) => RODS[rod].x + dirOf(RODS[rod].side) * Math.sin(a) * FIG.leg;

/* ---------- Hilfen für Wahl und Reichweite ---------- */
// Welche eigene Stange (0..3) ist für den Ball zuständig? Die vorderste, die den Ball noch vor sich oder in Reichweite hat.
export function bestRod(ball, side) {
  const d = dirOf(side), u = ball.x * d + clamp(ball.vx * d * 0.16, -1.6, 0.5);
  let best = 0;
  for (let i = 0; i < 4; i++) if (RODS[OWN[side][i]].x * d <= u + 0.9) best = i;
  return best;
}
// Figur einer Stange, die am wenigsten schieben muss, um auf Höhe y zu kommen
export function nearestFigure(rod, y, rodY) {
  const f = RODS[rod].fig, range = RODS[rod].range;
  let best = 0, cost = 1e9;
  for (let i = 0; i < f.length; i++) {
    const need = y - f[i], over = Math.max(0, Math.abs(need) - range), c = over * 10 + Math.abs(clamp(need, -range, range) - rodY);
    if (c < cost) { cost = c; best = i; }
  }
  return best;
}
export function reachable(ball) {
  for (let i = 0; i < RODS.length; i++) {
    const r = RODS[i];
    if (Math.abs(ball.x - r.x) > FIG.leg * 0.88 + REACH - 0.05) continue;
    for (const f of r.fig) if (Math.abs(ball.y - f) <= r.range + FIG.hy + FIG.round + R * 0.6) return true;
  }
  return false;
}

/* ---------- Anlegen ---------- */
const newRod = () => ({ y: 0, vy: 0, a: 0, w: 0, m: 0, mt: 0, p: 0, hit: false, cd: 0, up: false });
const newCtl = () => ({ rod: 2, k: 0, pend: 0, pp: 0 });
const newBrain = () => ({ x: 0, y: 0, vx: 0, vy: 0, age: 9, rod: 2, want: 2, wt: 0, y1: 0, k: 0, p: 0.5, err: 0, near: 0, cool: 0.5, trap: 0, aim: 0, miss: false });

function throwIn(s, to) {
  const from = rand(s) < 0.5 ? -1 : 1;
  s.ball = { x: (rand(s) - 0.5) * 0.5, y: from * (HW - R), vx: 0, vy: 0, s: 0 };
  s.phase = 'in'; s.wait = MATCH.throwWait; s.hold = null; s.slow = 0; s.zx = 0; s.zt = 0;
  s.bias = to === 0 ? -1 : to === 1 ? 1 : rand(s) < 0.5 ? -1 : 1;
  emit(s, 'throw');
}

function create(seed, opts) {
  const s = {
    rng: ((seed >>> 0) % 2147483646) + 1, level: (opts && opts.level) || 'normal',
    t: 0, time: MATCH.time, golden: false, phase: 'in', wait: 0, score: [0, 0], win: null,
    ball: null, rods: RODS.map(newRod), hold: null, ctl: [newCtl(), newCtl()], brain: [newBrain(), newBrain()],
    slow: 0, zx: 0, zt: 0, bias: 1, snd: 0, events: [], eventId: 0
  };
  for (let i = 0; i < 8; i++) rand(s);
  throwIn(s, null);
  return s;
}

function cleanInput(i) {
  const o = i && typeof i === 'object' ? i : {};
  return {
    on: o.on === true,
    r: clamp(Math.round(num(o.r, 2)), 0, 3),
    y: clamp(num(o.y), -1, 1),
    w: clamp(num(o.w), 0, 1),
    k: clamp(Math.round(num(o.k)), 0, 65535),
    p: clamp(num(o.p), 0, 1),
    t: o.t === true
  };
}

/* ---------- Schießen ---------- */
// Liegt der Ball (jetzt oder gleich) vor einem Fuß dieser Stange? Ergebnis: Wartezeit bis dahin (0 = sofort)
function kickDelay(s, i) {
  const r = RODS[i], rod = s.rods[i], d = dirOf(r.side), b = s.ball;
  for (let t = 0; t <= SHOT.buffer + 1e-9; t += SHOT.buffer / 8) {
    const rel = (b.x + b.vx * t - r.x) * d, y = b.y + b.vy * t;
    if (rel > -0.95 && rel < 1.05 && r.fig.some((f) => Math.abs(y - rod.y - f) < 0.6)) {
      const back = SPIN_ROD.windMax * 0.6 / SPIN_ROD.backSpeed;           // Zeit, die das Ausholen ohnehin braucht
      return Math.max(0, t - back);
    }
  }
  return 0;
}
function startKick(s, i, p) {
  const rod = s.rods[i];
  rod.m = 1; rod.p = p; rod.hit = false;
  rod.mt = s.hold && s.hold.r === i ? 0 : kickDelay(s, i);
}
// Ball mit einem Schuss losschicken
function shoot(s, i, fig, p) {
  const r = RODS[i], rod = s.rods[i], d = dirOf(r.side), b = s.ball;
  const foot = (SPIN_ROD.strikeMin + SPIN_ROD.strikeAdd * p) * FIG.leg;
  const speed = Math.min(BALL.max, Math.max(SHOT.min + SHOT.add * p, foot * 0.8));
  const off = clamp((b.y - (rod.y + r.fig[fig])) / 0.55, -1, 1);
  let lat = off * SHOT.offset + (rod.vy / speed) * SHOT.rodPush;
  // sanfte Zielhilfe: ein Stück in Richtung Tor
  const dx = Math.max(1, (d * HL - b.x) * d), aim = clamp((clamp(b.y, -GH * 0.7, GH * 0.7) - b.y) / dx, -0.8, 0.8);
  lat += (aim - lat) * SHOT.assist + (rand(s) - 0.5) * SHOT.noise * 2;
  lat = clamp(lat, -1.25, 1.25);
  const n = Math.hypot(1, lat);
  b.vx = (d * speed) / n; b.vy = (lat * speed) / n; b.s = clamp(rod.vy * SHOT.spin, -5, 5) * d;
  rod.hit = true; s.slow = 0;
  emit(s, 'kick', { side: r.side, p: Math.round(p * 100) / 100, x: Math.round(b.x * 100) / 100, y: Math.round(b.y * 100) / 100 });
}

/* ---------- Stangen ---------- */
function assistGoal(s, i) {
  const rod = s.rods[i], b = s.ball, f = nearestFigure(i, b.y, rod.y);
  return clamp(b.y - RODS[i].fig[f], -RODS[i].range, RODS[i].range);
}
function moveRod(s, i, input, h) {
  const r = RODS[i], rod = s.rods[i], d = dirOf(r.side), active = input.on && OWN[r.side][input.r] === i;
  // Schieben
  let goal, max;
  if (active) { goal = input.y * r.range; max = SLIDE.max; }
  else { goal = assistGoal(s, i); max = s.brain[r.side].cpu ? CPU[s.level].assist : SLIDE.assist; }
  const want = clamp((goal - rod.y) * (active ? SLIDE.follow : 7), -max, max);
  rod.vy += clamp(want - rod.vy, -SLIDE.acc * h, SLIDE.acc * h);
  rod.y += rod.vy * h;
  if (Math.abs(rod.y) > r.range) { rod.y = Math.sign(rod.y) * r.range; rod.vy = 0; }
  // Drehen
  const before = rod.a;
  if (rod.cd > 0) rod.cd -= h;
  if (rod.m === 1) {                                              // ausholen
    const back = -(0.5 + 0.6 * rod.p);
    if (rod.a > back) rod.a = Math.max(back, rod.a - SPIN_ROD.backSpeed * h);
    rod.mt -= h;
    if (rod.a <= back + 1e-6 && rod.mt <= 0) { rod.m = 2; if (s.hold && s.hold.r === i) { const f = s.hold.f; s.hold = null; rod.cd = TRAP.cool; shoot(s, i, f, rod.p); } }
  } else if (rod.m === 2) {                                       // durchziehen
    rod.a += (SPIN_ROD.strikeMin + SPIN_ROD.strikeAdd * rod.p) * h;
    if (rod.a >= SPIN_ROD.end) { rod.a = SPIN_ROD.end; rod.m = 3; rod.mt = SPIN_ROD.follow; }
  } else if (rod.m === 3) {                                       // ausschwingen
    rod.mt -= h;
    if (rod.mt <= 0) { rod.m = 0; rod.hit = false; rod.w = 0; }
  } else {
    let to = 0;
    const b = s.ball, rel = (b.x - r.x) * d;
    if (s.hold && s.hold.r === i) to = s.hold.s > 0 ? Math.asin(TRAP.front / FIG.leg) : -Math.asin(TRAP.back / FIG.leg);
    else if (active && input.w > 0.02) to = -SPIN_ROD.windMax * input.w;
    else if (active && input.t) to = TRAP.lean;
    else if (!active && rel < -0.25 && rel > -3.4 && b.vx * d > 5) to = -1.35;   // eigenen Schuss durchlassen
    rod.up = to < -0.5;                                          // bewusst angehoben
    rod.w += (SPIN_ROD.k * (to - rod.a) - SPIN_ROD.c * rod.w) * h;
    rod.a += rod.w * h;
    return;
  }
  rod.w = (rod.a - before) / h;
}

/* ---------- Ball ---------- */
function sound(s, type, data) { if (s.snd <= 0) { s.snd = 0.05; emit(s, type, data); } }
// Zusammenstoß Ball gegen den Fuß einer Figur. Gibt true bei Berührung zurück.
function hitFigure(s, i, f) {
  const r = RODS[i], rod = s.rods[i], b = s.ball, d = dirOf(r.side);
  if (Math.abs(rod.a) > FIG.lift) return false;
  const cx = footX(i, rod.a), cy = rod.y + r.fig[f];
  const striking = rod.m === 2 && !rod.hit;
  const grow = striking ? 0.09 : 0;
  const dx = b.x - cx, dy = b.y - cy;
  if (Math.abs(dx) > REACH + grow || Math.abs(dy) > FIG.hy + FIG.round + R + grow) return false;
  const qx = clamp(dx, -FIG.hx, FIG.hx), qy = clamp(dy, -FIG.hy, FIG.hy);
  let nx = dx - qx, ny = dy - qy, dist = Math.hypot(nx, ny);
  const min = FIG.round + R;
  if (dist >= min + grow) return false;
  if (rod.m >= 2 && rod.hit) return false;                       // gerade selbst abgeschossen
  if (striking) { shoot(s, i, f, rod.p); return true; }
  if ((rod.m === 1 || (rod.m === 0 && rod.up)) && rod.w < -3 && dx * d < 0) return false;   // beim Ausholen hebt der Fuß über den Ball
  if (dist < 1e-6) { if (FIG.hx - Math.abs(dx) < FIG.hy - Math.abs(dy)) { nx = dx < 0 ? -1 : 1; ny = 0; } else { nx = 0; ny = dy < 0 ? -1 : 1; } dist = 1; const depth = nx ? FIG.hx - Math.abs(dx) + min : FIG.hy - Math.abs(dy) + min; b.x += nx * depth; b.y += ny * depth; }
  else { nx /= dist; ny /= dist; b.x += nx * (min - dist); b.y += ny * (min - dist); }
  // An der Bande eingeklemmt: längs ausweichen statt durch die Figur
  if (Math.abs(b.y) > HW - R) {
    b.y = Math.sign(b.y) * (HW - R);
    const side = dx !== 0 ? Math.sign(dx) : d, ey = b.y - cy, gap = Math.max(0, Math.abs(ey) - FIG.hy);
    if (gap < min) b.x = cx + side * (FIG.hx + Math.sqrt(min * min - gap * gap) + 0.002);
    nx = side; ny = 0;
  }
  const vfx = d * Math.cos(rod.a) * rod.w * FIG.leg, vfy = rod.vy;
  const vn = (b.vx - vfx) * nx + (b.vy - vfy) * ny;
  if (vn < 0) {
    const e = Math.abs(vn) > 2 ? FIG.bounce : 0.1;
    b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
    // Reibung: bewegte Stange nimmt den Ball mit und gibt Effet
    const tx = -ny, ty = nx, vt = (b.vx - vfx) * tx + (b.vy - vfy) * ty, grip = clamp(-vt * 0.22, -3, 3);
    b.vx += tx * grip; b.vy += ty * grip;
    b.s = clamp(b.s * 0.4 + vfy * 0.22 * nx, -5, 5);
    if (-vn > 1.6) sound(s, 'hit', { side: r.side, p: Math.round(Math.min(1, -vn / 16) * 100) / 100, x: Math.round(b.x * 100) / 100, y: Math.round(b.y * 100) / 100 });
  }
  return true;
}
function walls(s) {
  const b = s.ball;
  if (Math.abs(b.y) > HW - R) {
    const side = Math.sign(b.y); b.y = side * (HW - R);
    if (b.vy * side > 0) { if (Math.abs(b.vy) > 1.8) sound(s, 'wall', { p: Math.round(Math.min(1, Math.abs(b.vy) / 16) * 100) / 100, x: Math.round(b.x * 100) / 100, y: Math.round(b.y * 100) / 100 }); b.vy = -b.vy * BALL.wall; b.vx = b.vx * 0.97 + b.s * 0.12; b.s *= 0.5; }
  }
  const ex = Math.sign(b.x) || 1;
  if (Math.abs(b.x) > HL - R) {
    if (Math.abs(b.y) >= GH) {                                    // Stirnbande neben dem Tor
      if (Math.abs(b.x) <= HL + 0.001 || Math.abs(b.y) > GH + R) {
        b.x = ex * (HL - R);
        if (b.vx * ex > 0) { if (Math.abs(b.vx) > 1.8) sound(s, 'wall', { p: Math.round(Math.min(1, Math.abs(b.vx) / 16) * 100) / 100, x: Math.round(b.x * 100) / 100, y: Math.round(b.y * 100) / 100 }); b.vx = -b.vx * BALL.wall; b.s *= 0.5; }
      }
    }
    // Pfosten
    const py = (Math.sign(b.y) || 1) * GH, dx = b.x - ex * HL, dy = b.y - py, dist = Math.hypot(dx, dy), min = R + TABLE.post;
    if (dist < min && dist > 1e-6) {
      const nx = dx / dist, ny = dy / dist, vn = b.vx * nx + b.vy * ny;
      b.x += nx * (min - dist); b.y += ny * (min - dist);
      if (vn < 0) { b.vx -= 1.75 * vn * nx; b.vy -= 1.75 * vn * ny; if (-vn > 2) sound(s, 'post', { x: Math.round(b.x * 100) / 100, y: Math.round(b.y * 100) / 100 }); }
    }
    if (Math.abs(b.x) > HL && Math.abs(b.y) > GH - R * 0.35) b.y = Math.sign(b.y) * (GH - R * 0.35);
  }
}
function releaseHold(s, push) {
  const h = s.hold; if (!h) return;
  const rod = s.rods[h.r], d = dirOf(RODS[h.r].side), b = s.ball;
  b.vx = d * h.s * push; b.vy = clamp(rod.vy * 0.95, -12, 12); s.hold = null; rod.cd = TRAP.cool;
}
function tryTrap(s, inputs) {
  const b = s.ball;
  if (s.hold || Math.hypot(b.vx, b.vy) > TRAP.speed) return;
  for (let k = 0; k < 2; k++) {
    const input = inputs[k]; if (!input.on || !input.t) continue;
    const i = OWN[k][input.r], r = RODS[i], rod = s.rods[i];
    if (rod.m !== 0 || rod.cd > 0 || Math.abs(b.x - r.x) > TRAP.reachX || input.w > 0.3) continue;
    for (let f = 0; f < r.fig.length; f++) {
      const dy = b.y - rod.y - r.fig[f];
      if (Math.abs(dy) > TRAP.reachY) continue;
      s.hold = { r: i, f, s: (b.x - r.x) * dirOf(k) >= 0 ? 1 : -1, t: 0, dy: clamp(dy, -0.3, 0.3) };
      b.s = 0; s.slow = 0; emit(s, 'trap', { side: k, x: Math.round(b.x * 100) / 100, y: Math.round(b.y * 100) / 100 });
      return;
    }
  }
}
function carry(s, h) {
  const hold = s.hold, r = RODS[hold.r], rod = s.rods[hold.r], b = s.ball, d = dirOf(r.side);
  const tx = r.x + d * (hold.s > 0 ? TRAP.front : -TRAP.back);
  hold.dy *= Math.exp(-2.5 * h);
  const ty = clamp(rod.y + r.fig[hold.f] + hold.dy, -(HW - R), HW - R);
  // weich heranziehen, nie springen
  const mx = clamp(tx - b.x, -14 * h, 14 * h), my = clamp(ty - b.y, -22 * h, 22 * h);
  b.x = clamp(b.x + mx, -(HL - R), HL - R); b.y += my; b.vx = 0; b.vy = rod.vy;
}
function moveBall(s, h) {
  const b = s.ball;
  if (s.hold) {
    carry(s, h);
    // Der Gegner darf stören
    const holder = RODS[s.hold.r].side, x = b.x, y = b.y;
    for (let i = 0; i < RODS.length; i++) {
      if (RODS[i].side === holder || Math.abs(RODS[i].x - b.x) > 1.5) continue;
      for (let f = 0; f < RODS[i].fig.length; f++) if (Math.abs(s.rods[i].w) + Math.abs(s.rods[i].vy) > 1.5 && hitFigure(s, i, f)) { s.rods[s.hold.r].cd = TRAP.cool; s.hold = null; return; }
    }
    b.x = x; b.y = y;
    return;
  }
  // Schräge in den Ecken: dort kommt sonst keine Figur hin
  if (Math.abs(b.x) > 5.5 && Math.abs(b.y) > 2.35) { b.vx -= Math.sign(b.x) * 2.6 * h; b.vy -= Math.sign(b.y) * 3.2 * h; }
  if (b.s) {
    const a = b.s * BALL.spinTurn * h, c = Math.cos(a), n = Math.sin(a), vx = b.vx * c - b.vy * n;
    b.vy = b.vx * n + b.vy * c; b.vx = vx; b.s *= Math.exp(-BALL.spinFade * h); if (Math.abs(b.s) < 0.02) b.s = 0;
  }
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > 0) { const next = Math.max(0, Math.min(BALL.max, sp) - (BALL.drag * sp + BALL.roll) * h); b.vx *= next / sp; b.vy *= next / sp; }
  b.x += b.vx * h; b.y += b.vy * h;
  walls(s);
  for (let i = 0; i < RODS.length; i++) {
    if (Math.abs(RODS[i].x - b.x) > FIG.leg + REACH + 0.1) continue;
    for (let f = 0; f < RODS[i].fig.length; f++) hitFigure(s, i, f);
  }
  walls(s);
}

/* ---------- Ablauf ---------- */
function finish(s, winner) { s.win = winner; s.phase = 'end'; s.hold = null; emit(s, 'end', { side: winner }); }
function clock(s, dt) {
  s.time = Math.max(0, s.time - dt);
  if (s.time > 0) return;
  if (s.score[0] !== s.score[1]) finish(s, s.score[0] > s.score[1] ? 0 : 1);
  else if (!s.golden) { s.golden = true; s.time = MATCH.golden; emit(s, 'golden'); }
  else finish(s, -1);
}
function goal(s, side) {
  s.score[side]++; s.hold = null; s.phase = 'goal'; s.wait = MATCH.goalWait; s.conceded = 1 - side;
  const b = s.ball;
  emit(s, 'goal', { side, x: Math.round(b.x * 100) / 100, y: Math.round(b.y * 100) / 100 });
  b.x = Math.sign(b.x) * (HL + 0.45); b.vx = b.vy = b.s = 0;
  if (s.score[side] >= MATCH.goals || s.golden) finish(s, side);
}
function step(s, inputs, dt) {
  if (s.win !== null) return;
  s.t += dt;
  if (s.snd > 0) s.snd -= dt;
  const ins = [cleanInput(inputs[0]), cleanInput(inputs[1])];
  // Schusswünsche annehmen (mit kurzem Eingabepuffer)
  for (let k = 0; k < 2; k++) {
    const input = ins[k], c = s.ctl[k];
    if (c.pend > 0) c.pend -= dt;
    if (!input.on) continue;
    if (c.rod !== input.r) { if (s.hold && s.hold.r === OWN[k][c.rod]) releaseHold(s, 0.6); c.rod = input.r; c.pend = 0; }
    if (input.k && input.k !== c.k) { c.k = input.k; c.pend = SHOT.buffer; c.pp = input.p; }
    const i = OWN[k][input.r];
    if (c.pend > 0 && s.rods[i].m === 0) { c.pend = 0; startKick(s, i, c.pp); }
  }
  if (s.hold) {
    const side = RODS[s.hold.r].side, input = ins[side], busy = s.rods[s.hold.r].m !== 0;
    s.hold.t += dt;
    if (!busy && (!input.on || !input.t || s.hold.t > TRAP.max)) releaseHold(s, s.hold.t > TRAP.max ? 2.2 : 0.9);
  }
  const h = dt / MATCH.substeps;
  for (let n = 0; n < MATCH.substeps; n++) {
    for (let i = 0; i < RODS.length; i++) moveRod(s, i, ins[RODS[i].side], h);
    if (s.phase !== 'play') continue;
    moveBall(s, h);
    if (Math.abs(s.ball.x) > HL + R * 0.75 && Math.abs(s.ball.y) < GH) { goal(s, s.ball.x > 0 ? 0 : 1); if (s.win !== null) return; }
  }
  if (s.phase === 'goal') { s.wait -= dt; if (s.wait <= 0) throwIn(s, s.conceded); return; }
  if (s.phase === 'in') {
    s.wait -= dt;
    if (s.wait <= 0) { s.phase = 'play'; const b = s.ball; b.vy = -Math.sign(b.y) * (4.2 + rand(s) * 1.6); b.vx = s.bias * (0.35 + rand(s) * 0.8); emit(s, 'drop'); }
  } else {
    tryTrap(s, ins);
    // Ball darf nie dauerhaft unerreichbar liegen oder in einem Bereich festhängen
    const b = s.ball, sp = Math.hypot(b.vx, b.vy);
    if (!s.hold && sp < 0.45) s.slow += dt; else s.slow = 0;
    if (Math.abs(b.x - s.zx) > 1.9) { s.zx = b.x; s.zt = 0; } else s.zt += dt;
    if (s.slow > MATCH.stuck || (s.slow > MATCH.unreachable && !reachable(b)) || s.zt > MATCH.zone || !Number.isFinite(b.x + b.y)) throwIn(s, null);
  }
  clock(s, dt);
}

/* ---------- Computergegner ---------- */
function reflectY(y) { const m = HW - R, p = 4 * m; let v = ((y + m) % p + p) % p; return v > 2 * m ? 3 * m - v : v - m; }
// Der Computer sieht den Ball nur alle "react" Sekunden und mit Fehler; dazwischen schätzt er.
function cpu(s, side, level, dt) {
  const L = CPU[level] || CPU.normal, m = s.brain[side], b = s.ball, d = dirOf(side);
  m.cpu = true; m.age += dt; m.cool -= dt;
  if (m.age >= L.react) {
    m.x = b.x + (rand(s) - 0.5) * L.error * 0.8; m.y = b.y + (rand(s) - 0.5) * L.error * 0.6;
    m.vx = b.vx * (1 + (rand(s) - 0.5) * L.error); m.vy = b.vy * (1 + (rand(s) - 0.5) * L.error);
    m.age = rand(s) * L.react * 0.25;
  }
  const px = clamp(m.x + m.vx * m.age * L.lead, -HL, HL), py = reflectY(m.y + m.vy * m.age * L.lead);
  const holding = s.hold && RODS[s.hold.r].side === side ? s.hold : null;
  const choice = holding ? RODS[holding.r].role : bestRod({ x: px, vx: m.vx }, side);
  if (choice !== m.want) { m.want = choice; m.wt = 0; } else m.wt += dt;
  if (m.rod !== m.want && m.wt >= L.switch) {
    m.rod = m.want; const i = OWN[side][m.rod]; m.y1 = s.rods[i].y; m.near = 0; m.err = (rand(s) - 0.5) * L.error * 2; m.aim = 0;
  }
  const i = OWN[side][m.rod], r = RODS[i], rod = s.rods[i];
  // Wo wird der Ball die Stange kreuzen?
  let ty = py;
  if ((r.x - px) * m.vx > 0 && Math.abs(m.vx) > 2) { const t = Math.min(0.6, (r.x - px) / m.vx); ty = py + (reflectY(py + m.vy * t) - py) * L.lead; }
  const rel = (px - r.x) * d, slow = Math.hypot(m.vx, m.vy) < 6;
  if (!m.aim || m.near === 0) m.aim = (rand(s) < 0.5 ? -1 : 1) * L.aim * (0.1 + rand(s) * 0.2);
  const offset = slow && Math.abs(rel) < 1.2 ? m.aim : 0;
  const f = nearestFigure(i, ty, rod.y), goalY = clamp(ty - r.fig[f] - offset + m.err, -r.range, r.range);
  if (!holding) m.y1 += clamp(goalY - m.y1, -L.speed * dt, L.speed * dt);
  else {                                                           // mit geklemmtem Ball seitlich zielen
    const aimY = clamp((m.aim > 0 ? 1 : -1) * 1.6 - r.fig[holding.f], -r.range, r.range);
    m.y1 += clamp(aimY - m.y1, -L.speed * 0.45 * dt, L.speed * 0.45 * dt);
  }
  const figY = rod.y + r.fig[nearestFigure(i, py, rod.y)];
  const inReach = rel > -0.92 && rel < 0.95 && Math.abs(py - figY) < 0.52 + L.error * 0.3;
  m.near = inReach ? m.near + dt : 0;
  if (m.trap > 0) {
    m.trap -= dt;
    if (holding && m.trap < 0.25 && m.cool <= 0) { m.k = (m.k % 65535) + 1; m.p = L.power[0] + rand(s) * (L.power[1] - L.power[0]); m.cool = L.cool; m.trap = 0.2; }
  } else if (inReach && m.near >= L.hesitate && m.cool <= 0 && s.phase === 'play') {
    if (L.trap && slow && rand(s) < L.trap) { m.trap = 0.55 + rand(s) * 0.7; }
    else if (rand(s) < L.miss) { m.cool = L.cool * 0.5; }
    else { m.k = (m.k % 65535) + 1; m.p = L.power[0] + rand(s) * (L.power[1] - L.power[0]); m.cool = L.cool * (0.8 + rand(s) * 0.5); }
    m.near = 0;
  }
  return { on: true, r: m.rod, y: m.y1 / r.range, w: 0, k: m.k, p: m.p, t: m.trap > 0 };
}

/* ---------- Netz ---------- */
const q = (v, f = 1000) => Math.round(v * f) / f;
function pack(s) {
  return {
    t: q(s.t), tm: q(s.time), g: s.golden ? 1 : 0, ph: s.phase, wt: q(s.wait), sc: [s.score[0], s.score[1]], win: s.win,
    b: [q(s.ball.x), q(s.ball.y), q(s.ball.vx, 100), q(s.ball.vy, 100), q(s.ball.s, 100)],
    r: s.rods.map((o) => [q(o.y), q(o.vy, 100), q(o.a), q(o.w, 10), o.m]),
    h: s.hold ? [s.hold.r, s.hold.f] : 0, c: [s.ctl[0].rod, s.ctl[1].rod],
    ev: s.events.map((e) => Object.assign({}, e)), ei: s.eventId
  };
}
const PHASES = ['in', 'play', 'goal', 'end'];
// Netzdaten: nur Zahlen in sinnvollen Grenzen (auch 1e308 ist Unsinn und würde beim Weiterrechnen zu Unendlich)
const finite = (a, n, max = 1e5) => Array.isArray(a) && a.length === n && a.every((v) => typeof v === 'number' && Math.abs(v) <= max);
const EVENT_MAX = 12, cleanEvent = (e) => { const o = {}; for (const k of Object.keys(e).slice(0, EVENT_MAX)) { const v = e[k]; if ((typeof v === 'number' && Math.abs(v) <= 1e5) || typeof v === 'boolean' || (typeof v === 'string' && v.length <= 24) || v === null) o[k] = v; } return o; };
function unpack(d) {
  if (!d || typeof d !== 'object' || !finite([d.t, d.tm, d.wt, d.ei], 4) || !PHASES.includes(d.ph) || !finite(d.sc, 2) || !finite(d.b, 5, 1000) || !finite(d.c, 2)) return null;
  if (!(d.win === null || d.win === 0 || d.win === 1 || d.win === -1)) return null;
  if (!d.sc.every((v) => Number.isInteger(v) && v >= 0 && v <= 99) || !d.c.every((v) => Number.isInteger(v) && v >= 0 && v <= 3)) return null;
  if (Math.abs(d.b[0]) > HL + 1 || Math.abs(d.b[1]) > HW + 0.5) return null;
  if (!Array.isArray(d.r) || d.r.length !== RODS.length || !d.r.every((o, i) => finite(o, 5, 1000) && Math.abs(o[0]) <= RODS[i].range + 0.01 && Math.abs(o[2]) < 4)) return null;
  if (!(d.h === 0 || (finite(d.h, 2) && RODS[d.h[0]] && RODS[d.h[0]].fig[d.h[1]] !== undefined))) return null;
  if (!Array.isArray(d.ev) || d.ev.length > 12 || !d.ev.every((e) => e && typeof e.type === 'string' && Number.isInteger(e.id))) return null;
  return {
    t: d.t, time: d.tm, golden: !!d.g, phase: d.ph, wait: d.wt, score: [d.sc[0], d.sc[1]], win: d.win,
    ball: { x: d.b[0], y: d.b[1], vx: d.b[2], vy: d.b[3], s: d.b[4] },
    rods: d.r.map((o) => ({ y: o[0], vy: o[1], a: o[2], w: o[3], m: o[4] })),
    hold: d.h ? { r: d.h[0], f: d.h[1] } : null, ctl: [{ rod: d.c[0] }, { rod: d.c[1] }],
    events: d.ev.map(cleanEvent), eventId: d.ei
  };
}
function lerp(a, b, t) {
  if (!a || !b) return b || a;
  const m = (x, y) => x + (y - x) * t, jump = Math.abs(b.ball.x - a.ball.x) + Math.abs(b.ball.y - a.ball.y) > 3;
  return Object.assign({}, b, {
    ball: jump ? b.ball : Object.assign({}, b.ball, { x: m(a.ball.x, b.ball.x), y: m(a.ball.y, b.ball.y) }),
    rods: b.rods.map((o, i) => Object.assign({}, o, { y: m(a.rods[i].y, o.y), a: m(a.rods[i].a, o.a) }))
  });
}

export const sim = { create, step, cpu, cleanInput, pack, unpack, lerp, score: (s) => s.score, winner: (s) => s.win };
