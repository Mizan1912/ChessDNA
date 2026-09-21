import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { Logo } from "../components/Icon";
import { STARTING_FEN } from "../lib/pgnToMoves";
import "./OnboardingPage.css";

// The hero board quietly plays through an opening on a loop — the board is
// the brand, and a board that moves says "this is about your games" before
// a word is read. Held still for anyone whose device asks for reduced motion.
const DEMO_LINE = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d4", "exd4", "cxd4", "Bb4+"];
const DEMO_STEP_MS = 1400;
const DEMO_PAUSE_STEPS = 3; // linger on the final position before starting over

function useDemoPositions() {
  return useMemo(() => {
    const board = new Chess();
    const positions = [STARTING_FEN];
    for (const san of DEMO_LINE) {
      board.move(san);
      positions.push(board.fen());
    }
    return positions;
  }, []);
}

// Shown once, before either the guest or signed-in path has a Chess.com
// username to work with. Two shapes:
// - Not signed in at all: choose "Sign in with Google" (saves your username
//   permanently) or type a username and continue as a guest (nothing saved,
//   asked again next visit).
// - Signed in but no saved username yet (fresh account, or signed in on a
//   new device): just the username step, since Google already told us who
//   they are.
export default function OnboardingPage({ needsUsernameOnly, userName, onSignInCredential, onGuestContinue, onUsernameSubmit }) {
  const [usernameInput, setUsernameInput] = useState("");
  const positions = useDemoPositions();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      setStep((current) => (current + 1) % (positions.length + DEMO_PAUSE_STEPS));
    }, DEMO_STEP_MS);
    return () => clearInterval(timer);
  }, [positions.length]);

  const fen = positions[Math.min(step, positions.length - 1)];

  function handleGuestContinue(event) {
    event.preventDefault();
    if (!usernameInput.trim()) return;
    onGuestContinue(usernameInput);
  }

  function handleUsernameOnlySubmit(event) {
    event.preventDefault();
    if (!usernameInput.trim()) return;
    onUsernameSubmit(usernameInput);
  }

  return (
    <div className="onboarding">
      <div className="onboarding-copy page-enter">
        <div className="onboarding-brand">
          <Logo size={44} />
          <span className="wordmark">
            Chess <span className="accent-em">DNA</span>
          </span>
        </div>

        <h1 className="onboarding-title">
          Find out how you <span className="accent-em">specifically</span> lose.
        </h1>
        <p className="onboarding-lead">
          Not "you're weak in endgames" — everyone is. The mistakes that are yours: when you tilt, where your clock goes,
          the blunders you keep repeating. Every finding links to the real positions behind it.
        </p>

        <div className="onboarding-card card">
          {needsUsernameOnly ? (
            <>
              <p className="onboarding-welcome">
                Welcome, <strong>{userName}</strong>. One more thing — what's your Chess.com username?
              </p>
              <form onSubmit={handleUsernameOnlySubmit} className="onboarding-form">
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(event) => setUsernameInput(event.target.value)}
                  placeholder="Chess.com username"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                  autoFocus
                />
                <button type="submit" className="btn-primary">
                  Continue
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="onboarding-signin">
                <GoogleSignInButton variant="full" onCredential={(credential) => onSignInCredential(credential, usernameInput)} />
                <span className="muted signin-note">Saves your username, so you never type it again.</span>
              </div>

              <div className="onboarding-divider">
                <span>or try it as a guest</span>
              </div>

              <form onSubmit={handleGuestContinue} className="onboarding-form">
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(event) => setUsernameInput(event.target.value)}
                  placeholder="Chess.com username"
                  aria-label="Chess.com username"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                <button type="submit" className="btn-primary">
                  Continue as guest
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <div className="onboarding-visual" aria-hidden="true">
        <div className="hero-halo" />
        <div className="hero-board">
          <Chessboard options={{ position: fen, allowDragging: false, showNotation: false, animationDurationInMs: 600 }} />
        </div>
      </div>
    </div>
  );
}
