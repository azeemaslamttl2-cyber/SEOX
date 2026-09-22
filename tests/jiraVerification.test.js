import test from "node:test";
import assert from "node:assert/strict";

import {
  VERIFICATION_KINDS,
  deriveVerificationSpec,
  describeCheck,
} from "../functions/_lib/jira-verification.js";
import { mapJiraStateToSeox, SEOX_STATES } from "../functions/_lib/jira-status-map.js";

const url = "https://example.com/blog/seo-guide";

function specFor(findingType, overrides = {}) {
  return deriveVerificationSpec({
    sourceModule: "auditor",
    findingType,
    scopeKind: "url",
    url,
    ...overrides,
  });
}

test("the common auditor findings all get a real, automatic check", () => {
  // These are the finding types the integration is mostly used for. If any of
  // them silently became 'manual', the verification loop would quietly stop
  // being the reason to use this feature at all.
  const mustBeAutomatic = [
    "404-page",
    "4xx-page",
    "5xx-page",
    "timed-out",
    "redirect-loop",
    "redirect-chain-too-long",
    "title-tag-missing-or-empty",
    "title-too-short",
    "title-too-long",
    "multiple-title-tags",
    "meta-description-missing",
    "multiple-meta-description-tags",
    "h1-tag-missing-or-empty",
    "noindex-page",
    "nofollow-page",
    "missing-alt-text",
    "non-canonical-page-specified-as-canonical-one",
    "canonical-points-to-4xx",
    "https-http-mixed-content",
    "page-has-no-outgoing-links",
  ];

  for (const findingType of mustBeAutomatic) {
    const spec = specFor(findingType);
    assert.equal(spec.kind, "url_check", findingType);
    assert.equal(spec.url, url, findingType);
    assert.ok(Array.isArray(spec.checks) && spec.checks.length > 0, findingType);
  }
});

test("a finding type with no reliable check is marked manual, with a reason", () => {
  const spec = specFor("orphan-page-has-no-incoming-internal-links");
  assert.equal(spec.kind, VERIFICATION_KINDS.MANUAL);
  assert.ok(spec.reason);
  // Being honest about what cannot be checked is better than a meaningless
  // green tick.
  assert.match(spec.reason, /re-run the audit/i);
});

test("site-wide and batched findings cannot be verified by fetching one page", () => {
  const site = deriveVerificationSpec({
    sourceModule: "auditor",
    findingType: "robots-txt-blocks-important-pages",
    scopeKind: "site",
  });
  assert.equal(site.kind, VERIFICATION_KINDS.MANUAL);
  assert.match(site.reason, /site-wide/i);

  const batch = deriveVerificationSpec({
    sourceModule: "auditor",
    findingType: "meta-description-missing",
    scopeKind: "batch",
    url,
  });
  assert.equal(batch.kind, VERIFICATION_KINDS.MANUAL);
  assert.match(batch.reason, /several URLs/i);
});

test("findings from modules other than the auditor are manual for now", () => {
  for (const sourceModule of ["speed", "wpscan", "gsc", "gbp", "eeat"]) {
    const spec = deriveVerificationSpec({ sourceModule, findingType: "anything", scopeKind: "url", url });
    assert.equal(spec.kind, VERIFICATION_KINDS.MANUAL, sourceModule);
  }
});

test("a meta description check bounds the length as well as the presence", () => {
  const spec = specFor("meta-description-missing");
  const types = spec.checks.map((check) => check.type);
  assert.ok(types.includes("tag_present"));
  assert.ok(types.includes("tag_length"), "an empty-but-present tag must not count as fixed");
});

test("every check describes itself in language a developer can act on", () => {
  const seen = new Set();
  for (const findingType of Object.keys({
    "404-page": 1,
    "redirect-loop": 1,
    "title-too-long": 1,
    "meta-description-missing": 1,
    "noindex-page": 1,
    "missing-alt-text": 1,
    "non-canonical-page-specified-as-canonical-one": 1,
    "https-http-mixed-content": 1,
    "page-has-no-outgoing-links": 1,
  })) {
    for (const check of specFor(findingType).checks) {
      const description = describeCheck(check);
      assert.ok(description && description.length > 5, `${findingType}/${check.type}`);
      // No placeholder text leaking into a customer's Jira board.
      assert.equal(description.includes("undefined"), false, description);
      seen.add(check.type);
    }
  }
  assert.ok(seen.size >= 6, "the sample should cover several distinct check types");
});

test("an unknown check type still yields a sentence rather than 'undefined'", () => {
  assert.ok(describeCheck({ type: "made_up" }).length > 5);
  assert.ok(describeCheck(null).length > 5);
});

test("the verification outcome and the Jira state agree about what happens next", () => {
  // Done + a real resolution means verify. Done + "Won't Do" means do not.
  assert.equal(
    mapJiraStateToSeox({ statusCategory: "done", resolution: "Fixed" }).shouldVerify,
    true
  );
  assert.equal(
    mapJiraStateToSeox({ statusCategory: "done", resolution: "Won't Do" }).shouldVerify,
    false
  );
  assert.equal(
    mapJiraStateToSeox({ statusCategory: "done", resolution: "Won't Do" }).seoxState,
    SEOX_STATES.WONT_FIX
  );
});

test("the runner refuses a spec whose URL is not publicly fetchable", async () => {
  const { runVerification } = await import("../functions/_lib/jira-verify.js");

  // An SSRF attempt must surface as "could not check", never as a fetch.
  const result = await runVerification({
    kind: "url_check",
    url: "http://169.254.169.254/latest/meta-data/",
    checks: [{ type: "http_status_ok" }],
  });

  assert.equal(result.outcome, "unavailable");
  assert.ok(result.error);
});

test("a manual spec resolves without touching the network", async () => {
  const { runVerification } = await import("../functions/_lib/jira-verify.js");
  const result = await runVerification({ kind: "manual", reason: "nothing to check" });
  assert.equal(result.outcome, "manual");
  assert.deepEqual(result.checks, []);
  assert.equal(result.reason, "nothing to check");
});

test("a missing spec is treated as manual rather than throwing", async () => {
  const { runVerification } = await import("../functions/_lib/jira-verify.js");
  const result = await runVerification(null);
  assert.equal(result.outcome, "manual");
});
