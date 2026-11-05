# Runs (Sessions) im Detail

Hier sind einzelne Bullet-Runs dokumentiert: Ergebnis, Rating, Fehlerquote und eine Zeile pro Partie. Stockfish 19 (Lite-Netz, WebAssembly), Tiefe 14. Gegnernamen und Chess.com-Links werden nicht veröffentlicht.

**Hinweise:** Rating = Wert im PGN-Header, also **vor** der jeweiligen Partie. Die Partien enthalten keine Uhrzeiten, deshalb kann **Zeitnot oder Lag nicht belegt werden**. Bei Siegen oder Niederlagen „auf Zeit“ sieht man nur das Ergebnis, nicht die Ursache. Patzer ≥ 300 cp, grobe Fehler ≥ 100 cp, kleine Fehler ≥ 50 cp Verlust gegenüber dem Bestzug (aus Sicht des ziehenden Spielers).

## Überblick

| Run | Kontrolle | Partien | S–R–N | Rating (Header) | Patzerquote du / Gegner |
|---|---|---|---|---|---|
| 04.11.2026 | Bullet 60 s | 9 | 7–0–2 | 970 → 1003 (Höchstwert 1003) | 16 % / 16 % |
| 05.11.2026 (Teil 1) | Bullet 60 s | 7 | 6–0–1 | 979 → 1012 (Höchstwert 1020) | 7 % / 10 % |
| 05.11.2026 (Teil 2) | Bullet 60 s | 11 | 8–0–3 | 1021 → 1053 (Höchstwert 1053) | 10 % / 12 % |
| 05.11.2026 (Teil 3) | Bullet 60 s | 23 | 13–1–9 | 1045 → 1086 (Höchstwert 1094) | 9 % / 8 % |
| 05.11.2026 (Teil 4) | Bullet 60 s | 10 | 6–0–4 | 1078 → 1101 (Höchstwert 1101) | 10 % / 12 % |

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

## Bullet-Run vom 05.11.2026 (Teil 3)

- **Ergebnis:** 13 Siege, 1 Remis, 9 Niederlagen aus 23 Partien (57 % Siege).
- **Rating:** 1045 (vor der ersten Partie) → 1086 (vor der letzten), Höchstwert 1094. Gegner im Schnitt 1072 Elo.
- **Fehlerquote:** Du 67 Patzer, 100 grobe, 105 kleine Fehler in 732 Zügen (9.2 % Patzer); Gegner 56 Patzer, 122 grobe, 98 kleine in 730 Zügen (7.7 %).
- **Art der Ergebnisse:** 5× Niederlage Schachmatt, 5× Sieg Schachmatt, 6× Sieg auf Zeit, 1× Remis Remis - Zeitüberschreitung, jedoch ungenügend Material, 2× Sieg Aufgabe, 4× Niederlage auf Zeit.

