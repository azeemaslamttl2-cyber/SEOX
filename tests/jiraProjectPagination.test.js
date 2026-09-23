// Listing EVERY Jira project a connection can see.
//
// THE BUG THESE GUARD: the project list was one request to
// /rest/api/3/project/search, returning `data.values` and nothing else. The
// settings dropdown asked for 50 and the Jira Tickets page for 100, so any
// account with more boards than that had the rest silently cut off. Because
// the endpoint orders by name, which boards survived depended on the
// alphabet - and a project mapped to a board past the cut-off then matched no
// <option>, so a correctly mapped project rendered as unmapped.
//
// Nothing about that is intermittent, but it reads as intermittent from the
// outside, which is why it went unfixed: the list was complete for small
// sites, complete for the boards near A, and wrong only for the ones nobody
// checked first.
//
// The walk is driven here through its injected `request`, so these are real
// assertions about paging arithmetic and termination rather than about HTTP.

import test from "node:test";
import assert from "node:assert/strict";

import { listJiraProjects, listJiraProjectsPage } from "../functions/_lib/jira-projects.js";

const connection = { id: 1, base_url: "https://x.atlassian.net", account_email: "a@b.c" };

/** A Jira project as /rest/api/3/project/search returns it. */
function project(n) {
  return { id: 10000 + n, key: `P${n}`, name: `Project ${n}`, projectTypeKey: "software" };
}

/**
 * A fake Jira that serves `total` projects, `pageSize` at a time.
 *
 * `pageSize` is what JIRA applies, which is deliberately allowed to differ
 * from what the caller asked for - that clamp is the thing an offset walk
 * gets wrong when it advances by the requested size.
 */
function fakeJira(total, { pageSize = 50, sendIsLast = true, sendTotal = true, sendNextPage = true } = {}) {
  const calls = [];
  return {
    calls,
    async request(env, conn, options) {
      calls.push(options);
      const startAt = Number(options.query.startAt) || 0;
      const values = [];
      for (let i = startAt; i < Math.min(startAt + pageSize, total); i += 1) values.push(project(i));
      const last = startAt + values.length >= total;
      return {
        data: {
          startAt,
          maxResults: pageSize,
          values,
          ...(sendTotal ? { total } : {}),
          ...(sendIsLast ? { isLast: last } : {}),
          ...(sendNextPage && !last ? { nextPage: "https://x.atlassian.net/next" } : {}),
        },
      };
    },
  };
}

/* -------------------------------------------------------------------------
 * The single page, and what it reports.
 * ---------------------------------------------------------------------- */

test("a page request carries startAt, an ordered query and the search term", async () => {
  const jira = fakeJira(10);
  await listJiraProjectsPage({}, connection, {
    startAt: 50,
    query: "zero",
    request: jira.request,
  });

  const [options] = jira.calls;
  assert.equal(options.path, "/rest/api/3/project/search");
  assert.equal(options.query.startAt, 50);
  assert.equal(options.query.query, "zero");
  // Without a stable order an offset walk can see a row twice and miss
  // another entirely.
  assert.equal(options.query.orderBy, "name");
});

test("a missing isLast is reported as null, never as false", async () => {
  // `false` would mean "Jira says there is more". Absent means "Jira did not
  // say", and the walk has to fall back to counting rather than assume.
  const jira = fakeJira(10, { sendIsLast: false });
  const page = await listJiraProjectsPage({}, connection, { request: jira.request });
  assert.equal(page.isLast, null);
});

/* -------------------------------------------------------------------------
 * 1 + 2. One page, and many.
 * ---------------------------------------------------------------------- */

test("a site that fits in one page costs exactly one request", async () => {
  const jira = fakeJira(12);
  const result = await listJiraProjects({}, connection, { request: jira.request });

  assert.equal(jira.calls.length, 1);
  assert.equal(result.projects.length, 12);
  assert.equal(result.truncated, false);
});

test("every page is walked, and every project comes back", async () => {
  const jira = fakeJira(137);
  const result = await listJiraProjects({}, connection, { request: jira.request });

  assert.equal(result.projects.length, 137, "all 137, not the first 50");
  assert.equal(result.total, 137);
  assert.equal(result.truncated, false);
  assert.equal(jira.calls.length, 3, "50 + 50 + 37");
  assert.deepEqual(
    jira.calls.map((call) => call.query.startAt),
    [0, 50, 100]
  );

  // The specific regression: the boards that used to be cut off.
  const keys = result.projects.map((entry) => entry.key);
  assert.ok(keys.includes("P0"));
  assert.ok(keys.includes("P50"), "the first board past the old 50 cap");
  assert.ok(keys.includes("P100"), "the first board past the old 100 cap");
  assert.ok(keys.includes("P136"));
});

/* -------------------------------------------------------------------------
 * 3. Jira clamping the page size must not make the walk skip rows.
 * ---------------------------------------------------------------------- */

