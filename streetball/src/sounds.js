// Eigene Töne des Spiels (im Browser erzeugt, keine Dateien).
export const SOUNDS = {
  dribble: (p = 1, { tone, hiss }) => { tone(135, 62, 0.34 * p, 0.11, 'sine'); hiss(650, 1.1, 0.1 * p, 0.035); },
  rim: (v = 3, { tone, hiss }) => { const k = Math.min(1, 0.25 + v / 8); [523, 817, 1291, 1960].forEach((f, i) => tone(f, f * 0.99, (0.3 * k) / (i + 1), 0.55, 'triangle')); hiss(2300, 2.5, 0.14 * k, 0.04); },
  board: (v = 3, { tone, hiss }) => { const k = Math.min(1, 0.3 + v / 8); tone(190, 120, 0.45 * k, 0.18, 'triangle'); tone(415, 380, 0.14 * k, 0.12, 'square'); hiss(1200, 1, 0.2 * k, 0.05); },
  swoosh: (a, { hiss }) => hiss(1100, 0.8, 0.12, 0.2, 'bandpass', 0, 0.08),
  jump: (a, { hiss }) => hiss(300, 1.4, 0.12, 0.09),
  squeak: (a, { tone }) => { const f = 1700 + Math.random() * 600; tone(f, f * 1.35, 0.045, 0.09, 'square'); tone(f * 1.5, f * 1.2, 0.025, 0.07, 'sawtooth', 0.04); },
  dunk: (a, { tone, hiss }) => { tone(120, 38, 0.85, 0.4); hiss(1500, 0.7, 0.4, 0.18); [440, 660, 990].forEach((f, i) => tone(f, f * 0.97, 0.18 / (i + 1), 0.8, 'triangle', 0.03)); },
  block: (a, { tone, hiss }) => { hiss(1400, 0.8, 0.55, 0.09); tone(260, 80, 0.5, 0.14, 'triangle'); },
  steal: (a, { tone, hiss }) => { hiss(2200, 1.2, 0.35, 0.06); tone(500, 900, 0.14, 0.1, 'triangle', 0.03); },
  whiff: (a, { hiss }) => hiss(700, 0.6, 0.12, 0.16, 'bandpass', 0, 0.05),
  check: (a, { tone }) => { tone(660, 660, 0.14, 0.08, 'triangle'); tone(990, 990, 0.14, 0.12, 'triangle', 0.1); },
  buzzer: (a, { tone }) => { tone(196, 192, 0.2, 0.75, 'sawtooth'); tone(247, 243, 0.14, 0.75, 'square'); }
};
