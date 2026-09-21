// How a length of time reads anywhere in the app. Nobody reads "674s";
// everyone reads "11m 14s". Under ten seconds keeps one decimal, because
// that's exactly where tenths matter (a 0.4s premove vs a 4s think).
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return null;
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const whole = Math.round(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = whole % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

// An engine evaluation as chess sites show it, always from White's side:
// "+1.3" (White better), "-6.8" (Black better), "M3" / "-M3" for a forced
// mate. Mate scores arrive from engine.js as 100000 minus 100 per move.
const MATE_THRESHOLD_CP = 90000;
export function formatEval(scoreCp) {
  if (scoreCp === null || scoreCp === undefined || Number.isNaN(scoreCp)) return null;
  if (Math.abs(scoreCp) >= MATE_THRESHOLD_CP) {
    const movesToMate = Math.max(1, Math.round((100000 - Math.abs(scoreCp)) / 100));
    return `${scoreCp > 0 ? "" : "-"}M${movesToMate}`;
  }
  // Rounded first, so a tiny negative like -3cp reads "0.0", not "-0.0".
  const pawns = Math.round(scoreCp / 10) / 10;
  if (pawns === 0) return "0.0";
  return `${pawns > 0 ? "+" : ""}${pawns.toFixed(1)}`;
}
