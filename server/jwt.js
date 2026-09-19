import jwt from "jsonwebtoken";

// Our OWN session token — not Google's. Once someone signs in with Google,
// we don't need to talk to Google again for the rest of their session; we
// just trust this cookie, the same way any classic login system would.
const SESSION_LENGTH = "30d";

export function signSessionToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: SESSION_LENGTH });
}

// Returns the decoded payload, or null if the token is missing, expired, or
// was signed with a different secret (e.g. JWT_SECRET got rotated).
export function verifySessionToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}
