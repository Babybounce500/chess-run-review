// Statische Stadt als wenige zusammengefasste Netze je Kachel: Fassaden, Boden, Schilder.
import * as THREE from '../vendor/three.module.js';
import { createBuilder, col, mat } from './geo.js';
import { facadeTextures, signTexture, groundTexture, stripV, signUv } from './textures.js';
import { createRng } from './rng.js';
import { MAP, CHUNK } from './config.js';

const N = Math.ceil(600 / CHUNK);
const chunkOf = (x, z) => Math.max(0, Math.min(N - 1, Math.floor((z + 300) / CHUNK))) * N + Math.max(0, Math.min(N - 1, Math.floor((x + 300) / CHUNK)));

/* ---------- Fassaden ---------- */
const PLAIN = stripV(6);
const plainUv = [[0.5, (PLAIN[0] + PLAIN[1]) / 2], [0.5, (PLAIN[0] + PLAIN[1]) / 2], [0.5, (PLAIN[0] + PLAIN[1]) / 2], [0.5, (PLAIN[0] + PLAIN[1]) / 2]];
function walls(B, x0, z0, x1, z1, y0, floors, fh, style, color, offset) {
  const faces = [
    { a: [x0, z1], b: [x1, z1], n: [0, 0, 1] }, { a: [x1, z0], b: [x0, z0], n: [0, 0, -1] },
    { a: [x1, z1], b: [x1, z0], n: [1, 0, 0] }, { a: [x0, z0], b: [x0, z1], n: [-1, 0, 0] }
  ];
  for (const f of faces) {
    const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]), bays = Math.max(1, Math.round(len / 3));
    for (let k = 0; k < floors; k++) {
      const s = typeof style === 'function' ? style(k) : style, v = stripV(s), u0 = (offset % 8) / 8, u1 = u0 + bays / 8;
      const y = y0 + k * fh, c = typeof color === 'function' ? color(k) : color;
      B.quad([f.a[0], y, f.a[1]], [f.b[0], y, f.b[1]], [f.b[0], y + fh, f.b[1]], [f.a[0], y + fh, f.a[1]], f.n, c, [[u0, v[0]], [u1, v[0]], [u1, v[1]], [u0, v[1]]]);
    }
  }
}
function slab(B, x0, y0, z0, x1, y1, z1, c) {                       // Quader mit einfarbiger Textur
  const old = B.flat; B.flat = plainUv; B.box(x0, y0, z0, x1, y1, z1, c, y0 > 0.5); B.flat = old;
}
function building(B, b, inner) {
  const rng = createRng(b.roof), wall = col(b.color), ground = col(b.color, 0.82), trim = col(b.color, 0.62), roof = col('#8d7f8a'), light = col('#f5e9dc');
  const offset = rng.int(0, 7);
  walls(B, b.x0, b.z0, b.x1, b.z1, 0, b.floors, b.floor, (k) => (k ? b.style : b.ground), (k) => (k ? wall : b.ground === 3 ? ground : col('#fff4ea')), offset);
  const roofFor = (x0, z0, x1, z1, h) => {
    const old = B.flat; B.flat = plainUv; B.top(x0 + 0.05, z0 + 0.05, x1 - 0.05, z1 - 0.05, h + 0.02, roof); B.flat = old;
    for (const [a, c, d, e] of [[x0, z0, x1, z0 + 0.35], [x0, z1 - 0.35, x1, z1], [x0, z0 + 0.35, x0 + 0.35, z1 - 0.35], [x1 - 0.35, z0 + 0.35, x1, z1 - 0.35]]) slab(B, a, h, c, d, h + 0.55, e, light);
    const w = x1 - x0, d = z1 - z0;
    for (let k = 0, n = rng.int(1, 4); k < n && w > 6 && d > 6; k++) { const sx = rng.range(1, 3), sz = rng.range(1, 3), x = rng.range(x0 + 1, x1 - 1 - sx), z = rng.range(z0 + 1, z1 - 1 - sz); slab(B, x, h, z, x + sx, h + rng.range(0.7, 1.8), z + sz, col('#b9b0b8')); }
    if (rng.chance(0.2) && w > 8 && d > 8) { const x = rng.range(x0 + 2.5, x1 - 2.5), z = rng.range(z0 + 2.5, z1 - 2.5); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) slab(B, x + dx - 0.1, h, z + dz - 0.1, x + dx + 0.1, h + 1.4, z + dz + 0.1, trim); B.add(new THREE.CylinderGeometry(1.5, 1.5, 2.2, 8), mat(x, h + 2.5, z), col('#c98d6a')); B.add(new THREE.ConeGeometry(1.7, 0.8, 8), mat(x, h + 4, z), col('#8a5a4a')); }
    if (h > 30 && rng.chance(0.6)) { const x = (x0 + x1) / 2, z = (z0 + z1) / 2; slab(B, x - 0.12, h, z - 0.12, x + 0.12, h + 8, z + 0.12, col('#6d6478')); }
  };
  if (b.top) {
    const t = b.top.inset;
    roofFor(b.x0, b.z0, b.x1, b.z1, b.base);
    walls(B, b.x0 + t, b.z0 + t, b.x1 - t, b.z1 - t, b.base, b.top.floors, b.floor, b.style, col(b.color, 0.92), offset);
    roofFor(b.x0 + t, b.z0 + t, b.x1 - t, b.z1 - t, b.h);
  } else roofFor(b.x0, b.z0, b.x1, b.z1, b.h);
  // Vorsprünge an Straßenseiten: Gesims, Markisen, Balkone, Kanten
  if (!inner) return;
  const sides = [];
  if (Math.abs(b.x0 - inner.x0) < 0.01) sides.push([b.x0, b.z0, b.x0, b.z1, -1, 0]);
  if (Math.abs(b.x1 - inner.x1) < 0.01) sides.push([b.x1, b.z0, b.x1, b.z1, 1, 0]);
  if (Math.abs(b.z0 - inner.z0) < 0.01) sides.push([b.x0, b.z0, b.x1, b.z0, 0, -1]);
  if (Math.abs(b.z1 - inner.z1) < 0.01) sides.push([b.x0, b.z1, b.x1, b.z1, 0, 1]);
  const awning = col(rng.pick(['#e8576a', '#2fb7ac', '#f2a63a', '#8a63c9']));
  for (const [ax, az, bx, bz, nx, nz] of sides) {
    const out = (a, c, d, y0, y1, color) => {                       // Leiste entlang der Seite, a..c Anteil, d Tiefe
      const x0 = ax + (bx - ax) * a, x1 = ax + (bx - ax) * c, z0 = az + (bz - az) * a, z1 = az + (bz - az) * c;
      slab(B, Math.min(x0, x1, x0 + nx * d, x1 + nx * d), y0, Math.min(z0, z1, z0 + nz * d, z1 + nz * d), Math.max(x0, x1, x0 + nx * d, x1 + nx * d), y1, Math.max(z0, z1, z0 + nz * d, z1 + nz * d), color);
    };
    out(0, 1, 0.22, b.floor - 0.14, b.floor + 0.1, light);
    if (b.type !== 'warehouse' && b.type !== 'towers' && rng.chance(0.55)) { const from = rng.range(0.05, 0.4); out(from, from + rng.range(0.35, 0.55), 0.95, b.floor - 0.72, b.floor - 0.55, awning); }
    if (b.style === 2) for (let k = 1; k < b.floors; k++) { out(0.06, 0.94, 0.55, k * b.floor - 0.02, k * b.floor + 0.1, light); out(0.06, 0.94, 0.04, k * b.floor + 0.1, k * b.floor + 0.12, trim); }
    if (b.style === 0 || b.style === 7) for (const a of [0, 0.985]) out(a, a + 0.015, 0.18, b.floor, b.base, light);
  }
}
function containerMesh(B, k) {
  const c = col(k.color), d = col(k.color, 0.7);
  slab(B, k.x0, k.y + 0.02, k.z0, k.x1, k.y + 2.58, k.z1, c);
  const alongX = k.x1 - k.x0 > k.z1 - k.z0;
  for (let t = 0.5; t < (alongX ? k.x1 - k.x0 : k.z1 - k.z0) - 0.3; t += 0.7) {
    if (alongX) { slab(B, k.x0 + t, k.y + 0.15, k.z0 - 0.04, k.x0 + t + 0.18, k.y + 2.45, k.z0, d); slab(B, k.x0 + t, k.y + 0.15, k.z1, k.x0 + t + 0.18, k.y + 2.45, k.z1 + 0.04, d); }
    else { slab(B, k.x0 - 0.04, k.y + 0.15, k.z0 + t, k.x0, k.y + 2.45, k.z0 + t + 0.18, d); slab(B, k.x1, k.y + 0.15, k.z0 + t, k.x1 + 0.04, k.y + 2.45, k.z0 + t + 0.18, d); }
  }
}
function crane(B, c) {
  const y = col('#e8a53a'), dark = col('#4a3f55');
  for (const dx of [-6, 6]) for (const dz of [-4, 4]) { slab(B, c.x + dx - 0.55, 0, c.z + dz - 0.55, c.x + dx + 0.55, 20, c.z + dz + 0.55, y); slab(B, c.x + dx - 0.7, 0, c.z + dz - 0.7, c.x + dx + 0.7, 1.2, c.z + dz + 0.7, dark); }
  for (const dz of [-4, 4]) slab(B, c.x - 6.5, 19, c.z + dz - 0.4, c.x + 6.5, 20.4, c.z + dz + 0.4, y);
  slab(B, c.x - 1.4, 20.4, c.z - 14, c.x + 1.4, 22, c.z + 30, y);
  slab(B, c.x - 2.2, 22, c.z - 4, c.x + 2.2, 25, c.z + 1, dark);
  slab(B, c.x - 0.08, 12, c.z + 24, c.x + 0.08, 20.4, c.z + 24.16, dark);
  slab(B, c.x - 1.2, 11.2, c.z + 22.8, c.x + 1.2, 12, c.z + 25.4, col('#c0503c'));
}

