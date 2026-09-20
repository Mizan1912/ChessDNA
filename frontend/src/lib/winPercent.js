// Converts an engine evaluation (centipawns) into "what percentage of the
// time does a player in this position actually win?".
//
// Why this exists: centipawns are a terrible way to measure a mistake.
// Dropping 300cp from +500 to +200 is meaningless — you were completely
// winning before and you're completely winning after. Dropping 300cp from
// +50 to -250 loses the game. Win percentage flattens out at the extremes
// the same way real chess does, so the same "eval loss" near equality counts
// for much more than it does in an already-decided position.
//
// Formula is Lichess's, which the build doc points at by name. See
// decision.md D-032.
const LICHESS_CONSTANT = -0.00368208;

export function centipawnsToWinPercent(centipawns) {
  const winningChances = 2 / (1 + Math.exp(LICHESS_CONSTANT * centipawns)) - 1; // -1..+1
  return 50 + 50 * winningChances; // 0..100
}

// How much of the game a single move threw away, in percentage points.
// Never negative — a move that improves the position didn't lose anything.
export function winPercentLost(evalBeforeCp, evalAfterCp) {
  const before = centipawnsToWinPercent(evalBeforeCp);
  const after = centipawnsToWinPercent(evalAfterCp);
  return Math.max(0, before - after);
}
