import { Chess } from "chess.js";

// Turns a PGN string into a flat list the board viewer can step through.
// Each entry already carries the FEN before and after itself, so stepping
// forward/back never needs to replay moves — just look up the entry.
export function pgnToMoves(pgn) {
  const game = new Chess();
  game.loadPgn(pgn);

  const verboseHistory = game.history({ verbose: true });

  return verboseHistory.map((move, index) => ({
    moveNumber: Math.floor(index / 2) + 1,
    color: move.color, // "w" or "b"
    san: move.san, // e.g. "Nf6", "O-O", "Qxd8+"
    fenBefore: move.before,
    fenAfter: move.after,
  }));
}

export const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
