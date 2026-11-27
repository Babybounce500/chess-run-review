// Die Kulisse: Abendhimmel, Platz, Käfig, Häuser, Zuschauer, Korbanlage mit beweglichem Netz.
import * as THREE from '../vendor/three.module.js';
import { COURT, HOOP } from './config.js';
import { clamp, lerp } from './math.js';
import { canvasTexture } from './figure.js';

const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export function buildCourt(scene) {
  scene.background = canvasTexture(4, 256, (g, w, h) => { const q = g.createLinearGradient(0, 0, 0, h); q.addColorStop(0, '#3f5fc4'); q.addColorStop(0.35, '#8a86dc'); q.addColorStop(0.62, '#ffab8f'); q.addColorStop(0.8, '#ffd39a'); q.addColorStop(1, '#8d6a7c'); g.fillStyle = q; g.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog(0xc99aa8, 34, 85);

  /* Boden */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 90), new THREE.MeshStandardMaterial({ color: 0x77708a, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.02, 10); ground.receiveShadow = true; scene.add(ground);
  const X0 = -8, X1 = 8, Z0 = -1.2, Z1 = 14.8, S = 64;
  const floorTex = canvasTexture((X1 - X0) * S, (Z1 - Z0) * S, (g, w, h) => {
    const X = (x) => (x - X0) * S, Z = (z) => (z - Z0) * S, r = rng(11);
    g.fillStyle = '#6f759c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f9bb0'; g.fillRect(X(-7), Z(0), 14 * S, 11.6 * S);
    const arc = () => { g.beginPath(); g.moveTo(X(-COURT.threeR), Z(0)); g.lineTo(X(-COURT.threeR), Z(HOOP.z)); g.arc(X(0), Z(HOOP.z), COURT.threeR * S, Math.PI, 0, true); g.lineTo(X(COURT.threeR), Z(0)); };
    arc(); g.fillStyle = '#49b4c0'; g.fill();
    g.fillStyle = '#ef8a55'; g.fillRect(X(-1.9), Z(0), 3.8 * S, 4.2 * S);
    g.beginPath(); g.arc(X(0), Z(4.2), 1.5 * S, 0, Math.PI); g.fillStyle = '#f6a35f'; g.fill();
    g.save(); g.translate(X(0), Z(9.4)); g.fillStyle = 'rgba(255,255,255,0.22)'; g.font = `italic 900 ${1.15 * S}px system-ui,Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BLACKTOP', 0, 0); g.restore();
    for (let i = 0; i < 26000; i++) { const light = r() < 0.5; g.fillStyle = light ? 'rgba(255,255,255,0.09)' : 'rgba(10,14,40,0.11)'; g.fillRect(r() * w, r() * h, 2, 2); }
    g.strokeStyle = '#fff8ec'; g.lineWidth = 0.085 * S; g.lineCap = 'square';
    g.strokeRect(X(-7), Z(0), 14 * S, 11.6 * S);
    arc(); g.stroke();
    g.strokeRect(X(-1.9), Z(0), 3.8 * S, 4.2 * S);
    g.beginPath(); g.arc(X(0), Z(4.2), 1.5 * S, 0, Math.PI); g.stroke();
    g.setLineDash([18, 16]); g.beginPath(); g.arc(X(0), Z(4.2), 1.5 * S, Math.PI, Math.PI * 2); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.arc(X(0), Z(HOOP.z), 1.0 * S, 0, Math.PI); g.stroke();
    g.beginPath(); g.arc(X(0), Z(11.6), 1.6 * S, Math.PI, Math.PI * 2); g.stroke();
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set((X0 + X1) / 2, 0, (Z0 + Z1) / 2); floor.receiveShadow = true; scene.add(floor);

  // Leuchtende Dreierlinie (zeigt: erst hier hinaus)
  const pts = [], edge = (a, rad) => [HOOP.x + Math.sin(a) * rad, 0.02, HOOP.z + Math.cos(a) * rad];
  const seg = (p, q, r1, r2) => pts.push(...p, ...q, ...r1, ...r1, ...q, ...r2);
  const W = 0.16, R = COURT.threeR;
  for (let i = 0; i < 48; i++) { const a = -Math.PI / 2 + (i / 48) * Math.PI, b = a + Math.PI / 48; seg(edge(a, R - W), edge(a, R + W), edge(b, R - W), edge(b, R + W)); }
  for (const s of [-1, 1]) seg([s * (R - W), 0.02, 0], [s * (R + W), 0.02, 0], [s * (R - W), 0.02, HOOP.z], [s * (R + W), 0.02, HOOP.z]);
  const arcGeo = new THREE.BufferGeometry(); arcGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const arcGlow = new THREE.Mesh(arcGeo, new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); arcGlow.visible = false; scene.add(arcGlow);

  /* Käfigzaun */
  const fenceTex = canvasTexture(64, 64, (g) => { g.strokeStyle = 'rgba(40,44,80,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke(); });
  fenceTex.wrapS = fenceTex.wrapT = THREE.RepeatWrapping;
  const postGeo = [];
  const fence = (w, h, x, z, ry) => {
    const t = fenceTex.clone(); t.needsUpdate = true; t.repeat.set(w * 2.2, h * 2.2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, h / 2, z); m.rotation.y = ry; scene.add(m);
    for (let i = 0; i <= Math.round(w / 2.6); i++) { const u = -w / 2 + (i * w) / Math.round(w / 2.6); postGeo.push([x + Math.cos(ry) * u, h, z - Math.sin(ry) * u]); }
  };
  fence(15.4, 2.6, 0, -0.62, 0); fence(13, 1.5, -7.6, 5.9, Math.PI / 2); fence(13, 1.5, 7.6, 5.9, Math.PI / 2);
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 6), new THREE.MeshStandardMaterial({ color: 0x3b3f66, roughness: 0.4, metalness: 0.5 }), postGeo.length);
  const m4 = new THREE.Matrix4();
  postGeo.forEach(([x, h, z], i) => posts.setMatrixAt(i, m4.makeScale(1, h, 1).setPosition(x, h / 2, z))); scene.add(posts);

  /* Mauer mit Farbflächen, Häuser, Bäume */
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 2.4), new THREE.MeshBasicMaterial({ map: canvasTexture(1024, 96, (g, w, h) => {
    const r = rng(5); g.fillStyle = '#b8605a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,20,30,.28)'; g.lineWidth = 1; for (let y = 8; y < h; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (y % 24) * 1.5; x < w; x += 36) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 12); g.stroke(); } }
    const col = ['#ffd34d', '#46bfff', '#ff6fa5', '#52e0a4', '#ff8a3d', '#a98bff'];
    for (let i = 0; i < 70; i++) { g.fillStyle = col[i % col.length]; g.globalAlpha = 0.75; g.beginPath(); const x = r() * w, y = 30 + r() * 60, s = 10 + r() * 28; if (i % 3 === 0) g.arc(x, y, s * 0.6, 0, 7); else { g.moveTo(x, y); g.lineTo(x + s * 1.4, y - s * 0.5); g.lineTo(x + s, y + s * 0.7); g.lineTo(x - s * 0.3, y + s * 0.4); } g.fill(); }
    g.globalAlpha = 1; g.fillStyle = '#6d3b4c'; g.fillRect(0, 0, w, 7);
  }) }));
  wall.position.set(0, 1.2, -4.2); scene.add(wall);
  const skyline = new THREE.Mesh(new THREE.PlaneGeometry(64, 15), new THREE.MeshBasicMaterial({ transparent: true, fog: false, map: canvasTexture(1024, 240, (g, w, h) => {
    const r = rng(23);
    for (const [base, color, min, max] of [[0, '#8d76b4', 90, 190], [1, '#5d4b86', 45, 140]]) {
      for (let x = -20; x < w; ) {
        const bw = 40 + r() * 70, bh = min + r() * (max - min); g.fillStyle = color; g.fillRect(x, h - bh, bw, bh);
        if (r() < 0.4) g.fillRect(x + bw * 0.4, h - bh - 14, 6, 14);
        for (let yy = h - bh + 8; yy < h - 10; yy += 13) for (let xx = x + 6; xx < x + bw - 8; xx += 11) if (r() < (base ? 0.3 : 0.16)) { g.fillStyle = r() < 0.7 ? '#ffdf95' : '#aee6ff'; g.fillRect(xx, yy, 5, 7); }
        x += bw + (base ? r() * 26 : 2);
      }
    }
    for (let x = 10; x < w; x += 34 + r() * 30) { g.fillStyle = r() < 0.5 ? '#2f6a63' : '#3d7d62'; g.beginPath(); g.arc(x, h - 12 - r() * 10, 16 + r() * 14, 0, 7); g.fill(); }
  }) }));
  skyline.position.set(0, 7, -15); scene.add(skyline);
  for (const s of [-1, 1]) { const side = skyline.clone(); side.rotation.y = -s * Math.PI / 2; side.position.set(s * 24, 6.4, 12); scene.add(side); }

  /* Flutlichter */
  const metal = new THREE.MeshStandardMaterial({ color: 0x4b507c, metalness: 0.55, roughness: 0.4 });
  const halo = canvasTexture(64, 64, (g) => { const q = g.createRadialGradient(32, 32, 2, 32, 32, 32); q.addColorStop(0, 'rgba(255,250,225,1)'); q.addColorStop(0.3, 'rgba(255,214,140,.55)'); q.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = q; g.fillRect(0, 0, 64, 64); });
  for (const [x, z] of [[-8.4, -0.8], [8.4, -0.8], [-8.9, 8.6], [8.9, 8.6]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 5.8, 8), metal); pole.position.set(x, 2.9, z); scene.add(pole);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.position.set(x, 5.85, z); glow.scale.setScalar(2.3); scene.add(glow);
  }

  /* Zuschauer (zwei Zeichenaufrufe) */
  const spots = [], rr = rng(41);
  for (const s of [-1, 1]) for (let i = 0; i < 16; i++) spots.push([s * (8.35 + (i % 2) * 0.75 + rr() * 0.2), 0.4 + i * 0.68 + rr() * 0.2]);
  for (let i = 0; i < 22; i++) if (Math.abs(-6.8 + i * 0.65) > 1.1) spots.push([-6.8 + i * 0.65 + rr() * 0.2, -1.5 - (i % 3) * 0.55]);
  const bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.24, 0.72, 3, 8), new THREE.MeshStandardMaterial({ roughness: 0.8 }), spots.length);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.7 }), spots.length);
  const shirts = [0xff6f61, 0xffc94d, 0x57d9a3, 0x5ab8ff, 0xb18cff, 0xff85c0, 0xf2f2f2], skins = [0xf0c095, 0xc98a5a, 0x8d5a3b, 0xe7ad83], c = new THREE.Color();
  spots.forEach((q, i) => { bodies.setColorAt(i, c.setHex(shirts[Math.floor(rr() * shirts.length)])); heads.setColorAt(i, c.setHex(skins[Math.floor(rr() * skins.length)])); q.push(rr() * 6.28, 0.85 + rr() * 0.3); });
  bodies.frustumCulled = heads.frustumCulled = false; scene.add(bodies, heads);
  function crowd(time, mood) {
    spots.forEach(([x, z, ph, h], i) => {
      const hop = Math.max(0, Math.sin(time * (3 + mood * 7) + ph)) * (0.03 + mood * 0.3);
      bodies.setMatrixAt(i, m4.makeScale(1, h, 1).setPosition(x, 0.6 * h + hop, z)); heads.setMatrixAt(i, m4.makeTranslation(x, 1.37 * h + hop, z));
    });
    bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
  }

  /* Korbanlage */
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.5, 10), metal); post.position.set(0, 1.75, 0.15); post.castShadow = true; scene.add(post);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 1.7, 12), new THREE.MeshStandardMaterial({ color: 0x2c4fd0, emissive: 0x16286e, roughness: 0.7 })); pad.position.set(0, 0.86, 0.15); scene.add(pad);
  const strut = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.75), metal); strut.position.set(0, 3.3, 0.52); scene.add(strut);
  const bw = HOOP.boardHalfW * 2, bh = HOOP.boardY1 - HOOP.boardY0, by = (HOOP.boardY0 + HOOP.boardY1) / 2;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.05), new THREE.MeshStandardMaterial({ color: 0xe8f8ff, emissive: 0x9fd8ff, emissiveIntensity: 0.35, transparent: true, opacity: 0.52, roughness: 0.1 }));
  glass.position.set(0, by, HOOP.boardZ - 0.025); glass.castShadow = true; scene.add(glass);
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff }), red = new THREE.MeshBasicMaterial({ color: 0xff5230 });
  const bar = (w, h, x, y, m, z = HOOP.boardZ + 0.008) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), m); q.position.set(x, y, z); scene.add(q); };
  bar(bw + 0.06, 0.06, 0, HOOP.boardY1, white); bar(bw + 0.06, 0.07, 0, HOOP.boardY0, red); for (const s of [-1, 1]) bar(0.06, bh, s * HOOP.boardHalfW, by, white);
  bar(0.62, 0.045, 0, 3.5, white); bar(0.62, 0.045, 0, 3.08, white); for (const s of [-1, 1]) bar(0.045, 0.46, s * 0.31, 3.29, white);
  const rimGroup = new THREE.Group(); rimGroup.position.set(HOOP.x, HOOP.y, HOOP.boardZ); scene.add(rimGroup);
  const orange = new THREE.MeshStandardMaterial({ color: 0xff6a1a, emissive: 0xff5a00, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.3 });
  const reach = HOOP.z - HOOP.boardZ;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(HOOP.r, HOOP.tube + 0.006, 10, 40), orange); ring.rotation.x = Math.PI / 2; ring.position.z = reach; ring.castShadow = true; rimGroup.add(ring);
  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, reach - HOOP.r + 0.04), orange); brace.position.z = (reach - HOOP.r) / 2; rimGroup.add(brace);

  const SEG = 12, ROWS = 5, base = [], lines = [];
  const node = (i, j) => { const u = j / ROWS, rad = lerp(HOOP.r - 0.008, 0.135, Math.sin((u * Math.PI) / 2)), a = ((i + (j % 2) * 0.5) / SEG) * Math.PI * 2; return [Math.cos(a) * rad, -u * 0.46, reach + Math.sin(a) * rad, u]; };
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < SEG; i++) { lines.push(node(i, j), node(i + (j % 2 ? 1 : 0), j + 1), node(i, j), node(i - (j % 2 ? 0 : 1), j + 1)); }
  for (let i = 0; i < SEG; i++) lines.push(node(i, ROWS), node(i + 1, ROWS));
  for (const q of lines) base.push(q[0], q[1], q[2]);
  const netGeo = new THREE.BufferGeometry(); netGeo.setAttribute('position', new THREE.Float32BufferAttribute(base, 3));
  const net = new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({ color: 0xffffff })); net.frustumCulled = false; rimGroup.add(net);
  let ripple = 9, rimKick = 9, rimPower = 0, netMoved = 0;
  function hoop(dt, ball) {
    ripple += dt; rimKick += dt;
    const a = netGeo.attributes.position.array, swing = ripple < 2 ? Math.exp(-ripple * 2.6) : 0;
    const bx = ball ? ball.x - HOOP.x : 9, by2 = ball ? ball.y - HOOP.y : 9, bz = ball ? ball.z - HOOP.z : 9;
    const inside = by2 < 0.05 && by2 > -0.6 && Math.hypot(bx, bz) < 0.3;
    netMoved = Math.max(swing, inside ? 1 : 0);
    for (let i = 0, k = 0; i < a.length; i += 3, k++) {
      const u = lines[k][3]; let x = base[i], y = base[i + 1], z = base[i + 2];
      if (swing > 0.01 && u > 0) { x += Math.sin(ripple * 17 + u * 3) * 0.1 * swing * u; z += Math.cos(ripple * 13 + u * 2) * 0.07 * swing * u; y -= Math.sin(Math.min(1, ripple * 6) * Math.PI) * 0.14 * u; }
      if (inside && u > 0) {                                                                 // Ball beult das Netz aus
        const dx = x - bx, dz = z - reach - bz, d = Math.hypot(dx, dz) || 0.001, near = clamp(1 - Math.abs(y - by2) / 0.22, 0, 1), push = Math.max(0, 0.15 - d) * near;
        x += (dx / d) * push; z += (dz / d) * push; y -= near * 0.05 * u;
      }
      a[i] = x; a[i + 1] = y; a[i + 2] = z;
    }
    netGeo.attributes.position.needsUpdate = true;
    rimGroup.rotation.x = rimKick < 1.2 ? Math.sin(rimKick * 28) * Math.exp(-rimKick * 5) * rimPower : 0;
  }

  return { arcGlow, crowd, hoop, swish() { ripple = 0; }, shakeRim(p) { rimKick = 0; rimPower = p; }, netActivity: () => netMoved };
}
