// Gemeinsame Steuerung: schwebender Analog-Stick links, Aktionsknöpfe rechts (Mehrfinger), Tastatur und Gamepad.
// read() liefert { x, y, <knopf-id>: true/false }. x nach rechts, y nach unten (Bildschirmrichtung), Länge höchstens 1.
export function createControls({ buttons = [], stick = true, onFirstTouch } = {}) {
  // buttons: [{ id: 'a', label: 'WURF', keys: ['Space'], pad: 0, color: '#ff8a30' }]
  const held = new Set(), tapped = new Set(), touch = {}; let sx = 0, sy = 0, stickId = null, origin = null, enabled = false;      // tapped: kurz gedrückt seit dem letzten Lesen
  const wrap = document.createElement('div'); wrap.id = 'touch'; wrap.hidden = true;
  const zone = document.createElement('div'); zone.id = 'stickZone'; const base = document.createElement('div'); base.id = 'stickBase'; const knob = document.createElement('div'); knob.id = 'stickKnob'; base.appendChild(knob);
  const pad = document.createElement('div'); pad.id = 'actions';
  if (stick) { zone.appendChild(base); wrap.appendChild(zone); }
  const els = {};
  for (const b of buttons) {
    const e = document.createElement('button'); e.type = 'button'; e.className = 'act'; e.dataset.act = b.id; e.textContent = b.label; if (b.color) e.style.setProperty('--c', b.color);
    const down = (ev) => { ev.preventDefault(); touch[b.id] = ev.pointerId; tapped.add(b.id); e.classList.add('on'); try { e.setPointerCapture(ev.pointerId); } catch (x) { /* ok */ } };
    const up = (ev) => { if (touch[b.id] !== ev.pointerId) return; delete touch[b.id]; e.classList.remove('on'); };
    e.addEventListener('pointerdown', down); e.addEventListener('pointerup', up); e.addEventListener('pointercancel', up); e.addEventListener('lostpointercapture', up);
    pad.appendChild(e); els[b.id] = e;
  }
  wrap.appendChild(pad); document.body.appendChild(wrap);
  const R = () => base.offsetWidth * 0.42 || 50;
  const rest = () => { sx = sy = 0; stickId = null; origin = null; knob.style.transform = ''; base.classList.remove('on'); base.style.left = ''; base.style.top = ''; };
  zone.addEventListener('pointerdown', (e) => {
    if (stickId !== null) return; e.preventDefault(); stickId = e.pointerId; const r = zone.getBoundingClientRect(), half = base.offsetWidth / 2;
    origin = { x: Math.min(r.width - half, Math.max(half, e.clientX - r.left)), y: Math.min(r.height - half, Math.max(half, e.clientY - r.top)) };
    base.style.left = origin.x - half + 'px'; base.style.top = origin.y - half + 'px'; base.classList.add('on'); try { zone.setPointerCapture(e.pointerId); } catch (x) { /* ok */ }
    origin.cx = r.left + origin.x; origin.cy = r.top + origin.y;
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickId) return; const max = R(); let dx = e.clientX - origin.cx, dy = e.clientY - origin.cy; const l = Math.hypot(dx, dy);
    if (l > max) { dx *= max / l; dy *= max / l; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`; const n = Math.hypot(dx, dy) / max, dead = 0.14;
    const k = n < dead ? 0 : (n - dead) / (1 - dead); sx = n ? (dx / max / n) * k : 0; sy = n ? (dy / max / n) * k : 0;
  });
  const release = (e) => { if (e.pointerId === stickId) rest(); };
  zone.addEventListener('pointerup', release); zone.addEventListener('pointercancel', release); zone.addEventListener('lostpointercapture', release);

  const GAME_KEYS = /^(Arrow|Key[WASDQE]$|Space|Shift|Digit|Control|KeyJ|KeyK|KeyL)/;
  addEventListener('keydown', (e) => { if (!enabled || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return; if (GAME_KEYS.test(e.code)) { e.preventDefault(); held.add(e.code); if (!e.repeat) for (const b of buttons) if ((b.keys || []).includes(e.code)) tapped.add(b.id); } });
  addEventListener('keyup', (e) => held.delete(e.code));
  const clear = () => { held.clear(); tapped.clear(); for (const k of Object.keys(touch)) delete touch[k]; for (const e of Object.values(els)) e.classList.remove('on'); rest(); };
  addEventListener('blur', clear); document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  const coarse = () => matchMedia('(pointer: coarse)').matches;
  let touched = coarse();
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !touched) { touched = true; sync(); if (onFirstTouch) onFirstTouch(); } }, true);
  const sync = () => { wrap.hidden = !(enabled && touched); document.body.classList.toggle('has-touch', !wrap.hidden); };

  return {
    setEnabled(on) { if (on === enabled) return; enabled = on; if (!on) clear(); sync(); },
    setLabel(id, text) { if (els[id] && els[id].textContent !== text) els[id].textContent = text; },
    showButton(id, on) { if (els[id]) els[id].hidden = !on; },
    touchVisible: () => !wrap.hidden,
    read() {
      const out = { x: 0, y: 0 }; for (const b of buttons) out[b.id] = false;
      if (!enabled) return out;
      let x = (held.has('ArrowRight') || held.has('KeyD') ? 1 : 0) - (held.has('ArrowLeft') || held.has('KeyA') ? 1 : 0);
      let y = (held.has('ArrowDown') || held.has('KeyS') ? 1 : 0) - (held.has('ArrowUp') || held.has('KeyW') ? 1 : 0);
      for (const b of buttons) out[b.id] = tapped.has(b.id) || touch[b.id] !== undefined || (b.keys || []).some((k) => held.has(k));
      tapped.clear();                                       // ein kurzer Druck zählt genau einmal, auch wenn er zwischen zwei Bildern lag
      x += sx; y += sy;
      const gp = (navigator.getGamepads ? [...navigator.getGamepads()] : []).find(Boolean);
      if (gp) { const ax = (v) => (Math.abs(v) > 0.18 ? v : 0); x += ax(gp.axes[0] || 0); y += ax(gp.axes[1] || 0); for (const b of buttons) if (b.pad !== undefined && gp.buttons[b.pad] && gp.buttons[b.pad].pressed) out[b.id] = true; }
      const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      out.x = Math.round(x * 100) / 100; out.y = Math.round(y * 100) / 100;
      return out;
    }
  };
}
