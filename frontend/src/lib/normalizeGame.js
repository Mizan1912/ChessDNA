// Chess.com and Lichess describe a game very differently. Every screen in this app
// should only ever see the shape below, so the rest of the code doesn't care which
// site a game came from.
//
// Normalized game shape:
// {
//   id: string              - unique per game, stable across reloads
//   platform: "chesscom" | "lichess"
//   url: string             - link back to the real game, for the evidence rule
//   playedAt: number        - unix timestamp (ms) the game ended
//   timeClass: string       - "bullet" | "blitz" | "rapid" | "daily" etc
//   userColor: "white" | "black"
//   opponentName: string
//   result: "win" | "loss" | "draw"
//   pgn: string
// }

// Chess.com's per-player result field is one of many words for win/loss/draw.
// See https://www.chess.com/news/view/published-data-api under "Game results".
const DRAW_RESULTS = new Set([
  "agreed",
  "repetition",
  "stalemate",
  "insufficient",
  "50move",
  "timevsinsufficient",
]);
const WIN_RESULTS = new Set(["win"]);

function toWinLossDraw(chessComResultWord) {
  if (WIN_RESULTS.has(chessComResultWord)) return "win";
  if (DRAW_RESULTS.has(chessComResultWord)) return "draw";
  return "loss";
}

export function normalizeChessComGame(rawGame, username) {
  const lowerUsername = username.toLowerCase();
  const userIsWhite = rawGame.white.username.toLowerCase() === lowerUsername;
  const userSide = userIsWhite ? rawGame.white : rawGame.black;
  const opponentSide = userIsWhite ? rawGame.black : rawGame.white;

  return {
    id: rawGame.uuid,
    platform: "chesscom",
    url: rawGame.url,
    playedAt: rawGame.end_time * 1000,
    timeClass: rawGame.time_class,
    userColor: userIsWhite ? "white" : "black",
    opponentName: opponentSide.username,
    result: toWinLossDraw(userSide.result),
    pgn: rawGame.pgn,
  };
}
