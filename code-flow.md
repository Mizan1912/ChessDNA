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

## 4e. Finding blunders with Stockfish

**Files involved:** `lib/engine.js` → `lib/blunderScan.js` (+ `lib/winPercent.js`) →
`hooks/useBlunderScan.js` → `pages/BlundersPage.jsx`

This is the first part of the app that needs a real chess engine rather than plain board logic.

1. **The engine runs in a Web Worker** (`engine.js`). A Web Worker is just "JavaScript running on a
   separate thread," and here it's not optional: analysing 50 games pins a CPU core for minutes, and
   on the main thread that would freeze the entire tab — no scrolling, no clicking, browser warning
   you the page is unresponsive. The build doc calls this out as the single most common way this
   kind of feature goes wrong.
2. **Talking to it is just text.** Stockfish speaks UCI, a line-based protocol: send it
   `position fen <the position>`, then `go depth 12`, and it streams back lines like
   `info depth 12 ... score cp -45 ... pv e2e4`, finishing with `bestmove e2e4`. `engine.js` wraps
   that in a normal promise, so the rest of the code just does `await engine.evaluate(fen, 12)`.
3. **One gotcha worth knowing**: UCI reports scores from *the perspective of whoever is to move*.
   So "+300" means "+300 for Black" if it's Black's turn. Comparing two positions without fixing
   that would produce nonsense. `engine.js` flips every score to one fixed perspective (positive =
   good for White), and `blunderScan.js` flips again into "good for the player whose games these
   are."
4. **Deciding what's a blunder** (`blunderScan.js`): for each of the player's own moves, evaluate
   the position before it and after it. The difference is what the move threw away. Three filters
   keep the noise down: skip the first 8 moves (opening theory, not real decisions), skip positions
   already decided (beyond ±600 centipawns), and require a real drop.
5. **That "real drop" is measured in win percentage, not centipawns** (`winPercent.js`). This is the
   part worth understanding, because it's the difference between a useful feature and a useless one.
   Centipawns are linear, but chess isn't: going from +500 to +200 is *nothing* (you were winning,
   you're still winning), while going from +50 to -250 loses the game. Converting both evals to
   "what percent of the time does someone win from here" and comparing those instead matches how
   much actually changed. In testing this cut the findings from 8 to 5 on the same four games, and
   the 3 it dropped were all "was winning by 5 pawns, still winning by 3."
6. **The UI never starts this by itself** (`useBlunderScan.js`, `BlundersPage.jsx`). A scan costs
   minutes, so it's always a button press. The hook tracks progress (reported after each game) so
   the page can show a real progress bar. Note where the hook actually lives: `App.jsx`, not
   `BlundersPage`. That's deliberate — clicking a blunder to look at it unmounts the page, and if
   the results lived there they'd be destroyed, forcing a fresh multi-minute scan just for daring
   to look at one.
7. **Two filters exist purely to stop it saying stupid things.** If the move played was the
   engine's own top choice, it's skipped entirely — you can't blunder by playing the best move, and
   without this guard it sometimes claimed you did (because scoring the position after a move
   searches one ply deeper than the position before it, so even a perfect move shows a tiny
   apparent "drop"). And hanging *pawns* are ignored when explaining, because "this leaves your
   pawn undefended" is true of half of all chess positions and explains nothing.

## 4f. Explaining WHY a move was a blunder

**Files involved:** `lib/explainBlunder.js`

An evaluation number tells you a move was bad but not what you did wrong. This turns the raw
numbers into a sentence, using only board logic and two moves the scan already had lying around:
the engine's preferred move, and the opponent's best reply (the "refutation"). No AI is involved —
it would cost money, which the build doc forbids, and it would happily invent things that aren't on
the board.

It checks, in order of how much the answer matters, and stops at the first one that fits:

1. Was there a forced mate available that you missed? → "You had a forced mate here."
2. Does the move allow a forced mate against you? → "Nf6 allows a forced mate."
3. Does the opponent's best reply simply capture something? → "Qd4 loses your queen on d4 to Bxd4."
4. Is one of your pieces now attacked and not properly defended? (chess.js's `attackers()` finds
   both the attackers and defenders of a square, and it counts as hanging if nothing defends it, or
   if the cheapest attacker is worth less than the piece.) → "leaves your knight on f6 undefended."
