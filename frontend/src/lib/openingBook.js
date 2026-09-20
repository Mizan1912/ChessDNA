// A small opening book, so the first few moves of a game are labelled "Book"
// (known theory) instead of being credited or blamed on the player.
//
// Chess.com decides this from a master-games database of millions of games.
// We can't ship that, so this is a hand-written list of mainstream openings
// and their main lines. The consequence is deliberate and one-directional:
// this book UNDER-fires. A genuine theory move that isn't listed here gets
// labelled Best or Excellent instead of Book — which is merely less
// informative. It never claims a move is theory when it isn't.
//
// See decision.md D-041.

// Each entry is one main line in SAN, space-separated. A move is "book" while
// the whole game so far still matches the start of at least one of these.
const LINES = [
  // --- 1.e4 e5 ---
  "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7", // Ruy Lopez, Closed
  "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O", // Ruy Lopez, Exchange
  "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6", // Ruy Lopez, Berlin
  "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4", // Italian
  "e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5", // Evans Gambit
  "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5", // Two Knights
  "e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5 c3 d6", // Italian, Giuoco Pianissimo
  "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nc3 Bb4", // Scotch
  "e4 e5 Nf3 Nc6 d4 exd4 Bc4 Bc5", // Scotch Gambit
  "e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4", // Four Knights
  "e4 e5 Nf3 Nc6 c3 Nf6 d4 Nxe4", // Ponziani
  "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5", // Petrov
  "e4 e5 Nf3 d6 d4 exd4 Nxd4 Nf6 Nc3 Be7", // Philidor
  "e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4", // Vienna Gambit
  "e4 e5 Nc3 Nc6 Bc4 Bc5", // Vienna
  "e4 e5 Bc4 Nf6 d3 c6", // Bishop's Opening
  "e4 e5 f4 exf4 Nf3 g5 h4 g4", // King's Gambit
  "e4 e5 d4 exd4 Qxd4 Nc6 Qe3", // Centre Game

  // --- Sicilian ---
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6", // Najdorf
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6", // Dragon
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6", // Classical
  "e4 c5 Nf3 d6 Bb5+ Bd7 Bxd7+ Qxd7", // Moscow
  "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5", // Sveshnikov
  "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 Nc3 Bg7", // Accelerated Dragon
  "e4 c5 Nf3 Nc6 Bb5 g6", // Rossolimo
  "e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nc3 Qc7", // Taimanov
  "e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6 Nc3 Qc7", // Kan
  "e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nf6 Nc3 d6", // Scheveningen
  "e4 c5 c3 d5 exd5 Qxd5 d4 Nf6", // Alapin
  "e4 c5 c3 Nf6 e5 Nd5 d4 cxd4", // Alapin, 2...Nf6
  "e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7", // Closed Sicilian
  "e4 c5 d4 cxd4 c3 dxc3 Nxc3 Nc6", // Smith-Morra
  "e4 c5 f4 d5 exd5 Nf6", // Grand Prix

  // --- French ---
  "e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7", // French, Classical
  "e4 e6 d4 d5 Nc3 Bb4 e5 c5", // Winawer
  "e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7", // Tarrasch
  "e4 e6 d4 d5 e5 c5 c3 Nc6", // Advance
  "e4 e6 d4 d5 exd5 exd5 Nf3 Nf6", // Exchange

  // --- Caro-Kann ---
  "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5", // Classical
  "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7", // Karpov
  "e4 c6 d4 d5 e5 Bf5 Nf3 e6", // Advance
  "e4 c6 d4 d5 exd5 cxd5 c4 Nf6", // Panov
  "e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6", // Exchange
  "e4 c6 Nf3 d5 Nc3 Bg4", // Two Knights

  // --- Other 1.e4 ---
  "e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6", // Scandinavian
  "e4 d5 exd5 Nf6 d4 Nxd5", // Scandinavian, 2...Nf6
  "e4 Nf6 e5 Nd5 d4 d6 Nf3 g6", // Alekhine
  "e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7", // Pirc
  "e4 g6 d4 Bg7 Nc3 d6 Nf3", // Modern

  // --- 1.d4 d5 ---
  "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7", // Queen's Gambit Declined
  "d4 d5 c4 e6 Nc3 c5 cxd5 exd5", // Tarrasch Defence
  "d4 d5 c4 dxc4 Nf3 Nf6 e3 e6", // Queen's Gambit Accepted
  "d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4", // Slav
  "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6", // Semi-Slav
  "d4 d5 c4 Nc6", // Chigorin
  "d4 d5 Bf4 Nf6 e3 e6 Nf3 c5", // London
  "d4 d5 Nf3 Nf6 e3 e6 Bd3 c5", // Colle

  // --- 1.d4 Nf6 ---
  "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O", // Nimzo-Indian
  "d4 Nf6 c4 e6 Nf3 b6 g3 Ba6", // Queen's Indian
  "d4 Nf6 c4 e6 Nf3 Bb4+ Bd2 Qe7", // Bogo-Indian
  "d4 Nf6 c4 e6 g3 d5 Bg2 Be7", // Catalan
  "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O", // King's Indian
  "d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3", // Grünfeld
  "d4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6", // Benoni
  "d4 Nf6 c4 c5 d5 b5", // Benko Gambit
  "d4 Nf6 Nf3 g6 Bf4 Bg7", // London vs King's Indian setup
  "d4 Nf6 Bg5 Ne4", // Trompowsky
  "d4 Nf6 Nf3 e6 Bg5 h6", // Torre

  // --- Other 1.d4 ---
  "d4 f5 g3 Nf6 Bg2 e6 Nf3 Be7", // Dutch
  "d4 e6 c4 f5", // Dutch via 1...e6

  // --- Flank openings ---
  "c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5", // English, Reversed Sicilian
  "c4 c5 Nf3 Nf6 Nc3 Nc6 g3 g6", // English, Symmetrical
  "c4 Nf6 Nc3 e6 Nf3 d5", // English, Anglo-Indian
  "Nf3 d5 c4 e6 g3 Nf6 Bg2 Be7", // Réti
  "Nf3 d5 g3 Nf6 Bg2 e6 O-O Be7", // King's Indian Attack
  "Nf3 Nf6 c4 g6 Nc3 Bg7", // Réti into Indian
  "f4 d5 Nf3 Nf6 e3 g6", // Bird
  "g3 d5 Bg2 e5", // Benko / hypermodern
  "b3 e5 Bb2 Nc6", // Larsen
];

// Every prefix of every line, so "is the game still in book?" is one lookup.
const PREFIXES = (() => {
  const set = new Set();
  for (const line of LINES) {
    const moves = line.split(" ");
    for (let length = 1; length <= moves.length; length++) {
      set.add(moves.slice(0, length).join(" "));
    }
  }
  return set;
})();

// The deepest line in the book — nothing past this can possibly be book, so
// callers can stop asking.
export const BOOK_MAX_PLIES = Math.max(...LINES.map((line) => line.split(" ").length));

/**
 * Is the move at the end of this SAN sequence still known theory?
 * `sanSoFar` is every move of the game up to and including the one being
 * judged, in order.
 */
export function isBookMove(sanSoFar) {
  if (sanSoFar.length === 0 || sanSoFar.length > BOOK_MAX_PLIES) return false;
  return PREFIXES.has(sanSoFar.join(" "));
}
