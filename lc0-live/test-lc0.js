// Test der Lc0-Seite (Server muss laufen):  NODE_PATH=<puppeteer-core> node test-lc0.js [basis-url]
const puppeteer = require('puppeteer-core');
const BASE = process.argv[2] || 'http://localhost:8791/';
let fails = 0, passes = 0; const ok = (c, m) => { if (c) { passes++; console.log('ok  ', m); } else { fails++; console.error('FAIL', m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PGN = '1. d4 d6 2. Nf3 f5 3. e3 g6 4. Bd3 Bg7 5. c4 Nf6 6. Bd2 O-O 7. Bc3 Nc6 8. O-O e5 9. d5 Ne7 10. Bc2 e4 11. Nfd2 Ng4 12. h3 Bxc3 13. Nxc3 Ne5 *';
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'].concat(process.env.LNA_OFF ? ['--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights'] : []) });
  const page = await browser.newPage(); await page.setViewport({ width: 1100, height: 900 });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  const S = () => page.evaluate(() => window.__lc0.state);
  const waitFor = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await page.evaluate(fn)) return true; await sleep(150); } return false; };
  const click = (sq) => page.evaluate((s) => document.querySelector(`.sq[data-sq="${s}"]`).click(), sq);

  ok(await page.evaluate(() => document.querySelectorAll('#board .sq').length === 64), 'Brett hat 64 Felder');
  ok(await page.evaluate(() => document.querySelector('.sq[data-sq="a1"]').classList.contains('d') && document.querySelector('.sq[data-sq="h1"]').classList.contains('l')), 'Feldfarben: a1 dunkel, h1 hell');
  ok(await page.evaluate(() => document.querySelectorAll('#net option').length === 4), 'Vier Netze wählbar');

  // Spielen als Weiß
  await click('e2'); ok(await page.evaluate(() => document.querySelectorAll('.sq.tg').length === 2), 'e2 markiert zwei Zielfelder');
  await click('e4'); ok((await S()).mv.length >= 1, 'Zug e4 gespielt');
  ok(await waitFor(() => window.__lc0.state.mv.length === 2 && !window.__lc0.state.busy), 'Lc0 antwortet mit einem Zug (' + (await S()).mv.map((m) => m.san).join(' ') + ')');
  await click('e2'); ok(await page.evaluate(() => document.querySelectorAll('.sq.tg').length === 0), 'Kein Zug für leeres Feld');
  // zurücknehmen
  await page.evaluate(() => document.querySelector('#bUndo').click()); ok((await S()).mv.length === 0, 'Zurücknehmen nimmt beide Züge zurück');
  // als Schwarz
  await page.evaluate(() => { document.querySelector('#pcol').value = 'b'; document.querySelector('#bNew').click(); });
  ok(await waitFor(() => window.__lc0.state.mv.length === 1 && !window.__lc0.state.busy), 'Als Schwarz zieht Lc0 zuerst');
  ok((await S()).flip === true, 'Brett ist für Schwarz gedreht');

  // Analyse + PGN laden
  await page.evaluate(() => window.__lc0.setTab('ana'));
  await page.evaluate((p) => { document.querySelector('#load').value = p; document.querySelector('#bLoad').click(); }, PGN);
  ok(await waitFor(() => window.__lc0.state.mv.length === 26 && window.__lc0.state.idx === 26), 'PGN geladen: 26 Halbzüge (mit Rochade und Schlagzügen)');
  ok(await waitFor(() => /Wahrscheinlichkeit/.test(document.querySelector('#lines').innerText) && document.querySelectorAll('#lines tr').length >= 4), 'Analyse zeigt Zugliste mit Wahrscheinlichkeiten');
  ok(await page.evaluate(() => document.querySelectorAll('#arrows g').length >= 1), 'Pfeile für die besten Züge');
  await page.evaluate(() => document.querySelector('#bPrev').click()); ok((await S()).idx === 25, 'Zug zurück');
  await page.evaluate(() => document.querySelector('#bFirst').click()); ok((await S()).idx === 0 && /w KQkq/.test((await S()).fen), 'Zum Anfang');
  await page.keyboard.press('ArrowRight'); ok((await S()).idx === 1, 'Pfeiltaste vor');
  await page.evaluate(() => window.__lc0.go(12)); const f8 = (await S()).fen; ok(/^r1bq1rk1|^rnbq1rk1/.test(f8) || f8.includes('1rk1'), 'Stellung nach 12 Halbzügen (Schwarz hat rochiert): ' + f8.split(' ').slice(0, 3).join(' '));

  // Partie prüfen
  await page.evaluate(() => { window.__lc0.setTab('rev'); document.querySelector('#rside').value = 'b'; document.querySelector('#bRev').click(); });
  ok(await waitFor(() => document.querySelectorAll('#revtab tr.click').length === 13, 30000), 'Partie prüfen: 13 Züge von Schwarz bewertet');
  const rv = await page.evaluate(() => window.__review.rows.map((r) => r.p));
  ok(rv.every((x) => x >= 0 && x <= 100) && rv.some((x) => x > 10), 'Wahrscheinlichkeiten plausibel (' + rv.map((x) => x.toFixed(0)).join(', ') + ' %)');
  await page.evaluate(() => document.querySelector('#revtab tr.click').click()); ok((await S()).mode === 'ana', 'Klick auf Zeile springt in die Stellung');

  // starkes Netz
  await page.evaluate(() => { window.__lc0.setTab('ana'); const n = document.querySelector('#net'); n.value = 'strong'; n.dispatchEvent(new Event('change')); document.querySelector('#bStart').click(); });
  ok(await waitFor(() => /Knoten/.test(document.querySelector('#lines').innerText) && /Gewinnchance/.test(document.querySelector('#lines').innerText), 30000), 'Starkes Netz: Analyse mit Knoten und Gewinnchance');

  // Handy-Breite
  await page.setViewport({ width: 375, height: 800 }); await sleep(300);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Handy-Breite: kein seitliches Scrollen');
  ok(errors.length === 0, 'Keine Skriptfehler' + (errors.length ? ': ' + errors[0] : ''));
  console.log(`\n${passes} bestanden, ${fails} fehlgeschlagen`);
  await browser.close(); process.exit(fails ? 1 : 0);
})();
