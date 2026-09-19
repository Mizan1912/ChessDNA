import { groupIntoSessions } from "./sessions.js";

// See decision.md:
// D-014 — break-point threshold (10 points) and minimum-sessions bar (20)
// D-013 — "lost from a winning position" is out of scope until Phase 4 (needs engine eval)
const BREAK_POINT_THRESHOLD_POINTS = 10;
const MIN_SESSIONS_FOR_TILT = 20;

// Minimum games in an hour-of-day bucket before we'll report a "worst hour" —
// otherwise a single unlucky game at 4am could look like a real pattern.
// Chosen by the agent, matching Feature 1's own "at least 8" bar for the same
// reason (small samples lie). Needs review.
const MIN_GAMES_PER_HOUR_BUCKET = 8;

function toScoreValue(result) {
  if (result === "win") return 1;
  if (result === "draw") return 0.5;
  return 0;
}

function average(scores) {
  return scores.length > 0 ? (scores.reduce((sum, s) => sum + s, 0) / scores.length) * 100 : null;
}

// Average score (0-100) at each position-in-session, e.g. index 0 is every
// game-1-of-a-session, index 1 is every game-2-of-a-session, and so on.
// Keeps the actual games in each bucket too — the evidence rule requires every
// finding to link back to the real games it came from, never a bare number.
export function computeScoreByIndex(sessions) {
  const buckets = new Map();

  for (const session of sessions) {
    for (const game of session) {
      if (!buckets.has(game.sessionIndex)) buckets.set(game.sessionIndex, []);
      buckets.get(game.sessionIndex).push(game);
    }
  }

  return [...buckets.entries()]
    .map(([sessionIndex, games]) => ({
      sessionIndex,
      scorePercent: average(games.map((g) => toScoreValue(g.result))),
      gameCount: games.length,
      games,
    }))
    .sort((a, b) => a.sessionIndex - b.sessionIndex);
}

// The first session-index that is BREAK_POINT_THRESHOLD_POINTS or more below
// game 1's score, and stays that far below for every later index we have data
// for. Returns null if no such point exists (or there isn't enough data).
export function findBreakPoint(scoreByIndex) {
  if (scoreByIndex.length < 2 || scoreByIndex[0].scorePercent === null) return null;

  const baseline = scoreByIndex[0].scorePercent;

  for (let i = 1; i < scoreByIndex.length; i++) {
    const staysDown = scoreByIndex
      .slice(i)
      .every((entry) => entry.scorePercent !== null && entry.scorePercent <= baseline - BREAK_POINT_THRESHOLD_POINTS);

    if (staysDown) return scoreByIndex[i].sessionIndex;
  }

  return null;
}

// Score in the game right after a loss, right after a loss on time, and
// overall — compared side by side. Uses every game in chronological order,
// not just games inside multi-game sessions, since "the next game you played"
// still applies even across a long break.
export function computeTiltChain(allGamesChronological) {
  const overallScore = average(allGamesChronological.map((g) => toScoreValue(g.result)));

  const afterAnyLossGames = [];
  const afterLossOnTimeGames = [];

  for (let i = 1; i < allGamesChronological.length; i++) {
    const previous = allGamesChronological[i - 1];
    const current = allGamesChronological[i];

    if (previous.result === "loss") {
      afterAnyLossGames.push(current);
      if (previous.resultReason === "timeout") {
        afterLossOnTimeGames.push(current);
      }
    }
  }

  return {
    overallScore,
    postLossScore: average(afterAnyLossGames.map((g) => toScoreValue(g.result))),
    postLossOnTimeScore: average(afterLossOnTimeGames.map((g) => toScoreValue(g.result))),
    afterAnyLossGames,
    afterLossOnTimeGames,
  };
}

// Score by hour of day, in whatever timezone this browser is set to (assumed
// to be the player's own timezone — see rnd.md if that assumption ever needs
// revisiting for a multi-timezone household or travel).
export function findWorstHour(allGames) {
  const buckets = new Map();

  for (const game of allGames) {
    const hour = new Date(game.playedAt).getHours();
    if (!buckets.has(hour)) buckets.set(hour, []);
    buckets.get(hour).push(game);
  }

  const qualifying = [...buckets.entries()]
    .filter(([, games]) => games.length >= MIN_GAMES_PER_HOUR_BUCKET)
    .map(([hour, games]) => ({
      hour,
      scorePercent: average(games.map((g) => toScoreValue(g.result))),
      gameCount: games.length,
      games,
    }));

  if (qualifying.length === 0) return null;

  return qualifying.reduce((worst, entry) => (entry.scorePercent < worst.scorePercent ? entry : worst));
}

// Runs the whole Feature 2 analysis on a list of normalized games. Returns a
// status so the UI can show "not enough games yet" instead of a fake number.
export function analyzeTilt(games) {
  const sessions = groupIntoSessions(games);
  const totalSessions = sessions.length;

  if (totalSessions < MIN_SESSIONS_FOR_TILT) {
    return { status: "insufficient-data", sessionsFound: totalSessions, sessionsNeeded: MIN_SESSIONS_FOR_TILT };
  }

  const chronological = [...games].sort((a, b) => a.playedAt - b.playedAt);
  const scoreByIndex = computeScoreByIndex(sessions);

  return {
    status: "ok",
    sessionsAnalysed: totalSessions,
    scoreByIndex,
    breakPointIndex: findBreakPoint(scoreByIndex),
    tiltChain: computeTiltChain(chronological),
    worstHour: findWorstHour(chronological),
  };
}
