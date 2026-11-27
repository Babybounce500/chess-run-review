// Rangstufen von Bronze bis Champion. Reine Rechnung; gespeichert wird nur auf dem eigenen Gerät.
export const TIERS = [
  { name: 'Bronze', from: 0, icon: '🥉' }, { name: 'Silber', from: 100, icon: '🥈' }, { name: 'Gold', from: 250, icon: '🥇' },
  { name: 'Platin', from: 450, icon: '💠' }, { name: 'Diamant', from: 700, icon: '💎' }, { name: 'Champion', from: 1000, icon: '👑' }
];
const BASE = { win: 25, ko: 5, draw: 4, loss: -12 };
// weight: wie viel ein Sieg zählt. cap: ab so vielen Punkten bringt dieser Gegner nichts mehr (kein Sammeln an Schwachen)
export const SOURCES = {
  easy: { weight: 0.6, cap: 250 }, normal: { weight: 1, cap: 700 }, hard: { weight: 1.4, cap: Infinity },
  k1: { weight: 0.6, cap: 250 }, k2: { weight: 0.9, cap: 450 }, k3: { weight: 1, cap: 700 }, k4: { weight: 1.2, cap: Infinity }, k5: { weight: 1.5, cap: Infinity },
  online: { weight: 1.2, cap: Infinity }
};

export function tierOf(points) {
  let i = 0; while (i + 1 < TIERS.length && points >= TIERS[i + 1].from) i++;
  const next = TIERS[i + 1] || null;
  return Object.assign({ index: i, next, share: next ? (points - TIERS[i].from) / (next.from - TIERS[i].from) : 1 }, TIERS[i]);
}
// result: 'win' | 'draw' | 'loss'
export function applyFight(points, source, result, ko) {
  const src = SOURCES[source]; if (!src || !(result in BASE)) return { points, gain: 0, capped: false, up: 0 };
  let gain = result === 'loss' ? BASE.loss : Math.round((BASE[result] + (result === 'win' && ko ? BASE.ko : 0)) * src.weight), capped = false;
  if (gain > 0 && points + gain > src.cap) { gain = Math.max(0, src.cap - points); capped = true; }
  const next = Math.max(0, points + gain);
  return { points: next, gain: next - points, capped, up: Math.sign(tierOf(next).index - tierOf(points).index) };
}
export const readPoints = (store) => { const n = Number(store.get('rank', '0')); return Number.isFinite(n) && n > 0 ? Math.min(99999, Math.round(n)) : 0; };
export function rankText(r) {
  const t = tierOf(r.points), sign = r.gain > 0 ? '+' + r.gain : r.gain < 0 ? '−' + -r.gain : '±0';
  return t.icon + ' ' + t.name + ' · ' + sign + ' Punkte' + (t.next ? ' · ' + r.points + '/' + t.next.from : ' · ' + r.points) +
    (r.up > 0 ? ' · AUFGESTIEGEN!' : r.up < 0 ? ' · abgestiegen' : '') + (r.capped ? '\nGegen diesen Gegner ist jetzt nicht mehr zu holen.' : '');
}
