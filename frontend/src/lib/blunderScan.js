import { Engine } from "./engine.js";
import { pgnToMoves } from "./pgnToMoves.js";
import { pgnToClockMoves } from "./clockData.js";
import { winPercentLost } from "./winPercent.js";
import { explainBlunder, uciToSan } from "./explainBlunder.js";

// See decision.md D-031 (where these get tuned) and D-032 (why the main
// threshold is win-percentage rather than the spec's raw centipawns).
// 15 points is the honest translation of the spec's "150 centipawns": near
// equality, where mistakes actually decide games, 150cp IS about 15 points
// of win chance. Expressed this way it keeps that same sensitivity in close
// positions while ignoring the same 150cp swing in an already-won game.
const BLUNDER_THRESHOLD_WIN_PERCENT = 15;
const DECIDED_POSITION_CP = 600; // past this, the game is already won/lost — a "blunder" there means nothing
const BOOK_MOVES_SKIPPED = 8; // full moves of opening theory, where a "mistake" is usually just book
const SCAN_DEPTH = 12; // bulk-scan depth: fast enough for 50 games, deep enough to spot real errors

// Scores from engine.js are always from White's point of view. Everything
// below wants them from the PLAYER's point of view instead — "did this move
// make things worse for me" — so Black's evals get flipped.
function fromPlayerPerspective(scoreCp, userColor) {
  return userColor === "black" ? -scoreCp : scoreCp;
}

// Walks one game and returns every moment where the player threw away
// BLUNDER_THRESHOLD_CP or more. Only the player's own moves are checked —
// the opponent's mistakes aren't this app's business.
async function scanOneGame(engine, game) {
  const moves = pgnToMoves(game.pgn);
  const clockMoves = pgnToClockMoves(game.pgn); // same length/order as `moves`
  const playerColorLetter = game.userColor === "black" ? "b" : "w";
  const blunders = [];

  for (let plyIndex = 0; plyIndex < moves.length; plyIndex++) {
    const move = moves[plyIndex];
    if (move.color !== playerColorLetter) continue;
    if (move.moveNumber <= BOOK_MOVES_SKIPPED) continue;

    const before = await engine.evaluate(move.fenBefore, SCAN_DEPTH);
    const evalBefore = fromPlayerPerspective(before.scoreCp, game.userColor);

    // Already winning big or losing big — the eval swing there says nothing
    // useful about the player's judgement, so don't count it.
    if (Math.abs(evalBefore) > DECIDED_POSITION_CP) continue;

    // You cannot blunder by playing the engine's own first choice. This
    // guard matters because of how the two evaluations are taken: scoring
    // the position AFTER a move searches one ply deeper than the position
    // before it did, so even a perfect move can show a small apparent
    // "drop". Without this, the best move in the position sometimes gets
    // reported as a mistake, which is nonsense on its face.
    if (uciToSan(move.fenBefore, before.bestMove) === move.san) continue;

    const after = await engine.evaluate(move.fenAfter, SCAN_DEPTH);
    const evalAfter = fromPlayerPerspective(after.scoreCp, game.userColor);

    const lostWinPercent = winPercentLost(evalBefore, evalAfter);
    if (lostWinPercent < BLUNDER_THRESHOLD_WIN_PERCENT) continue;

    const blunder = {
      game,
      plyIndex,
      moveNumber: move.moveNumber,
      fenBefore: move.fenBefore,
      fenAfter: move.fenAfter,
      movePlayed: move.san,
      // Both in UCI format (e.g. "g1f3"); explainBlunder.js turns them into
      // readable notation and works out WHY the move was bad.
      engineBestMove: before.bestMove, // what the player should have played
      refutationMove: after.bestMove, // how the opponent punishes what they did play
      evalBefore,
      evalAfter,
      lostWinPercent,
      lostCentipawns: evalBefore - evalAfter, // kept for display; not what the threshold uses
      clockSeconds: clockMoves[plyIndex]?.timeSpentSeconds ?? null,
    };

    // Worked out once here rather than on every render — it's the same
    // answer every time, and the viewer wants it too.
    blunder.explanation = explainBlunder(blunder);
    blunders.push(blunder);
  }

  return blunders;
}

// Scans a whole batch of games. Reports progress after each game so the UI
// can show a real progress bar, and checks `isCancelled` between games so
// navigating away doesn't leave the engine grinding in the background.
export async function scanGamesForBlunders(games, { onProgress, isCancelled } = {}) {
  const engine = new Engine();
  const allBlunders = [];

  try {
    await engine.start();

    for (let i = 0; i < games.length; i++) {
      if (isCancelled?.()) break;

      try {
        allBlunders.push(...(await scanOneGame(engine, games[i])));
      } catch {
        // One unparseable PGN shouldn't kill a 50-game scan.
      }

      onProgress?.({ gamesDone: i + 1, totalGames: games.length, blundersFound: allBlunders.length });
    }
  } finally {
    engine.stop();
  }

  return allBlunders;
}
