// Kampflogik ohne Grafik und DOM. Fester Takt, Zufall nur aus dem Startwert, Zustand reines JSON.
import { emit } from './kit/realtime.js';
import { MATCH, RING, PUNCH, BODY, FIGHT, DOWN, CPU } from './config.js';

export const TYPES = ['jab', 'cross', 'hook', 'upper'];
export const PHASES = ['intro', 'fight', 'down', 'rest', 'over'];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const approach = (v, to, step) => (v < to ? Math.min(to, v + step) : Math.max(to, v - step));
function rnd(o, key = 'rng') { o[key] = (Math.imul(o[key], 48271) >>> 0) % 2147483647 || 1; return o[key] / 2147483647; }

function fighter() {
  return {
    hp: FIGHT.hp, st: FIGHT.stamina, max: FIGHT.stamina,
    lean: 0, duck: 0, step: 0,
    guard: 0, low: 0, gt: 9, pcd: 0,                 // Deckung an, tief, Zeit seit Hochnehmen, Parade-Sperre
    act: null,                                        // { k, t, hand, body, done, miss }
    queue: null, rest: 0,                             // gepufferter Schlag, Pause bis Ausdauer wieder steigt
    stun: 0, counter: 0, hurt: 0, hx: 0,              // Benommenheit, Konterfenster, Trefferanzeige, Richtung
    downs: 0, roundDowns: 0, combo: 0, comboT: 0,
    prev: {},
    stats: { thrown: 0, landed: 0, power: 0, counters: 0, parries: 0, evades: 0, damage: 0, knockdowns: 0 },
    round: { damage: 0, landed: 0, knockdowns: 0 }
  };
}

function create(seed) {
  return {
    t: 0, phase: 'intro', pt: 0, round: 1, clock: MATCH.roundTime, gap: RING.startGap,
    f: [fighter(), fighter()], down: null, cards: [], win: null, how: '',
    rng: (seed % 2147483646) + 1, bot: [null, null], events: [], eventId: 0
  };
}

function cleanInput(i) {
  i = i || {};
  const o = { x: clamp(num(i.x), -1, 1), y: clamp(num(i.y), -1, 1), block: !!i.block, duck: !!i.duck, body: !!i.body, side: i.side === -1 ? -1 : 1 };
  for (const k of TYPES) o[k] = !!i[k];
  o.at = clamp(num(i.at), 0, 1e5);                       // Spielzeit, die man beim Drücken der Deckung gesehen hat
  return o;
}

const tired = (p) => p.st < FIGHT.tiredAt;
export const windOf = (a) => PUNCH[a.k].wind * a.slow;
export const backOf = (a) => PUNCH[a.k].back * a.slow * (a.miss ? FIGHT.whiffBack : 1);
const busy = (p) => !!p.act || p.stun > 0;

function startPunch(s, who, k, body, side) {
  const p = s.f[who], d = PUNCH[k];
  if (p.st < 1) { emit(s, 'gassed', { side: who }); return; }
  const slow = (tired(p) ? FIGHT.tiredSlow : 1) * (s.pace || 1), weak = tired(p);
  const hand = k === 'jab' ? -1 : k === 'hook' ? side : 1;          // -1 Führhand (links), 1 Schlaghand
  p.act = { k, t: 0, hand, body: body ? 1 : 0, done: 0, miss: 0, slow, weak: weak ? 1 : 0 };
  p.st = Math.max(0, p.st - d.cost); p.rest = FIGHT.regenDelay; p.stats.thrown++;
  emit(s, 'swing', { side: who, k });
}

