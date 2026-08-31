import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/off-page/expired-domains/check.js";
import { canCheckDomain, checkExpiredDomains, normalizeDomainToken } from "../src/lib/expiredDomainChecker.js";

async function callApi(body) {
  const response = await onRequest({
    request: new Request("http://localhost/api/off-page/expired-domains/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  return { status: response.status, body: await response.json() };
}

test("shared checker preserves UI normalization and result fields", () => {
  const checked = checkExpiredDomains(
    "https://www.Example.com\nvalid-domain.org invalid localhost 127.0.0.1",
    () => 0.7,
    () => "12:34:56 PM"
  );

  assert.deepEqual(checked.normalized, ["example.com", "valid-domain.org"]);
  assert.deepEqual(checked.rejected, ["invalid", "localhost", "127.0.0.1"]);
  assert.deepEqual(checked.results, [
    { domain: "example.com", available: true, tld: "com", checkedAt: "12:34:56 PM" },
    { domain: "valid-domain.org", available: true, tld: "org", checkedAt: "12:34:56 PM" },
  ]);
});

test("API accepts a domain array and returns result data plus rejection metadata", async () => {
  const result = await callApi({ admin_token: "test-admin-token", domains: ["example.com", "bad_domain", "www.valid.org"] });
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.length, 2);
  assert.deepEqual(result.body.normalizedDomains, ["example.com", "valid.org"]);
  assert.deepEqual(result.body.rejectedDomains, ["bad_domain"]);
  assert.equal(result.body.removedCount, 1);
  assert.equal(typeof result.body.data[0].available, "boolean");
  assert.equal(result.body.data[0].tld, "com");
});

test("API accepts newline-separated domains", async () => {
  const result = await callApi({ admin_token: "test-admin-token", domains: "example.com\nvalid.org" });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.length, 2);
});

test("API rejects missing and entirely invalid domain input", async () => {
  const missing = await callApi({});
  assert.equal(missing.status, 400);
  assert.equal(missing.body.success, false);
  assert.equal(missing.body.error, "admin_token is required.");

  const invalidToken = await callApi({ admin_token: "x".repeat(513), domains: "example.com" });
  assert.equal(invalidToken.status, 400);
  assert.equal(invalidToken.body.error, "admin_token is too long.");

  const invalid = await callApi({ admin_token: "test-admin-token", domains: "localhost,127.0.0.1,bad_domain" });
  assert.equal(invalid.status, 422);
  assert.equal(invalid.body.success, false);
});

test("domain helpers match the page validation rules", () => {
  assert.equal(normalizeDomainToken("https://WWW.Example.com/path"), "example.com");
  assert.equal(canCheckDomain("example.com"), true);
  assert.equal(canCheckDomain("localhost"), false);
  assert.equal(canCheckDomain("127.0.0.1"), false);
});
