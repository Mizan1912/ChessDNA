import { useEffect, useRef, useState } from "react";
import GamesListPage from "./pages/GamesListPage";
import GameViewerPage from "./pages/GameViewerPage";
import TiltPage from "./pages/TiltPage";
import ClockPage from "./pages/ClockPage";
import BlundersPage from "./pages/BlundersPage";
import OnboardingPage from "./pages/OnboardingPage";
import TimeClassTabs from "./components/TimeClassTabs";
import GoogleSignInButton from "./components/GoogleSignInButton";
import { useFetchedGames } from "./hooks/useFetchedGames";
import { useBlunderScan } from "./hooks/useBlunderScan";
import { useAuth } from "./hooks/useAuth";
import { saveChessComUsername } from "./lib/backendApi";
import "./App.css";

const VIEWS = [
  { key: "list", label: "Games list" },
  { key: "tilt", label: "Tilt findings" },
  { key: "clock", label: "Clock" },
  { key: "blunders", label: "Blunders" },
];

function App() {
  // moveIndex lets a finding (e.g. the clock page's "longest think") open
  // the viewer already sitting on the exact move it's talking about, instead
  // of always starting from move 0 and making the user click forward to it.
  const [openedGame, setOpenedGame] = useState(null); // { game, moveIndex } | null
  const [activeView, setActiveView] = useState("list");
  const fetched = useFetchedGames();
  const auth = useAuth();
  // Lives up here, not inside BlundersPage: opening a game from the blunder
  // list unmounts that page, and a scan takes minutes — losing the results
  // just for looking at one of them would be miserable.
  const blunderScan = useBlunderScan();

  // The onboarding screen (sign in, or continue as guest) shows until it's
  // explicitly dismissed by completing one of those two paths — a signed-in
  // user who already has a saved username skips it automatically (handled
  // below), so this only stays relevant for first-time visitors.
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const showOnboarding = auth.checkedSession && !onboardingDismissed && !auth.user?.chessComUsername;

  // Runs once, right after we learn whether someone's already signed in
  // (from a previous visit's cookie). If they are, and they have a saved
  // Chess.com username, fill it in and fetch automatically — this is the
  // whole point of Phase 3: come back tomorrow and your games are just
  // there, no retyping, no onboarding screen either.
  const hasAutoFetched = useRef(false);
  useEffect(() => {
    if (!auth.checkedSession || hasAutoFetched.current) return;
    hasAutoFetched.current = true;
    if (auth.user?.chessComUsername) {
      fetched.setUsername(auth.user.chessComUsername);
      fetched.fetchGames(undefined, auth.user.chessComUsername);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.checkedSession]);

  function startUsingApp(username) {
    fetched.setUsername(username);
    fetched.fetchGames(undefined, username);
    setOnboardingDismissed(true);
  }

  // From the onboarding screen's Google button. Carries along whatever
  // username was already typed in that screen's guest field, in case
  // someone types it and THEN decides to sign in rather than go guest.
  async function handleOnboardingSignIn(credential, typedUsername) {
    const signedInUser = await auth.signIn(credential);
    const trimmed = typedUsername.trim();

    if (signedInUser.chessComUsername) {
      startUsingApp(signedInUser.chessComUsername);
    } else if (trimmed) {
      await saveChessComUsername(trimmed);
      auth.updateChessComUsername(trimmed);
      startUsingApp(trimmed);
    }
    // else: no saved username and nothing typed yet — falls through to the
    // "needs username only" step, since auth.user is now set.
  }

  async function handleOnboardingUsernameSubmit(username) {
    const trimmed = username.trim();
    await saveChessComUsername(trimmed);
    auth.updateChessComUsername(trimmed);
    startUsingApp(trimmed);
  }

  // The header's own sign-in button (for a guest who's past onboarding and
  // decides to sign in later) — separate from the onboarding one above
  // because there's no "typed username" field sitting next to this button.
  async function handleHeaderGoogleCredential(credential) {
    const signedInUser = await auth.signIn(credential);
    const typedUsername = fetched.username.trim();
    if (typedUsername && !signedInUser.chessComUsername) {
      await saveChessComUsername(typedUsername);
      auth.updateChessComUsername(typedUsername);
    }
  }

  async function handleFetchGames(event) {
    await fetched.fetchGames(event);
    // Save whatever username was just used, so it's remembered next time —
    // but only if signed in; guests have nowhere to save it yet.
    if (auth.user) {
      const trimmed = fetched.username.trim();
      if (trimmed && trimmed !== auth.user.chessComUsername) {
        await saveChessComUsername(trimmed);
        auth.updateChessComUsername(trimmed);
      }
    }
  }

  // `note` is an optional sentence explaining why this position matters
  // (e.g. why a move was a blunder), shown above the board.
  function openGame(game, moveIndex = -1, note = null) {
    setOpenedGame({ game, moveIndex, note });
  }

  if (!auth.checkedSession) {
    return null; // avoids flashing onboarding then immediately replacing it for returning users
  }

  if (showOnboarding) {
    return (
      <OnboardingPage
        needsUsernameOnly={Boolean(auth.user)}
        userName={auth.user?.name}
        onSignInCredential={handleOnboardingSignIn}
        onGuestContinue={startUsingApp}
        onUsernameSubmit={handleOnboardingUsernameSubmit}
      />
    );
  }

  function renderMain() {
    if (openedGame) {
      return (
        <GameViewerPage
          game={openedGame.game}
          initialMoveIndex={openedGame.moveIndex}
          note={openedGame.note}
          onBack={() => setOpenedGame(null)}
        />
      );
    }
    if (activeView === "tilt") {
      return <TiltPage games={fetched.filteredGames} onBack={() => setActiveView("list")} onOpenGame={openGame} />;
    }
    if (activeView === "clock") {
      return <ClockPage games={fetched.filteredGames} onBack={() => setActiveView("list")} onOpenGame={openGame} />;
    }
    if (activeView === "blunders") {
      return (
        <BlundersPage
          games={fetched.filteredGames}
          scan={blunderScan}
          onBack={() => setActiveView("list")}
          onOpenGame={openGame}
        />
      );
    }
    return (
      <GamesListPage
        onOpenGame={openGame}
        username={fetched.username}
        setUsername={fetched.setUsername}
        gamesToFetch={fetched.gamesToFetch}
        setGamesToFetch={fetched.setGamesToFetch}
        games={fetched.filteredGames}
        status={fetched.status}
        errorMessage={fetched.errorMessage}
        fetchGames={handleFetchGames}
      />
    );
  }

  return (
    <>
      <header className="app-header">
        <h1>Chess DNA</h1>
        <span className="tagline">how you specifically lose</span>
        <div className="header-right">
          {fetched.games.length > 0 && !openedGame && (
            <nav className="header-nav">
              {VIEWS.filter((v) => v.key !== activeView).map((v) => (
                <button key={v.key} onClick={() => setActiveView(v.key)}>
                  {v.label}
                </button>
              ))}
            </nav>
          )}
          <div className="auth-slot">
            {auth.user ? (
              <span className="signed-in-as">
                {auth.user.name} <button onClick={auth.signOut}>Sign out</button>
              </span>
            ) : (
              <GoogleSignInButton onCredential={handleHeaderGoogleCredential} />
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        {!openedGame && (
          <TimeClassTabs
            totalCount={fetched.games.length}
            tabs={fetched.timeClassTabs}
            active={fetched.timeClassFilter}
            onChange={fetched.setTimeClassFilter}
          />
        )}
        {renderMain()}
      </main>
    </>
  );
}

export default App;