test("a clamped page size skips nothing", async () => {
  // Asked for 50, Jira serves 20. Advancing startAt by the REQUESTED size
  // would step over 30 projects per page and lose most of the site.
  const jira = fakeJira(100, { pageSize: 20 });
  const result = await listJiraProjects({}, connection, { request: jira.request });

  assert.equal(result.projects.length, 100);
  assert.deepEqual(
    jira.calls.map((call) => call.query.startAt),
    [0, 20, 40, 60, 80]
  );
});

/* -------------------------------------------------------------------------
 * 4 + 5. Termination when Jira is less forthcoming.
 * ---------------------------------------------------------------------- */

test("with no isLast, the reported total ends the walk", async () => {
  const jira = fakeJira(75, { sendIsLast: false });
  const result = await listJiraProjects({}, connection, { request: jira.request });

  assert.equal(result.projects.length, 75);
  assert.equal(result.truncated, false);
  assert.equal(jira.calls.length, 2);
});

test("with no isLast, no total and no nextPage, the walk stops rather than guesses", async () => {
  const jira = fakeJira(50, { sendIsLast: false, sendTotal: false, sendNextPage: false });
  const result = await listJiraProjects({}, connection, { request: jira.request });

  assert.equal(jira.calls.length, 1);
  assert.equal(result.projects.length, 50);
  assert.equal(result.truncated, false);
});

test("an empty page ends the walk", async () => {
  const jira = fakeJira(0);
  const result = await listJiraProjects({}, connection, { request: jira.request });

  assert.equal(result.projects.length, 0);
  assert.equal(result.truncated, false);
  assert.equal(jira.calls.length, 1);
});

/* -------------------------------------------------------------------------
 * 6. Duplicates.
 * ---------------------------------------------------------------------- */

test("a project returned on two pages is kept once", async () => {
  // An offset walk over a list that is being written to can serve the same
  // row twice. The dropdown must not then show it twice.
  let call = 0;
  const request = async () => {
    call += 1;
    if (call === 1) {
      return { data: { startAt: 0, maxResults: 2, total: 4, isLast: false, values: [project(1), project(2)] } };
    }
    return { data: { startAt: 2, maxResults: 2, total: 4, isLast: true, values: [project(2), project(3)] } };
  };

  const result = await listJiraProjects({}, connection, { request });
  assert.deepEqual(
    result.projects.map((entry) => entry.key),
    ["P1", "P2", "P3"]
  );
});

/* -------------------------------------------------------------------------
 * 7. The cap, and saying so.
 * ---------------------------------------------------------------------- */

test("hitting the page cap reports a truncated list instead of a complete one", async () => {
  const jira = fakeJira(1000, { pageSize: 10 });
  const result = await listJiraProjects({}, connection, { request: jira.request, maxPages: 3 });

  assert.equal(jira.calls.length, 3, "the cap is honoured - no unbounded walk");
  assert.equal(result.projects.length, 30);
  assert.equal(
    result.truncated,
    true,
    "a partial list must never be handed back as though it were whole"
  );
});

test("the walk never exceeds its page cap even when Jira always claims more", async () => {
  // A Jira that ignores startAt and always says there is another page. The
  // cap is the only thing between this and an infinite loop.
  const request = async () => ({
    data: { startAt: 0, maxResults: 1, total: 999999, isLast: false, values: [project(1)] },
  });
  const result = await listJiraProjects({}, connection, { request, maxPages: 5 });
  assert.equal(result.truncated, true);
  assert.equal(result.projects.length, 1, "deduped by id despite five identical pages");
});

/* -------------------------------------------------------------------------
 * 8. A failure is a failure, not a short list.
 * ---------------------------------------------------------------------- */

test("a Jira failure mid-walk propagates instead of returning what was collected", async () => {
  let call = 0;
  const request = async () => {
    call += 1;
    if (call === 1) {
      return { data: { startAt: 0, maxResults: 2, total: 10, isLast: false, values: [project(1), project(2)] } };
    }
    const error = new Error("Jira returned 503.");
    error.status = 503;
    throw error;
  };

  await assert.rejects(
    () => listJiraProjects({}, connection, { request }),
    /503/,
    "silently returning page 1 would be the original bug wearing a different hat"
  );
});

/* -------------------------------------------------------------------------
 * The shape callers depend on.
 * ---------------------------------------------------------------------- */

test("projects carry the fields the dropdown and the mapping need", async () => {
  const jira = fakeJira(1);
  const { projects } = await listJiraProjects({}, connection, { request: jira.request });

  assert.deepEqual(projects[0], {
    id: "10000",
    key: "P0",
    name: "Project 0",
    projectTypeKey: "software",
  });
  // The id is a string: the mapping stores it as one and the <option> value
  // is compared as one, so a number here would break selection by identity.
  assert.equal(typeof projects[0].id, "string");
});

test("a page size is requested per page, not one huge request", async () => {
  const jira = fakeJira(60);
  await listJiraProjects({}, connection, { request: jira.request });
  for (const call of jira.calls) {
    assert.ok(call.query.maxResults > 0 && call.query.maxResults <= 50);
  }
});