// Der Schlag kommt an: Reichweite, Ausweichen, Parade, Deckung, Treffer
function land(s, who) {
  const a = s.f[who], d = s.f[1 - who], act = a.act, P = PUNCH[act.k], foe = 1 - who;
  act.done = 1;
  const whiff = (why) => {
    act.miss = 1; a.st = Math.max(0, a.st - P.cost * FIGHT.whiffCost); a.combo = 0;
    if (why === 'slip' || why === 'duck') { d.counter = FIGHT.counterWindow; d.stats.evades++; emit(s, 'evade', { side: foe, k: act.k, how: why === 'slip' ? 0 : 1 }); }
    else emit(s, 'whiff', { side: who, k: act.k });
  };
  if (s.gap > P.range) return whiff('far');
  if (!act.body) {
    if (P.line === 'straight' && (Math.abs(d.lean) >= FIGHT.slipAt || d.duck >= FIGHT.duckAt)) return whiff(d.duck >= FIGHT.duckAt ? 'duck' : 'slip');
    if (P.line === 'hook' && d.duck >= FIGHT.duckAt) return whiff('duck');
    if (P.line === 'upper' && Math.abs(d.lean) >= FIGHT.slipAt) return whiff('slip');
  }
  let dmg = P.dmg * (act.body ? BODY.dmg : 1) * (act.weak ? FIGHT.tiredDmg : 1);
  // Parade: Deckung im letzten Moment hochgenommen, in der richtigen Höhe
  const guarding = d.guard && d.stun <= 0 && !d.act;
  const rightHeight = !!d.low === !!act.body;
  if (guarding && rightHeight && d.gt <= FIGHT.parryWindow && P.line !== 'upper') {
    a.stun = FIGHT.parryStun; a.act.miss = 1; a.combo = 0; d.counter = FIGHT.counterWindow + 0.2; d.stats.parries++;
    emit(s, 'parry', { side: foe, k: act.k });
    return;
  }
  if (guarding && !(P.line === 'upper' && !act.body && !rightHeight)) {
    const share = rightHeight ? (act.body ? FIGHT.guardBody : FIGHT.guardHead) : FIGHT.guardWrong;
    const through = dmg * share * (P.line === 'upper' ? 1.6 : 1);
    d.st = Math.max(0, d.st - dmg * FIGHT.guardCost); d.rest = FIGHT.regenDelay; d.hp = Math.max(1, d.hp - through * 0.6);
    if (d.st <= 0) { d.stun = 0.5; d.guard = 0; emit(s, 'break', { side: foe }); }
    a.combo = 0; emit(s, 'block', { side: foe, k: act.k, body: act.body });
    return;
  }
  // Sauberer Treffer
  const counter = a.counter > 0, open = !!d.act && !d.act.done;
  if (counter) { dmg *= FIGHT.counterDmg; a.stats.counters++; a.counter = 0; }
  else if (open) dmg *= FIGHT.openDmg;
  const into = P.line === 'hook' && !act.body && d.lean * act.hand > 0.35;      // in den Haken gelehnt
  if (into) dmg *= FIGHT.intoHook;
  const heavy = dmg >= FIGHT.stunDmg;
  d.hp = Math.max(0, d.hp - dmg * (act.body ? 0.6 : 1)); d.hurt = 0.35; d.hx = P.line === 'hook' ? act.hand : 0;
  if (act.body) { d.max = Math.max(35, d.max - dmg * BODY.drain * 0.45); d.st = Math.max(0, Math.min(d.max, d.st - dmg * BODY.drain)); }
  if (heavy || counter) { d.stun = Math.max(d.stun, FIGHT.stunBig); d.act = null; d.queue = null; } else if (open) d.act.miss = 1;
  d.combo = 0; a.combo = a.comboT > 0 ? a.combo + 1 : 1; a.comboT = 0.9;
  a.stats.landed++; a.round.landed++; a.stats.damage += dmg; a.round.damage += dmg; if (act.k !== 'jab') a.stats.power++;
  emit(s, 'hit', { side: who, k: act.k, body: act.body, p: Math.round(dmg * 10) / 10, counter: counter ? 1 : 0, combo: a.combo, hand: act.hand });
  const chin = act.body ? BODY.chin : 1;
  if (d.hp <= 0 || (d.hp < FIGHT.rockedHp * chin && dmg >= FIGHT.downHit)) knockdown(s, foe);
}

