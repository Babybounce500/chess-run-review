// Prüft die Spiellogik ohne Browser.   node tests/sim-test.mjs
import { sim, setupCheck, greenZone, pressure, hoopDist, ballFlight, EVENTS } from '../src/sim.js';
import { COURT, HOOP, BALL, PLAYER, SHOT, MOVES, MATCH } from '../src/config.js';

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 500) : '')); } };
const DT = 1 / 60;
const N = () => sim.cleanInput({});
const I = (o) => sim.cleanInput(o);

// Laufende Szene: Seite 0 hat den Ball, Gegner weit weg
function scene({ seed = 1, a = {}, b = {}, need = false } = {}) {
  const s = sim.create(seed, {});
  setupCheck(s, 0); s.phase = 'live'; s.pt = 0; s.events = []; s.need = need;
  Object.assign(s.p[0], { x: 0, z: 6.5, f: Math.PI }, a);
  Object.assign(s.p[1], { x: 5.8, z: 10.5, f: 0 }, b);
  return s;
}
const seenTypes = new Set();
function run(s, seconds, i0 = N, i1 = N, until) {
  const log = []; let seen = s.eventId;
  for (let t = 0; t < Math.round(seconds / DT); t++) {
    sim.step(s, [typeof i0 === 'function' ? i0(s, t) : i0, typeof i1 === 'function' ? i1(s, t) : i1], DT);
    for (const e of s.events) if (e.id > seen) { seen = e.id; log.push(e); seenTypes.add(e.type); }
    if (until && until(s, log)) break;
  }
  return log;
}
const has = (log, type) => log.some((e) => e.type === type);
// Werfen: WURF halten und bei "charge" loslassen
const shoot = (charge) => (s) => { const p = s.p[0]; return I({ a: p.act === 'gather' ? p.ch + DT / SHOT.full < charge : p.act === 'free' && s.ball.own === 0 && !s.fired }); };
function oneShot(s, charge) {
  const ctl = shoot(charge);
  return run(s, 5, (st) => { const i = ctl(st); if (st.p[0].act === 'follow') st.fired = true; return i; }, N, (st, log) => has(log, 'score') || has(log, 'rebound') || has(log, 'violation'));
}

console.log('1  Grundlagen und Netzdaten');
{
  const play = (seed) => { const s = sim.create(seed, {}); for (let t = 0; t < 3000; t++) sim.step(s, [sim.cpu(s, 0, 'normal', DT), sim.cpu(s, 1, 'hard', DT)], DT); return JSON.stringify(s); };
  ok('Gleicher Startwert und gleiche Eingaben ergeben genau dasselbe Spiel', play(77) === play(77));
  ok('Anderer Startwert ergibt ein anderes Spiel', play(77) !== play(78));
  const first = new Set(); for (let i = 0; i < 40; i++) first.add(sim.create(i * 991 + 5, {}).off);
  ok('Erster Ball wird ausgelost', first.size === 2);
  const s = sim.create(5, {}); ok('Zustand ist reines JSON', JSON.stringify(JSON.parse(JSON.stringify(s))) === JSON.stringify(s));
  let max = 0, bad = 0, types = new Set();
  for (let g = 0; g < 6; g++) {
    const q = sim.create(900 + g, {}); let seen = 0;
    for (let t = 0; t < 20000 && q.winner === null; t++) {
      sim.step(q, [sim.cpu(q, 0, 'hard', DT), sim.cpu(q, 1, 'normal', DT)], DT);
      for (const e of q.events) if (e.id > seen) { seen = e.id; types.add(e.type); }
      if (t % 7 === 0) { const text = JSON.stringify(sim.pack(q)); max = Math.max(max, text.length); const u = sim.unpack(JSON.parse(text)); if (!u || u.p.length !== 2 || u.score[0] !== q.score[0]) bad++; }
    }
  }
  ok('Netzpaket bleibt unter 4 kB', max < 4000, max);
  ok('Jeder echte Zustand übersteht die strenge Prüfung', bad === 0, bad);
  ok('Alle gemeldeten Ereignisse stehen in der Prüfliste', [...types].every((t) => EVENTS.includes(t)), [...types].filter((t) => !EVENTS.includes(t)));
  const good = sim.pack(sim.create(3, {}));
  const broken = [null, 5, 'x', {}, { ...good, p: [good.p[0]] }, { ...good, score: [0, -1] }, { ...good, phase: 'hack' }, { ...good, ball: { ...good.ball, x: 'a' } }, { ...good, ball: { ...good.ball, x: 1e9 } }, { ...good, p: [good.p[0], { ...good.p[1], act: '<b>' }] }, { ...good, events: [{ id: 1, type: 'böse' }] }, { ...good, events: new Array(13).fill({ id: 1, type: 'rim' }) }, { ...good, events: [{ id: 1, type: 'score', side: 9 }] }, { ...good, clock: NaN }, { ...good, winner: 7 }];
  ok('Unsinnige Pakete werden abgelehnt', broken.every((d) => sim.unpack(d) === null), broken.map((d) => sim.unpack(d) === null));
  const extra = sim.unpack({ ...good, evil: 1, p: [{ ...good.p[0], evil: 2 }, good.p[1]] });
  ok('Fremde Felder werden verworfen', extra && !('evil' in extra) && !('evil' in extra.p[0]) && !('ai' in extra));
  const c = [sim.cleanInput(null), sim.cleanInput({ x: 99, y: -99, a: 1, m: 50 }), sim.cleanInput({ x: NaN, y: 'a', m: 'x' })];
  ok('Eingaben werden immer begrenzt', c[0].x === 0 && c[0].m === -1 && Math.hypot(c[1].x, c[1].y) <= 1.0001 && c[1].a === true && c[1].m === 1.2 && c[2].x === 0 && c[2].y === 0 && c[2].m === -1, c);
  const a = scene(), b = JSON.parse(JSON.stringify(a)); b.p[0].x = a.p[0].x + 0.4; b.p[1].x = -5; b.ball.x = 5;
  const m = sim.lerp(a, b, 0.5);
  ok('Zwischenbild glättet kleine Wege, aber kein Versetzen', Math.abs(m.p[0].x - 0.2) < 1e-6 && m.p[1].x === -5 && m.ball.x === 5, [m.p[0].x, m.p[1].x, m.ball.x]);
}

