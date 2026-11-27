// Kampflogik ohne Browser:  node tests/sim-test.mjs
import { sim, windOf, totals } from '../src/sim.js';
import { PUNCH, FIGHT, MATCH, DOWN, RING } from '../src/config.js';
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  -> ' + JSON.stringify(x) : '')); } };
const DT = 1 / 60, N = () => sim.cleanInput({});
const inp = (o) => sim.cleanInput(o);
// Szene: Kampf läuft, Abstand wählbar
function scene(gap = 1.2, seed = 7) { const s = sim.create(seed); s.phase = 'fight'; s.pt = 0; s.gap = gap; return s; }
const run = (s, sec, a = N, b = N) => { for (let t = 0; t < sec; t += DT) sim.step(s, [typeof a === 'function' ? a(s, t) : a, typeof b === 'function' ? b(s, t) : b], DT); };
const types = (s) => s.events.map((e) => e.type);
// Spieler 0 schlägt k; Verteidiger hält d (ab delay)
function exchange(k, d = {}, { gap = 1.1, body = false, delay = 0, setup } = {}) {
  const s = scene(gap); if (setup) setup(s);
  run(s, 1, (x, t) => inp({ [k]: t < 0.05, body }), (x, t) => (t >= delay ? inp(d) : N()));
  return s;
}

console.log('Schläge');
for (const k of ['jab', 'cross', 'hook', 'upper']) {
  const s = exchange(k, {}, { gap: 1.0 });
  const early = scene(1.0); run(early, 0.05, (x, t) => inp({ [k]: t < 0.02 }));
  ok(PUNCH[k].name + ' trifft in Reichweite und kostet Ausdauer', types(s).includes('hit') && s.f[1].hp < 100 && s.f[0].stats.landed === 1 && early.f[0].st === 100 - PUNCH[k].cost, [s.f[1].hp, early.f[0].st]);
}
let s = exchange('hook', {}, { gap: 1.8 });
ok('Außer Reichweite: Fehlschlag kostet zusätzlich', types(s).includes('whiff') && s.f[1].hp === 100);
ok('Stärkere Schläge machen mehr Schaden', exchange('upper', {}, { gap: 1 }).f[1].hp < exchange('cross', {}, { gap: 1 }).f[1].hp && exchange('cross', {}, { gap: 1 }).f[1].hp < exchange('jab', {}, { gap: 1 }).f[1].hp);
s = scene(1.2); run(s, 0.1, (x, t) => inp({ cross: t < 0.02 })); ok('Schlag braucht Ausholzeit', s.f[1].hp === 100); run(s, 0.3); ok('und trifft danach', s.f[1].hp < 100);

console.log('Ausweichen');
ok('Cross: Seitschritt weicht aus', exchange('cross', { x: 1 }).events.some((e) => e.type === 'evade'));
ok('Cross: Ducken weicht aus', exchange('cross', { duck: true }).events.some((e) => e.type === 'evade'));
ok('Haken: Ducken weicht aus', exchange('hook', { duck: true }).events.some((e) => e.type === 'evade'));
ok('Haken: Seitschritt hilft nicht', exchange('hook', { x: 1 }).f[1].hp < 100);
ok('Uppercut trifft den Geduckten', exchange('upper', { duck: true }, { gap: 1 }).f[1].hp < 100);
ok('Uppercut: Seitschritt weicht aus', exchange('upper', { x: -1 }, { gap: 1 }).events.some((e) => e.type === 'evade'));
ok('Körpertreffer lässt sich nicht wegducken', exchange('cross', { duck: true }, { body: true }).f[1].hp < 100);
ok('Ausweichen öffnet ein Konterfenster', (() => { const q = scene(1.1); run(q, 0.3, (x, t) => inp({ cross: t < 0.02 }), inp({ x: 1 })); return q.f[1].counter > 0; })());

