// Regeltests der Logik, ohne Grafik.   node tests/sim-test.mjs
import fs from 'node:fs';
import { sim, ACT, JOB, dirOf, teamOf, topSpeed, passTarget } from '../src/sim.js';
import { PITCH, MATCH, KICK, TACKLE } from '../src/config.js';

const STEP = 1 / 60;
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 300) : '')); } };
const idle = () => sim.cleanInput({});
const press = (o) => sim.cleanInput(o);
function run(s, sec, a = idle, b = idle) { const n = Math.round(sec * 60); for (let k = 0; k < n; k++) sim.step(s, [typeof a === 'function' ? a(s, k) : a, typeof b === 'function' ? b(s, k) : b], STEP); return s; }
function until(s, cond, sec = 20, a = idle, b = idle) { const n = Math.round(sec * 60); for (let k = 0; k < n; k++) { if (cond(s)) return true; sim.step(s, [typeof a === 'function' ? a(s, k) : a, typeof b === 'function' ? b(s, k) : b], STEP); } return cond(s); }
// Spielszene: alle Spieler weit weg an den Rand, dann gezielt aufstellen
function scene(seed = 1, level = 'normal') {
  const s = sim.create(seed, { level }); s.ph = 'play'; s.pt = 0; s.rs = null;
  for (let i = 0; i < 22; i++) { const p = s.pl[i]; p.x = -30 + (i % 11) * 6; p.z = (i < 11 ? -1 : 1) * 32; p.tx = p.x; p.tz = p.z; p.vx = p.vz = 0; p.act = 0; p.cd = 0; }
  s.pl[0].x = -51; s.pl[0].z = 0; s.pl[11].x = 51; s.pl[11].z = 0;
  s.think = [99, 99]; const b = s.ball; b.own = -1; b.x = 0; b.z = 0; b.y = 0.11; b.vx = b.vy = b.vz = 0; s.pass = null; s.shot = null;
  return s;
}
function hold(s, i, x, z, f = 0) { const p = s.pl[i]; p.x = x; p.z = z; p.tx = x; p.tz = z; p.f = f; p.cd = 0; const b = s.ball; b.own = i; b.last = i; b.hands = false; b.x = x + Math.cos(f) * 0.55; b.z = z + Math.sin(f) * 0.55; b.y = 0.11; s.ctl[teamOf(i)] = i; s.poss = teamOf(i); return p; }
const free = (s, x, z, vx = 0, vz = 0, y = 0.11, vy = 0, last = 0) => { Object.assign(s.ball, { own: -1, x, z, y, vx, vz, vy, last, hands: false }); };