/* ---------- Boden ---------- */
function ground(world, builders) {
  const G = (x, z) => builders[chunkOf(x, z)];
  // Fläche in Stücke je Kachel zerlegen
  const area = (x0, z0, x1, z1, y, c) => {
    for (let x = x0; x < x1 - 1e-6;) {
      const nx = Math.min(x1, -300 + (Math.floor((x + 300) / CHUNK + 1e-6) + 1) * CHUNK);
      for (let z = z0; z < z1 - 1e-6;) { const nz = Math.min(z1, -300 + (Math.floor((z + 300) / CHUNK + 1e-6) + 1) * CHUNK); G((x + nx) / 2, (z + nz) / 2).ground.top(x, z, nx, nz, y, c); z = nz; }
      x = nx;
    }
  };
  const walk = col('#cdb7ad'), asphalt = col('#554a63'), line = col('#f4e6c8'), yellow = col('#ffc65a'), curb = col('#f0ddd0');
  // Grundfläche (Land)
  area(-300, -300, 300, MAP.harbourZ, 0, walk);
  area(-300, MAP.harbourZ, MAP.harbourX, MAP.seaZ, 0, col('#f2cf98'));
  area(MAP.pierX0, MAP.harbourZ, MAP.pierX1, MAP.pierZ1, 0, col('#b98a66'));
  for (let z = MAP.harbourZ; z < MAP.pierZ1; z += 1.6) area(MAP.pierX0, z, MAP.pierX1, z + 0.12, 0.012, col('#7c5645'));
  // Gehwegplatten der Blöcke und Höfe
  for (const b of world.blocks) {
    const i = b.inner;
    area(i.x0, i.z0, i.x1, i.z1, 0.012, col(b.type === 'plaza' ? '#e8c3a8' : b.type === 'parking' ? '#615670' : b.type === 'warehouse' ? '#a99a99' : '#b8a2a0'));
    for (const [x0, z0, x1, z1] of [[b.x0, b.z0, b.x1, b.z0 + 0.3], [b.x0, b.z1 - 0.3, b.x1, b.z1], [b.x0, b.z0 + 0.3, b.x0 + 0.3, b.z1 - 0.3], [b.x1 - 0.3, b.z0 + 0.3, b.x1, b.z1 - 0.3]]) area(x0, z0, x1, z1, 0.028, curb);
    if (b.type === 'plaza') { const cx = (i.x0 + i.x1) / 2, cz = (i.z0 + i.z1) / 2; for (let r = 7; r < Math.min(i.x1 - i.x0, i.z1 - i.z0) / 2; r += 5) { area(cx - r, cz - r, cx + r, cz - r + 0.4, 0.025, col('#c9788a')); area(cx - r, cz + r - 0.4, cx + r, cz + r, 0.025, col('#c9788a')); area(cx - r, cz - r, cx - r + 0.4, cz + r, 0.025, col('#c9788a')); area(cx + r - 0.4, cz - r, cx + r, cz + r, 0.025, col('#c9788a')); } }
  }
  for (const p of world.bays) { area(p.x - 1.7, p.z - 2.8, p.x - 1.58, p.z + 2.8, 0.03, line); area(p.x + 1.58, p.z - 2.8, p.x + 1.7, p.z + 2.8, 0.03, line); }
  // Straßen
  const R = world.roads;
  for (const s of R.segs) area(s.rect.x0, s.rect.z0, s.rect.x1, s.rect.z1, 0.016, asphalt);
  for (let j = 0; j < R.hz.length; j++) for (let i = 0; i < R.vx.length; i++) area(R.vx[i] - R.vw[i] / 2, R.hz[j] - R.hw[j] / 2, R.vx[i] + R.vw[i] / 2, R.hz[j] + R.hw[j] / 2, 0.018, asphalt);
  for (const s of R.segs) {
    const h = s.dir === 'h', a = s.a, b = s.b, A = R.nodes[a], B = R.nodes[b];
    const wa = h ? R.vw[A.i] : R.hw[A.j], wb = h ? R.vw[B.i] : R.hw[B.j];
    const from = (h ? s.ax : s.az) + wa / 2, to = (h ? s.bx : s.bz) - wb / 2, mid = h ? s.az : s.ax;
    const strip = (u0, u1, off, wide, c, y = 0.032) => (h ? area(u0, mid + off - wide / 2, u1, mid + off + wide / 2, y, c) : area(mid + off - wide / 2, u0, mid + off + wide / 2, u1, y, c));
    if (s.w > 13) { strip(from + 4.5, to - 4.5, -0.22, 0.16, yellow); strip(from + 4.5, to - 4.5, 0.22, 0.16, yellow); }
    else for (let u = from + 5; u < to - 7; u += 6) strip(u, u + 3, 0, 0.18, line);
    for (const [u0, u1] of [[from + 0.7, from + 3.5], [to - 3.5, to - 0.7]]) for (let o = -s.w / 2 + 0.9; o < s.w / 2 - 0.9; o += 1.5) strip(u0, u1, o + 0.3, 0.7, col('#e9dccf'));
  }
  // Promenade
  const shore = R.hz[R.hz.length - 1] + R.hw[R.hw.length - 1] / 2;
  area(-300, shore + 4, MAP.harbourX, MAP.beachZ, 0.02, col('#e6a98c'));
  for (let x = -300; x < MAP.harbourX; x += 8) area(x, shore + 4, x + 0.25, MAP.beachZ, 0.026, col('#c98574'));
  area(-300, shore + 14, MAP.harbourX, shore + 14.5, 0.03, col('#f7e4cf'));
  area(-300, MAP.beachZ - 0.6, MAP.harbourX, MAP.beachZ, 0.03, curb);
  area(MAP.harbourX, shore + 4, 300, MAP.harbourZ, 0.02, col('#9d93a0'));
  for (let x = MAP.harbourX + 4; x < 296; x += 4) if (x < MAP.pierX0 || x > MAP.pierX1) area(x, MAP.harbourZ - 2.2, x + 2, MAP.harbourZ - 1.7, 0.028, yellow);
}