console.log('2  Bewegung');
{
  let s = scene({ a: { x: 0, z: 8 } }); const right = I({ x: 1 });
  run(s, DT, right); const v1 = s.p[0].vx; run(s, 0.12, right); const v2 = s.p[0].vx; run(s, 0.4, right); const v3 = s.p[0].vx;
  ok('Anlaufen mit Beschleunigung', v1 > 0 && v1 < 0.5 && v2 > v1 && v2 < v3 && Math.abs(v3 - PLAYER.speed * PLAYER.ballFactor) < 0.05, [v1, v2, v3]);
  run(s, DT, N); const w1 = s.p[0].vx; run(s, 0.4, N); ok('Abbremsen statt Sofortstopp', w1 > v3 * 0.75 && s.p[0].vx === 0, [w1, s.p[0].vx]);
  s = scene({ a: { x: -3, z: 8 } }); run(s, 0.5, I({ x: 1 })); run(s, 0.05, I({ x: -1 })); const turn = s.p[0].vx; run(s, 0.5, I({ x: -1 }));
  ok('Richtungswechsel dauert kurz', turn > 0.5 && s.p[0].vx < -3, [turn, s.p[0].vx]);
  s = scene({ a: { x: -5.5, z: 9 } }); run(s, 0.8, I({ x: 1, c: true }));
  ok('Sprint ist schneller und kostet Ausdauer', s.p[0].vx > 5.2 && s.p[0].st < 0.85, [s.p[0].vx, s.p[0].st]);
  s = scene(); let dir = 1; run(s, 5, (q) => { if (q.p[0].x > 4) dir = -1; if (q.p[0].x < -4) dir = 1; return I({ x: dir, c: true }); });
  ok('Ohne Ausdauer kein Sprint', s.p[0].tired && Math.hypot(s.p[0].vx, s.p[0].vz) < PLAYER.speed, [s.p[0].st, s.p[0].vx]);
  const low = s.p[0].st; run(s, 2); ok('Ausdauer erholt sich', s.p[0].st > low + 0.4 && !s.p[0].tired, s.p[0].st);
  s = scene(); run(s, 4, I({ x: 1, y: 1 })); ok('Spieler bleiben im Feld', Math.abs(s.p[0].x) <= COURT.halfW && s.p[0].z <= COURT.maxZ);
  s = scene({ a: { x: 0, z: 3 }, b: { x: 5, z: 9 } }); run(s, 1.5, I({ y: -1 })); ok('Niemand läuft hinter das Brett', s.p[0].z >= HOOP.boardZ + 0.2, s.p[0].z);
  s = scene({ a: { x: 0, z: 8 }, b: { x: 0, z: 6.8 } }); run(s, 1.2, I({ y: -1 }));
  ok('Körper schieben sich nicht durch: Stehender Verteidiger hält stand', s.p[0].z > s.p[1].z + 0.7 && s.p[1].z > 5.9, [s.p[0].z, s.p[1].z]);
}

