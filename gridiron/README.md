# Neon Gridiron

Straßen-Football im Browser: vier gegen vier, gegen den Computer oder gegen einen Freund.

## Regeln
- Jede Seite hat zwei Angriffsserien. Vier Versuche für 11 m, ein Touchdown zählt einen Punkt.
- Vor jedem Versuch verdeckte Wahl: vier Spielzüge im Angriff, drei Aufstellungen in der Abwehr. Die Karte einmal antippen zeigt die Vorschau, „Festlegen“ oder ein zweites Antippen übernimmt.
- Gleichstand: Verlängerung, danach zählt der Raumgewinn.

## Steuerung
| | Angriff | Abwehr |
|---|---|---|
| Handy | Stick links, Knöpfe rechts (SNAP, PASS 1 bis 3, SPRINT; beim Laufen Haken und Stoßarm), Empfänger antippen | Stick, HECHT, WECHSEL, BALL!, SPRINT |
| Tastatur | WASD oder Pfeile, Leertaste/J/1, K/E/2, L/Q/3, Shift Sprint, 1 bis 4 wählt die Karte | wie Angriff |
| Gamepad | Stick, A, B, X, rechter Trigger | wie Angriff |

Passen: kurz drücken wirft flach, halten wirft hoch.

## Online
„Freund herausfordern“, Link verschicken, Antwort-Code einfügen. Die Verbindung läuft direkt zwischen den Browsern, der Gastgeber rechnet das Spiel.
Ohne Ersatzserver kann sie in strengen Netzen scheitern. Kein Betrugsschutz; ein veränderter Gastgeber könnte die Wahl des Gasts sehen.

## Entwickeln
```
npm start            # http://localhost:5000
npm run test:sim
npm install && npm run test:browser && npm run test:online     # braucht Chrome (Variable CHROME)
npm run update:sw    # nach Änderungen an Spieldateien
```
Stellwerte in `src/config.js`, Logik in `src/sim.js` (ohne Grafik), Szene in `src/view.js`, gemeinsamer Baukasten in `src/kit/`.

## Lizenzen
three.js 0.160.0 (MIT) unter `vendor/`. Figuren, Texturen und Töne werden im Code erzeugt.
