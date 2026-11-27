// Darstellung: Ring, Publikum, zwei Kämpfer mit Gelenken (Arme und Beine per Zielpunkt berechnet), Kameras, Effekte.
import * as THREE from '../vendor/three.module.js';
import { windOf, backOf } from './sim.js';
import { DOWN } from './config.js';

export const CORNER = ['#ff4d5e', '#3d8bff'];
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const damp = (c, to, rate, dt) => c + (to - c) * (1 - Math.exp(-rate * dt));
const bez = (a, c, b, t) => a.clone().multiplyScalar((1 - t) * (1 - t)).addScaledVector(c, 2 * (1 - t) * t).addScaledVector(b, t * t);

const UPPER = 0.33, FORE = 0.34, THIGH = 0.46, SHIN = 0.46;
// Zwei Gelenke: Schulter fest, Hand soll zum Ziel, Ellbogen weicht in Richtung "pole" aus
function ik(root, target, a, b, pole, elbow, end) {
  const dir = target.clone().sub(root); let d = dir.length(); if (d < 1e-5) { dir.set(0, 0, 1); d = 1e-5; } else dir.divideScalar(d);
  d = clamp(d, Math.abs(a - b) + 0.02, a + b - 0.005);
  const cos = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), perp = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  elbow.copy(root).addScaledVector(dir, a * cos).addScaledVector(perp, a * Math.sqrt(1 - cos * cos));
  end.copy(root).addScaledVector(dir, d);
}

function canvasTexture(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

/* ---------- Kämpfer ---------- */
function makeFighter(scene, color, skinColor, hairColor) {
  const group = new THREE.Group(); scene.add(group);
  const mat = (c, rough = 0.55, e = 0.08) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, emissive: c, emissiveIntensity: e });
  const skin = mat(skinColor, 0.48, 0.1), trunks = mat(color, 0.5, 0.18), leather = mat(color, 0.28, 0.22), white = mat(0xf4f4f6, 0.5, 0.2), dark = mat(0x14151c, 0.7, 0), hair = mat(hairColor, 0.8, 0.03);
  const outline = new THREE.MeshBasicMaterial({ color: 0x05060b, side: THREE.BackSide });
  const mesh = (geo, m, line = 1.09, parent = group) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; if (line) { const q = new THREE.Mesh(geo, outline); q.scale.setScalar(line); o.add(q); } parent.add(o); return o; };
  const bone = (r0, r1, m) => { const o = mesh(new THREE.CylinderGeometry(r1, r0, 1, 12), m, 0); const q = new THREE.Mesh(new THREE.CylinderGeometry(r1 * 1.12, r0 * 1.12, 0.985, 12), outline); o.add(q); return o; };
  const ball = (r, m, line = 1.1) => mesh(new THREE.SphereGeometry(r, 16, 12), m, line);
  const J = { group, parts: {} };
  const P = J.parts;
  for (const s of ['L', 'R']) {
    P['upper' + s] = bone(0.088, 0.062, skin); P['fore' + s] = bone(0.064, 0.048, skin); P['elbow' + s] = ball(0.062, skin, 0); P['shoulder' + s] = ball(0.094, skin);
    const glove = new THREE.Group(); group.add(glove); P['glove' + s] = glove;
    mesh(new THREE.SphereGeometry(0.115, 18, 14), leather, 1.1, glove).scale.set(1, 1.02, 1.22);
    mesh(new THREE.SphereGeometry(0.05, 10, 8), leather, 1.15, glove).position.set(s === 'L' ? 0.095 : -0.095, -0.03, 0.02);
    const cuff = mesh(new THREE.CylinderGeometry(0.062, 0.066, 0.1, 14), white, 1.1, glove); cuff.rotation.x = Math.PI / 2; cuff.position.z = -0.14;
    P['thigh' + s] = bone(0.115, 0.085, trunks); P['shin' + s] = bone(0.078, 0.05, skin); P['knee' + s] = ball(0.08, skin, 0);
    const boot = new THREE.Group(); group.add(boot); P['boot' + s] = boot;
    mesh(new THREE.BoxGeometry(0.13, 0.1, 0.27), dark, 1.1, boot).position.set(0, 0, 0.05);
    mesh(new THREE.CylinderGeometry(0.062, 0.07, 0.17, 12), white, 1.08, boot).position.set(0, 0.11, -0.02);
  }
  P.hips = ball(0.19, trunks); P.belt = mesh(new THREE.CylinderGeometry(0.188, 0.182, 0.085, 20), white, 1.06);
  P.abs = bone(0.165, 0.2, skin); P.chest = ball(0.235, skin, 1.07); P.pecL = ball(0.12, skin, 0); P.pecR = ball(0.12, skin, 0); P.neck = bone(0.085, 0.072, skin);
  const head = new THREE.Group(); group.add(head); P.head = head;
  mesh(new THREE.SphereGeometry(0.142, 22, 18), skin, 1.09, head).scale.set(0.94, 1.08, 1);
  mesh(new THREE.SphereGeometry(0.146, 22, 10, 0, Math.PI * 2, 0, Math.PI * 0.38), hair, 0, head).position.y = 0.012;
  mesh(new THREE.BoxGeometry(0.13, 0.02, 0.03), dark, 0, head).position.set(0, 0.036, 0.133);                // Brauen
  for (const x of [-0.043, 0.043]) mesh(new THREE.SphereGeometry(0.014, 8, 6), dark, 0, head).position.set(x, 0.008, 0.131);
  mesh(new THREE.SphereGeometry(0.028, 8, 6), skin, 0, head).position.set(0, -0.025, 0.137);                  // Nase
  mesh(new THREE.BoxGeometry(0.06, 0.016, 0.02), dark, 0, head).position.set(0, -0.072, 0.128);
  for (const x of [-0.134, 0.134]) mesh(new THREE.SphereGeometry(0.03, 8, 6), skin, 0, head).position.set(x, 0, 0);
  J.skinMats = [skin];
  return J;
}
const UP = V(0, 1, 0);
function place(boneMesh, a, b) { const d = b.clone().sub(a), len = d.length() || 1e-4; boneMesh.position.copy(a).addScaledVector(d, 0.5); boneMesh.scale.set(1, len, 1); boneMesh.quaternion.setFromUnitVectors(UP, d.divideScalar(len)); }

