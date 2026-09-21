import { TAGS } from "../lib/mistakeTags";
import { useMediaQuery, MOBILE_QUERY } from "../hooks/useMediaQuery";
import Icon from "../components/Icon";
import { formatDuration } from "../lib/format";
import "./FindingsPage.css";
import "./BlundersPage.css";

// Roughly how long a scan takes, measured at depth 12 on real games (see
// decision.md D-031). Only used to set expectations before the user commits
// to a multi-minute scan — never presented as a precise number. Deliberately
// on the long side: short, low-rated games scan faster (~1.6s, D-049), but an
// estimate that runs over is more annoying than one that finishes early.
const SECONDS_PER_GAME = 3.5;

// Short labels for the "why"; the full sentence shows on the board screen.
const WHY_LABELS = {
  "missed-mate": "Missed mate",
  "allows-mate": "Allows mate",
  "loses-material": "Loses material",
  "hangs-piece": "Hangs a piece",
  positional: "Loses the advantage",
};

function formatDate(timestampMs) {
  return new Date(timestampMs).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// The Phase 5 blind-spot tags on one mistake — several can apply at once.
function PatternChips({ tags }) {
  if (!tags?.length) return <span className="muted">—</span>;
  return tags.map((t) => (
    <span key={t.tag} className="pattern-chip">
      {TAGS[t.tag]?.name ?? t.tag}
    </span>
  ));
}

// `scan` is owned by App.jsx, not this page — see the note there. It has to
// outlive this component, since clicking into a blunder unmounts it.
export default function BlundersPage({ games, scan: scanState, onOpenGame, filterTabs }) {
  const { status, progress, blunders, scan } = scanState;
  const isMobile = useMediaQuery(MOBILE_QUERY);

  const estimatedMinutes = Math.max(1, Math.round((games.length * SECONDS_PER_GAME) / 60));
  const percentDone = progress.totalGames ? Math.round((progress.gamesDone / progress.totalGames) * 100) : 0;
  const open = (blunder) => onOpenGame(blunder.game, blunder.plyIndex, blunder.explanation?.why);

  return (
    <div className="findings-page">
      <header className="page-header">
        <span className="eyebrow">Blunders</span>
        {status === "done" && blunders.length > 0 ? (
          <h1>
            <span className="accent-em">{blunders.length}</span> moments you threw it away.
          </h1>
        ) : (
          <h1>
            Where you <span className="accent-em">threw it away</span>.
          </h1>
        )}
        <p>
          {status === "done"
            ? `Across ${progress.totalGames} games. Open any one to see the exact position, why it went wrong, and what the engine wanted.`
            : "Stockfish goes through your games move by move and stops on every moment your winning chances dropped sharply."}
        </p>
      </header>

      {filterTabs}

      {status === "idle" && (
        <section className="card scan-card">
          <div className="scan-icon">
            <Icon name="blunders" size={26} />
          </div>
          <div className="scan-copy">
            <h2>Scan {games.length} games</h2>
            <p className="muted">
              Takes around {estimatedMinutes} minute{estimatedMinutes === 1 ? "" : "s"}. The engine runs in the background —
              the app stays usable while it works.
            </p>
          </div>
          <button className="btn-primary scan-button" onClick={() => scan(games)} disabled={games.length === 0}>
            Start scan
          </button>
        </section>
      )}

      {status === "scanning" && (
        <section className="card scan-card scanning" role="status">
          <div className="scan-progress-copy">
            <span className="eyebrow">Analysing</span>
            <p>
              Game <strong>{progress.gamesDone}</strong> of {progress.totalGames} ·{" "}
              <strong className="gold-text">{progress.blundersFound}</strong> blunder{progress.blundersFound === 1 ? "" : "s"} so far
            </p>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${percentDone}%` }} />
          </div>
        </section>
      )}

      {status === "error" && (
        <p className="error-message" role="alert">
          The engine failed to run. Reloading the page usually fixes it.
        </p>
      )}

      {status === "done" && blunders.length === 0 && (
        <section className="card scan-card">
          <p>No blunders in these games — either you played clean, or there aren't enough games here yet.</p>
        </section>
      )}

      {status === "done" && blunders.length > 0 && (
        isMobile ? (
          <ul className="blunder-cards stagger">
            {blunders.map((blunder, index) => (
              <li key={`${blunder.game.id}-${blunder.plyIndex}-${index}`} style={{ "--i": Math.min(index, 12) }}>
                <button className="blunder-card" onClick={() => open(blunder)}>
                  <span className="blunder-card-top">
                    <span className="blunder-move">
                      <span className="muted">{blunder.moveNumber}.</span> {blunder.movePlayed}
                    </span>
                    <span className="lost-cell">−{Math.round(blunder.lostWinPercent)}%</span>
                  </span>
                  <span className="blunder-why">{WHY_LABELS[blunder.explanation?.tag] ?? "—"}</span>
                  <span className="blunder-card-meta">
                    <PatternChips tags={blunder.tags} />
                    <span className="muted blunder-date">
                      best {blunder.explanation?.bestMoveSan ?? "—"} · {formatDate(blunder.game.playedAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="blunders-table-wrapper card">
            <table className="blunders-table">
              <thead>
                <tr>
                  <th>Move</th>
                  <th>Played</th>
                  <th>Why</th>
                  <th>Pattern</th>
                  <th>Best was</th>
                  <th>Win chance lost</th>
                  <th>Time</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody className="stagger">
                {blunders.map((blunder, index) => (
                  <tr
                    key={`${blunder.game.id}-${blunder.plyIndex}-${index}`}
                    role="button"
                    tabIndex={0}
                    style={{ "--i": Math.min(index, 14) }}
                    onClick={() => open(blunder)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        open(blunder);
                      }
                    }}
                  >
                    <td className="muted">{blunder.moveNumber}</td>
                    <td className="mono strong">{blunder.movePlayed}</td>
                    <td>{WHY_LABELS[blunder.explanation?.tag] ?? "—"}</td>
                    <td className="pattern-cell">
                      <PatternChips tags={blunder.tags} />
                    </td>
                    <td className="mono best-cell">{blunder.explanation?.bestMoveSan ?? "—"}</td>
                    <td className="lost-cell">−{Math.round(blunder.lostWinPercent)}%</td>
                    <td className="muted">{formatDuration(blunder.clockSeconds) ?? "—"}</td>
                    <td className="muted">{formatDate(blunder.game.playedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
