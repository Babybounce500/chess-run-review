// Abnahme aus dem Plan: 500 Spiele Computer gegen Computer, ohne Grafik.   node tests/match-test.mjs [anzahlFaktor]
// Die Grenzwerte stehen fest; sie werden nicht an Ergebnisse angepasst.
import { series, report } from '../tools/measure.mjs';

const factor = Number(process.argv[2]) || 1;
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n + (x !== undefined ? '  (' + x + ')' : '')); } else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  -> ' + x : '')); } };
const groups = [
  ['normal gegen normal', ['normal', 'normal'], 200],
  ['schwer gegen leicht', ['hard', 'easy'], 100],
  ['schwer gegen normal', ['hard', 'normal'], 100],
  ['normal gegen leicht', ['normal', 'easy'], 100]
];
const total = { n: 0, hang: 0, goals: 0, pas: 0, cmp: 0 };
const t0 = Date.now();
for (let g = 0; g < groups.length; g++) {
  const [name, levels, count] = groups[g], n = Math.max(2, Math.round(count * factor));
  const t = series(n, levels, { seed: 20000 + g * 100000, swap: levels[0] !== levels[1], packEvery: 10 }), r = report(t);
  console.log('\n' + name + ' (' + n + ' Spiele)'); console.log(JSON.stringify(r));
  total.n += n; total.hang += t.hang; total.goals += t.goals; total.pas += t.pas[0] + t.pas[1]; total.cmp += t.cmp[0] + t.cmp[1];
  ok('alle Spiele enden, keine Hänger', r.haenger === 0, r.haenger);
  ok('keine ungültigen Zahlen', r.ungueltigeZahlen === 0);
  ok('Ball bleibt nie länger als 10 s liegen', r.laengsterStillstandSek < 10, r.laengsterStillstandSek + ' s');
  ok('Tore je Spiel im Mittel 1 bis 5', r.toreJeSpiel >= 1 && r.toreJeSpiel <= 5, r.toreJeSpiel);
  ok('Passquote 60 bis 85 %', r.passquote >= 60 && r.passquote <= 85, r.passquote + ' %');
  ok('kein Klumpen: im Mittel höchstens 5 Feldspieler in 10 m um den Ball', r.feldspielerIn10m <= 5, r.feldspielerIn10m);
  ok('kein Klumpen: mehr als 8 in 10 m seltener als 1 %', r.anteilMehrAls8In10m < 1, r.anteilMehrAls8In10m + ' %');
  ok('Mitspieler halten Abstand: nächster im Mittel mindestens 7 m', r.naechsterMitspielerM >= 7, r.naechsterMitspielerM + ' m');
  ok('Netzpaket unter 1500 Byte', r.paketMaxByte < 1500 && r.paketFehler === 0, r.paketMaxByte + ' B');
  if (levels[0] !== levels[1]) ok('höhere Stufe gewinnt klar öfter (mindestens doppelt so oft)', t.win[0] >= 2 * Math.max(1, t.win[1]), t.win[0] + ' : ' + t.win[1] + ' bei ' + t.draw + ' Unentschieden');
}
console.log('\nGesamt: ' + total.n + ' Spiele, Hänger ' + total.hang + ', Tore je Spiel ' + (total.goals / total.n).toFixed(2) + ', Passquote ' + (total.cmp / total.pas * 100).toFixed(1) + ' %, Dauer ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`); process.exit(fail ? 1 : 0);
