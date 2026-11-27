// Darstellung mit three.js: Flutlicht-Feld, Gelenkfiguren, Ball, Markierungen und Kamera.
// Liest nur aus der Spiellogik ab, verändert sie nie. Logik (x, z) wird in der Szene zu (x, y, -z).
import * as THREE from '../vendor/three.module.js';
import { FIELD, ACT, ACTION, PASS, FORMATIONS, PLAYS, TARGETS, LINEUP } from './config.js';
import { clamp, canPass, controlled, routePoints, passPlan, ballArc } from './sim.js';

export const TEAM = [0xff8a30, 0x3fb8ff];
export const TAG = ['#35f0ff', '#ffd34d', '#ff6fd0'];                 // Farben der Passziele 1, 2, 3
const SCALE = 1.34;
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (cur, to, rate, dt) => cur + (to - cur) * (1 - Math.exp(-rate * dt));
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

/* ---------- Figuren: ein Gelenkskelett je Spieler, alle Teile als Instanzen (wenige Zeichenaufrufe) ---------- */
const PARTS = {
  pelvis: { geo: () => new THREE.BoxGeometry(0.4, 0.2, 0.27), col: 'pants', out: 1.14 },
  torso: { geo: () => new THREE.CapsuleGeometry(0.2, 0.26, 4, 10).scale(1.12, 1, 0.78), col: 'jersey', out: 1.12 },
  pads: { geo: () => new THREE.CapsuleGeometry(0.16, 0.38, 4, 10).rotateZ(Math.PI / 2).scale(1, 0.85, 1.05), col: 'jersey', out: 1.13 },
  plate: { geo: () => new THREE.BoxGeometry(0.2, 0.22, 0.02), col: 'trim' },
  head: { geo: () => new THREE.SphereGeometry(0.13, 14, 10), col: 'skin' },
  helmet: { geo: () => new THREE.SphereGeometry(0.19, 18, 14), col: 'helmet', out: 1.13 },
  stripe: { geo: () => new THREE.TorusGeometry(0.19, 0.022, 5, 20, Math.PI * 1.15).rotateZ(-0.2).rotateY(Math.PI / 2), col: 'trim' },
  mask: { geo: () => new THREE.TorusGeometry(0.15, 0.018, 5, 16, Math.PI).rotateX(Math.PI / 2), col: 'mask' },
  uarm: { geo: () => new THREE.CapsuleGeometry(0.08, 0.2, 3, 8), col: 'jersey', out: 1.18, n: 2 },
  farm: { geo: () => new THREE.CapsuleGeometry(0.062, 0.22, 3, 8), col: 'skin', out: 1.22, n: 2 },
  hand: { geo: () => new THREE.SphereGeometry(0.075, 10, 8), col: 'glove', n: 2 },
  thigh: { geo: () => new THREE.CapsuleGeometry(0.11, 0.28, 3, 8), col: 'pants', out: 1.14, n: 2 },
  shin: { geo: () => new THREE.CapsuleGeometry(0.08, 0.3, 3, 8), col: 'sock', out: 1.18, n: 2 },
  shoe: { geo: () => new THREE.BoxGeometry(0.17, 0.11, 0.3), col: 'shoe', out: 1.15, n: 2 }
};
function makeSkeleton() {
  const root = new THREE.Group(); root.rotation.order = 'YXZ'; root.scale.setScalar(SCALE);
  const body = new THREE.Group(); root.add(body); const marks = [];
  const joint = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const mark = (type, parent, x = 0, y = 0, z = 0, k = 0) => { const m = joint(parent, x, y, z); marks.push({ type, k, node: m }); return m; };
  const hips = joint(body, 0, 0.93, 0); mark('pelvis', hips);
  const spine = joint(hips, 0, 0.06, 0); mark('torso', spine, 0, 0.27, 0); mark('pads', spine, 0, 0.48, 0); mark('plate', spine, 0, 0.34, 0.165);
  const neck = joint(spine, 0, 0.62, 0); mark('head', neck, 0, 0.12, 0.035); mark('helmet', neck, 0, 0.18, -0.01); mark('stripe', neck, 0, 0.185, -0.01); mark('mask', neck, 0, 0.09, 0.07);
  const arm = (s, k) => { const sh = joint(spine, s * 0.33, 0.48, 0); mark('uarm', sh, 0, -0.15, 0, k); const el = joint(sh, 0, -0.31, 0); mark('farm', el, 0, -0.13, 0, k); const hand = mark('hand', el, 0, -0.31, 0, k); return { sh, el, hand }; };
  const leg = (s, k) => { const hip = joint(hips, s * 0.13, -0.04, 0); mark('thigh', hip, 0, -0.21, 0, k); const knee = joint(hip, 0, -0.43, 0); mark('shin', knee, 0, -0.2, 0, k); const foot = joint(knee, 0, -0.42, 0); mark('shoe', foot, 0, 0, 0.06, k); return { hip, knee, foot }; };
  return { root, hips, spine, neck, marks, armL: arm(-1, 0), armR: arm(1, 1), legL: leg(-1, 0), legR: leg(1, 1) };
}
const KEYS = ['hipY', 'lean', 'twist', 'head', 'lsx', 'lsz', 'le', 'rsx', 'rsz', 're', 'lhx', 'lhz', 'lk', 'rhx', 'rhz', 'rk', 'pitch', 'roll', 'lift'];
function applyPose(J, p) {
  J.hips.position.y = 0.93 + p.hipY; J.spine.rotation.set(p.lean, p.twist, 0); J.neck.rotation.x = p.head;
  J.armL.sh.rotation.set(p.lsx, 0, p.lsz); J.armL.el.rotation.x = p.le;
  J.armR.sh.rotation.set(p.rsx, 0, p.rsz); J.armR.el.rotation.x = p.re;
  J.legL.hip.rotation.set(p.lhx, 0, p.lhz); J.legL.knee.rotation.x = p.lk;
  J.legR.hip.rotation.set(p.rhx, 0, p.rhz); J.legR.knee.rotation.x = p.rk;
  J.legL.foot.rotation.x = -p.lhx * 0.8 - p.lk * 0.6; J.legR.foot.rotation.x = -p.rhx * 0.8 - p.rk * 0.6;
}
const P = (o) => { const p = {}; for (const k of KEYS) p[k] = o[k] || 0; return p; };
const STAND = P({ lsz: -0.2, rsz: 0.2, le: -0.35, re: -0.35, lk: 0.08, rk: 0.08 });
const STANCE_WR = P({ lean: 0.45, head: -0.35, hipY: -0.16, lhx: -0.75, lk: 0.95, rhx: 0.25, rk: 0.75, lsx: -0.5, rsx: 0.2, lsz: -0.25, rsz: 0.25, le: -0.8, re: -1.1 });
const STANCE_DEF = P({ lean: 0.42, head: -0.35, hipY: -0.2, lhz: -0.22, rhz: 0.22, lhx: -0.5, rhx: -0.5, lk: 0.95, rk: 0.95, lsz: -0.6, rsz: 0.6, lsx: -0.5, rsx: -0.5, le: -0.8, re: -0.8 });
const STANCE_QB = P({ lean: 0.22, head: -0.1, hipY: -0.1, lhz: -0.12, rhz: 0.12, lhx: -0.35, rhx: -0.35, lk: 0.6, rk: 0.6, lsx: -0.85, rsx: -0.85, lsz: -0.1, rsz: 0.1, le: -0.75, re: -0.75 });
const RUSH = P({ lean: 0.7, head: -0.6, hipY: -0.26, lhx: -1.0, lk: 1.35, rhx: 0.35, rk: 1.0, lsx: -0.9, rsx: -0.7, lsz: -0.2, rsz: 0.2, le: -0.4, re: -0.4 });
const mixPose = (a, b, t) => { const o = {}; for (const k of KEYS) o[k] = mix(a[k], b[k], t); return o; };

