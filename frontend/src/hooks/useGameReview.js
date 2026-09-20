import { useEffect, useRef, useState } from "react";
import { reviewGame } from "../lib/reviewGame";

// Runs the deep per-move review of one game — the thing that produces the
// Brilliant/Best/Mistake/Blunder labels. Takes the better part of a minute,
// so it's always started by a button press, never automatically.
export function useGameReview() {
  const [status, setStatus] = useState("idle"); // idle | reviewing | done | error
  const [progress, setProgress] = useState({ plyDone: 0, totalPlies: 0 });
  const [review, setReview] = useState(null);

  const cancelledRef = useRef(false);
  useEffect(() => () => { cancelledRef.current = true; }, []);

  async function run(game) {
    cancelledRef.current = false;
    setStatus("reviewing");
    setReview(null);

    try {
      const result = await reviewGame(game, {
        onProgress: setProgress,
        isCancelled: () => cancelledRef.current,
      });
      if (cancelledRef.current) return;
      setReview(result);
      setStatus("done");
    } catch {
      if (!cancelledRef.current) setStatus("error");
    }
  }

  return { status, progress, review, run };
}
