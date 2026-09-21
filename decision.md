# decision.md — why things are the way they are

Newest entry at top. One entry per decision, never edited later; if a decision is reversed, a new
entry is added that says so and links back. Every magic number in the code must trace to an entry
here.

---

## D-050 — On a phone, the header wraps into two rows
Date: 2026-09-21
Phase: 5 (found while checking the Blunders page on mobile)
Decided by: assistant

What: the header was one row that was never allowed to wrap. On the Blunders page at 390px, the nav
buttons plus the fixed-width Google sign-in button pushed the sign-in button **112px off the right
edge** — horizontal scrolling on a phone, live on the deployed site. It predates Phase 5; the games
list happened not to trigger it because its nav labels are shorter.

Letting the right-hand group wrap as one block fixed the overflow but stacked three rows (142px of
sticky header, a sixth of a phone screen). Final version: under 480px, `.header-right` becomes
`display: contents`, so its two halves can be placed independently — the sign-in button sits beside
the app name, and the nav takes a full-width row beneath. 99px, two rows. Desktop markup and layout
are unchanged (59px, one row).

Verified: 0px overflow on all four pages (games list, tilt, clock, blunders) at both 390px and 1300px.

Affects: `App.css`.

---

## D-049 — The engine forgets everything between games, so results don't depend on order
Date: 2026-09-21
Phase: 5
Decided by: assistant

What: found because Phase 5 started counting. The Blunders page reported **120** mistakes for
50 games; a direct scan of the same 50 found **112**. The difference was order: the page scans newest
first, the script scanned oldest first. Measured directly — same games, both orders, no other change:
112 vs 120, with **30 moments flagged in only one of the two orders.**

Cause: Stockfish keeps a table of positions it has already searched (the "hash") and reuses it. The
engine was never told a new game had started, so that table carried over from game to game — and a
fixed-depth search can land on a slightly different number depending on what's in it. Moves near the
15-point threshold tipped one way or the other depending on which games came before them. In effect,
whether a move counted as a blunder depended partly on *other* games.

That was tolerable as a list of blunders to look at. It is not tolerable for anything that counts
them: "3x your rating peers" has to be the same number every time for the same games, or it isn't a
measurement.

Fix: `Engine.newGame()` sends UCI's `ucinewgame` (and waits for `readyok`) through the same queue as
every search, and the blunder scan calls it before each game. Each game is now analysed as though it
were the first. The single-game review didn't need it — it already starts a fresh engine per game.

Verified by rerunning the experiment: **115 and 115, zero moments differing between orders**, tag
counts identical. Cost, measured head-to-head on the same games in the same order, alternating runs:
78.3s / 79.1s with memory kept vs 78.8s / 79.6s cleared — about half a second per 50 games.

