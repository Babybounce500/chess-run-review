# Änderungsprotokoll

## 2026-11-26 (Analysebrett in Orbitron, Review und Media Queries)
- Neuer Reiter **Analysebrett** in der Orbitron-Sidebar: schnelle Engine, Stellungen bauen, Gesamtanalyse. Eigener Rahmen, offline nutzbar, Direktlink `#/analysebrett`. Während einer Duellpartie gesperrt.
- Review: Umwandlung wählbar, Schutz bei Engine-Absturz, laufende Analyse pausiert im Hintergrund und endet nach 60 s, Zusatz-Arbeiter werden beendet.
- Layouts für Handy hochkant und quer, Tablet, Laptop und große Bildschirme.


## 2026-11-26 (Engine-Labor: Brett repariert, Stellungen bauen)
- Alle Felder sind gleich groß (leere Reihen fielen zusammen). Das Brett wird bei laufender Analyse nicht mehr neu aufgebaut, Klicks und Züge gehen nicht mehr verloren.
- **Stellung bauen:** Figuren vom Rand aufs Brett ziehen oder antippen, frei verschieben, entfernen; Zugrecht, Rochaden, FEN, Prüfung auf ungültige Stellungen, sofortige Analyse.


## 2026-11-26 (Engine-Labor zum Testen)
- Neue eigenständige Testseite `engine/`: Stockfish 10 als WebAssembly gegen die bisherige Fassung, Live-Analyse, schnelle Gesamtanalyse mit parallelen Arbeitern und Fehlerurteilen, Vergleich an Matt- und Patzer-Stellungen. Orbitron ist unverändert.


## 2026-11-26 (PWA-Feinschliff)
- App-Symbole als PNG (192, 512, maskable), Schnellzugriffe auf Duell, Chat und Training, deutsche Beschreibung.
- Stockfish und die anderen mitgelieferten Bibliotheken kommen sofort aus dem Speicher, auch bei schwachem Netz.
- Chat zeigt den richtigen Fenstertitel, Duell-PGN trägt den neuen Namen.


## 2026-11-25 (Offline-Fähigkeit repariert)
- Die drei Apps räumen nur noch ihre **eigenen** Speicher auf (vorher löschten Chat und Orbitron sich gegenseitig).
- Bibliotheken (chess.js, Stockfish, Symbole, Schriften, weitere) werden **mitgeliefert** statt von fremden Servern geladen (`orbitron/vendor/`, Lizenzen in `vendor/LICENSES.md`).
- Vollständige Speicherliste beim Bauen erzeugt, nie eine Seite als Ersatz für Skripte oder Bilder, klare Offline-Seite.
- Duell hat Manifest und eigenen Offline-Speicher; Anzeige „Offline bereit“; Offline-Test `tests/offline-test.js`.


## 2026-11-25 (Duell: neue Figuren und Holzbrett zum Testen)
- Unter „Aussehen“ zusätzlich die Figuren **Orbitron Flat** und das Brett **Holz** mit Texturen. Der bisherige Satz bleibt Standard. Felder und Notation zeichnet weiter der Code.


## 2026-11-25 (Duell: Archiv, Bilanz, Analyse, Aussehen; Chat: Weiterleiten, Sprachtempo)
- **Duell:** Beendete Partien werden lokal archiviert. Bilanz pro Freund in der Lobby und im Spiel. „In Orbitron analysieren“ nach der Partie (neuer Chat mit der PGN). Brettfarben passend zu den Orbitron-Themes und Figurensatz wählbar.
- **Chat:** Nachrichten, Bilder und Dateien weiterleiten (auch an mehrere Gespräche und Räume). Sprachnachrichten mit 1×, 1,5×, 2× oder 0,75× abspielen.


