import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeW3CInputUrl,
  summarizeW3CResponse,
} from "./validate.js";

test("normalizeW3CInputUrl accepts a normal public URL and rejects malformed or private values", () => {
  assert.equal(normalizeW3CInputUrl("example.com").toString(), "https://example.com/");
  assert.throws(() => normalizeW3CInputUrl("localhost:3000"), /private|local|URL/i);
  assert.throws(() => normalizeW3CInputUrl("not a url"), /Invalid URL|URL/i);
});

test("summarizeW3CResponse reports totals and locations from the validator payload", () => {
  const summary = summarizeW3CResponse({
    url: "https://example.com/",
    messages: [
      { type: "error", message: "Missing doctype", lastLine: 4, lastColumn: 12, source: { code: "<html>" }, extract: "<html>", url: "https://example.com/" },
      { type: "warning", message: "Trailing slash recommended", lastLine: 2, lastColumn: 3 },
      { type: "info", message: "A general note" },
    ],
  });

  assert.equal(summary.status, "issues");
  assert.equal(summary.totalErrors, 1);
  assert.equal(summary.totalWarnings, 1);
  assert.equal(summary.messages[0].location, "line 4, column 12");
  assert.equal(summary.messages[1].type, "warning");
});
