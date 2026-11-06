/* Shared, source-of-truth chess state for gemini-player.html.
 * Every opponent produces a candidate; chess.js is the only authority that
 * may commit a move to the game.
 */
(function (global) {
  'use strict';

  const OPENING_TRANSITIONS = {
    '': ['e4', 'd4', 'Nf3', 'c4'],
    'e4': ['e5', 'c5', 'e6', 'c6', 'd6'],
    'e4 e5': ['Nf3', 'Nc3', 'Bc4', 'f4'],
    'e4 c5': ['Nf3', 'Nc3', 'c3'],
    'd4': ['d5', 'Nf6', 'e6'],
    'd4 d5': ['c4', 'Nf3', 'Bg5', 'e3'],
    'Nf3': ['d5', 'Nf6', 'c5', 'e5'],
    'c4': ['e5', 'Nf6', 'c5', 'e6']
  };

  function normalize(text) {
    return String(text || '').trim().replace(/[–—→]/g, '-').replace(/\s+/g, ' ');
  }

  class ChessPlayerCore {
    constructor({ onChange } = {}) {
      this.onChange = onChange || function () {};
      this.reset();
    }

    reset(fen) {
      this.game = new global.Chess(fen || undefined);
      this.moves = [];
      this.lastError = '';
      this.emit();
    }

    loadPgn(pgn) {
      const loaded = new global.Chess();
      if (!loaded.load_pgn(String(pgn || ''), { sloppy: true })) {
        throw new Error('Gespeicherte PGN ist ungültig.');
      }
      this.game = loaded;
      this.moves = [];
      const replay = new global.Chess();
      loaded.history({ verbose: true }).forEach(move => {
        const before = replay.fen();
        const applied = replay.move(move);
        this.moves.push({
          ply: this.moves.length + 1,
          san: applied.san,
          uci: applied.from + applied.to + (applied.promotion || ''),
          by: 'user',
          fenBefore: before,
          fenAfter: replay.fen()
        });
      });
      this.emit();
    }

    emit() {
      this.onChange(this.state());
    }

    state() {
      return {
        fen: this.game.fen(),
        turn: this.game.turn(),
        moves: this.moves.slice(),
        over: this.game.game_over(),
        check: this.game.in_check(),
        pgn: this.game.pgn()
      };
    }

    legalMoves() {
      return this.game.moves();
    }

    needsPromotion(from, to) {
      const piece = this.game.get(from);
      return Boolean(piece && piece.type === 'p' && (to[1] === '1' || to[1] === '8'));
    }

    parseMove(input) {
      if (input && typeof input === 'object' && input.from && input.to) {
        try {
          return this.game.move({
            from: input.from,
            to: input.to,
            promotion: input.promotion || 'q'
          });
        } catch (_) {
          return null;
        }
      }
      const value = normalize(input);
      if (!value) return null;
      const coordinate = value.match(/([a-h][1-8])\s*[- ]\s*([a-h][1-8])(?:\s*=?\s*([qrbn]))?/i);
      if (coordinate) {
        return this.game.move({
          from: coordinate[1].toLowerCase(),
          to: coordinate[2].toLowerCase(),
          promotion: (coordinate[3] || 'q').toLowerCase()
        });
      }
      const uci = value.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/i);
      if (uci) {
        return this.game.move({
          from: uci[1].toLowerCase(),
          to: uci[2].toLowerCase(),
          promotion: (uci[3] || 'q').toLowerCase()
        });
      }
      const san = value.replace(/^(?:move|zug|ich spiele|ich ziehe)\s+/i, '').trim();
      try {
        return this.game.move(san, { sloppy: true });
      } catch (_) {
        return null;
      }
    }

    play(input, by) {
      const before = this.game.fen();
      const move = this.parseMove(input);
      if (!move) {
        this.lastError = `"${normalize(input)}" ist kein legaler Zug.`;
        return { ok: false, error: this.lastError, legal: this.legalMoves() };
      }
      const record = {
        ply: this.moves.length + 1,
        san: move.san,
        uci: move.from + move.to + (move.promotion || ''),
        by: by || 'user',
        fenBefore: before,
        fenAfter: this.game.fen()
      };
      this.moves.push(record);
      this.lastError = '';
      this.emit();
      return { ok: true, move: record, state: this.state() };
    }

    markovCandidate() {
      const key = this.moves.slice(-2).map(m => m.san).join(' ');
      const one = this.moves.slice(-1).map(m => m.san).join(' ');
      const pool = OPENING_TRANSITIONS[key] || OPENING_TRANSITIONS[one] || [];
      const legal = this.game.moves({ verbose: true });
      const candidates = legal.filter(move => pool.includes(move.san));
      const source = candidates.length ? candidates : legal;
      const weighted = source.map(move => ({
        move,
        weight: 1 + (move.captured ? 3 : 0) + (move.san.includes('+') ? 2 : 0) +
          (move.flags && /k|q/.test(move.flags) ? .6 : 0)
      }));
      const total = weighted.reduce((sum, item) => sum + item.weight, 0);
      let roll = Math.random() * total;
      let selected = weighted[weighted.length - 1]?.move;
      for (const item of weighted) {
        roll -= item.weight;
        if (roll <= 0) { selected = item.move; break; }
      }
      return selected ? selected.from + selected.to + (selected.promotion || '') : null;
    }

    async markovMove() {
      const candidate = this.markovCandidate();
      return candidate ? this.play(candidate, 'markov') : { ok: false, error: 'Keine legalen Züge verfügbar.' };
    }

    async localKnowledgeMove() {
      const legal = this.game.moves({ verbose: true });
      if (!legal.length) return { ok: false, error: 'Keine legalen Züge verfügbar.' };
      const scored = legal.map(move => {
        const next = new global.Chess(this.game.fen());
        next.move(move);
        return { move, score: this.search(next, 1, -Infinity, Infinity) };
      });
      const bestScore = Math.max(...scored.map(item => item.score));
      const choices = scored.filter(item => item.score === bestScore);
      const selected = choices[Math.floor(Math.random() * choices.length)].move;
      return this.play(selected.from + selected.to + (selected.promotion || ''), 'gemini-local');
    }

    pieceValue(type) {
      return { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 }[type] || 0;
    }

    evaluate(game) {
      const board = game.board();
      let score = 0;
      board.forEach(row => row.forEach(piece => {
        if (!piece) return;
        const value = this.pieceValue(piece.type);
        score += piece.color === 'w' ? value : -value;
      }));
      if (game.in_check()) score += game.turn() === 'w' ? -35 : 35;
      return score;
    }

    search(game, depth, alpha, beta) {
      if (depth <= 0 || game.game_over()) {
        const value = this.evaluate(game);
        return game.turn() === 'w' ? value : -value;
      }
      const moves = game.moves({ verbose: true }).sort((a, b) => Number(Boolean(b.captured)) - Number(Boolean(a.captured)));
      if (!moves.length) return this.evaluate(game);
      let best = -Infinity;
      for (const move of moves) {
        const next = new global.Chess(game.fen());
        next.move(move);
        const score = -this.search(next, depth - 1, -beta, -alpha);
        best = Math.max(best, score);
        alpha = Math.max(alpha, score);
        if (alpha >= beta) break;
      }
      return best;
    }

    async stockfishMove({ depth = 12, movetime = 500 } = {}) {
      if (!this.worker) await this.initStockfish();
      const fen = this.game.fen();
      const result = await new Promise((resolve) => {
        let bestmove = null;
        let score = null;
        let pv = '';
        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          this.worker.removeEventListener('message', onMessage);
          resolve({ bestmove, score, pv });
        };
        const onMessage = (event) => {
          const line = String(event.data || '').trim();
          const scoreMatch = line.match(/score\s+(cp|mate)\s+(-?\d+)/);
          if (scoreMatch) score = scoreMatch[1] === 'mate' ? `M${scoreMatch[2]}` : (Number(scoreMatch[2]) / 100).toFixed(2);
          if (line.includes(' pv ')) pv = line.split(' pv ')[1];
          if (line.startsWith('bestmove ')) {
            bestmove = line.split(/\s+/)[1];
            done();
          }
        };
        const timer = setTimeout(done, 6000);
        this.worker.addEventListener('message', onMessage);
        this.worker.postMessage('ucinewgame');
        this.worker.postMessage('position fen ' + fen);
        this.worker.postMessage(`go depth ${depth} movetime ${movetime}`);
      });
      if (!result.bestmove || result.bestmove === '(none)') return { ok: false, error: 'Stockfish hat keinen Zug geliefert.', evidence: result };
      const move = this.play(result.bestmove, 'stockfish');
      return Object.assign(move, { evidence: result });
    }

    async initStockfish() {
      if (this.worker) return;
      const response = await fetch('https://cdn.jsdelivr.net/npm/stockfish.js@10/stockfish.js');
      if (!response.ok) throw new Error('Stockfish konnte nicht geladen werden.');
      const source = await response.text();
      this.worker = new Worker(URL.createObjectURL(new Blob([source], { type: 'application/javascript' })));
      this.worker.postMessage('uci');
    }

    pgn() {
      return this.game.pgn();
    }
  }

  global.OrbitronChessPlayerCore = ChessPlayerCore;
})(window);