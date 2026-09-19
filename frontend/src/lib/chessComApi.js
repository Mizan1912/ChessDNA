// Talks to the Chess.com public API. No API key needed, called straight from the browser.
// Docs: https://www.chess.com/news/view/published-data-api

// Falls back to the real public endpoint if VITE_CHESSCOM_API_BASE_URL isn't set,
// so the app still works with zero env setup — but it's overridable (e.g. pointing
// at a mock server in tests) without touching code. See .env.example at repo root.
const BASE_URL = import.meta.env.VITE_CHESSCOM_API_BASE_URL || "https://api.chess.com/pub";

// Chess.com returns a plain 404 for a username that doesn't exist.
export class UsernameNotFoundError extends Error {
  constructor(username) {
    super(`No Chess.com player found with username "${username}"`);
    this.name = "UsernameNotFoundError";
  }
}

async function fetchJson(url, username) {
  const response = await fetch(url);
  if (response.status === 404) {
    throw new UsernameNotFoundError(username);
  }
  if (!response.ok) {
    throw new Error(`Chess.com API request failed (${response.status}): ${url}`);
  }
  return response.json();
}

// Chess.com stores games in one archive per month. This returns the archive URLs,
// oldest first.
export async function getArchiveUrls(username) {
  const data = await fetchJson(`${BASE_URL}/player/${username}/games/archives`, username);
  return data.archives;
}

async function getGamesFromArchive(archiveUrl, username) {
  const data = await fetchJson(archiveUrl, username);
  return data.games;
}

// Fetches the player's most recent games, newest first, stopping once we have at
// least `limit` games (or we run out of archives). Chess.com has no "give me the
// last N games" endpoint, so we walk archives backwards from the most recent month.
export async function getRecentGames(username, limit) {
  const archiveUrls = await getArchiveUrls(username);
  const games = [];

  for (let i = archiveUrls.length - 1; i >= 0 && games.length < limit; i--) {
    const monthGames = await getGamesFromArchive(archiveUrls[i], username);
    games.push(...monthGames.reverse()); // newest game in the month first
  }

  return games.slice(0, limit);
}
