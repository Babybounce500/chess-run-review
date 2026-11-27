# Cage Penalty

Elfmeterschießen im Browser: gegen den Computer oder gegen einen Freund. Fünf Schüsse je Seite, danach K.-o.-Runde.

**Spielen:** https://babybounce500.github.io/monolith-penalty/

## Bedienung

| | Finger / Maus | Tastatur | Gamepad |
|---|---|---|---|
| Schießen | Zum Tor wischen: Richtung zielt, Tempo ist Kraft, Bogen gibt Effet | Pfeile oder WASD zielen, Leertaste halten und loslassen | Linker Stick zielt, A halten und loslassen, rechter Stick Effet |
| Halten | Aufs Tor tippen | Q W E oben, A S D unten | Stick wählt, A springt |

Grüne Zone der Kraft: genau. Darunter weich, darüber mit Streuung und oft drüber.

## Online gegen Freunde

1. „Freund herausfordern“, den Link verschicken.
2. Der Freund öffnet ihn, tippt „Annehmen“ und schickt seinen Antwort-Code zurück.
3. Code einfügen, „Verbinden“.

Die Verbindung läuft direkt zwischen den Browsern (WebRTC). Schütze und Torwart legen **verdeckt** fest: Zuerst geht nur eine Prüfsumme hinüber,
dann die Wahl. Die Streuung entsteht aus zwei Zufallszahlen, je eine von jedem Spieler. Online springt der Torwart immer beim Schuss ab.

Grenzen: kein Ersatzserver (TURN), in strengen Netzen kommt keine Verbindung zustande. Ein veränderter Client wird bei falschen Prüfsummen erkannt,
sonst gibt es keinen Betrugsschutz. Eine abgerissene Verbindung beendet die Partie.

## Entwickeln

```
npm start          # http://localhost:5000
npm test           # Spiellogik und Wischgesten (ohne Browser)
npm install && npm run test:browser && npm run test:online     # braucht Chrome (Variable CHROME)
npm run update:sw  # nach jeder Änderung an Dateien der Seite
```

| Datei | Aufgabe |
|---|---|
| `src/config.js` | alle Stellwerte (Kraft, Streuung, Torwart, Computerstärke) |
| `src/sim.js` | reine Spiellogik: Ballbahn, Parade, Regeln, Computergegner |
| `src/view.js` | 3D-Szene, Figuren, Animationen, Kameras |
| `src/input.js` | Wischen, Tippen, Tastatur, Gamepad |
| `src/audio.js` | im Browser erzeugte Töne, Vibration |
| `src/net.js` | Direktverbindung („Monolith Net“, für weitere Spiele wiederverwendbar) |
| `src/main.js` | Ablauf, Menüs, Online-Protokoll, Chat |

Jeder Schuss wird vollständig vorberechnet. Die Bildrate ändert deshalb nichts am Ergebnis.
In `sim.js` nur `+ - * /` und `Math.sqrt` verwenden, damit alle Browser bitgleich rechnen (ein Test prüft das).

## Lizenzen

three.js 0.160.0 (MIT), liegt unter `vendor/` mit Lizenztext. Alle Figuren, Texturen und Töne werden im Code erzeugt.
