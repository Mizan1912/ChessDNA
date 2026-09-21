import { useState } from "react";
import { Chessboard } from "react-chessboard";
import { pgnToMoves, STARTING_FEN } from "../lib/pgnToMoves";
import { recordOf, ratingTrend } from "../lib/gameStats";
import { useMediaQuery, CAN_HOVER_QUERY, MOBILE_QUERY } from "../hooks/useMediaQuery";
import Icon from "../components/Icon";
import "./GamesListPage.css";

const MIN_GAMES = 1;
const MAX_GAMES = 100;
const GAMES_STEP = 1;

// "21 Sep" — the year only when it isn't this year. Shorter and easier to
// scan than 21/09/2026, and never ambiguous between day-first and month-first.
function formatDate(timestampMs) {
  const date = new Date(timestampMs);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

const RESULT_LETTER = { win: "W", loss: "L", draw: "D" };

// The board a hovered game ended on — its final position is more telling at a
// glance than a description. Only where hovering is possible: see below.
function finalPositionFen(pgn) {
  const moves = pgnToMoves(pgn);
  return moves.length > 0 ? moves[moves.length - 1].fenAfter : STARTING_FEN;
}

// A rating line drawn from real per-game ratings. No axes: it's there to
// show direction at a glance; the exact numbers sit right next to it.
function Sparkline({ points }) {
  if (points.length < 2) return null;
  const width = 160;
  const height = 44;
  const low = Math.min(...points);
  const span = Math.max(...points) - low || 1;
  const coords = points.map((value, index) => [
    (index / (points.length - 1)) * width,
    height - 4 - ((value - low) / span) * (height - 8),
  ]);
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(201,154,60,0.35)" />
          <stop offset="1" stopColor="rgba(201,154,60,0)" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#spark-fill)" />
      <polyline points={line} fill="none" stroke="#d6a94d" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function StatsStrip({ games, timeClassFilter }) {
  const record = recordOf(games);
  const trend = ratingTrend(games, timeClassFilter);

  return (
    <div className="stats-strip stagger">
      <div className="card stat-card" style={{ "--i": 0 }}>
        <span className="eyebrow">Record</span>
        <div className="stat-value">
          {record.wins}
          <span className="record-sep">–</span>
          {record.losses}
          <span className="record-sep">–</span>
          {record.draws}
        </div>
        <span className="stat-foot">
          <span className="win">wins</span> · <span className="loss">losses</span> · draws
        </span>
      </div>

      <div className="card stat-card" style={{ "--i": 1 }}>
        <span className="eyebrow">Score</span>
        <div className="stat-value gold">
          {record.winRate === null ? "—" : Math.round(record.winRate)}
          <span className="stat-unit">%</span>
        </div>
        <span className="stat-foot">across {record.total} game{record.total === 1 ? "" : "s"}</span>
      </div>

      {trend && (
        <div className="card stat-card rating-card" style={{ "--i": 2 }}>
          <div className="rating-copy">
            {/* Says which rating it is — Chess.com keeps one per time control. */}
            <span className="eyebrow">{trend.timeClass} rating</span>
            <div className="stat-value">{trend.current}</div>
            <span className={`stat-foot rating-change ${trend.change >= 0 ? "up" : "down"}`}>
              {trend.change >= 0 ? "▲" : "▼"} {Math.abs(trend.change)} over these games
            </span>
          </div>
          <Sparkline points={trend.points} />
        </div>
      )}
    </div>
  );
}

// `games` is already filtered to the active time class — see App.jsx /
// useFetchedGames.js.
export default function GamesListPage({
  onOpenGame,
  username,
  setUsername,
  gamesToFetch,
  setGamesToFetch,
  games,
  allGamesCount,
  timeClassFilter,
  status,
  errorMessage,
  fetchGames,
  filterTabs,
}) {
  const [previewFen, setPreviewFen] = useState(STARTING_FEN);
  // The "hover a game to see how it ended" board only exists where hovering
  // does. On a touch screen there's no hover: the board would just sit there
  // showing the starting position, taking half the screen — so it's gone,
  // and tapping a game opens it straight away.
  const canHover = useMediaQuery(CAN_HOVER_QUERY);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const showPreview = canHover && !isMobile && games.length > 0;
  const loading = status === "loading";

  return (
    <div className={`games-page${games.length > 0 ? " fills-screen" : ""}`}>
      <header className="page-header">
        <span className="eyebrow">Chess DNA</span>
        <h1>
          Find out how you <span className="accent-em">specifically</span> lose.
        </h1>
        <p>Pull your recent Chess.com games, then open any finding to see the exact positions behind it.</p>
      </header>

      <form className="fetch-card card" onSubmit={fetchGames}>
        <div className="field username-field">
          <label htmlFor="username">Chess.com username</label>
          <div className="input-with-icon">
            <Icon name="search" size={18} />
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. hikaru"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
            />
          </div>
        </div>

        <div className="field slider-field">
          <label htmlFor="gamesToFetch">
            Games to fetch <strong className="slider-value">{gamesToFetch}</strong>
          </label>
          <input
            id="gamesToFetch"
            type="range"
            min={MIN_GAMES}
            max={MAX_GAMES}
            step={GAMES_STEP}
            value={gamesToFetch}
            onChange={(event) => setGamesToFetch(Number(event.target.value))}
            style={{ "--fill": `${((gamesToFetch - MIN_GAMES) / (MAX_GAMES - MIN_GAMES)) * 100}%` }}
          />
        </div>

        <button type="submit" className="btn-primary fetch-button" disabled={loading}>
          {loading ? <span className="spinner" aria-hidden="true" /> : <Icon name="search" size={18} />}
          {loading ? "Fetching…" : "Fetch games"}
        </button>
      </form>

      {status === "error" && (
        <p className="error-message" role="alert">
          {errorMessage}
        </p>
      )}

      {loading && allGamesCount === 0 && (
        <div className="games-skeleton" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="skeleton-row" style={{ animationDelay: `${index * 90}ms` }} />
          ))}
        </div>
      )}

      {status === "done" && games.length === 0 && (
        <p className="muted">No games found for this selection.</p>
      )}

      {/* The time-control filter: after the form that fetches the games, and
          before everything it filters. */}
      {filterTabs}

      {games.length > 0 && (
        <>
          <StatsStrip games={games} timeClassFilter={timeClassFilter} />

          <div className={`games-layout${showPreview ? " with-preview" : ""}`}>
            <section className="games-panel">
              <div className="section-head">
                <h2>Recent games</h2>
                <span className="muted">
                  {isMobile ? "Tap" : "Click"} a game to review it
                </span>
              </div>

              {isMobile ? (
                // Phone: one card per game — nothing cut off at the edge, the
                // result readable at a glance, a big tap target.
                <ul className="game-cards stagger">
                  {games.map((game, index) => (
                    <li key={game.id} style={{ "--i": Math.min(index, 12) }}>
                      <button className="game-card" data-game-row onClick={() => onOpenGame(game)}>
                        <span className={`result-badge result-${game.result}`}>{RESULT_LETTER[game.result]}</span>
                        <span className="game-card-body">
                          <span className="game-card-title">
                            vs {game.opponentName}
                            {game.opponentRating != null && <span className="opp-rating">{game.opponentRating}</span>}
                          </span>
                          <span className="game-card-meta">
                            <span className={`color-dot ${game.userColor}`} />
                            <span className="capitalize">{game.timeClass}</span> · {formatDate(game.playedAt)}
                          </span>
                        </span>
                        <Icon name="next" size={18} className="game-card-chevron" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="games-table-wrapper card">
                  <table className="games-table">
                    <thead>
                      <tr>
                        <th>Result</th>
                        <th>Opponent</th>
                        <th>You</th>
                        <th>Time control</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody className="stagger">
                      {games.map((game, index) => (
                        <tr
                          key={game.id}
                          role="button"
                          tabIndex={0}
                          style={{ "--i": Math.min(index, 14) }}
                          onClick={() => onOpenGame(game)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onOpenGame(game);
                            }
                          }}
                          onMouseEnter={showPreview ? () => setPreviewFen(finalPositionFen(game.pgn)) : undefined}
                          onMouseLeave={showPreview ? () => setPreviewFen(STARTING_FEN) : undefined}
                        >
                          <td>
                            <span className={`pill pill-${game.result}`}>{game.result}</span>
                          </td>
                          <td className="opponent-cell">
                            {game.opponentName}
                            {game.opponentRating != null && <span className="opp-rating">{game.opponentRating}</span>}
                          </td>
                          <td>
                            <span className={`color-dot ${game.userColor}`} title={`You played ${game.userColor}`} />
                          </td>
                          <td className="capitalize muted">{game.timeClass}</td>
                          <td className="muted">{formatDate(game.playedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {showPreview && (
              <aside className="preview-panel card">
                <span className="eyebrow">How it ended</span>
                <div className="preview-board">
                  <Chessboard options={{ position: previewFen, allowDragging: false }} />
                </div>
                <p className="muted preview-caption">Hover a game to see its final position.</p>
              </aside>
            )}
          </div>
        </>
      )}
    </div>
  );
}