## 2026-11-24 (Orbitron-Marke für Duell und Chat)
- **Einheitliches Aussehen:** Duell und Chat tragen jetzt das Orbitron-Design (Farben, Schrift, Kapselknöpfe, Wortmarke mit Springer). Die drei Themes Hell, Dunkel und Neural stammen aus der App, die Wahl wird geteilt (gleicher Speicherschlüssel) und wechselt live mit. Die Schrift ist eingebettet, es gibt keine Anfrage an Schrift-Server. Eine Quelle (`brand/`), eingespielt mit `scripts/sync-brand.mjs`, geprüft von `tests/brand-test.js`.


## 2026-11-24 (Orbitron: Chat & Anrufe)
- **Reiter „Chat & Anrufe“** direkt unter „Online Duell“ in der Orbitron-Sidebar. Eigener Rahmen: Verbindung, Anruf und Duell laufen beim Schließen und Wechseln weiter. Abzeichen zeigt „n online“, „💬 n“ bei ungelesenen Nachrichten und „📞 Anruf“. Ein eingehender Anruf öffnet das Fenster von selbst. Direktlink `#/chat`, Befehl `/chat`.


## 2026-11-24 (Chat-Test: Quick Wins)
- **Bildschirm bleibt im Anruf an**, Warnung beim Schließen während Anruf oder Übertragung, Verbindungsbalken (Ping, Paketverlust) an jeder Kachel, Geräte wählen (Mikrofon, Kamera, Lautsprecher).
- **Speicherschutz** mit Hinweisleiste und **verschlüsseltes Backup** (Passwort, AES-GCM) inklusive Schlüssel, Einspielen in ein frisches Profil.
- **QR-Code** für Einladung und Antwort (eigener Encoder). **Installierbar** als App (Manifest, Symbole, Service Worker, startet auch offline).


## 2026-11-24 (Chat-Test: Anrufe)
- **Audio-, Video- und Bildschirmanrufe** im Chat-Test, einzeln und in Räumen, ohne Server und ohne neuen Code-Austausch (die Absprache läuft über den bestehenden Datenkanal). Klingeln, Annehmen, Besetzt, Verpasst; Kachelraster mit Sprecher-Hervorhebung; Mikrofon stumm, Kamera an/aus und wechseln, Bildschirm teilen (nur Rechner), Datensparen, Vollbild, Minimieren. Bildqualität sinkt automatisch mit der Zahl der Teilnehmer (720p bei 2 bis 180p bei 8). Handy hochkant und quer, Tablet, 320 px.

## 2026-11-24 (Chat-Test: Gruppenräume)
- **Gruppenräume** bis 8 Personen, ohne Server. Wer neu dazukommt, braucht nur eine Verbindung zu einem Mitglied, die Verbindungen zu allen anderen entstehen von selbst (signierte Verbindungsdaten werden über bestehende Kanäle weitergereicht). Absendernamen, Antworten, Reaktionen mit Zähler, Löschen für alle, Bilder und Dateien an jedes Mitglied, Ausgangsfach pro Mitglied, Verlauf der letzten 30 Textnachrichten für Neue, Mitgliederliste, Direkteinladung verbundener Kontakte, Raum verlassen.

## 2026-11-24 (Chat-Test: Messenger in einer Datei)
- **Chat-Test:** eigenständiger Browser-Messenger in einer einzigen Datei, ohne Server (`chat/`). Text, Links, Bilder, Dateien bis 50 MB mit Fortschritt, Sprachnachrichten, Antworten, Reaktionen, Löschen, Suche, Haken, Verlauf auf dem Gerät (IndexedDB), Ausgangsfach für Offline-Nachrichten. Verbindung per Link und Antwort-Code, signiert mit Schlüsselpaar, Sicherheitscode wie bei Signal. Handy hochkant und quer, Tablet, Dunkelmodus. Beide müssen online sein, kein Push, keine Gruppen.

