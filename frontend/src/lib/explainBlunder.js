import { Chess } from "chess.js";

// Turns a flagged blunder into a plain sentence saying WHY it was bad —
// the thing Chess.com does and a bare evaluation number doesn't.
//
// Rule followed throughout: never claim something specific unless it's
// actually been checked on the board. A confidently wrong "this hangs your
// knight" costs more trust than a vaguer sentence that happens to be true,
// which is the same reasoning the build doc gives for keeping the
// "Brilliant" label strict.

export const PIECE_NAMES = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
export const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

// Anything at or beyond this is the engine reporting a forced mate rather
// than a material judgement (see engine.js's MATE_SCORE_CP).
const MATE_THRESHOLD_CP = 90000;

// Converts UCI ("g1f3", "e7e8q") into readable notation ("Nf3", "e8=Q") by
// replaying it on the board it belongs to.
export function uciToSan(fen, uciMove) {
  if (!uciMove || uciMove === "(none)") return null;
  try {
    const board = new Chess(fen);
    const move = board.move({
      from: uciMove.slice(0, 2),
      to: uciMove.slice(2, 4),
      promotion: uciMove[4],
    });
    return move?.san ?? null;
  } catch {
    return null;
  }
}

// Does the opponent's punishing move simply capture something?
function describeCapture(fenAfter, refutationUci) {
  if (!refutationUci || refutationUci === "(none)") return null;
  try {
    const board = new Chess(fenAfter);
    const move = board.move({
      from: refutationUci.slice(0, 2),
      to: refutationUci.slice(2, 4),
      promotion: refutationUci[4],
    });
    if (!move?.captured) return null;
    return { pieceName: PIECE_NAMES[move.captured], square: move.to, isMate: board.isCheckmate() };
  } catch {
    return null;
  }
}

// Looks for a piece of the player's that is now attacked and not properly
// defended — "hanging" in the way a human means it. Pawns are ignored on
// purpose: a loose pawn is almost never the real reason a move was bad, and
// saying so out loud makes the explanation look silly.
export function findHangingPiece(fenAfter, playerColorLetter) {
  const MINIMUM_WORTH_MENTIONING = PIECE_VALUES.n; // knight or better
  const opponent = playerColorLetter === "w" ? "b" : "w";
  try {
    const board = new Chess(fenAfter);
    let worst = null;

    for (const row of board.board()) {
      for (const square of row) {
        if (!square || square.color !== playerColorLetter || square.type === "k") continue;
        if (PIECE_VALUES[square.type] < MINIMUM_WORTH_MENTIONING) continue;

        const attackers = board.attackers(square.square, opponent);
        if (attackers.length === 0) continue;
        const defenders = board.attackers(square.square, playerColorLetter);

        // Undefended entirely, or defended but the cheapest attacker is
        // worth less than the piece — either way it loses material.
        const cheapestAttackerSquare = attackers.reduce((best, sq) =>
          (PIECE_VALUES[board.get(sq)?.type] ?? 99) < (PIECE_VALUES[board.get(best)?.type] ?? 99) ? sq : best
        );
        const cheapestAttacker = board.get(cheapestAttackerSquare)?.type;
        const pieceValue = PIECE_VALUES[square.type];
        const undefended = defenders.length === 0;
        const reallyHanging = undefended || PIECE_VALUES[cheapestAttacker] < pieceValue;
        if (!reallyHanging) continue;

        if (!worst || pieceValue > PIECE_VALUES[worst.piece.type]) {
          worst = { piece: square, undefended, attackerName: PIECE_NAMES[cheapestAttacker] };
        }
      }
    }

    // `undefended` matters for the wording. A defended piece attacked by
    // something cheaper is still lost, but calling it "undefended" is a
    // specific claim that's false — the first version did exactly that.
    return worst
      ? {
          pieceName: PIECE_NAMES[worst.piece.type],
          square: worst.piece.square,
          undefended: worst.undefended,
          attackerName: worst.attackerName,
        }
      : null;
  } catch {
    return null;
  }
}

export function explainBlunder(blunder) {
  const playerColorLetter = blunder.game.userColor === "black" ? "b" : "w";
  const bestMoveSan = uciToSan(blunder.fenBefore, blunder.engineBestMove);
  const refutationSan = uciToSan(blunder.fenAfter, blunder.refutationMove);
  const capture = describeCapture(blunder.fenAfter, blunder.refutationMove);

  const instead = bestMoveSan ? ` The engine wanted ${bestMoveSan}.` : "";

  // Ordered by how much the explanation matters — a missed mate is the
  // headline no matter what else is true of the position.
  if (blunder.evalBefore >= MATE_THRESHOLD_CP) {
    return {
      tag: "missed-mate",
      why: `You had a forced mate here and played ${blunder.movePlayed} instead.${instead}`,
      bestMoveSan,
      refutationSan,
    };
  }

  if (blunder.evalAfter <= -MATE_THRESHOLD_CP) {
    return {
      tag: "allows-mate",
      why: `${blunder.movePlayed} allows a forced mate.${instead}`,
      bestMoveSan,
      refutationSan,
    };
  }

  if (capture?.isMate) {
    return {
      tag: "allows-mate",
      why: `${blunder.movePlayed} allows ${refutationSan}, which is checkmate.${instead}`,
      bestMoveSan,
      refutationSan,
    };
  }

  if (capture) {
    return {
      tag: "loses-material",
      why: `${blunder.movePlayed} loses your ${capture.pieceName} on ${capture.square} to ${refutationSan}.${instead}`,
      bestMoveSan,
      refutationSan,
    };
  }

  const hanging = findHangingPiece(blunder.fenAfter, playerColorLetter);
  if (hanging) {
    const how = hanging.undefended
      ? "undefended"
      : `attacked by a ${hanging.attackerName}, which is worth less than it`;
    return {
      tag: "hangs-piece",
      why: `${blunder.movePlayed} leaves your ${hanging.pieceName} on ${hanging.square} ${how}.${instead}`,
      bestMoveSan,
      refutationSan,
    };
  }

  // Nothing concrete found on the board, so say only what's certainly true:
  // the engine disagreed, and here's what it wanted instead.
  return {
    tag: "positional",
    why: refutationSan
      ? `${blunder.movePlayed} gives the advantage away — the opponent's best answer is ${refutationSan}.${instead}`
      : `${blunder.movePlayed} gives the advantage away.${instead}`,
    bestMoveSan,
    refutationSan,
  };
}
