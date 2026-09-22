import test from "node:test";
import assert from "node:assert/strict";

const { default: config } = await import("../vite.config.js");

const plugin = config.plugins.find((entry) => entry && entry.name === "seox-jira-api");

const JIRA_ROUTES = [
  "/api/jira/connect",
  "/api/jira/status",
  "/api/jira/metadata",
  "/api/jira/mapping",
  "/api/jira/issues",
  "/api/jira/webhook",
  "/api/jira/jobs",
];

test("the Jira API is mounted for both Vite dev and preview", () => {
  // Production serves the app with `vite preview` on :4173, and /api/* is
  // handled by these plugin middlewares in that same Node process. A route
  // registered only for `configureServer` would 404 in production while
  // passing every local test - which is the specific way this codebase has
  // been caught out before.
  assert.ok(plugin, "Jira plugin should be registered");
  assert.equal(typeof plugin.configureServer, "function");
  assert.equal(typeof plugin.configurePreviewServer, "function");
  assert.equal(config.preview?.port, 4173);
});

test("every Jira route reaches the server-side handlers in preview", () => {
  const mounted = [];
  const server = { middlewares: { use(path) { mounted.push(path); } } };

  plugin.configurePreviewServer(server);

  for (const route of JIRA_ROUTES) {
    assert.ok(mounted.includes(route), `${route} is not mounted for preview`);
  }
});

test("the dev server mounts exactly the same routes as preview", () => {
  const dev = [];
  const preview = [];
  plugin.configureServer({ middlewares: { use: (path) => dev.push(path) } });
  plugin.configurePreviewServer({ middlewares: { use: (path) => preview.push(path) } });

  assert.deepEqual(dev.sort(), preview.sort());
});

test("adding Jira did not disturb the existing API plugins", () => {
  // Jira is additive. Every plugin that served /api/* before must still be
  // registered, and still for both hooks.
  for (const name of [
    "seox-gbp-api",
    "seox-settings-api",
    "seox-projects-api",
    "seox-deepseek-api",
    "seox-auditor-api",
  ]) {
    const existing = config.plugins.find((entry) => entry && entry.name === name);
    assert.ok(existing, `${name} should still be registered`);
    assert.equal(typeof existing.configurePreviewServer, "function", `${name} lost its preview hook`);
  }
});
