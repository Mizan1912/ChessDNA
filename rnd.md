# rnd.md — open questions for you to research outside this chat

This file is not part of the original build plan — it's added on top of `decision.md` and `flow.md`
so that anything I can't resolve myself, or that needs real-world checking I can't do, has one place
to live instead of getting lost in chat scrollback.

Each entry: what's blocking, why I can't just decide it myself, and what phase it matters for.
Entries are removed once resolved and folded into a `decision.md` entry — this file should only ever
hold what's currently open.

---

## Open questions

_None currently blocking._

## Resolved

### RQ-001 — Real Google sign-in needs to be tested by you, in your real browser ✅ RESOLVED
Phase: 3
Raised: 2026-09-20
Resolved: 2026-09-20 — user confirmed Google OAuth works in their real browser.

What's blocking: I built and verified the sign-in flow's plumbing (backend rejects bad credentials
correctly, session cookie round-trips correctly, and — via a manually-inserted test user plus a
hand-signed session token, not a real login — confirmed: username auto-restore + auto-fetch on a
return visit, the onboarding screen showing for a fresh visitor, "continue as guest" working, and
the signed-in-but-no-username step saving correctly to Mongo) but I cannot complete an actual Google
OAuth login myself — that needs a real Google account clicking through Google's real consent
screen, which no automated tool should do.

Why I can't decide it: it needs your Google account and a real click-through.

What to check: open http://localhost:5173 in a fresh/incognito window (with both `npm run dev` in
`/frontend` and `npm run dev` in `/server` running) so you see the real onboarding screen, and
confirm: (1) "Sign in with Google" completes without an error and your name appears afterward, (2)
"Continue as guest" with a typed username works and the header still offers to sign in afterward,
(3) the specific untested case — on the onboarding screen, type a Chess.com username in the guest
field, then click "Sign in with Google" *instead of* "Continue as guest" — confirm that typed
username is still saved to your new account rather than lost.

Resolved: _pending your test_

## Watch items (not blocking, but worth knowing about)

### W-004 — The Tilt headline can rest on a single game
Noticed: 2026-09-21, while checking the redesigned Tilt page against the user's 100 real games

What I found: the page headlined "Stop after 8 games in a sitting." The bars showed why — game 9 of
a session has happened exactly **once**, and it was a loss (0%). The break-point rule (D-014) checks
that the score *stays* 10+ points below game 1 for every later position in a session, but never asks
how many games each of those positions is based on. So when the last position has a sample of one, a
single loss is enough to produce the page's main finding. Games 7 and 8 (100%) rest on 2 and 1 games
respectively, so the rest of the tail is just as thin.

Why it matters: this is the page's headline, stated as an instruction to the user. It's exactly the
"a number the user can't trust is a number they won't believe" problem the evidence rule exists to
prevent — the evidence is there (tap the bar, see the one game) but the headline claims more than it
shows.

What to decide: a minimum number of games per position before it can count towards (or against) a
break point — e.g. ignore positions with fewer than 5 games — logged as its own decision, since D-014
set the rule. Not changed yet: it changes what the app claims, not how it looks.

### W-003 — The MongoDB password is still the one that was pasted into chat
Noticed: 2026-09-21, deploy

What I found: the Atlas connection string, password included, was pasted in plain text into the
build conversation early in Phase 3. It never reached git — every commit in history was searched,
zero matches, so the public repo is clean — but it does sit in that conversation's history. That was
fine while the backend only ran on localhost. Since the deploy, it's the password protecting a
database reachable from the internet, and it's still in use (tested: it connects). Rotation was
explicitly deferred by the user on 2026-09-21.

What to do, when you do it: Atlas → Security → Database Access → your user → Edit → Edit Password →
**Autogenerate** (letters and digits only — `@`, `:` or `/` would break the connection string) →
Update User. Then the new password goes in **three** places: Atlas (done by that step), your local
`.env`, and Render's `MONGODB_URI` (Render redeploys itself on save). Miss Render and the live
sign-in breaks; miss `.env` and only local development breaks. If Atlas Network Access is set to
`0.0.0.0/0`, this password is the only thing between the internet and the database — which is the
case for doing it soon.

### W-002 — Stockfish is GPLv3, and the build doc never mentions licensing
Noticed: 2026-09-20, Phase 4

What I found: the `stockfish` npm package is licensed **GPLv3** (see
`frontend/node_modules/stockfish/Copying.txt`). GPLv3 is a "copyleft" licence: the usual reading is
that if you distribute software that includes GPL code, the whole combined work has to be released
under GPLv3 too, with source available. This is exactly why Lichess is open-source under AGPL —
they ship Stockfish.

Why it matters here: the build doc talks about this project eventually making money ("that is far
more than this project will have before it makes money"), but never mentions licensing at all. If
Chess DNA is ever distributed as a closed-source commercial product, shipping Stockfish inside it is
a real legal question, not a technicality.

Nothing to do right now — it's fine for personal use, and fine forever if the project is happy being
open source. But it's worth a proper look before any paid/closed launch. Options if it becomes a
problem: keep the project open source (simplest), or move the engine server-side and have it talk
over an API (commonly argued to avoid the combined-work problem, but genuinely contested — that one
needs a lawyer, not me).

### W-001 — Chess.com API is behind Cloudflare bot protection
Noticed: 2026-09-19, Phase 1

What I found: a plain `curl` and Node's `fetch` reach `api.chess.com` fine, but an automated
headless-Chromium request gets a 403 from Cloudflare's bot mitigation, which a real browser also
surfaces as a CORS failure (no `Access-Control-Allow-Origin` header on the blocked response). You
already confirmed real fetching works fine in your actual browser, so this is not currently a
problem — it only affected my own headless self-testing.

Why it's here anyway: the build doc assumes "both chess APIs allow [browser fetches], so those
calls need no backend at all." That's true today for real human browsers, but Cloudflare's bot
rules are Chess.com's to change, not ours. If Chess.com ever tightens that protection in a way that
also affects genuine browsers (rate limits, stricter fingerprinting), game fetching would need to
move behind a `/server` route instead of running straight from the browser — that backend now
exists as of Phase 3, so this would no longer even need new infrastructure, just a new route.

Nothing to do right now. If real users ever report "fetch games" failing with a console CORS error,
this is the first thing to check.

## Format for future entries

```
### RQ-001 — <short title>
Phase: <n>
Raised: <date>

What's blocking: <the concrete unknown>
Why I can't decide it: <e.g. needs your account access, needs a real-world test I can't run,
needs a tradeoff only you can weigh>
What to check: <specific thing to go verify — a doc, a free-tier limit, an account setting>
Resolved: <date, and link to the decision.md entry it became>
```
