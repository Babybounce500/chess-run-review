# Gewinnzüge und Comebacks

Grundlage: **3054 ausgewertete Partien**, davon **1511 Siege**. Gesucht sind deine starken Züge in gewonnenen Partien und die Wendepunkte, wenn du aus einer schlechten Stellung zurückkommst (Bewertung mindestens 3 Bauern schlechter). Alles stammt aus der Stockfish-Auswertung (Tiefe 11 bis 14), die Zuordnung zu Motiven ist eine eigene Näherung.

## Gewinnzüge

Ein Gewinnzug ist ein Zug in einer gewonnenen Partie, der (fast) der Bestzug war und eines von diesen Dingen bewirkt: ein Matt vorbereitet, ein Figurenopfer, ein Doppelangriff, Materialgewinn durch eine Taktik oder die konsequente Antwort auf einen Fehler des Gegners. Es sind **3109 solche Züge** in 1511 Siegen, im Schnitt 2,1 pro Sieg. Zusätzlich gab es in **653 Siegen (43,2 %)** eine Mattfolge, die die Engine schon vor dem Matt sah (zusammen 1355 Züge, die du dabei gespielt hast; sie sind unten getrennt aufgeführt).

| Art des Gewinnzugs | Anzahl | Anteil |
|---|---|---|
| Materialgewinn durch Schlagzug | 1372 | 44,1 % |
| Gegnerfehler konsequent bestraft | 669 | 21,5 % |
| Figurenopfer | 421 | 13,5 % |
| Gabel / Doppelangriff | 326 | 10,5 % |
| Materialgewinn durch ruhigen Zug / Drohung | 321 | 10,3 % |

### Mit welcher Figur
| Figur | Anzahl | Anteil |
|---|---|---|
| Dame | 762 | 24,5 % |
| Turm | 612 | 19,7 % |
| Springer | 584 | 18,8 % |
| Bauer | 527 | 17,0 % |
| Läufer | 468 | 15,1 % |
| König | 156 | 5,0 % |

An den Mattfolgen sind beteiligt:

| Figur in der Mattfolge | Anzahl | Anteil |
|---|---|---|
| Dame | 751 | 55,4 % |
| Turm | 350 | 25,8 % |
| Bauer | 113 | 8,3 % |
| Springer | 66 | 4,9 % |
| Läufer | 51 | 3,8 % |
| König | 24 | 1,8 % |

### In welcher Phase
| Phase | Anzahl | Anteil |
|---|---|---|
| Mittelspiel | 2555 | 82,2 % |
| Eröffnung | 291 | 9,4 % |
| Endspiel | 263 | 8,5 % |

### In welchem Zugbereich
| Zugnummer | Anzahl | Anteil |
|---|---|---|
| 11–20 | 1067 | 34,3 % |
| 21–30 | 1063 | 34,2 % |
| 31–40 | 450 | 14,5 % |
| 1–10 | 291 | 9,4 % |
| 41+ | 238 | 7,7 % |

### Beispiele (nur Stellung und Zug, keine Namen)
| Art | Zug Nr. | Zug | Stellung (FEN) |
|---|---|---|---|
| Mattangriff | 24 | Dame von d4 nach g7 (schlägt Bauer), Matt | `5rk1/1R4pp/2p1p3/p2p4/3Q4/6P1/q1P3P1/7K w - - 0 24` |
| Mattangriff | 23 | Dame von h6 nach g7, Matt | `4rr1k/pp5p/6RQ/2pq1p2/2p5/2Pp1P2/PP1N1b1P/R6K w - - 0 23` |
| Mattangriff | 27 | Dame von g4 nach h4, Matt | `8/ppp3q1/2np2pk/4p1N1/4P1Q1/8/PPP3PP/5RK1 w - - 12 27` |
| Figurenopfer | 23 | Läufer von e5 nach d4 | `r3r1k1/5p1p/pq1p2pB/3Pb2n/1p6/3Q1RnP/PP3NB1/4R1K1 b - - 3 23` |
| Figurenopfer | 27 | Springer von e2 nach f4 | `r3r1k1/5p1p/p2p2pB/3P3n/1p6/3Q3P/PP2nqBK/5R2 b - - 1 27` |
| Figurenopfer | 29 | Läufer von c8 nach e6 | `r1b1r3/5kb1/p1p3p1/8/2BPp3/4q2P/PP4RK/3R4 b - - 1 29` |
| Gabel / Doppelangriff | 23 | Bauer von e4 nach d3 (schlägt Bauer), Schach | `r4rk1/p1p2p1p/1p1p2pP/2nP4/2PNpb1q/1P1P4/PBK1Q3/R7 b - - 0 23` |
| Gabel / Doppelangriff | 25 | Dame von g5 nach d8, Schach | `5k2/3n1p2/2p5/1p4Q1/p7/8/PP1NrPPP/R5K1 w - - 3 25` |
| Gabel / Doppelangriff | 28 | Dame von g4 nach f4, Schach | `8/5p2/2p2k2/1p6/p5Q1/8/PP1r1PPP/R5K1 w - - 0 28` |

