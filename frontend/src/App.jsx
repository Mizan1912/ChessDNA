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
  const [selectedGame, setSelectedGame] = useState(null);
  const [activeView, setActiveView] = useState("list");
  const fetched = useFetchedGames();

  function renderMain() {
    if (selectedGame) {
      return <GameViewerPage game={selectedGame} onBack={() => setSelectedGame(null)} />;
    }
    if (activeView === "tilt") {
      return <TiltPage games={fetched.filteredGames} onBack={() => setActiveView("list")} onOpenGame={setSelectedGame} />;
    }
    if (activeView === "clock") {
      return <ClockPage games={fetched.filteredGames} onBack={() => setActiveView("list")} onOpenGame={setSelectedGame} />;
    }
    return (
      <GamesListPage
        onOpenGame={setSelectedGame}
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
        {fetched.games.length > 0 && !selectedGame && (
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
        {!selectedGame && (
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
