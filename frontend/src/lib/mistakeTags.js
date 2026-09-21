import { Chess } from "chess.js";

// Phase 5: sorting mistakes into the KINDS of mistake they are — the
// Feature 1 "tag list" from the build doc. A blunder scan says "you lost
// the thread on move 24"; tags say "…and it was a back-rank mate, again".
// Counting those across games is what turns a list of errors into a blind
// spot.
//
// Rules the doc sets for this file, followed throughout:
//  - Plain board logic with chess.js. No machine learning, no guessing.
//  - A position can earn zero, one or several tags.
//  - Every tag says WHICH SQUARES it's about, so the board can highlight
//    them (the evidence rule: "the piece that hung, the mating square,
//    whatever the tag points at").
//
// The doc says to build the ten tags one at a time, starting with hanging
// piece and back rank. Those two are here; the rest follow the same shape.
// See decision.md D-048.

export const TAGS = {
  "hanging-piece": {
    name: "Hanging piece",
    blurb: "left a piece attacked and undefended, and it was taken",
  },
  "back-rank": {
    name: "Back rank",
    blurb: "the king had no escape square, and the back rank cost you",
  },
};

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// How far into the opponent's best line a tag may look. The doc puts
// "engine lines longer than the immediate refutation" out of scope, so the
// hanging-piece check stops at the opponent's third move — enough for the
// common "check first, then take the piece" — rather than wandering off
// into whatever the engine imagines ten moves later.
const REFUTATION_WINDOW_PLIES = 5;

// A back-rank MATE can legitimately be longer than that (sacrifice,
// recapture, mate), so the mate check reads the whole line the engine gave.
const MATE_LINE_MAX_PLIES = 16;

// "Wins material" means a real gain, not a pawn's worth of noise at the end
// of a line — two points, i.e. at least the exchange.
const MATERIAL_WIN_MIN = 2;

const otherColour = (colour) => (colour === "w" ? "b" : "w");

function materialOf(board, colour) {
  let total = 0;
  for (const row of board.board()) {
    for (const square of row) if (square?.color === colour) total += PIECE_VALUES[square.type];
  }
  return total;
}

function findKing(board, colour) {
  for (const row of board.board()) {
    for (const square of row) if (square?.type === "k" && square.color === colour) return square.square;
  }
  return null;
}

// Plays an engine line (UCI moves) forward from a position, one ply at a
// time, and records what each move did. Stops quietly at the first move that
// isn't legal — engine lines occasionally end in "(none)" or trail off.
function playLine(fen, uciMoves, maxPlies) {
  const steps = [];
  const board = new Chess(fen);
  for (const uci of (uciMoves ?? []).slice(0, maxPlies)) {
    let move;
    try {
      move = board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    } catch {
      break;
    }
    if (!move) break;
    steps.push({ move, isCheck: board.inCheck(), isCheckmate: board.isCheckmate(), board: new Chess(board.fen()) });
  }
  return steps;
}

// --- Hanging piece -----------------------------------------------------
//
// The doc's rule: "After the played move, a piece of the player is attacked
// and undefended, and the engine's best line wins it."
//
// Two deliberate readings of that sentence:
//  - "piece" means knight or better. A loose pawn is rarely why a move was
//    a mistake, and it's the same line explainBlunder.js already draws.
//  - "undefended" means undefended — zero defenders. A defended queen
//    attacked by a pawn is lost too, but that's a different mistake (and
//    closer to "trade blunder"); folding it in here would blur the tag.
function detectHangingPiece(moment) {
  const { fenAfter, refutationLine, playerColour } = moment;
  const board = new Chess(fenAfter);
  const opponent = otherColour(playerColour);

  // Every piece of the player's that is attacked with nothing guarding it,
  // keyed by where it stands — tracked as the line plays out, in case the
  // player moves it before it's taken.
  const loose = new Map();
  for (const row of board.board()) {
    for (const square of row) {
      if (!square || square.color !== playerColour || square.type === "k" || square.type === "p") continue;
      if (board.attackers(square.square, opponent).length === 0) continue;
      if (board.attackers(square.square, playerColour).length > 0) continue;
      loose.set(square.square, square.type);
    }
  }
  if (loose.size === 0) return null;

  const steps = playLine(fenAfter, refutationLine, REFUTATION_WINDOW_PLIES + 1);
  for (let i = 0; i < Math.min(steps.length, REFUTATION_WINDOW_PLIES); i++) {
    const { move } = steps[i];

    if (move.color === playerColour && loose.has(move.from)) {
      loose.set(move.to, loose.get(move.from));
      loose.delete(move.from);
      continue;
    }

    if (move.color === opponent && move.captured && loose.has(move.to)) {
      // "Wins it" — not "trades for it". If the player's very next move
      // takes back on that square and the swap is roughly even, the piece
      // wasn't won, it was exchanged.
      const lostValue = PIECE_VALUES[move.captured];
      const reply = steps[i + 1]?.move;
      const recaptured = reply && reply.color === playerColour && reply.to === move.to && reply.captured;
      const netLoss = recaptured ? lostValue - PIECE_VALUES[reply.captured] : lostValue;
      if (netLoss < MATERIAL_WIN_MIN) return null;

      return {
        tag: "hanging-piece",
        squares: [move.to],
        detail: { piece: move.captured, square: move.to, takenBy: move.san },
      };
    }
  }
  return null;
}

