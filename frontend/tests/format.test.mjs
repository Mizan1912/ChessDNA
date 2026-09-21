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
