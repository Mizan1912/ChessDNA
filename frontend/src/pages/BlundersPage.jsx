import { TAGS } from "../lib/mistakeTags";
import "./BlundersPage.css";

// Roughly how long a scan takes, measured at depth 12 on real games (see
// decision.md D-031). Only used to set expectations before the user commits
// to a multi-minute scan — never presented as a precise number.
const SECONDS_PER_GAME = 3.5;

// Short labels for the table; the full sentence shows on the board screen.
const TAG_LABELS = {
  "missed-mate": "Missed mate",
  "allows-mate": "Allows mate",
  "loses-material": "Loses material",
  "hangs-piece": "Hangs a piece",
  positional: "Loses the advantage",
};

// `scan` is owned by App.jsx, not this page — see the note there. It has to
// outlive this component, since clicking into a blunder unmounts it.
export default function BlundersPage({ games, scan: scanState, onBack, onOpenGame }) {
  const { status, progress, blunders, scan } = scanState;

  const estimatedMinutes = Math.max(1, Math.round((games.length * SECONDS_PER_GAME) / 60));
  const percentDone = progress.totalGames
    ? Math.round((progress.gamesDone / progress.totalGames) * 100)
    : 0;

  return (
    <div className="blunders-page">
      <button onClick={onBack}>Back to list</button>

      <h2>Blunders</h2>

      {status === "idle" && (
        <>
          <p className="blunders-lead">
            Runs Stockfish over all {games.length} of these games to find the moments you threw
            something away. Takes around {estimatedMinutes} minute{estimatedMinutes === 1 ? "" : "s"} —
            the page stays usable while it runs.
          </p>
          <button onClick={() => scan(games)} disabled={games.length === 0}>
            Scan {games.length} games
          </button>
        </>
      )}

      {status === "scanning" && (
        <div className="scan-progress">
          <p>
            Analysing game {progress.gamesDone} of {progress.totalGames} — {progress.blundersFound}{" "}
            blunder{progress.blundersFound === 1 ? "" : "s"} so far.
          </p>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${percentDone}%` }} />
          </div>
        </div>
      )}

      {status === "error" && (
        <p className="error-message" role="alert">
          The engine failed to run. Reloading the page usually fixes it.
        </p>
      )}

      {status === "done" && (
        <>
          <p className="headline">
            {blunders.length === 0
              ? "No blunders found in these games — either you played clean, or there aren't enough games here yet."
              : `${blunders.length} blunder${blunders.length === 1 ? "" : "s"} across ${progress.totalGames} games.`}
          </p>

          {blunders.length > 0 && (
            <div className="blunders-table-wrapper">
              <table className="blunders-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Move</th>
                    <th>Played</th>
                    <th>Why</th>
                    <th>Pattern</th>
                    <th>Best was</th>
                    <th>Win chance lost</th>
                    <th>Time spent</th>
                  </tr>
                </thead>
                <tbody>
                  {blunders.map((blunder, index) => (
                    <tr
                      key={`${blunder.game.id}-${blunder.plyIndex}-${index}`}
                      onClick={() => onOpenGame(blunder.game, blunder.plyIndex, blunder.explanation?.why)}
                    >
                      <td>{new Date(blunder.game.playedAt).toLocaleDateString()}</td>
                      <td>{blunder.moveNumber}</td>
                      <td>{blunder.movePlayed}</td>
                      <td className="why-cell">{TAG_LABELS[blunder.explanation?.tag] ?? "—"}</td>
                      {/* The Feature 1 tags — what KIND of mistake, counted across
                          games to find blind spots. Several can apply at once. */}
                      <td className="pattern-cell">
                        {blunder.tags?.length
                          ? blunder.tags.map((t) => (
                              <span key={t.tag} className="pattern-chip" title={TAGS[t.tag]?.blurb}>
                                {TAGS[t.tag]?.name ?? t.tag}
                              </span>
                            ))
                          : "—"}
                      </td>
                      <td>{blunder.explanation?.bestMoveSan ?? "—"}</td>
                      <td className="lost-cell">−{Math.round(blunder.lostWinPercent)}%</td>
                      <td>
                        {blunder.clockSeconds === null ? "—" : `${Math.round(blunder.clockSeconds)}s`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="analysed-count">
            Click any row to see that exact position on the board.
          </p>
        </>
      )}
    </div>
  );
}