Worth recording how that timing was nearly got wrong: the first comparison showed no difference in
the counts either, because the test switch patched a different copy of the engine module than the one
the scan was using (Vite's dev server serves an edited file under a new `?t=` address). Caught
because the "old" arm gave 115 instead of the 112 the old code had produced three times. Redone
against the right module: the old arm reproduced 112 exactly.

Affects: `lib/engine.js`, `lib/blunderScan.js`.

---

## D-048 — The first two blind-spot tags: hanging piece and back rank
Date: 2026-09-21
Phase: 5
Decided by: assistant, following the build doc ("do the tags one at a time, starting with hanging
piece and back rank")

What: `lib/mistakeTags.js` — the Feature 1 tag list, as plain chess.js logic, starting with the two
the doc names. Each blunder the scan finds now carries `tags`: zero or more of
`{ tag, squares, detail }`. `squares` is there for the evidence rule ("highlighted square — the piece
that hung, the mating square, whatever the tag points at"). Shown on the Blunders page as a
**Pattern** column, separate from the existing "Why" column: "Why" is the sentence you read, a pattern
is what gets counted across games.

To check the rules against a *sequence* of moves ("the engine's best line wins it"), the engine now
returns its whole principal variation (`pv`), not just the first move. Additive — `move` and
`bestMove` are unchanged. The scan stores it as `refutationLine`.

**Hanging piece** — doc: "after the played move, a piece of the player is attacked and undefended,
and the engine's best line wins it." Readings taken:
- "piece" = knight or better. A loose pawn is rarely why a move was a mistake (same line
  `explainBlunder.js` already draws).
- "undefended" = zero defenders. A defended queen attacked by a pawn is lost too, but that's a
  different mistake, closer to "trade blunder"; folding it in would blur this tag.
- "wins it" = captured within the opponent's first three moves (5 plies — the doc puts lines longer
  than the immediate refutation out of scope), and not simply traded back on the next move. The piece
  is tracked if the player moves it before it's taken.

**Back rank** — doc: "best line delivers mate or wins material on the player's first rank while their
king has no pawn escape."
- "No pawn escape" = king on its back rank, and every square directly in front of it is blocked by its
  own pieces or covered by the opponent.
- Mate branch: the engine's line ends in checkmate, delivered on the back rank.
- Material branch: early in the line an enemy **rook or queen** lands on the back rank **with check,
  while the king is still on it**, and by the end of the line the opponent is up at least 2 points.

The material branch was first written as "any check **or capture** landing on the back rank". Real
games showed that was wrong: early on, nearly every king counts as "trapped" behind its own pieces,
so a bishop capturing a queen on d8 (because a knight had moved off the diagonal) was tagged "back
rank" when the king had nothing to do with it. Tightened to a rook or queen, giving check, along the
rank. That exact position is now a regression test.

**Validation:** 13 tests (`npm test` in `/frontend`, Node's built-in runner, no dependency),
including a "must NOT fire" case for every rule — a tag that fires on everything tells the user
nothing. Then run over 50 real games (the user's own, rated 203-624): 112 mistakes, 29 hanging-piece,
3 back-rank before the fix, 2 after. After the fix, **exactly one moment's tags changed** — the false
positive — and nothing else. Each remaining back-rank hit was checked by hand on the board, including
a queenside one (Qb8#, king on c8 walled in by its own c7 pawn and d7 bishop). The 36 "loses
material" moments with no tag were checked too: pawns (excluded by design), even trades that went
wrong later, and a knight check that then picks up a bishop — work for the trade-blunder and fork tags
still to come, not misses.

**Also fixed, in `explainBlunder.js` (Phase 4):** its "hangs a piece" sentence said "leaves your rook
on h8 **undefended**" for pieces that were in fact defended but attacked by something cheaper — a
false specific claim, which that file's own header says never to make. It now says "attacked by a
bishop, which is worth less than it" in that case, and "undefended" only when there are no defenders.
Found because the new tag (strict: zero defenders) disagreed with the old sentence on exactly those
two positions.

Affects: `lib/mistakeTags.js` (new), `tests/mistakeTags.test.mjs` (new), `lib/engine.js`,
`lib/blunderScan.js`, `lib/explainBlunder.js`, `pages/BlundersPage.jsx` + `.css`, `package.json`
(`npm test`).

---

## D-047 — Keep the backend awake with an uptime monitor, rather than changing the code
Date: 2026-09-21
Phase: 0 (deploy)
Decided by: user, choosing between a code fix and this

The problem: `App.jsx` renders **nothing** until the session check (`/api/me`) answers — deliberately,
so a returning signed-in user doesn't see the onboarding screen flash before their games replace it.
But Render's free tier puts the backend to sleep after 15 minutes without traffic, and waking it takes
up to ~50 seconds. So a first visitor after a quiet spell would stare at a blank page for that long.
Found by rehearsing the production build, not by reasoning — and it contradicted an earlier claim in
D-045 that only sign-in would ever feel the backend sleeping. That claim was wrong: the *first paint*
waits on the backend too.

What: an external uptime monitor requests `https://chessdna.onrender.com/api/health` every 5
minutes, so the backend never goes idle long enough to sleep. That endpoint was chosen because it
touches nothing — no database, no auth — so thousands of pings a month cost nothing downstream and
never reach Atlas. It's pinged directly on Render rather than through the Vercel rewrite, so the pings
don't count against Vercel's usage either. The monitor also emails when the backend is genuinely down,
which nothing else in this project would have told anyone.

Why not the code fix: rendering the app immediately and letting the session check finish in the
background would remove the dependency entirely, but brings back the onboarding flash for returning
users. The user chose to keep the code as it is.

**Known limits, so they aren't a surprise later:**
- The blank-page behaviour is still in the code. It's only hidden while the monitor keeps pinging. If
  the monitor stops, is paused, or misses, cold visits go blank again.
- Render's free tier allows 750 instance-hours a month per workspace. One service awake around the
  clock uses ~744 of those. A **second** always-awake free service would run out partway through the
  month.
- Moving to a paid Render instance (which doesn't sleep) makes the monitor unnecessary for this
  purpose, though it's still worth keeping for the down-alerts.

Affects: nothing in the repo. It's an external service configured by hand.

---

## D-046 — The server's start script no longer requires a .env file
Date: 2026-09-21
Phase: 0 (deploy)
Decided by: assistant, found while writing up the Render steps

What: `npm start` was `node --env-file=../.env index.js`. On Render there is no `.env` file —
variables come from the dashboard — and Node's `--env-file` **refuses to start** when the file is
missing (`../.env: not found`, exit code 9). The build would have succeeded and every start would
have died, with a log line easy to misread as a config problem rather than a flag problem.

Now `start` uses `--env-file-if-exists`, which loads the file when it's there (local `npm start`
still works) and carries on without it when it isn't. `package.json` gains
`"engines": { "node": ">=22.9.0" }`, the release that introduced that flag; Render reads `engines`
to choose which Node to install, so this also stops a host defaulting to an older Node that would
reject the flag outright.

`dev` deliberately keeps the strict `--env-file`: on a developer's machine a missing `.env` is a
mistake, and it should fail loudly rather than start half-configured.

Verified by a full rehearsal rather than by reasoning: copied `/server` to a directory with no
`.env` anywhere above it, supplied the variables as real environment variables the way a dashboard
does, set `PORT=3997` and `NODE_ENV=production`, ran `npm start`. It logged
`../.env not found. Continuing without it.`, listened on 3997, and answered `/api/health` (200) and
`/api/me` (401, correctly).

Affects: `server/package.json`.

---

## D-045 — Deployment: two hosts, one domain
Date: 2026-09-21
Phase: 0 (the deploy step D-005 paused)
Decided by: user, choosing between three shapes laid out in conversation

What: Frontend on **Vercel**, backend on **Render**, and a rewrite rule in `frontend/vercel.json` so
that `yoursite/api/*` is quietly forwarded to the backend. The browser only ever talks to one
origin.

Why this shape: the session cookie is `SameSite=Lax` (`server/auth.js`). On localhost the frontend
and backend count as the same site; on two separate public domains they don't, and a `Lax` cookie is
deliberately not sent on cross-site requests — sign-in would appear to succeed and then silently not
stick. The rejected alternatives: switching the cookie to `SameSite=None` (works today, but relies on
third-party cookies, which browsers keep restricting — Safari already blocks many), or having
Express serve the built frontend itself (simplest, but on a free tier the *whole app* would sleep,
so a cold visit stares at a blank page for ~50 seconds). With the rewrite, the auth code needs no
changes at all, CORS stops mattering, and the static app stays on a CDN — only sign-in ever touches
the sleep-prone backend. Everything else, analysis included, runs in the browser.

Three code changes were needed, each a bug that would have surfaced only in production:

1. **The server now reads `PORT` first** (`server/index.js`). It read only `SERVER_PORT`, but Render
   (and Railway, Fly, Heroku) inject `PORT`, then health-check the port *they* chose. The server
   would have bound 3001 and logged "listening" while the host marked the deploy dead. Verified by
   booting with `PORT=3999` and hitting `/api/health` there.
2. **`VITE_API_BASE_URL` of `/` now means "this same site"** (`frontend/src/lib/backendApi.js`). It
   used `||`, under which an empty value counts as missing and quietly falls back to
   `http://localhost:3001` — the live site would have tried to call the developer's laptop. Now `??`
   (only a truly unset value means localhost), and trailing slashes are trimmed so `/` becomes the
   empty prefix. `/` rather than an empty string because some hosts refuse to save an environment
   variable with no value. All five cases checked: `/`, `""`, unset, the local URL, and the local
   URL with a stray slash.
3. **`frontend/vercel.json`** declares the install and build commands explicitly rather than relying
   on detection, because `npm install` is load-bearing here: the Stockfish engine is gitignored and
   only exists after the `postinstall` script copies it out of `node_modules`. If analysis silently
   does nothing on the live site, that's the first thing to check.

**A deliberate exception to "no hardcoding":** the backend's URL is written directly into
`vercel.json`'s rewrite. Vercel does not substitute environment variables inside rewrite
destinations, so there is no way to make it an env var. It isn't a secret — it's a public URL that
every visitor's browser effectively reaches anyway — and this is the one place it lives.

`.env.example` now documents what every variable becomes in production, including two that exist
only there: `NODE_ENV=production` (which is what turns on the cookie's `Secure` flag — without it,
browsers reject the cookie over HTTPS and sign-in silently doesn't stick) and a freshly generated
`JWT_SECRET` rather than the local one.

Before deploying, the MongoDB password must be rotated: it was pasted in plain text into a chat
early in the project. Checked the repo, which is public: the password appears **nowhere** in git
history, across every commit, so there is nothing to scrub there — rotation is about the chat, not
the repo.

Affects: `server/index.js`, `frontend/src/lib/backendApi.js`, `frontend/vercel.json` (new),
`.env.example`. Supersedes the "deploy to Vercel serverless functions" assumption in D-005 (see
D-027 for why the backend became Express).

---

## D-044 — The move's verdict is drawn on the board, on the square it landed on
Date: 2026-09-21
Phase: 4B
Decided by: user

What: Three things the board now shows about the move you're looking at:

1. **A coloured medal on the destination square** (`components/MoveBadge.jsx`) — a red `??` on a
   blunder, a green star on a best move, and so on. It hangs off the square's top-right corner so
   it never covers the piece it's judging. You're already looking at the piece; the verdict should
   find you there rather than making you hunt for it in a list.

   It's **drawn as SVG, not as a text glyph in a coloured circle**. The glyph version was built
   first and the user's verdict was that it looked cheap. Two reasons, both worth remembering: the
   marks were whatever the page font supplied — a star and a book character borrowed from different
   typefaces, landing at different weights and heights — and a flat disc has no depth. Now every
   mark is a drawn path at a weight we choose, on a disc with a gradient lit from above and a
   hairline inner bevel.

   The first pass at "depth" also went wrong in an instructive way: a hard ring in the page's dark
   background colour was drawn around each medal, which made them read as stickers pasted onto the
   board. Removed. A soft drop shadow alone lifts the medal off the board without drawing a line
   around it.
2. **Both of the move's squares lit**, so where the piece came from is obvious.
3. **A green arrow showing what you should have played instead**, drawn only when there was
   something better — nothing to suggest after a best, great, brilliant or theory move.

None of it applies while you're exploring a line of your own, which isn't part of the game.

Two implementation notes worth knowing:

- The medals are sized in `cqw` against `.board-panel`, which is declared a size container. 1cqw is
  1% of the board's width, so a medal stays the same fraction of a square at any board size with no
  breakpoints. Measured at 22px on desktop and 19px on a phone.
- `react-chessboard`'s `squareRenderer` **replaces** the board's own inner square element, and with
  it the board's handling of `squareStyles` — the library only applies those when no renderer is
  supplied. So the highlight styles are applied by our renderer directly. Verified afterwards that
  dragging to explore a line still works with the custom renderer in place, since that was the
  obvious thing to break.

Cache format bumped again (`-v2` -> `-v3`): reviewed moves now carry their from/to squares and the
best move in raw UCI, which a v2 record simply doesn't have.

Affects: `components/MoveBadge.jsx` + `.css` (new), `lib/pgnToMoves.js` (now carries `from`/`to`),
`lib/reviewGame.js`, `lib/reviewCache.js`, `pages/GameViewerPage.jsx` + `.css`.

---

## D-043 — The game-review scorecard, and why every cached review was thrown away
Date: 2026-09-21
Phase: 4B
Decided by: user

What: `components/ReviewSummary.jsx` — the review sidebar in the shape people already know how to
read: both players side by side, their accuracy, a count of every label each of them played, and
the per-game strength estimate. Your column is always on the left, because this screen is about
you. Label rows are ordered best-to-worst straight from `LABELS`'s own key order, so adding a label
to that map puts it in the right row automatically.

The counts fill in live as the review runs, since they're just a tally of what's known. Accuracy
and the rating estimate stay blank (`—`) until the review is finished, for the same reason the
inline line already did: a half-game average is misleading, not merely incomplete.

The panel replaces the old inline rating line, which said "≈2236 level this game"; the number now
lives in the scorecard's "Game rating" row with the same hover caveat attached.

Because D-039, D-040 and D-041 all change what a review *says* about the same game, the cache
format stamp went from `d14-mpv2-v1` to `-v2`. Every review saved under the old rules is discarded
and re-analysed rather than being mixed in with numbers that now mean something different. This is
exactly the situation the stamp was built for in D-038.

Affects: `components/ReviewSummary.jsx` + `.css` (new), `lib/reviewCache.js`,
`pages/GameViewerPage.jsx`.

---

## D-042 — Both clocks sit beside the board, one player per side
Date: 2026-09-21
Phase: 4B
Decided by: user

What: The game viewer now puts a player strip above the board and another below it — name, rating,
a colour dot, and that player's clock at whatever move you're looking at. Opponent on top, you
underneath, exactly the arrangement of a real board and of every chess site. Both strips flip with
the board, so the side facing you is always at the bottom.

How the clock number is worked out: a player's clock at ply N is whatever it read after their most
recent move, so the code walks back from N to the last ply that player made. Before either side has
moved, both show the starting time from the PGN's `TimeControl` header. `lib/clockData.js` already
parsed every `[%clk ...]` comment to compute time *spent*; it now also passes through the raw time
*remaining*, which is the same data read the other way.

Whoever is to move gets the lit clock (inverted colours), as on a real board, read straight off the
side-to-move field of the current FEN. Under ten seconds the clock switches to tenths and turns
red, because that is exactly when tenths start to matter.

Affects: `components/PlayerStrip.jsx` + `.css` (new), `lib/clockData.js`, `lib/normalizeGame.js`
(now carries `userName`, `userRating`, `opponentRating`), `pages/GameViewerPage.jsx` + `.css`.

---

## D-041 — A small hand-written opening book, which under-fires on purpose
Date: 2026-09-21
Phase: 4B
Decided by: assistant, to serve the user's "match Chess.com" request

What: `lib/openingBook.js` holds 79 mainstream opening lines in SAN. A move is labelled **Book**
while the whole game so far is still a prefix of at least one of them. Book moves are labelled
before anything else is considered, and are excluded from accuracy in both directions — playing ten
memorised moves shouldn't pad your score, and neither should theory be credited to you.

Why hand-written: Chess.com decides this from a database of millions of master games. We can't ship
that. The consequence is deliberate and one-directional — **this book under-fires**. A genuine
theory move that isn't in the list gets labelled Best or Excellent instead of Book, which is merely
less informative. It never claims a move is theory when it isn't. Measured on a real game, we
labelled 1 book move per side where Chess.com labelled 2.

Every line was machine-checked for legality with chess.js (79 lines, 0 illegal) rather than trusted
as typed.

Affects: `lib/openingBook.js` (new), `lib/moveLabels.js`, `lib/reviewGame.js`.

---

## D-040 — Accuracy uses the Lichess curve blended with a harmonic mean
Date: 2026-09-21
Phase: 4B
Decided by: user ("chess.com k game review zyada strict h... match kro")

What: Accuracy was `100 - averageLoss * 2.5`, a straight line. It was far too generous — it handed
out 95% for games Chess.com scores in the 70s and 80s. Replaced with two changes:

1. **Per-move accuracy** now uses Lichess's published curve,
   `103.1668 * exp(-0.04354 * winPercentLost) - 3.1669`. It is steep near the top (a five-point
   slip already costs real accuracy) and flat at the bottom (a catastrophe is a catastrophe;
   twice as bad barely registers). This matches how the labels already think.
2. **The game figure blends the arithmetic and harmonic means** of those per-move numbers. The
   plain average alone lets forty quiet moves drown out the two that decided the game; the harmonic
   mean is dragged down hard by the worst moves. Per-move values are floored at 1 so a single total
   collapse can't send the harmonic mean to zero and take the game with it.

Reported to one decimal place, like every other review screen — 75.6 reads as a measurement, 76
reads as a grade.

Also recalibrated the per-game rating estimate from D-037. It was `(accuracy - 52) * 52`, tuned
against the old inflated accuracies. Refitted against a real Chess.com review (75.6% -> 1200,
85.0% -> 1400). A straight line through those two points was tried first and was wrong at the top:
it capped a flawless 100% game at about 1720, which nobody would believe. The relationship isn't
linear — the last few points of accuracy are enormously harder to earn than the first few — so it's
now `164 * exp(0.0263 * accuracy)`, which passes through the lower anchor and the rule of thumb
that a 95% game is roughly 2000-strength, reaching ~2280 at a perfect 100%.

**Be clear what that is:** one anchor is measured, the other is judgement, and Chess.com also
weighs how strong the opponent was, which we don't see at all. The build doc's warning from D-037
still stands. Measured after the change, a 3400-rated player's 90%-accuracy bullet game reads as
~1763, which is plainly too low for that player — the estimate under-reads badly at the top and
should be recalibrated once Phase 5's baseline data exists, or removed.

Affects: `lib/reviewGame.js`.

---

## D-039 — Great and Brilliant are much harder to earn
Date: 2026-09-21
Phase: 4B
Decided by: user ("no brill 2 great lekin tmhara review m 1 brill and many great h")

What: The user compared a real Chess.com review against ours on the same kind of game. Chess.com
gave 0 Brilliant and 2 Great; we gave 1 Brilliant and a fistful of Greats. A label that fires often
stops meaning anything, and Chess.com is the reference people compare against — they pay for it,
and we're giving this away, so it has to be at least as honest.

The old rule for "Great" was one test: the player found the engine's move and the second-best was
10+ win-percentage points worse. Three tests now have to pass at once:

1. **The gap is 15 points, not 10.**
2. **The alternative would have changed the state of the game.** A move is only "the only move" if
   the others actually lose something that matters. Going from +8 to +4 is a huge win-percentage
   gap on paper and no difference whatsoever over the board. States are win-percentage bands:
   losing below 35, winning above 65, a game in between. The second-best move has to drop you into
   a worse band than the best one.
3. **There was a real choice.** A forced recapture is not a great move.

**Brilliant** keeps all of the above and adds that you weren't already winning easily
(`evalBefore < 400cp`) on top of the existing requirement of a real, unreturned sacrifice of a
piece or more that leaves the position still playable. Sacrificing a knight when you're a rook up
isn't brilliant, it's just still winning.

Measured after the change on a real bullet game between two 3300+ players: **0 Brilliant for both
sides, 2 Great for the user** — matching the Chess.com screenshot exactly on both counts. The
opponent still got 5 Greats, which is more than Chess.com would likely award; if that stays
annoying the honest next lever is raising the gap again rather than adding special cases.

Affects: `lib/moveLabels.js`, `lib/reviewGame.js` (passes the legal-move count and book flag).

---

## D-038 — Reviews are cached, auto-started, and shown as they're computed
Date: 2026-09-20
Phase: 4B
Decided by: user

What: Three changes to how a review is experienced, all from the user reporting it as too slow and
having to re-run per game:
1. **Cached in IndexedDB** (`lib/reviewCache.js`). A finished review is saved under the game's id,
   so reopening that game shows its labels immediately instead of re-analysing. Measured: 26s the
   first time, **1.3 seconds after a full page reload**. Cached records carry a format stamp
   (`d14-mpv2-v1`); if the depth or the labelling rules ever change, old records are ignored and
   re-analysed rather than shown as if they were current. All storage access is wrapped so private
   browsing or a full quota degrades to "no cache", never to a broken page.
2. **Starts by itself** when a game is opened — no button. If it's cached, there's nothing to wait
   for anyway; if it isn't, the analysis overlaps with looking at the board instead of following a
   click.
3. **Labels appear as they're computed**, not all at the end. `reviewGame` now hands back the moves
   worked out so far with each progress tick. Accuracy is deliberately withheld until the end,
   since a half-finished average would be misleading.
Also made a real speed fix found while measuring: the live evaluation bar was running a **second**
Stockfish worker alongside the review, competing for CPU. It now stands down while a review is in
progress (unless you're exploring your own line, where the review has nothing to say). That alone
took the first review from ~44s to ~26s.
Why not just lower the depth instead: measured it. Depth 12 is 3-6x faster but agrees with depth 14
on only **59-70%** of labels, with 1-6 serious disagreements per game (one depth calls a move fine,
the other calls it a mistake). That's a real accuracy loss, so the slowness was solved by removing
repetition and dead waiting rather than by making the analysis worse.
Affects: `lib/reviewCache.js` (new), `lib/reviewGame.js`, `hooks/useGameReview.js`,
`pages/GameViewerPage.jsx`.

---

## D-037 — Estimated rating from accuracy, against the doc's advice
Date: 2026-09-20
Phase: 4B
Decided by: user
Needs review: yes

What: A review now also reports an approximate playing strength per side, derived from accuracy,
shown as "≈2236 level this game".
Why this is flagged: the build doc explicitly says **not** to do this — "Do not invent a rating
estimate from it in v1" — and its caution is well founded. Accuracy depends heavily on how sharp
the position was, the time control, and whether the opponent ever tested you; a quiet drawn game
can be 95% accurate for a beginner. It also under-reads badly at the top (a super-GM bullet game
measured 95% accuracy, which this maps to ≈2236, far below their real strength). Built anyway
because the user asked for it directly.
How the risk is managed: it is never called "your rating". It's phrased per-game ("≈X level this
game"), carries a tilde, and has a hover explanation saying it's a rough guide and not a rating.
Alternatives considered: refusing on the doc's authority (rejected — the user's explicit request
beats a default, as long as the caveats are honest and visible); calibrating against real rating
data (there isn't any yet — that's what the Phase 5 baseline work is for, and this could be revisited
then).
Affects: `lib/reviewGame.js` (`ratingFromAccuracy`), `pages/GameViewerPage.jsx`/`.css`.

---

## D-036 — Evaluation bar runs live and shallow, separate from the deep review
Date: 2026-09-20
Phase: 4B
Decided by: agent

What: The bar beside the board is fed by its own quick depth-12 evaluation of whatever position is
showing (`hooks/useLiveEval.js`), refreshed as you step through moves or play your own. It does NOT
wait for a game review. Once a review has been run, the bar prefers the review's deeper number for
positions that are part of the actual game, and falls back to the live one everywhere else
(including positions you invented while exploring).
Why: the user asked for the bar "everywhere". Making it depend on a 45-second review would mean no
bar at all until you'd waited — but a single position evaluates in well under a tenth of a second,
so live evaluation gives an instant bar with no waiting. Two sources, each used where it's better.
Also fixed a real bug this exposed: `Engine.evaluate()` had no queueing, so a second call while one
was running stole the response handler and left the first promise pending forever. Stepping quickly
through a game would have triggered exactly that. Calls are now serialised.
Affects: `hooks/useLiveEval.js` (new), `components/EvalBar.jsx`/`.css` (new), `lib/engine.js`
(queueing), `pages/GameViewerPage.jsx`.

---

## D-035 — Move-quality labels use semantic colour, breaking the one-accent rule
Date: 2026-09-20
Phase: 4B
Decided by: agent
Needs review: yes

What: The move labels (Brilliant / Great / Best / Excellent / Good / Inaccuracy / Mistake / Miss /
Blunder) each get their own colour — teal, blue, green through yellow, orange, red — rather than the
single accent colour the design direction otherwise insists on.
Why: the build doc's design rules say "exactly one accent colour for findings and warnings. Not
two." This deliberately breaks that, because the label set is a *scale from good to bad* and colour
is how that scale is read at a glance; every chess site does it this way, and the user explicitly
asked for the Chess.com-style tags. The rule's real target is decorative colour and gradients, not
functional encoding of meaning. Glyphs (!!, ★, ?!, ??) carry the same information, so the meaning
survives for anyone who can't distinguish the colours.
Alternatives considered: accent-only with glyphs doing all the work (rejected — a blunder and a
brilliancy would look identical at a glance, which defeats the point).
Affects: `lib/moveLabels.js`, `pages/GameViewerPage.css`.

---

## D-034 — Game review (Phase 4B): depth 14 / MultiPV 2, and no "Book" label
Date: 2026-09-20
Phase: 4B
Decided by: agent
Needs review: yes

What: `lib/reviewGame.js` runs the doc's "deep review" mode over a single game — every position
evaluated, every move labelled by the Feature 7 table, plus an accuracy score for both sides. Three
deviations from the spec, all deliberate:
1. **Depth 14 with 2 lines, not depth 18 with 3.** The doc's table specifies 18/3 and budgets
   "20-40 seconds" for a review. Measured, that combination took **208 seconds** on a 92-ply game —
   unusable. At 14/2 the same game takes **44.6 seconds**, and the output barely moves: same
   blunder found, same 95/95 accuracy, label counts within one or two (36 Best vs 35, 10 Great vs
   11). Nearly five times faster for no meaningful loss of judgement.
2. **MultiPV 2 rather than 3.** The second line is the only one actually used — it's what tells an
   "only move" apart from one of several good ones, which is the basis of Great and Brilliant. A
   third line would cost time and change nothing.
3. **No "Book" label.** The doc defines it as "position still matches the opening file" — we have
   no opening file. Approximating it by move number would be wrong, since it would stamp "Book" on
   genuine early blunders. Omitted rather than faked; early theory moves simply get labelled Best
   or Excellent, which they are.
Brilliant is kept deliberately strict per the doc's warning ("the label that will embarrass you"):
it requires an only-move AND a net material sacrifice of 3+ that is NOT won straight back (checked
against the position after the opponent's best reply) AND the position still being level or better
afterwards. Anything short of that downgrades to Great.
Not built: the doc's IndexedDB caching of finished reviews. Reviews are recomputed if you reopen a
game. Worth adding — 45 seconds is a long time to repeat — but it's a separate piece of work.
Affects: `lib/reviewGame.js` (new), `lib/moveLabels.js` (new), `hooks/useGameReview.js` (new),
`lib/engine.js` (MultiPV support), `pages/GameViewerPage.jsx`.

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
