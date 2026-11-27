// Online-Duell: Laufzeit messen, Ausgleich für den Gastgeber, gemeinsamer Start, Serie bis zwei Siege.
// Der Baukasten liefert Lobby, Verbindung und Chat; hier steht nur, was beim Boxen dazukommt.
import { STEP } from './kit/realtime.js';
import { TYPES } from './sim.js';

export const NET = {
  delay: 0.07,        // so weit hinter dem neuesten Stand zeigt der Gast (Sekunden)
  sendEvery: 2,       // Zustand jeden zweiten Takt, also 30-mal je Sekunde
  pace: 1.25,         // online sind alle Schläge ein Viertel langsamer, damit man trotz Leitung reagieren kann
  maxLag: 0.22,       // mehr Ausgleich bekommt der Gastgeber nicht auferlegt
  waitMax: 20,        // so lange wartet der Fertige höchstens auf den anderen
  wins: 2             // Serie: wer zuerst so viele Kämpfe gewinnt
};
const BOOLS = ['block', 'duck', 'body', ...TYPES];

export function createOnline({ shell, testLag = 0 }) {
  let handler = null, samples = [], rtt = null, lag = 0, peerLag = 0, pingT = 0;
  let mine = false, peer = false, go = false, waited = 0, hinted = false, told = false;
  let line = [], tick = 0, held = null;
  let series = [0, 0], opponent = '';
  const online = () => shell.state.mode === 'online';
  // testLag verzögert nur im Test jede ausgehende Nachricht, alle gleich, damit die Reihenfolge wie im echten Netz bleibt
  if (testLag > 0) { const direct = shell.net.send; shell.net.send = (o) => { setTimeout(() => direct(o), testLag); return true; }; }
  const send = (o) => shell.send(o);
  shell.onGame((d) => {
    if (d.t === 'p') { if (typeof d.n === 'number') send({ t: 'q', n: d.n }); if (shell.state.role === 'guest' && typeof d.g === 'number' && d.g >= 0 && d.g <= 1000) peerLag = d.g / 1000; return; }
    if (d.t === 'q') { const s = (performance.now() - d.n) / 1000; if (s >= 0 && s < 5) { samples.push(s); if (samples.length > 7) samples.shift(); rtt = samples.slice().sort((a, b) => a - b)[samples.length >> 1]; } return; }
    if (d.t === 'ready') { if (d.n === shell.state.seed) peer = true; return; }
    if (handler) handler(d);
  });
  // für den Echtzeit-Teil des Baukastens: dieselbe Hülle, Nachrichten laufen hier durch
  const link = Object.assign({}, shell, { onGame(fn) { handler = fn; } });

  const target = () => (rtt === null ? 0 : Math.min(NET.maxLag, rtt + NET.delay));
  const ownLag = () => Math.round((shell.state.role === 'host' ? lag : peerLag) * 1000);

  return {
    link,
    // neuer Kampf
    reset() {
      mine = peer = go = hinted = told = false; waited = 0; line = []; tick = 0; held = null;
      const other = shell.state.names[1 - shell.state.me];
      if (other !== opponent || Math.max(series[0], series[1]) >= NET.wins) series = [0, 0];
      opponent = other;
    },
    // Verbindung beendet oder zurück im Menü
    stop() { samples = []; rtt = null; lag = peerLag = 0; series = [0, 0]; opponent = ''; mine = peer = go = false; line = []; held = null; },
    // Gastgeber: eigene Eingaben so lange zurückhalten, wie der Gast durch die Leitung verliert
    own(input) {
      tick++; line.push({ due: tick + Math.round(lag / STEP), input });
      const now = []; while (line.length && line[0].due <= tick) now.push(line.shift().input);
      if (now.length) {
        const out = Object.assign({}, now[now.length - 1]);
        for (const k of BOOLS) out[k] = now.some((i) => i[k]);
        const punch = now.find((i) => TYPES.some((k) => i[k])); if (punch) out.side = punch.side;
        const press = now.find((i) => i.block && i.at); if (press) out.at = press.at;
        held = out;
      }
      return held || {};
    },
    // Je Bild. walking = der Einmarsch läuft noch. waiting = der Kampf darf noch nicht beginnen
    update(dt, walking) {
      if (!online() || !shell.state.started) return { waiting: false };
      pingT -= dt; if (pingT <= 0) { pingT = 1; send({ t: 'p', n: performance.now(), g: Math.round(lag * 1000) }); }
      if (shell.state.role === 'host') { const to = target(); lag = lag === 0 ? to : lag + Math.max(-dt * 0.1, Math.min(dt * 0.1, to - lag)); }
      if (!walking && !mine) { mine = true; send({ t: 'ready', n: shell.state.seed }); }
      if (mine && !go) { waited += dt; if (peer || waited > NET.waitMax) { go = true; told = false; } }
      // beim Start einmal sagen, welchen Ausgleich der Gastgeber trägt
      if (go && !told && rtt !== null && ownLag() > 0) { told = true; shell.toast('Ping ' + Math.round(rtt * 1000) + ' ms · Ausgleich beim Gastgeber ' + ownLag() + ' ms'); }
      const hint = mine && !go;
      if (hint !== hinted) { hinted = hint; shell.hint(hint ? 'Warte auf deinen Gegner …' : ''); }
      return { waiting: !go };
    },
    // Zusatz für die Zeile unter dem Spielstand
    status: () => (online() && rtt !== null ? ' · ' + Math.round(rtt * 1000) + ' ms' : ''),
    // Ergebnis eines Kampfs in die Serie zählen (Gewinner 0, 1 oder -1)
    result(win) { if (win === 0 || win === 1) series[win]++; },
    seriesText(names) {
      const done = series[0] >= NET.wins ? 0 : series[1] >= NET.wins ? 1 : -1;
      return 'Serie bis ' + NET.wins + ' Siege: ' + names[0] + ' ' + series[0] + ' : ' + series[1] + ' ' + names[1] + (done >= 0 ? '\n🏆 Die Serie geht an ' + names[done] + '!' : '');
    },
    info: () => ({ rtt, lag: +lag.toFixed(3), peerLag, mine, peer, go, series: series.slice() })
  };
}
