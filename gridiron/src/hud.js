// Spiel-eigene Oberfläche: Spielzug-Karten, Schilder über den Passempfängern, Anzeigezeile und Ausrufe.
import { FIELD, MATCH, TIME, PLAYS, FORMATIONS, TARGETS, LINEUP, PASS } from './config.js';
import { openness, openClass, canPass, rushLeft, routePoints } from './sim.js';
import { TAG } from './view.js';

const make = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; };
const text = (e, t) => { if (e.textContent !== t) e.textContent = t; };
const OPEN = ['ZU', 'ENG', 'FREI'];

// Kleine Skizze eines Spielzugs bzw. einer Aufstellung (oben = Richtung Endzone des Angriffs)
function sketch(kind, i) {
  const X = (x) => (50 + x * 5.6).toFixed(1), Y = (z) => (50 - z * 3.1).toFixed(1);
  let s = `<svg viewBox="0 0 100 66" aria-hidden="true"><line x1="2" y1="${Y(0)}" x2="98" y2="${Y(0)}" stroke="#4d8cff" stroke-width="1.5"/>`;
  if (kind === 'play') {
    TARGETS.forEach((p, k) => {
      const pts = routePoints(i, 0, p) || [[LINEUP[p][0], LINEUP[p][1]], [LINEUP[p][0] * 0.85, 2]];
      const clip = pts.map(([x, z]) => [x, Math.min(15, z)]), d = clip.map(([x, z]) => X(x) + ',' + Y(z)).join(' '), end = clip[clip.length - 1];
      s += `<polyline points="${d}" fill="none" stroke="${TAG[k]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"${PLAYS[i].routes[p].block !== undefined ? ' stroke-dasharray="3 3"' : ''}/><circle cx="${X(end[0])}" cy="${Y(end[1])}" r="3" fill="${TAG[k]}"/><circle cx="${X(LINEUP[p][0])}" cy="${Y(LINEUP[p][1])}" r="3.4" fill="#fff"/>`;
    });
    s += `<circle cx="${X(0)}" cy="${Y(LINEUP[0][1])}" r="3.8" fill="#ffb066"/>`;
  } else {
    const f = FORMATIONS[i];
    f.spots.forEach(([x, z], k) => {
      const job = f.job[k];
      if (job === 'zone' || job === 'deep') s += `<circle cx="${X(x)}" cy="${Y(z)}" r="${job === 'deep' ? 17 : 13}" fill="rgba(255,255,255,.13)" stroke="#fff" stroke-dasharray="3 3"/>`;
      if (job === 'rush') s += `<line x1="${X(x)}" y1="${Y(z)}" x2="${X(x * 0.3)}" y2="${Y(-3)}" stroke="#ff6a7c" stroke-width="3" stroke-linecap="round"/>`;
      s += `<circle cx="${X(x)}" cy="${Y(z)}" r="4" fill="${job === 'rush' ? '#ff6a7c' : '#fff'}"/>`;
    });
  }
  return s + '</svg>';
}