console.log('Grundlagen');
{
  const src = fs.readFileSync(new URL('../src/sim.js', import.meta.url), 'utf8');
  ok('Logik nutzt weder Math.random noch Uhr oder DOM', !/Math\.random|Date\.now|performance\.|document\.|window\./.test(src));
  const play = (seed) => { const s = sim.create(seed, { level: 'normal' }); for (let k = 0; k < 3600; k++) sim.step(s, [sim.cpu(s, 0), sim.cpu(s, 1)], STEP); return JSON.stringify(s); };
  ok('gleicher Startwert, gleiches Spiel', play(5) === play(5));
  ok('anderer Startwert, anderes Spiel', play(5) !== play(6));
  const a = sim.create(9); for (let k = 0; k < 1200; k++) sim.step(a, [sim.cpu(a, 0), sim.cpu(a, 1)], STEP);
  const b = JSON.parse(JSON.stringify(a));
  for (let k = 0; k < 600; k++) { sim.step(a, [sim.cpu(a, 0), sim.cpu(a, 1)], STEP); sim.step(b, [sim.cpu(b, 0), sim.cpu(b, 1)], STEP); }
  ok('Zustand ist reines JSON (nach Kopie läuft es identisch weiter)', JSON.stringify(a) === JSON.stringify(b));
  const s = sim.create(2);
  ok('22 Spieler, Spielstand 0:0, Sieger offen', s.pl.length === 22 && sim.score(s).join() === '0,0' && sim.winner(s) === null);
  ok('Anstoß: jeder steht in seiner Hälfte', s.pl.every((p, i) => p.x * dirOf(s, teamOf(i)) <= 0.01), s.pl.map((p) => Math.round(p.x)));
  ok('Anstoß: Gegner außerhalb des Mittelkreises', s.pl.every((p, i) => teamOf(i) === s.rs.team || Math.hypot(p.x, p.z) >= PITCH.circle));
  ok('Anstoß: der Ausführende hat den Ball', s.ball.own === s.rs.taker && s.ctl[s.rs.team] === s.rs.taker);
  for (const junk of [null, undefined, 5, 'x', [], { x: NaN, z: Infinity, pass: 'ja', shoot: 1 }, { x: 99, z: -99 }]) {
    const c = sim.cleanInput(junk);
    if (!(Number.isFinite(c.x) && Number.isFinite(c.z) && Math.hypot(c.x, c.z) <= 1.02 && ['pass', 'through', 'shoot', 'sprint', 'switch'].every((k) => typeof c[k] === 'boolean'))) { ok('Eingabeprüfung bei Unsinn', false, junk); break; }
  }
  ok('Eingabeprüfung liefert immer Gültiges', true);
  ok('Eingabeprüfung: nur echte Wahrheitswerte zählen', sim.cleanInput({ pass: 'ja', shoot: 1 }).pass === false && sim.cleanInput({ shoot: 1 }).shoot === false);
}

console.log('Netzpaket');
{
  const s = sim.create(4); let max = 0, bad = 0, drift = 0;
  for (let k = 0; k < 30000 && sim.winner(s) === null; k++) {
    sim.step(s, [sim.cpu(s, 0), sim.cpu(s, 1)], STEP);
    if (k % 3) continue;
    const text = JSON.stringify(sim.pack(s)); max = Math.max(max, text.length);
    const u = sim.unpack(JSON.parse(text)); if (!u) { bad++; continue; }
    drift = Math.max(drift, ...u.pl.map((p, i) => Math.hypot(p.x - s.pl[i].x, p.z - s.pl[i].z)), Math.hypot(u.ball.x - s.ball.x, u.ball.z - s.ball.z));
    if (u.ph !== s.ph || u.sc.join() !== s.sc.join() || u.ball.own !== s.ball.own || u.ctl.join() !== s.ctl.join()) bad++;
  }
  ok('jedes Paket eines ganzen Spiels lässt sich entpacken (auch Endstand)', bad === 0 && sim.winner(s) !== null, bad);
  ok('Paket mit Hülle unter 1,5 kB (größtes: ' + max + ' B)', max < 1450, max);
  ok('Rundung höchstens 2 cm', drift <= 0.02, drift);
  const good = () => JSON.parse(JSON.stringify(sim.pack(sim.create(8))));
  ok('frisches Paket gültig', !!sim.unpack(good()));
  const junk = [null, undefined, 0, 'x', [], {}, { v: 2 }];
  const broken = (fn) => { const d = good(); fn(d); junk.push(d); };
  broken((d) => { d.v = 2; }); broken((d) => { delete d.h; }); broken((d) => d.h.pop()); broken((d) => { d.h[0] = 7; }); broken((d) => { d.h[2] = 3; }); broken((d) => { d.h[6] = 22; }); broken((d) => { d.h[11] = 5; });
  broken((d) => { d.b[0] = 1.5; }); broken((d) => { d.b[0] = 1e9; }); broken((d) => { d.b[6] = 22; }); broken((d) => { d.b = 'abc'; }); broken((d) => d.p.pop()); broken((d) => { d.p[3] = null; }); broken((d) => { d.p[5] = 99; }); broken((d) => { d.p = {}; });
  broken((d) => { d.r = 5; }); broken((d) => { d.r = [9, 0, 0, 0, 0]; }); broken((d) => { d.r = 0; }); broken((d) => { d.c = [1]; }); broken((d) => { d.s[0] = -1; }); broken((d) => { d.e = 1; }); broken((d) => { d.e = [[1, 99, 0, 0, 0, 0, 0, 0]]; }); broken((d) => { d.e = Array(40).fill([1, 0, 0, 0, 0, 0, 0, 0]); }); broken((d) => { d.e = [null]; });
  const leaked = junk.filter((j) => { try { return sim.unpack(j) !== null; } catch (e) { return true; } });
  ok(junk.length + ' kaputte Pakete geben alle null und werfen nicht', leaked.length === 0, leaked.slice(0, 2));
  const a = sim.unpack(good()), b = sim.unpack(good()); b.pl[3].x = a.pl[3].x + 1; b.pl[4].x = a.pl[4].x + 30;
  const m = sim.lerp(a, b, 0.5);
  ok('Zwischenbild mittelt Bewegungen', Math.abs(m.pl[3].x - (a.pl[3].x + 0.5)) < 1e-9);
  ok('Zwischenbild verschleift Sprünge nicht', m.pl[4].x === b.pl[4].x);
}

