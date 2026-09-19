# code-flow.md — how the code actually works, step by step

`flow.md` describes what you see on screen. This file describes what happens underneath, in plain
language, so you can follow the code without already knowing React or the codebase. Like `flow.md`,
this is rewritten each phase to describe the current state — not a history of changes (that's
`decision.md`).

Four kinds of files, and what each kind is for:

- **`pages/`** — one file per screen. Decides what to show and reacts to clicks. Doesn't know
  *how* to fetch games or compute tilt — it just calls the code in `lib/` and puts the result on
  screen.
- **`lib/`** — the actual logic. No screen stuff in here at all — just plain functions that take
  data in and give data out. This is the part worth reading closely if you want to understand how
  a number was calculated.
- **`components/`** — small reusable pieces of screen (like the evidence list) used by more than
  one page.
- **`hooks/`** — shared "memory" that more than one page needs to read from the same place.

Everything above lives in `/frontend` — plain React code that runs in the browser. As of Phase 3
there's also **`/server`**, a completely separate small Express app: the one place allowed to hold
the Mongo password, because a browser can never keep a secret (anyone can open dev tools). The
frontend never talks to Mongo or Google's verification API directly — it always goes through
`/server` first.

---

## 1. Fetching games from Chess.com

**Files involved:** `hooks/useFetchedGames.js` → `lib/chessComApi.js` → `lib/normalizeGame.js`

You type a username and click "Fetch games." Here's what happens, in order:

1. `useFetchedGames.js` is the file holding onto "what did we fetch." It has a function called
   `fetchGames` that runs when you click the button.
2. That function calls `getRecentGames(username, howMany)` in `chessComApi.js`.
3. `getRecentGames` first asks Chess.com "what months of games does this player have?" (the
   `getArchiveUrls` function) — Chess.com organizes games into one bucket per month.
4. Starting from the newest month, it downloads that whole month's games (`getGamesFromArchive`)
   and keeps going backwards through older months until it has enough games or runs out of months.
5. Each game comes back from Chess.com in Chess.com's own format — a `white` object, a `black`
   object, a `pgn` string (the move-by-move text of the game), etc.
6. `normalizeGame.js` takes each of those and converts it into *our* shape — the same shape no
   matter which chess site it came from (this matters once Lichess is added later — Lichess formats
   games completely differently, but the rest of the app will never need to know that). This step
   also figures out: was the user white or black in this game, and did the user win, lose, or draw.
7. The converted list is stored in `useFetchedGames.js`'s memory, and every page that asked for it
   (the games list, the Tilt page) re-renders with the new list.

**Why a raw fetch can fail:** if the username doesn't exist, Chess.com returns a 404, which
`chessComApi.js` turns into a `UsernameNotFoundError` so the page can show a friendly message
instead of a technical one.

---

## 2. Viewing one game, move by move

**Files involved:** `lib/pgnToMoves.js` → `pages/GameViewerPage.jsx` → `react-chessboard`

1. You click a row in the games table. The page you're on hands that one game object to
   `GameViewerPage`.
2. `pgnToMoves.js` uses a library called `chess.js` to read the game's PGN text and turn it into a
   list of moves, where **each move already carries a snapshot of the board right after it's
   played** (called a FEN — a short text code that describes exactly where every piece is). This
   means jumping to move 20 doesn't require replaying moves 1-19 — we just already have the
   snapshot for move 20.
3. `GameViewerPage` keeps track of "which move am I looking at right now" as a single number. The
   prev/next/start/end buttons just change that number.
4. Whatever move number is selected, the matching snapshot (FEN) gets handed to the `Chessboard`
   component from `react-chessboard`, which draws the pieces. We never tell it *how* to draw a
   chessboard — that library already knows how; we just tell it *which position* to show.

---

## 2b. Time-class tabs — shared across the whole app

**Files involved:** `lib/timeClass.js` → `hooks/useFetchedGames.js` → `components/TimeClassTabs.jsx`

This filter lives one level above any single page, because it needs to affect all of them:

1. `timeClass.js` has two plain functions: `timeClassTabs(games)` counts how many games fall into
   each time class (bullet/blitz/rapid/daily), and `filterByTimeClass(games, activeClass)` returns
   only the games matching the active tab (or everything, if "all" is selected).
