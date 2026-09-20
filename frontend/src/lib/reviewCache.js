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
export const REVIEW_FORMAT = "d14-mpv2-v1";

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
