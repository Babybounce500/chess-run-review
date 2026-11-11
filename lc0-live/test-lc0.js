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
  ok(await waitFor(() => /Wahrscheinlichkeit/.test(document.querySelector('#lines').innerText) && document.querySelectorAll('#lines .ln').length >= 4), 'Analyse zeigt Zugliste mit Wahrscheinlichkeiten');
  ok(await page.evaluate(() => document.querySelectorAll('#arrows g').length >= 1), 'Pfeile für die besten Züge');
  await page.evaluate(() => document.querySelector('#bPrev').click()); ok((await S()).idx === 25, 'Zug zurück');
  await page.evaluate(() => document.querySelector('#bFirst').click()); ok((await S()).idx === 0 && /w KQkq/.test((await S()).fen), 'Zum Anfang');
  await page.keyboard.press('ArrowRight'); ok((await S()).idx === 1, 'Pfeiltaste vor');
  await page.evaluate(() => window.__lc0.go(12)); const f8 = (await S()).fen; ok(/^r1bq1rk1|^rnbq1rk1/.test(f8) || f8.includes('1rk1'), 'Stellung nach 12 Halbzügen (Schwarz hat rochiert): ' + f8.split(' ').slice(0, 3).join(' '));

  // Partie prüfen
  await page.evaluate(() => { window.__lc0.setTab('rev'); document.querySelector('#rside').value = 'b'; document.querySelector('#bRev').click(); });
  ok(await waitFor(() => document.querySelectorAll('#revtab .rv').length === 13, 30000), 'Partie prüfen: 13 Züge von Schwarz bewertet');
  const rv = await page.evaluate(() => window.__review.rows.map((r) => r.p));
  ok(rv.every((x) => x >= 0 && x <= 100) && rv.some((x) => x > 10), 'Wahrscheinlichkeiten plausibel (' + rv.map((x) => x.toFixed(0)).join(', ') + ' %)');
  await page.evaluate(() => document.querySelector('#revtab .rv').click()); ok((await S()).mode === 'ana', 'Klick auf Zeile springt in die Stellung');

  // starkes Netz
  await page.evaluate(() => { window.__lc0.setTab('ana'); const n = document.querySelector('#net'); n.value = 'strong'; n.dispatchEvent(new Event('change')); document.querySelector('#bStart').click(); });
  ok(await waitFor(() => /Knoten/.test(document.querySelector('#lines').innerText) && /Gewinnchance/.test(document.querySelector('#lines').innerText), 30000), 'Starkes Netz: Analyse mit Knoten und Gewinnchance');

  // Oberfläche: Verbindung, Ziehen, Umwandlung, Partie-Ende
  await page.evaluate(() => { const n = document.querySelector('#net'); n.value = 'maia-1500'; n.dispatchEvent(new Event('change')); });
  ok(await page.evaluate(() => document.querySelector('#conn').classList.contains('ok')), 'Verbindungspunkt ist grün');
  await page.evaluate(() => { document.querySelector('#bStart').click(); window.__lc0.setTab('play'); document.querySelector('#pcol').value = 'w'; document.querySelector('#bNew').click(); });
  await sleep(300);
  const rc = (sq) => page.evaluate((s) => { const r = document.querySelector(`.sq[data-sq="${s}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sq);
  const a = await rc('d2'), b = await rc('d4');
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  ok(await page.evaluate(() => !!document.querySelector('.ghost')), 'Ziehen: Figur folgt dem Zeiger');
  await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up();
  ok(await waitFor(() => window.__lc0.state.mv.length >= 1 && window.__lc0.state.mv[0].san === 'd4'), 'Ziehen: d2 nach d4 per Drag and Drop');
  ok(await waitFor(() => window.__lc0.state.mv.length === 2 && !window.__lc0.state.busy), 'Lc0 antwortet auf den Drag-Zug');
  ok(await page.evaluate(() => document.querySelector('#capsBot') && document.querySelector('#stripTop .pname').textContent.length > 0), 'Spielerleisten zeigen Namen');
  // Umwandlung
  await page.evaluate(() => { window.__lc0.setTab('ana'); document.querySelector('#auto').checked = false; document.querySelector('#load').value = '7k/P7/8/8/8/8/8/K7 w - - 0 1'; document.querySelector('#bLoad').click(); window.__lc0.setTab('play'); });
  await waitFor(() => !window.__lc0.state.busy);
  await click('a7'); await click('a8');
  ok(await waitFor(() => document.querySelector('#promoOv').classList.contains('show')), 'Umwandlung: Auswahl erscheint');
  await page.evaluate(() => document.querySelector('#promo button[data-p="q"]').click());
  ok(await waitFor(() => window.__lc0.state.mv.length >= 1 && /=Q/.test(window.__lc0.state.mv[0].san)), 'Umwandlung in Dame: ' + (await S()).mv.map((m) => m.san).join(' '));
  // Partie-Ende
  await page.evaluate(() => { window.__lc0.setTab('ana'); document.querySelector('#load').value = '1. f3 e5 2. g4 Qh4#'; document.querySelector('#bLoad').click(); window.__lc0.setTab('play'); });
  ok(await waitFor(() => document.querySelector('#overOv').classList.contains('show') && /Lc0 gewinnt/.test(document.querySelector('#overT').textContent)), 'Partie-Ende: Banner „Lc0 gewinnt“ bei Matt');
  await page.evaluate(() => document.querySelector('#ovRev').click());
  ok(await waitFor(() => document.querySelectorAll('#revtab .rv').length === 2, 20000), 'Banner „Partie prüfen“ startet die Prüfung (2 Züge von Weiß)');

  // Handy-Breite
  await page.setViewport({ width: 375, height: 800, isMobile: true, hasTouch: true }); await sleep(400);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Handy-Breite: kein seitliches Scrollen');
  ok(await page.evaluate(() => { const r = document.querySelector('#board').getBoundingClientRect(); return r.width >= 340 && r.left >= 0 && r.right <= window.innerWidth; }), 'Handy: Brett füllt die Breite');
  ok(await page.evaluate(() => { const t = document.querySelector('#tabs').getBoundingClientRect(); return getComputedStyle(document.querySelector('#tabs')).position === 'fixed' && Math.abs(t.bottom - window.innerHeight) < 2; }), 'Handy: Reiterleiste sitzt unten fest');
  ok(await page.evaluate(() => [...document.querySelectorAll('.ibtn, #tabs button, #bNew, #bUndo, #bHint')].every((b) => b.getBoundingClientRect().height >= 43 || b.offsetParent === null)), 'Handy: alle Tasten mindestens 44 px hoch');
  await page.evaluate(() => { window.__lc0.setTab('play'); document.querySelector('#bStart').click(); window.__lc0.setTab('ana'); }); await sleep(300);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: false });
  ok(errors.length === 0, 'Keine Skriptfehler' + (errors.length ? ': ' + errors[0] : ''));
  console.log(`\n${passes} bestanden, ${fails} fehlgeschlagen`);
  await browser.close(); process.exit(fails ? 1 : 0);
})();
