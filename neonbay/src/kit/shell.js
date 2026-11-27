// Hülle für ein Einzelspieler-Spiel mit offener Welt: Menü, Anzeige, Pause, Einstellungen.
// Angepasste Fassung der Monolith-Hülle (ohne Online-Lobby, Chat, Punktestand).
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
export const QUALITY_ORDER = ['auto', 'low', 'medium', 'high'];
const QUALITY_NAMES = { auto: 'Auto', low: 'Niedrig', medium: 'Mittel', high: 'Hoch' };

export function createShell(cfg) {
  // cfg: { id, audio, help, onStart(fresh), onResume(), onMenu(), onPause(p), onRecover(), onQuality(q), hasSave() }
  const store = { get(k, d) { try { const v = localStorage.getItem(cfg.id + '_' + k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(cfg.id + '_' + k, v); return true; } catch (e) { return false; } }, del(k) { try { localStorage.removeItem(cfg.id + '_' + k); } catch (e) { /* ok */ } } };
  const S = { screen: 'menu', quality: store.get('quality', 'auto') };
  if (!QUALITY_ORDER.includes(S.quality)) S.quality = 'auto';
  const root = el('<div id="shell"></div>');
  root.innerHTML = `
  <div id="hud" hidden>
    <button id="mapBox" type="button" aria-label="Minikarte vergrößern"><canvas id="mini"></canvas></button>
    <div class="tools"><button id="btnSound" type="button" aria-label="Ton"></button><button id="btnPause" type="button" aria-label="Pause">⏸</button></div>
    <div id="gauge" hidden><div class="speed"><b id="kmh">0</b><small>km/h</small></div><div class="dmg"><small>Zustand</small><span><i id="health"></i></span></div></div>
    <p id="prompt" hidden></p>
    <p id="toast" hidden role="status"></p>
  </div>
  <section id="menu" class="sheet"><div class="card">
    <h1><span>NEON</span><em>BAY</em></h1><p class="sub">Eine Küstenstadt im Abendlicht. Fahren, laufen, entdecken.</p>
    <button id="btnPlay" class="primary" type="button">Losfahren</button>
    <button id="btnNew" class="ghost" type="button" hidden>Neu beginnen</button>
    <div class="settings"><button class="setSound" type="button"></button><button class="setEngine" type="button"></button><button class="setQuality" type="button"></button></div>
    <details><summary>So wird gespielt</summary><div class="help"></div></details>
    <p class="note">Phase 1: Fahren und Stadt. Der Spielstand bleibt nur auf diesem Gerät.</p>
  </div></section>
  <section id="pause" class="sheet dim" hidden><div class="card">
    <h2>Pause</h2>
    <button id="btnResume" class="primary" type="button">Weiter</button>
    <button id="btnRecover" class="friend" type="button">Auto herholen und reparieren</button>
    <div class="settings"><button class="setSound" type="button"></button><button class="setEngine" type="button"></button><button class="setQuality" type="button"></button></div>
    <details><summary>Steuerung</summary><div class="help"></div></details>
    <button id="btnQuit" class="ghost" type="button">Ins Menü</button>
  </div></section>`;
  document.body.appendChild(root);
  const $ = (id) => document.getElementById(id);
  for (const h of root.querySelectorAll('.help')) h.innerHTML = cfg.help || '';
  const audio = cfg.audio;

  function show(screen) {
    S.screen = screen;
    $('menu').hidden = screen !== 'menu'; $('pause').hidden = screen !== 'pause'; $('hud').hidden = screen === 'menu';
    document.body.dataset.screen = screen;
  }
  function labels() {
    const on = audio.enabled();
    $('btnSound').textContent = on ? '🔊' : '🔇'; $('btnSound').setAttribute('aria-pressed', String(on));
    for (const b of root.querySelectorAll('.setSound')) { b.textContent = 'Ton: ' + (on ? 'an' : 'aus'); b.setAttribute('aria-pressed', String(on)); }
    for (const b of root.querySelectorAll('.setEngine')) { b.textContent = 'Motor: ' + (audio.engineEnabled() ? 'an' : 'aus'); b.setAttribute('aria-pressed', String(audio.engineEnabled())); }
    for (const b of root.querySelectorAll('.setQuality')) b.textContent = 'Grafik: ' + QUALITY_NAMES[S.quality];
  }
  function menuButtons() { const saved = cfg.hasSave(); $('btnPlay').textContent = saved ? 'Weiterspielen' : 'Losfahren'; $('btnNew').hidden = !saved; $('btnNew').textContent = 'Neu beginnen'; delete $('btnNew').dataset.sure; }
  function toast(text) { const e = $('toast'); e.textContent = text; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { e.hidden = true; }, 2800); }
  function play(fresh) { audio.unlock(); show('play'); cfg.onStart(fresh); if (document.activeElement) document.activeElement.blur(); }
  function setPaused(p) {
    if (p) { if (S.screen !== 'play') return; show('pause'); } else { if (S.screen !== 'pause') return; show('play'); if (document.activeElement) document.activeElement.blur(); }
    cfg.onPause(p);
  }
  function toMenu() { cfg.onMenu(); show('menu'); menuButtons(); }

  $('btnPlay').onclick = () => play(false);
  $('btnNew').onclick = () => { const b = $('btnNew'); if (b.dataset.sure) return play(true); b.dataset.sure = '1'; b.textContent = 'Spielstand wirklich löschen?'; };
  $('btnPause').onclick = () => setPaused(S.screen !== 'pause'); $('btnResume').onclick = () => setPaused(false);
  $('btnRecover').onclick = () => { setPaused(false); cfg.onRecover(); };
  $('btnQuit').onclick = toMenu;
  const sound = () => { audio.toggle(); labels(); audio.play('ui'); };
  $('btnSound').onclick = () => { sound(); $('btnSound').blur(); };
  for (const b of root.querySelectorAll('.setSound')) b.onclick = sound;
  for (const b of root.querySelectorAll('.setEngine')) b.onclick = () => { audio.toggleEngine(); labels(); audio.play('ui'); };
  for (const b of root.querySelectorAll('.setQuality')) b.onclick = () => { S.quality = QUALITY_ORDER[(QUALITY_ORDER.indexOf(S.quality) + 1) % QUALITY_ORDER.length]; store.set('quality', S.quality); labels(); audio.play('ui'); cfg.onQuality(S.quality); };
  // große Karte schließt sich von selbst wieder, damit sie nichts dauerhaft verdeckt
  let mapTimer = 0;
  $('mapBox').onclick = () => { const big = $('mapBox').classList.toggle('big'); $('mapBox').blur(); clearTimeout(mapTimer); if (big) mapTimer = setTimeout(() => $('mapBox').classList.remove('big'), 7000); };
  // Esc schaltet um; P setzt hier nur fort (das Pausieren übernimmt die Steuerung)
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setPaused(S.screen !== 'pause'); else if (e.code === 'KeyP' && !e.repeat && S.screen === 'pause') setPaused(false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.screen === 'play') setPaused(true); });
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  show('menu'); labels();
  return {
    state: S, store, toast, show, setPaused, toMenu, $,
    prompt(text) { const e = $('prompt'); if (e.textContent !== (text || '')) e.textContent = text || ''; e.hidden = !text; },
    // erst aufrufen, wenn das Spiel fertig verdrahtet ist (hasSave greift auf die Hülle zu)
    start() { menuButtons(); const b = $('boot'); if (b) b.remove(); const qs = new URLSearchParams(location.search); if (window.isSecureContext && 'serviceWorker' in navigator && !qs.has('nosw')) navigator.serviceWorker.register('sw.js').catch(() => {}); },
    snapshot: () => ({ screen: S.screen, quality: S.quality })
  };
}