// Eine Pose aus dem Zustand ableiten. anim = Gedächtnis der Figur (eigene Schrittphase)
function poseFor(s, i, p, anim, time) {
  const speed = Math.hypot(p.vx, p.vz), fx = Math.sin(p.f), fz = Math.cos(p.f), fwd = p.vx * fx + p.vz * fz, side = p.vx * fz - p.vz * fx;
  const back = fwd < -0.5 && -fwd > Math.abs(side) * 0.7, a = clamp(speed / 6.4, 0, 1.1), ph = anim.phase;
  const preSnap = s.ph === 'pick' || s.ph === 'set';
  let pose = preSnap ? (i === 0 ? STANCE_QB : i === 4 ? RUSH : i < 4 ? STANCE_WR : STANCE_DEF) : (i >= 4 && speed < 2 ? STANCE_DEF : STAND);
  const breathe = Math.sin(time * (2.1 + anim.k * 0.7) + anim.offset);
  pose = Object.assign({}, pose, { hipY: pose.hipY + breathe * 0.012, lean: pose.lean + breathe * 0.015 });
  if (speed > 0.35) {
    const sw = Math.sin(ph), cs = Math.cos(ph) * (back ? -1 : 1), amp = Math.min(1, a * 1.05);
    const run = P({
      lean: back ? 0.2 : 0.14 + amp * 0.24, head: -0.12 * amp, hipY: Math.abs(Math.cos(ph)) * 0.09 * amp - 0.06 * amp - (back ? 0.09 : 0),
      lhx: -sw * 1.0 * amp - (back ? 0.3 : 0.05), rhx: sw * 1.0 * amp - (back ? 0.3 : 0.05),
      lk: 0.18 + Math.max(0, cs) * 1.65 * amp + (back ? 0.35 : 0), rk: 0.18 + Math.max(0, -cs) * 1.65 * amp + (back ? 0.35 : 0),
      lsx: sw * (back ? 0.45 : 1.05) * amp - 0.1, rsx: -sw * (back ? 0.45 : 1.05) * amp - 0.1, lsz: -0.24 - (back ? 0.25 : 0), rsz: 0.24 + (back ? 0.25 : 0),
      le: -0.55 - 0.9 * amp, re: -0.55 - 0.9 * amp, twist: sw * 0.18 * amp
    });
    const strafe = clamp(side / (speed + 0.01), -1, 1) * (Math.abs(side) > Math.abs(fwd) ? 1 : 0.3);
    run.lhz = -Math.max(0, sw) * 0.35 * Math.abs(strafe) - 0.04; run.rhz = Math.max(0, -sw) * 0.35 * Math.abs(strafe) + 0.04; run.roll = -strafe * 0.12 * amp;
    pose = mixPose(pose, run, smooth(0.35, 1.8, speed));
  }
  const b = s.ball, holds = b.m === 'held' && b.own === i && !preSnap;
  if (holds) {
    if (i === 0 && canPass(s)) {
      const q = s.hold.k >= 0 ? clamp(s.hold.t / 0.3, 0, 1) : 0;
      pose = Object.assign({}, pose, { lsx: mix(-0.8, -1.5, q), lsz: -0.15, le: mix(-1.5, -0.4, q), rsx: mix(-0.8, 1.15, q), rsz: mix(0.15, 1.25, q), re: mix(-1.5, -1.7, q), twist: q * 0.55 });
    } else pose = Object.assign({}, pose, { rsx: -0.35, rsz: 0.12, re: -2.1 });      // Ball unter den Arm geklemmt
  }
  if (b.m === 'air' && b.tgt === i) { const u = smooth(0.55, 0.85, b.t / b.T); pose = Object.assign({}, pose, { lsx: mix(pose.lsx, -2.25, u), rsx: mix(pose.rsx, -2.25, u), lsz: mix(pose.lsz, -0.3, u), rsz: mix(pose.rsz, 0.3, u), le: mix(pose.le, -0.35, u), re: mix(pose.re, -0.35, u), head: mix(pose.head, -0.45, u) }); }
  if (p.blk > 0) pose = Object.assign({}, pose, { lsx: -1.4, rsx: -1.4, le: -0.5, re: -0.5, lean: 0.4 });
  const t = p.at;
  if (p.act === ACT.throw) {
    const wind = P({ lean: -0.05, twist: 0.65, hipY: -0.1, rsx: 1.25, rsz: 1.55, re: -1.7, lsx: -1.5, lsz: -0.5, le: -0.3, lhx: -0.55, lk: 0.35, rhx: 0.35, rk: 0.5 });
    const rel = P({ lean: 0.2, twist: -0.25, hipY: -0.1, rsx: -2.5, rsz: 0.35, re: -0.25, lsx: -0.3, lsz: -0.8, le: -1.2, lhx: -0.55, lk: 0.4, rhx: 0.3, rk: 0.45 });
    const follow = P({ lean: 0.45, twist: -0.6, hipY: -0.12, rsx: -0.7, rsz: -0.15, re: -0.5, lsx: 0.3, lsz: -0.7, le: -1.1, lhx: -0.5, lk: 0.5, rhx: 0.3, rk: 0.4 });
    pose = t < PASS.windup ? mixPose(wind, rel, smooth(PASS.windup * 0.45, PASS.windup, t)) : mixPose(rel, follow, smooth(PASS.windup, PASS.windup + 0.18, t));
  } else if (p.act === ACT.catch) pose = Object.assign({}, pose, { lsx: -1.2, rsx: -1.2, le: -1.5, re: -1.5, lsz: -0.1, rsz: 0.1 });
  else if (p.act === ACT.jump) {
    const u = clamp(t / ACTION.jump.dur, 0, 1), up = Math.sin(Math.PI * u);
    pose = mixPose(pose, P({ lean: -0.08, head: -0.35, lsz: -2.9, rsz: 2.9, lsx: -0.2, rsx: -0.2, le: -0.1, re: -0.1, lhx: -0.35, lk: 0.7, rhx: 0.15, rk: 0.9, lift: up * 0.75 }), smooth(0, 0.12, t) * (1 - smooth(0.85, 1, u)));
    pose.lift = up * 0.75;
  } else if (p.act === ACT.dive) {
    const u = smooth(0.02, 0.2, t);
    pose = mixPose(pose, P({ pitch: 1.38, lift: 0.55 - smooth(0.2, 0.46, t) * 0.38, head: -0.7, lsz: -2.8, rsz: 2.8, lsx: -0.35, rsx: -0.35, le: -0.2, re: -0.2, lhx: 0.15, rhx: -0.1, lk: 0.2, rk: 0.4 }), u);
  } else if (p.act === ACT.down) {
    const fromDive = anim.last === ACT.dive || anim.fellForward, u = smooth(0, 0.2, t), dirSign = fromDive ? 1 : anim.fall;
    const lie = P({ pitch: dirSign * 1.5, lift: 0.2, head: dirSign > 0 ? -0.5 : 0.35, lsz: -1.9, rsz: 1.3, lsx: -0.4, rsx: -0.9, le: -0.8, re: -1.4, lhx: -0.25, rhx: 0.2, lk: 0.9, rk: 0.35 });
    pose = fromDive ? lie : mixPose(pose, lie, u);
    const rise = p.dur > 0 && p.dur < 5 ? smooth(p.dur - 0.28, p.dur, t) : 0; if (rise > 0) pose = mixPose(pose, STANCE_DEF, rise);
  } else if (p.act === ACT.stumble) {
    const w = Math.sin(t * 22) * (1 - smooth(0.4, 0.95, t));
    pose = mixPose(pose, P({ lean: 0.75, head: -0.2, hipY: -0.28, lsz: -1.5 - w * 0.5, rsz: 1.5 - w * 0.5, lsx: w * 0.8, rsx: -w * 0.8, le: -0.5, re: -0.5, lhx: -0.8, lk: 1.3, rhx: 0.3, rk: 1.0, roll: w * 0.2 }), smooth(0, 0.12, t) * (1 - smooth(0.75, 0.95, t)));
  } else if (p.act === ACT.juke) {
    const u = Math.sin(Math.PI * clamp(t / ACTION.juke.dur, 0, 1)), dir = Math.sign(side) || 1;
    pose = mixPose(pose, P({ lean: 0.3, twist: -dir * 0.4, hipY: -0.22, lhz: -0.55 + (dir > 0 ? -0.15 : 0.3), rhz: 0.55 + (dir > 0 ? -0.3 : 0.15), lhx: -0.5, rhx: 0.1, lk: 1.0, rk: 0.8, rsx: -0.35, rsz: 0.12, re: -2.1, lsz: -1.4, lsx: -0.3, le: -0.5, roll: -dir * 0.42 }), u);
  } else if (p.act === ACT.stiff) {
    const u = smooth(0, 0.08, t) * (1 - smooth(0.38, 0.5, t));
    pose = mixPose(pose, Object.assign({}, pose, { lsx: -1.62, lsz: -0.12, le: 0, twist: 0.3 }), u);
  } else if (p.act === ACT.cheer) {
    const hop = Math.abs(Math.sin(t * 6.5 + anim.offset));
    pose = P({ lean: -0.15, head: -0.3, lsz: -2.55 - hop * 0.3, rsz: 2.55 + hop * 0.3, le: -0.4, re: -0.4, lift: hop * 0.3, lk: (1 - hop) * 0.55, rk: (1 - hop) * 0.55, lhx: -(1 - hop) * 0.3, rhx: -(1 - hop) * 0.3 });
  }
  return pose;
}

