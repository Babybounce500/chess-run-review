// Computergegner. Er sieht den Gegner nur verzögert (Reaktionszeit), schätzt, irrt sich und lässt sich täuschen.
import { COURT, HOOP, PLAYER, SHOT, CPU, MOVES } from './config.js';
import { clamp, hyp, hoopDist, rand } from './math.js';
import { pressure } from './sim.js';

export function newMind() { return { look: 0, ox: 0, oz: 6, pr: 0, think: 0, plan: '', tx: 0, tz: 7, rel: 0, jumpIn: -1, jumpSet: false, stealIn: -1, armed: false, board: -1, stuck: 0 }; }

export function cpuInput(s, side, level, dt) {
  const cfg = CPU[level] || CPU.normal, m = s.ai[side], me = s.p[side], op = s.p[1 - side], b = s.ball;
  const out = { x: 0, y: 0, a: false, b: false, c: false };
  const r = () => rand(s, 'airng'), gauss = () => r() + r() + r() - 1.5;
  if (s.phase !== 'live') { Object.assign(m, newMind(), { ox: op.x, oz: op.z }); m.think = cfg.react; return out; }
  // Wahrnehmung nur im Takt der Reaktionszeit
  m.look -= dt;
  if (m.look <= 0) { m.look = cfg.react * (0.8 + r() * 0.4); m.ox = op.x + op.vx * cfg.react * 0.5; m.oz = op.z + op.vz * cfg.react * 0.5; m.pr = pressure(s, side); }
  m.think -= dt;

  const go = (tx, tz, sprint, avoid) => {
    tx = clamp(tx, -COURT.halfW, COURT.halfW); tz = clamp(tz, COURT.minZ + 0.1, COURT.maxZ);
    let dx = tx - me.x, dz = tz - me.z; const d = hyp(dx, dz);
    if (d < 0.14) return d;
    dx /= d; dz /= d;
    if (avoid) {                                                                        // um den Verteidiger herum
      const ex = m.ox - me.x, ez = m.oz - me.z, e = hyp(ex, ez) || 1, ahead = (ex * dx + ez * dz) / e;
      if (e < 1.7 && ahead > 0.6) { const side2 = ex * -dz + ez * dx > 0 ? -1 : 1; dx += -dz * side2 * 1.1; dz += dx * side2 * 0.5; const n = hyp(dx, dz) || 1; dx /= n; dz /= n; }
    }
    const k = Math.min(1, d * 1.5) * cfg.pace;
    out.x = dx * k; out.y = dz * k; out.c = !!sprint && d > 1 && me.st > 0.3;
    return d;
  };
  const pressA = () => { out.a = !me.ha; return out.a; };
  const pressB = () => { out.b = !me.hb; return out.b; };

  // Geplanter Absprung zum Block läuft weiter, auch wenn der Ball schon fliegt (so wirkt die Finte)
  if (m.jumpIn >= 0 && b.own !== side) { m.jumpIn -= dt; if (m.jumpIn < 0) { if (hyp(op.x - me.x, op.z - me.z) < 2.3) pressA(); m.jumpIn = -1; } }

  if (b.own === side) {
    m.jumpIn = -1; m.jumpSet = false; m.board = -1; m.armed = false; m.stealIn = -1;
    const d = hoopDist(me.x, me.z);
    if (me.act === 'gather') {
      out.a = me.ch + dt / SHOT.full < m.rel;
      go(me.x, me.z, false);
      return out;
    }
    if (s.need) {                                                                        // erst hinter die Dreierlinie
      let ax = me.x - HOOP.x, az = Math.max(0.5, me.z - HOOP.z) + 0.8; const l = hyp(ax, az) || 1; ax /= l; az /= l;
      go(HOOP.x + ax * (COURT.threeR + 0.7), HOOP.z + az * (COURT.threeR + 0.7), true, true);
      m.plan = ''; m.think = Math.min(m.think, 0.1);
      if (me.cd <= 0 && hyp(op.x - me.x, op.z - me.z) < 1.1 && r() < cfg.cross * dt * 3) pressB();
      return out;
    }
    const urgent = s.clock < 2.6 || s.time < 2.5, near = hyp(m.ox - me.x, m.oz - me.z);
    if (urgent) m.plan = 'shoot';
    else if (s.pt < cfg.react + 0.7 && s.clock > 12) { go(me.x + (side ? 1 : -1) * Math.sin(s.t * 2) * 0.8, me.z - 0.4, false, true); return out; }
    else if (m.think <= 0 || !m.plan) {
      m.think = cfg.react + 0.35 + r() * 0.6;
      if (d < 3 && (m.pr < 0.7 || r() < 0.4)) m.plan = 'drive';
      else if (m.pr < cfg.open && d < 6.6 && r() < (d > COURT.threeR ? 0.55 : 0.75)) m.plan = 'shoot';
      else if (me.cd <= 0 && near < 1.9 && r() < cfg.cross + 0.15) m.plan = 'cross';
      else if (s.clock < 6 && m.pr < 0.55 && d < 6.6) m.plan = 'shoot';
      else if (r() < cfg.drive) { m.plan = 'drive'; m.tx = (r() < 0.5 ? -1 : 1) * (0.2 + r() * 0.7); m.think += 0.8; }
      else { m.plan = 'spot'; const a = (r() - 0.5) * 2.3, rad = r() < 0.4 ? COURT.threeR + 0.4 : 3.2 + r() * 2; m.tx = HOOP.x + Math.sin(a) * rad; m.tz = HOOP.z + Math.cos(a) * rad; m.think += 0.5; }
    }
    if (m.plan === 'shoot') {
      if (d > 7.4 && s.clock > 1.2 && s.time > 1.2) go(HOOP.x, HOOP.z + 4, true, true);
      else if (me.act === 'free' && pressA()) {
        m.rel = clamp(SHOT.ideal + gauss() * cfg.relErr * 1.5, 0.3, 1);
        if (!urgent && m.pr > 0.25 && r() < cfg.cross * 0.3) m.rel = 0.12;                    // Wurffinte
        m.plan = ''; m.think = 0.35 + r() * 0.3;
      }
    } else if (m.plan === 'cross') {
      const sx = r() < 0.5 ? -1 : 1, back = d < 6 && r() < 0.5;
      if (back) { out.x = (me.x - HOOP.x) / (d || 1); out.y = (me.z - HOOP.z) / (d || 1); } else { out.x = sx * 0.9; out.y = -0.45; }
      if (me.act === 'free' && pressB()) { m.plan = back ? 'shoot' : 'drive'; m.tx = sx * 0.6; m.think = back ? 0.7 : 0.9; }
    } else if (m.plan === 'drive') {
      go(HOOP.x + m.tx * clamp(d - 1, 0, 1.6), HOOP.z + 0.3, true, true);
      out.c = me.st > 0.2 && r() < 0.98;
      const toward = (me.vx * (HOOP.x - me.x) + me.vz * (HOOP.z - me.z)) / (d || 1);
      if (me.act === 'free' && ((d < 2.75 && toward > 1.4) || d < 1.9)) { if (pressA()) { m.rel = SHOT.ideal + gauss() * cfg.relErr; m.plan = ''; m.think = 0.6; } }
      m.stuck = toward < 0.5 ? m.stuck + dt : 0;
      if (m.stuck > 0.7) { m.stuck = 0; m.plan = me.cd <= 0 && r() < cfg.cross ? 'cross' : d < 6.5 ? 'shoot' : 'spot'; m.think = 0.4; }
    } else {
      if (go(m.tx, m.tz, false, true) < 0.4) { m.plan = d < 6.6 && m.pr < 0.6 ? 'shoot' : ''; m.think = 0.3; }
    }
    return out;
  }

  m.plan = '';
  const dist = hyp(op.x - me.x, op.z - me.z);
  if (b.own === 1 - side) {                                                              // Verteidigen
    m.board = -1;
    const shooting = op.act === 'gather' || op.act === 'layup' || op.act === 'dunk';
    if (shooting && !m.jumpSet) {
      m.jumpSet = true;
      if (dist < 2.5 && r() < cfg.blockP) {
        const ideal = op.act === 'gather' ? SHOT.ideal * SHOT.full - 0.37 : (op.act === 'dunk' ? MOVES.dunkSlam : MOVES.layupRelease) - 0.34;
        m.jumpIn = Math.max(0, Math.max(cfg.react * 0.75, ideal + gauss() * cfg.blockErr) - op.at);
      }
    } else if (!shooting) m.jumpSet = false;
    let hx = HOOP.x - m.ox, hz = HOOP.z - m.oz; const l = hyp(hx, hz) || 1; hx /= l; hz /= l;
    const gap = Math.min(l * 0.75, cfg.gap + Math.max(0, l - 5.6) * 0.3 + (s.need ? 0.3 : 0) - (shooting ? 0.3 : 0));
    const off = go(m.ox + hx * gap, m.oz + hz * gap, false);
    out.c = off > 1.3 && me.st > 0.25 && cfg.sprint > 0.5;
    // Stehlen: erst vornehmen, dann auf den freien Ball warten
    const reach = hyp(b.x - me.x, b.z - me.z);
    if (m.think <= 0) { m.think = 0.45 + r() * 0.4; m.armed = r() < cfg.stealP; }
    if (m.armed && me.act === 'free' && me.scd <= 0 && reach < 1.3) {
      if (m.stealIn < 0 && b.mode === 'drib' && b.y < MOVES.stealHeight + 0.12 && b.vy < 0 && reach < dist + 0.1) m.stealIn = cfg.stealDelay * (0.4 + r() * 1.2);
      if (m.stealIn >= 0) {
        m.stealIn -= dt; out.x = (b.x - me.x) / (reach || 1) * cfg.pace; out.y = (b.z - me.z) / (reach || 1) * cfg.pace;
        if (m.stealIn < 0 && reach < 1.15) { pressB(); m.armed = false; }
      }
    } else m.stealIn = -1;
    return out;
  }

  // Ball ist frei: ausboxen, hingehen, springen
  m.armed = false; m.stealIn = -1; m.jumpSet = false;
  if (m.board < 0) m.board = r() < cfg.boardP ? 1 : 0;
  if (b.mode === 'shot' && !b.rim && !b.board) {
    let ox = m.ox - HOOP.x, oz = m.oz - HOOP.z; const l = hyp(ox, oz) || 1;
    if (m.board && b.by !== side) go(HOOP.x + (ox / l) * 1.35, HOOP.z + Math.max(0.2, oz / l) * 1.35, false);
    else go(HOOP.x, HOOP.z + 1.6, false);
  } else {
    const t = b.y > 1.5 ? 0.45 : 0.22;
    const d = go(b.x + b.vx * t, b.z + b.vz * t, true);
    if (d < 0.14) { out.x = 0; out.y = 0; }
    const flat = hyp(b.x - me.x, b.z - me.z);
    if (m.board && me.act === 'free' && b.vy < 0.6 && b.y > 1.95 && b.y < PLAYER.reach + 0.95 && flat < 1.05) pressA();
  }
  return out;
}
