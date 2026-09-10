import test from "node:test";
import assert from "node:assert/strict";

const { default: config } = await import("../vite.config.js");

const plugin = config.plugins.find((entry) => entry && entry.name === "seox-deepseek-settings-api");

test("DeepSeek settings API is mounted for both Vite dev and preview", () => {
  assert.ok(plugin, "DeepSeek settings plugin should be registered");
  assert.equal(typeof plugin.configureServer, "function");
  assert.equal(typeof plugin.configurePreviewServer, "function");
  assert.equal(config.preview?.port, 4173);
});
