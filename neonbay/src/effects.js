// Reifenspuren, Qualm, Funken und weiche Bodenschatten (je ein Netz).
import * as THREE from '../vendor/three.module.js';
import { dotTexture, shadowMask } from './textures.js';

function particles(scene, count, size, blending) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 4), data = Array.from({ length: count }, () => ({ life: 0 }));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const m = new THREE.PointsMaterial({ size, map: dotTexture(), vertexColors: true, transparent: true, depthWrite: false, blending });
  const points = new THREE.Points(g, m); points.frustumCulled = false; points.visible = false; scene.add(points);
  let next = 0, alive = 0;
  return {
    emit(x, y, z, vx, vy, vz, life, r, gr, b, a, gravity = 0) { const p = data[next]; Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, r, g: gr, b, a, gravity }); next = (next + 1) % count; },
    update(dt) {
      alive = 0;
      data.forEach((p, i) => {
        if (p.life <= 0) { col[i * 4 + 3] = 0; pos[i * 3 + 1] = -50; return; }
        p.life -= dt; p.vy -= p.gravity * dt; p.x += p.vx * dt; p.y = Math.max(0.05, p.y + p.vy * dt); p.z += p.vz * dt; alive++;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        col[i * 4] = p.r; col[i * 4 + 1] = p.g; col[i * 4 + 2] = p.b; col[i * 4 + 3] = Math.max(0, p.life / p.max) * p.a;
      });
      points.visible = alive > 0; if (alive) { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; }
    },
    clear() { for (const p of data) p.life = 0; }
  };
}

export function createEffects(scene) {
  const smoke = particles(scene, 90, 1.5, THREE.NormalBlending), sparks = particles(scene, 60, 0.28, THREE.AdditiveBlending);
  // Reifenspuren: Ringpuffer aus kurzen Streifen
  const MAX = 500, pos = new Float32Array(MAX * 12), idx = [];
  for (let i = 0; i < MAX; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.setDrawRange(0, 0);
  const skid = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x140a16, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
  skid.frustumCulled = false; scene.add(skid);
  let write = 0, used = 0; const last = [null, null];
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x1a0a20, alphaMap: shadowMask(), transparent: true, opacity: 0.55, depthWrite: false });
  const shadow = (w, l) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2), shadowMat); m.position.y = 0.05; m.renderOrder = 1; scene.add(m); return m; };
  return {
    smoke, sparks, shadow,
    trail(wheel, x, z, on) {
      const prev = last[wheel];
      if (!on) { last[wheel] = null; return; }
      if (!prev) { last[wheel] = { x, z }; return; }
      const dx = x - prev.x, dz = z - prev.z, l = Math.hypot(dx, dz);
      if (l < 0.45) return;
      if (l > 4) { last[wheel] = { x, z }; return; }
      const nx = -dz / l * 0.14, nz = dx / l * 0.14;
      pos.set([prev.x + nx, 0.042, prev.z + nz, prev.x - nx, 0.042, prev.z - nz, x + nx, 0.042, z + nz, x - nx, 0.042, z - nz], write * 12);
      write = (write + 1) % MAX; used = Math.min(MAX, used + 1); g.setDrawRange(0, used * 6); g.attributes.position.needsUpdate = true;
      last[wheel] = { x, z };
    },
    update(dt) { smoke.update(dt); sparks.update(dt); },
    clear() { smoke.clear(); sparks.clear(); used = write = 0; g.setDrawRange(0, 0); last[0] = last[1] = null; }
  };
}
