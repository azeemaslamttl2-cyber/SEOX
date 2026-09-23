// The Jira Tickets page's data rules, tested away from React.
//
// Three of them are worth guarding:
//   1. a ticket raised BY HAND in Jira must appear (before the fix, only
//      tickets SEOX itself had filed could, so a busy Jira board looked
//      empty);
//   2. what counts as "pending";
//   3. a project that could not be queried must carry its state and must
//      NOT read as "zero tickets".

import test from "node:test";
import assert from "node:assert/strict";

import {
  ACTIONABLE_CATEGORIES,
  applyFilters,
  collectFacets,
  flattenTickets,
  isPending,
  matchesSearch,
  matchesView,
  projectsFromFeed,
  sortTickets,
} from "../src/lib/jiraTickets.js";
import { presentState, isTrustworthy } from "../src/lib/jiraTicketStates.js";

/**
 * A trimmed copy of what `POST /api/jira/tickets` returns for a selected
 * Jira project.
 *
 * WUCP-1157 and WUCP-1156 were raised by hand in Jira and carry `seox: null`.
 */
const FEED = {
  success: true,
  mode: "tickets",
  summary: { total_projects: 1, projects_queried: 1, projects_with_errors: 0, total_tickets: 3 },
  projects: [
    {
      project: { project_id: null, project_name: "Web - UCP", project_url: "", domain: "" },
      jira: {
        configured: true,
        connected: true,
        base_url: "https://x.atlassian.net",
        mapped: true,
        project_id: "10055",
        project_key: "WUCP",
        project_name: "Web - UCP",
      },
      state: { ok: true, code: "OK", message: "Retrieved 3 Jira tickets from WUCP." },
      ticket_count: 3,
      next_page_token: "tok",
      tickets: [
        {
          id: "10001",
          key: "WUCP-1",
          url: "https://x.atlassian.net/browse/WUCP-1",
          summary: "Title tag missing on /admissions",
          description: "The title element is absent.",
          status: { id: "1", name: "To Do", category: "new", categoryName: "To Do" },
          priority: { id: "2", name: "High" },
          assignee: { accountId: "a1", displayName: "Dev One" },
          reporter: { accountId: "a9", displayName: "Reporter One" },
          issueType: { id: "10004", name: "Bug" },
          project: { id: "10055", key: "WUCP", name: "Web - UCP" },
          labels: ["seox"],
          components: [],
          fixVersions: [],
          comments: [],
          commentCount: 0,
          attachments: [],
          created: "2026-09-20T10:00:00.000Z",
          updated: "2026-09-22T10:00:00.000Z",
          createdBySeox: true,
          seox: {
            link_id: 7,
            fingerprint: "abc",
            finding_title: "Title tag missing or empty",
            finding_type: "title-tag-missing-or-empty",
            source_module: "auditor",
            severity: "error",
            affected_url: "https://ucp.edu.pk/admissions",
            seox_state: "open",
            seox_state_label: "Open",
          },
        },
        {
          id: "10002",
          key: "WUCP-1157",
          url: "https://x.atlassian.net/browse/WUCP-1157",
          summary: "Request for Newsletter Update",
          status: { id: "10027", name: "Stagging", category: "indeterminate" },
          priority: { id: "3", name: "Medium" },
          assignee: { accountId: "a2", displayName: "Dev Two" },
          issueType: { id: "10001", name: "Task" },
          project: { id: "10055", key: "WUCP", name: "Web - UCP" },
          labels: [],
          updated: "2026-09-22T09:00:00.000Z",
          createdBySeox: false,
          seox: null,
        },
        {
          id: "10003",
          key: "WUCP-1156",
          url: "https://x.atlassian.net/browse/WUCP-1156",
          summary: "Banner Image Update on Landing Page",
          status: { id: "6", name: "Closed", category: "done" },
          priority: { id: "4", name: "Low" },
          assignee: null,
          issueType: { id: "10001", name: "Task" },
          project: { id: "10055", key: "WUCP", name: "Web - UCP" },
          labels: [],
          updated: "2026-09-21T09:00:00.000Z",
          createdBySeox: false,
          seox: null,
        },
      ],
    },
  ],
};

/** The same envelope when the project could not be queried at all. */
const NOT_MAPPED_FEED = {
  success: true,
  mode: "tickets",
  projects: [
    {
      project: { project_id: "proj_a", project_name: "https://ucp.edu.pk/", domain: "ucp.edu.pk" },
      jira: { configured: true, connected: true, mapped: false, project_key: null },
      state: {
        ok: false,
        code: "JIRA_PROJECT_MAPPING_MISSING",
        message: "Jira is connected, but no Jira project is mapped.",
      },
      ticket_count: 0,
      tickets: [],
      next_page_token: null,
    },
  ],
};

// --- What is a ticket ------------------------------------------------------

