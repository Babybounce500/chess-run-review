# Shadow Boxer: Title Night

Boxen im Browser. **Stand: Phase 3** (Kampfgefühl, Übertragung, Online-Duell).

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

## Entwickeln
```
npm start                 # http://localhost:5000
node tests/sim-test.mjs
npm install && node tests/browser-test.mjs     # braucht Chrome (Variable CHROME)
node tests/show-test.mjs                       # Übertragung
node tests/online-test.mjs                     # zwei Browser, auch mit künstlicher Verzögerung
npm run update:sw         # nach Änderungen
```
Stellwerte in `src/config.js`, Logik in `src/sim.js`, Szene in `src/view.js`, Gestenfläche in `src/punchpad.js`, Anzeige in `src/hud.js`, Übertragung in `src/show.js`, Online-Regeln in `src/online.js`, Baukasten in `src/kit/`.

## Geplant
4 Karriere, Rangstufen, Training.

three.js 0.160.0 (MIT) unter `vendor/`.
