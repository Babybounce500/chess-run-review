# Schach-Run-Review (DomvsAvrea)

Stockfish-Analyse eigener Chess.com-Partien mit Bericht, Lernviewer und Trainingsmaterial. Alles auf Deutsch.

- **Bericht:** https://babybounce500.github.io/chess-run-review/
- **Viewer** (Musterpartien, Matt & Taktik, Konterspiel, Computer-Turnier, Tal, Bauernsturm): https://babybounce500.github.io/chess-run-review/musterpartien/
- Direktlinks im Viewer: `#turnier`, `#mate`, `#konter`, `#tal`, `#games`.

**Runs im Detail** (Sessions, eine Zeile pro Partie): [docs/RUNS.md](docs/RUNS.md) · **Elo-Sprung vom 05.11.:** [docs/ELO-SPRUNG-05-11.md](docs/ELO-SPRUNG-05-11.md) · **Finale (1300):** [docs/FINALRUN-1300.md](docs/FINALRUN-1300.md) · **Chess.com gesamt (3846 Partien):** [docs/CHESSCOM-GESAMT.md](docs/CHESSCOM-GESAMT.md)

## Datenbasis

| | |
|---|---|
| Partien | **1164** (Chess.com-PGN-Exporte, 23.09.–05.11.2026) |
| Bilanz | 608 Siege – 40 Remis – 516 Niederlagen (52.2 % Siege) |
| Zeitkontrollen | Bullet 60 s: 476 Partien (56.5 % Siege) · Blitz 5+0: 688 Partien (49.3 % Siege) |
| Rating (Tageswerte) | Blitz 1269 → 1434 · Bullet 712 → 1303 |
| Analysierte eigene Züge | 39598 |

Gegnernamen und Chess.com-Links werden nicht veröffentlicht.

## Wie die Analyse entstanden ist

1. **Parsen:** Jede Partie wird mit `chess.js` geladen und Zug für Zug nachgespielt.
2. **Bewertung:** Stockfish 19 (Lite-Netz, als WebAssembly unter Node.js, 1 Thread) bewertet jede Stellung. Die Bewertung wird aus der Sicht des Spielers (Weiß/Schwarz) in Centibauern (cp) umgerechnet, Matt als ±(10000 − Matt in n).
3. **Fehlerklassen** (Verlust gegenüber dem Bestzug der Engine): **Patzer ≥ 300 cp**, **grober Fehler ≥ 100 cp**, **kleiner Fehler ≥ 50 cp**.
4. **Phasen:** Eröffnung bis Zug 10, Endspiel ab höchstens 6 Figuren (ohne Könige und Bauern), dazwischen Mittelspiel.
5. **Eröffnungsnamen:** aus der Eröffnungsdatenbank von lichess (lichess-org/chess-openings, CC0), längster passender Zugfolgen-Präfix. Familien mit weniger als 12 Partien werden nicht gewertet.
6. **Aggregation** und Bericht werden mit eigenen Node.js-Skripten erzeugt (nicht im Repo, siehe „Reproduzierbarkeit“).

### Analysechargen (unterschiedliche Tiefe!)

| Charge | Partien | Tiefe |
|---|---|---|
| 1 | 200 (erste Datei) | 13 |
| 2 | 799 (zweite Datei) | 11 |
| 3 | 17 Live-Partien vom 04.11. | 14–18 |
| 4 | 9 Bullet-Partien vom 04.11. | 14 |
| 5 | 5 Live-Partien vom 05.11. | 14–18 |

Die Werte sind deshalb **nicht exakt vergleichbar**: Bei geringerer Tiefe schwanken einzelne Verlustwerte. Für die Gesamtbilanz ist das unkritisch, für einzelne Partien kann ein höherer Wert der Engine-Variante eine andere Bewertung ergeben.

## Wichtige Definitionen (Bericht und Viewer)

- **Verlorene Stellung:** Die Engine bewertet die Partie irgendwann mit ≤ −300 cp aus deiner Sicht. Aktuell 849 Partien, davon 342 gewonnen (40 %), 24 remis, 483 verloren. Mit Remis 43 % gerettet.
- **Gegnerfehler bestraft:** Der Gegner verschlechtert seine Stellung um ≥ 200 cp, du stehst danach ≥ +300 und spielst einen Zug mit höchstens 50 cp Verlust. Quote: 917 von 1988.
- **Vorteil verspielt:** Eigener Vorteil ≥ +300 sinkt durch einen eigenen Zug auf unter +100 (642-mal).
- **Verpasstes Matt / zugelassenes Matt:** Die Engine sieht Matt in n Zügen für dich bzw. gegen dich und der gespielte Zug lässt es zu bzw. nicht aus (223 bzw. 500).
- **Brillanz-Kandidat (eigene Heuristik, kein offizielles Chess.com-Urteil):** Engine-Bestzug (≤ 15 cp Verlust), mindestens 2 Punkte Material geopfert, danach nicht schlechter als −50 cp, vorher nicht klar gewonnen. Viele Königsopfer sind Fehlalarme.
- **Schlüsselzug „einziger Zug“ (Konter-Tab):** Du stehst schlechter, spielst den Bestzug, und der zweitbeste Zug ist laut Engine (zwei Varianten, Tiefe 14) mindestens 200 cp schlechter.

