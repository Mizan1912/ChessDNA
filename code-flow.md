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
