// Tests der Spiellogik ohne Browser:  node tests/sim-test.mjs
import fs from 'node:fs';
import { sim, decide, controlled, openness, canPass, rushLeft, switchDefender, PHASES } from '../src/sim.js';
import { STEP } from '../src/kit/realtime.js';
import { FIELD, MATCH, TIME, ACT, ACTION, PASS, PLAYS, FORMATIONS, TARGETS, SPEED, MOVE } from '../src/config.js';

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 500) : '')); } };
const I = (o = {}) => sim.cleanInput(o);
const hyp = Math.hypot;
function run(s, sec, a = {}, b = {}) { for (let i = 0; i < Math.round(sec / STEP); i++) sim.step(s, [I(typeof a === 'function' ? a(s) : a), I(typeof b === 'function' ? b(s) : b)], STEP); return s; }
// Angriff / Abwehr als Eingaben der richtigen Seite
function drive(s, sec, off = {}, def = {}) { for (let i = 0; i < Math.round(sec / STEP); i++) { const o = I(typeof off === 'function' ? off(s) : off), d = I(typeof def === 'function' ? def(s) : def); sim.step(s, s.off === 0 ? [o, d] : [d, o], STEP); } return s; }
function until(s, pred, off = {}, def = {}, max = 20) { for (let i = 0; i < max / STEP; i++) { if (pred(s)) return true; drive(s, STEP, off, def); } return pred(s); }
function seeded(first) { for (let seed = 1; ; seed++) { const s = sim.create(seed); if (s.off === first) return s; } }
// Spielzug bis zum Snap bringen
function live(seed = 1, play = 0, form = 0) {
  const s = sim.create(seed);
  drive(s, STEP, { p: play, n: s.play }, { p: form, n: s.play });
  until(s, (x) => x.pt >= TIME.setMin + 0.02);
  drive(s, STEP, { a: true });
  return s;
}
// Verteidiger weit wegstellen, damit einzelne Regeln allein geprüft werden
const park = (s, keep = []) => { for (let i = 4; i < 8; i++) if (!keep.includes(i)) Object.assign(s.pl[i], { x: -7.5 + (i - 4) * 0.8, z: -1.5, vx: 0, vz: 0, act: ACT.down, at: 0, dur: 999 }); };
const events = (s, type) => s.events.filter((e) => e.type === type);

console.log('Aufbau und Gleichstand');
{
  const src = fs.readFileSync(new URL('../src/sim.js', import.meta.url), 'utf8');
  ok('Keine Zufallsfunktion des Browsers, kein Zugriff auf Seite oder Uhr', !/Math\.random|document\.|window\.|Date\.now|performance\./.test(src));
  const a = sim.create(7), b = sim.create(7);
  for (let i = 0; i < 3000; i++) for (const s of [a, b]) sim.step(s, [I(sim.cpu(s, 0, 'normal')), I(sim.cpu(s, 1, 'hard'))], STEP);
  ok('Gleicher Startwert und gleiche Eingaben: identischer Zustand', JSON.stringify(a) === JSON.stringify(b));
  const c = sim.create(8); ok('Anderer Startwert: andere Partie', JSON.stringify(sim.create(7)) !== JSON.stringify(c));
  ok('Zustand ist reines JSON', JSON.stringify(JSON.parse(JSON.stringify(a))) === JSON.stringify(a));
  ok('Beide Seiten können beginnen', new Set(Array.from({ length: 20 }, (_, i) => sim.create(i).off)).size === 2);
}

console.log('Eingaben prüfen');
{
  const g = sim.cleanInput({ x: 99, z: -99, a: 'ja', b: 1, r: 7, p: 2.5, n: -1 });
  ok('Unsinn wird begrenzt', hyp(g.x, g.z) <= 1.0001 && g.a === false && g.b === false && g.r === -1 && g.p === -1 && g.n === 0, g);
  const h = sim.cleanInput(null), k = sim.cleanInput({ x: NaN, z: Infinity });
  ok('Leere und kaputte Eingabe ist gültig', h.x === 0 && h.r === -1 && k.x === 0 && k.z === 0);
}

