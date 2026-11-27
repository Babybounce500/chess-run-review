// Erzeugt die App-Symbole auf einer Zeichenfläche in Chrome (headless). Aufruf: node tools/make-icons.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
for (const size of [192, 512]) {
  const data = await page.evaluate((size) => {
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); g.scale(size / 512, size / 512);
    const sky = g.createLinearGradient(0, 0, 0, 340); sky.addColorStop(0, '#2c2468'); sky.addColorStop(0.55, '#d8588a'); sky.addColorStop(1, '#ffab63'); g.fillStyle = sky; g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(256, 270, 120, 0, 7); g.fill();
    g.fillStyle = '#e9805f'; for (const [y, h] of [[270, 6], [296, 9], [324, 12]]) g.fillRect(120, y, 272, h);
    g.fillStyle = '#241341'; for (const [x, w, h] of [[0, 70, 190], [62, 54, 130], [112, 40, 90], [356, 48, 100], [398, 62, 170], [456, 56, 120]]) g.fillRect(x, 352 - h, w, h);
    g.fillStyle = '#1b5877'; g.fillRect(0, 350, 512, 162); g.fillStyle = '#ffb877'; for (let i = 0; i < 7; i++) g.fillRect(256 - 100 + i * 12, 364 + i * 20, 200 - i * 24, 6);
    // Palme
    g.strokeStyle = '#150a28'; g.lineCap = 'round'; g.lineWidth = 16; g.beginPath(); g.moveTo(104, 360); g.quadraticCurveTo(116, 240, 150, 160); g.stroke(); g.lineWidth = 12;
    for (const [dx, dy] of [[-90, 30], [-74, -34], [-10, -66], [62, -40], [86, 22]]) { g.beginPath(); g.moveTo(150, 160); g.quadraticCurveTo(150 + dx * 0.5, 160 + dy - 30, 150 + dx, 160 + dy); g.stroke(); }
    g.textAlign = 'center'; g.font = 'italic 900 92px "Segoe UI", Arial'; g.shadowBlur = 26;
    g.shadowColor = '#37e6e0'; g.fillStyle = '#dffffd'; g.fillText('NEON', 256, 416); g.shadowColor = '#ff2f7e'; g.fillStyle = '#ffd9ea'; g.fillText('BAY', 256, 488);
    return c.toDataURL('image/png').split(',')[1];
  }, size);
  fs.writeFileSync(new URL('../icons/icon-' + size + '.png', import.meta.url), Buffer.from(data, 'base64'));
}
await browser.close();
console.log('Symbole erzeugt');