function knockdown(s, who) {
  const d = s.f[who], a = s.f[1 - who];
  d.downs++; d.roundDowns++; d.hp = 0; d.act = null; d.queue = null; d.stun = 0; d.guard = 0;
  a.stats.knockdowns++; a.round.knockdowns++;
  const level = Math.min(DOWN.need.length - 1, d.downs - 1);
  s.phase = 'down'; s.pt = 0;
  s.down = { who, count: 0, level, hits: 0, need: DOWN.need[level], m: 0, dir: 1, zone: 0.5, lock: 0, tko: d.roundDowns >= DOWN.tko ? 1 : 0 };
  s.down.zone = 0.25 + rnd(s) * 0.5;
  emit(s, 'down', { side: who, tko: s.down.tko });
}

function finish(s, win, how) { s.phase = 'over'; s.pt = 0; s.win = win; s.how = how; emit(s, 'over', { side: win < 0 ? 0 : win, how }); }

// Drei Punktrichter: 10 zu 9, Niederschläge zählen je einen Punkt Abzug
function scoreRound(s) {
  const [x, y] = [s.f[0].round, s.f[1].round];
  const card = [];
  for (let j = 0; j < 3; j++) {
    const bias = (rnd(s) - 0.5) * 6;
    const diff = (x.damage - y.damage) + (x.landed - y.landed) * 0.8 + bias;
    let a = 10, b = 10;
    if (Math.abs(diff) > 2.5) { if (diff > 0) b = 9; else a = 9; }
    a -= y.knockdowns; b -= x.knockdowns;
    card.push([Math.max(7, a), Math.max(7, b)]);
  }
  s.cards.push(card);
}
export function totals(s) {
  return [0, 1, 2].map((j) => s.cards.reduce((t, r) => [t[0] + r[j][0], t[1] + r[j][1]], [0, 0]));
}
function decision(s) {
  let a = 0, b = 0; for (const [x, y] of totals(s)) { if (x > y) a++; else if (y > x) b++; }
  finish(s, a >= 2 ? 0 : b >= 2 ? 1 : -1, a === 3 || b === 3 ? 'einstimmig' : a >= 2 || b >= 2 ? 'geteilt' : 'unentschieden');
}

function endRound(s) {
  scoreRound(s); emit(s, 'bell', { end: 1 });
  if (s.round >= MATCH.rounds) return decision(s);
  s.phase = 'rest'; s.pt = 0;
  for (const p of s.f) { p.act = null; p.queue = null; p.stun = 0; p.guard = 0; }
}
function startRound(s) {
  s.round++; s.clock = MATCH.roundTime; s.phase = 'intro'; s.pt = 0; s.gap = RING.startGap; s.down = null;
  for (const p of s.f) {
    p.hp = Math.min(FIGHT.hp, p.hp + (FIGHT.hp - p.hp) * 0.4); p.max = Math.min(FIGHT.stamina, p.max + 12); p.st = p.max;
    p.lean = 0; p.duck = 0; p.hurt = 0; p.counter = 0; p.combo = 0; p.roundDowns = 0; p.round = { damage: 0, landed: 0, knockdowns: 0 };
  }
}

