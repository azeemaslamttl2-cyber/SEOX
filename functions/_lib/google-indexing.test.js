import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import {
  classifyGoogleError,
  getIndexingAccessToken,
  parseServiceAccount,
  prepareUrls,
  publishUrl,
  resetIndexingTokenCache,
} from "./google-indexing.js";

test("prepareUrls separates valid, invalid and duplicate URLs", () => {
  const { valid, invalid, duplicates } = prepareUrls(
    "https://a.com/x\nnot a url\nhttps://a.com/x#frag\nftp://a.com/f\nhttp://localhost/x\nhttp://10.0.0.1/x\n\nhttps://b.org"
  );
  assert.deepEqual(valid.map((v) => v.url), ["https://a.com/x", "https://b.org/"]);
  assert.equal(invalid.length, 4);
  assert.deepEqual(duplicates, ["https://a.com/x"]);
});

test("parseServiceAccount gives readable config errors", () => {
  assert.throws(() => parseServiceAccount(""), (e) => e.code === "NOT_CONFIGURED" && e.status === 503);
  assert.throws(() => parseServiceAccount("{nope"), (e) => e.code === "BAD_CONFIG");
  assert.throws(() => parseServiceAccount("{}"), (e) => e.code === "BAD_CONFIG");
});

test("classifyGoogleError maps quota, permission, disabled-API and server errors", () => {
  const quota = classifyGoogleError(429, { error: { message: "Quota exceeded", status: "RESOURCE_EXHAUSTED" } });
  assert.equal(quota.code, "QUOTA_EXCEEDED");
  assert.equal(quota.stopBatch, true);

  const perm = classifyGoogleError(
    403,
    { error: { message: "Permission denied. Failed to verify the URL ownership." } },
    { clientEmail: "sa@p.iam.gserviceaccount.com", url: "https://a.com/x" }
  );
  assert.equal(perm.code, "PERMISSION_DENIED");
  assert.match(perm.message, /sa@p\.iam\.gserviceaccount\.com/);
  assert.match(perm.message, /https:\/\/a\.com/);

  const disabled = classifyGoogleError(403, { error: { message: "Web Search Indexing API has not been used in project 1 before or it is disabled." } });
  assert.equal(disabled.code, "API_DISABLED");
  assert.equal(disabled.stopBatch, true);

  assert.equal(classifyGoogleError(503, {}).code, "GOOGLE_UNAVAILABLE");
  assert.equal(classifyGoogleError(400, { error: { message: "bad" } }).code, "INVALID_REQUEST");
});

test("access token exchange signs an RS256 JWT and publishUrl posts the documented body", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const account = {
    client_email: "sa@p.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
    private_key_id: "kid1",
  };
  const env = { GOOGLE_INDEXING_SERVICE_ACCOUNT_KEY: JSON.stringify(account) };
  resetIndexingTokenCache();

  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("oauth2")) return Response.json({ access_token: "tok123", expires_in: 3600 });
    return Response.json({ urlNotificationMetadata: { url: "https://a.com/x", latestUpdate: { url: "https://a.com/x", type: "URL_UPDATED", notifyTime: "2026-10-02T10:00:00Z" } } });
  };
  try {
    const access = await getIndexingAccessToken(env);
    assert.equal(access.token, "tok123");
    const assertion = new URLSearchParams(calls[0].init.body).get("assertion");
    const [header, claims] = assertion.split(".").slice(0, 2).map((p) => JSON.parse(Buffer.from(p, "base64url").toString()));
    assert.equal(header.alg, "RS256");
    assert.equal(claims.iss, account.client_email);
    assert.equal(claims.scope, "https://www.googleapis.com/auth/indexing");

    const result = await publishUrl({ url: "https://a.com/x", token: access.token, clientEmail: access.clientEmail });
    assert.equal(result.ok, true);
    assert.equal(result.notifyTime, "2026-10-02T10:00:00Z");
    const publish = calls[1];
    assert.equal(publish.url, "https://indexing.googleapis.com/v3/urlNotifications:publish");
    assert.equal(publish.init.headers.Authorization, "Bearer tok123");
    assert.deepEqual(JSON.parse(publish.init.body), { url: "https://a.com/x", type: "URL_UPDATED" });
  } finally {
    globalThis.fetch = realFetch;
    resetIndexingTokenCache();
  }
});