// --- Back rank ---------------------------------------------------------
//
// The doc's rule: "Best line delivers mate or wins material on the
// player's first rank while their king has no pawn escape."
//
// "No pawn escape" is read the way a player means it: the king is on its
// back rank and every square directly in front of it is either blocked by
// its own pieces or covered by the opponent — the missing "luft".
function kingIsTrappedOnBackRank(board, playerColour) {
  const kingSquare = findKing(board, playerColour);
  if (!kingSquare) return null;
  const backRank = playerColour === "w" ? "1" : "8";
  if (kingSquare[1] !== backRank) return null;

  const forwardRank = playerColour === "w" ? "2" : "7";
  const kingFile = kingSquare.charCodeAt(0);
  const opponent = otherColour(playerColour);

  for (let file = kingFile - 1; file <= kingFile + 1; file++) {
    if (file < 97 || file > 104) continue; // off the board (a-h)
    const escape = String.fromCharCode(file) + forwardRank;
    const occupant = board.get(escape);
    if (occupant?.color === playerColour) continue; // blocked by its own piece
    if (board.isAttacked(escape, opponent)) continue; // covered
    return null; // a real way out exists
  }
  return { kingSquare, backRank };
}

function detectBackRank(moment) {
  const { fenAfter, refutationLine, playerColour } = moment;
  const start = new Chess(fenAfter);
  const trapped = kingIsTrappedOnBackRank(start, playerColour);
  if (!trapped) return null;

  const opponent = otherColour(playerColour);
  const steps = playLine(fenAfter, refutationLine, MATE_LINE_MAX_PLIES);
  if (steps.length === 0) return null;

  // Mate delivered ON the back rank.
  const last = steps[steps.length - 1];
  if (last.isCheckmate && last.move.color === opponent && last.move.to[1] === trapped.backRank) {
    return {
      tag: "back-rank",
      squares: [last.move.to, trapped.kingSquare],
      detail: { kind: "mate", mateSquare: last.move.to, kingSquare: trapped.kingSquare },
    };
  }

  // Material won THROUGH the back rank: early in the line, an enemy rook or
  // queen lands on it and gives check along it — the one thing a king with
  // no escape square can't simply walk away from — and by the end of the
  // line the opponent is genuinely ahead on material.
  //
  // The first version accepted any capture landing on the back rank. Real
  // games showed why that was wrong: early on, nearly every king counts as
  // "trapped" behind its own pieces, so a bishop picking off a queen on d8
  // was tagged "back rank" when the king had nothing to do with it. It has
  // to be a rook or queen, it has to be check, and it has to be along the
  // rank. See decision.md D-048.
  const invasion = steps
    .slice(0, REFUTATION_WINDOW_PLIES)
    .find(
      (s) =>
        s.move.color === opponent &&
        (s.move.piece === "r" || s.move.piece === "q") &&
        s.move.to[1] === trapped.backRank &&
        s.isCheck &&
        // Both on the back rank means the check runs along it. (If the king
        // had stepped off earlier in the line, a rook on f8 checking a king
        // on f7 would be a check down the file — not this pattern.)
        findKing(s.board, playerColour)?.[1] === trapped.backRank
    );
  if (!invasion) return null;

  const balance = (board) => materialOf(board, opponent) - materialOf(board, playerColour);
  const gained = balance(last.board) - balance(start);
  if (gained < MATERIAL_WIN_MIN) return null;

  return {
    tag: "back-rank",
    squares: [invasion.move.to, trapped.kingSquare],
    detail: { kind: "material", invasionSquare: invasion.move.to, kingSquare: trapped.kingSquare, gained },
  };
}

const DETECTORS = [detectHangingPiece, detectBackRank];

/**
 * Tags one mistake moment.
 *
 * `moment` needs:
 *  - fenAfter: the position right after the player's mistake
 *  - refutationLine: the engine's best line from fenAfter (UCI moves), i.e.
 *    how the opponent punishes it
 *  - playerColour: "w" or "b" — whose mistake it was
 *
 * Returns an array of { tag, squares, detail }, possibly empty.
 */
export function tagMistake(moment) {
  const found = [];
  for (const detect of DETECTORS) {
    try {
      const result = detect(moment);
      if (result) found.push(result);
    } catch {
      // A malformed position or line mustn't take the whole scan down; it
      // just earns no tag.
    }
  }
  return found;
}
