# Lc0 Live (lokal)

Eine Brett-Seite mit Lc0 statt Stockfish. Läuft nur auf deinem Rechner.

**Start:** `start-lc0.bat` doppelklicken (oder `node lc0-server.js` und http://localhost:8791/ öffnen). Node.js muss installiert sein.

## Reiter
- **Spielen:** gegen Lc0, als Weiß, Schwarz oder Zufall. Bei den Maia-Netzen zieht die Engine „wie ein Mensch“ (nach Wahrscheinlichkeit) oder immer den besten Zug. „Hinweis“ zeigt die Lieblingszüge des Netzes als Pfeile.
- **Analyse:** FEN oder PGN laden, mit ◀ ▶ (oder Pfeiltasten) durch die Partie gehen, Züge ausprobieren (eine neue Variante ersetzt den Rest der Linie), PGN kopieren. Zeigt die Top-Züge mit Wahrscheinlichkeit; beim starken Netz auch Gewinnchance und Knoten.
- **Partie prüfen:** PGN laden, Maia bewertet jeden deiner Züge: Wie oft spielt ein Spieler dieser Stärke diesen Zug? Unter 3 % ist ein Ausrutscher, ab 10 % ein typischer Zug. Klick auf eine Zeile springt in die Stellung.

## Netze (Ordner `engine`)
| Netz | Zweck | Tempo |
|---|---|---|
| Maia 1100 / 1500 / 1900 | menschenähnliche Züge dieser Stärke | sehr schnell |
| Lc0 stark (791556) | starke Analyse | ca. 2 Sekunden pro Zug auf der CPU |

Lc0 läuft über die CPU (dnnl). Mit einer Nvidia-Grafikkarte wäre die CUDA-Version von Lc0 deutlich schneller: von https://github.com/LeelaChessZero/lc0/releases laden und den Inhalt von `engine` ersetzen.

## Test
`NODE_PATH=<puppeteer-core> node test-lc0.js` (Server muss laufen).

## Von GitHub Pages aus nutzen
Die Seite unter `https://babybounce500.github.io/chess-run-review/lc0-live/` ist nur die Oberfläche. Die Engine läuft bei dir: Starte `start-lc0.bat` aus dem lokalen Ordner `lc0-live` (dort liegen `lc0.exe` und die Netze im Ordner `engine`), dann kann die Pages-Seite sie über `http://127.0.0.1:8791` erreichen. Der Server akzeptiert nur Anfragen von localhost und von `babybounce500.github.io`. Ohne laufenden Server zeigt die Seite eine Meldung.

Nicht im Repo (zu groß, eigene Lizenzen): `lc0.exe`, DLLs und die Netze. Lc0: https://github.com/LeelaChessZero/lc0/releases (Version 0.32.1, `windows-cpu-dnnl`). Maia-Netze: https://github.com/CSSLab/maia-chess.
