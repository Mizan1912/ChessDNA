import { analyzeClock } from "../lib/clockFingerprint";
import GameEvidenceList from "../components/GameEvidenceList";
import Icon from "../components/Icon";
import { formatDuration } from "../lib/format";
import "./FindingsPage.css";

// "See that move" — opens the viewer on the exact position a finding is about.
function SeeMoveButton({ onClick }) {
  return (
    <button className="btn-ghost see-move" onClick={onClick}>
      See that move <Icon name="next" size={16} />
    </button>
  );
}

export default function ClockPage({ games, onOpenGame, filterTabs }) {
  const result = analyzeClock(games);

  if (result.status === "no-clock-data") {
    return (
      <div className="findings-page">
        <header className="page-header">
          <span className="eyebrow">Clock</span>
          <h1>
            No clock data <span className="accent-em">here</span>.
          </h1>
          <p>None of these games have move times recorded in them, so there's nothing to measure. Daily games usually don't.</p>
        </header>
        {filterTabs}
      </div>
    );
  }

  const share = Math.round(result.openingTimeShare);
  const { longestThink, wastefulKnownPosition, gamesLostOnTime } = result;

  return (
    <div className="findings-page">
      <header className="page-header">
        <span className="eyebrow">Clock</span>
        <h1>
          You spend <span className="accent-em">{share}%</span> of your thinking time in the first 12 moves.
        </h1>
        <p>
          Based on {result.gamesAnalysed} games ({result.movesWithClockData} moves with clock data).
        </p>
      </header>

      {filterTabs}

      <div className="findings-grid stagger">
        <section className="card finding-card" style={{ "--i": 0 }}>
          <div className="finding-head">
            <h2>Opening vs the rest</h2>
          </div>
          {/* The headline number, drawn: how much of the thinking pie the
              first 12 moves eat. */}
          <div className="share-bar" role="img" aria-label={`${share}% of thinking time in the first 12 moves`}>
            <span className="share-opening" style={{ width: `${share}%` }} />
          </div>
          <div className="share-legend">
            <span>
              <span className="legend-dot gold" /> First 12 moves <strong>{share}%</strong>
            </span>
            <span>
              <span className="legend-dot" /> The rest <strong>{100 - share}%</strong>
            </span>
          </div>
        </section>

        <section className="card finding-card" style={{ "--i": 1 }}>
          <div className="finding-head">
            <h2>Longest think</h2>
          </div>
          <div className="stat-row">
            <div className="stat-block">
              <span className="eyebrow">Spent</span>
              <span className="stat-value gold">{formatDuration(longestThink.timeSpentSeconds)}</span>
            </div>
            <div className="stat-block">
              <span className="eyebrow">On move</span>
              <span className="stat-value">
                {longestThink.moveNumber}. <span className="stat-san">{longestThink.san}</span>
              </span>
            </div>
          </div>
          <SeeMoveButton onClick={() => onOpenGame(longestThink.game, longestThink.plyIndex)} />
        </section>

        <section className="card finding-card" style={{ "--i": 2 }}>
          <div className="finding-head">
            <h2>Lost on time</h2>
          </div>
          {gamesLostOnTime.length === 0 ? (
            <p className="muted finding-text">None of these games were lost on time.</p>
          ) : (
            <>
              <div className="stat-row">
                <div className="stat-block">
                  <span className="eyebrow">Games</span>
                  <span className="stat-value gold">{gamesLostOnTime.length}</span>
                </div>
              </div>
              <GameEvidenceList games={gamesLostOnTime} onOpenGame={onOpenGame} />
            </>
          )}
        </section>

        <section className="card finding-card" style={{ "--i": 3 }}>
          <div className="finding-head">
            <h2>Known position, wasted time</h2>
          </div>
          {wastefulKnownPosition === null ? (
            <p className="muted finding-text">
              No position shows up 20+ times yet with a standout slow think — fetch more games to check.
            </p>
          ) : (
            <>
              <p className="finding-text">
                You've reached this exact position <strong className="gold-text">{wastefulKnownPosition.timesReached} times</strong>,
                and still spent <strong className="gold-text">{formatDuration(wastefulKnownPosition.worst.timeSpentSeconds)}</strong> on
                move {wastefulKnownPosition.worst.moveNumber} ({wastefulKnownPosition.worst.san}) in one of them.
              </p>
              <SeeMoveButton onClick={() => onOpenGame(wastefulKnownPosition.worst.game, wastefulKnownPosition.worst.plyIndex)} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
