// Alle Stellwerte von Neon Kicker. Längen in Tischeinheiten, Zeiten in Sekunden, Winkel im Bogenmaß.
// Koordinaten der Logik: x längs (Tor von Spieler 0 bei -L/2), y quer.

export const TABLE = { L: 14, W: 8.4, goalHalf: 1.35, post: 0.09 };

export const BALL = {
  r: 0.27,
  max: 24,                 // Höchsttempo
  drag: 0.32,              // tempoabhängige Reibung
  roll: 0.45,              // gleichmäßige Rollreibung
  wall: 0.82,              // Rückprall an der Bande
  spinTurn: 0.30,          // wie stark Effet die Bahn dreht
  spinFade: 1.4
};

// Figur: Fuß hängt LEG unter der Stange. Ab |Winkel| > lift ist der Fuß über dem Ball.
export const FIG = { leg: 0.9, hx: 0.14, hy: 0.22, round: 0.08, lift: 1.08, bounce: 0.42 };

// Acht Stangen in echter Aufstellung, von Tor 0 nach Tor 1
export const RODS = [
  { x: -6.125, side: 0, role: 0, fig: [0], range: 1.85 },
  { x: -4.375, side: 0, role: 1, fig: [-1.35, 1.35], range: 2.55 },
  { x: -2.625, side: 1, role: 3, fig: [-2.3, 0, 2.3], range: 1.6 },
  { x: -0.875, side: 0, role: 2, fig: [-2.8, -1.4, 0, 1.4, 2.8], range: 1.1 },
  { x: 0.875, side: 1, role: 2, fig: [-2.8, -1.4, 0, 1.4, 2.8], range: 1.1 },
  { x: 2.625, side: 0, role: 3, fig: [-2.3, 0, 2.3], range: 1.6 },
  { x: 4.375, side: 1, role: 1, fig: [-1.35, 1.35], range: 2.55 },
  { x: 6.125, side: 1, role: 0, fig: [0], range: 1.85 }
];
// Eigene Stangen je Seite: Torwart, Abwehr, Mittelfeld, Sturm
export const OWN = [[0, 1, 3, 5], [7, 6, 4, 2]];
export const ROD_NAMES = ['Torwart', 'Abwehr', 'Mittelfeld', 'Sturm'];

export const SLIDE = { max: 15, acc: 320, follow: 28, assist: 2.4 };
export const SPIN_ROD = {
  k: 520, c: 40,           // Drehfeder (gedämpft, schwingt nicht über)
  windMax: 1.35,           // Ausholen
  backSpeed: 17,           // Tempo des automatischen Ausholens
  strikeMin: 13, strikeAdd: 15,
  end: 1.35, follow: 0.09
};
export const SHOT = { min: 7.5, add: 14.5, offset: 0.52, rodPush: 0.42, assist: 0.16, noise: 0.025, spin: 0.38, buffer: 0.12 };
export const TRAP = { reachX: 0.98, reachY: 0.5, speed: 17, max: 2.0, front: 0.56, back: 0.5, cool: 0.3, lean: 0.3 };

export const MATCH = { goals: 5, time: 180, golden: 60, throwWait: 0.85, goalWait: 1.6, stuck: 3.5, unreachable: 1.2, zone: 14, substeps: 12 };

// Computergegner: Reaktionszeit, Schiebetempo, Wahrnehmungsfehler, Zögern vor dem Schuss
export const CPU = {
  easy: { react: 0.30, speed: 3.6, error: 0.42, lead: 0.15, hesitate: 0.24, cool: 0.9, power: [0.2, 0.55], trap: 0, aim: 0, assist: 1.0, switch: 0.32, miss: 0.35 },
  normal: { react: 0.17, speed: 6.5, error: 0.22, lead: 0.6, hesitate: 0.1, cool: 0.5, power: [0.45, 0.8], trap: 0.12, aim: 0.5, assist: 1.9, switch: 0.16, miss: 0.14 },
  hard: { react: 0.09, speed: 10.5, error: 0.08, lead: 0.95, hesitate: 0.035, cool: 0.3, power: [0.65, 1], trap: 0.22, aim: 1, assist: 2.7, switch: 0.07, miss: 0.04 }
};

// Eingaben am Gerät
export const INPUT = {
  keySpeed: 8.5,           // Tastatur und Gamepad: Einheiten je Sekunde
  dragGain: 1.15,          // Fingerweg zu Stangenweg (1 = genau mit dem Finger)
  flickSpeed: 520,         // ab diesem Tempo (Bildpunkte je Sekunde) schießt ein Wisch
  flickFull: 2100,         // volles Tempo = härtester Schuss
  flickTravel: 16,
  windTravel: 70,          // Bildpunkte Zurückziehen für volles Ausholen
  chargeTime: 0.55,        // Knopf halten bis voller Schuss
  manualHold: 2.5          // so lange gilt eine Handwahl, bevor die Automatik wieder wählt
};

export const COLORS = ['#22d3ee', '#ff4fa3'];
