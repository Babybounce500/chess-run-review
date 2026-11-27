// Regie der Übertragung: Einmarsch, Bauchbinden, Wiederholungen, Rundenstatistik, Richterwertung, Kommentar.
// Liest den Kampf nur mit; angehalten wird er ausschließlich während des Einmarschs.
import { sim, totals } from './sim.js';
import { MATCH } from './config.js';

export const RIVALS = {
  easy:   { name: 'Rocco Brandt', nick: '„Der Neuling“',  height: 178, reach: 180, weight: 74, record: '4 – 3' },
  normal: { name: 'Viktor Sand',  nick: '„Sandsturm“',    height: 183, reach: 187, weight: 76, record: '17 – 4' },
  hard:   { name: 'Ilja Stahl',   nick: '„Der Amboss“',   height: 186, reach: 192, weight: 79, record: '29 – 1' }
};
const HERO = { nick: '„Der Herausforderer“', height: 182, reach: 185, weight: 76 };
export const WALK = { each: 3.6, face: 3.2 };                    // Sekunden
const SPAN = { before: 0.9, after: 0.75 }, SLOW = 0.4;
const LINES = {
  jab: ['Saubere Führhand.', 'Der Jab sitzt.', 'Er hält ihn mit dem Jab auf Abstand.'],
  cross: ['Volltreffer mit der Schlaghand!', 'Der Cross kommt durch!', 'Gerade durch die Mitte!'],
  hook: ['Was für ein Haken!', 'Von der Seite erwischt!', 'Der Haken schlägt ein!'],
  upper: ['Uppercut! Den hat er nicht gesehen!', 'Von unten durch die Deckung!', 'Gewaltiger Aufwärtshaken!'],
  body: ['Hart zum Körper.', 'Das geht in die Rippen.', 'Er arbeitet am Körper.'],
  counter: ['Eiskalt gekontert!', 'Genau darauf hat er gewartet!', 'Bestraft!'],
  parry: ['Glänzend pariert.', 'Abgefangen!', 'Traumhaftes Timing in der Abwehr.'],
  down: ['Er geht zu Boden!', 'Niederschlag! Die Halle steht!', 'Da liegt er!'],
  up: ['Er steht wieder!', 'Aufgestanden, das Herz ist da.'],
  gassed: ['Ihm geht die Luft aus.'],
  break: ['Die Deckung ist offen!']
};

const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const add = (parent, tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; parent.appendChild(e); return e; };
const pct = (a, b) => (b ? Math.round((a / b) * 100) + ' %' : '–');

