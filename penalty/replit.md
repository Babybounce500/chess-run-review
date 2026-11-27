# Cage Penalty (Projektkontext für Replit Agent und Claude Code)

Elfmeterschieß-Spiel als statische PWA ohne Build-Schritt und ohne Laufzeit-Pakete. `server.js` liefert die Dateien aus. Zuerst `README.md` lesen.

Befehle: `npm start`, `npm test`, `npm run test:browser`, `npm run test:online`, `npm run update:sw`.

## Regeln
- Antworten auf Deutsch.
- `src/sim.js` bleibt frei von Grafik und Browser-Funktionen; nur `+ - * /` und `Math.sqrt` (Online-Gleichstand).
- Stellwerte nach `src/config.js`.
- Keine externen Bibliotheken oder Dateien nachladen; three.js liegt in `vendor/`.
- Nachrichten vom Mitspieler immer prüfen, Text nie als HTML einsetzen.
- Keine Marken- oder Personennamen (Verbände, Spiele-Marken, Sportler).
- Neue Funktion = neuer Test, der sie bedient. Nach Änderungen `npm run update:sw`.
