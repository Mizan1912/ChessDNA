import { useState } from "react";
import { analyzeTilt } from "../lib/tilt";
import GameEvidenceList from "../components/GameEvidenceList";
import "./TiltPage.css";

function formatScore(scorePercent) {
  return `${Math.round(scorePercent)}%`;
}

function formatHour(hour) {
  const period = hour < 12 ? "am" : "pm";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}${period}`;
}

// Toggles a labeled section open to show the real games behind a finding —
// the evidence rule requires this everywhere, never just a bare number.
function EvidenceToggle({ label, games, onOpenGame }) {
  const [open, setOpen] = useState(false);
  if (games.length === 0) return null;

  return (
    <div className="evidence-toggle">
      <button className="evidence-toggle-button" onClick={() => setOpen((v) => !v)}>
        {open ? "hide" : "show"} the {games.length} game{games.length === 1 ? "" : "s"} {label}
      </button>
      {open && <GameEvidenceList games={games} onOpenGame={onOpenGame} />}
    </div>
  );
}

export default function TiltPage({ games, onBack, onOpenGame }) {
  const result = analyzeTilt(games);
  const [openIndexRow, setOpenIndexRow] = useState(null);

  return (
    <div className="tilt-page">
      <button onClick={onBack}>Back to list</button>

      <h2>Tilt</h2>

      {result.status === "insufficient-data" && (
        <p>
          Not enough games yet — found {result.sessionsFound} sessions of 2+ games, need{" "}
          {result.sessionsNeeded}. Fetch more games or play a few more sessions, then come back.
        </p>
      )}

      {result.status === "ok" && (
        <>
          <p className="headline">
            {result.breakPointIndex !== null
              ? `Stop after ${result.breakPointIndex} games in a sitting — your score drops from there on.`
              : "No clear break point yet — your score doesn't reliably drop within a session."}
          </p>

          <table className="tilt-table">
            <thead>
              <tr>
                <th>Game # in session</th>
                <th>Score</th>
                <th>Sample</th>
              </tr>
            </thead>
            <tbody>
              {result.scoreByIndex.map((entry) => (
                <tr
                  key={entry.sessionIndex}
                  className={entry.sessionIndex === result.breakPointIndex ? "break-point" : ""}
                  onClick={() =>
                    setOpenIndexRow((current) => (current === entry.sessionIndex ? null : entry.sessionIndex))
                  }
                >
                  <td>{entry.sessionIndex + 1}</td>
                  <td>{entry.scorePercent === null ? "—" : formatScore(entry.scorePercent)}</td>
                  <td>{entry.gameCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.scoreByIndex.map(
            (entry) =>
              openIndexRow === entry.sessionIndex && (
                <GameEvidenceList key={entry.sessionIndex} games={entry.games} onOpenGame={onOpenGame} />
              )
          )}

          <h3>After a loss</h3>
          <p>
            Overall score: {formatScore(result.tiltChain.overallScore)}. Score in the very next game
            after any loss: {result.tiltChain.postLossScore === null ? "not enough data" : formatScore(result.tiltChain.postLossScore)}.
            {result.tiltChain.postLossOnTimeScore !== null && (
              <> After a loss on time specifically: {formatScore(result.tiltChain.postLossOnTimeScore)}.</>
            )}
          </p>
          <EvidenceToggle
            label="played right after a loss"
            games={result.tiltChain.afterAnyLossGames}
            onOpenGame={onOpenGame}
          />

          <h3>Time of day</h3>
          <p>
            {result.worstHour
              ? `Your worst hour is around ${formatHour(result.worstHour.hour)} — you score ${formatScore(result.worstHour.scorePercent)} there, over ${result.worstHour.gameCount} games.`
              : "Not enough games at any single hour yet to call out a worst time of day."}
          </p>
          {result.worstHour && (
            <EvidenceToggle
              label={`played around ${formatHour(result.worstHour.hour)}`}
              games={result.worstHour.games}
              onOpenGame={onOpenGame}
            />
          )}

          <p className="analysed-count">Based on {result.sessionsAnalysed} sessions.</p>
        </>
      )}
    </div>
  );
}
