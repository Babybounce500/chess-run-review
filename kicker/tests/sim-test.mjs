// Logik-Test ohne Browser: Physik, Regeln, Computergegner, Netzdaten.   node tests/sim-test.mjs
import { sim, bestRod, reachable, nearestFigure } from '../src/sim.js';
import { STEP } from '../src/kit/realtime.js';
import { TABLE, BALL, FIG, RODS, OWN, MATCH, SPIN_ROD } from '../src/config.js';

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 500) : '')); } };
const HL = TABLE.L / 2, HW = TABLE.W / 2, R = BALL.r;
const none = () => sim.cleanInput({});
const inp = (o) => sim.cleanInput(Object.assign({ on: true }, o));
const run = (s, n, a = none(), b = none()) => { for (let i = 0; i < n; i++) sim.step(s, [typeof a === 'function' ? a(s, i) : a, typeof b === 'function' ? b(s, i) : b], STEP); return s; };
// Zustand mit ruhendem Spiel und selbst gesetztem Ball
function lab(x, y, vx = 0, vy = 0) { const s = sim.create(7, {}); s.phase = 'play'; s.ball = { x, y, vx, vy, s: 0 }; s.zx = x; return s; }
const seen = (s, type) => s.events.some((e) => e.type === type);
function collect(s, n, a, b) { const all = []; let last = s.eventId; for (let i = 0; i < n; i++) { run(s, 1, a, b); for (const e of s.events) if (e.id > last) { all.push(e); last = e.id; } } return all; }

console.log('Grundlagen');
{
  const a = sim.create(123, {}), b = sim.create(123, {});
  const play = (s) => { for (let i = 0; i < 1500; i++) sim.step(s, [sim.cleanInput(sim.cpu(s, 0, 'normal', STEP)), sim.cleanInput(sim.cpu(s, 1, 'hard', STEP))], STEP); return JSON.stringify(s); };
  ok('Gleicher Startwert ergibt exakt gleichen Verlauf', play(a) === play(b));
  ok('Anderer Startwert ergibt anderen Verlauf', play(sim.create(124, {})) !== play(sim.create(125, {})));
  ok('Acht Stangen in Kickeraufstellung', RODS.length === 8 && RODS.map((r) => r.side + ':' + r.fig.length).join(' ') === '0:1 0:2 1:3 0:5 1:5 0:3 1:2 1:1');
  ok('Aufstellung ist gespiegelt', RODS.every((r, i) => Math.abs(r.x + RODS[7 - i].x) < 1e-9 && r.side !== RODS[7 - i].side && r.fig.length === RODS[7 - i].fig.length));
  ok('Zustand ist reines JSON', JSON.stringify(JSON.parse(JSON.stringify(a))) === JSON.stringify(a));
}

console.log('Eingaben');
{
  const bad = [null, undefined, 5, 'x', [], { r: 99, y: 1e9, w: -4, k: -1, p: 7, t: 'ja', on: 1 }, { r: NaN, y: Infinity, w: NaN, k: 1e12, p: NaN }];
  ok('Unsinn wird immer gültig', bad.every((i) => { const o = sim.cleanInput(i); return o.r >= 0 && o.r <= 3 && Number.isInteger(o.r) && Math.abs(o.y) <= 1 && o.w >= 0 && o.w <= 1 && Number.isInteger(o.k) && o.k >= 0 && o.k <= 65535 && o.p >= 0 && o.p <= 1 && typeof o.t === 'boolean' && typeof o.on === 'boolean'; }));
  ok('Leere Eingabe steuert nichts', none().on === false && none().k === 0);
}

