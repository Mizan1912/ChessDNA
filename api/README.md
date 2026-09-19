# /api

Serverless functions go here (Vercel convention — each file in this folder becomes an endpoint).

Untouched until Phase 3 (Login and saving). Nothing in `/frontend` may hold a database password or
secret key — that is the entire reason this folder exists. See the root `.env.example` for the
variable names these functions will read once Phase 3 starts.