// Aufstehen: Marke läuft hin und her, im Zeitfenster Deckung drücken
function stepDown(s, inputs, dt) {
  const D = s.down, who = D.who, p = s.f[who], press = inputs[who].block && !p.prev.block;
  D.m += D.dir * DOWN.speed[D.level] * dt;
  if (D.m > 1) { D.m = 2 - D.m; D.dir = -1; } else if (D.m < 0) { D.m = -D.m; D.dir = 1; }
  D.lock = Math.max(0, D.lock - dt);
  // Wer verzögert zuschaut, wird an der Marke gemessen, die beim Drücken zu sehen war
  let mark = D.m;
  const late = inputs[who].at > 0 ? clamp(s.t - inputs[who].at, 0, DOWN.rewind) : 0;
  if (late > 0) { let u = (D.dir > 0 ? D.m : 2 - D.m) - DOWN.speed[D.level] * late; u = ((u % 2) + 2) % 2; mark = u <= 1 ? u : 2 - u; }
  const a = s.f[1 - who]; if (a.act) { a.act.t += dt; if (a.act.t >= windOf(a.act) + backOf(a.act)) a.act = null; }      // der Schlagarm kommt zurück
  if (press && !D.tko && D.lock <= 0) {
    if (Math.abs(mark - D.zone) <= DOWN.width[D.level] / 2) { D.hits++; D.zone = 0.15 + rnd(s) * 0.7; emit(s, 'getup', { side: who, ok: 1 }); D.lock = 0.18; }
    else { D.hits = Math.max(0, D.hits - 1); D.lock = 0.4; emit(s, 'getup', { side: who, ok: 0 }); }
  }
  s.pt += dt;
  const c = Math.floor(s.pt / DOWN.tick);
  if (c > D.count) { D.count = c; if (c <= DOWN.count) emit(s, 'count', { n: c, side: who }); }
  if (D.tko && D.count >= 3) return finish(s, 1 - who, 'tko');
  if (!D.tko && D.hits >= D.need && D.count < DOWN.count) {
    p.hp = DOWN.hp[D.level]; p.st = p.max; p.hurt = 0; p.stun = 0;
    s.phase = 'fight'; s.pt = 0; s.gap = RING.startGap; s.down = null; s.f[1 - who].act = null; s.f[1 - who].combo = 0;
    emit(s, 'up', { side: who });
    return;
  }
  if (D.count >= DOWN.count) finish(s, 1 - who, 'ko');
}

function step(s, inputs, dt) {
  if (s.phase === 'over') { s.t += dt; s.pt += dt; return; }
  s.t += dt;
  const remember = () => { for (let i = 0; i < 2; i++) { const q = inputs[i]; s.f[i].prev = { block: q.block, jab: q.jab, cross: q.cross, hook: q.hook, upper: q.upper }; } };
  if (s.phase === 'intro') { s.pt += dt; if (s.pt >= MATCH.intro) { s.phase = 'fight'; s.pt = 0; emit(s, 'bell', { end: 0 }); } return remember(); }
  if (s.phase === 'rest') { s.pt += dt; if (s.pt >= MATCH.rest) startRound(s); return remember(); }
  if (s.phase === 'down') { for (const p of s.f) { p.hurt = Math.max(0, p.hurt - dt); p.lean = approach(p.lean, 0, 4 * dt); p.duck = approach(p.duck, 0, 4 * dt); } stepDown(s, inputs, dt); return remember(); }

  s.pt += dt; s.clock = Math.max(0, s.clock - dt);
  // 1  Haltung, Beine, Deckung
  let move = 0;
  for (let i = 0; i < 2; i++) {
    const p = s.f[i], q = inputs[i], stunned = p.stun > 0;
    p.stun = Math.max(0, p.stun - dt); p.counter = Math.max(0, p.counter - dt); p.hurt = Math.max(0, p.hurt - dt); p.pcd = Math.max(0, p.pcd - dt);
    p.comboT = Math.max(0, p.comboT - dt); if (p.comboT <= 0) p.combo = 0;
    const free = !stunned && !p.act;
    p.lean = approach(p.lean, stunned ? 0 : (Math.abs(q.x) > 0.35 ? Math.sign(q.x) : 0), FIGHT.lean * dt);
    p.duck = approach(p.duck, !stunned && q.duck ? 1 : 0, FIGHT.duck * dt);
    const wants = q.block && !stunned;
    if (wants && !p.prev.block) { if (p.pcd <= 0) p.gt = 0; else p.gt = 9; p.pcd = FIGHT.parryCooldown; }   // schnelles Hämmern gibt keine Parade
    p.gt += dt; p.guard = wants && free ? 1 : 0; p.low = q.body ? 1 : 0;
    p.step = free && !p.guard ? -q.y : free ? -q.y * 0.5 : 0;                        // oben = vor
    move += p.step * (tired(p) ? 0.7 : 1);
    if (!busy(p) && !p.guard) { p.rest = Math.max(0, p.rest - dt); if (p.rest <= 0) p.st = Math.min(p.max, p.st + FIGHT.regen * dt); }
    else if (p.guard) { p.rest = Math.max(0, p.rest - dt); if (p.rest <= 0) p.st = Math.min(p.max, p.st + FIGHT.regenGuard * dt); }
  }
  s.gap = clamp(s.gap - move * RING.stepSpeed * dt, RING.minGap, RING.maxGap);
  // 2  Schläge annehmen (mit Puffer) und fortführen. Reihenfolge wechselt, damit keine Seite bevorzugt ist
  const order = (Math.floor(s.t * 60) % 2) ? [1, 0] : [0, 1];
  for (const i of order) {
    const p = s.f[i], q = inputs[i];
    for (const k of TYPES) if (q[k] && !p.prev[k]) p.queue = { k, body: q.body ? 1 : 0, side: q.side, t: FIGHT.buffer };
    if (p.queue) {
      // Kombination: während des Zurücknehmens darf der nächste Schlag mit der anderen Hand früher beginnen
      const chain = p.act && p.act.done && !p.act.miss && p.act.t >= windOf(p.act) + backOf(p.act) * 0.45 && p.queue.k !== p.act.k;
      if ((!p.act || chain) && p.stun <= 0) { const n = p.queue; p.queue = null; p.guard = 0; startPunch(s, i, n.k, n.body, n.side); }
      else { p.queue.t -= dt; if (p.queue.t <= 0) p.queue = null; }
    }
  }
  for (const i of order) {
    if (s.phase !== 'fight') break;
    const p = s.f[i]; if (!p.act) continue;
    p.act.t += dt;
    if (!p.act.done && p.act.t >= windOf(p.act)) land(s, i);
    if (p.act && p.act.t >= windOf(p.act) + backOf(p.act)) p.act = null;
  }
  remember();
  if (s.phase === 'fight' && s.clock <= 0) endRound(s);
}

