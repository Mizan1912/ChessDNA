import { Chess } from "chess.js";
import { PIECE_NAMES, PIECE_VALUES, findHangingPiece } from "./explainBlunder.js";
import { centipawnsToWinPercent } from "./winPercent.js";

// A short explanation for EVERY move in a reviewed game — why it was
// excellent, why it was a mistake — the way Chess.com's coach talks you
// through a review. See decision.md D-052.
//
// The rule, same as explainBlunder.js: nothing is claimed unless it has been
// checked on the board. Each sentence comes from one of three sources:
//   1. what the move physically did — replayed with chess.js (it took the
//      knight, gave check, castled, attacks the queen on d8…)
//   2. what its label means — which the classifier has already verified (a
//      "great" move is by definition the only one that held; see moveLabels.js)
//   3. the engine's own line after the move — its best reply and the move
//      after, replayed on the board ("walks into Bxe4, which takes your
//      knight on e4")
// Chess.com's coach is more colourful. This is plainer on purpose: a
// confident sentence that's wrong costs more trust than a plain one that's true.

const MATE_THRESHOLD_CP = 90000;

const other = (colour) => (colour === "w" ? "b" : "w");

// One side's material minus the other's, in pawns (kings don't count).
const MATERIAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
function balance(fen, colour) {
  let total = 0;
  for (const row of new Chess(fen).board()) {
    for (const square of row) if (square) total += (square.color === colour ? 1 : -1) * MATERIAL[square.type];
  }
  return total;
}

// Replays UCI moves from a position and returns each move chess.js made
// (with its SAN, capture, check…), stopping quietly at anything illegal.
function replay(fen, uciMoves, limit) {
  const board = new Chess(fen);
  const played = [];
  for (const uci of (uciMoves ?? []).slice(0, limit)) {
    let move;
    try {
      move = board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    } catch {
      break;
    }
    if (!move) break;
    played.push({ ...move, givesMate: board.isCheckmate() });
  }
  return played;
}

// The most valuable enemy piece the moved piece now attacks, if attacking it
// is a real threat: it's undefended, or worth more than the attacker.
// Knights and up only — "attacks a pawn" isn't worth a sentence.
function newThreat(after, move) {
  const moverValue = PIECE_VALUES[move.promotion ?? move.piece];
  let best = null;
  for (const row of after.board()) {
    for (const square of row) {
      if (!square || square.color === move.color || square.type === "k" || square.type === "p") continue;
      if (!after.attackers(square.square, move.color).includes(move.to)) continue;
      const undefended = after.attackers(square.square, other(move.color)).length === 0;
      if (!undefended && PIECE_VALUES[square.type] <= moverValue) continue;
      if (!best || PIECE_VALUES[square.type] > PIECE_VALUES[best.type]) best = square;
    }
  }
  return best;
}

// Sentence one: what the move physically did.
function describeAction(move, after, moveNumber, previousMove) {
  const parts = [];
  const backRank = move.color === "w" ? "1" : "8";

  if (move.flags.includes("k")) parts.push("castles kingside");
  else if (move.flags.includes("q")) parts.push("castles queenside");
  else if (move.promotion) parts.push(`promotes to a ${PIECE_NAMES[move.promotion]}`);
  else if (move.captured && previousMove?.captured && previousMove.to === move.to) {
    parts.push(`takes back on ${move.to}`);
  } else if (move.captured) {
    parts.push(`takes the ${PIECE_NAMES[move.captured]} on ${move.to}`);
  } else if ((move.piece === "n" || move.piece === "b") && move.from[1] === backRank && moveNumber <= 15) {
    parts.push(`develops the ${PIECE_NAMES[move.piece]}`);
  } else if (move.piece === "p") {
    parts.push(move.flags.includes("b") ? `pushes the pawn two squares to ${move.to}` : `pushes the pawn to ${move.to}`);
  }

  if (after.isCheck()) parts.push(parts.length ? "with check" : "gives check");

  const threat = newThreat(after, move);
  if (threat) parts.push(`${parts.length ? "and " : ""}attacks the ${PIECE_NAMES[threat.type]} on ${threat.square}`);

  if (parts.length === 0) return null;
  // "with check" attaches without a comma; everything else is a clause.
  let text = parts[0];
  for (const part of parts.slice(1)) text += part.startsWith("with") ? ` ${part}` : `, ${part}`;
  return `${move.san} ${text}.`;
}

// "Next, the engine expects Rxe1 and then Kf7."
function whatComesNext(line) {
  if (line.length === 0) return null;
  if (line.length === 1) return `The engine expects ${line[0].san} next.`;
  return `The engine expects ${line[0].san}, then ${line[1].san}.`;
}

/**
 * Explains one move of a reviewed game.
 *
 * input:
 *  - san, color ("w"/"b"), moveNumber, fenBefore, fenAfter — the move itself
 *  - label, bestMoveSan, replyLine (UCI) — from the review
 *  - evalBeforeCp, evalAfterCp — engine evaluations, White's point of view
 *  - isYou — whether the viewer made this move (for "your" vs "their")
 *  - previousMove — the verbose chess.js move before it, if any (recaptures)
 *
 * Returns a string of one to three sentences, or null if the move can't be
 * replayed (never throws).
 */
