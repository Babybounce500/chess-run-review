// Leistungsmessung in headless Chrome mit echter Grafikkarte: node tests/perf-test.mjs
// Sucht die dichteste Stelle der Stadt und misst dort Zeichenaufrufe und Bildrate. Ziel: < 150 Aufrufe, ≥ 45 Bilder/s.
import { createRequire } from 'node:module';
import { harness } from './harness.mjs';
const require = createRequire(import.meta.url);
const T = await harness();
const { ok, sleep, shot } = T;

const set = (p, patch) => p.evaluate((x) => window.__test.set(x), patch);
const measure = async (p, ms) => {
  await p.evaluate(() => window.__test.frames()); await sleep(ms);
  const f = await p.evaluate(() => window.__test.frames()), sorted = f.slice().sort((a, b) => a - b), sum = f.reduce((a, b) => a + b, 0);
  return { frames: f.length, fps: +(1000 * f.length / sum).toFixed(1), p50: +sorted[f.length >> 1].toFixed(1), p95: +sorted[Math.floor(f.length * 0.95)].toFixed(1), p99: +sorted[Math.floor(f.length * 0.99)].toFixed(1), slow: +(f.filter((x) => x > 1000 / 45 + 0.5).length / f.length * 100).toFixed(1) };
};
// jede Kreuzung und jede Straßenmitte, vier Blickrichtungen
const scan = (p) => p.evaluate(async () => {
  const w = window.__test.world(), spots = [];
  for (const n of w.roads.nodes) spots.push([n.x, n.z]);
  for (const s of w.roads.segs) spots.push([(s.ax + s.bx) / 2, (s.az + s.bz) / 2]);
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const out = [];
  for (const [x, z] of spots) for (let k = 0; k < 4; k++) {
    const h = k * Math.PI / 2;
    window.__test.set({ mode: 'car', car: { x, z, h, vx: 0, vz: 0, w: 0 }, yaw: h }); await frame(); await frame();
    const v = window.__game.view(); out.push({ x, z, h, calls: v.calls, tris: v.triangles });
  }
  return out;
});

async function run(label, viewport, quality, required) {
  const p = await T.open(viewport, '?test&nosw');
  await p.evaluate((q) => localStorage.setItem('neonbay_quality', q), quality); await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__game);
  await p.click('#btnPlay'); await sleep(2500);
  const info = await p.evaluate(() => window.__game.view());
  console.log(`\n${label}: ${viewport.width}×${viewport.height} @${viewport.deviceScaleFactor || 1}, Stufe ${info.quality}, gerendert ${info.size.join('×')}`);
  console.log('    Grafik: ' + info.gpu);
  const all = await scan(p);
  const byCalls = all.slice().sort((a, b) => b.calls - a.calls), byTris = all.slice().sort((a, b) => b.tris - a.tris);
  console.log(`    ${all.length} Blickpunkte: Zeichenaufrufe höchstens ${byCalls[0].calls} (Median ${byCalls[all.length >> 1].calls}), Dreiecke höchstens ${byTris[0].tris} (Median ${byTris[all.length >> 1].tris})`);
  ok(label + ': unter 150 Zeichenaufrufe an jedem Blickpunkt', byCalls[0].calls < 150, byCalls[0]);
  const spots = [...byTris.slice(0, 3), ...byCalls.slice(0, 2)]; let worst = null;
  for (const s of spots) {
    await set(p, { mode: 'car', car: { x: s.x, z: s.z, h: s.h, vx: 0, vz: 0, w: 0 }, yaw: s.h }); await sleep(600);
    const m = await measure(p, 5000);
    console.log(`    dichte Stelle (${s.x.toFixed(0)} | ${s.z.toFixed(0)}), ${s.calls} Aufrufe, ${s.tris} Dreiecke: ${m.fps} Bilder/s, Bildzeit p50 ${m.p50} / p95 ${m.p95} / p99 ${m.p99} ms, ${m.slow} % langsamer als 45/s`);
    if (!worst || m.fps < worst.fps) worst = m;
  }
  await shot(p, 'P-dichteste-' + label.replace(/\W+/g, '-'));
  // Fahrt mit Tempo, Drift und Qualm über die breite Allee
  const ax = await p.evaluate(() => { const r = window.__test.world().roads; return r.vx[r.avenue]; });
  await set(p, { mode: 'car', car: { x: ax - 4, z: 170, h: Math.PI, vx: 0, vz: -10, w: 0 }, yaw: Math.PI });
  await p.keyboard.down('KeyW'); await p.evaluate(() => window.__test.frames()); const t = measure(p, 9000);
  for (let i = 0; i < 6; i++) { await sleep(1000); await p.keyboard.down(i % 2 ? 'KeyA' : 'KeyD'); await sleep(180); if (i === 3) await p.keyboard.down('Space'); await sleep(200); await p.keyboard.up('Space'); await p.keyboard.up(i % 2 ? 'KeyA' : 'KeyD'); }
  const drive = await t; await p.keyboard.up('KeyW');
  console.log(`    Fahrt auf der Allee: ${drive.fps} Bilder/s, p95 ${drive.p95} ms, p99 ${drive.p99} ms, ${drive.slow} % langsame Bilder`);
  if (required) { ok(label + ': mindestens 45 Bilder/s an der dichtesten Stelle', worst.fps >= 45, worst); ok(label + ': mindestens 45 Bilder/s beim Fahren', drive.fps >= 45, drive); }
  ok(label + ': fehlerfrei', !p.errors.length, p.errors);
  await p.browserContext().close();
  return { spot: byTris[0], calls: byCalls[0].calls };
}

