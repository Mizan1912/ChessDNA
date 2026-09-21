import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { pgnToMoves, STARTING_FEN } from "../lib/pgnToMoves";
import { pgnToClockMoves, pgnTimeControl } from "../lib/clockData";
import { LABELS } from "../lib/moveLabels";
import EvalBar from "../components/EvalBar";
import PlayerStrip from "../components/PlayerStrip";
import ReviewSummary from "../components/ReviewSummary";
import MoveBadge from "../components/MoveBadge";
import Icon from "../components/Icon";
import { formatDuration, formatEval } from "../lib/format";
import { explainMove } from "../lib/explainMove";
import { useLiveEval } from "../hooks/useLiveEval";
import { useGameReview } from "../hooks/useGameReview";
import { useMediaQuery, MOBILE_QUERY } from "../hooks/useMediaQuery";
import "./GameViewerPage.css";

function formatDate(timestampMs) {
  return new Date(timestampMs).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const otherColour = (colour) => (colour === "black" ? "white" : "black");

// "best was Nf3" is noise when you already played it, and for theory moves
// there is nothing to improve on.
const NO_BEST_MOVE_HINT = new Set(["best", "brilliant", "great", "book"]);

// How each verdict reads in a sentence — "Nd6 is a blunder", not "Nd6 is
// Blunder". The label word itself is what gets the emphasis.
const VERDICT_PHRASE = {
  brilliant: ["is", "brilliant"],
  great: ["is a", "great move"],
  book: ["is a", "book move"],
  best: ["is the", "best move"],
  excellent: ["is", "excellent"],
  good: ["is", "good"],
  inaccuracy: ["is an", "inaccuracy"],
  mistake: ["is a", "mistake"],
  miss: ["is a", "miss"],
  blunder: ["is a", "blunder"],
};

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Brings the current move into view INSIDE its own list — and only there.
// The previous version used scrollIntoView(), which scrolls every scrollable
// container up the chain, the page included: on a phone, six taps of "next"
// dragged the whole page 496px and pushed the board off the top of the
// screen. This only ever moves the list's own scroll position.
function scrollWithin(container, element, axis) {
  if (!container || !element) return;
  const box = container.getBoundingClientRect();
  const item = element.getBoundingClientRect();
  const behavior = prefersReducedMotion() ? "auto" : "smooth";

  if (axis === "x") {
    // The phone strip keeps the current move centred, like a ticker.
    const left = container.scrollLeft + (item.left - box.left) - (box.width - item.width) / 2;
    container.scrollTo({ left, behavior });
    return;
  }
  // The laptop list only moves when the current move has left the visible
  // area — a list that re-centres on every step is tiring to read.
  const margin = 8;
  if (item.top < box.top + margin) {
    container.scrollTo({ top: container.scrollTop + (item.top - box.top) - margin, behavior });
  } else if (item.bottom > box.bottom - margin) {
    container.scrollTo({ top: container.scrollTop + (item.bottom - box.bottom) + margin, behavior });
  }
}

// The small label glyph beside a move in the list, in its label colour.
function LabelGlyph({ labelled }) {
  if (!labelled) return null;
  const meta = LABELS[labelled.label];
  return (
    <span className={`move-label ${meta.className}`} title={meta.name}>
      {meta.glyph}
    </span>
  );
}

// Laptop: the chess-site standard — one row per move number, White's move
// then Black's, each with its verdict and how long it took.
function MoveTable({ moves, clockMoves, labelsByPly, activeIndex, onSelect, listRef }) {
  const rows = [];
  for (let i = 0; i < moves.length; i += 2) rows.push({ number: moves[i].moveNumber, white: i, black: i + 1 });

  const cell = (ply) => {
    if (ply >= moves.length) return <span className="move-cell empty" />;
    const time = formatDuration(clockMoves[ply]?.timeSpentSeconds ?? null);
    return (
      <button
        className={`move-cell${ply === activeIndex ? " active" : ""}`}
        data-ply={ply}
        onClick={() => onSelect(ply)}
      >
        <span className="move-san">{moves[ply].san}</span>
        <LabelGlyph labelled={labelsByPly.get(ply)} />
        {time && <span className="move-time">{time}</span>}
      </button>
    );
  };

  return (
    <div className="move-table" ref={listRef}>
      {rows.map((row) => (
        <div className="move-row" key={row.number}>
          <span className="move-number">{row.number}.</span>
          {cell(row.white)}
          {cell(row.black)}
        </div>
      ))}
    </div>
  );
}

// Phone: one sideways-scrolling line of moves under the board, the current
// one kept centred. Takes one row of height instead of half the screen.
function MoveStrip({ moves, labelsByPly, activeIndex, onSelect, listRef }) {
  return (
    <div className="move-strip" ref={listRef}>
      {moves.map((move, ply) => (
        <button
          key={ply}
          className={`strip-move${ply === activeIndex ? " active" : ""}`}
          data-ply={ply}
          onClick={() => onSelect(ply)}
        >
          {move.color === "w" && <span className="strip-number">{move.moveNumber}.</span>}
          {move.san}
          <LabelGlyph labelled={labelsByPly.get(ply)} />
        </button>
      ))}
    </div>
  );
}

// The five board controls. On a phone they live in a bar pinned to the
// bottom of the screen, under the thumb; on a laptop, at the foot of the
// moves panel (and on the arrow keys).
function BoardControls({ atStart, atEnd, onFirst, onPrev, onNext, onLast, onFlip, className }) {
  return (
    <nav className={`board-controls ${className}`} aria-label="Move through the game">
      <button className="btn-icon" data-nav="first" onClick={onFirst} disabled={atStart} aria-label="First move">
        <Icon name="first" size={22} />
      </button>
      <button className="btn-icon" data-nav="prev" onClick={onPrev} disabled={atStart} aria-label="Previous move">
        <Icon name="prev" size={24} />
      </button>
      <button className="btn-icon btn-step" data-nav="next" onClick={onNext} disabled={atEnd} aria-label="Next move">
        <Icon name="next" size={24} />
      </button>
      <button className="btn-icon" data-nav="last" onClick={onLast} disabled={atEnd} aria-label="Last move">
        <Icon name="last" size={22} />
      </button>
      <button className="btn-icon" data-nav="flip" onClick={onFlip} aria-label="Flip board">
        <Icon name="flip" size={20} />
      </button>
    </nav>
  );
}

// The coach card: "h5 is excellent", the evaluation after it, and a short
// explanation of WHY (lib/explainMove.js — every claim in it is checked on
// the board). The verdict word is the thing your eye lands on.
function MoveVerdict({ labelled, explanation, evalAfterCp }) {
  if (!labelled) return <div className="move-verdict placeholder" aria-hidden="true" />;
  const meta = LABELS[labelled.label];
  const [lead, word] = VERDICT_PHRASE[labelled.label] ?? ["is", meta.name.toLowerCase()];
  const evalText = formatEval(evalAfterCp);
  return (
    <div className={`move-verdict ${meta.className}`} key={labelled.plyIndex}>
      <div className="verdict-top">
        <MoveBadge label={labelled.label} inline />
        <p className="verdict-headline">
          <strong className="verdict-move">{labelled.san}</strong> {lead} <strong className="verdict-word">{word}</strong>
        </p>
        {evalText && (
          <span className={`eval-chip${evalAfterCp < 0 ? " black-better" : ""}`} title="Engine evaluation after this move (+ = White better)">
            {evalText}
          </span>
        )}
      </div>
      {explanation && <p className="verdict-explain">{explanation}</p>}
    </div>
  );
}

// `initialMoveIndex` is the move a finding elsewhere in the app (the clock
// page's "longest think" or "known position" findings) wants highlighted and
// animated when this viewer opens — e.g. the slow move itself, not the game
// as a whole. -1 means "no target, just open at the start" (the normal case,
// clicking a game from the list).
export default function GameViewerPage({ game, onBack, initialMoveIndex = -1, note = null }) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
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
  const [boardOrientation, setBoardOrientation] = useState(game.userColor === "black" ? "black" : "white");
  const [panelTab, setPanelTab] = useState("moves"); // laptop panel: "moves" | "review"

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

  // Why the current move earned its label — explained from the board and the
  // engine's line, only once the review has labelled this move.
  const currentEvalAfter = review.review?.evalAfterPly?.[moveIndex];
  const explanation = useMemo(() => {
    if (!currentLabel) return null;
    const move = moves[moveIndex];
    const evalBeforeCp = moveIndex === 0 ? review.review?.startingEval : review.review?.evalAfterPly?.[moveIndex - 1];
    let previousMove = null;
    if (moveIndex > 0) {
      try {
        previousMove = new Chess(moves[moveIndex - 1].fenBefore).move(moves[moveIndex - 1].san);
      } catch {
        previousMove = null;
      }
    }
    return explainMove({
      san: move.san,
      color: move.color,
      moveNumber: move.moveNumber,
      fenBefore: move.fenBefore,
      fenAfter: move.fenAfter,
      label: currentLabel.label,
      bestMoveSan: currentLabel.bestMoveSan,
      replyLine: currentLabel.replyLine,
      evalBeforeCp,
      evalAfterCp: review.review?.evalAfterPly?.[moveIndex],
      isYou: (move.color === "w") === (game.userColor === "white"),
      previousMove,
    });
  }, [currentLabel, moveIndex, moves, review.review, game.userColor]);

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
        {playedMove && square === playedMove.to && currentLabel && <MoveBadge label={currentLabel.label} />}
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

  // Keep the current move visible in its list — scrolling the list, never
  // the page (see scrollWithin). Matters most when arriving from a finding,
  // where the move in question is often 30+ moves in.
  const listRef = useRef(null);
  useEffect(() => {
    const container = listRef.current;
    const active = container?.querySelector(`[data-ply="${moveIndex}"]`);
    if (active) scrollWithin(container, active, isMobile ? "x" : "y");
    else if (container && moveIndex === -1) container.scrollTo({ top: 0, left: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [moveIndex, isMobile, panelTab]);

  function goTo(index) {
    setExploring(null);
    setMoveIndex(Math.max(-1, Math.min(moves.length - 1, index)));
  }
  function flipBoard() {
    setBoardOrientation((side) => (side === "white" ? "black" : "white"));
  }

  // Arrow keys step through the game, as on every chess site. Ignored while
  // typing, and whenever a modifier key is held (so browser shortcuts still work).
  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest?.("input, textarea, [contenteditable]")) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const actions = {
        ArrowLeft: () => goTo(moveIndex - 1),
        ArrowRight: () => goTo(moveIndex + 1),
        Home: () => goTo(-1),
        End: () => goTo(moves.length - 1),
        f: flipBoard,
      };
      const action = actions[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Dragging a piece branches off into your own line rather than editing the
  // game. Returns false for illegal moves so the piece snaps back.
  function handlePieceDrop({ sourceSquare, targetSquare }) {
    if (!targetSquare) return false;
    try {
      const board = new Chess(currentFen);
      const played = board.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      if (!played) return false;
      setExploring({ fen: board.fen(), line: [...(exploring?.line ?? []), played.san] });
      return true;
    } catch {
      return false;
    }
  }

  const controls = {
    atStart: moveIndex === -1 && !exploring,
    atEnd: moveIndex === moves.length - 1 && !exploring,
    onFirst: () => goTo(-1),
    onPrev: () => goTo(moveIndex - 1),
    onNext: () => goTo(moveIndex + 1),
    onLast: () => goTo(moves.length - 1),
    onFlip: flipBoard,
  };

  const you = game.userColor;
  const accuracy = review.status === "done" ? review.review?.accuracy : null;
  const progressPercent = review.progress.totalPlies
    ? Math.round((review.progress.plyDone / review.progress.totalPlies) * 100)
    : 0;

  // Review status — a progress bar while the engine works, then both
  // players' accuracy as the headline numbers.
  const reviewStatus = (
    <div className="review-status">
      {review.status === "reviewing" && (
        <div className="review-progress" role="status">
          <div className="review-progress-text">
            <span className="eyebrow">Reviewing</span>
            <span className="muted">
              move {Math.ceil(review.progress.plyDone / 2)} of {Math.ceil(review.progress.totalPlies / 2)}
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}
      {review.status === "error" && (
        <p className="error-message review-error">
          Review failed.{" "}
          <button className="btn-ghost" onClick={() => review.run(game)}>
            Try again
          </button>
        </p>
      )}
      {accuracy && (
        <div className="accuracy-pair review-accuracy">
          <div className="accuracy-block you">
            <span className="eyebrow">You</span>
            <span className="stat-value gold">{accuracy[you]?.toFixed?.(1) ?? "—"}</span>
          </div>
          <div className="accuracy-block">
            <span className="eyebrow">Opponent</span>
            <span className="stat-value">{accuracy[otherColour(you)]?.toFixed?.(1) ?? "—"}</span>
          </div>
          <span className="accuracy-caption muted">accuracy</span>
        </div>
      )}
    </div>
  );

  const exploringBanner = exploring && (
    <div className="exploring-banner">
      <span className="eyebrow">Your own line</span>
      <strong className="exploring-line">{exploring.line.join(" ")}</strong>
      <button className="btn-ghost" onClick={() => setExploring(null)}>
        <Icon name="back" size={16} /> Back to the game
      </button>
    </div>
  );

  return (
    <div className={`viewer${isMobile ? " viewer-mobile" : ""}`}>
      <header className="viewer-header">
        <button className="btn-icon viewer-back" onClick={onBack} aria-label="Back">
          <Icon name="back" size={22} />
        </button>
        <div className="viewer-title">
          <span className="eyebrow">
            <span className={`color-dot ${game.userColor}`} /> <span className="capitalize">{game.timeClass}</span> ·{" "}
            {formatDate(game.playedAt)}
          </span>
          <h1>
            vs {game.opponentName}
            {game.opponentRating != null && <span className="title-rating">{game.opponentRating}</span>}
          </h1>
        </div>
        <span className={`pill pill-${game.result}`}>{game.result}</span>
        <a className="btn-icon external-link" href={game.url} target="_blank" rel="noreferrer" aria-label="Open on Chess.com" title="Open on Chess.com">
          <Icon name="external" size={20} />
        </a>
      </header>

      {note && <p className="viewer-note">{note}</p>}

      <div className="viewer-layout">
        <div className="board-column">
          {/* On a phone the explanation sits ABOVE the board: underneath, it
              fell below the pinned control bar and couldn't be read while
              stepping through moves. */}
          {isMobile && (exploringBanner || <MoveVerdict labelled={currentLabel} explanation={explanation} evalAfterCp={currentEvalAfter} />)}

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
                    animationDurationInMs: prefersReducedMotion() ? 0 : 220,
                  }}
                />
              </div>
            </div>
            <PlayerStrip {...bottomSide} />
          </div>

          {isMobile && (
            <MoveStrip moves={moves} labelsByPly={labelsByPly} activeIndex={exploring ? null : moveIndex} onSelect={goTo} listRef={listRef} />
          )}
        </div>

        {isMobile ? (
          <section className="mobile-review">
            <div className="card">{reviewStatus}</div>
            <ReviewSummary game={game} review={review.review} status={review.status} />
          </section>
        ) : (
          <section className="side-panel card">
            <div className="side-panel-inner">
              {reviewStatus}
              {exploringBanner || <MoveVerdict labelled={currentLabel} explanation={explanation} evalAfterCp={currentEvalAfter} />}

              <div className="panel-tabs" role="tablist">
                <button role="tab" aria-selected={panelTab === "moves"} className={panelTab === "moves" ? "active" : ""} onClick={() => setPanelTab("moves")}>
                  Moves
                </button>
                <button role="tab" aria-selected={panelTab === "review"} className={panelTab === "review" ? "active" : ""} onClick={() => setPanelTab("review")}>
                  Review
                </button>
              </div>

              <div className="panel-body">
                {panelTab === "moves" ? (
                  <MoveTable
                    moves={moves}
                    clockMoves={clockMoves}
                    labelsByPly={labelsByPly}
                    activeIndex={exploring ? null : moveIndex}
                    onSelect={goTo}
                    listRef={listRef}
                  />
                ) : (
                  <div className="panel-review">
                    <ReviewSummary game={game} review={review.review} status={review.status} />
                  </div>
                )}
              </div>

              <BoardControls {...controls} className="panel-controls" />
            </div>
          </section>
        )}
      </div>

      {/* The phone's controls are pinned to the bottom of the screen. Rendered
          into <body> rather than here, because this page arrives with a
          transform animation, and a transformed parent would make "fixed"
          mean "fixed to the page" for the length of that animation. */}
      {isMobile && createPortal(<BoardControls {...controls} className="control-bar glass" />, document.body)}
    </div>
  );
}
