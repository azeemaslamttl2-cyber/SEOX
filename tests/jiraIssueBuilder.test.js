import test from "node:test";
import assert from "node:assert/strict";

import {
  REQUIRED_LABEL,
  SUMMARY_MAX,
  URL_RENDER_LIMIT,
  adfToPlainText,
  buildCreateIssuePayload,
  buildDescriptionAdf,
  buildLabels,
  buildSummary,
  buildVerificationComment,
  sanitizeLabel,
} from "../functions/_lib/jira-issue-builder.js";
import { deriveVerificationSpec } from "../functions/_lib/jira-verification.js";
import { normalizeFindingPayload } from "../functions/_lib/jira-finding.js";

const mapping = {
  jiraProjectId: "10001",
  defaultIssueTypeId: "10002",
  defaultPriorityId: "3",
  prioritySupported: true,
  defaultAssigneeAccountId: null,
  defaultLabels: ["seox", "seo"],
  components: [],
  severityPriorityMap: { error: "2", warning: "3", notice: "4" },
};

function findingFor(overrides = {}) {
  const { finding } = normalizeFindingPayload(
    {
      sourceModule: "auditor",
      findingType: "meta-description-missing",
      title: "Meta description tag missing or empty",
      severity: "warning",
      scope: { kind: "url", url: "https://example.com/blog/seo-guide" },
      currentValue: "",
      expectedValue: "70-158 characters, unique",
      evidence: { metaDescriptionCount: 0, status: 200 },
      seoxPath: "/auditor/issues/meta-description-missing",
      ...overrides,
    },
    "acme-site"
  );
  return finding;
}

test("the summary is prefixed, scoped and never exceeds Jira's limit", () => {
  const summary = buildSummary(findingFor());
  assert.ok(summary.startsWith("[SEOX] "));
  assert.ok(summary.includes("/blog/seo-guide"));

  const long = buildSummary({
    ...findingFor(),
    title: "x".repeat(400),
  });
  assert.ok(long.length <= SUMMARY_MAX, `summary was ${long.length} chars`);
  assert.ok(long.startsWith("[SEOX] "));
});

test("a multi-URL finding says how many URLs it covers", () => {
  const summary = buildSummary({ ...findingFor(), affectedUrlCount: 37 });
  assert.ok(summary.includes("37 URLs"), summary);
});

test("the seox label always survives, whatever the caller asks for", () => {
  // The webhook JQL filter and the reconcile query both select on it, so it
  // is not the user's to remove.
  const labels = buildLabels({
    sourceModule: "auditor",
    severity: "error",
    extraLabels: ["custom"],
    mappingLabels: [],
  });
  assert.ok(labels.includes(REQUIRED_LABEL));
  assert.ok(labels.includes("seox-auditor"));
  assert.ok(labels.includes("seox-error"));
  assert.ok(labels.includes("custom"));
});

test("an automatic issue is labelled so a robot's ticket can be told apart", () => {
  const labels = buildLabels({ sourceModule: "auditor", severity: "error", creationMode: "auto" });
  assert.ok(labels.includes("seox-auto"));
  const manual = buildLabels({ sourceModule: "auditor", severity: "error", creationMode: "manual" });
  assert.equal(manual.includes("seox-auto"), false);
});

test("labels are slugified, because Jira rejects whitespace in a label", () => {
  assert.equal(sanitizeLabel("My Label"), "my-label");
  assert.equal(sanitizeLabel("  Spaced  Out  "), "spaced-out", "runs of whitespace collapse to one hyphen");
  assert.equal(sanitizeLabel("weird!!chars"), "weirdchars");
  assert.equal(sanitizeLabel(""), "");
});

test("the description is valid ADF and carries the fingerprint verbatim", () => {
  const finding = findingFor();
  const verification = deriveVerificationSpec({
    sourceModule: finding.sourceModule,
    findingType: finding.findingType,
    scopeKind: "url",
    url: finding.url,
  });

  const adf = buildDescriptionAdf(finding, {
    fingerprint: "a".repeat(64),
    verification,
    appUrl: "https://app.example.com",
    projectName: "Acme",
  });

  assert.equal(adf.type, "doc");
  assert.equal(adf.version, 1);
  assert.ok(Array.isArray(adf.content) && adf.content.length > 0);

  const text = adfToPlainText(adf);
  // The fingerprint is written into the body on purpose: it is what the
  // pre-flight duplicate search matches on, and it keeps the link
  // recoverable by a human if the SEOX row is ever lost.
  assert.ok(text.includes("a".repeat(64)));
  assert.ok(text.includes("https://example.com/blog/seo-guide"));
  assert.ok(text.includes("Acme"));
  assert.ok(text.toLowerCase().includes("acceptance criteria"));

  // The deep link back into SEOX is a link mark, so its href lives in the
  // document rather than in the flattened text.
  const serialised = JSON.stringify(adf);
  assert.ok(
    serialised.includes("https://app.example.com/auditor/issues/meta-description-missing"),
    "the issue should link back to the finding in SEOX"
  );
  assert.ok(text.includes("Open this finding in SEOX"));
});

test("the acceptance criteria are exactly what SEOX will re-check", () => {
  const finding = findingFor();
  const verification = deriveVerificationSpec({
    sourceModule: "auditor",
    findingType: "meta-description-missing",
    scopeKind: "url",
    url: finding.url,
  });
  const text = adfToPlainText(buildDescriptionAdf(finding, { fingerprint: "f", verification }));
  assert.ok(text.includes("meta description"), text.slice(0, 400));
  assert.ok(text.includes("SEOX automatically re-checks the URL"));
});

