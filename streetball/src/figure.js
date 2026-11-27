// Spielfiguren mit Gelenken: Posen je Aktion, Schritt passend zum Tempo (eigene Phase je Figur), Hände greifen den Ball.
import * as THREE from '../vendor/three.module.js';
import { HOOP, SHOT, MOVES } from './config.js';
import { clamp, lerp, smooth, hyp, forward, sideVec } from './math.js';

export const SCALE = 1.12;
const UPPER = 0.31, FORE = 0.32;

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

const KEYS = ['hipY', 'lean', 'twist', 'roll', 'head', 'lsx', 'lsz', 'le', 'rsx', 'rsz', 're', 'lhx', 'lhz', 'lk', 'rhx', 'rhz', 'rk'];
const IDLE = { hipY: -0.04, lean: 0.1, lsz: -0.2, rsz: 0.2, le: -0.35, re: -0.35, lhx: -0.12, rhx: -0.12, lk: 0.22, rk: 0.22, lhz: -0.05, rhz: 0.05 };
const GUARD = { hipY: -0.17, lean: 0.34, head: -0.25, lhz: -0.24, rhz: 0.24, lhx: -0.42, rhx: -0.42, lk: 0.78, rk: 0.78, lsz: -1.05, rsz: 1.05, lsx: -0.45, rsx: -0.45, le: -0.55, re: -0.55 };
const HANDLE = { hipY: -0.13, lean: 0.3, head: -0.22, lhz: -0.14, rhz: 0.14, lhx: -0.45, rhx: -0.2, lk: 0.68, rk: 0.5, lsz: -0.5, rsz: 0.5, lsx: -0.5, rsx: -0.5, le: -0.9, re: -0.9 };
const AIR = { lean: 0.05, lhx: -0.35, rhx: 0.05, lk: 0.85, rk: 0.55, lsz: -0.3, rsz: 0.3 };
const BLOCK = { lean: -0.06, head: -0.3, lsx: -0.15, rsx: -0.15, lsz: -2.92, rsz: 2.92, le: -0.08, re: -0.08, lhx: -0.12, rhx: 0.1, lk: 0.35, rk: 0.55 };
const CROUCH = { hipY: -0.28, lean: 0.35, lhx: -0.75, rhx: -0.75, lk: 1.3, rk: 1.3, lsz: -0.5, rsz: 0.5, le: -0.7, re: -0.7 };
const FOLLOW = { lean: -0.04, head: -0.15, rsx: -2.75, rsz: 0.15, re: -0.25, lsx: -2.1, lsz: -0.25, le: -0.6, lhx: -0.15, rhx: 0.05, lk: 0.3, rk: 0.35 };
const LAYUP = { lean: -0.02, head: -0.2, rhx: -1.35, rk: 1.55, lhx: 0.15, lk: 0.2, lsz: -0.9, lsx: -0.4, le: -0.7 };
const DUNK = { lean: -0.12, head: -0.15, lhx: -0.9, lk: 1.5, rhx: 0.2, rk: 1.1, lsz: -1.4, lsx: 0.3, le: -0.5 };
const STEAL = { hipY: -0.24, lean: 0.62, head: -0.4, lhx: -0.95, lk: 0.9, rhx: 0.35, rk: 0.55, lhz: -0.15, rhz: 0.15, lsz: -0.9, lsx: 0.4, le: -0.5, rsx: -1.4, re: -0.2 };
const RECOVER = { hipY: -0.14, lean: 0.55, head: -0.2, lhx: -0.5, rhx: -0.25, lk: 0.8, rk: 0.6, lsx: -0.35, rsx: -0.35, le: -0.2, re: -0.2, lsz: -0.25, rsz: 0.25 };
const CHEER = { lean: -0.2, head: -0.35, lsz: -2.6, rsz: 2.6, le: -0.35, re: -0.35, lhx: -0.1, rhx: 0.15, lk: 0.15, rk: 0.2 };
const SAD = { lean: 0.36, head: 0.5, lsz: -0.12, rsz: 0.12, lsx: -0.1, rsx: -0.1, le: -0.15, re: -0.15, lk: 0.18, rk: 0.18 };
const blend = (a, b, t) => { const o = {}; for (const k of KEYS) o[k] = lerp(a[k] || 0, b[k] || 0, t); return o; };

