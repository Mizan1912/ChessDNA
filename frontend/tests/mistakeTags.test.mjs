// Run with: npm test  (from /frontend). Uses Node's built-in test runner —
// no test framework dependency.
//
// Every tag rule gets positions where the right answer is known in advance,
// and — just as important — near-miss positions where the tag must NOT
// fire. A blind-spot finder that tags everything tells the user nothing.
//
// Each FEN is the position right AFTER the player's mistake, so it's the
// opponent to move; `line` is the opponent's best continuation (hand-written
// here, the engine's principal variation in the app).

import { test } from "node:test";
import assert from "node:assert/strict";
import { tagMistake } from "../src/lib/mistakeTags.js";

const tagsOf = (moment) => tagMistake(moment).map((t) => t.tag).sort();
const find = (moment, tag) => tagMistake(moment).find((t) => t.tag === tag);

// --- Hanging piece ---------------------------------------------------------

test("hanging piece: undefended knight, taken at once", () => {
  const moment = { fenAfter: "4k3/8/5q2/4N3/8/8/8/4K3 b - - 0 1", refutationLine: ["f6e5"], playerColour: "w" };
  const hit = find(moment, "hanging-piece");
  assert.ok(hit, "should be tagged");
  assert.deepEqual(hit.squares, ["e5"]);
  assert.equal(hit.detail.piece, "n");
});

test("hanging piece: NOT when the knight is defended", () => {
  const moment = { fenAfter: "4k3/8/5q2/4N3/3P4/8/8/4K3 b - - 0 1", refutationLine: ["f6e5", "d4e5"], playerColour: "w" };
  assert.deepEqual(tagsOf(moment), []);
});

test("hanging piece: NOT when the engine's line doesn't actually take it", () => {
  // Loose knight, but the doc's rule also needs "the engine's best line wins it".
  const moment = { fenAfter: "4k3/8/5q2/4N3/8/8/8/4K3 b - - 0 1", refutationLine: ["e8d8"], playerColour: "w" };
  assert.deepEqual(tagsOf(moment), []);
});

test("hanging piece: NOT for a pawn", () => {
  const moment = { fenAfter: "4k3/8/5q2/4P3/8/8/8/4K3 b - - 0 1", refutationLine: ["f6e5"], playerColour: "w" };
  assert.deepEqual(tagsOf(moment), []);
});

test("hanging piece: works for Black's mistakes too", () => {
  // Mirror image: Black's knight on e4 is loose, White's queen on f3 takes it.
  const moment = { fenAfter: "4k3/8/8/8/4n3/5Q2/8/4K3 w - - 0 1", refutationLine: ["f3e4"], playerColour: "b" };
  assert.deepEqual(find(moment, "hanging-piece")?.squares, ["e4"]);
});

// --- Back rank -------------------------------------------------------------

test("back rank: the classic mate, no luft", () => {
  const moment = { fenAfter: "3r2k1/R4ppp/8/8/8/8/5PPP/6K1 b - - 0 1", refutationLine: ["d8d1"], playerColour: "w" };
  const hit = find(moment, "back-rank");
  assert.ok(hit, "should be tagged");
  assert.equal(hit.detail.kind, "mate");
  assert.deepEqual(hit.squares, ["d1", "g1"]);
});

test("back rank: NOT when the king has luft (h3 played)", () => {
  const moment = { fenAfter: "3r2k1/R4ppp/8/8/8/7P/5PP1/6K1 b - - 0 1", refutationLine: ["d8d1", "g1h2"], playerColour: "w" };
  assert.deepEqual(tagsOf(moment), []);
});

test("back rank: NOT when the line doesn't use the weakness", () => {
  const moment = { fenAfter: "3r2k1/R4ppp/8/8/8/8/5PPP/6K1 b - - 0 1", refutationLine: ["g8f8"], playerColour: "w" };
  assert.deepEqual(tagsOf(moment), []);
});

test("back rank: works for Black's king on the 8th rank", () => {
  const moment = { fenAfter: "6k1/5ppp/8/8/8/8/r4PPP/3R2K1 w - - 0 1", refutationLine: ["d1d8"], playerColour: "b" };
  const hit = find(moment, "back-rank");
  assert.equal(hit?.detail.kind, "mate");
  assert.deepEqual(hit?.squares, ["d8", "g8"]);
});

test("back rank: wins material without mating — and the knight was hanging too", () => {
  // Rook takes the loose knight on c1 WITH CHECK along the back rank; the
  // queen has to block. Not mate, but a piece is gone because of the back
  // rank. Both tags are true at once, and both should be reported.
  const moment = {
    fenAfter: "2r3k1/5ppp/8/8/Q7/8/5PPP/2N3K1 b - - 0 1",
    refutationLine: ["c8c1", "a4d1"],
    playerColour: "w",
  };
  assert.deepEqual(tagsOf(moment), ["back-rank", "hanging-piece"]);
  const backRank = find(moment, "back-rank");
  assert.equal(backRank.detail.kind, "material");
  assert.equal(backRank.detail.gained, 3);
});

test("back rank: NOT a bishop picking off the queen on d8 (real game, first-version false positive)", () => {
  // From a real game: Black's Nh7 opened the h4-d8 diagonal and Bxd8 simply
  // won the queen. The castled king counts as "trapped" behind f7/g7/h7, and
  // the capture lands on the 8th rank — which the first version of the rule
  // wrongly accepted. The king had nothing to do with it.
  const moment = {
    fenAfter: "r1bq1rk1/ppp2ppn/7p/2p1P3/2n4B/2N5/PPP2PPP/R2Q1RK1 w - - 1 12",
    refutationLine: ["h4d8", "c4b2", "d1e1", "f7f6", "d8e7", "f8e8", "e5f6", "h7f6"],
    playerColour: "b",
  };
  assert.equal(find(moment, "back-rank"), undefined);
});

// --- Robustness --------------------------------------------------------------

test("a nonsense line earns no tag and doesn't throw", () => {
  const moment = { fenAfter: "4k3/8/5q2/4N3/8/8/8/4K3 b - - 0 1", refutationLine: ["a1a8", "(none)"], playerColour: "w" };
  assert.deepEqual(tagsOf(moment), []);
});

test("no line at all earns no tag", () => {
  const moment = { fenAfter: "4k3/8/5q2/4N3/8/8/8/4K3 b - - 0 1", refutationLine: [], playerColour: "w" };
  assert.deepEqual(tagsOf(moment), []);
});
