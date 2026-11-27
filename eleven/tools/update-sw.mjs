// Schreibt Dateiliste und Speichername in sw.js. Nach Änderungen ausführen: npm run update:sw   (--check prüft nur)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d) => fs.existsSync(path.join(root, d)) ? fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name]) : [];
const FILES = ['index.html', 'style.css', 'manifest.webmanifest', ...walk('icons'), ...walk('vendor').filter((f) => f.endsWith('.js')), ...walk('src').filter((f) => f.endsWith('.js')), ...walk('assets')].sort();
const hash = crypto.createHash('sha256');
// Zeilenenden vereinheitlichen, damit Windows und Linux denselben Namen errechnen
for (const f of FILES) { const raw = fs.readFileSync(path.join(root, f)); hash.update(f).update(/\.(png)$/.test(f) ? raw : raw.toString('utf8').replace(/\r\n/g, '\n')); }
const version = hash.digest('hex').slice(0, 10), swFile = path.join(root, 'sw.js');
const old = fs.readFileSync(swFile, 'utf8');
const next = old.replace(/const VERSION = PREFIX \+ '[^']*';/, () => "const VERSION = PREFIX + '" + version + "';")
  .replace(/const SHELL = \[[^\]]*\];/, () => 'const SHELL = ' + JSON.stringify(['./', ...FILES]) + ';');
if (process.argv.includes('--check')) { if (next !== old) { console.error('sw.js ist veraltet: npm run update:sw'); process.exit(1); } console.log('sw.js aktuell'); }
else { fs.writeFileSync(swFile, next); console.log('sw.js: ' + version + ', ' + (FILES.length + 1) + ' Einträge'); }
