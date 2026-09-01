import test from "node:test";
import assert from "node:assert/strict";

import {
  buildW3CApiResult,
  mergeW3CValidationReport,
  normalizeW3CInputUrl,
  summarizeW3CResponse,
} from "./validate.js";
import { onRequest as nestedRouteOnRequest } from "./validate/index.js";

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

test("mergeW3CValidationReport preserves unrelated project_data and updates only w3_validation", () => {
  const existing = {
    site_info: { url: "https://example.com" },
    seo: { score: 85 },
    w3_validation: { status: "warning", totalErrors: 2 },
  };

  const merged = mergeW3CValidationReport(existing, {
    status: "valid",
    totalErrors: 0,
    totalWarnings: 0,
    totalMessages: 1,
    url: "https://example.com",
    generatedAt: "2026-09-01T00:00:00.000Z",
    messages: [{ type: "info", message: "Page validated successfully." }],
    validator: { name: "W3C Nu Html Checker", docs: "https://validator.w3.org/nu/about.html" },
  });

  assert.deepEqual(merged.site_info, { url: "https://example.com" });
  assert.deepEqual(merged.seo, { score: 85 });
  assert.equal(merged.w3_validation.status, "valid");
  assert.equal(merged.w3_validation.totalErrors, 0);
  assert.equal(merged.w3_validation.messages[0].type, "info");
  assert.equal(merged.w3_validation.validator.name, "W3C Nu Html Checker");
});

test("mergeW3CValidationReport handles empty or malformed existing data safely", () => {
  assert.deepEqual(mergeW3CValidationReport(null, { status: "valid" }), {
    w3_validation: { status: "valid" },
  });

  assert.deepEqual(mergeW3CValidationReport("bad-data", { status: "warning" }), {
    w3_validation: { status: "warning" },
  });
});

test("buildW3CApiResult wraps the report in the application JSON response shape", () => {
  const result = buildW3CApiResult("https://example.com/", {
    status: "valid",
    totalErrors: 0,
    totalWarnings: 0,
    totalMessages: 0,
    messages: [],
    generatedAt: "2026-09-01T00:00:00.000Z",
  });

  assert.equal(result.success, true);
  assert.equal(result.data.url, "https://example.com/");
  assert.equal(result.data.status, "valid");
  assert.equal(result.data.errors, 0);
  assert.equal(result.data.warnings, 0);
  assert.deepEqual(result.data.messages, []);
});

test("nested validate route alias exposes the same handler for production path matching", async () => {
  const response = await nestedRouteOnRequest({
    request: new Request("https://example.com/api/tech-seo/w3c/validate?url=https://example.com"),
    env: { AUTH_JWT_SECRET: "12345678901234567890123456789012" },
  });

  assert.equal(response.status, 401);
  const payload = await response.json();
  assert.match(payload.error || "", /Unauthorized|Invalid or expired session/i);
});
