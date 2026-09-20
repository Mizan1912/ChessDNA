import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { pgnToMoves, STARTING_FEN } from "../lib/pgnToMoves";
import { pgnToClockMoves } from "../lib/clockData";
import { LABELS } from "../lib/moveLabels";
import EvalBar from "../components/EvalBar";
import { useLiveEval } from "../hooks/useLiveEval";
import { useGameReview } from "../hooks/useGameReview";
import "./GameViewerPage.css";

function formatSeconds(seconds) {
  if (seconds === null) return null;
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;
}

const otherColour = (colour) => (colour === "black" ? "white" : "black");
const accuracyFor = (colour, accuracy) => accuracy?.[colour] ?? "—";
const ratingFor = (colour, estimatedRating) => estimatedRating?.[colour] ?? null;

// `initialMoveIndex` is the move a finding elsewhere in the app (the clock
// page's "longest think" or "known position" findings) wants highlighted and
// animated when this viewer opens — e.g. the slow move itself, not the game
// as a whole. -1 means "no target, just open at the start" (the normal case,
// clicking a game from the list).
export default function GameViewerPage({ game, onBack, initialMoveIndex = -1, note = null }) {
  const moves = useMemo(() => pgnToMoves(game.pgn), [game.pgn]);

  // clockData.js always returns one entry per ply, same order as pgnToMoves,
  // so they can be lined up by array index — see clockData.js's own comment.
  const clockMoves = useMemo(() => {
    try {
      return pgnToClockMoves(game.pgn);
    } catch {
      return [];
    }
  }, [game.pgn]);

  // -1 means "starting position, before move 1". When a finding wants a
  // specific move highlighted, mount one ply BEFORE it (silently — nothing
  // animates on first mount anyway) and then step forward exactly once, a
  // tick later. That single step is what actually animates — just that one
  // move sliding into place, not a jump across everything since move 0.
  const [moveIndex, setMoveIndex] = useState(Math.max(-1, initialMoveIndex - 1));
  const [boardOrientation, setBoardOrientation] = useState(
    game.userColor === "black" ? "black" : "white"
  );

  // When you drag a piece, you leave the actual game and start exploring your
  // own line. `exploring` holds that made-up position; null means "showing
  // the real game". Kept separate so the game itself is never lost — one
  // click puts it back.
  const [exploring, setExploring] = useState(null);

  // Starts by itself on open, and comes back instantly for a game that's
  // already been reviewed once.
  const review = useGameReview(game);

  useEffect(() => {
    if (initialMoveIndex === -1) return;
    const timer = setTimeout(() => setMoveIndex(initialMoveIndex), 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount — this is a one-time "arrive here" animation, not a live sync

  const gameFen = moveIndex === -1 ? STARTING_FEN : moves[moveIndex].fenAfter;
  const currentFen = exploring?.fen ?? gameFen;

  // The bar follows whatever is on the board, including positions you made up
  // yourself while exploring. Stood down while a review is running, unless
  // you're off exploring your own line — otherwise a second engine competes
  // with the review for CPU, and the review is already producing evaluations
  // for every position in the game anyway.
  const liveEvalEnabled = exploring !== null || review.status !== "reviewing";
  const liveScoreCp = useLiveEval(currentFen, liveEvalEnabled);

  // Once the game has been reviewed, prefer its deeper, more careful number
  // for positions that are actually part of the game.
  const reviewedScoreCp =
    !exploring && review.review
      ? moveIndex === -1
        ? review.review.startingEval
        : review.review.evalAfterPly[moveIndex]
      : undefined;
  const shownScoreCp = reviewedScoreCp ?? liveScoreCp;

  const labelsByPly = useMemo(() => {
    const map = new Map();
    for (const m of review.review?.moves ?? []) map.set(m.plyIndex, m);
    return map;
  }, [review.review]);

  const currentLabel = !exploring && moveIndex >= 0 ? labelsByPly.get(moveIndex) : null;

  // Keep the highlighted move visible. Matters most when arriving from a
  // finding: the move in question is often 30+ moves in, well outside the
  // move list's visible window.
  const activeMoveRef = useRef(null);
  useEffect(() => {
    activeMoveRef.current?.scrollIntoView({ block: "nearest" });
  }, [moveIndex]);

  function goTo(index) {
    setExploring(null);
    setMoveIndex(index);
  }
  function flipBoard() {
    setBoardOrientation((side) => (side === "white" ? "black" : "white"));
  }

  // Dragging a piece branches off into your own line rather than editing the
  // game. Returns false for illegal moves so the piece snaps back.
  function handlePieceDrop({ sourceSquare, targetSquare }) {
    if (!targetSquare) return false;
    try {
      const board = new Chess(currentFen);
      const played = board.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      if (!played) return false;
      setExploring({
        fen: board.fen(),
        line: [...(exploring?.line ?? []), played.san],
      });
      return true;
    } catch {
      return false;
    }
  }

  return (
    <div>
      <button onClick={onBack}>Back to list</button>

      <p className="viewer-meta">
        <span className="your-color">
          <span className={`color-dot ${game.userColor}`} /> you played{" "}
          <span className="color-name">{game.userColor}</span>
        </span>{" "}
        — vs {game.opponentName} — {game.result} — {game.timeClass}
        <a href={game.url} target="_blank" rel="noreferrer">
          view on Chess.com
        </a>
      </p>

      {note && <p className="viewer-note">{note}</p>}

      <div className="viewer-layout">
        <div className="board-column">
          {/* Bar and board sit in their own row so the bar can stretch to
              exactly the board's height, whatever size it renders at. */}
          <div className="board-row">
            <EvalBar scoreCp={shownScoreCp} boardOrientation={boardOrientation} />
            <div className="board-panel">
              <Chessboard
                options={{
                  position: currentFen,
                  boardOrientation,
                  allowDragging: true,
                  onPieceDrop: handlePieceDrop,
                }}
              />
            </div>
          </div>

          {currentLabel && (
            <p className={`move-label-banner ${LABELS[currentLabel.label].className}`}>
              <span className="move-label-glyph">{LABELS[currentLabel.label].glyph}</span>
              {currentLabel.san} is {LABELS[currentLabel.label].name}
              {currentLabel.bestMoveSan && currentLabel.label !== "best" && currentLabel.label !== "brilliant" && (
                <span className="move-label-best"> · best was {currentLabel.bestMoveSan}</span>
              )}
            </p>
          )}
        </div>

        <div className="moves-panel">
          <div className="move-controls">
            <button onClick={() => goTo(-1)} disabled={moveIndex === -1 && !exploring}>
              |&lt;
            </button>
            <button onClick={() => goTo(Math.max(-1, moveIndex - 1))} disabled={moveIndex === -1 && !exploring}>
              &lt;
            </button>
            <button
              onClick={() => goTo(Math.min(moves.length - 1, moveIndex + 1))}
              disabled={moveIndex === moves.length - 1 && !exploring}
            >
              &gt;
            </button>
            <button onClick={() => goTo(moves.length - 1)} disabled={moveIndex === moves.length - 1 && !exploring}>
              &gt;|
            </button>
            <button onClick={flipBoard}>Flip board</button>
          </div>

          {exploring ? (
            <p className="exploring-banner">
              Exploring your own line: <strong>{exploring.line.join(" ")}</strong>
              <button onClick={() => setExploring(null)}>Back to the game</button>
            </p>
          ) : (
            <div className="review-controls">
              {review.status === "reviewing" && (
                <span className="review-progress">
                  Reviewing… move {Math.ceil(review.progress.plyDone / 2)} of{" "}
                  {Math.ceil(review.progress.totalPlies / 2)}
                </span>
              )}
              {review.status === "error" && (
                <span className="error-message">
                  Review failed. <button onClick={() => review.run(game)}>Try again</button>
                </span>
              )}
              {review.status === "done" && review.review?.accuracy && (
                <span className="review-accuracy">
                  <strong>You</strong> {accuracyFor(game.userColor, review.review.accuracy)}% accurate
                  {ratingFor(game.userColor, review.review.estimatedRating) && (
                    <span
                      title="A rough guide to how strong this one game was — not a rating. Accuracy depends a lot on how sharp the position was and how hard your opponent pushed you."
                      className="estimated-rating"
                    >
                      {" "}
                      · ≈{ratingFor(game.userColor, review.review.estimatedRating)} level this game
                    </span>
                  )}
                  <span className="review-opponent">
                    {" "}
                    · opponent {accuracyFor(otherColour(game.userColor), review.review.accuracy)}%
                  </span>
                </span>
              )}
            </div>
          )}

          <ol className="move-list">
            {moves.map((move, index) => {
              const timeLabel = formatSeconds(clockMoves[index]?.timeSpentSeconds ?? null);
              const labelled = labelsByPly.get(index);
              return (
                <li key={index}>
                  <button
                    ref={index === moveIndex ? activeMoveRef : null}
                    className={index === moveIndex && !exploring ? "active" : ""}
                    onClick={() => goTo(index)}
                  >
                    {move.color === "w" ? `${move.moveNumber}. ` : ""}
                    {move.san}
                    {labelled && (
                      <span
                        className={`move-label ${LABELS[labelled.label].className}`}
                        title={LABELS[labelled.label].name}
                      >
                        {LABELS[labelled.label].glyph}
                      </span>
                    )}
                    {timeLabel && <span className="move-time"> {timeLabel}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
