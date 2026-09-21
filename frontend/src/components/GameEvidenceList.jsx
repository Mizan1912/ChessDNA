import Icon from "./Icon";
import "./GameEvidenceList.css";

// Every finding in this app must be one tap away from the real games it came
// from — the build doc calls this the evidence rule, "no finding without a
// way to see the games it came from." This is the shared list used to do
// that: tap a row, it opens in the real board viewer.
export default function GameEvidenceList({ games, onOpenGame }) {
  if (games.length === 0) return null;

  return (
    <ul className="evidence-list stagger">
      {games.map((game, index) => (
        <li key={game.id} style={{ "--i": Math.min(index, 10) }}>
          <button className="evidence-row" onClick={() => onOpenGame(game)}>
            <span className={`pill pill-${game.result}`}>{game.result}</span>
            <span className="evidence-opponent">vs {game.opponentName}</span>
            <span className="muted evidence-date">
              {new Date(game.playedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </span>
            <Icon name="next" size={16} className="evidence-chevron" />
          </button>
        </li>
      ))}
    </ul>
  );
}
