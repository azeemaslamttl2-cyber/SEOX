import test from "node:test";
import assert from "node:assert/strict";

import { normalizeJiraBaseUrl } from "../functions/_lib/jira-client.js";
import { normalizeFindingPayload } from "../functions/_lib/jira-finding.js";
import { encryptWithKey, decryptWithKey, secretKeyConfigured } from "../functions/_lib/secret-crypto.js";

// A valid 32-byte base64 key, for the crypto assertions only.
const TEST_KEY = Buffer.alloc(32, 7).toString("base64");
const env = { JIRA_TOKEN_ENCRYPTION_KEY: TEST_KEY };

// Each route with a method it actually serves. connect.js is POST-only and
// answers 405 to a GET before it looks at authentication, which is correct -
// a method check is cheaper and leaks nothing.
const JIRA_ROUTES = [
  { path: "../functions/api/jira/connect.js", method: "POST" },
  { path: "../functions/api/jira/status.js", method: "GET" },
  { path: "../functions/api/jira/metadata.js", method: "GET" },
  { path: "../functions/api/jira/mapping.js", method: "GET" },
  { path: "../functions/api/jira/issues.js", method: "GET" },
  { path: "../functions/api/jira/jobs.js", method: "GET" },
];

// --- Authentication --------------------------------------------------------

test("every session-authenticated Jira route rejects an unauthenticated request", async () => {
  for (const { path, method } of JIRA_ROUTES) {
    const { onRequest } = await import(path);
    const response = await onRequest({
      request: new Request("http://localhost/api/jira/x", {
        method,
        ...(method === "POST"
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "connect", projectId: "p" }),
            }
          : {}),
      }),
      env: {},
    });
    assert.equal(response.status, 401, `${path} should reject an anonymous ${method}`);
  }
});

test("a POST without a session is rejected before any Jira or database work", async () => {
  for (const modulePath of ["../functions/api/jira/connect.js", "../functions/api/jira/issues.js"]) {
    const { onRequest } = await import(modulePath);
    const response = await onRequest({
      request: new Request("http://localhost/api/jira/x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", projectId: "p" }),
      }),
      env: {},
    });
    assert.equal(response.status, 401, modulePath);
  }
});

test("OPTIONS is answered without authentication, and 405 for the wrong verb", async () => {
  const { onRequest } = await import("../functions/api/jira/status.js");
  const preflight = await onRequest({
    request: new Request("http://localhost/api/jira/status", { method: "OPTIONS" }),
    env: {},
  });
  assert.equal(preflight.status, 204);

  const wrongVerb = await onRequest({
    request: new Request("http://localhost/api/jira/status", { method: "DELETE" }),
    env: {},
  });
  assert.equal(wrongVerb.status, 405);
});

// --- Webhook authentication ------------------------------------------------

test("the webhook rejects a missing, short or unknown token with a bare 401", async () => {
  const { onRequest } = await import("../functions/api/jira/webhook.js");

  const cases = [
    "http://localhost/api/jira/webhook",
    "http://localhost/api/jira/webhook?t=",
    "http://localhost/api/jira/webhook?t=tooshort",
    `http://localhost/api/jira/webhook?t=${"f".repeat(200)}`,
  ];

  for (const url of cases) {
    const response = await onRequest({
      request: new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookEvent: "jira:issue_updated", issue: { id: "1" } }),
      }),
      env: {},
    });
    assert.equal(response.status, 401, url);
    // No body: the endpoint must not help an attacker tell a close token from
    // a wrong one.
    const text = await response.text();
    assert.equal(text.includes("secret"), false);
    assert.equal(text.includes("token"), false);
  }
});

test("the webhook rejects a non-JSON body and an oversized body", async () => {
  const { onRequest } = await import("../functions/api/jira/webhook.js");
  const token = "a".repeat(64);

  const wrongType = await onRequest({
    request: new Request(`http://localhost/api/jira/webhook?t=${token}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hello",
    }),
    env: {},
  });
  assert.equal(wrongType.status, 400);

  const oversized = await onRequest({
    request: new Request(`http://localhost/api/jira/webhook?t=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ padding: "x".repeat(1024 * 1024 + 10) }),
    }),
    env: {},
  });
  assert.equal(oversized.status, 413);
});

test("the webhook answers OPTIONS and refuses GET", async () => {
  const { onRequest } = await import("../functions/api/jira/webhook.js");
  const preflight = await onRequest({
    request: new Request("http://localhost/api/jira/webhook", { method: "OPTIONS" }),
    env: {},
  });
  assert.equal(preflight.status, 204);

  const get = await onRequest({
    request: new Request("http://localhost/api/jira/webhook", { method: "GET" }),
    env: {},
  });
  assert.equal(get.status, 405);
});

// --- Job runner ------------------------------------------------------------

