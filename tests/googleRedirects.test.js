import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  GOOGLE_CALLBACK_PATHS,
  appOrigin,
  googleRedirectUri,
  isLoopbackHostname,
  overrideMatchesFlow,
} from "../functions/_lib/google-redirects.js";
import { invalidateAppSettingsCache } from "../functions/_lib/app-settings.js";

const APP = "https://aismart.thetowertech.com";

/** Reads a source file with line endings normalised: the repo checks out CRLF. */
function read(relative) {
  const CRLF = String.fromCharCode(13) + String.fromCharCode(10);
  return fs.readFileSync(new URL(relative, import.meta.url), "utf8").split(CRLF).join(String.fromCharCode(10));
}

function requestTo(url = `${APP}/api/gbp/connect`) {
  return new Request(url, { method: "POST" });
}

/**
 * The settings service reads `admin_settings` first and only falls back to the
 * environment. With no database reachable the row read fails, so an env-only
 * environment exercises exactly the "setting not configured" case that broke
 * production.
 */
function envWith(overrides = {}) {
  invalidateAppSettingsCache();
  return { APP_URL: APP, ...overrides };
}

test("each Google flow returns to its own route", () => {
  // The three flows land on three different pages, which is why one flow's URI
  // can never substitute for another's.
  assert.equal(GOOGLE_CALLBACK_PATHS.auth, "/api/auth/google/callback");
  assert.equal(GOOGLE_CALLBACK_PATHS.gsc, "/gsc/oauth-callback");
  assert.equal(GOOGLE_CALLBACK_PATHS.gbp, "/gbp/oauth-callback");
  assert.equal(new Set(Object.values(GOOGLE_CALLBACK_PATHS)).size, 3);
});

test("an unconfigured Business Profile redirect derives its own callback, not another flow's", async () => {
  // The production failure: google_gbp_redirect_uri unset, google_auth_redirect_uri
  // set. The server used to answer with the sign-in URI while the browser used
  // <origin>/gbp/oauth-callback, so the two never agreed.
  const env = envWith({ GOOGLE_AUTH_REDIRECT_URI: `${APP}/api/auth/google/callback` });
  const resolved = await googleRedirectUri("gbp", requestTo(), env);

  assert.equal(resolved, `${APP}/gbp/oauth-callback`);
  assert.notEqual(resolved, `${APP}/api/auth/google/callback`);
});

test("the server's derived URI matches what the browser sends", async () => {
  // src/lib/gbpApi.js falls back to `${window.location.origin}/gbp/oauth-callback`.
  const browserFallback = `${APP}/gbp/oauth-callback`;
  const server = await googleRedirectUri("gbp", requestTo(), envWith());
  assert.equal(server, browserFallback);
});

test("a configured redirect still wins", async () => {
  const env = envWith({ GBP_REDIRECT_URI: `${APP}/gbp/oauth-callback` });
  assert.equal(await googleRedirectUri("gbp", requestTo(), env), `${APP}/gbp/oauth-callback`);
});

test("a loopback or malformed override is ignored rather than sent to Google", async () => {
  // Google rejects a loopback redirect for a web client, so a stale local value
  // must not leak into production.
  const loopback = envWith({ GBP_REDIRECT_URI: "http://localhost:5173/gbp/oauth-callback" });
  assert.equal(await googleRedirectUri("gbp", requestTo(), loopback), `${APP}/gbp/oauth-callback`);

  const malformed = envWith({ GBP_REDIRECT_URI: "not-a-url" });
  assert.equal(await googleRedirectUri("gbp", requestTo(), malformed), `${APP}/gbp/oauth-callback`);
});

test("a redirect saved against the wrong flow is ignored, not sent to Google", async () => {
  // Exactly the state found in the database: the Business Profile setting held
  // the sign-in callback. Honouring it would return the GBP consent to the
  // sign-in handler and the connection would never complete.
  const env = envWith({ GBP_REDIRECT_URI: APP + "/api/auth/google/callback" });
  assert.equal(await googleRedirectUri("gbp", requestTo(), env), APP + "/gbp/oauth-callback");

  const gsc = envWith({ GOOGLE_REDIRECT_URI: APP + "/gbp/oauth-callback" });
  assert.equal(await googleRedirectUri("gsc", requestTo(), gsc), APP + "/gsc/oauth-callback");
});

