import "./GameEvidenceList.css";

// Every finding in this app must be one tap away from the real games it came
// from — the build doc calls this the evidence rule, "no finding without a
// way to see the games it came from." This is the shared list used to do
// that: click a row, it opens in the real board viewer.
export default function GameEvidenceList({ games, onOpenGame }) {
  if (games.length === 0) return null;

  return (
    <ul className="evidence-list">
      {games.map((game) => (
        <li key={game.id}>
          <button className="evidence-row" onClick={() => onOpenGame(game)}>
            <span>{new Date(game.playedAt).toLocaleDateString()}</span>
            <span>vs {game.opponentName}</span>
            <span>{game.result}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
