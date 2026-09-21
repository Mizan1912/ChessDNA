import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { materialSacrificed } from "../src/lib/moveLabels.js";

// Plays moves from a FEN and returns the FEN at the end.
function after(fen, moves) {
  const board = new Chess(fen);
  for (const m of moves) board.move(m);
  return board.fen();
}

test("an even trade is not a sacrifice (a real game labelled Rxd1+ Kxd1 'Brilliant')", () => {
  const fen = "3r2k1/8/8/8/8/8/5PPP/3RK3 b - - 0 1"; // king on e1, next to d1
  assert.equal(materialSacrificed(fen, after(fen, ["Rxd1+", "Kxd1"]), "b"), 0);
});

test("a rook given up for nothing is a sacrifice of 5", () => {
  const fen = "3r2k1/8/8/8/8/8/5PPP/R4K2 b - - 0 1";
  assert.equal(materialSacrificed(fen, after(fen, ["Rd1+", "Rxd1"]), "b"), 5);
});

test("a knight given up to a pawn is a sacrifice of 3", () => {
  const fen = "4k3/8/8/2p5/8/5N2/8/4K3 w - - 0 1";
  assert.equal(materialSacrificed(fen, after(fen, ["Nd4", "cxd4"]), "w"), 3);
});

test("winning material is the opposite of a sacrifice", () => {
  const fen = "4k3/8/8/4p3/8/5N2/8/4K3 w - - 0 1";
  assert.equal(materialSacrificed(fen, after(fen, ["Nxe5", "Ke7"]), "w"), -1);
});
