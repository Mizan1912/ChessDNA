import { useState } from "react";
import { getRecentGames, UsernameNotFoundError } from "../lib/chessComApi";
import { normalizeChessComGame } from "../lib/normalizeGame";

const DEFAULT_GAMES = 50; // see decision.md D-008 — this is just the slider's starting value

// Holds the "fetch games from Chess.com" state so more than one page (the
// list, and the tilt/clock insights page) can read the same results without
// each page fetching separately.
export function useFetchedGames() {
  const [username, setUsername] = useState("");
  const [gamesToFetch, setGamesToFetch] = useState(DEFAULT_GAMES);
  const [games, setGames] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | error | done
  const [errorMessage, setErrorMessage] = useState("");

  async function fetchGames(event) {
    event.preventDefault();
    const trimmedUsername = username.trim();
    if (!trimmedUsername) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const rawGames = await getRecentGames(trimmedUsername, gamesToFetch);
      const normalized = rawGames.map((game) => normalizeChessComGame(game, trimmedUsername));
      setGames(normalized);
      setStatus("done");
    } catch (error) {
      if (error instanceof UsernameNotFoundError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Something went wrong reaching Chess.com. Try again in a moment.");
      }
      setGames([]);
      setStatus("error");
    }
  }

  return {
    username,
    setUsername,
    gamesToFetch,
    setGamesToFetch,
    games,
    status,
    errorMessage,
    fetchGames,
  };
}
