import { useEffect, useState } from "react";

// True while a CSS media query matches, updating live as the window resizes
// or a phone rotates. For the few places layout can't be left to CSS alone —
// e.g. the Google sign-in button, which is a third-party widget that must be
// rendered in exactly one place, not rendered twice and one copy hidden.
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);

  return matches;
}

// The one breakpoint the whole app shell switches on: below it, a top bar and
// a bottom tab bar (thumb reach); above it, a side rail.
export const MOBILE_QUERY = "(max-width: 899px)";

// Whether the device can hover at all. Touch screens can't, so anything
// that only appears on hover needs a different path there.
export const CAN_HOVER_QUERY = "(hover: hover) and (pointer: fine)";
