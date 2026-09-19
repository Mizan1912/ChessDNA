import { pgnToClockMoves } from "./clockData.js";

// See decision.md D-020 — only positions reached at least this many times
// count as "you know this position," matching the spec's own "20+ times."
const MIN_REPEATS_FOR_KNOWN_POSITION = 20;

// Same position, ignoring the halfmove/fullmove counters at the end of a FEN
// (two positions with identical pieces/turn/castling/en-passant are "the
// same position" even if reached by different move orders).
function positionKey(fen) {
  return fen.split(" ").slice(0, 4).join(" ");
}

function sumTime(moves) {
  return moves.reduce((sum, m) => sum + m.timeSpentSeconds, 0);
}

export function analyzeClock(games) {
  // Each entry below carries which game it came from, so every finding can
  // link back to the real game — the evidence rule.
  const allMoves = [];
  const positionMap = new Map(); // positionKey -> array of move entries

  for (const game of games) {
    let clockMoves;
    try {
      clockMoves = pgnToClockMoves(game.pgn);
    } catch {
      continue; // a PGN chess.js can't parse for clocks just gets skipped
    }

    for (const move of clockMoves) {
      const entry = { ...move, game };
      allMoves.push(entry);

      if (move.isOpening) {
        const key = positionKey(move.fenBefore);
        if (!positionMap.has(key)) positionMap.set(key, []);
        positionMap.get(key).push(entry);
      }
    }
  }

  if (allMoves.length === 0) {
    return { status: "no-clock-data" };
  }

  const openingMoves = allMoves.filter((m) => m.isOpening);
  const openingTimeShare = (sumTime(openingMoves) / sumTime(allMoves)) * 100;

  const longestThink = allMoves.reduce((longest, move) =>
    move.timeSpentSeconds > longest.timeSpentSeconds ? move : longest
  );

  const gamesLostOnTime = games.filter((g) => g.result === "loss" && g.resultReason === "timeout");

  const knownPositionGroups = [...positionMap.values()].filter(
    (group) => group.length >= MIN_REPEATS_FOR_KNOWN_POSITION
  );
  const allKnownPositionMoves = knownPositionGroups.flat();
  const wastefulKnownPosition =
    allKnownPositionMoves.length > 0
      ? (() => {
          const worst = allKnownPositionMoves.reduce((a, b) => (b.timeSpentSeconds > a.timeSpentSeconds ? b : a));
          const group = knownPositionGroups.find((g) => g.includes(worst));
          return { worst, timesReached: group.length, group };
        })()
      : null;

  return {
    status: "ok",
    openingTimeShare,
    longestThink,
    gamesLostOnTime,
    wastefulKnownPosition,
    gamesAnalysed: games.length,
    movesWithClockData: allMoves.length,
  };
}
