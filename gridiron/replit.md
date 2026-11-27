# Neon Gridiron (Projektkontext für Replit Agent und Claude Code)

Browser-Spiel ohne Build-Schritt und ohne Laufzeit-Pakete; `node server.js` (Port aus PORT, sonst 5000). Zuerst README.md lesen.

- `src/sim.js` bleibt frei von Grafik und DOM; fester Takt, Zufall nur aus dem Startwert.
- Stellwerte nach `src/config.js`. `src/kit/` ist der gemeinsame Baukasten und wird hier nicht geändert.
- Keine externen Dateien nachladen. Keine Marken- oder Personennamen.
- Nachrichten vom Mitspieler prüfen, Text nie als HTML einsetzen.
- Nach Änderungen `npm run update:sw`; neue Funktion = neuer Test.
