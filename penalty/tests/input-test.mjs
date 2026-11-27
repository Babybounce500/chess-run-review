// Wischgesten ohne Browser:  node tests/input-test.mjs
import { swipeToShot } from '../src/input.js';
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  -> ' + JSON.stringify(x) : '')); } };
for (const size of [{ w: 390, h: 844 }, { w: 1280, h: 720 }, { w: 844, h: 390 }]) {
  const u = Math.min(size.w * 1.25, size.h);
  const sw = (dx, dy, ms, bend = 0, steps = 12, hold = 0) => { const p = []; for (let i = 0; i <= steps; i++) { const k = i / steps; p.push({ x: size.w / 2 + (dx * k + Math.sin(k * Math.PI) * bend) * u, y: size.h * 0.8 - dy * k * u, t: 1000 + ms * k }); } if (hold) p.push({ ...p[p.length - 1], t: 1000 + ms + hold }); return swipeToShot(p, size); };
  const n = size.w + 'x' + size.h + ': ';
  ok(n + 'rechts oben zielt rechts', sw(0.15, 0.25, 150).aimX > 0.4);
  ok(n + 'weiter wischen zielt höher', sw(0, 0.34, 180).aimY > sw(0, 0.18, 180).aimY + 0.3);
  ok(n + 'schneller wischen gibt mehr Kraft', sw(0, 0.25, 90).power > sw(0, 0.25, 320).power + 0.3, [sw(0, 0.25, 90).power, sw(0, 0.25, 320).power]);
  ok(n + 'Tempo für die grüne Zone gut erreichbar (0,25 in 130 ms)', sw(0, 0.25, 130).power > 0.5 && sw(0, 0.25, 130).power < 0.85, sw(0, 0.25, 130).power);
  ok(n + 'Zögern vor dem Loslassen kostet keine Kraft', Math.abs(sw(0, 0.25, 130, 0, 12, 400).power - sw(0, 0.25, 130).power) < 0.02);
  ok(n + 'Bogen gibt Effet in Bogenrichtung', sw(0, 0.25, 150, 0.08).curve > 0.4 && sw(0, 0.25, 150, -0.08).curve < -0.4);
  ok(n + 'gerader Wisch ohne Effet', sw(0.1, 0.25, 150).curve === 0);
  ok(n + 'nach unten oder Tipp ist kein Schuss', sw(0, -0.2, 100) === null && sw(0, 0.01, 100) === null);
}
console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
