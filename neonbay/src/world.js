// Stadt aus einem Startwert: Straßennetz -> Blöcke -> Gebäude und Inventar -> Kollisionsgitter.
// Reine Logik ohne DOM und Grafik.
import { MAP, CITY, CAR } from './config.js';
import { createRng } from './rng.js';

const CELL = 20, GRID_FROM = -340, GRID_N = 34;

export const SIGN_NAMES = ['KOLIBRI BAR', 'SALZWERK', 'MOTEL LUNAFLUT', 'PINA SOL', 'NACHTWELLE', 'HAFENGLUT', 'ZITRUSKINO', 'FUNKENSNACK',
  'KORALLE 7', 'TIDENHUB', 'PALMA VISTA', 'BLAUE STUNDE', 'EISZAUBER', 'RADIO MÖWE', 'DÜNENCLUB', 'SIRUP & CO'];

function positions(rng, from, to, n) {
  const step = (to - from) / (n - 1), out = [];
  for (let i = 0; i < n; i++) out.push(i === 0 || i === n - 1 ? from + i * step : Math.round(from + i * step + rng.range(-0.14, 0.14) * step));
  return out;
}

/* ---------- Straßennetz ---------- */
function buildRoads(rng) {
  const vx = positions(rng, CITY.vFrom, CITY.vTo, CITY.vRoads), hz = positions(rng, CITY.hFrom, CITY.hTo, CITY.hRoads);
  const avenue = Math.floor(vx.length / 2) - 1;
  const vw = vx.map((_, i) => (i === avenue ? CITY.avenue : CITY.road));
  const hw = hz.map((_, j) => (j === hz.length - 1 ? CITY.beachRoad : CITY.road));
  const nodes = [];
  for (let j = 0; j < hz.length; j++) for (let i = 0; i < vx.length; i++) nodes.push({ i, j, x: vx[i], z: hz[j] });
  const id = (i, j) => j * vx.length + i;
  const segs = [];
  for (let j = 0; j < hz.length; j++) for (let i = 0; i < vx.length - 1; i++) segs.push({ dir: 'h', i, j, a: id(i, j), b: id(i + 1, j), w: hw[j] });
  for (let j = 0; j < hz.length - 1; j++) for (let i = 0; i < vx.length; i++) segs.push({ dir: 'v', i, j, a: id(i, j), b: id(i, j + 1), w: vw[i] });

  // Einige innere Abschnitte entfernen (größere Blöcke), ohne das Netz zu zerschneiden
  const used = new Set(), removed = [];
  const inner = segs.filter((s) => (s.dir === 'h' ? s.j > 0 && s.j < hz.length - 1 : s.i > 0 && s.i < vx.length - 1 && s.i !== avenue));
  const degree = (n) => segs.filter((s) => !s.gone && (s.a === n || s.b === n)).length;
  const connected = () => {
    const seen = new Set([0]), todo = [0];
    while (todo.length) { const n = todo.pop(); for (const s of segs) { if (s.gone) continue; const m = s.a === n ? s.b : s.b === n ? s.a : -1; if (m >= 0 && !seen.has(m)) { seen.add(m); todo.push(m); } } }
    return seen.size === nodes.length;
  };
  for (let tries = 0; tries < 400 && removed.length < CITY.merges && inner.length; tries++) {
    const s = rng.pick(inner); if (s.gone) continue;
    const cells = s.dir === 'h' ? [s.i + ',' + (s.j - 1), s.i + ',' + s.j] : [(s.i - 1) + ',' + s.j, s.i + ',' + s.j];
    if (cells.some((c) => used.has(c))) continue;
    if (degree(s.a) <= 2 || degree(s.b) <= 2) continue;
    s.gone = true; if (!connected()) { s.gone = false; continue; }
    cells.forEach((c) => used.add(c)); removed.push({ seg: s, cells });
  }
  const live = segs.filter((s) => !s.gone);
  for (const s of live) {
    const A = nodes[s.a], B = nodes[s.b]; s.ax = A.x; s.az = A.z; s.bx = B.x; s.bz = B.z;
    s.rect = s.dir === 'h' ? { x0: A.x, x1: B.x, z0: A.z - s.w / 2, z1: A.z + s.w / 2 } : { x0: A.x - s.w / 2, x1: A.x + s.w / 2, z0: A.z, z1: B.z };
  }
  return { vx, hz, vw, hw, avenue, nodes, segs: live, removed };
}

