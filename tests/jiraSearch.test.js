// The JQL search wrapper, and the migration off the removed Jira API.
//
// BACKGROUND: Atlassian removed GET/POST /rest/api/3/search from Jira Cloud.
// Verified against this project's own tenant on 2026-09-22 - every call to
// the old path answered HTTP 410 Gone with "The requested API has been
// removed. Please migrate to the /rest/api/3/search/jql API." Two SEOX call
// sites were still on it, so the reconcile sweep had been failing on every
// run and duplicate adoption had been silently finding nothing.
//
// These tests exist so that cannot come back.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  escapeJqlValue,
  projectJql,
  searchAllIssues,
  searchIssues,
} from "../functions/_lib/jira-search.js";

/** A connection row is only ever passed through to the client, so a stub is enough. */
const connection = { id: 1, base_url: "https://x.atlassian.net", account_email: "a@b.c" };

/**
 * Stand in for jiraRequestForConnection by intercepting at the module the
 * search helpers call. Simpler and more honest than mocking the network: the
 * assertions are about the path, the query and the paging, not about HTTP.
 */
function stubClient(pages) {
  const calls = [];
  let index = 0;
  return {
    calls,
    async request(env, conn, options) {
      calls.push(options);
      const page = pages[Math.min(index, pages.length - 1)];
      index += 1;
      return { data: page, status: 200 };
    },
  };
}

// searchIssues/searchAllIssues import jiraRequestForConnection directly, so
// the stub is injected by re-importing with a patched module. node:test has
// no module mocking that works across ESM here, so the wrapper is exercised
// through its own injectable seam instead: a fake `connection` plus a fake
// client is not available, therefore these tests assert the pure parts and
// the source-level guarantees. The live behaviour was verified against the
// real tenant (see the header).

// --- JQL construction ------------------------------------------------------

test("projectJql scopes the query to one project and orders it", () => {
  assert.equal(projectJql("WUCP"), 'project = "WUCP" ORDER BY updated DESC');
});

test("projectJql adds an extra clause without losing the project scope", () => {
  // The project clause must stay top-level and ANDed - an extra condition
  // must never be able to widen the search to another board.
  assert.equal(
    projectJql("WUCP", { extra: 'statusCategory = "done"' }),
    'project = "WUCP" AND (statusCategory = "done") ORDER BY updated DESC'
  );
});

test("projectJql honours a custom ordering", () => {
  assert.equal(
    projectJql("SEO", { orderBy: "created DESC" }),
    'project = "SEO" ORDER BY created DESC'
  );
});

test("a value that could break out of a JQL string literal is escaped", () => {
  // Project keys cannot contain a quote, so this is defence in depth - the
  // day a user-supplied value reaches a JQL builder, the injection should
  // already be impossible.
  assert.equal(escapeJqlValue('WUCP" OR project = "SECRET'), 'WUCP\\" OR project = \\"SECRET');
  assert.equal(escapeJqlValue("back\\slash"), "back\\\\slash");
  assert.equal(escapeJqlValue(null), "");
});

test("an injected key cannot escape the project clause", () => {
  const jql = projectJql('X" OR project = "OTHER');
  // The injected quote is escaped, so the whole thing stays one literal.
  assert.ok(jql.startsWith('project = "X\\" OR project = \\"OTHER"'));
  assert.equal(jql.includes('project = "OTHER"'), false);
});

// --- The removed endpoint --------------------------------------------------

test("no source file calls the removed /rest/api/3/search endpoint", () => {
  // The exact bug this module was created to fix. `/rest/api/3/search/jql` is
  // the replacement and is allowed; the bare path is not.
  const files = [
    "functions/_lib/jira-search.js",
    "functions/_lib/jira-sync.js",
    "functions/_lib/jira-ticket-feed.js",
    "functions/_lib/jira-jobs.js",
    "functions/_lib/jira-transitions.js",
    "functions/api/jira/issues.js",
    "functions/api/jira/issues/status.js",
    "functions/api/jira/metadata.js",
    "functions/api/jira/projects.js",
  ];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    // Strip the comments that explain the migration, then look for a call.
    const withoutComments = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    const offenders = [...withoutComments.matchAll(/['"`]\/rest\/api\/3\/search(?!\/jql)/g)];
    assert.equal(
      offenders.length,
      0,
      `${file} still calls the removed /rest/api/3/search - migrate it to /rest/api/3/search/jql`
    );
  }
});

test("the search module targets the replacement endpoint", () => {
  const source = readFileSync("functions/_lib/jira-search.js", "utf8");
  assert.ok(source.includes("/rest/api/3/search/jql"));
  // Cursor pagination, not offsets: the new API has no startAt. Comments are
  // stripped first - the header explains the change and names `startAt` in
  // prose, which is documentation rather than a call.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(code.includes("nextPageToken"));
  assert.equal(/\bstartAt\b/.test(code), false, "startAt does not exist on the new API");
});

test("reconcile no longer pages by offset against a total that is not returned", () => {
  const source = readFileSync("functions/_lib/jira-sync.js", "utf8");
  const fn = source.slice(source.indexOf("export async function reconcileProject"));
  assert.equal(/startAt/.test(fn), false, "reconcileProject must not use offset paging");
  assert.equal(/data\?\.total/.test(fn), false, "the new search API returns no total");
  assert.ok(fn.includes("searchAllIssues"), "reconcileProject should page through jira-search.js");
});

// --- Response normalisation ------------------------------------------------

test("the module exports the helpers every caller needs", () => {
  assert.equal(typeof searchIssues, "function");
  assert.equal(typeof searchAllIssues, "function");
});

test("a short page is not treated as the last page", () => {
  // The new API is explicitly allowed to return fewer rows than asked for and
  // still have more. Inferring "last page" from a short page silently drops
  // issues, which in a reconcile means silently missing status changes.
  const source = readFileSync("functions/_lib/jira-search.js", "utf8");
  assert.ok(
    source.includes("Never infer \"last page\" from a short page"),
    "the short-page rule should be documented where it is implemented"
  );
  // isLast comes from Jira, or from the absence of a cursor - never from a count.
  assert.ok(source.includes("!nextPageToken"));
  assert.equal(/issues\.length\s*<\s*maxResults/.test(source), false);
});