console.log('Pässe');
{
  const s = sim.create(3, { level: 'normal' }); const t = s.rs.team, inputs = (v) => (t === 0 ? [v, idle()] : [idle(), v]);
  const tap = press({ pass: true, x: -dirOf(s, t), z: 0.4 });
  for (let k = 0; k < 20; k++) sim.step(s, inputs(tap), STEP);
  ok('vor der Freigabe führt niemand den Anstoß aus', s.ph === 'set' && s.stats.pas[t] === 0);
  for (let k = 0; k < 50; k++) sim.step(s, inputs(idle()), STEP);
  for (let k = 0; k < 6; k++) sim.step(s, inputs(tap), STEP);
  for (let k = 0; k < 20; k++) sim.step(s, inputs(idle()), STEP);
  ok('PASS führt den Anstoß aus', s.ph === 'play' && s.stats.pas[t] === 1 && s.ball.own !== s.pass?.from, [s.ph, s.stats.pas]);
  ok('Steuerung wechselt zum Angespielten', s.pass ? s.ctl[t] === s.pass.to : teamOf(s.ball.own) === t);
}
function kicked(kind, holdSec, mateX = 22) {
  const s = scene(11); hold(s, 7, -5, 0, 0); const q = s.pl[9]; q.x = mateX; q.z = 1; q.tx = q.x; q.tz = q.z;
  const input = press({ [kind]: true, x: 1, z: 0 });
  run(s, holdSec, input); until(s, (v) => v.ball.own !== 7, 2);
  return s;
}
{
  const short = kicked('pass', 0.08, 8), long = kicked('pass', 0.8, 22);
  ok('Kurzpass fliegt flach', short.ball.vy === 0 && short.ball.y < 0.2);
  ok('weiter Pass ist schneller als kurzer', Math.hypot(long.ball.vx, long.ball.vz) > Math.hypot(short.ball.vx, short.ball.vz) + 3);
  ok('Kurzpass kommt beim Mitspieler an', until(short, (v) => v.ball.own === 9, 4), [short.ball.own, short.ball.x, short.pl[9].x]);
  ok('angekommener Pass zählt in der Statistik', short.stats.cmp[0] === 1 && short.stats.pas[0] === 1);
  const through = kicked('through', 0.2), normal = kicked('pass', 0.2);
  ok('Steilpass zielt deutlich vor den Mann', through.pass.x > normal.pass.x + 4, [through.pass.x, normal.pass.x]);
  const up = scene(12); hold(up, 7, -5, 0, 0); up.pl[9].x = 12; up.pl[9].z = 0;
  run(up, 0.05, press({ pass: true, x: 1 })); run(up, 0.1, press({ pass: true, through: true, x: 1 })); until(up, (v) => v.ball.own !== 7, 2);
  ok('Wisch während des Passens macht daraus einen Steilpass', up.pass && up.pass.x > 15, up.pass);
  const two = scene(13); hold(two, 7, 0, 0, 0); two.pl[9].x = 15; two.pl[9].z = 8; two.pl[10].x = 15; two.pl[10].z = -8;
  ok('Stickrichtung wählt den Mitspieler', passTarget(two, 7, 0.8, 0.6, 0.2, false).j === 9 && passTarget(two, 7, 0.8, -0.6, 0.2, false).j === 10);
}

