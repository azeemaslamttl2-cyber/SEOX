// The read-only Jira-eligible issue feed: GET /api/jira/issues?admin_token=
//
// No database and no HTTP server: the extraction rules and the eligibility
// rules are pure, and the route is called directly with a Request and a stub
// env - the convention the other jira tests use.
//
// The fixtures below are trimmed copies of results actually stored in
// `tool_results`, so a change in a module's vocabulary ('notfound', 'found',
// good:false) fails here rather than silently emptying the endpoint.

import test from "node:test";
import assert from "node:assert/strict";

import {
  extractAuditIssueFindings,
  extractScreamingFrogFindings,
  extractToolFindings,
  extractWpSecurityFinding,
} from "../functions/_lib/jira-eligible-sources.js";
import { evaluateEligibility, parseEligibleQuery } from "../functions/_lib/jira-eligible.js";
import { buildFingerprint } from "../functions/_lib/jira-fingerprint.js";
import { onRequest } from "../functions/api/jira/issues.js";

const PAGE = "https://example.com/";

// --- extraction ------------------------------------------------------------

test("a failing E-E-A-T check becomes a finding and a passing one does not", () => {
  const findings = extractToolFindings("eeat", {
    url: PAGE,
    sections: [
      {
        id: "authority",
        title: "Authority & Technical",
        checks: [
          { name: "Meta Description", desc: "Meta description is present", badge: "Not found", status: "fail" },
          { name: "SSL Certificate (HTTPS)", desc: "Secure connection", badge: "HTTPS enabled", status: "pass" },
        ],
      },
    ],
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].sourceModule, "eeat");
  assert.equal(findings[0].findingType, "authority-meta-description");
  assert.equal(findings[0].currentValue, "Not found");
  assert.equal(findings[0].url, PAGE);
});

test("robots.txt 'notfound' counts as a problem", () => {
  // This module never emits 'fail'; if 'notfound' stopped being treated as a
  // defect the robots source would silently return nothing.
  const findings = extractToolFindings("robots", {
    url: PAGE,
    checks: [
      { name: "Sitemap Declared", desc: "XML sitemap URL is declared", badge: "Not Found", status: "notfound" },
      { name: "Robots.txt Accessible", desc: "returns 200", badge: "HTTP 200", status: "pass" },
    ],
  });
  assert.deepEqual(findings.map((f) => f.findingType), ["sitemap-declared"]);
});

test("crawl optimisation uses its own stored priority for severity", () => {
  const findings = extractToolFindings("crawlOptimization", {
    url: PAGE,
    sections: [
      {
        id: "metadata",
        title: "Unnecessary Metadata",
        checks: [
          { name: "Shortlinks Tags", desc: "adds redirect chains", status: "found", priority: "HIGH" },
          { name: "RSD / WLW Link Tags", desc: "legacy links", status: "found", priority: "LOW" },
          { name: "oEmbed Links", desc: "discovery links", status: "clean", priority: "HIGH" },
        ],
      },
    ],
  });

  assert.equal(findings.length, 2);
  assert.equal(findings.find((f) => f.findingType.includes("shortlinks")).severity, "error");
  assert.equal(findings.find((f) => f.findingType.includes("rsd")).severity, "notice");
  // It reports as the auditor, so a crawl defect cannot be filed twice.
  assert.equal(findings[0].sourceModule, "auditor");
});

test("a failing Core Web Vital is an error, an opportunity is only a notice", () => {
  const findings = extractToolFindings("speed", {
    url: PAGE,
    cwv: [
      { metric: "LCP", full: "Largest Contentful Paint", value: "6.8 s", good: false },
      { metric: "CLS", full: "Cumulative Layout Shift", value: "0.01", good: true },
    ],
    opportunities: [{ name: "Reduce unused CSS", savings: "Est savings of 127 KiB" }],
    sections: [],
  });

  const cwv = findings.find((f) => f.findingType === "core-web-vitals-lcp");
  assert.ok(cwv, "the failing metric is reported");
  assert.equal(cwv.severity, "error");
  assert.equal(cwv.currentValue, "6.8 s");
  assert.ok(!findings.some((f) => f.findingType === "core-web-vitals-cls"), "a good metric is not a finding");
  assert.equal(findings.find((f) => f.title === "Reduce unused CSS").severity, "notice");
});

