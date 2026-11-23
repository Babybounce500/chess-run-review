/* Orbitron Backup: Fortschritt als Datei sichern und wieder laden. Alles, was Orbitron im Browser speichert (Schluessel mit Praefix "orbitron_"),
 * also Tagesplan, Wochenfokus, Scanner-Bestwerte, Auto-Coach-Aufgaben, Benutzername. Nichts verlaesst deinen Rechner.
 */
(function () {
  'use strict';
  const K = window.OrbitronGameCore; if (!K) return;
  let kit = null;
  function ready(fn) { if (window.OrbitronGame && window.OrbitronGame._kit) { kit = window.OrbitronGame._kit; fn(); } else document.addEventListener('orbitron-game-ready', () => { kit = window.OrbitronGame._kit; fn(); }, { once: true }); }
  const PREFIX = 'orbitron_', VERSION = 1;
  function collect() {
    const keys = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX)) keys[k] = localStorage.getItem(k); } } catch (e) { /* Speicher gesperrt */ }
    return { app: 'orbitron', version: VERSION, created: new Date().toISOString(), keys };
  }
  function check(obj) {
    if (!obj || typeof obj !== 'object' || obj.app !== 'orbitron' || obj.version !== VERSION || !obj.keys || typeof obj.keys !== 'object') return 'Das ist keine Orbitron-Sicherung (oder eine andere Version).';
    for (const [k, v] of Object.entries(obj.keys)) if (!k.startsWith(PREFIX) || typeof v !== 'string') return 'Die Sicherung enthält ungültige Einträge.';
    return null;
  }
  function restore(obj) {
    const err = check(obj); if (err) return { ok: false, err }; let n = 0;
    try { for (const [k, v] of Object.entries(obj.keys)) { localStorage.setItem(k, v); n++; } } catch (e) { return { ok: false, err: 'Der Browser konnte nicht speichern (Speicher voll oder gesperrt).', n }; }
    return { ok: true, n };
  }
  function summary(obj) {
    const ks = Object.keys(obj.keys); const size = ks.reduce((a, k) => a + k.length + obj.keys[k].length, 0); const has = (p) => ks.some((k) => k.includes(p));
    return { n: ks.length, kb: Math.max(1, Math.round(size / 1024)), daily: has('daily'), live: has('live'), focus: has('focus'), scan: has('scan') };
  }
  function openBackup() {
    const card = kit.newCard(); const cur = collect(); const sm = summary(cur);
    card.innerHTML = `<div class="og-title"><i class="bi bi-archive"></i> Sichern und Wiederherstellen <span class="og-badge">${sm.n} Einträge, ${sm.kb} KB</span></div>
      <div class="og-note og-desc">Dein Fortschritt liegt nur in diesem Browser: Tagesplan, Wiederholungsplan, Wochenfokus, Scanner-Bestwerte und die Aufgaben aus dem Auto-Coach. Mit der Sicherung kannst du auf ein anderes Gerät oder einen anderen Browser wechseln, ohne etwas zu verlieren. Die Datei bleibt auf deinem Rechner und enthält auch deinen Chess.com-Namen, gib sie also nicht weiter.</div>
      <div class="og-row"><button class="og-btn primary" data-save><i class="bi bi-download"></i> Als Datei sichern</button><label class="og-btn" style="cursor:pointer"><i class="bi bi-upload"></i> Aus Datei laden<input type="file" accept=".json,application/json" data-file style="display:none"></label></div>
      <div class="og-say" data-say><b>Bereit</b><span class="og-sub">Aktuell gespeichert: Tagesplan ${sm.daily ? 'ja' : 'nein'}, Auto-Coach ${sm.live ? 'ja' : 'nein'}, Wochenfokus ${sm.focus ? 'ja' : 'nein'}, Scanner ${sm.scan ? 'ja' : 'nein'}.</span></div>`;
    const q = (s) => card.querySelector(s); const say = (a, b) => { q('[data-say]').innerHTML = `<b>${kit.esc(a)}</b>${b ? `<span class="og-sub">${kit.esc(b)}</span>` : ''}`; };
    q('[data-save]').onclick = () => {
      const o = collect(); const name = 'orbitron-sicherung-' + new Date().toISOString().slice(0, 10) + '.json';
      try { const blob = new Blob([JSON.stringify(o)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); say('Gesichert', `${Object.keys(o.keys).length} Einträge in ${name} gespeichert (Download-Ordner).`); } catch (e) { say('Speichern nicht möglich', 'Der Browser hat den Download blockiert.'); }
    };
    q('[data-file]').onchange = (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader();
      r.onload = () => { let o = null; try { o = JSON.parse(String(r.result)); } catch (x) { say('Datei nicht lesbar', 'Das ist keine gültige JSON-Datei.'); return; } const s = restore(o); if (!s.ok) { say('Nicht geladen', s.err); return; } card.__backup.last = s; say('Wiederhergestellt', `${s.n} Einträge geladen. Lade die Seite neu (Strg+R), damit alles übernommen wird.`); };
      r.readAsText(f);
    };
    card.__backup = { collect, restore, last: null }; kit.addCard(card); return card;
  }
  function match(t) {
    if (!t) return null; const s = t.toLowerCase();
    if (/^[/](sicherung|backup|sichern)\b|^sicherung\b/.test(s)) return { run: openBackup };
    return null;
  }
  ready(() => { window.OrbitronBackup = { openBackup, collect, restore, check, summary, match, version: '1.0' }; });
})();
