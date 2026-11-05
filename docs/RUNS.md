# Runs (Sessions) im Detail

Hier sind einzelne Bullet-Runs dokumentiert: Ergebnis, Rating, Fehlerquote und eine Zeile pro Partie. Stockfish 19 (Lite-Netz, WebAssembly), Tiefe 14. Gegnernamen und Chess.com-Links werden nicht veröffentlicht.

**Hinweise:** Rating = Wert im PGN-Header, also **vor** der jeweiligen Partie. Die Partien enthalten keine Uhrzeiten, deshalb kann **Zeitnot oder Lag nicht belegt werden**. Bei Siegen oder Niederlagen „auf Zeit“ sieht man nur das Ergebnis, nicht die Ursache. Patzer ≥ 300 cp, grobe Fehler ≥ 100 cp, kleine Fehler ≥ 50 cp Verlust gegenüber dem Bestzug (aus Sicht des ziehenden Spielers).

## Überblick

| Run | Kontrolle | Partien | S–R–N | Rating (Header) | Patzerquote du / Gegner |
|---|---|---|---|---|---|
| 04.11.2026 | Bullet 60 s | 9 | 7–0–2 | 970 → 1003 (Höchstwert 1003) | 16 % / 16 % |
| 05.11.2026 (Teil 1) | Bullet 60 s | 7 | 6–0–1 | 979 → 1012 (Höchstwert 1020) | 7 % / 10 % |
| 05.11.2026 (Teil 2) | Bullet 60 s | 11 | 8–0–3 | 1021 → 1053 (Höchstwert 1053) | 10 % / 12 % |

## Bullet-Run vom 04.11.2026

- **Ergebnis:** 7 Siege, 0 Remis, 2 Niederlagen aus 9 Partien (78 % Siege).
- **Rating:** 970 (vor der ersten Partie) → 1003 (vor der letzten), Höchstwert 1003. Gegner im Schnitt 978 Elo.
- **Fehlerquote:** Du 41 Patzer, 40 grobe, 27 kleine Fehler in 253 Zügen (16.2 % Patzer); Gegner 39 Patzer, 37 grobe, 33 kleine in 251 Zügen (15.5 %).
- **Art der Ergebnisse:** 1× Sieg Aufgabe, 3× Sieg Schachmatt, 1× Niederlage Schachmatt, 3× Sieg auf Zeit, 1× Niederlage auf Zeit.

