// Eigene Modelle: Palme, Laterne, Poller, Bank, Fahrzeuge und die Figur.
import * as THREE from '../vendor/three.module.js';
import { createBuilder, col, mat } from './geo.js';

export function palmGeometry() {
  const B = createBuilder(), trunk = col('#9a6b4f'), ring = col('#7d5340');
  let x = 0;
  for (let k = 0; k < 6; k++) { const nx = Math.pow((k + 1) / 6, 2) * 0.7; B.add(new THREE.CylinderGeometry(0.17 - k * 0.012, 0.23 - k * 0.012, 1.12, 6, 1, true), mat((x + nx) / 2, 0.55 + k * 1.1, 0, 0, 0, -(nx - x) / 1.1), k % 2 ? ring : trunk); x = nx; }
  const top = [0.7, 6.65, 0];
  B.add(new THREE.IcosahedronGeometry(0.34, 0), mat(top[0], top[1], 0), col('#6d4a2f'));
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + (i % 2) * 0.2, len = 2.7 + (i % 3) * 0.35, lift = i % 2 ? 0.75 : 0.35, green = col(i % 2 ? '#2f9a6e' : '#47b377');
    const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
    const pts = [[0, 0, 0.12], [0.38, lift, 0.5], [0.72, lift * 0.62, 0.4], [1, -0.55, 0.04]].map(([t, y, w]) => [[top[0] + dx * len * t + px * w, top[1] + y, dz * len * t + pz * w], [top[0] + dx * len * t - px * w, top[1] + y, dz * len * t - pz * w], [top[0] + dx * len * t, top[1] + y + 0.14, dz * len * t]]);
    for (let k = 0; k < 3; k++) { const p = pts[k], q = pts[k + 1]; for (const [l, r] of [[0, 2], [2, 1]]) { B.quad(p[l], p[r], q[r], q[l], [0, 1, 0], green); B.quad(q[l], q[r], p[r], p[l], [0, 1, 0], green); } }
  }
  return B.build();
}
export function lampGeometry() {
  const B = createBuilder(), c = col('#4b3d63');
  B.add(new THREE.CylinderGeometry(0.07, 0.12, 5.6, 6), mat(0, 2.8, 0), c);
  B.add(new THREE.CylinderGeometry(0.17, 0.2, 0.5, 6), mat(0, 0.25, 0), c);
  B.box(-0.05, 5.5, -0.05, 0.05, 5.62, 1.0, c);
  B.box(-0.22, 5.38, 0.75, 0.22, 5.52, 1.25, c);
  return B.build();
}
export function lampGlowGeometry() { const B = createBuilder(); B.box(-0.18, 5.3, 0.8, 0.18, 5.39, 1.2, col('#ffe6ad'), true); return B.build(); }
export function bollardGeometry() { const B = createBuilder(); B.add(new THREE.CylinderGeometry(0.2, 0.26, 0.8, 8), mat(0, 0.4, 0), col('#3d3552')); B.add(new THREE.CylinderGeometry(0.24, 0.24, 0.14, 8), mat(0, 0.82, 0), col('#ffc65a')); return B.build(); }
export function benchGeometry() { const B = createBuilder(), w = col('#b5714e'), m = col('#4b3d63'); B.box(-1.1, 0.42, -0.35, 1.1, 0.52, 0.2, w); B.box(-1.1, 0.62, -0.42, 1.1, 0.98, -0.34, w); for (const x of [-0.95, 0.85]) B.box(x, 0, -0.38, x + 0.1, 0.62, 0.18, m); return B.build(); }
export function planterGeometry() { const B = createBuilder(); B.add(new THREE.CylinderGeometry(0.8, 0.65, 0.7, 10), mat(0, 0.35, 0), col('#d99a7a')); B.add(new THREE.IcosahedronGeometry(0.65, 0), mat(0, 0.9, 0), col('#3f9d6b')); return B.build(); }

