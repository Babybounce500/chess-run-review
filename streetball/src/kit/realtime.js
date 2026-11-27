// Echtzeit mit Gastgeber als Schiedsrichter.
// Der Gastgeber rechnet das Spiel im festen Takt (60 Hz) und schickt 20-mal je Sekunde den Zustand.
// Der Gast schickt nur seine Eingaben und zeigt die Zustände leicht verzögert und geglättet an.
//
// Das Spiel liefert ein Objekt "sim":
//   create(seed, { level })            -> state (reines JSON-Objekt)
//   step(state, [inputA, inputB], dt)  -> verändert state; Ereignisse mit emit(state, ...) melden
//   cpu(state, side, level, dt)        -> Eingabe des Computers
//   cleanInput(obj)                    -> geprüfte Eingabe (immer gültig, auch bei Unsinn)
//   pack(state) / unpack(data)         -> kompaktes JSON für das Netz und zurück (unpack gibt null bei Unsinn)
//   lerp(a, b, t)                      -> Zwischenzustand für die Anzeige
//   score(state) -> [a, b]     winner(state) -> null (läuft) | 0 | 1 | -1 (unentschieden)
export const STEP = 1 / 60;
const SEND_EVERY = 3, DELAY = 0.1, STALE = 0.6;

// Ereignisse (Töne, Effekte): fortlaufend nummeriert, die letzten 12 bleiben im Zustand
export function emit(state, type, data) { state.eventId = (state.eventId || 0) + 1; (state.events || (state.events = [])).push(Object.assign({ id: state.eventId, type }, data)); if (state.events.length > 12) state.events.shift(); }

export function createRealtime({ shell, sim, readInput, onEvent }) {
  let mode = 'off', state = null, prev = null, level = 'normal', acc = 0, tick = 0, seen = 0, ended = false;
  let remote = null, remoteQueue = [], remoteAge = 0;                       // Gastgeber
  let buffer = [], clock = null, sendT = 0, lastSent = '';                  // Gast
  const neutral = () => sim.cleanInput({});
  const copy = (s) => sim.unpack(JSON.parse(JSON.stringify(sim.pack(s))));

  function reset(m, seed, lv) {
    mode = m; level = lv || 'normal'; state = sim.create(seed >>> 0, { level }); prev = copy(state); acc = 0; tick = 0; seen = 0; ended = false;
    remote = neutral(); remoteQueue = []; remoteAge = 0; buffer = []; clock = null; sendT = 0; lastSent = '';
  }
  function events(s) { for (const e of s.events || []) if (e.id > seen) { seen = e.id; if (onEvent) onEvent(e, s); } }
  function finish(s) { const w = sim.winner(s); if (w === null || w === undefined || ended) return; ended = true; const sc = sim.score(s); shell.setScore(sc[0], sc[1]); setTimeout(() => { if (ended && shell.playing()) shell.end({ winner: w }); }, 1400); }

  shell.onGame((d) => {
    if (d.t === 'i' && mode === 'host') { const i = sim.cleanInput(d.in || {}); remoteQueue.push(i); if (remoteQueue.length > 8) remoteQueue.shift(); remoteAge = 0; }
    if (d.t === 's' && mode === 'guest' && Number.isInteger(d.n)) {
      if (buffer.length && d.n <= buffer[buffer.length - 1].n) return;
      const s = sim.unpack(d.s); if (!s) return;
      buffer.push({ n: d.n, s }); if (buffer.length > 30) buffer.shift();
    }
  });

  return {
    solo(seed, lv) { reset('solo', seed, lv); },
    online(role, seed) { reset(role === 'host' ? 'host' : 'guest', seed); },
    stop() { mode = 'off'; state = null; },
    mode: () => mode,
    state: () => state,
    // dt = vergangene Zeit seit dem letzten Bild. Ergebnis: Zustand zum Zeichnen (oder null)
    update(dt) {
      if (mode === 'off' || !state) return null;
      if (mode === 'guest') {
        sendT += dt; const mine = sim.cleanInput(readInput()), key = JSON.stringify(mine);
        if (key !== lastSent || sendT >= 1 / 20) { shell.send({ t: 'i', in: mine }); lastSent = key; sendT = 0; }
        if (!buffer.length) return state;
        const newest = (buffer[buffer.length - 1].n * STEP);
        if (clock === null || Math.abs(newest - DELAY - clock) > 0.4) clock = newest - DELAY;
        else clock += dt + (newest - DELAY - clock) * Math.min(1, dt * 2);           // sanft nachführen
        let a = buffer[0], b = buffer[0];
        for (let i = 0; i < buffer.length; i++) { if (buffer[i].n * STEP <= clock) { a = buffer[i]; b = buffer[i + 1] || buffer[i]; } }
        const span = (b.n - a.n) * STEP, t = span > 0 ? Math.max(0, Math.min(1, (clock - a.n * STEP) / span)) : 1;
        state = span > 0 ? sim.lerp(a.s, b.s, t) : a.s;
        events(a.s); const sc = sim.score(a.s); shell.setScore(sc[0], sc[1]); finish(a.s);
        return state;
      }
      if (shell.paused()) return state;
      acc = Math.min(0.25, acc + dt);                                                // nach Hängern nicht ewig aufholen
      while (acc >= STEP) {
        acc -= STEP;
        if (sim.winner(state) !== null && sim.winner(state) !== undefined) { acc = 0; break; }
        prev = copy(state);
        const mine = sim.cleanInput(readInput());
        let other;
        if (mode === 'solo') other = sim.cleanInput(sim.cpu(state, 1, level, STEP));
        else { remoteAge += STEP; if (remoteQueue.length) remote = remoteQueue.shift(); if (remoteAge > STALE) remote = neutral(); other = remote; }
        sim.step(state, [mine, other], STEP); tick++;
        events(state);
        if (mode === 'host' && (tick % SEND_EVERY === 0 || sim.winner(state) !== null)) shell.send({ t: 's', n: tick, s: sim.pack(state) });
      }
      const sc = sim.score(state); shell.setScore(sc[0], sc[1]); finish(state);
      // Gastgeber wiederholt den Endstand kurz, damit er sicher ankommt
      if (mode === 'host' && ended && (sendT += dt) > 0.25) { sendT = 0; shell.send({ t: 's', n: ++tick, s: sim.pack(state) }); }
      return sim.lerp(prev, state, Math.min(1, acc / STEP));
    }
  };
}
