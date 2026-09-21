import { useEffect, useRef, useState } from "react";
import GamesListPage from "./pages/GamesListPage";
import GameViewerPage from "./pages/GameViewerPage";
import TiltPage from "./pages/TiltPage";
import ClockPage from "./pages/ClockPage";
import BlundersPage from "./pages/BlundersPage";
import OnboardingPage from "./pages/OnboardingPage";
import TimeClassTabs from "./components/TimeClassTabs";
import GoogleSignInButton from "./components/GoogleSignInButton";
import EmptyState from "./components/EmptyState";
import Icon, { Logo } from "./components/Icon";
import { useFetchedGames } from "./hooks/useFetchedGames";
import { useBlunderScan } from "./hooks/useBlunderScan";
import { useAuth } from "./hooks/useAuth";
import { useMediaQuery, MOBILE_QUERY } from "./hooks/useMediaQuery";
import { saveChessComUsername } from "./lib/backendApi";
import "./App.css";

// The four screens, in the order they appear in the rail and the tab bar.
const VIEWS = [
  { key: "list", label: "Games", icon: "games" },
  { key: "tilt", label: "Tilt", icon: "tilt" },
  { key: "clock", label: "Clock", icon: "clock" },
  { key: "blunders", label: "Blunders", icon: "blunders" },
];

// Signed in: your initial in a gold ring, which opens a small menu with your
// name and "Sign out". Signed out: Google's own compact sign-in button.
function AccountButton({ user, onSignOut, onGoogleCredential, menuPlacement }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  // Close the menu on any tap outside it — the behaviour everyone expects,
  // and the only way to dismiss it on a phone.
  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  if (!user) return <GoogleSignInButton variant="compact" onCredential={onGoogleCredential} />;

  const initial = (user.name ?? "?").trim().charAt(0).toUpperCase();
  return (
    <div className="account" ref={rootRef}>
      <button
        className="avatar"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Account: ${user.name}`}
        aria-expanded={open}
      >
        {initial}
      </button>
      {open && (
        <div className={`account-menu glass account-menu-${menuPlacement}`} role="menu">
          <span className="eyebrow">Signed in as</span>
          <strong className="account-name">{user.name}</strong>
          <button className="btn-ghost account-signout" role="menuitem" onClick={onSignOut}>
            <Icon name="logout" size={18} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

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
  const isMobile = useMediaQuery(MOBILE_QUERY);

  // --- the browser's own back button ---
  // There's no router yet (the doc brings in react-router later), but a
  // phone's back gesture has to work NOW: without this, pressing back inside
  // a game didn't return to the list — it left the site entirely. Each
  // screen change is recorded in the browser's history, and going back
  // restores the screen that was there before.
  useEffect(() => {
    window.history.replaceState({ view: "list" }, "");
    const onPopState = (event) => {
      const state = event.state ?? { view: "list" };
      setActiveView(state.view ?? "list");
      if (!state.game) setOpenedGame(null);
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(view) {
    if (view === activeView && !openedGame) return;
    setOpenedGame(null);
    setActiveView(view);
    window.history.pushState({ view }, "");
    window.scrollTo(0, 0);
  }

  // Leaving a game goes BACK in history rather than forward to the list, so
  // the in-app back button and the phone's back gesture stay the same thing.
  function closeGame() {
    if (window.history.state?.game) window.history.back();
    else setOpenedGame(null);
  }

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
    window.history.pushState({ view: activeView, game: true }, "");
    window.scrollTo(0, 0);
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
          onBack={closeGame}
        />
      );
    }

    // Tilt, Clock and Blunders all read the fetched games. Before there are
    // any, say so and offer the way forward — never a blank page, never a
    // page of zeros pretending to be findings.
    if (activeView !== "list" && fetched.games.length === 0) {
      return (
        <EmptyState
          icon={VIEWS.find((v) => v.key === activeView)?.icon}
          title="Fetch your games first"
          body="Every finding here is worked out from your own games. Load them on the Games screen and this page fills itself in."
          actionLabel="Go to Games"
          onAction={() => navigate("list")}
        />
      );
    }
    if (activeView === "tilt") return <TiltPage games={fetched.filteredGames} onOpenGame={openGame} filterTabs={filterTabs} onGoToGames={() => navigate("list")} />;
    if (activeView === "clock") return <ClockPage games={fetched.filteredGames} onOpenGame={openGame} filterTabs={filterTabs} />;
    if (activeView === "blunders") {
      return <BlundersPage games={fetched.filteredGames} scan={blunderScan} onOpenGame={openGame} filterTabs={filterTabs} />;
    }
    return (
      <GamesListPage
        onOpenGame={openGame}
        username={fetched.username}
        setUsername={fetched.setUsername}
        gamesToFetch={fetched.gamesToFetch}
        setGamesToFetch={fetched.setGamesToFetch}
        games={fetched.filteredGames}
        allGamesCount={fetched.games.length}
        timeClassFilter={fetched.timeClassFilter}
        status={fetched.status}
        errorMessage={fetched.errorMessage}
        fetchGames={handleFetchGames}
        filterTabs={filterTabs}
      />
    );
  }

  // Each page places the time-control filter itself, right under its own
  // heading — a filter above the page title gets the order backwards.
  const filterTabs = (
    <TimeClassTabs
      totalCount={fetched.games.length}
      tabs={fetched.timeClassTabs}
      active={fetched.timeClassFilter}
      onChange={fetched.setTimeClassFilter}
    />
  );

  const account = (placement) => (
    <AccountButton
      user={auth.user}
      onSignOut={auth.signOut}
      onGoogleCredential={handleHeaderGoogleCredential}
      menuPlacement={placement}
    />
  );

  const navItems = VIEWS.map((view) => (
    <button
      key={view.key}
      className={`nav-item${view.key === activeView ? " active" : ""}`}
      onClick={() => navigate(view.key)}
      aria-current={view.key === activeView ? "page" : undefined}
    >
      <Icon name={view.icon} size={22} />
      <span>{view.label}</span>
    </button>
  ));

  // Inside a game on a phone, the board needs every pixel: the viewer brings
  // its own slim top bar and its own bottom controls, so the app's bars step
  // aside.
  const viewerOnPhone = isMobile && openedGame;
  // Replays the page-arrival animation on every screen change.
  const screenKey = openedGame ? `game-${openedGame.game.id}` : activeView;

  return (
    <div className={`shell${isMobile ? " shell-mobile" : ""}`}>
      {!isMobile && (
        <aside className="rail glass" aria-label="Main">
          <div className="rail-brand" title="Chess DNA">
            <Logo size={40} />
          </div>
          <nav className="rail-nav">{navItems}</nav>
          <div className="rail-account">{account("rail")}</div>
        </aside>
      )}

      {isMobile && !viewerOnPhone && (
        <header className="topbar glass">
          <div className="topbar-brand">
            <Logo size={30} />
            <span className="wordmark">
              Chess <span className="accent-em">DNA</span>
            </span>
          </div>
          {account("topbar")}
        </header>
      )}

      <main className={`content${viewerOnPhone ? " content-viewer" : ""}`}>
        <div key={screenKey} className="page page-enter">
          {renderMain()}
        </div>
      </main>

      {isMobile && !viewerOnPhone && (
        <nav className="tabbar glass" aria-label="Main">
          {navItems}
        </nav>
      )}
    </div>
  );
}

export default App;
