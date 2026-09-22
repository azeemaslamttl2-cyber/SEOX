import test from "node:test";
import assert from "node:assert/strict";

import {
  SEOX_STATES,
  isNotFixedResolution,
  isStaleUpdate,
  mapJiraStateToSeox,
  normalizeSeverity,
  readIssueFields,
  resolvePriorityId,
} from "../functions/_lib/jira-status-map.js";

test("mapping is driven by statusCategory, never by the status name", () => {
  // A team that renames "In Progress" to "Doing", adds "Blocked", or runs a
  // localised Jira must still map correctly. The category is the only stable
  // signal Jira gives.
  assert.equal(mapJiraStateToSeox({ statusCategory: "new" }).seoxState, SEOX_STATES.OPEN);
  assert.equal(
    mapJiraStateToSeox({ statusCategory: "indeterminate" }).seoxState,
    SEOX_STATES.IN_PROGRESS
  );
  assert.equal(
    mapJiraStateToSeox({ statusCategory: "done" }).seoxState,
    SEOX_STATES.RESOLVED_PENDING
  );
});

test("an unrecognised category falls open, not done", () => {
  // Being wrong in the "open" direction is harmless. Being wrong in the
  // "done" direction would trigger a pointless re-crawl and possibly a
  // misleading Jira comment.
  assert.equal(mapJiraStateToSeox({ statusCategory: "" }).seoxState, SEOX_STATES.OPEN);
  assert.equal(mapJiraStateToSeox({ statusCategory: "weird" }).seoxState, SEOX_STATES.OPEN);
  assert.equal(mapJiraStateToSeox({}).seoxState, SEOX_STATES.OPEN);
});

test("a done issue schedules verification, but only when it was actually fixed", () => {
  const fixed = mapJiraStateToSeox({ statusCategory: "done", resolution: "Done" });
  assert.equal(fixed.seoxState, SEOX_STATES.RESOLVED_PENDING);
  assert.equal(fixed.shouldVerify, true);

  const unresolved = mapJiraStateToSeox({ statusCategory: "done", resolution: null });
  assert.equal(unresolved.shouldVerify, true);

  for (const resolution of [
    "Won't Do",
    "Won't Fix",
    "Wont fix",
    "Duplicate",
    "Cannot Reproduce",
    "Declined",
    "Invalid",
  ]) {
    const result = mapJiraStateToSeox({ statusCategory: "done", resolution });
    assert.equal(result.seoxState, SEOX_STATES.WONT_FIX, resolution);
    assert.equal(result.shouldVerify, false, resolution);
  }
});

test("a settled verification is not dragged back to awaiting verification", () => {
  // The issue stays Done in Jira, so every later sync sees the same state.
  // Without this the finding would loop through verification forever.
  for (const settled of [SEOX_STATES.VERIFIED, SEOX_STATES.REOPENED]) {
    const result = mapJiraStateToSeox({ statusCategory: "done", currentState: settled });
    assert.equal(result.seoxState, settled);
    assert.equal(result.shouldVerify, false);
  }
});

test("resolution classification tolerates the wording teams actually use", () => {
  assert.equal(isNotFixedResolution("Won't Do"), true);
  assert.equal(isNotFixedResolution("wont fix"), true);
  assert.equal(isNotFixedResolution("Obsolete"), true);
  assert.equal(isNotFixedResolution("Fixed"), false);
  assert.equal(isNotFixedResolution("Done"), false);
  assert.equal(isNotFixedResolution(""), false);
  assert.equal(isNotFixedResolution(null), false);
});

test("out-of-order and duplicate updates are discarded", () => {
  // A webhook and the reconcile poll can deliver the same change, and
  // webhooks can arrive out of order. Both must be harmless.
  const stored = "2026-09-21 10:00:00";
  assert.equal(isStaleUpdate(stored, "2026-09-21T09:00:00.000Z"), true, "older");
  assert.equal(isStaleUpdate(stored, "2026-09-21T10:00:00.000Z"), true, "equal");
  assert.equal(isStaleUpdate(stored, "2026-09-21T11:00:00.000Z"), false, "newer");
  assert.equal(isStaleUpdate(null, "2026-09-21T10:00:00.000Z"), false, "nothing stored yet");
  assert.equal(isStaleUpdate(stored, null), false, "no timestamp on the incoming event");
});

test("issue fields are read without capturing a Jira user's email address", () => {
  const fields = readIssueFields({
    id: "10234",
    key: "WEB-412",
    fields: {
      status: { name: "In Progress", statusCategory: { key: "indeterminate" } },
      resolution: null,
      priority: { name: "High" },
      assignee: {
        accountId: "5b10a2",
        displayName: "Dev Person",
        emailAddress: "dev@client.example",
      },
      created: "2026-09-20T09:00:00.000+0000",
      updated: "2026-09-21T09:30:00.000+0000",
      summary: "[SEOX] Meta description missing",
    },
  });

  assert.equal(fields.key, "WEB-412");
  assert.equal(fields.statusCategory, "indeterminate");
  assert.equal(fields.assigneeName, "Dev Person");
  assert.equal(fields.assigneeId, "5b10a2");
  // Third-party personal data SEOX has no need for.
  assert.equal(JSON.stringify(fields).includes("dev@client.example"), false);
  // Timestamps come back in the MySQL datetime shape the schema uses.
  assert.match(fields.remoteUpdatedAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test("severity scales from other SEOX modules fold onto the auditor's three", () => {
  assert.equal(normalizeSeverity("critical"), "error");
  assert.equal(normalizeSeverity("high"), "error");
  assert.equal(normalizeSeverity("medium"), "warning");
  assert.equal(normalizeSeverity("low"), "notice");
  assert.equal(normalizeSeverity("info"), "notice");
  assert.equal(normalizeSeverity("notice"), "notice");
  assert.equal(normalizeSeverity(undefined), "warning");
});

test("priority resolution falls back rather than sending nothing", () => {
  const map = { error: "2", warning: "3" };
  assert.equal(resolvePriorityId("error", map, "4"), "2");
  assert.equal(resolvePriorityId("notice", map, "4"), "4", "unmapped severity uses the default");
  assert.equal(resolvePriorityId("notice", {}, null), null, "nothing configured means omit it");
});
