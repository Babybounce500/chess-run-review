// Alle Stellwerte. Längen in Metern, Zeiten in Sekunden.
export const PITCH = { halfL: 52.5, halfW: 34, goalHalf: 3.66, goalH: 2.44, goalDepth: 2.2, boxDepth: 16.5, boxHalf: 20.16, sixDepth: 5.5, sixHalf: 9.16, circle: 9.15, spot: 11 };

export const MATCH = {
  half: 180,          // Länge einer Halbzeit (Uhr)
  stoppage: 3,        // so lange darf ein laufender Schuss die Halbzeit verlängern
  setMin: 0.8,        // frühestens dann darf eine Standardsituation ausgeführt werden
  setAuto: 6,         // spätestens dann führt der Computer sie aus
  goalPause: 3.2,
  halfPause: 3.5
};

export const BALL = { r: 0.11, g: 9.81, bounce: 0.58, grip: 0.86, roll: 3.1, drag: 0.12, postR: 0.07, maxV: 38 };

export const MOVE = {
  speed: { gk: 6.0, def: 6.7, mid: 6.8, fwd: 7.0 },
  sprint: 1.24, carry: 0.89, carrySprint: 0.9,
  accel: 17, brake: 24, turn: 26,
  drain: 0.13, regen: 0.06, tired: 0.84,      // Ausdauer: Verbrauch, Erholung, Tempo ohne Ausdauer
  bump: 0.75
};

export const KICK = {
  full: 0.8,                    // Haltezeit für volle Stärke
  windup: 0.1,
  buffer: 0.2,                  // früher Druck gilt noch so lange, wenn der Ball ankommt
  passEnd: 7.5,                 // Ankunftstempo eines flachen Passes
  loftFrom: 30,                 // ab dieser Entfernung fliegt der Ball
  shotMin: 18, shotMax: 31,
  passErr: 0.045, shotErr: 0.055   // Streuung in Radiant, ohne Druck
};

export const TACKLE = {
  reach: 1.15, cooldown: 1.0, immune: 0.65,
  base: 0.40, front: 0.14, behind: -0.2, sprinting: 0.12,
  slideTime: 0.55, slideSpeed: 9.2, slideDown: 0.65, slideReach: 1.05
};

// Computerstufen: nur Reaktion und Entscheidungsgüte, Tempo und Physik sind für alle gleich
export const LEVELS = {
  easy:   { think: 0.36, react: 0.37, noise: 0.95, shotRange: 22, press: 3.6, tackleWait: 0.32, keeper: 0.33, sense: 0.55, aim: 1.28 },
  normal: { think: 0.25, react: 0.28, noise: 0.6,  shotRange: 24, press: 4.0, tackleWait: 0.23, keeper: 0.27, sense: 0.73, aim: 1.1 },
  hard:   { think: 0.16, react: 0.19, noise: 0.3,  shotRange: 25, press: 4.5, tackleWait: 0.15, keeper: 0.22, sense: 0.9,  aim: 0.95 }
};

// 4-4-2 im Angriffsblick: x = nach vorn (Mitte 0), z = seitlich
export const FORMATION = [
  { r: 'gk',  n: 'TW', x: -50, z: 0 },
  { r: 'def', n: 'LV', x: -31, z: -22 },
  { r: 'def', n: 'IV', x: -35, z: -7.5 },
  { r: 'def', n: 'IV', x: -35, z: 7.5 },
  { r: 'def', n: 'RV', x: -31, z: 22 },
  { r: 'mid', n: 'LM', x: -10, z: -23 },
  { r: 'mid', n: 'ZM', x: -16, z: -7 },
  { r: 'mid', n: 'ZM', x: -10, z: 7 },
  { r: 'mid', n: 'RM', x: -8,  z: 23 },
  { r: 'fwd', n: 'ST', x: 8,   z: -9 },
  { r: 'fwd', n: 'ST', x: 11,  z: 8 }
];

// Erfundene Nachnamen, je Mannschaft elf
export const NAMES = [
  ['Falkner', 'Orwin', 'Brannic', 'Tessmar', 'Jelko', 'Quirin', 'Moravec', 'Sandow', 'Ilves', 'Varga-Lind', 'Korbeck'],
  ['Eisvogt', 'Norrby', 'Calder', 'Wieland-Os', 'Petrak', 'Haveloh', 'Zettin', 'Imrek', 'Douvan', 'Rastelle', 'Umbach']
];
export const TEAMS = [{ name: 'Lichtwerk', kit: 0xff5a36, trim: 0xffffff, shorts: 0x2a1030, gk: 0xffd21f }, { name: 'Nordhafen', kit: 0x2f7dff, trim: 0xffffff, shorts: 0xf2f5ff, gk: 0x25e08a }];