console.log('Schüsse, Tor, Gestänge');
{
  const shoot = (holdSec, z = 0) => { const s = scene(21); s.pl[11].z = 30; s.pl[11].x = 20; hold(s, 9, 36, z, 0); run(s, holdSec, press({ shoot: true, x: 1 })); until(s, (v) => v.ball.own !== 9, 2); return s; };
  const soft = shoot(0.1), hard = shoot(0.75), v = (s) => Math.hypot(s.ball.vx, s.ball.vz);
  ok('Schussstärke wächst mit der Haltezeit', v(hard) > v(soft) + 6, [v(soft), v(hard)]);
  ok('Tempo im erlaubten Bereich', v(soft) >= KICK.shotMin - 1 && v(hard) <= KICK.shotMax + 0.5);
  ok('Schuss wird gezählt', soft.stats.sh[0] === 1);
  ok('Schuss ins leere Tor ist ein Tor', until(hard, (s) => s.ph === 'goal', 3) && hard.sc[0] === 1, [hard.ph, hard.sc, hard.ball.x, hard.ball.z]);
  ok('Tor zählt als Schuss aufs Tor', hard.stats.on[0] === 1);
  ok('Ball bleibt im Netz', (run(hard, 1.5), Math.abs(hard.ball.x) < PITCH.halfL + PITCH.goalDepth + 0.1 && Math.abs(hard.ball.z) < PITCH.goalHalf));
  ok('nach dem Tor stößt die andere Mannschaft an', until(hard, (s) => s.ph === 'set', 6) && hard.rs.k === 'kickoff' && hard.rs.team === 1);
  const p = scene(22); free(p, 48, PITCH.goalHalf, 20, 0); p.pl[11].z = 30; p.pl[11].x = 20; until(p, (s) => s.ball.vx < 0, 1);
  ok('Pfosten prallt zurück', p.ball.vx < 0 && p.sc[0] === 0 && p.events.some((e) => e.type === 'post'), [p.ball.vx, p.sc]);
  const c = scene(23); free(c, 49, 0, 20, 0, 2.3, 1.6); c.pl[11].z = 30; c.pl[11].x = 20; until(c, (s) => s.ball.vx < 0 || s.ph !== 'play', 1);
  ok('Latte hält den Ball', c.sc[0] === 0 && c.ball.vx < 0, [c.sc, c.ball.vx, c.ball.y]);
  const far = scene(24); hold(far, 3, -30, 0, 0); run(far, 0.5, press({ shoot: true, x: 1 })); until(far, (s) => s.ball.own !== 3, 2);
  ok('Schuss aus der eigenen Hälfte ist ein Befreiungsschlag', far.stats.sh[0] === 0 && far.ball.vy > 3);
}

