import { Chess } from "chess.js";
import { winPercentLost } from "./winPercent.js";

// The move-quality labels, straight from the build doc's Feature 7 table.
// Every threshold is a WIN PERCENTAGE loss, never a centipawn loss — the doc
// is emphatic about this, and for good reason: throwing away 300 centipawns
// while already a queen up costs you nothing, while throwing away 300 from
// equality loses the game. See decision.md D-032 and D-034.

export const LABELS = {
  brilliant: { name: "Brilliant", glyph: "!!", className: "label-brilliant" },
  great: { name: "Great", glyph: "!", className: "label-great" },
  best: { name: "Best", glyph: "★", className: "label-best" },
  excellent: { name: "Excellent", glyph: "✓", className: "label-excellent" },
  good: { name: "Good", glyph: "·", className: "label-good" },
  inaccuracy: { name: "Inaccuracy", glyph: "?!", className: "label-inaccuracy" },
  mistake: { name: "Mistake", glyph: "?", className: "label-mistake" },
  miss: { name: "Miss", glyph: "×", className: "label-miss" },
  blunder: { name: "Blunder", glyph: "??", className: "label-blunder" },
};

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const MATE_THRESHOLD_CP = 90000;

// How much material one side has on the board right now.
function materialFor(fen, colorLetter) {
  let total = 0;
  for (const row of new Chess(fen).board()) {
    for (const square of row) {
      if (square?.color === colorLetter) total += PIECE_VALUES[square.type];
    }
  }
  return total;
}

// A sacrifice is material the player deliberately gave up and did NOT get
// back. Measured after the opponent's best reply, because a move that hangs
// a queen only to win it straight back isn't a sacrifice at all.
function materialSacrificed(fenBefore, fenAfterOpponentReply, playerColorLetter) {
  if (!fenAfterOpponentReply) return 0;
  return materialFor(fenBefore, playerColorLetter) - materialFor(fenAfterOpponentReply, playerColorLetter);
}

/**
 * Works out which label a single move earns.
 *
 * Everything in `context` is from the PLAYER's point of view, in centipawns:
 *  - evalBefore / evalAfter: the position before and after this move
 *  - playedBestMove: did they play the engine's first choice?
 *  - secondBestEval: what the engine's second-best move was worth (null if
 *    there wasn't one — e.g. only one legal move)
 *  - fenBefore / fenAfterReply / playerColorLetter: for detecting sacrifices
 */
export function classifyMove(context) {
  const {
    evalBefore,
    evalAfter,
    playedBestMove,
    secondBestEval,
    fenBefore,
    fenAfterReply,
    playerColorLetter,
  } = context;

  const lost = winPercentLost(evalBefore, evalAfter);

  // "Great" per the doc: the best move was 10+ win-percentage points better
  // than the second best, and the player found it. In other words, there was
  // only one move that held the position together and they saw it.
  const wasOnlyGoodMove =
    playedBestMove &&
    secondBestEval !== null &&
    winPercentLost(evalBefore, secondBestEval) >= 10;

  // Checked in the doc's own order, stopping at the first match.

  // Brilliant = Great, plus a real material sacrifice, plus the position is
  // still OK afterwards. Kept deliberately strict: the doc warns this is the
  // label that embarrasses you, and that when unsure you downgrade to Great.
  if (wasOnlyGoodMove) {
    const sacrificed = materialSacrificed(fenBefore, fenAfterReply, playerColorLetter);
    if (sacrificed >= 3 && evalAfter >= 0) return "brilliant";
    return "great";
  }

  if (playedBestMove) return "best";

  // Missing a forced mate is its own category, regardless of how much the
  // evaluation technically moved.
  if (evalBefore >= MATE_THRESHOLD_CP && evalAfter < MATE_THRESHOLD_CP) return "miss";

  if (lost < 2) return "excellent";
  if (lost < 5) return "good";
  if (lost < 10) return "inaccuracy";
  if (lost < 20) return "mistake";
  return "blunder";
}
