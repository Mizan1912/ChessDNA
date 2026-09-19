// A "session" is a run of games played close together, with no long break.
// This has nothing to do with logging in — it's purely about clustering games
// by when they were played.

const SESSION_GAP_MINUTES = 30; // see decision.md D-014's neighbourhood — matches the spec's own number

// Groups games into sessions and returns each game tagged with its session
// index (0 = first game of that session). Sessions of exactly one game are
// dropped — a single game has no "session pattern" to measure.
export function groupIntoSessions(games) {
  const sorted = [...games].sort((a, b) => a.playedAt - b.playedAt);
  const gapMs = SESSION_GAP_MINUTES * 60 * 1000;

  const rawSessions = [];
  let currentSession = [];

  for (const game of sorted) {
    const previousGame = currentSession[currentSession.length - 1];
    const startsNewSession = !previousGame || game.playedAt - previousGame.playedAt > gapMs;

    if (startsNewSession) {
      if (currentSession.length > 0) rawSessions.push(currentSession);
      currentSession = [game];
    } else {
      currentSession.push(game);
    }
  }
  if (currentSession.length > 0) rawSessions.push(currentSession);

  return rawSessions
    .filter((session) => session.length > 1)
    .map((session) => session.map((game, index) => ({ ...game, sessionIndex: index })));
}
