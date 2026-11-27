// Rückmeldungen: Töne, Banner, Vibration, Anzeigetext, Knopfbeschriftung und Hinweise.
import { COURT, MOVES } from './config.js';
import { hoopDist } from './math.js';

export function createFeedback({ shell, audio, view, hud, controls }) {
  let excite = 0, hintText = '', hintFor = 0, hintSide = -1, shownOff = false, shownDef = false, subText = '';
  const touch = () => controls.touchVisible();
  const hint = (text, seconds, side = -1) => { hintText = text; hintFor = seconds; hintSide = side; shell.hint(text); };

  function event(e, s) {
    const me = shell.state.me, mine = e.side === me;
    view.fx(e, s);
    switch (e.type) {
      case 'bounce': audio.play('dribble', mine ? 1 : 0.6); break;
      case 'floor': audio.play('dribble', Math.min(1, e.v / 5)); break;
      case 'rim': audio.play('rim', e.v); if (e.v > 3) excite = Math.max(excite, 0.5); break;
      case 'board': audio.play('board', e.v); break;
      case 'net': audio.play('net'); break;
      case 'release': audio.play('swoosh'); excite = Math.max(excite, 0.45); break;
      case 'shot': if (mine && e.kind !== 'layup') { hud.release(s.p[me].ch, s.p[me].gr, !!e.perfect); if (e.perfect) audio.vibrate(12); } break;
      case 'jump': audio.play('jump'); if (e.kind === 'dunk') excite = 0.8; break;
      case 'squeak': case 'cross': audio.play('squeak'); break;
      case 'land': if (mine) audio.play('jump'); break;
      case 'fake': audio.play('squeak'); break;
      case 'dunk': audio.play('dunk'); audio.vibrate([50, 30, 90]); excite = 1; break;
      case 'block': audio.play('block'); audio.vibrate(55); excite = 0.9; shell.banner('GEBLOCKT!', mine ? 'good' : 'bad', 900); break;
      case 'steal': audio.play('steal'); audio.vibrate(35); excite = 0.7; shell.banner('GEKLAUT!', mine ? 'good' : 'bad', 900); break;
      case 'stealmiss': audio.play('whiff'); break;
      case 'ankle': audio.play('squeak'); excite = 0.8; shell.banner('ABGEHÄNGT!', mine ? 'good' : 'bad', 800); break;
      case 'turnover': if (e.kind !== 'steal') shell.banner(mine ? 'DEIN BALL' : 'BALL WEG', mine ? 'good' : 'bad', 700); break;
      case 'rebound': audio.play('dribble', 0.8); break;
      case 'clear': audio.play('ui'); if (mine) shell.banner('FREI!', 'good', 600); break;
      case 'needclear': if (mine) { audio.play('ui'); hint('Erst hinter die Dreierlinie!', 2.2); } break;
      case 'check': audio.play('check'); shell.banner(mine ? 'CHECK · DEIN BALL' : 'CHECK · VERTEIDIGE', 'role', 950); break;
      case 'score': {
        const word = e.buzzer ? 'BUZZER!' : e.kind === 'dunk' ? 'DUNK!' : e.pts === 3 ? 'DREIER!' : e.kind === 'swish' ? 'SWISH!' : e.kind === 'layup' ? 'KORBLEGER!' : 'KORB!';
        shell.banner(word + ' +' + e.pts, mine ? 'good' : 'bad', 1500); audio.play(mine ? 'cheer' : 'groan'); if (mine) audio.vibrate([30, 40, 60]); excite = 1; break;
      }
      case 'violation': audio.play('buzzer'); shell.banner('WURFUHR!', mine ? 'bad' : 'good', 1300); break;
      case 'buzzer': excite = 1; break;
      case 'timeup': audio.play('buzzer'); shell.banner('ZEIT!', 'role', 1500); break;
      case 'sudden': audio.play('buzzer'); shell.banner('NÄCHSTER KORB!', 'role', 1600); break;
      default: break;
    }
  }

  function labels(s, me) {
    const own = s.ball.own, p = s.p[me];
    let a = 'SPRUNG', b = 'KLAU';
    if (own === me) {
      const d = hoopDist(p.x, p.z), toward = (p.vx * -p.x + p.vz * (1.35 - p.z)) / (d || 1);
      a = s.need ? 'RAUS!' : p.act === 'gather' ? 'LOS!' : d < MOVES.dunkRange && toward > MOVES.dunkSpeed ? 'DUNK' : d < 2.0 || (d < MOVES.layupRange && toward > 1.2) ? 'LEGER' : d >= COURT.threeR ? 'WURF 3' : 'WURF';
      b = 'TRICK';
    } else if (own >= 0) a = 'BLOCK';
    controls.setLabel('a', a); controls.setLabel('b', b);
  }

  return {
    event,
    reset() { excite = 0; hintFor = 0; shownOff = shownDef = false; subText = ''; shell.hint(''); },
    frame(dt, s) {
      excite = Math.max(0, excite - dt * 0.55); audio.excite(shell.state.screen === 'play' ? excite : 0);
      if (!s || shell.state.screen !== 'play') return;
      const me = shell.state.me;
      labels(s, me);
      const t = Math.ceil(s.time), clock = Math.ceil(s.clock);
      const narrow = innerWidth < 400, time = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
      const text = (s.sudden ? (narrow ? 'K.o. ' : 'Nächster Korb ') : '') + time + (narrow ? ' ⏱' : ' · Uhr ') + clock;
      if (text !== subText) { subText = text; shell.setSub(text); const el = document.getElementById('sub'); if (el) el.dataset.low = s.clock <= 4 ? '1' : '0'; }
      if (hintFor > 0 && hintSide >= 0 && s.ball.own >= 0 && s.ball.own !== hintSide) hintFor = 0.001;          // Ballwechsel: alter Tipp passt nicht mehr
      if (hintFor > 0) { hintFor -= dt; if (hintFor <= 0) { hintText = ''; shell.hint(''); } else if (document.getElementById('hint').hidden) shell.hint(hintText); return; }
      if (s.phase !== 'live') return;
      if (s.need && s.ball.own === me) hint('Erst hinter die Dreierlinie!', 1.2, me);
      else if (s.ball.own === me && !shownOff) { shownOff = true; hint(touch() ? 'WURF halten, im Grünen loslassen' : 'Leertaste halten, im Grünen loslassen · K Trick · Umschalt Sprint', 5, me); }
      else if (s.ball.own === 1 - me && !shownDef) { shownDef = true; hint(touch() ? 'KLAU, wenn der Ball unten ist · BLOCK beim Absprung' : 'K klaut, wenn der Ball unten ist · Leertaste blockt', 5, 1 - me); }
    }
  };
}
