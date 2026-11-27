// Spiel-eigene Bedienelemente: Stangenleiste, Schalter für die automatische Wahl, Hinweise, Uhr.
import { ROD_NAMES } from './config.js';

const SHORT = ['TW', 'AB', 'MF', 'ST'];

export function createHud({ shell, input, audio }) {
  const bar = document.createElement('div'); bar.id = 'rodbar'; bar.hidden = true; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Stange wählen');
  const chips = SHORT.map((name, r) => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.rod = r; b.setAttribute('aria-label', ROD_NAMES[r]); b.title = ROD_NAMES[r] + ' (Taste ' + (r + 1) + ')';
    b.innerHTML = '<b>' + name + '</b><small>' + ROD_NAMES[r] + '</small>';
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); input.select(r, true); audio.play('ui'); });
    b.addEventListener('click', (e) => { if (e.detail === 0) input.select(r, true); });      // Tastaturbedienung
    bar.appendChild(b); return b;
  });
  document.body.appendChild(bar);
  const charge = document.createElement('div'); charge.id = 'charge'; charge.hidden = true; charge.innerHTML = '<i></i>'; document.body.appendChild(charge);

  input.state.auto = shell.store.get('auto', '1') !== '0';
  const toggles = [];
  const label = () => { for (const t of toggles) { t.textContent = 'Stangenwahl: ' + (input.state.auto ? 'automatisch' : 'von Hand'); t.setAttribute('aria-pressed', String(input.state.auto)); } };
  for (const [parent, before] of [['#menu .card', 'details'], ['#pause .card', '#btnResume']]) {
    const t = document.createElement('button'); t.type = 'button'; t.className = 'ghost autoToggle'; const box = document.querySelector(parent); box.insertBefore(t, box.querySelector(before));
    t.onclick = () => { input.state.auto = !input.state.auto; shell.store.set('auto', input.state.auto ? '1' : '0'); label(); audio.play('ui'); };
    toggles.push(t);
  }
  label();

  let hintT = 0, shownRod = -1;
  return {
    start() {
      const touch = matchMedia('(pointer: coarse)').matches;
      shell.hint(touch ? 'Ziehen schiebt · Wisch nach vorn schießt' : 'Ziehen oder Pfeile: schieben · Leertaste: Schuss · Shift: klemmen'); hintT = 4.5; shownRod = -1;
    },
    stop() { hintT = 0; shell.hint(''); },
    update(s, dt) {
      const screen = shell.state.screen, show = !!s && (screen === 'play' || screen === 'pause');
      if (bar.hidden === show) bar.hidden = !show;
      if (hintT > 0 && ((hintT -= dt) <= 0 || input.state.lastShot)) { hintT = 0; shell.hint(''); }
      if (input.state.rod !== shownRod) { shownRod = input.state.rod; chips.forEach((c, r) => c.setAttribute('aria-pressed', String(r === shownRod))); }
      const c = Math.max(input.state.charge, input.state.wind);
      charge.hidden = !(show && c > 0.02); if (!charge.hidden) charge.firstChild.style.width = Math.round(c * 100) + '%';
      if (s) { const t = Math.ceil(s.time), clock = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); shell.setSub(s.golden ? 'Golden Goal ' + clock : clock); }
    }
  };
}
