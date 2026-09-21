import { test } from "node:test";
import assert from "node:assert/strict";
import { recordOf, ratingTrend } from "../src/lib/gameStats.js";

const game = (result, timeClass, userRating, playedAt) => ({ result, timeClass, userRating, playedAt });

test("record: wins, losses, draws and a score that counts draws as half", () => {
  const r = recordOf([game("win"), game("win"), game("loss"), game("draw")]);
  assert.deepEqual({ w: r.wins, l: r.losses, d: r.draws, t: r.total }, { w: 2, l: 1, d: 1, t: 4 });
  assert.equal(r.winRate, 62.5);
});

test("record: no games means no score, not 0%", () => {
  assert.equal(recordOf([]).winRate, null);
});

test("rating trend: oldest to newest, whatever order the games arrive in", () => {
  const t = ratingTrend([game("win", "rapid", 620, 3), game("win", "rapid", 600, 1), game("loss", "rapid", 610, 2)], "rapid");
  assert.deepEqual(t.points, [600, 610, 620]);
  assert.equal(t.current, 620);
  assert.equal(t.change, 20);
});

test("rating trend on 'All' follows the most-played time control, never a blend", () => {
  const games = [
    game("win", "rapid", 600, 1), game("win", "rapid", 610, 2), game("win", "rapid", 620, 3),
    game("loss", "bullet", 300, 4),
  ];
  const t = ratingTrend(games, "all");
  assert.equal(t.timeClass, "rapid");
  assert.deepEqual(t.points, [600, 610, 620]); // the bullet 300 isn't mixed in
});

test("rating trend: nothing to show when ratings are missing", () => {
  assert.equal(ratingTrend([game("win", "rapid", undefined, 1)], "rapid"), null);
});