## 2026-11-24 (Online Duell: Chat)
- **Chat im Duell:** Textnachrichten direkt zwischen den beiden Browsern (kein Server liest mit), Schnellantworten, Stumm-Schalter, Zähler für Ungelesenes, Verlauf nur im eigenen Browser. Der Orbitron-Reiter zeigt „💬 n“, solange das Duell-Fenster ausgeblendet ist. Nachrichten werden nur als Text angezeigt, auf 300 Zeichen gekürzt und auf 8 pro 10 Sekunden begrenzt.

## 2026-11-24 (Orbitron: Online Duell)
- **Online Duell:** neuer Reiter ganz oben in der Sidebar. Freundespartien direkt von Browser zu Browser (WebRTC), Bedenkzeit 1+0 bis 15+10, Aufgeben, Remis, Revanche, PGN-Export. Ohne Server: Link und Antwort-Code per Chat austauschen. Direktlink `#/duell`, Chat-Befehl `/duell`. Die Partie läuft weiter, wenn das Fenster geschlossen wird.
- Brett und Figuren wie in Orbitron, Figuren ziehen per Maus und Finger, Brett drehen, Zugton, Teilen-Knopf, Bildschirm bleibt wach. Einklappbare Seitenleiste, Neustart-Knopf, Notausgang `duell/?reset=1`.
- Handy hochkant und quer, Tablet und sehr schmale Bildschirme geprüft.
- Eigenständig erreichbar unter `/duell/`. Kein Betrugsschutz, keine Wertung.

## 2026-11-23 (Orbitron: Matt-Tempo)
- **Matt-Tempo:** 99 Aufgaben aus verpassten erzwungenen Matts (Matt in 1 bis 4) in den letzten Bullet- und Blitz-Partien, mit knapper Uhr (5 bis 15 Sekunden). Direktlink `#/tempo`, Station im Tagesplan.

## 2026-11-23 (Orbitron: Eröffnungs-Labor, Sicherung, Wann Fehler)
- **Eröffnungs-Labor und Ampel:** je Farbe 62 Eröffnungen mit Form der letzten 30 Partien (grün, gelb, rot), Ergebnis nach Variante, Bewertung nach Zug 10 und 168 wiederkehrende Fehlerstellungen als Übung. Direktlink `#/labor`.
- **Sichern und Wiederherstellen:** Fortschritt als Datei sichern und laden. Direktlink `#/sicherung`.
- **Wann Fehler:** große Patzer nach Zugnummer, neuer Reiter im Rating-Hebel (`#/wann`).

## 2026-11-23 (Orbitron: Auto-Coach)
- **Auto-Coach:** holt neue Chess.com-Partien über die öffentliche Schnittstelle und zählt sie in Rating-Hebel und Mattbild-Atlas. Stockfish im Browser analysiert die neuesten 6 bis 50 Partien und macht daraus neue Aufgaben (Fehler, Bullet, verpasste Matts, Zeitnot). Alles bleibt im Browser. Direktlink `#/coach`.

## 2026-11-22 (Orbitron: Drohungs-Scanner)
- **Drohungs-Scanner:** Stellungen aus eigenen Partien kurz vor einem Patzer. In 3 bis 12 Sekunden antippen, was hängt (eigene und gegnerische Figuren) und ob Matt droht, 10 Runden pro Lauf mit Auswertung. Direktlink `#/scanner`, Station im Tagesplan.

## 2026-11-22 (Orbitron: Rating-Hebel, Wochenfokus, Mattbild-Atlas)
- **Rating-Hebel:** zeigt, welche Schwäche dich am meisten Rating kostet (Zeit, Grundreihe, Damenmatt, Turm-Matt, Aufgabe), je Zeitklasse und Zeitraum, mit grober Elo-Schätzung. Direktlink `#/hebel`.
- **Wochenfokus:** ein Fokus pro Woche mit Messung der Erfolgsquote, erscheint im Tagesplan.
- **Mattbild-Atlas:** 16 Mattfiguren, gesetzt gegen erlitten, mit Knopf zur passenden Übung. Direktlink `#/mattbild`.