| # | Farbe | Gegner-Elo | Ergebnis | Züge | Du P/G/k | Gegner P/G | Stand ≥ +1 / ≤ −1 | Auffälligkeit |
|---|---|---|---|---|---|---|---|---|
| 1 | Schwarz | 1079 | Niederlage (Schachmatt) | 27 | 5/3/4 | 1/2 | 2 % / 87 % | dein größter Fehler 22...Rf8 (Matt, besser Rad8 Rhf1); Gegnerpatzer 22.Bb5 (−3.4) |
| 2 | Weiß | 1039 | Sieg (Schachmatt) | 12 | 0/4/3 | 2/0 | 26 % / 39 % | Gegnerpatzer 11...Qe7 (Matt) |
| 3 | Schwarz | 1054 | Sieg (auf Zeit) | 30 | 2/3/2 | 3/4 | 55 % / 7 % | dein größter Fehler 24...Qc1+ (−8.3, besser Bxd4 cxd4); Gegnerpatzer 24.Qd4 (−6.9) |
| 4 | Schwarz | 1078 | Remis | 57 | 1/4/10 | 1/3 | 3 % / 47 % | dein größter Fehler 32...Kd3 (−3.9, besser Kxe5 Rh7); Gegnerpatzer 53.f5 (−4.7) |
| 5 | Weiß | 1032 | Sieg (Aufgabe) | 11 | 0/2/2 | 1/3 | 33 % / 0 % | Gegnerpatzer 10...h5 (−8.4) |
| 6 | Schwarz | 1041 | Niederlage (auf Zeit) | 34 | 11/3/1 | 10/5 | 55 % / 21 % | dein größter Fehler 23...Qh5 (Matt, besser Qe8+ Qe5); Gegnerpatzer 23.Ke1 (Matt) |
| 7 | Weiß | 1054 | Sieg (auf Zeit) | 31 | 6/2/4 | 4/6 | 48 % / 15 % | dein größter Fehler 30.Kh1 (Matt, besser Rf2 Bxe5); Gegnerpatzer 28...Qc6 (−8.2) |
| 8 | Schwarz | 1082 | Sieg (Schachmatt) | 24 | 1/3/1 | 4/6 | 60 % / 10 % | dein größter Fehler 3...e5 (−6.0, besser cxb5 O-O); Gegnerpatzer 23.Re3 (Matt) |
| 9 | Schwarz | 1107 | Niederlage (Schachmatt) | 43 | 4/10/6 | 0/9 | 4 % / 80 % | dein größter Fehler 39...e5 (−10.4, besser Kf8 Kf6) |
| 10 | Schwarz | 1073 | Sieg (auf Zeit) | 32 | 8/4/3 | 3/5 | 2 % / 48 % | dein größter Fehler 29...Kh6 (Matt, besser Qxe6 Qxe6); Gegnerpatzer 30.Nxd8 (Matt) |
| 11 | Schwarz | 1073 | Sieg (Schachmatt) | 44 | 2/4/0 | 1/9 | 58 % / 11 % | dein größter Fehler 11...O-O (−4.1, besser Bxg2 Rg1); Gegnerpatzer 23.f4 (−9.3) |
| 12 | Weiß | 1063 | Sieg (Aufgabe) | 26 | 0/3/4 | 1/3 | 73 % / 0 % | Gegnerpatzer 13...Rh5 (−3.7) |
| 13 | Weiß | 1113 | Niederlage (Schachmatt) | 28 | 3/5/5 | 2/6 | 36 % / 9 % | dein größter Fehler 27.Kh1 (Matt, besser b3 Rc2); Gegnerpatzer 19...Nc6 (−5.1) |
| 14 | Weiß | 1089 | Niederlage (Schachmatt) | 8 | 1/1/1 | 0/2 | 19 % / 13 % | dein größter Fehler 8.O-O (Matt, besser Nc3 b6) |
| 15 | Schwarz | 1090 | Sieg (auf Zeit) | 35 | 1/3/5 | 2/3 | 21 % / 43 % | dein größter Fehler 5...Qxd6 (−9.0, besser Bxd6 exd6); Gegnerpatzer 5.Qxd6 (−8.8) |
| 16 | Weiß | 1073 | Niederlage (auf Zeit) | 37 | 6/10/7 | 4/6 | 23 % / 55 % | dein größter Fehler 34.Nb6 (Matt, besser Na3 Bf6); Gegnerpatzer 34...Rd6 (Matt) |
| 17 | Weiß | 1054 | Sieg (auf Zeit) | 37 | 2/5/10 | 2/7 | 40 % / 42 % | dein größter Fehler 36.Kh2 (Matt, besser Rc1 Qf4); Gegnerpatzer 36...Kf6 (Matt) |
| 18 | Schwarz | 1080 | Niederlage (Schachmatt) | 17 | 2/5/3 | 0/4 | 3 % / 67 % | dein größter Fehler 16...Rd8 (Matt, besser Qg6 Qxb7) |
| 19 | Weiß | 1089 | Niederlage (auf Zeit) | 40 | 3/6/13 | 0/7 | 4 % / 66 % | dein größter Fehler 37.Ke4 (−5.8, besser Rxe7 Bxe7) |
| 20 | Weiß | 1067 | Sieg (Schachmatt) | 47 | 2/8/3 | 7/8 | 69 % / 15 % | dein größter Fehler 18.Ne4 (−4.3, besser Qc4 Qb6+); Gegnerpatzer 42...Kh5 (−7.2) |
| 21 | Weiß | 1056 | Sieg (auf Zeit) | 39 | 2/4/7 | 3/10 | 42 % / 25 % | dein größter Fehler 11.Be3 (−5.6, besser Bxg6 hxg6); Gegnerpatzer 31...Re1 (−5.4) |
| 22 | Schwarz | 1102 | Niederlage (auf Zeit) | 48 | 3/6/8 | 2/8 | 26 % / 16 % | dein größter Fehler 32...Kd7 (−5.3, besser a5 b4); Gegnerpatzer 39.Ke4 (−4.7) |
| 23 | Schwarz | 1077 | Sieg (Schachmatt) | 30 | 2/2/3 | 3/6 | 68 % / 0 % | dein größter Fehler 29...c5+ (Matt, besser Ra3 Bb3); Gegnerpatzer 29.Kd4 (Matt) |

