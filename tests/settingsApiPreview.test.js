import test from "node:test";
import assert from "node:assert/strict";

const { default: config } = await import("../vite.config.js");

const plugin = config.plugins.find((entry) => entry && entry.name === "seox-settings-api");

test("General Settings API is mounted for both Vite dev and preview", () => {
  // Production serves the app with `vite preview` on :4173, and /api/* is
  // handled by these plugin middlewares in that same Node process. A route
  // registered only for `configureServer` would 404 in production.
  assert.ok(plugin, "Settings plugin should be registered");
  assert.equal(typeof plugin.configureServer, "function");
  assert.equal(typeof plugin.configurePreviewServer, "function");
  assert.equal(config.preview?.port, 4173);
});

test("settings routes reach the server-side handlers, not the client bundle", async () => {
  const mounted = [];
  const server = {
    middlewares: {
      use(path) {
        mounted.push(path);
      },
    },
  };

  plugin.configurePreviewServer(server);
  assert.ok(mounted.includes("/api/settings/general"));
  assert.ok(mounted.includes("/api/settings/public"));
});

test("the general settings handler requires an administrator", async () => {
  const { onRequest } = await import("../functions/api/settings/general.js");
  const response = await onRequest({
    request: new Request("http://localhost/api/settings/general", { method: "GET" }),
    env: {},
  });

  // No Authorization header -> rejected before any database or settings access.
  assert.equal(response.status, 401);
});

test("the public settings route exposes no secret fields", async () => {
  const { onRequest } = await import("../functions/api/settings/public.js");
  const response = await onRequest({
    request: new Request("http://localhost/api/settings/public", { method: "GET" }),
    env: {
      // Point at a closed port so the admin_settings read fails immediately and
      // the route falls back to the environment, which is what this asserts.
      MYSQL_HOST: "127.0.0.1",
      MYSQL_PORT: "1",
      GOOGLE_CLIENT_ID: "public-client-id",
      GOOGLE_CLIENT_SECRET: "must-not-leak",
      PAGESPEED_API_KEY: "must-not-leak",
      DATAFORSEO_PASSWORD: "must-not-leak",
      BING_WEBMASTER_API_KEY: "must-not-leak",
    },
  });

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body).sort(), [
    "googleAuthRedirectUri",
    "googleClientId",
    "googleGbpRedirectUri",
    "googleGscRedirectUri",
  ]);
  assert.ok(!JSON.stringify(body).includes("must-not-leak"));
});