/* ---------- Ansicht ---------- */
export function createView(container, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05060f); scene.fog = new THREE.Fog(0x070818, 6.5, 17);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 80);

  scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x2a1a24, 0.95));
  const key = new THREE.DirectionalLight(0xfff1dd, 2.3); key.position.set(2.5, 7, 1.5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 14 }); scene.add(key);
  const rimA = new THREE.DirectionalLight(0xff5a72, 1.1); rimA.position.set(-5, 3, 3); const rimB = new THREE.DirectionalLight(0x4a8cff, 1.2); rimB.position.set(5, 3, -4); scene.add(rimA, rimB);

  /* Ring */
  const HALF = 2.7;
  const canvasTex = canvasTexture(1024, 1024, (g, w) => {
    g.fillStyle = '#c9cfdd'; g.fillRect(0, 0, w, w);
    let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${60 + r() * 60},${70 + r() * 50},${110 + r() * 60},0.13)`; g.fillRect(r() * w, r() * w, 3, 3); }
    g.strokeStyle = '#1b2147'; g.lineWidth = 14; g.strokeRect(60, 60, w - 120, w - 120);
    g.beginPath(); g.arc(w / 2, w / 2, 255, 0, 7); g.lineWidth = 10; g.stroke();
    g.save(); g.translate(w / 2, w / 2); g.rotate(Math.PI / 2); g.textAlign = 'center'; g.fillStyle = '#1b2147'; g.font = 'italic 900 112px system-ui, sans-serif'; g.fillText('TITLE', 0, -12); g.fillStyle = '#d92d45'; g.fillText('NIGHT', 0, 96); g.restore();
    for (const [x, y, c] of [[60, w - 60, '#ff4d5e'], [w - 60, 60, '#3d8bff']]) { g.fillStyle = c; g.beginPath(); g.arc(x, y, 150, 0, 7); g.globalAlpha = 0.35; g.fill(); g.globalAlpha = 1; }
  });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 0.5, 0.5, HALF * 2 + 0.5), [0, 1, 2, 3, 4, 5].map((i) => (i === 2 ? new THREE.MeshStandardMaterial({ map: canvasTex, roughness: 0.85 }) : new THREE.MeshStandardMaterial({ color: 0x14183a, roughness: 0.7 }))));
  floor.position.y = -0.25; floor.receiveShadow = true; scene.add(floor);
  const posts = [];
  const corners = [[-HALF, HALF, 0xff4d5e], [HALF, -HALF, 0x3d8bff], [HALF, HALF, 0xe8e8f0], [-HALF, -HALF, 0xe8e8f0]];
  for (const [x, z, c] of corners) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.55, 12), new THREE.MeshStandardMaterial({ color: 0x9aa0b8, metalness: 0.8, roughness: 0.3 })); post.position.set(x, 0.775, z); scene.add(post);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, 0.2), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, emissive: c, emissiveIntensity: 0.25 })); pad.position.set(x * 0.975, 0.88, z * 0.975); pad.rotation.y = Math.PI / 4; scene.add(pad); posts.push([post, pad, x, z]);
  }
  const ropeMats = [0xd92d45, 0xf2f2f6, 0x2f6fe0].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, emissive: c, emissiveIntensity: 0.3 }));
  const ropes = [];
  [0.55, 0.93, 1.31].forEach((y, k) => { for (let side = 0; side < 4; side++) { const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, HALF * 2, 8), ropeMats[k]); rope.rotation.z = Math.PI / 2; const h = new THREE.Group(); h.rotation.y = (side * Math.PI) / 2; rope.position.set(0, y, HALF); h.add(rope); scene.add(h); ropes.push(h); } });
  // Publikum: viele einfache Figuren in Rängen
  const CROWD = 520, bodyGeo = new THREE.CapsuleGeometry(0.17, 0.32, 3, 8), headGeo = new THREE.SphereGeometry(0.13, 8, 6);
  const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshLambertMaterial(), CROWD), heads = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial(), CROWD), seats = [];
  { let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; const M = new THREE.Matrix4(), c = new THREE.Color();
    for (let i = 0; i < CROWD; i++) { const row = i % 5, a = (i / CROWD) * Math.PI * 2 * 5.03 + row, rad = 5.2 + row * 1.05 + r() * 0.35, x = Math.cos(a) * rad, z = Math.sin(a) * rad, y = -0.55 + row * 0.46;
      const aisle = Math.abs(x) < 1.25;                       // Gang für den Einmarsch frei lassen
      if (!aisle) seats.push({ i, x, y, z, p: r() * 7 });
      M.makeTranslation(x, y, z); bodies.setMatrixAt(i, M); c.setHSL(r(), 0.32, 0.045 + r() * 0.06); bodies.setColorAt(i, c);
      M.makeTranslation(x, y + 0.45, z); heads.setMatrixAt(i, M); c.setHSL(0.07, 0.35, 0.06 + r() * 0.09); heads.setColorAt(i, c);
      if (aisle) { M.makeScale(0, 0, 0); bodies.setMatrixAt(i, M); heads.setMatrixAt(i, M); } } }
  scene.add(bodies, heads);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshLambertMaterial({ color: 0x0b0d1e })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.9; scene.add(ground);
  const softTex = canvasTexture(128, 128, (g) => { const q = g.createRadialGradient(64, 64, 4, 64, 64, 62); q.addColorStop(0, 'rgba(255,255,255,.9)'); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.fillRect(0, 0, 128, 128); });
  const ramps = [0, 1].map((i) => {
    const dir = i === 0 ? 1 : -1, col = i === 0 ? 0xff4d5e : 0x3d8bff, g = new THREE.Group(); scene.add(g);
    const walk = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.4, 7.4), new THREE.MeshStandardMaterial({ color: 0x10132c, roughness: 0.5, metalness: 0.3 })); walk.position.set(0, -0.23, dir * (HALF + 3.9)); walk.receiveShadow = true; g.add(walk);
    const glow = new THREE.MeshBasicMaterial({ color: col });
    for (const x of [-0.8, 0.8]) { const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 7.4), glow); strip.position.set(x, -0.01, dir * (HALF + 3.9)); g.add(strip); }
    const z = dir * (HALF + 7.5);
    for (const x of [-1.1, 1.1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.1, 0.22), glow); post.position.set(x, 1.4, z); g.add(post); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.22, 0.22), glow); top.position.set(0, 2.95, z); g.add(top);
    const fog = [];
    for (let k = 0; k < 14; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: col, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending })); s.userData = { x: ((k * 37) % 17) / 17 * 2.6 - 1.3, z: z - dir * (((k * 53) % 23) / 23 * 4.5), p: k * 0.9 }; s.scale.setScalar(0.9 + (k % 5) * 0.25); g.add(s); fog.push(s); }
    const lamp = new THREE.PointLight(col, 0, 9, 1.6); lamp.position.set(0, 2.4, z - dir * 1.2); g.add(lamp);
    return { fog, lamp };
  });
  let excitement = 0, bounced = false;
  // Scheinwerferkegel und Blitzlichter
  const coneMat = new THREE.MeshBasicMaterial({ color: 0x8fb4ff, transparent: true, opacity: 0.045, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  for (const [x, z] of [[-3.4, -3.4], [3.4, -3.4], [-3.4, 3.4], [3.4, 3.4]]) { const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5, 6.5, 20, 1, true), coneMat); cone.position.set(x * 0.72, 3.4, z * 0.72); cone.lookAt(x * 1.9, 9, z * 1.9); cone.rotateX(Math.PI / 2); scene.add(cone); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff4d8 })); lamp.position.set(x * 1.35, 5.6, z * 1.35); scene.add(lamp); }
  const FL = 40, flGeo = new THREE.BufferGeometry(), flPos = new Float32Array(FL * 3); flGeo.setAttribute('position', new THREE.BufferAttribute(flPos, 3));
  const flashes = new THREE.Points(flGeo, new THREE.PointsMaterial({ map: canvasTexture(64, 64, (g) => { const q = g.createRadialGradient(32, 32, 1, 32, 32, 30); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.fillRect(0, 0, 64, 64); }), color: 0xffffff, size: 0.34, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })); flashes.frustumCulled = false; scene.add(flashes);
  let flashLevel = 0.1, flashT = 0;

  const fighters = [makeFighter(scene, 0xe2283f, 0xc9895a, 0x1c120c), makeFighter(scene, 0x1f63e0, 0x8a5636, 0x0d0907)];

  /* Effekte */
  const N = 140, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(N * 3), pVel = new Float32Array(N * 3), pCol = new Float32Array(N * 3), pLife = new Float32Array(N);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const dotTex = canvasTexture(64, 64, (g) => { const q = g.createRadialGradient(32, 32, 2, 32, 32, 30); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.fillRect(0, 0, 64, 64); });
  const sparks = new THREE.Points(pGeo, new THREE.PointsMaterial({ map: dotTex, size: 0.075, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false })); sparks.frustumCulled = false; scene.add(sparks);
  let pNext = 0;
  function burst(at, color, count, speed) { const c = new THREE.Color(color); for (let k = 0; k < count; k++) { const i = pNext++ % N; pPos.set([at.x, at.y, at.z], i * 3); pVel.set([(Math.random() - 0.5) * speed, Math.random() * speed * 0.7, (Math.random() - 0.5) * speed], i * 3); pCol.set([c.r, c.g, c.b], i * 3); pLife[i] = 0.5 + Math.random() * 0.3; } pGeo.attributes.color.needsUpdate = true; }
  const starTex = canvasTexture(128, 128, (g) => { g.translate(64, 64); g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 20; i++) { const r = i % 2 ? 16 : 62, a = (i / 20) * Math.PI * 2; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } g.fill(); });
  const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false, depthTest: false })); star.visible = false; star.renderOrder = 6; scene.add(star);
  let starLife = 0, starSize = 0.4;

  /* Haltung berechnen */
  const anim = [0, 1].map(() => ({ phase: 0, fall: 0, gap: 0, cheer: 0, rest: 0, away: 0 }));
  let fpv = -1;                                   // wessen Augen die Kamera gerade sind
  const neutralHead = V(0, 1.6, 0.1);
  // Kopf und Rumpf in eigenen Koordinaten (x rechts, y hoch, z zum Gegner)
  function torso(f, a, time, i) {
    const breathe = Math.sin(time * (f.st < 30 ? 7 : 3.4) + i * 2) * (f.st < 30 ? 0.022 : 0.011), bob = Math.abs(Math.sin(time * 4.4 + i * 1.7)) * 0.018;
    const duck = f.duck, lean = f.lean, hurt = clamp(f.hurt / 0.35, 0, 1), stun = f.stun > 0 ? Math.min(1, f.stun * 3) : 0;
    const pelvis = V(lean * 0.1, 0.97 - duck * 0.27 - bob * (1 - duck), -duck * 0.05);
    const chest = pelvis.clone().add(V(lean * 0.2 + Math.sin(time * 9) * 0.05 * stun, 0.36 - duck * 0.06 - Math.abs(lean) * 0.04 + breathe, 0.04 + duck * 0.2 - hurt * 0.07));
    const head = chest.clone().add(V(lean * 0.18 + f.hx * hurt * 0.2 + Math.sin(time * 7 + 1) * 0.07 * stun, 0.32 - duck * 0.04 - hurt * 0.03 - stun * 0.04, 0.05 + duck * 0.08 - hurt * 0.17));
    return { pelvis, chest, head, breathe, hurt, stun };
  }
  function pose(i, s, dt, time) {
    const f = s.f[i], o = s.f[1 - i], a = anim[i], gap = s.gap;
    const T0 = torso(f, a, time, i), oppT = torso(o, anim[1 - i], time, 1 - i);
    const { pelvis, chest, head } = T0;
    // Punkt des Gegners in meinen Koordinaten
    const theirs = (p) => V(-p.x, p.y, gap - p.z);
    let twist = 0, dip = 0, lunge = 0;
    const guardL = head.clone().add(V(-0.14, -0.1 + Math.sin(time * 5 + i) * 0.012, 0.3)), guardR = head.clone().add(V(0.12, -0.14 + Math.cos(time * 5 + i) * 0.012, 0.22));
    if (f.guard) {
      if (f.low) { guardL.copy(chest).add(V(-0.13, -0.1, 0.27)); guardR.copy(chest).add(V(0.13, -0.12, 0.26)); }
      else { guardL.copy(head).add(V(-0.085, -0.025, 0.2)); guardR.copy(head).add(V(0.085, -0.035, 0.2)); }
    } else if (f.st < 15 && !f.act) { guardL.y -= 0.18; guardR.y -= 0.22; }
    // Ich-Sicht: eigene Fäuste tiefer und weiter außen, damit der Gegner frei bleibt
    if (fpv === i) { for (const [h, k] of [[guardL, -1], [guardR, 1]]) { h.x += k * (f.guard ? 0.1 : 0.17); h.y -= f.guard ? 0.17 : 0.27; h.z += 0.06; } }
    const hands = [guardL, guardR];
    if (f.act) {
      const act = f.act, w = windOf(act), b = backOf(act), idx = act.hand < 0 ? 0 : 1, side = act.hand < 0 ? -1 : 1, G = hands[idx].clone();
      const real = act.done && !act.miss;
      // Ziel: beim Treffer die tatsächliche Stelle des Gegners, sonst dorthin, wo er eben noch war
      let target = act.body ? V(0, 1.2, gap - 0.2) : V(neutralHead.x, neutralHead.y, gap - neutralHead.z - 0.1);
      if (real) target = theirs(act.body ? oppT.chest.clone().add(V(0, -0.12, 0.2)) : oppT.head.clone().add(V(0, -0.01, 0.13)));
      else if (act.miss) target.z += 0.12;
      let reach, back = 0;
      if (act.t < w) { const u = act.t / w; reach = u < 0.38 ? 0 : Math.pow((u - 0.38) / 0.62, 2.1); back = u < 0.38 ? smooth(u / 0.38) : 1 - reach; }
      else reach = 1 - smooth((act.t - w) / b);
      const k = act.k;
      twist = -side * (k === 'jab' ? 0.2 : k === 'cross' ? 0.62 : k === 'hook' ? 0.75 : 0.45) * (reach - back * 0.45);
      if (k === 'upper') dip = back * 0.13 - reach * 0.06;
      if (k === 'hook') twist += side * back * 0.25;
      lunge = clamp(target.z - (k === 'hook' || k === 'upper' ? 0.66 : 0.76), 0, 0.72) * reach;
      let hand;
      if (k === 'hook') { const C = V(side * 0.78, target.y + 0.02, target.z * 0.62); hand = bez(G.clone().add(V(side * 0.16 * back, 0, -0.08 * back)), C, target, reach); }
      else if (k === 'upper') { const C = V(side * 0.14, target.y - 0.62, target.z * 0.72); hand = bez(G.clone().add(V(side * 0.04, -0.3 * back, -0.06 * back)), C, target.clone().add(V(0, 0.03, 0)), reach); }
      else hand = G.clone().add(V(side * 0.03 * back, -0.02 * back, -(k === 'cross' ? 0.2 : 0.09) * back)).lerp(target, reach);
      hands[idx] = hand;
    }
    // Rumpfdrehung, Ausfallschritt
    const rot = (p) => { const x = p.x - pelvis.x, z = p.z - pelvis.z, c = Math.cos(twist), n = Math.sin(twist); return V(pelvis.x + x * c + z * n, p.y, pelvis.z - x * n + z * c); };
    for (const p of [chest, head]) { p.copy(rot(p)); }
    pelvis.y -= dip; chest.y -= dip; head.y -= dip; chest.z += lunge * 0.62; head.z += lunge * 0.62; pelvis.z += lunge * 0.4;
    const shoulder = (side) => { const c = Math.cos(twist), n = Math.sin(twist), x = side * 0.255, z = 0.0; return V(chest.x + x * c + z * n, chest.y + 0.13, chest.z - x * n + z * c); };
    const sh = [shoulder(-1), shoulder(1)];
    // Beine: Schrittfolge nach zurückgelegtem Weg
    const moved = a.gap ? Math.abs(gap - a.gap) : 0; a.gap = gap; if (Math.abs(f.step) > 0.1 && !f.act) a.phase += moved * 7 + dt * Math.abs(f.step) * 3;
    const lift = (k) => (Math.abs(f.step) > 0.1 ? Math.max(0, Math.sin(a.phase + k)) * 0.09 : 0);
    const foot = [V(-0.2 + f.lean * 0.04, 0.07 + lift(0), 0.3 + lunge * 0.6), V(0.22 + f.lean * 0.04, 0.07 + lift(Math.PI), -0.27 + lunge * 0.05)];
    const joints = { pelvis, chest, head, sh, hands, foot, twist, hipSide: [V(pelvis.x - 0.13, pelvis.y - 0.02, pelvis.z), V(pelvis.x + 0.13, pelvis.y - 0.02, pelvis.z)] };
    if (a.walk) {                                                  // Einmarsch: aufrecht gehen, am Ende die Arme heben
      const w = a.walk, ph = w.dist * 4.1, up = w.raise;
      foot[0].set(-0.17, 0.07 + Math.max(0, Math.sin(ph)) * 0.13 * w.moving, Math.cos(ph) * 0.3 * w.moving);
      foot[1].set(0.17, 0.07 + Math.max(0, -Math.sin(ph)) * 0.13 * w.moving, -Math.cos(ph) * 0.3 * w.moving);
      pelvis.set(0, 0.99 - Math.abs(Math.sin(ph)) * 0.025 * w.moving, 0); chest.set(0, pelvis.y + 0.38, 0.03); head.set(0, chest.y + 0.33, 0.05);
      sh[0].set(-0.26, chest.y + 0.12, 0.02); sh[1].set(0.26, chest.y + 0.12, 0.02);
      hands[0].set(-0.4, 0.95, -Math.cos(ph) * 0.28 * w.moving + 0.05).lerp(V(-0.45, 2.22, 0.08), up); hands[1].set(0.4, 0.95, Math.cos(ph) * 0.28 * w.moving + 0.05).lerp(V(0.45, 2.22, 0.08), up);
      joints.hipSide = [V(-0.13, pelvis.y - 0.02, 0), V(0.13, pelvis.y - 0.02, 0)];
    }
    // Jubel, Pause, Sturz
    const over = s.phase === 'over', downed = (s.phase === 'down' && s.down.who === i) || (over && (s.how === 'ko' || s.how === 'tko') && s.win !== i);
    const fallTo = downed ? (s.phase === 'down' && !s.down.tko ? 1 - 0.55 * clamp(s.down.hits / s.down.need, 0, 1) : 1) : 0;
    a.fall = damp(a.fall, fallTo, fallTo > a.fall ? 5.5 : 4, dt);
    a.cheer = damp(a.cheer, (over && s.win === i) || (s.phase === 'down' && s.down.who !== i && s.down.tko) ? 1 : 0, 4, dt);
    a.rest = damp(a.rest, s.phase === 'rest' ? 1 : 0, 3, dt);
    if (!a.walk) a.away = damp(a.away, s.phase === 'down' && s.down.who !== i ? 0.75 : 0, 3, dt);
    if (a.rest > 0.01) { hands[0].lerp(V(-0.34, 0.92, 0.08), a.rest); hands[1].lerp(V(0.34, 0.92, 0.08), a.rest); chest.z += 0.08 * a.rest; head.y -= 0.04 * a.rest; }
    if (a.cheer > 0.01) { const j = Math.abs(Math.sin(time * 5)) * 0.1 * a.cheer; hands[0].lerp(V(-0.42, 2.18, 0.05), a.cheer); hands[1].lerp(V(0.42, 2.18, 0.05), a.cheer); for (const p of [pelvis, chest, head, ...sh, ...hands]) p.y += j; }
    return joints;
  }

  function draw(i, s, joints) {
    const J = fighters[i], P = J.parts, a = anim[i], gap = s.gap, fall = a.fall;
    const world = (p) => {
      let { x, y, z } = p;
      if (fall > 0.001) { const ang = fall * 1.45, c = Math.cos(ang), n = Math.sin(ang), y0 = y - 0.1, z0 = z + 0.25; y = 0.1 + Math.max(-0.02, y0 * c - 0.04 * n * (z0 > 0 ? 0 : 1)) + 0.07 * n; z = -0.25 + z0 * c - y0 * n - fall * 0.15; }
      const back = a.away;                          // beim Anzählen tritt der Stehende zurück
      return i === 0 ? V(x, y, gap / 2 - z + back) : V(-x, y, -gap / 2 + z - back);
    };
    const pelvis = world(joints.pelvis), chest = world(joints.chest), head = world(joints.head);
    P.hips.position.copy(pelvis); P.hips.scale.set(1.12, 0.82, 0.92);
    const waist = pelvis.clone().lerp(chest, 0.2); P.belt.position.copy(waist); P.belt.quaternion.setFromUnitVectors(UP, chest.clone().sub(pelvis).normalize()); P.belt.scale.set(1.06, 1, 0.9);
    place(P.abs, waist, chest.clone().lerp(pelvis, 0.12));
    const facing = (i === 0 ? Math.PI : 0) - joints.twist * 1;
    P.chest.position.copy(chest).y += 0.04; P.chest.rotation.set(0, facing, 0); P.chest.scale.set(1.06, 1.0, 0.76);
    const fwd = V(Math.sin(facing), 0, Math.cos(facing)), right = V(Math.cos(facing), 0, -Math.sin(facing));
    for (const [key, k] of [['pecL', -1], ['pecR', 1]]) { P[key].position.copy(chest).addScaledVector(right, 0.1 * k).addScaledVector(fwd, 0.12).y += 0.08; P[key].scale.set(1, 0.72, 0.62); P[key].rotation.y = facing; }
    const neckTop = head.clone().lerp(chest, 0.35); place(P.neck, chest.clone().add(V(0, 0.16, 0)), neckTop);
    P.head.position.copy(head);
    const look = world(V(0, joints.head.y - 0.05, joints.head.z + 1)); P.head.lookAt(look);
    ['L', 'R'].forEach((s2, k) => {
      const sh = world(joints.sh[k]), target = world(joints.hands[k]), elbow = V(), hand = V();
      const side = k === 0 ? -1 : 1, pole = world(joints.sh[k].clone().add(V(side * 0.55, -0.75, -0.25))).sub(sh);
      if (s.f[i].act && (s.f[i].act.hand < 0 ? 0 : 1) === k && s.f[i].act.k === 'hook') pole.copy(world(joints.sh[k].clone().add(V(side * 0.9, 0.05, -0.3))).sub(sh));
      // Arm: reicht er nicht, kommt die Schulter ein Stück mit
      const need = sh.distanceTo(target) - (UPPER + FORE - 0.02); if (need > 0) sh.addScaledVector(target.clone().sub(sh).normalize(), Math.min(need, 0.28));
      ik(sh, target, UPPER, FORE, pole, elbow, hand);
      P['shoulder' + s2].position.copy(sh); P['shoulder' + s2].scale.set(1, 0.95, 0.95);
      place(P['upper' + s2], sh, elbow); place(P['fore' + s2], elbow, hand.clone().lerp(elbow, 0.2)); P['elbow' + s2].position.copy(elbow);
      const g = P['glove' + s2]; g.scale.setScalar(fpv === i ? 0.74 : 1); g.position.copy(hand); g.lookAt(hand.clone().multiplyScalar(2).sub(elbow));
      const hip = world(joints.hipSide[k]), ft = world(joints.foot[k]), knee = V(), end = V(), kpole = world(joints.hipSide[k].clone().add(V(side * 0.12, -0.3, 0.9))).sub(hip);
      ik(hip, ft, THIGH, SHIN, kpole, knee, end);
      place(P['thigh' + s2], hip, knee.clone().lerp(hip, 0.06)); place(P['shin' + s2], knee, end); P['knee' + s2].position.copy(knee);
      const boot = P['boot' + s2]; boot.position.copy(end); boot.rotation.set(fall * -1.2 * (i === 0 ? -1 : 1), (i === 0 ? Math.PI : 0) + side * -0.18 * (i === 0 ? 1 : 1), 0);
    });
    J.head = head; J.chestW = chest;
  }

  /* Kamera */
  const cam = { mode: 'shoulder', pos: V(0, 2, 3), look: V(0, 1.4, 0), shake: 0, time: 0, ready: false };
  function cameraGoal(s, me, d) {
    if (d && s) {
      const portrait = camera.aspect < 0.9, gap = s.gap;
      if (d.mode === 'walk') {                                    // vor dem Einlaufenden her
        const dir = d.who === 0 ? 1 : -1, z = dir * (gap / 2 + anim[d.who].away), side = Math.sin(d.u * 2.2) * 0.55;
        return { pos: V(side * dir, 1.35 + d.u * 0.5, z - dir * (portrait ? 3.5 : 2.7)), look: V(0, 1.22, z), fov: portrait ? 58 : 42, rate: 5 };
      }
      if (d.mode === 'faceoff') { const a = 1.25 + d.u * 0.7, r = portrait ? 5.2 : 3.4; return { pos: V(Math.sin(a) * r, 1.45 + d.u * 0.25, Math.cos(a) * r), look: V(0, portrait ? 1.05 : 1.2, 0), fov: portrait ? 56 : 38, rate: 4 }; }
      if (d.mode === 'replay') {
        const dir = d.who === 0 ? 1 : -1, mine = (x, y, z) => V(x * dir, y, dir * (gap / 2 - z));
        if (d.angle === 0) { const r = portrait ? 5.4 : 2.7; return { pos: V(dir * r, 1.5, dir * (0.35 - d.u * 0.5)), look: V(0, 1.28, -dir * 0.2), fov: portrait ? 52 : 36, rate: 6 }; }
        return { pos: mine(portrait ? -1.5 : -1.25, 0.85 + d.u * 0.35, -0.5), look: mine(0.05, 1.42, gap * 0.95), fov: portrait ? 58 : 38, rate: 6 };
      }
    }
    const portrait = camera.aspect < 0.9, gap = s ? s.gap : 1.7, dir = me === 0 ? 1 : -1;
    const mine = (x, y, z) => (me === 0 ? V(x, y, gap / 2 - z) : V(-x, y, -gap / 2 + z));
    if (!s) return { pos: V(Math.sin(cam.time * 0.12) * 5.2, 2.5, Math.cos(cam.time * 0.12) * 5.2), look: V(0, 1.1, 0), fov: portrait ? 62 : 44, rate: 2 };
    if (s.phase === 'intro' && s.round === 1) { const u = smooth(s.pt / 2.0), a = mix(1.9, 0, u), rad = mix(5.2, 1, u), end = mine(portrait ? 1.12 : 1.78, portrait ? 2.42 : 2.1, portrait ? -2.05 : -1.2); const start = V(Math.sin(a) * rad * dir, 2.6, Math.cos(a) * rad * dir); return { pos: start.lerp(end, u), look: V(0, 1.25, 0).lerp(mine(portrait ? 0.02 : 0.12, portrait ? 1.08 : 1.24, gap * 0.82), u), fov: portrait ? 60 : 40, rate: 7 }; }
    const stopped = s.phase === 'down' || s.phase === 'over' || s.phase === 'rest';
    if (stopped) {
      const a = cam.time * 0.22 + 1.3, r = portrait ? 5.4 : 4.1;
      // Liegt jemand, rückt der Blick zu ihm (er fällt vom Gegner weg)
      const who = s.phase === 'down' ? s.down.who : s.phase === 'over' && (s.how === 'ko' || s.how === 'tko') && s.win >= 0 ? 1 - s.win : -1, cz = who < 0 ? 0 : (who === 0 ? 1 : -1) * (gap / 2 + 0.35);
      return { pos: V(Math.sin(a) * r, portrait ? 2.8 : 2.1, cz + Math.cos(a) * r), look: V(0, 0.65, cz * 0.8), fov: portrait ? 60 : 44, rate: 3 };
    }
    if (cam.mode === 'first') { const f = s.f[me], t = torso(f, anim[me], cam.time, me); return { pos: mine(t.head.x, t.head.y + 0.13, t.head.z - 0.12), look: mine(0, 1.38, gap), fov: portrait ? 80 : 64, rate: 22 }; }
    const lean = s.f[me].lean, duck = s.f[me].duck;
    // Schulterblick: weit genug seitlich, damit der eigene Kämpfer den Gegner nicht verdeckt
    return { pos: mine((portrait ? 1.12 : 1.78) + lean * 0.2, (portrait ? 2.42 : 2.1) - duck * 0.18, (portrait ? -2.05 : -1.2)), look: mine((portrait ? 0.02 : 0.12) + lean * 0.05, portrait ? 1.08 : 1.24, gap * 0.82), fov: portrait ? 60 : 40, rate: 9 };
  }
  let last = null, camKey = '';
  function resize() { const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); cam.ready = false; }

  return {
    resize,
    reset() { for (const a of anim) Object.assign(a, { phase: 0, fall: 0, gap: 0, cheer: 0, rest: 0, away: 0, walk: null }); cam.ready = false; cam.shake = 0; starLife = 0; pLife.fill(0); excitement = 0; },
    resetPose() { for (const a of anim) Object.assign(a, { fall: 0, cheer: 0, rest: 0, away: 0, gap: 0 }); },
    excite(v) { excitement = Math.min(1, Math.max(excitement, v)); },
    setCamera(m) { cam.mode = m; cam.ready = false; },
    camera: () => cam.mode,
    event(e, s) {
      if (!fighters[0].head) return;
      const at = (i, body) => { const J = fighters[i]; return (body ? J.chestW : J.head).clone().add(V(0, 0, i === 0 ? -0.14 : 0.14)); };
      if (e.type === 'hit') { const foe = 1 - e.side, p = at(foe, e.body); burst(p, e.body ? 0xffd9a0 : 0xbfe6ff, Math.min(36, 8 + e.p * 1.8), 1.6 + e.p * 0.12); star.position.copy(p); starSize = 0.22 + e.p * 0.022; starLife = 0.12; star.material.color.setHex(e.counter ? 0xffd34d : 0xffffff); cam.shake = Math.max(cam.shake, Math.min(0.12, 0.012 + e.p * 0.005)); flashLevel = Math.max(flashLevel, e.p > 11 ? 0.8 : 0.25); }
      else if (e.type === 'block') { burst(at(e.side, e.body), 0xff9a6a, 8, 1.2); cam.shake = Math.max(cam.shake, 0.015); }
      else if (e.type === 'parry') { const p = at(e.side, 0); star.position.copy(p); starSize = 0.55; starLife = 0.2; star.material.color.setHex(0x7ff2ff); burst(p, 0x7ff2ff, 22, 2.2); flashLevel = 0.5; }
      else if (e.type === 'down') { cam.shake = 0.16; flashLevel = 1; burst(at(e.side, 0), 0xffffff, 40, 2.6); }
      else if (e.type === 'over') flashLevel = 1;
    },
    frame(dt, s, o = {}) {
      cam.time += dt; const me = o.me || 0;
      if (s) last = s;
      const dd = o.director || null, shot = dd ? dd.mode + (dd.who || 0) + (dd.angle || 0) : '';
      if (shot !== camKey) { camKey = shot; cam.ready = false; }             // Schnitt zwischen den Einstellungen
      for (let i = 0; i < 2; i++) {
        const a = anim[i]; a.walk = null;
        if (dd && dd.mode === 'walk') { const moving = i === dd.who && dd.u < 0.78 ? 1 : 0, prog = i === dd.who ? smooth(Math.min(1, dd.u / 0.8)) : dd.who === 0 ? 1 : 0, off = (1 - prog) * 8.6; a.away = off; a.walk = { dist: 8.6 - off, moving, raise: i === dd.who ? smooth((dd.u - 0.76) / 0.14) : 0 }; }
        fighters[i].group.visible = !(dd && dd.mode === 'walk' && dd.who !== i);          // nur der Einlaufende ist zu sehen, sonst verstellt der andere die Kamera
      }
      ramps.forEach((r, i) => { const on = dd && dd.mode === 'walk' && dd.who === i ? 1 : dd && (dd.mode === 'walk' || dd.mode === 'faceoff') ? 0.35 : 0.12; r.lamp.intensity = damp(r.lamp.intensity, on * 22, 4, dt); for (const f of r.fog) { f.position.set(f.userData.x + Math.sin(cam.time * 0.5 + f.userData.p) * 0.25, 0.45 + Math.sin(cam.time * 0.8 + f.userData.p) * 0.15, f.userData.z); f.material.opacity = 0.04 + on * 0.16; } });
      excitement = Math.max(0, excitement - dt * 0.4);
      if (excitement > 0.03 || bounced) {                                // das Publikum springt auf
        bounced = excitement > 0.03; const M = new THREE.Matrix4();
        for (const q of seats) { const j = bounced ? Math.max(0, Math.sin(cam.time * 9 + q.p * 3)) * 0.28 * excitement * (q.p > 2 ? 1 : 0.4) + excitement * (q.p > 4.5 ? 0.22 : 0) : 0; M.makeTranslation(q.x, q.y + j, q.z); bodies.setMatrixAt(q.i, M); M.makeTranslation(q.x, q.y + 0.45 + j, q.z); heads.setMatrixAt(q.i, M); }
        bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
      }
      const shown = s || { phase: 'intro', round: 1, pt: 0, gap: 1.7, f: [0, 1].map(() => ({ lean: 0, duck: 0, step: 0, guard: 0, low: 0, st: 100, stun: 0, hurt: 0, hx: 0, act: null })), down: null };
      fpv = !dd && cam.mode === 'first' && s && (s.phase === 'fight' || s.phase === 'intro') ? me : -1;
      for (let i = 0; i < 2; i++) draw(i, shown, pose(i, shown, dt, cam.time));
      const g = cameraGoal(s, me, dd);
      if (!cam.ready) { cam.pos.copy(g.pos); cam.look.copy(g.look); cam.ready = true; }
      const k = 1 - Math.exp(-g.rate * dt); cam.pos.lerp(g.pos, k); cam.look.lerp(g.look, k);
      if (Math.abs(camera.fov - g.fov) > 0.05) { camera.fov = damp(camera.fov, g.fov, 6, dt); camera.updateProjectionMatrix(); }
      cam.shake = Math.max(0, cam.shake - dt * 0.55); const sh = opts.reducedMotion ? 0 : cam.shake;
      camera.position.set(cam.pos.x + Math.sin(cam.time * 91) * sh, cam.pos.y + Math.sin(cam.time * 117) * sh, cam.pos.z); camera.lookAt(cam.look);
      const first = !dd && cam.mode === 'first' && s && (s.phase === 'fight' || s.phase === 'intro');
      for (let i = 0; i < 2; i++) { const P = fighters[i].parts, hide = first && i === me; for (const key of ['head', 'neck', 'chest', 'pecL', 'pecR', 'abs', 'hips', 'belt', 'shoulderL', 'shoulderR']) P[key].visible = !hide; }
      // Seile zwischen Kamera und Ring ausblenden, damit sie die Sicht nicht zerschneiden
      for (const [post, pad, x, z] of posts) post.visible = pad.visible = Math.hypot(camera.position.x - x, camera.position.z - z) > 2.6;      // Pfosten dicht vor der Linse ausblenden
      for (const h of ropes) { const a = h.rotation.y, nx = Math.sin(a), nz = Math.cos(a); h.visible = camera.position.x * nx + camera.position.z * nz < HALF - 0.15; }
      for (let i = 0; i < N; i++) if (pLife[i] > 0) { pLife[i] -= dt; pVel[i * 3 + 1] -= 5 * dt; pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt; if (pLife[i] <= 0) pPos[i * 3 + 1] = -9; }
      pGeo.attributes.position.needsUpdate = true;
      starLife -= dt; star.visible = starLife > 0; if (star.visible) { star.scale.setScalar(starSize * (1.2 - starLife * 2)); star.material.rotation += dt * 6; }
      flashLevel = damp(flashLevel, 0.08, 1.4, dt); flashT -= dt;
      if (flashT <= 0) { flashT = 0.07; for (let i = 0; i < FL; i++) { const on = Math.random() < flashLevel * 0.4, q = seats[(Math.random() * seats.length) | 0]; flPos.set(on ? [q.x, q.y + 0.65, q.z] : [0, -20, 0], i * 3); } flGeo.attributes.position.needsUpdate = true; }
      renderer.render(scene, camera);
    },
    info() {
      const p = (v) => { const q = v.clone().project(camera), r = renderer.domElement.getBoundingClientRect(); return { x: r.left + ((q.x + 1) / 2) * r.width, y: r.top + ((1 - q.y) / 2) * r.height }; };
      const out = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, camera: cam.mode, fov: camera.fov, shot: camKey, excitement: +excitement.toFixed(2), z: fighters.map((f) => (f.chestW ? +f.chestW.z.toFixed(2) : 0)), shown: fighters.map((f) => f.group.visible) };
      if (fighters[0].head) { out.heads = [p(fighters[0].head), p(fighters[1].head)]; out.gloves = [0, 1].map((i) => ['gloveL', 'gloveR'].map((k) => { const w = fighters[i].parts[k].position; return [+w.x.toFixed(3), +w.y.toFixed(3), +w.z.toFixed(3)]; })); out.headW = [0, 1].map((i) => fighters[i].head.toArray().map((v) => +v.toFixed(3))); out.falls = anim.map((a) => +a.fall.toFixed(2)); }
      return out;
    }
  };
}