console.log('Verdeckte Wahl');
for (const off of [0, 1]) {
  const s = seeded(off);
  const mine = off === 0 ? { p: 2, n: s.play } : { p: 1, n: s.play };            // Wahl des Gastgebers (Spieler 0)
  run(s, 0.1, mine, {});
  const packed = sim.pack(s), view = sim.unpack(JSON.parse(JSON.stringify(packed))), key = off === 0 ? 'o' : 'd';
  ok((off === 0 ? 'Gastgeber greift an' : 'Gastgeber verteidigt') + ': Gast erfährt nur „festgelegt“, nicht was', s.call[key] === mine.p && view.call[key] === 9, [s.call, view.call]);
  const before = s.call[key]; run(s, 0.3, { p: 0, n: s.play }, {});
  ok('Festgelegt bleibt festgelegt', s.call[key] === before);
  run(s, 0.1, {}, { p: 2, n: s.play });
  ok('Sobald beide gewählt haben, geht es weiter und beides ist sichtbar', s.ph === 'set' && sim.unpack(sim.pack(s)).call[key] === before);
}
{
  const s = sim.create(3); drive(s, 0.2, { p: 1, n: s.play + 5 }, { p: 1, n: 0 });
  ok('Wahl für einen anderen Spielzug zählt nicht', s.call.o === -1 && s.call.d === -1 && s.ph === 'pick');
  until(s, (x) => x.ph !== 'pick');
  ok('Ohne Wahl wird nach Ablauf gelost', s.ph === 'set' && s.call.o >= 0 && s.call.d >= 0 && s.t >= TIME.pick - 0.05, [s.t, s.call]);
}

console.log('Snap und Aufstellung');
{
  const s = sim.create(5); drive(s, STEP, { p: 0, n: s.play }, { p: 1, n: s.play });
  drive(s, 0.2, {}); drive(s, 0.05, { a: true }); ok('Snap erst nach kurzer Aufstellzeit', s.ph === 'set');
  drive(s, TIME.setMin); drive(s, 0.05, { a: true }); ok('Snap per Knopf', s.ph === 'live');
  const t = sim.create(5); drive(t, STEP, { p: 0, n: t.play }, { p: 1, n: t.play }); until(t, (x) => x.ph === 'live'); ok('Automatischer Snap, wenn niemand drückt', t.ph === 'live' && t.t <= TIME.setMax + 0.2);
  const u = sim.create(5); drive(u, STEP, { p: 0, n: u.play }, { p: 0, n: u.play }); const dc = u.dc;
  drive(u, 0.05, {}, { b: true }); ok('Abwehr wechselt vor dem Snap die Figur', u.dc !== dc, [dc, u.dc]);
  const x0 = u.pl[u.dc].x; drive(u, 0.8, {}, { x: 1, z: -1 }); ok('Abwehr stellt sich selbst, aber nicht über die Linie', u.pl[u.dc].x > x0 + 0.5 && u.pl[u.dc].z >= u.los + 0.99, [x0, u.pl[u.dc].x, u.pl[u.dc].z, u.los]);
}

console.log('Motorik');
{
  const s = live(11, 0, 0); park(s); const q = s.pl[0];
  drive(s, 0.1, { x: 1 }); const v1 = hyp(q.vx, q.vz); drive(s, 0.7, { x: 1 }); const v2 = hyp(q.vx, q.vz);
  ok('Kein Blitzstart: erst beschleunigen', v1 > 0.3 && v1 < SPEED.qb * 0.45 && v2 > SPEED.qb * 0.8, [v1, v2]);
  drive(s, 0.08, { x: -1 }); ok('Richtungswechsel braucht Zeit', q.vx > -1, q.vx); drive(s, 0.8, { x: -1 }); ok('... klappt dann', q.vx < -4, q.vx);
  drive(s, 1, {}); ok('Bremsen bis zum Stand', hyp(q.vx, q.vz) < 0.1);
  const t = live(11, 3, 0); park(t); until(t, (x) => x.ball.own === 3); const r = t.pl[3];
  drive(t, 1.0, { z: 1 }); const z0 = r.z, x0 = r.x; let steps = 0; while (r.vx < r.vz && steps++ < 120) drive(t, STEP, { x: 1 });
  ok('Wenderadius: bei Tempo führt die Kurve ein Stück weiter', r.z - z0 > 0.5 && r.x - x0 > 0.2 && steps * STEP > 0.12, [r.z - z0, r.x - x0, steps]);
  const u = live(11, 3, 0); park(u); until(u, (x) => x.ball.own === 3); drive(u, 0.9, { z: 1 }); const base = hyp(u.pl[3].vx, u.pl[3].vz); drive(u, 0.7, { z: 1, d: true });
  ok('Sprint ist schneller und kostet Ausdauer', hyp(u.pl[3].vx, u.pl[3].vz) > base * 1.1 && u.pl[3].st < 0.75, [base, hyp(u.pl[3].vx, u.pl[3].vz), u.pl[3].st]);
}

