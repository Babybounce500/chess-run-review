// Eingabe: Wischen (Finger oder Maus), Tastatur und Gamepad werden zu Absichten:
//   Schießen: {aimX, aimY, power, curve}     Halten: {x, y}
import { SHOT } from './config.js';
import { clamp, cleanShot } from './sim.js';

// Aus einem Wisch (Liste von {x,y,t}) wird ein Schuss. size = Bildschirmmaße.
export function swipeToShot(points, size) {
  if (points.length < 2) return null;
  const a = points[0], b = points[points.length - 1], dx = b.x - a.x, dy = a.y - b.y;
  const unit = Math.min(size.w * 1.25, size.h);                  // eine Größe für hoch und quer
  if (dy < unit * 0.05) return null;                             // nach oben wischen
  const aimX = clamp(dx / (unit * 0.24), -SHOT.maxAimX, SHOT.maxAimX);
  const aimY = clamp((dy / unit - 0.07) / 0.30, 0, SHOT.maxAimY);
  // Kraft aus dem schnellsten Abschnitt (mindestens 60 ms lang): kurzes Zögern vor dem Loslassen kostet keine Kraft
  let speed = 0;
  for (let j = 1, i = 0; j < points.length; j++) {
    while (i < j - 1 && points[j].t - points[i + 1].t >= 60) i++;
    const p = points[i], q = points[j], dt = q.t - p.t;
    speed = Math.max(speed, Math.hypot(q.x - p.x, q.y - p.y) / Math.max(60, dt) * 1000 / unit);       // Bildschirme je Sekunde
  }
  const power = clamp((speed - 0.35) / 2.4, 0.05, 1);
  // Effet aus der Biegung: größter seitlicher Abstand der Spur von der geraden Linie
  const len = Math.hypot(dx, dy) || 1; let bend = 0;
  for (const q of points) { const off = ((q.x - a.x) * -(b.y - a.y) + (q.y - a.y) * (b.x - a.x)) / len; if (Math.abs(off) > Math.abs(bend)) bend = off; }
  // Spur nach rechts ausgebaucht (positives off beim Wisch nach oben): Ball startet rechts und dreht zurück
  const curve = Math.abs(bend) < unit * 0.012 ? 0 : clamp(bend / (unit * 0.09), -1, 1);
  return cleanShot({ aimX, aimY, power, curve });
}

export function createInput(el, view, handlers) {
  let mode = 'none', points = null, pointer = null;
  const aim = { x: 0, y: 0.35, power: 0, charging: false, t: 0, curve: 0 };
  const held = new Set();
  const size = () => ({ w: el.clientWidth, h: el.clientHeight });
  const diveAt = (cx, cy) => {                                   // Tipp auf das Tor
    const p = view.pick(cx, cy, -10.65); if (!p) return null;
    return { x: clamp(p.x / 2.3, -1, 1), y: clamp((p.y - 0.5) / 1.5, 0, 1) };
  };

  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || pointer !== null) return;
    if (mode === 'dive') { const d = diveAt(e.clientX, e.clientY); if (d) handlers.dive(d); e.preventDefault(); return; }
    if (mode !== 'shoot') return;
    pointer = e.pointerId; points = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }]; aim.charging = false;
    try { el.setPointerCapture(e.pointerId); } catch (x) { /* ok */ }
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointer || !points) return;
    points.push({ x: e.clientX, y: e.clientY, t: e.timeStamp }); if (points.length > 240) points.splice(1, 1);
    const s = swipeToShot(points, size()); handlers.preview(s, points);
  });
  const finish = (e, cancel) => {
    if (e.pointerId !== pointer) return;
    pointer = null; const list = points; points = null;
    if (!list || mode !== 'shoot') return;
    if (!cancel) list.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
    const s = cancel ? null : swipeToShot(list, size());
    if (s) handlers.shoot(s); else handlers.preview(null, null);
  };
  el.addEventListener('pointerup', (e) => finish(e, false));
  el.addEventListener('pointercancel', (e) => finish(e, true));

  // Tastatur: Pfeile oder WASD zielen, Leertaste halten und loslassen. Halten: Q W E oben, A S D unten.
  const DIVE_KEYS = { KeyQ: [-1, 0.9], KeyW: [0, 0.9], KeyE: [1, 0.9], KeyA: [-0.85, 0.12], KeyS: [0, 0.2], KeyD: [0.85, 0.12] };
  window.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)) return;
    if (mode === 'dive' && DIVE_KEYS[e.code]) { if (!e.repeat) { const [sx, y] = DIVE_KEYS[e.code]; handlers.dive({ x: sx * view.screenRight(), y }); } e.preventDefault(); return; }
    if (mode !== 'shoot') return;
    if (/^(Arrow|Key[WASD]|Space)/.test(e.code)) e.preventDefault();
    held.add(e.code);
    if (e.code === 'Space' && !e.repeat) { aim.charging = true; aim.power = 0; }
    handlers.preview(keyShot(), null);
  });
  window.addEventListener('keyup', (e) => {
    held.delete(e.code);
    if (e.code === 'Space' && mode === 'shoot' && aim.charging) { const s = keyShot(); aim.charging = false; handlers.shoot(s); }   // erst die Kraft ablesen
  });
  window.addEventListener('blur', () => { held.clear(); aim.charging = false; });
  const keyShot = () => cleanShot({ aimX: aim.x, aimY: aim.y, power: aim.charging ? aim.power : 0.68, curve: aim.curve });

  let padDown = false;
  function update(dt) {
    if (mode === 'none') return;
    const pad = (navigator.getGamepads ? [...navigator.getGamepads()] : []).find(Boolean);
    const axis = (v) => (Math.abs(v) > 0.18 ? v : 0);
    if (mode === 'dive') {
      if (!pad) return;
      const a = pad.buttons[0] && pad.buttons[0].pressed;
      if (a && !padDown) handlers.dive({ x: clamp(axis(pad.axes[0]) * view.screenRight(), -1, 1), y: clamp(0.4 - axis(pad.axes[1]) * 0.6, 0, 1) });
      padDown = a; return;
    }
    let mx = (held.has('ArrowRight') || held.has('KeyD') ? 1 : 0) - (held.has('ArrowLeft') || held.has('KeyA') ? 1 : 0);
    let my = (held.has('ArrowUp') || held.has('KeyW') ? 1 : 0) - (held.has('ArrowDown') || held.has('KeyS') ? 1 : 0);
    if (pad) {
      mx += axis(pad.axes[0]); my -= axis(pad.axes[1]); aim.curve = axis(pad.axes[2] || 0);
      const a = pad.buttons[0] && pad.buttons[0].pressed;
      if (a && !padDown) { aim.charging = true; aim.power = 0; }
      if (!a && padDown && aim.charging) { const s = keyShot(); aim.charging = false; padDown = a; handlers.shoot(s); return; }
      padDown = a;
    }
    if (mx || my) { aim.x = clamp(aim.x + mx * dt * 1.35, -SHOT.maxAimX, SHOT.maxAimX); aim.y = clamp(aim.y + my * dt * 1.0, 0, SHOT.maxAimY); }
    if (aim.charging) aim.power = Math.min(1, aim.power + dt / 1.05);
    if (mx || my || aim.charging) handlers.preview(keyShot(), null);
  }
  return {
    update,
    setMode(m) { if (m === mode) return; mode = m; points = null; pointer = null; held.clear(); aim.charging = false; aim.power = 0; if (m === 'shoot') { aim.x = 0; aim.y = 0.35; aim.curve = 0; } },
    mode: () => mode
  };
}
