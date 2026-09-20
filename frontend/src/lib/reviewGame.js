import { Chess } from "chess.js";
import { Engine } from "./engine.js";
import { pgnToMoves } from "./pgnToMoves.js";
import { classifyMove } from "./moveLabels.js";
import { centipawnsToWinPercent } from "./winPercent.js";
import { uciToSan } from "./explainBlunder.js";

// The "deep review" of a single game — the second of the two analysis modes
// the build doc describes. The bulk blunder scan (blunderScan.js) is fast and
// shallow across many games; this one is slow and thorough across one game,
// and it's what the evaluation bar and the per-move labels read from.
// See decision.md D-034.
// The doc's table suggests depth 18 / MultiPV 3 and budgets 20-40 seconds for
// a review. Measured here, that combination took 208 seconds on a 92-ply
// game — unusable. Depth 14 with 2 lines keeps the labels essentially the
// same (the second line is only needed to spot an "only move") while landing
// inside a tolerable wait. See decision.md D-034.
const REVIEW_DEPTH = 14;
const REVIEW_MULTI_PV = 2;

// Evaluations come out of the engine from White's point of view. Labels care
// about the player who made the move, so they get flipped per ply.
function toMoverPerspective(scoreCp, colorLetter) {
  return colorLetter === "b" ? -scoreCp : scoreCp;
}

// Turns the per-move win-percentage losses into a single 0-100 accuracy
// figure, the way review screens usually present it. A player who never
// loses anything scores 100; the more they throw away on average, the lower
// it goes.
function accuracyFromLosses(losses) {
  if (losses.length === 0) return null;
  const averageLoss = losses.reduce((sum, value) => sum + value, 0) / losses.length;
  return Math.max(0, Math.min(100, Math.round(100 - averageLoss * 2.5)));
}

// A rough rating-strength estimate for how someone played in THIS game.
//
// Worth being blunt about what this is: the build doc explicitly says not to
// invent a rating from accuracy ("Do not invent a rating estimate from it in
// v1"), and it has a point — accuracy depends heavily on how sharp the
// position was, how long the time control was, and how much the opponent
// tested you. A quiet drawn game can be 95% accurate for a beginner. This is
// therefore labelled in the UI as a per-game performance estimate, never as
// "your rating". Added on explicit request — see decision.md D-037.
export function ratingFromAccuracy(accuracy) {
  if (accuracy === null) return null;
  return Math.round(Math.max(400, Math.min(2900, (accuracy - 52) * 52)));
}

/**
 * Reviews one game end to end.
 *
 * Returns { moves, evals, accuracy } where:
 *  - evals[i] is the evaluation (White's perspective, centipawns) of the
 *    position AFTER ply i; evals[-1] is handled by the caller as the start.
 *  - moves[i] carries the label and supporting numbers for ply i.
 */
export async function reviewGame(game, { onProgress, isCancelled } = {}) {
  const moves = pgnToMoves(game.pgn);
  const engine = new Engine();

  const reviewed = [];
  const evalAfterPly = []; // White's perspective, indexed by ply
  const lossesByColor = { w: [], b: [] };
  let startingEval = 0;

  try {
    await engine.start();

    // The position before the very first move — the bar needs a starting
    // value, and ply 0's "before" evaluation comes from here.
    let previous = await engine.evaluate(moves[0]?.fenBefore, REVIEW_DEPTH, REVIEW_MULTI_PV);
    startingEval = previous.scoreCp;

    for (let plyIndex = 0; plyIndex < moves.length; plyIndex++) {
      if (isCancelled?.()) break;

      const move = moves[plyIndex];
      const after = await engine.evaluate(move.fenAfter, REVIEW_DEPTH, REVIEW_MULTI_PV);
      evalAfterPly[plyIndex] = after.scoreCp;

      const evalBefore = toMoverPerspective(previous.scoreCp, move.color);
      const evalAfter = toMoverPerspective(after.scoreCp, move.color);

      // Did they play what the engine wanted? Compared in readable notation
      // so promotions and castling don't trip up a raw string comparison.
      const engineBestSan = uciToSan(move.fenBefore, previous.lines[0]?.move ?? previous.bestMove);
      const playedBestMove = engineBestSan !== null && engineBestSan === move.san;

      const secondLine = previous.lines[1];
      const secondBestEval =
        secondLine ? toMoverPerspective(secondLine.scoreCp, move.color) : null;

      // What the position looks like after the opponent's best reply — used
      // to tell a genuine sacrifice from a piece that just gets won back.
      const replySan = after.lines[0]?.move ?? after.bestMove;
      const fenAfterReply = applyUciMove(move.fenAfter, replySan);

      const label = classifyMove({
        evalBefore,
        evalAfter,
        playedBestMove,
        secondBestEval,
        fenBefore: move.fenBefore,
        fenAfterReply,
        playerColorLetter: move.color,
      });

      const lost = Math.max(
        0,
        centipawnsToWinPercent(evalBefore) - centipawnsToWinPercent(evalAfter)
      );
      lossesByColor[move.color].push(lost);

      reviewed.push({
        plyIndex,
        san: move.san,
        color: move.color,
        moveNumber: move.moveNumber,
        label,
        evalAfter: after.scoreCp, // White's perspective, for the bar
        bestMoveSan: engineBestSan,
        winPercentLost: lost,
      });

      // Hand back what's been worked out so far, not just a counter — the
      // viewer shows labels as they land rather than making you stare at a
      // progress number for twenty seconds with nothing to look at.
      onProgress?.({
        plyDone: plyIndex + 1,
        totalPlies: moves.length,
        partial: { moves: [...reviewed], evalAfterPly: [...evalAfterPly], startingEval },
      });
      previous = after;
    }
  } finally {
    engine.stop();
  }

  const accuracy = {
    white: accuracyFromLosses(lossesByColor.w),
    black: accuracyFromLosses(lossesByColor.b),
  };

  return {
    moves: reviewed,
    startingEval,
    evalAfterPly,
    accuracy,
    estimatedRating: {
      white: ratingFromAccuracy(accuracy.white),
      black: ratingFromAccuracy(accuracy.black),
    },
  };
}

// Plays a UCI move onto a FEN and returns the resulting FEN, or null if it
// isn't legal there (the engine occasionally reports "(none)" in terminal
// positions).
function applyUciMove(fen, uciMove) {
  if (!uciMove || uciMove === "(none)") return null;
  try {
    const board = new Chess(fen);
    board.move({ from: uciMove.slice(0, 2), to: uciMove.slice(2, 4), promotion: uciMove[4] });
    return board.fen();
  } catch {
    return null;
  }
}
