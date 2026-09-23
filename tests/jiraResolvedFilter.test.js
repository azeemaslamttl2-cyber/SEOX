// Excluding finished tickets from the Jira ticket feed.
//
// THE RULE: `/api/jira/tickets` answers "what still needs attention in the
// mapped Jira project?". Everything in Jira's `Done` status
// category is left out unless the caller explicitly asks for it, and it is
// left out BY JIRA - the exclusion is a JQL clause, not a pass over the
// response. That distinction is the whole point: a board with ten years of
// closed issues would otherwise spend every page of the cursor on history
// before reaching this week's work.
//
// The two failure modes these tests exist to prevent:
//   1. a resolved ticket reaching the caller that did not ask for one;
//   2. `status_category: "done"` - the one request that IS for resolved
//      tickets - having its own results thrown away by the safety net.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  STATUS_CATEGORIES,
  dropResolvedTickets,
  readBoolean,
  resolveStatusFilter,
} from "../functions/_lib/jira-ticket-feed.js";
import { EXCLUDE_DONE_JQL, projectJql } from "../functions/_lib/jira-search.js";
import { requestForView } from "../src/lib/jiraTickets.js";

// --- the default -----------------------------------------------------------

test("with nothing asked for, resolved tickets are excluded", () => {
  const filter = resolveStatusFilter();

  assert.equal(filter.includeResolved, false);
  assert.equal(filter.statusCategory, null);
  assert.equal(filter.jql, EXCLUDE_DONE_JQL);
});

test("the exclusion is written against the status CATEGORY, not status names", () => {
  // Status names are per-project and renameable - "Closed", "Completed",
  // "Shipped", a localised equivalent. The category is Jira's own and is not
  // renameable, so it is the only thing that can be asked about correctly.
  assert.match(EXCLUDE_DONE_JQL, /statusCategory/);
  assert.equal(/\b(Resolved|Closed|Completed)\b/.test(EXCLUDE_DONE_JQL), false);
});

test("the default filter still scopes the query to the mapped project", () => {
  // A status clause that lost the project scope would return the whole
  // Jira site's open issues - every board the credential can read.
  const jql = projectJql("WUCP", { extra: resolveStatusFilter().jql });

  assert.equal(
    jql,
    'project = "WUCP" AND (statusCategory != "done") ORDER BY updated DESC'
  );
});

// --- asking for something else ---------------------------------------------

test("an explicit category narrows to exactly that category", () => {
  for (const category of ["new", "indeterminate"]) {
    const filter = resolveStatusFilter({ statusCategory: category });
    assert.equal(filter.statusCategory, category);
    assert.equal(filter.jql, `statusCategory = "${category}"`);
    assert.equal(filter.includeResolved, false);
  }
});

test('status_category "done" is how a caller asks FOR the resolved tickets', () => {
  const filter = resolveStatusFilter({ statusCategory: "done" });

  assert.equal(filter.jql, 'statusCategory = "done"');
  // Without this the safety net below would discard every row the request
  // was for, and the Resolved view would always be empty.
  assert.equal(filter.includeResolved, true);
});

test('"all" and include_resolved both drop the status clause entirely', () => {
  for (const filter of [
    resolveStatusFilter({ statusCategory: "all" }),
    resolveStatusFilter({ includeResolved: true }),
  ]) {
    assert.equal(filter.jql, "");
    assert.equal(filter.statusCategory, null);
    assert.equal(filter.includeResolved, true);
  }
});

test("an unrecognised category falls back to the default rather than to no filter", () => {
  // Being wrong towards "show fewer finished tickets" is recoverable. Being
  // wrong towards "no filter" silently reverts the whole behaviour.
  for (const bad of ["", "  ", "DONE!", "resolved", null, undefined]) {
    assert.equal(resolveStatusFilter({ statusCategory: bad }).jql, EXCLUDE_DONE_JQL);
  }
});

test("category matching is case- and whitespace-insensitive", () => {
  assert.equal(resolveStatusFilter({ statusCategory: " DONE " }).statusCategory, "done");
  assert.equal(
    resolveStatusFilter({ statusCategory: "Indeterminate" }).statusCategory,
    "indeterminate"
  );
});

test("STATUS_CATEGORIES is Jira's own three and does not include 'all'", () => {
  assert.deepEqual([...STATUS_CATEGORIES], ["new", "indeterminate", "done"]);
});

// --- the local safety net --------------------------------------------------

