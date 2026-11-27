// Karriere: fünf erfundene Gegner mit eigenem Stil bis zum Titelkampf. Fortschritt bleibt auf dem Gerät.
export const OPPONENTS = [
  { key: 'k1', name: 'Rocco Brandt', nick: '„Der Neuling“', height: 178, reach: 180, weight: 74, record: '4 – 3', style: 'Wilder Schläger mit weiten Haken', tip: 'Ducke unter den Haken weg und kontere.' },
  { key: 'k2', name: 'Milan Kord', nick: '„Die Mauer“', height: 181, reach: 182, weight: 78, record: '11 – 2', style: 'Steht hinter hoher Deckung', tip: 'Er schlägt selten. Wechsle zwischen Kopf und Körper, Körpertreffer rauben ihm die Luft.' },
  { key: 'k3', name: 'Viktor Sand', nick: '„Sandsturm“', height: 183, reach: 187, weight: 76, record: '17 – 4', style: 'Schlagserien ohne Pause', tip: 'Deckung halten, bis ihm die Luft ausgeht, dann angreifen.' },
  { key: 'k4', name: 'Dario Venn', nick: '„Der Schatten“', height: 180, reach: 190, weight: 75, record: '21 – 1', style: 'Hält Abstand, weicht aus und kontert', tip: 'Haken gehen bei ihm oft ins Leere. Bleib bei Jab und Cross.' },
  { key: 'k5', name: 'Ilja Stahl', nick: '„Der Amboss“', height: 186, reach: 192, weight: 79, record: '29 – 1', style: 'Champion: harte Hände, geht zum Körper', tip: 'Tiefe Deckung gegen den Körper, nach der Parade zuschlagen.', title: true }
];
export const byKey = (key) => OPPONENTS.find((o) => o.key === key) || null;
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const add = (parent, tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; parent.appendChild(e); return e; };

export function createCareer({ store, onFight, onClose }) {
  const sheet = el('<section id="career" class="sheet" hidden><div class="card"><h2>Karriere</h2><p class="note" id="careerState"></p><ol id="careerList"></ol><button id="careerReset" class="ghost" type="button">Karriere neu beginnen</button><button id="careerBack" class="primary" type="button">Zurück</button></div></section>');
  document.body.appendChild(sheet);
  const progress = () => { const n = Math.floor(Number(store.get('career', '0'))); return Number.isFinite(n) ? Math.max(0, Math.min(OPPONENTS.length, n)) : 0; };
  let armed = false;
  function render() {
    const done = progress(), list = sheet.querySelector('#careerList'); list.textContent = '';
    sheet.querySelector('#careerState').textContent = done >= OPPONENTS.length ? '👑 Du bist Champion! Der Gürtel gehört dir.' : 'Kampf ' + (done + 1) + ' von ' + OPPONENTS.length + ' · besiege einen Gegner, um den nächsten freizuschalten.';
    OPPONENTS.forEach((o, i) => {
      const state = i < done ? 'beaten' : i === done ? 'open' : 'locked', li = add(list, 'li', state);
      const text = add(li, 'div'); add(text, 'b', '', (o.title ? '👑 ' : '') + o.name); add(text, 'span', '', o.nick + ' · ' + o.record);
      add(text, 'small', '', state === 'locked' ? 'Noch gesperrt' : o.style + '. Tipp: ' + o.tip);
      const b = add(li, 'button', state === 'open' ? 'primary' : 'ghost', state === 'locked' ? '🔒' : state === 'beaten' ? '✓ Nochmal' : 'Kämpfen'); b.type = 'button'; b.dataset.key = o.key; b.disabled = state === 'locked';
      b.onclick = () => { close(true); onFight(o.key); };
    });
    armed = false; sheet.querySelector('#careerReset').textContent = 'Karriere neu beginnen'; sheet.querySelector('#careerReset').hidden = done === 0;
  }
  function open() { render(); document.getElementById('menu').hidden = true; sheet.hidden = false; }
  function close(fighting) { sheet.hidden = true; if (!fighting) { document.getElementById('menu').hidden = false; if (onClose) onClose(); } }
  sheet.querySelector('#careerBack').onclick = () => close(false);
  // zweimal tippen, damit der Fortschritt nicht aus Versehen verschwindet
  sheet.querySelector('#careerReset').onclick = (e) => { if (!armed) { armed = true; e.target.textContent = 'Wirklich? Fortschritt löschen'; return; } store.set('career', '0'); render(); };
  return {
    open, progress, close: () => { sheet.hidden = true; },
    isOpen: () => !sheet.hidden,
    // Ergebnis eines Karrierekampfs. Rückgabe: Text fürs Abschlussbild und der nächste Gegner
    result(key, won) {
      const i = OPPONENTS.findIndex((o) => o.key === key); if (i < 0) return null;
      const done = progress(); let advanced = false;
      if (won && i === done) { store.set('career', String(done + 1)); advanced = true; }
      const now = progress(), next = advanced ? OPPONENTS[now] || null : null;
      const text = !won ? 'Karriere: Versuch es noch einmal. Tipp: ' + OPPONENTS[i].tip
        : advanced && OPPONENTS[i].title ? '👑 TITEL GEWONNEN! Du bist Champion.' : advanced ? 'Karriere: ' + next.name + ' wartet.' : 'Karriere: Diesen Gegner hattest du schon geschlagen.';
      return { text, next, champion: advanced && !!OPPONENTS[i].title };
    }
  };
}
