# decision.md — why things are the way they are

Newest entry at top. One entry per decision, never edited later; if a decision is reversed, a new
entry is added that says so and links back. Every magic number in the code must trace to an entry
here.

---

## D-033 — Blunders explain themselves; scan results survive navigation
Date: 2026-09-20
Phase: 4
Decided by: user

What: Three changes, all from user feedback that the blunder list said *that* a move was bad but
never *why*, and that results vanished on navigation:
1. **Scan state moved up to `App.jsx`.** It used to live inside `BlundersPage`, which unmounts the
   moment you click a blunder to look at it — so coming back meant re-running a multi-minute scan.
   Straightforward bug.
2. **New `lib/explainBlunder.js`.** Turns a flagged move into a plain sentence: "Qd4 loses your
   queen on d4 to Bxd4", "Nf6 allows a forced mate", "You had a forced mate here". It works off
   board logic (chess.js) plus two engine moves the scan already computed but was throwing away —
   the best move, and the opponent's refutation. Shown as a short tag in the table and as a full
   sentence above the board when you open the position. No AI, no extra engine cost.
3. **Move list scrolls the highlighted move into view** — findings are often 30+ moves deep, well
   outside the visible window.
Two correctness fixes came out of testing this on real games:
- **Never flag the engine's own best move as a blunder.** Real output contained "move 44 d2 | best
  was d2" — self-contradictory. Cause: scoring the position *after* a move searches one ply deeper
  than the position before it did, so even a perfect move can show a small apparent drop. Now
  skipped outright.
- **Ignore hanging pawns when explaining.** "Nd6 leaves your pawn on f4 undefended" is technically
  true and practically useless; explanations now only name a knight or better.
Why: user asked for Chess.com-style reasons. Also follows the build doc's Feature 7 note that "the
suggestions are free — the motif tags are already computed... turn each into a template sentence".
Deliberately conservative: it only makes a specific claim when it's actually been checked on the
board, and otherwise falls back to a vaguer sentence that's certainly true. Same reasoning the doc
gives for keeping "Brilliant" strict — a confidently wrong explanation costs more trust than a
cautious one.
Alternatives considered: calling an LLM to write explanations (rejected — costs money, the doc
forbids paid services, and it would invent things that aren't on the board).
Affects: `lib/explainBlunder.js` (new), `lib/blunderScan.js`, `pages/BlundersPage.jsx`, `App.jsx`,
`pages/GameViewerPage.jsx`/`.css`, `hooks/useBlunderScan.js` (now owned by App).

---

## D-032 — Blunders are measured in win percentage, not centipawns (pulled forward from Phase 4B)
Date: 2026-09-20
Phase: 4
Decided by: agent
Needs review: yes

What: The spec's Feature 1 says "flag a move when the eval swings against the player by 150
centipawns or more." Implemented exactly that first, and the output was mostly junk: of 8 findings
across 4 real games, 7 were moves where the player was already winning by 3-6 pawns and was STILL
winning afterwards (+5.2 → +3.6, +5.8 → +3.3). Those aren't mistakes in any sense a player cares
about. Switched the threshold to win-percentage lost (new `lib/winPercent.js`, Lichess's conversion
formula) at **15 percentage points**. Same 4 games now produce 5 findings, all real.
Why: the build doc already says this itself, just later on — Feature 7 (Phase 4B): "classify on win
percentage, not centipawns. Losing 300cp while already a queen up means nothing... Lichess publishes
the conversion formula and it is a single line of maths." Since Phase 5's tagging and Phase 6's
repetition queue are both built on top of whatever Phase 4 flags, shipping a noisy definition of
"blunder" now would poison both. Better to use the doc's own better idea early than to build two
phases on a definition the doc itself rejects.
Why 15 and not the doc's "Blunder = over 20" from Feature 7's label table: 15 points is what 150cp
actually works out to near equality, so it preserves the original spec's sensitivity in close
positions (the only place mistakes decide games) while dropping the same swing in a decided one. At
20 points, genuine equal-to-losing mistakes got filtered out too.
Alternatives considered: keep raw centipawns as specced (rejected — demonstrably noisy, evidence
above); use 20 points to match Feature 7's "Blunder" band exactly (rejected — filtered out real
mistakes like an equal position turning clearly lost).
Affects: `lib/winPercent.js` (new), `lib/blunderScan.js`, `pages/BlundersPage.jsx`. `winPercent.js`
is deliberately standalone because Phase 4B's game-review labels need the exact same conversion.