console.log('Pass');
function throwWith(holdSec, k = 0, play = 0, seed = 21) {
  const s = live(seed, play, 0); park(s); drive(s, 0.6);
  const key = ['a', 'b', 'c'][k]; drive(s, holdSec, { [key]: true }); until(s, (x) => x.ball.m === 'air', {}, {}, 1); return s;
}
{
  const flat = throwWith(0.05), high = throwWith(0.4);
  ok('Kurz drücken: flacher Pass', flat.ball.m === 'air' && !flat.ball.high && events(flat, 'throw')[0].high === 0);
  ok('Halten: hoher Pass mit mehr Bogen und längerer Flugzeit', high.ball.high && high.ball.apex > flat.ball.apex * 2.5 && high.ball.T > flat.ball.T * 1.2, [flat.ball.apex, high.ball.apex, flat.ball.T, high.ball.T]);
  const auto = live(22, 0, 0); park(auto); drive(auto, 0.6); drive(auto, PASS.maxHold + 0.4, { b: true }); ok('Zu lange gehalten: wirft von selbst (hoch)', events(auto, 'throw').length === 1 && events(auto, 'throw')[0].high === 1);
  for (let k = 0; k < 3; k++) { const s = throwWith(0.05, k); ok('Passknopf ' + (k + 1) + ' geht zum richtigen Empfänger', s.ball.tgt === TARGETS[k], s.ball.tgt); }
  const tap = live(23, 0, 0); park(tap); drive(tap, 0.6); drive(tap, 0.05, { r: 2 }); until(tap, (x) => x.ball.m === 'air', {}, {}, 1); ok('Antippen des Empfängers wirft ebenfalls', tap.ball.tgt === TARGETS[2]);
  const buf = live(24, 0, 0); park(buf); drive(buf, PASS.ready - 0.08); drive(buf, 0.04, { a: true }); until(buf, (x) => x.ball.m === 'air', {}, {}, 0.6); ok('Eingabepuffer: knapp zu früh gedrückt zählt trotzdem', buf.ball.m === 'air');
  let caughtN = 0; const types = {};
  for (let i = 0; i < 90; i++) { const s = throwWith(i % 2 ? 0.05 : 0.35, i % 3, i % 3, 300 + i); until(s, (x) => x.ball.m !== 'air', {}, {}, 4); if (s.ball.m === 'held' && s.ball.own > 0) caughtN++; else types[s.res && s.res.type] = 1; }
  ok('Freier Empfänger fängt fast immer (Wurf mit Vorhalten)', caughtN >= 75, [caughtN, types]);
  const c = throwWith(0.05, 0, 0, 21); until(c, (x) => x.ball.m !== 'air', {}, {}, 4);
  ok('Nach dem Fang steuert der Angriff den Fänger', c.ball.m === 'held' && controlled(c, c.off) === c.ball.own && c.scr);
  const x = c.pl[c.ball.own].x; drive(c, 0.5, { x: x > 0 ? -1 : 1, z: 0.3 }); ok('... und lenkt ihn', Math.abs(c.pl[c.ball.own].x - x) > 0.4);
  const sc = live(25, 0, 0); park(sc); drive(sc, 1.6, { z: 1 }); ok('Quarterback über der Linie: kein Pass mehr', sc.pl[0].z > sc.los && sc.scr && !canPass(sc));
  drive(sc, 0.1, { a: true }); ok('... Knopf A ist dann der Haken', sc.ball.m === 'held' && events(sc, 'juke').length === 1);
  const rp = live(26, 3, 0); park(rp); ok('Laufspielzug: kein Pass', !canPass(rp)); drive(rp, 0.6); ok('Laufspielzug: Läufer bekommt den Ball', rp.ball.own === 3 && events(rp, 'handoff').length === 1 && controlled(rp, rp.off) === 3);
  const op = live(27, 0, 0); park(op); drive(op, 1); ok('Freiheitsanzeige: ohne Gegner frei', openness(op, 0) > 2.4);
  Object.assign(op.pl[5], { x: op.pl[1].x + 0.3, z: op.pl[1].z + 0.3, vx: op.pl[1].vx, vz: op.pl[1].vz, act: 0 }); ok('Freiheitsanzeige: mit Bewacher zu', openness(op, 0) < 1.4, openness(op, 0));
}

