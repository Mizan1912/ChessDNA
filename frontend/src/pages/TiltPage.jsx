import { useState } from "react";
import { analyzeTilt } from "../lib/tilt";
import GameEvidenceList from "../components/GameEvidenceList";
import Icon from "../components/Icon";
import "./FindingsPage.css";

function formatScore(scorePercent) {
  return `${Math.round(scorePercent)}%`;
}

function formatHour(hour) {
  const period = hour < 12 ? "am" : "pm";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}${period}`;
}

// Opens the real games behind a finding — the evidence rule requires this
// everywhere, never just a bare number.
function EvidenceToggle({ label, games, onOpenGame }) {
  const [open, setOpen] = useState(false);
  if (games.length === 0) return null;

  return (
    <div className="evidence-toggle">
      <button className="btn-ghost evidence-toggle-button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Icon name="chevronDown" size={16} className={`chevron${open ? " open" : ""}`} />
        {open ? "Hide" : "Show"} the {games.length} game{games.length === 1 ? "" : "s"} {label}
      </button>
      {open && <GameEvidenceList games={games} onOpenGame={onOpenGame} />}
    </div>
  );
}

export default function TiltPage({ games, onOpenGame, filterTabs, onGoToGames }) {
  const result = analyzeTilt(games);
  const [openIndexRow, setOpenIndexRow] = useState(null);

  if (result.status === "insufficient-data") {
    const percent = Math.min(100, (result.sessionsFound / result.sessionsNeeded) * 100);
    return (
      <div className="findings-page">
        <header className="page-header">
          <span className="eyebrow">Tilt</span>
          <h1>
            Not enough sessions <span className="accent-em">yet</span>.
          </h1>
          <p>
            A session is 2+ games in a row. This needs {result.sessionsNeeded} of them before it says anything, so it
            never reads a pattern into a handful of games.
          </p>
        </header>
        {filterTabs}

        {/* How close you are, drawn — and what to do about it. */}
        <section className="card finding-card progress-card">
          <div className="stat-row">
            <div className="stat-block">
              <span className="eyebrow">Sessions found</span>
              <span className="stat-value">
                <span className="gold-text">{result.sessionsFound}</span>
                <span className="stat-of"> / {result.sessionsNeeded}</span>
              </span>
            </div>
          </div>
          <div className="share-bar">
            <span className="share-opening" style={{ width: `${percent}%` }} />
          </div>
          <p className="muted finding-text">
            Fetch more of your games — up to 100 at a time — or play a few more sittings and come back.
          </p>
          {onGoToGames && (
            <button className="btn-primary progress-cta" onClick={onGoToGames}>
              Fetch more games
            </button>
          )}
        </section>
      </div>
    );
  }

  const breakPoint = result.breakPointIndex;
  const maxScore = Math.max(...result.scoreByIndex.map((e) => e.scorePercent ?? 0), 1);
  const { tiltChain, worstHour } = result;

  return (
    <div className="findings-page">
      <header className="page-header">
        <span className="eyebrow">Tilt</span>
        {breakPoint !== null ? (
          <h1>
            Stop after <span className="accent-em">{breakPoint} games</span> in a sitting.
          </h1>
        ) : (
          <h1>
            No clear break point <span className="accent-em">yet</span>.
          </h1>
        )}
        <p>
          {breakPoint !== null
            ? `From game ${breakPoint + 1} of a session onwards, your score drops and stays down. Based on ${result.sessionsAnalysed} sessions.`
            : `Your score doesn't reliably drop within a session. Based on ${result.sessionsAnalysed} sessions.`}
        </p>
      </header>

      {filterTabs}

      <div className="findings-grid stagger">
        {/* Score by position in the session, as bars: a drop is something to
            SEE. The break point is the gold one. Tap a bar for its games. */}
        <section className="card finding-card span-2" style={{ "--i": 0 }}>
          <div className="finding-head">
            <h2>Score by game in the session</h2>
            <span className="muted">Tap a bar to see its games</span>
          </div>
          <ol className="score-bars">
            {result.scoreByIndex.map((entry) => {
              const isBreak = entry.sessionIndex === breakPoint;
              const isOpen = openIndexRow === entry.sessionIndex;
              return (
                <li key={entry.sessionIndex}>
                  <button
                    className={`score-bar-row${isBreak ? " break-point" : ""}${isOpen ? " open" : ""}`}
                    onClick={() => setOpenIndexRow((current) => (current === entry.sessionIndex ? null : entry.sessionIndex))}
                    aria-expanded={isOpen}
                  >
                    <span className="score-bar-label">Game {entry.sessionIndex + 1}</span>
                    <span className="score-bar-track">
                      <span
                        className="score-bar-fill"
                        style={{ width: `${((entry.scorePercent ?? 0) / maxScore) * 100}%` }}
                      />
                    </span>
                    <span className="score-bar-value">
                      {entry.scorePercent === null ? "—" : formatScore(entry.scorePercent)}
                    </span>
                    <span className="score-bar-sample muted">
                      {entry.gameCount} game{entry.gameCount === 1 ? "" : "s"}
                    </span>
                  </button>
                  {isOpen && <GameEvidenceList games={entry.games} onOpenGame={onOpenGame} />}
                </li>
              );
            })}
          </ol>
          {breakPoint !== null && (
            <p className="finding-foot muted">
              <span className="legend-swatch" /> the break point — where your score falls 10+ points below your first
              game and stays there.
            </p>
          )}
        </section>

        <section className="card finding-card" style={{ "--i": 1 }}>
          <div className="finding-head">
            <h2>After a loss</h2>
          </div>
          <div className="stat-row">
            <div className="stat-block">
              <span className="eyebrow">Overall</span>
              <span className="stat-value">{formatScore(tiltChain.overallScore)}</span>
            </div>
            <div className="stat-block">
              <span className="eyebrow">Next game after a loss</span>
              <span className="stat-value gold">
                {tiltChain.postLossScore === null ? "—" : formatScore(tiltChain.postLossScore)}
              </span>
            </div>
            {tiltChain.postLossOnTimeScore !== null && (
              <div className="stat-block">
                <span className="eyebrow">After losing on time</span>
                <span className="stat-value">{formatScore(tiltChain.postLossOnTimeScore)}</span>
              </div>
            )}
          </div>
          <EvidenceToggle label="played right after a loss" games={tiltChain.afterAnyLossGames} onOpenGame={onOpenGame} />
        </section>

        <section className="card finding-card" style={{ "--i": 2 }}>
          <div className="finding-head">
            <h2>Time of day</h2>
          </div>
          {worstHour ? (
            <>
              <div className="stat-row">
                <div className="stat-block">
                  <span className="eyebrow">Worst hour</span>
                  <span className="stat-value gold">{formatHour(worstHour.hour)}</span>
                </div>
                <div className="stat-block">
                  <span className="eyebrow">Your score then</span>
                  <span className="stat-value">{formatScore(worstHour.scorePercent)}</span>
                </div>
              </div>
              <p className="muted finding-text">Over {worstHour.gameCount} games played around that hour.</p>
              <EvidenceToggle label={`played around ${formatHour(worstHour.hour)}`} games={worstHour.games} onOpenGame={onOpenGame} />
            </>
          ) : (
            <p className="muted finding-text">Not enough games at any single hour yet to call out a worst time of day.</p>
          )}
        </section>
      </div>
    </div>
  );
}