console.log('Ball aus dem Spiel');
{
  const out = (x, z, vx, vz, last, y = 0.11) => { const s = scene(31); free(s, x, z, vx, vz, y, 0, last); until(s, (v) => v.ph === 'set', 2); return s; };
  const a = out(5, 32, 0, 12, 3); ok('Seitenaus: Einwurf für den Gegner', a.rs?.k === 'throw' && a.rs.team === 1 && a.ball.hands, a.rs);
  const b = out(50, 15, 14, 0, 9); ok('Angreifer zuletzt: Abstoß', b.rs?.k === 'goalkick' && b.rs.team === 1 && b.rs.taker === 11, b.rs);
  const c = out(50, 15, 14, 0, 13); ok('Verteidiger zuletzt: Ecke', c.rs?.k === 'corner' && c.rs.team === 0, c.rs);
  ok('Ecke: Angreifer im Strafraum', c.pl.filter((p, i) => i > 0 && i < 11 && p.x > PITCH.halfL - PITCH.boxDepth - 2 && Math.abs(p.z) < PITCH.boxHalf).length >= 4);
  ok('Ecke: Gegner halten Abstand', c.pl.every((p, i) => i < 11 || Math.hypot(p.x - c.rs.x, p.z - c.rs.z) >= PITCH.circle - 1));
  const d = out(5, 32, 0, 12, 3, 0.11); ok('Standard wird ohne Eingabe nach spätestens 7 s ausgeführt', until(d, (s) => s.ph === 'play', MATCH.setAuto + 1));
  for (const [x, z, vx, last, name] of [[50, 15, 14, 9, 'Abstoß'], [50, -15, 14, 13, 'Ecke']]) { const s = out(x, z, vx, 0, last); ok(name + ' wird automatisch ausgeführt', until(s, (v) => v.ph === 'play', MATCH.setAuto + 1)); }
  const walk = scene(32); hold(walk, 7, 10, 33.4, Math.PI / 2); until(walk, (s) => s.ph === 'set', 3, press({ z: 1 }));
  ok('ins Aus dribbeln gibt Einwurf', walk.rs?.k === 'throw' && walk.rs.team === 1, walk.rs);
}

console.log('Torhüter');
{
  let saved = 0, goals = 0, other = 0;
  for (let k = 0; k < 200; k++) {
    const s = scene(400 + k); const z = ((k % 21) - 10) * 0.32; hold(s, 9, 34 + (k % 5), z * 0.5, 0); s.think = [99, 99];
    run(s, 0.15 + (k % 6) * 0.1, press({ shoot: true, x: 0.8, z: (k % 3 - 1) * 0.6 })); until(s, (v) => v.ph !== 'play' || v.stats.sav[1] > 0 || (v.ball.own === 11), 3);
    if (s.stats.sav[1] || s.ball.own === 11) saved++; else if (s.sc[0]) goals++; else other++;
  }
  const rate = saved / (saved + goals);
  ok('Torwart hält einen sinnvollen Teil freier Schüsse (' + saved + ' gehalten, ' + goals + ' Tore, ' + other + ' vorbei)', rate > 0.25 && rate < 0.85, rate);
  const c = scene(41); free(c, 44, 0.2, 8, 0, 0.5, 1, 9); ok('langsamen Ball fängt er', until(c, (s) => s.ball.own === 11 && s.ball.hands, 3), [c.ball.own, c.ph]);
  run(c, 3, idle(), press({ x: -1, sprint: true }));
  ok('mit Ball in der Hand bleibt er im Strafraum', c.ball.own !== 11 || c.pl[11].x >= PITCH.halfL - PITCH.boxDepth, c.pl[11].x);
  ok('er gibt den Ball spätestens nach 8 s ab', until(c, (s) => s.ball.own !== 11, 9));
  const r = scene(42); free(r, 42, 8, 0, 0, 0.11, 0, 9); r.pl[11].x = 49; ok('er holt freie Bälle im Strafraum', until(r, (s) => s.ball.own === 11, 5), [r.pl[11].x, r.pl[11].z]);
  const t = scene(43); t.pl[11].x = 49.5; t.pl[11].z = 0; hold(t, 9, 30, 0, 0); run(t, 0.1);
  ok('Torwart steht zwischen Ball und Tor', Math.abs(t.pl[11].z) < 1.5 && t.pl[11].x > 44);
}