test("a deployment under a base path keeps its configured redirect", () => {
  assert.ok(overrideMatchesFlow(new URL(APP + "/gbp/oauth-callback"), "gbp"));
  assert.ok(overrideMatchesFlow(new URL(APP + "/app/gbp/oauth-callback"), "gbp"));
  assert.ok(!overrideMatchesFlow(new URL(APP + "/gsc/oauth-callback"), "gbp"));
  assert.ok(!overrideMatchesFlow(new URL(APP + "/dashboard"), "gbp"));
});

test("a loopback request falls back to the public origin", () => {
  assert.ok(isLoopbackHostname("localhost"));
  assert.ok(isLoopbackHostname("127.0.0.1"));
  assert.ok(!isLoopbackHostname("aismart.thetowertech.com"));

  const local = new Request("http://127.0.0.1:4173/api/gbp/connect", { method: "POST" });
  assert.equal(appOrigin(local, {}), APP);
  // APP_URL wins when it is set to a real host.
  assert.equal(appOrigin(local, { APP_URL: "https://example.com" }), "https://example.com");
});

test("the Business Profile config no longer borrows another flow's redirect", () => {
  const source = read("../functions/_lib/gbp-client.js");
  const config = source.slice(source.indexOf("export async function getOAuthConfig"));
  const body = config.slice(0, config.indexOf("\n}\n") + 3);
  assert.doesNotMatch(body, /google_gsc_redirect_uri/);
  assert.doesNotMatch(body, /google_auth_redirect_uri/);
  assert.match(body, /googleRedirectUri\('gbp'/);
});

test("the browser derives the Business Profile redirect the same way", () => {
  const source = read("../src/lib/gbpApi.js");
  const fn = source.slice(source.indexOf("export async function getGbpRedirectUri"));
  const body = fn.slice(0, fn.indexOf("\n}\n") + 3);
  // No cross-flow fallback, and the same flow-aware rule the server applies.
  assert.doesNotMatch(body, /googleGscRedirectUri/);
  assert.match(body, /resolveConfiguredRedirect\(settings\.googleGbpRedirectUri, "gbp"\)/);
});

test("both sides agree on which route each flow returns to", () => {
  // The server and the browser keep their own copy of these paths; if they
  // drift, every redirect URI comparison starts failing again.
  const browser = read("../src/lib/googleOAuthConfig.js");
  const block = /export const GOOGLE_CALLBACK_PATHS = \{([\s\S]*?)\};/.exec(browser);
  assert.ok(block, "browser callback paths not found");
  for (const [flow, path] of Object.entries(GOOGLE_CALLBACK_PATHS)) {
    assert.ok(
      block[1].includes(`${flow}: "${path}"`),
      `browser path for ${flow} does not match the server (${path})`
    );
  }
});

test("the Search Console flow no longer trusts a redirect saved for another flow", () => {
  // google_gsc_redirect_uri currently holds the Business Profile callback, which
  // would send a Search Console consent to the wrong page.
  const source = read("../src/lib/googleOAuthConfig.js");
  assert.doesNotMatch(source, /settings\.googleGscRedirectUri \|\| runtimeRedirectUri/);
  assert.match(source, /resolveConfiguredRedirect\(settings\.googleGscRedirectUri, "gsc"\)/);
});

test("the token exchange is guarded by the same check as the consent URL", () => {
  // Google also matches redirect_uri when swapping the code for tokens.
  const source = read("../functions/api/gbp/connect.js");
  const guards = source.match(/redirectUri !== expectedRedirectUri/g) || [];
  assert.equal(guards.length, 2, "both the auth-url and exchange legs must check");
});

test("the settings hint no longer tells admins to reuse the Search Console URI", () => {
  const source = read("../src/pages/settings/settingsCatalog.js");
  assert.doesNotMatch(source, /Defaults to the Search Console redirect/);
  assert.match(source, /gbp\/oauth-callback/);
});