console.log('Abfangen und Abwehren');
function contest(pressAt, seed) {
  // Verteidiger steht am Zielpunkt; er drückt BALL!, wenn der Ball noch pressAt Sekunden braucht (null = nie)
  const s = throwWith(0.35, 0, 0, seed); const b = s.ball, d = s.pl[7];
  Object.assign(d, { x: b.tx + 0.35, z: b.tz + 0.35, vx: 0, vz: 0, act: ACT.run, at: 0, dur: 0, cd: 0 }); s.dc = 7;
  let pressed = false;
  for (let i = 0; i < 300 && s.ph === 'live' && s.ball.m === 'air'; i++) {
    const left = s.ball.T - s.ball.t, press = pressAt !== null && !pressed && left <= pressAt; if (press) pressed = true;
    d.x = b.tx + 0.35; d.z = b.tz + 0.35; d.vx = d.vz = 0;
    drive(s, STEP, {}, { c: press, x: 0.0, z: 0.0 });
  }
  return s.ball.m === 'held' && s.ball.own === 7 ? 'int' : s.res && s.res.type === 'swat' ? 'swat' : s.ball.m === 'held' ? 'catch' : 'inc';
}
{
  const tally = (at) => { const t = { int: 0, swat: 0, catch: 0, inc: 0 }; for (let i = 0; i < 120; i++) t[contest(at, 500 + i)]++; return t; };
  const good = tally(0.2), early = tally(1.0), none = tally(null);
  ok('Richtig getimter Sprung: meist abgefangen oder abgewehrt', good.int + good.swat > 85 && good.int > 25, good);
  ok('Zu früh gesprungen: deutlich schlechter', early.int + early.swat < (good.int + good.swat) * 0.65, early);
  ok('Nur danebenstehen reicht selten', none.int + none.swat < (good.int + good.swat) * 0.65 && none.catch > 45, none);
  const k = live(31, 0, 0); park(k); drive(k, 0.6); drive(k, 0.05, { a: true }); until(k, (x) => x.ball.m === 'air');
  Object.assign(k.pl[6], { x: (k.ball.fx + k.ball.tx) / 2, z: (k.ball.fz + k.ball.tz) / 2, act: 0 });
  let blocked = 0; for (let i = 0; i < 80; i++) { const c = JSON.parse(JSON.stringify(k)); c.rng = 1000 + i * 77; const p = c.pl[6]; for (let n = 0; n < 200 && c.ball.m === 'air' && c.ph === 'live'; n++) { if (c.ball.t / c.ball.T < 0.84) { p.x = c.ball.x; p.z = c.ball.z; } drive(c, STEP); } if (c.res && (c.res.type === 'swat' || c.res.type === 'int')) blocked++; }
  ok('Verteidiger in der Wurfbahn kommt an flache Bälle', blocked > 12, blocked);
}