console.log('3  Wurf');
{
  let scored = 0, total = 0, three = [], two = [];
  for (const d of [2.9, 3.8, 4.6, 5.2, 5.7, 6.4]) for (const a of [-1.2, -0.6, 0, 0.6, 1.2]) for (let seed = 1; seed <= 4; seed++) {
    const x = Math.sin(a) * d, z = HOOP.z + Math.cos(a) * d; if (Math.abs(x) > COURT.halfW) continue;
    const s = scene({ seed: seed * 97, a: { x, z }, b: { x: x > 0 ? -6 : 6, z: 10.5 } }); const log = oneShot(s, SHOT.ideal); total++;
    const e = log.find((q) => q.type === 'score'); if (e) { scored++; (d >= COURT.threeR ? three : two).push(e.pts); }
  }
  ok('Perfekt getimte freie Würfe treffen fast immer (Ballphysik, ' + scored + '/' + total + ')', scored / total >= 0.95, [scored, total]);
  ok('Innerhalb der Linie zwei, außerhalb drei Punkte', two.length > 20 && two.every((p) => p === 2) && three.length > 20 && three.every((p) => p === 3));
  let late = 0, mid = 0; for (let seed = 1; seed <= 60; seed++) { if (has(oneShot(scene({ seed: seed * 31 }), 0.99), 'score')) late++; if (has(oneShot(scene({ seed: seed * 31 }), 0.5), 'score')) mid++; }
  ok('Deutlich zu spät trifft kaum (' + late + '/60), knapp daneben selten (' + mid + '/60)', late <= 8 && mid < 30, [late, mid]);
  let s = scene(); let log = run(s, 0.1, I({ a: true })); log = log.concat(run(s, 0.6));
  ok('Kurz antippen ist eine Wurffinte', has(log, 'fake') && !has(log, 'release') && s.ball.own === 0, log.map((e) => e.type));
  s = scene({ a: { x: -2, z: 7.5 } }); run(s, 0.55, I({ a: true, x: 1 }));
  ok('Während des Wurfladens kann man sich bewegen', s.p[0].act === 'gather' && s.p[0].x > -1.6, [s.p[0].act, s.p[0].x]);
  s = scene(); run(s, 0.5, I({ a: true })); ok('Sprungwurf hebt ab, Ball ist über dem Kopf', s.p[0].y > 0.3 && s.ball.y > 2.3, [s.p[0].y, s.ball.y]);
  s = scene(); log = run(s, 2, I({ a: true })); ok('Zu lange gehalten: Wurf geht von selbst raus', has(log, 'release'));
  const near = scene({ a: { x: 0, z: 3.4 } }), far = scene({ a: { x: 0, z: 8.6 } }), moving = scene({ a: { vx: 4 } }), still = scene(), guarded = scene({ b: { x: 0, z: 5.6 } });
  ok('Grüne Zone: nah größer als weit', greenZone(near, 0) > greenZone(far, 0) * 1.5, [greenZone(near, 0), greenZone(far, 0)]);
  ok('Grüne Zone: im Stand größer als in Bewegung', greenZone(still, 0) > greenZone(moving, 0) * 1.2);
  ok('Grüne Zone: frei größer als bedrängt', greenZone(still, 0) > greenZone(guarded, 0) * 1.4 && pressure(guarded, 0) > 0.6 && pressure(still, 0) === 0, [pressure(guarded, 0)]);
  const behind = scene({ b: { x: 0, z: 7.4 } }); ok('Verteidiger im Rücken drückt weniger als davor', pressure(behind, 0) < pressure(guarded, 0) * 0.7);
  s = scene(); run(s, 0.5, I({ a: true })); const seen = run(s, DT * 2, I({ a: false, m: SHOT.ideal }));
  ok('Online: der beim Gast gesehene Anzeigewert zählt', seen.some((e) => e.type === 'shot' && e.perfect), seen);
  s = scene(); run(s, 0.3, I({ a: true })); const faked = run(s, DT * 2, I({ a: false, m: 1.1 }));
  ok('Ein erfundener Anzeigewert wird ignoriert', !faked.some((e) => e.type === 'shot' && e.perfect) && s.p[0].ch < 0.6);
}