test("W3C messages collapse to one finding per distinct message", () => {
  // The stored results carry 300+ messages; one Jira issue each is unusable.
  const messages = Array.from({ length: 40 }, (_, i) => ({
    type: "error",
    message: "Element li not allowed as child of element div",
    line: i + 1,
  }));
  messages.push({ type: "info", message: "Trailing slash on void elements", line: 99 });

  const findings = extractToolFindings("w3c-validation", { url: PAGE, messages });

  assert.equal(findings.length, 1, "40 occurrences of one problem are one finding");
  assert.equal(findings[0].currentValue, "40 occurrences");
  assert.equal(findings[0].severity, "error");
  assert.equal(findings[0].evidence.occurrences, 40);
  assert.ok(!findings.some((f) => f.title.includes("Trailing slash")), "'info' is not a defect");
});

test("duplicate pages with no measured overlap are not invented as findings", () => {
  // The stored blobs list every scanned page here, including ones the module's
  // own summary reports as 0% duplicate.
  const findings = extractToolFindings("duplicate", {
    duplicatePages: [
      { url: "https://example.com/a", duplicateWords: 0, matches: [], matchPercent: 100 },
      { url: "https://example.com/b", duplicateWords: 120, matches: [{}], matchPercent: 64, matchPages: 2 },
    ],
  });

  assert.deepEqual(findings.map((f) => f.url), ["https://example.com/b"]);
  assert.equal(findings[0].findingType, "duplicate-content");
});

test("plagiarism only reports when matches were actually found", () => {
  assert.equal(extractToolFindings("plagiarism", { sourceUrl: PAGE, matches: [], uniqueScore: 0 }).length, 0);
  assert.equal(extractToolFindings("plagiarism", { sourceUrl: PAGE, matches: [{}, {}], uniqueScore: 60 }).length, 1);
});

test("modules that store no verdicts contribute nothing", () => {
  // dashboardChecks reports that a check could not RUN, which is an
  // operational problem rather than an SEO defect.
  assert.deepEqual(extractToolFindings("dashboardChecks", { tools: { gsc: { status: "error" } } }), []);
  assert.deepEqual(extractToolFindings("sitemap", { url: PAGE, count: 48, pages: [{ loc: PAGE }] }), []);
  assert.deepEqual(extractToolFindings("unknown-future-tool", { anything: true }), []);
});

test("a Screaming Frog import folds onto the auditor's own slugs", () => {
  // Otherwise the same defect found by both the crawl and the import would
  // fingerprint differently and file two Jira issues.
  const findings = extractScreamingFrogFindings({
    url: "https://example.com/hero.webp",
    findings: [
      { check: "title_missing", count: 1 },
      { check: "h1_missing", count: 3 },
      { check: "title_over_60", count: 1 },
    ],
  });

  assert.deepEqual(findings.map((f) => f.findingType), [
    "title-tag-missing-or-empty",
    "h1-tag-missing-or-empty",
    // A 60-character threshold is not the auditor's 70-character one, so it
    // keeps its own identity rather than being merged into title-too-long.
    "title_over_60",
  ]);
  assert.equal(findings[0].sourceModule, "auditor");
  assert.equal(findings[1].currentValue, "3 occurrences");
});

test("a WordPress vulnerability is site-scoped and keeps its severity", () => {
  const finding = extractWpSecurityFinding({
    kind: "plugin",
    component_slug: "contact-form-7",
    installed_version: "5.0",
    fixed_in: "5.9",
    severity: "critical",
    title: "Unauthenticated file upload",
    detail: "An attacker can upload arbitrary files.",
    cve: "CVE-2020-0000",
  });

  assert.equal(finding.sourceModule, "wpscan");
  assert.equal(finding.severity, "error"); // 'critical' normalises onto the auditor scale
  assert.equal(finding.scopeKind, "site");
  assert.match(finding.recommendation, /5\.9/);
});