## Bullet-Run vom 05.11.2026 (Teil 4)

- **Ergebnis:** 6 Siege, 0 Remis, 4 Niederlagen aus 10 Partien (60 % Siege).
- **Rating:** 1078 (vor der ersten Partie) → 1101 (vor der letzten), Höchstwert 1101. Gegner im Schnitt 1077 Elo.
- **Fehlerquote:** Du 34 Patzer, 45 grobe, 48 kleine Fehler in 350 Zügen (9.7 % Patzer); Gegner 42 Patzer, 61 grobe, 42 kleine in 349 Zügen (12.0 %).
- **Art der Ergebnisse:** 3× Niederlage auf Zeit, 1× Niederlage Schachmatt, 3× Sieg auf Zeit, 2× Sieg Aufgabe, 1× Sieg Schachmatt.

| # | Farbe | Gegner-Elo | Ergebnis | Züge | Du P/G/k | Gegner P/G | Stand ≥ +1 / ≤ −1 | Auffälligkeit |
|---|---|---|---|---|---|---|---|---|
| 1 | Schwarz | 1085 | Niederlage (auf Zeit) | 33 | 2/2/4 | 1/4 | 2 % / 35 % | dein größter Fehler 11...Na6 (−6.5, besser b6 Ba6); Gegnerpatzer 17.c3 (−3.1) |
| 2 | Weiß | 1084 | Niederlage (Schachmatt) | 47 | 5/7/8 | 2/7 | 22 % / 61 % | dein größter Fehler 29.c4 (−14.1, besser Qxb7 Kd7); Gegnerpatzer 40...h4 (Matt) |
| 3 | Schwarz | 1064 | Sieg (auf Zeit) | 22 | 4/5/3 | 3/6 | 5 % / 75 % | dein größter Fehler 5...Bb4 (−4.5, besser Ne4 Nxe4); Gegnerpatzer 22.Ne4 (−10.5) |
| 4 | Weiß | 1076 | Sieg (Aufgabe) | 23 | 1/1/5 | 2/3 | 62 % / 11 % | dein größter Fehler 7.c3 (−5.8, besser Bd2 Qc7); Gegnerpatzer 9...Qf6 (−7.0) |
| 5 | Weiß | 1077 | Niederlage (auf Zeit) | 39 | 7/6/7 | 10/15 | 95 % / 0 % | dein größter Fehler 26.Qxf7+ (Matt, besser Nc7+ Kf8); Gegnerpatzer 25...Qf7 (Matt) |
| 6 | Schwarz | 1080 | Sieg (Schachmatt) | 31 | 3/8/5 | 4/9 | 10 % / 74 % | dein größter Fehler 25...Rf8 (−5.3, besser Bd4 Re1); Gegnerpatzer 31.Rcc7 (Matt) |
| 7 | Schwarz | 1076 | Niederlage (auf Zeit) | 40 | 3/4/9 | 4/4 | 30 % / 54 % | dein größter Fehler 18...Nc4 (−7.8, besser a5 Ra2); Gegnerpatzer 40.Nb6 (−8.6) |
| 8 | Weiß | 1069 | Sieg (auf Zeit) | 55 | 1/7/2 | 6/6 | 33 % / 29 % | dein größter Fehler 32.Rd2 (−7.3, besser Rd7 R8e6); Gegnerpatzer 49...Kh4 (Matt) |
| 9 | Weiß | 1054 | Sieg (Aufgabe) | 17 | 3/1/1 | 2/2 | 67 % / 3 % | dein größter Fehler 16.Qxc5 (−11.7, besser Qc7 O-O); Gegnerpatzer 16...b6 (Matt) |
| 10 | Schwarz | 1100 | Sieg (auf Zeit) | 45 | 5/4/4 | 8/5 | 50 % / 6 % | dein größter Fehler 43...f6+ (Matt, besser Rc4 Kf6); Gegnerpatzer 44.Kf4 (Matt) |