/* ---------- Computergegner ---------- */
// Sieht nur, was auch ein Mensch sieht, und erst nach seiner Reaktionszeit.
function cpu(s, side, level, dt) {
  const L = CPU[level] || CPU.normal, me = s.f[side], foe = s.f[1 - side];
  const b = s.bot[side] || (s.bot[side] = { rng: (s.rng ^ (side + 1) * 7919) % 2147483646 + 1, def: null, see: 0, next: 0.8, plan: [], press: 0, hold: 0, getupAt: -1, seen: -1 });
  const out = { x: 0, y: 0, block: false, duck: false, body: false, side: 1 };
  const R = () => rnd(b);
  if (s.phase === 'down' && s.down.who === side) {
    const D = s.down;
    if (b.seen !== D.hits * 100 + D.count) { b.seen = D.hits * 100 + D.count; b.getupAt = R(); }
    const near = Math.abs(D.m - D.zone) < DOWN.width[D.level] * 0.3;
    b.press = Math.max(0, b.press - dt);
    if (near && b.press <= 0 && D.lock <= 0) { b.press = 0.5; out.block = R() < L.getup * (1 - D.level * 0.14); }
    return out;
  }
  if (s.phase !== 'fight') return out;
  // Abwehr: neuen Schlag bemerken, nach der Reaktionszeit entscheiden
  if (foe.act && !foe.act.done) {
    if (!b.def) {
      const will = R() < L.guard * (me.st < 12 ? 0.5 : 1), smart = R() < L.smart;
      b.def = { at: L.react * (0.85 + R() * 0.3), will, smart, roll: R(), side: R() < 0.5 ? -1 : 1, t: 0 };
    }
    b.def.t += dt;
  } else if (b.def) { b.def.t += dt; if (b.def.t > b.def.at + 0.45) b.def = null; }
  if (b.def && b.def.will && b.def.t >= b.def.at && foe.act && !me.act) {
    const k = foe.act.k, body = foe.act.body, line = PUNCH[k].line;
    if (!b.def.smart) { out.block = true; out.body = b.def.roll < 0.3; }
    else if (body) { out.block = true; out.body = true; }
    else if (line === 'hook') { if (b.def.roll < 0.55) out.duck = true; else out.block = true; }
    else if (line === 'upper') { if (b.def.roll < 0.7) out.x = b.def.side; else out.block = true; }
    else { if (b.def.roll < 0.4) out.x = b.def.side; else out.block = true; }
    return out;
  }
  // Beine: Arbeitsabstand, bei Müdigkeit oder angeschlagen Abstand
  const worn = me.st < L.keep || me.hp < 22;
  const want = worn ? 2.0 : 1.28 + (me.hp < foe.hp ? 0.12 : 0);
  out.y = s.gap > want + 0.1 ? -1 : s.gap < want - 0.2 ? 1 : 0;
  // Konter
  if (me.counter > 0 && !me.act && R() < L.counter * dt * 9) b.plan = [s.gap < 1.3 ? 'hook' : 'cross'];
  b.next -= dt;
  if (!b.plan.length && b.next <= 0 && !worn) {
    b.next = (0.35 + R() * 1.3) / L.rate;
    const open = foe.stun > 0 || (foe.act && foe.act.done);
    const pool = s.gap <= PUNCH.upper.range ? ['jab', 'hook', 'upper', 'hook', 'cross'] : s.gap <= PUNCH.hook.range ? ['jab', 'cross', 'hook', 'jab'] : ['jab', 'jab', 'cross'];
    const first = open ? pool[pool.length - 2] : pool[Math.floor(R() * pool.length)];
    b.plan = [first]; if (R() < L.combo) b.plan.push(first === 'jab' ? 'cross' : 'jab'); if (R() < L.combo * 0.5) b.plan.push('hook');
    b.bodyPlan = foe.guard && !foe.low && R() < L.smart ? 1 : R() < 0.18 ? 1 : 0;
  }
  if (b.plan.length) {
    const k = b.plan[0];
    if (s.gap > PUNCH[k].range) { out.y = -1; b.hold += dt; if (b.hold > 0.9) { b.plan = []; b.hold = 0; } }
    else if (!me.act || (me.act.done && me.act.k !== k)) { if (!me.prev[k]) { out[k] = true; out.body = !!b.bodyPlan; out.side = R() < 0.6 ? -1 : 1; b.plan.shift(); b.hold = 0; } }
    return out;
  }
  // Ruhephase: Deckung, wenn der Gegner in Reichweite ist
  if (s.gap < 1.5 && R() < L.guard * 0.5) out.block = !!me.prev.block || R() < dt * 2.5;
  return out;
}