console.log('Stangen');
{
  const s = lab(0, 0); s.phase = 'goal'; s.wait = 99;
  let maxY = 0, maxA = 0;
  for (let i = 0; i < 60; i++) { run(s, 1, inp({ r: 1, y: 0.6 })); maxY = Math.max(maxY, s.rods[1].y); }
  const goal = 0.6 * RODS[1].range;
  ok('Aktive Stange erreicht das Ziel', Math.abs(s.rods[1].y - goal) < 0.02, s.rods[1].y);
  ok('Schieben schwingt nicht über', maxY <= goal + 0.03, [maxY, goal]);
  const t = lab(0, 0); t.phase = 'goal'; t.wait = 99; run(t, 8, inp({ r: 1, y: 1 }));
  ok('Schnell: nach 8 Takten schon weit', t.rods[1].y > 1.2, t.rods[1].y);
  run(s, 30, inp({ r: 3, w: 1 }));
  ok('Ausholen dreht die Stange nach hinten', s.rods[5].a < -1.25, s.rods[5].a);
  for (let i = 0; i < 90; i++) { run(s, 1, inp({ r: 3 })); maxA = Math.max(maxA, s.rods[5].a); }
  ok('Drehfeder kehrt weich zurück, ohne nennenswert zu schwingen', Math.abs(s.rods[5].a) < 0.01 && maxA < 0.06, [s.rods[5].a, maxA]);
  const u = lab(0, 0); u.phase = 'goal'; u.wait = 99; let jump = 0, prev = 0;
  for (let i = 0; i < 60; i++) { run(u, 1, inp({ r: 3, k: i < 2 ? 0 : 1, p: 1 })); jump = Math.max(jump, Math.abs(u.rods[5].a - prev)); prev = u.rods[5].a; }
  ok('Schuss dreht ohne Sprung', jump < 0.55 && Math.abs(u.rods[5].a) < 0.05, [jump, u.rods[5].a]);
  const v = lab(0, 0); v.phase = 'goal'; v.wait = 99; run(v, 200, inp({ r: 0, y: 0 }));
  ok('Grenzen je Stange werden eingehalten', v.rods.every((o, i) => Math.abs(o.y) <= RODS[i].range + 1e-9));
}

console.log('Ball und Figuren');
{
  // Harte Bälle gegen eine ruhende Figur: nie hindurch
  let through = 0, tries = 0;
  for (let k = 0; k < 120; k++) {
    const i = k % 8, r = RODS[i], f = r.fig[k % r.fig.length], from = k % 2 ? 1 : -1, speed = 10 + (k % 15);
    if (Math.abs(f) > HW - 0.6) continue;
    const s = lab(r.x - from * 0.85, f + ((k % 5) - 2) * 0.07, from * speed, 0); tries++;
    // Nur diese Stange steht fest in der Bahn
    for (let n = 0; n < 12; n++) { s.rods.forEach((o) => { o.y = 0; o.vy = 0; o.a = 0; o.w = 0; }); run(s, 1, inp({ r: r.role, y: 0 }), inp({ r: r.role, y: 0 })); if ((s.ball.x - r.x) * from > 0.1) { through++; break; } }
  }
  ok('Harter Ball geht nie durch eine Figur (' + tries + ' Versuche)', through === 0, through);
  const s = lab(RODS[4].x - 0.9, 0, 24, 0); run(s, 4);
  ok('Höchsttempo prallt ab', s.ball.vx < 0, s.ball);
  const t = lab(RODS[3].x, 0.7, 12, 0); run(t, 1);
  ok('Zwischen zwei Figuren läuft der Ball durch', t.ball.vx > 8);
  const u = lab(0, 0, 3, 22); for (let i = 0; i < 200; i++) run(u, 1);
  ok('Ball bleibt innerhalb der Banden', Math.abs(u.ball.y) <= HW - R + 1e-6, u.ball);
  const w = lab(0, 3, 0, 10); const ev = collect(w, 30, none(), none());
  ok('Bande wirft ab und klingt', w.ball.vy < 0 && ev.some((e) => e.type === 'wall'), w.ball);
  const v = lab(1.9, 0.7, 0, 0.0001); v.ball.vx = 0.0; v.ball.vx = 6; v.ball.vy = 0; const w0 = Math.hypot(6, 0); run(v, 30);
  ok('Reibung bremst', Math.hypot(v.ball.vx, v.ball.vy) < w0);
  const e = lab(-1.8, 0.7, 0, 8); e.ball.s = 4; run(e, 12); ok('Effet krümmt die Bahn', e.ball.vx < -0.3, e.ball);
}
{
  // Fuzz: wildes Schieben und Schießen, Ball nie außerhalb, nie tief in einer Figur
  let outside = 0, deep = 0, nan = 0, steps = 0;
  const overlap = (s) => { let worst = 0; for (let i = 0; i < 8; i++) { const r = RODS[i], o = s.rods[i]; if (Math.abs(o.a) > FIG.lift - 0.1 || o.m !== 0 || (o.up && o.w < -3)) continue; const cx = r.x + (r.side ? -1 : 1) * Math.sin(o.a) * FIG.leg; for (const f of r.fig) { const dx = s.ball.x - cx, dy = s.ball.y - o.y - f; const d = Math.hypot(dx - Math.max(-FIG.hx, Math.min(FIG.hx, dx)), dy - Math.max(-FIG.hy, Math.min(FIG.hy, dy))); worst = Math.max(worst, FIG.round + R - d); } } return worst; };
  for (let m = 0; m < 25; m++) {
    const s = sim.create(1000 + m, {}); let seed = 7 + m; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const cur = [none(), none()]; let k = 0;
    for (let i = 0; i < 2400 && s.win === null; i++) {
      if (i % 9 === 0) for (let p = 0; p < 2; p++) cur[p] = inp({ r: bestRod(s.ball, p), y: rnd() < 0.5 ? s.ball.y / 3 + rnd() - 0.5 : rnd() * 2 - 1, w: rnd() < 0.15 ? rnd() : 0, k: rnd() < 0.5 ? ++k : 0, p: rnd(), t: rnd() < 0.15 });
      sim.step(s, cur, STEP); steps++;
      const b = s.ball;
      if (!Number.isFinite(b.x + b.y + b.vx + b.vy)) nan++;
      if (s.phase === 'play' && (Math.abs(b.y) > HW - R + 0.02 || Math.abs(b.x) > HL + R || (Math.abs(b.x) > HL - R + 0.1 && Math.abs(b.y) > TABLE.goalHalf + 0.2))) outside++;
      if (s.phase === 'play' && !s.hold && overlap(s) > 0.2) deep++;
    }
  }
  ok('Zufallseingaben: Ball nie außerhalb des Tisches (' + steps + ' Takte)', outside === 0, outside);
  ok('Zufallseingaben: keine ungültigen Zahlen', nan === 0, nan);
  ok('Zufallseingaben: Ball steckt praktisch nie tief in einer Figur', deep / steps < 0.002, [deep, steps]);
}

