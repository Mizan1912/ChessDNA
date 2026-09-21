// Talks to /server (the Express backend), never to Mongo directly — the
// browser never sees the database connection string, only these HTTP calls.
//
// In production VITE_API_BASE_URL is set to "/", meaning "this same site":
// requests go to "/api/..." on the site's own domain and the host forwards
// them to the backend (see frontend/vercel.json, D-045). That keeps the
// session cookie same-site.
//
// Two details make that work:
//  - `??` rather than `||`. With `||`, an empty value counts as "missing" and
//    quietly falls back to localhost — the live site would try to call the
//    developer's laptop. Only a truly UNSET value means localhost now.
//  - Trailing slashes are trimmed. So "/" becomes "" (same site), and a
//    stray "http://host/" can't produce "http://host//api/me". "/" is used
//    rather than an empty string because some hosts refuse to save an
//    environment variable with no value.
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
const BASE_URL = configuredBaseUrl.replace(/\/+$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: "include", // sends/receives the httpOnly session cookie
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (response.status === 401) return null; // "not signed in" is a normal state, not an error
  if (!response.ok) throw new Error(`Request to ${path} failed (${response.status})`);
  return response.json();
}

export function fetchCurrentUser() {
  return request("/api/me");
}

export function signInWithGoogle(credential) {
  return request("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
}

export function signOut() {
  return request("/api/auth/logout", { method: "POST" });
}

export function saveChessComUsername(chessComUsername) {
  return request("/api/profile", {
    method: "PUT",
    body: JSON.stringify({ chessComUsername }),
  });
}