console.log('Laufen, Wechsel, Zweikampf');
{
  const sp = (sprint) => { const s = scene(51); s.ctl[0] = 7; const p = s.pl[7]; p.x = -30; p.z = 0; free(s, 40, 30); run(s, 2, press({ x: 1, sprint })); return p; };
  const walk = sp(false), dash = sp(true);
  ok('wer selbst steuert, behält seinen Spieler', walk.x > -22 && dash.x > -18, [walk.x, dash.x]);
  ok('Sprint ist schneller', dash.x > walk.x + 1.5, [walk.x, dash.x]);
  ok('Sprint kostet Ausdauer', dash.st < 0.85 && walk.st > 0.99, dash.st);
  const a = scene(52); a.pl[7].x = -30; ok('Beschleunigung statt Sofortstart', (run(a, 0.1, press({ x: 1 })), a.pl[7].vx < 4));
  const c = scene(53); hold(c, 7, 0, 0); ok('mit Ball etwas langsamer', topSpeed(c, 7, true) < topSpeed({ ...c, ball: { ...c.ball, own: -1 } }, 7, true));
  const w = scene(54); hold(w, 15, 0, 0, Math.PI); w.pl[7].x = -20; w.pl[7].z = 0; w.pl[6].x = -4; w.pl[6].z = 1; w.pl[8].x = -9; w.pl[8].z = 0; w.pl[7].z = 4; w.ctl[0] = 7;
  run(w, STEP, press({ switch: true }));
  ok('WECHSEL nimmt den Spieler am Ball', w.ctl[0] === 6, w.ctl);
  run(w, STEP); run(w, STEP, press({ switch: true }));
  ok('nochmals WECHSEL nimmt den nächsten', w.ctl[0] === 8, w.ctl);
  let keeper = false; for (let k = 0; k < 30; k++) { run(w, STEP); run(w, STEP, press({ switch: true })); if (w.ctl[0] === 0) keeper = true; }
  ok('der Torwart wird nie angewählt', !keeper);
  const au = scene(55); au.ctl[0] = 2; au.pl[2].x = -40; au.pl[6].x = -3; au.pl[6].z = 0; hold(au, 15, 0, 0, Math.PI); au.ball.own = -1; au.poss = 0; au.swAt = [0, 0];
  free(au, 0.5, 0, 0, 0, 0.11, 0, 15); au.pl[15].x = 0.6; run(au, 1.0);
  ok('automatischer Wechsel nach Ballverlust', au.ctl[0] === 6 || au.ball.own === au.ctl[0], [au.ctl, au.ball.own]);
  const trial = (kind, front) => {
    let won = 0;
    for (let k = 0; k < 300; k++) {
      const s = scene(600 + k); hold(s, 15, 0, 0, Math.PI); s.imm = 0; const o = s.pl[7]; o.x = front ? -1.5 : 1.5; o.z = 0; o.f = front ? 0 : Math.PI; s.ctl[0] = 7;
      if (kind === 'slide') { o.x = front ? -2.6 : 2.6; run(s, STEP, press({ shoot: true, x: front ? 1 : -1 })); run(s, 0.6); }
      else { o.x = front ? -1.2 : 1.7; run(s, STEP, press({ pass: true })); run(s, 0.05); }
      if (s.stats.tkl[0] > 0) won++;
    }
    return won / 300;
  };
  const f = trial('stand', true), b = trial('stand', false), sl = trial('slide', true);
  ok('Zweikampf von vorn gelingt teils (' + Math.round(f * 100) + ' %)', f > 0.3 && f < 0.85, f);
  ok('von hinten schlechter (' + Math.round(b * 100) + ' %)', b < f - 0.15, [f, b]);
  ok('Grätsche in den Ball trifft meist (' + Math.round(sl * 100) + ' %)', sl > 0.6, sl);
  const m = scene(61); hold(m, 15, 20, 20); m.pl[7].x = 0; m.pl[7].z = 0; m.ctl[0] = 7; run(m, STEP, press({ shoot: true, x: -1 })); ok('Grätsche beginnt', m.pl[7].act === ACT.slide); run(m, TACKLE.slideTime + 0.05); ok('danebengerutscht: liegt kurz am Boden', m.pl[7].act === ACT.down, m.pl[7].act); run(m, 1); ok('und steht wieder auf', m.pl[7].act === ACT.run);
  const pr = scene(62); hold(pr, 15, 10, 0, Math.PI); pr.imm = 1e9; pr.pl[7].x = -5; pr.pl[7].z = 3; pr.ctl[0] = 7; run(pr, 1.2, press({ pass: true })); ok('DRUCK halten läuft den Gegner an', Math.hypot(pr.pl[7].x - 10, pr.pl[7].z) < 11, [pr.pl[7].x, pr.pl[7].z]);
}

