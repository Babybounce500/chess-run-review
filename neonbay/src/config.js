// Alle Stellwerte. Längen in Metern, Zeiten in Sekunden, Winkel in Bogenmaß.
export const DT = 1 / 60;
export const SEED = 20261127;                       // Startwert der Stadt "Neon Bay"

export const MAP = {
  half: 300,                                        // Karte reicht von -300 bis +300
  edge: 296,                                        // ab hier steht die Randmauer
  seaZ: 262,                                        // Wasser im Westen
  harbourX: 140, harbourZ: 232,                     // Hafenbecken im Osten
  pierX0: 212, pierX1: 226, pierZ1: 285,
  beachZ: 232
};

export const CITY = {
  vRoads: 8, hRoads: 7,
  vFrom: -282, vTo: 282, hFrom: -282, hTo: 178,
  road: 12, avenue: 18, beachRoad: 16,
  sidewalk: 4, alley: 9, merges: 6,
  curbCars: 26
};

// Fahrzeug "Brandung GT" (erfunden)
export const CAR = {
  length: 4.5, width: 2.0, radius: 1.0, offsets: [-1.25, -0.42, 0.42, 1.25], wheelbase: 2.7,
  engine: 11.5, topParam: 48,                        // Antrieb fällt bis zu diesem Tempo auf null; mit Luftwiderstand rund 135 km/h
  maxSpeed: 40,                                      // harte Obergrenze (144 km/h)
  reverseAccel: 7, reverseMax: 9,
  brake: 23, roll: 1.2, drag: 0.0016,
  steerLow: 0.7, steerHigh: 0.15, steerFadeSpeed: 32,
  steerIn: 4.5, steerBack: 7.5,                      // wie schnell die Lenkung folgt
  latGrip: 21,                                       // maximale Querbeschleunigung beim Lenken
  sideRate: 10, sideMax: 26,                         // wie schnell seitliches Rutschen abgebaut wird
  driftRate: 1.5, driftMax: 7.5, driftYaw: 2.25,     // Handbremse
  handDecel: 5.5,
  driftRecover: 1.7,                                 // pro Sekunde ohne Handbremse
  yawResponse: 11, yawResponseDrift: 5,
  restitution: 0.22,
  damageFrom: 5, damagePer: 1.5                      // Schaden ab dieser Aufprallgeschwindigkeit
};

export const PLAYER = {
  radius: 0.4, walk: 3.4, sprint: 6.8, accel: 32, turn: 14,
  gravity: 18, jump: 5.6, jumpBuffer: 0.12,
  enterRange: 1.9, enterMaxSpeed: 3, exitMaxSpeed: 4.5
};

// Qualitätsstufen
export const QUALITY = {
  low: { label: 'Niedrig', ratio: 0.8, maxRatio: 1, view: 180, particles: false },
  medium: { label: 'Mittel', ratio: 1, maxRatio: 1.25, view: 240, particles: true },
  high: { label: 'Hoch', ratio: 1, maxRatio: 1.5, view: 310, particles: true }
};
export const CHUNK = 100;
