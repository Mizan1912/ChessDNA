import { useState } from "react";
import { Chessboard } from "react-chessboard";
import { getRecentGames, UsernameNotFoundError } from "../lib/chessComApi";
import { normalizeChessComGame } from "../lib/normalizeGame";
import { pgnToMoves, STARTING_FEN } from "../lib/pgnToMoves";
import "./GamesListPage.css";

// Slider bounds for how many games to pull. 50 matches the "first run analyses
// 50 games" plan from the build doc, kept here only as the slider's starting
// value — the user can move it, so it's not a fixed limit anywhere else.
const MIN_GAMES = 10;
const MAX_GAMES = 100;
const DEFAULT_GAMES = 50;
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

export default function GamesListPage({ onOpenGame }) {
  const [username, setUsername] = useState("");
  const [gamesToFetch, setGamesToFetch] = useState(DEFAULT_GAMES);
  const [games, setGames] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | error | done
  const [errorMessage, setErrorMessage] = useState("");
  const [previewFen, setPreviewFen] = useState(STARTING_FEN);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedUsername = username.trim();
    if (!trimmedUsername) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const rawGames = await getRecentGames(trimmedUsername, gamesToFetch);
      const normalized = rawGames.map((game) => normalizeChessComGame(game, trimmedUsername));
      setGames(normalized);
      setStatus("done");
    } catch (error) {
      if (error instanceof UsernameNotFoundError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Something went wrong reaching Chess.com. Try again in a moment.");
      }
      setGames([]);
      setStatus("error");
    }
  }

  return (
    <div className="list-layout">
      <div className="list-main">
        <form className="toolbar" onSubmit={handleSubmit}>
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
