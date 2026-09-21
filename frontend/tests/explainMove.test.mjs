// Every claim the move explanations make is supposed to be checked on the
// board. These tests pin that down with positions where the truth is known —
// including the cases where a sentence must NOT appear.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { explainMove } from "../src/lib/explainMove.js";

// Builds an explainMove input by playing `before` from the start (or from a
// FEN), then `san`.
function moveFrom(start, before, san, extra = {}) {
  const board = new Chess(start);
  for (const m of before) board.move(m);
  const fenBefore = board.fen();
  const moveNumber = board.moveNumber();
  const played = board.move(san);
  return {
    san: played.san,
    color: played.color,
    moveNumber,
    fenBefore,
    fenAfter: board.fen(),
    evalBeforeCp: 20,
    evalAfterCp: 20,
    isYou: true,
    replyLine: [],
    ...extra,
  };
}
const START = undefined;

test("development + the label + what the engine expects next", () => {
  const text = explainMove(moveFrom(START, ["e4", "e5"], "Nf3", { label: "best", replyLine: ["b8c6", "f1b5"] }));
  assert.equal(text, "Nf3 develops the knight. The engine's top choice. The engine expects Nc6, then Bb5.");
});

test("castling is named as castling", () => {
  const text = explainMove(moveFrom(START, ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"], "O-O", { label: "book" }));
  assert.equal(text, "O-O castles kingside. A standard opening move.");
});

test("a new threat is only claimed when the piece really attacks something worth it", () => {
  // Nf3 attacks the undefended queen on d4.
  const text = explainMove(moveFrom("4k3/8/8/8/3q4/8/8/4K1N1 w - - 0 1", [], "Nf3", { label: "best" }));
  assert.match(text, /^Nf3 develops the knight, and attacks the queen on d4\./);
});

test("no threat sentence when the attacked piece is defended and worth no more", () => {
  // Bb5 hits the knight on c6, but it's defended and a bishop is worth the same.
  const text = explainMove(moveFrom(START, ["e4", "e5", "Nf3", "Nc6"], "Bb5", { label: "book" }));
  assert.equal(text, "Bb5 develops the bishop. A standard opening move.");
});

test("a blunder names the capture that punishes it, and the better move", () => {
  const text = explainMove(
    moveFrom("4k3/8/8/2p5/8/5N2/8/4K3 w - - 0 1", [], "Nd4", { label: "blunder", replyLine: ["c5d4", "e1e2"], bestMoveSan: "Ke2", evalAfterCp: -300 })
  );
  assert.equal(text, "It walks into cxd4, which wins your knight on d4. Better was Ke2.");
});

test("a move that allows a back-rank mate says so, with the mating move", () => {
  // The rook on a1 was the only guard of the back rank; Ra7 walks into Rd1#.
  const text = explainMove(
    moveFrom("3r2k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", [], "Ra7", {
      label: "blunder",
      replyLine: ["d8d1"],
      bestMoveSan: "g3",
      evalBeforeCp: 0,
      evalAfterCp: -99900,
    })
  );
  assert.equal(text, "It walks into Rd1#, which is checkmate. Better was g3.");
});

test("checkmate is simply called checkmate", () => {
  const text = explainMove(moveFrom(START, ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6"], "Qxf7#", { label: "best" }));
  assert.equal(text, "Qxf7# is checkmate.");
});

test("the opponent's moves say 'their', not 'your'", () => {
  const text = explainMove(
    moveFrom("4k3/8/8/2p5/8/5N2/8/4K3 w - - 0 1", [], "Nd4", { label: "blunder", replyLine: ["c5d4", "e1e2"], isYou: false, evalAfterCp: -300 })
  );
  assert.match(text, /wins their knight on d4/);
});

test("a recapture reads as taking back", () => {
  const board = new Chess();
  for (const m of ["e4", "d5", "exd5"]) board.move(m);
  const previousMove = board.history({ verbose: true }).at(-1);
  const text = explainMove(moveFrom(START, ["e4", "d5", "exd5"], "Qxd5", { label: "best", previousMove }));
  assert.match(text, /^Qxd5 takes back on d5/);
});

test("check on its own reads 'gives check'", () => {
  const text = explainMove(moveFrom(START, ["e4", "e5", "Qh5", "Nc6", "Bc4", "g6"], "Qf3", { label: "good" }));
  assert.ok(!/with check/.test(text));
  const check = explainMove(moveFrom("4k3/8/8/8/8/8/8/R3K3 w - - 0 1", [], "Ra8+", { label: "best" }));
  assert.match(check, /^Ra8\+ gives check\./);
});

test("an illegal or garbled move returns null instead of throwing", () => {
  assert.equal(explainMove({ san: "Qz9", fenBefore: "8/8/8/8/8/8/8/8 w - - 0 1", fenAfter: "x", label: "best" }), null);
});

test("a trade is not described as the punishment (real game: Ne4 Nxe4 dxe4)", () => {
  // Black's Ne4 is taken, but Black takes straight back: knight for knight.
  const text = explainMove(
    moveFrom(START, ["d4", "d5", "Nc3", "Nf6", "Bf4", "Nc6", "Qd2", "e6", "O-O-O"], "Ne4", {
      label: "mistake", replyLine: ["c3e4", "d5e4", "e2e3"], bestMoveSan: "a6", isYou: false, evalBeforeCp: 30, evalAfterCp: 80,
    })
  );
  assert.ok(!/walks into/.test(text), text);
});

test("recapturing a bishop with a bishop is not a punishment either (real game: Bxd6 cxd6)", () => {
  const board = new Chess("r2q1rk1/ppp2ppp/2nbpn2/3p4/3P1B2/2N1P3/PPPQ1PPP/2KR1BNR w - - 0 1");
  const text = explainMove(
    moveFrom(board.fen(), [], "Bxd6", { label: "inaccuracy", replyLine: ["c7d6", "f2f3"], bestMoveSan: "f3", evalBeforeCp: 40, evalAfterCp: -20 })
  );
  assert.ok(!/walks into/.test(text), text);
  assert.ok(!/undefended/.test(text), text); // the bishop is half of an even trade, not "hanging"
  assert.match(text, /Better was f3\./);
});

test("losing the exchange IS described (rook taken on the square where it took a bishop)", () => {
  // White's rook takes a bishop on f3 and a knight takes the rook: a real loss.
  const text = explainMove(
    moveFrom("4k3/8/8/8/3n4/5b2/8/4KR2 w - - 0 1", [], "Rxf3", { label: "inaccuracy", replyLine: ["d4f3", "e1e2"], evalAfterCp: -300 })
  );
  assert.match(text, /walks into Nxf3\+, and you lose the exchange/);
});

test("the cost sentence says 'you' and 'your'", () => {
  const text = explainMove(moveFrom(START, ["e4", "e5"], "a3", { label: "inaccuracy", evalBeforeCp: 30, evalAfterCp: -20 }));
  assert.match(text, /It costs you about \d+% of your winning chances\./);
});

test("a real loss that survives the recapture is still named (real game: Nh5 Qxf3, queens off, bishop gone)", () => {
  // Kh1 lets the queen take the bishop with check; White takes the queen,
  // the rook takes back, and White is simply a bishop down.
  const fen = "5rk1/8/8/8/5q2/5B2/4Q3/6K1 w - - 0 1";
  const text = explainMove(moveFrom(fen, [], "Kh1", {
    label: "blunder", replyLine: ["f4f3", "e2f3", "f8f3", "h1g2"], evalAfterCp: -400,
  }));
  assert.match(text, /It walks into Qxf3\+, which wins your bishop on f3\./);
});

test("an exchange still in progress at the end of the line claims nothing about material", () => {
  const text = explainMove(
    moveFrom("4k3/8/8/2p5/8/5N2/8/4K3 w - - 0 1", [], "Nd4", { label: "blunder", replyLine: ["c5d4"], evalAfterCp: -300 })
  );
  assert.ok(!/wins your knight/.test(text), text);
});
