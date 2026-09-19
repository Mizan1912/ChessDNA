# decision.md — why things are the way they are

Newest entry at top. One entry per decision, never edited later; if a decision is reversed, a new
entry is added that says so and links back. Every magic number in the code must trace to an entry
here.

---

## D-017 — Responsive breakpoint at 720px added to every two-column layout
Date: 2026-09-19
Phase: 2
Decided by: user

What: The games list, game viewer, and (implicitly, no two-column layout there) tilt page all had a
fixed-width board/side panel with no way to shrink or stack. Below ~720px wide (phones, most
portrait tablets) this caused the main content to be squeezed into a sliver and visually overlap the
board — confirmed as a real bug via a mobile-viewport screenshot, not just a style complaint. Added
a `@media (max-width: 720px)` rule to `GamesListPage.css` and `GameViewerPage.css` that switches
each `flex` row to `flex-direction: column` and lets the board panel go full-width, plus a
`.games-table-wrapper` with `overflow-x: auto` as a safety net if a table ever gets wider than the
screen. Also hid the header tagline under 480px to keep the header on one line.
Why: user specifically flagged mobile as broken, in addition to laptop. This wasn't optional
polish — the fetch form was genuinely unusable on a phone before this fix (a button could be
overlapped by the board and become unclickable).
Alternatives considered: none — this is a correctness fix, not a design choice with real
alternatives.
Affects: `GamesListPage.css`/`.jsx`, `GameViewerPage.css`, `App.css`.

---

## D-016 — Fourth living doc: code-flow.md, for internals not user journey
Date: 2026-09-19
Phase: 2
Decided by: user

What: Added `code-flow.md` at the repo root, alongside `decision.md`/`flow.md`/`rnd.md`. It explains
how the code works internally (which file calls which, in what order, in plain language) — separate
from `flow.md`, which stays focused on what the user sees and clicks. Rewritten each phase like
`flow.md`, not appended to.
Why: user wants to understand the codebase at a lower level than "what screen shows what," without
`flow.md` turning into two different documents mashed together.
Alternatives considered: folding this into `flow.md` as a new section — rejected, user explicitly
asked for `flow.md` to stay as-is and for this to be separate.
Affects: every phase from here on updates four living docs, not three.

---

## D-015 — Shared GameEvidenceList component for the evidence rule
Date: 2026-09-19
Phase: 2
Decided by: agent

What: Added `components/GameEvidenceList.jsx` — a plain clickable list (date, opponent, result)
that opens a game in the real board viewer. `TiltPage` uses it behind "show the N games..." toggles
on every finding (break-point row, post-loss chain, worst hour).
Why: the build doc's evidence rule is unconditional — "no finding is ever shown without a way to
see the games it came from." This is the shared piece every later feature (blind spots, clock,
opening fit) can reuse instead of each page inventing its own list.
Alternatives considered: board thumbnails per list row (the doc's ideal for Feature 1's blunder
list) — deferred here since Feature 2's findings aren't tied to one specific board position the way
a blunder is; a plain list is honest and sufficient for "this game was part of that group."
Affects: `frontend/src/components/GameEvidenceList.jsx/.css`, `TiltPage.jsx`.

---

## D-014 — Tilt break-point threshold: 10 percentage points, minimum 20 sessions
Date: 2026-09-19
Phase: 2
Decided by: user

What: The "break point" (the session index where play starts falling apart) is the first index whose
average score is 10 percentage points or more below the session's game-1 score, and stays at least
that far below for every later index that has data. Nothing is reported below 20 total sessions —
shows "not enough games yet" instead, per the spec.
Why: user picked 10 points as the sensitivity that catches real tilt without flagging normal
game-to-game variance.
Alternatives considered: 15 points (stricter, could miss real but smaller effects); tune after
seeing real data (user preferred deciding upfront).
Affects: `frontend/src/lib/tilt.js`.

---

## D-013 — "Lost from a winning position" tilt chain deferred to Phase 4
Date: 2026-09-19
Phase: 2
Decided by: user

What: Phase 2's tilt detector computes "score after any loss" and "score after a loss on time"
(both readable straight from PGN result/termination text), but not "score after a loss from a
winning position" — that needs an engine eval to know the game was winning before it flipped, and
there's no Stockfish yet.
Why: user chose accuracy over a placeholder number. A heuristic (move count, end material) could
mislead exactly the kind of person this app is trying to tell the truth to.
Alternatives considered: cheap heuristic (material/move-count based guess) — rejected as unreliable.
Affects: `lib/tilt.js` (to be built); revisit once Phase 4 adds Stockfish evals.

---

## D-012 — Archive-walking inefficiency deferred to Phase 3, not fixed now
Date: 2026-09-19
Phase: 1
Decided by: agent
Needs review: yes

