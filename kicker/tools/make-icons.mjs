// Erzeugt die eigenen Symbole mit einem unsichtbaren Chrome (Canvas).   node tools/make-icons.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || (process.env.PROGRAMFILES || '/usr/bin') + (process.env.PROGRAMFILES ? '/Google/Chrome/Application/chrome.exe' : '/google-chrome'), headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
fs.mkdirSync(new URL('../icons/', import.meta.url), { recursive: true });
for (const size of [192, 512]) {
  const data = await page.evaluate((size) => {
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); g.scale(size / 512, size / 512);
    const bg = g.createRadialGradient(256, 230, 30, 256, 256, 380); bg.addColorStop(0, '#2a1f6e'); bg.addColorStop(1, '#07071f'); g.fillStyle = bg; g.fillRect(0, 0, 512, 512);
    const glow = (color, blur) => { g.shadowColor = color; g.shadowBlur = (blur * size) / 512; };
    const box = (color, x, y, w, h, r) => { g.fillStyle = color; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
    glow('#7c6cff', 30); g.strokeStyle = '#7c6cff'; g.lineWidth = 10; g.beginPath(); g.roundRect(40, 40, 432, 432, 58); g.stroke();
    glow('#9fb4ff', 14); box('#c9d4ff', 66, 160, 380, 30, 15);                       // Stange
    glow('#22d3ee', 34); g.fillStyle = '#22d3ee'; g.beginPath(); g.arc(196, 110, 42, 0, 7); g.fill();
    box('#22d3ee', 146, 146, 100, 138, 28); box('#22d3ee', 168, 276, 56, 80, 10); box('#aef2ff', 142, 346, 108, 46, 20);
    glow('#ffa53d', 18); g.strokeStyle = 'rgba(255,165,61,.85)'; g.lineCap = 'round'; g.lineWidth = 13;
    for (const [x, y, len] of [[330, 300, 60], [352, 322, 90], [388, 348, 54]]) { g.beginPath(); g.moveTo(x + 40, y - 40); g.lineTo(x + 40 + len * 0.55, y - 40 - len * 0.55); g.stroke(); }
    glow('#ffd34d', 50); g.fillStyle = '#ffe680'; g.beginPath(); g.arc(334, 354, 52, 0, 7); g.fill();
    glow('#ff4fa3', 24); box('#ff4fa3', 130, 420, 252, 16, 8);
    return c.toDataURL('image/png').split(',')[1];
  }, size);
  fs.writeFileSync(new URL('../icons/icon-' + size + '.png', import.meta.url), Buffer.from(data, 'base64'));
  console.log('icons/icon-' + size + '.png');
}
await browser.close();
