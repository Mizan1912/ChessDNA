# decision.md — why things are the way they are

Newest entry at top. One entry per decision, never edited later; if a decision is reversed, a new
entry is added that says so and links back. Every magic number in the code must trace to an entry
here.

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

- **Vercel deployment** (belongs to: whenever the user is ready, likely revisited at end of Phase 0
  or start of Phase 1) — scaffold and `npm run build` confirmed working locally; deployment itself
  paused per D-005.