What: `getRecentGames` pulls a whole month's archive JSON from Chess.com even when only a handful
of games are needed, because Chess.com's archive endpoint has no "give me the last N games" option.
No change is being made to work around this now.
Why: the build doc's own "Sync strategy" section already plans the real fix — track
`lastAnalysedGameId` per user and fetch only games newer than it on repeat visits, so only the
*first* sync ever pulls a full month. That tracking needs somewhere to persist the id, which is
what Phase 3 (Mongo) adds. Building a workaround now would duplicate work Phase 3 already does
properly.
Alternatives considered: caching archives in IndexedDB in the meantime — rejected as unnecessary
complexity for a problem that only shows up for very high-volume accounts, and that Phase 3 removes
anyway.
Affects: `frontend/src/lib/chessComApi.js` (unchanged for now); revisit when Phase 3 adds
`lastAnalysedGameId`.

---

## D-011 — Phase 1 closes with Chess.com only; Lichess parked
Date: 2026-09-19
Phase: 1
Decided by: user

What: Phase 1 is considered done with only Chess.com wired up. Lichess support (API client,
normalizer, and a platform picker in the form) is parked, not built.
Why: user chose to move to Phase 2 (Tilt + Clock) rather than spend more time on Phase 1 first —
Phase 2 only needs the games already fetchable from Chess.com.
Alternatives considered: build Lichess now to match Phase 1's original scope exactly — user declined.
Affects: `GamesListPage.jsx` has no platform picker yet; `lib/lichessApi.js` doesn't exist yet.

---

## D-010 — Games list redesigned: board as visual anchor, hover preview, flattened toolbar
Date: 2026-09-19
Phase: 1
Decided by: agent
Needs review: yes

What: After the first design pass still read as generic, the games list page was restructured:
the username/slider/button form is now a slim bottom-bordered toolbar (not a bordered "card"
floating on empty background — that was still the exact look the doc warns against, just recoloured
dark), and a chess board now sits beside the table at all times — starting position when idle, and
the hovered game's final position when hovering a row. This makes the board do real work (a quick
visual signature of how a game ended) instead of only appearing after a click, and gives the screen
an immediate "this is a chess tool" read per the design direction's one-second test.
Why: user said the first pass still felt AI-generated. Verified visually via Playwright screenshots
(with Chess.com responses mocked from real fetched data — the live API blocks headless/automated
browsers via Cloudflare, see the watch item in rnd.md) rather than guessing blind.
Alternatives considered: keep the card but restyle its colours only — rejected, the doc's actual
complaint is about the "card floating on flat background" shape, not the colour choice.
Affects: `frontend/src/pages/GamesListPage.jsx`, `GamesListPage.css`.

---

## D-009 — Design direction applied now, not deferred; plain CSS files, no framework
Date: 2026-09-19
Phase: 1
Decided by: user

What: Replaced the default Vite scaffold styling (purple/indigo accents, centred layout — exactly
the generic look the build doc warns against) with the project's actual design system: dark by
default, one accent colour (`--color-accent`, a wood/amber tone) used for interactive states only,
a serif heading font (Fraunces, loaded free from Google Fonts) paired with a plain system-font
body, tabular figures for numbers, and a dense (not airy) table/list layout. Glassmorphism (blur)
is used only on the sticky app header, where real content scrolls underneath it — nowhere else.
Styling is plain CSS, one file per component/page, imported directly — no Tailwind or CSS-in-JS
library added.
Why: user pointed out the UI looked bad after Phase 1's first working slice. The build doc is
explicit that Phase 1's screen is where the design direction should be established, not deferred —
that was my mistake, not a "later phase" item. Plain CSS avoids adding a dependency the doc's tech
stack table didn't already call for.
Alternatives considered: Tailwind (fast to write, but a new dependency not in the locked stack;
would need its own decision entry to add) — deferred unless plain CSS becomes unwieldy.
Affects: `frontend/src/index.css` (full rewrite), `App.jsx`/`App.css`, `GamesListPage.jsx`/`.css`,
`GameViewerPage.jsx`/`.css`, `index.html` (font link).

---

## D-008 — Chess.com base URL moved to env var; game count is a UI slider, not a constant
Date: 2026-09-19
Phase: 1
Decided by: user

What: Two fixes to Phase 1 slice 1:
1. `VITE_CHESSCOM_API_BASE_URL` added to root `.env.example`/`.env`, read via `import.meta.env` in
   `lib/chessComApi.js`, falling back to the real endpoint if unset. `vite.config.js` now points
   `envDir` at the repo root so `/frontend` and the future `/api` functions share one `.env` file
   instead of needing two kept in sync.
2. The hardcoded `GAMES_TO_FETCH = 50` was removed. `GamesListPage` now has a range slider
   (10-100, step 10, defaults to 50) so the user picks how many games to pull per fetch.
