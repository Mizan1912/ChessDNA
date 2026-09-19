import { useEffect, useRef } from "react";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Wraps Google Identity Services' own button — that script (loaded in
// index.html) attaches a global `window.google` object once it's ready,
// which is why this waits for it instead of importing anything.
export default function GoogleSignInButton({ onCredential }) {
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
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "medium",
      });
    }, 100);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={buttonRef} />;
}