console.log('Tackle, Haken, Stoßarm');
// Läufer läuft nach vorn, Verteidiger kommt frontal; liefert den Zustand kurz vor dem Kontakt
function duel(gap, seed = 41) {
  const s = live(seed, 3, 0); park(s, [7]); until(s, (x) => x.ball.own === 3); drive(s, 0.3, { z: 1 });
  const r = s.pl[3]; Object.assign(r, { x: 0, z: s.los, vx: 0, vz: 4 }); Object.assign(s.pl[7], { x: 0, z: r.z + gap, vx: 0, vz: 0, act: 0, cd: 0, f: Math.PI }); s.dc = 7; s.touched[1 - s.off] = true; s.idle[1 - s.off] = 0; return s;
}
const hold = { x: 0.001, z: -0.13 };
{
  let s = duel(2.6); drive(s, 0.02, { z: 1 }, { a: true, z: -1 }); until(s, (x) => x.ph !== 'live', { z: 1 }, hold, 1);
  ok('Hechten im richtigen Abstand tackelt', s.res && s.res.type === 'tackle' && events(s, 'tackle').length === 1 && s.pl[3].act === ACT.down, s.res);
  const gain = s.res.gain; ok('Schwung: Ballpunkt liegt dort, wo der Träger fällt', Math.abs(s.res.spot - s.pl[3].z) < 2 && Number.isFinite(gain), [s.res.spot, s.pl[3].z]);
  s = duel(9); drive(s, 0.02, {}, { a: true, z: -1 }); drive(s, ACTION.dive.dur + 0.1, {}, hold); ok('Zu früh gehechtet: Verteidiger liegt am Boden', s.ph === 'live' && s.pl[7].act === ACT.down, [s.ph, s.pl[7].act]);
  const x = s.pl[7].x, z = s.pl[7].z; drive(s, 0.2, {}, { x: 1 }); ok('... und kann kurz nichts tun', hyp(s.pl[7].x - x, s.pl[7].z - z) < 0.4);
  let escaped = 0, caughtStill = 0;
  for (let i = 0; i < 20; i++) {
    const j = duel(2.7, 60 + i); drive(j, 0.02, { z: 1 }, { a: true, z: -1 }); let done = false;
    for (let n = 0; n < 60 && j.ph === 'live'; n++) { const d = Math.abs(j.pl[7].z - j.pl[3].z); const press = !done && d < 1.9; if (press) done = true; drive(j, STEP, { z: 1, x: 1, a: press }, hold); }
    if (j.ph === 'live') escaped++;
    const k = duel(2.7, 60 + i); drive(k, 0.02, { z: 1 }, { a: true, z: -1 }); drive(k, 0.6, { z: 1 }, hold); if (k.ph !== 'live') caughtStill++;
  }
  ok('Haken im richtigen Moment weicht dem Hechtsprung aus', escaped >= 17 && caughtStill >= 17, [escaped, caughtStill]);
  let shed = 0; for (let i = 0; i < 40; i++) { const j = duel(2.0, 80 + i); drive(j, 0.02, { z: 1 }); for (let n = 0; n < 40 && j.ph === 'live'; n++) drive(j, STEP, { z: 1, b: j.pl[7].z - j.pl[3].z < 1.7 }, { x: 0.001, z: -0.6 }); if (j.pl[7].act === ACT.stumble && j.ph === 'live') shed++; }
  ok('Stoßarm schiebt den Verteidiger von vorn meist weg', shed >= 28, shed);
  const g = duel(1.4); until(g, (x) => x.ph !== 'live', {}, { x: 0.001, z: -0.8 }, 2); ok('Festhalten: Körperkontakt bringt den Träger nach kurzer Zeit zu Boden', g.res && g.res.type === 'tackle' && events(g, 'grab').length >= 1);
  const w = duel(8); const dc = w.dc; Object.assign(w.pl[5], { x: w.pl[3].x + 1, z: w.pl[3].z + 3, act: 0 }); drive(w, 0.05, {}, { b: true }); ok('Wechsel nimmt den Verteidiger am Ball', w.dc === 5, [dc, w.dc]);
}

console.log('Rusher und Mitläufer');
for (let f = 0; f < 3; f++) {
  const s = live(51, 0, f), rushers = FORMATIONS[f].job.map((j, i) => (j === 'rush' ? 4 + i : -1)).filter((i) => i >= 0);
  drive(s, FORMATIONS[f].rushWait - 0.15);
  ok(FORMATIONS[f].name + ': Rusher zählt erst und bleibt hinter der Linie', rushers.every((i) => s.pl[i].z > s.los + 0.6) && rushLeft(s) > 0, rushers.map((i) => s.pl[i].z - s.los));
  until(s, (x) => x.ph !== 'live', {}, {}, 6); ok(FORMATIONS[f].name + ': wer stehen bleibt, wird gesackt', s.res.type === 'sack' && s.res.gain < 0, s.res);
}
{
  const s = live(52, 0, 1); const z = s.pl[7].z; drive(s, 1.2); ok('Ohne Stickeingabe läuft die gesteuerte Abwehrfigur selbst mit', hyp(s.pl[7].vx, s.pl[7].vz) > 0.5 || Math.abs(s.pl[7].z - z) > 1);
  const t = live(52, 0, 1); drive(t, 0.8, {}, { x: 1 }); ok('Mit Stick folgt sie der Eingabe', t.pl[t.dc].vx > 4, t.pl[t.dc].vx);
  switchDefender(t); ok('switchDefender wählt eine Abwehrfigur', t.dc >= 4 && t.dc <= 7);
}

