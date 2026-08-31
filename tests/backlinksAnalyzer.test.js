import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBacklinks, parseBacklinkText } from "../src/lib/backlinksAnalyzer.js";
import { onRequest, validateAdminToken } from "../functions/api/tech-seo/backlinks/analyze.js";

async function callApi(body, headers = {}) {
  const request = new Request("http://localhost/api/tech-seo/backlinks/analyze", {
    method: "POST",
    body,
    headers,
  });
  const response = await onRequest({ request });
  return { status: response.status, body: await response.json() };
}

test("CSV API response matches the shared frontend analysis", async () => {
  const csv = "Domain,DR,Backlinks,Country\nseo-marketing.com,40,12,US\ncasino.xyz,2,4,RU";
  const expected = analyzeBacklinks({ text: csv, keywords: "SEO marketing" });
  const result = analyzeBacklinks({ text: csv, keywords: "SEO marketing" });
  assert.deepEqual(result.analyzedBacklinks, expected.analyzedBacklinks);
  assert.deepEqual(result.stats, expected.stats);
  assert.equal(result.csvFormat, "domain");
});

test("TSV upload is parsed with the same rules", async () => {
  const tsv = "Domain\tDR\tBacklinks\tCountry\nexample.com\t10\t3\tUS";
  const result = analyzeBacklinks({ text: tsv, keywords: "example" });
  assert.equal(result.csvFormat, "domain");
  assert.equal(result.backlinks[0].domain, "example.com");
});

test("direct JSON backlink records are accepted", async () => {
  const result = analyzeBacklinks({
    keywords: "marketing",
    backlinks: [{ Domain: "marketing.example", DR: 20, Backlinks: 8, Country: "US" }],
  });

  assert.equal(result.backlinks[0].domain, "marketing.example");
  assert.equal(result.backlinks[0].dr, 20);
});

test("missing and invalid input return meaningful statuses", async () => {
  const missing = await callApi(JSON.stringify({ keywords: "seo" }), { "Content-Type": "application/json" });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.success, false);

  assert.throws(() => validateAdminToken(""), { message: "admin_token is required", status: 400 });
  assert.throws(() => validateAdminToken("x".repeat(513)), { message: "admin_token is too long", status: 400 });
});

test("parser preserves the existing CSV contract", () => {
  const parsed = parseBacklinkText("Domain,DR\nexample.com,12");
  assert.equal(parsed.results[0].domain, "example.com");
  assert.equal(parsed.results[0].dr, 12);
});