const b0 = (s) => (s.ball.m === 'held' ? s.ball.own : -1);

export function createView(container, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = canvasTexture(4, 256, (g, w, h) => { const q = g.createLinearGradient(0, 0, 0, h); q.addColorStop(0, '#16245c'); q.addColorStop(0.55, '#3a4fa8'); q.addColorStop(1, '#e08a6a'); g.fillStyle = q; g.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog(0x33447f, 58, 125);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 220);

  scene.add(new THREE.HemisphereLight(0xe4edff, 0x4d6a45, 1.55));
  const sun = new THREE.DirectionalLight(0xfff4dd, 2.0); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 2, far: 60 }); sun.shadow.bias = -0.0006; scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xaecbff, 0.7); fill.position.set(-8, 10, -6); scene.add(fill);

  /* ---------- Boden ---------- */
  const W = FIELD.halfW, G = FIELD.goal, E = FIELD.endDepth, X0 = -22, X1 = 22, Z0 = -22, Z1 = 70;
  const ground = canvasTexture(1024, 2048, (g, cw, ch) => {
    const sx = cw / (X1 - X0), sz = ch / (Z1 - Z0), X = (x) => (x - X0) * sx, Z = (z) => (Z1 - z) * sz;     // oben im Bild = großes z
    const r = seeded(31);
    g.fillStyle = '#42486b'; g.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 14000; i++) { const v = 55 + r() * 55; g.fillStyle = `rgba(${v},${v + 5},${v + 35},0.35)`; g.fillRect(r() * cw, r() * ch, 3, 3); }
    g.fillStyle = '#2f8a4c'; g.fillRect(X(-W - 1.6), Z(G + E + 1.6), (2 * W + 3.2) * sx, (G + 2 * E + 3.2) * sz);
    for (let z = 0; z < G; z += 5) { g.fillStyle = (z / 5) % 2 ? '#43b866' : '#38a85a'; g.fillRect(X(-W), Z(z + 5), 2 * W * sx, 5 * sz); }
    g.fillStyle = '#286f55'; g.fillRect(X(-W), Z(0), 2 * W * sx, E * sz);
    for (let i = 0; i < 26000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,200,0.07)' : 'rgba(0,50,20,0.1)'; g.fillRect(X(-W + r() * 2 * W), Z(-E + r() * (G + E)), 2, 5); }
    const line = (x, z, w, h, c = '#f4fbff') => { g.fillStyle = c; g.fillRect(X(x), Z(z + h), w * sx, h * sz); };
    for (let z = 0; z <= G; z += 5) line(-W, z - 0.07, 2 * W, z === 0 || z === G ? 0.24 : 0.12);
    for (let z = 1; z < G; z++) if (z % 5) for (const x of [-W + 0.15, -2.4, 2.1, W - 0.5]) line(x, z - 0.03, 0.35, 0.06, 'rgba(244,251,255,0.75)');
    for (const x of [-W - 0.18, W]) line(x, -E, 0.18, G + 2 * E);
    line(-W, -E - 0.1, 2 * W, 0.18); line(-W, G + E - 0.08, 2 * W, 0.18);
    g.font = `900 ${1.5 * sz}px system-ui, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(244,251,255,0.88)';
    for (let z = 5; z < G; z += 5) for (const [x, rot] of [[-W + 2.1, Math.PI / 2], [W - 2.1, -Math.PI / 2]]) { g.save(); g.translate(X(x), Z(z)); g.rotate(rot); g.scale(sz / sx > 1 ? 1 : sz / sx, 1); g.fillText(String(G - z), 0, 0); g.restore(); }
    g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 7; g.beginPath(); g.ellipse(X(0), Z(G / 2), 2.6 * sx, 2.6 * sz, 0, 0, 7); g.stroke();
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), new THREE.MeshLambertMaterial({ map: ground }));
  floor.rotation.x = -Math.PI / 2; floor.position.set((X0 + X1) / 2, 0, -(Z0 + Z1) / 2); floor.receiveShadow = true; scene.add(floor);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshLambertMaterial({ color: 0x2c3158 })); apron.rotation.x = -Math.PI / 2; apron.position.set(0, -0.05, -G / 2); scene.add(apron);
  // Endzone in der Farbe der angreifenden Seite; Schrift für beide Blickrichtungen lesbar
  const endTex = canvasTexture(512, 192, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 16;
    for (let x = -h; x < w; x += 44) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + h, 0); g.stroke(); }
    g.font = '900 italic 76px system-ui, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 12; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.strokeText('ENDZONE', w / 2, h / 2); g.fillStyle = '#ffffff'; g.fillText('ENDZONE', w / 2, h / 2);
  });
  const endZone = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, E - 0.2), new THREE.MeshLambertMaterial({ map: endTex, transparent: true, opacity: 0.9 }));
  endZone.rotation.x = -Math.PI / 2; endZone.position.set(0, 0.008, -(G + E / 2)); endZone.receiveShadow = true; scene.add(endZone);

  const flat = (w, h, color, opacity) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 1; scene.add(m); return m; };
  const losLine = flat(2 * W, 0.2, 0x2f7bff, 0.95), firstLine = flat(2 * W, 0.26, 0xffe23d, 0.95);

  /* ---------- Umgebung ---------- */
  const boxes = []; const addBox = (x, y, z, sx, sy, sz, c) => boxes.push([x, y, z, sx, sy, sz, c]);
  const crowd = []; const cr = seeded(77), CROWD_COLORS = [0xff8a30, 0x3fb8ff, 0xffd34d, 0xff6fd0, 0xe8ecff, 0x7ef0a8, 0xb58cff];
  for (const sideX of [-1, 1]) for (let row = 0; row < 4; row++) {
    const x = sideX * (W + 4.4 + row * 1.3); addBox(x, 0.35 + row * 0.38, -G / 2, 1.3, 0.7 + row * 0.76, G + 2 * E + 6, row % 2 ? 0x565f94 : 0x4a5283);
    for (let z = -E - 2; z < G + E + 2; z += 0.85) if (cr() < 0.8) crowd.push([x + (cr() - 0.5) * 0.4, 0.95 + row * 0.76, -z + (cr() - 0.5) * 0.3]);
  }
  for (const endZ of [-1, 1]) for (let row = 0; row < 3; row++) {
    const z = endZ < 0 ? -(G + E + 4.2 + row * 1.3) : E + 4.2 + row * 1.3; addBox(0, 0.35 + row * 0.38, z, 2 * W + 6, 0.7 + row * 0.76, 1.3, row % 2 ? 0x565f94 : 0x4a5283);
    for (let x = -W - 2.6; x < W + 2.6; x += 0.85) if (cr() < 0.8) crowd.push([x, 0.95 + row * 0.76, z]);
  }
  for (const sideX of [-1, 1]) { addBox(sideX * (W + 2.8), 0.42, -G / 2, 0.22, 0.84, G + 2 * E + 4, 0x2e8cff); }
  const unit = new THREE.BoxGeometry(1, 1, 1), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), C = new THREE.Color();
  const stands = new THREE.InstancedMesh(unit, new THREE.MeshLambertMaterial(), boxes.length);
  boxes.forEach((b, i) => { M.compose(V(b[0], b[1], b[2]), Q, V(b[3], b[4], b[5])); stands.setMatrixAt(i, M); stands.setColorAt(i, C.setHex(b[6])); }); scene.add(stands);
  const people = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.22, 2, 6), new THREE.MeshLambertMaterial({ emissive: 0x181830 }), crowd.length);
  crowd.forEach((c, i) => { M.makeTranslation(c[0], c[1], c[2]); people.setMatrixAt(i, M); people.setColorAt(i, C.setHex(CROWD_COLORS[Math.floor(cr() * CROWD_COLORS.length)])); }); scene.add(people);
  const glowTex = canvasTexture(128, 128, (g) => { const q = g.createRadialGradient(64, 64, 4, 64, 64, 64); q.addColorStop(0, 'rgba(255,255,245,1)'); q.addColorStop(0.25, 'rgba(255,240,200,0.55)'); q.addColorStop(1, 'rgba(255,230,180,0)'); g.fillStyle = q; g.fillRect(0, 0, 128, 128); });
  const towerAt = [[-W - 10, 6], [W + 10, 6], [-W - 10, -G - 2], [W + 10, -G - 2]];
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 13, 8), new THREE.MeshLambertMaterial({ color: 0x8a93c4 }), 4);
  const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 1.3, 0.35), new THREE.MeshBasicMaterial({ color: 0xfffbe8, fog: false }), 4);
  towerAt.forEach(([x, z], i) => { M.makeTranslation(x, 6.5, z); poles.setMatrixAt(i, M); M.compose(V(x, 13.4, z), Q.setFromEuler(new THREE.Euler(0, x < 0 ? 0.9 : -0.9, 0)), V(1, 1, 1)); lamps.setMatrixAt(i, M); Q.identity(); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); sp.position.set(x, 13.4, z); sp.scale.set(10, 8, 1); scene.add(sp); });
  scene.add(poles, lamps);
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xa87800, roughness: 0.35 });
  const tube = (len, x, y, z, rz = 0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 10), gold); m.position.set(x, y, z); m.rotation.z = rz; scene.add(m); };
  const gz = -(G + E); tube(2.4, 0, 1.2, gz); tube(5.2, 0, 2.4, gz, Math.PI / 2); tube(3.4, -2.6, 4.1, gz); tube(3.4, 2.6, 4.1, gz);

  /* ---------- Figuren ---------- */
  const skeletons = [], anims = [];
  for (let i = 0; i < 8; i++) { const sk = makeSkeleton(); skeletons.push(sk); const r = seeded(101 + i * 977); r(); anims.push({ k: r(), offset: r() * 6.28, phase: r() * 6.28, stride: 0.9 + r() * 0.22, x: 0, z: 0, last: 0, act: 0, fall: 1, fellForward: false }); }
  const meshes = {}, outlines = {};
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x070a18, side: THREE.BackSide });
  for (const [name, def] of Object.entries(PARTS)) {
    const geo = def.geo(), n = 8 * (def.n || 1);
    const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ emissive: 0x141418 }), n); m.castShadow = name !== 'plate' && name !== 'stripe' && name !== 'mask'; m.frustumCulled = false; scene.add(m); meshes[name] = m;
    if (def.out) { const o = new THREE.InstancedMesh(geo, outlineMat, n); o.frustumCulled = false; scene.add(o); outlines[name] = o; }
  }
  const SKINS = [0xf0b98d, 0xc98a55, 0x8d5a34, 0xe0a070, 0x6e4429, 0xd7996a, 0xb37446, 0xf4c7a1];
  let paintedOff = -1;
  function paint(off) {
    if (off === paintedOff) return; paintedOff = off;
    for (let i = 0; i < 8; i++) {
      const team = i < 4 ? off : 1 - off, base = new THREE.Color(TEAM[team]);
      const colors = { jersey: base, pants: base.clone().lerp(new THREE.Color(team ? 0x06103a : 0x3a1402), 0.62), helmet: i === 0 ? new THREE.Color(0xffffff) : base.clone().lerp(new THREE.Color(0xffffff), 0.12), trim: i === 0 ? base : new THREE.Color(0xffffff), skin: new THREE.Color(SKINS[i]), glove: new THREE.Color(i >= 1 && i <= 3 ? 0xffffff : 0x20243c), sock: new THREE.Color(team ? 0xdfeaff : 0xfff0e2), shoe: new THREE.Color(0x15182c), mask: new THREE.Color(0xd6dcea) };
      for (const [name, def] of Object.entries(PARTS)) for (let k = 0; k < (def.n || 1); k++) meshes[name].setColorAt(i * (def.n || 1) + k, colors[def.col]);
    }
    for (const m of Object.values(meshes)) m.instanceColor.needsUpdate = true;
    endZone.material.color.setHex(TEAM[off]).lerp(new THREE.Color(0xffffff), 0.06);
  }
  const ringGeo = new THREE.RingGeometry(0.52, 0.72, 28).rotateX(-Math.PI / 2);
  const rings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }), 8); rings.frustumCulled = false; rings.renderOrder = 2; scene.add(rings);
  const mine = new THREE.Mesh(new THREE.RingGeometry(0.82, 1.08, 36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false })); mine.renderOrder = 3; scene.add(mine);
  const carrier = new THREE.Mesh(new THREE.RingGeometry(0.74, 0.98, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3350, transparent: true, depthWrite: false })); carrier.renderOrder = 3; scene.add(carrier);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.44, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0xffe23d, depthTest: false, transparent: true })); arrow.renderOrder = 9; scene.add(arrow);
  const arrowEdge = new THREE.Mesh(arrow.geometry, new THREE.MeshBasicMaterial({ color: 0x070a18, side: THREE.BackSide, depthTest: false, transparent: true })); arrowEdge.scale.setScalar(1.28); arrowEdge.renderOrder = 8; arrow.add(arrowEdge);

  /* ---------- Ball ---------- */
  const ballTex = canvasTexture(256, 128, (g) => { g.fillStyle = '#a2511f'; g.fillRect(0, 0, 256, 128); const r = seeded(5); for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(60,20,5,0.25)'; g.fillRect(r() * 256, r() * 128, 2, 2); } g.fillStyle = '#ffffff'; for (const x of [30, 226]) g.fillRect(x, 0, 11, 128); for (const x0 of [64, 192]) { g.fillRect(x0 - 3, 34, 6, 60); for (let y = 38; y < 94; y += 11) g.fillRect(x0 - 13, y, 26, 5); } });
  const ballGeo = new THREE.SphereGeometry(0.2, 20, 14).rotateX(Math.PI / 2).scale(1, 1, 1.65);
  const ball = new THREE.Mesh(ballGeo, new THREE.MeshLambertMaterial({ map: ballTex, emissive: 0x331505 })); ball.castShadow = true; scene.add(ball);
  const ballEdge = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide })); ballEdge.scale.setScalar(1.14); ball.add(ballEdge);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.24, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })); scene.add(spot);
  const target = new THREE.Group();
  for (const [r0, r1, c] of [[0.85, 1.05, 0xffffff], [0.18, 0.34, 0xffd34d]]) { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 32, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95, depthWrite: false })); m.renderOrder = 4; target.add(m); }
  target.visible = false; scene.add(target);
  const TRAIL = 18, trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })); trail.frustumCulled = false; trail.visible = false; scene.add(trail);
  const DOTS = 18, dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }), DOTS); dots.frustumCulled = false; dots.visible = false; scene.add(dots);

  /* ---------- Laufwege und Aufstellungs-Vorschau ---------- */
  const guides = new THREE.Group(); scene.add(guides); let guideKey = '';
  function ribbon(pts, color, width, opacity) {
    const v = [], idx = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      v.push(pts[i][0] - dz * width, 0.04, -(pts[i][1] + dx * width), pts[i][0] + dz * width, 0.04, -(pts[i][1] - dx * width));
      if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide })); m.renderOrder = 2; guides.add(m);
  }
  function head(from, to, color) {
    const g = new THREE.BufferGeometry(); let dx = to[0] - from[0], dz = to[1] - from[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const p = (f, s) => [to[0] + dx * f - dz * s, 0.045, -(to[1] + dz * f + dx * s)];
    g.setAttribute('position', new THREE.Float32BufferAttribute([...p(0.7, 0), ...p(-0.25, 0.55), ...p(-0.25, -0.55)], 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, depthWrite: false })); m.renderOrder = 2; guides.add(m);
  }
  function setGuides(preview, s) {
    const key = preview ? preview.kind + preview.i + ':' + s.los : '';
    if (key === guideKey) return; guideKey = key;
    for (const m of guides.children.slice()) { guides.remove(m); m.geometry.dispose(); m.material.dispose(); }
    if (!preview) return;
    if (preview.kind === 'play') {
      TARGETS.forEach((i, k) => {
        const route = PLAYS[preview.i].routes[i]; let pts = routePoints(preview.i, s.los, i);
        if (!pts) { const q = s.pl[route.block]; pts = [[LINEUP[i][0], s.los + LINEUP[i][1]], [q.x, q.z - 1]]; }
        ribbon(pts, TAG[k], route.block !== undefined ? 0.09 : 0.17, 0.9); head(pts[pts.length - 2], pts[pts.length - 1], TAG[k]);
      });
    } else {
      const f = FORMATIONS[preview.i];
      f.spots.forEach(([x, z], k) => {
        const pz = s.los + z, circle = (r, op) => ribbon(Array.from({ length: 29 }, (_, n) => [x + Math.cos((n / 28) * Math.PI * 2) * r, pz + Math.sin((n / 28) * Math.PI * 2) * r]), 0xffffff, 0.08, op);
        circle(0.7, 0.95);
        if (f.job[k] === 'zone') circle(3.2, 0.5); if (f.job[k] === 'deep') circle(4.2, 0.5);
        if (f.job[k] === 'rush') { ribbon([[x, pz - 0.8], [x * 0.3, s.los - 2.6]], 0xff5a6e, 0.16, 0.9); head([x, pz - 0.8], [x * 0.3, s.los - 2.6], 0xff5a6e); }
      });
    }
  }

  /* ---------- Partikel ---------- */
  const N = 320, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(N * 3).fill(-50), pCol = new Float32Array(N * 3), pVel = new Float32Array(N * 3), pAge = new Float32Array(N);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.22, vertexColors: true })); points.frustumCulled = false; scene.add(points); let pNext = 0;
  function burst(x, y, z, colors, speed, count, life = 1) {
    if (opts.reducedMotion) count = Math.ceil(count / 3);
    for (let n = 0; n < count; n++) { const i = pNext = (pNext + 1) % N; pPos.set([x, y, -z], i * 3); pVel.set([(Math.random() - 0.5) * speed, Math.random() * speed * 0.75 + 0.5, (Math.random() - 0.5) * speed], i * 3); C.setHex(colors[n % colors.length]); pCol.set([C.r, C.g, C.b], i * 3); pAge[i] = life * (0.6 + Math.random() * 0.5); }
    pGeo.attributes.color.needsUpdate = true;
  }
  function particles(dt) {
    for (let i = 0; i < N; i++) {
      if (pAge[i] <= 0) continue; pAge[i] -= dt; const k = i * 3; pVel[k + 1] -= 9 * dt; pPos[k] += pVel[k] * dt; pPos[k + 1] = Math.max(0.05, pPos[k + 1] + pVel[k + 1] * dt); pPos[k + 2] += pVel[k + 2] * dt;
      if (pPos[k + 1] <= 0.06) { pVel[k] *= 0.8; pVel[k + 2] *= 0.8; } if (pAge[i] <= 0) pPos[k + 1] = -50;
    }
    pGeo.attributes.position.needsUpdate = true;
  }

  /* ---------- Kamera ---------- */
  const cam = { side: 1, pos: V(), ready: false, shake: 0, time: 0, pitch: 0.75, fov: 40, insets: { top: 0, bottom: 0, left: 0, right: 0 }, size: [1, 1], target: V() };
  const basis = { r: V(), u: V(), f: V() };
  function orient() {
    const p = cam.pitch, d = cam.side;                                              // d = 1: Blick Richtung +z der Logik (Angriff), -1: Verteidigung
    basis.f.set(0, -Math.sin(p), -d * Math.cos(p)); basis.r.set(d, 0, 0); basis.u.crossVectors(basis.r, basis.f);
    camera.quaternion.setFromRotationMatrix(M.makeBasis(basis.r, basis.u, basis.f.clone().negate()));
  }
  // Nächste Kameraposition, bei der alle Punkte im freien Bildbereich liegen
  function fit(pts, minDepth) {
    const [w, h] = cam.size, I = cam.insets, tv = Math.tan((camera.fov * Math.PI) / 360), th = tv * camera.aspect;
    const x0 = -1 + (2 * I.left) / w, x1 = 1 - (2 * I.right) / w, y0 = -1 + (2 * I.bottom) / h, y1 = 1 - (2 * I.top) / h;
    const q = pts.map((p) => [p.dot(basis.r), p.dot(basis.u), p.dot(basis.f)]);
    const solve = (qf) => {
      let ax = -1e9, bx = 1e9, ay = -1e9, by = 1e9;
      for (const [r, u, f] of q) { const d = f - qf; ax = Math.max(ax, r - x1 * d * th); bx = Math.min(bx, r - x0 * d * th); ay = Math.max(ay, u - y1 * d * tv); by = Math.min(by, u - y0 * d * tv); }
      return ax <= bx && ay <= by ? [(ax + bx) / 2, (ay + by) / 2] : null;
    };
    let near = Math.min(...q.map((p) => p[2])) - 3, mid = 0; for (const p of q) mid += p[2]; near = Math.min(near, mid / q.length - minDepth);
    let lo = near - 150, hi = near, best = solve(near);
    if (!best) { for (let n = 0; n < 22; n++) { const m = (lo + hi) / 2; if (solve(m)) lo = m; else hi = m; } hi = lo; best = solve(lo) || [0, 0]; }
    return V().addScaledVector(basis.r, best[0]).addScaledVector(basis.u, best[1]).addScaledVector(basis.f, hi);
  }
  function framePoints(s, side, preview) {
    const pts = [], offense = side === s.off, b = s.ball;
    const person = (i, pad = 0.9) => { const p = s.pl[i]; pts.push(V(p.x - pad, 0, -p.z), V(p.x + pad, 0, -p.z), V(p.x, 2.9, -p.z)); };
    const at = (x, z, y = 0) => pts.push(V(clamp(x, -W - 0.5, W + 0.5), y, -clamp(z, -E, G + E)));
    const area = (x, z, dx, back, front) => { at(x - dx, z); at(x + dx, z); at(x, z - back); at(x, z + front); };
    const me = controlled(s, side);
    if (s.ph === 'pick' || s.ph === 'set') {
      const tall = cam.size[0] / cam.size[1] < 0.8;               // hochkant knapper rahmen, damit die Figuren lesbar groß sind
      for (let i = 0; i < 8; i++) person(i, tall ? 0.45 : 0.9);
      if (preview && preview.kind === 'play') for (const i of TARGETS) { const r = routePoints(preview.i, s.los, i); if (r) for (const [x, z] of r) at(x, Math.min(z, s.los + 13)); }
      if (preview && preview.kind === 'form') for (const [x, z] of FORMATIONS[preview.i].spots) at(x, s.los + z);
      area(0, s.los, tall ? 4 : 5, tall ? 3 : 4.5, tall ? 5.5 : 8);
    } else if (b.m === 'air') {
      person(b.tgt, 1.4); at(b.tx, b.tz); at(b.x, b.z, Math.min(b.y, 4)); area(b.tx, b.tz, 4, 3.5, 3.5);
      for (let i = 4; i < 8; i++) if (i === me || Math.hypot(s.pl[i].x - b.tx, s.pl[i].z - b.tz) < 5) person(i);
      if (b.t / b.T < 0.45) person(0);
    } else if (canPass(s)) {
      for (const i of [0, ...TARGETS]) person(i, 1.1);
      if (!offense) person(me, 1.2);
      area(s.pl[0].x * 0.4, s.pl[0].z, 4, 2, 7);
    } else {
      const c = b.m === 'held' ? s.pl[b.own] : null, x = c ? c.x : b.x, z = c ? c.z : b.z, dead = s.ph === 'dead' || s.ph === 'over';
      if (c) person(b.own, 1.4);
      area(x, z, dead ? 3.6 : 4.6, dead ? 3 : offense ? 3.5 : 6.5, dead ? 3 : offense ? 7.5 : 4);
      if (!dead) { for (let i = 0; i < 8; i++) if (Math.hypot(s.pl[i].x - x, s.pl[i].z - z) < (i === me ? 14 : 6.5)) person(i); }
    }
    if (!pts.length) area(0, s.los, 6, 5, 8);
    return pts;
  }
  function resize() {
    const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); renderer.setSize(w, h, false); camera.aspect = w / h; cam.size = [w, h];
    const a = w / h; cam.pitch = a < 0.8 ? 0.84 : a < 1.25 ? 0.86 : a < 1.9 ? 0.72 : 0.66; camera.fov = a < 0.8 ? 50 : a < 1.25 ? 42 : 34; camera.updateProjectionMatrix(); cam.ready = false;
  }

  /* ---------- Effekte aus Ereignissen ---------- */
  function event(e) {
    if (e.type === 'tackle') { cam.shake = 0.22 + (e.p || 0) * 0.25; burst(e.x, 0.6, e.z, [0xffffff, 0x6fe08a, 0xffd34d], 6 + (e.p || 0) * 4, 40, 0.8); }
    else if (e.type === 'td') { cam.shake = 0.2; burst(e.x, 2.2, e.z, [TEAM[e.s], 0xffd34d, 0xffffff, 0xff6fd0], 11, 170, 2.2); burst(0, 5, G + 3, [TEAM[e.s], 0xffd34d, 0xffffff], 14, 100, 2.4); }
    else if (e.type === 'catch') burst(e.x, 2, e.z, [0xffffff, 0x35f0ff], 4, 22, 0.6);
    else if (e.type === 'int') { cam.shake = 0.2; burst(e.x, 2.2, e.z, [0xffffff, 0xff5a6e, 0xffd34d], 7, 60, 1.1); }
    else if (e.type === 'swat') { cam.shake = 0.12; burst(e.x, 2, e.z, [0xffffff, 0xffb020], 5, 24, 0.6); }
    else if (e.type === 'shed' || e.type === 'block') { cam.shake = 0.12; burst(e.x, 1.2, e.z, [0xffffff, 0xc8e0ff], 4, 16, 0.5); }
    else if (e.type === 'juke' || e.type === 'dive') burst(e.x, 0.15, e.z, [0x9be8a8, 0xd8ffe0], 3, 10, 0.45);
    else if (e.type === 'snap') burst(e.x, 0.2, e.z, [0x9be8a8], 3, 10, 0.4);
  }

  /* ---------- Bild ---------- */
  const hide = new THREE.Matrix4().makeScale(0, 0, 0), S = new THREE.Matrix4(), tmp = V(), tmp2 = V(), zAxis = V(0, 0, 1), spinQ = new THREE.Quaternion();
  let spin = 0, lastPlay = -1, trailN = 0;
  function frame(dt, s, o = {}) {
    cam.time += dt;
    if (!s) { renderer.render(scene, camera); return; }
    if (o.insets) cam.insets = o.insets;
    const side = o.me || 0, offense = side === s.off;
    paint(s.off);
    if (s.play !== lastPlay) { lastPlay = s.play; trailN = 0; for (let i = 0; i < 8; i++) { const a = anims[i], p = s.pl[i]; a.x = p.x; a.z = p.z; a.last = a.act = p.act; a.fellForward = false; a.fall = 1; } }
    losLine.position.set(0, 0.016, -(s.res && s.ph !== 'live' ? s.res.spot : s.los)); firstLine.position.set(0, 0.018, -s.line); firstLine.visible = s.line < FIELD.goal - 0.1;
    losLine.visible = !(s.res && s.res.type === 'td');
    for (let i = 0; i < 8; i++) {
      const p = s.pl[i], a = anims[i], sk = skeletons[i], moved = Math.hypot(p.x - a.x, p.z - a.z);
      if (p.act !== a.act) { a.last = a.act; a.act = p.act; if (p.act === ACT.down) { a.fellForward = a.last === ACT.dive; a.fall = p.vx * Math.sin(p.f) + p.vz * Math.cos(p.f) >= -0.5 ? 1 : -1; } }
      const speed = Math.hypot(p.vx, p.vz), stride = (0.72 + Math.min(1, speed / 8) * 0.85) * a.stride;       // Schrittlänge passt zum Tempo
      if (moved < 2) a.phase = (a.phase + (moved / stride) * Math.PI) % (Math.PI * 200);
      a.x = p.x; a.z = p.z;
      const pose = poseFor(s, i, p, a, cam.time);
      sk.root.position.set(p.x, pose.lift * SCALE, -p.z); sk.root.rotation.set(pose.pitch, Math.PI - p.f, pose.roll);
      if (Math.abs(pose.pitch) > 0.05) { const k = Math.sin(pose.pitch) * 0.75 * SCALE; sk.root.position.x -= Math.sin(p.f) * k; sk.root.position.z += Math.cos(p.f) * k; }
      applyPose(sk, pose); sk.root.updateMatrixWorld(true);
      for (const mk of sk.marks) {
        const def = PARTS[mk.type], at = i * (def.n || 1) + mk.k; meshes[mk.type].setMatrixAt(at, mk.node.matrixWorld);
        if (def.out) { S.copy(mk.node.matrixWorld).scale(tmp.setScalar(def.out)); outlines[mk.type].setMatrixAt(at, S); }
      }
      const team = i < 4 ? s.off : 1 - s.off; M.makeTranslation(p.x, 0.025, -p.z); rings.setMatrixAt(i, M); rings.setColorAt(i, C.setHex(TEAM[team]));
    }
    for (const m of Object.values(meshes)) m.instanceMatrix.needsUpdate = true;
    for (const m of Object.values(outlines)) m.instanceMatrix.needsUpdate = true;
    rings.instanceMatrix.needsUpdate = true; rings.instanceColor.needsUpdate = true;

    const me = controlled(s, side), mp = s.pl[me], showMe = !!mp && s.ph !== 'over';
    mine.visible = arrow.visible = showMe && !(s.ph === 'pick' && !offense);
    if (showMe) { const pulse = 1 + Math.sin(cam.time * 6) * 0.07; mine.position.set(mp.x, 0.032, -mp.z); mine.scale.setScalar(pulse); mine.material.opacity = s.ph === 'dead' ? 0.35 : 0.95; arrow.position.set(mp.x, 4.15 + Math.sin(cam.time * 5) * 0.12, -mp.z); arrow.rotation.y += dt * 2.4; arrow.visible = mine.visible && s.ph !== 'dead'; }

    // Ballträger des Gegners deutlich markieren
    const hunt = !offense && b0(s) >= 0 && b0(s) < 4 && (s.ph === 'live');
    carrier.visible = hunt; if (hunt) { const q = s.pl[s.ball.own]; carrier.position.set(q.x, 0.036, -q.z); carrier.rotation.y += dt * 3; carrier.scale.setScalar(1.05 + Math.sin(cam.time * 9) * 0.1); }

    // Ball
    const b = s.ball; let bx = b.x, by = b.y, bz = -b.z;
    const held = b.m === 'held' && !(s.ph === 'pick' || s.ph === 'set') && !(s.ph === 'live' && s.pt < 0.22 && b.own === 0);
    if (held) { const sk = skeletons[b.own], p = s.pl[b.own]; sk.armR.hand.getWorldPosition(tmp); if (b.own === 0 && canPass(s) && s.hold.k < 0 && p.act === ACT.run) { sk.armL.hand.getWorldPosition(tmp2); tmp.lerp(tmp2, 0.5); } bx = tmp.x; by = Math.max(0.22, tmp.y); bz = tmp.z; }
    ball.position.set(bx, by, bz);
    if (b.m === 'air') {
      const u = clamp(b.t / b.T, 0, 1), nx = ballArc(b, Math.min(1.02, u + 0.03)), pv = ballArc(b, Math.max(0, u - 0.01));
      tmp.set(nx.x - pv.x, nx.y - pv.y, -(nx.z - pv.z)).normalize(); spin += dt * 26;                       // Spirale
      ball.quaternion.setFromUnitVectors(zAxis, tmp).multiply(spinQ.setFromAxisAngle(zAxis, spin));
      const arr = trailGeo.attributes.position.array; for (let i = 0; i < TRAIL; i++) { const q = ballArc(b, Math.max(0, u - i * 0.014)); arr.set([q.x, q.y, -q.z], i * 3); } trailGeo.attributes.position.needsUpdate = true; trailN = 1;
      ball.scale.setScalar(1.2);
    } else if (held) { const p = s.pl[b.own]; ball.rotation.set(0.35, Math.PI - p.f, 0.2); ball.scale.setScalar(0.95); trailN = 0; }
    else { if (b.m === 'loose') ball.rotateX(dt * 7); else ball.rotation.set(0, Math.PI / 2, 0); ball.scale.setScalar(1.1); trailN = 0; }
    trail.visible = !!trailN; spot.position.set(bx, 0.03, bz); spot.visible = by > 0.6; spot.scale.setScalar(clamp(1.3 - by * 0.12, 0.5, 1.3));
    target.visible = b.m === 'air';
    if (target.visible) { target.position.set(b.tx, 0.05, -b.tz); const left = clamp(1 - b.t / b.T, 0, 1); target.children[0].scale.setScalar(0.7 + left * 1.3); }

    // Wurfvorschau beim Ausholen (nur für den Angreifer)
    dots.visible = offense && canPass(s) && s.hold.k >= 0;
    if (dots.visible) {
      const high = s.hold.t >= PASS.highAfter, plan = passPlan(s, s.hold.k, high), arc = { fx: s.pl[0].x, fz: s.pl[0].z, fy: PASS.release, tx: plan.x, tz: plan.z, ty: PASS.catchY, apex: plan.apex };
      for (let i = 0; i < DOTS; i++) { const q = ballArc(arc, (i + 1) / (DOTS + 0.5)); M.makeTranslation(q.x, q.y, -q.z); dots.setMatrixAt(i, M); }
      dots.instanceMatrix.needsUpdate = true; dots.material.color.set(TAG[s.hold.k]); target.visible = true; target.position.set(plan.x, 0.05, -plan.z); target.children[0].scale.setScalar(1);
    }
    // Hilfslinien
    let preview = null;
    if (s.ph === 'pick') preview = o.preview === undefined || o.preview === null || o.preview < 0 ? null : { kind: offense ? 'play' : 'form', i: o.preview };
    else if (s.ph === 'set') preview = offense ? { kind: 'play', i: s.call.o } : null;
    else if (s.ph === 'live' && offense && canPass(s) && s.pt < 1.1) preview = { kind: 'play', i: s.call.o };
    setGuides(preview, s);
    particles(dt);

    // Kamera
    const dir = offense ? 1 : -1;
    if (dir !== cam.side) { cam.side = dir; cam.ready = false; }
    orient();
    const goal = fit(framePoints(s, side, preview), camera.aspect < 0.8 ? 16 : 13);
    if (!cam.ready) { cam.pos.copy(goal); cam.ready = true; }
    else {
      const dz = goal.dot(basis.f) - cam.pos.dot(basis.f), zoomRate = dz < 0 ? 5.5 : 1.8;                   // schnell raus, ruhig heran
      const along = damp(cam.pos.dot(basis.f), goal.dot(basis.f), zoomRate, dt), pan = s.ball.m === 'air' ? 8 : 4.5, right = damp(cam.pos.dot(basis.r), goal.dot(basis.r), pan, dt), up = damp(cam.pos.dot(basis.u), goal.dot(basis.u), pan, dt);
      cam.pos.set(0, 0, 0).addScaledVector(basis.f, along).addScaledVector(basis.r, right).addScaledVector(basis.u, up);
    }
    cam.shake = Math.max(0, cam.shake - dt * 1.1);
    const sh = opts.reducedMotion ? 0 : cam.shake * cam.shake * 2.2;
    camera.position.copy(cam.pos).addScaledVector(basis.r, Math.sin(cam.time * 67) * sh).addScaledVector(basis.u, Math.sin(cam.time * 89) * sh);
    camera.updateMatrixWorld();
    sun.target.position.set(b.x * 0.3, 0, -clamp(b.z + 3, 5, G)); sun.position.copy(sun.target.position).add(tmp.set(9, 20, 7));
    renderer.render(scene, camera);
  }

  return {
    canvas: renderer.domElement, resize, frame, event,
    reset() { cam.ready = false; lastPlay = -1; pAge.fill(0); pPos.fill(-50); pGeo.attributes.position.needsUpdate = true; },
    // Logikpunkt -> Bildschirmpunkt
    project(x, y, z) { const v = V(x, y, -z).project(camera), r = renderer.domElement.getBoundingClientRect(); return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, front: v.z < 1 }; },
    info() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, side: cam.side, fov: camera.fov, insets: Object.assign({}, cam.insets), phases: anims.map((a) => Math.round(a.phase * 100) / 100), cam: camera.position.toArray().map((v) => Math.round(v * 10) / 10) }; }
  };
}
