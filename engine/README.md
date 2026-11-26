# Orbitron Engine-Labor (Testseite, getrennt von Orbitron)

Stockfish 10 als WebAssembly gegen die bisher in Orbitron genutzte asm.js-Fassung.

## Starten
```
node server.js
```
Dann http://127.0.0.1:8091 im Browser öffnen (Strg+C beendet den Server). Ein Doppelklick auf index.html reicht nicht: WebAssembly braucht einen Server.

## Reiter
- **Analyse:** Brett, laufende Analyse (1, 3 oder 5 Linien), alte und neue Engine umschaltbar, FEN oder PGN laden.
- **Stellung bauen:** Figuren vom Rand aufs Brett ziehen (Maus oder Finger), frei verschieben, vom Brett ziehen zum Entfernen; oder Figur antippen und Felder antippen, Radierer. Am Zug, Rochaderechte, FEN kopieren. Ungültige Stellungen werden erklärt, gültige sofort analysiert.
- **Gesamtanalyse:** ganze Partie, jede Stellung einzeln. Profil „Wie Orbitron heute“ entspricht der Vollanalyse im Orbitron-Chat (Tiefe 14, höchstens 2,5 s, ein Arbeiter bei „Alt“). Parallele Arbeiter, Bewertungsverlauf, Urteile (Ungenau ab 0,1, Fehler ab 0,2, Patzer ab 0,3 Verlust an Gewinnchance, Skala wie Lichess), angenäherte Genauigkeit, Ergebnis als JSON mit den Feldnamen der Orbitron-Vollanalyse.
- **Vergleich:** Mattaufgaben und eigene Patzer, beide Engines mit gleicher Zeit, CSV.

## Messung (26.11.2026, Rechner mit 4 Threads, headless Chrome)
Morphy, Pariser Oper (34 Stellungen), Profil „Wie Orbitron heute“: alt 62,6 s bei mittlerer Tiefe 12,5, neu mit 3 Arbeitern 9,2 s bei Tiefe 14,0.

## Analyse verstehen
- **Pfeile:** grün bester Zug, blau zweiter, grau dritter, rot der in einer analysierten Partie gespielte Fehler, gelb der nächste Zug in einer Variante. Abschaltbar oder nur der beste.
- **Varianten:** Zug in einer Linie antippen oder ▶, dann blättern, abspielen, übernehmen.
- **Zugliste** mit Vor und Zurück, Urteil zum eigenen Zug, Erklärung in Worten (Bewertung, bester Zug, Material, ungedeckte Figuren; regelbasiert, keine KI), Wendepunkte nach der Gesamtanalyse. Deutsche oder englische Notation.
- Diese Stockfish-Fassung reagiert auf „Stopp“ erst nach der laufenden Tiefe. Dauert das länger als 150 ms, springt eine vorgeladene zweite Engine ein.

## In Orbitron
Reiter „Analysebrett“ (auch `#/analysebrett`, Befehl `/engine`). Eigener Rahmen: Stellung bleibt beim Wechseln, die laufende Analyse pausiert, sobald das Fenster zu ist. Läuft im selben Orbitron-Fenster eine Duellpartie, ist das Analysebrett gesperrt (eine zweite, getrennt geöffnete Seite kann das nicht erkennen). Laufende Analyse höchstens 60 s je Stellung. Kopie nach Orbitron: index.html, data.js, img/, vendor/ nach `engine/`.

## Neu aufbauen und testen
```
node tools/setup.js
NODE_PATH=<puppeteer-core> node tests/engine-test.js
```
Farben und Schrift: `BRAND_EXTRA="E:/schach-meisger/ENGINE-TEST/index.html" node <orbitron>/scripts/sync-brand.mjs`.

Nur zum Üben und Analysieren, nie während einer laufenden Partie. Stockfish.js steht unter der GPL-3.0 (vendor/LICENSES.md).
