import { useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { pgnToMoves, STARTING_FEN } from "../lib/pgnToMoves";
import "./GamesListPage.css";

const MIN_GAMES = 3;
const MAX_GAMES = 100;
const GAMES_STEP = 10;

// Chess.com's known time classes, in the order we want the tabs to appear.
// Anything outside this list (rare) still gets a tab, just tacked on at the end.
const KNOWN_TIME_CLASS_ORDER = ["bullet", "blitz", "rapid", "daily"];

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

function timeClassTabs(games) {
  const counts = new Map();
  for (const game of games) {
    counts.set(game.timeClass, (counts.get(game.timeClass) || 0) + 1);
  }

  const known = KNOWN_TIME_CLASS_ORDER.filter((tc) => counts.has(tc));
  const unknown = [...counts.keys()].filter((tc) => !KNOWN_TIME_CLASS_ORDER.includes(tc));

  return [...known, ...unknown].map((timeClass) => ({ timeClass, count: counts.get(timeClass) }));
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
  const [activeTimeClass, setActiveTimeClass] = useState("all");

  const tabs = useMemo(() => timeClassTabs(games), [games]);
  const visibleGames = activeTimeClass === "all" ? games : games.filter((g) => g.timeClass === activeTimeClass);

  // A new fetch can land on a time class that no longer has any games in it
  // (e.g. switching from a bullet-heavy account to a daily-only one) — fall
  // back to "all" rather than silently showing an empty table.
  const hasActiveTab = activeTimeClass === "all" || tabs.some((tab) => tab.timeClass === activeTimeClass);
  const effectiveTimeClass = hasActiveTab ? activeTimeClass : "all";
  const effectiveVisibleGames = hasActiveTab ? visibleGames : games;

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
          <>
            <div className="time-class-tabs">
              <button
                className={effectiveTimeClass === "all" ? "active" : ""}
                onClick={() => setActiveTimeClass("all")}
              >
                All ({games.length})
              </button>
              {tabs.map((tab) => (
                <button
                  key={tab.timeClass}
                  className={effectiveTimeClass === tab.timeClass ? "active" : ""}
                  onClick={() => setActiveTimeClass(tab.timeClass)}
                >
                  {tab.timeClass} ({tab.count})
                </button>
              ))}
            </div>

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
                  {effectiveVisibleGames.map((game) => (
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
          </>
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
