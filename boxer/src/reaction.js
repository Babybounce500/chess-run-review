// Schnellste Reaktion: Zeit vom Ausholen des Gegners bis zum eigenen Tastendruck, der die erfolgreiche Abwehr eingeleitet hat.
// Gemessen wird an der Eingabe und an der Spielzeit, die gerade zu sehen ist: online zählt so weder Leitung noch Ausgleich mit.
import { windOf } from './sim.js';

const FASTEST = 0.08;            // darunter war es geraten, nicht reagiert

export function createReaction() {
  let thrown = -1, start = null, until = 0, onset = null, was = false, best = null, last = null;
  return {
    reset() { thrown = -1; start = null; until = 0; onset = null; was = false; best = null; last = null; },
    // je Bild mit dem angezeigten Zustand: neuer Schlag des Gegners?
    update(s, me) {
      if (!s) return;
      const foe = s.f[1 - me];
      if (foe.act && foe.stats.thrown !== thrown) { thrown = foe.stats.thrown; start = s.t - foe.act.t; until = start + windOf(foe.act) + 0.02; onset = null; }
    },
    // eigene Eingabe: nur ein neuer Druck zwischen Ausholen und Einschlag zählt, der letzte gewinnt
    input(t, defending) {
      if (defending && !was && start !== null && t >= start && t <= until) onset = t;
      was = !!defending;
    },
    // beim Ereignis „ausgewichen“ oder „pariert“ der eigenen Seite
    success() {
      if (onset === null) return null;
      const r = onset - start; onset = null;
      if (r < FASTEST || r > 1) return null;
      last = Math.round(r * 1000); if (best === null || last < best) best = last;
      return last;
    },
    best: () => best, last: () => last
  };
}