/* ---------- Netz und Anzeige ---------- */
const r2 = (v) => Math.round(v * 100) / 100;
function pack(s) {
  return {
    t: r2(s.t), ph: s.phase, pt: r2(s.pt), rd: s.round, cl: r2(s.clock), g: r2(s.gap), win: s.win, how: s.how,
    f: s.f.map((p) => [r2(p.hp), r2(p.st), r2(p.max), r2(p.lean), r2(p.duck), r2(p.step), p.guard, p.low, r2(p.stun), r2(p.counter), r2(p.hurt), p.hx, p.downs, p.combo,
      p.act ? [TYPES.indexOf(p.act.k), r2(p.act.t), p.act.hand, p.act.body, p.act.done, p.act.miss, r2(p.act.slow), p.act.weak] : 0,
      Object.values(p.stats).map(r2)]),
    d: s.down ? [s.down.who, s.down.count, s.down.level, s.down.hits, s.down.need, r2(s.down.m), s.down.dir, r2(s.down.zone), s.down.tko] : 0,
    c: s.cards, ev: s.events.map((e) => Object.assign({}, e)), ei: s.eventId
  };
}
const within = (v, a, b) => typeof v === 'number' && v >= a && v <= b;
const STAT_KEYS = ['thrown', 'landed', 'power', 'counters', 'parries', 'evades', 'damage', 'knockdowns'];
function unpack(d) {
  try {
    if (!d || !PHASES.includes(d.ph) || !within(d.t, 0, 1e5) || !within(d.pt, 0, 1e4) || !within(d.rd, 1, MATCH.rounds) || !within(d.cl, 0, 999) || !within(d.g, 0.5, 3)) return null;
    if (!(d.win === null || [-1, 0, 1].includes(d.win)) || typeof d.how !== 'string' || d.how.length > 20 || !Array.isArray(d.f) || d.f.length !== 2) return null;
    const f = [];
    for (const a of d.f) {
      if (!Array.isArray(a) || a.length !== 16 || !a.slice(0, 14).every((v) => within(v, -200, 200))) return null;
      let act = null;
      if (a[14] !== 0) { const c = a[14]; if (!Array.isArray(c) || c.length !== 8 || !c.every((v) => within(v, -10, 10)) || !TYPES[c[0]]) return null; act = { k: TYPES[c[0]], t: c[1], hand: c[2] < 0 ? -1 : 1, body: c[3] ? 1 : 0, done: c[4] ? 1 : 0, miss: c[5] ? 1 : 0, slow: c[6] || 1, weak: c[7] ? 1 : 0 }; }
      if (!Array.isArray(a[15]) || a[15].length !== STAT_KEYS.length || !a[15].every((v) => within(v, 0, 1e5))) return null;
      f.push(Object.assign(fighter(), { hp: a[0], st: a[1], max: a[2], lean: a[3], duck: a[4], step: a[5], guard: a[6] ? 1 : 0, low: a[7] ? 1 : 0, stun: a[8], counter: a[9], hurt: a[10], hx: a[11], downs: a[12], combo: a[13], act, stats: Object.fromEntries(STAT_KEYS.map((k, i) => [k, a[15][i]])) }));
    }
    let down = null;
    if (d.d !== 0) { const c = d.d; if (!Array.isArray(c) || c.length !== 9 || !c.every((v) => within(v, -20, 20)) || ![0, 1].includes(c[0]) || ![0, 1, 2].includes(c[2])) return null; down = { who: c[0], count: c[1], level: c[2], hits: c[3], need: c[4], m: c[5], dir: c[6], zone: c[7], tko: c[8], lock: 0 }; }
    if (d.ph === 'down' && !down) return null;
    if (!Array.isArray(d.c) || d.c.length > MATCH.rounds || !d.c.every((r) => Array.isArray(r) && r.length === 3 && r.every((j) => Array.isArray(j) && j.length === 2 && j.every((v) => within(v, 0, 10))))) return null;
    if (!Array.isArray(d.ev) || d.ev.length > 12 || !within(d.ei, 0, 1e9)) return null;
    const ev = [];
    for (const e of d.ev) { if (!e || typeof e.type !== 'string' || e.type.length > 10 || !within(e.id, 1, 1e9)) return null; const o = {}; for (const [k, v] of Object.entries(e).slice(0, 10)) if (within(v, -1000, 1e9) || (typeof v === 'string' && v.length <= 20)) o[k] = v; ev.push(o); }
    return { t: d.t, phase: d.ph, pt: d.pt, round: d.rd, clock: d.cl, gap: d.g, f, down, cards: d.c, win: d.win, how: d.how, rng: 1, bot: [null, null], events: ev, eventId: d.ei };
  } catch (e) { return null; }
}
function lerp(a, b, t) {
  if (!a || !b || a.phase !== b.phase || a.round !== b.round) return b || a;
  const m = (x, y) => x + (y - x) * t;
  const f = b.f.map((q, i) => {
    const p = a.f[i], o = Object.assign({}, q, { lean: m(p.lean, q.lean), duck: m(p.duck, q.duck), step: m(p.step, q.step) });
    if (q.act && p.act && p.act.k === q.act.k && q.act.t >= p.act.t) o.act = Object.assign({}, q.act, { t: m(p.act.t, q.act.t) });
    return o;
  });
  const down = b.down && a.down ? Object.assign({}, b.down, { m: m(a.down.m, b.down.m) }) : b.down;
  return Object.assign({}, b, { t: m(a.t, b.t), pt: m(a.pt, b.pt), gap: m(a.gap, b.gap), f, down });
}
export const sim = { create, step, cpu, cleanInput, pack, unpack, lerp, score: (s) => [s.f[0].stats.knockdowns, s.f[1].stats.knockdowns], winner: (s) => (s.phase === 'over' && s.pt >= MATCH.endHold ? s.win : null) };