// Kaimauern, Randmauer und Kulisse außerhalb der Karte (immer sichtbar, je ein Netz)
function backdrop(B, G) {
  const quay = col('#8a7280'), E = MAP.edge;
  slab(B, MAP.harbourX, -3, MAP.harbourZ - 0.05, MAP.pierX0, 0, MAP.harbourZ + 0.35, quay); slab(B, MAP.pierX1, -3, MAP.harbourZ - 0.05, 300, 0, MAP.harbourZ + 0.35, quay);
  slab(B, MAP.harbourX - 0.35, -3, MAP.harbourZ, MAP.harbourX + 0.05, 0, MAP.seaZ, quay);
  for (let z = MAP.harbourZ + 3; z < MAP.pierZ1; z += 7) for (const x of [MAP.pierX0 + 0.2, MAP.pierX1 - 0.6]) slab(B, x, -3, z, x + 0.4, -0.02, z + 0.4, col('#5d4038'));
  // Randmauer
  const wall = col('#d9bfb4'), cap = col('#8c6f7c');
  for (const [x0, z0, x1, z1] of [[-E - 0.6, -E - 0.6, -E, MAP.seaZ], [E, -E - 0.6, E + 0.6, MAP.harbourZ], [-E, -E - 0.6, E, -E]]) { slab(B, x0, 0, z0, x1, 1.3, z1, wall); slab(B, x0 - 0.1, 1.3, z0, x1 + 0.1, 1.5, z1, cap); }
  // Land und Häuser jenseits der Mauer
  G.top(-760, -760, -300, MAP.seaZ, -0.02, col('#93788a')); G.top(300, -760, 760, MAP.harbourZ, -0.02, col('#93788a')); G.top(-300, -760, 300, -300, -0.02, col('#93788a'));
  const rng = createRng(1234);
  const row = (n, place) => { for (let i = 0; i < n; i++) { const [x, z] = place(rng), w = rng.range(14, 30), d = rng.range(14, 30), floors = rng.int(2, 9); walls(B, x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0, floors, 3.4, rng.pick([0, 1, 7, 2]), col(rng.pick(['#8e7894', '#a5808c', '#7c7396', '#b2938f'])), rng.int(0, 7)); slab(B, x - w / 2, floors * 3.4, z - d / 2, x + w / 2, floors * 3.4 + 0.4, z + d / 2, col('#6f607c')); } };
  row(46, (r) => [r.range(-380, -318), r.range(-340, 240)]);
  row(40, (r) => [r.range(318, 380), r.range(-340, 190)]);
  row(46, (r) => [r.range(-340, 340), r.range(-390, -318)]);
  // Hügelkette am Horizont
  for (let i = 0; i < 30; i++) { const a = Math.PI * 0.62 + (i / 29) * Math.PI * 1.76, d = rng.range(520, 600), x = Math.cos(a) * d, z = Math.sin(a) * d - 40; if (z > 120) continue; B.flat = plainUv; B.add(new THREE.ConeGeometry(rng.range(80, 150), rng.range(45, 100), 7), mat(x, 12, z, 0, rng.range(0, 3)), col('#5d4a77')); B.flat = [[0, 0], [0, 0], [0, 0], [0, 0]]; }
}

