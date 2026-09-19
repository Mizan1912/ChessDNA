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

## Watch items (not blocking, but worth knowing about)

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
move behind a serverless function in `/api` instead of running straight from the browser.

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