export function createFigure(color, number, accent) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.scale.setScalar(SCALE);
  const mat = (c, e = 0.16) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.02, emissive: c, emissiveIntensity: e });
  const dark = new THREE.Color(color).multiplyScalar(0.34).getHex();
  const shirt = mat(color, 0.24), shorts = mat(dark, 0.2), skin = mat(number === 1 ? 0xb5774a : 0xe3a77a, 0.14), shoe = mat(0xfafafa, 0.28), hair = mat(number === 1 ? 0x1c120c : 0x4a2a14, 0.06), band = mat(accent, 0.4);
  const outline = new THREE.MeshBasicMaterial({ color: 0x0b0d1c, side: THREE.BackSide });
  const part = (geo, m, parent, x = 0, y = 0, z = 0, line = 1.13) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.castShadow = true;
    if (line) { const o = new THREE.Mesh(geo, outline); o.scale.setScalar(line); mesh.add(o); }
    parent.add(mesh); return mesh;
  };
  const limb = (r, len, m, parent) => part(new THREE.CapsuleGeometry(r, len - r, 3, 8), m, parent, 0, -len / 2, 0, 1.15);
  const joint = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  const hips = joint(body, 0, 0.93, 0);
  part(new THREE.BoxGeometry(0.38, 0.22, 0.25), shorts, hips);
  const spine = joint(hips, 0, 0.06, 0);
  part(new THREE.CapsuleGeometry(0.2, 0.28, 4, 10), shirt, spine, 0, 0.3, 0).scale.set(1.18, 1, 0.76);
  const numTex = canvasTexture(64, 64, (g) => { g.font = '900 54px system-ui,Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#10122a'; g.strokeText(String(number === 1 ? 7 : 3), 32, 35); g.fillStyle = '#ffffff'; g.fillText(String(number === 1 ? 7 : 3), 32, 35); });
  const numMat = new THREE.MeshBasicMaterial({ map: numTex, transparent: true, depthWrite: false });
  for (const s of [1, -1]) { const n = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), numMat); n.position.set(0, 0.34, s * 0.178); n.rotation.y = s > 0 ? 0 : Math.PI; spine.add(n); }
  const neck = joint(spine, 0, 0.62, 0);
  part(new THREE.SphereGeometry(0.16, 16, 12), skin, neck, 0, 0.15, 0);
  part(new THREE.SphereGeometry(0.168, 16, 8, 0, Math.PI * 2, 0, Math.PI * (number === 1 ? 0.4 : 0.48)), hair, neck, 0, 0.162, -0.008, 0);
  part(new THREE.TorusGeometry(0.152, 0.022, 6, 20), band, neck, 0, 0.2, 0, 0).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) part(new THREE.SphereGeometry(0.022, 6, 5), outline, neck, s * 0.055, 0.15, 0.152, 0);
  const arm = (s) => {
    const sh = joint(spine, s * 0.3, 0.5, 0); limb(0.075, 0.17, shirt, sh); limb(0.062, UPPER, skin, sh);
    const el = joint(sh, 0, -UPPER, 0); limb(0.056, 0.27, skin, el);
    part(new THREE.SphereGeometry(0.078, 10, 8), skin, el, 0, -FORE, 0);
    return { sh, el, s, w: 0, t: new THREE.Vector3() };
  };
  const leg = (s) => {
    const hip = joint(hips, s * 0.12, -0.04, 0); limb(0.105, 0.34, shorts, hip); limb(0.08, 0.43, skin, hip);
    const knee = joint(hip, 0, -0.43, 0); limb(0.072, 0.4, skin, knee);
    const foot = joint(knee, 0, -0.42, 0); part(new THREE.BoxGeometry(0.17, 0.11, 0.31), shoe, foot, 0, 0, 0.07);
    part(new THREE.BoxGeometry(0.18, 0.035, 0.32), shirt, foot, 0, -0.045, 0.07, 0);
    return { hip, knee, foot };
  };
  const armL = arm(-1), armR = arm(1), legL = leg(-1), legR = leg(1);

  const ring = new THREE.Group();
  const flat = (geo, c, o, y) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = y; ring.add(m); return m; };
  flat(new THREE.CircleGeometry(0.46, 28), 0x0c0e22, 0.28, 0.008);
  const rim = flat(new THREE.RingGeometry(0.44, 0.56, 36), color, 0.95, 0.014);
  const outer = flat(new THREE.RingGeometry(0.62, 0.68, 36), 0xffffff, 0.9, 0.016);

  const pose = Object.assign({}, blend(IDLE, IDLE, 0));
  const anim = { phase: number * 1.7, x: null, z: null, vf: 0, vs: 0, af: 0, as: 0, time: number * 2.3, yaw: 0 };
  const down = new THREE.Vector3(0, -1, 0), v = new THREE.Vector3(), n = new THREE.Vector3(), k = new THREE.Vector3(), el = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), qi = new THREE.Quaternion();
  // Zwei-Knochen-Lösung: Hand zum Zielpunkt (im Raum des Oberkörpers)
  function reach(a, target, w) {
    v.copy(target).sub(a.sh.position);
    const d = clamp(v.length(), 0.14, UPPER + FORE - 0.003); n.copy(v).normalize();
    k.set(a.s * 0.8, -0.35, -0.55); k.addScaledVector(n, -k.dot(n)).normalize();
    const cos = clamp((UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d), -1, 1), sin = Math.sqrt(1 - cos * cos);
    el.copy(n).multiplyScalar(cos * UPPER).addScaledVector(k, sin * UPPER);
    q1.setFromUnitVectors(down, v.copy(el).normalize());
    v.copy(n).multiplyScalar(d).sub(el).normalize().applyQuaternion(qi.copy(q1).invert());
    q2.setFromUnitVectors(down, v);
    a.sh.quaternion.slerp(q1, w); a.el.quaternion.slerp(q2, w);
  }

  // p = Spielerzustand, ctx = { has, ball, mine, dead, defending, time }
  function update(dt, p, ctx) {
    anim.time += dt;
    const [fx, fz] = forward(p.f), [sx, sz] = sideVec(p.f);
    const vf = p.vx * fx + p.vz * fz, vs = p.vx * sx + p.vz * sz, speed = hyp(p.vx, p.vz);
    const k1 = 1 - Math.exp(-9 * dt);
    const af = dt > 0 ? clamp((vf - anim.vf) / Math.max(dt, 0.008), -25, 25) : 0, as = dt > 0 ? clamp((vs - anim.vs) / Math.max(dt, 0.008), -25, 25) : 0;
    anim.vf = vf; anim.vs = vs; anim.af += (af - anim.af) * k1; anim.as += (as - anim.as) * k1;
    // Schrittphase aus dem wirklich zurückgelegten Weg
    let moved = anim.x === null ? 0 : hyp(p.x - anim.x, p.z - anim.z); if (moved > 0.8) moved = 0;
    anim.x = p.x; anim.z = p.z;
    anim.phase += (moved / (0.62 + speed * 0.11)) * Math.PI * (vf < -0.4 ? -1 : 1);
    const sw = Math.sin(anim.phase), run = smooth(0.25, 2.2, speed), amp = clamp(0.35 + speed / 7, 0.35, 1.15);
    const lateral = speed > 0.4 ? clamp((Math.abs(vs) - Math.abs(vf) * 0.6) / speed, 0, 1) : 0;

    const base = ctx.has ? HANDLE : ctx.defending ? GUARD : IDLE;
    let t = Object.assign({}, blend(base, base, 0));
    const breathe = Math.sin(anim.time * 3.1);
    t.hipY += breathe * 0.012; t.lean += breathe * 0.012;
    if (run > 0 && lateral < 1) {
      const gait = {
        hipY: Math.abs(Math.cos(anim.phase)) * 0.07 * amp - 0.07, lean: 0.12 + 0.22 * amp * Math.sign(vf || 1), head: -0.1,
        lhx: -sw * 0.85 * amp - 0.15, rhx: sw * 0.85 * amp - 0.15, lk: Math.max(0, Math.cos(anim.phase)) * 1.4 * amp + 0.2, rk: Math.max(0, -Math.cos(anim.phase)) * 1.4 * amp + 0.2,
        lsx: sw * 0.8 * amp, rsx: -sw * 0.8 * amp, lsz: -0.22, rsz: 0.22, le: -1.2, re: -1.2
      };
      t = blend(t, gait, run * (1 - lateral));
    }
    if (lateral > 0) {                                                                      // Seitschritte beim Verteidigen
      const open = (Math.sin(anim.phase * 1.4) + 1) / 2, slide = Object.assign({}, blend(GUARD, GUARD, 0), { lhz: -0.1 - open * 0.42, rhz: 0.1 + open * 0.42, hipY: -0.2 + (1 - open) * 0.07, roll: clamp(-vs * 0.03, -0.18, 0.18) });
      t = blend(t, slide, run * lateral);
    }
    if (p.y > 0.08) t = blend(t, AIR, smooth(0.08, 0.4, p.y));
    let hands = null;                                                                        // [linksZiel, rechtsZiel, gewicht]
    const b = ctx.ball, ballWorld = (ox, oy) => new THREE.Vector3(b.x + sx * ox, b.y + oy, b.z + sz * ox);
    switch (p.act) {
      case 'gather': {
        const lift = smooth(SHOT.fake - 0.06, SHOT.fake + 0.14, p.ch), dip = smooth(0.02, 0.18, p.ch) * (1 - lift);
        t = blend(t, CROUCH, dip * 0.85);
        t.lean = lerp(t.lean, -0.04, lift); t.head = lerp(t.head || 0, -0.15, lift);
        if (ctx.has) hands = [ballWorld(-0.15, -0.03), ballWorld(0.13, -0.09), 1];
        break;
      }
      case 'follow': t = blend(t, FOLLOW, smooth(0, 0.12, p.at)); break;
      case 'layup': { t = blend(t, LAYUP, smooth(0.04, 0.2, p.at)); if (ctx.has) hands = p.at < 0.18 ? [ballWorld(-0.14, 0), ballWorld(0.14, 0), 1] : [null, ballWorld(0, -0.1), 1]; else t.rsx = -2.8; break; }
      case 'dunk': {
        t = blend(t, DUNK, smooth(0.08, 0.3, p.at));
        if (ctx.has) hands = p.at < 0.2 ? [ballWorld(-0.14, 0), ballWorld(0.14, 0), 1] : [null, ballWorld(0, -0.06), 1];
        else if (p.at < MOVES.dunkSlam + 0.2) hands = [null, new THREE.Vector3(HOOP.x + sx * 0.1, HOOP.y, HOOP.z + 0.2), 1];
        break;
      }
      case 'block': t = p.done ? blend(AIR, BLOCK, smooth(MOVES.blockWindup, MOVES.blockWindup + 0.14, p.at)) : blend(t, CROUCH, 0.8); break;
      case 'steal': {
        const u = smooth(0, MOVES.stealFrom + 0.02, p.at) * (1 - smooth(MOVES.stealTo + 0.04, MOVES.stealTime, p.at) * 0.6);
        t = blend(t, STEAL, u);
        hands = [null, new THREE.Vector3(p.x + fx * 0.95, clamp(b.y, 0.45, 1.2), p.z + fz * 0.95), u];
        break;
      }
      case 'recover': t = blend(t, RECOVER, smooth(-0.1, 0.08, p.at) * (1 - smooth(MOVES.stealRecover - 0.1, MOVES.stealRecover, p.at))); break;
      case 'land': t = blend(t, CROUCH, 0.65 * (1 - p.at / 0.14)); break;
      case 'cross': {
        const u = Math.sin(clamp(p.at / MOVES.crossTime, 0, 1) * Math.PI), lat = p.sx * sx + p.sz * sz;
        t = blend(t, CROUCH, u * 0.6); t.roll = -lat * 0.38 * u; t.lhz = (t.lhz || 0) - 0.35 * u; t.rhz = (t.rhz || 0) + 0.35 * u;
        break;
      }
      case 'stumble': {
        const u = Math.sin(clamp(p.at / MOVES.stumble, 0, 1) * Math.PI), wob = Math.sin(anim.time * 17);
        t = blend(t, { hipY: -0.36, lean: -0.28, head: 0.2, lhx: -1.1, rhx: -0.4, lk: 1.5, rk: 0.9, lsz: -1.6 - wob * 0.5, rsz: 1.6 - wob * 0.5, le: -0.4, re: -0.4, roll: wob * 0.16 }, u);
        break;
      }
      default: break;
    }
    if (ctx.has && !hands) {
      if (b.mode === 'drib') {                                                               // Dribbelhand folgt dem Ball
        const h = new THREE.Vector3(b.x, Math.max(b.y + 0.15, p.act === 'cross' ? 0.72 : 0.98), b.z);
        hands = Math.abs(p.hx) < 0.3 && p.act === 'cross' ? [h, h, 0.9] : p.hx > 0 ? [null, h, 1] : [h, null, 1];
      } else hands = [ballWorld(-0.15, -0.02), ballWorld(0.15, -0.02), 1];
    }
    if (ctx.mood && p.act !== 'dunk' && p.act !== 'layup' && p.y < 0.2) {
      hands = ctx.has ? hands : null;
      if (ctx.mood > 0) { const hop = Math.abs(Math.sin(anim.time * 7)); t = blend(t, CHEER, 0.95); t.hipY += hop * 0.12; t.lk += (1 - hop) * 0.35; t.rk += (1 - hop) * 0.35; }
      else if (speed < 1) t = blend(t, SAD, 0.85);
    }
    t.lean = (t.lean || 0) + clamp(anim.af * 0.011, -0.2, 0.24); t.roll = (t.roll || 0) + clamp(-anim.as * 0.009, -0.2, 0.2);

    const rate = 1 - Math.exp(-(p.act === 'steal' || p.act === 'block' || p.act === 'cross' ? 26 : 17) * dt);
    for (const key of KEYS) pose[key] += ((t[key] || 0) - pose[key]) * rate;
    root.position.set(p.x, Math.max(0, p.y), p.z); root.rotation.y = p.f;
    body.rotation.z = pose.roll;
    hips.position.y = 0.93 + pose.hipY; spine.rotation.set(pose.lean, pose.twist, 0); neck.rotation.x = pose.head;
    armL.sh.rotation.set(pose.lsx, 0, pose.lsz); armL.el.rotation.set(pose.le, 0, 0);
    armR.sh.rotation.set(pose.rsx, 0, pose.rsz); armR.el.rotation.set(pose.re, 0, 0);
    legL.hip.rotation.set(pose.lhx, 0, pose.lhz); legL.knee.rotation.x = pose.lk;
    legR.hip.rotation.set(pose.rhx, 0, pose.rhz); legR.knee.rotation.x = pose.rk;
    legL.foot.rotation.x = -pose.lhx - pose.lk * 0.65; legR.foot.rotation.x = -pose.rhx - pose.rk * 0.65;
    root.updateMatrixWorld(true);
    for (const [i, a] of [armL, armR].entries()) {
      const target = hands && hands[i];
      a.w += ((target ? hands[2] : 0) - a.w) * (1 - Math.exp(-22 * dt));
      if (target) { a.t.copy(target); spine.worldToLocal(a.t); }
      if (a.w > 0.03) reach(a, a.t, a.w);
    }
    ring.position.set(p.x, 0, p.z);
    outer.visible = ctx.mine; outer.scale.setScalar(1 + Math.sin(anim.time * 5) * 0.05);
    rim.material.opacity = ctx.has ? 1 : 0.75;
  }

  const solid = [shirt, shorts, skin, shoe, hair, band, outline];
  let alpha = 1;
  function fade(to, dt) {
    alpha += (to - alpha) * (1 - Math.exp(-10 * dt));
    const see = alpha < 0.97;
    for (const m of solid) { if (m.transparent !== see) { m.transparent = see; m.needsUpdate = true; } m.opacity = see ? alpha : 1; }
    outline.visible = alpha > 0.8; numMat.opacity = alpha;
  }

  return { root, ring, update, fade, anim, alpha: () => alpha };
}
