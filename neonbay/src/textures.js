// Alle Bilder entstehen zur Laufzeit auf einer Zeichenfläche (keine Dateien).
import * as THREE from '../vendor/three.module.js';
import { createRng } from './rng.js';
import { SIGN_NAMES } from './world.js';

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function texture(c, repeatS) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeatS) t.wrapS = THREE.RepeatWrapping;
  return t;
}

// Fassadenstreifen: 8 Streifen zu je 64 px, jeder zeigt ein Stockwerk mit 8 Achsen (24 m).
export const STRIPS = 8;
export function facadeTextures() {
  const rng = createRng(4711), a = canvas(512, 512), e = canvas(512, 512), g = a.getContext('2d'), l = e.getContext('2d');
  l.fillStyle = '#000'; l.fillRect(0, 0, 512, 512);
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const win = (x, y, w, h, dark, litChance, warm) => {
    const lit = rng.chance(litChance);
    const grad = g.createLinearGradient(x, y, x + w * 0.4, y + h);
    if (lit) { grad.addColorStop(0, '#ffe3a0'); grad.addColorStop(1, '#e8a860'); } else { grad.addColorStop(0, dark[0]); grad.addColorStop(1, dark[1]); }
    R(x, y, w, h, grad);
    if (lit) { l.fillStyle = warm || rng.pick(['#b9843c', '#a86a30', '#8f7a52', '#6f8aa0']); l.fillRect(x + 1, y + 1, w - 2, h - 2); }
    else if (rng.chance(0.3)) { g.fillStyle = 'rgba(255,190,150,.22)'; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + w, y); g.lineTo(x + w, y + h * 0.45); g.lineTo(x + w * 0.5, y + h); g.fill(); }
  };
  for (let s = 0; s < STRIPS; s++) {
    const y = s * 64;
    R(0, y, 512, 64, s === 0 ? '#9db4c4' : s === 3 ? '#cfc8c0' : s === 6 ? '#ffffff' : '#f4efe8');
    if (s === 6) continue;
    if (s === 3) for (let x = 0; x < 512; x += 8) { R(x, y, 3, 64, 'rgba(0,0,0,.14)'); R(x + 3, y, 2, 64, 'rgba(255,255,255,.18)'); }
    for (let b = 0; b < 8; b++) {
      const x = b * 64;
      if (s === 0) { win(x + 2, y + 5, 29, 52, ['#5b86a8', '#2c4a66'], 0.2); win(x + 33, y + 5, 29, 52, ['#5b86a8', '#2c4a66'], 0.2); R(x, y + 58, 64, 6, '#d9e2e8'); }
      if (s === 1) { R(x + 17, y + 11, 30, 42, '#ffffff'); win(x + 20, y + 14, 24, 36, ['#46566f', '#232c3e'], 0.28); R(x + 31, y + 14, 2, 36, '#e8e2da'); R(x + 9, y + 12, 7, 40, '#5f8f8a'); R(x + 48, y + 12, 7, 40, '#5f8f8a'); R(x + 15, y + 53, 34, 4, '#c9bdb0'); R(x, y + 61, 64, 3, '#d8cfc4'); }
      if (s === 2) { win(x + 8, y + 9, 48, 46, ['#4e6580', '#26344a'], 0.3); R(x + 31, y + 9, 2, 46, '#f4efe8'); R(x + 2, y + 40, 60, 3, '#ffffff'); for (let k = 4; k < 62; k += 7) R(x + k, y + 42, 2, 18, '#fbf7f0'); R(x + 1, y + 58, 62, 5, '#b8aea6'); }
      if (s === 3) { if (b % 4 === 1) { R(x + 6, y + 8, 52, 56, '#7b6f68'); for (let k = 12; k < 64; k += 7) R(x + 6, y + k, 52, 2, '#5d534e'); R(x + 4, y + 6, 56, 3, '#e8b23c'); } else win(x + 14, y + 8, 36, 14, ['#56646e', '#313b44'], 0.2); }
      if (s === 4) { R(x, y, 64, 64, '#e9ded2'); win(x + 4, y + 17, 56, 41, ['#4c5a70', '#232b3c'], 0.8, '#c98f48'); for (let k = 0; k < 4; k++) R(x + 8 + k * 13, y + 40 + rng.int(-4, 4), 9, 18, 'rgba(60,40,50,.55)'); R(x, y + 5, 64, 10, '#2c2438'); for (let k = 8; k < 56; k += 9) R(x + k, y + 8, 5, 4, rng.pick(['#ff7ac0', '#5fe0d0', '#ffd36a'])); R(x + 31, y + 17, 2, 41, '#e9ded2'); }
      if (s === 5) { R(x, y, 64, 64, '#f1e8dc'); if (b % 3 === 2) { R(x + 18, y + 18, 28, 46, '#4a3b52'); win(x + 22, y + 22, 20, 28, ['#51607a', '#28304a'], 0.7); } else win(x + 6, y + 22, 52, 34, ['#4a586e', '#222a3a'], 0.65, '#b57f50'); for (let k = 0; k < 64; k += 16) { R(x + k, y + 3, 8, 15, '#e0656a'); R(x + k + 8, y + 3, 8, 15, '#fff6ec'); } R(x, y + 18, 64, 3, 'rgba(0,0,0,.28)'); }
      if (s === 7) { win(x, y + 16, 31, 32, ['#587791', '#2a3f58'], 0.24); win(x + 33, y + 16, 31, 32, ['#587791', '#2a3f58'], 0.24); R(x, y + 50, 64, 3, '#cdc4ba'); }
    }
  }
  return { map: texture(a, true), emissive: texture(e, true) };
}
// v-Bereich eines Streifens (Textur steht kopf: oben = 1)
export const stripV = (s) => [1 - ((s + 1) * 64 - 1.5) / 512, 1 - (s * 64 + 1.5) / 512];