2. `useFetchedGames.js` (the hook from section 1) holds `timeClassFilter` as a piece of state, and
   computes `filteredGames` from it on every render. This is the value every page actually reads —
   nobody reads the raw `games` list except to build the tab counts.
3. `components/TimeClassTabs.jsx` is just buttons — it doesn't know anything about games or tilt, it
   just calls `onChange(theClassYouClicked)`, which `App.jsx` wires straight to the hook's setter.
4. `App.jsx` renders `TimeClassTabs` once, above whichever page is currently showing. So clicking
   "Bullet" while looking at the games list, then switching to the Tilt page, keeps "Bullet"
   selected — because both pages are reading from the same hook, not two separate filters.

The rule going forward: any new feature page should take its games from `filteredGames`, not
`games`, so it automatically respects whatever time class the user has selected.

## 3. The board preview on the games list (hover to see how a game ended)

**Files involved:** `pages/GamesListPage.jsx` → `lib/pgnToMoves.js`

When your mouse enters a row, `GamesListPage` runs the same `pgnToMoves` function from section 2,
but only keeps the very last snapshot (the final position). That becomes the board's position. When
your mouse leaves, it switches back to the normal starting position. Nothing is pre-computed for
every row up front — it only does this work for the one row you're actually hovering, so it stays
cheap even with 100 games in the list.

---

## 4. The tilt detector

**Files involved:** `lib/sessions.js` → `lib/tilt.js` → `pages/TiltPage.jsx`

This is the most "logic-heavy" feature so far. Here's the chain:

1. **Cutting games into sessions** (`sessions.js`): games are sorted by when they were played, then
   walked in order. Every time the gap between one game ending and the next one starting is more
   than 30 minutes, that's a new "session" (a sitting at the board). Sessions with only one game in
   them are thrown away — you can't tell if someone tilts within a session of one.