console.log('Deckung, Parade, Konter');
const clean = 100 - exchange('cross').f[1].hp;
const guarded = 100 - exchange('cross', { block: true }).f[1].hp;       // Deckung von Anfang an: keine Parade
ok('Deckung hält den größten Teil ab', guarded > 0 && guarded < clean * 0.3, [guarded, clean]);
ok('Falsche Höhe schützt schlechter', 100 - exchange('cross', { block: true }, { body: true }).f[1].hp > (100 - exchange('cross', { block: true, body: true }, { body: true }).f[1].hp) * 1.2);
s = exchange('cross', { block: true }, { delay: PUNCH.cross.wind - 0.08 });
ok('Deckung im letzten Moment: Parade ohne Schaden, Angreifer benommen', types(s).includes('parry') && s.f[1].hp === 100, types(s));
s = scene(1.1); run(s, 1.2, (x, t) => inp({ cross: t < 0.02 }), (x, t) => inp({ block: Math.floor(t * 18) % 2 === 0 }));
ok('Wildes Hämmern auf Deckung gibt keine Parade', !types(s).includes('parry'), types(s));
s = scene(1.1); run(s, 0.3, (x, t) => inp({ cross: t < 0.02 }), inp({ x: 1 })); run(s, 0.8, N, (x, t) => inp({ cross: t < 0.02 }));
const counter = s.events.find((e) => e.type === 'hit' && e.counter);
ok('Konter nach Ausweichen zählt und macht deutlich mehr Schaden', !!counter && counter.p > PUNCH.cross.dmg * 1.3 && s.f[1].stats.counters === 1, counter);
s = scene(1.0); for (let i = 0; i < 40; i++) run(s, 0.5, (x, t) => inp({ hook: t < 0.02 }), inp({ block: true }));
ok('Dauerdruck auf die Deckung kostet den Verteidiger Ausdauer', s.f[1].st < 70, [s.f[1].st]);
s = scene(1.0); s.f[1].st = 5; run(s, 0.5, (x, t) => inp({ hook: t < 0.02 }), inp({ block: true })); ok('Ohne Ausdauer bricht die Deckung', types(s).includes('break') && s.f[1].stun >= 0, types(s));

console.log('Ausdauer und Zonen');
s = scene(2.3); for (let i = 0; i < 14; i++) run(s, 0.45, (x, t) => inp({ upper: t < 0.02 }));
ok('Wildes Schlagen leert die Ausdauer', s.f[0].st < 15, s.f[0].st);
const tiredAct = (() => { run(s, 0.7); s.f[0].st = 10; s.f[0].rest = 1; run(s, 0.03, inp({ jab: true })); return s.f[0].act; })();
ok('Müde schlägt langsamer und schwächer', tiredAct && tiredAct.slow > 1.2 && windOf(tiredAct) > PUNCH.jab.wind, tiredAct);
s = scene(2.3); s.f[0].st = 20; run(s, 4); ok('In Ruhe erholt sich die Ausdauer', s.f[0].st > 60, s.f[0].st);
const body = exchange('cross', {}, { body: true }), head = exchange('cross');
ok('Körpertreffer: weniger Schaden, senken aber die Ausdauergrenze', body.f[1].hp > head.f[1].hp && body.f[1].max < 100 && head.f[1].max === 100);

console.log('Kombinationen und Puffer');
s = scene(1.2); run(s, 1.4, (x, t) => inp({ jab: t < 0.03, cross: t > 0.2 && t < 0.24, hook: t > 0.52 && t < 0.56 }));
ok('Jab, Cross, Haken laufen flüssig nacheinander', s.f[0].stats.thrown === 3 && s.f[0].stats.landed === 3, s.f[0].stats);
s = scene(1.2); run(s, 1, (x, t) => inp({ cross: t < 0.02 || (t > 0.5 && t < 0.52) }));
ok('Kurz zu früh gedrückt wird gepuffert', s.f[0].stats.thrown === 2, s.f[0].stats.thrown);
s = scene(1.2); run(s, 1, inp({ jab: true })); ok('Gedrückt halten schlägt nur einmal', s.f[0].stats.thrown === 1);

console.log('Beine');
s = scene(1.7); run(s, 0.5, inp({ y: -1 })); ok('Stick nach vorn verkürzt den Abstand', s.gap < 1.3);
run(s, 3, inp({ y: -1 }), inp({ y: -1 })); ok('Abstand bleibt in den Grenzen', s.gap >= RING.minGap - 1e-9);
run(s, 5, inp({ y: 1 }), inp({ y: 1 })); ok('auch nach hinten', s.gap <= RING.maxGap + 1e-9);