test("the job runner is disabled, not open, when its token is unset", async () => {
  const { onRequest } = await import("../functions/api/jira/jobs.js");
  const response = await onRequest({
    request: new Request("http://localhost/api/jira/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger: "cron" }),
    }),
    env: {},
  });
  // 503 "disabled", never 200 "drained".
  assert.equal(response.status, 503);
});

test("the job runner rejects a wrong scheduler token", async () => {
  const { onRequest } = await import("../functions/api/jira/jobs.js");
  const response = await onRequest({
    request: new Request("http://localhost/api/jira/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Jira-Scheduler-Token": "wrong" },
      body: JSON.stringify({ trigger: "cron" }),
    }),
    env: { JIRA_SCHEDULER_TOKEN: "correct-token-value" },
  });
  assert.equal(response.status, 401);
});

// --- SSRF ------------------------------------------------------------------

test("a Jira base URL pointing at a private or local address is refused", () => {
  const blocked = [
    "http://localhost:8080",
    "https://127.0.0.1",
    "https://10.0.0.5",
    "https://192.168.1.10",
    "https://172.16.0.1",
    "https://169.254.169.254",
    "https://metadata.google.internal",
    "https://jira.local",
  ];
  for (const url of blocked) {
    assert.throws(() => normalizeJiraBaseUrl(url, {}), /private|local|https/i, url);
  }
});

test("a Jira base URL with embedded credentials or a non-http scheme is refused", () => {
  assert.throws(() => normalizeJiraBaseUrl("https://user:pass@team.atlassian.net", {}), /credential/i);
  assert.throws(() => normalizeJiraBaseUrl("ftp://team.atlassian.net", {}), /https/i);
  assert.throws(() => normalizeJiraBaseUrl("javascript:alert(1)", {}), /https|valid/i);
  assert.throws(() => normalizeJiraBaseUrl("", {}), /required/i);
  assert.throws(() => normalizeJiraBaseUrl(`https://a.atlassian.net/${"x".repeat(1200)}`, {}), /too long/i);
});

test("the insecure base URL escape hatch is ignored in production", () => {
  const permissive = { JIRA_ALLOW_INSECURE_BASE_URL: "true", NODE_ENV: "production" };
  assert.throws(() => normalizeJiraBaseUrl("http://localhost:8080", permissive), /https|private/i);
});

test("a valid base URL is canonicalised, dropping a pasted REST or browse path", () => {
  assert.equal(normalizeJiraBaseUrl("https://team.atlassian.net/", {}), "https://team.atlassian.net");
  assert.equal(
    normalizeJiraBaseUrl("https://team.atlassian.net/rest/api/3/myself", {}),
    "https://team.atlassian.net"
  );
  assert.equal(
    normalizeJiraBaseUrl("https://team.atlassian.net/browse/WEB-1", {}),
    "https://team.atlassian.net"
  );
  assert.equal(normalizeJiraBaseUrl("team.atlassian.net", {}), "https://team.atlassian.net");
});

test("a finding URL pointing at a private address is refused before it can be stored or fetched", () => {
  assert.throws(
    () =>
      normalizeFindingPayload(
        {
          sourceModule: "auditor",
          findingType: "404-page",
          scope: { kind: "url", url: "http://169.254.169.254/latest/meta-data/" },
        },
        "p1"
      ),
    /private|local|metadata/i
  );
});

test("a finding cannot inject an external link through seoxPath", () => {
  const { finding } = normalizeFindingPayload(
    {
      sourceModule: "auditor",
      findingType: "404-page",
      scope: { kind: "url", url: "https://example.com/a" },
      seoxPath: "https://evil.example/steal",
    },
    "p1"
  );
  assert.equal(finding.seoxPath, "", "an absolute URL must be dropped");

  const { finding: protocolRelative } = normalizeFindingPayload(
    {
      sourceModule: "auditor",
      findingType: "404-page",
      scope: { kind: "url", url: "https://example.com/a" },
      seoxPath: "//evil.example/steal",
    },
    "p1"
  );
  assert.equal(protocolRelative.seoxPath, "");
});

// --- Credential handling ---------------------------------------------------

