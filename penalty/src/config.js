// Alle Stellwerte an einer Stelle. Längen in Metern, Zeiten in Sekunden.
export const FIELD = {
  goalW: 6.0, goalH: 2.4, post: 0.07,
  goalZ: -11, keeperZ: -10.65,          // Ebene, in der der Torwart den Ball abfängt
  ballR: 0.14, spotZ: 0, g: 9.81
};
export const SHOT = {
  maxAimX: 1.25,                        // 1 = Pfosten, darüber daneben
  maxAimY: 1.35,                        // 1 = Latte
  sweet: [0.55, 0.82],                  // genaue Kraft
  timeSlow: 0.95, timeFast: 0.40,       // Flugzeit bei Kraft 0 und 1
  curveAccel: 9,                        // seitliche Beschleunigung bei vollem Effet
  spreadBase: 0.025, spreadOver: 0.34,  // Streuung (in Torhälften), Zusatz bei zu viel Kraft
  spreadSoft: 0.07, liftOver: 0.30
};
export const KEEPER = {
  diveTime: 0.56,                       // bis zur vollen Streckung
  onlineStart: -0.02,                   // online: Absprung beim Schuss, für beide gleich
  earliest: -0.12,
  reachX: 1.8, minY: 0.35, maxY: 1.75, // wie weit der Körper wandert
  arm: 0.62, bodyR: 0.25, handR: 0.27
};
export const MATCH = { kicks: 5, choiceSeconds: 25 };
export const CPU = {
  easy:   { read: 0.22, err: 0.75, start: [0.16, 0.30], aimErr: 0.30, corner: 0.45 },
  normal: { read: 0.38, err: 0.50, start: [0.10, 0.22], aimErr: 0.16, corner: 0.65 },
  hard:   { read: 0.55, err: 0.32, start: [0.05, 0.15], aimErr: 0.07, corner: 0.85 }
};
export const STEP = 1 / 120;            // fester Rechentakt der Ballbahn