Why: user caught both as violations of the project's "no hardcode, use envs" rule — the API base
URL is external config that should be overridable without a code change, and the game count is a
per-request user choice, not a fixed limit.
Alternatives considered: making game count an env var too — rejected, it's a UI-level user
preference each time they fetch, not a deployment-level config value.
Affects: `frontend/vite.config.js`, `frontend/src/lib/chessComApi.js`, `frontend/src/pages/GamesListPage.jsx`,
root `.env.example`.

---

## D-007 — Chess.com wired up before Lichess in Phase 1
Date: 2026-09-19
Phase: 1
Decided by: agent
Needs review: yes

What: Build and prove the game-fetching flow against Chess.com's API first; add Lichess once that
path works end to end.
Why: Chess.com's REST API (monthly archive endpoints, plain JSON) is simpler to get a first working
slice from than Lichess's NDJSON stream. User didn't have a preference when asked, said proceed.
Alternatives considered: Lichess first, or both at once — both first would double the surface area
before anything is proven working.
Affects: `lib/chessComApi.js` built now, `lib/lichessApi.js` and the platform-normalizing layer come
right after.

---

## D-006 — src/ skeleton: pages, components, lib, hooks
Date: 2026-09-19
Phase: 0
Decided by: user

What: `/frontend/src` gets four empty subfolders now — `pages/`, `components/`, `lib/` (chess.js and
API-client helpers), `hooks/` — each holding a `.gitkeep` placeholder, instead of staying flat like
Vite's default scaffold.
Why: user asked for a proper, distinctive folder structure visible from the first commit, not one
that grows ad hoc once Phase 1 starts.
Alternatives considered: leave `src/` flat and add folders only when Phase 1 needs them — closer to
the "no fake work" spirit but rejected in favour of visible structure now.
Affects: `/frontend/src` layout; Phase 1 work will fill these folders rather than inventing new
top-level ones.

---

## D-005 — Deployment deferred, Phase 0 closes without a live URL
Date: 2026-09-19
Phase: 0
Decided by: user

What: Vercel deployment is paused. Phase 0's original "done when" (a real URL loads) is not met yet;
we're treating "builds clean locally, both apps runnable" as the Phase 0 bar instead.
Why: user wants to set up Vercel later.
Alternatives considered: none, explicit user instruction.
Affects: Phase 0 exit criteria, `vercel.json` (not yet created).

---

## D-004 — Repo split: /frontend + /api at root
Date: 2026-09-19
Phase: 0
Decided by: user

What: React+Vite app lives entirely in `/frontend` with its own `package.json`. Serverless functions
will live in `/api` at repo root (Vercel's default convention). A `vercel.json` will point the build
at `/frontend` when we deploy.
Why: keeps frontend and backend dependencies from mixing in one package.json, and reads as a
"distinctive folder structure" — clear at a glance which code runs in the browser vs on the server.
Alternatives considered: single root package.json with `/src` + `/api` (matches the tech-stack table
literally, simpler Vercel config) — rejected for mixing concerns in one dependency tree.
Affects: overall repo layout, future `vercel.json`.

---

## D-003 — Package manager: npm
Date: 2026-09-19
Phase: 0
Decided by: user

What: npm is the only package manager used in this repo.
Why: ships with Node, zero extra install, Vercel assumes it by default.
Alternatives considered: pnpm, yarn — both work fine but need a separate install and small Vercel
config changes, no real benefit at this scale.
Affects: install instructions, CI/deploy config later.

---

## D-002 — Language: plain JavaScript, no TypeScript
Date: 2026-09-19
Phase: 0
Decided by: user

What: Frontend and `/api` functions are written in plain JavaScript.
Why: matches the build plan's instruction that the user is "not a heavy-jargon person" — no type
syntax or build-time type layer to read through.
Alternatives considered: TypeScript — more upfront safety on the DNA object's shape, but adds a
learning curve; rejected for this project.
Affects: every file in `/frontend` and `/api`, going forward.

---

## D-001 — Version control: local git only, no remote yet
Date: 2026-09-19
Phase: 0
Decided by: user

What: `git init` locally. No GitHub remote and no Vercel project connected yet.
Why: user wants to create/connect GitHub and Vercel themselves when ready; agent should not need
push access or credentials.
Alternatives considered: connect a GitHub repo now (user has none ready); skip git entirely
(rejected — commit history is worth having from day one).
Affects: nothing pushes anywhere until the user explicitly asks.

---

## Parked

- **Vercel deployment** (belongs to: whenever the user is ready) — scaffold and `npm run build`
  confirmed working locally; deployment itself paused per D-005.
- **"Lost from a winning position" tilt chain** (belongs to: Phase 4, once Stockfish evals exist) —
  parked per D-013.
- **Lichess support** (belongs to: whenever it's picked back up, likely before Phase 3 so saved DNA
  covers both platforms) — parked per D-011. `lib/chessComApi.js` and `normalizeGame.js` were
  written with the platform split in mind (see D-007), so adding `lib/lichessApi.js` +
  `normalizeLichessGame()` later should slot in without reworking the Chess.com side.