## 2026-11-22 (Orbitron: Matt-Figuren)
- **Matt-Figuren:** 355 Aufgaben aus eigenen Partien. Matt setzen (Grundreihe, Turm, Abzug, Doppelschach, Springer, Läufer, Bauer, erstickt, Schäfermatt) und Matt verhindern (Verteidigung mit Stockfish geprüft). Direktlink `#/mattfiguren`, auch als Station im Tagesplan.

## 2026-11-22 (Orbitron: Damenmatt-Muster)
- **Damenmatt-Muster:** 470 Aufgaben aus eigenen Partien, die mit einem Damenmatt endeten (meist Matt in 2), sortiert nach Muster: Dame und Läufer auf der Diagonale, Matt auf dem Fianchetto-Feld, Matt auf der 7. Reihe, Grundreihenmatt. Direktlink `#/damenmatt`, auch als Station im Tagesplan.

## 2026-11-22 (Orbitron: Taktik-Muster, Endspiel-Grundlagen, Ausspielen)
- **Taktik-Muster:** 161 Aufgaben aus eigenen Partien, in denen der beste Zug ein klares Muster war (Gabel, Spieß, Fesselung, Abzug, hängende Figur). Muster werden automatisch erkannt und mit einer Materialprobe bestätigt, die Züge sind mit Stockfish geprüft.
- **Endspiel-Grundlagen:** 14 Lehrbuchstellungen (Lucena, Philidor, Schlüsselfeld und Opposition, Springer gegen Randbauer, Turm gegen Bauer, Leitermatt, Kasten-Methode), jeweils mit Erklärung.
- **Stellung ausspielen:** Jede Aufgabe lässt sich gegen Stockfish (einstellbare Stärke) zu Ende spielen, mit Tipp, Zug zurück und Auswertung (Ziel erreicht, größter Einbruch). Direktlinks: `#/taktik`, `#/grundlagen`, `#/ausspielen`.

## 2026-11-22 (Orbitron: neue Trainingsbereiche)
- **Orbitron-Live (Pfad /orbitron/):** Das Training-Menü hat jetzt 13 Bereiche: Tagesplan mit Wiederholungsplan und Serie, Fehler-Trainer, Bullet-Aufgaben, Opfer-Trainer, Zeitnot-Trainer und Mattjäger (jeweils mit Uhr), Endspiel-Fehler (nur Endspiele, auch lange Turmendspiele), Eröffnungs-Prüfer mit Buchzügen (Lichess-ECO), Eröffnungs-Fallen (stellen und erkennen), Zeit-Heatmap (Zeit pro Zug, Bullet und Blitz getrennt) und Session-Wächter.
- Jeder Bereich hat einen Direktlink (zum Beispiel `gemini-chat.html#/zeit`, `#/heute`, `#/fallen`) und einen Chat-Befehl (`/zeit`, `/heute`, `/fallen`, `/endspielfehler`, `/zeitnot`, `/matt`, `/opfer`, `/repertoire`).
- Aufgabenlisten lassen sich als PGN exportieren (Knopf „PGN“), zum Beispiel für eine Lichess-Studie.
- Alle Aufgaben wurden mit Stockfish geprüft. Der Browser-Test (`tests/train-test.js`, `tests/smoke-new.js`) deckt alle Bereiche am Desktop und in Handy-Breite ab.

## 2026-11-09 (Aktualisierung)
- 17 weitere Partien vom 08. und 09.11. mit Stockfish ausgewertet und eingerechnet. Jetzt **3091 Partien**, 1530–118–1443. Zeitprofil, Gewinnzüge, Eröffnungen/Endspiele und Chess.com-Gesamtübersicht sind neu berechnet.

