// Alle Töne werden im Browser erzeugt (keine Dateien).
export function createAudio() {
  let ctx = null, master = null, noise = null, on = true;
  try { on = localStorage.getItem('penalty_sound') !== '0'; } catch (e) { /* ok */ }
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
    kick: (p = 0.7) => { tone(150 + p * 60, 45, 0.5 + p * 0.4, 0.16); hiss(1800, 0.8, 0.22 + p * 0.2, 0.06); },
    step: () => hiss(420, 1.2, 0.09, 0.05),
    net: () => { hiss(3200, 0.5, 0.35, 0.45, 'highpass', 0, 0.02); tone(90, 60, 0.2, 0.2); },
    post: () => { [880, 1327, 2093, 2790].forEach((f, i) => tone(f, f * 0.985, 0.32 / (i + 1), 0.7, 'triangle')); hiss(2500, 2, 0.25, 0.05); },
    save: () => { hiss(900, 0.9, 0.6, 0.11); tone(220, 90, 0.35, 0.12, 'triangle'); },
    cheer: () => { hiss(760, 0.5, 0.45, 1.5, 'bandpass', 0, 0.18); hiss(1500, 0.7, 0.2, 1.1, 'bandpass', 0.06, 0.25); [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.12, 0.28, 'triangle', 0.05 + i * 0.09)); },
    groan: () => { hiss(340, 0.9, 0.35, 0.9, 'bandpass', 0, 0.2); tone(220, 130, 0.12, 0.7, 'sawtooth'); },
    whistle: () => { tone(2350, 2300, 0.14, 0.18, 'square'); tone(2350, 2250, 0.14, 0.32, 'square', 0.24); },
    ui: () => tone(660, 880, 0.12, 0.07, 'triangle'),
    msg: () => { tone(880, 880, 0.1, 0.06, 'sine'); tone(1180, 1180, 0.1, 0.09, 'sine', 0.07); }
  };
  return {
    play(name, arg) { if (!SOUNDS[name] || !ready()) return; log.push(name); if (log.length > 60) log.shift(); try { SOUNDS[name](arg); } catch (e) { /* ohne Ton weiter */ } },
    excite() { /* bewusst ohne Dauergeräusch: Töne gibt es nur bei Ereignissen */ },
    toggle() { on = !on; try { localStorage.setItem('penalty_sound', on ? '1' : '0'); } catch (e) { /* ok */ } if (ctx) master.gain.value = on ? 0.7 : 0; if (on) ready(); return on; },
    enabled: () => on, log, unlock: ready,
    vibrate(pattern) { if (on && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* ok */ } } }
  };
}
