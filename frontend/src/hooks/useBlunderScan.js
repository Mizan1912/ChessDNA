import { useEffect, useRef, useState } from "react";
import { scanGamesForBlunders } from "../lib/blunderScan";

// Owns the "run Stockfish over a batch of games" job: whether it's running,
// how far along it is, and what it found. Scanning takes minutes, so this is
// never started automatically — the user presses a button.
export function useBlunderScan() {
  const [status, setStatus] = useState("idle"); // idle | scanning | done | error
  const [progress, setProgress] = useState({ gamesDone: 0, totalGames: 0, blundersFound: 0 });
  const [blunders, setBlunders] = useState([]);

  // Set when the component goes away mid-scan, so the engine stops grinding
  // instead of running on invisibly in the background.
  const cancelledRef = useRef(false);
  useEffect(() => () => { cancelledRef.current = true; }, []);

  async function scan(games) {
    cancelledRef.current = false;
    setStatus("scanning");
    setBlunders([]);
    setProgress({ gamesDone: 0, totalGames: games.length, blundersFound: 0 });

    try {
      const found = await scanGamesForBlunders(games, {
        onProgress: setProgress,
        isCancelled: () => cancelledRef.current,
      });
      if (cancelledRef.current) return;
      setBlunders(found);
      setStatus("done");
    } catch {
      if (!cancelledRef.current) setStatus("error");
    }
  }

  return { status, progress, blunders, scan };
}
