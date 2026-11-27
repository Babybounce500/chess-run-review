// Anzeigen direkt an den Figuren: Wurfanzeige mit grüner Zone, Ausdauer, Wurfuhr am Korb.
import { SHOT, HOOP } from './config.js';
import { clamp } from './math.js';

export function createHud(view) {
  const wrap = document.createElement('div'); wrap.id = 'fx'; wrap.hidden = true;
  wrap.innerHTML = '<div id="meter" hidden><div class="track"><i></i><b></b><u></u></div><small></small></div><div id="stamina" hidden><b></b></div><div id="clock" hidden></div>';
  document.body.appendChild(wrap);
  const meter = wrap.querySelector('#meter'), zone = meter.querySelector('i'), fill = meter.querySelector('b'), mark = meter.querySelector('u'), label = meter.querySelector('small');
  const stamina = wrap.querySelector('#stamina'), bar = stamina.firstChild, clock = wrap.querySelector('#clock');
  let after = 0, verdict = '', last = { ch: 0, gr: SHOT.green };
  const pct = (v) => (clamp(v, 0, 1) * 100).toFixed(1) + '%';
  function place(el, x, y) { el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; }
  function paint(ch, gr) {
    zone.style.bottom = pct(SHOT.ideal - gr); zone.style.height = pct(Math.min(1, SHOT.ideal + gr) - (SHOT.ideal - gr));
    fill.style.height = pct(ch); mark.style.bottom = pct(ch);
    meter.dataset.green = Math.abs(ch - SHOT.ideal) <= gr ? '1' : '0';
  }
  return {
    reset() { after = 0; verdict = ''; meter.hidden = true; },
    // Rückmeldung nach dem Loslassen
    release(charge, green, perfect) { after = 1.0; verdict = perfect ? 'PERFEKT' : charge < SHOT.ideal ? 'ZU FRÜH' : 'ZU SPÄT'; last = { ch: charge, gr: green }; },
    update(dt, s, me, visible) {
      wrap.hidden = !visible || !s; if (wrap.hidden) return;
      after = Math.max(0, after - dt);
      const p = s.p[me], W = innerWidth;
      const gathering = p.act === 'gather';
      meter.hidden = !(gathering || after > 0);
      if (!meter.hidden) {
        if (gathering) { after = 0; paint(p.ch, p.gr); label.textContent = p.three ? '3er' : '2er'; meter.dataset.result = ''; }
        else { paint(last.ch, last.gr); label.textContent = verdict; meter.dataset.result = verdict === 'PERFEKT' ? 'good' : 'bad'; }
        const at = view.project(p.x, 1.75 + p.y, p.z), side = view.project(p.x + 0.75, 1.75 + p.y, p.z).x - at.x;
        const off = Math.max(30, Math.abs(side)), h = meter.offsetHeight || 130;
        place(meter, at.x + off + 28 > W - 6 ? at.x - off - 26 : at.x + off, clamp(at.y - h / 2, 70, innerHeight - h - 6));
      }
      stamina.hidden = !(p.st < 0.985 && s.phase === 'live');
      if (!stamina.hidden) { const f = view.project(p.x, 0, p.z + 0.62); place(stamina, f.x - 28, f.y + 3); bar.style.width = pct(p.st); stamina.dataset.tired = p.tired ? '1' : '0'; }
      const left = Math.ceil(s.clock);
      clock.hidden = !(s.phase === 'live' && s.clock <= 5 && s.clock > 0 && s.ball.mode !== 'shot');
      if (!clock.hidden) { if (clock.textContent !== String(left)) clock.textContent = left; const at = view.project(1.55, HOOP.boardY1 - 0.3, HOOP.boardZ); place(clock, clamp(at.x - 22, 6, W - 52), Math.max(view.info().insets.top, at.y - 22)); }
    },
    info: () => ({ meter: !meter.hidden && !wrap.hidden, label: label.textContent, rect: meter.hidden || wrap.hidden ? null : meter.getBoundingClientRect().toJSON(), green: zone.style.height })
  };
}
