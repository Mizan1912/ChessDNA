import { useState } from "react";
import GamesListPage from "./pages/GamesListPage";
import GameViewerPage from "./pages/GameViewerPage";
import TiltPage from "./pages/TiltPage";
import TimeClassTabs from "./components/TimeClassTabs";
import { useFetchedGames } from "./hooks/useFetchedGames";
import "./App.css";

function App() {
  const [selectedGame, setSelectedGame] = useState(null);
  const [showTilt, setShowTilt] = useState(false);
  const fetched = useFetchedGames();

  function renderMain() {
    if (selectedGame) {
      return <GameViewerPage game={selectedGame} onBack={() => setSelectedGame(null)} />;
    }
    if (showTilt) {
      return (
        <TiltPage games={fetched.filteredGames} onBack={() => setShowTilt(false)} onOpenGame={setSelectedGame} />
      );
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
          <button className="header-tilt-link" onClick={() => setShowTilt((v) => !v)}>
            {showTilt ? "Games list" : "Tilt findings"}
          </button>
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