/* ---------- Blöcke ---------- */
function buildBlocks(rng, R) {
  const { vx, hz, vw, hw } = R;
  const cell = (i, j) => ({ x0: vx[i] + vw[i] / 2, x1: vx[i + 1] - vw[i + 1] / 2, z0: hz[j] + hw[j] / 2, z1: hz[j + 1] - hw[j + 1] / 2 });
  const blocks = [], merged = new Map();
  for (const m of R.removed) merged.set(m.cells[0], m), merged.set(m.cells[1], m);
  const done = new Set();
  for (let j = 0; j < hz.length - 1; j++) for (let i = 0; i < vx.length - 1; i++) {
    const key = i + ',' + j; if (done.has(key)) continue;
    let r = cell(i, j), big = false, cj = j;
    const m = merged.get(key);
    if (m) {
      for (const c of m.cells) { done.add(c); const [a, b] = c.split(',').map(Number), o = cell(a, b); r = { x0: Math.min(r.x0, o.x0), x1: Math.max(r.x1, o.x1), z0: Math.min(r.z0, o.z0), z1: Math.max(r.z1, o.z1) }; cj = Math.max(cj, b); }
      big = true;
    } else done.add(key);
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    let type = 'mixed';
    if (cj === hz.length - 2) type = cx > 120 ? 'warehouse' : 'shore';
    else if (Math.abs(cx + 20) < 125 && cz < -80) type = 'towers';
    else if (cx < -110) type = 'old';
    else if (cx > 140 && cz > -40) type = 'warehouse';
    blocks.push({ ...r, type, big });
  }
  // Je zwei Plätze und Parkplätze
  const free = blocks.filter((b) => b.type === 'mixed' || b.type === 'old');
  for (const t of ['plaza', 'parking', 'plaza', 'parking']) { if (!free.length) break; const k = Math.floor(rng() * free.length); free.splice(k, 1)[0].type = t; }
  return blocks;
}

/* ---------- Gebäude ---------- */
const PALETTES = {
  towers: ['#8fb3c9', '#a9c4d6', '#d9c7b0', '#7e9ab5', '#c6b1c9', '#e3d5c4'],
  old: ['#f2a07b', '#f6c177', '#f4d8a8', '#e58a8a', '#9fd3c3', '#f0b6a0', '#e9e0cf'],
  shore: ['#fbe3cf', '#9fe0d6', '#ffb3a7', '#ffd59e', '#c9b6f2', '#f8f1e4'],
  warehouse: ['#b86f55', '#8d97a3', '#a89a86', '#6f8f94'],
  mixed: ['#e9d3bd', '#c8d5d2', '#f1b99a', '#bfa6c4', '#d6c08f', '#a8c0d8']
};
function makeBuilding(rng, r, type) {
  const b = { x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, type, color: rng.pick(PALETTES[type] || PALETTES.mixed), floor: 3.2, floors: 3, style: 1, ground: rng.chance(0.5) ? 4 : 5, roof: rng.int(0, 999999), top: null };
  if (type === 'towers') { b.floors = rng.int(9, 22); b.style = rng.pick([0, 0, 7, 2]); if (rng.chance(0.4)) b.top = { inset: rng.range(2, 4), floors: rng.int(2, 6) }; }
  else if (type === 'old') { b.floors = rng.int(2, 5); b.style = rng.pick([1, 1, 2]); }
  else if (type === 'shore') { b.floors = rng.int(2, 4); b.style = rng.pick([1, 2, 2, 7]); }
  else if (type === 'warehouse') { b.floors = rng.int(2, 3); b.floor = 3.5; b.style = 3; b.ground = 3; }
  else { b.floors = rng.int(3, 8); b.style = rng.pick([1, 2, 7, 0]); if (b.floors > 6 && rng.chance(0.3)) b.top = { inset: rng.range(2, 3.5), floors: rng.int(1, 3) }; }
  b.base = b.floors * b.floor;
  b.h = b.base + (b.top ? b.top.floors * b.floor : 0);
  return b;
}
function fillLots(rng, r, type, out, root = r) {
  const w = r.x1 - r.x0, d = r.z1 - r.z0;
  const max = type === 'towers' ? 34 : type === 'old' ? 22 : type === 'warehouse' ? 40 : 28;
  if (w <= max && d <= max) { out.push(makeBuilding(rng, r, type)); return; }
  const alongX = w >= d, len = alongX ? w : d;
  // Gassen nur dort, wo sie mindestens an einem Ende auf den Gehweg münden (sonst entstünden abgeschlossene Höfe)
  const open = alongX ? r.z0 === root.z0 || r.z1 === root.z1 : r.x0 === root.x0 || r.x1 === root.x1;
  const gap = open && len > 2 * 14 + CITY.alley && rng.chance(type === 'warehouse' ? 0.7 : 0.35) ? CITY.alley : 0;
  const cut = (alongX ? r.x0 : r.z0) + Math.round((len - gap) * rng.range(0.42, 0.58) * 10) / 10;
  if (alongX) { fillLots(rng, { ...r, x1: cut }, type, out, root); fillLots(rng, { ...r, x0: cut + gap }, type, out, root); }
  else { fillLots(rng, { ...r, z1: cut }, type, out, root); fillLots(rng, { ...r, z0: cut + gap }, type, out, root); }
}