export function explainMove(input) {
  const { san, fenBefore, fenAfter, label, bestMoveSan, replyLine, evalBeforeCp, evalAfterCp, isYou, moveNumber, previousMove } = input;
  let move;
  let after;
  try {
    const board = new Chess(fenBefore);
    move = board.move(san);
    after = new Chess(fenAfter);
  } catch {
    return null;
  }

  const your = isYou ? "your" : "their";
  const You = isYou ? "You" : "They";
  const them = isYou ? "you" : "them";

  if (after.isCheckmate()) return `${san} is checkmate.`;

  // Everything judged from the mover's side of the board.
  const sign = move.color === "w" ? 1 : -1;
  const before = (evalBeforeCp ?? 0) * sign;
  const afterEval = (evalAfterCp ?? 0) * sign;

  const action = describeAction(move, after, moveNumber, previousMove);
  const line = replay(fenAfter, replyLine, 2);
  const better = bestMoveSan && bestMoveSan !== san ? bestMoveSan : null;
  const sentences = [];

  if (action) sentences.push(action);

  switch (label) {
    case "book":
      sentences.push("A standard opening move.");
      break;
    case "brilliant":
      sentences.push(`A sacrifice that works: it gives up material, and ${your} position still holds.`);
      break;
    case "great":
      sentences.push(`The only move that holds ${your} position — every alternative was clearly worse.`);
      break;
    case "best":
      sentences.push("The engine's top choice.");
      break;
    case "excellent":
      sentences.push(better ? `Nearly as strong as the engine's top choice, ${better}.` : "Nearly as strong as the engine's top choice.");
      break;
    case "good":
      sentences.push(better ? `A reasonable move, though ${better} was stronger.` : "A reasonable move.");
      break;
    default: {
      // Inaccuracy, mistake, miss, blunder: say what actually goes wrong,
      // most serious first, and only what the board or the engine line shows.
      const reply = line[0];
      // Whether material is really lost is decided by COUNTING it: the
      // mover's material balance before this move, against the balance once
      // the engine's whole stored line has played out. Looking one move ahead
      // got it wrong both ways in a real game — it called knight-for-knight
      // a lost knight, and when patched to spot "they take straight back",
      // it hid a real loss (Nh5 Qxf3: the queens come off, but the bishop
      // stays lost). Counting across the line settles both. Only trusted when
      // the line ends quietly: if its last move is a capture, the exchange is
      // still going and the count would be premature.
      const exchange = replay(fenAfter, replyLine, 6);
      const settled = exchange.length > 0 && !exchange[exchange.length - 1].captured;
      const endFen = exchange.length ? exchange[exchange.length - 1].after : fenAfter;
      const materialLost = settled ? balance(fenBefore, move.color) - balance(endFen, move.color) : 0;

      if (before >= MATE_THRESHOLD_CP && afterEval < MATE_THRESHOLD_CP) {
        sentences.push(`${You} had a forced mate here${better ? `, starting with ${better}` : ""}.`);
      } else if (afterEval <= -MATE_THRESHOLD_CP && reply) {
        sentences.push(reply.givesMate ? `It walks into ${reply.san}, which is checkmate.` : `It allows a forced mate, starting with ${reply.san}.`);
      } else if (reply?.captured && materialLost >= 2) {
        // Name the piece only when it IS what's lost once the dust settles.
        const piece = reply.captured !== "p" && Math.abs(materialLost - PIECE_VALUES[reply.captured]) <= 1 ? reply.captured : null;
        const lostTheExchange = reply.captured === "r" && materialLost === 2;
        sentences.push(
          lostTheExchange
            ? `It walks into ${reply.san}, and ${them === "you" ? "you lose" : "they lose"} the exchange — a rook for a minor piece.`
            : piece
            ? `It walks into ${reply.san}, which wins ${your} ${PIECE_NAMES[piece]} on ${reply.to}.`
            : `It walks into ${reply.san}, and ${them === "you" ? "you lose" : "they lose"} material in the exchanges that follow.`
        );
      } else {
        const hanging = findHangingPiece(fenAfter, move.color);
        // A piece that's "hanging" only because it's the first half of an even
        // trade (Bxd6 cxd6) isn't a weakness worth naming.
        const partOfTrade = hanging && reply?.captured && reply.to === hanging.square;
        if (hanging && !partOfTrade) {
          sentences.push(
            `It leaves ${your} ${hanging.pieceName} on ${hanging.square} ${hanging.undefended ? "undefended" : `attacked by a ${hanging.attackerName}`}.`
          );
        } else {
          const lost = Math.round(centipawnsToWinPercent(before) - centipawnsToWinPercent(afterEval));
          if (lost >= 1) sentences.push(`It costs ${them} about ${lost}% of ${your} winning chances.`);
        }
      }
      if (better && !sentences.some((s) => s.includes(better))) sentences.push(`Better was ${better}.`);
      return sentences.join(" ");
    }
  }

  const next = whatComesNext(line);
  if (next) sentences.push(next);
  return sentences.join(" ");
}