console.log('Schießen, Annehmen, Passen');
{
  const rod = 5, x = RODS[rod].x;
  // bis zum Schuss rechnen und genau dort messen (danach darf der Ball woanders abprallen)
  const toKick = (s, a, b, n = 40) => { for (let i = 0; i < n; i++) { const last = s.eventId; run(s, 1, a, b); const k = s.events.find((e) => e.id > last && e.type === 'kick'); if (k) return k; } return null; };
  const shot = (p, dx = 0.45, dy = 0) => { const s = lab(x + dx, dy); const kick = toKick(s, inp({ r: 3, y: 0, k: 1, p }), none()); return { s, kick, v: Math.hypot(s.ball.vx, s.ball.vy) }; };
  const soft = shot(0.1), hard = shot(1);
  ok('Schuss trifft den Ball vor dem Fuß', !!soft.kick && !!hard.kick && hard.s.ball.vx > 5, [soft.kick, hard.s.ball]);
  ok('Härte hängt von der Stärke ab', hard.v > soft.v + 5, [soft.v, hard.v]);
  const back = shot(0.8, -0.5);
  ok('Ball hinter der Figur wird nach vorn geschossen', !!back.kick && back.s.ball.x > x && back.s.ball.vx > 5, back.s.ball);
  const left = shot(0.8, 0.45, -0.3), right = shot(0.8, 0.45, 0.3);
  ok('Treffpunkt bestimmt die Richtung', left.s.ball.vy < -1 && right.s.ball.vy > 1, [left.s.ball.vy, right.s.ball.vy]);
  // Spieler 1 schießt in die andere Richtung
  const o = lab(RODS[2].x - 0.45, 0); toKick(o, none(), inp({ r: 3, y: 0, k: 1, p: 0.8 }));
  ok('Spieler 1 schießt zu Tor 0', o.ball.vx < -5, o.ball);
  // Eingabepuffer: Taste kurz bevor der Ball da ist
  const pre = lab(x + 2.0, 0, -9, 0); const early = toKick(pre, inp({ r: 3, y: 0, k: 1, p: 0.8 }), none());
  ok('Früh gedrückter Schuss trifft den anrollenden Ball (Eingabepuffer)', !!early && pre.ball.vx > 3, [early, pre.ball]);
  const once = lab(x + 0.45, 0); const e2 = collect(once, 60, inp({ r: 3, y: 0, k: 5, p: 0.8 }), none());
  ok('Gleiche Schussnummer schießt nur einmal', e2.filter((e) => e.type === 'kick').length === 1);
  // Annehmen
  const t = lab(x + 1.3, 0.1, -6, 0); const e3 = collect(t, 30, inp({ r: 3, y: 0, t: true }), none());
  ok('Klemmen nimmt den Ball an', !!t.hold && t.hold.r === rod && e3.some((e) => e.type === 'trap'), [t.hold, t.ball]);
  const hx = t.ball.x; run(t, 40, inp({ r: 3, y: 0.5, t: true }));
  ok('Geklemmter Ball wandert mit der Stange', !!t.hold && Math.abs(t.ball.y - (t.rods[rod].y + RODS[rod].fig[t.hold.f])) < 0.12 && Math.abs(t.rods[rod].y - 0.8) < 0.05, [t.ball, t.rods[rod].y, hx]);
  const shotHeld = JSON.parse(JSON.stringify(t)); toKick(shotHeld, inp({ r: 3, y: 0.5, t: true, k: 2, p: 1 }), none());
  ok('Aus dem Klemmen heraus schießen', !shotHeld.hold && shotHeld.ball.vx > 8, shotHeld.ball);
  const pass1 = JSON.parse(JSON.stringify(t)); run(pass1, 4, inp({ r: 3, y: -1, t: true })); run(pass1, 2, inp({ r: 3, y: -1, t: false }));
  ok('Loslassen bei bewegter Stange passt zur Seite', !pass1.hold && pass1.ball.vy < -2, pass1.ball);
  run(t, 200, inp({ r: 3, y: 0, t: true }));
  ok('Klemmen endet von selbst (kein Zeitspiel)', !t.hold || t.hold.t <= 2.05, t.hold);
}

