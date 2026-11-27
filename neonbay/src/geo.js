// Kleiner Baukasten für zusammengefasste Geometrie (Position, Normale, UV, Farbe).
import * as THREE from '../vendor/three.module.js';

const colorCache = new Map();
export function col(hex, k = 1) {
  const key = hex + '|' + k; let c = colorCache.get(key);
  if (!c) { const t = new THREE.Color(hex); c = [t.r * k, t.g * k, t.b * k]; colorCache.set(key, c); }
  return c;
}

export function createBuilder() {
  const pos = [], nor = [], uv = [], color = [], idx = [];
  const B = {
    // Ecken gegen den Uhrzeigersinn von außen gesehen
    quad(a, b, c, d, n, c0, uvs) {
      const base = pos.length / 3, u = uvs || B.flat;
      for (let k = 0; k < 4; k++) { const p = k === 0 ? a : k === 1 ? b : k === 2 ? c : d; pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); uv.push(u[k][0], u[k][1]); color.push(c0[0], c0[1], c0[2]); }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    },
    flat: [[0, 0], [0, 0], [0, 0], [0, 0]],
    // waagrechte Fläche
    top(x0, z0, x1, z1, y, c, uvs) { B.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], c, uvs); },
    box(x0, y0, z0, x1, y1, z1, c, bottom) {
      B.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], c);
      B.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], c);
      B.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], c);
      B.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], c);
      B.top(x0, z0, x1, z1, y1, c);
      if (bottom) B.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], c);
    },
    // fertige three.js-Geometrie einfügen (Matrix und Farbe)
    add(geometry, matrix, c) {
      const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      if (matrix) g.applyMatrix4(matrix);
      const p = g.attributes.position, n = g.attributes.normal, base = pos.length / 3;
      for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(0, 0); color.push(c[0], c[1], c[2]); idx.push(base + i); }
      g.dispose();
    },
    mapUv(fn) { for (let i = 0; i < uv.length / 2; i++) { const r = fn(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); uv[i * 2] = r[0]; uv[i * 2 + 1] = r[1]; } },
    empty: () => !idx.length,
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
      g.setIndex(idx); g.computeBoundingSphere(); g.computeBoundingBox();
      return g;
    }
  };
  return B;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
export function mat(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return _m.compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)).clone();
}
