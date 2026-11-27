# Neon Bay (Projektkontext für Replit Agent und Claude Code)
Browser-Spiel ohne Build-Schritt; `node server.js`. Zuerst README.md lesen.
- Logik ohne Grafik und DOM: `src/world.js`, `src/vehicles.js`, `src/player.js`, `src/sim.js`, `src/camera.js`. Fester Takt 60 Hz, Zufall nur aus dem Startwert. Stellwerte in `src/config.js`.
- `src/kit/` ist eine für das Einzelspiel angepasste Kopie des Monolith-Baukastens (Hülle, Steuerung, Ton).
- Keine externen Dateien, keine Marken- oder Personennamen. Kein Dauergeräusch; Motor standardmäßig aus.
- Nach Änderungen `npm run update:sw`; neue Funktion = neuer Test. Aktueller Umfang: Phase 1 (Fahren und Stadt).