/* ---------- Fahrzeug "Brandung GT" ---------- */
// Seitenprofil (z nach vorn, y nach oben) entlang der Breite gezogen
function profile(points, width, bevel) {
  const s = new THREE.Shape(); points.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y))); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelOffset: -bevel, bevelSegments: 1 });
  g.translate(0, 0, -(width - bevel * 2) / 2); g.rotateY(-Math.PI / 2); return g;
}
const LOWER = [[-2.22, 0.34], [-2.26, 0.78], [-2.1, 0.98], [-1.3, 1.02], [0.95, 0.96], [2.0, 0.76], [2.27, 0.58], [2.24, 0.34], [1.85, 0.3], [-1.85, 0.3]];
const GLASS = [[-1.55, 0.98], [-0.8, 1.44], [0.22, 1.44], [1.08, 0.94]];
const ROOF = [[-0.92, 1.4], [-0.72, 1.5], [0.16, 1.5], [0.34, 1.4]];
const wheelPositions = [[-0.93, 0.38, 1.42], [0.93, 0.38, 1.42], [-0.93, 0.38, -1.38], [0.93, 0.38, -1.38]];
function carBody(B, paint, dark) {
  B.add(profile(LOWER, 1.96, 0.09), null, paint);
  B.add(profile(GLASS, 1.7, 0.05), null, col('#22304f'));
  B.add(profile(ROOF, 1.56, 0.04), null, paint);
  B.box(-1.0, 0.28, -0.75, -0.9, 0.46, 0.8, dark); B.box(0.9, 0.28, -0.75, 1.0, 0.46, 0.8, dark);
  B.box(-0.8, 0.32, 2.2, 0.8, 0.46, 2.32, dark); B.box(-0.85, 0.3, -2.3, 0.85, 0.46, -2.18, dark);
  for (const x of [-0.9, 0.78]) B.box(x, 0.98, -2.22, x + 0.12, 1.14, -1.96, dark);
  B.box(-0.98, 1.12, -2.26, 0.98, 1.19, -1.98, paint);
  for (const x of [-1.12, 0.96]) B.box(x, 0.98, 0.78, x + 0.16, 1.1, 0.95, paint);
  for (const [x, , z] of wheelPositions) { const s = Math.sign(x); B.add(new THREE.CylinderGeometry(0.47, 0.47, 0.04, 14), mat(s * 0.965, 0.42, z, 0, 0, Math.PI / 2), dark); }
}
function wheel(B, x, y, z) {
  B.add(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 14), mat(x, y, z, 0, 0, Math.PI / 2), col('#17131f'));
  B.add(new THREE.CylinderGeometry(0.24, 0.24, 0.32, 10), mat(x, y, z, 0, 0, Math.PI / 2), col('#d9d4e4'));
  B.box(x - 0.17, y - 0.045, z - 0.22, x + 0.17, y + 0.045, z + 0.22, col('#6a6478'));
}
export const CAR_COLORS = ['#e9e4ee', '#3fb8c9', '#f0a33c', '#7a5cc4', '#d6455c', '#4a7be0', '#59b87a', '#4a4358'];
export function parkedGeometry() {
  const B = createBuilder(), dark = col('#2a2436'); carBody(B, [1, 1, 1], dark);
  for (const [x, y, z] of wheelPositions) wheel(B, x, y + 0.02, z);
  B.box(-0.8, 0.62, 2.24, -0.35, 0.74, 2.28, col('#fff3cf')); B.box(0.35, 0.62, 2.24, 0.8, 0.74, 2.28, col('#fff3cf'));
  B.box(-0.85, 0.72, -2.31, -0.3, 0.86, -2.25, col('#c0253a')); B.box(0.3, 0.72, -2.31, 0.85, 0.86, -2.25, col('#c0253a'));
  return B.build();
}
export function playerCar() {
  const group = new THREE.Group(), lean = new THREE.Group(); group.add(lean);
  const paintMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 70, specular: 0x886655 });
  const lit = new THREE.MeshLambertMaterial({ vertexColors: true });
  const B = createBuilder(); carBody(B, col('#ff2f7e'), col('#241c30'));
  B.box(-0.09, 1.505, -0.72, 0.09, 1.52, 0.16, col('#fff2e8')); B.box(-0.09, 0.985, 1.12, 0.09, 1.0, 1.5, col('#fff2e8'));
  lean.add(new THREE.Mesh(B.build(), paintMat));
  const head = createBuilder(); head.box(-0.82, 0.6, 2.24, -0.34, 0.73, 2.3, col('#fff6d8')); head.box(0.34, 0.6, 2.24, 0.82, 0.73, 2.3, col('#fff6d8')); head.box(-0.7, 0.34, -2.32, 0.7, 0.38, -2.3, col('#37e6e0'));
  lean.add(new THREE.Mesh(head.build(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
  const tail = createBuilder(); tail.box(-0.9, 0.72, -2.32, -0.25, 0.86, -2.25, [1, 1, 1]); tail.box(0.25, 0.72, -2.32, 0.9, 0.86, -2.25, [1, 1, 1]);
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x80101e, toneMapped: false }); lean.add(new THREE.Mesh(tail.build(), tailMat));
  const wheelB = createBuilder(); wheel(wheelB, 0, 0, 0); const wheelGeo = wheelB.build();
  const wheels = wheelPositions.map(([x, y, z], i) => { const pivot = new THREE.Group(), spin = new THREE.Mesh(wheelGeo, lit); pivot.position.set(x, y + 0.02, z); pivot.add(spin); group.add(pivot); return { pivot, spin, front: i < 2 }; });
  return { group, lean, wheels, tailMat };
}

