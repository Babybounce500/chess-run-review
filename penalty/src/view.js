// Darstellung mit three.js. Liest nur aus der Spiellogik ab, verändert sie nie.
import * as THREE from '../vendor/three.module.js';
import { FIELD, KEEPER } from './config.js';
import { keeperPose, ballAt, ballOnPath, flight, clamp } from './sim.js';

export const RUNUP = 0.9;                       // Anlauf vor dem Schuss (Sekunden)
const HW = FIELD.goalW / 2, H = FIELD.goalH, GZ = FIELD.goalZ;
const TEAM = [0x2ee59d, 0x38bdf8];
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const damp = (cur, to, rate, dt) => cur + (to - cur) * (1 - Math.exp(-rate * dt));

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ---------- Figur mit Gelenken ---------- */
function makeCharacter(color, keeper) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mat = (c, e = 0.18) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.05, emissive: c, emissiveIntensity: e });
  const shirt = mat(color, 0.22), shorts = mat(new THREE.Color(color).multiplyScalar(0.4).getHex()), skin = mat(0xc98a55, 0.12),
    shoe = mat(0xf2f2f2, 0.25), glove = mat(0xffb020, 0.45), hair = mat(0x2a1a10, 0.05);
  const outline = new THREE.MeshBasicMaterial({ color: 0x05060d, side: THREE.BackSide });
  const part = (geo, m, parent, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.castShadow = true;
    const o = new THREE.Mesh(geo, outline); o.scale.setScalar(1.12); mesh.add(o); parent.add(mesh); return mesh;
  };
  const limb = (r, len, m, parent) => part(new THREE.CapsuleGeometry(r, len - r, 4, 8), m, parent, 0, -len / 2, 0);
  const joint = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  const hips = joint(body, 0, 0.93, 0);
  part(new THREE.BoxGeometry(0.38, 0.2, 0.24), shorts, hips, 0, 0, 0);
  const spine = joint(hips, 0, 0.06, 0);
  part(new THREE.CapsuleGeometry(0.2, 0.28, 4, 10), shirt, spine, 0, 0.3, 0).scale.set(1.15, 1, 0.75);
  const neck = joint(spine, 0, 0.62, 0);
  part(new THREE.SphereGeometry(0.155, 18, 14), skin, neck, 0, 0.14, 0);
  part(new THREE.SphereGeometry(0.162, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), hair, neck, 0, 0.15, -0.005);
  const arm = (s) => {
    const sh = joint(spine, s * 0.29, 0.5, 0); limb(0.072, 0.3, shirt, sh);
    const el = joint(sh, 0, -0.31, 0); limb(0.058, 0.28, skin, el);
    const hand = part(new THREE.SphereGeometry(keeper ? 0.115 : 0.065, 12, 10), keeper ? glove : skin, el, 0, -0.32, 0);
    return { sh, el, hand };
  };
  const leg = (s) => {
    const hip = joint(hips, s * 0.12, -0.04, 0); limb(0.095, 0.42, shorts, hip);
    const knee = joint(hip, 0, -0.43, 0); limb(0.07, 0.4, skin, knee);
    const foot = joint(knee, 0, -0.42, 0); part(new THREE.BoxGeometry(0.15, 0.1, 0.28), shoe, foot, 0, 0, 0.06);
    return { hip, knee, foot };
  };
  const J = { root, body, hips, spine, neck, armL: arm(-1), armR: arm(1), legL: leg(-1), legR: leg(1) };
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.44, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; J.ring = ring;
  J.paint = (c) => { shirt.color.setHex(c); shirt.emissive.setHex(c); shorts.color.copy(new THREE.Color(c).multiplyScalar(0.4)); shorts.emissive.copy(shorts.color); ring.material.color.setHex(c); };
  return J;
}
// Pose = Gelenkwinkel. Fehlende Werte sind 0.
const KEYS = ['hipY', 'lean', 'twist', 'head', 'lsx', 'lsz', 'le', 'rsx', 'rsz', 're', 'lhx', 'lhz', 'lk', 'rhx', 'rhz', 'rk'];
function applyPose(J, p) {
  J.hips.position.y = 0.93 + (p.hipY || 0); J.spine.rotation.set(p.lean || 0, p.twist || 0, 0); J.neck.rotation.x = p.head || 0;
  J.armL.sh.rotation.set(p.lsx || 0, 0, p.lsz || 0); J.armL.el.rotation.x = p.le || 0;
  J.armR.sh.rotation.set(p.rsx || 0, 0, p.rsz || 0); J.armR.el.rotation.x = p.re || 0;
  J.legL.hip.rotation.set(p.lhx || 0, 0, p.lhz || 0); J.legL.knee.rotation.x = p.lk || 0;
  J.legR.hip.rotation.set(p.rhx || 0, 0, p.rhz || 0); J.legR.knee.rotation.x = p.rk || 0;
  J.legL.foot.rotation.x = -(p.lhx || 0) - (p.lk || 0) * 0.6; J.legR.foot.rotation.x = -(p.rhx || 0) - (p.rk || 0) * 0.6;
}
const blend = (a, b, t) => { const o = {}; for (const k of KEYS) o[k] = mix(a[k] || 0, b[k] || 0, t); return o; };
// Zeitleiste aus Schlüsselposen
function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) return blend(keys[i - 1][1], keys[i][1], smooth(keys[i - 1][0], keys[i][0], t));
  return keys[keys.length - 1][1];
}
const IDLE = { lsz: -0.16, rsz: 0.16, le: -0.25, re: -0.25, lk: 0.06, rk: 0.06 };
const BACKSWING = { lean: 0.22, twist: 0.35, hipY: -0.07, lhx: -0.35, lk: 0.5, rhx: 0.95, rk: 1.5, lsx: -0.9, lsz: -0.9, le: -0.4, rsx: 0.7, rsz: 0.35, re: -0.5 };
const CONTACT = { lean: 0.05, twist: -0.05, hipY: -0.08, lhx: -0.18, lk: 0.35, rhx: -0.35, rk: 0.15, lsx: -0.5, lsz: -1.0, le: -0.3, rsx: 0.4, rsz: 0.5, re: -0.5 };
const FOLLOW = { lean: -0.18, twist: -0.5, hipY: 0.05, lhx: 0.22, lk: 0.15, rhx: -1.55, rk: 0.3, lsx: 0.5, lsz: -1.15, le: -0.3, rsx: -0.8, rsz: 0.6, re: -0.7 };
const CHEER = { lean: -0.2, head: -0.35, lsz: -2.6, rsz: 2.6, le: -0.35, re: -0.35, lhx: -0.1, rhx: 0.15, lk: 0.15, rk: 0.2 };
const SAD = { lean: 0.38, head: 0.45, lsz: -0.1, rsz: 0.1, lsx: -2.2, rsx: -2.2, le: -2.1, re: -2.1, lk: 0.15, rk: 0.15 };