/* ---------- Welt ---------- */
export function createWorld(seed) {
  const rng = createRng(seed);
  const roads = buildRoads(rng), blocks = buildBlocks(rng, roads);
  const world = { seed: seed >>> 0, roads, blocks, buildings: [], props: [], containers: [], signs: [], parked: [], water: [], bounds: [], colliders: [], spawn: null, bays: [] };
  const rect = (kind, x0, z0, x1, z1, h, occlude) => world.colliders.push({ t: 0, kind, x0, z0, x1, z1, h, occlude: !!occlude });
  const circ = (kind, x, z, r, h) => world.colliders.push({ t: 1, kind, x, z, r, h });
  const prop = (kind, x, z, rot = 0, s = 1) => {
    world.props.push({ kind, x, z, rot, s });
    if (kind === 'palm') circ('palm', x, z, 0.35, 7);
    else if (kind === 'lamp') circ('lamp', x, z, 0.22, 6);
    else if (kind === 'bench') { const along = Math.abs(Math.sin(rot)) > 0.7; rect('bench', x - (along ? 0.4 : 1.1), z - (along ? 1.1 : 0.4), x + (along ? 0.4 : 1.1), z + (along ? 1.1 : 0.4), 0.9); }
    else if (kind === 'fountain') circ('fountain', x, z, 4.2, 1.2);
    else if (kind === 'planter') circ('planter', x, z, 0.8, 0.9);
  };

  // Wasser und Kartenrand
  const W = (x0, z0, x1, z1) => { world.water.push({ x0, z0, x1, z1 }); rect('water', x0, z0, x1, z1, 0.9); };
  W(-340, MAP.seaZ, MAP.harbourX, 340);
  W(MAP.harbourX, MAP.harbourZ, MAP.pierX0, 340);
  W(MAP.pierX1, MAP.harbourZ, 340, 340);
  W(MAP.pierX0, MAP.pierZ1, MAP.pierX1, 340);
  const E = MAP.edge;
  for (const b of [[-340, -340, -E, 340], [E, -340, 340, 340], [-E, -340, E, -E]]) { world.bounds.push({ x0: b[0], z0: b[1], x1: b[2], z1: b[3] }); rect('edge', ...b, 1.4); }

  // Blöcke füllen
  const S = CITY.sidewalk;
  const ave = roads.vx[roads.avenue], avw = roads.vw[roads.avenue] / 2, beach = roads.hz[roads.hz.length - 1], bw = roads.hw[roads.hw.length - 1] / 2;
  for (const bl of blocks) {
    const inner = { x0: bl.x0 + S, x1: bl.x1 - S, z0: bl.z0 + S, z1: bl.z1 - S };
    bl.inner = inner;
    const cx = (inner.x0 + inner.x1) / 2, cz = (inner.z0 + inner.z1) / 2, w = inner.x1 - inner.x0, d = inner.z1 - inner.z0;
    if (bl.type === 'plaza') {
      prop('fountain', cx, cz);
      for (let x = inner.x0 + 3; x <= inner.x1 - 3; x += 11) { prop('palm', x, inner.z0 + 2.5, rng.range(0, 6.28), rng.range(0.85, 1.2)); prop('palm', x, inner.z1 - 2.5, rng.range(0, 6.28), rng.range(0.85, 1.2)); }
      for (const dx of [-9, 9]) { if (Math.abs(dx) + 3 < w / 2) { prop('bench', cx + dx, cz, Math.PI / 2); } }
      for (const dz of [-9, 9]) { if (Math.abs(dz) + 3 < d / 2) prop('bench', cx, cz + dz, 0); }
    } else if (bl.type === 'parking') {
      // Reihen quer, Fahrgassen dazwischen
      const rows = Math.max(1, Math.floor((d - 5) / 13) + 1), step = rows > 1 ? (d - 6) / (rows - 1) : 0;
      for (let k = 0; k < rows; k++) {
        const z = rows > 1 ? inner.z0 + 3 + k * step : cz;
        for (let x = inner.x0 + 2.5; x <= inner.x1 - 2.5; x += 3.4) { world.bays.push({ x, z }); if (rng.chance(0.2)) world.parked.push({ x, z, h: rng.chance(0.5) ? 0 : Math.PI, color: rng.int(0, 7) }); }
      }
    } else {
      const list = []; fillLots(rng, inner, bl.type, list);
      for (const b of list) {
        world.buildings.push(b); rect('building', b.x0, b.z0, b.x1, b.z1, b.h, true);
        // Neonschilder an Straßenseiten
        const faces = [];
        if (Math.abs(b.x0 - inner.x0) < 0.01) faces.push({ nx: -1, nz: 0, x: b.x0, z: (b.z0 + b.z1) / 2, len: b.z1 - b.z0 });
        if (Math.abs(b.x1 - inner.x1) < 0.01) faces.push({ nx: 1, nz: 0, x: b.x1, z: (b.z0 + b.z1) / 2, len: b.z1 - b.z0 });
        if (Math.abs(b.z0 - inner.z0) < 0.01) faces.push({ nx: 0, nz: -1, x: (b.x0 + b.x1) / 2, z: b.z0, len: b.x1 - b.x0 });
        if (Math.abs(b.z1 - inner.z1) < 0.01) faces.push({ nx: 0, nz: 1, x: (b.x0 + b.x1) / 2, z: b.z1, len: b.x1 - b.x0 });
        const p = bl.type === 'shore' ? 0.75 : bl.type === 'old' ? 0.45 : bl.type === 'warehouse' ? 0.15 : 0.35;
        for (const f of faces) {
          if (f.len < 8 || !rng.chance(p)) continue;
          const name = rng.int(0, SIGN_NAMES.length - 1);
          if (b.h > 9 && rng.chance(0.28)) {
            const side = (rng.chance(0.5) ? 1 : -1) * (f.len / 2 - 1.2);
            world.signs.push({ x: f.x + f.nx * 1.15 + Math.abs(f.nz) * side, z: f.z + f.nz * 1.15 + Math.abs(f.nx) * side, y: 6.8, w: 1.9, hgt: 5.4, nx: f.nx, nz: f.nz, name, blade: true });
          } else {
            const sw = Math.min(f.len - 2, rng.range(6.5, 9.5));
            world.signs.push({ x: f.x + f.nx * 0.18, z: f.z + f.nz * 0.18, y: b.floor + 0.55, w: sw, hgt: sw / 4, nx: f.nx, nz: f.nz, name, blade: false });
          }
        }
      }
    }
    // Gehweg: Laternen und Palmen
    const sides = [
      { x0: bl.x0 + 1.1, z0: bl.z0, dx: 0, dz: 1, len: bl.z1 - bl.z0, palm: Math.abs(bl.x0 - (ave + avw)) < 0.01, rot: -Math.PI / 2 },
      { x0: bl.x1 - 1.1, z0: bl.z0, dx: 0, dz: 1, len: bl.z1 - bl.z0, palm: Math.abs(bl.x1 - (ave - avw)) < 0.01, rot: Math.PI / 2 },
      { x0: bl.x0, z0: bl.z0 + 1.1, dx: 1, dz: 0, len: bl.x1 - bl.x0, palm: false, rot: Math.PI },
      { x0: bl.x0, z0: bl.z1 - 1.1, dx: 1, dz: 0, len: bl.x1 - bl.x0, palm: Math.abs(bl.z1 - (beach - bw)) < 0.01, rot: 0 }
    ];
    for (const s of sides) {
      const gap = s.palm ? 14 : 30, n = Math.max(1, Math.floor((s.len - 12) / gap));
      for (let k = 0; k <= n; k++) {
        const t = 6 + k * ((s.len - 12) / n);
        const x = s.x0 + s.dx * t, z = s.z0 + s.dz * t;
        if (s.palm) prop('palm', x, z, rng.range(0, 6.28), rng.range(0.9, 1.25)); else prop('lamp', x, z, s.rot);
      }
    }
  }

  // Strandpromenade
  const shore = beach + bw;
  for (let x = -286; x <= 128; x += 13) prop('palm', x + rng.range(-1.5, 1.5), shore + 6, rng.range(0, 6.28), rng.range(1, 1.35));
  for (let x = -280; x <= 124; x += 19) prop('palm', x + rng.range(-3, 3), MAP.beachZ - 3, rng.range(0, 6.28), rng.range(0.9, 1.3));
  for (let x = -266; x <= 110; x += 62) {
    const kx = Math.round(x + rng.range(-8, 8)), kz = shore + 23;
    const k = { x0: kx - 3.5, x1: kx + 3.5, z0: kz - 2.5, z1: kz + 2.5, type: 'kiosk', color: rng.pick(PALETTES.shore), floor: 3.4, floors: 1, base: 3.4, h: 3.4, style: 4, ground: rng.chance(0.5) ? 4 : 5, roof: rng.int(0, 999999), top: null };
    world.buildings.push(k); rect('building', k.x0, k.z0, k.x1, k.z1, k.h, true);
    world.signs.push({ x: kx, z: k.z0 - 0.18, y: 3.9, w: 6.4, hgt: 1.6, nx: 0, nz: -1, name: rng.int(0, SIGN_NAMES.length - 1), blade: false, roof: true });
    prop('bench', kx + 12, MAP.beachZ - 7, 0); prop('bench', kx - 12, MAP.beachZ - 7, 0);
  }
  for (let x = -284; x <= 130; x += 34) prop('lamp', x, shore + 1.1, 0);
  for (let x = -276; x <= 122; x += 23) prop('planter', x, shore + 14.3);

  // Hafen: Container und Kran
  const colors = ['#c0503c', '#2f7f8f', '#d39a2c', '#5b6c9e', '#4e8a55', '#b9b4a8'];
  const addContainer = (x, z, alongX, level) => {
    const hx = alongX ? 3.05 : 1.25, hz2 = alongX ? 1.25 : 3.05;
    world.containers.push({ x0: x - hx, x1: x + hx, z0: z - hz2, z1: z + hz2, y: level * 2.6, color: rng.pick(colors) });
    if (!level) rect('container', x - hx, z - hz2, x + hx, z + hz2, 2.6, true); else { const c = world.colliders.findLast((o) => o.kind === 'container' && Math.abs(o.x0 - (x - hx)) < 0.01 && Math.abs(o.z0 - (z - hz2)) < 0.01); if (c) c.h = (level + 1) * 2.6; }
  };
  for (let x = 152; x <= 284; x += 19) {
    if (x > 200 && x < 238) continue;                  // Zufahrt zum Steg
    const z = shore + 15 + rng.range(-1, 1), stack = rng.int(1, 3);
    for (let l = 0; l < stack; l++) addContainer(x, z, true, l);
    if (rng.chance(0.65)) { const s2 = rng.int(1, 2); for (let l = 0; l < s2; l++) addContainer(x, z + 2.55, true, l); }
  }
  world.crane = { x: 262, z: MAP.harbourZ - 6 };
  for (const dx of [-6, 6]) for (const dz of [-4, 4]) rect('crane', world.crane.x + dx - 0.6, world.crane.z + dz - 0.6, world.crane.x + dx + 0.6, world.crane.z + dz + 0.6, 20);
  for (let z = MAP.harbourZ + 8; z < MAP.pierZ1 - 4; z += 12) { circ('bollard', MAP.pierX0 + 0.8, z, 0.3, 0.9); circ('bollard', MAP.pierX1 - 0.8, z, 0.3, 0.9); world.props.push({ kind: 'bollard', x: MAP.pierX0 + 0.8, z, rot: 0, s: 1 }, { kind: 'bollard', x: MAP.pierX1 - 0.8, z, rot: 0, s: 1 }); }
  for (let x = 146; x <= 290; x += 9) { if (x > MAP.pierX0 - 2 && x < MAP.pierX1 + 2) continue; circ('bollard', x, MAP.harbourZ - 0.9, 0.3, 0.9); world.props.push({ kind: 'bollard', x, z: MAP.harbourZ - 0.9, rot: 0, s: 1 }); }

  // Startpunkt an der Strandallee
  const sx = ave + 38;
  world.spawn = { car: { x: sx, z: beach + bw - 1.35, h: Math.PI / 2 }, player: { x: sx - 4.2, z: beach + bw + 1.9, h: Math.PI / 2 } };

  // Geparkte Autos am Straßenrand
  const clearOfParked = (x, z) => world.parked.every((p) => Math.hypot(p.x - x, p.z - z) > 8) && Math.hypot(world.spawn.car.x - x, world.spawn.car.z - z) > 22;
  const target = world.parked.length + CITY.curbCars;
  for (let tries = 0; tries < 900 && world.parked.length < target; tries++) {
    const s = rng.pick(roads.segs), len = s.dir === 'h' ? s.bx - s.ax : s.bz - s.az;
    if (len < 44) continue;
    const t = rng.range(18, len - 18), side = rng.chance(0.5) ? 1 : -1, off = side * (s.w / 2 - 1.3);
    const x = s.dir === 'h' ? s.ax + t : s.ax + off, z = s.dir === 'h' ? s.az + off : s.az + t;
    if (!clearOfParked(x, z)) continue;
    world.parked.push({ x, z, h: s.dir === 'h' ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? Math.PI : 0), color: rng.int(0, 7) });
  }

  buildGrid(world);
  return world;
}

