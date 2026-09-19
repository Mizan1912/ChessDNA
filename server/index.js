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

const port = process.env.SERVER_PORT || 3001;
app.listen(port, () => {
  console.log(`Chess DNA server listening on http://localhost:${port}`);
});
