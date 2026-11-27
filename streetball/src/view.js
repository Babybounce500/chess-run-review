// Darstellung mit three.js: Szene, Ball, Effekte und eigene Kameraführung. Liest nur aus der Spiellogik.
import * as THREE from '../vendor/three.module.js';
import { COURT, HOOP, BALL, TEAM } from './config.js';
import { clamp, lerp, hyp } from './math.js';
import { createFigure, canvasTexture, SCALE } from './figure.js';
import { buildCourt } from './court.js';

const damp = (cur, to, rate, dt) => cur + (to - cur) * (1 - Math.exp(-rate * dt));

export function createView(container, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 140);

  scene.add(new THREE.HemisphereLight(0xe4ecff, 0x9a6a58, 1.75));
  const sun = new THREE.DirectionalLight(0xffe3bd, 2.0); sun.position.set(-7, 12, 11); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 10, bottom: -9, near: 1, far: 40 }); sun.shadow.bias = -0.0006;
  sun.target.position.set(0, 0, 5); scene.add(sun, sun.target);
  const rimLight = new THREE.DirectionalLight(0xff8fb0, 0.8); rimLight.position.set(8, 5, -8); scene.add(rimLight);

  const court = buildCourt(scene);
  const figures = [createFigure(TEAM[0], 1, 0xffffff), createFigure(TEAM[1], 2, 0xffe14d)];
  for (const f of figures) scene.add(f.root, f.ring);

  // Pfeil über der eigenen Figur
  const marker = new THREE.Group();
  const cone = (r, h, c, order) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4), new THREE.MeshBasicMaterial({ color: c, depthTest: false })); m.rotation.x = Math.PI; m.renderOrder = order; marker.add(m); return m; };
  cone(0.22, 0.34, 0x0b0d1c, 8); const tip = cone(0.15, 0.24, 0xffffff, 9); tip.position.y = 0.01; scene.add(marker);

  /* Ball */
  const ballTex = canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#f4761f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = i % 2 ? 'rgba(255,190,110,.35)' : 'rgba(120,45,5,.3)'; g.fillRect((i * 83) % w, (i * 47) % h, 2, 2); }
    g.strokeStyle = '#231108'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); for (const x of [0, w / 2, w]) { g.moveTo(x, 0); g.lineTo(x, h); }
    g.stroke();
    for (const x of [w / 4, (3 * w) / 4]) { g.beginPath(); g.ellipse(x, h / 2, 30, h * 0.62, 0, 0, 7); g.stroke(); }
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL.r * 1.16, 22, 16), new THREE.MeshStandardMaterial({ map: ballTex, emissive: 0xffffff, emissiveMap: ballTex, emissiveIntensity: 0.28, roughness: 0.55 }));
  ball.castShadow = true; scene.add(ball);
  const ballLine = new THREE.Mesh(ball.geometry, new THREE.MeshBasicMaterial({ color: 0x1c0c04, side: THREE.BackSide })); ballLine.scale.setScalar(1.12); ball.add(ballLine);
  const spot = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.27, 28), new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  spot.rotation.x = -Math.PI / 2; scene.add(spot);
  const TRAIL = 16, trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(TRAIL * 3), 3));
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.85 })); trail.frustumCulled = false; trail.visible = false; scene.add(trail);
  const history = [];

  /* Partikel und Schockringe */
  const N = 260, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(N * 3), pCol = new Float32Array(N * 3), pVel = new Float32Array(N * 3), pLife = new Float32Array(N), pGrav = new Float32Array(N);
  pPos.fill(-50);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.13, vertexColors: true })); points.frustumCulled = false; scene.add(points);
  let next = 0;
  const tint = new THREE.Color();
  function burst(x, y, z, colors, count, speed, grav = 7, life = 1) {
    if (opts.reducedMotion) count = Math.ceil(count / 4);
    for (let n = 0; n < count; n++) {
      const i = next; next = (next + 1) % N;
      const a = Math.random() * 6.283, u = Math.random() * 2 - 1, s = speed * (0.35 + Math.random() * 0.65), h = Math.sqrt(1 - u * u);
      pPos.set([x, y, z], i * 3); pVel.set([Math.cos(a) * h * s, Math.abs(u) * s * 0.9, Math.sin(a) * h * s], i * 3);
      tint.setHex(colors[n % colors.length]); pCol.set([tint.r, tint.g, tint.b], i * 3); pLife[i] = life * (0.6 + Math.random() * 0.6); pGrav[i] = grav;
    }
    pGeo.attributes.color.needsUpdate = true;
  }
  const waves = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 36), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); m.visible = false; m.userData.t = 9; scene.add(m); return m; });
  let waveNext = 0;
  function wave(x, y, z, color) { const m = waves[waveNext++ % waves.length]; m.position.set(x, y, z); m.material.color.setHex(color); m.userData.t = 0; m.visible = true; }

  /* ---------- Kamera ---------- */
  const view = { me: 0, time: 0, shake: 0, mood: 0, insets: { top: 90, bottom: 20, left: 10, right: 10 }, portrait: false, dist: 16, target: new THREE.Vector3(0, 1.4, 5), W: 1, H: 1, snap: true, e: 0.5 };
  const F = new THREE.Vector3(), R = new THREE.Vector3(1, 0, 0), U = new THREE.Vector3(), want = new THREE.Vector3(), rel = new THREE.Vector3();
  const pool = Array.from({ length: 24 }, () => new THREE.Vector3()); let used = 0;
  const point = (x, y, z) => { pool[used++].set(x, y, z); };
  function safeRect() {
    const { W, H, insets: i } = view;
    const x0 = -1 + (2 * i.left) / W, x1 = 1 - (2 * i.right) / W, y0 = -1 + (2 * i.bottom) / H, y1 = 1 - (2 * i.top) / H;
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hx: Math.max(0.3, (x1 - x0) / 2), hy: Math.max(0.3, (y1 - y0) / 2) };
  }
  // Abstand und Zielpunkt so wählen, dass alle wichtigen Punkte in der freien Bildfläche liegen
  function frameCamera(state, dt) {
    const r = safeRect(), tv = Math.tan((camera.fov * Math.PI) / 360), th = tv * camera.aspect;
    F.set(0, -Math.sin(view.e), -Math.cos(view.e)); U.set(0, Math.cos(view.e), -Math.sin(view.e));
    used = 0;
    point(-HOOP.boardHalfW - 0.05, HOOP.boardY1 + 0.08, HOOP.boardZ); point(HOOP.boardHalfW + 0.05, HOOP.boardY1 + 0.08, HOOP.boardZ); point(0, 0.2, HOOP.z);
    let mx = 0, mz = 5;
    if (state) {
      for (const p of state.p) { point(p.x - 0.6, 0, p.z + 0.35); point(p.x + 0.6, 0, p.z + 0.35); point(p.x, 2.55 + Math.max(0, p.y), p.z); }
      const b = state.ball; point(b.x, clamp(b.y + 0.15, 0, 5), clamp(b.z, 0.5, COURT.maxZ));
      mx = (state.p[0].x + state.p[1].x) / 2; mz = (state.p[0].z + state.p[1].z) / 2;
    } else { point(-3.2, 0, 7.5); point(3.2, 0, 7.5); point(0, 2.4, 7); }
    const spread = view.portrait ? 1.7 : 3.4;
    point(clamp(mx, -3, 3) - spread, 0.3, mz); point(clamp(mx, -3, 3) + spread, 0.3, mz);
    want.set(0, 0, 0); for (let i = 0; i < used; i++) want.add(pool[i]); want.divideScalar(used);
    let d = 14;
    for (let pass = 0; pass < 5; pass++) {
      d = view.portrait ? 11 : 10.5;
      for (let i = 0; i < used; i++) { rel.copy(pool[i]).sub(want); const c = rel.dot(F); d = Math.max(d, Math.abs(rel.dot(R)) / (r.hx * th) - c, Math.abs(rel.dot(U)) / (r.hy * tv) - c); }
      let ax = 9, bx = -9, ay = 9, by = -9;
      for (let i = 0; i < used; i++) { rel.copy(pool[i]).sub(want); const depth = rel.dot(F) + d, x = rel.dot(R) / (depth * th), y = rel.dot(U) / (depth * tv); ax = Math.min(ax, x); bx = Math.max(bx, x); ay = Math.min(ay, y); by = Math.max(by, y); }
      want.addScaledVector(R, ((ax + bx) / 2) * d * th).addScaledVector(U, ((ay + by) / 2) * d * tv);
    }
    d = 10.5;
    for (let i = 0; i < used; i++) { rel.copy(pool[i]).sub(want); const c = rel.dot(F); d = Math.max(d, Math.abs(rel.dot(R)) / (r.hx * th) - c, Math.abs(rel.dot(U)) / (r.hy * tv) - c); }
    if (view.snap) { view.target.copy(want); view.dist = d; view.snap = false; }
    else {
      view.target.set(damp(view.target.x, want.x, 4.5, dt), damp(view.target.y, want.y, 4.5, dt), damp(view.target.z, want.z, 4.5, dt));
      view.dist = damp(view.dist, d, d > view.dist ? 7 : 2.2, dt);
    }
    // Beim Hinterherziehen darf nichts aus dem Bild rutschen
    let need = 0;
    for (let i = 0; i < used; i++) { rel.copy(pool[i]).sub(view.target); const c = rel.dot(F); need = Math.max(need, Math.abs(rel.dot(R)) / (r.hx * th) - c, Math.abs(rel.dot(U)) / (r.hy * tv) - c); }
    view.dist = Math.max(view.dist, need);
    const slow = state && state.slow > 0 && !opts.reducedMotion ? 0.93 : 1;
    view.zoom = damp(view.zoom || 1, slow, 6, dt);
    const dist = view.dist * view.zoom;
    view.shake = Math.max(0, view.shake - dt * 1.1);
    const s = opts.reducedMotion ? 0 : view.shake * view.shake * 2.4;
    camera.position.copy(view.target).addScaledVector(F, -dist);
    camera.position.x += Math.sin(view.time * 71) * s; camera.position.y += Math.sin(view.time * 93) * s;
    camera.rotation.set(-view.e, 0, 0);
    camera.setViewOffset(view.W, view.H, (-r.cx * view.W) / 2, (r.cy * view.H) / 2, view.W, view.H);
    camera.updateMatrixWorld();
  }
  function resize() {
    const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); renderer.setSize(w, h, false);
    view.W = w; view.H = h; camera.aspect = w / h; view.portrait = w / h < 0.9;
    view.e = view.portrait ? 0.73 : w / h > 1.9 ? 0.52 : 0.63; camera.fov = view.portrait ? 50 : 40; view.snap = true;
  }

  /* ---------- Ereignisse ---------- */
  function fx(e, s) {
    const b = s.ball, p = e.side >= 0 && s.p[e.side];
    if (e.type === 'rim') { burst(b.x, b.y, b.z, [0xffe8a0, 0xffffff, 0xff8a30], Math.min(16, 4 + e.v * 2), 2.6, 8, 0.5); court.shakeRim(Math.min(0.05, e.v * 0.008)); }
    else if (e.type === 'net') { court.swish(); }
    else if (e.type === 'dunk') { view.shake = 0.34; court.shakeRim(0.2); burst(HOOP.x, HOOP.y, HOOP.z, [0xffe14d, 0xff8a30, 0xffffff], 70, 5, 9, 1); wave(HOOP.x, HOOP.y - 0.05, HOOP.z, 0xffe14d); }
    else if (e.type === 'block') { view.shake = 0.28; burst(e.x, e.y, e.z, [0xffffff, 0x9fe4ff], 40, 4.5, 5, 0.6); wave(e.x, e.y, e.z, 0xffffff); }
    else if (e.type === 'steal') { view.shake = 0.16; burst(e.x, e.y, e.z, [0xffffff, 0xffe14d], 24, 3.4, 6, 0.5); wave(e.x, e.y, e.z, 0xffe14d); }
    else if (e.type === 'score') { view.mood = 1; burst(HOOP.x, HOOP.y - 0.3, HOOP.z, [TEAM[e.side], 0xffffff, 0xffe14d, 0x52e0a4], e.pts === 3 || e.kind === 'dunk' ? 110 : 55, 5.2, 5, 1.6); }
    else if ((e.type === 'land' || e.type === 'squeak' || e.type === 'cross') && p) burst(p.x, 0.08, p.z, [0xe9dcd0, 0xbfb4c8], e.type === 'land' ? 10 : 7, 1.4, 2, 0.45);
    else if (e.type === 'floor') burst(b.x, 0.06, b.z, [0xe9dcd0], 6, 1.2, 2, 0.35);
    else if (e.type === 'ankle' && p) { const d = s.p[1 - e.side]; wave(d.x, 0.05, d.z, 0xff5a6e); }
    else if (e.type === 'clear' && p) wave(p.x, 0.05, p.z, 0x52e0a4);
  }

  /* ---------- Bild ---------- */
  const idle = { p: [], ball: { x: 0.9, y: 0.12, z: 6.6, own: -1, mode: 'loose' } };
  for (const [x, z, f] of [[-1.4, 6.6, 0.45], [1.9, 7.1, -0.5]]) idle.p.push({ x, z, y: 0, vx: 0, vz: 0, f, act: 'free', at: 0, ch: 0, hx: 1, st: 1, mood: 0 });
  const prevBall = new THREE.Vector3(), axis = new THREE.Vector3();
  let lastState = null;
  function frame(dt, state) {
    view.time += dt; view.mood = Math.max(0, view.mood - dt * 0.6);
    const s = state || idle, b = s.ball; lastState = state;
    for (let k = 0; k < 2; k++) {
      const p = s.p[k];
      figures[k].update(dt, p, { has: b.own === k, ball: b, mine: !!state && k === view.me, mood: p.mood, defending: !!state && b.own === 1 - k });
    }
    ball.position.set(b.x, Math.max(BALL.r * 1.16, b.y), b.z);
    const mx = b.x - prevBall.x, my = b.y - prevBall.y, mz = b.z - prevBall.z, md = Math.hypot(mx, mz);
    if (b.own < 0 && Math.hypot(mx, my, mz) < 1.5) { if (md > 0.0005) ball.rotateOnWorldAxis(axis.set(mz, 0, -mx).normalize(), (md / BALL.r) * 0.45); else ball.rotateX(-dt * 3); } else if (b.own >= 0) ball.rotateX(dt * (b.mode === 'drib' ? 4 : 0));
    prevBall.set(b.x, b.y, b.z);
    const loose = b.own < 0;
    spot.position.set(b.x, 0.022, b.z); spot.visible = !!state; spot.material.opacity = loose ? clamp(0.95 - b.y * 0.1, 0.45, 0.95) : 0.38; spot.scale.setScalar(loose ? 1 + b.y * 0.22 + Math.sin(view.time * 8) * 0.07 : 0.8);
    if (state && b.mode === 'shot') { history.unshift([b.x, b.y, b.z]); if (history.length > TRAIL) history.pop(); } else history.length = Math.max(0, history.length - 2);
    trail.visible = history.length > 2;
    if (trail.visible) { const a = trailGeo.attributes.position.array; for (let i = 0; i < TRAIL; i++) a.set(history[Math.min(i, history.length - 1)], i * 3); trailGeo.attributes.position.needsUpdate = true; }
    const mine = s.p[view.me];
    marker.visible = !!state; marker.position.set(mine.x, (2.5 + Math.max(0, mine.y)) * SCALE + Math.sin(view.time * 4) * 0.05, mine.z); marker.rotation.y = view.time * 1.6;
    if (state && (mine.act === 'gather' || (b.own === view.me && b.y > 2.2))) marker.visible = false;
    // Verdeckt der Gegner die eigene Figur, wird er durchscheinend
    const own = s.p[view.me], opp = s.p[1 - view.me], dz = opp.z - own.z;
    const covers = !!state && dz > 0.15 && dz < 2.6 && Math.abs(opp.x - own.x) < 0.75;
    figures[1 - view.me].fade(covers ? 0.5 : 1, dt); figures[view.me].fade(1, dt);
    court.arcGlow.visible = !!state && s.need && s.phase === 'live'; court.arcGlow.material.opacity = 0.5 + Math.sin(view.time * 7) * 0.35;
    court.hoop(dt, state ? b : null);
    court.crowd(view.time, view.mood);
    for (let i = 0; i < N; i++) {
      if (pLife[i] <= 0) continue;
      pLife[i] -= dt; const j = i * 3;
      pVel[j + 1] -= pGrav[i] * dt; pVel[j] *= 1 - 0.8 * dt; pVel[j + 2] *= 1 - 0.8 * dt;
      pPos[j] += pVel[j] * dt; pPos[j + 1] = Math.max(0.04, pPos[j + 1] + pVel[j + 1] * dt); pPos[j + 2] += pVel[j + 2] * dt;
      if (pLife[i] <= 0) pPos[j + 1] = -50;
    }
    pGeo.attributes.position.needsUpdate = true;
    for (const w of waves) { if (!w.visible) continue; w.userData.t += dt; const t = w.userData.t; w.scale.setScalar(0.2 + t * 3.2); w.material.opacity = Math.max(0, 0.9 - t * 2.4); if (w.position.y < 0.2 || w.position.z < 2) w.rotation.x = -Math.PI / 2; else w.quaternion.copy(camera.quaternion); if (t > 0.4) w.visible = false; }
    frameCamera(state, dt);
    renderer.render(scene, camera);
  }

  const pv = new THREE.Vector3();
  function project(x, y, z) { pv.set(x, y, z).project(camera); return { x: ((pv.x + 1) / 2) * view.W, y: ((1 - pv.y) / 2) * view.H }; }

  return {
    canvas: renderer.domElement, resize, frame, fx, project,
    setSide(me) { view.me = me === 1 ? 1 : 0; view.snap = true; },
    reset() { view.snap = true; history.length = 0; pLife.fill(0); pPos.fill(-50); view.shake = 0; view.mood = 0; },
    setInsets(i) { Object.assign(view.insets, i); },
    // Bildschirmrichtung -> Richtung auf dem Platz. Die Kamera blickt immer Richtung Korb, für beide Rollen gleich.
    stickToWorld(x, y) { return { x, y }; },
    info() {
      const s = lastState;
      return {
        calls: renderer.info.render.calls, tris: renderer.info.render.triangles, w: view.W, h: view.H, dist: view.dist, insets: Object.assign({}, view.insets), me: view.me,
        board: [project(-HOOP.boardHalfW, HOOP.boardY1, HOOP.boardZ), project(HOOP.boardHalfW, HOOP.boardY0, HOOP.boardZ)], rim: project(HOOP.x, HOOP.y, HOOP.z),
        players: s ? s.p.map((p) => ({ feet: project(p.x, p.y, p.z), head: project(p.x, p.y + 2.12, p.z) })) : [],
        ball: s ? project(s.ball.x, s.ball.y, s.ball.z) : null, net: court.netActivity(), arc: court.arcGlow.visible,
        strides: figures.map((f) => f.anim.phase)
      };
    }
  };
}
