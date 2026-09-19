import { useState } from "react";
import { getRecentGames, UsernameNotFoundError } from "../lib/chessComApi";
import { normalizeChessComGame } from "../lib/normalizeGame";
import { timeClassTabs, filterByTimeClass } from "../lib/timeClass";

const DEFAULT_GAMES = 50; // see decision.md D-008 — this is just the slider's starting value

// Holds the "fetch games from Chess.com" state, PLUS which time class
// (bullet/blitz/rapid/daily/all) is currently selected. Every page that reads
// from this hook gets `filteredGames`, already narrowed to the active time
// class — this is deliberate: a player's tilt, clock habits, and everything
// else this app measures can differ a lot between formats, so every feature
// should look at one format at a time, not "all games" blended together.
// See decision.md D-019.
export function useFetchedGames() {
  const [username, setUsername] = useState("");
  const [gamesToFetch, setGamesToFetch] = useState(DEFAULT_GAMES);
  const [games, setGames] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | error | done
  const [errorMessage, setErrorMessage] = useState("");
  const [timeClassFilter, setTimeClassFilter] = useState("all");

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
      setTimeClassFilter("all"); // a fresh fetch shouldn't keep last fetch's filter selection
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
    timeClassFilter,
    setTimeClassFilter,
    timeClassTabs: timeClassTabs(games),
    filteredGames: filterByTimeClass(games, timeClassFilter),
  };
}
