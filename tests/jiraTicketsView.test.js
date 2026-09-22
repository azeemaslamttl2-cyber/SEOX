// The Jira Tickets page's data rules, tested away from React.
//
// Two of them are worth guarding: what counts as "pending", and the fact
// that the page only ever shows findings that really have a Jira issue. Both
// are the kind of thing that breaks quietly - a page that shows nothing, or
// one that offers a Resolve button on a finding that was never filed.

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

/** A trimmed copy of what POST /api/jira/issues actually returns. */
const FEED = {
  success: true,
  total_projects: 2,
  projects: [
    {
      project_id: "proj_a",
      project_name: "Alpha",
      project_url: "https://alpha.example",
      domain: "alpha.example",
      jira_connected: true,
      jira_project_key: "SEO",
      issues: [
        {
          issue_id: "f1",
          issue_type: "title-tag-missing-or-empty",
          title: "Title tag missing",
          severity: "error",
          url: "https://alpha.example/a",
          status: "open",
          source_module: "auditor",
          jira_created: true,
          jira_issue_key: "SEO-1",
          jira_issue_url: "https://x.atlassian.net/browse/SEO-1",
          jira_status: "To Do",
          jira_status_category: "new",
          jira_priority: "High",
          jira_assignee: "Dev One",
          jira_synced_at: "2026-09-22T10:00:00.000Z",
        },
        {
          issue_id: "f2",
          issue_type: "meta-description-missing",
          title: "Meta description missing",
          severity: "warning",
          url: "https://alpha.example/b",
          status: "in_progress",
          source_module: "auditor",
          jira_created: true,
          jira_issue_key: "SEO-2",
          jira_status: "Doing",
          jira_status_category: "indeterminate",
          jira_priority: "Medium",
          jira_assignee: "Dev Two",
          jira_synced_at: "2026-09-22T09:00:00.000Z",
        },
        {
          issue_id: "f3",
          issue_type: "missing-alt-text",
          title: "Images without alt text",
          severity: "notice",
          url: "https://alpha.example/c",
          status: "resolved_pending",
          source_module: "auditor",
          jira_created: true,
          jira_issue_key: "SEO-3",
          jira_status: "Shipped to prod",
          jira_status_category: "done",
          jira_priority: "Low",
          jira_assignee: null,
          jira_synced_at: "2026-09-21T09:00:00.000Z",
        },
        {
          // Never filed. Belongs on the auditor pages, not here.
          issue_id: "f4",
          issue_type: "h1-tag-missing-or-empty",
          title: "H1 missing",
          severity: "error",
          url: "https://alpha.example/d",
          status: "open",
          source_module: "auditor",
          jira_created: false,
          jira_issue_key: null,
        },
      ],
    },
    {
      project_id: "proj_b",
      project_name: "Beta",
      domain: "beta.example",
      jira_connected: false,
      issues: [],
    },
  ],
};

// --- What is a ticket ------------------------------------------------------

test("only findings with a real Jira issue become tickets", () => {
  const tickets = flattenTickets(FEED);
  assert.deepEqual(
    tickets.map((t) => t.jira_issue_key),
    ["SEO-1", "SEO-2", "SEO-3"]
  );
  // The unfiled finding must not appear - a Resolve button on it would have
  // nothing to resolve.
  assert.equal(tickets.some((t) => t.issue_id === "f4"), false);
});

test("each ticket carries the SEOX project it belongs to", () => {
  const [first] = flattenTickets(FEED);
  assert.equal(first.project_id, "proj_a");
  assert.equal(first.project_name, "Alpha");
  assert.equal(first.project_url, "https://alpha.example");
  assert.equal(first.jira_project_key, "SEO");
});

test("a malformed or empty feed yields no tickets rather than throwing", () => {
  for (const value of [null, undefined, {}, { projects: null }, { projects: [{}] }]) {
    assert.deepEqual(flattenTickets(value), []);
  }
});

test("every project the feed covered is listed, including ones with no tickets", () => {
  const projects = projectsFromFeed(FEED);
  assert.deepEqual(projects.map((p) => p.project_id), ["proj_a", "proj_b"]);
  assert.equal(projects[1].jira_connected, false);
});

// --- What is pending -------------------------------------------------------

