# Shadow Boxer (Projektkontext für Replit Agent und Claude Code)
Browser-Spiel ohne Build-Schritt; `node server.js`. Zuerst README.md lesen.
- `src/sim.js` ohne Grafik und DOM, fester Takt, Zufall nur aus dem Startwert. Stellwerte in `src/config.js`.
- `src/kit/` ist der gemeinsame Baukasten. Hier abweichend: `realtime.js` nimmt `delay` und `sendEvery` an. Boxen-spezifisches Online in `src/online.js`.
- Keine externen Dateien, keine Marken- oder Personennamen. Nach Änderungen `npm run update:sw`; neue Funktion = neuer Test.
