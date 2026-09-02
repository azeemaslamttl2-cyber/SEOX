import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "./screaming-frog.js";

const env = { ADMIN_TOKEN: "valid-admin-token" };

function request(body) {
  return onRequest({
    request: new Request("https://example.com/api/tech-seo/screaming-frog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    env,
  });
}

test("Screaming Frog API analyzes a valid CSV URL list", async () => {
  const response = await request({
    admin_token: "valid-admin-token",
    urls_csv: "https://example.com/page-a,https://example.org/page-b",
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.status, "success");
  assert.equal(payload.total_urls_submitted, 2);
  assert.equal(payload.total_urls_processed, 2);
  assert.deepEqual(payload.processed_urls, ["https://example.com/page-a", "https://example.org/page-b"]);
  assert.equal(payload.results_by_url.length, 2);
  assert.ok(payload.analysis_results);
});

test("Screaming Frog API supports multiple rows and reports invalid URLs", async () => {
  const response = await request({
    admin_token: "valid-admin-token",
    urls_csv: "Address\nhttps://example.com/ok\nnot-a-url\nftp://example.com/nope",
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.total_urls_submitted, 3);
  assert.equal(payload.total_urls_processed, 1);
  assert.equal(payload.errors.length, 2);
  assert.equal(payload.processed_urls[0], "https://example.com/ok");
});

test("Screaming Frog API rejects empty CSV input", async () => {
  const response = await request({ admin_token: "valid-admin-token", urls_csv: "  " });
  const payload = await response.json();
  assert.equal(response.status, 422);
  assert.equal(payload.status, "error");
  assert.match(payload.message, /empty|required/i);
});

test("Screaming Frog API rejects missing admin token", async () => {
  const response = await request({ urls_csv: "https://example.com" });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.match(payload.message, /admin_token/i);
});

test("Screaming Frog API rejects invalid admin token before processing", async () => {
  const response = await request({ admin_token: "wrong-token", urls_csv: "https://example.com" });
  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.match(payload.message, /invalid admin token/i);
});

test("Screaming Frog API accepts a multipart CSV file", async () => {
  const form = new FormData();
  form.append("admin_token", "valid-admin-token");
  form.append("urls_csv", new Blob(["https://example.com/file-upload"]), "urls.csv");
  const response = await onRequest({
    request: new Request("https://example.com/api/tech-seo/screaming-frog", { method: "POST", body: form }),
    env,
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.total_urls_processed, 1);
  assert.deepEqual(payload.processed_urls, ["https://example.com/file-upload"]);
});