console.log('4  Korbleger und Dunk');
{
  let s = scene({ a: { x: 1.1, z: 2.8 } }); let log = run(s, 2, (q, t) => I({ a: t < 4 }), N, (q, l) => has(l, 'score') || has(l, 'rebound'));
  ok('In Korbnähe wird daraus ein Korbleger', log.some((e) => e.type === 'release' && e.kind === 'layup') && log.some((e) => e.type === 'score' && e.kind === 'layup' && e.pts === 2), log.map((e) => e.type));
  let made = 0; for (let seed = 1; seed <= 40; seed++) { const q = scene({ seed: seed * 13, a: { x: -1.2 + (seed % 7) * 0.4, z: 2.7 } }); if (has(run(q, 3, (st, t) => I({ a: t < 4 }), N, (st, l) => has(l, 'score') || has(l, 'rebound')), 'score')) made++; }
  ok('Freie Korbleger sitzen meistens (' + made + '/40)', made >= 32, made);
  s = scene({ a: { x: 0.3, z: 6 } }); log = run(s, 2.5, (q, t) => I({ y: -1, c: true, a: hoopDist(q.p[0].x, q.p[0].z) < 2.8 && q.p[0].act === 'free' }), N, (q, l) => has(l, 'score'));
  ok('Aus dem Sprint wird ein Dunk', has(log, 'dunk') && log.some((e) => e.type === 'score' && e.kind === 'dunk'), log.map((e) => e.type));
  ok('Beim Dunk läuft die Zeitlupe', s.slow > 0 || s.slowed);
  s = scene({ a: { x: 0.3, z: 6 } }); log = run(s, 2.5, (q) => I({ y: -1, a: hoopDist(q.p[0].x, q.p[0].z) < 2.8 && q.p[0].act === 'free' }), N, (q, l) => has(l, 'score'));
  ok('Ohne Sprint kein Dunk', !has(log, 'dunk') && log.some((e) => e.type === 'release' && e.kind === 'layup'));
}

