// Übertragungs-Anzeige: Gesundheit, Ausdauer, Niederschläge, Zähler, Aufsteh-Balken, Trefferblitz.
import { FIGHT, DOWN } from './config.js';

const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
export function createHud() {
  const bars = el(`<div id="bars" hidden>${[0, 1].map((i) => `<div class="fbar f${i}"><div class="who"><b></b><span class="kd"></span></div><div class="hp"><i class="lag"></i><i class="now"></i></div><div class="sta"><i class="now"></i><i class="cap"></i></div></div>`).join('<span class="vs">VS</span>')}</div>`);
  const count = el('<div id="count" hidden></div>');
  const getup = el('<div id="getup" hidden><b>STEH AUF!</b><div class="meter"><i class="zone"></i><i class="mark"></i></div><span class="pips"></span><small>Deckung drücken, wenn die Marke im grünen Feld ist</small></div>');
  const hurt = el('<div id="hurt"></div>');
  document.body.append(hurt, bars, count, getup);
  const q = (s, r = bars) => r.querySelector(s), lag = [100, 100];
  const text = (e, t) => { if (e.textContent !== t) e.textContent = t; };
  let flash = 0;
  return {
    hit(p) { flash = Math.min(0.75, 0.2 + p * 0.035); },
    hide() { bars.hidden = true; count.hidden = true; getup.hidden = true; hurt.style.opacity = 0; flash = 0; lag[0] = lag[1] = 100; },
    update(dt, s, me, names, show) {
      if (!s || !show) { this.hide(); return; }
      bars.hidden = false;
      for (let k = 0; k < 2; k++) {
        const i = k === 0 ? me : 1 - me, f = s.f[i], box = q('.f' + k);                       // links immer ich
        box.dataset.team = String(i);
        text(q('.who b', box), names[i]);
        text(q('.kd', box), '●'.repeat(f.downs));
        lag[k] = f.hp > lag[k] ? f.hp : Math.max(f.hp, lag[k] - dt * 28);
        q('.hp .now', box).style.width = (f.hp / FIGHT.hp) * 100 + '%'; q('.hp .lag', box).style.width = (lag[k] / FIGHT.hp) * 100 + '%';
        q('.sta .now', box).style.width = (f.st / FIGHT.stamina) * 100 + '%'; q('.sta .cap', box).style.width = 100 - (f.max / FIGHT.stamina) * 100 + '%';
        box.classList.toggle('low', f.hp < 25); box.classList.toggle('tired', f.st < FIGHT.tiredAt);
      }
      const down = s.phase === 'down' ? s.down : null;
      count.hidden = !(down && down.count > 0 && down.count <= DOWN.count);
      if (!count.hidden) { if (count.textContent !== String(down.count)) { count.textContent = down.count; count.classList.remove('pop'); void count.offsetWidth; count.classList.add('pop'); } }
      const mine = down && down.who === me && !down.tko;
      getup.hidden = !mine;
      if (mine) {
        const w = DOWN.width[down.level];
        q('.zone', getup).style.left = (down.zone - w / 2) * 100 + '%'; q('.zone', getup).style.width = w * 100 + '%'; q('.mark', getup).style.left = down.m * 100 + '%';
        text(q('.pips', getup), '◆'.repeat(Math.min(down.hits, down.need)) + '◇'.repeat(Math.max(0, down.need - down.hits)));
      }
      flash = Math.max(0, flash - dt * 1.9);
      const low = s.f[me].hp < 25 && s.phase === 'fight' ? 0.18 : 0;
      hurt.style.opacity = Math.max(flash, low).toFixed(2);
    }
  };
}
