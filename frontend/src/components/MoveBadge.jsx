import { LABELS } from "../lib/moveLabels";
import "./MoveBadge.css";

// The little medal that sits on the square a piece just moved to, saying what
// the move was worth. Chess.com puts it there, and it's the right place for
// it: you're already looking at the piece, so the verdict finds you instead of
// you having to find it in a list.
//
// It's drawn as SVG rather than as a text glyph in a coloured circle. The
// glyph version looked cheap for a reason worth remembering: the shapes were
// whatever the page font happened to give (a star and a book glyph from
// different typefaces, sitting at different weights and heights), and a flat
// disc has no depth. Here every mark is a drawn path at a weight we choose,
// on a disc with a gradient, a light inner rim and a shadow — so it reads as
// a physical token resting on the board.

// Each label's face: the base colour, a lighter tint for the top of the
// gradient, and the mark itself. Base colours match the move list's label
// colours in GameViewerPage.css — the same palette, applied as fills.
const FACES = {
  brilliant: { base: "#2aa89b", light: "#5fdccf", mark: text("!!") },
  great: { base: "#5285c9", light: "#8fbaf2", mark: text("!") },
  book: { base: "#8c7059", light: "#bda088", mark: book() },
  best: { base: "#74a839", light: "#a9d96f", mark: star() },
  excellent: { base: "#688f45", light: "#96bf73", mark: check(2.7) },
  good: { base: "#857b71", light: "#b5aca2", mark: check(2) },
  inaccuracy: { base: "#c99c2c", light: "#edcd6c", mark: text("?!") },
  mistake: { base: "#c8762f", light: "#eda86c", mark: text("?") },
  miss: { base: "#c86630", light: "#ed996c", mark: cross() },
  blunder: { base: "#ba4a44", light: "#e3827d", mark: text("??") },
};

// --- the marks, all drawn in a 24x24 box centred on (12, 12) ---

function text(characters) {
  // Two-character marks need to come down a size to breathe inside the disc.
  const size = characters.length > 1 ? 11.5 : 15;
  return (
    <text
      className="badge-text"
      x="12"
      y="12.6"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={size}
    >
      {characters}
    </text>
  );
}

function star() {
  return (
    <path
      fill="#fff"
      d="M12 5 L13.76 9.57 L18.66 9.84 L14.85 12.93 L16.12 17.66 L12 15 L7.88 17.66 L9.15 12.93 L5.34 9.84 L10.24 9.57 Z"
    />
  );
}

function check(width) {
  return (
    <path
      fill="none"
      stroke="#fff"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.8 12.2 L10.3 15.7 L17.2 8.6"
    />
  );
}

function cross() {
  return (
    <path
      fill="none"
      stroke="#fff"
      strokeWidth="2.7"
      strokeLinecap="round"
      d="M8.2 8.2 L15.8 15.8 M15.8 8.2 L8.2 15.8"
    />
  );
}

// An open book, seen from above: two pages falling away from a centre spine.
function book() {
  return (
    <g>
      <path
        fill="#fff"
        d="M12 8.6 C10.4 7.5 8.3 7.3 6.4 7.7 L6.4 16.1 C8.3 15.7 10.4 15.9 12 17 C13.6 15.9 15.7 15.7 17.6 16.1 L17.6 7.7 C15.7 7.3 13.6 7.5 12 8.6 Z"
      />
      <path stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" d="M12 8.9 L12 16.5" />
    </g>
  );
}

// `inline`: the same medal sitting in a line of text (the verdict under the
// board) rather than pinned to the corner of a board square.
export default function MoveBadge({ label, inline = false }) {
  const meta = LABELS[label];
  const face = FACES[label];
  if (!meta || !face) return null;

  const gradientId = `badge-grad-${label}`;
  return (
    <svg
      className={inline ? "move-badge-inline" : "move-badge"}
      viewBox="0 0 24 24"
      role="img"
      aria-label={meta.name}
      style={{ color: face.base }}
    >
      <title>{meta.name}</title>
      <defs>
        {/* Lit from above, like anything sitting on a table. */}
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={face.light} />
          <stop offset="1" stopColor={face.base} />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill={`url(#${gradientId})`} />
      {/* A hairline rim just inside the edge — enough to suggest a bevel,
          not enough to read as a second circle. */}
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="#fff" strokeOpacity="0.2" strokeWidth="0.8" />
      {face.mark}
    </svg>
  );
}
