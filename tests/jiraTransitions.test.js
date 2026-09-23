import test from "node:test";
import assert from "node:assert/strict";

import {
  describeTransition,
  projectKeyOfIssueKey,
  selectTransition,
} from "../functions/_lib/jira-transitions.js";

/**
 * The rule under test throughout this file: a Jira transition is resolved
 * against the transitions Jira reports for THAT issue, right now. Nothing is
 * hardcoded - not an id, not a status name, not the assumption that "Done"
 * exists.
 *
 * The three workflows below are real shapes, not conveniences:
 *   CLASSIC   the default Jira Software board
 *   RENAMED   a team that renamed every column and has no "Resolved" at all
 *   DECLINING a done category whose only entries decline the work
 */

const CLASSIC = [
  { id: "11", name: "To Do", to: { name: "To Do", statusCategory: { key: "new", name: "To Do" } } },
  {
    id: "21",
    name: "In Progress",
    to: { name: "In Progress", statusCategory: { key: "indeterminate", name: "In Progress" } },
  },
  { id: "31", name: "Done", to: { name: "Done", statusCategory: { key: "done", name: "Done" } } },
];

const RENAMED = [
  { id: "5", name: "Icebox", to: { name: "Icebox", statusCategory: { key: "new", name: "To Do" } } },
  {
    id: "7",
    name: "Shipped",
    to: { name: "Shipped to prod", statusCategory: { key: "done", name: "Done" } },
  },
];

const DECLINING = [
  {
    id: "41",
    name: "Won't Do",
    to: { name: "Won't Do", statusCategory: { key: "done", name: "Done" } },
  },
  {
    id: "42",
    name: "Duplicate",
    to: { name: "Duplicate", statusCategory: { key: "done", name: "Done" } },
  },
];

// --- Explicit transition ids ----------------------------------------------

test("an explicit transition id is honoured when the workflow offers it", () => {
  const { transition } = selectTransition(CLASSIC, { transitionId: "21" });
  assert.equal(transition.id, "21");
  assert.equal(transition.to.name, "In Progress");
});

test("a transition id from another workflow is refused, not sent to Jira", () => {
  // The whole point: id 31 means "Done" on the classic board and nothing at
  // all on the renamed one. Passing it through would either error at Jira or,
  // worse, hit an unrelated transition that happens to share the number.
  const result = selectTransition(RENAMED, { transitionId: "31" });
  assert.equal(result.transition, undefined);
  assert.equal(result.code, "TRANSITION_UNAVAILABLE");
  assert.match(result.error, /not available/i);
});

test("an id that is valid on this board but not from this status is refused", () => {
  // Jira only returns transitions legal from the issue's CURRENT status, so
  // an id missing from the list is exactly this case.
  const result = selectTransition([CLASSIC[0]], { transitionId: "31" });
  assert.equal(result.code, "TRANSITION_UNAVAILABLE");
});

// --- Resolving without an id ----------------------------------------------

test("resolve picks the done-category transition on a standard board", () => {
  const { transition } = selectTransition(CLASSIC, { intent: "resolve" });
  assert.equal(transition.id, "31");
});

test("resolve works on a board with no status called Done or Resolved", () => {
  // "Shipped to prod" is in the done CATEGORY, which is the part of a Jira
  // workflow that is stable across projects. Matching on the name would find
  // nothing here.
  const { transition } = selectTransition(RENAMED, { intent: "resolve" });
  assert.equal(transition.id, "7");
  assert.equal(transition.to.name, "Shipped to prod");
});

test("resolve refuses when the only done transitions decline the work", () => {
  // "Won't Do" and "Duplicate" both land in the done category. Treating
  // either as a resolution would record a fix that never happened.
  const result = selectTransition(DECLINING, { intent: "resolve" });
  assert.equal(result.transition, undefined);
  assert.equal(result.code, "ONLY_DECLINING_TRANSITIONS");
});

test("a declining transition can still be chosen explicitly by id", () => {
  const { transition } = selectTransition(DECLINING, { transitionId: "41" });
  assert.equal(transition.name, "Won't Do");
});

test("resolve reports clearly when there is no done transition at all", () => {
  const result = selectTransition([CLASSIC[0], CLASSIC[1]], { intent: "resolve" });
  assert.equal(result.code, "TRANSITION_UNAVAILABLE");
  assert.match(result.error, /No valid Jira transition is available to resolve this issue/);
});

test("an empty transition list is an error, never a silent no-op", () => {
  const result = selectTransition([], { intent: "resolve" });
  assert.equal(result.code, "NO_TRANSITIONS");
});

// --- Named statuses --------------------------------------------------------

test("a status name matches the destination status, case and spacing aside", () => {
  for (const name of ["In Progress", "in progress", "  IN-PROGRESS  ", "inprogress"]) {
    const { transition } = selectTransition(CLASSIC, { status: name });
    assert.equal(transition.id, "21", `"${name}" should reach In Progress`);
  }
});

test("a status name also matches the transition's own label", () => {
  const board = [
    {
      id: "9",
      name: "Start progress",
      to: { name: "Doing", statusCategory: { key: "indeterminate" } },
    },
  ];
  const { transition } = selectTransition(board, { status: "Start progress" });
  assert.equal(transition.id, "9");
});

test("a recognised word with no matching status falls back to its category", () => {
  // "Resolved" exists on neither board, but it unambiguously means done.
  const { transition } = selectTransition(RENAMED, { status: "Resolved" });
  assert.equal(transition.id, "7");
});

test("an unrecognised status name is an error rather than a guess", () => {
  const result = selectTransition(CLASSIC, { status: "Needs Legal Review" });
  assert.equal(result.transition, undefined);
  assert.equal(result.code, "TRANSITION_UNAVAILABLE");
});

test("reopen prefers a to-do destination and accepts in-progress", () => {
  assert.equal(selectTransition(CLASSIC, { intent: "reopen" }).transition.id, "11");

  const noTodo = [CLASSIC[1], CLASSIC[2]];
  assert.equal(selectTransition(noTodo, { intent: "reopen" }).transition.id, "21");
});

test("resolve is the default when no target is named at all", () => {
  assert.equal(selectTransition(CLASSIC, {}).transition.id, "31");
});

// --- Shaping ---------------------------------------------------------------

test("describeTransition exposes what the UI needs and nothing else", () => {
  const described = describeTransition({
    id: 31,
    name: "Done",
    hasScreen: true,
    isAvailable: true,
    to: { name: "Done", statusCategory: { key: "done", name: "Done" } },
    fields: { customfield_10001: { required: true, schema: { type: "string" } } },
  });

  assert.deepEqual(described, {
    id: "31",
    name: "Done",
    to_status: "Done",
    to_status_category: "done",
    to_status_category_name: "Done",
    has_screen: true,
    is_available: true,
  });
  // Jira's `fields` block describes a screen's custom fields and is not
  // something the browser needs.
  assert.equal("fields" in described, false);
});

// --- Issue key parsing -----------------------------------------------------

test("the Jira project key is read from the issue key", () => {
  assert.equal(projectKeyOfIssueKey("SEO-123"), "SEO");
  assert.equal(projectKeyOfIssueKey("seo-123"), "SEO");
  assert.equal(projectKeyOfIssueKey("AB_C-9"), "AB_C");
});

test("anything that is not an issue key yields no project key", () => {
  // An empty result must never be compared as equal to a mapped project key,
  // which is why the endpoint guards on both sides being non-empty.
  for (const value of ["", "SEO", "123-456", "../../etc", "SEO-", null, undefined]) {
    assert.equal(projectKeyOfIssueKey(value), "", String(value));
  }
});
