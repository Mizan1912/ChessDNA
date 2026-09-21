import { useLayoutEffect, useRef, useState } from "react";
import "./TimeClassTabs.css";

// Shared across every page that reads from useFetchedGames — the games list,
// the tilt page, and anything built later (clock, blind spots, opening fit).
// One selection here filters what all of them analyse, since a player's
// patterns can look completely different in bullet vs. rapid.
//
// Drawn as a segmented control: a gold pill slides under whichever option is
// chosen, rather than options simply swapping colour, so the eye follows the
// change. Scrolls sideways on a narrow phone rather than wrapping.
export default function TimeClassTabs({ totalCount, tabs, active, onChange }) {
  const trackRef = useRef(null);
  const [indicator, setIndicator] = useState(null);

  const options = [{ key: "all", label: "All", count: totalCount }].concat(
    tabs.map((tab) => ({ key: tab.timeClass, label: tab.timeClass, count: tab.count }))
  );

  // Measure the chosen option and move the pill to it. Layout effect, so it
  // lands before the browser paints and never visibly flickers into place.
  useLayoutEffect(() => {
    const track = trackRef.current;
    const button = track?.querySelector(`[data-key="${active}"]`);
    if (!button) return;
    setIndicator({ left: button.offsetLeft, width: button.offsetWidth });
    // Keep the chosen option visible when the row scrolls sideways — scrolling
    // only this row, never the page.
    const overflowRight = button.offsetLeft + button.offsetWidth - (track.scrollLeft + track.clientWidth);
    if (overflowRight > 0 || button.offsetLeft < track.scrollLeft) {
      track.scrollTo({ left: button.offsetLeft - 12, behavior: "smooth" });
    }
  }, [active, totalCount, tabs.length]);

  if (totalCount === 0) return null;

  return (
    <div className="time-class-tabs glass" ref={trackRef} role="tablist" aria-label="Time control">
      {indicator && (
        <span className="tab-indicator" style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }} />
      )}
      {options.map((option) => (
        <button
          key={option.key}
          data-key={option.key}
          role="tab"
          aria-selected={active === option.key}
          className={active === option.key ? "active" : ""}
          onClick={() => onChange(option.key)}
        >
          <span className="tab-label">{option.label}</span>
          <span className="tab-count">{option.count}</span>
        </button>
      ))}
    </div>
  );
}
