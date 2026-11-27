// 3D-Szene: Rasen, Tore, Ränge, 22 instanzierte Figuren, Ball und Fernsehkamera. Liest nur den Spielzustand.
import * as THREE from '../vendor/three.module.js';
import { PITCH, TEAMS, NAMES } from './config.js';
import { ACT, N, dirOf } from './sim.js';

const SCALE = 1.2;                                   // Figuren etwas größer als echt, damit sie auf kleinen Bildschirmen lesbar bleiben
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SKIN = [0xf1c7a3, 0xd9a178, 0xa86f4c, 0x73472f, 0xe8b48e], HAIR = [0x1c120c, 0x4a2c17, 0x8a5a28, 0xd9b26a, 0x2a2a30];
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function canvasTexture(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

function pitchTexture() {
  const mx = 6, mz = 5, W = (PITCH.halfL + mx) * 2, H = (PITCH.halfW + mz) * 2;
  const tex = canvasTexture(2048, 1448, (g, w, h) => {
    const k = w / W, kz = h / H, X = (x) => (x + W / 2) * k, Z = (z) => (z + H / 2) * kz;
    g.fillStyle = '#237a3c'; g.fillRect(0, 0, w, h);
    const band = (PITCH.halfL * 2) / 18;
    for (let i = -2; i < 20; i++) { g.fillStyle = i % 2 ? '#2b9148' : '#30a052'; g.fillRect(X(-PITCH.halfL + i * band), 0, band * k + 1, h); }
    g.fillStyle = 'rgba(0,20,10,.22)'; g.fillRect(0, 0, w, Z(-PITCH.halfW)); g.fillRect(0, Z(PITCH.halfW), w, h); g.fillRect(0, Z(-PITCH.halfW), X(-PITCH.halfL), Z(PITCH.halfW) - Z(-PITCH.halfW)); g.fillRect(X(PITCH.halfL), Z(-PITCH.halfW), w, Z(PITCH.halfW) - Z(-PITCH.halfW));
    const rnd = seeded(7); for (let i = 0; i < 26000; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.06)'; g.fillRect(rnd() * w, rnd() * h, 2, 3); }
    g.strokeStyle = '#eefcf2'; g.fillStyle = '#eefcf2'; g.lineWidth = 0.22 * k;
    const rect = (x0, z0, x1, z1) => g.strokeRect(X(x0), Z(z0), (x1 - x0) * k, (z1 - z0) * kz);
    const dot = (x, z) => { g.beginPath(); g.arc(X(x), Z(z), 0.25 * k, 0, 7); g.fill(); };
    rect(-PITCH.halfL, -PITCH.halfW, PITCH.halfL, PITCH.halfW);
    g.beginPath(); g.moveTo(X(0), Z(-PITCH.halfW)); g.lineTo(X(0), Z(PITCH.halfW)); g.stroke();
    g.beginPath(); g.ellipse(X(0), Z(0), PITCH.circle * k, PITCH.circle * kz, 0, 0, 7); g.stroke(); dot(0, 0);
    for (const s of [-1, 1]) {
      const e = s * PITCH.halfL;
      rect(Math.min(e, e - s * PITCH.boxDepth), -PITCH.boxHalf, Math.max(e, e - s * PITCH.boxDepth), PITCH.boxHalf);
      rect(Math.min(e, e - s * PITCH.sixDepth), -PITCH.sixHalf, Math.max(e, e - s * PITCH.sixDepth), PITCH.sixHalf);
      dot(e - s * PITCH.spot, 0);
      const a = Math.acos((PITCH.boxDepth - PITCH.spot) / PITCH.circle);
      g.beginPath(); g.ellipse(X(e - s * PITCH.spot), Z(0), PITCH.circle * k, PITCH.circle * kz, 0, (s > 0 ? Math.PI : 0) - a, (s > 0 ? Math.PI : 0) + a); g.stroke();
      for (const t of [-1, 1]) { g.beginPath(); g.arc(X(e), Z(t * PITCH.halfW), 1 * k, s > 0 ? (t > 0 ? Math.PI : Math.PI / 2) : (t > 0 ? Math.PI * 1.5 : 0), s > 0 ? (t > 0 ? Math.PI * 1.5 : Math.PI) : (t > 0 ? Math.PI * 2 : Math.PI / 2)); g.stroke(); }
    }
  });
  return { tex, W, H };
}

export function createView(container, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x070a1f); container.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x0a1030, 150, 290);
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 500);
  scene.add(new THREE.HemisphereLight(0xdde8ff, 0x2a4a30, 1.9));
  const sun = new THREE.DirectionalLight(0xfff4dd, 1.5); sun.position.set(25, 60, 35); scene.add(sun);
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  const instanced = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; scene.add(m); return m; };
  const put = (mesh, i, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => { dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz); dummy.scale.set(sx, sy, sz); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); };

  /* ---------- Stadion ---------- */
  const pt = pitchTexture();
  const turf = new THREE.Mesh(new THREE.PlaneGeometry(pt.W, pt.H), new THREE.MeshLambertMaterial({ map: pt.tex })); turf.rotation.x = -Math.PI / 2; scene.add(turf);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 360), new THREE.MeshLambertMaterial({ color: 0x141a3a })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.06; scene.add(ground);
  // Tore
  const bars = instanced(new THREE.CylinderGeometry(1, 1, 1, 8), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x555566 }), 10);
  const netPts = []; let bi = 0;
  for (const s of [-1, 1]) {
    const x = s * PITCH.halfL, back = s * (PITCH.halfL + PITCH.goalDepth), hh = PITCH.goalH, gz = PITCH.goalHalf;
    for (const z of [-gz, gz]) put(bars, bi++, x, hh / 2, z, 0.08, hh, 0.08);
    put(bars, bi++, x, hh, 0, 0.08, gz * 2 + 0.16, 0.08, Math.PI / 2);
    for (const z of [-gz, gz]) put(bars, bi++, back, hh * 0.4, z, 0.035, hh * 0.8, 0.035);
    const line = (a, b) => netPts.push(...a, ...b);
    for (let i = 0; i <= 12; i++) { const z = -gz + (gz * 2 * i) / 12; line([x, hh, z], [back, hh * 0.8, z]); line([back, hh * 0.8, z], [back, 0, z]); }
    for (let i = 0; i <= 5; i++) { const y = (hh * 0.8 * i) / 5; line([back, y, -gz], [back, y, gz]); for (const z of [-gz, gz]) line([x, (hh * i) / 5, z], [back, y, z]); }
    for (let i = 1; i < 4; i++) { const u = i / 4, px = x + (back - x) * u, y = hh - hh * 0.2 * u; line([px, y, -gz], [px, y, gz]); for (const z of [-gz, gz]) line([px, 0, z], [px, y, z]); }
  }
  const netGeo = new THREE.BufferGeometry(); netGeo.setAttribute('position', new THREE.Float32BufferAttribute(netPts, 3));
  scene.add(new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.45 })));
  // Ränge: gegenüber und hinter beiden Toren, die Kameraseite bleibt offen
  const unit = new THREE.BoxGeometry(1, 1, 1), rows = [], seats = [], rnd = seeded(31);
  const TIERS = 6;
  for (let t = 0; t < TIERS; t++) {
    const h = 1.2 + t * 1.25, off = t * 1.9;
    rows.push({ x: 0, z: -(PITCH.halfW + 8 + off), sx: PITCH.halfL * 2 + 22 + off * 2, sz: 1.9, h });
    for (const s of [-1, 1]) rows.push({ x: s * (PITCH.halfL + 8 + off), z: 0, sx: 1.9, sz: PITCH.halfW * 2 + 10, h });
  }
  const stands = instanced(unit, new THREE.MeshLambertMaterial(), rows.length);
  rows.forEach((r, i) => { put(stands, i, r.x, r.h / 2, r.z, r.sx, r.h, r.sz); stands.setColorAt(i, color.setHex((i / 3) % 2 < 1 ? 0x232a55 : 0x2b3367)); });
  const FANS = [0xff5a36, 0x2f7dff, 0xf2f5ff, 0xffd21f, 0x8890c0, 0x3d4580, 0xc0425a];
  for (const r of rows) { const long = r.sx > r.sz, len = long ? r.sx : r.sz; for (let d = -len / 2 + 0.6; d < len / 2 - 0.4; d += 1.25) { if (rnd() < 0.2) continue; seats.push({ x: r.x + (long ? d : 0), y: r.h + 0.4, z: r.z + (long ? 0 : d), p: rnd() * 6.28, c: FANS[Math.floor(rnd() * FANS.length)] }); } }
  const crowd = instanced(new THREE.BoxGeometry(0.55, 0.85, 0.55), new THREE.MeshLambertMaterial({ emissive: 0x15152a }), seats.length);
  const seatCrowd = (jump, time) => { seats.forEach((q, i) => put(crowd, i, q.x, q.y + (jump ? Math.max(0, Math.sin(time * 9 + q.p)) * 0.7 * jump : 0), q.z)); crowd.instanceMatrix.needsUpdate = true; };
  seats.forEach((q, i) => crowd.setColorAt(i, color.setHex(q.c))); seatCrowd(0, 0);
  // Banden mit erfundenen Namen
  const adTex = canvasTexture(1024, 64, (g, w, h) => {
    const items = [['LICHTWERK', '#ff5a36'], ['ELEVEN NIGHTS', '#ffd34d'], ['NORDHAFEN', '#2f7dff'], ['FLUTLICHT', '#2ee59d']];
    g.font = 'italic 900 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    items.forEach(([t, c], i) => { g.fillStyle = '#0c1030'; g.fillRect(i * 256, 0, 256, h); g.fillStyle = c; g.fillRect(i * 256, h - 7, 256, 7); g.fillStyle = '#fff'; g.fillText(t, i * 256 + 128, h / 2 - 2, 236); });
  });
  const boards = instanced(new THREE.PlaneGeometry(26, 1.15), new THREE.MeshBasicMaterial({ map: adTex }), 10);
  let ad = 0;
  for (let i = -2; i <= 1; i++) put(boards, ad++, i * 26.5 + 13.25, 0.62, -(PITCH.halfW + 5.4));
  for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) put(boards, ad++, s * (PITCH.halfL + 5.4), 0.62, i * 26.5, 1, 1, 1, 0, -s * Math.PI / 2);
  const poles = instanced(new THREE.CylinderGeometry(0.25, 0.4, 24, 6), new THREE.MeshLambertMaterial({ color: 0x8a93c4 }), 4);
  const lamps = instanced(new THREE.BoxGeometry(5, 2.4, 0.5), new THREE.MeshBasicMaterial({ color: 0xfffbe8, fog: false }), 4);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b], i) => { const x = a * (PITCH.halfL + 22), z = b * (PITCH.halfW + 20); put(poles, i, x, 12, z); put(lamps, i, x, 24.5, z, 1, 1, 1, 0, Math.atan2(-x, -z)); });

  /* ---------- Figuren ---------- */
  const mat = new THREE.MeshLambertMaterial({ emissive: 0x161616 });
  const limb = (r0, r1, len) => { const g = new THREE.CylinderGeometry(r0, r1, len, 6); g.translate(0, -len / 2, 0); return g; };
  const PARTS = {
    torso: [new THREE.CylinderGeometry(0.27, 0.2, 0.6, 8).scale(1, 1, 0.65), 1], shorts: [new THREE.CylinderGeometry(0.21, 0.23, 0.27, 8).scale(1, 1, 0.72), 1],
    head: [new THREE.SphereGeometry(0.17, 10, 8), 1], hair: [new THREE.SphereGeometry(0.178, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.46), 1],
    uarm: [limb(0.085, 0.065, 0.32), 2], farm: [limb(0.062, 0.048, 0.3), 2], thigh: [limb(0.11, 0.08, 0.45), 2], shin: [limb(0.078, 0.052, 0.44), 2], boot: [new THREE.BoxGeometry(0.13, 0.1, 0.29), 2]
  };
  const meshes = {};
  for (const [name, [geo, n]] of Object.entries(PARTS)) meshes[name] = instanced(geo, mat, N * n);
  // Gelenke: ein Gerüst, das für jede Figur neu gestellt wird
  const J = {}; const node = (name, parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); if (parent) parent.add(o); J[name] = o; return o; };
  const root = node('root', null, 0, 0, 0); root.scale.setScalar(SCALE);
  const hips = node('hips', root, 0, 0.98, 0); node('shorts', hips, 0, 0, 0); const chest = node('chest', hips, 0, 0.08, 0);
  node('torso', chest, 0, 0.32, 0); const neck = node('neck', chest, 0, 0.8, 0); node('head', neck, 0, 0, 0); node('hair', neck, 0, 0.02, -0.012);
  for (const [i, side] of [[0, -1], [1, 1]]) {
    const sh = node('sh' + i, chest, side * 0.3, 0.55, 0), el = node('el' + i, sh, 0, -0.32, 0); node('uarm' + i, sh, 0, 0, 0); node('farm' + i, el, 0, 0, 0);
    const hp = node('hp' + i, hips, side * 0.13, -0.04, 0), kn = node('kn' + i, hp, 0, -0.45, 0); node('thigh' + i, hp, 0, 0, 0); node('shin' + i, kn, 0, 0, 0); node('boot' + i, kn, 0, -0.45, 0.07);
  }
  const phase = Array.from({ length: N }, (_, i) => (i * 1.7) % 6.28);
  function paint() {
    const set = (n, i, c) => meshes[n].setColorAt(i, color.setHex(c));
    for (let i = 0; i < N; i++) {
      const team = TEAMS[i < 11 ? 0 : 1], gk = i % 11 === 0, shirt = gk ? team.gk : team.kit, shorts = gk ? 0x1a1a28 : team.shorts, skin = SKIN[(i * 7 + 3) % SKIN.length], hair = HAIR[(i * 5 + 1) % HAIR.length];
      set('torso', i, shirt); set('shorts', i, shorts); set('head', i, skin); set('hair', i, hair);
      for (let k = 0; k < 2; k++) { const j = i * 2 + k; set('uarm', j, shirt); set('farm', j, gk ? 0xf4f4f4 : skin); set('thigh', j, skin); set('shin', j, gk ? shorts : shirt); set('boot', j, 0x15151c); }
    }
  }
  paint();
  function pose(i, p, s, dt, time) {
    const v = Math.hypot(p.vx, p.vz), a = Math.min(1, v / 6.5), holder = s.ball.own === i;
    phase[i] = (phase[i] + v * dt * 2.35 / (1 + v * 0.09)) % (Math.PI * 2);
    const sw = Math.sin(phase[i]), cw = Math.cos(phase[i]);
    const ry = Math.PI / 2 - p.f;
    root.position.set(p.x, 0, p.z); root.rotation.set(0, ry, 0);
    hips.position.y = 0.98 - a * 0.04 + Math.abs(cw) * a * 0.06 + (v < 0.3 ? Math.sin(time * 2.2 + i) * 0.008 : 0);
    hips.rotation.set(0, 0, 0); chest.rotation.set(a * 0.22, sw * a * 0.14, 0); neck.rotation.set(-a * 0.1, 0, 0);
    for (let k = 0; k < 2; k++) {
      const m = k ? -1 : 1, sh = J['sh' + k], el = J['el' + k], hp = J['hp' + k], kn = J['kn' + k];
      hp.rotation.set(-sw * m * a * 1.0 - a * 0.08, 0, 0); kn.rotation.set(Math.max(0, cw * m) * a * 1.5 + 0.06, 0, 0);
      sh.rotation.set(sw * m * a * 0.9, 0, (k ? 1 : -1) * 0.13); el.rotation.set(-0.25 - a * 1.0, 0, 0);
    }
    const t = p.at;
    if (p.act === ACT.kick) {
      const u = t < 0.1 ? t / 0.1 : 1, back = t < 0.1 ? 0.9 * u : t < 0.22 ? 0.9 - 2.4 * ((t - 0.1) / 0.12) : -1.5 + (t - 0.22) * 8;
      J.hp1.rotation.x = Math.min(0, back) + Math.max(0, back); J.kn1.rotation.x = t < 0.12 ? 1.3 : 0.15; J.hp0.rotation.x = -0.1; J.kn0.rotation.x = 0.25; chest.rotation.x = 0.12; J.sh0.rotation.z = -1.0; J.sh1.rotation.z = 0.5;
    } else if (p.act === ACT.slide || p.act === ACT.down) {
      const u = p.act === ACT.slide ? Math.min(1, t / 0.12) : 1 - clamp((t - 0.35) / 0.25, 0, 1);
      hips.position.y = 0.98 - u * 0.7; hips.rotation.x = -1.15 * u; hips.rotation.z = 0.25 * u;
      J.hp0.rotation.x = -0.45 * u; J.hp1.rotation.x = -0.1 * u; J.kn0.rotation.x = 0.1; J.kn1.rotation.x = 1.2 * u;
      J.sh0.rotation.set(0.9 * u, 0, -1.0 * u); J.sh1.rotation.set(0.5 * u, 0, 0.8 * u);
    } else if (p.act === ACT.dive) {
      const lx = Math.cos(ry) * 0 - Math.sin(ry) * (Math.sign(p.vz) || 1), u = Math.min(1, t / 0.2) * (1 - clamp((t - 0.55) / 0.2, 0, 1)), side = lx >= 0 ? 1 : -1;
      hips.rotation.z = -side * 1.35 * u; hips.position.y = 0.98 - u * 0.35 + Math.sin(Math.min(1, t / 0.45) * Math.PI) * 0.35;
      for (let k = 0; k < 2; k++) { J['sh' + k].rotation.set(0, 0, (k ? 1 : -1) * 2.8 * u); J['el' + k].rotation.x = 0; J['hp' + k].rotation.x = 0.15; J['kn' + k].rotation.x = 0.35; }
    } else if (p.act === ACT.header) {
      const u = Math.sin(clamp(t / 0.45, 0, 1) * Math.PI); hips.position.y += u * 0.5; chest.rotation.x = -0.3 + t * 1.6; J.kn0.rotation.x = J.kn1.rotation.x = 0.7 * u; J.sh0.rotation.z = -0.9 * u; J.sh1.rotation.z = 0.9 * u;
    } else if (p.act === ACT.stumble) { chest.rotation.x = 0.6; J.sh0.rotation.set(-0.8, 0, -0.7); J.sh1.rotation.set(-0.5, 0, 0.7); }
    else if (p.act === ACT.cheer) { hips.position.y += Math.max(0, Math.sin(t * 9)) * 0.22; for (let k = 0; k < 2; k++) { J['sh' + k].rotation.set(0, 0, (k ? 1 : -1) * 2.55); J['el' + k].rotation.x = -0.2; } chest.rotation.x = -0.12; }
    else if (p.act === ACT.throw) { const u = clamp(t / 0.12, 0, 1); for (let k = 0; k < 2; k++) { J['sh' + k].rotation.set(-3.0 + u * 1.7, 0, 0); J['el' + k].rotation.x = -0.8 * (1 - u); } chest.rotation.x = -0.15 + u * 0.35; }
    else if (holder && s.ball.hands) { for (let k = 0; k < 2; k++) { J['sh' + k].rotation.set(s.ph === 'set' ? -2.9 : -0.9, 0, 0); J['el' + k].rotation.x = s.ph === 'set' ? -0.5 : -0.8; } }
    else if (i % 11 === 0 && v < 2 && !holder) { hips.position.y -= 0.08; for (let k = 0; k < 2; k++) { J['sh' + k].rotation.set(-0.5, 0, (k ? 1 : -1) * 0.5); J['hp' + k].rotation.x -= 0.25; J['kn' + k].rotation.x += 0.4; } }
    root.updateMatrixWorld(true);
    for (const n of ['torso', 'shorts', 'head', 'hair']) meshes[n].setMatrixAt(i, J[n].matrixWorld);
    for (const n of ['uarm', 'farm', 'thigh', 'shin', 'boot']) for (let k = 0; k < 2; k++) meshes[n].setMatrixAt(i * 2 + k, J[n + k].matrixWorld);
  }

  /* ---------- Ball, Schatten, Markierungen ---------- */
  const ballTex = canvasTexture(256, 128, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#151a30'; for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) { g.beginPath(); g.arc(x * 43 + (y % 2) * 21 + 10, y * 34 + 14, 9, 0, 7); g.fill(); } });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshLambertMaterial({ map: ballTex, emissive: 0x777777, emissiveMap: ballTex })); scene.add(ball);
  const disc = new THREE.CircleGeometry(1, 14); disc.rotateX(-Math.PI / 2);
  const shadows = instanced(disc, new THREE.MeshBasicMaterial({ color: 0x00140a, transparent: true, opacity: 0.35, depthWrite: false }), N + 1);
  const ringGeo = new THREE.RingGeometry(0.72, 1.0, 24); ringGeo.rotateX(-Math.PI / 2);
  const rings = instanced(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, depthWrite: false }), 4); rings.renderOrder = 2;
  rings.setColorAt(0, color.setHex(0xffe24a)); rings.setColorAt(1, color.setHex(0x9fd0ff)); rings.setColorAt(2, color.setHex(0xffffff)); rings.setColorAt(3, color.setHex(0xffffff));
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.7, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0xffe24a, depthTest: false, transparent: true })); marker.renderOrder = 5; scene.add(marker);
  const arrowGeo = new THREE.PlaneGeometry(1, 0.28); arrowGeo.rotateX(-Math.PI / 2); arrowGeo.translate(0.5, 0, 0);
  const arrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0xffe24a, transparent: true, opacity: 0.8, depthWrite: false })); arrow.visible = false; scene.add(arrow);
  const PARTS_MAX = 160, parts = instanced(new THREE.PlaneGeometry(0.34, 0.5), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), PARTS_MAX), bits = [];
  for (let i = 0; i < PARTS_MAX; i++) { put(parts, i, 0, -9, 0, 0, 0, 0); parts.setColorAt(i, color.setHex([0xff5a36, 0xffd34d, 0x2ee59d, 0x38bdf8, 0xffffff][i % 5])); } parts.visible = false;

  /* ---------- Kamera ---------- */
  const cam = { w: 1, h: 1, portrait: false, yaw: 1, x: 0, z: 0, dist: 80, snap: true, zoom: 1, shake: 0 };
  let excite = 0, time = 0, frames = 0, ratio = Math.min(devicePixelRatio || 1, 1.75), slow = 0, fpsT = 0, fpsN = 0, fps = 0;
  const V = new THREE.Vector3();
  function resize() {
    const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight; cam.w = w; cam.h = h; cam.portrait = w / h < 1;
    renderer.setPixelRatio(ratio); renderer.setSize(w, h, false); camera.aspect = w / h; cam.snap = true;
  }
  function place(s, dt, me) {
    const b = s.ball, d = dirOf(s, me), aspect = cam.w / cam.h;
    cam.yaw = d;
    const near = clamp((Math.abs(b.x) - 28) / 20, 0, 1);               // am Strafraum etwas näher heran
    let tx, tz, width, elev;
    if (cam.portrait) {
      camera.fov = 36; width = clamp(20 + aspect * 17, 26, 36) * (1 - near * 0.06); elev = 0.96;
      tx = clamp(b.x + d * 7 + b.vx * 0.18, -PITCH.halfL + 15, PITCH.halfL - 15); tz = clamp(b.z * 0.75, -PITCH.halfW + width * 0.4, PITCH.halfW - width * 0.4);
    } else {
      camera.fov = 26; width = clamp(30 + aspect * 10, 40, 54) * (1 - near * 0.08) * (cam.h < 500 ? 0.9 : 1); elev = 0.56;
      tx = clamp(b.x + b.vx * 0.3, -PITCH.halfL + width * 0.36, PITCH.halfL - width * 0.36); tz = clamp(b.z * 0.82 + 1.2, -PITCH.halfW + 9, PITCH.halfW - 3);
    }
    if (s.ph === 'goal') width *= 0.8;
    const dist = width / (2 * Math.tan((camera.fov * Math.PI) / 360) * aspect);
    const k = cam.snap ? 1 : 1 - Math.exp(-dt * 3.6);
    cam.x += (tx - cam.x) * k; cam.z += (tz - cam.z) * k; cam.dist += (dist - cam.dist) * (cam.snap ? 1 : 1 - Math.exp(-dt * 2)); cam.snap = false;
    cam.shake = Math.max(0, cam.shake - dt * 2.5);
    const sx = cam.shake ? Math.sin(time * 70) * cam.shake * 0.35 : 0, sy = cam.shake ? Math.cos(time * 57) * cam.shake * 0.25 : 0;
    const up = Math.sin(elev) * cam.dist, back = Math.cos(elev) * cam.dist;
    if (cam.portrait) { camera.position.set(cam.x - d * back, up + sy, cam.z + sx); camera.lookAt(cam.x, sy, cam.z + sx); }
    else { camera.position.set(cam.x + sx, up + sy, cam.z + back); camera.lookAt(cam.x + sx, sy, cam.z); }
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  function project(x, y, z) { V.set(x, y, z).project(camera); return { x: (V.x * 0.5 + 0.5) * cam.w, y: (-V.y * 0.5 + 0.5) * cam.h, front: V.z < 1 }; }

  function event(e) {
    if (e.type === 'goal') {
      excite = 2.8; cam.shake = opts.reducedMotion ? 0 : 1;
      if (!opts.reducedMotion) { bits.length = 0; const gx = clamp(e.x, -PITCH.halfL, PITCH.halfL); for (let i = 0; i < PARTS_MAX; i++) bits.push({ x: gx + (Math.random() - 0.5) * 22, y: 7 + Math.random() * 8, z: (Math.random() - 0.5) * 24, vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 2.5, r: Math.random() * 6 }); }
    } else if (!opts.reducedMotion && (e.type === 'post' || e.type === 'save')) cam.shake = 0.45;
    else if (!opts.reducedMotion && e.type === 'shot' && e.p > 0.75) cam.shake = 0.25;
  }

  function frame(dt, s, o = {}) {
    time += dt; frames++;
    fpsT += o.real || 0; fpsN++; if (fpsT >= 1) { fps = fpsN / fpsT; fpsT = 0; fpsN = 0; if (fps < 42 && ratio > 1 && ++slow >= 3) { ratio = Math.max(1, ratio - 0.25); slow = 0; resize(); } else if (fps >= 52) slow = 0; }
    if (!s) {                                      // Menü: ruhiger Blick ins Stadion
      camera.fov = cam.portrait ? 48 : 30; const a = time * 0.05;
      camera.position.set(Math.sin(a) * 30, cam.portrait ? 44 : 30, cam.portrait ? 92 : 70); camera.lookAt(0, 0, -6); camera.updateProjectionMatrix();
      for (const m of Object.values(meshes)) m.visible = false; shadows.visible = rings.visible = marker.visible = arrow.visible = false; ball.visible = false;
      renderer.render(scene, camera); return;
    }
    const me = o.me || 0;
    place(s, dt, me);
    for (const m of Object.values(meshes)) m.visible = true; shadows.visible = rings.visible = ball.visible = true;
    for (let i = 0; i < N; i++) { const p = s.pl[i]; pose(i, p, s, dt, time); const low = p.act === ACT.slide || p.act === ACT.down || p.act === ACT.dive; put(shadows, i, p.x, 0.012, p.z, low ? 0.95 : 0.52, 1, low ? 0.7 : 0.52); }
    for (const m of Object.values(meshes)) m.instanceMatrix.needsUpdate = true;
    const b = s.ball, bv = Math.hypot(b.vx, b.vz);
    // von hinten gesehen (hochkant) wird der geführte Ball neben den Fuß gesetzt, damit der Körper ihn nicht verdeckt
    let ox = 0, oz = 0;
    if (cam.portrait && b.own >= 0 && !b.hands) { const p = s.pl[b.own], away = Math.cos(p.f) * cam.yaw; if (away > 0) { ox = -Math.sin(p.f) * 0.55 * away * cam.yaw; oz = Math.cos(p.f) * 0.55 * away * cam.yaw; } }
    const bx = b.x + ox, bz = b.z + oz;
    ball.position.set(bx, Math.max(0.2, b.y + 0.07), bz);
    if (bv > 0.1) { V.set(b.vz, 0, -b.vx).normalize(); ball.rotateOnWorldAxis(V, bv * dt / 0.2); }
    const sh = clamp(1 - b.y / 14, 0.35, 1); put(shadows, N, bx, 0.016, bz, 0.27 * sh, 1, 0.27 * sh); shadows.instanceMatrix.needsUpdate = true;
    const mine = s.pl[s.ctl[me]], other = s.pl[s.ctl[1 - me]], pulse = 1 + Math.sin(time * 6) * 0.05;
    put(rings, 0, mine.x, 0.03, mine.z, 1.05 * pulse, 1, 1.05 * pulse); put(rings, 1, other.x, 0.025, other.z, 0.72, 1, 0.72);
    // Zielkreis für hohe Bälle
    let lx = 0, lz = 0, high = false;
    if (b.own < 0 && (b.y > 2 || b.vy > 3)) { const g = 9.81, t = (b.vy + Math.sqrt(Math.max(0, b.vy * b.vy + 2 * g * (b.y - 0.11)))) / g; lx = clamp(b.x + b.vx * t * 0.96, -PITCH.halfL, PITCH.halfL); lz = clamp(b.z + b.vz * t * 0.96, -PITCH.halfW, PITCH.halfW); high = t > 0.35; }
    put(rings, 2, lx, 0.035, lz, high ? 0.7 : 0, 1, high ? 0.7 : 0); put(rings, 3, 0, -5, 0, 0, 0, 0); rings.instanceMatrix.needsUpdate = true;
    marker.visible = s.ph !== 'over'; marker.position.set(mine.x, 2.9 + Math.sin(time * 5) * 0.12, mine.z); marker.rotation.y = time * 2;
    const ch = s.chg[me], aim = o.aim;
    arrow.visible = !!(ch && ch.k && b.own === s.ctl[me]);
    if (arrow.visible) { const ax = aim && Math.hypot(aim.x, aim.z) > 0.25 ? Math.atan2(aim.z, aim.x) : mine.f, len = 2.5 + Math.min(1, ch.t / 0.8) * 5; arrow.position.set(mine.x + Math.cos(ax) * 1.1, 0.05, mine.z + Math.sin(ax) * 1.1); arrow.rotation.y = -ax; arrow.scale.set(len, 1, 1); arrow.material.color.setHex(ch.k === 'shoot' ? 0xff5a6e : ch.k === 'through' ? 0x38bdf8 : 0xffe24a); }
    if (excite > 0) { excite -= dt; seatCrowd(opts.reducedMotion ? 0 : Math.max(0, Math.min(1, excite)), time); }
    parts.visible = bits.length > 0 && excite > 0;
    if (parts.visible) { bits.forEach((q, i) => { q.x += q.vx * dt; q.y = Math.max(0.05, q.y + q.vy * dt); q.z += Math.sin(time * 3 + q.r) * dt; put(parts, i, q.x, q.y, q.z, 1, 1, 1, time * 4 + q.r, q.r, time * 2); }); parts.instanceMatrix.needsUpdate = true; }
    renderer.render(scene, camera);
  }

  return {
    resize, frame, event, project,
    reset() { cam.snap = true; excite = 0; bits.length = 0; parts.visible = false; seatCrowd(0, 0); },
    // Stickrichtung (Bildschirm) in Spielfeldrichtung: quer gilt rechts = +x, hochkant gilt oben = Angriffsrichtung
    mapStick: (x, y) => (cam.portrait ? { x: -y * cam.yaw, z: x * cam.yaw } : { x, z: y }),
    portrait: () => cam.portrait, yaw: () => cam.yaw, size: () => [cam.w, cam.h],
    name: (i) => NAMES[i < 11 ? 0 : 1][i % 11],
    info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, frames, fps: Math.round(fps * 10) / 10, ratio, portrait: cam.portrait, camera: [Math.round(camera.position.x), Math.round(camera.position.y), Math.round(camera.position.z)], gpu: (() => { const gl = renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : ''; })() })
  };
}
