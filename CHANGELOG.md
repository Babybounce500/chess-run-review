# Änderungsprotokoll

## 2026-11-08 (Chess.com-Gesamtarchiv)
- **Neu: [docs/CHESSCOM-GESAMT.md](docs/CHESSCOM-GESAMT.md):** alle öffentlichen Live-Partien von Chess.com (3846, 19.08.2023 bis 08.11.2026) als Zusammenfassung: Bilanz, Rating je Zeitklasse, Monatsübersicht, Endarten, häufigste Eröffnungen. Gegnernamen und Links sind nicht enthalten.
- **Bericht und Viewer auf alle Partien ab 10.08.2026 erweitert:** Die Stockfish-Analyse (Tiefe 12) der bisher fehlenden 1874 Partien wurde mit der bisherigen Auswertung zusammengeführt. Grundlage sind jetzt **3038 Partien**, 1503–117–1418, vom 10.08. bis 08.11.2026. Die Tiefe der neu hinzugekommenen Partien (12) ist etwas geringer als bei den früheren (13 bis 14), Einzelwerte können deshalb um wenige Zehntel abweichen.

## 2026-11-06 (Korrektur)
- **Mattbild-Zuordnung im Finale korrigiert:** Die erste Fassung von [docs/FINALRUN-1300.md](docs/FINALRUN-1300.md) hatte bei der Mattbild-Erkennung die Position vor dem Mattzug ausgewertet und damit den falschen König angesehen. Richtig sind 6 Grundreihenmatts mit der Dame und 1 Damenmatt (Partie 17), nicht 5 und 2.

## 2026-11-05 (sechste Aktualisierung: Finale, 1300)
- **Teil 5 bis 7 vom 05.11.** eingerechnet: Teil 5 (50 Partien, 28–1–21, Header 1100 → 1150), Teil 6 (13 Partien, 10–0–3, 1158 → 1206) und das **Finale** (20 Partien, 14–0–6, **1249 → 1303**). Die Teile 5 und 6 waren zuvor nur im Chat ausgewertet und werden hier erstmals dokumentiert.
- **Neu: [docs/FINALRUN-1300.md](docs/FINALRUN-1300.md):** Auswertung des Finales mit Schwerpunkt auf den 7 Matt-Siegen (alle mit der Dame, 6× Grundreihe).
- [docs/ELO-SPRUNG-05-11.md](docs/ELO-SPRUNG-05-11.md) und [docs/RUNS.md](docs/RUNS.md) auf alle sieben Teile erweitert.
- Jetzt **3038 Partien**, 1503–117–1418.

## 2026-11-05 (fünfte Aktualisierung)
- **Bullet-Run Teil 4 vom 05.11.** (10 Partien, 6–0–4, Rating laut Header 1078 → 1101, über 1100) eingerechnet und in [docs/RUNS.md](docs/RUNS.md) dokumentiert.
- **Neu: [docs/ELO-SPRUNG-05-11.md](docs/ELO-SPRUNG-05-11.md):** Dokumentation des Rating-Sprungs vom 05.11. (51 Bullet-Partien, 33–1–17, Header-Rating 979 → 1101) mit Verlaufsgrafik.
- Jetzt **3038 Partien**, 1503–117–1418.

## 2026-11-05 (vierte Aktualisierung)
- **Bullet-Run Teil 3 vom 05.11.** (23 Partien, 13–1–9, Rating laut Header 1045 → 1086, **Höchstwert 1094**, neuer Bestwert) eingerechnet und in [docs/RUNS.md](docs/RUNS.md) dokumentiert.
- Damals 1071 Partien.

## 2026-11-05 (dritte Aktualisierung)
- **Bullet-Run Teil 2 vom 05.11.** (11 Partien, 8–0–3, Rating laut Header 1021 → 1053, Höchstwert 1053) eingerechnet und in [docs/RUNS.md](docs/RUNS.md) dokumentiert (Run vom 05.11. jetzt in zwei Teilen).
- Damals 1048 Partien.

## 2026-11-05 (zweite Aktualisierung)
- **Bullet-Run vom 05.11.** (7 Partien, 6–0–1, Rating laut Header 979 → 1012, Höchstwert 1020) eingerechnet und in [docs/RUNS.md](docs/RUNS.md) dokumentiert; dort auch der Run vom 04.11.
- Damals 1037 Partien.

## 2026-11-05
- Fünf neue Live-Partien eingerechnet (damals 1030 Partien). Zwei Siege durch Gegnerfehler bzw. Zeit, ein Remis durch Timeout gegen ungenügendes Material, ein Matt nach Springeropfer und ein Remis durch Patt aus verlorener Stellung (Matt in 4 für den Gegner).
- Remis-Aufteilung berechnet statt fest eingetragen: Patt 22, Stellungswiederholung 35, Zeit + zu wenig Material 47, zu wenig Material 2.
- Dokumentation (README, dieses Protokoll) ergänzt.

## 2026-11-04
- **Erstanalyse** von 200, dann 999 Partien; Bericht erstellt und über GitHub Pages veröffentlicht.
- **Musterpartien-Viewer:** 17 Stockfish-Partien, Eröffnungs-Check, 28 Lehrpositionen, Mittelspiel-Regeln. Brett-Darstellung korrigiert (feste Zeilenhöhe, Text-Glyphen).
- **Matt & Taktik:** 11 Mattbilder und 4 Taktik-Muster (Stockfish-geprüft), eigene und verpasste Matts. Zwei Beispiele (Philidor, Bauerngabel) entfernt, weil sie nicht belegbar waren.
- **Konterspiel, Engine-Duelle** (Stockfish 19 gegen Lc0/Berserk), **Michail Tal** (20 Partien), **Computer-Turnier** (9 Engines, 36 Partien, Stichkampf: Stockfish 19 gewinnt), **Bauernsturm** (9 Partien), **Claude gegen Stockfish**.
- 26 neue Partien (17 Live-Partien, 9 Bullet) eingerechnet: 1025 Partien; feste Zahlen im Bericht und Viewer durch berechnete ersetzt; Rating-Endwerte korrigiert (Bullet 1003).
- GothamChess-Daten wurden beschafft, aber **nicht veröffentlicht** (Nutzungsbedingungen).

### Korrekturen gegenüber früheren Aussagen
- Duelle Stockfish gegen Lc0: Stockfish gewann alle 6 Partien (zuerst fälschlich als „Lc0 gewinnt 2“ berichtet, Farben verwechselt).
- Tageszeit: Nur 23 Uhr UTC ist deutlich schwächer (36 %), nicht „ab 22 Uhr“.
- Remis-Aufteilung: 7 Wiederholungen und 2 ungenügendes Material (nicht 8 und 1).
- Bullet-Rating: Der Bericht zeigte zunächst 995/970 statt des tatsächlichen Endwerts 1003.