console.log('5  Verteidigung');
{
  // Stehlen: Verteidiger steht auf der Ballseite
  const setup = (seed, drib) => { const s = scene({ seed, a: { x: 0, z: 6.5, drib, hand: 1, hx: 1 } }); s.p[1].x = -0.62; s.p[1].z = 5.7; s.p[1].f = Math.atan2(0.1, 1); return s; };
  const attempt = (seed, drib) => { const s = setup(seed, drib); const log = run(s, 0.5, N, (q, t) => I({ b: t < 2 })); return { s, log }; };
  let hit = null, miss = null; const results = [];
  for (let k = 0; k < 20; k++) { const r = attempt(1, k / 20); const got = has(r.log, 'steal'); results.push(got ? 1 : 0); if (got && !hit) hit = { k, r }; if (!got && !miss) miss = { k, r }; }
  ok('Stehlen hängt vom Zeitpunkt ab: mal klappt es, mal nicht', !!hit && !!miss, results);
  ok('Richtiger Moment: Ball wechselt, Dreierlinie muss neu erreicht werden', !!hit && hit.r.s.ball.own === 1 && hit.r.s.off === 1, hit && hit.r.s.ball);
  let same = true; for (let seed = 2; seed < 30; seed++) if (has(attempt(seed, hit.k / 20).log, 'steal') !== true) same = false;
  ok('Kein Zufall: derselbe Moment klappt bei jedem Startwert', same);
  ok('Fehlgriff wird bestraft', !!miss && has(miss.r.log, 'stealmiss') && miss.r.s.ball.own === 0, miss && miss.r.log.map((e) => e.type));
  { const s = setup(1, miss.k / 20); run(s, 0.45, N, (q, t) => I({ b: t < 2 })); const z = s.p[1].z; run(s, 0.2, N, I({ y: 1 })); ok('Nach dem Fehlgriff kurz fast unbeweglich', s.p[1].z - z < 0.2, [s.p[1].act, s.p[1].z - z]); }
  { let any = false; for (let k = 0; k < 20; k++) { const s = scene({ a: { x: 0, z: 6.5, drib: k / 20, hand: 1, hx: 1 } }); s.p[1].x = 0.8; s.p[1].z = 6.5; s.p[1].f = -Math.PI / 2; if (has(run(s, 0.5, N, (q, t) => I({ b: t < 2 })), 'steal')) any = true; } ok('Körper schirmt den Ball ab (falsche Seite)', !any); }
  { const s = scene(); const log = run(s, 0.5, N, (q, t) => I({ b: t < 2 })); ok('Weit weg greift man ins Leere', has(log, 'stealmiss') && !has(log, 'steal')); }
  { const s = setup(1, hit.k / 20); const log = run(s, 0.5, (q, t) => I({ b: t < 2, x: -0.2, y: 1 }), (q, t) => I({ b: t < 2 })); ok('Ein Trick schlägt den Griff', !has(log, 'steal') && has(log, 'ankle'), log.map((e) => e.type)); }

  // Block: Absprung relativ zum Beginn des Wurfs
  const block = (delay, release = SHOT.ideal) => { const s = scene({ seed: 4, a: { x: 0, z: 6 }, b: { x: 0, z: 5.1, f: 0 } }); const ctl = shoot(release); return run(s, 1.4, (q) => { const i = ctl(q); if (q.p[0].act === 'follow') q.fired = true; return i; }, (q, t) => I({ b: false, a: t >= Math.round(delay / DT) && t < Math.round(delay / DT) + 3 })); };
  const windows = []; for (let d = 0; d <= 0.9; d += 0.05) if (has(block(d), 'block')) windows.push(Math.round(d * 100) / 100);
  ok('Block gelingt in einem Zeitfenster (' + windows[0] + ' bis ' + windows[windows.length - 1] + ' s)', windows.length >= 2 && windows.length <= 9, windows);
  ok('Zu früh und zu spät blockt nicht', !windows.includes(0) && !windows.includes(0.8));
  ok('Ohne Sprung kein Block', !has(block(99), 'block'));
  { const s = scene({ a: { x: 0, z: 6 }, b: { x: 3, z: 5 } }); const ctl = shoot(SHOT.ideal); const log = run(s, 1.4, (q) => ctl(q), (q, t) => I({ a: t === 12 })); ok('Weit entfernt kein Block', !has(log, 'block')); }
  { let blocked = 0; for (let d = 0; d < 0.5; d += 0.04) { const s = scene({ a: { x: 0, z: 3.9, vz: -5.5 }, b: { x: 0.1, z: 2.0, f: 0 } }); const log = run(s, 1.2, (q, t) => I({ y: -1, c: true, a: t < 3 }), (q, t) => I({ a: t >= Math.round(d / DT) && t < Math.round(d / DT) + 3 })); if (has(log, 'block')) blocked++; } ok('Korbleger und Dunk lassen sich blocken (' + blocked + ' Fenster)', blocked >= 1 && blocked <= 10, blocked); }
}

