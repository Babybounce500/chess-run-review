// Massentest: Computer gegen Computer ohne Grafik. Aufruf: node tools/measure.mjs [spiele] [stufeA] [stufeB]
import { sim, ACT } from '../src/sim.js';
import { MATCH } from '../src/config.js';
const STEP = 1 / 60;

export function playMatch(seed, levels, opts = {}) {
  const s = sim.create(seed, { levels });
  const m = { steps: 0, hang: false, stuck: 0, maxStuck: 0, samples: 0, near5: 0, near10: 0, crowd: 0, nn: 0, nnClose: 0, packMax: 0, packSum: 0, packs: 0, nan: false, sets: 0, noTouch: 0, maxNoTouch: 0 };
  let sx = 0, sz = 0, anchor = 0, lastOwn = -2, ownSince = 0;
  const limit = (MATCH.half * 2 + 600) * 60;
  while (sim.winner(s) === null) {
    if (++m.steps > limit) { m.hang = true; break; }
    sim.step(s, [sim.cpu(s, 0), sim.cpu(s, 1)], STEP);
    // Hänger: der Ball bleibt im laufenden Spiel lange praktisch an einer Stelle
    if (s.ph !== 'play') { anchor = s.t; sx = s.ball.x; sz = s.ball.z; ownSince = s.t; }
    else if (Math.hypot(s.ball.x - sx, s.ball.z - sz) > 2.5) { anchor = s.t; sx = s.ball.x; sz = s.ball.z; }
    else m.maxStuck = Math.max(m.maxStuck, s.t - anchor);
    if (s.ball.own !== lastOwn) { lastOwn = s.ball.own; ownSince = s.t; } else if (s.ph === 'play') m.maxNoTouch = Math.max(m.maxNoTouch, s.t - ownSince);
    if (s.ph === 'play' && s.tick % 30 === 0) {
      const b = s.ball; let a = 0, c = 0;
      for (let i = 0; i < 22; i++) {
        const p = s.pl[i]; if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) m.nan = true;
        if (i % 11 === 0) continue;
        const d = Math.hypot(p.x - b.x, p.z - b.z); if (d < 5) a++; if (d < 10) c++;
        let n = 99; const base = i < 11 ? 0 : 11;
        for (let j = base + 1; j < base + 11; j++) if (j !== i) n = Math.min(n, Math.hypot(s.pl[j].x - p.x, s.pl[j].z - p.z));
        m.nn += n; if (n < 3) m.nnClose++;
      }
      m.samples++; m.near5 += a; m.near10 += c; if (c > 8) m.crowd++;
    }
    if (opts.pack && s.tick % 3 === 0) {
      const text = JSON.stringify({ t: 's', n: s.tick, s: sim.pack(s) });
      m.packMax = Math.max(m.packMax, text.length); m.packSum += text.length; m.packs++;
      if (s.tick % 600 === 0 && !sim.unpack(JSON.parse(text).s)) m.badPack = (m.badPack || 0) + 1;
    }
  }
  m.s = s; return m;
}

export function series(n, levels, opts = {}) {
  const t = { n, hang: 0, nan: 0, goals: 0, hist: {}, win: [0, 0], draw: 0, sc: [0, 0], pas: [0, 0], cmp: [0, 0], sh: [0, 0], on: [0, 0], sav: [0, 0], tkl: [0, 0], cor: [0, 0], pos: [0, 0], maxStuck: 0, maxNoTouch: 0, samples: 0, near5: 0, near10: 0, crowd: 0, nn: 0, nnClose: 0, packMax: 0, packSum: 0, packs: 0, badPack: 0, maxSteps: 0 };
  for (let k = 0; k < n; k++) {
    // Seiten tauschen: in jedem zweiten Spiel steht die erste Stufe auf der anderen Seite
    const swap = opts.swap && k % 2 === 1, lv = swap ? [levels[1], levels[0]] : levels;
    const m = playMatch((opts.seed || 1000) + k * 7919, lv, { pack: opts.packEvery && k % opts.packEvery === 0 }), s = m.s;
    const A = swap ? 1 : 0, B = 1 - A, g = s.sc[0] + s.sc[1];
    if (m.hang) t.hang++; if (m.nan) t.nan++;
    t.goals += g; t.hist[g] = (t.hist[g] || 0) + 1;
    if (s.win === A) t.win[0]++; else if (s.win === B) t.win[1]++; else t.draw++;
    t.sc[0] += s.sc[A]; t.sc[1] += s.sc[B];
    for (const key of ['pas', 'cmp', 'sh', 'on', 'sav', 'tkl', 'cor', 'pos']) { t[key][0] += s.stats[key][A]; t[key][1] += s.stats[key][B]; }
    t.maxStuck = Math.max(t.maxStuck, m.maxStuck); t.maxNoTouch = Math.max(t.maxNoTouch, m.maxNoTouch); t.maxSteps = Math.max(t.maxSteps, m.steps);
    for (const key of ['samples', 'near5', 'near10', 'crowd', 'nn', 'nnClose', 'packSum', 'packs']) t[key] += m[key];
    t.packMax = Math.max(t.packMax, m.packMax); t.badPack += m.badPack || 0;
  }
  return t;
}

export function report(t) {
  const sum = (a) => a[0] + a[1], r = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
  return {
    spiele: t.n, haenger: t.hang, ungueltigeZahlen: t.nan, toreJeSpiel: r(t.goals / t.n), torVerteilung: t.hist, siege: t.win, unentschieden: t.draw, tore: t.sc,
    passquote: r(sum(t.cmp) / sum(t.pas) * 100, 1), paesseJeSpiel: r(sum(t.pas) / t.n, 1), schuesseJeSpiel: r(sum(t.sh) / t.n, 1), aufsTor: r(sum(t.on) / t.n, 1),
    paradenJeSpiel: r(sum(t.sav) / t.n, 1), haltequote: r(sum(t.sav) / (sum(t.sav) + t.goals) * 100, 1), zweikaempfeJeSpiel: r(sum(t.tkl) / t.n, 1), eckenJeSpiel: r(sum(t.cor) / t.n, 1),
    ballbesitzSek: [r(t.pos[0] / t.n, 0), r(t.pos[1] / t.n, 0)],
    laengsterStillstandSek: r(t.maxStuck, 1), laengsterBesitzOhneWechselSek: r(t.maxNoTouch, 1), laengstesSpielSek: r(t.maxSteps / 60, 0),
    feldspielerIn5m: r(t.near5 / t.samples), feldspielerIn10m: r(t.near10 / t.samples), anteilMehrAls8In10m: r(t.crowd / t.samples * 100, 2),
    naechsterMitspielerM: r(t.nn / (t.samples * 20)), anteilMitspielerUnter3m: r(t.nnClose / (t.samples * 20) * 100, 2),
    paketMaxByte: t.packMax, paketMittelByte: t.packs ? r(t.packSum / t.packs, 0) : 0, paketFehler: t.badPack
  };
}

if (process.argv[1] && process.argv[1].endsWith('measure.mjs')) {
  const n = Number(process.argv[2]) || 20, a = process.argv[3] || 'normal', b = process.argv[4] || a;
  const t0 = Date.now(), t = series(n, [a, b], { swap: a !== b, packEvery: 5 });
  console.log(JSON.stringify(report(t))); console.log('Dauer', (Date.now() - t0) / 1000, 's');
}
