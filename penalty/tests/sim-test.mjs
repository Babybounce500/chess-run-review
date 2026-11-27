// Tests der Spiellogik ohne Browser:  node tests/sim-test.mjs
import { resolveKick, ballAt, keeperPose, classify, createMatch, recordKick, winnerOf, shooterOf, suddenDeath, goalsOf, cpuShot, cpuDive, cleanShot, rng, flight } from '../src/sim.js';
import { FIELD, KEEPER } from '../src/config.js';
import fs from 'node:fs';
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  -> ' + JSON.stringify(x) : '')); } };
const far = { x: 1, y: 0, start: 4 };                     // Torwart springt viel zu spät: bleibt in der Mitte

console.log('Ballbahn');
const a = resolveKick({ aimX: 0.7, aimY: 0.5, power: 0.7 }, far, 42), b = resolveKick({ aimX: 0.7, aimY: 0.5, power: 0.7 }, far, 42);
ok('Gleiche Eingaben und gleicher Startwert: bitgleiches Ergebnis', a.outcome === b.outcome && a.path.length === b.path.length && a.path.every((v, i) => v === b.path[i]));
ok('Sauberer Schuss in die Ecke ist ein Tor', a.outcome === 'goal', a.outcome);
for (const fps of [30, 60, 144, 7]) {
  let t = 0, end; while (t < a.duration) { t += 1 / fps; end = ballAt(a, t); }
  const e = ballAt(a, a.duration);
  ok(fps + ' Bilder/s: Ball endet an derselben Stelle', Math.abs(end.x - e.x) < 1e-9 && Math.abs(end.z - e.z) < 1e-9);
}
const at = ballAt(a, a.tEvent);
ok('Ball kreuzt die Torlinie am berechneten Ziel', Math.abs(at.x - a.flight.tx) < 0.02 && Math.abs(at.y - a.flight.ty) < 0.02 && Math.abs(at.z - FIELD.goalZ) < 0.15, [at, a.flight.tx, a.flight.ty]);
ok('Tor: Ball bleibt im Netz', (() => { for (let t = a.tEvent; t <= a.duration; t += 0.01) { const p = ballAt(a, t); if (p.z < FIELD.goalZ - 1.3 || Math.abs(p.x) > FIELD.goalW / 2 + 0.1) return false; } return true; })());
const curved = flight({ aimX: 0.5, aimY: 0.4, power: 0.7, curve: 1 }, 3), straight = flight({ aimX: 0.5, aimY: 0.4, power: 0.7, curve: 0 }, 3);
ok('Effet: gleicher Zielpunkt, gebogene Bahn', Math.abs(curved.tx - straight.tx) < 1e-9 && curved.vx > straight.vx + 1 && curved.ax < 0);
ok('Viel Kraft fliegt schneller', flight({ power: 1 }, 1).T < flight({ power: 0.2 }, 1).T);
const spread = (p) => { let s = 0; for (let i = 1; i < 400; i++) { const f = flight({ aimX: 0, aimY: 0.4, power: p }, i); s += Math.abs(f.tx); } return s / 399; };
ok('Zu viel Kraft streut deutlich mehr als die grüne Zone', spread(1) > spread(0.7) * 4, [spread(1), spread(0.7)]);
let over = 0; for (let i = 1; i < 200; i++) if (resolveKick({ aimX: 0, aimY: 0.9, power: 1 }, far, i).outcome === 'over') over++;
ok('Volle Kraft nach oben geht oft drüber', over > 80, over);

console.log('Tor, Pfosten, daneben');
const hw = FIELD.goalW / 2;
ok('Mitte ist Tor', classify(0, 1) === 'goal');
ok('Pfosten links und rechts', classify(-hw, 1) === 'post' && classify(hw + 0.05, 0.3) === 'post');
ok('Latte', classify(0, FIELD.goalH) === 'post');
ok('Daneben und drüber', classify(hw + 0.8, 1) === 'wide' && classify(0, FIELD.goalH + 0.6) === 'over');
const post = resolveKick({ aimX: 1, aimY: 0.4, power: 0.7 }, far, 11);
ok('Pfostenschuss prallt zurück ins Feld', post.outcome !== 'post' || ballAt(post, post.tEvent + 0.2).z > FIELD.goalZ);

