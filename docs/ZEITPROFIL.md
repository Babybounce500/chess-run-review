# Zeitprofil: wie du deine Bedenkzeit einsetzt

Grundlage: **1971 Blitzpartien (5 Minuten)** vom 10.08. bis 08.11.2026 mit Uhrzeiten aus dem Chess.com-Archiv. Für 1971 davon liegt auch die Stockfish-Auswertung vor. Bullet ist am Ende kurz behandelt, weil es für dich Geschwindigkeitstraining ist.

## Wie viel Zeit pro Zug

| Phase | Deine Züge | Ø Sekunden | Median | Züge über 15 s |
|---|---|---|---|---|
| Züge 1–10 | 19510 | 2,6 | 1,5 | 1,4 % |
| Züge 11–20 | 18232 | 6,5 | 4,4 | 8,7 % |
| Züge 21–30 | 14898 | 8,2 | 5,7 | 14,6 % |
| ab Zug 31 | 19956 | 4,4 | 2,5 | 4,9 % |

- Im Schnitt nutzt du **192,2 von 300 Sekunden** pro Partie, davon **25,5 Sekunden** in den ersten 10 Zügen.
- Restzeit im Schnitt nach Zug 20: **209,6 s**, nach Zug 30: **128,8 s**, nach Zug 40: **75,9 s**.
- Lange Denkpausen (mindestens 15 s): 4998. Davon folgte direkt ein großer Fehler in 735 Fällen (14,7 %).

## Fehler und Bedenkzeit

Ein großer Fehler ist ein Zug, der mindestens 3 Bauerneinheiten gegenüber dem Bestzug kostet.

| Bedenkzeit für den Zug | Züge | große Fehler | Anteil |
|---|---|---|---|
| unter 1 s | 11200 | 359 | 3,2 % |
| 1–3 s | 24919 | 1331 | 5,3 % |
| 3–7 s | 19403 | 1377 | 7,1 % |
| 7–15 s | 12076 | 1182 | 9,8 % |
| über 15 s | 4998 | 735 | 14,7 % |

- Bei **weniger als 30 Sekunden Restzeit** machst du in 11,4 % der Züge einen großen Fehler (636 von 5602), bei mehr Restzeit in 6,5 % (4348 von 66994).

## Zeitverluste

- Von 925 verlorenen Blitzpartien gingen **265 auf Zeit verloren** (28,6 %).
- Bei 265 davon gibt es die Engine-Auswertung: In **91** (34,3 %) standest du am Ende nicht schlechter, in **58** (21,9 %) sogar klar besser (mindestens +1).

## Zeitvorsprung und Ergebnis

Zeitvorsprung = deine Restzeit minus die Restzeit des Gegners nach Zug 20.

| Zeitvorsprung nach Zug 20 | Partien | Punkte |
|---|---|---|
| über 60 s Rückstand | 70 | 37,1 % |
| 20–60 s Rückstand | 383 | 40,6 % |
| etwa gleich (±20 s) | 757 | 44,6 % |
| 20–60 s Vorsprung | 368 | 53,7 % |
| über 60 s Vorsprung | 116 | 67,2 % |

## Bullet kurz

In 1042 Bullet-Partien brauchst du im Schnitt **1,5 s pro Zug**. 16,3 % deiner Züge kommen in weniger als einer halben Sekunde (Premoves).

## Was daraus folgt

1. **Die Zeit geht in den Zügen 11 bis 30.** Dort liegt dein Durchschnitt bei 6,5 bis 8,2 Sekunden, und jeder siebte Zug zwischen 21 und 30 dauert über 15 Sekunden. In den ersten 10 Zügen brauchst du dagegen nur 25 Sekunden insgesamt.
2. **Ein Zeitvorsprung zahlt sich aus.** Bei über 60 Sekunden Vorsprung nach Zug 20 holst du 67 % der Punkte, bei über 60 Sekunden Rückstand nur 37 %.
3. **Zeitverluste sind oft keine Stellungsverluste.** Ein gutes Drittel der Zeitniederlagen lag nicht schlechter, jede fünfte sogar klar besser.
4. **Unter 30 Sekunden Restzeit** ist die Fehlerquote deutlich höher als davor.
5. Praktischer Hebel: ein festes Budget für die Mitte, zum Beispiel höchstens 10 Sekunden pro Zug bis Zug 30 außer bei einer echten Entscheidung.

## Einschränkungen

- Zeiten stammen aus den Uhrzeitangaben im PGN (auf Zehntelsekunden). Eine Latenz des Spiels (Lag) lässt sich daraus nicht erkennen.
- Die Tabelle „Fehler und Bedenkzeit“ zeigt keinen Ursache-Wirkung-Zusammenhang: Schwierige Stellungen brauchen länger und führen dort auch eher zu Fehlern. Längeres Nachdenken macht Fehler nicht wahrscheinlicher.
- Die Fehlererkennung nutzt Tiefe 12 bis 14. Die Aussagen sind Tendenzen, keine exakten Messwerte.
- Nur Partien ab dem 10.08.2026 und nur Standardschach.
