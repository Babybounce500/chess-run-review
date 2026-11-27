# Shadow Boxer: Title Night

Boxen im Browser. **Stand: Phase 4** (Kampfgefühl, Übertragung, Online-Duell, Karriere, Rang, Training).

## Regeln
Drei Runden zu 60 Sekunden. Sieg durch K. o., technischen K. o. (drei Niederschläge in einer Runde) oder nach Punkten (drei Richter).
Die große Zahl oben zählt die Niederschläge.

## Steuerung
| Aktion | Handy | Tastatur | Gamepad |
|---|---|---|---|
| Jab | rechts tippen | J | X |
| Cross | rechts hoch wischen | K | Y |
| Haken | rechts zur Seite wischen | L | B |
| Uppercut | rechts runter wischen | E | A |
| Zum Körper | KÖRPER halten | Shift | RB |
| Deckung (im letzten Moment: Parade) | DECKUNG | Leertaste | LB |
| Ducken | DUCKEN | Q | LT |
| Ausweichen / Abstand | Stick zur Seite / hoch und runter | A D / W S | Stick |
| Kamera (Schulterblick, Ich-Sicht) | 🎥 | V | |

Statt Wischen lassen sich im Menü Schlagknöpfe einstellen.

## Kampfsystem
- Seitschritt hilft gegen gerade Schläge, Ducken gegen Haken, der Uppercut bestraft das Ducken. Körpertreffer lassen sich nicht wegducken.
- Nach Ausweichen oder Parade öffnet sich ein Konterfenster mit deutlich mehr Schaden.
- Jeder Schlag kostet Ausdauer, Fehlschläge extra. Müde ist man langsam und schwach. Körpertreffer senken die Ausdauergrenze.
- Deckung schützt nur richtig in passender Höhe und kostet Ausdauer.
- Nach einem Niederschlag steht man durch Drücken im richtigen Moment auf; jedes Mal wird es schwerer.

## Übertragung
- **Einmarsch:** Gegner, dann du, mit Nebel, Torbogen und Bauchbinde; danach Kämpfervergleich. Drei Gegner: Rocco Brandt (leicht), Viktor Sand (normal), Ilja Stahl (schwer), alle erfunden.
- **Wiederholung in Zeitlupe:** beim Niederschlag des Gegners aus zwei Kamerawinkeln, in der Rundenpause der härteste Treffer, nach einem K. o. der entscheidende Schlag.
- **Rundenpause:** Trefferstatistik und Punktzettel. **Richterspruch:** Karten werden einzeln aufgedeckt. **Abschlussbild:** Ergebnisblatt.
- Publikum springt bei großen Szenen auf, Kommentar als Text.
- Überspringen: Knopf, Enter oder Leertaste. Ganz abschalten: Menü, „TV-Übertragung“.

## Online-Duell
1. „Freund herausfordern“, den Link verschicken.
2. Der Freund öffnet ihn, tippt „Annehmen“ und schickt den Antwort-Code zurück.
3. Code einfügen, „Verbinden“.

- Beide haben dieselben Werte. Serie bis zwei Siege, Revanche, Bilanz gegeneinander, Chat.
- Der Kampf beginnt, wenn beide den Einmarsch gesehen oder übersprungen haben (höchstens 20 Sekunden Warten).
- **Fairness:** Alle Schläge sind online ein Viertel langsamer. Der Gastgeber bekommt seine eigenen Eingaben um Laufzeit plus 70 ms verzögert (höchstens 220 ms). Beim Aufstehen zählt die Marke, die man beim Drücken gesehen hat (bis 450 ms zurück). Der Ping steht beim Rundenstand.
- Der Gastgeber rechnet den Kampf: Seine App muss im Vordergrund bleiben. Kein Betrugsschutz.

## Karriere
Fünf erfundene Gegner mit eigenem Stil, nacheinander freigeschaltet, der letzte ist der Titelkampf: Rocco Brandt (wilde Haken), Milan Kord (hohe Deckung), Viktor Sand (Schlagserien), Dario Venn (Abstand und Konter), Ilja Stahl (Champion, geht zum Körper). Zu jedem gibt es einen Tipp.

## Rang
Bronze 0 · Silber 100 · Gold 250 · Platin 450 · Diamant 700 · Champion 1000. Sieg +25 (K. o. +5) mal Gewicht des Gegners, Unentschieden +4, Niederlage −12. Leichte Gegner bringen nur bis zu einer Grenze Punkte. Gespeichert nur auf dem Gerät; ein abgebrochener Kampf zählt nicht.

## Training
Partner ohne Uhr und Niederschläge. Übungen „Frei“, „Parade“, „Kontern“, Schlag und Tempo wählbar. Die Leiste zeigt die Ausholbewegung, grün ist das Paradefenster (die letzten 150 ms), darunter das Konterfenster. Rückmeldung in Millisekunden.

Nach jedem Kampf: schnellste Reaktion und „Höhepunkt ansehen“.

## Entwickeln
```
npm start                 # http://localhost:5000
node tests/sim-test.mjs
npm install && node tests/browser-test.mjs     # braucht Chrome (Variable CHROME)
node tests/show-test.mjs                       # Übertragung
node tests/online-test.mjs                     # zwei Browser, auch mit künstlicher Verzögerung
node tests/career-test.mjs                     # Karriere, Rang, Training
npm run update:sw         # nach Änderungen
```
Stellwerte in `src/config.js`, Logik in `src/sim.js`, Szene in `src/view.js`, Gestenfläche in `src/punchpad.js`, Anzeige in `src/hud.js`, Übertragung in `src/show.js`, Online-Regeln in `src/online.js`, Karriere in `src/career.js`, Rang in `src/rank.js`, Training in `src/training.js`, Baukasten in `src/kit/`.

three.js 0.160.0 (MIT) unter `vendor/`.