console.log('Tore, Einwurf, Ende');
{
  const s = lab(6.7, 0.9, 12, 0); s.rods[7].y = -1.85; const ev = collect(s, 10, none(), inp({ r: 0, y: -1 }));
  ok('Ball in Tor 1 zählt für Spieler 0', s.score[0] === 1 && s.score[1] === 0 && ev.some((e) => e.type === 'goal' && e.side === 0), s.score);
  run(s, Math.ceil(MATCH.goalWait / STEP) + 2);
  ok('Nach dem Tor folgt der Einwurf', s.phase === 'in' && Math.abs(s.ball.y) > HW - 0.5, [s.phase, s.ball]);
  run(s, Math.ceil(MATCH.throwWait / STEP) + 2);
  ok('Einwurf rollt ins Feld', s.phase === 'play' && Math.abs(s.ball.vy) > 2);
  const w = lab(-6.7, -0.9, -12, 0); w.rods[0].y = 1.85; run(w, 10, inp({ r: 0, y: 1 })); ok('Ball in Tor 0 zählt für Spieler 1', w.score[1] === 1, w.score);
  const p = lab(6.5, TABLE.goalHalf + 0.6, 12, 0); run(p, 30); ok('Neben dem Tor gibt es kein Tor', p.score[0] === 0 && p.ball.x < HL, p.ball);
  const f = lab(6.7, 0.9, 12, 0); f.score = [MATCH.goals - 1, 0]; f.rods[7].y = -1.85; run(f, 10, none(), inp({ r: 0, y: -1 }));
  ok('Bis ' + MATCH.goals + ' Tore: Sieger steht fest', sim.winner(f) === 0);
  const t0 = f.t; run(f, 20); ok('Nach dem Ende ändert sich nichts mehr', f.t === t0);
  const a = lab(0, 0); a.time = 0.01; a.score = [2, 1]; run(a, 2); ok('Zeit um: Führung gewinnt', a.win === 0);
  const g = lab(0, 0); g.time = 0.01; run(g, 2); ok('Zeit um bei Gleichstand: Golden Goal', g.win === null && g.golden && g.time > 50);
  g.time = 0.01; g.phase = 'play'; run(g, 2); ok('Golden Goal ohne Tor: unentschieden', g.win === -1);
  const gg = lab(6.7, 0.9, 12, 0); gg.golden = true; gg.score = [1, 1]; gg.rods[7].y = -1.85; run(gg, 10, none(), inp({ r: 0, y: -1 })); ok('Golden Goal entscheidet sofort', gg.win === 0);
  // Ruhender Ball
  const d = lab(0, 0.7); const e = collect(d, Math.ceil((MATCH.stuck + 0.3) / STEP), none(), none());
  ok('Ruhender Ball wird neu eingeworfen', e.some((x) => x.type === 'throw'), [d.phase, d.ball]);
  const c = lab(6.9, 3.9); run(c, 90); ok('Ball in der Ecke rollt heraus oder wird neu eingeworfen', c.phase !== 'play' || Math.abs(c.ball.x) < 6.6 || Math.abs(c.ball.y) < 3.6, c.ball);
  let dead = 0;
  for (let x = -6.7; x <= 6.7; x += 0.23) for (let y = -3.9; y <= 3.9; y += 0.23) if (!reachable({ x, y })) dead++;
  ok('Kaum unerreichbare Stellen (nur Ecken)', dead < 140, dead);
  const z = lab(0, 0); z.zt = MATCH.zone - 0.05; z.zx = 0; z.ball.vx = 1; const e4 = collect(z, 10, none(), none()); ok('Ball, der in einem Bereich hängt, wird neu eingeworfen', e4.some((x) => x.type === 'throw'));
  // Stillstand: niemand steuert
  const st = sim.create(5, {}); let i = 0; while (st.win === null && i < 60 * 600) { run(st, 1); i++; }
  ok('Ohne jede Eingabe endet die Partie', st.win !== null, [i / 60, st.score]);
}

