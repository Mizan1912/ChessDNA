import { useState } from "react";
import GamesListPage from "./pages/GamesListPage";
import GameViewerPage from "./pages/GameViewerPage";
import TiltPage from "./pages/TiltPage";
import ClockPage from "./pages/ClockPage";
import TimeClassTabs from "./components/TimeClassTabs";
import { useFetchedGames } from "./hooks/useFetchedGames";
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
        fetchGames={fetched.fetchGames}
      />
    );
  }

  return (
    <>
      <header className="app-header">
        <h1>Chess DNA</h1>
        <span className="tagline">how you specifically lose</span>
        {fetched.games.length > 0 && !openedGame && (
          <nav className="header-nav">
            {VIEWS.filter((v) => v.key !== activeView).map((v) => (
              <button key={v.key} onClick={() => setActiveView(v.key)}>
                {v.label}
              </button>
            ))}
          </nav>
        )}
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