test("tickets raised by hand in Jira are shown, not only ones SEOX filed", () => {
  const tickets = flattenTickets(FEED);
  assert.deepEqual(
    tickets.map((t) => t.key),
    ["WUCP-1", "WUCP-1157", "WUCP-1156"]
  );
  assert.deepEqual(
    tickets.map((t) => t.createdBySeox),
    [true, false, false]
  );
  // Every row carries a directly openable Jira link, whoever filed it.
  assert.deepEqual(
    tickets.map((t) => t.url),
    [
      "https://x.atlassian.net/browse/WUCP-1",
      "https://x.atlassian.net/browse/WUCP-1157",
      "https://x.atlassian.net/browse/WUCP-1156",
    ]
  );
});

test("a SEOX finding is flattened onto the row when there is one", () => {
  const [first, second] = flattenTickets(FEED);
  assert.equal(first.severity, "error");
  assert.equal(first.affectedUrl, "https://ucp.edu.pk/admissions");
  assert.equal(first.seoxStateLabel, "Open");
  // A hand-raised ticket has no SEO severity and must not be given one.
  assert.equal(second.severity, "");
  assert.equal(second.seox, null);
});

test("each ticket carries the Jira project it came from", () => {
  const [first] = flattenTickets(FEED);
  assert.equal(first.jiraProjectKey, "WUCP");
  assert.equal(first.projectName, "Web - UCP");
});

test("a malformed or empty feed yields no tickets rather than throwing", () => {
  for (const value of [null, undefined, {}, { projects: null }, { projects: [{}] }]) {
    assert.deepEqual(flattenTickets(value), []);
  }
});

test("a project that could not be queried carries its state, not an empty list", () => {
  // The reported bug, in one assertion: this must NOT read as "zero tickets".
  const [entry] = projectsFromFeed(NOT_MAPPED_FEED);
  assert.equal(entry.state.ok, false);
  assert.equal(entry.state.code, "JIRA_PROJECT_MAPPING_MISSING");
  assert.equal(isTrustworthy(entry.state), false);
  assert.deepEqual(flattenTickets(NOT_MAPPED_FEED), []);
});

test("projectsFromFeed exposes the paging cursor and the Jira identity", () => {
  const [entry] = projectsFromFeed(FEED);
  assert.equal(entry.jira.project_key, "WUCP");
  assert.equal(entry.next_page_token, "tok");
  assert.equal(entry.ticket_count, 3);
});

// --- How a state is explained ----------------------------------------------

test("only a successful query is presented as an empty result", () => {
  const ok = presentState({ ok: true, code: "OK", jira: { project_key: "WUCP" } });
  assert.equal(ok.tone, "empty");
  assert.match(ok.title, /No Jira tickets found/i);
});

test("every configuration failure is an error with its own advice", () => {
  const cases = {
    JIRA_NOT_CONFIGURED: /not connected/i,
    JIRA_PROJECT_MAPPING_MISSING: /no jira project is mapped/i,
    JIRA_PROJECT_KEY_MISSING: /project key/i,
    JIRA_AUTHENTICATION_FAILED: /authentication failed/i,
    JIRA_PROJECT_NOT_FOUND: /could not be found/i,
    JIRA_PERMISSION_DENIED: /permission denied/i,
    JIRA_API_UNAVAILABLE: /unable to connect/i,
    JIRA_API_ERROR: /unexpected response/i,
    PROJECT_NOT_FOUND: /project not found/i,
    NETWORK_ERROR: /could not reach seox/i,
  };

  for (const [code, titlePattern] of Object.entries(cases)) {
    const presented = presentState({ ok: false, code, message: "x" });
    assert.equal(presented.tone, "error", `${code} must not be presented as an empty result`);
    assert.match(presented.title, titlePattern, code);
    // None of them may say "no tickets" - that is the confusion being fixed.
    assert.equal(/no jira tickets found/i.test(presented.title), false, code);
  }
});

test("the states that a user can fix link to the screen that fixes them", () => {
  for (const code of [
    "JIRA_NOT_CONFIGURED",
    "JIRA_PROJECT_MAPPING_MISSING",
    "JIRA_PROJECT_KEY_MISSING",
    "JIRA_AUTHENTICATION_FAILED",
    "JIRA_PROJECT_NOT_FOUND",
  ]) {
    const presented = presentState({ ok: false, code });
    assert.ok(presented.action, `${code} should offer an action`);
    assert.ok(presented.action.href.includes("tab=jira"), code);
  }
});

test("transient failures offer a retry and permanent ones do not", () => {
  assert.equal(presentState({ ok: false, code: "JIRA_API_UNAVAILABLE" }).retryable, true);
  assert.equal(presentState({ ok: false, code: "NETWORK_ERROR" }).retryable, true);
  assert.equal(presentState({ ok: false, code: "JIRA_PROJECT_MAPPING_MISSING" }).retryable, false);
});

test("an unrecognised code still produces an error, never an empty result", () => {
  const presented = presentState({ ok: false, code: "SOMETHING_NEW", message: "boom" });
  assert.equal(presented.tone, "error");
  assert.equal(presented.detail, "boom");
});

