import { useCallback, useEffect, useRef, useState } from "react";
import { reviewGame } from "../lib/reviewGame";
import { readCachedReview, writeCachedReview } from "../lib/reviewCache";

// Runs the per-move review for one game, and makes sure it only ever has to
// happen once: finished reviews are saved in the browser, so reopening a game
// shows its labels instantly instead of re-analysing for twenty seconds.
//
// Starts on its own as soon as a game is opened. While it runs, labels appear
// move by move rather than all at the end.
export function useGameReview(game) {
  const [status, setStatus] = useState("idle"); // idle | reviewing | done | error
  const [progress, setProgress] = useState({ plyDone: 0, totalPlies: 0 });
  const [review, setReview] = useState(null);

  const cancelledRef = useRef(false);
  useEffect(() => () => { cancelledRef.current = true; }, []);

  const run = useCallback(
    async (targetGame, { useCache = true } = {}) => {
      if (!targetGame) return;
      cancelledRef.current = false;

      if (useCache) {
        const cached = await readCachedReview(targetGame.id);
        if (cancelledRef.current) return;
        if (cached) {
          setReview(cached);
          setStatus("done");
          return;
        }
      }

      setStatus("reviewing");
      setReview(null);

      try {
        const result = await reviewGame(targetGame, {
          onProgress: ({ plyDone, totalPlies, partial }) => {
            if (cancelledRef.current) return;
            setProgress({ plyDone, totalPlies });
            // Show what's known so far. Accuracy is deliberately left off
            // until the end — a half-finished average would be misleading.
            if (partial) setReview({ ...partial, accuracy: null, estimatedRating: null });
          },
          isCancelled: () => cancelledRef.current,
        });
        if (cancelledRef.current) return;
        setReview(result);
        setStatus("done");
        writeCachedReview(targetGame.id, result); // fire and forget
      } catch {
        if (!cancelledRef.current) setStatus("error");
      }
    },
    []
  );

  // Kick off automatically whenever a different game is opened.
  useEffect(() => {
    if (!game) return;
    cancelledRef.current = false;
    setStatus("idle");
    setReview(null);
    run(game);
    return () => {
      cancelledRef.current = true;
    };
  }, [game?.id, run]);

  return { status, progress, review, run };
}
