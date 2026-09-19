// Chess.com's known time classes, in the order we want tabs to appear.
// Anything outside this list (rare) still gets a tab, just tacked on at the end.
const KNOWN_TIME_CLASS_ORDER = ["bullet", "blitz", "rapid", "daily"];

// Counts how many games fall into each time class, for the tab labels.
export function timeClassTabs(games) {
  const counts = new Map();
  for (const game of games) {
    counts.set(game.timeClass, (counts.get(game.timeClass) || 0) + 1);
  }

  const known = KNOWN_TIME_CLASS_ORDER.filter((tc) => counts.has(tc));
  const unknown = [...counts.keys()].filter((tc) => !KNOWN_TIME_CLASS_ORDER.includes(tc));

  return [...known, ...unknown].map((timeClass) => ({ timeClass, count: counts.get(timeClass) }));
}

// Applies the active tab. "all" (or a class that no longer exists in this
// game set, e.g. after a new fetch) falls back to every game rather than
// silently showing an empty page.
export function filterByTimeClass(games, activeTimeClass) {
  if (activeTimeClass === "all") return games;
  const hasMatch = games.some((g) => g.timeClass === activeTimeClass);
  return hasMatch ? games.filter((g) => g.timeClass === activeTimeClass) : games;
}
