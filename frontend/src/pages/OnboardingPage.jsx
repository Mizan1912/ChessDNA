import { useState } from "react";
import { Chessboard } from "react-chessboard";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { STARTING_FEN } from "../lib/pgnToMoves";
import "./OnboardingPage.css";

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
    <div className="onboarding-layout">
      <div className="onboarding-main">
        <h1>Chess DNA</h1>
        <p className="onboarding-tagline">how you specifically lose</p>

        {needsUsernameOnly ? (
          <>
            <p className="onboarding-lead">
              Welcome, {userName}. One more thing — what's your Chess.com username?
            </p>
            <form onSubmit={handleUsernameOnlySubmit} className="onboarding-form">
              <input
                type="text"
                value={usernameInput}
                onChange={(event) => setUsernameInput(event.target.value)}
                placeholder="e.g. hikaru"
                autoFocus
              />
              <button type="submit">Continue</button>
            </form>
          </>
        ) : (
          <>
            <p className="onboarding-lead">
              Sign in to save your Chess.com username permanently — or continue as a guest and type
              it again next time.
            </p>

            <div className="onboarding-signin">
              <GoogleSignInButton onCredential={(credential) => onSignInCredential(credential, usernameInput)} />
            </div>

            <div className="onboarding-divider">or</div>

            <form onSubmit={handleGuestContinue} className="onboarding-form">
              <input
                type="text"
                value={usernameInput}
                onChange={(event) => setUsernameInput(event.target.value)}
                placeholder="Chess.com username"
              />
              <button type="submit">Continue as guest</button>
            </form>
          </>
        )}
      </div>

      <div className="onboarding-board-panel">
        <Chessboard options={{ position: STARTING_FEN, allowDragging: false }} />
      </div>
    </div>
  );
}
