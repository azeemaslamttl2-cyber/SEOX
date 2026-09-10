import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEeatResult } from "../src/lib/eeatAuditUtils.js";

test("normalizeEeatResult keeps the audit shape safe when a saved result is missing sections", () => {
  const normalized = normalizeEeatResult({ url: "https://example.com", score: 80 }, "https://example.com");

  assert.equal(normalized.url, "https://example.com");
  assert.equal(normalized.score, 80);
  assert.equal(Array.isArray(normalized.sections), true);
  assert.deepEqual(normalized.sections, []);
});

test("normalizeEeatResult falls back to the default empty result when the value is empty", () => {
  const normalized = normalizeEeatResult(null, "https://example.com");

  assert.equal(normalized.url, "https://example.com");
  assert.equal(normalized.score, 0);
  assert.deepEqual(normalized.sections, []);
});
