import { useState } from "react";
import GamesListPage from "./pages/GamesListPage";
import GameViewerPage from "./pages/GameViewerPage";
import "./App.css";

function App() {
  const [selectedGame, setSelectedGame] = useState(null);

  return (
    <>
      <header className="app-header">
        <h1>Chess DNA</h1>
        <span className="tagline">how you specifically lose</span>
      </header>

      <main className="app-main">
        {selectedGame ? (
          <GameViewerPage game={selectedGame} onBack={() => setSelectedGame(null)} />
        ) : (
          <GamesListPage onOpenGame={setSelectedGame} />
        )}
      </main>
    </>
  );
}

export default App;
