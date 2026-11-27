# Eleven Nights

Fußball elf gegen elf im Browser. **Stand: Phase 1 „Platz und Ball“.** Alle Namen sind erfunden.

## Was drin ist
- 11 gegen 11 in 4-4-2 mit Rollen, die mit dem Ball wandern; höchstens ein Spieler presst, höchstens einer sichert, zwei bis drei bieten sich an.
- Ballphysik mit Rollen, Aufspringen, Pfosten und Latte.
- Kurzpass, Steilpass, Schuss mit Ladebalken, Sprint mit Ausdauer, automatischer und manueller Spielerwechsel.
- Zweikampf (Antippen, von selbst bei Nähe) und Grätsche, Kopfbälle, Torwart (Stellungsspiel, Paraden, Fangen, Herauslaufen, Abwurf).
- Anstoß, Einwurf, Ecke, Abstoß (vereinfacht). Zwei Halbzeiten zu je drei Minuten mit Seitenwechsel.
- Computergegner in drei Stufen. Sie unterscheiden sich in Reaktionszeit und Entscheidungsgüte, nicht im Tempo.
- Fernsehkamera (quer von der Seite, hochkant längs), Radar, Spielstand, Uhr, Halbzeit- und Endstatistik.

Noch nicht drin (spätere Phasen): Online-Duell (Knöpfe ausgeblendet), Abseits, Fouls, Karten, Freistoß, Elfmeter, Nachspielzeit, Flanke, Finte, Effet, Wiederholungen, Publikumskommentar, Karriere.

## Steuerung
| Aktion | Handy | Tastatur | Gamepad |
|---|---|---|---|
| Laufen / Zielen | Stick links | WASD oder Pfeile | linker Stick |
| Pass (halten = weiter) / ohne Ball: Druck, antippen = Zweikampf | PASS / DRUCK | J | A |
| Steilpass | PASS nach oben wischen | I | Y |
| Schuss (halten = stärker) / ohne Ball: Grätsche | SCHUSS / GRÄTSCHE | K | B |
| Sprint | SPRINT | Shift | RT |
| Spielerwechsel | WECHSEL | Leertaste | LB |
| Pause | ⏸ | Esc | |

Ohne Eingabe läuft der geführte Spieler mit der Mannschaft mit. Standards führt nach 6 s der Computer aus.

## Messwerte Phase 1 (27.11.2026)
500 Spiele Computer gegen Computer: keine Hänger, 3,69 Tore je Spiel, Passquote 72,9 %, größtes Netzpaket 981 Byte, im Mittel höchstens 3,3 Feldspieler in 10 m um den Ball.
Stufen (je 100 Spiele, Siege : Niederlagen): schwer gegen leicht 93 : 1, schwer gegen normal 70 : 9, normal gegen leicht 70 : 16.
Headless-Chrome auf Intel HD 5500: 59,5 bis 60 Bilder/s, 21 bis 23 Zeichenaufrufe.

## Entwickeln
```
npm start                          # http://localhost:5000
node tests/sim-test.mjs            # Regeltests
node tests/match-test.mjs          # 500 Spiele Computer gegen Computer (etwa 3 Minuten)
node tests/browser-test.mjs        # headless, braucht puppeteer-core (NODE_PATH) und Chrome (Variable CHROME)
node tools/measure.mjs 20 hard easy
npm run update:sw                  # nach Änderungen
```
Bildschirmfotos: Variable `SHOT_DIR` setzen.

Stellwerte in `src/config.js`, Logik in `src/sim.js` (ohne Grafik und DOM, 60 Hz, Zufall nur aus dem Startwert), Szene in `src/view.js`, Anzeige in `src/hud.js`, Verdrahtung in `src/main.js`, Baukasten unverändert in `src/kit/`.

three.js 0.160.0 (MIT) unter `vendor/`.
