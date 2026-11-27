// Bedienung: eigene Ziehfläche (Finger und Maus), Knöpfe, Tastatur, Gamepad und die Wahl der Stange.
// Der Finger schiebt die gewählte Stange relativ und 1:1; zurückziehen holt aus, ein Wisch nach vorn schießt.
import { INPUT, RODS, OWN } from './config.js';
import { bestRod, clamp } from './sim.js';

export function createInput({ stage, view, controls, state, side, playing }) {
  const I = { rod: 2, y: 0, wind: 0, charge: 0, drag: 0, k: 0, p: 0.5, trap: false, auto: true, manual: 0, cand: 2, candT: 0, mouseTrap: false, lastShot: null };
  const fingers = new Map(); let primary = null, held = { a: false, prev: false, next: false };
  const global = () => OWN[side()][I.rod];
  const range = () => RODS[global()].range;

  function fire(p, how) { I.k = (I.k % 65535) + 1; I.p = clamp(p, 0, 1); I.wind = I.drag = 0; I.lastShot = { p: Math.round(I.p * 100) / 100, how }; }
  // Wisch: kurz den Spitzenwert sammeln, dann mit dieser Härte schießen
  function flush(f) { const w = f.flick; if (!w) return; f.flick = null; if (!playing()) return; const speed = clamp((w.peak - INPUT.flickSpeed) / (INPUT.flickFull - INPUT.flickSpeed), 0, 1); fire(0.3 + 0.7 * Math.max(speed, w.wind * 0.85), 'wisch'); }
  function select(r, manual) {
    r = clamp(r, 0, 3); if (manual) I.manual = INPUT.manualHold;
    I.cand = r; I.candT = 0;
    if (r === I.rod) return;
    I.rod = r; const s = state(); if (s) I.y = s.rods[global()].y;
  }
  // Tipp nahe an einer eigenen Stange wählt sie
  function rodAt(x, y) {
    let best = -1, dist = 34;
    for (let r = 0; r < 4; r++) {
      const i = OWN[side()][r], a = view.axes(i), p = view.project(RODS[i].x, 0.5, 0), dx = x - p.x, dy = y - p.y;
      const along = Math.abs(dx * a.forward.x + dy * a.forward.y), across = Math.abs(dx * a.slide.x + dy * a.slide.y);
      if (along < dist && across < a.slide.px * 4.6) { dist = along; best = r; }
    }
    return best;
  }

  stage.addEventListener('pointerdown', (e) => {
    if (!playing()) return; e.preventDefault();
    if (e.pointerType === 'mouse' && e.button === 2) { I.mouseTrap = true; try { stage.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const f = { id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY, t0: e.timeStamp, moved: 0, fwd: 0, side: 0, hist: [[e.timeStamp, 0, 0]], armed: true, shot: false, flick: null, wound: 0 };
    fingers.set(e.pointerId, f); if (primary === null) primary = e.pointerId;
    try { stage.setPointerCapture(e.pointerId); } catch (x) { /* ok */ }
  });
  stage.addEventListener('pointermove', (e) => {
    const f = fingers.get(e.pointerId); if (!f || !playing()) return;
    const dx = e.clientX - f.x, dy = e.clientY - f.y; f.x = e.clientX; f.y = e.clientY; f.moved += Math.hypot(dx, dy);
    const a = view.axes(global()), ds = dx * a.slide.x + dy * a.slide.y, df = dx * a.forward.x + dy * a.forward.y;
    // Lag der Finger still, zählt das Wischtempo erst ab dem Losziehen
    const rest = f.hist[f.hist.length - 1]; if (e.timeStamp - rest[0] > 100) f.hist = [[e.timeStamp - 32, rest[1], rest[2]]];
    f.fwd += df; f.side += ds;
    f.hist.push([e.timeStamp, f.fwd, f.side]); while (f.hist.length > 2 && e.timeStamp - f.hist[0][0] > 90) f.hist.shift();
    const old = f.hist[0], span = Math.max(24, e.timeStamp - old[0]) / 1000, vf = (f.fwd - old[1]) / span, vs = (f.side - old[2]) / span;
    const flicking = vf > INPUT.flickSpeed && f.fwd - old[1] > INPUT.flickTravel && vf > Math.abs(vs) * 0.9;
    if (f.id === primary) {
      // Während eines Wischs nach vorn bleibt die Stange stehen, damit der Schuss nicht verzieht
      if (!(vf > INPUT.flickSpeed * 0.7 && Math.abs(df) > Math.abs(ds) * 1.5)) I.y = clamp(I.y + (ds / a.slide.px) * INPUT.dragGain, -range(), range());
      if (Math.abs(df) > Math.abs(ds) * 1.2) { I.drag = clamp(I.drag - (df < 0 ? df : df * 2), 0, INPUT.windTravel); I.wind = clamp((I.drag - 12) / (INPUT.windTravel - 12), 0, 1); }
    }
    if (flicking && f.armed) { f.flick = { peak: vf, t: performance.now(), wind: f.wound }; f.armed = false; f.shot = true; }
    else if (f.flick) { f.flick.peak = Math.max(f.flick.peak, vf); if (performance.now() - f.flick.t > 45 || vf < f.flick.peak * 0.55) flush(f); }
    else if (vf < 120) f.armed = true;
    if (df < 0 && f.id === primary) f.wound = I.wind;
  });
  function release(e, cancelled) {
    if (e.pointerType === 'mouse' && e.button === 2) { I.mouseTrap = false; return; }
    const f = fingers.get(e.pointerId); if (!f) return;
    fingers.delete(e.pointerId); if (!cancelled) flush(f);
    const tap = !cancelled && f.moved < 9 && e.timeStamp - f.t0 < 280;
    if (f.id === primary) {
      primary = null;
      if (!cancelled && playing() && !f.shot && I.wind > 0.5) fire(0.35 + 0.65 * I.wind, 'zwille');
      I.wind = I.drag = 0;
      // Tipp auf eine andere eigene Stange wählt sie, ein Mausklick sonst schießt
      if (tap && playing()) { const r = rodAt(e.clientX, e.clientY); if (r >= 0 && (r !== I.rod || f.type !== 'mouse')) select(r, true); else if (f.type === 'mouse') fire(0.65, 'klick'); }
    } else if (tap && playing()) fire(0.6, 'tipp');
  }
  stage.addEventListener('pointerup', (e) => release(e, false));
  stage.addEventListener('pointercancel', (e) => release(e, true));
  stage.addEventListener('wheel', (e) => { if (playing() && e.deltaY) { e.preventDefault(); select(I.rod + (e.deltaY < 0 ? 1 : -1), true); } }, { passive: false });
  addEventListener('keydown', (e) => {
    if (!playing() || e.repeat || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const n = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
    if (n) { e.preventDefault(); select(Number(n[1]) - 1, true); }
    else if (e.code === 'KeyQ') select(I.rod - 1, true);
    else if (e.code === 'KeyE') select(I.rod + 1, true);
  });
  // Sehr kurze Tipper, die zwischen zwei Bildern liegen, gehen nicht verloren
  const quick = () => { if (playing() && !held.a && I.charge === 0) fire(0.4, 'knopf'); };
  addEventListener('keyup', (e) => { if ((e.code === 'Space' || e.code === 'KeyJ') && !/INPUT|TEXTAREA/.test(e.target.tagName)) quick(); });
  const shootButton = document.querySelector('#touch .act[data-act="a"]'); if (shootButton) shootButton.addEventListener('pointerup', quick);
  const clear = () => { fingers.clear(); primary = null; I.mouseTrap = false; I.wind = I.drag = I.charge = 0; held = { a: false, prev: false, next: false }; I.trap = false; };
  addEventListener('blur', clear);

  return {
    state: I, select, clear,
    reset() { clear(); Object.assign(I, { rod: 2, y: 0, k: 0, p: 0.5, manual: 0, cand: 2, candT: 0, lastShot: null }); },
    // einmal je Bild
    update(dt) {
      const s = state();
      if (!playing() || !s) { if (held.a || fingers.size || I.charge) clear(); return; }
      const c = controls.read(), a = view.axes(global());
      const push = c.x * a.slide.x + c.y * a.slide.y;
      if (Math.abs(push) > 0.05) I.y = clamp(I.y + push * INPUT.keySpeed * dt, -range(), range());
      for (const f of fingers.values()) if (f.flick && performance.now() - f.flick.t > 60) flush(f);
      if (c.a) I.charge = clamp(I.charge + dt / INPUT.chargeTime, 0.001, 1);
      else if (held.a) { fire(0.38 + 0.62 * I.charge, 'knopf'); I.charge = 0; }
      if (c.prev && !held.prev) select(I.rod - 1, true);
      if (c.next && !held.next) select(I.rod + 1, true);                              // Gamepad (Tasten siehe oben)
      held = { a: c.a, prev: c.prev, next: c.next };
      I.trap = !!c.b || I.mouseTrap;
      // Automatische Wahl der zuständigen Stange
      if (I.manual > 0) I.manual -= dt;
      const holding = s.hold && RODS[s.hold.r].side === side();
      if (holding && OWN[side()][I.rod] !== s.hold.r && I.manual <= 0 && I.auto) select(RODS[s.hold.r].role, false);
      else if (I.auto && I.manual <= 0 && !holding && I.charge === 0 && I.wind === 0) {
        const best = bestRod(s.ball, side());
        if (best !== I.cand) { I.cand = best; I.candT = 0; } else I.candT += dt;
        if (best !== I.rod && I.candT >= 0.1) select(best, false);
      }
    },
    // Eingabe für die Spiellogik
    read() {
      if (!playing()) return { on: false };
      return { on: true, r: I.rod, y: Math.round((I.y / range()) * 1000) / 1000, w: Math.round(Math.max(I.wind, I.charge) * 100) / 100, k: I.k, p: I.p, t: I.trap };
    }
  };
}
