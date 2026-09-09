import test from "node:test";
import assert from "node:assert/strict";
import { buildSpeedResult, findProblemResources } from "../../../src/lib/speedTestResult.js";
import { mergeSpeedProjectData, onRequest } from "./speed.js";

function speedRequest(body, headers = {}) {
  return new Request("https://example.com/api/tech-seo/speed-test", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("speed requires admin_token and does not use Authorization authentication", async () => {
  const response = await onRequest({
    request: speedRequest({ url: "https://example.com" }, { Authorization: "Bearer stale-session" }),
    env: { ADMIN_TOKEN: "valid-admin-token" },
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "admin_token is required.");
});

test("speed accepts a valid body admin_token even with an unrelated Authorization header", async () => {
  const response = await onRequest({
    request: speedRequest(
      { admin_token: "valid-admin-token" },
      { Authorization: "Bearer stale-session" }
    ),
    env: { ADMIN_TOKEN: "valid-admin-token" },
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "url is required.");
});

test("speed result exposes only resources with detected performance problems", () => {
  const result = buildSpeedResult(
    "https://example.com/",
    { lighthouseResult: { audits: {
      "unused-css-rules": {
        score: 0,
        title: "Remove unused CSS",
        details: { items: [{ url: "https://cdn.example.com/app.css", totalBytes: 82341, wastedBytes: 45231 }] },
      },
      "unused-javascript": {
        score: 0,
        title: "Remove unused JavaScript",
        details: { items: [{ url: "https://cdn.example.com/app.js", totalBytes: 154320, wastedBytes: 78231 }] },
      },
      "modern-image-formats": {
        score: 1,
        details: { items: [{ url: "https://images.example.com/hero.webp" }] },
      },
    } } },
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
    {}
  );

  assert.equal(result.problems.css.length, 1);
  assert.equal(result.problems.css[0].resource_url, "https://cdn.example.com/app.css");
  assert.equal(result.problems.javascript[0].problems[0].type, "unused_javascript");
  assert.equal(result.problems.images.length, 0);
  assert.equal(result.problems.fonts.length, 0);
  assert.equal(result.problem_summary.total_problematic_resources, 2);
  assert.equal(result.resources, undefined);
});

test("resource problems from mobile and desktop audits are deduplicated", () => {
  const problems = findProblemResources([
    { audits: {
      "render-blocking-resources": { score: 0, title: "Render blocking resources", details: { items: [{ url: "https://example.com/app.js", wastedMs: 120 }] } },
      "unused-javascript": { score: 0, title: "Remove unused JavaScript", details: { items: [{ url: "https://example.com/app.js", wastedBytes: 500 }] } },
    } },
  ]);

  assert.equal(problems.javascript.length, 1);
  assert.equal(problems.javascript[0].problems.length, 2);
  assert.equal(problems.javascript[0].details.wastedMs, 120);
  assert.equal(problems.all.length, 1);
});

test("all resource types are returned when a failed audit provides a URL", () => {
  const problems = findProblemResources([{ audits: {
    "font-display": { score: 0, details: { items: [{ url: "https://example.com/site.woff2", resourceType: "Font" }] } },
    "video-size": { score: 0, details: { items: [{ url: "https://example.com/intro.mp4", resourceType: "Video" }] } },
    "document-size": { score: 0, details: { items: [{ url: "https://example.com/", resourceType: "Document" }] } },
    "json-transfer": { score: 0, details: { items: [{ url: "https://example.com/data.json", resourceType: "XHR" }] } },
  } }]);

  assert.equal(problems.all.length, 4);
  assert.deepEqual(problems.all.map((item) => item.resource_type), ["font", "video", "html", "xhr"]);
});

test("speed project merge replaces only speed and preserves unrelated project data", () => {
  const result = { url: "https://example.com", resources: [{ url: "https://example.com/app.js" }] };
  const merged = mergeSpeedProjectData(
    JSON.stringify({ eeat: { score: 80 }, robots: { status: "ok" }, speed: { old: true }, other_tool_data: { value: 1 } }),
    result
  );

  assert.deepEqual(merged.eeat, { score: 80 });
  assert.deepEqual(merged.robots, { status: "ok" });
  assert.deepEqual(merged.speed, result);
  assert.deepEqual(merged.other_tool_data, { value: 1 });
});
