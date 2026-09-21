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
