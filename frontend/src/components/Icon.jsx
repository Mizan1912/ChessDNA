// The app's icon set: one consistent family, drawn for this app on a 24px
// grid with a 1.75 stroke and rounded ends, so every icon has the same
// weight as the text beside it. Inline SVG — no icon library to download,
// and each one takes the text colour of wherever it sits (currentColor).

const PATHS = {
  // Navigation
  games: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  tilt: (
    // A line that holds, then falls — score over a session.
    <>
      <path d="M3 6.5h5l3 3 3.5-1 6.5 9" />
      <path d="M17 17.5h4v-4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5" />
      <path d="M10 2.5h4" />
    </>
  ),
  blunders: (
    <>
      <path d="M12 3.5 21.5 20h-19L12 3.5Z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.4v.1" />
    </>
  ),
  // Board controls
  first: (
    <>
      <path d="M17.5 6 11.5 12l6 6" />
      <path d="M6.5 6v12" />
    </>
  ),
  prev: <path d="M14.5 6 8.5 12l6 6" />,
  next: <path d="M9.5 6 15.5 12l-6 6" />,
  last: (
    <>
      <path d="M6.5 6 12.5 12l-6 6" />
      <path d="M17.5 6v12" />
    </>
  ),
  flip: (
    <>
      <path d="M4.5 9.5A7.5 7.5 0 0 1 18 7l1.5 1.5" />
      <path d="M19.5 4v4.5H15" />
      <path d="M19.5 14.5A7.5 7.5 0 0 1 6 17l-1.5-1.5" />
      <path d="M4.5 20v-4.5H9" />
    </>
  ),
  // General
  back: (
    <>
      <path d="M19.5 12h-15" />
      <path d="M10.5 6 4.5 12l6 6" />
    </>
  ),
  external: (
    <>
      <path d="M8 16 16.5 7.5" />
      <path d="M9.5 7.5h7v7" />
    </>
  ),
  chevronDown: <path d="M6 9.5l6 6 6-6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  logout: (
    <>
      <path d="M14.5 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3" />
      <path d="M10 16.5 5.5 12 10 7.5" />
      <path d="M5.5 12h10" />
    </>
  ),
};

export default function Icon({ name, size = 20, className = "", strokeWidth = 1.75 }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

// The brand mark: a double helix — the "DNA" — drawn in gold inside a soft
// rounded square, with a single rung picked out as a chessboard square.
export function Logo({ size = 36 }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="logo-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ecc56e" />
          <stop offset="1" stopColor="#b8862f" />
        </linearGradient>
        <linearGradient id="logo-ground" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a2a1c" />
          <stop offset="1" stopColor="#1e1510" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#logo-ground)" stroke="rgba(236,197,110,0.35)" />
      <g fill="none" stroke="url(#logo-gold)" strokeWidth="2.4" strokeLinecap="round">
        <path d="M13 8c0 8 14 8 14 16s-14 8-14 8" />
        <path d="M27 8c0 8-14 8-14 16s14 8 14 8" />
      </g>
      <g stroke="url(#logo-gold)" strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
        <path d="M15.5 12.5h9" />
        <path d="M15.5 27.5h9" />
      </g>
      <rect x="17" y="18" width="6" height="4" rx="1" fill="url(#logo-gold)" />
    </svg>
  );
}