console.log('Versuche, Punkte, Ende');
function endPlay(s, z, x = 0) {                    // Träger an eine Stelle setzen und tackeln lassen
  park(s); until(s, (v) => v.ball.own === 3); Object.assign(s.pl[3], { x, z, vx: 0, vz: 0 }); Object.assign(s.pl[7], { x, z: z + 0.4, act: 0, vx: 0, vz: 0, at: 0, blk: 0 }); until(s, (v) => v.ph !== 'live', {}, {}, 2); return s;
}
function nextPlay(s) { until(s, (v) => v.ph === 'pick', {}, {}, 8); drive(s, STEP, { p: 3, n: s.play }, { p: 0, n: s.play }); until(s, (v) => v.ph === 'live', { a: false }, {}, 8); return s; }
{
  const s = live(61, 3, 0), off = s.off; endPlay(s, s.los + 4);
  ok('Tackle: zweiter Versuch ab neuem Punkt', s.down === 2 && s.res.gain > 3.2 && s.res.gain < 4.8 && Math.abs(s.los - s.res.spot) < 0.01, [s.down, s.res]);
  nextPlay(s); endPlay(s, s.line + 0.8); ok('Gelbe Linie erreicht: neue vier Versuche', s.down === 1 && s.res.first && Math.abs(s.line - Math.min(FIELD.goal, s.los + MATCH.gain)) < 0.02 && events(s, 'first').length >= 1);
  for (let i = 0; i < 4; i++) { nextPlay(s); endPlay(s, s.los + 0.3); }
  ok('Vier Versuche ohne Erfolg: Ballwechsel', s.res.over && s.drv[off] === 1 && events(s, 'downs').length >= 1, s.res);
  until(s, (v) => v.ph === 'pick', {}, {}, 8); ok('Jetzt greift die andere Seite an, vom Startpunkt', s.off === 1 - off && s.down === 1 && s.los === MATCH.start);
  const t = live(62, 3, 0), o = t.off; park(t); until(t, (v) => v.ball.own === 3); Object.assign(t.pl[3], { z: FIELD.goal - 0.5, vz: 3 }); until(t, (v) => v.ph !== 'live', { z: 1 }, {}, 2);
  ok('Touchdown zählt einen Punkt und beendet die Serie', t.res.type === 'td' && t.sc[o] === 1 && t.res.over && t.drv[o] === 1);
  const u = live(63, 3, 0); park(u); until(u, (v) => v.ball.own === 3); until(u, (v) => v.ph !== 'live', { x: 1 }, {}, 4); ok('Seitenaus beendet den Spielzug', u.res.type === 'oob' && u.sc.join() === '0,0', u.res);
  const v = throwWith(0.05, 0, 0, 64); Object.assign(v.pl[v.ball.tgt], { x: -v.ball.tx, z: v.ball.tz - 9, act: ACT.down, at: 0, dur: 99 }); const los = v.los; until(v, (x) => x.ph !== 'live', {}, {}, 4);
  ok('Unvollständiger Pass: gleicher Punkt, nächster Versuch', v.res.type === 'incomplete' && v.los === los && v.down === 2, v.res);
  const w = throwWith(0.35, 0, 0, 65); intercept: for (let n = 0; n < 40; n++) { const c = JSON.parse(JSON.stringify(w)); c.rng = n * 991 + 3; const d = c.pl[5]; Object.assign(d, { x: c.ball.tx, z: c.ball.tz, act: 0, cd: 0, at: 0 }); let j = false; for (let i = 0; i < 300 && c.ph === 'live'; i++) { d.x = c.ball.tx; d.z = c.ball.tz; if (d.act === 0 && !j && c.ball.T - c.ball.t < 0.2) { d.act = ACT.jump; d.at = 0; d.dur = ACTION.jump.dur; j = true; } c.pl[c.ball.m === 'air' ? c.ball.tgt : 0].x = c.ball.tx + 1.2; drive(c, STEP); } if (c.res && c.res.type === 'int') { ok('Abgefangen: Serie vorbei, andere Seite kommt dran', c.res.over && c.drv[c.off] === 1 && events(c, 'int').length === 1); break intercept; } if (n === 39) ok('Abgefangen: Serie vorbei', false); }
  const m = live(66, 3, 0); m.t = MATCH.timeCap + 1; m.yd = [m.off === 0 ? 30 : 0, m.off === 1 ? 30 : 0]; const leader = m.off; endPlay(m, m.los + 2); until(m, (x) => x.ph === 'over', {}, {}, 8);
  ok('Zeitnotbremse beendet die Partie, bei Gleichstand zählt der Raumgewinn', m.win === leader && m.yardWin, [m.win, leader, m.yd]);
}
{
  const d = (sc, drv, ot = 0, yd = [0, 0], t = 10) => { const s = sim.create(1); Object.assign(s, { sc, drv, ot, yd, t, events: [] }); const r = decide(s); return [r, s.ot]; };
  ok('Offen, solange aufgeholt werden kann', d([1, 0], [1, 1])[0] === null && d([0, 0], [2, 1])[0] === null && d([1, 0], [2, 1])[0] === null);
  ok('Vorzeitiges Ende, wenn nicht mehr aufholbar', d([2, 0], [2, 1])[0] === 0 && d([0, 1], [1, 1])[0] === null && d([0, 2], [1, 1])[0] === 1 && d([1, 1], [2, 1])[0] === null);
  ok('Nach allen Serien gewinnt, wer führt', d([2, 1], [2, 2])[0] === 0 && d([0, 1], [2, 2])[0] === 1);
  ok('Gleichstand: Verlängerung', d([1, 1], [2, 2]).join() === ',1');
  ok('Verlängerung entschieden', d([2, 1], [3, 3], 1)[0] === 0);
  ok('Letzte Verlängerung ohne Sieger: Raumgewinn, sonst unentschieden', d([1, 1], [5, 5], MATCH.otRounds, [40, 55])[0] === 1 && d([1, 1], [5, 5], MATCH.otRounds, [7, 7])[0] === -1);
}