console.log('Netzdaten');
{
  const s = sim.create(9, {}); let max = 0, bad = 0;
  for (let i = 0; i < 3000 && s.win === null; i++) { run(s, 1, (x) => sim.cleanInput(sim.cpu(x, 0, 'hard', STEP)), (x) => sim.cleanInput(sim.cpu(x, 1, 'hard', STEP))); if (i % 7 === 0) { const j = JSON.stringify({ t: 's', n: i, s: sim.pack(s) }); max = Math.max(max, j.length); const u = sim.unpack(JSON.parse(j).s); if (!u || u.score.join() !== s.score.join() || Math.abs(u.ball.x - s.ball.x) > 0.01) bad++; } }
  ok('Zustand bleibt unter 4 kB (' + max + ' Zeichen)', max < 4000, max);
  ok('Packen und Entpacken passt', bad === 0, bad);
  const good = sim.pack(s), mut = (f) => { const c = JSON.parse(JSON.stringify(good)); f(c); return sim.unpack(c); };
  ok('Unsinn wird abgewiesen', [null, 1, 'x', {}, [], { t: 1 }].every((d) => sim.unpack(d) === null) && [
    (c) => { c.b[0] = 'a'; }, (c) => { c.b[0] = 1e9; }, (c) => { c.r.pop(); }, (c) => { c.r[0][0] = 50; }, (c) => { c.sc = [1]; }, (c) => { c.sc = [-1, 0]; }, (c) => { c.win = 7; }, (c) => { c.ph = 'x'; }, (c) => { c.h = [9, 0]; }, (c) => { c.h = [0, 3]; }, (c) => { c.c = [4, 0]; }, (c) => { c.ev = new Array(40).fill({}); }, (c) => { c.tm = null; }
  ].every((f) => mut(f) === null));
  const a = sim.unpack(good), b = sim.unpack(good); b.ball.x += 1; b.rods[0].y = a.rods[0].y + 1;
  const m = sim.lerp(a, b, 0.5); ok('Zwischenzustand für die Anzeige', Math.abs(m.ball.x - a.ball.x - 0.5) < 1e-6 && Math.abs(m.rods[0].y - a.rods[0].y - 0.5) < 1e-6);
}