---

## D-031 — Blunder scan thresholds and depth
Date: 2026-09-20
Phase: 4
Decided by: agent
Needs review: yes

What: The remaining numbers in `lib/blunderScan.js`, all taken from the build doc's Feature 1 spec:
- `DECIDED_POSITION_CP = 600` — skip positions already worse than -600 or better than +600, since
  an eval swing there says nothing about judgement. (Doc's own number.)
- `BOOK_MOVES_SKIPPED = 8` — ignore the first 8 full moves. Doc says "first 6-8 moves"; picked the
  top of that range.
- `SCAN_DEPTH = 12` — doc's "Bulk scan" mode is depth 12-14; picked 12 for speed, since this is the
  fast pass that feeds the DNA, not the deep per-game review (that's Phase 4B at depth 18).
Measured against real games at these settings: 3.4 seconds per game, so 50 games ≈ 165 seconds —
inside the doc's "50 games analyse in under 3 minutes" bar, with a little room to spare.
Why: all three trace directly to the spec; the depth choice is the one real judgement call, and
it's validated by hitting the doc's own speed target.
Alternatives considered: depth 14 (slower, would have blown the 3-minute budget at ~50 games).
Affects: `frontend/src/lib/blunderScan.js`.

---

## D-030 — Stockfish build: lite single-threaded WASM
Date: 2026-09-20
Phase: 4
Decided by: agent

What: Using the `stockfish` npm package's **lite single-threaded** build
(`stockfish-19-lite-single`, 1.8MB), copied out of `node_modules` into `public/stockfish/` by a
postinstall script (`frontend/scripts/copy-stockfish.js`) and gitignored. It runs inside a Web
Worker, never on the main thread.
Why: the package ships five builds. The full ones are ~99MB — completely unusable as a browser
download. Single-threaded avoids needing COOP/COEP cross-origin headers, exactly as the build doc's
tech-stack notes call for. The package's own README recommends this same build for this same
reason. Copying to `public/` rather than importing it is necessary because the engine's JS loads its
`.wasm` sibling by URL at runtime, so both files must sit together at a real served path.
Verified: boots in ~315ms; evaluates a position at depth 12 in 13-80ms; correctly reports a
queen-up position as ±1000cp; and — the part most likely to be silently wrong — correctly flips
scores to a single fixed perspective, since UCI reports them from whoever is to move.
Alternatives considered: full single-threaded build (99MB, rejected); lite multi-threaded (needs
COOP/COEP headers the doc explicitly says to avoid); asm.js (3MB and far slower, last-resort only).
Affects: `frontend/scripts/copy-stockfish.js`, `frontend/src/lib/engine.js`, `.gitignore`,
`frontend/package.json` (postinstall).

---

## D-029 — Dedicated onboarding screen, guest mode kept as an explicit choice
Date: 2026-09-20
Phase: 3
Decided by: user

What: A new first-screen (`OnboardingPage.jsx`) now gates the app before either a sign-in or a
guest username exists. Three shapes, all driven by one `showOnboarding` check in `App.jsx`
(`checkedSession && !onboardingDismissed && !user?.chessComUsername`):
1. Not signed in at all → "Sign in with Google" or type a username and "Continue as guest."
2. Signed in but no saved username yet (fresh account, or a new device) → just asks for the
   username, personalized with their name — Google already told us who they are.
3. Signed in with a saved username → onboarding never shows; skips straight to the existing
   auto-fetch behaviour from D-028's session-restore work.
The header's own "Sign in with Google" button still exists separately, for a guest who's past
onboarding and decides to sign in later — that upgrade path (and its guest-to-account username
migration) is unchanged from Phase 3's first pass.
Why: user wanted a proper first-time screen instead of a small header button, while explicitly
keeping guest mode available (confirmed directly rather than assumed) rather than requiring
sign-in.
Alternatives considered: requiring sign-in with no guest mode — user explicitly chose to keep guest
mode.
Affects: new `pages/OnboardingPage.jsx`/`.css`, `App.jsx` (onboarding-gating logic, split the
Google-credential handler into an onboarding version that also carries along a typed username, and
a header version), `hooks/useAuth.js` (added `updateChessComUsername` for local state sync after
saving).

---

## D-028 — Session design: httpOnly JWT cookie, 30 days, SameSite=Lax
Date: 2026-09-20
Phase: 3
Decided by: agent
Needs review: yes

What: After Google verifies who someone is (`google-auth-library`'s `verifyIdToken`, checked against
our own `GOOGLE_CLIENT_ID` as the audience — this is the actual security boundary), `/server` issues
its own JWT (just `{userId}`, signed with `JWT_SECRET`) in an httpOnly cookie named `session`,
30-day expiry, `SameSite=Lax`, `secure` only when `NODE_ENV=production` (browsers reject `secure`
cookies over plain http, which local dev is). The `users` collection is keyed by `googleSub` (the
stable Google account id), storing `email`, `name`, `chessComUsername` (null until saved),
`createdAt`, `lastLoginAt`. `/api/me` never returns the raw Mongo document — only
`{email, name, chessComUsername}` — so nothing beyond that reaches the browser.
Why: matches the build doc's own stated design ("Signed JWT in an httpOnly cookie — no session
store, nothing extra to run"). 30 days chosen as a reasonable "don't make people re-login constantly"
default; not user-specified, flagged for review.
Alternatives considered: a server-side session store (Redis/Mongo-backed sessions) — rejected, the
doc explicitly says no session store is needed for this design.
Affects: `server/auth.js`, `server/jwt.js`, `server/index.js`.

---

## D-027 — Backend switched from Vercel serverless functions to a standalone Express server
Date: 2026-09-20
Phase: 3
Decided by: user

What: The build doc's locked tech stack specified "3-4 serverless functions in an /api folder"
deployed on Vercel. User instead wants a real, independently-hostable Express server (not tied to
Vercel's function model), so it can be deployed wherever, not just Vercel. This is a deliberate
override of a stack choice the doc calls "locked" — flagging it explicitly since the doc says any
such swap needs a decision.md entry and a heads-up, not a silent change.
Why: user wants the freedom to host the backend independently of Vercel later.
Alternatives considered: staying with Vercel functions (the doc's original plan) — user chose
Express instead, deliberately.
Affects: new `/server` directory (Express app, its own `package.json`, separate from `/frontend`)
replaces the planned `/api` Vercel-functions folder. `/api/README.md`'s "untouched until Phase 3"
placeholder is now stale — `/api` is not used at all going forward. `vercel.json` (never created)
is no longer needed unless the frontend alone ever deploys to Vercel later.

---

## D-026 — Fix: games list caused horizontal page overflow on mobile
Date: 2026-09-20
Phase: 1 (bug found while re-testing after D-025)
Decided by: agent

What: `.list-main` (the column holding the toolbar and table on the games list page) had no width
constraint of its own on mobile — in a column-direction flex container, `flex: 1` doesn't stop an
item from growing to fit wide content, so it grew to match the table's natural width (431px) inside
a 343px-wide parent, dragging the whole page 74px wider than the viewport. The table's own
`overflow-x: auto` never engaged because its container was never actually constrained enough to
overflow against. Added `width: 100%; min-width: 0;` to `.list-main` inside the existing 720px
breakpoint. Confirmed via a real headless-browser check: `document.documentElement.scrollWidth -
clientWidth` was 74px before the fix, 0 after.
Why: this regressed when the "You" column was added (D-022) without re-running the mobile overflow
check from D-017 — found now while re-verifying the page after the palette change (unrelated to the
palette itself). `GameViewerPage.css`'s equivalent `.moves-panel` already had this fix from D-017 and
was unaffected.
Alternatives considered: none — a straightforward layout defect.
Affects: `frontend/src/pages/GamesListPage.css`.

---

## D-025 — Warm espresso background palette; Inter for body text
Date: 2026-09-20
Phase: 2
Decided by: user

What: Replaced the neutral blue-black slate background (`#14171b` family) with a warm espresso/wood
tone (`#1b140f` family) across every surface token, and swapped the body/numbers font from the
system-ui stack to Inter (loaded free from Google Fonts, same source as the existing Fraunces
heading font). Fraunces stays for headings — only the body typeface changed.
Why: user wanted a different background colour and font family. Chose warm over cool because the
board's own wood-toned squares now read as part of one palette instead of clashing with a
blue-black background; kept the heading/body split since the doc's "give headings real character,
keep body plain" rule still holds — only which plain font changed.
Alternatives considered: cooler dark (navy/charcoal), lighter charcoal grey, single font family for
everything, different heading font — user picked warm background + Inter body specifically.
Affects: `frontend/src/index.css` (all colour tokens, `--font-body`), `frontend/index.html` (font
link), `frontend/src/App.css` (header glass background rgba, kept in sync with the new bg colour).

---

## D-024 — Deep-link animation refined: animate only the highlighted move itself
Date: 2026-09-20
Phase: 2
Decided by: user

What: Superseding part of D-023. The first fix animated the whole jump from the start of the game to
the target position (correct for small jumps, but a confusing multi-piece jump for a target deep
into the game). User clarified they wanted only the specific highlighted move to animate. Now
`GameViewerPage` mounts silently one ply *before* the target (no animation needed for "arriving"),
then steps forward exactly once — always a clean single-move animation (or two pieces for a
castle/en-passant/promotion), landing with the actual finding's move highlighted as active.
`ClockPage` now passes the target move's own `plyIndex` (not `plyIndex - 1`) since `GameViewerPage`
handles stepping back internally. Confirmed via Playwright: exactly one piece animates, and the
final highlighted move matches the finding.
Why: user wanted to see the specific move play out, not a jump across the whole game.
Alternatives considered: none — direct clarification of the previous fix's scope.
Affects: `GameViewerPage.jsx`, `ClockPage.jsx`.

---

## D-023 — Deep-linked moves now animate; black colour-dot contrast fixed
Date: 2026-09-20
Phase: 2
Decided by: user

What: Two fixes:
1. Opening the viewer via a finding's "see that position" link previously landed directly on the
   target move with no animation — react-chessboard only animates a piece sliding when its
   `position` prop *changes*, not on first mount, so jumping straight there on mount just showed it
   frozen in place. `GameViewerPage` now always mounts at the start of the game, then moves to the
   target position ~50ms later via a `useEffect`, turning it into a real, visible slide. Confirmed
   via Playwright that a `transition: transform` style now appears on the moved piece.
2. The black colour-dot (used in the games list "You" column and the viewer's meta line) was nearly
   invisible — a near-black fill with a border colour almost identical to the page's own near-black
   background. Its border now uses the muted-text colour instead, giving it a visible ring.
Why: user reported the deep-link animation "must work" and that colour distinction needed to be
better — both were real, confirmed defects, not just preference.
Alternatives considered: none — both are straightforward fixes once diagnosed.
Affects: `frontend/src/pages/GameViewerPage.jsx`, `frontend/src/index.css`.

---

## D-022 — Show which colour the player had, in the list and the viewer
Date: 2026-09-20
Phase: 1/2 (games list + viewer, retroactive addition)
Decided by: user

What: A small coloured dot (white/black, plain CSS circle, no emoji) plus "you played white/black"
text now appears in the game viewer's meta line, and the same dot appears as a "You" column in the
games list table. Shared `.color-dot` styling lives in `index.css` since both pages use it.
Why: user pointed out there was no way to tell which side you played without opening the game and
reading the board orientation — a real gap, since the tilt/clock findings all talk about "you"
without ever showing which pieces were yours in the underlying games.
Alternatives considered: none — straightforward gap once named.
Affects: `frontend/src/index.css`, `GameViewerPage.jsx`/`.css`, `GamesListPage.jsx`.

---

## D-021 — Evidence links jump to the exact position; move list shows time per move
Date: 2026-09-20
Phase: 2
Decided by: user

What: Two fixes to the clock fingerprint's evidence:
1. `GameViewerPage` now accepts an `initialMoveIndex` prop. Clicking "see that position" from the
   Clock page's "longest think" or "known position" findings opens the viewer already sitting on the
   position right before that move, instead of always starting at move 0 and making the user click
   forward to find it. `App.jsx` now tracks `{game, moveIndex}` together instead of just `game`.
2. The move list in `GameViewerPage` now shows each move's thinking time next to it (e.g. "c5
   9.7s"), using `clockData.js`'s per-ply output lined up by array index with `pgnToMoves.js`'s
   output.
Also fixed a real bug this surfaced: the "known position, wasted time" finding was almost always
just the universal starting position (ply 0), since literally every game shares it regardless of
what the player does — trivial and uninteresting. `clockData.js` now returns one entry per ply
always (with `timeSpentSeconds: null` instead of being dropped, so it stays index-aligned with
`pgnToMoves.js`), and `clockFingerprint.js` excludes ply 0 from the "known position" candidate pool.
Why: user pointed out that opening a whole game to find one specific position defeats the point of
the finding, and that seeing time only as a sentence is less useful than seeing it move-by-move.
Alternatives considered: none — both were straightforward defects once named.
Affects: `lib/clockData.js`, `lib/clockFingerprint.js`, `GameViewerPage.jsx`/`.css`, `ClockPage.jsx`,
`App.jsx`.

---

## D-020 — Clock fingerprint scoped down; engine-dependent parts deferred to Phase 4
Date: 2026-09-19
Phase: 2
Decided by: user

What: Feature 3 ships now with: opening time share (% of total time in moves 1-12), the single
longest think found (with its game/move), a count of games lost on time, and a "repeated position,
wasted time" finding (a position reached 20+ times where an unusually long think still happened —
the worst such example, not a fixed threshold). Deferred to Phase 4: whether a long think's move was
actually good, the share of blunders happening under 60 seconds, and whether a time-loss happened
from a winning/equal position — all three need an engine eval that doesn't exist yet. The spec's
material-based middlegame/endgame zone split is also skipped for now — nothing buildable today
consumes it (only the deferred blunder/scramble-zone metric does); it'll be added once something
actually needs it, per the "no fake work" rule against building unused plumbing ahead of time.
Why: same reasoning as D-013 — ship the real, verifiable numbers now rather than a placeholder for
the eval-dependent ones.
Alternatives considered: wait until Phase 4 to build any of Feature 3 — user preferred shipping the
buildable half now.
Affects: new `lib/clockData.js`, new `lib/clockFingerprint.js`, new `pages/ClockPage.jsx`.

---

## D-019 — Time-class filter moved from the list page to the shared hook (applies everywhere)
Date: 2026-09-19
Phase: 2
Decided by: user

What: Superseding D-018's "display-only" note. `timeClassFilter` now lives in `useFetchedGames.js`,
not in `GamesListPage`. The hook exposes `filteredGames` (already narrowed to the active tab) and
`timeClassTabs`; every page that consumes the hook — the games list, the Tilt page, and any future
feature page — receives `filteredGames`, not the raw list. The tab UI itself was extracted to a
shared `components/TimeClassTabs.jsx`, rendered once in `App.jsx` above whichever page is active
(hidden while viewing a single game, since one game only has one time class).
Why: user pointed out that many players perform very differently by format (strong at rapid, weak
at bullet, etc.), so blending all formats into one tilt/blunder/clock analysis would wash out real
patterns. The split needs to apply to every feature going forward, not just be a table-display
convenience.
Alternatives considered: keep the filter local to each page and pass it explicitly between them —
rejected, that would mean re-deriving or duplicating the same filter state per page as more features
get added; a single shared source is simpler and guarantees every page stays in sync.
Affects: `hooks/useFetchedGames.js`, new `lib/timeClass.js`, new `components/TimeClassTabs.jsx/.css`,
`App.jsx`, `GamesListPage.jsx` (now just renders whatever `games` it's given), `TiltPage.jsx`
(analyses `filteredGames` instead of all games). Every later feature (clock, blind spots, opening
fit) should read `filteredGames` from the same hook rather than inventing its own filtering.

---

## D-018 — Games list: time-class tabs, and a contained scrolling table (superseded by D-019)
Date: 2026-09-19
Phase: 1 (games list, retroactive addition)
Decided by: user

What: Two changes to `GamesListPage`, neither in the original build doc:
1. Tabs above the table split games by time class (Bullet/Blitz/Rapid/Daily, plus "All"), each
   showing a count, computed from whatever time classes are actually present in the fetched games.
2. The table itself is now a fixed-height (480px) scrolling box with a sticky header, instead of an
   unbounded list that stretched the whole page taller the more games were fetched.
Why: user found the long unbounded table made the whole page scroll awkwardly, and wanted games
split by format since a player's tilt/blunder patterns can differ a lot between bullet and rapid.
This isn't in the build doc's Feature list — user explicitly said to build it anyway.
Alternatives considered: none discussed — straightforward UX fix plus an explicitly requested
feature.
Affects: the tab-filtering part of this entry is superseded by D-019 (moved from page-local to
shared); the contained-scrolling-table part still stands as-is.

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
