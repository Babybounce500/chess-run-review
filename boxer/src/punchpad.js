// Schlagfläche: Tippen = Jab, Wisch hoch = Cross, Wisch zur Seite = Haken, Wisch runter = Uppercut.
// Der Schlag löst aus, sobald der Wisch weit genug ist (nicht erst beim Loslassen).
export function classify(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy) * 1.15) return { k: 'hook', side: dx < 0 ? 1 : -1 };     // nach links wischen: rechte Hand
  return { k: dy < 0 ? 'cross' : 'upper', side: 1 };
}
export function createPunchPad({ onPunch, onTap }) {
  const zone = document.createElement('div'); zone.id = 'punchZone'; zone.hidden = true; document.body.appendChild(zone);
  const label = document.createElement('div'); label.id = 'punchLabel'; document.body.appendChild(label);
  const live = new Map(); const NAMES = { jab: 'Jab', cross: 'Cross', hook: 'Haken', upper: 'Uppercut' };
  const limit = () => Math.max(26, Math.min(innerWidth, innerHeight) * 0.07);
  function fire(p, x, y) {
    label.textContent = NAMES[p.k]; label.style.left = x + 'px'; label.style.top = y + 'px'; label.classList.remove('show'); void label.offsetWidth; label.classList.add('show');
    onPunch(p);
  }
  zone.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); live.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp, done: false }); try { zone.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } if (onTap) onTap(); });
  zone.addEventListener('pointermove', (e) => { const q = live.get(e.pointerId); if (!q || q.done) return; const dx = e.clientX - q.x, dy = e.clientY - q.y; if (Math.hypot(dx, dy) < limit()) return; q.done = true; fire(classify(dx, dy), e.clientX, e.clientY); });
  zone.addEventListener('pointerup', (e) => { const q = live.get(e.pointerId); live.delete(e.pointerId); if (!q || q.done) return; const dx = e.clientX - q.x, dy = e.clientY - q.y; if (Math.hypot(dx, dy) >= limit()) fire(classify(dx, dy), e.clientX, e.clientY); else if (e.timeStamp - q.t < 450) fire({ k: 'jab', side: -1 }, e.clientX, e.clientY); });
  const drop = (e) => live.delete(e.pointerId);
  zone.addEventListener('pointercancel', drop); zone.addEventListener('lostpointercapture', drop);
  return { setEnabled(on) { if (zone.hidden === on) { zone.hidden = !on; if (!on) live.clear(); } } };
}
