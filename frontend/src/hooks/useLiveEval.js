import { useEffect, useRef, useState } from "react";
import { Engine } from "../lib/engine";

// Evaluates whatever position is currently on the board, and keeps doing so
// as you step through moves or play your own. Deliberately shallow — this
// needs to feel instant while clicking through a game, not be authoritative.
// The careful per-move judgements come from the full review instead.
const LIVE_DEPTH = 12;

export function useLiveEval(fen, enabled = true) {
  const [scoreCp, setScoreCp] = useState(null);
  const engineRef = useRef(null);
  // Which position we actually want right now. Stepping quickly through a
  // game fires this faster than the engine can answer, so answers that
  // arrive for an old position get thrown away rather than flickering onto
  // the bar.
  const wantedFenRef = useRef(fen);

  useEffect(() => {
    if (!enabled) return;
    if (!engineRef.current) engineRef.current = new Engine();
    const engine = engineRef.current;

    wantedFenRef.current = fen;
    let abandoned = false;

    engine
      .evaluate(fen, LIVE_DEPTH)
      .then((result) => {
        if (abandoned || wantedFenRef.current !== fen) return;
        setScoreCp(result.scoreCp);
      })
      .catch(() => {});

    return () => {
      abandoned = true;
    };
  }, [fen, enabled]);

  // Shut the engine down when the board goes away, so it isn't left running.
  useEffect(() => {
    return () => {
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, []);

  return scoreCp;
}
