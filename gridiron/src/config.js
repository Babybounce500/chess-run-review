// Alle Stellwerte. Längen in Metern, Zeiten in Sekunden.
// Spielfeld der Logik: x quer (0 = Mitte), z längs. Der Angriff läuft immer Richtung +z.
export const FIELD = { halfW: 8, goal: 40, endDepth: 6 };

export const MATCH = {
  drives: 2,          // Angriffsserien je Seite in der regulären Zeit
  downs: 4,           // Versuche für ein neues First Down
  gain: 11,           // nötiger Raumgewinn
  start: 12,          // Startpunkt eines Drives
  otStart: 19,        // Startpunkt in der Verlängerung
  otRounds: 3,        // danach entscheidet der Raumgewinn
  maxDrivePlays: 9,   // Notbremse gegen endlose Drives
  timeCap: 232        // Notbremse: nach so vielen Spielsekunden endet die Partie mit dem laufenden Spielzug
};

export const TIME = {
  pick: 6.5,          // Wahl von Spielzug und Aufstellung
  setMin: 1.0,        // frühester Snap nach dem Aufstellen
  setMax: 3.6,        // danach automatischer Snap
  dead: 1.9,          // Anzeige des Ergebnisses
  deadBig: 2.8,       // bei Touchdown und Ballverlust
  live: 13,           // längster Spielzug
  buffer: 0.12        // Eingabepuffer
};

// Reihenfolge der Figuren: 0 Quarterback, 1 Receiver links, 2 Receiver rechts, 3 Läufer, 4 Rusher, 5 Decker links, 6 Decker rechts, 7 Safety
export const ROLES = ['qb', 'wr', 'wr', 'rb', 'rush', 'cb', 'cb', 'saf'];
export const SPEED = { qb: 6.0, wr: 7.25, rb: 6.95, rush: 6.2, cb: 7.18, saf: 7.15 };

export const MOVE = {
  accel: 17,          // Beschleunigen
  brake: 26,          // Abbremsen und Gegenlenken
  turn: 21,           // seitliche Beschleunigung: bestimmt den Wenderadius (v² / turn)
  sprint: 1.21,       // Sprintfaktor
  drain: 0.42,        // Ausdauer je Sekunde Sprint
  regen: 0.22,
  carry: 0.94,       // Ballträger ist etwas langsamer
  radius: 0.72        // Mindestabstand zwischen Figuren
};

export const ACT = { run: 0, dive: 1, down: 2, juke: 3, stiff: 4, stumble: 5, throw: 6, catch: 7, jump: 8, cheer: 9 };

export const ACTION = {
  dive: { windup: 0.07, hitEnd: 0.4, dur: 0.48, speed: 10.2, ground: 0.75, reach: 1.15, aim: 4.2, cone: 0.35, cool: 0.5 },
  juke: { dur: 0.34, safe: 0.3, side: 8.2, cool: 1.15 },
  stiff: { dur: 0.5, cool: 1.8, reach: 1.45, slow: 0.93 },
  jump: { dur: 0.62, from: 0.04, to: 0.5, cool: 0.55, reach: 1.75 },
  grab: { reach: 0.92, need: 0.28, slow: 0.45 },
  stumble: 0.95,
  blockHold: 1.1
};

export const PASS = {
  ready: 0.35,        // frühester Wurf nach dem Snap
  windup: 0.13,       // Ausholen bis zum Abwurf
  highAfter: 0.24,    // ab dieser Haltedauer wird es ein hoher Ball
  maxHold: 0.6,       // dann wirft der Quarterback von selbst
  flat: { speed: 18.5, apex: 0.35, apexPerM: 0.02, min: 0.3 },
  high: { speed: 12.2, apex: 2.3, apexPerM: 0.1, min: 0.75 },
  release: 2.0,       // Abwurfhöhe
  catchY: 1.45,       // Fanghöhe
  catchReach: 1.6,
  scatter: 0.14
};