test("the persisted browser crawl map expands to one finding per URL", () => {
  const findings = extractAuditIssueFindings({
    "404-page": {
      slug: "404-page",
      title: "404 page",
      severity: "error",
      count: 2,
      urls: [{ url: "https://example.com/gone", status: 404 }, { url: "https://example.com/old", status: 404 }],
    },
  });
  assert.equal(findings.length, 2);
  assert.equal(findings[0].severity, "error");
  assert.equal(findings[0].currentValue, "HTTP 404");
});

test("extracted findings can be fingerprinted, so they round-trip to the create path", () => {
  // The whole point: a caller can POST one of these findings back to
  // /api/jira/issues and land on the row this endpoint reported.
  const [finding] = extractToolFindings("robots", {
    url: PAGE,
    checks: [{ name: "Sitemap Declared", desc: "d", status: "notfound" }],
  });
  const identity = buildFingerprint({
    projectId: "proj_1",
    sourceModule: finding.sourceModule,
    findingType: finding.findingType,
    scope: { kind: "url", url: finding.url },
  });
  assert.match(identity.fingerprint, /^[0-9a-f]{64}$/);
});

// --- eligibility -----------------------------------------------------------

test("eligibility: an unfiled finding is eligible", () => {
  assert.deepEqual(evaluateEligibility(null), { eligible: true, reason: "not_linked" });
});

test("eligibility: an already-filed finding is not offered again", () => {
  const verdict = evaluateEligibility({ state: "linked", seox_state: "open" });
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.reason, "already_linked");
});

test("eligibility: 'won't fix' is respected and never re-offered", () => {
  // Someone decided not to fix this. Re-offering it re-files a declined issue.
  assert.equal(evaluateEligibility({ state: "linked", seox_state: "wont_fix" }).eligible, false);
});

test("eligibility: a reopened finding is eligible again", () => {
  // The fix did not hold - this is the "unless reopening is appropriate" case.
  const verdict = evaluateEligibility({ state: "linked", seox_state: "reopened" });
  assert.equal(verdict.eligible, true);
  assert.equal(verdict.reason, "reopened_still_present");
});

test("eligibility: unlinked and failed rows are eligible again", () => {
  assert.equal(evaluateEligibility({ state: "unlinked", seox_state: "unlinked" }).eligible, true);
  assert.equal(evaluateEligibility({ state: "failed", seox_state: "open" }).eligible, true);
});

// --- query parsing ---------------------------------------------------------

test("admin_token is mandatory", () => {
  assert.throws(() => parseEligibleQuery({}), /admin_token is required/);
  assert.throws(() => parseEligibleQuery({ admin_token: "   " }), /admin_token is required/);
});

test("an over-long token is rejected as invalid, not echoed back", () => {
  const error = (() => {
    try {
      parseEligibleQuery({ admin_token: "x".repeat(600) });
      return null;
    } catch (e) {
      return e;
    }
  })();
  assert.equal(error.status, 401);
  assert.equal(error.message, "Invalid admin_token");
  assert.ok(!error.message.includes("x"), "the submitted token is never echoed");
});

test("the URL is normalised the way SEOX already matches projects", () => {
  // www, scheme, trailing slash and case all collapse onto the stored domain.
  for (const url of [
    "https://example.com",
    "https://example.com/",
    "http://example.com",
    "https://www.example.com/",
    "https://EXAMPLE.com",
  ]) {
    assert.equal(parseEligibleQuery({ admin_token: "t", url }).domain, "example.com");
  }
});

test("paging defaults are sane and bounded", () => {
  assert.deepEqual(
    (({ page, limit }) => ({ page, limit }))(parseEligibleQuery({ admin_token: "t" })),
    { page: 1, limit: 100 }
  );
  assert.equal(parseEligibleQuery({ admin_token: "t", limit: "99999" }).limit, 500);
  assert.equal(parseEligibleQuery({ admin_token: "t", page: "-4" }).page, 1);
});

