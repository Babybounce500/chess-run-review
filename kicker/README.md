# Neon Kicker

Tischfußball im Neonlicht: gegen den Computer (drei Stufen) oder direkt gegen Freunde, am Handy und am Rechner.
Läuft komplett im Browser, auch ohne Netz. Keine Dienste, keine Konten, keine nachgeladenen Dateien.

## Starten

```
node server.js          # dann http://localhost:5000
```

## Spielregeln

- Fünf Tore gewinnen.
- Nach drei Minuten zählt die Führung. Bei Gleichstand läuft das Golden Goal (höchstens eine Minute), danach unentschieden.
- Bleibt der Ball liegen, unerreichbar oder lange im selben Bereich, wird neu eingeworfen.
- Ein geklemmter Ball wird nach zwei Sekunden von selbst frei.

## Steuerung

| Aktion | Handy | Tastatur | Maus | Gamepad |
|---|---|---|---|---|
| Stange schieben | irgendwo ziehen (relativ, 1:1) | Pfeile oder WASD | ziehen | linker Stick |
| Schießen | nach vorn wischen, SCHUSS, Tipp mit zweitem Finger | Leertaste oder J (halten = härter) | klicken oder nach vorn wischen | A |
| Ausholen | zurückziehen, loslassen schießt | Leertaste halten | zurückziehen | A halten |
| Klemmen / Passen | KLEMMEN halten, seitlich schieben, loslassen | Shift oder K | rechte Taste | X |
| Stange wählen | Leiste oder Tipp auf die Stange | Q / E, 1 bis 4 | Klick, Mausrad | LB / RB |

Die Stange wählt sich automatisch (abschaltbar im Menü und in der Pause). Eine Handwahl gilt 2,5 Sekunden.
Nicht gewählte eigene Stangen laufen langsam mit dem Ball mit und heben die Figuren, wenn ein eigener Schuss von hinten kommt.
Das gilt für beide Seiten.

## Online

„Freund herausfordern“ erzeugt einen Einladungslink. Der Freund öffnet ihn, schickt den Antwort-Code zurück, fertig.
Die Verbindung läuft direkt zwischen den Browsern, der Gastgeber rechnet das Spiel. In sehr strengen Netzen klappt die Direktverbindung nicht.
Jeder sieht sein Tor unten (Hochformat) beziehungsweise links (Querformat); die Anzeige dreht sich mit.

## Aufbau

```
src/config.js   alle Stellwerte (Physik, Regeln, Computergegner, Eingabe)
src/sim.js      reine Logik: Physik, Regeln, Computergegner, Netzdaten (läuft auch in Node)
src/view.js     3D-Szene, Figuren, Effekte, Kamera
src/input.js    Ziehfläche, Wischen, Knöpfe, automatische Stangenwahl
src/hud.js      Stangenleiste, Uhr, Hinweise
src/sounds.js   erzeugte Töne
src/main.js     Verdrahtung
src/kit/*       gemeinsamer Baukasten (Menü, Online, Steuerung, Ton)
```

## Prüfen

```
node tests/sim-test.mjs          Physik, Regeln, Computergegner, Netzdaten
node tests/browser-test.mjs      Eingaben, Bildschirmgrößen, Offline (unsichtbarer Chrome)
node tests/online-test.mjs       zwei Browser spielen gegeneinander
```

`SHOT_DIR=<ordner>` speichert Bildschirmfotos. Nach Änderungen an Spieldateien: `npm run update:sw`.

three.js (Ordner `vendor/`) steht unter der MIT-Lizenz, siehe `vendor/THREE-LICENSE.txt`.
