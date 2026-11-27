// Darstellung mit three.js: Neontisch, Stangen, Figuren, Ball, Effekte, Kamera. Liest nur ab, ändert nie die Logik.
import * as THREE from '../vendor/three.module.js';
import { TABLE, BALL, FIG, RODS, COLORS } from './config.js';

const HL = TABLE.L / 2, HW = TABLE.W / 2, GH = TABLE.goalHalf, ROD_Y = 1.1, TILT = 0.24;
const TEAM = COLORS.map((c) => new THREE.Color(c));
const ROD_LEN = TABLE.W + 1.5;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// Mehrere Formen zu einer verschmelzen (wenige Zeichenaufrufe)
function merge(parts) {
  const pos = [], nor = [], col = [];
  for (const [geo, color, x, y, z] of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.translate(x, y, z);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(color.r, color.g, color.b); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
// Quader mit gerundetem Grundriss (Fuß der Figur, deckt sich mit der Trefferfläche)
function slab(hx, hy, r, h) {
  const s = new THREE.Shape();
  s.moveTo(-hx, -hy - r); s.lineTo(hx, -hy - r); s.absarc(hx, -hy, r, -Math.PI / 2, 0); s.lineTo(hx + r, hy); s.absarc(hx, hy, r, 0, Math.PI / 2);
  s.lineTo(-hx, hy + r); s.absarc(-hx, hy, r, Math.PI / 2, Math.PI); s.lineTo(-hx - r, -hy); s.absarc(-hx, -hy, r, Math.PI, Math.PI * 1.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 4 }); g.rotateX(Math.PI / 2); g.translate(0, h / 2, 0); return g;
}
function figureParts(team, offsets) {
  const body = [], line = [], white = new THREE.Color(0xf4f8ff), main = TEAM[team], dark = main.clone().multiplyScalar(0.42), light = main.clone().lerp(white, 0.55), ink = new THREE.Color(0x02030a);
  for (const z of offsets) {
    const add = (geo, color, x, y, dz, grow = 0.045) => {
      body.push([geo, color, x, y, z + dz]);
      geo.computeBoundingBox(); const s = new THREE.Vector3(); geo.boundingBox.getSize(s);
      const o = geo.clone(); o.scale((s.x + grow * 2) / s.x, (s.y + grow * 2) / s.y, (s.z + grow * 2) / s.z); line.push([o, ink, x, y, z + dz]);
    };
    add(new THREE.SphereGeometry(0.15, 14, 10), light, 0.015, 0.45, 0);              // Kopf
    add(box(0.16, 0.08, 0.2), dark, 0, 0.52, 0, 0);                                   // Haar
    add(box(0.26, 0.5, 0.4), main, 0, 0.08, 0);                                       // Rumpf
    add(box(0.17, 0.17, 0.56), main, 0, 0.23, 0);                                     // Schultern
    add(box(0.05, 0.3, 0.12), white, 0.135, 0.07, 0, 0);                              // Streifen vorn (Blickrichtung)
    add(box(0.2, 0.46, 0.13), dark, 0, -0.38, -0.1); add(box(0.2, 0.46, 0.13), dark, 0, -0.38, 0.1);
    add(slab(FIG.hx, FIG.hy, FIG.round, 0.27), light, 0, -FIG.leg, 0, 0.04);          // Fuß
  }
  return { body: merge(body), line: merge(line) };
}

export function createView(container, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = canvasTexture(256, 256, (g, w, h) => { const q = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.72); q.addColorStop(0, '#1b1650'); q.addColorStop(0.6, '#0c0b30'); q.addColorStop(1, '#05051a'); g.fillStyle = q; g.fillRect(0, 0, w, h); });
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 200);
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x241640, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(3.5, 14, 2.5); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 7, bottom: -7, near: 4, far: 28 }); sun.shadow.bias = -0.002; scene.add(sun);
  const glowLight = new THREE.PointLight(0xffffff, 0, 14, 1.6); glowLight.position.set(0, 2.5, 0); scene.add(glowLight);

  /* ---------- Spielfläche ---------- */
  const floorTex = canvasTexture(1400, 840, (g, w, h) => {
    const S = w / TABLE.L, X = (x) => w / 2 + x * S, Y = (y) => h / 2 + y * S;
    g.fillStyle = '#0b1838'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i += 2) { g.fillStyle = 'rgba(70,120,255,0.07)'; g.fillRect(i * S, 0, S, h); }
    for (const [s, c] of [[-1, COLORS[0]], [1, COLORS[1]]]) { const q = g.createRadialGradient(X(s * HL), Y(0), 10, X(s * HL), Y(0), 4.2 * S); q.addColorStop(0, c + '55'); q.addColorStop(1, c + '00'); g.fillStyle = q; g.fillRect(0, 0, w, h); }
    const neon = (c, width, draw) => { g.strokeStyle = c; g.shadowColor = c; g.shadowBlur = 18; g.lineWidth = width; g.beginPath(); draw(); g.stroke(); g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = width * 0.3; g.stroke(); };
    neon('#7c6cff', 6, () => { g.moveTo(X(0), 0); g.lineTo(X(0), h); });
    neon('#7c6cff', 6, () => g.arc(X(0), Y(0), 1.35 * S, 0, Math.PI * 2));
    neon(COLORS[0], 6, () => { g.rect(X(-HL) - 8, Y(-2.3), 2 * S + 8, 4.6 * S); });
    neon(COLORS[1], 6, () => { g.rect(X(HL) - 2 * S, Y(-2.3), 2 * S + 8, 4.6 * S); });
    // Schrägen in den Ecken
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { g.fillStyle = 'rgba(160,150,255,0.17)'; g.beginPath(); g.moveTo(X(sx * HL), Y(sy * HW)); g.lineTo(X(sx * 5.5), Y(sy * HW)); g.lineTo(X(sx * HL), Y(sy * 2.35)); g.fill(); }
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(TABLE.L, TABLE.W), new THREE.MeshStandardMaterial({ map: floorTex, emissive: 0xffffff, emissiveMap: floorTex, emissiveIntensity: 0.38, roughness: 0.75 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  /* ---------- Rahmen, Tore ---------- */
  const wallColor = new THREE.Color(0x242a68), wallParts = [], T = 0.34, WH = 0.55;
  for (const s of [-1, 1]) {
    wallParts.push([box(TABLE.L + T * 2, WH, T), wallColor, 0, WH / 2, s * (HW + T / 2)]);
    for (const t of [-1, 1]) wallParts.push([box(T, WH, HW - GH), wallColor, s * (HL + T / 2), WH / 2, t * (GH + (HW - GH) / 2)]);
    wallParts.push([box(0.2, WH * 0.7, GH * 2 + 0.2), new THREE.Color(0x0b0d26), s * (HL + 0.85), WH * 0.35, 0]);
    for (const t of [-1, 1]) wallParts.push([box(0.85, WH * 0.7, 0.12), new THREE.Color(0x151846), s * (HL + 0.42), WH * 0.35, t * (GH + 0.06)]);
    wallParts.push([box(0.85, 0.04, GH * 2), new THREE.Color(0x04040e), s * (HL + 0.42), 0.0, 0]);
  }
  const walls = new THREE.Mesh(merge(wallParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35 })); walls.receiveShadow = true; scene.add(walls);
  const strip = (w, d, x, y, z, color) => { const m = new THREE.Mesh(box(w, 0.05, d), new THREE.MeshBasicMaterial({ color })); m.position.set(x, y, z); scene.add(m); return m; };
  for (const s of [-1, 1]) { strip(HL, 0.09, -HL / 2, WH + 0.02, s * (HW + 0.05), COLORS[0]); strip(HL, 0.09, HL / 2, WH + 0.02, s * (HW + 0.05), COLORS[1]); }
  const goalGlow = [0, 1].map((k) => {
    const s = k === 0 ? -1 : 1, parts = [];
    for (const t of [-1, 1]) { parts.push(strip(0.09, HW - GH, s * (HL + 0.05), WH + 0.02, t * (GH + (HW - GH) / 2), COLORS[k])); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.75, 14), new THREE.MeshBasicMaterial({ color: 0xffffff })); post.position.set(s * (HL + 0.06), 0.38, t * (GH + 0.07)); scene.add(post); }
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.8, GH * 2), new THREE.MeshBasicMaterial({ map: canvasTexture(64, 192, (g, w, h) => { g.strokeStyle = COLORS[k]; g.lineWidth = 2; for (let i = -h; i < w + h; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke(); } }), transparent: true, opacity: 0.55, depthWrite: false }));
    mouth.rotation.x = -Math.PI / 2; mouth.position.set(s * (HL + 0.42), 0.05, 0); scene.add(mouth);
    parts.push(strip(0.1, GH * 2 + 0.2, s * (HL + 0.9), WH * 0.7 + 0.03, 0, COLORS[k]));
    return { mouth, parts, flash: 0 };
  });

  /* ---------- Stangen ---------- */
  const steel = new THREE.MeshStandardMaterial({ color: 0xdfe8ff, metalness: 0.85, roughness: 0.22, emissive: 0x26304f });
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x02030a, side: THREE.BackSide });
  const figMat = TEAM.map((c) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.05, emissive: c, emissiveIntensity: 0.22 }));
  const rods = RODS.map((r, i) => {
    const g = new THREE.Group(); g.position.set(r.x, ROD_Y, 0); scene.add(g);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, ROD_LEN, 12), steel); bar.rotation.x = Math.PI / 2; bar.castShadow = true; g.add(bar);
    // Figuren und Stellringe gleiten, alles dreht sich um die Stange
    const slide = new THREE.Group(); g.add(slide);
    const parts = figureParts(r.side, r.fig), body = new THREE.Mesh(parts.body, figMat[r.side]), line = new THREE.Mesh(parts.line, outlineMat);
    body.castShadow = true; slide.add(body, line);
    const hs = r.side === 0 ? 1 : -1, grip = new THREE.Group(); g.add(grip);
    const gripMat = new THREE.MeshStandardMaterial({ color: COLORS[r.side], emissive: COLORS[r.side], emissiveIntensity: 0.18, roughness: 0.5 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.62, 14), gripMat); handle.rotation.x = Math.PI / 2; handle.position.z = hs * (ROD_LEN / 2 + 0.05);
    const mark = new THREE.Mesh(box(0.09, 0.42, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff })); mark.position.set(0, -0.02, hs * (ROD_LEN / 2 + 0.05));
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 12), steel); knob.rotation.x = Math.PI / 2; knob.position.z = -hs * (ROD_LEN / 2);
    grip.add(handle, mark, knob);
    return { g, slide, grip, gripMat };
  });
  // Markierung der gewählten Stange: Leuchtstreifen und Ringe unter den eigenen Figuren
  const softTex = canvasTexture(64, 8, (g, w, h) => { const q = g.createLinearGradient(0, 0, w, 0); q.addColorStop(0, 'rgba(255,255,255,0)'); q.addColorStop(0.5, 'rgba(255,255,255,1)'); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.fillRect(0, 0, w, h); });
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, TABLE.W), new THREE.MeshBasicMaterial({ map: softTex, color: 0xffd34d, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
  lane.rotation.x = -Math.PI / 2; lane.position.y = 0.012; scene.add(lane);
  const rings = new THREE.InstancedMesh(new THREE.RingGeometry(0.42, 0.52, 28), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.95, depthWrite: false }), 5);
  rings.frustumCulled = false; scene.add(rings);
  const arrows = [-1, 1].map((s) => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 3), new THREE.MeshBasicMaterial({ color: 0xffd34d })); scene.add(m); return m; });

  /* ---------- Ball, Spur, Funken ---------- */
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL.r, 24, 18), new THREE.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xffd34d, emissiveIntensity: 0.85, roughness: 0.35, map: canvasTexture(128, 64, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#ffb347'; for (const [x, y] of [[16, 18], [52, 44], [88, 16], [112, 48]]) { g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); } }) }));
  ball.castShadow = true; scene.add(ball);
  const glowTex = canvasTexture(64, 64, (g) => { const q = g.createRadialGradient(32, 32, 2, 32, 32, 31); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.35, 'rgba(255,255,255,0.45)'); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.fillRect(0, 0, 64, 64); });
  const additive = (extra) => new THREE.MeshBasicMaterial(Object.assign({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }, extra));
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), additive({ color: 0xffd34d, opacity: 0.8 })); halo.rotation.x = -Math.PI / 2; scene.add(halo);
  const finder = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 32), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.9, depthTest: false })); finder.rotation.x = -Math.PI / 2; finder.renderOrder = 6; finder.visible = false; scene.add(finder);
  const TRAIL = 22, trail = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.75, 0.75), additive({ color: 0xffa53d, opacity: 0.6 }), TRAIL); trail.frustumCulled = false; scene.add(trail);
  const history = [];
  const N = 360, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(N * 3).fill(-99), pCol = new Float32Array(N * 3), pVel = new Float32Array(N * 3), pLife = new Float32Array(N);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 7, sizeAttenuation: false, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); points.frustumCulled = false; scene.add(points);
  let next = 0;
  function burst(x, z, colors, count, speed, life) {
    const c = new THREE.Color();
    for (let n = 0; n < (reducedMotion ? Math.ceil(count / 3) : count); n++) {
      const i = next = (next + 1) % N, a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
      pPos.set([x, 0.35, z], i * 3); pVel.set([Math.cos(a) * v, Math.random() * speed * 0.7, Math.sin(a) * v], i * 3); pLife[i] = life * (0.5 + Math.random() * 0.5);
      c.set(colors[n % colors.length]); pCol.set([c.r, c.g, c.b], i * 3);
    }
    pGeo.attributes.color.needsUpdate = true;
  }

  /* ---------- Kamera ---------- */
  const V = { side: 0, portrait: false, w: 1, h: 1, insets: { top: 0, right: 0, bottom: 0, left: 0 }, shake: 0, time: 0 };
  const fit = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { fit.push([sx * (HL + 0.98), 0, sz * (GH + 0.2)], [sx * (HL + 0.98), 0.6, sz * (GH + 0.2)], [sx * (HL + 0.34), 0, sz * (HW + 0.36)], [sx * (HL + 0.34), 0.65, sz * (HW + 0.36)], [sx * 6.2, ROD_Y + 0.2, sz * (HW + 0.5)]); }
  // Auf großen Flächen kommen auch die Griffe ganz ins Bild, auf flachen zählt der Tisch
  const handles = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) handles.push([sx * 6.2, ROD_Y + 0.2, sz * (ROD_LEN / 2 + 0.45)]);
  const base = new THREE.Vector3(), look = new THREE.Vector3(0, 0.3, 0), tmp = new THREE.Vector3();
  function place() {
    const d = V.side === 0 ? 1 : -1;
    const up = V.portrait ? new THREE.Vector3(d, 0, 0) : new THREE.Vector3(0, 0, -d);     // Bildschirm oben
    const { top, right, bottom, left } = V.insets, rw = Math.max(80, V.w - left - right), rh = Math.max(80, V.h - top - bottom);
    camera.aspect = V.w / V.h; camera.clearViewOffset(); camera.up.copy(up);
    const dir = new THREE.Vector3(0, Math.cos(TILT), 0).addScaledVector(up, -Math.sin(TILT));
    let lo = 8, hi = 160, box2 = null;
    for (let n = 0; n < 32; n++) {
      const mid = (lo + hi) / 2; camera.position.copy(look).addScaledVector(dir, mid); camera.lookAt(look); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const p of V.h - top - bottom < 430 ? fit : fit.concat(handles)) { tmp.set(p[0], p[1], p[2]).project(camera); const x = ((tmp.x + 1) / 2) * V.w, y = ((1 - tmp.y) / 2) * V.h; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      if (x1 - x0 <= rw && y1 - y0 <= rh) { hi = mid; box2 = [x0, x1, y0, y1]; } else lo = mid;
    }
    camera.position.copy(look).addScaledVector(dir, hi); camera.lookAt(look);
    if (box2) camera.setViewOffset(V.w, V.h, (box2[0] + box2[1]) / 2 - (left + rw / 2), (box2[2] + box2[3]) / 2 - (top + rh / 2), V.w, V.h);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(); base.copy(camera.position);
  }
  function resize(insets) {
    V.w = container.clientWidth || innerWidth; V.h = container.clientHeight || innerHeight; if (insets) V.insets = insets;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); renderer.setSize(V.w, V.h, false);
    V.portrait = V.h > V.w;                                      // Hochformat: Tisch längs, eigenes Tor unten
    place();
  }
  function project(x, y, z) { const v = tmp.set(x, y, z).project(camera); return { x: ((v.x + 1) / 2) * V.w, y: ((1 - v.y) / 2) * V.h }; }

  const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), qid = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), axis = new THREE.Vector3();
  let prev = null;

  return {
    canvas: renderer.domElement, resize, project,
    portrait: () => V.portrait,
    setSide(side) { V.side = side; place(); },
    // Bildschirmrichtung (Einheitsvektor und Bildpunkte je Tischeinheit) quer zur Stange und nach vorn
    axes(rod) {
      const x = RODS[rod].x, d = RODS[rod].side === 0 ? 1 : -1;
      const unit = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l, px: l }; };
      const a = Object.assign({}, project(x, 0.5, -0.5)), b = Object.assign({}, project(x, 0.5, 0.5)), c = Object.assign({}, project(x - 0.5 * d, 0.5, 0)), e = Object.assign({}, project(x + 0.5 * d, 0.5, 0));
      return { slide: unit(a, b), forward: unit(c, e) };
    },
    // Bildschirmausdehnung der Spielfläche (für Prüfungen)
    bounds() { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = project(sx * (HL + 0.34), 0.3, sz * (HW + 0.2)); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); } return [x0, y0, x1, y1]; },
    event(e) {
      const x = e.x || 0, z = e.y || 0;
      if (e.type === 'kick') { burst(x, z, [COLORS[e.side], '#ffffff'], Math.round(8 + e.p * 22), 3 + e.p * 5, 0.45); V.shake = Math.max(V.shake, e.p > 0.6 ? 0.06 + e.p * 0.08 : 0); }
      else if (e.type === 'hit') burst(x, z, ['#ffffff', COLORS[e.side]], Math.round(3 + e.p * 10), 2 + e.p * 4, 0.3);
      else if (e.type === 'wall') burst(x, z, ['#b9a8ff'], Math.round(3 + e.p * 10), 2 + e.p * 3, 0.3);
      else if (e.type === 'post') { burst(x, z, ['#ffffff', '#ffd34d'], 20, 5, 0.5); V.shake = 0.14; }
      else if (e.type === 'trap') burst(x, z, ['#ffd34d', COLORS[e.side]], 12, 2, 0.4);
      else if (e.type === 'goal') {
        const gx = e.side === 0 ? HL : -HL;
        burst(gx, z, [COLORS[e.side], '#ffd34d', '#ffffff'], 220, 8, 1.6); V.shake = 0.32; goalGlow[1 - e.side].flash = 1.6;
        glowLight.color.set(COLORS[e.side]); glowLight.position.set(gx * 0.8, 2.5, 0); glowLight.intensity = 60;
      }
    },
    reset() { history.length = 0; prev = null; pLife.fill(0); pPos.fill(-99); pGeo.attributes.position.needsUpdate = true; for (const g of goalGlow) g.flash = 0; glowLight.intensity = 0; },
    // s = Zustand (oder null fürs Menü), ui = { rod: gewählte Stange (0..7) oder -1 }
    frame(dt, s, ui) {
      V.time += dt;
      for (let i = 0; i < RODS.length; i++) {
        const o = s ? s.rods[i] : { y: 0, a: Math.sin(V.time * 1.3 + i) * 0.25 }, r = rods[i], d = RODS[i].side === 0 ? 1 : -1;
        // erst verschieben, dann um die Stange drehen
        r.slide.position.z = o.y; r.slide.rotation.z = o.a * d; r.grip.rotation.z = o.a * d;
        r.gripMat.emissiveIntensity = ui.rod === i ? 0.9 : 0.18;
      }
      const sel = s && ui.rod >= 0 ? ui.rod : -1;
      lane.visible = rings.visible = sel >= 0; arrows.forEach((a) => (a.visible = sel >= 0));
      if (sel >= 0) {
        const r = RODS[sel], o = s.rods[sel], pulse = 1 + Math.sin(V.time * 6) * 0.05;
        lane.position.x = r.x; lane.material.opacity = 0.34 + Math.sin(V.time * 6) * 0.07;
        r.fig.forEach((f, k) => { m4.compose(v3.set(r.x, 0.03, o.y + f), q0, s3.set(pulse, pulse, 1)); rings.setMatrixAt(k, m4); });
        rings.count = r.fig.length; rings.instanceMatrix.needsUpdate = true;
        arrows.forEach((a, k) => { const e = k ? 1 : -1; a.position.set(r.x, 0.75, e * (HW + 0.17)); a.rotation.set(e * Math.PI / 2, 0, 0); });
      }
      // Ball
      const b = s ? s.ball : { x: 0, y: 0, vx: 0, vy: 0 };
      const inGoal = s && Math.abs(b.x) > HL;
      ball.visible = halo.visible = !!s;
      const hop = s && s.phase === 'in' ? Math.abs(Math.sin(V.time * 7)) * 0.35 : 0;
      ball.position.set(b.x, (inGoal ? BALL.r * 0.7 : BALL.r) + hop, b.y);
      if (prev) { const mx = b.x - prev.x, mz = b.y - prev.y, md = Math.hypot(mx, mz); if (md > 0.0005 && md < 2) ball.rotateOnWorldAxis(axis.set(mz, 0, -mx).normalize(), md / BALL.r); if (md > 2) history.length = 0; }
      prev = { x: b.x, y: b.y };
      halo.position.set(b.x, 0.02, b.y);
      finder.visible = !!s && (s.phase === 'in' || !!s.hold); finder.position.set(b.x, 0.04, b.y); finder.scale.setScalar(s && s.phase === 'in' ? 1.2 + (V.time * 2 % 1) * 0.9 : 1.15); finder.material.opacity = s && s.phase === 'in' ? 1 - (V.time * 2 % 1) * 0.8 : 0.75;
      if (s) { history.unshift([b.x, b.y]); if (history.length > TRAIL) history.pop(); }
      const speed = s ? Math.hypot(b.vx || 0, b.vy || 0) : 0;
      for (let i = 0; i < TRAIL; i++) {
        const p = history[i + 1], fade = p && speed > 2.5 ? (1 - i / TRAIL) * clamp((speed - 2.5) / 8, 0, 1) : 0;
        m4.compose(v3.set(p ? p[0] : 0, 0.2, p ? p[1] : 0), q0, s3.set(fade, fade, fade || 0.0001)); trail.setMatrixAt(i, m4);
      }
      trail.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < N; i++) if (pLife[i] > 0) {
        pLife[i] -= dt; pVel[i * 3 + 1] -= 9 * dt;
        // Funken bleiben über dem Tisch
        pPos[i * 3] = clamp(pPos[i * 3] + pVel[i * 3] * dt, -HL - 0.8, HL + 0.8); pPos[i * 3 + 1] = Math.max(0.05, pPos[i * 3 + 1] + pVel[i * 3 + 1] * dt); pPos[i * 3 + 2] = clamp(pPos[i * 3 + 2] + pVel[i * 3 + 2] * dt, -HW, HW);
        if (pLife[i] <= 0) pPos.fill(-999, i * 3, i * 3 + 3);                       // ganz aus dem Bild
      }
      pGeo.attributes.position.needsUpdate = true;
      goalGlow.forEach((g) => { g.flash = Math.max(0, g.flash - dt); const f = g.flash > 0 ? 0.5 + 0.5 * Math.sin(g.flash * 22) : 0; g.mouth.material.opacity = 0.55 + f * 0.45; for (const m of g.parts) m.scale.y = 1 + f * 3; });
      glowLight.intensity = Math.max(0, glowLight.intensity - dt * 45);
      // Wackeln bei harten Treffern
      V.shake = Math.max(0, V.shake - dt * 0.9);
      const k = reducedMotion ? 0 : V.shake * V.shake * 3;
      camera.position.set(base.x + Math.sin(V.time * 71) * k, base.y, base.z + Math.cos(V.time * 87) * k);
      renderer.render(scene, camera);
      camera.position.copy(base); camera.updateMatrixWorld();
    },
    info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, side: V.side, portrait: V.portrait, w: V.w, h: V.h, insets: V.insets })
  };
}