console.log('Niederschlag');
const floored = () => { const q = scene(1.1); q.f[1].hp = 20; run(q, 0.4, (x, t) => inp({ cross: t < 0.02 })); return q; };
s = floored(); ok('Harter Treffer auf Angeschlagenen: Niederschlag', s.phase === 'down' && s.down.who === 1 && s.f[0].stats.knockdowns === 1, s.phase);
run(s, DOWN.tick * 3.2); ok('Es wird gezählt', s.down.count === 3, s.down && s.down.count);
run(s, DOWN.tick * 8); ok('Bis 10 liegen: K. o.', s.phase === 'over' && s.win === 0 && s.how === 'ko', [s.phase, s.how]);
ok('Sieger erst nach kurzem Nachlauf', sim.winner(s) === 0 || s.pt < MATCH.endHold);
s = floored(); let presses = 0;
for (let t = 0; t < 9 && s.phase === 'down'; t += DT) { const D = s.down, hit = D.lock <= 0 && Math.abs(D.m - D.zone) < 0.03 && !s.f[1].prev.block; if (hit) presses++; sim.step(s, [N(), inp({ block: hit })], DT); }
ok('Im richtigen Moment drücken: man steht auf', s.phase === 'fight' && s.f[1].hp === DOWN.hp[0], [s.phase, presses]);
s = floored(); for (let t = 0; t < 4 && s.phase === 'down'; t += DT) sim.step(s, [N(), inp({ block: Math.floor(t * 20) % 2 === 0 })], DT);
ok('Blindes Hämmern bringt einen kaum hoch', s.phase === 'down' && s.down.hits < s.down.need, s.down && s.down.hits);
s = scene(1.1); s.f[1].downs = 2; s.f[1].roundDowns = 2; s.f[1].hp = 20; run(s, 0.4, (x, t) => inp({ cross: t < 0.02 })); run(s, DOWN.tick * 3.5);
ok('Dritter Niederschlag in der Runde: technischer K. o.', s.phase === 'over' && s.how === 'tko' && s.win === 0, [s.how, s.win]);

console.log('Online-Ausgleich');
// Der Zuschauer sieht die Marke "late" Sekunden zu spät und drückt, wenn sie bei ihm im Feld steht
function lateGetup(late, compensate) {
  const q = floored(); const seen = [];
  for (let t = 0; t < 9.5 && q.phase === 'down'; t += DT) {
    const D = q.down; seen.push({ t: q.t, m: D.m, zone: D.zone });
    const v = seen[Math.max(0, seen.length - 1 - Math.round(late / DT))];
    const hit = D.lock <= 0 && Math.abs(v.m - v.zone) < 0.03 && v.zone === D.zone && !q.f[1].prev.block;
    sim.step(q, [N(), inp({ block: hit, at: hit && compensate ? v.t : 0 })], DT);
  }
  return q;
}
ok('0,25 s Verzögerung ohne Ausgleich: man kommt nicht hoch', lateGetup(0.25, false).phase !== 'fight');
ok('0,25 s Verzögerung mit Ausgleich: man steht auf', lateGetup(0.25, true).phase === 'fight');
ok('Zurückgerechnet wird nur bis zur Obergrenze', lateGetup(0.8, true).phase !== 'fight' && DOWN.rewind === 0.45);
ok('Unsinnige Zeitangaben werden begrenzt', sim.cleanInput({ at: -5 }).at === 0 && sim.cleanInput({ at: 'x' }).at === 0 && sim.cleanInput({ at: 1e12 }).at === 1e5);
const slow = scene(1.2); slow.pace = 1.25; run(slow, PUNCH.cross.wind + 0.02, (x, t) => inp({ cross: t < 0.02 }));
const quick = scene(1.2); run(quick, PUNCH.cross.wind + 0.02, (x, t) => inp({ cross: t < 0.02 }));
ok('Online-Tempo: derselbe Schlag trifft später', quick.f[1].hp < 100 && slow.f[1].hp === 100, [quick.f[1].hp, slow.f[1].hp]);
run(slow, 0.2); ok('und trifft dann doch', slow.f[1].hp < 100);
const packed = scene(1.2); packed.pace = 1.25; run(packed, 0.05, (x, t) => inp({ jab: t < 0.02 }));
ok('Der Gast sieht dasselbe Tempo', Math.abs(sim.unpack(JSON.parse(JSON.stringify(sim.pack(packed)))).f[0].act.slow - 1.25) < 0.01);

console.log('Runden und Richter');
s = sim.create(3); run(s, MATCH.intro + 0.1); ok('Nach der Einleitung läutet es', s.phase === 'fight' && types(s).includes('bell'));
run(s, MATCH.roundTime + 0.2); ok('Rundenende: Pause und drei Punktzettel', s.phase === 'rest' && s.cards.length === 1 && s.cards[0].length === 3);
run(s, MATCH.rest + 0.1); ok('Runde 2 beginnt mit voller Ausdauer', s.round === 2 && s.f[0].st === s.f[0].max && s.clock === MATCH.roundTime);
s = sim.create(4); run(s, 260, (x, t) => inp({ jab: x.phase === 'fight' && Math.floor(t * 2) % 2 === 0, y: -1 }));
ok('Wer allein trifft, gewinnt nach Punkten', s.phase === 'over' && s.win === 0 && (s.how === 'einstimmig' || s.how === 'ko' || s.how === 'tko'), [s.win, s.how, totals(s)]);

