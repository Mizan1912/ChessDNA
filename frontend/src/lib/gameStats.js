// The at-a-glance numbers on the Games screen: your record, and where your
// rating has gone across the games on screen. Pure functions over the
// normalised games — no engine, nothing stored.

export function recordOf(games) {
  const record = { wins: 0, losses: 0, draws: 0, total: games.length, winRate: null };
  for (const game of games) {
    if (game.result === "win") record.wins++;
    else if (game.result === "loss") record.losses++;
    else record.draws++;
  }
  // Draws count as half, the way chess scores everything.
  if (record.total > 0) record.winRate = ((record.wins + record.draws / 2) / record.total) * 100;
  return record;
}

/**
 * Your rating across these games, oldest to newest.
 *
 * Chess.com keeps a separate rating per time control, so a trend across "All"
 * would zigzag between your bullet and rapid numbers and mean nothing. With
 * "All" selected, this follows the time control you play most, and says which
 * one it chose — never a blended line presented as one rating.
 */
export function ratingTrend(games, timeClassFilter) {
  let timeClass = timeClassFilter;
  if (timeClass === "all") {
    const counts = {};
    for (const game of games) counts[game.timeClass] = (counts[game.timeClass] ?? 0) + 1;
    timeClass = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }
  if (!timeClass) return null;

  const points = games
    .filter((game) => game.timeClass === timeClass && typeof game.userRating === "number")
    .sort((a, b) => a.playedAt - b.playedAt)
    .map((game) => game.userRating);
  if (points.length === 0) return null;

  return {
    timeClass,
    points,
    current: points[points.length - 1],
    change: points[points.length - 1] - points[0],
    high: Math.max(...points),
  };
}
