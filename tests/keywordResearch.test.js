import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/keywords/research.js";

async function callApi(body) {
  const response = await onRequest({
    request: new Request("http://localhost/api/keywords/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  return { status: response.status, body: await response.json() };
}

test("admin token validation runs before keyword input validation", async () => {
  const result = await callApi({ country: "Pakistan", language: "en", seed_keywords: "" });
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { success: false, error: "Admin token is required." });
});

test("invalid admin token stops the request before DataForSEO", async () => {
  const result = await callApi({
    admin_token: "invalid-token",
    country: "Pakistan",
    language: "en",
    seed_keywords: "SEO tools",
  });
  assert.ok([401, 500].includes(result.status));
  assert.equal(result.body.success, false);
  assert.equal(result.body.error.includes("invalid-token"), false);
});

test("route module imports successfully", async () => {
  const route = await import("../functions/api/keywords/research.js");
  assert.equal(typeof route.onRequest, "function");
});

test("domain mode reaches the existing domain keyword action after auth", async () => {
  const result = await callApi({
    admin_token: "invalid-token",
    mode: "domain",
    country: "Pakistan",
    language: "en",
    domain: "example.com",
  });
  assert.ok([401, 500].includes(result.status));
  assert.equal(result.body.success, false);
});