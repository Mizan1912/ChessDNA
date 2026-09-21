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
  #multiPv = 1;
  // The engine handles exactly one search at a time, and each search claims
  // the single line handler. Without serialising, a second evaluate() call
  // would steal the handler and leave the first promise hanging forever.
  #queue = Promise.resolve();

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

  // Asks the engine for more than one candidate line at a time. Needed to
  // tell "the only good move" apart from "one of several fine moves", which
  // is the whole basis of the Great and Brilliant labels. Costs speed, so
  // the bulk blunder scan leaves it at 1.
  async #setMultiPv(count) {
    if (this.#multiPv === count) return;
    this.#multiPv = count;
    this.#send(`setoption name MultiPV value ${count}`);
  }

  // Wipes the engine's memory of positions it has already searched (its
  // "hash table"), so the next game is analysed as if it were the first.
  //
  // Without this, results depended on ORDER. Stockfish reuses what it
  // learned in earlier searches, which is normally a speed-up — but it means
  // a fixed-depth search of the same position can land on a slightly
  // different number depending on what was analysed before it. Measured on 50
  // real games: 112 mistakes scanned oldest-first, 120 newest-first, with 30
  // moments flagged in only one of the two orders. Anything that COUNTS
  // mistakes (Phase 5's "3x your peers") has to give the same answer for the
  // same games every time. See decision.md D-049.
  //
  // Goes through the same queue as evaluate(), so it can never land in the
  // middle of a search.
  newGame() {
    const result = this.#queue.then(() => this.#newGameNow());
    this.#queue = result.catch(() => {});
    return result;
  }

  async #newGameNow() {
    await this.start();
    return new Promise((resolve) => {
      // "ucinewgame" has no reply of its own; "isready" -> "readyok" is how
      // UCI confirms the engine has finished whatever it was told to do.
      this.#pendingLineHandler = (line) => {
        if (line === "readyok") {
          this.#pendingLineHandler = null;
          resolve();
        }
      };
      this.#send("ucinewgame");
      this.#send("isready");
    });
  }

  // Evaluates one position. Resolves with { scoreCp, bestMove, lines }, where
  // every score is from White's point of view (positive = White better), and
  // `lines` holds the top `multiPv` candidate moves, best first.
  // Only one of these can be in flight at a time — callers await each in turn.
  evaluate(fen, depth, multiPv = 1) {
    // Chain onto whatever is already running, so calls queue up instead of
    // trampling each other.
    const result = this.#queue.then(() => this.#evaluateNow(fen, depth, multiPv));
    this.#queue = result.catch(() => {}); // a failed search shouldn't block the queue
    return result;
  }

  async #evaluateNow(fen, depth, multiPv) {
    await this.start();
    await this.#setMultiPv(multiPv);

    return new Promise((resolve) => {
      // Keyed by multipv index (1 = best line, 2 = second best, ...). The
      // engine re-sends these at every depth, so later lines overwrite
      // earlier, shallower ones.
      const bestByRank = new Map();
      const flip = whoseTurn(fen) === "black";

      this.#pendingLineHandler = (line) => {
        // Score lines look like:
        //   info depth 12 ... multipv 1 ... score cp -45 ... pv e2e4 e7e5
        //   info depth 12 ... multipv 2 ... score mate 3 ... pv ...
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        // The whole principal variation — the line the engine expects both
        // sides to play from here — not just its first move. The Phase 5
        // tags need it: "the engine's best line wins the piece", "the best
        // line mates on the back rank" are claims about a sequence, and
        // can't be checked from a single move. `pv` is always the last field
        // on the line, so everything after it is the sequence.
        const pv = line.match(/ pv (.+)$/)?.[1].trim().split(/\s+/) ?? [];

        if (cpMatch || mateMatch) {
          const rank = Number(line.match(/multipv (\d+)/)?.[1] ?? 1);
          const raw = mateMatch ? mateToCentipawns(Number(mateMatch[1])) : Number(cpMatch[1]);
          bestByRank.set(rank, {
            scoreCp: flip ? -raw : raw,
            move: pv[0] ?? null,
            pv,
            isMate: Boolean(mateMatch),
          });
        }

        // "bestmove xxxx" is the engine saying it's done with this position.
        const bestMoveMatch = line.match(/^bestmove (\S+)/);
        if (bestMoveMatch) {
          this.#pendingLineHandler = null;
          const lines = [...bestByRank.entries()]
            .sort(([a], [b]) => a - b)
            .map(([, value]) => value);
          resolve({
            scoreCp: lines[0]?.scoreCp ?? 0,
            bestMove: bestMoveMatch[1],
            pv: lines[0]?.pv ?? [], // the best line, in UCI, starting with bestMove
            lines,
          });
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
    this.#multiPv = 1; // a fresh worker starts at the engine's own default
  }
}
