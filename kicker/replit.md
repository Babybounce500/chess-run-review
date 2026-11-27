# Neon Kicker auf Replit

Reines Browser-Spiel ohne Abhängigkeiten und ohne Bauschritt.

- Start: `node server.js` (Port aus `PORT`, sonst 5000). `.replit` ist eingerichtet.
- Veröffentlichen: Deployment mit `node server.js`.
- `node_modules` wird nur für die Tests gebraucht und gehört nicht ins Projekt.
- Nach Änderungen an Spieldateien: `npm run update:sw` (aktualisiert den Offline-Speicher).
- `src/kit/` ist der gemeinsame Baukasten aller Spiele und wird hier nicht geändert.
- Alle Stellwerte stehen in `src/config.js`.
