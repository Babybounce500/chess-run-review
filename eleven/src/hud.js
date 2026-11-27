// Anzeige über der 3D-Szene: Radar, Spielername, Kraftbalken, Pfeil zum eigenen Spieler, Statistik.
import { PITCH, FORMATION, MATCH, KICK } from './config.js';
import { N, dirOf } from './sim.js';

const COLORS = ['#ff5a36', '#2f7dff'], KEEP = ['#ffd21f', '#25e08a'];
const el = (id, tag = 'div', parent = document.body) => { const e = document.createElement(tag); e.id = id; e.hidden = true; parent.appendChild(e); return e; };

export function clockText(s) {
  if (s.ph === 'half') return 'Halbzeit';
  if (s.ph === 'over') return 'Abpfiff';
  const t = Math.min(MATCH.half, Math.floor(s.clock));
  return s.half + '. Halbzeit · ' + Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}
export function statRows(s, me) {
  const o = 1 - me, a = s.stats, pos = a.pos[0] + a.pos[1] || 1, pct = (t) => (a.pas[t] ? Math.round((a.cmp[t] / a.pas[t]) * 100) + ' %' : '–');
  const mine = Math.round((a.pos[me] / pos) * 100);
  return [['Ballbesitz', mine + ' %', (a.pos[0] + a.pos[1] ? 100 - mine : 0) + ' %'], ['Schüsse', a.sh[me], a.sh[o]], ['aufs Tor', a.on[me], a.on[o]], ['Pässe', a.pas[me], a.pas[o]], ['Passquote', pct(me), pct(o)], ['Paraden', a.sav[me], a.sav[o]], ['Ecken', a.cor[me], a.cor[o]]];
}
export function statTable(s, me, names) {
  const t = document.createElement('table');
  const row = (cells, head) => { const r = t.insertRow(); cells.forEach((c, i) => { const d = document.createElement(head ? 'th' : 'td'); d.textContent = c; d.className = ['k', 'c0', 'c1'][i]; r.appendChild(d); }); };
  row(['', names[me], names[1 - me]], true);
  for (const r of statRows(s, me)) row(r);
  return t;
}

export function createHud(view) {
  const radar = el('radar', 'canvas'), tag = el('tag'), power = el('power'), off = el('offscreen'), panel = el('panel');
  power.innerHTML = '<i></i>';
  const g = radar.getContext('2d'); let size = '', tick = 0;
  function drawRadar(s, me) {
    const portrait = view.portrait(), yaw = view.yaw(), ratio = Math.min(2, devicePixelRatio || 1);
    const w = radar.clientWidth, h = radar.clientHeight; if (!w || !h) return;
    const key = w + 'x' + h; if (key !== size) { size = key; radar.width = Math.round(w * ratio); radar.height = Math.round(h * ratio); }
    g.setTransform(ratio, 0, 0, ratio, 0, 0); g.clearRect(0, 0, w, h);
    const pad = 5, L = PITCH.halfL, W = PITCH.halfW;
    const at = (x, z) => (portrait ? [w / 2 + (z * yaw / W) * (w / 2 - pad), h / 2 - (x * yaw / L) * (h / 2 - pad)] : [w / 2 + (x / L) * (w / 2 - pad), h / 2 + (z / W) * (h / 2 - pad)]);
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1; g.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
    g.beginPath(); if (portrait) { g.moveTo(pad, h / 2); g.lineTo(w - pad, h / 2); } else { g.moveTo(w / 2, pad); g.lineTo(w / 2, h - pad); } g.stroke();
    for (const sx of [-1, 1]) { const a = at(sx * L, -PITCH.boxHalf), b = at(sx * (L - PITCH.boxDepth), PITCH.boxHalf); g.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); }
    const r = Math.max(2.2, Math.min(w, h) / 34);
    for (let i = 0; i < N; i++) { const p = s.pl[i], [x, y] = at(p.x, p.z), t = i < 11 ? 0 : 1; g.fillStyle = i % 11 === 0 ? KEEP[t] : COLORS[t]; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); if (i === s.ctl[me]) { g.strokeStyle = '#ffe24a'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r + 2, 0, 7); g.stroke(); } }
    const [x, y] = at(s.ball.x, s.ball.z); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r * 0.85, 0, 7); g.fill(); g.stroke();
  }
  return {
    update(s, me, visible) {
      radar.hidden = tag.hidden = !visible || !s;
      if (!visible || !s) { power.hidden = off.hidden = true; panel.hidden = true; return; }
      if (tick++ % 3 === 0) drawRadar(s, me);
      const i = s.ctl[me], p = s.pl[i], [vw, vh] = view.size();
      const text = FORMATION[i % 11].n + ' ' + view.name(i); if (tag.dataset.t !== text) { tag.dataset.t = text; tag.innerHTML = '<b></b><i><u></u></i>'; tag.firstChild.textContent = text; }
      tag.querySelector('u').style.width = Math.round(p.st * 100) + '%';
      const c = s.chg[me], at = view.project(p.x, 3.5, p.z), inside = at.front && at.x > 12 && at.x < vw - 12 && at.y > 60 && at.y < vh - 20;
      power.hidden = !(c && c.k) || !inside;
      if (!power.hidden) { power.style.transform = `translate(${Math.round(at.x - 32)}px, ${Math.round(at.y - 16)}px)`; power.firstChild.style.width = Math.round(Math.min(1, c.t / KICK.full) * 100) + '%'; power.dataset.k = c.k; }
      off.hidden = inside || s.ph === 'goal' || s.ph === 'half';
      if (!off.hidden) { const x = Math.max(26, Math.min(vw - 26, at.x)), y = Math.max(150, Math.min(vh - 190, at.y)); off.style.transform = `translate(${Math.round(x - 16)}px, ${Math.round(y - 16)}px) rotate(${Math.atan2(at.y - y, at.x - x)}rad)`; }
      const half = s.ph === 'half';
      if (half && panel.hidden) { panel.textContent = ''; const h = document.createElement('h3'); h.textContent = 'Halbzeit · Statistik'; panel.append(h, statTable(s, me, this.names)); const n = document.createElement('p'); n.textContent = 'Nach der Pause werden die Seiten getauscht.'; panel.appendChild(n); }
      panel.hidden = !half;
    },
    names: ['Du', 'Computer'],
    side: (s, me) => (dirOf(s, me) > 0 ? 'rechts' : 'links'),
    visible: () => ({ radar: !radar.hidden, panel: !panel.hidden })
  };
}
