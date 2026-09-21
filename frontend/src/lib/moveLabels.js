import { Chess } from "chess.js";
import { centipawnsToWinPercent, winPercentLost } from "./winPercent.js";

// The move-quality labels, straight from the build doc's Feature 7 table.
// Every threshold is a WIN PERCENTAGE loss, never a centipawn loss — the doc
// is emphatic about this, and for good reason: throwing away 300 centipawns
// while already a queen up costs you nothing, while throwing away 300 from
// equality loses the game. See decision.md D-032 and D-034.

export const LABELS = {
  brilliant: { name: "Brilliant", glyph: "!!", className: "label-brilliant" },
  great: { name: "Great", glyph: "!", className: "label-great" },
  book: { name: "Book", glyph: "◫", className: "label-book" },
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

// --- How rare "Great" and "Brilliant" are ---------------------------------
//
// The first version of these rules handed out a Brilliant and a fistful of
// Greats in a game where Chess.com gave zero and two. Chess.com is the
// reference people compare against, and a label that fires often stops
// meaning anything. See decision.md D-039 for the full reasoning.
//
// Three gates now have to be passed at once for "Great":
//  1. the gap to the second-best move is large (this used to be 10),
//  2. the alternative would have changed the STATE of the game — a move is
//     only "the only move" if the others actually lose something that
//     matters. Going from +8 to +4 is a big win-percentage gap on paper and
//     no difference at all over the board.
//  3. there was a real choice to make (not a forced recapture).
const GREAT_GAP_WIN_PERCENT = 15;

// Win-percentage bands used for gate 2 above: below 35 you are losing,
// above 65 you are winning, in between it's a game.
const WINNING_WIN_PERCENT = 65;
const LOSING_WIN_PERCENT = 35;

// Brilliant additionally requires that you weren't already completely
// winning. Sacrificing a knight when you're a rook up is not brilliant, it's
// just still winning.
const BRILLIANT_MAX_LEAD_CP = 400;

// Which of the three bands (0 losing, 1 balanced, 2 winning) a position is in.
function band(winPercent) {
  if (winPercent >= WINNING_WIN_PERCENT) return 2;
  if (winPercent > LOSING_WIN_PERCENT) return 1;
  return 0;
}

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
//
// It's the change in the material BALANCE — the player's material minus the
// opponent's — not the player's material alone. The first version counted
// only what the player lost, which made every trade look like a sacrifice:
// Rxd1+ Kxd1 costs the player a rook, but it also took one, and it was
// labelled Brilliant in a real game. An even trade leaves the balance where
// it was; only a real sacrifice moves it. See decision.md D-052.
export function materialSacrificed(fenBefore, fenAfterOpponentReply, playerColorLetter) {
  if (!fenAfterOpponentReply) return 0;
  const opponent = playerColorLetter === "w" ? "b" : "w";
  const balance = (fen) => materialFor(fen, playerColorLetter) - materialFor(fen, opponent);
  return balance(fenBefore) - balance(fenAfterOpponentReply);
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
 *  - isBook: the game is still inside known opening theory
 *  - legalMoveCount: how many moves were available (1 means forced)
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
    isBook = false,
    legalMoveCount = 2,
  } = context;

  const lost = winPercentLost(evalBefore, evalAfter);

  // Theory isn't the player's work, good or bad, so it's labelled before
  // anything else and never praised or blamed.
  if (isBook) return "book";

  // "The only move": the player found the engine's choice, the runner-up was
  // far worse, that difference actually mattered, and there was a genuine
  // choice to make. All four, or it's just a Best move.
  const bestWinPercent = centipawnsToWinPercent(evalBefore);
  const secondWinPercent =
    secondBestEval === null ? null : centipawnsToWinPercent(secondBestEval);

  const wasOnlyGoodMove =
    playedBestMove &&
    legalMoveCount > 1 &&
    secondWinPercent !== null &&
    bestWinPercent - secondWinPercent >= GREAT_GAP_WIN_PERCENT &&
    band(secondWinPercent) < band(bestWinPercent);

  // Checked in the doc's own order, stopping at the first match.

  // Brilliant = the only move, plus a real material sacrifice, plus the
  // position is still OK afterwards, plus you weren't already winning easily.
  // Kept deliberately strict: the doc warns this is the label that
  // embarrasses you, and that when unsure you downgrade to Great.
  if (wasOnlyGoodMove) {
    const sacrificed = materialSacrificed(fenBefore, fenAfterReply, playerColorLetter);
    if (sacrificed >= 3 && evalAfter >= 0 && evalBefore < BRILLIANT_MAX_LEAD_CP) {
      return "brilliant";
    }
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
