# Orbitron Engine-Labor (Testseite, getrennt von Orbitron)

Stockfish 10 als WebAssembly gegen die bisher in Orbitron genutzte asm.js-Fassung.

## Starten
```
node server.js
```
Dann http://127.0.0.1:8091 im Browser öffnen (Strg+C beendet den Server). Ein Doppelklick auf index.html reicht nicht: WebAssembly braucht einen Server.

## Reiter
- **Analyse:** Brett, laufende Analyse (1, 3 oder 5 Linien), alte und neue Engine umschaltbar, FEN oder PGN laden.
- **Gesamtanalyse:** ganze Partie, jede Stellung einzeln. Profil „Wie Orbitron heute“ entspricht der Vollanalyse im Orbitron-Chat (Tiefe 14, höchstens 2,5 s, ein Arbeiter bei „Alt“). Parallele Arbeiter, Bewertungsverlauf, Urteile (Ungenau ab 0,1, Fehler ab 0,2, Patzer ab 0,3 Verlust an Gewinnchance, Skala wie Lichess), angenäherte Genauigkeit, Ergebnis als JSON mit den Feldnamen der Orbitron-Vollanalyse.
- **Vergleich:** Mattaufgaben und eigene Patzer, beide Engines mit gleicher Zeit, CSV.

## Messung (26.11.2026, Rechner mit 4 Threads, headless Chrome)
Morphy, Pariser Oper (34 Stellungen), Profil „Wie Orbitron heute“: alt 62,6 s bei mittlerer Tiefe 12,5, neu mit 3 Arbeitern 9,2 s bei Tiefe 14,0.

## Neu aufbauen und testen
```
node tools/setup.js
NODE_PATH=<puppeteer-core> node tests/engine-test.js
```
Farben und Schrift: `BRAND_EXTRA="E:/schach-meisger/ENGINE-TEST/index.html" node <orbitron>/scripts/sync-brand.mjs`.

Nur zum Üben und Analysieren, nie während einer laufenden Partie. Stockfish.js steht unter der GPL-3.0 (vendor/LICENSES.md).