console.log('Netzdaten');
s = scene(1.2); run(s, 0.1, inp({ hook: true })); const p = JSON.parse(JSON.stringify(sim.pack(s))), u = sim.unpack(p);
ok('Zustand überlebt Packen und Auspacken', !!u && u.f[0].act.k === 'hook' && Math.abs(u.gap - s.gap) < 0.01);
ok('Netzpaket ist klein', JSON.stringify(p).length < 1500, JSON.stringify(p).length);
let bad = 0, acc = 0; const junk = [null, -1, 1e308, 'x', [], {}, 99999];
for (let i = 0; i < 6000; i++) { const c = JSON.parse(JSON.stringify(p)), keys = []; (function walk(o, path) { if (o && typeof o === 'object') for (const k of Object.keys(o)) { keys.push([...path, k]); walk(o[k], [...path, k]); } })(c, []); const key = keys[(i * 7919) % keys.length]; let o = c; for (let j = 0; j < key.length - 1; j++) o = o[key[j]]; o[key[key.length - 1]] = junk[i % junk.length];
  const r = sim.unpack(JSON.parse(JSON.stringify(c))); if (!r) continue; acc++; if (JSON.stringify(sim.pack(r)).includes('null,null') && r.f.some((f) => !Number.isFinite(f.hp))) bad++; if (!r.f.every((f) => Number.isFinite(f.hp) && Number.isFinite(f.st))) bad++; sim.lerp(r, r, 0.5); }
ok('Gefälschte Zustände richten nichts an', bad === 0 && sim.unpack(null) === null && sim.unpack({ ph: 'x' }) === null, [bad, acc]);
ok('Unsinnige Eingaben werden begrenzt', sim.cleanInput({ x: 1e9, y: NaN, jab: 'ja', side: 7 }).x === 1 && sim.cleanInput({ y: NaN }).y === 0 && sim.cleanInput({ side: -1 }).side === -1);

console.log('Computergegner');
function bout(a, b, seed) { const q = sim.create(seed); let t = 0; for (; t < 60 * 400 && sim.winner(q) === null; t++) sim.step(q, [sim.cleanInput(sim.cpu(q, 0, a, DT)), sim.cleanInput(sim.cpu(q, 1, b, DT))], DT); return q; }
const series = (a, b, n) => { let w = 0, l = 0, ko = 0, thrown = 0, landed = 0, endless = 0, len = 0; for (let i = 1; i <= n; i++) { const q = i % 2 ? bout(a, b, i * 31) : bout(b, a, i * 31); const mine = i % 2 ? 0 : 1; if (sim.winner(q) === null) endless++; if (q.win === mine) w++; else if (q.win === 1 - mine) l++; if (q.how === 'ko' || q.how === 'tko') ko++; thrown += q.f[0].stats.thrown; landed += q.f[0].stats.landed; len += q.t; } return { w, l, ko, acc: landed / thrown, endless, len: len / n }; };
const same = series('normal', 'normal', 40), hn = series('hard', 'normal', 40), ne = series('normal', 'easy', 40), he = series('hard', 'easy', 40);
console.log('    normal gegen normal: ' + JSON.stringify(same));
console.log('    schwer:normal ' + hn.w + ':' + hn.l + ' · normal:leicht ' + ne.w + ':' + ne.l + ' · schwer:leicht ' + he.w + ':' + he.l);
ok('Alle Kämpfe enden', same.endless + hn.endless + ne.endless + he.endless === 0);
ok('Stärkere Stufe gewinnt öfter', hn.w > hn.l && ne.w > ne.l && he.w >= hn.w, [hn, ne, he]);
ok('Gleich starke Gegner sind ausgeglichen', same.w >= 10 && same.l >= 10, [same.w, same.l]);
ok('Trefferquote glaubwürdig (15 bis 70 %)', same.acc > 0.15 && same.acc < 0.7, same.acc);
ok('Es gibt Niederschläge, aber nicht nur', same.ko >= 2 && same.ko <= 34, same.ko);
const d1 = bout('hard', 'easy', 5), d2 = bout('hard', 'easy', 5);
ok('Gleicher Startwert: gleicher Kampf', JSON.stringify(sim.pack(d1)) === JSON.stringify(sim.pack(d2)));
console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