console.log('Mannschaftsverhalten');
{
  const s = sim.create(71); let maxPress = 0, maxChase = 0;
  for (let k = 0; k < 20000; k++) { sim.step(s, [sim.cpu(s, 0), sim.cpu(s, 1)], STEP); if (s.ph === 'play') for (const t of [0, 1]) { const m = s.pl.slice(t * 11 + 1, t * 11 + 11); maxPress = Math.max(maxPress, m.filter((p) => p.job === JOB.press).length); maxChase = Math.max(maxChase, m.filter((p) => p.job === JOB.chase || p.job === JOB.receive || p.job === JOB.press || p.job === JOB.cover).length); } }
  ok('nie mehr als ein Angreifer des Ballführenden je Mannschaft', maxPress <= 1, maxPress);
  ok('nie mehr als drei Spieler mit Ballauftrag', maxChase <= 3, maxChase);
}

console.log('Spielablauf');
{
  const s = sim.create(81); s.clock = MATCH.half - 0.5; s.ph = 'play'; s.rs = null; const d0 = dirOf(s, 0), first = s.first;
  ok('Halbzeit nach drei Minuten', until(s, (v) => v.ph === 'half', 6));
  ok('Seitenwechsel und Anstoß der anderen Mannschaft', until(s, (v) => v.ph === 'set', 6) && s.half === 2 && dirOf(s, 0) === -d0 && s.rs.team === 1 - first);
  s.clock = MATCH.half - 0.5; s.ph = 'play'; s.rs = null; s.sc = [2, 1];
  ok('Abpfiff mit Sieger', until(s, (v) => v.ph === 'over', 6) && sim.winner(s) === 0);
  const u = sim.create(82); u.half = 2; u.clock = MATCH.half; u.ph = 'play'; u.rs = null; run(u, 0.1); ok('Gleichstand ergibt Unentschieden', sim.winner(u) === -1);
  const full = (a, b, seed) => { const v = sim.create(seed); let n = 0; while (sim.winner(v) === null && n++ < 60000) sim.step(v, [a(v, 0, n), b(v, 1, n)], STEP); return { v, n }; };
  const lazy = full(() => idle(), (v) => sim.cpu(v, 1), 83);
  ok('Mensch ohne jede Eingabe: Spiel endet trotzdem', sim.winner(lazy.v) !== null, [lazy.n, lazy.v.ph]);
  const none = full(() => idle(), () => idle(), 84); ok('ganz ohne Eingaben: Spiel endet', sim.winner(none.v) !== null);
  let seed = 99; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let bad = 0;
  for (let k = 0; k < 15; k++) {
    const held = [{}, {}];
    const chaos = (v, side, n) => { if (n % (3 + side * 4) === 0) held[side] = { x: rnd() * 2 - 1, z: rnd() * 2 - 1, pass: rnd() < 0.3, through: rnd() < 0.15, shoot: rnd() < 0.2, sprint: rnd() < 0.5, switch: rnd() < 0.2 }; return sim.cleanInput(held[side]); };
    const r = full(chaos, chaos, 900 + k);
    if (sim.winner(r.v) === null || !r.v.pl.every((p) => Number.isFinite(p.x + p.z + p.vx + p.vz + p.f)) || !Number.isFinite(r.v.ball.x + r.v.ball.y + r.v.ball.z) || !sim.unpack(sim.pack(r.v))) bad++;
  }
  ok('15 Spiele mit wilden Zufallseingaben enden sauber', bad === 0, bad);
}

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`); process.exit(fail ? 1 : 0);