console.log('6  Rebound, Befreien, Check, Uhr');
{
  // Rebound: Wer springt, holt den hohen Ball
  const s = scene({ a: { x: -0.5, z: 3.4 }, b: { x: 0.5, z: 3.4 } });
  Object.assign(s.ball, { own: -1, mode: 'loose', live: false, x: 0, y: 3.5, z: 3.4, vx: 0, vy: 0, vz: 0, nograb: 0 });
  const log = run(s, 1.2, N, (q) => I({ a: q.ball.y < 3.35 && q.ball.y > 2.6 }), (q) => q.ball.own >= 0);
  ok('Absprung gewinnt den Rebound', s.ball.own === 1 && (has(log, 'turnover') || has(log, 'rebound')), [s.ball.own, s.p[1].y]);
  ok('Nach Ballgewinn innen: erst befreien', s.need === true && s.off === 1 && s.clock > MATCH.shotClock - 0.5, [s.need, s.clock]);
  run(s, 0.8); const blocked = run(s, 0.5, N, (q, t) => I({ a: t < 20 }));
  ok('Vor dem Befreien kann man nicht werfen', has(blocked, 'needclear') && !has(blocked, 'release') && s.ball.own === 1, blocked.map((e) => e.type));
  s.p[0].x = -5; s.p[0].z = 2; const cl = run(s, 2.5, N, I({ y: 1 }), (q) => !q.need);
  ok('Hinter der Dreierlinie ist der Ball frei', !s.need && has(cl, 'clear') && hoopDist(s.p[1].x, s.p[1].z) >= COURT.threeR);
  const own = scene({ a: { x: 0, z: 3.2 } }); Object.assign(own.ball, { own: -1, mode: 'loose', live: false, x: 0, y: 1.2, z: 3.2, vx: 0, vy: 0, vz: 0, nograb: 0, rim: true }); own.clock = 3; run(own, 0.3, N, N, (q) => q.ball.own === 0);
  ok('Offensivrebound: kein Befreien, Uhr neu nach Ringberührung', own.ball.own === 0 && !own.need && own.clock > 13, [own.ball.own, own.need, own.clock]);

  const v = scene(); v.clock = 0.5; const vl = run(v, 1, N, N, (q) => q.phase === 'dead');
  ok('Wurfuhr abgelaufen: Ballverlust', has(vl, 'violation') && v.phase === 'dead' && v.next === 1);
  const chk = run(v, MATCH.dead + 0.1, N, N, (q) => q.phase === 'check');
  ok('Danach Check am Bogen für den anderen', has(chk, 'check') && v.ball.own === 1 && v.off === 1 && hoopDist(v.p[1].x, v.p[1].z) > COURT.threeR && !v.need && v.p[0].z < v.p[1].z);
  const z = v.p[1].z; run(v, MATCH.check * 0.7, N, I({ y: -1 })); ok('Beim Check steht alles kurz still', v.phase === 'check' && v.p[1].z === z);
  run(v, MATCH.check); ok('Dann geht es los', v.phase === 'live');
  const sc = scene(); const sl = oneShot(sc, SHOT.ideal); run(sc, MATCH.dead + 0.2, N, N, (q) => q.phase === 'check');
  ok('Nach einem Korb bekommt der andere den Ball', has(sl, 'score') && sc.off === 1 && sc.ball.own === 1);
  const buzz = scene(); buzz.clock = 0.62; const bl = oneShot(buzz, SHOT.ideal);
  ok('Läuft die Uhr beim Wurfladen ab, geht der Ball noch raus (Buzzer) und zählt', has(bl, 'release') && bl.some((e) => e.type === 'score' && e.buzzer) && has(bl, 'buzzer'), bl.map((e) => e.type));
  const stuck = scene(); Object.assign(stuck.ball, { own: -1, mode: 'loose', x: 6.9, y: 0.12, z: 0, vx: 0, vy: 0, vz: 0 }); stuck.p[0].x = -5; stuck.p[1].x = -4; const st = run(stuck, MATCH.looseMax + 1, N, N, (q) => q.phase !== 'live');
  ok('Ein liegengebliebener Ball hält das Spiel nicht auf', has(st, 'violation'));
}

