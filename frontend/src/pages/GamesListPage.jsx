import { useState } from "react";
import { Chessboard } from "react-chessboard";
import { pgnToMoves, STARTING_FEN } from "../lib/pgnToMoves";
import "./GamesListPage.css";

const MIN_GAMES = 3;
const MAX_GAMES = 100;
const GAMES_STEP = 10;

function formatDate(timestampMs) {
  return new Date(timestampMs).toLocaleDateString();
}

// The board a hovered game ended on — its final position is more telling at a
// glance than a description, and it keeps the board doing real work instead
// of sitting there as decoration.
function finalPositionFen(pgn) {
  const moves = pgnToMoves(pgn);
  return moves.length > 0 ? moves[moves.length - 1].fenAfter : STARTING_FEN;
}

export default function GamesListPage({
  onOpenGame,
  username,
  setUsername,
  gamesToFetch,
  setGamesToFetch,
  games,
  status,
  errorMessage,
  fetchGames,
}) {
  const [previewFen, setPreviewFen] = useState(STARTING_FEN);

  return (
    <div className="list-layout">
      <div className="list-main">
        <form className="toolbar" onSubmit={fetchGames}>
          <div className="field">
            <label htmlFor="username">Chess.com username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. hikaru"
            />
          </div>

          <div className="field slider-field">
            <label htmlFor="gamesToFetch">Games to fetch: {gamesToFetch}</label>
            <input
              id="gamesToFetch"
              type="range"
              min={MIN_GAMES}
              max={MAX_GAMES}
              step={GAMES_STEP}
              value={gamesToFetch}
              onChange={(event) => setGamesToFetch(Number(event.target.value))}
            />
          </div>

          <button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Loading..." : "Fetch games"}
          </button>
        </form>

        {status === "error" && (
          <p className="error-message" role="alert">
            {errorMessage}
          </p>
        )}

        {status === "done" && games.length === 0 && <p>No games found for this player.</p>}

        {games.length > 0 && (
          <div className="games-table-wrapper">
            <table className="games-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Opponent</th>
                  <th>Result</th>
                  <th>Time control</th>
                </tr>
              </thead>
              <tbody>
                {games.map((game) => (
                  <tr
                    key={game.id}
                    onClick={() => onOpenGame(game)}
                    onMouseEnter={() => setPreviewFen(finalPositionFen(game.pgn))}
                    onMouseLeave={() => setPreviewFen(STARTING_FEN)}
                  >
                    <td>{formatDate(game.playedAt)}</td>
                    <td>{game.opponentName}</td>
                    <td>{game.result}</td>
                    <td>{game.timeClass}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="list-board-panel">
        <Chessboard options={{ position: previewFen, allowDragging: false }} />
        <p className="board-caption">
          {games.length > 0 ? "hover a game to see how it ended" : "fetch games to get started"}
        </p>
      </div>
    </div>
  );
}
