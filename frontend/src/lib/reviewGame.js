import { Chess } from "chess.js";
import { Engine } from "./engine.js";
import { pgnToMoves } from "./pgnToMoves.js";
import { classifyMove } from "./moveLabels.js";
import { isBookMove, BOOK_MAX_PLIES } from "./openingBook.js";
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
const REVIEW_DEPTH = 18;
const REVIEW_MULTI_PV = 2;

// Evaluations come out of the engine from White's point of view. Labels care
// about the player who made the move, so they get flipped per ply.
function toMoverPerspective(scoreCp, colorLetter) {
  return colorLetter === "b" ? -scoreCp : scoreCp;
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// How accurate a SINGLE move was, 0-100, from how much win percentage it
// threw away. This is Lichess's published curve, which Chess.com's numbers
// track closely: it is steep near the top (a 5-point slip already costs you
// real accuracy) and flattens out at the bottom (a catastrophe is a
// catastrophe, twice as bad barely registers).
//
// The first version here was a flat `100 - averageLoss * 2.5`, which was far
// too generous — it handed out 95% for games Chess.com scores in the 70s.
// See decision.md D-040.
function moveAccuracy(winPercentLost) {
  return clamp(103.1668 * Math.exp(-0.04354 * winPercentLost) - 3.1669, 0, 100);
}

// Turns the per-move losses into one 0-100 figure for the game.
//
// The plain average alone is too forgiving: forty quiet moves drown out the
// two that decided the game. So the harmonic mean is blended in, which is
// dragged down hard by the worst moves — the same trick Lichess uses, and the
// reason a game with four mistakes lands in the 70s rather than the 90s.
function accuracyFromLosses(losses) {
  if (losses.length === 0) return null;
  // Floored at 1 so a single total collapse can't send the harmonic mean to
  // zero and take the whole game with it.
  const perMove = losses.map((lost) => Math.max(1, moveAccuracy(lost)));
  const arithmetic = perMove.reduce((sum, value) => sum + value, 0) / perMove.length;
  const harmonic = perMove.length / perMove.reduce((sum, value) => sum + 1 / value, 0);
  // One decimal place, like every other review screen — 75.6 reads as a
  // measurement, 76 reads as a grade.
  return Math.round(clamp((arithmetic + harmonic) / 2, 0, 100) * 10) / 10;
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
//
// Anchored on a real Chess.com review: 75.6% accuracy -> 1200, 85.0% -> 1400.
//
// A straight line through those two points was the first attempt and it was
// wrong at the top — it capped a flawless 100% game at about 1720, which
// nobody would believe. The relationship is not linear: the last few points
// of accuracy are enormously harder to earn than the first few. So this is an
// exponential fit through the lower anchor and the rule of thumb that a 95%
// game is roughly 2000-strength, which reaches ~2280 at a perfect 100%.
//
// Be clear about what that means: one anchor is measured, the other is
// judgement. Chess.com also weighs how strong the opponent was, which this
// doesn't see at all. See decision.md D-040.
export function ratingFromAccuracy(accuracy) {
  if (accuracy === null) return null;
  return Math.round(clamp(164 * Math.exp(0.0263 * accuracy), 100, 3000));
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

  // Book detection walks forward with the game: once the game leaves theory
  // it can never re-enter it, so this latches off and stays off.
  const sanSoFar = [];
  let stillInBook = true;

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
      const engineBestUci = previous.lines[0]?.move ?? previous.bestMove;
      const engineBestSan = uciToSan(move.fenBefore, engineBestUci);
      const playedBestMove = engineBestSan !== null && engineBestSan === move.san;

      const secondLine = previous.lines[1];
      const secondBestEval =
        secondLine ? toMoverPerspective(secondLine.scoreCp, move.color) : null;

      // What the position looks like after the opponent's best reply — used
      // to tell a genuine sacrifice from a piece that just gets won back.
      const replySan = after.lines[0]?.move ?? after.bestMove;
      const fenAfterReply = applyUciMove(move.fenAfter, replySan);

      sanSoFar.push(move.san);
      if (stillInBook && plyIndex < BOOK_MAX_PLIES) {
        stillInBook = isBookMove(sanSoFar);
      } else {
        stillInBook = false;
      }

      const label = classifyMove({
        evalBefore,
        evalAfter,
        playedBestMove,
        secondBestEval,
        fenBefore: move.fenBefore,
        fenAfterReply,
        playerColorLetter: move.color,
        isBook: stillInBook,
        legalMoveCount: new Chess(move.fenBefore).moves().length,
      });

      const lost = Math.max(
        0,
        centipawnsToWinPercent(evalBefore) - centipawnsToWinPercent(evalAfter)
      );
      // Theory doesn't count towards accuracy in either direction — playing
      // ten memorised book moves shouldn't pad the score.
      if (!stillInBook) lossesByColor[move.color].push(lost);

      reviewed.push({
        plyIndex,
        san: move.san,
        color: move.color,
        moveNumber: move.moveNumber,
        label,
        evalAfter: after.scoreCp, // White's perspective, for the bar
        bestMoveSan: engineBestSan,
        // Kept in raw UCI as well as notation, because the board draws the
        // "you should have played this" arrow from the two squares.
        bestMoveUci: engineBestUci ?? null,
        // The engine's expected continuation after this move, opponent first
        // (UCI, a few plies). The move explanations read the punishment of a
        // bad move, and "what happens next" after a good one, straight off it.
        replyLine: (after.pv ?? []).slice(0, 6),
        from: move.from,
        to: move.to,
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
