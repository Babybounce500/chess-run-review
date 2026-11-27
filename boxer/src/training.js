// Training: Partner ohne Uhr und Niederschläge. Die Leiste zeigt, wann ein Schlag ankommt und wann man drücken muss.
import { windOf } from './sim.js';
import { FIGHT, PUNCH } from './config.js';

export const DRILLS = { free: 'Frei', parry: 'Parade', counter: 'Kontern' };
const PUNCHES = ['jab', 'cross', 'hook', 'upper', 'mix'];
const SLOW = 1.6;
const DODGE = { jab: 'zur Seite oder ducken', cross: 'zur Seite oder ducken', hook: 'ducken', upper: 'zur Seite', mix: 'Gerade zur Seite oder ducken, Haken ducken, Uppercut zur Seite' };
const help = (o) => (o.mode === 'free' ? 'Der Partner steht still. Probier Schläge und Kombinationen aus.'
  : o.mode === 'counter' ? 'Ausweichen (' + DODGE[o.k] + '), dann sofort zurückschlagen.'
  : o.k === 'upper' ? 'Ein Uppercut lässt sich nicht parieren: weiche zur Seite aus.'
  : 'Drücke DECKUNG, wenn die Marke im grünen Feld ist.');
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

export function createTraining({ reaction }) {
  const box = el(`<div id="train" hidden>
    <div class="row">${Object.entries(DRILLS).map(([k, v]) => `<button type="button" data-drill="${k}">${v}</button>`).join('')}<button type="button" id="trainPunch"></button><button type="button" id="trainSlow"></button></div>
    <div id="trainBar"><i class="zone"></i><i class="press" hidden></i><i class="mark"></i></div>
    <div id="trainCounter" hidden><i></i><span>Konterfenster</span></div>
    <p id="trainMsg"></p><p id="trainStats"></p></div>`);
  document.body.appendChild(box);
  const $ = (q) => box.querySelector(q);
  let state = null, opt = { mode: 'parry', k: 'jab', slow: true }, tries = 0, parries = 0, counters = 0, evades = 0, guardWas = 0, hitAt = null, openAt = null, seenAct = -1;
  const msg = (text, cls) => { const m = $('#trainMsg'); m.textContent = text; m.className = cls || ''; };
  const stats = () => { const best = reaction.best(); $('#trainStats').textContent = 'Paraden ' + parries + '/' + tries + ' · Ausgewichen ' + evades + ' · Konter ' + counters + (best === null ? '' : ' · Reaktion ' + best + ' ms'); };
  const punchName = () => (opt.k === 'mix' ? 'Zufall' : PUNCH[opt.k].name);
  function apply() {
    if (state) { state.drill = { mode: opt.mode, k: opt.k }; state.pace = opt.slow ? SLOW : 1; }
    for (const b of box.querySelectorAll('[data-drill]')) b.setAttribute('aria-pressed', String(b.dataset.drill === opt.mode));
    $('#trainPunch').textContent = punchName(); $('#trainSlow').textContent = opt.slow ? 'Langsam' : 'Normal';
    for (const q of ['#trainPunch', '#trainSlow', '#trainBar']) $(q).hidden = opt.mode === 'free';
    $('#trainCounter').hidden = true; openAt = null;
  }
  // nach dem Klick den Fokus abgeben, damit die Leertaste nicht den Knopf auslöst
  const click = (e, fn) => { e.currentTarget.blur(); fn(); apply(); msg(help(opt)); };
  for (const b of box.querySelectorAll('[data-drill]')) b.onclick = (e) => click(e, () => { opt.mode = b.dataset.drill; });
  $('#trainPunch').onclick = (e) => click(e, () => { opt.k = PUNCHES[(PUNCHES.indexOf(opt.k) + 1) % PUNCHES.length]; });
  $('#trainSlow').onclick = (e) => click(e, () => { opt.slow = !opt.slow; });

  return {
    start(s) { state = s; tries = parries = counters = evades = 0; guardWas = 0; hitAt = null; openAt = null; seenAct = -1; reaction.reset(); apply(); msg(help(opt)); stats(); },
    stop() { state = null; box.hidden = true; },
    active: () => !!state,
    event(e, s) {
      if (!state) return;
      if (e.type === 'parry' && e.side === 0) { tries++; parries++; openAt = s.t; const r = reaction.success(); msg('Parade! Deckung ' + e.gt + ' ms vor dem Treffer.' + (r === null ? '' : ' Reaktion ' + r + ' ms.'), 'good'); }
      else if (e.type === 'block' && e.side === 0) {
        if (e.k !== 'upper') tries++;                         // ein Uppercut ist keine Paradechance
        const early = e.gt - Math.round(FIGHT.parryWindow * 1000), low = !!s.f[0].low;
        msg(e.k === 'upper' ? 'Geblockt. Ein Uppercut lässt sich nicht parieren, weiche zur Seite aus.' : e.body && !low ? 'Zum Körper: halte zusätzlich KÖRPER.' : !e.body && low ? 'Schlag zum Kopf: lass KÖRPER los.'
          : e.gt >= 9000 ? 'Zu schnell erneut gedrückt. Kurz warten.' : early > 350 ? 'Geblockt. Für die Parade loslassen und erst bei Grün drücken.' : early > 0 ? 'Geblockt, ' + early + ' ms zu früh gedrückt.' : 'Geblockt. Für die Parade vorher kurz loslassen.', 'warn');
      }
      else if (e.type === 'hit' && e.side === 1) { tries++; hitAt = s.t; msg('Getroffen.', 'bad'); }
      else if (e.type === 'evade' && e.side === 0) { tries++; evades++; openAt = s.t; const r = reaction.success(); msg('Ausgewichen! Jetzt kontern.' + (r === null ? '' : ' Reaktion ' + r + ' ms.'), 'good'); }
      else if (e.type === 'hit' && e.side === 0 && e.counter) { counters++; msg('Konter!' + (openAt === null ? '' : ' Nach ' + Math.round((s.t - openAt) * 1000) + ' ms.'), 'good'); openAt = null; }
      stats();
    },
    // eigener Druck auf DECKUNG: kam er kurz nach dem Treffer?
    press(t) { if (state && hitAt !== null && t - hitAt >= 0 && t - hitAt < 0.35) { msg('Zu spät, ' + Math.max(10, Math.round((t - hitAt) * 1000)) + ' ms nach dem Treffer.', 'bad'); hitAt = null; } },
    // je Bild
    update(s, show) {
      box.hidden = !state || !show; if (box.hidden || !s) return;
      const me = s.f[0], act = s.f[1].act, pressed = me.guard === 1 && guardWas === 0; guardWas = me.guard;
      if (openAt !== null && me.counter <= 0) openAt = null;
      if (act) {
        const wind = windOf(act), u = Math.min(1, act.t / wind);
        if (s.f[1].stats.thrown !== seenAct) { seenAct = s.f[1].stats.thrown; $('#trainBar .press').hidden = true; }
        $('#trainBar .mark').style.left = u * 100 + '%';
        const zone = act.k === 'upper' ? 0 : Math.min(1, FIGHT.parryWindow / wind); $('#trainBar .zone').style.left = (1 - zone) * 100 + '%'; $('#trainBar .zone').style.width = zone * 100 + '%';
        if (pressed && !act.done) { const p = $('#trainBar .press'); p.hidden = false; p.style.left = u * 100 + '%'; }
      } else $('#trainBar .mark').style.left = '0%';
      const open = me.counter > 0 && opt.mode !== 'free';
      $('#trainCounter').hidden = !open; if (open) $('#trainCounter i').style.width = Math.min(100, (me.counter / (FIGHT.counterWindow * (s.pace || 1))) * 100) + '%';
    },
    info: () => ({ active: !!state, opt: Object.assign({}, opt), tries, parries, counters, evades, message: $('#trainMsg').textContent })
  };
}
