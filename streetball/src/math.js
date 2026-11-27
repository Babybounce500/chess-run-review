// Kleine Rechenhilfen für Logik und Darstellung.
import { HOOP } from './config.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const hyp = (x, y) => Math.sqrt(x * x + y * y);
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const hoopDist = (x, z) => hyp(x - HOOP.x, z - HOOP.z);
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
export const angleStep = (from, to, max) => wrap(from + clamp(wrap(to - from), -max, max));
export const angleLerp = (a, b, t) => wrap(a + wrap(b - a) * t);
// Blickwinkel 0 zeigt nach +z; Seitenvektor = lokale x-Achse der Figur
export const forward = (f) => [Math.sin(f), Math.cos(f)];
export const sideVec = (f) => [Math.cos(f), -Math.sin(f)];
// Zufall aus dem Zustand (Feld rng bzw. airng)
export function rand(s, key = 'rng') { s[key] = (Math.imul(s[key] || 1, 48271) >>> 0) % 2147483647 || 1; return s[key] / 2147483647; }
