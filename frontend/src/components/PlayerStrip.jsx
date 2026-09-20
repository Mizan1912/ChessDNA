import "./PlayerStrip.css";

// One player's row beside the board: who they are, and what their clock read
// at whatever move you're currently looking at. Chess.com puts the opponent
// above the board and you below it; so do we, and the pair flips together
// when the board flips.

function formatClock(seconds) {
  if (seconds === null || seconds === undefined) return null;
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  // Under ten seconds people read tenths, which is exactly when it matters.
  if (whole < 10) return seconds.toFixed(1);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export default function PlayerStrip({ name, rating, colour, isYou, clockSeconds, isToMove }) {
  const clock = formatClock(clockSeconds);
  return (
    <div className={`player-strip${isToMove ? " to-move" : ""}`}>
      <span className={`color-dot ${colour}`} />
      <span className="player-name">{name}</span>
      {rating != null && <span className="player-rating">{rating}</span>}
      {isYou && <span className="player-you">you</span>}
      {clock && (
        <span className={`player-clock${clockSeconds < 10 ? " low" : ""}`}>{clock}</span>
      )}
    </div>
  );
}
