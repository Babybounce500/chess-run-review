// Monolith Net: Direktverbindung zwischen zwei Browsern (WebRTC), ohne Server.
// Ablauf wie beim Orbitron-Duell: Gastgeber schickt einen Link, der Gast schickt einen Antwort-Code zurück.
// Das Spiel bekommt nur geprüfte Objekte mit einem Feld t.
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];

export function encode(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export function decode(s, game) {
  try {
    let t = String(s).trim(); const m = t.match(/#m=([A-Za-z0-9_-]+)/); if (m) t = m[1];
    t = t.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '=';
    const o = JSON.parse(decodeURIComponent(escape(atob(t))));
    return o && o.v === 1 && o.g === game && typeof o.sdp === 'string' && o.sdp.length < 20000 ? o : null;
  } catch (e) { return null; }
}
export const cleanText = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);

export async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function randomHex(n = 16) { return [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join(''); }

// rate: höchstens so viele Nachrichten je 5 s annehmen (Echtzeit braucht rund 200), size: größte Nachricht
export function createNet({ game, ice = ICE, rate = 500, size = 12000 }) {
  const on = {}; let pc = null, dc = null, timer = null, lastRx = 0, state = 'off';
  const emit = (name, arg) => { if (on[name]) on[name](arg); };
  const setState = (s) => { if (s === state) return; state = s; emit('state', s); };
  const stamps = [];
  function wire(ch) {
    dc = ch;
    const open = () => { if (dc !== ch || state === 'open') return; lastRx = Date.now(); setState('open'); };
    ch.onopen = open;
    ch.onclose = () => { if (dc === ch) setState('lost'); };
    ch.onmessage = (e) => {
      if (dc !== ch || typeof e.data !== 'string' || e.data.length > size) return;
      const now = Date.now(); while (stamps.length && now - stamps[0] > 5000) stamps.shift();
      if (stamps.length > rate) return; stamps.push(now);                       // Flut abweisen
      let d; try { d = JSON.parse(e.data); } catch (x) { return; }
      if (!d || typeof d.t !== 'string') return;
      lastRx = now; if (state === 'lost' && ch.readyState === 'open') setState('open');
      if (d.t === 'ping') return;
      if (d.t === 'leave') { setState('left'); close(); return; }
      emit('msg', d);
    };
    if (ch.readyState === 'open') open();
  }
  function peer() {
    const p = new RTCPeerConnection({ iceServers: ice });
    p.onconnectionstatechange = () => { if (p !== pc) return; if (p.connectionState === 'failed') setState('failed'); else if (p.connectionState === 'disconnected' && state === 'open') setState('lost'); };
    return p;
  }
  function gathered(p, ms = 4000) {
    return new Promise((res) => {
      if (p.iceGatheringState === 'complete') return res();
      const t = setTimeout(done, ms);
      function done() { clearTimeout(t); p.removeEventListener('icegatheringstatechange', chk); res(); }
      function chk() { if (p.iceGatheringState === 'complete') done(); }
      p.addEventListener('icegatheringstatechange', chk);
    });
  }
  function beat() { clearInterval(timer); timer = setInterval(() => { send({ t: 'ping' }); if (state === 'open' && Date.now() - lastRx > 12000) setState('lost'); }, 2000); }
  function send(o) { try { if (dc && dc.readyState === 'open') { dc.send(JSON.stringify(o)); return true; } } catch (e) { /* weiter */ } return false; }
  function close() { clearInterval(timer); const d = dc, p = pc; dc = null; pc = null; try { if (d) d.close(); } catch (e) { /* ok */ } try { if (p) p.close(); } catch (e) { /* ok */ } }

  return {
    on(name, fn) { on[name] = fn; return this; },
    state: () => state,
    async host(info) {
      close(); setState('wait'); pc = peer(); const p = pc; wire(p.createDataChannel(game)); beat();
      await p.setLocalDescription(await p.createOffer()); await gathered(p);
      if (pc !== p) throw new Error('abgebrochen');
      return encode({ v: 1, g: game, info, sdp: p.localDescription.sdp });
    },
    async accept(answerCode) {
      const a = decode(answerCode, game); if (!a || !pc) throw new Error('Das ist kein gültiger Antwort-Code.');
      setState('connecting'); await pc.setRemoteDescription({ type: 'answer', sdp: a.sdp });
    },
    async join(offer) {
      close(); setState('connecting'); pc = peer(); const p = pc; p.ondatachannel = (e) => { if (pc === p) wire(e.channel); }; beat();
      await p.setRemoteDescription({ type: 'offer', sdp: offer.sdp }); await p.setLocalDescription(await p.createAnswer()); await gathered(p);
      return encode({ v: 1, g: game, sdp: p.localDescription.sdp });
    },
    send,
    leave() {
      send({ t: 'leave' }); const d = dc, p = pc;
      // Nur die alte Verbindung schließen: wer sofort neu einlädt, hat inzwischen eine andere
      setTimeout(() => { if (dc === d && pc === p) { close(); setState('off'); } else { try { if (d) d.close(); } catch (e) { /* ok */ } try { if (p) p.close(); } catch (e) { /* ok */ } } }, 150);
    },
    drop() { close(); setState('lost'); }                          // für Tests
  };
}
