# Eleven Nights (Projektkontext für Replit Agent und Claude Code)
Browser-Spiel ohne Build-Schritt; `node server.js`. Zuerst README.md lesen.
- `src/sim.js` ohne Grafik und DOM, fester Takt, Zufall nur aus dem Startwert. Stellwerte in `src/config.js`.
- `src/kit/` ist der gemeinsame Baukasten und bleibt unverändert. Taste I und der Wisch auf PASS liegen in `src/main.js`.
- Keine externen Dateien, keine Marken- oder Personennamen, Töne nur bei Ereignissen. Nach Änderungen `npm run update:sw`; neue Funktion = neuer Test.
