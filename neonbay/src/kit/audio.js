// Alle Töne werden im Browser erzeugt (keine Dateien). Aus dem Monolith-Baukasten, für Neon Bay angepasst.
// Töne gibt es nur bei Ereignissen. Das Motorgeräusch ist abschaltbar und standardmäßig AUS.
export function createAudio(id = 'game') {
  let ctx = null, master = null, noise = null, motor = null, on = true, engineOn = false;
  try { on = localStorage.getItem(id + '_sound') !== '0'; engineOn = localStorage.getItem(id + '_engine') === '1'; } catch (e) { /* ok */ }
  const log = [];
  function ready() {
    if (!on) return false;
    try {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
        noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    } catch (e) { return false; }
  }
  function env(node, t, peak, attack, decay) { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay); node.connect(g); g.connect(master); }
  function tone(f0, f1, peak, dur, type = 'sine', delay = 0) { const t = ctx.currentTime + delay, o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); env(o, t, peak, 0.006, dur); o.start(t); o.stop(t + dur + 0.05); }
  function hiss(freq, q, peak, dur, type = 'bandpass', delay = 0, attack = 0.005) { const t = ctx.currentTime + delay, s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; s.connect(f); env(f, t, peak, attack, dur); s.start(t, Math.random()); s.stop(t + attack + dur + 0.05); }
  const SOUNDS = {
    door: () => { tone(190, 90, 0.35, 0.09, 'triangle'); hiss(900, 1, 0.25, 0.07); tone(140, 80, 0.3, 0.08, 'triangle', 0.13); },
    crash: (p = 8) => { const k = Math.min(1, p / 25); tone(130, 40, 0.25 + k * 0.6, 0.22); hiss(700 + k * 900, 0.6, 0.2 + k * 0.6, 0.15 + k * 0.25); if (k > 0.45) hiss(4200, 1.5, 0.2 * k, 0.35, 'highpass', 0.03); },
    screech: () => { hiss(2100, 7, 0.16, 0.42, 'bandpass', 0, 0.06); tone(980, 720, 0.035, 0.4, 'sawtooth'); },
    jump: () => tone(260, 470, 0.12, 0.12, 'sine'),
    land: () => hiss(260, 1, 0.2, 0.08),
    horn: () => { tone(392, 392, 0.2, 0.35, 'square'); tone(494, 494, 0.16, 0.35, 'square'); },
    ui: () => tone(660, 880, 0.12, 0.07, 'triangle')
  };
  function stopEngine() { if (!motor) return; const m = motor; motor = null; try { m.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04); m.a.stop(ctx.currentTime + 0.25); m.b.stop(ctx.currentTime + 0.25); } catch (e) { /* ok */ } }
  return {
    play(name, arg) { if (!SOUNDS[name] || !ready()) return; log.push(name); if (log.length > 60) log.shift(); try { SOUNDS[name](arg); } catch (e) { /* ohne Ton weiter */ } },
    // level: null = stumm, sonst 0..1 (Drehzahl)
    engine(level, load = 0) {
      if (level === null || !on || !engineOn || !ready()) return stopEngine();
      if (!motor) {
        const gain = ctx.createGain(), filter = ctx.createBiquadFilter(), a = ctx.createOscillator(), b = ctx.createOscillator();
        filter.type = 'lowpass'; filter.frequency.value = 420; gain.gain.value = 0.0001; a.type = 'sawtooth'; b.type = 'square'; a.connect(filter); b.connect(filter); filter.connect(gain); gain.connect(master); a.start(); b.start();
        motor = { gain, filter, a, b };
      }
      const f = 44 + level * 95, t = ctx.currentTime;
      motor.a.frequency.setTargetAtTime(f, t, 0.06); motor.b.frequency.setTargetAtTime(f * 0.502, t, 0.06);
      motor.filter.frequency.setTargetAtTime(300 + level * 700, t, 0.08); motor.gain.gain.setTargetAtTime(0.03 + load * 0.035 + level * 0.02, t, 0.08);
    },
    engineRunning: () => !!motor,
    engineEnabled: () => engineOn,
    toggleEngine() { engineOn = !engineOn; try { localStorage.setItem(id + '_engine', engineOn ? '1' : '0'); } catch (e) { /* ok */ } if (!engineOn) stopEngine(); return engineOn; },
    toggle() { on = !on; try { localStorage.setItem(id + '_sound', on ? '1' : '0'); } catch (e) { /* ok */ } if (!on) stopEngine(); if (ctx) master.gain.value = on ? 0.7 : 0; if (on) ready(); return on; },
    enabled: () => on, log, unlock: ready,
    vibrate(pattern) { if (on && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* ok */ } } }
  };
}
