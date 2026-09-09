import test from "node:test";
import assert from "node:assert/strict";
import { buildSpeedResult } from "../../../src/lib/speedTestResult.js";
import { mergeSpeedProjectData } from "./speed.js";

test("speed result preserves every discovered resource URL by category", () => {
  const result = buildSpeedResult(
    "https://example.com/",
    {},
    {},
    {
      loadTime: 120,
      resources: [
        { url: "https://cdn.example.com/site.css", type: "Stylesheet", status: 200 },
        { url: "https://cdn.example.com/app.js", type: "JavaScript", status: 200 },
        { url: "https://images.example.com/hero.webp", type: "Image", status: 200 },
        { url: "https://fonts.example.com/site.woff2", type: "Font", status: 200 },
        { url: "https://video.example.com/intro.mp4", type: "Video", status: 206 },
        { url: "https://example.com/data.json", type: "Other", status: 200 },
      ],
      audit: {},
    },
    {},
    { includeRaw: true }
  );

  assert.equal(result.resourceDetails.css[0].url, "https://cdn.example.com/site.css");
  assert.equal(result.resourceDetails.javascript[0].url, "https://cdn.example.com/app.js");
  assert.equal(result.resourceDetails.images[0].url, "https://images.example.com/hero.webp");
  assert.equal(result.resourceDetails.fonts[0].url, "https://fonts.example.com/site.woff2");
  assert.equal(result.resourceDetails.videos[0].url, "https://video.example.com/intro.mp4");
  assert.equal(result.resourceDetails.other[0].url, "https://example.com/data.json");
  assert.equal(result.resources.length, 6);
});

test("speed project merge preserves unrelated project data", () => {
  const result = { url: "https://example.com", resources: [{ url: "https://example.com/app.js" }] };
  const merged = mergeSpeedProjectData(
    JSON.stringify({ eeat: { score: 80 }, robots: { status: "ok" }, speed: { old: true } }),
    result
  );

  assert.deepEqual(merged.eeat, { score: 80 });
  assert.deepEqual(merged.robots, { status: "ok" });
  assert.deepEqual(merged.speed, result);
});