test("a finding SEOX cannot verify says so instead of promising a check", () => {
  const finding = findingFor({
    findingType: "orphan-page-has-no-incoming-internal-links",
  });
  const verification = deriveVerificationSpec({
    sourceModule: "auditor",
    findingType: finding.findingType,
    scopeKind: "url",
    url: finding.url,
  });
  assert.equal(verification.kind, "manual");

  const text = adfToPlainText(buildDescriptionAdf(finding, { fingerprint: "f", verification }));
  // The spec's own reason is shown, so the ticket is honest about what will
  // and will not be confirmed automatically.
  assert.ok(text.includes("no automatic check"), text.slice(-500));
  assert.equal(text.includes("SEOX automatically re-checks the URL"), false);
});

test("a long URL list is capped and the true total is stated", () => {
  const urls = Array.from({ length: 120 }, (_, index) => `https://example.com/page-${index}`);
  const finding = { ...findingFor(), urls, affectedUrlCount: 120, scopeKind: "batch" };

  const text = adfToPlainText(buildDescriptionAdf(finding, { fingerprint: "f" }));
  assert.ok(text.includes(`and ${120 - URL_RENDER_LIMIT} more`), "the overflow must be stated");
  assert.equal(text.includes("page-119"), false, "the list must actually be capped");
  assert.ok(text.includes("page-0"));
});

test("the create payload sets only the fields SEOX owns", () => {
  const finding = findingFor({ severity: "error", findingType: "404-page" });
  const payload = buildCreateIssuePayload({
    finding,
    mapping,
    fingerprint: "f".repeat(64),
    verification: deriveVerificationSpec({
      sourceModule: "auditor",
      findingType: "404-page",
      scopeKind: "url",
      url: finding.url,
    }),
  });

  assert.equal(payload.fields.project.id, "10001");
  assert.equal(payload.fields.issuetype.id, "10002");
  assert.equal(payload.fields.priority.id, "2", "error should map through severityPriorityMap");
  assert.ok(payload.fields.labels.includes("seox"));

  // Things that belong to the team, not to SEOX.
  for (const forbidden of ["sprint", "duedate", "parent", "customfield_10001", "resolution", "status"]) {
    assert.equal(forbidden in payload.fields, false, `${forbidden} must not be set`);
  }
  // No assignee is set when the mapping does not name one.
  assert.equal("assignee" in payload.fields, false);
});

test("priority is omitted entirely when the Jira project does not support it", () => {
  const payload = buildCreateIssuePayload({
    finding: findingFor(),
    mapping: { ...mapping, prioritySupported: false },
    fingerprint: "f",
  });
  assert.equal("priority" in payload.fields, false);
});

test("caller overrides win, but cannot strip the seox label", () => {
  const payload = buildCreateIssuePayload({
    finding: findingFor(),
    mapping,
    overrides: {
      summary: "Custom summary",
      issueTypeId: "99",
      priorityId: "1",
      assigneeAccountId: "acc-1",
      labels: ["extra"],
    },
    fingerprint: "f",
  });

  assert.equal(payload.fields.summary, "Custom summary");
  assert.equal(payload.fields.issuetype.id, "99");
  assert.equal(payload.fields.priority.id, "1");
  assert.equal(payload.fields.assignee.id, "acc-1");
  assert.ok(payload.fields.labels.includes("extra"));
  assert.ok(payload.fields.labels.includes("seox"));
});

test("AI fields are used when present and the draft is attributed", () => {
  const ai = {
    technicalDescription: "The article template omits the description meta tag.",
    rootCause: "The excerpt field is empty for this post.",
    recommendedFix: "Output the excerpt, falling back to the first 155 characters.",
    developerInstructions: ["Edit article.html", "Set the excerpt"],
    acceptanceCriteria: ["The tag is present", "It is 70-158 characters"],
    seoImpact: "Google composes the snippet itself, which usually converts worse.",
    testingInstructions: ["View source and search for name=\"description\""],
  };

  const text = adfToPlainText(
    buildDescriptionAdf(findingFor(), { fingerprint: "f", ai, actorEmail: "seo@acme.com" })
  );

  assert.ok(text.includes("The article template omits"));
  assert.ok(text.includes("Likely root cause"));
  assert.ok(text.includes("Edit article.html"));
  // Teams are entitled to know a machine drafted it.
  assert.ok(text.includes("drafted by SEOX AI"));
  assert.ok(text.includes("seo@acme.com"));
});

test("the verification comment states exactly which check failed", () => {
  const failed = buildVerificationComment(
    {
      checkedAt: "2026-09-21T10:00:00.000Z",
      checks: [
        { type: "tag_present", passed: false, expected: "a non-empty meta description", actual: "still missing or empty" },
        { type: "tag_length", passed: true, expected: "70-158 characters", actual: "120 characters" },
      ],
    },
    { url: "https://example.com/a", passed: false }
  );

  const text = adfToPlainText(failed);
  assert.ok(text.includes("still present"));
  assert.ok(text.includes("still missing or empty"));
  // A passing check is not noise the developer needs in a failure comment.
  assert.equal(text.includes("120 characters"), false);

  const passedComment = adfToPlainText(
    buildVerificationComment({ checkedAt: "2026-09-21T10:00:00.000Z", checks: [] }, {
      url: "https://example.com/a",
      passed: true,
    })
  );
  assert.ok(passedComment.includes("verified this fix"));
});

test("evidence values are rendered without dumping huge objects into Jira", () => {
  const finding = findingFor({
    evidence: {
      list: Array.from({ length: 40 }, (_, index) => `item-${index}`),
      nested: { a: 1, b: 2 },
      long: "x".repeat(2000),
    },
  });
  const text = adfToPlainText(buildDescriptionAdf(finding, { fingerprint: "f" }));
  assert.equal(text.includes("item-39"), false, "long arrays must be trimmed");
  assert.ok(text.length < 20000, `description was ${text.length} characters`);
});