2. **Score by position in session** (`tilt.js`'s `computeScoreByIndex`): every game gets tagged with
   its position in its session (1st game, 2nd game, 3rd game...). Then, across *all* sessions, we
   average the score of every "1st game," every "2nd game," and so on. A win counts as 1, a draw as
   0.5, a loss as 0 — averaged and shown as a percentage.
3. **Finding the break point** (`findBreakPoint`): starting from game 2 onward, we check "is this
   position's average score at least 10 points lower than game 1's average score, and does it *stay*
   that much lower for every position after it too?" The first position where that's true is the
   break point — the point where things reliably start going wrong. If no such point exists, we say
   so honestly instead of forcing a fake answer.
4. **The tilt chain** (`computeTiltChain`): this one ignores sessions and just looks at your games in
   one long timeline. For every game that came right after a loss, it records that next game's
   score. Average all of those, and compare to your overall average — that's "how much worse do you
   do right after losing." It does the same thing but filtered to only losses where the reason was
   `"timeout"` (running out of the clock), to separate "tilt from losing" from "tilt from a clock
   loss specifically."
5. **Worst hour of day** (`findWorstHour`): groups every game by the hour it was played in (using
   your computer's own clock/timezone), and finds the hour with the lowest average score — but only
   if there are at least 8 games in that hour, otherwise one unlucky 3am game could look like a real
   pattern when it's just noise.
6. **Not enough data yet:** all of the above only runs if there are at least 20 sessions total.
   Below that, `analyzeTilt` (the function that ties all of this together) returns a status saying
   so, and the page shows an honest "not enough games yet" instead of a misleading number.

---

## 4b. The clock fingerprint

**Files involved:** `lib/clockData.js` → `lib/clockFingerprint.js` → `pages/ClockPage.jsx`

1. **Reading the clock from a PGN** (`clockData.js`): Chess.com/Lichess PGNs put a comment like
   `{[%clk 0:02:31.4]}` after every move — chess.js's `getComments()` returns these keyed by the FEN
   right after that move, which lines up exactly with the `after` FEN from `history({verbose:true})`
   (the same trick section 2 uses). Time spent on a move is just "previous reading for that same
   color minus this reading," plus the increment (parsed from the PGN's `TimeControl` header, e.g.
   `"180+2"` means 2 seconds added per move). For each color's very first move, there's no earlier
   reading to subtract from, so the time control's starting seconds are used instead.
2. **Opening time share** (`clockFingerprint.js`): every move is tagged `isOpening` if it's move 12
   or earlier (matches the spec's own cutoff). Sum the time spent on opening moves, divide by time
   spent on all moves, across every fetched game at once.
3. **Longest think**: just a max — whichever single move, across every game, has the largest
   time-spent value. It keeps a reference to which game it came from.
4. **Games lost on time**: filters the game list for `result === "loss"` AND `resultReason ===
   "timeout"` (the exact reason string Chess.com gives us, preserved since `normalizeGame.js` added
   it in Phase 2 — see section on the tilt chain, which needed the same field).
5. **Known position, wasted time**: every opening-move position gets grouped by a simplified version
   of its FEN (piece placement, whose turn, castling rights, en passant — but NOT the move-count
   numbers at the end of a FEN, since those always differ). Any group reached 20 or more times counts
   as "a position you know." Among only those groups, find the single slowest think — that's the
   finding. If nothing has been repeated 20+ times yet, this finding just doesn't show.

**What's deliberately not built yet:** whether a long think's move was actually good, what share of
blunders happen under 60 seconds, and whether a time-loss happened from a winning position — all
three need an engine evaluation, which doesn't exist until Phase 4 (see decision.md D-020).

**Why ply 0 is excluded from "known position":** the position before White's very first move is
*always* the same standard chess starting position, in every single game, regardless of anything the
player does. Without excluding it, it would automatically "win" the known-position check every time
(it's always reached 100% as often as there are games) and make the finding meaningless. See
decision.md D-021.

## 4c. Jumping straight to a position from a finding

**Files involved:** `App.jsx` → `pages/GameViewerPage.jsx`

`App.jsx` doesn't just remember which game is open — it remembers `{ game, moveIndex }` together.
Normally `moveIndex` is `-1` (start of the game), but the Clock page's "see that position" buttons
call `onOpenGame(game, somePlyIndex - 1)` — one ply *before* the move being talked about, since that
earlier position is what "the known position" actually refers to (the position right before the
slow think happened, not after). `GameViewerPage` just reads this in as its starting `moveIndex`
instead of always starting at `-1`.

The move list also shows each move's thinking time now: `GameViewerPage` calls both `pgnToMoves`
(for the board positions) and `pgnToClockMoves` (for the timing) on the same PGN, and since both
walk the exact same list of moves in the exact same order, it can just look up `clockMoves[index]`
for whatever move `moves[index]` is — no separate matching logic needed.

## 4c. Signing in and remembering your username

**Files involved:** `components/GoogleSignInButton.jsx` → `lib/backendApi.js` → `/server/auth.js` →
`/server/db.js` (Mongo) and `/server/jwt.js`

This is the one part of the app where the browser is NOT allowed to hold a secret (the Mongo
password), so a real backend — `/server`, a plain Express app, separate from `/frontend` — is
involved for the first time. Here's the whole trip, end to end:

1. **The button itself doesn't do much.** `GoogleSignInButton.jsx` just waits for Google's own
   script (loaded in `index.html`) to be ready, then hands rendering off to Google entirely —
   `window.google.accounts.id.renderButton(...)`. When someone actually signs in through it, Google
   calls back with a `credential`, which is really just a signed token proving "this really is
   [email] and Google vouches for it." We never see a password.
2. **That credential goes to our backend**, not straight into use — `backendApi.js` POSTs it to
   `/server`'s `/api/auth/google`. This step matters: anyone could fake a credential-looking string
   in the browser's network tab, so the actual trust decision has to happen somewhere the user can't
   tamper with it, which is the server.
3. **The server checks it's real.** `auth.js` hands the credential to `google-auth-library`'s
   `verifyIdToken`, which cryptographically confirms Google actually issued this token, and that it
   was issued for *our* app specifically (checked against `GOOGLE_CLIENT_ID`) and not some other
   site. This one check is the entire security boundary of "sign in with Google."
4. **The server finds or creates a user row** in Mongo's `users` collection, keyed by Google's own
   stable id for that account (`googleSub`) — so signing in again later matches the same row, even
   if the person's Google display name changes.
5. **The server issues its OWN login token** (`jwt.js`) — unrelated to Google's token, just
   `{userId}` signed with a secret only our server knows (`JWT_SECRET`) — and sends it back as an
   `httpOnly` cookie. "httpOnly" means frontend JavaScript can never read this cookie's value even if
   it wanted to; the browser just automatically attaches it to future requests to `/server`. This is
   what makes you "stay signed in" without Google being involved again.
6. **On every later visit**, `useAuth.js` calls `GET /api/me` on mount. The server reads that cookie,
   checks the signature is still valid and not expired, loads the matching user, and sends back
   `{email, name, chessComUsername}` — never the raw database row. If there's a saved
   `chessComUsername`, `App.jsx` fills the username field in and triggers a fetch automatically,
   which is the entire point of Phase 3: nothing to retype on a return visit.
7. **Guest-to-account migration** is just: if you'd already typed a username as a guest, and you
   then sign in, `App.jsx` saves that typed username to your new account right away (`PUT
   /api/profile`) instead of only saving on the next manual fetch.

## 4d. The onboarding screen

**Files involved:** `pages/OnboardingPage.jsx` → `App.jsx`

`App.jsx` computes one boolean, `showOnboarding`, from three pieces of state: has the initial
session check finished (`auth.checkedSession`), has onboarding already been dismissed this visit
(`onboardingDismissed`), and does the signed-in user (if any) already have a saved username
(`auth.user?.chessComUsername`). If all three say "not yet handled," `App.jsx` renders
`OnboardingPage` instead of the normal app shell — no header, no tabs, just the onboarding screen.

`OnboardingPage` itself doesn't know about any of that logic — it just renders one of two shapes
based on a single `needsUsernameOnly` prop (true when someone's already signed in but has no saved
username) and calls back to whichever handler fits what the person did:

- Typed a username and clicked "Continue as guest" → `onGuestContinue(username)` → `App.jsx` sets
  it as the active username, fetches games, and marks onboarding dismissed for this visit.
- Clicked "Sign in with Google" → `onSignInCredential(credential, whateverWasTypedSoFar)`. This one
  is slightly more involved: after Google confirms who they are, if they already had a saved
  username (signing in on a new device, say) that's used immediately; otherwise, if they'd typed
  something in the guest field before deciding to sign in instead, that gets saved as their
  username; if neither, `showOnboarding` stays true, but now `auth.user` is set, so it naturally
  falls into the "needs username only" shape on the next render.
- On the "needs username only" shape, submitting the form calls `onUsernameSubmit(username)`
  directly — no guest option shown, since they're already signed in.

## 5. Showing evidence for a finding

**Files involved:** `components/GameEvidenceList.jsx`

Every number `tilt.js` produces keeps the actual list of games that made up that number attached to
it (not just the average — the real games too). `TiltPage` puts a "show the N games..." toggle next
to each finding; clicking it renders `GameEvidenceList`, a plain list of those games (date,
opponent, result). Clicking any row in that list opens `GameViewerPage` (section 2) on that exact
game. This is what the build doc calls "the evidence rule" — a number by itself is never enough,
you should always be able to get to the real games one click away.

---

## Reading order, if you want to trace one feature start to finish

Pick the feature, then read the files in this order — each one calls into the next:

- **Fetching/viewing games:** `useFetchedGames.js` → `chessComApi.js` → `normalizeGame.js` →
  `GamesListPage.jsx` → `pgnToMoves.js` → `GameViewerPage.jsx`
- **Tilt:** `sessions.js` → `tilt.js` → `TiltPage.jsx` → `GameEvidenceList.jsx`
- **Clock:** `clockData.js` → `clockFingerprint.js` → `ClockPage.jsx`
- **Time-class filter:** `timeClass.js` → `useFetchedGames.js` → `TimeClassTabs.jsx` (rendered by `App.jsx`)
- **Sign-in:** `GoogleSignInButton.jsx` → `backendApi.js` → `/server/auth.js` → `/server/jwt.js` +
  `/server/db.js` → back to `useAuth.js` on the next `/api/me` check