console.log('Netz');
{
  const s = sim.create(91); let max = 0, bad = 0, n = 0, rt = true;
  while (s.win === null && n++ < 40000) {
    sim.step(s, [I(sim.cpu(s, 0, 'normal')), I(sim.cpu(s, 1, 'normal'))], STEP);
    if (n % 3 === 0) { const text = JSON.stringify(sim.pack(s)); max = Math.max(max, text.length); const u = sim.unpack(JSON.parse(text)); if (!u) bad++; else if (JSON.stringify(sim.pack(u)) !== text) rt = false; }
  }
  ok('Zustand bleibt unter 4 kB', max < 4000, max);
  ok('Jeder gesendete Zustand wird angenommen', bad === 0, bad);
  ok('Auspacken und neu packen verändert nichts', rt);
  const good = JSON.parse(JSON.stringify(sim.pack(live(92))));
  const breakers = [null, 7, 'x', {}, [], (d) => { d.v = 2; }, (d) => { d.ph = 9; }, (d) => { d.o = 2; }, (d) => { d.p.pop(); }, (d) => { d.p[0][0] = 'a'; }, (d) => { d.p[0][5] = 77; }, (d) => { d.p[1] = null; }, (d) => { d.b[7] = 0; }, (d) => { d.b[4] = 99; }, (d) => { d.b = [1]; }, (d) => { d.sc = [1]; }, (d) => { d.sc = [-1, 0]; }, (d) => { d.call = [7, 0]; }, (d) => { d.dc = 0; }, (d) => { d.win = 5; }, (d) => { d.ev = 'x'; }, (d) => { d.ev = [{ id: 1, type: '<img>' }]; }, (d) => { d.ev = [{ id: 1, type: 'td', x: 'a' }]; }, (d) => { d.res = [99, 0, 0, 0, 0, 0]; }, (d) => { d.t = NaN; }, (d) => { d.h = [5, 0]; }, (d) => { d.los = 1e9; }];
  const passed = breakers.filter((f) => { if (typeof f !== 'function') return sim.unpack(f) !== null; const d = JSON.parse(JSON.stringify(good)); f(d); return sim.unpack(d) !== null; });
  ok('Unsinn aus dem Netz wird abgelehnt (' + breakers.length + ' Fälle)', passed.length === 0 && sim.unpack(good) !== null, passed.map(String));
  const extra = JSON.parse(JSON.stringify(good)); extra.ev = [{ id: 1, type: 'td', evil: '<script>' }]; ok('Fremde Felder in Ereignissen werden verworfen', sim.unpack(extra).events[0].evil === undefined);
  const a = live(93); drive(a, 0.5, { x: 1 }); const u1 = sim.unpack(sim.pack(a)); drive(a, 0.1, { x: 1 }); const u2 = sim.unpack(sim.pack(a)), mid = sim.lerp(u1, u2, 0.5);
  ok('Zwischenbild liegt zwischen zwei Zuständen', mid.pl[0].x > u1.pl[0].x && mid.pl[0].x < u2.pl[0].x && sim.lerp(null, u2, 0.5) === u2);
  ok('Kein Überblenden über Spielzuggrenzen', sim.lerp(Object.assign({}, u1, { play: 99 }), u2, 0.5) === u2);
}

