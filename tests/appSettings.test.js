import test from "node:test";
import assert from "node:assert/strict";
import {
  SETTING_DEFINITIONS,
  SETTING_KEYS,
  maskSecret,
  resolveSettingValues,
} from "../functions/_lib/app-settings.js";

function rowsFrom(entries) {
  return new Map(
    Object.entries(entries).map(([key, value]) => [
      key,
      typeof value === "string"
        ? { value, updatedAt: "2026-01-01 10:00:00", updatedBy: "admin@example.com" }
        : value,
    ])
  );
}

test("admin_settings is the primary source and wins over .env", () => {
  const values = resolveSettingValues({
    rows: rowsFrom({ pagespeed_api_key: "from-database" }),
    env: { PAGESPEED_API_KEY: "from-env" },
  });

  const entry = values.get("pagespeed_api_key");
  assert.equal(entry.value, "from-database");
  assert.equal(entry.source, "admin_settings");
  assert.equal(entry.updatedBy, "admin@example.com");
});

test(".env is used only as a migration fallback and is reported as such", () => {
  const values = resolveSettingValues({
    env: { PAGESPEED_API_KEY: "from-env" },
  });

  const entry = values.get("pagespeed_api_key");
  assert.equal(entry.value, "from-env");
  assert.equal(entry.source, "env");
});

test("a setting configured nowhere resolves to empty and 'unset'", () => {
  const values = resolveSettingValues({ env: {} });
  const entry = values.get("google_client_secret");
  assert.equal(entry.value, "");
  assert.equal(entry.source, "unset");
});

test("legacy admin_settings 'apis' document still supplies DataForSEO credentials", () => {
  const values = resolveSettingValues({
    legacyDocument: {
      dataforseoLogin: "legacy@example.com",
      dataforseoPassword: "legacy-secret",
      dataforseoUpdatedBy: "old-admin@example.com",
    },
    env: {},
  });

  assert.equal(values.get("dataforseo_login").value, "legacy@example.com");
  assert.equal(values.get("dataforseo_login").source, "admin_settings_legacy");
  assert.equal(values.get("dataforseo_password").value, "legacy-secret");
  assert.equal(values.get("dataforseo_password").updatedBy, "old-admin@example.com");
});

test("a new admin_settings row takes precedence over the legacy document", () => {
  const values = resolveSettingValues({
    rows: rowsFrom({ dataforseo_login: "current@example.com" }),
    legacyDocument: { dataforseoLogin: "legacy@example.com" },
    env: { DATAFORSEO_LOGIN: "env@example.com" },
  });

  assert.equal(values.get("dataforseo_login").value, "current@example.com");
  assert.equal(values.get("dataforseo_login").source, "admin_settings");
});

test("VITE_-prefixed variables are still read during migration but only server-side", () => {
  const values = resolveSettingValues({
    env: {
      VITE_BING_WEBMASTER_API_KEY: "vite-bing",
      VITE_DATAFORSEO_LOGIN: "vite-login",
      VITE_GOOGLE_CLIENT_ID: "vite-client-id",
    },
  });

  assert.equal(values.get("bing_webmaster_api_key").value, "vite-bing");
  assert.equal(values.get("dataforseo_login").value, "vite-login");
  assert.equal(values.get("google_client_id").value, "vite-client-id");
});

test("the non-VITE variable wins when both are present", () => {
  const values = resolveSettingValues({
    env: {
      BING_WEBMASTER_API_KEY: "server-key",
      VITE_BING_WEBMASTER_API_KEY: "browser-key",
    },
  });

  assert.equal(values.get("bing_webmaster_api_key").value, "server-key");
});

test("Google OAuth redirect URIs map to separate keys per flow", () => {
  const values = resolveSettingValues({
    rows: rowsFrom({
      google_gsc_redirect_uri: "https://app.example.com/gsc/oauth-callback",
      google_auth_redirect_uri: "https://app.example.com/api/auth/google/callback",
      google_gbp_redirect_uri: "https://app.example.com/gbp/oauth-callback",
    }),
  });

  assert.equal(values.get("google_gsc_redirect_uri").value, "https://app.example.com/gsc/oauth-callback");
  assert.equal(
    values.get("google_auth_redirect_uri").value,
    "https://app.example.com/api/auth/google/callback"
  );
  assert.equal(values.get("google_gbp_redirect_uri").value, "https://app.example.com/gbp/oauth-callback");
});

test("only OAuth client id and redirect URIs are marked browser-safe", () => {
  const publicKeys = SETTING_DEFINITIONS.filter((item) => item.public).map((item) => item.key);
  assert.deepEqual(publicKeys.sort(), [
    "google_auth_redirect_uri",
    "google_client_id",
    "google_gbp_redirect_uri",
    "google_gsc_redirect_uri",
  ]);

  const secretKeys = SETTING_DEFINITIONS.filter((item) => item.secret).map((item) => item.key);
  for (const key of secretKeys) {
    assert.ok(!publicKeys.includes(key), `${key} is a secret and must not be public`);
  }
  assert.ok(secretKeys.includes("google_client_secret"));
  assert.ok(secretKeys.includes("dataforseo_password"));
  assert.ok(secretKeys.includes("pagespeed_api_key"));
  assert.ok(secretKeys.includes("bing_webmaster_api_key"));
});

test("setting keys are unique snake_case identifiers that fit the column", () => {
  assert.equal(new Set(SETTING_KEYS).size, SETTING_KEYS.length);
  for (const key of SETTING_KEYS) {
    assert.match(key, /^[a-z][a-z0-9_]*$/, `${key} should be snake_case`);
    assert.ok(key.length <= 100, `${key} must fit admin_settings.setting_key`);
  }
});

test("maskSecret never reveals more than the last four characters", () => {
  assert.equal(maskSecret("supersecretvalue"), "••••alue");
  assert.equal(maskSecret(""), "");
  assert.ok(!maskSecret("supersecretvalue").includes("supersecret"));
});
