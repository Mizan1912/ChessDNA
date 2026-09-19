import { useEffect, useRef, useState } from "react";
import GamesListPage from "./pages/GamesListPage";
import GameViewerPage from "./pages/GameViewerPage";
import TiltPage from "./pages/TiltPage";
import ClockPage from "./pages/ClockPage";
import TimeClassTabs from "./components/TimeClassTabs";
import GoogleSignInButton from "./components/GoogleSignInButton";
import { useFetchedGames } from "./hooks/useFetchedGames";
import { useAuth } from "./hooks/useAuth";
import { saveChessComUsername } from "./lib/backendApi";
import "./App.css";

const VIEWS = [
  { key: "list", label: "Games list" },
  { key: "tilt", label: "Tilt findings" },
  { key: "clock", label: "Clock" },
];

function App() {
  // moveIndex lets a finding (e.g. the clock page's "longest think") open
  // the viewer already sitting on the exact move it's talking about, instead
  // of always starting from move 0 and making the user click forward to it.
  const [openedGame, setOpenedGame] = useState(null); // { game, moveIndex } | null
  const [activeView, setActiveView] = useState("list");
  const fetched = useFetchedGames();
  const auth = useAuth();

  // Runs once, right after we learn whether someone's already signed in
  // (from a previous visit's cookie). If they are, and they have a saved
  // Chess.com username, fill it in and fetch automatically — this is the
  // whole point of Phase 3: come back tomorrow and your games are just
  // there, no retyping.
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

  async function handleGoogleCredential(credential) {
    const signedInUser = await auth.signIn(credential);
    // Guest-to-account migration: if they'd already typed a username before
    // signing in, save it to their new account instead of losing it.
    const typedUsername = fetched.username.trim();
    if (typedUsername && !signedInUser.chessComUsername) {
      await saveChessComUsername(typedUsername);
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
      }
    }
  }

  function openGame(game, moveIndex = -1) {
    setOpenedGame({ game, moveIndex });
  }

  function renderMain() {
    if (openedGame) {
      return (
        <GameViewerPage
          game={openedGame.game}
          initialMoveIndex={openedGame.moveIndex}
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
            {auth.checkedSession &&
              (auth.user ? (
                <span className="signed-in-as">
                  {auth.user.name} <button onClick={auth.signOut}>Sign out</button>
                </span>
              ) : (
                <GoogleSignInButton onCredential={handleGoogleCredential} />
              ))}
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