test("a stored credential is ciphertext, and round-trips only with the right key", async () => {
  const secret = "ATATT3xFfGF0-super-secret-token";
  const sealed = await encryptWithKey(env, "JIRA_TOKEN_ENCRYPTION_KEY", secret, "Jira credential");

  assert.ok(sealed.startsWith("v1."), "the stored envelope must be versioned");
  assert.equal(sealed.includes(secret), false, "the plaintext must not survive in the ciphertext");

  assert.equal(await decryptWithKey(env, "JIRA_TOKEN_ENCRYPTION_KEY", sealed, "Jira credential"), secret);

  // A different key must fail loudly with an actionable message, not return junk.
  const otherEnv = { JIRA_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64") };
  await assert.rejects(
    () => decryptWithKey(otherEnv, "JIRA_TOKEN_ENCRYPTION_KEY", sealed, "Jira credential"),
    /different JIRA_TOKEN_ENCRYPTION_KEY/
  );
});

test("a missing or malformed encryption key is reported, never silently ignored", async () => {
  assert.equal(secretKeyConfigured({}, "JIRA_TOKEN_ENCRYPTION_KEY"), false);
  assert.equal(secretKeyConfigured(env, "JIRA_TOKEN_ENCRYPTION_KEY"), true);

  await assert.rejects(
    () => encryptWithKey({}, "JIRA_TOKEN_ENCRYPTION_KEY", "x"),
    /JIRA_TOKEN_ENCRYPTION_KEY is not configured/
  );
  await assert.rejects(
    () => encryptWithKey({ JIRA_TOKEN_ENCRYPTION_KEY: "short" }, "JIRA_TOKEN_ENCRYPTION_KEY", "x"),
    /32 bytes|base64/
  );
});

test("the GBP encryption surface is unchanged by the shared-crypto refactor", async () => {
  const gbp = await import("../functions/_lib/gbp-crypto.js");
  assert.equal(typeof gbp.encryptSecret, "function");
  assert.equal(typeof gbp.decryptSecret, "function");
  assert.equal(typeof gbp.encryptionKeyConfigured, "function");

  const gbpEnv = { GBP_TOKEN_ENCRYPTION_KEY: TEST_KEY };
  const sealed = await gbp.encryptSecret(gbpEnv, "refresh-token");
  assert.ok(sealed.startsWith("v1."));
  assert.equal(await gbp.decryptSecret(gbpEnv, sealed), "refresh-token");
  assert.equal(gbp.encryptionKeyConfigured({}), false);
});

// --- No secret reaches the browser bundle ----------------------------------

test("no VITE_-prefixed Jira variable exists anywhere in the frontend", async () => {
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");

  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(js|jsx)$/.test(entry)) continue;
      if (readFileSync(full, "utf8").includes("VITE_JIRA")) offenders.push(full);
    }
  };
  walk("src");

  // Anything VITE_-prefixed is inlined into the browser bundle at build time.
  // There is no Jira value the browser needs.
  assert.deepEqual(offenders, []);
});

test("the Jira browser client never sends a token anywhere but the connect call", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("src/lib/jiraApi.js", "utf8");

  const tokenMentions = source.split("\n").filter((line) => line.includes("apiToken"));
  // Exactly two: the connectJira parameter and the body it builds.
  assert.equal(tokenMentions.length, 2, tokenMentions.join(" | "));
  assert.ok(
    tokenMentions.every((line) => line.includes("connect") || line.includes("apiToken }")),
    "apiToken must only appear on the connect path"
  );
});

// --- project_id is an authorisation input, not a decoration ----------------

test("a project_id on an unlinked issue selects the mapping, rather than being ignored", async () => {
  // THE BUG THIS GUARDS: for a ticket SEOX did not file, the mapping used to
  // be looked up from the ISSUE KEY in every case. A project_id in the
  // request was then checked against nothing - the key found its own mapping
  // and agreed with itself - so an issue on a board mapped to one site was
  // accepted under the identifier of a different site. Verified against the
  // real tenant: WPGC-1 sent with the internal project mapped to WUCP was
  // accepted and reached Jira. It is now refused with WRONG_JIRA_PROJECT
  // before any Jira call.
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("functions/api/jira/issues/status.js", "utf8");
  const fn = source.slice(
    source.indexOf("async function resolveContext"),
    source.indexOf("/** Jira's own errors already carry a status")
  );
  const code = fn.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const claimed = code.indexOf("else if (claimedProjectId)");
  const byKey = code.indexOf("getMappingByJiraProjectKey(");
  assert.ok(claimed > -1, "a named internal project must have its own branch");
  assert.ok(
    claimed < byKey,
    "the named project must supply the mapping BEFORE the issue key is allowed to"
  );
  assert.ok(
    code.includes("getMapping(admin.id, claimedProjectId)"),
    "the mapping must come from the project the caller named, scoped to that caller"
  );
});

test("the issue key is still checked against whichever mapping was chosen", async () => {
  // The branch above only decides WHICH Jira project may be driven. This is
  // the check that refuses an issue belonging to a different one, and it has
  // to run for every path through resolveContext, not just the link one.
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("functions/api/jira/issues/status.js", "utf8");
  const fn = source.slice(
    source.indexOf("async function resolveContext"),
    source.indexOf("/** Jira's own errors already carry a status")
  );
  const code = fn.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  assert.ok(code.includes("WRONG_JIRA_PROJECT"));
  // After the if/else chain that picks a mapping - so it applies to all three
  // of the authorisation paths the header documents.
  const lastBranch = code.lastIndexOf("getMappingByJiraProjectKey(");
  assert.ok(
    code.indexOf("WRONG_JIRA_PROJECT") > lastBranch,
    "the prefix check must come after the mapping is chosen, not inside one branch"
  );
});
