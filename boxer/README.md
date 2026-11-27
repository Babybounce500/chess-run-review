# Shadow Boxer: Title Night

Boxen im Browser. **Stand: Phase 1** (Kampfgefühl, gegen den Computer).

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

## Entwickeln
```
npm start                 # http://localhost:5000
node tests/sim-test.mjs
npm install && node tests/browser-test.mjs     # braucht Chrome (Variable CHROME)
npm run update:sw         # nach Änderungen
```
Stellwerte in `src/config.js`, Logik in `src/sim.js`, Szene in `src/view.js`, Gestenfläche in `src/punchpad.js`, Anzeige in `src/hud.js`, Baukasten in `src/kit/`.

## Geplant
2 Übertragung (Einmarsch, Wiederholungen, Richterwertung, Publikum) · 3 Online-Duell · 4 Karriere, Rangstufen, Training.

three.js 0.160.0 (MIT) unter `vendor/`.