## 2026-11-08 (Zeitprofil, Fehler-Trainer, Chess.com in Orbitron)
- **Neu: [docs/ZEITPROFIL.md](docs/ZEITPROFIL.md):** Bedenkzeit pro Zug und Phase aus den Uhrzeiten von 1954 Blitzpartien, verknüpft mit der Stockfish-Auswertung (Zeitverluste, Zeitvorsprung, Fehler nach Restzeit).
- **Neu: [docs/EROEFFNUNGEN-ENDSPIELE.md](docs/EROEFFNUNGEN-ENDSPIELE.md):** Stabilität jeder Eröffnung (Stand nach Zug 12, frühe Fehler, Ergebnis) und die Endspiel-Lage nach Endspielart (Eintrittsstand, Fehler, Gewinn gehalten, Zeitverluste).
- **Neu: [docs/GEWINNZUEGE.md](docs/GEWINNZUEGE.md):** welche starken Züge deine Siege entscheiden (Mattangriffe, Opfer, Doppelangriffe, Materialgewinn) und wo, mit welchen Figuren und wann die Comebacks aus schlechter Stellung kippen.
- **Orbitron-Live (Pfad /orbitron/):** Fehler-Trainer mit Aufgaben aus eigenen Partien, Trainings-Menü und „Meine Partien“ (Partien direkt von Chess.com laden und per Klick analysieren).

## 2026-11-08 (Chess.com-Gesamtarchiv)
- **Neu: [docs/CHESSCOM-GESAMT.md](docs/CHESSCOM-GESAMT.md):** alle öffentlichen Live-Partien von Chess.com (3846, 19.08.2023 bis 08.11.2026) als Zusammenfassung: Bilanz, Rating je Zeitklasse, Monatsübersicht, Endarten, häufigste Eröffnungen. Gegnernamen und Links sind nicht enthalten.
- **Bericht und Viewer auf alle Partien ab 10.08.2026 erweitert:** Die Stockfish-Analyse (Tiefe 12) der bisher fehlenden 1874 Partien wurde mit der bisherigen Auswertung zusammengeführt. Grundlage sind jetzt **3091 Partien**, 1530–118–1443, vom 10.08. bis 08.11.2026. Die Tiefe der neu hinzugekommenen Partien (12) ist etwas geringer als bei den früheren (13 bis 14), Einzelwerte können deshalb um wenige Zehntel abweichen.

## 2026-11-06 (Korrektur)
- **Mattbild-Zuordnung im Finale korrigiert:** Die erste Fassung von [docs/FINALRUN-1300.md](docs/FINALRUN-1300.md) hatte bei der Mattbild-Erkennung die Position vor dem Mattzug ausgewertet und damit den falschen König angesehen. Richtig sind 6 Grundreihenmatts mit der Dame und 1 Damenmatt (Partie 17), nicht 5 und 2.

## 2026-11-05 (sechste Aktualisierung: Finale, 1300)
- **Teil 5 bis 7 vom 05.11.** eingerechnet: Teil 5 (50 Partien, 28–1–21, Header 1100 → 1150), Teil 6 (13 Partien, 10–0–3, 1158 → 1206) und das **Finale** (20 Partien, 14–0–6, **1249 → 1303**). Die Teile 5 und 6 waren zuvor nur im Chat ausgewertet und werden hier erstmals dokumentiert.
- **Neu: [docs/FINALRUN-1300.md](docs/FINALRUN-1300.md):** Auswertung des Finales mit Schwerpunkt auf den 7 Matt-Siegen (alle mit der Dame, 6× Grundreihe).
- [docs/ELO-SPRUNG-05-11.md](docs/ELO-SPRUNG-05-11.md) und [docs/RUNS.md](docs/RUNS.md) auf alle sieben Teile erweitert.
- Jetzt **3091 Partien**, 1530–118–1443.

## 2026-11-05 (fünfte Aktualisierung)
- **Bullet-Run Teil 4 vom 05.11.** (10 Partien, 6–0–4, Rating laut Header 1078 → 1101, über 1100) eingerechnet und in [docs/RUNS.md](docs/RUNS.md) dokumentiert.
- **Neu: [docs/ELO-SPRUNG-05-11.md](docs/ELO-SPRUNG-05-11.md):** Dokumentation des Rating-Sprungs vom 05.11. (51 Bullet-Partien, 33–1–17, Header-Rating 979 → 1101) mit Verlaufsgrafik.
- Jetzt **3091 Partien**, 1530–118–1443.

