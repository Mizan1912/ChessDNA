import { useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { pgnToMoves, STARTING_FEN } from "../lib/pgnToMoves";
import "./GameViewerPage.css";

export default function GameViewerPage({ game, onBack }) {
  const moves = useMemo(() => pgnToMoves(game.pgn), [game.pgn]);

  // -1 means "starting position, before move 1"
  const [moveIndex, setMoveIndex] = useState(-1);
  const [boardOrientation, setBoardOrientation] = useState(
    game.userColor === "black" ? "black" : "white"
  );

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
        vs {game.opponentName} — {game.result} — {game.timeClass}
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
            {moves.map((move, index) => (
              <li key={index}>
                <button
                  className={index === moveIndex ? "active" : ""}
                  onClick={() => setMoveIndex(index)}
                >
                  {move.color === "w" ? `${move.moveNumber}. ` : ""}
                  {move.san}
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