export function createView(container, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = canvasTexture(4, 256, (g, w, h) => { const q = g.createLinearGradient(0, 0, 0, h); q.addColorStop(0, '#0a0b2a'); q.addColorStop(0.55, '#2b1d5c'); q.addColorStop(1, '#7a2f55'); g.fillStyle = q; g.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog(0x1a1440, 22, 46);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);

  scene.add(new THREE.HemisphereLight(0xaec4ff, 0x3a2418, 1.35));
  const sun = new THREE.DirectionalLight(0xfff2dc, 2.1); sun.position.set(5, 13, 3); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.target.position.set(0, 0, -6); scene.add(sun, sun.target);
  for (const [c, i, x, y, z] of [[0xff7820, 45, 0, 3.6, GZ - 0.6], [0x2ee59d, 20, -7, 3.5, -1], [0x8b5cf6, 24, 7, 3.5, -5]]) { const l = new THREE.PointLight(c, i, 18, 1.8); l.position.set(x, y, z); scene.add(l); }

  /* Boden mit Linien */
  const floorTex = canvasTexture(1024, 1024, (g, w, h) => {
    const S = w / 30, X = (x) => w / 2 + x * S, Z = (z) => h / 2 + (z + 5) * S;
    g.fillStyle = '#26293d'; g.fillRect(0, 0, w, h);
    let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 16000; i++) { const v = 30 + r() * 40; g.fillStyle = `rgba(${v + 20},${v + 25},${v + 55},0.35)`; g.fillRect(r() * w, r() * h, 2, 2); }
    g.strokeStyle = '#dfe8ff'; g.lineWidth = 5; g.globalAlpha = 0.85;
    g.beginPath(); g.moveTo(X(-8), Z(GZ)); g.lineTo(X(8), Z(GZ)); g.stroke();
    g.strokeRect(X(-5.2), Z(GZ), 10.4 * S, 5.6 * S);
    g.strokeRect(X(-3.8), Z(GZ), 7.6 * S, 2.1 * S);
    g.beginPath(); g.arc(X(0), Z(-5.4), 2.4 * S, 0.42, Math.PI - 0.42); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(X(0), Z(0), 0.17 * S, 0, 7); g.fill();
    g.strokeStyle = '#ff8a30'; g.globalAlpha = 0.6; g.beginPath(); g.arc(X(0), Z(0), 1.5 * S, 0, 7); g.stroke();
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.82 }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = -5; floor.receiveShadow = true; scene.add(floor);

  /* Käfig, Skyline, Laternen */
  const fenceTex = canvasTexture(64, 64, (g) => { g.strokeStyle = 'rgba(150,170,230,0.75)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke(); });
  fenceTex.wrapS = fenceTex.wrapT = THREE.RepeatWrapping;
  const fence = (w, h, x, y, z, ry, rep) => { const t = fenceTex.clone(); t.needsUpdate = true; t.repeat.set(w * rep, h * rep); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.17, depthWrite: false, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };
  const backFence = fence(20, 5, 0, 2.5, -14.7, 0, 1.6);
  fence(24, 5, -9.5, 2.5, -4, Math.PI / 2, 1.6); fence(24, 5, 9.5, 2.5, -4, Math.PI / 2, 1.6);
  const windows = (seed) => canvasTexture(64, 128, (g) => { g.fillStyle = '#10112a'; g.fillRect(0, 0, 64, 128); let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let y = 6; y < 122; y += 11) for (let x = 6; x < 58; x += 11) if (r() < 0.22) { g.fillStyle = r() < 0.5 ? '#ffd27a' : r() < 0.5 ? '#7ad7ff' : '#ff7ab8'; g.fillRect(x, y, 5, 6); } });
  for (const side of [-1, 1]) [[-13, 7], [-9.4, 10], [-5.6, 8], [-1.8, 12.5], [2.2, 9], [6.2, 13], [10.4, 8.5], [14, 11]].forEach(([x, h], i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(3.1, h, 1), new THREE.MeshBasicMaterial({ map: windows(11 + i * 37 + (side > 0 ? 500 : 0)), color: 0x6a6c9c }));
    b.position.set(x, h / 2 - 0.5, side < 0 ? -22 : 14); scene.add(b);
  });
  for (const [x, z, c] of [[-8.6, -11.5, 0xffa040], [8.6, -11.5, 0xb58cff], [-8.6, 1.5, 0x2ee59d], [8.6, 1.5, 0x38bdf8]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 5.6, 8), new THREE.MeshStandardMaterial({ color: 0x39406a, metalness: 0.7, roughness: 0.35 }));
    pole.position.set(x, 2.8, z); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshBasicMaterial({ color: c })); lamp.position.set(x, 5.7, z); scene.add(pole, lamp);
  }

  /* Tor und Netz */
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.25 });
  const tube = (len, x, y, z, rz) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(FIELD.post, FIELD.post, len, 12), frameMat); m.position.set(x, y, z); m.rotation.z = rz || 0; m.castShadow = true; scene.add(m); return m; };
  const goalParts = [tube(H, -HW, H / 2, GZ), tube(H, HW, H / 2, GZ), tube(FIELD.goalW + FIELD.post * 2, 0, H, GZ, Math.PI / 2)];
  const netPts = [], netBase = [];
  const grid = (a, b, c, d, nu, nv) => {
    const at = (u, v) => [0, 1, 2].map((k) => mix(mix(a[k], b[k], u), mix(c[k], d[k], u), v));
    for (let i = 0; i <= nu; i++) for (let j = 0; j < nv; j++) netPts.push(...at(i / nu, j / nv), ...at(i / nu, (j + 1) / nv));
    for (let j = 0; j <= nv; j++) for (let i = 0; i < nu; i++) netPts.push(...at(i / nu, j / nv), ...at((i + 1) / nu, j / nv));
  };
  const back = GZ - 1.3;
  grid([-HW, 0, back], [HW, 0, back], [-HW, H - 0.15, back], [HW, H - 0.15, back], 30, 12);
  grid([-HW, H, GZ], [HW, H, GZ], [-HW, H - 0.15, back], [HW, H - 0.15, back], 30, 5);
  for (const s of [-HW, HW]) grid([s, 0, GZ], [s, 0, back], [s, H, GZ], [s, H - 0.15, back], 6, 12);
  netBase.push(...netPts);
  const netGeo = new THREE.BufferGeometry(); netGeo.setAttribute('position', new THREE.Float32BufferAttribute(netPts, 3));
  const netMat = new THREE.LineBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.5 });
  const net = new THREE.LineSegments(netGeo, netMat); net.frustumCulled = false; scene.add(net);
  let ripple = null;
  function updateNet(now) {
    if (!ripple) return;
    const age = now - ripple.t0, a = netGeo.attributes.position.array, amp = 0.55 * Math.exp(-age * 2.6) * Math.cos(age * 11);
    for (let i = 0; i < a.length; i += 3) {
      const dx = netBase[i] - ripple.x, dy = netBase[i + 1] - ripple.y, depth = clamp((GZ - netBase[i + 2]) / 1.3, 0, 1);
      a[i + 2] = netBase[i + 2] - amp * Math.exp(-(dx * dx + dy * dy) * 1.4) * depth;
    }
    netGeo.attributes.position.needsUpdate = true;
    if (age > 2.5) { ripple = null; netGeo.attributes.position.array.set(netBase); netGeo.attributes.position.needsUpdate = true; }
  }

  /* Spieler, Ball */
  const shooter = makeCharacter(TEAM[0], false), keeper = makeCharacter(TEAM[1], true);
  scene.add(shooter.root, shooter.ring, keeper.root, keeper.ring);
  const ballTex = canvasTexture(256, 128, (g) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#14162b'; for (const [x, y] of [[20, 30], [84, 64], [148, 28], [212, 66], [52, 104], [180, 108], [116, 4], [244, 8]]) { g.beginPath(); for (let k = 0; k < 5; k++) { const q = (k / 5) * Math.PI * 2; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(q) * 15, y + Math.sin(q) * 15); } g.fill(); } });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(FIELD.ballR, 24, 18), new THREE.MeshStandardMaterial({ map: ballTex, emissive: 0xffffff, emissiveMap: ballTex, emissiveIntensity: 0.3, roughness: 0.4 }));
  ball.castShadow = true; scene.add(ball);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.27, 24), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; scene.add(halo);
  const TRAIL = 22, trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(TRAIL * 3), 3));
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.75 })); trail.frustumCulled = false; trail.visible = false; scene.add(trail);

  /* Zielhilfe */
  const reticle = new THREE.Group();
  for (const [r0, r1, c, o] of [[0.2, 0.27, 0xffffff, 0.95], [0.03, 0.08, 0xff7820, 1]]) { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 32), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide, depthTest: false })); m.renderOrder = 5; reticle.add(m); }
  reticle.visible = false; scene.add(reticle);
  const DOTS = 14, dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }), DOTS); dots.visible = false; dots.frustumCulled = false; scene.add(dots);
  const dm = new THREE.Matrix4();

  /* Konfetti und Funken */
  const N = 220, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(N * 3), pCol = new Float32Array(N * 3), pVel = new Float32Array(N * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true })); points.visible = false; points.frustumCulled = false; scene.add(points);
  let pLife = 0;
  function burst(x, y, z, colors, speed) {
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) { pPos.set([x, y, z], i * 3); pVel.set([(Math.random() - 0.5) * speed, Math.random() * speed * 0.8, (Math.random() - 0.3) * speed], i * 3); c.setHex(colors[i % colors.length]); pCol.set([c.r, c.g, c.b], i * 3); }
    pLife = 2; points.visible = true; pGeo.attributes.color.needsUpdate = true;
  }

  /* Kamera */
  const state = { view: 'shooter', shake: 0, time: 0, follow: 0, portrait: false };
  const camPos = new THREE.Vector3(0, 2.4, 5), camLook = new THREE.Vector3(0, 1, -7);
  function cameraTargets(bx) {
    const asp = camera.aspect, portrait = asp < 0.9, wide = asp > 1.5;      // wide: Desktop und Handy quer
    state.portrait = portrait;
    if (state.view === 'keeper') {
      // Hochkant so weit zurück, dass das ganze Tor ins Bild passt (bei höchstens 74 Grad Blickwinkel)
      const dist = portrait ? Math.max(5.4, (HW + 0.45) / (0.754 * asp)) : 4.3;
      return { pos: [bx * 0.12, portrait ? 1.1 + dist * 0.36 : 2.9, GZ - dist], look: [bx * 0.15, portrait ? 0.3 : wide ? 0.5 : 0.85, -7.5], half: HW + 0.45, dist, min: wide ? 42 : 40 };
    }
    return { pos: [bx * 0.1, portrait ? 3.3 : 2.35, portrait ? 6.2 : 4.7], look: [bx * 0.25, portrait ? 0.35 : wide ? 0.2 : 0.85, wide ? -6 : -7], half: HW + 0.75, dist: (portrait ? 6.2 : 4.7) - GZ, min: wide ? 34 : 40 };
  }
  function fitFov(half, dist, min) {
    const v = (2 * Math.atan(half / dist / camera.aspect) * 180) / Math.PI;
    return clamp(v, min, 78);
  }
  function resize() {
    const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); renderer.setSize(w, h, false); camera.aspect = w / h; snapCamera();
  }
  function snapCamera() { const t = cameraTargets(0); camPos.set(...t.pos); camLook.set(...t.look); camera.fov = fitFov(t.half, t.dist, t.min); camera.updateProjectionMatrix(); camera.position.copy(camPos); camera.lookAt(camLook); camera.updateMatrixWorld(); }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3(), prevBall = new THREE.Vector3(0, FIELD.ballR, 0);
  let keeperIdlePhase = 0, trailOn = false;

  function poseShooter(t, result) {
    const J = shooter, start = state.portrait ? { x: -0.62, z: 0.95 } : { x: -0.95, z: 1.7 }, plant = { x: -0.3, z: 0.34 };
    let x, z, p, yaw = Math.PI;
    if (t === null) { x = start.x; z = start.z; yaw = Math.PI - 0.42; const b = Math.sin(state.time * 2.4); p = Object.assign({}, IDLE, { hipY: b * 0.012, lean: 0.04 + b * 0.015 }); }
    else if (t < -0.2) {
      const u = smooth(-RUNUP, -0.2, t); x = mix(start.x, plant.x - 0.06, u); z = mix(start.z, plant.z + 0.14, u); yaw = Math.PI - 0.42 + 0.3 * u;
      const dist = Math.hypot(x - start.x, z - start.z), ph = (dist / 0.82) * Math.PI;          // Schritt passt zum zurückgelegten Weg
      const sw = Math.sin(ph), run = { lean: 0.2, hipY: Math.abs(Math.cos(ph)) * 0.05 - 0.04, lhx: -sw * 0.8, rhx: sw * 0.8, lk: Math.max(0, sw) * 1.1 + 0.15, rk: Math.max(0, -sw) * 1.1 + 0.15, lsx: sw * 0.75, rsx: -sw * 0.75, lsz: -0.22, rsz: 0.22, le: -0.9, re: -0.9 };
      p = blend(IDLE, run, smooth(-RUNUP, -RUNUP + 0.18, t));
      p = blend(p, BACKSWING, smooth(-0.36, -0.2, t));
    } else {
      const u = smooth(-0.2, 0.12, t); x = mix(plant.x - 0.06, plant.x, u); z = mix(plant.z + 0.14, plant.z - 0.1, u); yaw = Math.PI - 0.12 * (1 - u);
      x -= 1.25 * smooth(0.06, 0.55, t); z += 0.35 * smooth(0.2, 0.7, t);         // nach dem Schuss zur Seite: freie Sicht aufs Tor
      p = track([[-0.2, BACKSWING], [-0.1, BACKSWING], [0.0, CONTACT], [0.17, FOLLOW], [0.34, FOLLOW], [0.75, IDLE]], t);
      if (result && t > result.tEvent + 0.35) {
        const w = smooth(result.tEvent + 0.35, result.tEvent + 0.75, t), happy = result.goal;
        p = blend(p, happy ? CHEER : SAD, w);
        if (happy) { const hop = Math.abs(Math.sin((t - result.tEvent) * 7)); p = Object.assign({}, p, { hipY: (p.hipY || 0) + hop * 0.18 * w, lk: (p.lk || 0) + (1 - hop) * 0.3 * w, rk: (p.rk || 0) + (1 - hop) * 0.3 * w }); yaw = mix(yaw, 0.2, w); }
      }
    }
    J.root.position.set(x, 0, z); J.root.rotation.y = yaw; applyPose(J, p); J.ring.position.set(x, 0.012, z);
  }

  function poseKeeper(t, dive, result) {
    const J = keeper, active = dive && t !== null && t >= dive.start;
    keeperIdlePhase = state.time;
    const sway = Math.sin(keeperIdlePhase * 2.1), bounce = Math.abs(Math.sin(keeperIdlePhase * 4.2));
    const ready = { lean: 0.3, head: -0.25, hipY: -0.17 + bounce * 0.03, lhz: -0.2, rhz: 0.2, lhx: -0.35, rhx: -0.35, lk: 0.7, rk: 0.7, lsz: -0.95, rsz: 0.95, lsx: -0.55, rsx: -0.55, le: -0.5, re: -0.5 };
    if (!active) {
      const x = sway * 0.16; J.root.position.set(x, 0, FIELD.keeperZ); J.root.rotation.set(0, 0, sway * 0.03); applyPose(J, ready); J.ring.position.set(x, 0.012, FIELD.keeperZ);
      return;
    }
    const q = keeperPose(dive, t), e = q.e, roll = -Math.atan2(q.dx, q.dy);
    const wide = clamp(Math.abs(dive.x) * 1.4, 0, 1), up = 1 - wide;
    const stretch = {
      lean: -0.05, head: -0.1, hipY: 0,
      lsz: -2.85 - (dive.x < 0 ? 0.12 : 0), rsz: 2.85 + (dive.x > 0 ? 0.12 : 0), lsx: -0.15, rsx: -0.15, le: -0.08, re: -0.08,
      lhz: -0.08 - (dive.x > 0 ? 0.3 : 0), rhz: 0.08 + (dive.x < 0 ? 0.3 : 0), lhx: dive.x > 0 ? -0.5 : 0.05, rhx: dive.x < 0 ? -0.5 : 0.05, lk: dive.x > 0 ? 0.8 : 0.15, rk: dive.x < 0 ? 0.8 : 0.15
    };
    if (Math.abs(dive.x) < 0.18 && dive.y < 0.35) Object.assign(stretch, { hipY: -0.3, lk: 1.3, rk: 1.3, lhx: -0.8, rhx: -0.8, lsz: -1.2, rsz: 1.2, lsx: -0.9, rsx: -0.9 });
    applyPose(J, blend(ready, stretch, smooth(0, 0.7, q.k)));
    // Landung: nach dem Ereignis zurück auf den Boden
    const done = result ? smooth(result.tEvent + 0.18, result.tEvent + 0.75, t) : smooth(dive.start + KEEPER.diveTime + 0.35, dive.start + KEEPER.diveTime + 0.9, t);
    const fy = mix(mix(0, q.footY - 0.05, e), up < 0.5 ? 0.12 : 0, done);
    const fx = mix(0, q.footX, e) + q.dx * 0.5 * done * wide;
    J.root.position.set(fx, Math.max(0, fy), FIELD.keeperZ);
    J.root.rotation.set(0, 0, mix(0, roll, e) * (1 - done) + (Math.sign(-dive.x) * 1.5 * wide) * done);
    J.ring.position.set(mix(0, q.cx, e), 0.012, FIELD.keeperZ);
  }

  return {
    canvas: renderer.domElement,
    resize,
    setView(v) { state.view = v; backFence.visible = v !== 'keeper'; netMat.opacity = v === 'keeper' ? 0.22 : 0.5; snapCamera(); },
    setTeams(shooterTeam) { shooter.paint(TEAM[shooterTeam]); keeper.paint(TEAM[1 - shooterTeam]); },
    reset() { trailOn = false; trail.visible = false; ripple = null; netGeo.attributes.position.array.set(netBase); netGeo.attributes.position.needsUpdate = true; points.visible = false; pLife = 0; ball.position.set(0, FIELD.ballR, 0); prevBall.copy(ball.position); snapCamera(); },
    // Zielvorschau: null blendet aus
    aim(shot) {
      reticle.visible = dots.visible = !!shot; if (!shot) return;
      const f = flight(shot, 1, true);
      reticle.position.set(f.tx, f.ty, GZ + 0.08);
      const hot = shot.power > 0.82; reticle.children[0].material.color.setHex(hot ? 0xff5a5a : 0xffffff);
      for (let i = 0; i < DOTS; i++) { const b = ballOnPath(f, (f.T * (i + 1) * 0.62) / DOTS); dm.makeTranslation(b.x, b.y, b.z); dots.setMatrixAt(i, dm); }
      dots.instanceMatrix.needsUpdate = true;
    },
    marker(p) { reticle.visible = !!p; dots.visible = false; if (p) { reticle.position.set(p.x, p.y, FIELD.keeperZ + 0.35); reticle.children[0].material.color.setHex(0xffd34d); } },
    // Ereignis-Effekte
    impact(result) {
      const b = ballAt(result, result.tEvent);
      if (result.outcome === 'goal') { ripple = { t0: state.time + 0.04, x: b.x, y: b.y }; burst(b.x, b.y, GZ + 0.2, [0x2ee59d, 0xffd34d, 0x38bdf8, 0xff5ab0], 7); state.shake = 0.22; }
      else if (result.outcome === 'save') { burst(b.x, b.y, FIELD.keeperZ + 0.2, [0xffffff, 0xffb020], 4); state.shake = 0.18; }
      else if (result.outcome === 'post') { burst(b.x, b.y, GZ, [0xffffff, 0xffe9a0], 5); state.shake = 0.3; goalParts.forEach((m) => (m.userData.hit = state.time)); }
    },
    frame(dt, scene_) {
      state.time += dt;
      const { t, result, dive } = scene_;
      poseShooter(t, result); poseKeeper(t, result ? result.dive : dive, result);
      let b = { x: 0, y: FIELD.ballR, z: 0 };
      if (result && t !== null && t >= 0) { b = ballAt(result, t); trailOn = t < result.tEvent + 0.25; }
      ball.position.set(b.x, b.y, b.z);
      const mx = b.x - prevBall.x, mz = b.z - prevBall.z, md = Math.hypot(mx, mz);
      if (md > 0.0004) ball.rotateOnWorldAxis(new THREE.Vector3(mz, 0, -mx).normalize(), md / FIELD.ballR * 0.6);
      prevBall.copy(ball.position);
      halo.position.set(b.x, 0.014, b.z); halo.material.opacity = clamp(0.85 - b.y * 0.25, 0.2, 0.85);
      const a = trailGeo.attributes.position.array;
      if (result && t !== null && t > 0.02 && trailOn) { trail.visible = true; for (let i = 0; i < TRAIL; i++) { const q = ballAt(result, Math.max(0, t - i * 0.008)); a.set([q.x, q.y, q.z], i * 3); } trailGeo.attributes.position.needsUpdate = true; } else trail.visible = false;
      updateNet(state.time);
      if (pLife > 0) { pLife -= dt; for (let i = 0; i < N * 3; i += 3) { pVel[i + 1] -= 6 * dt; pPos[i] += pVel[i] * dt; pPos[i + 1] = Math.max(0.03, pPos[i + 1] + pVel[i + 1] * dt); pPos[i + 2] += pVel[i + 2] * dt; } pGeo.attributes.position.needsUpdate = true; points.material.opacity = clamp(pLife, 0, 1); if (pLife <= 0) points.visible = false; }
      reticle.rotation.z += dt * 1.4; reticle.scale.setScalar(1 + Math.sin(state.time * 6) * 0.06);
      // Kamera folgt weich dem Ball
      const c = cameraTargets(result && t > 0 && t < result.tEvent + 0.6 ? b.x : 0);
      camPos.set(damp(camPos.x, c.pos[0], 4, dt), damp(camPos.y, c.pos[1], 4, dt), damp(camPos.z, c.pos[2], 4, dt));
      camLook.set(damp(camLook.x, c.look[0], 5, dt), damp(camLook.y, c.look[1], 5, dt), damp(camLook.z, c.look[2], 5, dt));
      state.shake = Math.max(0, state.shake - dt * 0.8);
      const s = opts.reducedMotion ? 0 : state.shake * state.shake * 3;
      camera.position.set(camPos.x + Math.sin(state.time * 71) * s, camPos.y + Math.sin(state.time * 93) * s, camPos.z);
      camera.lookAt(camLook);
      renderer.render(scene, camera);
    },
    // Bildschirmpunkt auf eine senkrechte Ebene bei planeZ
    pick(clientX, clientY, planeZ) {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera); plane.set(new THREE.Vector3(0, 0, 1), -planeZ);
      return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, y: hit.y } : null;
    },
    project(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camera), r = renderer.domElement.getBoundingClientRect(); return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }; },
    screenRight() { return state.view === 'keeper' ? -1 : 1; },
    info() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, view: state.view, fov: camera.fov }; }
  };
}