## 2026-11-05 (vierte Aktualisierung)
- **Bullet-Run Teil 3 vom 05.11.** (23 Partien, 13–1–9, Rating laut Header 1045 → 1086, **Höchstwert 1094**, neuer Bestwert) eingerechnet und in [docs/RUNS.md](docs/RUNS.md) dokumentiert.
- Damals 1071 Partien.

## 2026-11-05 (dritte Aktualisierung)
- **Bullet-Run Teil 2 vom 05.11.** (11 Partien, 8–0–3, Rating laut Header 1021 → 1053, Höchstwert 1053) eingerechnet und in [docs/RUNS.md](docs/RUNS.md) dokumentiert (Run vom 05.11. jetzt in zwei Teilen).
- Damals 1048 Partien.

## 2026-11-05 (zweite Aktualisierung)
- **Bullet-Run vom 05.11.** (7 Partien, 6–0–1, Rating laut Header 979 → 1012, Höchstwert 1020) eingerechnet und in [docs/RUNS.md](docs/RUNS.md) dokumentiert; dort auch der Run vom 04.11.
- Damals 1037 Partien.

## 2026-11-05
- Fünf neue Live-Partien eingerechnet (damals 1030 Partien). Zwei Siege durch Gegnerfehler bzw. Zeit, ein Remis durch Timeout gegen ungenügendes Material, ein Matt nach Springeropfer und ein Remis durch Patt aus verlorener Stellung (Matt in 4 für den Gegner).
- Remis-Aufteilung berechnet statt fest eingetragen: Patt 22, Stellungswiederholung 36, Zeit + zu wenig Material 47, zu wenig Material 2.
- Dokumentation (README, dieses Protokoll) ergänzt.

## 2026-11-04
- **Erstanalyse** von 200, dann 999 Partien; Bericht erstellt und über GitHub Pages veröffentlicht.
- **Musterpartien-Viewer:** 17 Stockfish-Partien, Eröffnungs-Check, 28 Lehrpositionen, Mittelspiel-Regeln. Brett-Darstellung korrigiert (feste Zeilenhöhe, Text-Glyphen).
- **Matt & Taktik:** 11 Mattbilder und 4 Taktik-Muster (Stockfish-geprüft), eigene und verpasste Matts. Zwei Beispiele (Philidor, Bauerngabel) entfernt, weil sie nicht belegbar waren.
- **Konterspiel, Engine-Duelle** (Stockfish 19 gegen Lc0/Berserk), **Michail Tal** (20 Partien), **Computer-Turnier** (9 Engines, 36 Partien, Stichkampf: Stockfish 19 gewinnt), **Bauernsturm** (9 Partien), **Claude gegen Stockfish**.
- 26 neue Partien (17 Live-Partien, 9 Bullet) eingerechnet: 1025 Partien; feste Zahlen im Bericht und Viewer durch berechnete ersetzt; Rating-Endwerte korrigiert (Bullet 1003).
- GothamChess-Daten wurden beschafft, aber **nicht veröffentlicht** (Nutzungsbedingungen).

### Korrekturen gegenüber früheren Aussagen
- Duelle Stockfish gegen Lc0: Stockfish gewann alle 6 Partien (zuerst fälschlich als „Lc0 gewinnt 2“ berichtet, Farben verwechselt).
- Tageszeit: Nur 23 Uhr UTC ist deutlich schwächer (36 %), nicht „ab 22 Uhr“.
- Remis-Aufteilung: 7 Wiederholungen und 2 ungenügendes Material (nicht 8 und 1).
- Bullet-Rating: Der Bericht zeigte zunächst 995/970 statt des tatsächlichen Endwerts 1003.
