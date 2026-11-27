// Schnellste Reaktion: Zeit vom Ausholen des Gegners bis zum Beginn der eigenen Abwehr, die Erfolg hatte.
const FASTEST = 0.08;            // darunter war es geraten, nicht reagiert

export function createReaction() {
  let thrown = -1, start = null, onset = null, was = false, best = null, last = null;
  const defending = (f) => f.guard === 1 || Math.abs(f.lean) > 0.15 || f.duck > 0.15;
  return {
    reset() { thrown = -1; start = null; onset = null; was = false; best = null; last = null; },
    // je Bild mit dem angezeigten Zustand
    update(s, me) {
      if (!s) return;
      const f = s.f[me], foe = s.f[1 - me], now = defending(f);
      if (foe.act && foe.stats.thrown !== thrown) { thrown = foe.stats.thrown; start = s.t - foe.act.t; onset = null; was = was && now; }
      // nur ein Wechsel in die Abwehr zählt; wer schon vorher abgewehrt hat, hat nicht reagiert
      if (now && !was && start !== null && onset === null) onset = s.t;
      was = now;
    },
    // beim Ereignis „ausgewichen“ oder „pariert“ der eigenen Seite
    success() {
      if (start === null || onset === null) return null;
      const r = onset - start; onset = null;
      if (r < FASTEST || r > 1) return null;
      last = Math.round(r * 1000); if (best === null || last < best) best = last;
      return last;
    },
    best: () => best, last: () => last
  };
}
