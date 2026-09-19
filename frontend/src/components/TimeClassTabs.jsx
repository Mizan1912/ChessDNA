import "./TimeClassTabs.css";

// Shared across every page that reads from useFetchedGames — the games list,
// the tilt page, and anything built later (clock, blind spots, opening fit).
// One selection here filters what all of them analyse, since a player's
// patterns can look completely different in bullet vs. rapid.
export default function TimeClassTabs({ totalCount, tabs, active, onChange }) {
  if (totalCount === 0) return null;

  return (
    <div className="time-class-tabs">
      <button className={active === "all" ? "active" : ""} onClick={() => onChange("all")}>
        All ({totalCount})
      </button>
      {tabs.map((tab) => (
        <button
          key={tab.timeClass}
          className={active === tab.timeClass ? "active" : ""}
          onClick={() => onChange(tab.timeClass)}
        >
          {tab.timeClass} ({tab.count})
        </button>
      ))}
    </div>
  );
}
