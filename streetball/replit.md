# Blacktop Hoops

1-gegen-1-Straßenbasketball als reine Webseite (three.js lokal, keine Abhängigkeiten zur Laufzeit).

- Start: `node server.js` (Port `$PORT` oder 5000). Veröffentlichung wie in `.replit` beschrieben.
- Spiellogik in `src/sim.js` ist deterministisch (60 Hz, Zufall nur aus dem Startwert, Zustand reines JSON).
- `src/kit/*` ist der gemeinsame Baukasten und wird nicht geändert.
- Nach Änderungen an Dateien: `npm run update:sw`, sonst bleibt der Offline-Speicher alt.
- Sprache der Oberfläche und Doku: Deutsch. Keine Marken- oder Personennamen.
- Tests: `node tests/sim-test.mjs`, `node tests/browser-test.mjs`, `node tests/online-test.mjs`.

Details zu Regeln und Steuerung stehen in `README.md`.