## Weitere Inhalte im Viewer

| Bereich | Inhalt | Methode |
|---|---|---|
| Musterpartien | 17 Partien zu deinen Eröffnungen | Stockfish 19 (WASM, Tiefe 13) gegen sich selbst, Eröffnung vorgegeben |
| Engine-Duelle | 12 Partien | Stockfish 19 (nativ, offizielles Release) gegen Lc0 0.32.1 (Netz t1-256x10, CPU) und Berserk 14, 2 s/Zug |
| Computer-Turnier | 9 Teilnehmer, 36 Partien, Stichkampf | jeder gegen jeden, 0,6 s/Zug; Stockfish 19 (voll, 2400, 2000, 1600), Lc0, Berserk 14, Maia 1100/1500/1900 (Lc0, 1 Knoten) |
| Matt & Taktik | 11 Mattbilder, 4 Taktik-Muster, 14 eigene Matts, 9 verpasste Matts | Jede Stellung von Stockfish (Tiefe 20–22) bestätigt, fehlerhafte Beispiele verworfen |
| Konterspiel | Profil, 12 „einziger Zug“-Stellungen, Eröffnungs-Konterschläge | siehe Definitionen |
| Michail Tal | 20 Partien mit Schlüsselstellen | PGN Mentor, Stockfish Tiefe 16; Lizenz der Quelldatei ungeklärt (siehe unten) |
| Claude gegen Stockfish | 1 Partie | Stockfish begrenzt auf 1500 Elo, 0,5 s/Zug; Züge von Claude ohne Engine-Hilfe |
| Bauernsturm | deine Caro-Kann-Partie + 8 Stockfish-Partien | Stockfish 19 gegen sich selbst, 0,8 s/Zug |

## Quellen und Rechte

- **Eigene Partien:** Chess.com-PGN-Exporte des eigenen Kontos.
- **Tal-Partien:** PGN Mentor (`pgnmentor.com/players/Tal.zip`), abgeglichen mit zwei Sammlungen auf chessgames.com (nur Gegner, Jahr, Ergebnis, Zugzahl). Auf PGN Mentor wurde **keine ausdrückliche Weitergabeerlaubnis** gefunden („completely free“, Fußzeile © 64 Squares). Partiezüge sind Fakten, die Sammlung ist aber nicht lizenziert: Bei Zweifeln den Betreiber fragen oder den Tal-Tab entfernen.
- **GothamChess-Partien** (Chess.com Published-Data API) sind **nicht veröffentlicht**: Das Chess.com User Agreement verbietet laut Prüfung das Vervielfältigen und Verbreiten ohne Erlaubnis. Sie existieren nur lokal.
- **Engines:** Stockfish, Lc0, Berserk und Maia sind Open-Source-Projekte; die jeweiligen Lizenzen gelten. Eröffnungsdaten: lichess-org/chess-openings (CC0).

## Einschränkungen

- Keine Uhrdaten in den Massendaten: **Zeitnot kann nicht belegt werden** (nur in einzelnen Live-Partien mit Uhrzeiten).
- Remis durch „Zeit + zu wenig Material“: Wer geflaggt hat, geht aus dem PGN nicht hervor. Die Aussage „vermutlich verschenkte Siege“ (12 von 18) ist eine Ableitung aus der letzten Engine-Bewertung, nicht belegt.
- Die Turnier- und Duell-Ergebnisse sind wegen sehr kurzer Bedenkzeit (0,6–2 s) auf einem 2-Kern-Laptop nur grobe Rangfolgen. Lc0 lief mit einem kleinen Netz auf der CPU und ist dort deutlich schwächer als in Turnieren.
- Brillanz-, Matt- und Opfererkennung sind eigene Näherungen.
- Kleine Stichproben (Eröffnungen mit < 30 Partien) sind nicht belastbar.
- Eröffnungsnamen folgen der Datenbank, nicht immer dem üblichen Sprachgebrauch (z. B. „Altindisch“ für 1.d4 d6 2.c4).

## Reproduzierbarkeit

Die Skripte liegen aktuell lokal (Pfade im Temp-Ordner) und sind nicht Teil dieses Repos. Der Ablauf: PGN → `chess.js` → UCI mit Stockfish 19 → JSON pro Partie → Aggregation (Fehler, Phasen, Eröffnungen, Matts, Rettungen) → statisches HTML (eine Datei, ohne externe Abhängigkeiten). Wenn du die Skripte brauchst, kann ich sie bereinigt ins Repo legen.

## Änderungsprotokoll

Siehe [CHANGELOG.md](CHANGELOG.md).
