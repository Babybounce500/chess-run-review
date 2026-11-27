// Eigene Töne, im Browser erzeugt. Kein Dauergeräusch.
export const SOUNDS = {
  thud: (p = 8, { tone, hiss }) => { const k = Math.min(1, p / 16); tone(150 - k * 60, 40, 0.35 + k * 0.55, 0.12 + k * 0.1); hiss(1300 - k * 600, 0.8, 0.22 + k * 0.4, 0.05 + k * 0.05, 'lowpass'); },
  bodyshot: (p = 8, { tone, hiss }) => { tone(95, 38, 0.55, 0.17); hiss(480, 0.7, 0.35, 0.09, 'lowpass'); },
  guard: (_, { tone, hiss }) => { hiss(720, 1.4, 0.3, 0.06); tone(240, 150, 0.16, 0.06, 'triangle'); },
  parry: (_, { tone }) => { tone(1560, 1540, 0.2, 0.28, 'triangle'); tone(2330, 2300, 0.12, 0.22, 'sine'); },
  whoosh: (_, { hiss }) => hiss(900, 1.6, 0.07, 0.11, 'bandpass', 0, 0.05),
  bell: (times = 1, { tone }) => { for (let i = 0; i < times; i++) { tone(880, 872, 0.32, 0.9, 'triangle', i * 0.22); tone(1318, 1310, 0.18, 0.7, 'sine', i * 0.22); tone(2093, 2080, 0.07, 0.4, 'sine', i * 0.22); } },
  count: (n = 1, { tone }) => tone(420 + n * 22, 400 + n * 22, 0.22, 0.14, 'square'),
  floor: (_, { tone, hiss }) => { tone(80, 28, 0.8, 0.35); hiss(300, 0.6, 0.5, 0.22, 'lowpass'); },
  tick: (_, { tone }) => tone(700, 900, 0.1, 0.05, 'triangle'),
  miss: (_, { tone }) => tone(220, 150, 0.12, 0.12, 'sawtooth')
};
