import test from "node:test";
import assert from "node:assert/strict";
import { GSC_MODULES, isFreshGscResult, resolveGscData } from "./gsc-server.js";

const audit = (fetchedAt) => ({ signedIn: true, metrics: {}, topQueries: [], fetchedAt });
const insights = (fetchedAt) => ({ signedIn: true, summary: {}, keywords: [], fetchedAt });

test("only the audit and insights keys are managed, never the shared gsc key", () => {
  assert.deepEqual(Object.keys(GSC_MODULES), ["gsc_audit", "gsc_insights"]);
});

test("freshness needs a usable result with a recent fetchedAt", () => {
  const now = Date.parse("2026-10-02T12:00:00Z");
  assert.equal(isFreshGscResult("gsc_audit", audit("2026-10-02T00:00:00Z"), now), true);
  assert.equal(isFreshGscResult("gsc_audit", audit("2026-09-30T00:00:00Z"), now), false);
  assert.equal(isFreshGscResult("gsc_audit", audit(undefined), now), false);
  assert.equal(isFreshGscResult("gsc_audit", insights(new Date().toISOString()), now), false);
  assert.equal(isFreshGscResult("gsc_insights", insights("2026-10-02T00:00:00Z"), now), true);
});

test("fresh saved results are served without calling Google", async () => {
  const now = new Date().toISOString();
  const saved = { gsc_audit: audit(now), gsc_insights: insights(now) };
  const result = await resolveGscData({ env: {}, project: { user_id: 1, project_id: "p" }, saved });
  assert.equal(result.gsc_audit.status, "cached");
  assert.equal(result.gsc_insights.data, saved.gsc_insights);
});
