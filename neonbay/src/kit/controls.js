// Steuerung: schwebender Stick links, kontextabhängige Knöpfe rechts (Mehrfinger), Tastatur, Maus-Umschauen, Gamepad.
// Aus dem Monolith-Baukasten, für zu Fuß / im Auto erweitert.
const BUTTONS = [
  { id: 'jump', label: 'SPRUNG', mode: 'foot', color: '#ff8a30' },
  { id: 'sprint', label: 'SPRINT', mode: 'foot', color: '#37e6e0' },
  { id: 'enter', label: 'EIN­STEIGEN', mode: 'foot', color: '#ffd34d' },
  { id: 'gas', label: 'GAS', mode: 'car', color: '#2ee59d' },
  { id: 'brake', label: 'BREMSE', mode: 'car', color: '#ff5a6e' },
  { id: 'hand', label: 'DRIFT', mode: 'car', color: '#c58bff' },
  { id: 'exit', label: 'AUS­STEIGEN', mode: 'car', color: '#ffd34d' }
];

export function createControls({ surface, onPause } = {}) {
  const held = new Set(), tapped = new Set(), touch = {}; let sx = 0, sy = 0, stickId = null, origin = null, enabled = false, mode = 'foot';
  let lookX = 0, lookY = 0, drag = null, padPrev = [], source = 'keyboard';
  const make = (tag, id) => { const e = document.createElement(tag); if (id) e.id = id; return e; };
  const wrap = make('div', 'touch'); wrap.hidden = true;
  const zone = make('div', 'stickZone'), base = make('div', 'stickBase'), knob = make('div', 'stickKnob'), label = make('span', 'stickLabel');
  base.append(knob, label); zone.appendChild(base);
  const pad = make('div', 'actions'); wrap.append(zone, pad);
  const els = {};
  for (const b of BUTTONS) {
    const e = make('button'); e.type = 'button'; e.className = 'act'; e.dataset.act = b.id; e.dataset.mode = b.mode; e.textContent = b.label; e.style.setProperty('--c', b.color);
    const down = (ev) => { ev.preventDefault(); source = 'touch'; touch[b.id] = ev.pointerId; tapped.add(b.id); e.classList.add('on'); try { e.setPointerCapture(ev.pointerId); } catch (x) { /* ok */ } };
    const up = (ev) => { if (touch[b.id] !== ev.pointerId) return; delete touch[b.id]; e.classList.remove('on'); };
    e.addEventListener('pointerdown', down); e.addEventListener('pointerup', up); e.addEventListener('pointercancel', up); e.addEventListener('lostpointercapture', up);
    pad.appendChild(e); els[b.id] = e;
  }
  document.body.appendChild(wrap);
  const R = () => base.offsetWidth * 0.42 || 50;
  const rest = () => { sx = sy = 0; stickId = null; origin = null; knob.style.transform = ''; base.classList.remove('on'); base.style.left = ''; base.style.top = ''; };
  zone.addEventListener('pointerdown', (e) => {
    if (stickId !== null) return; e.preventDefault(); source = 'touch'; stickId = e.pointerId; const r = zone.getBoundingClientRect(), half = base.offsetWidth / 2;
    origin = { x: Math.min(r.width - half, Math.max(half, e.clientX - r.left)), y: Math.min(r.height - half, Math.max(half, e.clientY - r.top)) };
    base.style.left = origin.x - half + 'px'; base.style.top = origin.y - half + 'px'; base.classList.add('on'); try { zone.setPointerCapture(e.pointerId); } catch (x) { /* ok */ }
    origin.cx = r.left + origin.x; origin.cy = r.top + origin.y;
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickId) return; const max = R(); let dx = e.clientX - origin.cx, dy = e.clientY - origin.cy; const l = Math.hypot(dx, dy);
    if (l > max) { dx *= max / l; dy *= max / l; }
    if (mode === 'car') dy = 0;
    knob.style.transform = `translate(${dx}px, ${dy}px)`; const n = Math.hypot(dx, dy) / max, dead = 0.12;
    const k = n < dead ? 0 : (n - dead) / (1 - dead); sx = n ? (dx / max / n) * k : 0; sy = n ? (dy / max / n) * k : 0;
  });
  const release = (e) => { if (e.pointerId === stickId) rest(); };
  zone.addEventListener('pointerup', release); zone.addEventListener('pointercancel', release); zone.addEventListener('lostpointercapture', release);

  // Umschauen: mit Maus oder Finger auf der freien Fläche ziehen
  if (surface) {
    surface.addEventListener('pointerdown', (e) => { if (!enabled || drag) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { surface.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } });
    surface.addEventListener('pointermove', (e) => { if (!drag || e.pointerId !== drag.id) return; const k = 4.2 / Math.max(480, innerWidth); lookX += (e.clientX - drag.x) * k; lookY += (e.clientY - drag.y) * k * 0.8; drag.x = e.clientX; drag.y = e.clientY; });
    const end = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
    surface.addEventListener('pointerup', end); surface.addEventListener('pointercancel', end); surface.addEventListener('lostpointercapture', end);
  }

  const GAME_KEYS = /^(Arrow|Key[WASDEFHJLR]$|Space|Shift|Enter$)/;
  addEventListener('keydown', (e) => {
    if (!enabled || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyP') { if (!e.repeat && onPause) onPause(); return; }
    if (!GAME_KEYS.test(e.code)) return;
    // Enter und Leertaste auf einem Knopf der Anzeige sollen nicht zusätzlich den Knopf auslösen
    e.preventDefault(); source = 'keyboard'; if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
    held.add(e.code); if (!e.repeat) tapped.add(e.code);
  });
  addEventListener('keyup', (e) => held.delete(e.code));
  const clear = () => { held.clear(); tapped.clear(); drag = null; lookX = lookY = 0; for (const k of Object.keys(touch)) delete touch[k]; for (const e of Object.values(els)) e.classList.remove('on'); rest(); };
  addEventListener('blur', clear); document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  let touched = matchMedia('(pointer: coarse)').matches;
  let onChange = null;
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { source = 'touch'; if (!touched) { touched = true; sync(); } } }, true);
  const sync = () => { wrap.hidden = !(enabled && touched); const was = document.body.classList.contains('has-touch'); document.body.classList.toggle('has-touch', touched); if (was !== touched && onChange) onChange(); };
  const show = () => { for (const b of BUTTONS) els[b.id].classList.toggle('off', b.mode !== mode); label.textContent = mode === 'car' ? '◀ LENKEN ▶' : ''; base.classList.toggle('car', mode === 'car'); };
  show(); sync();

  return {
    setEnabled(on) { if (on === enabled) return; enabled = on; if (!on) clear(); sync(); },
    setMode(m) {
      if (m === mode) return; mode = m;
      // Knöpfe des alten Modus loslassen, Stick neu beginnen
      for (const b of BUTTONS) if (b.mode !== m) { delete touch[b.id]; tapped.delete(b.id); els[b.id].classList.remove('on'); }
      rest(); show(); document.body.dataset.mode = m;
    },
    showButton(id, on) { if (els[id]) els[id].classList.toggle('away', !on); },
    onTouchChange(fn) { onChange = fn; },
    isTouch: () => source === 'touch' || (touched && source !== 'keyboard' && source !== 'pad'),
    source: () => source,
    clear,
    // dt in Sekunden (für den rechten Stick). Einmal je Bild aufrufen.
    read(dt = 1 / 60) {
      const out = { x: 0, y: 0, gas: 0, brake: 0, hand: false, sprint: false, jump: false, use: false, horn: false, lookDx: 0, lookDy: 0 };
      const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
      // Start-Taste am Gamepad wirkt auch in der Pause
      if (gp && gp.buttons[9] && gp.buttons[9].pressed && !padPrev[9] && onPause) onPause();
      if (!enabled) { tapped.clear(); lookX = lookY = 0; padPrev = gp ? gp.buttons.map((b) => b.pressed) : []; return out; }
      const key = (...k) => k.some((c) => held.has(c)), hit = (...k) => k.some((c) => tapped.has(c)), down = (id) => touch[id] !== undefined || tapped.has(id);
      let x = (key('ArrowRight', 'KeyD') ? 1 : 0) - (key('ArrowLeft', 'KeyA') ? 1 : 0);
      let y = (key('ArrowDown', 'KeyS') ? 1 : 0) - (key('ArrowUp', 'KeyW') ? 1 : 0);
      const keyX = x;
      out.gas = mode === 'car' && (key('ArrowUp', 'KeyW') || down('gas')) ? 1 : 0;
      out.brake = mode === 'car' && (key('ArrowDown', 'KeyS') || down('brake')) ? 1 : 0;
      out.hand = mode === 'car' && (key('Space') || down('hand'));
      out.sprint = mode === 'foot' && (key('ShiftLeft', 'ShiftRight') || down('sprint'));
      out.jump = mode === 'foot' && (hit('Space') || tapped.has('jump'));
      out.use = hit('KeyE', 'KeyF', 'Enter') || tapped.has('enter') || tapped.has('exit');
      out.horn = mode === 'car' && hit('KeyH');
      out.lookDx = lookX + ((key('KeyL') ? 1 : 0) - (key('KeyJ') ? 1 : 0)) * 2.2 * dt; out.lookDy = lookY; lookX = lookY = 0;
      // Lenkung am Finger: in der Mitte feinfühliger
      x += mode === 'car' ? Math.sign(sx) * Math.pow(Math.abs(sx), 1.35) : sx; y += sy;
      if (gp) {
        const ax = (v) => (Math.abs(v || 0) > 0.16 ? (v - Math.sign(v) * 0.16) / 0.84 : 0);
        const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed), val = (i) => (gp.buttons[i] ? gp.buttons[i].value : 0), edge = (i) => btn(i) && !padPrev[i];
        const gx = ax(gp.axes[0]), gy = ax(gp.axes[1]);
        if (gx || gy || gp.buttons.some((b) => b.pressed)) source = 'pad';
        x += gx; y += gy;
        out.lookDx += ax(gp.axes[2]) * 2.6 * dt; out.lookDy += ax(gp.axes[3]) * 1.6 * dt;
        if (mode === 'car') { out.gas = Math.max(out.gas, val(7)); out.brake = Math.max(out.brake, val(6)); out.hand = out.hand || btn(0) || btn(5); out.horn = out.horn || edge(10) || edge(2); }
        else { out.jump = out.jump || edge(0); out.sprint = out.sprint || btn(1) || btn(2) || btn(7); }
        out.use = out.use || edge(3);
        padPrev = gp.buttons.map((b) => b.pressed);
      }
      tapped.clear();
      if (mode === 'car') { out.x = Math.max(-1, Math.min(1, keyX ? keyX : x)); out.y = 0; }
      else { const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } out.x = x; out.y = y; }
      return out;
    }
  };
}
