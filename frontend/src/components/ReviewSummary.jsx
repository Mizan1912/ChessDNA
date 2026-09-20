import { Fragment, useMemo, useState } from "react";
import { LABELS } from "../lib/moveLabels";
import "./ReviewSummary.css";

// The game-review scorecard: accuracy for both players, how many moves of
// each quality each of them played, and the per-game strength estimate.
// Chess.com's review sidebar in the same shape, because that's the shape
// people already know how to read.

// LABELS is declared best-to-worst, so its own key order is the row order.
const ROW_ORDER = Object.keys(LABELS);

function countByLabel(moves) {
  const counts = { white: {}, black: {} };
  for (const move of moves) {
    const side = move.color === "w" ? "white" : "black";
    counts[side][move.label] = (counts[side][move.label] ?? 0) + 1;
  }
  return counts;
}

export default function ReviewSummary({ game, review, status }) {
  const [open, setOpen] = useState(true);

  const counts = useMemo(() => countByLabel(review?.moves ?? []), [review]);

  if (!review) return null;

  const you = game.userColor;
  const them = you === "black" ? "white" : "black";
  // Your column sits on the left, always — this screen is about you.
  const columns = [
    { side: you, name: game.userName ?? "You", rating: game.userRating },
    { side: them, name: game.opponentName, rating: game.opponentRating },
  ];

  // Accuracy and the strength estimate are averages over the whole game, so
  // they'd be misleading while only half of it has been looked at.
  const finished = status === "done";

  return (
    <section className="review-summary">
      <header className="summary-head">
        <h3>Game review</h3>
        <button className="summary-toggle" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Show"}
        </button>
      </header>

      {/* Every row is the same four-column grid — label, you, marker, them —
          so the two players' numbers stay in one vertical line all the way
          down the card. Rows with nothing in the middle leave it empty. */}
      <div className="summary-row summary-players">
        <span className="summary-metric">Players</span>
        <span className="summary-value summary-player">
          <span className={`color-dot ${columns[0].side}`} />
          <span className="summary-player-name">{columns[0].name}</span>
        </span>
        <span className="summary-glyph" />
        <span className="summary-value summary-player">
          <span className={`color-dot ${columns[1].side}`} />
          <span className="summary-player-name">{columns[1].name}</span>
        </span>
      </div>

      <div className="summary-row summary-accuracy">
        <span className="summary-metric">Accuracy</span>
        {columns.map((column, index) => (
          <Fragment key={column.side}>
            {index === 1 && <span className="summary-glyph" />}
            <span className="summary-value">
              <span className="accuracy-chip">
                {finished && review.accuracy?.[column.side] != null
                  ? review.accuracy[column.side].toFixed(1)
                  : "—"}
              </span>
            </span>
          </Fragment>
        ))}
      </div>

      {open && (
        <>
          {ROW_ORDER.map((key) => {
            const label = LABELS[key];
            const leftCount = counts[columns[0].side][key] ?? 0;
            const rightCount = counts[columns[1].side][key] ?? 0;
            return (
              <div className={`summary-row summary-count ${label.className}`} key={key}>
                <span className="summary-metric">{label.name}</span>
                <span className="summary-value">{leftCount}</span>
                <span className="summary-glyph" title={label.name}>
                  {label.glyph}
                </span>
                <span className="summary-value">{rightCount}</span>
              </div>
            );
          })}

          <div className="summary-row summary-rating">
            <span
              className="summary-metric estimated-rating"
              title="A rough guide to how strong each side played in this one game — not a rating. It's read off accuracy alone, so it doesn't know how hard the opponent pushed you."
            >
              Game rating
            </span>
            {columns.map((column, index) => (
              <Fragment key={column.side}>
                {index === 1 && <span className="summary-glyph" />}
                <span className="summary-value">
                  <span className="rating-chip">
                    {finished && review.estimatedRating?.[column.side] != null
                      ? review.estimatedRating[column.side]
                      : "—"}
                  </span>
                </span>
              </Fragment>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