/* ---------- Figur mit Gelenken ---------- */
export function person() {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const skin = col('#d99a72'), shirt = col('#2fd0c4'), pants = col('#3a3470'), shoe = col('#f4ede4'), hair = col('#3a2230'), jacket = col('#ff7a3d');
  const part = (build) => { const B = createBuilder(); build(B); return new THREE.Mesh(B.build(), material); };
  const capsule = (B, r, len, y, c, sx = 1, sz = 1) => B.add(new THREE.CapsuleGeometry(r, len, 3, 8), mat(0, y, 0, 0, 0, 0, sx, 1, sz), c);
  const root = new THREE.Group(), hips = new THREE.Group(); hips.position.y = 0.94; root.add(hips);
  hips.add(part((B) => capsule(B, 0.16, 0.08, 0, pants, 1.15, 0.85)));
  const torso = new THREE.Group(); hips.add(torso);
  torso.add(part((B) => { capsule(B, 0.2, 0.3, 0.34, jacket, 1.12, 0.78); B.box(-0.075, 0.18, 0.13, 0.075, 0.56, 0.168, shirt); B.box(-0.06, 0.6, -0.05, 0.06, 0.7, 0.06, skin); }));
  const head = part((B) => { B.add(new THREE.SphereGeometry(0.17, 12, 10), mat(0, 0.14, 0, 0, 0, 0, 0.92, 1.05, 0.95), skin); B.add(new THREE.SphereGeometry(0.185, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), mat(0, 0.17, -0.015, -0.3, 0, 0), hair); B.box(-0.085, 0.14, 0.15, -0.035, 0.175, 0.166, hair); B.box(0.035, 0.14, 0.15, 0.085, 0.175, 0.166, hair); });
  head.position.y = 0.68; torso.add(head);
  const limb = (parent, x, y, upper, lower) => {
    const a = new THREE.Group(); a.position.set(x, y, 0); parent.add(a); a.add(part(upper.draw));
    const b = new THREE.Group(); b.position.y = -upper.len; a.add(b); b.add(part(lower.draw));
    return { a, b };
  };
  const arm = (x) => limb(torso, x, 0.54, { len: 0.3, draw: (B) => capsule(B, 0.07, 0.22, -0.15, jacket) }, { draw: (B) => { capsule(B, 0.055, 0.2, -0.13, skin); B.add(new THREE.SphereGeometry(0.065, 8, 6), mat(0, -0.3, 0), skin); } });
  const leg = (x) => limb(hips, x, -0.04, { len: 0.43, draw: (B) => capsule(B, 0.095, 0.3, -0.21, pants) }, { draw: (B) => { capsule(B, 0.078, 0.3, -0.2, pants); B.box(-0.085, -0.47, -0.09, 0.085, -0.37, 0.2, shoe); } });
  const arms = [arm(-0.29), arm(0.29)], legs = [leg(-0.12), leg(0.12)];
  let phase = 0, last = 0, blend = 0;
  return {
    group: root,
    animate(p, walked, speed, dt) {
      const step = Math.max(0, walked - last); last = walked;
      const run = Math.max(0, Math.min(1, (speed - 3.6) / 2.8)), stride = 1.5 + run * 1.1;
      if (step < 3) phase += step / stride * Math.PI * 2;
      blend += (Math.min(1, speed / 2) - blend) * Math.min(1, dt * 12);
      const air = !p.grounded, s = Math.sin(phase), c = Math.cos(phase), amp = (0.55 + run * 0.35) * blend;
      legs.forEach((l, i) => { const k = i ? -1 : 1; l.a.rotation.x = air ? (i ? 0.25 : -0.75) : -s * k * amp; l.b.rotation.x = air ? (i ? 0.7 : 1.1) : Math.max(0, c * k) * (0.8 + run * 0.8) * blend + 0.03; });
      arms.forEach((a, i) => { const k = i ? -1 : 1; a.a.rotation.x = air ? -0.5 : s * k * amp * 0.85; a.a.rotation.z = (i ? 1 : -1) * (air ? 0.5 : 0.09); a.b.rotation.x = air ? -0.7 : -(0.25 + run * 0.9) * blend - 0.12; });
      torso.rotation.x = 0.04 + run * 0.2 * blend; torso.rotation.y = s * 0.09 * blend;
      hips.position.y = 0.94 + Math.abs(c) * 0.05 * blend * (1 + run) - 0.025 * blend;
    }
  };
}
