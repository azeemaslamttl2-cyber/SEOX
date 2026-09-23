// Searching Jira with JQL.
//
// *** WHY THIS MODULE EXISTS ***
// Atlassian REMOVED `GET/POST /rest/api/3/search` from Jira Cloud. It does not
// return an error you can retry - it returns HTTP 410 Gone:
//
//   "The requested API has been removed. Please migrate to the
//    /rest/api/3/search/jql API."   (CHANGE-2046)
//
// Verified against this project's own tenant on 2026-09-22: every call to the
// old path answered 410, every call to the new path answered 200. Two places
// in SEOX were still on the old path - the 30-minute reconcile sweep and the
// remote duplicate pre-flight - so the sweep had been failing every run and
// duplicate adoption had been silently returning "nothing found" for every
// create. Both now come through here.
//
// The new API is not a drop-in rename. Three differences matter:
//
//   1. PAGINATION IS A CURSOR, NOT AN OFFSET. There is no `startAt`; you send
//      back the `nextPageToken` you were given. Callers that counted up to
//      `total` have to be rewritten, not adjusted.
//   2. THERE IS NO `total`. The result set size is not known without a second
//      call to /search/approximate-count. Code that displayed a total has to
//      either spend that call or stop claiming a number.
//   3. `fields` IS NOT OPTIONAL in practice. Omit it and you get id and key
//      and nothing else, which looks exactly like an issue with empty fields.

import { jiraRequestForConnection } from './jira-client.js';

/** The issue fields SEOX reads. Kept in one place so every caller agrees. */
export const ISSUE_FIELDS = 'summary,status,resolution,assignee,reporter,priority,issuetype,labels,created,updated';

/** A hard ceiling per call. Jira's own maximum for this endpoint is 100. */
const MAX_RESULTS = 100;

/**
 * One page of a JQL search.
 *
 * @param {object} env
 * @param {object} connection            a jira_connections row
 * @param {object} options
 * @param {string} options.jql
 * @param {string} [options.fields]      defaults to ISSUE_FIELDS
 * @param {number} [options.maxResults]
 * @param {string} [options.pageToken]   `nextPageToken` from a previous page
 * @param {'interactive'|'background'} [options.kind]
 * @returns {Promise<{issues: object[], nextPageToken: string|null, isLast: boolean}>}
 */
export async function searchIssues(
  env,
  connection,
  { jql, fields = ISSUE_FIELDS, maxResults = 50, pageToken = '', kind = 'background' } = {}
) {
  const { data } = await jiraRequestForConnection(env, connection, {
    path: '/rest/api/3/search/jql',
    query: {
      jql,
      fields,
      maxResults: Math.min(Math.max(Number(maxResults) || 50, 1), MAX_RESULTS),
      ...(pageToken ? { nextPageToken: pageToken } : {}),
    },
    kind,
  });

  const issues = Array.isArray(data?.issues) ? data.issues : [];
  const nextPageToken = data?.nextPageToken || null;

  return {
    issues,
    nextPageToken,
    // `isLast` is authoritative when Jira sends it; otherwise the absence of a
    // cursor is what ends the walk. Never infer "last page" from a short page:
    // this API is explicitly allowed to return fewer rows than asked for and
    // still have more.
    isLast: typeof data?.isLast === 'boolean' ? data.isLast : !nextPageToken,
  };
}

/**
 * Walk every page of a JQL search, up to a hard cap.
 *
 * The cap is not a nicety. A reconcile over a large Jira project must never
 * turn into an unbounded walk that holds a worker and spends the customer's
 * shared rate limit.
 */
export async function searchAllIssues(
  env,
  connection,
  { jql, fields = ISSUE_FIELDS, pageSize = 100, maxPages = 10, kind = 'background' } = {}
) {
  const collected = [];
  let pageToken = '';

  for (let page = 0; page < maxPages; page += 1) {
    const result = await searchIssues(env, connection, {
      jql,
      fields,
      maxResults: pageSize,
      pageToken,
      kind,
    });
    collected.push(...result.issues);
    if (result.isLast || !result.nextPageToken) {
      return { issues: collected, truncated: false };
    }
    pageToken = result.nextPageToken;
  }

  // Ran out of pages before Jira ran out of issues. Say so rather than
  // letting the caller believe it saw everything.
  return { issues: collected, truncated: true };
}

/**
 * Escape a value for embedding in a JQL string literal.
 *
 * Jira project keys are `[A-Z][A-Z0-9_]+` so they cannot contain a quote, but
 * this is applied anyway: the day someone passes a user-supplied value into a
 * JQL builder, the injection should already be impossible rather than
 * depending on a validation that lives somewhere else.
 */
export function escapeJqlValue(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** `project = "KEY" ORDER BY updated DESC`, built from a validated key. */
export function projectJql(projectKey, { orderBy = 'updated DESC', extra = '' } = {}) {
  const clauses = [`project = "${escapeJqlValue(projectKey)}"`];
  if (extra) clauses.push(`(${extra})`);
  return `${clauses.join(' AND ')} ORDER BY ${orderBy}`;
}

/**
 * The JQL that leaves out every status Jira itself files under `Done`.
 *
 * Written against the CATEGORY, not against a list of status names. "Done",
 * "Closed", "Resolved", "Completed", "Shipped to prod" and a localised
 * equivalent are all different names for the same thing, they are renameable
 * per project, and no hardcoded list survives contact with a real board. Every
 * Jira status belongs to exactly one of three categories - new, indeterminate,
 * done - and Jira, not SEOX, decides which. So the question "is this ticket
 * finished?" is asked of Jira in the one form Jira can answer correctly.
 *
 * Deliberately NOT `resolution = EMPTY`, which is the other common way to
 * write this. A reopened issue whose resolution was never cleared - a very
 * ordinary state on an old board - is still open work, and `resolution =
 * EMPTY` would hide it. Hiding a ticket that needs attention is the one
 * failure this filter must not have.
 */
export const EXCLUDE_DONE_JQL = 'statusCategory != "done"';