const NEON = ['#ff4fa3', '#37e6e0', '#ffd23f', '#9d7bff', '#ff7a3d', '#5cff9a'];
// 16 erfundene Neonschilder in zwei Spalten
export function signTexture() {
  const c = canvas(1024, 1024), g = c.getContext('2d');
  SIGN_NAMES.forEach((name, i) => {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 128, neon = NEON[i % NEON.length], second = NEON[(i + 2) % NEON.length];
    g.fillStyle = ['#1b1030', '#101a33', '#2a0f2a', '#0e2230'][i % 4]; g.fillRect(x, y, 512, 128);
    g.save(); g.shadowColor = second; g.shadowBlur = 16; g.strokeStyle = second; g.lineWidth = 5; g.strokeRect(x + 12, y + 12, 488, 104); g.restore();
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
    const font = ['italic 900 ', '900 ', 'bold ', 'italic bold '][i % 4];
    let size = 70; do { g.font = font + size + 'px ' + (i % 3 ? '"Segoe UI", Arial, sans-serif' : 'Georgia, serif'); size -= 2; } while (g.measureText(name).width > 440);
    g.shadowColor = neon; g.shadowBlur = 22; g.fillStyle = neon; g.fillText(name, x + 256, y + 66); g.fillText(name, x + 256, y + 66);
    g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.72)'; g.fillText(name, x + 256, y + 66);
    g.globalAlpha = 0.55; g.fillStyle = neon; g.fillText(name, x + 256, y + 66);
    g.restore();
  });
  const t = texture(c); t.anisotropy = 8; return t;
}
export const signUv = (i) => { const x = (i % 2) * 0.5, y = 1 - (Math.floor(i / 2) + 1) / 8; return [x + 0.004, y + 0.002, x + 0.496, y + 0.123]; };

// Bodenbild: weiche Abendschatten und feine Körnung über die ganze Karte (UV = Kartenposition)
export const SUN = (() => { const v = [-0.62, 0.36, 0.7], l = Math.hypot(...v); return v.map((k) => k / l); })();
export function groundTexture(world, size = 1024) {
  const c = canvas(size, size), g = c.getContext('2d'), s = size / 600, rng = createRng(88);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 14; i++) { g.fillStyle = rng.chance(0.5) ? 'rgba(40,20,40,.05)' : 'rgba(0,0,0,.025)'; const r = rng.range(1, 3.5); g.fillRect(rng() * size, rng() * size, r, r); }
  const layer = canvas(size, size), q = layer.getContext('2d'); q.fillStyle = '#000';
  const X = (x) => (x + 300) * s, Z = (z) => (z + 300) * s;
  // alle Schatten in eine Ebene, damit sie sich nicht aufaddieren
  const sx = -SUN[0] / SUN[1] * 0.55, sz = -SUN[2] / SUN[1] * 0.55;
  const cast = (r, h) => {
    const dx = sx * Math.min(h, 30), dz = sz * Math.min(h, 30);
    const p = [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]], all = p.concat(p.map(([x, z]) => [x + dx, z + dz])).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), hull = [];
    for (const list of [all, all.slice().reverse()]) { const part = []; for (const pt of list) { while (part.length > 1 && cross(part[part.length - 2], part[part.length - 1], pt) <= 0) part.pop(); part.push(pt); } part.pop(); hull.push(...part); }
    q.beginPath(); hull.forEach(([x, z], i) => (i ? q.lineTo(X(x), Z(z)) : q.moveTo(X(x), Z(z)))); q.closePath(); q.fill();
  };
  for (const b of world.buildings) cast(b, b.h);
  for (const k of world.containers) cast(k, k.y + 2.6);
  for (const p of world.props) if (p.kind === 'palm') { q.beginPath(); q.ellipse(X(p.x + sx * 6), Z(p.z + sz * 6), 2.4 * s, 1.6 * s, 0.8, 0, 7); q.fill(); q.lineWidth = 0.5 * s; q.beginPath(); q.moveTo(X(p.x), Z(p.z)); q.lineTo(X(p.x + sx * 6), Z(p.z + sz * 6)); q.strokeStyle = '#000'; q.stroke(); }
  g.globalAlpha = 0.34; g.filter = 'blur(1.2px)'; g.drawImage(layer, 0, 0); g.filter = 'none'; g.globalAlpha = 1;
  // dunkler Saum direkt an den Gebäuden
  g.strokeStyle = 'rgba(30,10,40,.22)'; g.lineWidth = 2.4 * s; for (const b of world.buildings) g.strokeRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * s, (b.z1 - b.z0) * s);
  const t = texture(c); t.anisotropy = 4; return t;
}

// Graustufen-Maske für weiche Bodenschatten
export function shadowMask() {
  const c = canvas(128, 128), g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
  g.filter = 'blur(12px)'; g.fillStyle = '#fff'; g.beginPath(); g.roundRect(26, 22, 76, 84, 30); g.fill();
  return new THREE.CanvasTexture(c);
}

export function dotTexture(inner = 0.1) {
  const c = canvas(64, 64), g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 32 * inner, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
