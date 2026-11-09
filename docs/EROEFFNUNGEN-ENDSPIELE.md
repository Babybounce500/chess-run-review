# Eröffnungen und Endspiele

## Kurzfazit

- **Stabile Eröffnungen:** Weiß · Scotch Game (102 Partien, 53 %); Weiß · Philidor Defense (51 Partien, 54 %); Schwarz · Hungarian Opening (25 Partien, 62 %).
- **Wackelig:** Weiß · Zukertort Opening (nach Zug 12 Median −2,1, 58 % klar schlechter); Weiß · Caro-Kann Defense (nach Zug 12 Median −1,3, 49 % klar schlechter); Weiß · Owen Defense (nach Zug 12 Median −1,2, 41 % klar schlechter); Schwarz · Caro-Kann Defense (nach Zug 12 Median −0,8, 25 % klar schlechter); Schwarz · Old Indian Defense (nach Zug 12 Median −0,7, 33 % klar schlechter). Die schlechteste Anfangsstellung hat Weiß · Caro-Kann Defense (Median −1,3).
- **Ergebnis besser als die Stellung** (Punkte trotz Rückstand nach Zug 12): Weiß · Sicilian Defense (65 %, Median −0,4); Weiß · Caro-Kann Defense (63 %, Median −1,3); Weiß · Bird Opening (56 %, Median −0,4); Weiß · French Defense (55 %, Median −0,3). Hier gewinnst du durch Fehler des Gegners, nicht durch die Eröffnung.
- **Hauptwaffe Schwarz · Pirc Defense:** 424 Blitz-Partien, 47 % Punkte. Das ist so gut wie dein übriges Schwarz-Repertoire, im Bullet sogar deutlich besser (siehe Abschnitt „Pirc im Vergleich“).
- **Endspiele:** In 48 % der Partien wird ein Endspiel erreicht, meist als der Spieler mit Nachteil. Bei Vorteil gewinnst du nur 68 % dieser Endspiele; von den 271 Endspielen mit Vorteil gehen 88 nicht an dich: 44 durch Zeitverlust, 31 durch einen großen Fehler, 13 sonst.
- **Fehleranfälligste Endspielart:** Damenendspiel mit 9,7 großen Fehlern pro 100 Zügen; am saubersten Turmendspiel mit 4,4.

Grundlage: **2012 Blitz- und Rapid-Partien** (ohne Bullet) mit Stockfish-Auswertung. In **975** (48 %) wird ein Endspiel erreicht (ab Zug 15 höchstens 4 Figuren ohne Bauern und Könige zusammen auf dem Brett). Bewertungen in Bauerneinheiten aus deiner Sicht, Tiefe 11 bis 14.

## Pirc im Vergleich (nur deine Partien mit Schwarz)

Prüfung der These „Pirc ist die solideste Eröffnung: man verliert nicht am Anfang, kann viel vorziehen und später kontern“.

| Zeitklasse | Eröffnung | Partien | Punkte | Niederlage in höchstens 20 Zügen | nach Zug 12 klar schlechter | Punkte, wenn klar schlechter | große Fehler in Zug 1 bis 12 pro Partie | Bedenkzeit in den ersten 10 Zügen | Züge unter 1 s |
|---|---|---|---|---|---|---|---|---|---|
| Blitz | Pirc | 419 | 47 % | 5 % | 30 % | 37 % | 0,3 | 19,8 s | 48 % |
| Blitz | andere Eröffnungen | 582 | 49 % | 3 % | 31 % | 38 % | 0,3 | 22,1 s | 42 % |
| Bullet | Pirc | 245 | 58 % | 2 % | 35 % | 51 % | 0,5 | 8,8 s | 65 % |
| Bullet | andere Eröffnungen | 274 | 53 % | 3 % | 40 % | 45 % | 0,5 | 9,3 s | 63 % |

**Was die Zahlen sagen:**
- **Im Bullet stimmt die These:** Pirc holt dort die meisten Punkte, du stehst seltener klar schlechter und kommst öfter zurück. Zwei Drittel der ersten Züge gehen als Premove.
- **Im Blitz ist Pirc ungefähr so gut wie dein übriges Schwarz-Repertoire,** weder besser noch schlechter. Der Anteil klar schlechter Stellungen nach Zug 12 liegt in beiden Gruppen bei etwa 30 Prozent, und das Zurückkommen (Punkte aus schlechter Stellung) ist gleich.
- **Der Premove-Vorteil ist belegt:** Du brauchst für die ersten 10 Züge etwas weniger Zeit, und ein größerer Teil der Züge fällt unter eine Sekunde.
- **Frühe Niederlagen** (in höchstens 20 Zügen) sind bei allen Schwarz-Eröffnungen selten, bei Pirc im Blitz minimal häufiger (5 statt 3 Prozent).
- Die Einstufung „wackelig“ in der Tabelle unten kommt von festen Schwellenwerten. Fast alle deine Schwarz-Eröffnungen liegen darüber. Pirc ist also nicht schlechter als der Rest, aber auch kein Ausreißer nach oben.

