import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { pgnToMoves, STARTING_FEN } from "../lib/pgnToMoves";
import { pgnToClockMoves, pgnTimeControl } from "../lib/clockData";
import { LABELS } from "../lib/moveLabels";
import EvalBar from "../components/EvalBar";
import PlayerStrip from "../components/PlayerStrip";
import ReviewSummary from "../components/ReviewSummary";
import MoveBadge from "../components/MoveBadge";
import { useLiveEval } from "../hooks/useLiveEval";
import { useGameReview } from "../hooks/useGameReview";
import "./GameViewerPage.css";

function formatSeconds(seconds) {
  if (seconds === null) return null;
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;
}

const otherColour = (colour) => (colour === "black" ? "white" : "black");
const accuracyFor = (colour, accuracy) => accuracy?.[colour] ?? "—";

// "best was Nf3" is noise when you already played it, and for theory moves
// there is nothing to improve on.
const NO_BEST_MOVE_HINT = new Set(["best", "brilliant", "great", "book"]);

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

  // --- what the board itself shows about the current move ---
  // The move you're looking at, its two squares lit, and its quality medal
  // sitting on the square the piece landed on. None of this applies while
  // you're exploring a line of your own, which isn't part of the game.
  const playedMove = !exploring && moveIndex >= 0 ? moves[moveIndex] : null;

  const squareStyles = useMemo(() => {
    if (!playedMove) return {};
    const lit = { backgroundColor: "rgba(224, 182, 65, 0.28)" };
    return { [playedMove.from]: lit, [playedMove.to]: lit };
  }, [playedMove]);

  // "You should have played this instead" — drawn only when there was
  // something better. Nothing to suggest after a top move or a theory move.
  const arrows = useMemo(() => {
    if (!playedMove || !currentLabel?.bestMoveUci) return [];
    if (NO_BEST_MOVE_HINT.has(currentLabel.label)) return [];
    return [
      {
        startSquare: currentLabel.bestMoveUci.slice(0, 2),
        endSquare: currentLabel.bestMoveUci.slice(2, 4),
        color: "#8bc34a",
      },
    ];
  }, [playedMove, currentLabel]);

  // Replaces the board's own inner square div, so it has to keep rendering
  // the piece — and it has to apply the square highlights itself, because
  // the board only uses its own `squareStyles` when no renderer is supplied.
  function renderSquare({ square, children }) {
    return (
      <div className="square-layer" style={squareStyles[square]}>
        {children}
        {playedMove && square === playedMove.to && currentLabel && (
          <MoveBadge label={currentLabel.label} />
        )}
      </div>
    );
  }

  // --- the two clocks beside the board ---
  // A player's clock at this point in the game is whatever it read after
  // their most recent move, so walk back from here to the last ply they
  // played. Before either side has moved, both clocks show the starting time
  // from the TimeControl header.
  const baseSeconds = useMemo(() => pgnTimeControl(game.pgn).baseSeconds, [game.pgn]);
  function clockFor(colourLetter) {
    for (let i = Math.min(moveIndex, clockMoves.length - 1); i >= 0; i--) {
      if (moves[i]?.color !== colourLetter) continue;
      return clockMoves[i]?.clockRemainingSeconds ?? null;
    }
    return baseSeconds;
  }

  // Whose turn it is in the position on screen — drives which clock is lit.
  const sideToMove = currentFen.split(" ")[1];

  const sides = {
    white: {
      colour: "white",
      isYou: game.userColor === "white",
      name: game.userColor === "white" ? game.userName ?? "You" : game.opponentName,
      rating: game.userColor === "white" ? game.userRating : game.opponentRating,
      clockSeconds: clockFor("w"),
      isToMove: sideToMove === "w",
    },
    black: {
      colour: "black",
      isYou: game.userColor === "black",
      name: game.userColor === "black" ? game.userName ?? "You" : game.opponentName,
      rating: game.userColor === "black" ? game.userRating : game.opponentRating,
      clockSeconds: clockFor("b"),
      isToMove: sideToMove === "b",
    },
  };

  // Whoever's side of the board is facing you sits at the bottom, as on a
  // real board — so flipping the board flips the two strips with it.
  const bottomSide = sides[boardOrientation];
  const topSide = sides[otherColour(boardOrientation)];

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
          {/* Opponent on top, you underneath, each with their clock — the
              arrangement of a real board, and of every chess site. The
              evaluation bar stays level with the board itself rather than
              with the strips. */}
          <div className="board-stack">
            <PlayerStrip {...topSide} />
            <div className="board-row">
              <EvalBar scoreCp={shownScoreCp} boardOrientation={boardOrientation} />
              <div className="board-panel">
                <Chessboard
                  options={{
                    position: currentFen,
                    boardOrientation,
                    allowDragging: true,
                    onPieceDrop: handlePieceDrop,
                    arrows,
                    squareRenderer: renderSquare,
                  }}
                />
              </div>
            </div>
            <PlayerStrip {...bottomSide} />
          </div>

          {currentLabel && (
            <p className={`move-label-banner ${LABELS[currentLabel.label].className}`}>
              <span className="move-label-glyph">{LABELS[currentLabel.label].glyph}</span>
              {currentLabel.san} is {LABELS[currentLabel.label].name}
              {currentLabel.bestMoveSan && !NO_BEST_MOVE_HINT.has(currentLabel.label) && (
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
                  <span className="review-opponent">
                    {" "}
                    · opponent {accuracyFor(otherColour(game.userColor), review.review.accuracy)}%
                  </span>
                </span>
              )}
            </div>
          )}

          {/* The full scorecard — every label counted for both players. Fills
              in as the review runs; the averages wait until it's finished. */}
          <ReviewSummary game={game} review={review.review} status={review.status} />

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