test("a rate-limited response tells the user how long to wait", () => {
  const presented = presentState({
    ok: false,
    code: "JIRA_API_UNAVAILABLE",
    message: "Jira is rate limiting SEOX.",
    retry_after_seconds: 120,
  });
  assert.match(presented.detail, /2 minute/);
});

// --- What is pending -------------------------------------------------------

test("pending is decided on statusCategory, not on the status name", () => {
  // "Stagging" and "Closed" are this board's real names. No list of expected
  // status names would classify them correctly; the category does.
  assert.deepEqual(ACTIONABLE_CATEGORIES, ["new", "indeterminate"]);
  assert.equal(isPending({ status: { name: "Icebox", category: "new" } }), true);
  assert.equal(isPending({ status: { name: "Stagging", category: "indeterminate" } }), true);
  assert.equal(isPending({ status: { name: "Closed", category: "done" } }), false);
});

test("an unknown category is treated as pending, never as done", () => {
  assert.equal(isPending({ status: { category: "" } }), true);
  assert.equal(isPending({}), true);
  assert.equal(isPending({ status: { category: "something-new-from-atlassian" } }), true);
});

test("the views partition the tickets as their labels claim", () => {
  const tickets = flattenTickets(FEED);
  const keysIn = (view) => tickets.filter((t) => matchesView(t, view)).map((t) => t.key);

  assert.deepEqual(keysIn("pending"), ["WUCP-1", "WUCP-1157"]);
  assert.deepEqual(keysIn("in_progress"), ["WUCP-1157"]);
  assert.deepEqual(keysIn("done"), ["WUCP-1156"]);
  assert.deepEqual(keysIn("all"), ["WUCP-1", "WUCP-1157", "WUCP-1156"]);
});

test("a resolved ticket leaves Pending but stays under All", () => {
  const before = { key: "WUCP-1", status: { category: "new" } };
  const after = { ...before, status: { category: "done", name: "Closed" } };

  assert.equal(matchesView(before, "pending"), true);
  assert.equal(matchesView(after, "pending"), false);
  assert.equal(matchesView(after, "all"), true);
  assert.equal(matchesView(after, "done"), true);
});

// --- Filtering and search --------------------------------------------------

test("filter options are built from the rows on screen", () => {
  const facets = collectFacets(flattenTickets(FEED));
  assert.deepEqual(facets.priorities, ["High", "Low", "Medium"]);
  assert.deepEqual(facets.assignees, ["Dev One", "Dev Two"]);
  assert.deepEqual(
    facets.statuses.map((s) => s.name),
    ["Closed", "Stagging", "To Do"]
  );
  assert.deepEqual(facets.issueTypes, ["Bug", "Task"]);
  assert.equal(facets.assignees.includes(null), false);
});

test("search covers the fields a user would actually type", () => {
  const [ticket] = flattenTickets(FEED);
  for (const term of [
    "WUCP-1",
    "wucp-1",
    "title tag",
    "ucp.edu.pk/admissions",
    "Web - UCP",
    "Dev One",
    "To Do",
    // The SEO finding's own wording, which the Jira summary may not repeat.
    "Title tag missing or empty",
  ]) {
    assert.equal(matchesSearch(ticket, term), true, term);
  }
  assert.equal(matchesSearch(ticket, "nothing-like-this"), false);
  assert.equal(matchesSearch(ticket, "   "), true);
});

test("filters combine, and each one narrows on its own field", () => {
  const tickets = flattenTickets(FEED);
  const keys = (options) =>
    applyFilters(tickets, { view: "all", search: "", ...options }).map((t) => t.key);

  assert.deepEqual(keys({ priority: "High" }), ["WUCP-1"]);
  assert.deepEqual(keys({ severity: "error" }), ["WUCP-1"]);
  assert.deepEqual(keys({ assignee: "Dev Two" }), ["WUCP-1157"]);
  assert.deepEqual(keys({ status: "Stagging" }), ["WUCP-1157"]);
  assert.deepEqual(keys({ issueType: "Task" }), ["WUCP-1157", "WUCP-1156"]);
  assert.deepEqual(keys({ priority: "High", severity: "warning" }), []);
  assert.deepEqual(keys({}), ["WUCP-1", "WUCP-1157", "WUCP-1156"]);
});

test("the pending view and a filter apply together", () => {
  const tickets = flattenTickets(FEED);
  const result = applyFilters(tickets, { view: "pending", search: "", severity: "error" });
  assert.deepEqual(
    result.map((t) => t.key),
    ["WUCP-1"]
  );
});

// --- Ordering --------------------------------------------------------------

test("to-do comes before in-progress before done, then by severity", () => {
  const shuffled = [...flattenTickets(FEED)].reverse();
  assert.deepEqual(
    sortTickets(shuffled).map((t) => t.key),
    ["WUCP-1", "WUCP-1157", "WUCP-1156"]
  );
});

test("sorting does not mutate the list it was given", () => {
  const tickets = flattenTickets(FEED);
  const original = tickets.map((t) => t.jira_issue_key);
  sortTickets([...tickets].reverse());
  assert.deepEqual(
    tickets.map((t) => t.jira_issue_key),
    original
  );
});
