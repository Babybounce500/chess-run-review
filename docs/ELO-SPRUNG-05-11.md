# Elo-Sprung vom 05.11.2026: von 979 auf 1101 in einem Tag

51 Bullet-Partien (60 s) an einem Tag. Das Bullet-Rating laut PGN-Header steigt von **979** (erste Partie des Tages) auf **1101** (letzte Partie): **+122**. Die 1100 wurde überschritten.

![Elo-Verlauf am 05.11.2026](elo-2026-11-05.svg)

*Grün = Sieg, Rot = Niederlage, Grau = Remis. Gestrichelt: 1000 und 1100.*

## Kernzahlen

| | |
|---|---|
| Partien | 51 (Bullet 60 s), in vier Runs |
| Bilanz | **33 Siege, 1 Remis, 17 Niederlagen** (65 % Siege) |
| Rating (Header) | 979 → 1101, Höchstwert 1101, Tagestief 979 |
| Gegner im Schnitt | 1052 Elo (Run 1: 993, Run 2: 1026, Run 3: 1072, Run 4: 1077) |
| Längste Siegesserie | 6 (endet nach Partie 6) |
| Längste Niederlagenserie | 2 |
| Stärkster Anstieg | +56 Rating in 10 Partien (Partie 12 bis 22) |
| Siege nach Art | 10× Matt, 9× Aufgabe, 14× Zeit |
| Niederlagen nach Art | 8× Matt, 9× Zeit |
| Patzerquote (≥ 300 cp) | du 9.2 % (147 von 1601 Zügen), Gegner 9.8 % (156 von 1593) |

## Die vier Runs des Tages

| Run | Partien | S–R–N | Rating Beginn → Ende (Header) | Höchstwert | Gegner Ø |
|---|---|---|---|---|---|
| Teil 1 | 7 | 6–0–1 | 979 → 1012 | 1020 | 993 |
| Teil 2 | 11 | 8–0–3 | 1021 → 1053 | 1053 | 1026 |
| Teil 3 | 23 | 13–1–9 | 1045 → 1086 | 1094 | 1072 |
| Teil 4 | 10 | 6–0–4 | 1078 → 1101 | 1101 | 1077 |

Details pro Partie siehe [RUNS.md](RUNS.md).

## Wie der Sprung zustande kam (aus den Daten)

1. **Es war kein sauberer Durchmarsch.** 17 von 51 Partien gingen verloren, die längste Niederlagenserie war 2. Der Anstieg kam durch eine gute Gesamtquote (65 % Siege), nicht durch eine einzelne Serie.
2. **Die Gegner wurden stärker, das Rating stieg trotzdem:** Von 993 (Run 1) auf 1077 im vierten Run, die Siegquote blieb hoch. Gegen stärkere Gegner zählt ein Sieg mehr.
3. **Gewonnen wurde über Zeit, Aufgaben und Matt:** 10× Matt, 9× Aufgabe, 14× Zeit. Die Engine sah dich in vielen Siegen lange schlechter stehen; der Gegner hat Matt zugelassen, aufgegeben oder die Uhr verloren (siehe Fazit in RUNS.md).
4. **Fehlerquote:** Deine Patzerquote (9.2 %) liegt leicht unter der deiner Gegner (9.8 %).
5. **Wiederkehrender Mattfehler:** Königszüge und Rochade (z. B. 27.Kh1, 8.O-O, 32.Kf1), siehe RUNS.md.

## Einschränkungen

- Das Rating ist der Wert im **Header vor der jeweiligen Partie**; das Rating nach der letzten Partie ist nicht bekannt. „+122“ misst also vom Stand vor der ersten bis vor der letzten Partie.
- Der Vergleich zum Vortag: Die letzte Partie vom 04.11. hatte laut Header 1003; zwischen den Tagen liegen Partien, die nicht in den Dateien sind (nach deiner Angabe Niederlagen). Gegenüber 1003 beträgt der Anstieg also +98, gegenüber dem Tagesbeginn (979) +122.
- Die fünf Live-Blitzpartien vom 05.11. (5+0) sind hier nicht enthalten.
- Keine Uhrzeiten in den Partien: Lag, Zeitnot und Premoves lassen sich nicht belegen.
- Die Chess.com-Trophäe, die du erwähnt hast, steht nicht in den Daten und ist hier nicht belegt.