console.log('7  Ballphysik');
{
  let through = 0, high = 0, shots = 0;
  let seed = 9; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 4000; i++) {
    const s = scene(), b = s.ball; s.phase = 'dead';
    const tx = (r() - 0.5) * 1.6, ty = HOOP.boardY0 + 0.1 + r() * 0.9, from = { x: (r() - 0.5) * 4, y: 2 + r() * 2.5, z: 2 + r() * 3 };
    const dx = tx - from.x, dy = ty - from.y, dz = HOOP.boardZ - from.z, l = Math.hypot(dx, dy, dz), v = 8 + r() * 22;
    Object.assign(b, { own: -1, mode: 'loose', live: false, ...from, vx: (dx / l) * v, vy: (dy / l) * v, vz: (dz / l) * v });
    for (let t = 0; t < 40; t++) { const pz = b.z; ballFlight(s, DT); shots++; if (pz > HOOP.boardZ && b.z < HOOP.boardZ - 0.05 && Math.abs(b.x) < HOOP.boardHalfW - BALL.r && b.y > HOOP.boardY0 + BALL.r && b.y < HOOP.boardY1 - BALL.r) through++; if (!Number.isFinite(b.x + b.y + b.z)) high++; }
  }
  ok('Kein Durchfliegen durchs Brett, auch bei sehr schnellen Bällen (' + shots + ' Schritte)', through === 0 && high === 0, [through, high]);
  let rimThrough = 0;
  for (let i = 0; i < 3000; i++) {
    const s = scene(), b = s.ball; s.phase = 'dead'; const a = r() * Math.PI * 2;
    const hit = { x: HOOP.x + Math.cos(a) * HOOP.r, z: HOOP.z + Math.abs(Math.sin(a)) * HOOP.r }, v = 4 + r() * 8;
    Object.assign(b, { own: -1, mode: 'loose', live: false, x: hit.x, y: HOOP.y + 0.6, z: hit.z, vx: 0, vy: -v, vz: 0 });
    let min = 9; for (let t = 0; t < 12; t++) { ballFlight(s, DT); const rl = Math.hypot(b.x - HOOP.x, b.z - HOOP.z) || 1; min = Math.min(min, Math.hypot(b.x - (HOOP.x + ((b.x - HOOP.x) / rl) * HOOP.r), b.y - HOOP.y, b.z - (HOOP.z + ((b.z - HOOP.z) / rl) * HOOP.r))); }
    if (min < (BALL.r + HOOP.tube) * 0.6) rimThrough++;
  }
  ok('Kein Durchfliegen durch den Ring', rimThrough === 0, rimThrough);
  const drop = (y, vy) => { const s = scene(); Object.assign(s.ball, { own: -1, mode: 'shot', live: true, by: 0, pts: 2, x: HOOP.x, y, z: HOOP.z, vx: 0, vy, vz: 0, nograb: 9 }); run(s, 0.4); return s; };
  ok('Von oben durch den Ring zählt (auch sehr schnell)', drop(3.5, -1).score[0] === 2 && drop(4.2, -25).score[0] === 2);
  ok('Von unten durch den Ring zählt nicht', drop(2.5, 4.2).score[0] === 0);
  ok('Ein Korb zählt nur einmal', (() => { const s = drop(3.4, -2); run(s, 1); return s.score[0] === 2; })());
  const w = scene(); Object.assign(w.ball, { own: -1, mode: 'loose', x: 0, y: 1, z: 6, vx: 30, vy: 2, vz: 25 }); w.phase = 'dead'; w.pt = 99; let out = false; run(w, 4, N, N, (q) => { if (Math.abs(q.ball.x) > COURT.wallX || q.ball.z > COURT.wallZ1 || q.ball.y < 0) out = true; return false; });
  ok('Der Käfig hält den Ball im Spiel', !out);
}

console.log('8  Spielende');
{
  let s = scene(); s.score = [9, 4]; oneShot(s, SHOT.ideal);
  ok('Bei 11 Punkten steht der Sieger fest, erst nach dem Jubel', s.score[0] >= 11 && s.final === 0 && s.winner === null && sim.winner(s) === null);
  const log = run(s, MATCH.finalDead + 0.2); ok('Danach meldet das Spiel den Sieger', sim.winner(s) === 0 && has(log, 'end'));
  const frozen = JSON.stringify(s); sim.step(s, [I({ x: 1 }), N()], DT); ok('Nach Ende ändert sich nichts mehr', JSON.stringify(s) === frozen);
  s = scene(); s.score = [5, 3]; s.time = 0.2; run(s, 4); ok('Zeit abgelaufen: Führender gewinnt', s.winner === 0);
  s = scene(); s.score = [4, 4]; s.time = 0.2; const sl = run(s, MATCH.finalDead + MATCH.check + 0.4);
  ok('Gleichstand: nächster Korb entscheidet', s.sudden && has(sl, 'sudden') && s.winner === null && s.phase === 'live', [s.sudden, s.phase]);
  s.off = 0; Object.assign(s.ball, { own: 0, mode: 'drib' }); s.p[0].x = 0; s.p[0].z = 6.5; s.p[0].act = 'free'; s.p[1].x = 6; s.p[1].z = 10; s.need = false; oneShot(s, SHOT.ideal); run(s, 3);
  ok('Ein Korb in der Verlängerung beendet das Spiel', s.winner === 0, [s.winner, s.score]);
  s = scene(); s.score = [4, 4]; s.sudden = true; s.time = 0.2; run(s, 4); ok('Auch die Verlängerung endet (unentschieden)', s.winner === -1);
  let longest = 0, ended = 0;
  for (let g = 0; g < 8; g++) { const q = sim.create(g + 1, {}); let n = 0; while (q.winner === null && n < 60 * 420) { sim.step(q, [N(), N()], DT); n++; } if (q.winner !== null) ended++; longest = Math.max(longest, n * DT); }
  ok('Selbst ganz ohne Eingaben endet jede Partie (längste ' + Math.round(longest) + ' s)', ended === 8 && longest < 330, [ended, longest]);
}