export function buildCity(world, scene) {
  const facade = facadeTextures();
  const facadeMat = new THREE.MeshLambertMaterial({ map: facade.map, emissiveMap: facade.emissive, emissive: 0xffffff, emissiveIntensity: 0.85, vertexColors: true });
  const groundMap = groundTexture(world);
  const groundMat = new THREE.MeshLambertMaterial({ map: groundMap, vertexColors: true });
  const signMat = new THREE.MeshBasicMaterial({ map: signTexture(), toneMapped: false });
  const builders = Array.from({ length: N * N }, () => ({ facade: createBuilder(), ground: createBuilder(), sign: createBuilder() }));

  const innerOf = (b) => { const bl = world.blocks.find((k) => b.x0 >= k.x0 && b.x1 <= k.x1 && b.z0 >= k.z0 && b.z1 <= k.z1); return bl && bl.inner; };
  for (const b of world.buildings) building(builders[chunkOf((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2)].facade, b, innerOf(b));
  for (const k of world.containers) containerMesh(builders[chunkOf((k.x0 + k.x1) / 2, (k.z0 + k.z1) / 2)].facade, k);
  crane(builders[chunkOf(world.crane.x, world.crane.z)].facade, world.crane);
  for (const p of world.props) if (p.kind === 'fountain') {
    const B = builders[chunkOf(p.x, p.z)].facade; B.flat = plainUv;
    B.add(new THREE.CylinderGeometry(4.2, 4.5, 0.8, 20), mat(p.x, 0.4, p.z), col('#f2dccb')); B.add(new THREE.CylinderGeometry(3.7, 3.7, 0.1, 20), mat(p.x, 0.82, p.z), col('#3fc7d6'));
    B.add(new THREE.CylinderGeometry(0.45, 0.7, 2.4, 10), mat(p.x, 1.8, p.z), col('#f2dccb')); B.add(new THREE.CylinderGeometry(1.5, 0.5, 0.4, 14), mat(p.x, 3.1, p.z), col('#ff8fa8'));
    B.flat = [[0, 0], [0, 0], [0, 0], [0, 0]];
  }
  ground(world, builders);

  for (const s of world.signs) {
    const B = builders[chunkOf(s.x, s.z)].sign, [u0, v0, u1, v1] = signUv(s.name), white = [1, 1, 1];
    const face = (mx, mz, cx, cz, rotated) => {                       // Blickrichtung (mx, mz)
      const rx = mz, rz = -mx, w = s.w / 2, h = s.hgt / 2;
      B.quad([cx - rx * w, s.y - h, cz - rz * w], [cx + rx * w, s.y - h, cz + rz * w], [cx + rx * w, s.y + h, cz + rz * w], [cx - rx * w, s.y + h, cz - rz * w], [mx, 0, mz], white,
        rotated ? [[u0, v1], [u0, v0], [u1, v0], [u1, v1]] : [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
    };
    if (!s.blade) face(s.nx, s.nz, s.x, s.z, false);
    else {
      const tx = s.nz, tz = -s.nx;
      face(tx, tz, s.x + tx * 0.07, s.z + tz * 0.07, true); face(-tx, -tz, s.x - tx * 0.07, s.z - tz * 0.07, true);
      const F = builders[chunkOf(s.x, s.z)].facade, ex = Math.abs(s.nx) ? s.w / 2 + 0.08 : 0.05, ez = Math.abs(s.nz) ? s.w / 2 + 0.08 : 0.05;
      slab(F, s.x - ex, s.y - s.hgt / 2 - 0.1, s.z - ez, s.x + ex, s.y + s.hgt / 2 + 0.1, s.z + ez, col('#241a33'));
      slab(F, Math.min(s.x, s.x - s.nx * 1.15) - 0.04, s.y + s.hgt / 2 - 0.4, Math.min(s.z, s.z - s.nz * 1.15) - 0.04, Math.max(s.x, s.x - s.nx * 1.15) + 0.04, s.y + s.hgt / 2 - 0.3, Math.max(s.z, s.z - s.nz * 1.15) + 0.04, col('#241a33'));
    }
  }

  const uvOfGround = (x, y, z) => [(x + 300) / 600, 1 - (z + 300) / 600];
  const chunks = builders.map((b, k) => {
    const group = new THREE.Group();
    const add = (builder, material, name) => { if (builder.empty()) return; const m = new THREE.Mesh(builder.build(), material); m.name = name; m.matrixAutoUpdate = false; group.add(m); };
    b.ground.mapUv(uvOfGround);
    add(b.facade, facadeMat, 'facade'); add(b.ground, groundMat, 'ground'); add(b.sign, signMat, 'sign');
    scene.add(group);
    const x0 = -300 + (k % N) * CHUNK, z0 = -300 + Math.floor(k / N) * CHUNK;
    return { group, x0, z0, x1: x0 + CHUNK, z1: z0 + CHUNK };
  });
  const far = createBuilder(), farGround = createBuilder(); backdrop(far, farGround); farGround.mapUv(() => [0.0005, 0.9995]);
  for (const [b, m] of [[far, facadeMat], [farGround, groundMat]]) { const mesh = new THREE.Mesh(b.build(), m); mesh.matrixAutoUpdate = false; scene.add(mesh); }

  return {
    chunks,
    update(x, z, view) {
      let n = 0;
      for (const c of chunks) { const d = Math.hypot(Math.max(c.x0 - x, 0, x - c.x1), Math.max(c.z0 - z, 0, z - c.z1)); c.group.visible = d < view; if (c.group.visible) n++; }
      return n;
    }
  };
}
