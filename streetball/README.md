# Blacktop Hoops

Straßenbasketball 1 gegen 1 im Browser: gegen den Computer (drei Stufen) oder online gegen einen Freund. Bis 11 Punkte.
Keine Installation nötig, keine fremden Server, Dateien oder Schriften. Läuft nach dem ersten Laden auch ohne Netz.

## Starten

    node server.js          (Port: $PORT oder 5000)

Dann `http://localhost:5000` öffnen. Jeder andere statische Webserver geht auch.

## Steuerung

| Aktion | Touch | Tastatur | Gamepad |
|---|---|---|---|
| Laufen | Stick links | Pfeile / WASD | linker Stick |
| Wurf (halten und loslassen) / Block / Sprung | großer Knopf | Leertaste / J | A |
| Trick / Klauen | mittlerer Knopf | K / E | X |
| Sprint | oberer Knopf | Umschalt / L | RT |
| Pause | Pausenknopf | Esc | – |

## Regeln

- **Wurf:** WURF halten, in der grünen Zone loslassen. Die Zone wird kleiner mit Abstand, eigenem Tempo, Gegnerdruck und leerer Ausdauer.
  Kurz antippen ist eine Wurffinte. Wird der Anzeigebalken voll, geht der Wurf von selbst raus.
- **Korbnähe:** Ein Druck genügt für den Korbleger. Im Sprint auf den Korb zu wird daraus ein Dunk.
- **Trick:** Ausbrechen zur Seite oder Schritt zurück (Stick nach hinten). Wer beim Gegner in die falsche Richtung läuft, bleibt stehen.
- **Klauen:** klappt nur, wenn der Ball unten (oder beim Handwechsel vorn) ist, in Reichweite und nicht vom Körper abgeschirmt.
  Daneben greifen kostet Zeit. Ein Trick im selben Moment schlägt den Griff.
- **Block:** Absprung so, dass die Hand beim Abwurf noch steigt oder oben ist.
- **Punkte:** innerhalb der Linie 2, dahinter 3. Nach einem Korb bekommt der andere den Ball (Check am Bogen).
- **Befreien:** Nach Ballgewinn (Klau, Defensivrebound) erst hinter die Dreierlinie, sie leuchtet dann.
- **Wurfuhr** 14 Sekunden. **Spielzeit** 3 Minuten; danach gewinnt der Führende, bei Gleichstand zählt der nächste Korb (45 s), sonst unentschieden.

## Online

Gastgeber: „Freund herausfordern“, Link verschicken, Antwort-Code des Freundes einfügen. Die Verbindung läuft direkt zwischen den
Browsern (WebRTC); der Gastgeber rechnet das Spiel. Für den Verbindungsaufbau wird ein öffentlicher STUN-Dienst angefragt.
In strengen Netzen (ohne Vermittlungsserver) kann die Direktverbindung scheitern. Kein Betrugsschutz.

## Aufbau

    src/config.js   Stellwerte          src/sim.js     Spielregeln und Ballphysik (ohne DOM)
    src/cpu.js      Computergegner      src/math.js    Rechenhilfen
    src/view.js     Szene und Kamera    src/court.js   Platz, Kulisse, Korb mit Netz
    src/figure.js   Gelenkfiguren       src/hud.js     Anzeigen an den Figuren
    src/feedback.js Töne, Banner, Knopfbeschriftung    src/sounds.js  Klänge
    src/main.js     Verdrahtung         src/kit/*      gemeinsamer Baukasten (nicht ändern)

Nach Änderungen: `npm run update:sw`.

## Prüfen

    node tests/sim-test.mjs
    node tests/browser-test.mjs      (unsichtbarer Chrome, braucht node_modules/puppeteer-core)
    node tests/online-test.mjs

Mit `SHOT_DIR=<Ordner>` entstehen Bildschirmfotos. `?speed=` beschleunigt nur für Tests.

three.js 0.160.0 (MIT-Lizenz, siehe `vendor/THREE-LICENSE.txt`).