## Eröffnungen: wie stabil sind sie?

Für jede Eröffnung mit mindestens 25 Partien: Wie stehst du nach 12 Zügen, wie oft stehst du da bereits klar schlechter, und gewinnst du, wenn du gut stehst.

**Lesehinweis:** Der Name beschreibt die ganze Eröffnung, nicht nur deinen Zug. Bei Weiß steht deshalb oft die Verteidigung des Gegners im Namen (zum Beispiel „Weiß · Caro-Kann Defense“ oder „Weiß · Sicilian Defense“). Das sind deine Partien als Weiß gegen diese Verteidigung.

| Eröffnung | Partien | S–R–N | Punkte | Stand nach Zug 12 (Median) | nicht schlechter als −0,5 | klar schlechter (≤ −1,5) | Siege bei Vorteil (≥ +0,5) | große Fehler bis Zug 12 pro Partie | Einschätzung |
|---|---|---|---|---|---|---|---|---|---|
| Schwarz · Pirc Defense | 424 | 186–26–212 | 47 % | −0,5 | 50 % | 30 % | 60 % | 0,3 | wackelig |
| Schwarz · Queen's Pawn Game | 141 | 70–9–62 | 53 % | −0,5 | 49 % | 31 % | 68 % | 0,2 | wackelig |
| Weiß · Sicilian Defense | 107 | 66–7–34 | 65 % | −0,4 | 54 % | 29 % | 87 % | 0,3 | Ergebnis besser als Stellung |
| Weiß · Scotch Game | 102 | 52–5–45 | 53 % | −0,0 | 60 % | 27 % | 69 % | 0,4 | stabil |
| Weiß · Queen's Pawn Game | 83 | 35–5–43 | 45 % | −0,1 | 56 % | 25 % | 55 % | 0,3 | solide |
| Weiß · French Defense | 79 | 43–1–35 | 55 % | −0,3 | 53 % | 32 % | 58 % | 0,3 | Ergebnis besser als Stellung |
| Schwarz · Caro-Kann Defense | 59 | 29–1–29 | 50 % | −0,8 | 44 % | 25 % | 78 % | 0,2 | wackelig |
| Weiß · Scandinavian Defense | 58 | 23–1–34 | 41 % | −0,2 | 54 % | 30 % | 68 % | 0,3 | solide |
| Weiß · Center Game | 57 | 29–3–25 | 54 % | +0,2 | 59 % | 30 % | 68 % | 0,4 | solide |
| Weiß · Caro-Kann Defense | 57 | 35–2–20 | 63 % | −1,3 | 43 % | 49 % | 73 % | 0,3 | wackelig |
| Schwarz · Old Indian Defense | 55 | 29–2–24 | 55 % | −0,7 | 45 % | 33 % | 40 % | 0,2 | wackelig |
| Weiß · Philidor Defense | 51 | 27–1–23 | 54 % | +0,2 | 64 % | 22 % | 67 % | 0,4 | stabil |
| Schwarz · Sicilian Defense | 47 | 16–2–29 | 36 % | −0,2 | 61 % | 24 % | 54 % | 0,2 | solide |
| Weiß · Bird Opening | 41 | 23–0–18 | 56 % | −0,4 | 50 % | 39 % | 67 % | 0,4 | wackelig |
| Weiß · Zukertort Opening | 38 | 16–1–21 | 43 % | −2,1 | 29 % | 58 % | 80 % | 0,8 | wackelig |
| Weiß · King's Pawn Game | 37 | 21–3–13 | 61 % | −0,0 | 64 % | 33 % | 58 % | 0,4 | solide |
| Weiß · Owen Defense | 36 | 16–1–19 | 46 % | −1,2 | 32 % | 41 % | 33 % | 0,3 | wackelig |
| Weiß · Pirc Defense | 30 | 16–3–11 | 58 % | −0,9 | 40 % | 37 % | 80 % | 0,4 | wackelig |
| Weiß · Modern Defense | 30 | 17–0–13 | 57 % | −0,4 | 50 % | 40 % | 78 % | 0,4 | wackelig |
| Schwarz · English Opening | 29 | 16–1–12 | 57 % | −0,6 | 48 % | 22 % | 67 % | 0,1 | wackelig |
| Schwarz · Rat Defense | 29 | 13–3–13 | 50 % | −0,6 | 46 % | 36 % | 100 % | 0,3 | wackelig |
| Weiß · Bishop's Opening | 28 | 16–1–11 | 59 % | −0,5 | 48 % | 44 % | 88 % | 0,6 | wackelig |
| Schwarz · Hungarian Opening | 25 | 15–1–9 | 62 % | −0,1 | 64 % | 28 % | 75 % | 0,3 | stabil |

