import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/keywords/ubersuggest.js";

async function callApi(body) {
  const response = await onRequest({
    request: new Request("http://localhost/api/keywords/ubersuggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  return { status: response.status, body: await response.json() };
}

test("admin token is validated before keyword or country processing", async () => {
  const result = await callApi({ keyword: "SEO tools", country: "Pakistan" });
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { success: false, error: "Admin token is required." });
});

test("invalid admin token stops the request", async () => {
  const result = await callApi({ admin_token: "invalid-token", keyword: "SEO tools", country: "PK" });
  assert.ok([401, 500].includes(result.status));
  assert.equal(result.body.success, false);
  assert.equal(result.body.error.includes("invalid-token"), false);
});

test("keyword and country validation occurs after authentication", async () => {
  const missingKeyword = await callApi({ admin_token: "invalid-token", country: "Pakistan" });
  assert.ok([401, 500].includes(missingKeyword.status));
  assert.equal(missingKeyword.body.success, false);
});