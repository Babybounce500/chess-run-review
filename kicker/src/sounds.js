// Eigene Töne des Tisches (werden im Browser erzeugt).
export const sounds = {
  clack: (p = 0.4, { tone, hiss }) => { tone(1250 + p * 500, 620, 0.09 + p * 0.2, 0.035, 'square'); hiss(3100, 3, 0.1 + p * 0.25, 0.03); },
  bank: (p = 0.4, { tone, hiss }) => { tone(210 + p * 90, 95, 0.14 + p * 0.28, 0.08, 'triangle'); hiss(760, 1.2, 0.07 + p * 0.12, 0.05); },
  shot: (p = 0.7, { tone, hiss }) => { tone(330 + p * 260, 70, 0.28 + p * 0.45, 0.11, 'triangle'); hiss(2100, 1.4, 0.16 + p * 0.34, 0.055); tone(1500, 900, 0.05 + p * 0.1, 0.03, 'square'); },
  trap: (a, { tone, hiss }) => { tone(560, 280, 0.18, 0.09, 'sine'); hiss(900, 2, 0.1, 0.05); },
  throwin: (a, { tone }) => { tone(440, 440, 0.1, 0.08, 'triangle'); tone(660, 660, 0.1, 0.12, 'triangle', 0.1); },
  goal: (a, { tone, hiss }) => { hiss(240, 0.7, 0.55, 0.28); tone(95, 45, 0.5, 0.35); [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, f * 1.01, 0.13, 0.22, 'sawtooth', 0.12 + i * 0.075)); }
};
