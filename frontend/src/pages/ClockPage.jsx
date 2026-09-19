import { analyzeClock } from "../lib/clockFingerprint";
import GameEvidenceList from "../components/GameEvidenceList";
import "./ClockPage.css";

function formatSeconds(seconds) {
  return `${Math.round(seconds)}s`;
}

export default function ClockPage({ games, onBack, onOpenGame }) {
  const result = analyzeClock(games);

  if (result.status === "no-clock-data") {
    return (
      <div className="clock-page">
        <button onClick={onBack}>Back to list</button>
        <h2>Clock</h2>
        <p>None of these games have clock data in their PGN — nothing to analyse here.</p>
      </div>
    );
  }

  return (
    <div className="clock-page">
      <button onClick={onBack}>Back to list</button>

      <h2>Clock</h2>

      <p className="headline">
        You spend {Math.round(result.openingTimeShare)}% of your total thinking time in the first 12
        moves.
      </p>

      <h3>Longest think</h3>
      <p>
        Your longest think was {formatSeconds(result.longestThink.timeSpentSeconds)}, on move{" "}
        {result.longestThink.moveNumber} ({result.longestThink.san}).
      </p>
      <button
        className="link-button"
        onClick={() => onOpenGame(result.longestThink.game, result.longestThink.plyIndex)}
      >
        see that move
      </button>

      <h3>Lost on time</h3>
      {result.gamesLostOnTime.length === 0 ? (
        <p>None of these games were lost on time.</p>
      ) : (
        <>
          <p>You've lost {result.gamesLostOnTime.length} game(s) on time.</p>
          <GameEvidenceList games={result.gamesLostOnTime} onOpenGame={onOpenGame} />
        </>
      )}

      <h3>Known position, wasted time</h3>
      {result.wastefulKnownPosition === null ? (
        <p>No position shows up 20+ times yet with a standout slow think — fetch more games to check.</p>
      ) : (
        <>
          <p>
            You've reached this exact position {result.wastefulKnownPosition.timesReached} times, and
            still spent {formatSeconds(result.wastefulKnownPosition.worst.timeSpentSeconds)} on move{" "}
            {result.wastefulKnownPosition.worst.moveNumber} ({result.wastefulKnownPosition.worst.san})
            in one of them.
          </p>
          <button
            className="link-button"
            onClick={() =>
              onOpenGame(result.wastefulKnownPosition.worst.game, result.wastefulKnownPosition.worst.plyIndex)
            }
          >
            see that move
          </button>
        </>
      )}

      <p className="analysed-count">
        Based on {result.gamesAnalysed} games ({result.movesWithClockData} moves with clock data).
      </p>
    </div>
  );
}
