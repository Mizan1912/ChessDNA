import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { handleGoogleSignIn, handleSignOut, handleMe, requireAuth } from "./auth.js";
import { handleSaveProfile } from "./profile.js";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/auth/google", handleGoogleSignIn);
app.post("/api/auth/logout", handleSignOut);
app.get("/api/me", handleMe);

app.put("/api/profile", requireAuth, handleSaveProfile);

// PORT comes first because that is the name every Node host injects (Render,
// Railway, Fly, Heroku). They pick the port themselves and health-check the
// one they picked, so ignoring it means the deploy is marked dead while the
// log cheerfully says "listening" on a port nobody is watching. SERVER_PORT
// stays as the local-dev name, and 3001 as the last resort. See D-045.
const port = process.env.PORT || process.env.SERVER_PORT || 3001;
app.listen(port, () => {
  console.log(`Chess DNA server listening on port ${port}`);
});