| # | Farbe | Gegner-Elo | Ergebnis | Züge | Du P/G/k | Gegner P/G | Stand ≥ +1 / ≤ −1 | Auffälligkeit |
|---|---|---|---|---|---|---|---|---|
| 1 | Schwarz | 958 | Sieg (Aufgabe) | 13 | 0/1/3 | 1/2 | 69 % / 4 % | Gegnerpatzer 5.Bd3 (−6.2) |
| 2 | Schwarz | 982 | Sieg (Schachmatt) | 34 | 4/3/4 | 9/2 | 79 % / 1 % | dein größter Fehler 29...Rd8+ (Matt, besser Ra6+ Rb6); Gegnerpatzer 30.Kc7 (Matt) |
| 3 | Weiß | 1007 | Niederlage (Schachmatt) | 32 | 5/9/1 | 5/6 | 13 % / 58 % | dein größter Fehler 27.Kf1 (Matt, besser Rxd2 Qe5); Gegnerpatzer 29...Rg1 (Matt) |
| 4 | Schwarz | 964 | Sieg (auf Zeit) | 34 | 9/2/4 | 6/1 | 3 % / 50 % | dein größter Fehler 27...f5 (Matt, besser Re1#); Gegnerpatzer 27.Nb5 (Matt) |
| 5 | Weiß | 975 | Sieg (Schachmatt) | 17 | 3/4/1 | 5/3 | 61 % / 12 % | dein größter Fehler 16.e6 (−6.4, besser Qxf8+ Kd7); Gegnerpatzer 16...Ne7 (Matt) |
| 6 | Weiß | 1016 | Niederlage (auf Zeit) | 30 | 6/5/4 | 4/7 | 3 % / 57 % | dein größter Fehler 20.Rf1 (Matt, besser Rg1 Bg2+); Gegnerpatzer 20...Bf5 (Matt) |
| 7 | Schwarz | 966 | Sieg (Schachmatt) | 17 | 1/2/2 | 2/1 | 9 % / 21 % | dein größter Fehler 5...Nf6 (−5.5, besser Bxf3 Qd2); Gegnerpatzer 17.b3 (Matt) |
| 8 | Weiß | 962 | Sieg (auf Zeit) | 30 | 10/3/5 | 6/4 | 2 % / 68 % | dein größter Fehler 21.Kg1 (Matt, besser Qxh5 gxh5); Gegnerpatzer 21...Qg5+ (−14.2) |
| 9 | Schwarz | 974 | Sieg (auf Zeit) | 46 | 3/11/3 | 1/11 | 0 % / 74 % | dein größter Fehler 46...bxc5 (−3.7, besser Rh2+ Kf3); Gegnerpatzer 12.e4 (−3.0) |

## Bullet-Run vom 05.11.2026 (Teil 1)

- **Ergebnis:** 6 Siege, 0 Remis, 1 Niederlage aus 7 Partien (86 % Siege).
- **Rating:** 979 (vor der ersten Partie) → 1012 (vor der letzten), Höchstwert 1020. Gegner im Schnitt 993 Elo.
- **Fehlerquote:** Du 14 Patzer, 32 grobe, 28 kleine Fehler in 197 Zügen (7.1 % Patzer); Gegner 20 Patzer, 30 grobe, 18 kleine in 195 Zügen (10.3 %).
- **Art der Ergebnisse:** 3× Sieg Schachmatt, 2× Sieg Aufgabe, 1× Sieg auf Zeit, 1× Niederlage Schachmatt.

| # | Farbe | Gegner-Elo | Ergebnis | Züge | Du P/G/k | Gegner P/G | Stand ≥ +1 / ≤ −1 | Auffälligkeit |
|---|---|---|---|---|---|---|---|---|
| 1 | Schwarz | 968 | Sieg (Schachmatt) | 22 | 1/6/1 | 3/1 | 7 % / 32 % | dein größter Fehler 16...Nh5 (−4.4, besser Qf2 Re1); Gegnerpatzer 22.Rxf7 (Matt) |
| 2 | Weiß | 970 | Sieg (Schachmatt) | 25 | 3/2/4 | 3/4 | 80 % / 8 % | dein größter Fehler 23.Kh1 (Matt, besser Nf6 Rd7); Gegnerpatzer 23...Qxb2 (Matt) |
| 3 | Weiß | 957 | Sieg (Schachmatt) | 30 | 1/5/4 | 4/3 | 20 % / 54 % | dein größter Fehler 19.Bg5 (−3.4, besser Rxf7 g6); Gegnerpatzer 29...Kc8 (Matt) |
| 4 | Schwarz | 1007 | Sieg (Aufgabe) | 26 | 2/4/1 | 2/6 | 40 % / 4 % | dein größter Fehler 23...Qxc3 (−7.8, besser cxb3 Bc4+); Gegnerpatzer 24.Kd1 (−19.8) |
| 5 | Schwarz | 1016 | Sieg (Aufgabe) | 34 | 1/6/3 | 3/5 | 26 % / 9 % | dein größter Fehler 32...Kf4 (−8.7, besser Rf2 Rd1); Gegnerpatzer 34.Re3+ (Matt) |
| 6 | Schwarz | 986 | Sieg (auf Zeit) | 28 | 2/5/7 | 3/7 | 57 % / 4 % | dein größter Fehler 27...Qxb2+ (−3.4, besser Qxe4+ Qe3); Gegnerpatzer 14.Qe2 (−8.0) |
| 7 | Weiß | 1047 | Niederlage (Schachmatt) | 32 | 4/4/8 | 2/4 | 77 % / 5 % | dein größter Fehler 32.Kf1 (Matt, besser Kh1 Rh2+); Gegnerpatzer 12...Ke7 (−3.8) |

## Bullet-Run vom 05.11.2026 (Teil 2)

- **Ergebnis:** 8 Siege, 0 Remis, 3 Niederlagen aus 11 Partien (73 % Siege).
- **Rating:** 1021 (vor der ersten Partie) → 1053 (vor der letzten), Höchstwert 1053. Gegner im Schnitt 1026 Elo.
- **Fehlerquote:** Du 32 Patzer, 37 grobe, 56 kleine Fehler in 322 Zügen (9.9 % Patzer); Gegner 38 Patzer, 38 grobe, 44 kleine in 319 Zügen (11.9 %).
- **Art der Ergebnisse:** 3× Sieg Aufgabe, 2× Niederlage auf Zeit, 4× Sieg auf Zeit, 1× Niederlage Schachmatt, 1× Sieg Schachmatt.

| # | Farbe | Gegner-Elo | Ergebnis | Züge | Du P/G/k | Gegner P/G | Stand ≥ +1 / ≤ −1 | Auffälligkeit |
|---|---|---|---|---|---|---|---|---|
| 1 | Weiß | 1067 | Sieg (Aufgabe) | 14 | 0/1/3 | 0/2 | 4 % / 4 % |  |
| 2 | Schwarz | 1037 | Niederlage (auf Zeit) | 39 | 4/4/10 | 2/6 | 0 % / 86 % | dein größter Fehler 34...Qe2 (Matt, besser Qg4+ Kf1); Gegnerpatzer 31.Qf6+ (Matt) |
| 3 | Schwarz | 995 | Sieg (auf Zeit) | 29 | 5/5/2 | 4/2 | 29 % / 16 % | dein größter Fehler 23...Re8 (Matt, besser Qe3+ Kf1); Gegnerpatzer 24.Rd2 (Matt) |
| 4 | Weiß | 1047 | Niederlage (Schachmatt) | 32 | 5/2/5 | 5/4 | 25 % / 38 % | dein größter Fehler 22.Nxb7 (Matt, besser Nc7+ Kf8); Gegnerpatzer 21...Ke8 (Matt) |
| 5 | Schwarz | 1005 | Niederlage (auf Zeit) | 48 | 0/4/7 | 2/5 | 67 % / 0 % | Gegnerpatzer 40.a8=Q (−3.6) |
| 6 | Weiß | 1006 | Sieg (auf Zeit) | 36 | 4/6/6 | 5/5 | 87 % / 0 % | dein größter Fehler 19.Qxd8+ (Matt, besser Re1+ Be6); Gegnerpatzer 17...h4 (−18.1) |
| 7 | Weiß | 1008 | Sieg (auf Zeit) | 38 | 3/7/9 | 3/8 | 25 % / 4 % | dein größter Fehler 27.Kf1 (Matt, besser Qxg2 Rxg2+); Gegnerpatzer 27...Rxf2+ (Matt) |
| 8 | Schwarz | 1021 | Sieg (auf Zeit) | 36 | 6/3/8 | 6/3 | 17 % / 47 % | dein größter Fehler 27...Rd8 (Matt, besser Qxd6 Kh1); Gegnerpatzer 34.Qe6 (−10.3) |
| 9 | Weiß | 1042 | Sieg (Aufgabe) | 12 | 0/0/2 | 3/1 | 52 % / 0 % | Gegnerpatzer 11...b6 (−10.1) |
| 10 | Schwarz | 1030 | Sieg (Schachmatt) | 17 | 2/2/1 | 4/1 | 32 % / 0 % | dein größter Fehler 12...Bxh4 (−4.3, besser e3 Nf5); Gegnerpatzer 17.e3 (Matt) |
| 11 | Weiß | 1033 | Sieg (Aufgabe) | 23 | 3/3/3 | 4/1 | 84 % / 4 % | dein größter Fehler 22.Ne1 (−12.1, besser Nd4 Qxe2); Gegnerpatzer 22...Rae8 (−17.7) |

## Fazit und Beobachtungen

1. **Das Bullet-Rating (Header-Werte) steigt über die drei Runs:** 970 → 1003 (Run 1), 979 → Höchstwert 1020 (Run 2), 1021 → Höchstwert 1053 (Run 3). Zwischen Run 1 und 2 steht im Header ein Rückgang von 1003 auf 979; die Partien dazwischen (nach deiner Angabe Niederlagen vom Vortag) liegen nicht in den Dateien, die Ursache ist also nicht belegt.
2. **Gewonnen wird selten durch klaren Vorteil, sondern durch Gegnerpatzer, Aufgaben und Zeit.** In Run 3 sind von 8 Siegen nur 1 durch Matt, 3 durch Aufgabe des Gegners (nach 12, 14 und 23 Zügen) und 4 auf Zeit. In allen Runs hast du Partien gewonnen, in denen die Engine dich lange schlechter sah (≤ −1) und der Gegner ein Matt zugelassen, aufgegeben oder die Uhr verloren hat. Das passt zu deinem Muster aus dem Gesamtbericht (Rettungen aus verlorener Stellung).
3. **Die Uhr entscheidet viele Partien:** In Run 3 endeten 6 von 11 Partien auf Zeit (4 Siege, 2 Niederlagen). In Partie 5 (Run 3) standest du laut Engine 67 % der Zeit besser (nie schlechter) und hast trotzdem auf Zeit verloren. Ob Zeitnot oder Lag der Grund war, lässt sich aus den Dateien nicht erkennen.
4. **Fehlerquote:** Run 1: 16 % Patzer pro Zug (Gegner 16 %), Run 2: 7 % (Gegner 10 %), Run 3: 10 % (Gegner 12 %). Die Niederlagen durch Matt: In Run 2 (Partie 7) kam sie aus überlegener Stellung (77 % der Zeit besser, nie schlechter): Matt zugelassen mit 32.Kf1 (besser Kh1). In Run 1 (Partie 3) standest du dagegen 58 % der Zeit schlechter (Matt zugelassen mit 27.Kf1, besser Txd2), und in Run 3 (Partie 4) war die Stellung ausgeglichen bis schlechter (25 % besser, 38 % schlechter; Matt zugelassen mit 22.Sxb7, besser Sc7+).
5. **Offen bleibt:** Lag, Zeitnot und Premoves lassen sich aus den PGN-Dateien nicht ablesen. Wenn dir das wichtig ist, nimm beim Export Uhrzeiten (`[%clk]`) mit, dann wird Zeitnot auswertbar.
