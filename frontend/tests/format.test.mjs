import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDuration } from "../src/lib/format.js";

test("durations read the way a person says them", () => {
  assert.equal(formatDuration(0.4), "0.4s");
  assert.equal(formatDuration(9.94), "9.9s");
  assert.equal(formatDuration(12.4), "12s");
  assert.equal(formatDuration(59.4), "59s");
  assert.equal(formatDuration(60), "1m");
  assert.equal(formatDuration(674), "11m 14s"); // the one that prompted this
  assert.equal(formatDuration(3725), "1h 2m");
});

test("no time is shown as nothing, not as 0s or NaN", () => {
  assert.equal(formatDuration(null), null);
  assert.equal(formatDuration(undefined), null);
  assert.equal(formatDuration(NaN), null);
});

import { formatEval } from "../src/lib/format.js";

test("evaluations read like a chess site's, from White's side", () => {
  assert.equal(formatEval(130), "+1.3");
  assert.equal(formatEval(-682), "-6.8");
  assert.equal(formatEval(0), "0.0");
  assert.equal(formatEval(99700), "M3");
  assert.equal(formatEval(-99900), "-M1");
  assert.equal(formatEval(null), null);
});

test("a near-zero negative evaluation reads 0.0, never -0.0", () => {
  assert.equal(formatEval(-3), "0.0");
  assert.equal(formatEval(4), "0.0");
  assert.equal(formatEval(-6), "-0.1");
});