// Wartezeit, bevor die Verteidigung nach dem Snap über die Linie darf ("Zählen")
export const FORMATIONS = [
  { id: 'mann', name: 'Manndeckung', info: 'Jeder deckt einen Gegner eng.', rushWait: 2.0,
    spots: [[0, 1.3], [-5.8, 2.6], [5.8, 2.6], [0.6, 7.5]], job: ['rush', 'man1', 'man2', 'man3'] },
  { id: 'zone', name: 'Raumdeckung', info: 'Tief sicher, kurz etwas offen.', rushWait: 2.0,
    spots: [[0, 1.3], [-4.8, 5.2], [4.8, 5.2], [0, 11]], job: ['rush', 'zone', 'zone', 'deep'] },
  { id: 'blitz', name: 'Blitz', info: 'Zwei stürmen früh, Läufer frei.', rushWait: 1.25,
    spots: [[-1.8, 1.3], [-5.8, 3.2], [5.8, 3.2], [2.2, 2.2]], job: ['rush', 'man1', 'man2', 'rush'] }
];
// Neutrale Wartestellung, solange verdeckt gewählt wird (verrät nichts)
export const HUDDLE_DEF = [[0, 2], [-5.2, 4], [5.2, 4], [0.4, 6.4]];
export const LINEUP = [[0, -3.6], [-5.9, -0.7], [5.9, -0.7], [1.9, -4.2]];

// Laufwege relativ zum Startpunkt der Figur: [quer, vorwärts]. stop = am Ende stehen bleiben und anbieten
export const PLAYS = [
  { id: 'tief', name: 'Tiefschuss', info: 'Zwei laufen weit, Läufer kurz rechts.',
    routes: [null, { pts: [[-0.4, 8], [-0.4, 24]] }, { pts: [[0, 7], [-4.6, 15], [-5.4, 22]] }, { pts: [[3.8, 4], [5.2, 7.5]], stop: true }] },
  { id: 'kreuz', name: 'Kreuzfeuer', info: 'Schnelle Wege quer durch die Mitte.',
    routes: [null, { pts: [[0.3, 3], [6.5, 8], [11.5, 11]] }, { pts: [[0, 7.5], [-7.5, 8.5], [-10, 9]] }, { pts: [[-3.6, 4.5], [-6.6, 6]], stop: true }] },
  { id: 'aussen', name: 'Außenbahn', info: 'Haken links, Stopp rechts, Läufer tief.',
    routes: [null, { pts: [[0, 6.5], [-1.7, 7.4]], stop: true }, { pts: [[0.2, 10.5], [-1.4, 8.6]], stop: true }, { pts: [[-6.4, 3], [-8.8, 7], [-8.8, 20]] }] },
  { id: 'lauf', name: 'Durchbruch', info: 'Der Läufer bekommt den Ball, die anderen blocken.', run: true,
    routes: [null, { block: 5 }, { block: 6 }, { pts: [[-1.9, 3.2], [-1.9, 14]] }] }
];
export const HANDOFF_AT = 0.42;

// Passtasten 1, 2, 3 -> Figur
export const TARGETS = [1, 3, 2];

// Computergegner: Reaktionszeit, Vorhalten, Entschlossenheit, Fehler
export const CPU = {
  easy: { react: 0.5, lead: 0.35, dive: 1.6, jump: 0.22, juke: 0.2, pace: 0.9, aim: 2.1, throwAt: 1.75, need: 2.5, noise: 2.4, think: 0.5 },
  normal: { react: 0.3, lead: 0.72, dive: 3.2, jump: 0.5, juke: 0.5, pace: 0.965, aim: 1.25, throwAt: 1.35, need: 2.1, noise: 1.1, think: 0.3 },
  hard: { react: 0.17, lead: 0.98, dive: 5.2, jump: 0.64, juke: 0.8, pace: 1.0, aim: 0.9, throwAt: 1.1, need: 1.85, noise: 0.35, think: 0.18 }
};