try {
  const main = await run('PC hoch', { width: 1280, height: 720 }, 'high', true);
  await run('Handy-Ansicht mittel', { width: 390, height: 844, deviceScaleFactor: 3 }, 'medium', true);
  await run('Full HD hoch (nur Info)', { width: 1920, height: 1080 }, 'high', false);
  await run('Full HD niedrig (nur Info)', { width: 1920, height: 1080 }, 'low', false);
  // Reserve: ohne Bildratenbegrenzung
  const puppeteer = require('puppeteer-core');
  const free = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-frame-rate-limit', '--disable-gpu-vsync'] });
  try {
    const p = await free.newPage(); await p.setViewport({ width: 1280, height: 720 }); await p.goto(T.base + '?test&nosw', { waitUntil: 'load' }); await p.waitForFunction(() => window.__game); await p.evaluate(() => localStorage.setItem('neonbay_quality', 'high')); await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__game); await p.click('#btnPlay'); await sleep(1500);
    const s = main.spot; await set(p, { mode: 'car', car: { x: s.x, z: s.z, h: s.h, vx: 0, vz: 0, w: 0 }, yaw: s.h }); await sleep(600);
    // Bildzeit samt Grafikkarte: nach jedem Bild einen Bildpunkt zurücklesen erzwingt das Fertigrechnen
    const gpu = await p.evaluate(async () => { const c = document.querySelector('#stage canvas'), gl = c.getContext('webgl2'), px = new Uint8Array(4), times = []; let last = performance.now(); for (let i = 0; i < 240; i++) { await new Promise((r) => requestAnimationFrame(() => { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); r(); })); const now = performance.now(); times.push(now - last); last = now; } times.splice(0, 20); times.sort((a, b) => a - b); const avg = times.reduce((a, b) => a + b, 0) / times.length; return { fps: +(1000 / avg).toFixed(1), p95: +times[Math.floor(times.length * 0.95)].toFixed(1) }; });
    console.log(`\nReserve (1280×720 hoch, ohne Begrenzung, dichteste Stelle): ${gpu.fps} Bilder/s, p95 ${gpu.p95} ms`);
  } finally { await free.close(); }
} catch (e) { T.abort(e); }
await T.done();
