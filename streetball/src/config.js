// Alle Stellwerte an einer Stelle. Längen in Metern, Zeiten in Sekunden.
// Koordinaten: x quer, y hoch, z vom Korb weg (z = 0 ist die Grundlinie).

export const COURT = {
  halfW: 6.2, minZ: 0.45, maxZ: 10.8,      // Laufbereich der Spieler
  threeR: 5.4,                             // Abstand der Dreierlinie vom Korb
  wallX: 7.3, wallZ0: -0.35, wallZ1: 11.7  // Käfig: hier prallt der Ball ab
};

export const HOOP = {
  x: 0, y: 3.05, z: 1.35, r: 0.235, tube: 0.018,
  boardZ: 0.95, boardHalfW: 0.9, boardY0: 2.9, boardY1: 3.98
};

export const BALL = { r: 0.12, g: 9.81, sub: 4, rimBounce: 0.55, boardBounce: 0.62, floorBounce: 0.68 };

export const PLAYER = {
  radius: 0.38,
  speed: 4.1, sprint: 5.9, ballFactor: 0.93,
  accel: 19, brake: 27, turn: 13,
  gatherSpeed: 0.45,                        // Anteil der Laufgeschwindigkeit beim Wurfladen
  drain: 0.27, regen: 0.16, regenStill: 0.28, tired: 0.25,
  jumpV: 3.95, shotJumpV: 3.45,
  reach: 2.35,                              // Höhe der gestreckten Hand im Stand
  buffer: 0.12                              // Eingabepuffer
};

export const SHOT = {
  full: 0.86,                               // Dauer, bis die Anzeige voll ist
  ideal: 0.68,                              // Mitte der grünen Zone (Anteil der Anzeige)
  lift: 0.2,                                // ab hier hebt der Schütze ab
  fake: 0.22,                               // früher losgelassen = Wurffinte
  green: 0.105, greenMin: 0.018
};

export const MOVES = {
  layupRange: 2.7, dunkRange: 2.8, dunkSpeed: 4.35,
  layupTime: 0.62, layupRelease: 0.36,
  dunkTime: 0.86, dunkSlam: 0.46,
  crossTime: 0.34, crossCooldown: 1.5, crossSpeed: 5.8, crossProtect: 0.28,
  stealTime: 0.42, stealFrom: 0.09, stealTo: 0.24, stealRecover: 0.38, stealCooldown: 0.9, stealReach: 0.72, stealRadius: 0.6, stealHeight: 0.78,
  blockWindup: 0.07,
  stumble: 0.55
};

export const MATCH = {
  target: 11, time: 180, sudden: 45, shotClock: 14,
  check: 1.1, dead: 1.7, finalDead: 2.0, looseMax: 7
};

// Computergegner: Reaktionszeit, Genauigkeit und Fehlerquote
export const CPU = {
  easy:   { react: 0.46, pace: 0.82, relErr: 0.15,  blockP: 0.22, blockErr: 0.22,   stealP: 0.14, stealDelay: 0.3,  drive: 0.35, cross: 0.08, open: 0.5,  gap: 1.65, boardP: 0.35, sprint: 0.35 },
  normal: { react: 0.28, pace: 0.93, relErr: 0.085, blockP: 0.4, blockErr: 0.13,  stealP: 0.3,  stealDelay: 0.14, drive: 0.5,  cross: 0.3,  open: 0.34, gap: 1.35, boardP: 0.65, sprint: 0.65 },
  hard:   { react: 0.17, pace: 1.0,  relErr: 0.045, blockP: 0.58, blockErr: 0.08, stealP: 0.48, stealDelay: 0.06, drive: 0.55, cross: 0.55, open: 0.26, gap: 1.1, boardP: 0.9,  sprint: 0.9 }
};

export const TEAM = [0xff7a2f, 0x2aa9ff];
export const TEAM_CSS = ['#ff8a3d', '#46bfff'];
