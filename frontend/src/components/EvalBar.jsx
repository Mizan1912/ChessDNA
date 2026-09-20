import { centipawnsToWinPercent } from "../lib/winPercent";
import "./EvalBar.css";

const MATE_THRESHOLD_CP = 90000;

// The familiar vertical bar: White's share fills from the bottom, Black's
// from the top. Uses win percentage rather than raw centipawns for the fill,
// so being a queen up looks decisively winning instead of running off the
// end of the scale.
function formatScore(scoreCp, orientation) {
  if (scoreCp === null) return "…";
  if (Math.abs(scoreCp) >= MATE_THRESHOLD_CP) {
    const movesToMate = Math.round((100000 - Math.abs(scoreCp)) / 100);
    const winningSide = scoreCp > 0 ? "white" : "black";
    // Show it from the perspective of whoever is winning, as "M3".
    return `${winningSide === orientation ? "" : "-"}M${Math.max(1, movesToMate)}`;
  }
  const pawns = scoreCp / 100;
  return `${pawns > 0 ? "+" : ""}${pawns.toFixed(1)}`;
}

export default function EvalBar({ scoreCp, boardOrientation = "white" }) {
  const whitePercent = scoreCp === null ? 50 : centipawnsToWinPercent(scoreCp);
  // When the board is flipped, the bar flips with it, so "your side" is
  // always the end nearest you.
  const fillFromBottom = boardOrientation === "white" ? whitePercent : 100 - whitePercent;

  return (
    <div className="eval-bar" title="Engine evaluation">
      <div className="eval-bar-track">
        {/* One value drives the fill; CSS decides whether that means height
            (tall bar beside the board) or width (flat bar under it). */}
        <div className="eval-bar-fill" style={{ "--fill": `${fillFromBottom}%` }} />
      </div>
      <span className="eval-bar-score">{formatScore(scoreCp, boardOrientation)}</span>
    </div>
  );
}