const TICKETS = [
  { key: "WUCP-1", status: { name: "To Do", category: "new" } },
  { key: "WUCP-2", status: { name: "In Progress", category: "indeterminate" } },
  { key: "WUCP-3", status: { name: "Closed", category: "done" } },
  // Jira reports the category KEY in lowercase; a shaper that ever let the
  // display name ("Done") through must still be excluded, not shown.
  { key: "WUCP-4", status: { name: "Completed", category: "Done" } },
];

test("a done ticket never survives a request that did not ask for one", () => {
  const kept = dropResolvedTickets(TICKETS, false);

  assert.deepEqual(
    kept.map((ticket) => ticket.key),
    ["WUCP-1", "WUCP-2"]
  );
});

test("the safety net is a no-op once the caller asked for resolved tickets", () => {
  assert.deepEqual(dropResolvedTickets(TICKETS, true), TICKETS);
});

test("a ticket with an unknown or missing category is KEPT", () => {
  // The asymmetry is deliberate and matches isPending() on the client:
  // showing a ticket that turns out to be finished costs a glance, hiding one
  // that still needs work means nobody looks at it again.
  const odd = [
    { key: "A-1", status: { category: "" } },
    { key: "A-2" },
    { key: "A-3", status: { category: "something-new-from-atlassian" } },
  ];

  assert.deepEqual(dropResolvedTickets(odd, false), odd);
});

// --- the flag over a query string ------------------------------------------

test('include_resolved="false" over a query string does NOT mean true', () => {
  // GET delivers every value as a string, and Boolean("false") is true. This
  // is the trap the helper exists for.
  assert.equal(readBoolean("false"), false);
  assert.equal(readBoolean("0"), false);
  assert.equal(readBoolean("no"), false);
  assert.equal(readBoolean(""), false);
  assert.equal(readBoolean(undefined), false);
});

test("the flag is accepted in the forms both transports actually send", () => {
  assert.equal(readBoolean(true), true);
  assert.equal(readBoolean("true"), true);
  assert.equal(readBoolean("TRUE"), true);
  assert.equal(readBoolean("1"), true);
  assert.equal(readBoolean(1), true);
});

// --- the client's views map onto the server's filter ------------------------

test("each Tickets view asks the server for exactly what it displays", () => {
  assert.deepEqual(requestForView("pending"), { statusCategory: "", includeResolved: false });
  assert.deepEqual(requestForView("in_progress"), {
    statusCategory: "indeterminate",
    includeResolved: false,
  });
  assert.deepEqual(requestForView("done"), { statusCategory: "done", includeResolved: true });
  assert.deepEqual(requestForView("all"), { statusCategory: "", includeResolved: true });
});

test("the Resolved and All views are the only ones that ask for finished tickets", () => {
  // If Pending ever started sending include_resolved, the server-side
  // exclusion would be silently switched off for the page's main view.
  for (const view of ["pending", "in_progress"]) {
    assert.equal(requestForView(view).includeResolved, false);
  }
});

// --- source-level guarantees ------------------------------------------------

test("neither ticket query builds its own status clause", () => {
  // Two call sites used to interpolate `statusCategory = "..."` inline, which
  // is how one of them ends up with a different default from the other.
  // resolveStatusFilter() is now the only place that decision is made.
  const source = readFileSync("functions/_lib/jira-ticket-feed.js", "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const inline = [...code.matchAll(/statusCategory\s*=\s*\\?"/g)];
  assert.equal(
    inline.length,
    1,
    "only resolveStatusFilter() may build a statusCategory clause"
  );

  for (const call of ["projectJql(mapping.jira_project_key, { extra: statusFilter.jql })",
                      "projectJql(match.key, { extra: statusFilter.jql })"]) {
    assert.ok(code.includes(call), `expected the feed to query via ${call}`);
  }
});

test("both ticket paths run the response through the safety net", () => {
  const code = readFileSync("functions/_lib/jira-ticket-feed.js", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  assert.equal(
    [...code.matchAll(/dropResolvedTickets\(/g)].length,
    3, // the definition, plus one call in each of the two ticket paths
    "each ticket path must filter its own results"
  );
});

test("the browser is not the thing deciding which tickets are returned", () => {
  // The client may re-check a row it updated in place, but it must never be
  // the only filter - that would mean downloading the resolved tickets first.
  const client = readFileSync("src/lib/jiraTicketsApi.js", "utf8");
  assert.ok(client.includes("body.include_resolved = true"));
  assert.ok(client.includes("body.status_category = statusCategory"));
});
