# Neon Bay

Stilisierte Küstenstadt im Browser. **Stand: Phase 1 „Fahren und Stadt“.** Noch ohne Verkehr, Passanten, Fahndung und Aufträge.

## Starten
```
npm start          # http://localhost:5000
```
Kein Build-Schritt, keine fremden Dateien zur Laufzeit. Nach dem ersten Laden auch offline.

## Was drin ist
- Ein Viertel von rund 600 × 600 m, aus einem Startwert erzeugt: Straßennetz mit Allee und Strandstraße, Hochhäuser, Altstadt, Plätze, Parkplätze, Promenade mit Strand, Hafen mit Becken, Steg, Containern und Kran.
- Zu Fuß: gehen, sprinten, springen.
- Ein fahrbares Auto (erfundene „Brandung GT“): Gas, Bremse, Rückwärtsgang, Handbremse/Drift, Kollision, Schaden (kostet Leistung, nie alles).
- Geparkte Autos als Hindernisse, die man anstoßen kann.
- Verfolgerkamera, drehbare Minikarte, Speicherstand auf dem Gerät.

## Steuerung
| Aktion | Handy | Tastatur | Gamepad |
|---|---|---|---|
| Laufen / Lenken | Stick links | WASD, Pfeile | linker Stick |
| Sprinten | SPRINT halten | Umschalt | B oder RT |
| Springen | SPRUNG | Leertaste | A |
| Ein- und Aussteigen | Knopf (nur wenn möglich) | E, F, Enter | Y |
| Gas / Bremse und rückwärts | GAS / BREMSE | W / S | RT / LT |
| Handbremse (Drift) | DRIFT | Leertaste | A oder RB |
| Hupe | | H | X |
| Umschauen | über das Bild ziehen | Maus ziehen, J / L | rechter Stick |
| Pause | ⏸ | Esc, P | Start |

Minikarte antippen vergrößert sie. Falls das Auto weg oder kaputt ist: Pause → „Auto herholen und reparieren“.

## Einstellungen
- **Ton:** nur bei Ereignissen (Tür, Aufprall, Quietschen, Sprung, Hupe).
- **Motor:** Motorgeräusch beim Fahren, standardmäßig aus.
- **Grafik:** Auto, Niedrig, Mittel, Hoch. „Auto“ beginnt am Handy mit Mittel und geht bei zu niedriger Bildrate eine Stufe herunter.

## Aufbau
| Datei | Inhalt |
|---|---|
| `src/config.js` | Stellwerte (Fahrphysik, Stadt, Qualität) |
| `src/world.js` | Stadt aus dem Startwert, Kollisionsgitter |
| `src/vehicles.js`, `src/player.js`, `src/sim.js` | Fahrphysik, Figur, Regeln, Speicherstand (ohne DOM/Grafik, 60 Hz) |
| `src/camera.js` | Kamerarechnung (ohne Grafik) |
| `src/view.js`, `citymesh.js`, `models.js`, `textures.js`, `environment.js`, `effects.js`, `geo.js` | 3D-Szene |
| `src/minimap.js`, `src/main.js`, `src/kit/` | Anzeige, Verdrahtung, angepasster Baukasten |

## Prüfen
Braucht `puppeteer-core` (vorhandenes `node_modules` per `NODE_PATH` nutzen) und Chrome (Variable `CHROME`).
```
node tests/sim-test.mjs        # Logik: 1.000 Zufallsfahrten, Erreichbarkeit, Aussteigen, Kamera
node tests/browser-test.mjs    # Bedienung, Layouts, Speichern, offline (Fotos mit SHOT_DIR=<ordner>)
node tests/perf-test.mjs       # Zeichenaufrufe und Bildrate an der dichtesten Stelle
npm run update:sw              # nach Änderungen
```
Für Tests gibt es den Zusatz `?test` in der Adresse (Lagen setzen, Messwerte).

three.js 0.160.0 (MIT) unter `vendor/`.
