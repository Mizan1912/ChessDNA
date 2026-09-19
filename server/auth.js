import { OAuth2Client } from "google-auth-library";
import { ObjectId } from "mongodb";
import { getDb } from "./db.js";
import { signSessionToken, verifySessionToken } from "./jwt.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const SESSION_COOKIE_NAME = "session";
const SESSION_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches jwt.js's SESSION_LENGTH

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  maxAge: SESSION_COOKIE_MAX_AGE_MS,
  // Browsers reject `secure` cookies over plain http — fine for local dev,
  // but this MUST be true once the app is served over https in production.
  secure: process.env.NODE_ENV === "production",
};

// Checks the credential (a JWT) really came from Google and really was
// issued for OUR Client ID — this is the whole security boundary of "Sign
// in with Google," so it goes straight to Google's own library, not a
// hand-rolled check.
async function verifyGoogleCredential(credential) {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload(); // { sub, email, name, ... }
}

export async function handleGoogleSignIn(req, res) {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: "Missing credential" });
  }

  let payload;
  try {
    payload = await verifyGoogleCredential(credential);
  } catch {
    return res.status(401).json({ error: "Invalid Google credential" });
  }

  const db = await getDb();
  const users = db.collection("users");

  const now = new Date();
  await users.updateOne(
    { googleSub: payload.sub },
    {
      $set: { email: payload.email, name: payload.name, lastLoginAt: now },
      $setOnInsert: { googleSub: payload.sub, chessComUsername: null, createdAt: now },
    },
    { upsert: true }
  );
  const user = await users.findOne({ googleSub: payload.sub });

  const token = signSessionToken({ userId: user._id.toString() });
  res.cookie(SESSION_COOKIE_NAME, token, cookieOptions);
  res.json(toPublicUser(user));
}

export function handleSignOut(req, res) {
  res.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
  res.json({ ok: true });
}

export async function handleMe(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Not signed in" });
  res.json(toPublicUser(user));
}

// Reads the session cookie and loads the matching user, or null if there
// isn't a valid session. Used by both /api/me and the requireAuth middleware.
export async function getUserFromRequest(req) {
  const payload = verifySessionToken(req.cookies?.[SESSION_COOKIE_NAME]);
  if (!payload) return null;

  const db = await getDb();
  return db.collection("users").findOne({ _id: new ObjectId(payload.userId) });
}

export async function requireAuth(req, res, next) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Not signed in" });
  req.user = user;
  next();
}

// Never send the raw Mongo document to the browser — trims it to exactly
// what the frontend needs.
function toPublicUser(user) {
  return {
    email: user.email,
    name: user.name,
    chessComUsername: user.chessComUsername ?? null,
  };
}
