import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/off-page/backlink-cleaner.js";
import { classifyIssues, computeStats, normalizeRows } from "../src/lib/backlinkCleaner.js";

async function callApi(form) {
  const response = await onRequest({
    request: new Request("http://localhost/api/off-page/backlink-cleaner", {
      method: "POST",
      body: form,
    }),
  });
  return { status: response.status, body: await response.json() };
}

test("shared cleaner logic matches the page result fields and stats", () => {
  const csv = "Domain,URL,DR,Category,Title,Status\nexample.com,https://example.com/page,80,Editorial,Example,200\ncasino.xyz,https://casino.xyz,12,Gambling,Bonus,200";
  const rows = normalizeRows(csv);
  const analyzed = rows.map((row) => ({ ...row, issues: classifyIssues({ ...row, issues: "Unknown" }) }));

  assert.deepEqual(analyzed[0], {
    id: "example.com-0",
    domain: "example.com",
    url: "https://example.com/page",
    dr: 80,
    category: "Editorial",
    title: "Example",
    status: "200",
    issues: "Clean",
  });
  assert.equal(analyzed[1].issues, "Spammy TLD");
  assert.deepEqual(computeStats(analyzed), {
    totalLinks: 2,
    clean: 1,
    flagged: 1,
    avgDR: 46,
    scanned: 2,
    excluded: 0,
  });
});

test("missing admin token is rejected before file validation", async () => {
  const form = new FormData();
  form.append("file", new Blob(["not csv"], { type: "text/csv" }), "backlinks.csv");

  const result = await callApi(form);
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { success: false, error: "Invalid or missing admin token." });
});

test("invalid admin token is rejected without exposing token data", async () => {
  const form = new FormData();
  form.append("admin_token", "invalid-token");
  form.append("file", new Blob(["Domain,DR\nexample.com,50"], { type: "text/csv" }), "backlinks.csv");

  const result = await callApi(form);
  assert.notEqual(result.status, 404);
  assert.ok([401, 500].includes(result.status));
  assert.equal(result.body.success, false);
  assert.equal(result.body.error.includes("invalid-token"), false);
});