### Einschätzung
- **Stabil** (Punkte ≥ 52 %, nach Zug 12 meist nicht schlechter, selten klar schlechter): Weiß · Scotch Game (102 Partien, 53 %); Weiß · Philidor Defense (51 Partien, 54 %); Schwarz · Hungarian Opening (25 Partien, 62 %)
- **Solide:** Weiß · Queen's Pawn Game (83 Partien, 45 %); Weiß · Scandinavian Defense (58 Partien, 41 %); Weiß · Center Game (57 Partien, 54 %); Schwarz · Sicilian Defense (47 Partien, 36 %); Weiß · King's Pawn Game (37 Partien, 61 %)
- **Wackelig** (oft schon nach Zug 12 klar schlechter): Schwarz · Pirc Defense (424 Partien, 47 %); Schwarz · Queen's Pawn Game (141 Partien, 53 %); Schwarz · Caro-Kann Defense (59 Partien, 50 %); Weiß · Caro-Kann Defense (57 Partien, 63 %); Schwarz · Old Indian Defense (55 Partien, 55 %); Weiß · Bird Opening (41 Partien, 56 %); Weiß · Zukertort Opening (38 Partien, 43 %); Weiß · Owen Defense (36 Partien, 46 %); Weiß · Pirc Defense (30 Partien, 58 %); Weiß · Modern Defense (30 Partien, 57 %); Schwarz · English Opening (29 Partien, 57 %); Schwarz · Rat Defense (29 Partien, 50 %); Weiß · Bishop's Opening (28 Partien, 59 %)
- **Stellung gut, Ergebnis schwach** (nach Zug 12 etwa gleich oder besser, trotzdem unter 50 %): –
- **Ergebnis besser als Stellung** (nach Zug 12 schlechter, aber über 52 % Punkte): Weiß · Sicilian Defense (107 Partien, 65 %); Weiß · French Defense (79 Partien, 55 %)

## Endspiele: wie sieht die Lage aus?

| Endspielart (bei Eintritt) | Partien | S–R–N | Punkte | Stand bei Eintritt (Median) | Ø Verlust pro Zug (cp, gedeckelt) | große Fehler pro 100 Züge | Siege bei Vorteil (≥ +1,5) | Punkte bei Gleichstand | gerettet bei Nachteil (≤ −1,5) | Niederlagen auf Zeit |
|---|---|---|---|---|---|---|---|---|---|---|
| Damenendspiel | 453 | 160–17–276 | 37 % | −3,8 | 77,1 | 9,7 % | 75 % | 44 % | 17 % | 27 % |
| Turm und Leichtfigur | 434 | 135–50–249 | 37 % | −1,8 | 62,6 | 6,5 % | 61 % | 42 % | 20 % | 39 % |
| Turmendspiel | 76 | 30–8–38 | 45 % | −0,3 | 54,2 | 4,4 % | 65 % | 46 % | 33 % | 37 % |
| Leichtfigurenendspiel | 12 | 4–4–4 | 50 % | +0,4 | 59,2 | 5,6 % | 67 % | 42 % | 67 % | 75 % |

### Gewinn gehalten oder nicht
- In **271 Endspielen** hast du bei Eintritt mindestens 1,5 Bauern Vorteil. Davon nicht gewonnen: **88**. Ursache: 31 mit einem großen Fehler im Endspiel, 44 durch Zeitverlust, 13 ohne großen Fehler (Remis oder Verlust durch viele kleine).
- So enden die Endspiele: Niederlage: Matt 345, Niederlage: Zeit 188, Sieg: Aufgabe 128, Sieg: Matt 104, Sieg: Zeit 97, Remis: Remis 77, Niederlage: Aufgabe 34, Remis: Matt 2.

## Einschränkungen
- Die Eröffnungen sind die Namen aus der ECO-Liste (nach Familie zusammengefasst). Varianten innerhalb einer Familie können sich stark unterscheiden.
- Der Stand nach Zug 12 ist eine Momentaufnahme, bei Tiefe 11 bis 14 sind einzelne Werte etwas unsicher. Die Median-Werte sind verlässlicher als Einzelpartien.
- Als Endspiel zählt der erste Moment ab Zug 15, in dem zusammen höchstens 4 Figuren (ohne Bauern und Könige) auf dem Brett stehen. Wer vorher Material verloren hat, erreicht diese Stellungen oft schon schlechter. Deshalb ist der Stand bei Eintritt wichtiger als die Gesamtpunkte je Endspielart.
- Bullet ist ausgenommen, weil dort Zeit und Geschwindigkeit die Fehler bestimmen.