test("boolean filters accept the usual spellings and ignore nonsense", () => {
  assert.equal(parseEligibleQuery({ admin_token: "t", jira_created: "false" }).filters.jiraCreated, false);
  assert.equal(parseEligibleQuery({ admin_token: "t", jira_created: "1" }).filters.jiraCreated, true);
  assert.equal(parseEligibleQuery({ admin_token: "t", jira_created: "maybe" }).filters.jiraCreated, null);
  assert.equal(parseEligibleQuery({ admin_token: "t" }).filters.jiraCreated, null);
});

test("severity filters normalise onto the auditor scale", () => {
  assert.equal(parseEligibleQuery({ admin_token: "t", severity: "critical" }).filters.severity, "error");
  assert.equal(parseEligibleQuery({ admin_token: "t", severity: "medium" }).filters.severity, "warning");
});

// --- the route ------------------------------------------------------------

const noDbEnv = {}; // no MySQL configured

async function get(url, env = noDbEnv) {
  const response = await onRequest({ request: new Request(url), env });
  return { status: response.status, body: await response.json() };
}

async function post(payload, env = noDbEnv) {
  const response = await onRequest({
    request: new Request("http://localhost:3000/api/jira/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    env,
  });
  return { status: response.status, body: await response.json() };
}

test("POST without an admin_token stays on the session-authenticated path", async () => {
  // The create path must keep working exactly as before, and the feed must
  // not be readable anonymously.
  const { status } = await post({ action: "create", projectId: "p" });
  assert.equal(status, 401);
});

test("GET without an admin_token does NOT fall back to the admin path", async () => {
  const { status } = await get("http://localhost/api/jira/issues");
  assert.equal(status, 401);
});

test("a blank admin_token is rejected, never treated as absent", async () => {
  // Presence of the field selects the mode, so an empty token is a 400 rather
  // than silently becoming an anonymous or session request.
  const posted = await post({ admin_token: "" });
  assert.equal(posted.status, 400);
  assert.equal(posted.body.success, false);
  assert.equal(posted.body.error, "admin_token is required");

  const got = await get("http://localhost/api/jira/issues?admin_token=");
  assert.equal(got.status, 400);
  assert.equal(got.body.error, "admin_token is required");
});

test("the response is always JSON with a success flag on failure", async () => {
  const { body } = await post({ admin_token: "" });
  assert.equal(typeof body, "object");
  assert.equal(body.success, false);
  assert.ok(typeof body.error === "string");
  assert.ok(!("stack" in body), "no stack trace is ever returned");
});

test("OPTIONS is answered without touching the database", async () => {
  const response = await onRequest({
    request: new Request("http://localhost/api/jira/issues", { method: "OPTIONS" }),
    env: noDbEnv,
  });
  assert.equal(response.status, 204);
});

test("an `action` in an admin_token body can never reach a write path", async () => {
  // This is the read-only guarantee. The admin branch is dispatched before the
  // action switch, so a body that looks like a create request is still only
  // ever read: it fails on the token, not on the finding payload.
  const { status, body } = await post({
    admin_token: "",
    action: "create",
    projectId: "p",
    finding: { sourceModule: "robots", findingType: "sitemap-declared", scope: { kind: "site" } },
  });

  assert.equal(status, 400);
  assert.equal(body.error, "admin_token is required", "the admin branch owned the request");
  assert.ok(!("created" in body), "no create was attempted");
});

test("admin_token never unlocks a write verb other than the read-only POST", async () => {
  for (const method of ["PUT", "PATCH", "DELETE"]) {
    const response = await onRequest({
      request: new Request("http://localhost/api/jira/issues?admin_token=anything", { method }),
      env: noDbEnv,
    });
    assert.notEqual(response.status, 200, `${method} must not succeed via admin_token`);
  }
});

test("a JSON body's numbers and booleans are honoured, not dropped", async () => {
  // A query string is all strings, but {"limit": 100} is a real number; if it
  // were ignored the caller would silently get the default page size.
  const parsed = parseEligibleQuery({ admin_token: "t", limit: 250, page: 3, jira_created: false });
  assert.equal(parsed.limit, 250);
  assert.equal(parsed.page, 3);
  assert.equal(parsed.filters.jiraCreated, false);
});
