import { useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { pgnToMoves, STARTING_FEN } from "../lib/pgnToMoves";
import { pgnToClockMoves } from "../lib/clockData";
import "./GameViewerPage.css";

function formatSeconds(seconds) {
  if (seconds === null) return null;
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;
}

// `initialMoveIndex` lets a finding elsewhere in the app (the clock page's
// "longest think" or "known position" findings) open this game already
// sitting on the exact move being talked about, instead of always dropping
// the viewer at the start of the game and making the user click forward to
// find it themselves.
export default function GameViewerPage({ game, onBack, initialMoveIndex = -1 }) {
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

  // -1 means "starting position, before move 1". Always MOUNT at the start,
  // even when a finding wants to open on a specific move — react-chessboard
  // only animates a piece sliding when the position CHANGES, not on first
  // mount, so jumping straight to the target position on mount would just
  // show it frozen there with no motion. Moving to it a tick after mount
  // turns that into a real, visible slide.
  const [moveIndex, setMoveIndex] = useState(-1);
  const [boardOrientation, setBoardOrientation] = useState(
    game.userColor === "black" ? "black" : "white"
  );

  useEffect(() => {
    if (initialMoveIndex === -1) return;
    const timer = setTimeout(() => setMoveIndex(initialMoveIndex), 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount — this is a one-time "arrive here" animation, not a live sync

  const currentFen = moveIndex === -1 ? STARTING_FEN : moves[moveIndex].fenAfter;

  function goToStart() {
    setMoveIndex(-1);
  }
  function goBack() {
    setMoveIndex((i) => Math.max(-1, i - 1));
  }
  function goForward() {
    setMoveIndex((i) => Math.min(moves.length - 1, i + 1));
  }
  function goToEnd() {
    setMoveIndex(moves.length - 1);
  }
  function flipBoard() {
    setBoardOrientation((side) => (side === "white" ? "black" : "white"));
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

      <div className="viewer-layout">
        <div className="board-panel">
          <Chessboard options={{ position: currentFen, boardOrientation, allowDragging: false }} />
        </div>

        <div className="moves-panel">
          <div className="move-controls">
            <button onClick={goToStart} disabled={moveIndex === -1}>
              |&lt;
            </button>
            <button onClick={goBack} disabled={moveIndex === -1}>
              &lt;
            </button>
            <button onClick={goForward} disabled={moveIndex === moves.length - 1}>
              &gt;
            </button>
            <button onClick={goToEnd} disabled={moveIndex === moves.length - 1}>
              &gt;|
            </button>
            <button onClick={flipBoard}>Flip board</button>
          </div>

          <ol className="move-list">
            {moves.map((move, index) => {
              const timeLabel = formatSeconds(clockMoves[index]?.timeSpentSeconds ?? null);
              return (
                <li key={index}>
                  <button
                    className={index === moveIndex ? "active" : ""}
                    onClick={() => setMoveIndex(index)}
                  >
                    {move.color === "w" ? `${move.moveNumber}. ` : ""}
                    {move.san}
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