/* ---------- Kollision ---------- */
const cellIndex = (v) => Math.max(0, Math.min(GRID_N - 1, Math.floor((v - GRID_FROM) / CELL)));
function buildGrid(world) {
  const grid = Array.from({ length: GRID_N * GRID_N }, () => []);
  world.colliders.forEach((c, k) => {
    const x0 = c.t ? c.x - c.r : c.x0, x1 = c.t ? c.x + c.r : c.x1, z0 = c.t ? c.z - c.r : c.z0, z1 = c.t ? c.z + c.r : c.z1;
    for (let j = cellIndex(z0); j <= cellIndex(z1); j++) for (let i = cellIndex(x0); i <= cellIndex(x1); i++) grid[j * GRID_N + i].push(k);
    c.stamp = 0;
  });
  Object.defineProperty(world, 'grid', { value: grid, enumerable: false });
  world.stamp = 0;
}
export function forColliders(world, x0, z0, x1, z1, fn) {
  const stamp = ++world.stamp;
  const i0 = cellIndex(x0), i1 = cellIndex(x1), j1 = cellIndex(z1);
  for (let j = cellIndex(z0); j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const list = world.grid[j * GRID_N + i];
    for (let n = 0; n < list.length; n++) { const c = world.colliders[list[n]]; if (c.stamp !== stamp) { c.stamp = stamp; fn(c); } }
  }
}