5. Nothing concrete found → say only what's certainly true: the engine disagreed, here's what it
   wanted, here's how the opponent answers.

That last fallback is the important one. The rule throughout is to never make a specific claim
without checking it on the board first — a confidently wrong "this hangs your knight" destroys
trust in everything else the app says, which is exactly the reasoning the build doc gives for
keeping the "Brilliant" label strict.

## 4g. The analysis board: evaluation bar, move labels, playing your own moves

**Files involved:** `hooks/useLiveEval.js` + `components/EvalBar.jsx` (the bar),
`lib/reviewGame.js` + `lib/moveLabels.js` + `hooks/useGameReview.js` (the labels), and
`pages/GameViewerPage.jsx` tying all three together.

Three separate things share one screen, and they work quite differently:

1. **The evaluation bar is live and cheap.** It runs its own depth-12 evaluation of whatever
   position is currently showing, which takes well under a tenth of a second, and redoes it every
   time the position changes. It deliberately does *not* wait for a full review — if it did, there
   would be no bar at all until you'd sat through a 45-second analysis. If a review *has* been run,
   the bar quietly prefers that deeper number for positions belonging to the real game.
   - One subtlety: stepping quickly through moves asks for evaluations faster than the engine can
     answer them. Answers that come back for a position you've already left are thrown away rather
     than flickering onto the bar.
2. **Playing your own moves branches off rather than editing anything.** Dragging a piece runs the
   move through chess.js; if it's legal, the resulting position is stored separately as "exploring",
   and the board shows that instead of the game. The game itself is never modified — one click puts
   it back. The bar follows you into your own line, which is the entire point of an analysis board.
3. **The move labels need a full review, so they're opt-in.** `reviewGame.js` walks every position
   in the game, asking the engine for its top TWO moves each time. Two, specifically, because:
   - the best line tells you what the player *should* have played, and
   - the second-best tells you whether there was any other decent option at all. If the best move
     is far better than the second best, then that move was the *only* move — and finding an only
     move is what earns "Great". That's information you simply cannot get from a single line.

   `moveLabels.js` then applies the doc's table in order, stopping at the first match, measuring
   everything in win percentage rather than centipawns (same reasoning as the blunder scan).
   "Brilliant" is held to a deliberately high bar: an only-move that also sacrifices real material
   which is *not* immediately won back, leaving the position still playable. The doc warns this is
   the label that embarrasses you, so when in doubt it downgrades to Great.

**Why depth 14 and not the doc's 18:** measured, depth 18 with three lines took 208 seconds on one
92-ply game. Depth 14 with two lines produced practically the same verdicts in a fraction of the
time. The numbers in the doc were a starting guess; these are what the machine actually does.

**And why not go lower still, to depth 12?** Also measured — it's 3-6x faster again, but it only
agrees with depth 14 on 59-70% of labels, and disagrees *seriously* (one says the move was fine,
the other says it was a mistake) several times per game. That's not a speed win, it's wrong
answers delivered faster. Slowness got solved a different way instead:

## 4h. Making the review feel fast without making it worse

**Files involved:** `lib/reviewCache.js`, `hooks/useGameReview.js`

Three things, none of which touch the quality of the analysis:

1. **It only ever runs once per game.** A finished review is saved in the browser's own database
   (IndexedDB) under that game's id. Reopening the game loads the saved copy — about a second,
   versus half a minute to redo it. Saved reviews carry a stamp naming the settings they were
   produced with (`d14-mpv2-v2` — the `v2` because the stricter labels and the new accuracy curve
   changed what a review says); if those settings ever change, old records are ignored and
   re-analysed rather than being shown as though they were still current. Every storage call is
   wrapped in a try/catch, because private browsing and full disks are real and neither should
   break the page — they just mean "no cache".
2. **It starts on its own** when you open a game. If there's a saved copy there's nothing to wait
   for; if there isn't, the analysis runs while you're already looking at the board rather than
   after you've hunted for a button.
3. **Results appear as they're found.** Each progress tick carries the moves worked out so far, so
   labels fill in from move one rather than appearing all at once at the end. Accuracy is held back
   until the end on purpose — an average over half a game would be a misleading number.