export function createHud({ onPick, onConfirm, onTag }) {
  // Karten
  const panel = make('div', '', document.body); panel.id = 'plays'; panel.hidden = true;
  const head = make('div', 'phead', panel), title = make('b', '', head), timer = make('i', '', head); make('u', '', timer);
  const list = make('div', 'cards', panel);
  const go = make('button', 'primary', panel); go.type = 'button'; go.id = 'btnPick'; go.onclick = () => onConfirm();
  let builtKind = '';
  function build(kind) {
    if (builtKind === kind) return; builtKind = kind; list.textContent = ''; panel.dataset.kind = kind;
    (kind === 'play' ? PLAYS : FORMATIONS).forEach((p, i) => {
      const b = make('button', 'pcard', list); b.type = 'button'; b.dataset.pick = String(i);
      b.innerHTML = sketch(kind, i); const n = make('b', '', b); n.textContent = p.name; const d = make('small', '', b); d.textContent = p.info; const k = make('em', '', b); k.textContent = String(i + 1);
      b.onclick = () => onPick(i);
    });
  }
  // Schilder der Passempfänger
  const tags = [0, 1, 2].map((k) => {
    const b = make('button', 'tag', document.body); b.type = 'button'; b.dataset.tag = String(k); b.hidden = true; b.style.setProperty('--c', TAG[k]);
    make('b', '', b).textContent = String(k + 1); make('small', '', b);
    const down = (e) => { e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } onTag(k, true); };
    const up = () => onTag(k, false);
    b.addEventListener('pointerdown', down); for (const n of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(n, up);
    return b;
  });
  const chip = make('div', '', document.body); chip.id = 'chip'; chip.hidden = true;
  let roles = null;                                                                // die Anzeige baut die Hülle erst nach uns

  function setVisible(on) { if (!on) { panel.hidden = true; chip.hidden = true; for (const t of tags) t.hidden = true; } }

  function update(s, me, view, ui) {
    const offense = s.off === me;
    // Karten
    const picking = s.ph === 'pick' && ui.playing;
    panel.hidden = !picking;
    if (picking) {
      build(offense ? 'play' : 'form');
      text(title, ui.locked ? 'Festgelegt. Gleich geht es los …' : offense ? 'Wähle deinen Spielzug' : 'Wähle deine Aufstellung');
      timer.firstChild.style.width = Math.max(0, Math.min(100, (1 - s.pt / TIME.pick) * 100)) + '%';
      for (const b of list.children) { const on = Number(b.dataset.pick) === ui.sel; b.setAttribute('aria-pressed', String(on)); b.disabled = ui.locked && !on; }
      go.disabled = ui.locked; text(go, ui.locked ? 'Festgelegt ✓' : 'Festlegen');
    }
    // Anzeigezeile
    const togo = s.line >= FIELD.goal - 0.1 ? 'Tor' : String(Math.max(1, Math.ceil(s.line - s.los - 0.01)));
    const series = s.ot ? 'Verlängerung ' + s.ot : 'Serie ' + Math.min(MATCH.drives, s.drv[s.off] + (s.res && s.res.over ? 0 : 1)) + '/' + MATCH.drives;
    if (!roles) roles = [0, 1].map((k) => make('small', 'role', document.getElementById('side' + k)));
    for (let k = 0; k < 2; k++) { text(roles[k], s.off === k ? 'ANGRIFF' : 'ABWEHR'); roles[k].dataset.off = s.off === k ? '1' : '0'; }
    // Statusfeld
    let info = '';
    if (ui.playing) {
      const rush = rushLeft(s);
      if (s.ph === 'pick' || s.ph === 'set') info = s.down + '. Versuch · ' + (togo === 'Tor' ? 'bis zur Endzone' : 'noch ' + togo + ' m');
      else if (s.ph === 'live' && rush > 0) info = 'Rusher startet in ' + (Math.ceil(rush * 10) / 10).toFixed(1).replace('.', ',') + ' s';
      else if (s.ph === 'live' && canPass(s)) info = offense ? 'Rusher kommt! Wirf oder lauf' : 'Jetzt darf gestürmt werden';
      else if (s.ph === 'dead' && s.res && s.res.type !== 'int') { const g = Math.round(s.res.gain); info = s.res.type === 'td' ? 'Touchdown' : g < 0 ? 'Raumverlust ' + -g + ' m' : 'Raumgewinn ' + g + ' m'; }
    }
    chip.hidden = !info; text(chip, info); chip.dataset.warn = s.ph === 'live' && canPass(s) && rushLeft(s) <= 0 ? '1' : '0';
    // Schilder
    const showTags = ui.playing && offense && (s.ph === 'set' || (s.ph === 'live' && canPass(s)));
    const placed = [];
    for (let k = 0; k < 3; k++) {
      const t = tags[k]; if (!showTags) { t.hidden = true; continue; }
      const p = s.pl[TARGETS[k]], q = view.project(p.x, 3.7, p.z); t.hidden = false;
      const w = t.offsetWidth || 56, h = t.offsetHeight || 52, I = ui.insets;
      let x = Math.max(4 + w / 2, Math.min(innerWidth - 4 - w / 2, q.x)), y = Math.max(I.top + h, Math.min(innerHeight - 8, q.y));
      for (const o of placed) if (Math.abs(o.x - x) < w + 2 && Math.abs(o.y - y) < h) { x = o.x + (x >= o.x ? w + 3 : -w - 3); x = Math.max(4 + w / 2, Math.min(innerWidth - 4 - w / 2, x)); if (Math.abs(o.x - x) < w) y = o.y - h - 2; }
      placed.push({ x, y }); t.style.transform = `translate(${Math.round(x - w / 2)}px, ${Math.round(y - h)}px)`;
      const open = s.ph === 'live' ? openClass(openness(s, k)) : -1;
      t.dataset.open = String(open); t.disabled = s.ph !== 'live';
      const holding = s.ph === 'live' && s.hold.k === k;
      t.classList.toggle('hold', holding); text(t.lastChild, holding ? (s.hold.t >= PASS.highAfter ? 'HOCH' : 'FLACH') : open < 0 ? '' : OPEN[open]);
    }
    return series;
  }
  return { update, setVisible, panel, chip };
}

// Ausrufe zu den Ereignissen. Je wichtiger, desto eher gewinnt der Text, wenn mehrere gleichzeitig kommen
export function callout(e, s, me) {
  const good = (offGood) => ((s.off === me) === offGood ? 'good' : 'bad'), gain = s.res ? Math.round(s.res.gain) : 0, plus = (gain > 0 ? '+' : '') + gain;
  switch (e.type) {
    case 'td': return [9, 'TOUCHDOWN!', e.s === me ? 'good' : 'bad', 2200];
    case 'int': return [8, 'ABGEFANGEN!', good(false), 2000];
    case 'downs': return [7, 'BALLWECHSEL', e.s === me ? 'bad' : 'good', 1700];
    case 'sack': return [6, 'SACK!', e.s === me ? 'bad' : 'good', 1300];
    case 'first': return [5, 'ERSTER VERSUCH!', e.s === me ? 'good' : 'bad', 1400];
    case 'swat': return [4, 'ABGEWEHRT!', good(false), 1200];
    case 'drop': return [4, 'FALLEN GELASSEN', good(false), 1200];
    case 'incomplete': return [3, 'DANEBEN', good(false), 1200];
    case 'oob': return [3, 'IM AUS ' + plus, 'role', 1100];
    case 'timeout': return [3, 'PFIFF', 'role', 1100];
    case 'tackle': return [2, gain > 0 ? 'GESTOPPT ' + plus : gain < 0 ? 'ZURÜCK ' + plus : 'GESTOPPT', gain >= 4 ? good(true) : good(false), 1100];
    case 'shed': return [1, 'WEGGESTOSSEN!', good(true), 700];
    case 'drive': return [4, e.s === me ? 'DU GREIFST AN' : 'DU VERTEIDIGST', e.s === me ? 'role' : 'role keep', 1500];
    case 'overtime': return [10, 'VERLÄNGERUNG', 'role', 1800];
    case 'final': return s.yardWin ? [10, 'RAUMGEWINN ZÄHLT', 'role', 1800] : null;
    default: return null;
  }
}
