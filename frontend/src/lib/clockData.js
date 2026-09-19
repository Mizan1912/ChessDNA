import { Chess } from "chess.js";

// Chess.com/Lichess PGNs put a clock reading after every move, like
// {[%clk 0:02:31.4]}. This file turns that into "how many seconds did the
// player spend thinking on each move" — the raw material the clock
// fingerprint (lib/clockFingerprint.js) is built from.

const OPENING_MOVE_CUTOFF = 12; // see decision.md D-020 — matches the spec's own "to move 12"

function parseClockSeconds(comment) {
  const match = comment?.match(/\[%clk (\d+):(\d+):(\d+(?:\.\d+)?)\]/);
  if (!match) return null;
  const [, hours, minutes, seconds] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

// TimeControl header looks like "180+2" (180s base, 2s increment), "180"
// (no increment), or "1/86400" (daily — no fixed base, handled as null).
function parseTimeControl(pgn) {
  const match = pgn.match(/\[TimeControl "(\d+)(?:\+(\d+))?"\]/);
  if (!match) return { baseSeconds: null, incrementSeconds: 0 };
  return { baseSeconds: Number(match[1]), incrementSeconds: match[2] ? Number(match[2]) : 0 };
}

// Returns one entry per move: { moveNumber, color, san, timeSpentSeconds,
// fenBefore, isOpening }. Moves with no clock data (older games, or a PGN
// with clocks stripped) are left out rather than guessed at.
export function pgnToClockMoves(pgn) {
  const game = new Chess();
  game.loadPgn(pgn);

  const { baseSeconds, incrementSeconds } = parseTimeControl(pgn);
  const comments = game.getComments();
  const commentByFen = new Map(comments.map((c) => [c.fen, c.comment]));

  const verboseHistory = game.history({ verbose: true });
  const clockReadings = verboseHistory.map((move) => parseClockSeconds(commentByFen.get(move.after)));

  const result = [];
  for (let i = 0; i < verboseHistory.length; i++) {
    const move = verboseHistory[i];
    const clockNow = clockReadings[i];
    // The previous reading for the SAME color is two plies back (white,
    // black, white, black, ...). For each color's very first move there's no
    // earlier reading — use the time control's starting time instead, if we
    // know it.
    const clockBefore = i >= 2 ? clockReadings[i - 2] : baseSeconds;

    if (clockNow === null || clockBefore === null) continue;

    const timeSpentSeconds = Math.max(0, clockBefore - clockNow + incrementSeconds);

    result.push({
      moveNumber: Math.floor(i / 2) + 1,
      color: move.color,
      san: move.san,
      fenBefore: move.before,
      timeSpentSeconds,
      isOpening: Math.floor(i / 2) + 1 <= OPENING_MOVE_CUTOFF,
    });
  }

  return result;
}
