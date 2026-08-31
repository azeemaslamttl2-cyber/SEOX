import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/off-page/backlink-indexer.js";

async function callApi(body) {
  const response = await onRequest({
    request: new Request("http://localhost/api/off-page/backlink-indexer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  return { status: response.status, body: await response.json() };
}

test("admin token is required before URL validation", async () => {
  const result = await callApi({ urls: ["not-a-url"] });
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { success: false, error: "Invalid or missing admin token." });
});

test("missing URLs is rejected after authentication gate", async () => {
  const result = await callApi({});
  assert.equal(result.status, 401);
  assert.equal(result.body.success, false);
  assert.equal(result.body.error, "Invalid or missing admin token.");
});

test("route module imports successfully", async () => {
  const route = await import("../functions/api/off-page/backlink-indexer.js");
  assert.equal(typeof route.onRequest, "function");
});