console.log('Ganze Partien');
{
  const play = (seed, a, b) => { const s = sim.create(seed); let n = 0, finite = true; while (s.win === null && n++ < 60 * 400) { sim.step(s, [typeof a === 'string' ? I(sim.cpu(s, 0, a)) : I(a(s, n)), typeof b === 'string' ? I(sim.cpu(s, 1, b)) : I(b(s, n))], STEP); if (n % 20 === 0 && !s.pl.every((p) => Number.isFinite(p.x + p.z + p.vx + p.vz))) finite = false; } return { s, finite }; };
  let ended = 0, tmin = 1e9, tmax = 0, sum = 0; const types = new Set();
  for (let i = 0; i < 60; i++) { const { s } = play(700 + i, 'normal', 'normal'); if (s.win !== null) ended++; tmin = Math.min(tmin, s.t); tmax = Math.max(tmax, s.t); sum += s.t; for (const e of s.events) types.add(e.type); }
  console.log('    Dauer in Spielsekunden: ' + tmin.toFixed(0) + ' bis ' + tmax.toFixed(0) + ', Mittel ' + (sum / 60).toFixed(0));
  ok('60 Computerpartien enden alle', ended === 60, ended);
  ok('Dauer im Mittel 1,5 bis 3,5 Minuten, nie über 4,4', sum / 60 > 90 && sum / 60 < 210 && tmax < 265, [sum / 60, tmax]);
  const idle = play(5, () => ({}), () => ({}));
  ok('Auch wenn niemand etwas tut, endet die Partie', idle.s.win !== null && idle.s.t < 265, [idle.s.t, idle.s.sc]);
  let ok2 = true; for (let i = 0; i < 8; i++) { const mash = (k) => (s, n) => { const h = (n * 7 + k * 13 + i) >> 3; return { x: Math.sin(h * 1.3), z: Math.cos(h * 0.7), a: h % 5 === 0, b: h % 7 === 0, c: h % 4 === 0, d: h % 3 === 0, r: h % 11 === 0 ? h % 3 : -1, p: h % 4, n: s.play }; }; const r = play(900 + i, mash(0), mash(1)); ok2 = ok2 && r.s.win !== null && r.finite; }
  ok('Wildes Drücken auf beiden Seiten: keine kaputten Werte, Partie endet', ok2);
  const versus = (a, b, N) => { let w = 0, l = 0; for (let i = 0; i < N; i++) { const flip = i % 2, { s } = play(1200 + i, flip ? b : a, flip ? a : b); if (s.win === (flip ? 1 : 0)) w++; else if (s.win === (flip ? 0 : 1)) l++; } return [w, l]; };
  const hn = versus('hard', 'normal', 60), ne = versus('normal', 'easy', 60), he = versus('hard', 'easy', 40);
  console.log('    Siege:Niederlagen  schwer-normal ' + hn.join(':') + '  normal-leicht ' + ne.join(':') + '  schwer-leicht ' + he.join(':'));
  ok('Schwer schlägt Normal klar öfter', hn[0] > hn[1] * 1.3, hn);
  ok('Normal schlägt Leicht klar öfter', ne[0] > ne[1] * 1.8, ne);
  ok('Schwer schlägt Leicht fast immer', he[0] >= 32, he);
  const s = sim.create(3); sim.cpu(s, 1, 'easy'); ok('Handicap gilt nur für die Computerseite', s.bot[1] === 'easy' && s.bot[0] === null);
  ok('Phasenliste passt zur Logik', PHASES.length === 5 && PLAYS.length === 4 && FORMATIONS.length === 3 && MOVE.sprint > 1);
}
console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
