import { useEffect, useRef } from "react";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Google draws this button itself (inside its own frame), so it can't be
// styled with our CSS — only chosen from Google's own options. These are the
// two that fit a dark, gold-accented app:
//  - "full":    the complete "Sign in with Google" pill, for onboarding
//  - "compact": just the round G, for the tight space in the side rail and
//               the phone's top bar
const VARIANTS = {
  full: { type: "standard", theme: "filled_black", shape: "pill", size: "large", text: "signin_with" },
  compact: { type: "icon", theme: "filled_black", shape: "circle", size: "large" },
};

// Wraps Google Identity Services' own button — that script (loaded in
// index.html) attaches a global `window.google` object once it's ready,
// which is why this waits for it instead of importing anything.
export default function GoogleSignInButton({ onCredential, variant = "full" }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    // The Google script tag is loaded with `async defer` (index.html), so it
    // can easily still be loading when this component first mounts — poll
    // briefly instead of assuming it's already there.
    const interval = setInterval(() => {
      if (!window.google?.accounts?.id || !buttonRef.current) return;
      clearInterval(interval);

      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => onCredential(response.credential),
      });
      buttonRef.current.innerHTML = ""; // never two buttons stacked in one slot
      window.google.accounts.id.renderButton(buttonRef.current, VARIANTS[variant] ?? VARIANTS.full);
    }, 100);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  return <div ref={buttonRef} className={`google-button google-button-${variant}`} />;
}