// Berührung Kreis gegen Hindernis. Schreibt in out und gibt die Eindringtiefe zurück (0 = frei).
export function touch(c, x, z, r, out) {
  if (c.t) {
    const dx = x - c.x, dz = z - c.z, sum = r + c.r, d2 = dx * dx + dz * dz;
    if (d2 >= sum * sum) return 0;
    const d = Math.sqrt(d2);
    out.nx = d > 1e-6 ? dx / d : 1; out.nz = d > 1e-6 ? dz / d : 0; out.depth = sum - d; return out.depth;
  }
  const cx = x < c.x0 ? c.x0 : x > c.x1 ? c.x1 : x, cz = z < c.z0 ? c.z0 : z > c.z1 ? c.z1 : z;
  const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return 0;
  if (d2 > 1e-10) { const d = Math.sqrt(d2); out.nx = dx / d; out.nz = dz / d; out.depth = r - d; return out.depth; }
  const l = x - c.x0, rr = c.x1 - x, t = z - c.z0, b = c.z1 - z, m = Math.min(l, rr, t, b);
  out.nx = m === l ? -1 : m === rr ? 1 : 0; out.nz = out.nx ? 0 : m === t ? -1 : 1; out.depth = m + r; return out.depth;
}

const tmp = { nx: 0, nz: 0, depth: 0 };
// Tiefste Berührung mit festen Hindernissen; out wird gefüllt.
export function deepest(world, x, z, r, out) {
  let best = 0;
  forColliders(world, x - r, z - r, x + r, z + r, (c) => { const d = touch(c, x, z, r, tmp); if (d > best) { best = d; out.nx = tmp.nx; out.nz = tmp.nz; out.depth = d; out.c = c; } });
  return best;
}
export function isFree(world, x, z, r) { return deepest(world, x, z, r, {}) <= 0; }

