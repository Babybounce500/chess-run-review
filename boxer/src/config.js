// Alle Stellwerte. Zeiten in Sekunden, Längen in Metern.
export const MATCH = { rounds: 3, roundTime: 60, intro: 2.2, rest: 9, endHold: 6.5 };   // Pause und Nachlauf lang genug für Wiederholung und Richter
export const RING = { minGap: 0.78, maxGap: 2.3, startGap: 1.7, stepSpeed: 1.35 };

// wind: Ausholen bis zum Treffer, back: Zurücknehmen danach, range: Reichweite (Abstand), dmg: Schaden, cost: Ausdauer
export const PUNCH = {
  jab:   { name: 'Jab',      wind: 0.14, back: 0.17, range: 1.78, dmg: 4.5, cost: 4,  line: 'straight' },
  cross: { name: 'Cross',    wind: 0.25, back: 0.29, range: 1.68, dmg: 10,  cost: 9,  line: 'straight' },
  hook:  { name: 'Haken',    wind: 0.28, back: 0.31, range: 1.30, dmg: 12,  cost: 11, line: 'hook' },
  upper: { name: 'Uppercut', wind: 0.32, back: 0.36, range: 1.12, dmg: 14,  cost: 13, line: 'upper' }
};
export const BODY = { dmg: 0.8, drain: 1.15, chin: 0.45 };      // Körper: weniger Schaden, zehrt die Ausdauer, kaum Niederschläge
export const FIGHT = {
  hp: 100, stamina: 100,
  regen: 13, regenGuard: 5, regenDelay: 0.35,                    // Ausdauer je Sekunde; kurz nach einem Schlag nichts
  tiredAt: 30, tiredSlow: 1.35, tiredDmg: 0.65,
  whiffCost: 0.5, whiffBack: 1.3,                                 // Fehlschlag: kostet mehr und lässt länger offen
  buffer: 0.14,                                                    // Eingabepuffer
  lean: 8, duck: 9,                                                // wie schnell Ausweichen greift (je Sekunde)
  slipAt: 0.55, duckAt: 0.6,
  guardHead: 0.14, guardBody: 0.35, guardWrong: 0.62,              // Schadensanteil hinter der Deckung (passend / falsche Höhe)
  guardCost: 0.75,
  aggression: 0.4,                                                 // Richter: so viel zählt ein geblockter Schlag
  parryWindow: 0.15, parryStun: 0.55, parryCooldown: 0.45,
  counterWindow: 0.65, counterDmg: 1.45,
  openDmg: 1.18,                                                    // Treffer in die eigene Schlagbewegung
  intoHook: 1.3,                                                    // in den Haken hineingelehnt
  stunBig: 0.28, stunDmg: 10,
  rockedHp: 22, downHit: 9                                          // angeschlagen: ab diesem Treffer geht es zu Boden
};
export const DOWN = {
  count: 10, tick: 0.95,
  need: [3, 4, 5],                                                  // nötige Treffer im Zeitfenster je Niederschlag
  width: [0.30, 0.24, 0.19], speed: [0.95, 1.15, 1.35],
  rewind: 0.45,                                                     // online: so weit wird höchstens zurückgerechnet
  hp: [42, 32, 22], tko: 3                                          // dritter Niederschlag in einer Runde: Abbruch
};
export const CPU = {
  //           Reaktion  Abwehrquote  richtige Wahl  Angriffe/s  Kombo   Konter  Ausdauer-Disziplin  Aufstehen
  easy:   { learn: 0, react: 0.33, guard: 0.38, smart: 0.52, rate: 0.82, combo: 0.25, counter: 0.28, keep: 14, getup: 0.68 },
  normal: { learn: 0.4, react: 0.27, guard: 0.49, smart: 0.63, rate: 1.00, combo: 0.36, counter: 0.44, keep: 21, getup: 0.82 },
  hard:   { learn: 0.65, react: 0.22, guard: 0.60, smart: 0.74, rate: 1.16, combo: 0.46, counter: 0.60, keep: 28, getup: 0.90 },
  // Karriere. want: Wunschabstand · body: Anteil Körpertreffer · slip/duck: wie gern ausgewichen statt gedeckt · near/mid/far: Lieblingsschläge
  k1:     { learn: 0, react: 0.34, guard: 0.30, smart: 0.45, rate: 0.95, combo: 0.30, counter: 0.20, keep: 10, getup: 0.65, want: 1.18, near: ['hook', 'hook', 'upper', 'hook', 'jab'], mid: ['hook', 'cross', 'hook', 'jab'] },
  k2:     { learn: 0.35, react: 0.27, guard: 0.74, smart: 0.50, rate: 0.72, combo: 0.28, counter: 0.40, keep: 24, getup: 0.78, want: 1.30, body: 0.10, slip: 0.08, duck: 0.15, idle: 1.5 },
  k3:     { learn: 0.45, react: 0.28, guard: 0.42, smart: 0.60, rate: 1.32, combo: 0.64, counter: 0.36, keep: 9,  getup: 0.82, want: 1.40, near: ['jab', 'jab', 'hook', 'cross', 'jab'], mid: ['jab', 'cross', 'jab', 'jab'] },
  k4:     { learn: 0.65, react: 0.21, guard: 0.66, smart: 0.80, rate: 0.98, combo: 0.46, counter: 0.84, keep: 28, getup: 0.86, want: 1.52, slip: 0.85, duck: 0.35 },
  k5:     { learn: 0.8, react: 0.19, guard: 0.70, smart: 0.86, rate: 1.26, combo: 0.56, counter: 0.76, keep: 29, getup: 0.93, want: 1.25, body: 0.36, near: ['upper', 'hook', 'cross', 'hook', 'cross'] }
};