console.log('Computergegner');
{
  function duel(la, lb, n, offset = 0) {
    const r = { wins: [0, 0, 0], goals: [0, 0], dur: 0, max: 0, endless: 0, throws: 0, kicks: 0 };
    for (let m = 0; m < n; m++) {
      const s = sim.create(4000 + m * 31 + offset, {}); let i = 0, last = 0; s.level = lb;
      while (s.win === null && i < 60 * 400) { sim.step(s, [sim.cleanInput(sim.cpu(s, 0, la, STEP)), sim.cleanInput(sim.cpu(s, 1, lb, STEP))], STEP); i++; for (const e of s.events) if (e.id > last) { last = e.id; if (e.type === 'throw') r.throws++; if (e.type === 'kick') r.kicks++; } }
      if (s.win === null) r.endless++; else r.wins[s.win === -1 ? 2 : s.win]++;
      r.goals[0] += s.score[0]; r.goals[1] += s.score[1]; r.dur += i * STEP / n; r.max = Math.max(r.max, i * STEP);
    }
    return r;
  }
  const t0 = Date.now(), res = {};
  for (const [a, b] of [['easy', 'easy'], ['normal', 'normal'], ['hard', 'hard'], ['hard', 'easy'], ['easy', 'hard'], ['normal', 'easy'], ['hard', 'normal']]) { res[a + b] = duel(a, b, 24); const r = res[a + b]; console.log(`    ${a} gegen ${b}: Siege ${r.wins.join('/')} Tore ${r.goals.join(':')} Dauer ${r.dur.toFixed(0)} s (max ${r.max.toFixed(0)}), Einwürfe ${(r.throws / 24).toFixed(1)}, Schüsse ${(r.kicks / 24).toFixed(0)}`); }
  console.log('    Rechenzeit ' + (Date.now() - t0) + ' ms');
  const all = Object.values(res);
  ok('Jede Partie endet', all.every((r) => r.endless === 0));
  ok('Keine Partie dauert länger als 5 Minuten', all.every((r) => r.max < 300), all.map((r) => r.max));
  ok('Im Schnitt 40 Sekunden bis 4 Minuten', all.every((r) => r.dur > 40 && r.dur < 240), all.map((r) => r.dur));
  const strong = res.hardeasy.wins[0] + res.easyhard.wins[1];
  ok('Schwer schlägt Leicht deutlich', strong >= 38, strong + ' von 48');
  ok('Normal schlägt Leicht', res.normaleasy.wins[0] >= 16, res.normaleasy.wins);
  ok('Schwer schlägt Normal', res.hardnormal.wins[0] >= 14, res.hardnormal.wins);
  ok('Gleich starke Gegner: beide Seiten gewinnen', res.normalnormal.wins[0] > 3 && res.normalnormal.wins[1] > 3, res.normalnormal.wins);
  ok('Es fallen Tore', all.every((r) => r.goals[0] + r.goals[1] > 40), all.map((r) => r.goals));
  // Reaktionszeit: Der Computer sieht eine plötzliche Änderung erst nach seiner Reaktionszeit
  const s = lab(2, -2, 0, 0); for (let i = 0; i < 60; i++) sim.cpu(s, 1, 'easy', STEP);
  const before = sim.cpu(s, 1, 'easy', STEP); s.brain[1].age = 0; s.ball.y = 2; const after = sim.cpu(s, 1, 'easy', STEP);
  ok('Computer ist nicht allwissend (Reaktionszeit)', Math.abs(after.y - before.y) < 0.05, [before.y, after.y]);
  ok('Zuständige Stange folgt dem Ball', bestRod({ x: -6.6, vx: 0 }, 0) === 0 && bestRod({ x: -4, vx: 0 }, 0) === 1 && bestRod({ x: -0.5, vx: 0 }, 0) === 2 && bestRod({ x: 3, vx: 0 }, 0) === 3 && bestRod({ x: 6.6, vx: 0 }, 1) === 0 && bestRod({ x: -3, vx: 0 }, 1) === 3);
  ok('Nächste Figur', nearestFigure(3, 2.8, 0) === 4 && nearestFigure(3, -2.8, 0) === 0);
}

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