// Schneidet die Strecke ein Rechteck-Hindernis? (Durchtunneln erkennen)
function segRect(ax, az, bx, bz, c) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  if (Math.abs(dx) < 1e-12) { if (ax <= c.x0 || ax >= c.x1) return false; }
  else { let a = (c.x0 - ax) / dx, b = (c.x1 - ax) / dx; if (a > b) { const s = a; a = b; b = s; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
  if (Math.abs(dz) < 1e-12) { if (az <= c.z0 || az >= c.z1) return false; }
  else { let a = (c.z0 - az) / dz, b = (c.z1 - az) / dz; if (a > b) { const s = a; a = b; b = s; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
  return t0 < t1;
}
export function crossesSolid(world, ax, az, bx, bz) {
  let hit = false;
  forColliders(world, Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), (c) => { if (!hit && !c.t && segRect(ax, az, bx, bz, c)) hit = true; });
  return hit;
}

// Waagrechter Abstand (quadratisch gemessen) zum nächsten hohen Hindernis
export function occluderGap(world, x, z, max) {
  let best = max;
  forColliders(world, x - max, z - max, x + max, z + max, (c) => { if (c.occlude) best = Math.min(best, Math.max(c.x0 - x, x - c.x1, c.z0 - z, z - c.z1)); });
  return best;
}

// Anteil (0..1) der freien Sicht von A nach B gegen hohe Hindernisse, mit Abstandspolster.
export function clearFraction(world, ax, ay, az, bx, by, bz, pad) {
  let best = 1;
  const d = [bx - ax, by - ay, bz - az], o = [ax, ay, az];
  forColliders(world, Math.min(ax, bx) - pad, Math.min(az, bz) - pad, Math.max(ax, bx) + pad, Math.max(az, bz) + pad, (c) => {
    if (!c.occlude) return;
    const lo = [c.x0 - pad, -1, c.z0 - pad], hi = [c.x1 + pad, c.h + pad, c.z1 + pad];
    let t0 = 0, t1 = 1;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(d[k]) < 1e-9) { if (o[k] <= lo[k] || o[k] >= hi[k]) return; continue; }
      let a = (lo[k] - o[k]) / d[k], b = (hi[k] - o[k]) / d[k]; if (a > b) { const s = a; a = b; b = s; }
      if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) return;
    }
    if (t0 < best) best = t0;
  });
  return best;
}

// Nächster Punkt auf dem Straßennetz (Fahrbahnmitte der rechten Spur).
export function roadPoses(world, x, z) {
  const out = [];
  for (const s of world.roads.segs) {
    const h = s.dir === 'h';
    const t = Math.max(6, Math.min((h ? s.bx - s.ax : s.bz - s.az) - 6, h ? x - s.ax : z - s.az));
    for (const shift of [0, -14, 14]) {
      const u = Math.max(6, Math.min((h ? s.bx - s.ax : s.bz - s.az) - 6, t + shift));
      for (const dir of [1, -1]) {
        const heading = h ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
        const px = (h ? s.ax + u : s.ax) - Math.cos(heading) * s.w / 4, pz = (h ? s.az : s.az + u) + Math.sin(heading) * s.w / 4;
        out.push({ x: px, z: pz, h: heading, d: Math.hypot(px - x, pz - z) });
      }
    }
  }
  return out.sort((a, b) => a.d - b.d);
}
export { CAR };