console.log('Torwart');
const mid = resolveKick({ aimX: 0, aimY: 0.35, power: 0.65 }, { x: 0, y: 0.3, start: 0 }, 5);
ok('Schuss in die Mitte, Torwart bleibt stehen: gehalten', mid.outcome === 'save', mid.outcome);
ok('Abpraller fliegt vom Tor weg', ballAt(mid, mid.tEvent + 0.25).z > FIELD.keeperZ);
const rate = (shot, dive) => { let s = 0; for (let i = 1; i <= 200; i++) if (resolveKick(shot, dive, i).outcome === 'save') s++; return s / 200; };
const low = { aimX: 0.65, aimY: 0.2, power: 0.55 };
ok('Richtige Ecke, rechtzeitig: meist gehalten', rate(low, { x: 0.65, y: 0.15, start: 0 }) > 0.85, rate(low, { x: 0.65, y: 0.15, start: 0 }));
ok('Falsche Ecke: nicht gehalten', rate(low, { x: -0.7, y: 0.15, start: 0 }) === 0);
ok('Richtige Ecke, aber zu spät: deutlich seltener', rate(low, { x: 0.65, y: 0.15, start: 0.5 }) < 0.3, rate(low, { x: 0.65, y: 0.15, start: 0.5 }));
ok('Harter Schuss ins Eck ist schwerer zu halten als ein weicher', rate({ aimX: 0.82, aimY: 0.75, power: 0.8 }, { x: 0.82, y: 0.75, start: 0.1 }) < rate({ aimX: 0.82, aimY: 0.75, power: 0.3 }, { x: 0.82, y: 0.75, start: 0.1 }));
const p0 = keeperPose({ x: 1, y: 1, start: 0 }, -1), p1 = keeperPose({ x: 1, y: 1, start: 0 }, KEEPER.diveTime);
ok('Haltung: erst Stand, dann gestreckt zur Ecke', p0.cx === 0 && p0.k === 0 && p1.k === 1 && p1.handX > 2.5 && p1.handX < hw + 0.15, [p0.cx, p1.handX]);

console.log('Unsinnige Werte');
const junk = resolveKick({ aimX: 1e9, aimY: NaN, power: 'x', curve: -50 }, { x: Infinity, y: null, start: -99 }, 1);
ok('Werden begrenzt, kein NaN', junk.path.every(Number.isFinite) && junk.shot.aimX === 1.25 && junk.shot.curve === -1 && junk.dive.start >= -0.12);
ok('Leere Eingaben haben Vorgaben', cleanShot().power === 0.5);

console.log('Regeln');
const play = (seq, first = 0) => { const m = createMatch(first); for (const g of seq) recordKick(m, g); return m; };
ok('Abwechselnd, Beginner wählbar', shooterOf(createMatch(1)) === 1 && shooterOf(play([1], 1)) === 0);
ok('3:0 nach je drei Schüssen entscheidet vorzeitig', winnerOf(play([1, 0, 1, 0, 1, 0])) === 0);
ok('2:0 nach je zwei Schüssen noch offen', winnerOf(play([1, 0, 1, 0])) === null);
ok('Entschieden: weitere Schüsse zählen nicht', play([1, 0, 1, 0, 1, 0, 1]).kicks[0].length === 3);
const draw = play([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
ok('5:5 geht in die K.-o.-Runde', winnerOf(draw) === null && suddenDeath(draw));
recordKick(draw, true);
ok('K.-o.: erst nach beiden Schüssen entschieden', winnerOf(draw) === null);
recordKick(draw, false);
ok('K.-o.: Treffer gegen Fehlschuss gewinnt', winnerOf(draw) === 0 && goalsOf(draw, 0) === 6);
let bad = 0;
for (let s = 1; s < 600; s++) { const r = rng(s), m = createMatch(s % 2); let n = 0; while (winnerOf(m) === null && n < 200) { recordKick(m, r() < 0.7); n++; } if (winnerOf(m) === null || Math.abs(m.kicks[0].length - m.kicks[1].length) > 1) bad++; }
ok('600 Zufallsspiele enden alle mit Sieger', bad === 0, bad);

console.log('Computergegner');
const stats = (level) => { let goals = 0, saves = 0, onTarget = 0; for (let i = 1; i <= 3000; i++) { const shot = { aimX: (i % 2 ? 1 : -1) * (0.35 + (i % 7) * 0.07), aimY: 0.15 + (i % 5) * 0.14, power: 0.6 + (i % 4) * 0.06 }; const res = resolveKick(shot, cpuDive(level, shot, i), (i ^ 0x5bd1e995) >>> 0); if (res.goal) goals++; if (res.outcome === 'save') saves++; } return { goals: goals / 3000, saves: saves / 3000 }; };
const e = stats('easy'), n = stats('normal'), h = stats('hard');
console.log('    Torquote gegen CPU-Torwart: leicht ' + (e.goals * 100).toFixed(0) + ' %, normal ' + (n.goals * 100).toFixed(0) + ' %, schwer ' + (h.goals * 100).toFixed(0) + ' %');
ok('Schwierigkeit wirkt: leicht > normal > schwer', e.goals > n.goals && n.goals > h.goals, [e, n, h]);
ok('Quoten im spielbaren Bereich (40 bis 90 %)', h.goals > 0.4 && e.goals < 0.92, [e.goals, h.goals]);
const cg = (level) => { let g = 0; for (let i = 1; i <= 2000; i++) if (['goal', 'save'].includes(classify(flight(cpuShot(level, i), i).tx, flight(cpuShot(level, i), i).ty) === 'goal' ? 'goal' : 'x')) g++; return g / 2000; };
console.log('    CPU-Schüsse aufs Tor: leicht ' + (cg('easy') * 100).toFixed(0) + ' %, normal ' + (cg('normal') * 100).toFixed(0) + ' %, schwer ' + (cg('hard') * 100).toFixed(0) + ' %');
ok('Starke CPU schießt genauer', cg('hard') > cg('easy'));
const src = fs.readFileSync(new URL('../src/sim.js', import.meta.url), 'utf8');
ok('Spiellogik benutzt keine browserabhängigen Rechenfunktionen', !/Math\.(sin|cos|tan|atan|atan2|pow|exp|log|random|hypot)\b/.test(src));
console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
