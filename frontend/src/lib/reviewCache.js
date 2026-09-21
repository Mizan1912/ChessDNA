// Stores finished game reviews in the browser (IndexedDB), so a game only
// ever has to be analysed once. Reviews are pure derived data — they can
// always be recomputed from the game — which is exactly why they belong in
// the browser rather than in Mongo, where they'd eat the free tier for no
// reason. The build doc says the same.

const DB_NAME = "chess-dna";
const STORE_NAME = "reviews";
const DB_VERSION = 1;

// Bumped whenever the analysis changes in a way that makes old saved reviews
// wrong — different engine depth, different labelling rules. Anything stored
// under an older stamp is ignored and re-analysed rather than shown as if it
// were current.
// v2: stricter Great/Brilliant, opening book, Lichess-curve accuracy (D-039,
// D-040, D-041). Everything saved under v1 was scored by the old, looser
// rules, so it is discarded rather than mixed in with the new numbers.
// v3: reviewed moves now carry their from/to squares and the best move in
// UCI, which the board needs for the medals and the suggestion arrow — a v2
// record simply doesn't have those fields (D-044).
// v4: each reviewed move carries `replyLine`, the engine's continuation after
// it, which the per-move explanations need (D-052).
// v5: Brilliant now measures a sacrifice as a change in the material BALANCE,
// so an even trade can no longer be labelled Brilliant (D-052).
export const REVIEW_FORMAT = "d14-mpv2-v5";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Every call is wrapped so that storage being unavailable (private browsing,
// blocked site data, quota full) just means "no cache" rather than breaking
// the review entirely.
export async function readCachedReview(gameId) {
  try {
    const db = await openDb();
    const stored = await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(gameId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (!stored || stored.format !== REVIEW_FORMAT) return null;
    return stored.review;
  } catch {
    return null;
  }
}

export async function writeCachedReview(gameId, review) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const request = db
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .put({ format: REVIEW_FORMAT, savedAt: Date.now(), review }, gameId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
  } catch {
    // Not being able to save just means it gets analysed again next time.
  }
}
