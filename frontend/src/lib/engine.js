// Drives Stockfish, which runs inside a Web Worker — NOT on the main thread.
// That matters: analysis pegs a CPU core for minutes at a time, and on the
// main thread it would freeze the whole tab (no scrolling, no clicking, the
// browser showing "page unresponsive"). In a worker it's just a background
// thread, and the UI stays alive.
//
// Stockfish speaks UCI, a plain line-based text protocol: you send it
// commands as strings, it sends back lines of text. See decision.md D-030.

const ENGINE_URL = "/stockfish/stockfish-19-lite-single.js";

// Mate is "infinitely" better than any material advantage, but the rest of
// the code compares plain centipawn numbers, so mate gets mapped onto a very
// large centipawn value. Subtracting the distance-to-mate keeps "mate in 1"
// ranked above "mate in 6".
const MATE_SCORE_CP = 100000;

function mateToCentipawns(movesToMate) {
  const sign = movesToMate >= 0 ? 1 : -1;
  return sign * (MATE_SCORE_CP - Math.abs(movesToMate) * 100);
}

// UCI reports scores from the perspective of whoever is to move. That makes
// positions incomparable with each other, so everything here is flipped to a
// single fixed perspective: positive = good for White, always.
function whoseTurn(fen) {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}

export class Engine {
  #worker = null;
  #pendingLineHandler = null;
  #readyPromise = null;

  async start() {
    if (this.#readyPromise) return this.#readyPromise;

    this.#readyPromise = new Promise((resolve, reject) => {
      try {
        this.#worker = new Worker(ENGINE_URL);
      } catch (error) {
        reject(error);
        return;
      }

      this.#worker.onerror = (event) => reject(new Error(event.message || "Stockfish worker failed"));
      this.#worker.onmessage = (event) => {
        const line = typeof event.data === "string" ? event.data : "";
        this.#pendingLineHandler?.(line);
      };

      // UCI handshake: "uci" makes it announce itself and finish with
      // "uciok"; "isready" then confirms it's finished booting with
      // "readyok". Only after that is it safe to ask for analysis.
      this.#pendingLineHandler = (line) => {
        if (line === "uciok") this.#send("isready");
        if (line === "readyok") {
          this.#pendingLineHandler = null;
          resolve();
        }
      };
      this.#send("uci");
    });

    return this.#readyPromise;
  }

  #send(command) {
    this.#worker.postMessage(command);
  }

  // Evaluates one position and resolves with { scoreCp, bestMove }, where
  // scoreCp is always from White's point of view (positive = White better).
  // Only one of these can be in flight at a time — see analyseGames(), which
  // awaits each call in turn.
  async evaluate(fen, depth) {
    await this.start();

    return new Promise((resolve) => {
      let latestScoreCp = 0;

      this.#pendingLineHandler = (line) => {
        // Score lines look like:
        //   info depth 12 ... score cp -45 ... pv e2e4 e7e5
        //   info depth 12 ... score mate 3 ... pv ...
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        if (mateMatch) {
          latestScoreCp = mateToCentipawns(Number(mateMatch[1]));
        } else if (cpMatch) {
          latestScoreCp = Number(cpMatch[1]);
        }

        // "bestmove xxxx" is the engine saying it's done with this position.
        const bestMoveMatch = line.match(/^bestmove (\S+)/);
        if (bestMoveMatch) {
          this.#pendingLineHandler = null;
          const fromWhitePerspective =
            whoseTurn(fen) === "black" ? -latestScoreCp : latestScoreCp;
          resolve({ scoreCp: fromWhitePerspective, bestMove: bestMoveMatch[1] });
        }
      };

      this.#send(`position fen ${fen}`);
      this.#send(`go depth ${depth}`);
    });
  }

  stop() {
    this.#worker?.terminate();
    this.#worker = null;
    this.#readyPromise = null;
    this.#pendingLineHandler = null;
  }
}