console.log('9  Computergegner und Dauerlauf');
{
  const series = (a, b, games) => { const w = [0, 0, 0]; let sum = 0, max = 0, endless = 0, ev = {}; for (let g = 0; g < games; g++) { const swap = g % 2, lv = swap ? [b, a] : [a, b], s = sim.create(3000 + g * 53, {}); let n = 0, seen = 0; while (s.winner === null && n < 60 * 420) { sim.step(s, [sim.cpu(s, 0, lv[0], DT), sim.cpu(s, 1, lv[1], DT)], DT); n++; for (const e of s.events) if (e.id > seen) { seen = e.id; ev[e.type] = (ev[e.type] || 0) + 1; seenTypes.add(e.type); } } if (s.winner === null) endless++; else if (s.winner < 0) w[2]++; else w[swap ? 1 - s.winner : s.winner]++; sum += n * DT; max = Math.max(max, n * DT); } return { w, avg: sum / games, max, endless, ev }; };
  const he = series('hard', 'easy', 30), ne = series('normal', 'easy', 30), hn = series('hard', 'normal', 30), nn = series('normal', 'normal', 20);
  console.log(`    schwer:leicht ${he.w}  normal:leicht ${ne.w}  schwer:normal ${hn.w}  Dauer normal ${Math.round(nn.avg)} s (max ${Math.round(nn.max)})`);
  ok('Alle Computerpartien enden', !he.endless && !ne.endless && !hn.endless && !nn.endless);
  ok('Schwer schlägt Leicht klar', he.w[0] >= 26, he.w);
  ok('Normal schlägt Leicht meistens', ne.w[0] >= 21, ne.w);
  ok('Schwer schlägt Normal meistens', hn.w[0] >= 20, hn.w);
  ok('Partien dauern zwischen 40 s und 4 Minuten', nn.avg > 40 && nn.max < 270 && he.max < 270, [nn.avg, nn.max]);
  const e = nn.ev; ok('Im Computerspiel kommen alle Spielzüge vor', ['score', 'block', 'steal', 'stealmiss', 'rebound', 'turnover', 'clear', 'dunk', 'cross', 'fake'].every((t) => e[t] > 0), e);
  const s = sim.create(8, {}); let seed = 5; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647; let bad = null, inp = [N(), N()];
  for (let t = 0; t < 150000 && !bad; t++) {
    if (s.winner !== null) Object.assign(s, sim.create(t, {}));
    if (r() < 0.12) inp[r() < 0.5 ? 0 : 1] = I({ x: r() * 2 - 1, y: r() * 2 - 1, a: r() < 0.35, b: r() < 0.3, c: r() < 0.4, m: r() < 0.2 ? r() : -1 });
    sim.step(s, inp, DT);
    for (const p of s.p) if (![p.x, p.z, p.y, p.vx, p.vz, p.f, p.st].every(Number.isFinite) || Math.abs(p.x) > COURT.halfW + 0.001 || p.z < COURT.minZ - 0.001 || p.y < 0 || p.y > 2) bad = { t, p };
    const b = s.ball; if (![b.x, b.y, b.z].every(Number.isFinite) || Math.abs(b.x) > 8 || b.y < -0.01 || b.y > 12) bad = { t, b };
    if (t % 500 === 0 && !sim.unpack(JSON.parse(JSON.stringify(sim.pack(s))))) bad = { t, unpack: sim.pack(s) };
  }
  ok('150000 Schritte mit wirren Eingaben: keine Ausreißer', !bad, bad);
}
console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