## Comebacks

Von 2204 Partien, in denen du mindestens 3 Bauern schlechter standest, hast du **818 gewonnen und 83 remis gehalten** (40,9 %) und 1303 verloren.

### Was den Umschwung auslöst
| Wendepunkt | Anzahl | Anteil |
|---|---|---|
| Gegnerfehler | 548 | 83,4 % |
| Gegner lässt nach | 92 | 14,0 % |
| eigener starker Zug | 17 | 2,6 % |

Wendepunkt = der erste Halbzug nach dem Tiefpunkt, nach dem du nicht mehr schlechter stehst (Bewertung mindestens −1).

### Wo im Spiel kommt der Wendepunkt
| Phase | Anzahl | Anteil |
|---|---|---|
| Mittelspiel | 545 | 83,0 % |
| Eröffnung | 65 | 9,9 % |
| Endspiel | 47 | 7,2 % |

| Zugnummer | Anzahl | Anteil |
|---|---|---|
| 11–20 | 253 | 38,5 % |
| 21–30 | 204 | 31,1 % |
| 31–40 | 85 | 12,9 % |
| 1–10 | 65 | 9,9 % |
| 41+ | 50 | 7,6 % |

### Deine Antwort auf den Fehler des Gegners
In 535 Comebacks hat der Gegner mit einem Fehler (mindestens 2,5 Bauern) den Umschwung ausgelöst. Deine direkte Antwort war ein Schachgebot in 19,4 %, ein Schlagzug in 55,5 %. Gespielt hast du dabei:

| Figur deiner Antwort | Anzahl | Anteil |
|---|---|---|
| Dame | 137 | 25,6 % |
| Turm | 108 | 20,2 % |
| Springer | 97 | 18,1 % |
| Läufer | 90 | 16,8 % |
| Bauer | 63 | 11,8 % |
| König | 40 | 7,5 % |

Die Figur, die der Gegner mit seinem Fehlerzug bewegt hat:

| Figur des Gegners | Anzahl | Anteil |
|---|---|---|
| Dame | 107 | 20,0 % |
| Bauer | 107 | 20,0 % |
| Läufer | 88 | 16,4 % |
| Turm | 88 | 16,4 % |
| Springer | 87 | 16,3 % |
| König | 58 | 10,8 % |

### Was du in schlechter Stellung anders machst
Deine Züge, solange du mindestens 1,5 Bauern schlechter stehst, im Vergleich zwischen Partien, die du gerettet hast, und Partien, die du verloren hast:

| | gerettet (S/R) | verloren |
|---|---|---|
| Züge | 9590 | 22533 |
| Schachgebote | 7,5 % | 7,8 % |
| Schlagzüge | 23,9 % | 21,9 % |
| Damenzüge | 14,3 % | 12,0 % |
| Turmzüge | 20,0 % | 20,7 % |
| Königszüge | 18,1 % | 23,6 % |
| Springerzüge | 15,0 % | 12,7 % |
| Läuferzüge | 12,6 % | 9,5 % |
| Bauernzüge | 20,0 % | 21,4 % |

In den drei Zügen unmittelbar vor einem gegnerischen Fehler (Comeback-Wendepunkt) waren bei dir 8,9 % Schachgebote und 24,6 % Schlagzüge.

## Einschränkungen

- Ein „Gewinnzug“ ist hier ein Zug, den die Engine als (fast) besten wertet und der eine Taktik, ein Matt oder einen Materialgewinn vorbereitet. Es gibt keine MultiPV-Daten, deshalb kann nicht beurteilt werden, wie schwer der Zug zu finden war.
- Die Motive (Gabel, Opfer, Materialgewinn) sind aus Material und Angriffen nach dem Zug berechnet. Fesselungen, Abzugsschach und Zwischenzüge werden nicht eigens erkannt und stecken in „Materialgewinn“.
- Tiefe 11 bis 14: Zahlen bei einzelnen Zügen können abweichen, die Verteilungen sind aussagekräftiger.
- Ein Umschwung entsteht fast immer durch einen Fehler des Gegners. Deine Leistung ist, ihn zu provozieren und konsequent zu nutzen.