One other thing that mattered: the evaluation bar runs its own engine, and while a review was
running that meant *two* Stockfish workers fighting over the CPU. The bar now stands down during a
review (except when you're exploring your own line, which the review knows nothing about). That
single change took a first review from about 44 seconds to about 26.

## 4i. The scorecard and the two clocks

**Files involved:** `components/ReviewSummary.jsx`, `components/PlayerStrip.jsx`,
`lib/clockData.js`

Two pieces of the Chess.com layout that people already know how to read, so there's nothing new to
learn.

**The scorecard** sits beside the move list: both players in two columns (yours on the left, always
— this screen is about you), their accuracy, a count of how many moves of each quality each of them
played, and the per-game rating estimate. The row order comes straight from the label list itself,
so adding a new label later puts it in the right place automatically without anyone remembering to
update the panel. The counts fill in live while the review runs, because a tally of what's known so
far is honest. Accuracy and the rating stay blank until the end, because an average over half a
game isn't.

**The clocks** are one strip above the board and one below — opponent on top, you underneath, as on
a real board — and they flip when you flip the board. Working out what a clock read at a given
move is simpler than it sounds: chess.com's PGN writes each player's remaining time after every
move, so a player's clock at move 20 is just whatever it read the last time they moved. The code
walks backwards from where you are until it finds that player's most recent move. Before anyone has
moved, both show the starting time from the PGN's time-control header. Whoever is about to move
gets the lit clock, and under ten seconds it shows tenths and turns red — which is exactly when
tenths start to matter.

## 4j. Being as strict as Chess.com

**Files involved:** `lib/moveLabels.js`, `lib/openingBook.js`, `lib/reviewGame.js`

Side by side with a real Chess.com review of the same kind of game, our version was too generous:
Chess.com gave 0 Brilliant and 2 Great, we gave 1 Brilliant and a handful of Greats, and our
accuracy figures sat in the 90s where theirs sat in the 70s and 80s. A compliment that arrives
every third move isn't a compliment. Three changes fixed it.

**"Great" now has to pass three tests instead of one.** The old rule was simply "you found the
engine's move and the runner-up was 10 points worse". Now: the gap has to be 15 points, *and* the
runner-up has to have actually cost you something that matters, *and* there has to have been a real
choice in the first place.

That middle test is the interesting one. Imagine you're winning overwhelmingly. The best move keeps
you winning overwhelmingly; the second-best keeps you winning comfortably. On paper that's a big
gap. Over the board it's no difference at all — you were winning either way. So positions are
sorted into three states (losing, a game, winning), and a move only counts as "the only move" if
every alternative would have dropped you into a worse state. Finding the one move that saves a lost
position is great. Finding the flashiest way to stay three queens up is not.

**"Brilliant" keeps all of that and adds that you weren't already winning easily.** Giving up a
knight when you're a rook ahead isn't brilliant, it's just still winning. Together with the
existing requirement — a real sacrifice that you don't win straight back, leaving a position that
still holds — this now almost never fires, which is the point.

**"Book" exists now.** `openingBook.js` holds 79 mainstream opening lines written out as moves. A
move is Book while the whole game so far still matches the start of one of them. Chess.com does
this from a database of millions of master games and we can't ship that, so ours is small on
purpose and errs one way only: a real theory move it doesn't know gets called Best instead of Book,
which is merely less informative. It will never claim something is theory when it isn't. Book moves
are also left out of the accuracy calculation entirely — memorising ten moves shouldn't pad your
score, and theory isn't your work to be credited for.

**Accuracy got a proper curve.** It used to be a straight line: average how much you threw away,
multiply, subtract. That treats a 40-point collapse as exactly twice as bad as a 20-point one,
which isn't how chess works — and it let forty quiet moves drown out the two that decided the game.
Now each move gets its own accuracy from a curve that's steep near the top and flat at the bottom,
and the game's figure blends the ordinary average with a harmonic mean, which is the kind of
average that gets dragged down hard by your worst moments. That's why one real blunder now costs
you visibly, where before it vanished into the crowd.

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
- **Blunders:** `engine.js` → `blunderScan.js` (+ `winPercent.js`) → `useBlunderScan.js` →
  `BlundersPage.jsx`
- **Evaluation bar:** `useLiveEval.js` → `engine.js`, rendered by `EvalBar.jsx`
- **Move labels:** `reviewGame.js` → `moveLabels.js` (+ `openingBook.js`) → `useGameReview.js` →
  `GameViewerPage.jsx` → `ReviewSummary.jsx`