test("pending is decided on statusCategory, not on the status name", () => {
  // "Shipped to prod" is not a name any list of pending statuses would
  // contain, and "Doing" is not one any list of in-progress names would.
  // Only the category gets both right.
  assert.deepEqual(ACTIONABLE_CATEGORIES, ["new", "indeterminate"]);

  assert.equal(isPending({ jira_status: "Icebox", jira_status_category: "new" }), true);
  assert.equal(isPending({ jira_status: "Doing", jira_status_category: "indeterminate" }), true);
  assert.equal(isPending({ jira_status: "Shipped to prod", jira_status_category: "done" }), false);
});

test("an unknown category is treated as pending, never as done", () => {
  // Being wrong in the "still needs attention" direction shows a ticket that
  // is already finished. Being wrong the other way hides work.
  assert.equal(isPending({ jira_status_category: "" }), true);
  assert.equal(isPending({}), true);
  assert.equal(isPending({ jira_status_category: "something-new-from-atlassian" }), true);
});

test("the views partition the tickets as their labels claim", () => {
  const tickets = flattenTickets(FEED);
  const keysIn = (view) =>
    tickets.filter((t) => matchesView(t, view)).map((t) => t.jira_issue_key);

  assert.deepEqual(keysIn("pending"), ["SEO-1", "SEO-2"]);
  assert.deepEqual(keysIn("in_progress"), ["SEO-2"]);
  assert.deepEqual(keysIn("done"), ["SEO-3"]);
  assert.deepEqual(keysIn("all"), ["SEO-1", "SEO-2", "SEO-3"]);
});

test("a resolved ticket leaves Pending but stays under All", () => {
  // What the page does after a successful transition: it rewrites the row
  // rather than reloading, so the row must fall out of one view and remain
  // in the other purely on its new category.
  const before = { jira_issue_key: "SEO-1", jira_status_category: "new" };
  const after = { ...before, jira_status_category: "done", jira_status: "Done" };

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
    ["Doing", "Shipped to prod", "To Do"]
  );
  // An unassigned ticket contributes no assignee, so the dropdown cannot
  // offer a value that matches nothing.
  assert.equal(facets.assignees.includes(null), false);
});

test("search covers the fields a user would actually type", () => {
  const [ticket] = flattenTickets(FEED);
  for (const term of ["SEO-1", "seo-1", "title tag", "alpha.example/a", "Alpha", "Dev One"]) {
    assert.equal(matchesSearch(ticket, term), true, term);
  }
  assert.equal(matchesSearch(ticket, "nothing-like-this"), false);
  // An empty search matches everything rather than nothing.
  assert.equal(matchesSearch(ticket, "   "), true);
});

test("filters combine, and each one narrows on its own field", () => {
  const tickets = flattenTickets(FEED);
  const keys = (options) =>
    applyFilters(tickets, { view: "all", search: "", ...options }).map((t) => t.jira_issue_key);

  assert.deepEqual(keys({ priority: "High" }), ["SEO-1"]);
  assert.deepEqual(keys({ severity: "warning" }), ["SEO-2"]);
  assert.deepEqual(keys({ assignee: "Dev Two" }), ["SEO-2"]);
  assert.deepEqual(keys({ status: "Doing" }), ["SEO-2"]);
  assert.deepEqual(keys({ issueType: "missing-alt-text" }), ["SEO-3"]);
  assert.deepEqual(keys({ priority: "High", severity: "warning" }), []);
  assert.deepEqual(keys({}), ["SEO-1", "SEO-2", "SEO-3"]);
});

test("the pending view and a filter apply together", () => {
  const tickets = flattenTickets(FEED);
  const result = applyFilters(tickets, { view: "pending", search: "", severity: "error" });
  assert.deepEqual(result.map((t) => t.jira_issue_key), ["SEO-1"]);
});

// --- Ordering --------------------------------------------------------------

test("to-do comes before in-progress before done, then by severity", () => {
  const shuffled = [...flattenTickets(FEED)].reverse();
  assert.deepEqual(
    sortTickets(shuffled).map((t) => t.jira_issue_key),
    ["SEO-1", "SEO-2", "SEO-3"]
  );
});

test("sorting does not mutate the list it was given", () => {
  const tickets = flattenTickets(FEED);
  const original = tickets.map((t) => t.jira_issue_key);
  sortTickets([...tickets].reverse());
  assert.deepEqual(tickets.map((t) => t.jira_issue_key), original);
});