export function createShow({ view, audio, shell, onSkip }) {
  const lower = el('<div id="lower" hidden><b></b><span></span><small></small></div>');
  const tale = el('<div id="tale" hidden><h3>Kämpfervergleich</h3><table></table></div>');
  const replayUi = el('<div id="replay" hidden><i></i><i></i><b>● WIEDERHOLUNG</b></div>');
  const panel = el('<div id="panel" hidden></div>');
  const ticker = el('<div id="ticker" hidden></div>');
  const skip = el('<button id="btnSkipShow" type="button" hidden>Überspringen ▸▸</button>');
  document.body.append(lower, tale, replayUi, panel, ticker, skip);

  let on = true, walk = null, frames = [], pending = [], best = null, ko = null, rep = null, start = null, panelKey = '', tickerT = 0, lastLine = 0, profiles = null, phase = '', round = 0;
  const show = (e, v) => { if (e.hidden === v) e.hidden = !v; };
  const hideAll = () => { for (const e of [lower, tale, replayUi, panel, ticker, skip]) e.hidden = true; panelKey = ''; };

  function say(kind, id) { const list = LINES[kind]; if (!list) return; const now = performance.now(); if (now - lastLine < 1700 && !['down', 'counter', 'up'].includes(kind)) return; lastLine = now; ticker.textContent = list[id % list.length]; ticker.hidden = false; ticker.classList.remove('in'); void ticker.offsetWidth; ticker.classList.add('in'); tickerT = 2.4; }

  function taleOfTape(names) {
    const [a, b] = profiles, t = tale.querySelector('table'); t.textContent = '';
    const rows = [[names[0], '', names[1]], [a.nick, 'Kampfname', b.nick], [a.record, 'Bilanz', b.record], [a.height + ' cm', 'Größe', b.height + ' cm'], [a.reach + ' cm', 'Reichweite', b.reach + ' cm'], [a.weight + ' kg', 'Gewicht', b.weight + ' kg']];
    rows.forEach((r, i) => { const tr = add(t, 'tr', i ? '' : 'head'); add(tr, 'td', 'c0', r[0]); add(tr, 'th', '', r[1]); add(tr, 'td', 'c1', r[2]); });
  }
  function bind(i, names) {
    const p = profiles[i];
    lower.dataset.team = String(i); lower.querySelector('b').textContent = names[i]; lower.querySelector('span').textContent = (i === 0 ? 'Rote Ecke' : 'Blaue Ecke') + ' · ' + p.nick; lower.querySelector('small').textContent = p.height + ' cm · ' + p.weight + ' kg · Bilanz ' + p.record;
  }

  /* ---------- Tabellen ---------- */
  function statTable(box, rows, names) { const t = add(box, 'table', 'stats'); const h = add(t, 'tr', 'head'); add(h, 'td', 'c0', names[0]); add(h, 'th', ''); add(h, 'td', 'c1', names[1]); for (const r of rows) { const tr = add(t, 'tr'); add(tr, 'td', 'c0', r[1]); add(tr, 'th', '', r[0]); add(tr, 'td', 'c1', r[2]); } return t; }
  function cardTable(box, s, upTo, names) {
    const t = add(box, 'table', 'cards'), head = add(t, 'tr', 'head'); add(head, 'th', '', 'Punktrichter'); for (let r = 0; r < s.cards.length; r++) add(head, 'th', '', 'R' + (r + 1)); add(head, 'th', '', 'Gesamt');
    const sum = totals(s);
    for (let j = 0; j < 3; j++) {
      const tr = add(t, 'tr', j < upTo ? 'shown' : 'hidden'); add(tr, 'td', '', 'Richter ' + 'ABC'[j]);
      for (const r of s.cards) add(tr, 'td', '', j < upTo ? r[j][0] + ':' + r[j][1] : '·');
      add(tr, 'td', 'sum ' + (sum[j][0] > sum[j][1] ? 'c0' : sum[j][1] > sum[j][0] ? 'c1' : ''), j < upTo ? sum[j][0] + ' : ' + sum[j][1] : '?');
    }
    add(box, 'p', 'note', 'Links ' + names[0] + ', rechts ' + names[1]);
  }
  function roundStats(s) { const d = s.f.map((f, i) => { const b = (start && start[i]) || {}; const get = (k) => f.stats[k] - (b[k] || 0); return { thrown: get('thrown'), landed: get('landed'), power: get('power'), counters: get('counters'), parries: get('parries'), damage: Math.round(get('damage')), down: get('knockdowns') }; });
    return [['Treffer', d[0].landed + ' / ' + d[0].thrown, d[1].landed + ' / ' + d[1].thrown], ['Quote', pct(d[0].landed, d[0].thrown), pct(d[1].landed, d[1].thrown)], ['Harte Treffer', d[0].power, d[1].power], ['Konter · Paraden', d[0].counters + ' · ' + d[0].parries, d[1].counters + ' · ' + d[1].parries], ['Schaden', d[0].damage, d[1].damage], ['Niederschläge', d[0].down, d[1].down]]; }

  function restPanel(s) {
    const key = 'rest' + s.round; if (panelKey !== key) { panelKey = key; panel.textContent = ''; panel.className = 'rest'; add(panel, 'h3', '', 'Runde ' + s.round + ' · Statistik'); statTable(panel, roundStats(s), shell.state.names); cardTable(panel, s, 3, shell.state.names); }
    show(panel, true);
  }
  function decisionPanel(s) {
    const n = Math.min(3, Math.floor((s.pt - 0.5) / 1.35)), key = 'dec' + n;
    if (panelKey !== key) { panelKey = key; panel.textContent = ''; panel.className = 'decision'; add(panel, 'h3', '', n >= 3 ? (s.win < 0 ? 'Unentschieden!' : 'Sieger: ' + shell.state.names[s.win]) : 'Die Richter haben entschieden'); cardTable(panel, s, Math.max(0, n), shell.state.names); if (n > 0) audio.play('tick'); if (n >= 3) { audio.play('fanfare'); view.excite(1); } }
    show(panel, true);
  }

  /* ---------- Wiederholungen ---------- */
  function record(s) {
    const last = frames[frames.length - 1];
    if (last && s.t - last.t < 1 / 45) return;
    const copy = sim.unpack(sim.pack(s)); if (!copy) return;
    frames.push(copy); while (frames.length && s.t - frames[0].t > 4) frames.shift();
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i]; if (s.t < p.at + SPAN.after && s.phase !== 'over') continue;
      pending.splice(i, 1);
      const clip = { frames: frames.filter((f) => f.t >= p.at - SPAN.before && f.t <= p.at + SPAN.after), at: p.at, hit: p.hit, score: p.score, down: p.down, played: false };
      if (clip.frames.length < 8) continue;
      if (!best || clip.score >= best.score) best = clip;
      if (clip.down) ko = clip;
    }
  }
  function playClip(clip, angles, kind) { rep = { clip, angles, n: 0, t: clip.frames[0].t, kind, hit: false }; view.resetPose(); show(replayUi, true); show(ticker, false); }
  function stopReplay() { if (!rep) return; rep = null; show(replayUi, false); view.resetPose(); }
  function replayFrame(dt) {
    const c = rep.clip, first = c.frames[0].t, last = c.frames[c.frames.length - 1].t;
    rep.t += dt * SLOW;
    if (!rep.hit && rep.t >= c.at) { rep.hit = true; view.event(c.hit, c.frames[0]); audio.play(c.hit.body ? 'bodyshot' : 'thud', c.hit.p); }
    if (rep.t >= last) { rep.n++; if (rep.n >= rep.angles.length) { stopReplay(); return null; } rep.t = first; rep.hit = false; view.resetPose(); }
    let i = 0; while (i < c.frames.length - 2 && c.frames[i + 1].t <= rep.t) i++;
    const a = c.frames[i], b = c.frames[i + 1] || a, q = b.t > a.t ? Math.min(1, Math.max(0, (rep.t - a.t) / (b.t - a.t))) : 1;
    return { mode: 'replay', who: c.hit.side, angle: rep.angles[rep.n], u: (rep.t - first) / Math.max(0.1, last - first), state: sim.lerp(a, b, q), dt: dt * SLOW };
  }

  return {
    enabled: () => on, setEnabled(v) { on = !!v; if (!on) { walk = null; stopReplay(); hideAll(); } },
    // duel = Bilanzen beider Seiten beim Online-Kampf; sonst zählt der Computergegner
    reset(level, names, record, duel) {
      hideAll(); stopReplay(); frames = []; pending = []; best = null; ko = null; start = null; phase = ''; round = 0; tickerT = 0;
      // online haben beide dieselben Werte
      profiles = duel ? duel.map((r) => Object.assign({}, HERO, { nick: '„Herausforderer“', record: r })) : [Object.assign({}, HERO, { record }), RIVALS[level] || RIVALS.normal];
      walk = on ? { t: 0, stage: -1, names } : null;
    },
    stop() { walk = null; stopReplay(); hideAll(); frames = []; pending = []; },
    skip() { if (walk) { walk = null; for (const e of [lower, tale, skip]) e.hidden = true; view.resetPose(); if (onSkip) onSkip(); } else stopReplay(); },
    event(e, s) {
      if (e.type === 'hit') { if (e.counter) say('counter', e.id); else if (e.body && e.p > 6) say('body', e.id); else if (e.p >= 9 || e.id % 3 === 0) say(e.k, e.id); if (on && (e.p >= 8.5 || e.counter)) pending.push({ at: s.t, hit: Object.assign({}, e), score: e.p + (e.counter ? 5 : 0), down: false }); if (e.p >= 11 || e.counter) view.excite(0.45); }
      else if (e.type === 'down') { say('down', e.id); view.excite(1); const p = pending[pending.length - 1]; if (p) { p.down = true; p.score += 30; } }
      else if (e.type === 'parry') { say('parry', e.id); view.excite(0.35); }
      else if (e.type === 'up') { say('up', e.id); view.excite(0.8); }
      else if (e.type === 'gassed' || e.type === 'break') say(e.type, e.id);
      else if (e.type === 'over') view.excite(1);
    },
    // Je Bild. Rückgabe: hold = Kampf anhalten, view = abweichende Einstellung, busy = Anzeige und Steuerung ausblenden
    update(dt, s, playing) {
      if (tickerT > 0) { tickerT -= dt; if (tickerT <= 0) ticker.hidden = true; }
      if (!s || !playing) {
        // im Pausenmenü und auf dem Abschlussbild liegt keine Einblendung darüber; beim Weiterspielen kommt sie wieder
        if (!s) hideAll(); else for (const e of [lower, tale, replayUi, panel, ticker, skip]) show(e, false);
        return { hold: false, view: null, busy: false };
      }
      if (walk) {
        walk.t += dt; const t = walk.t, total = WALK.each * 2 + WALK.face;
        if (t >= total) { this.skip(); return { hold: false, view: null, busy: false }; }
        const stage = t < WALK.each ? 0 : t < WALK.each * 2 ? 1 : 2;
        if (stage !== walk.stage) { walk.stage = stage; if (stage < 2) { bind(stage === 0 ? 1 : 0, walk.names); audio.play('fanfare'); } else { taleOfTape(walk.names); audio.play('bell', 1); } view.excite(stage === 2 ? 0.6 : 0.8); }
        const u = stage === 0 ? t / WALK.each : stage === 1 ? (t - WALK.each) / WALK.each : (t - WALK.each * 2) / WALK.face;
        show(skip, true); show(lower, stage < 2 && u > 0.18); show(tale, stage === 2); view.excite(0.25);
        return { hold: true, busy: true, view: stage < 2 ? { mode: 'walk', who: stage === 0 ? 1 : 0, u } : { mode: 'faceoff', u } };
      }
      // Rundenwechsel: Ausgangswerte merken
      if (s.round !== round) { round = s.round; start = s.f.map((f) => Object.assign({}, f.stats)); best = null; ko = null; }
      if (s.phase !== 'rest' && s.phase !== 'over' && !rep) record(s);
      else if (s.phase === 'over' && pending.length) record(s);
      const entered = s.phase !== phase; if (entered) { phase = s.phase; if (s.phase === 'fight' || s.phase === 'intro') { stopReplay(); panel.hidden = true; panelKey = ''; } if (s.phase === 'fight') { for (const e of [panel, replayUi]) e.hidden = true; } }
      if (on) {
        // Niederschlag des Gegners: sofortige Wiederholung während des Anzählens (der eigene Aufsteh-Balken bleibt frei)
        if (s.phase === 'down' && s.down.who !== shell.state.me && ko && !ko.played && !rep) { ko.played = true; playClip(ko, [0, 1], 'down'); }
        if (s.phase === 'over' && (s.how === 'ko' || s.how === 'tko') && s.pt > 1.6 && s.pt < 2.4 && !rep && (ko || best)) { const c = ko || best; if (!c.final) { c.final = true; playClip(c, [1], 'ko'); } }
        if (s.phase === 'rest') {
          if (best && !best.rested && s.pt < 0.4 && !rep) { best.rested = true; playClip(best, [0], 'rest'); }
          if (!rep && s.pt > 0.3) restPanel(s); else show(panel, false);
        } else if (s.phase === 'over' && s.how !== 'ko' && s.how !== 'tko') { if (!shell.state.over) decisionPanel(s); else show(panel, false); }
        else show(panel, false);
      }
      if (shell.state.over) { stopReplay(); show(panel, false); show(ticker, false); }
      if (rep && s.phase === 'down' && s.down.who === shell.state.me) stopReplay();
      const v = rep ? replayFrame(dt) : null;
      show(skip, !!v); show(replayUi, !!v);
      return { hold: false, view: v, busy: !!v || !panel.hidden };
    },
    // Ergebnisblatt auf dem Abschlussbild
    resultSheet(box, s) {
      box.textContent = '';
      const rows = [['Treffer', s.f[0].stats.landed + ' / ' + s.f[0].stats.thrown, s.f[1].stats.landed + ' / ' + s.f[1].stats.thrown], ['Quote', pct(s.f[0].stats.landed, s.f[0].stats.thrown), pct(s.f[1].stats.landed, s.f[1].stats.thrown)], ['Konter', s.f[0].stats.counters, s.f[1].stats.counters], ['Paraden', s.f[0].stats.parries, s.f[1].stats.parries], ['Niederschläge', s.f[0].stats.knockdowns, s.f[1].stats.knockdowns]];
      statTable(box, rows, shell.state.names);
      if (s.how !== 'ko' && s.how !== 'tko' && s.cards.length) cardTable(box, s, 3, shell.state.names);
    },
    info: () => ({ on, walk: walk ? walk.stage : null, replay: rep ? { kind: rep.kind, angle: rep.angles[rep.n], t: +rep.t.toFixed(2) } : null, panel: panel.hidden ? null : panel.className, best: best ? +best.score.toFixed(1) : null, ko: !!ko, frames: frames.length, rest: MATCH.rest })
  };
}
