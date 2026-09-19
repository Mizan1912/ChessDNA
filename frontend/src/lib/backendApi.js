// Talks to /server (the Express backend), never to Mongo directly — the
// browser never sees the database connection string, only these HTTP calls.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

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