## Fazit und Beobachtungen

1. **Das Bullet-Rating (Header-Werte, vor der Partie) steigt über die fünf Runs:** 970 → 1003 (Run 1, 04.11.), dann am 05.11.: 979 → Höchstwert 1020 (Teil 1), 1021 → 1053 (Teil 2), 1045 → 1094 (Teil 3) und 1078 → **1101** (Teil 4, über 1100). Zwischen dem 04. und dem 05.11. steht im Header ein Rückgang von 1003 auf 979; die Partien dazwischen (nach deiner Angabe Niederlagen vom Vortag) liegen nicht in den Dateien, die Ursache ist nicht belegt. Den Sprung des Tages beschreibt [ELO-SPRUNG-05-11.md](ELO-SPRUNG-05-11.md).
2. **Die Gegner werden stärker:** Im Schnitt 978 Elo (Run 1), 993, 1026, 1072 und **1077** (Teil 4). Teil 3 ist mit 23 Partien der längste Run (13–1–9), Teil 4 endet 6–0–4. Gegen die stärkeren Gegner gab es mehr Niederlagen, trotzdem stieg das Rating.
3. **Gewonnen wird selten durch klaren Vorteil, sondern durch Gegnerpatzer, Aufgaben und Zeit.** In Teil 3 sind von 13 Siegen 5 durch Matt, 6 auf Zeit und 2 durch Aufgabe; in Teil 4 von 6 Siegen 3 auf Zeit, 2 durch Aufgabe und 1 durch Matt. In allen Runs hast du Partien gewonnen, in denen die Engine dich lange schlechter sah (≤ −1) und der Gegner ein Matt zugelassen, aufgegeben oder die Uhr verloren hat. Das passt zu deinem Muster aus dem Gesamtbericht (Rettungen aus verlorener Stellung).
4. **Die Uhr entscheidet viele Partien:** In Teil 2 endeten 6 von 11 auf Zeit, in Teil 3 11 von 23, in Teil 4 6 von 10 (3 Siege, 3 Niederlagen). Zweimal hast du auf Zeit verloren, obwohl die Engine dich fast die ganze Partie besser sah: Teil 2 Partie 5 (67 % besser, nie schlechter) und Teil 4 Partie 5 (95 % besser, nie schlechter, aber auch 10 Patzer und 15 grobe Fehler des Gegners). Ob Zeitnot oder Lag der Grund war, lässt sich aus den Dateien nicht erkennen.
5. **Fehlerquote pro Zug (Patzer):** Run 1: 16 % (Gegner 16 %), Teil 1: 7 % (Gegner 10 %), Teil 2: 10 % (Gegner 12 %), Teil 3: 9 % (Gegner 8 %), Teil 4: 10 % (Gegner 12 %).
6. **Wiederkehrender Mattfehler: Königszüge und Rochade.** Mehrfach lässt ein Königszug oder die Rochade Matt zu: Run 1 (27.Kf1), Teil 1 (32.Kf1), Teil 3 (27.Kh1 in Partie 13, 8.O-O in Partie 14 nach nur 8 Zügen, und in gewonnenen Partien 30.Kh1 und 36.Kh2). Die Engine bevorzugte jeweils einen Figurenzug (z. B. Rf2, Rc1, Nc3). Vor jedem Königszug lohnt sich die Frage: „Was greift mein König danach nicht mehr?“
7. **Offen bleibt:** Lag, Zeitnot und Premoves lassen sich aus den PGN-Dateien nicht ablesen. Nimm beim Export Uhrzeiten (`[%clk]`) mit, dann wird Zeitnot auswertbar.
