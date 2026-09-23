// The Jira projects a connection can see.
//
// Extracted from functions/api/jira/metadata.js so the session-authenticated
// settings screen and the admin_token Jira Tickets page ask Jira the same
// question the same way. Two copies of "list the projects" is how one screen
// ends up filtering out archived projects and the other does not.
//
// A Jira PROJECT is not a SEOX project. SEOX projects are websites
// (https://ucp.edu.pk/); Jira projects are boards (WUCP / "Web - UCP"). The
// mapping between them lives in jira_project_mappings and is reported here
// as `seox_projects`, but it is NOT required: the Jira Tickets page lets a
// user read any Jira project their own credential can see, mapped or not.

import { jiraRequestForConnection } from './jira-client.js';
import { listConnectionsForUser, listMappingsForUser } from './jira-repository.js';

/**
 * *** /rest/api/3/project/search IS PAGINATED, AND THE FIRST PAGE IS NOT THE
 * ANSWER ***
 *
 * This module used to issue exactly one request and return `data.values`,
 * with `maxResults: 50` from the settings screen and `100` from the Tickets
 * page. An account with more boards than that had the rest silently cut off -
 * and because the list is ordered by name, which boards survived depended on
 * the alphabet. That is the whole of the "the dropdown sometimes does not
 * show all my projects" report: it was not intermittent, it was a fixed
 * prefix that changed whenever a project was renamed, added, or the account's
 * visibility changed.
 *
 * It also broke mapping in a way that looked unrelated: a project mapped to a
 * board beyond the cut-off had a `jiraProjectId` matching no <option>, so the
 * dropdown fell back to its placeholder and read as "not loaded" or "not
 * mapped" on a project that was mapped perfectly well.
 *
 * *** HOW THE WALK TERMINATES ***
 * `isLast` is authoritative when Jira sends it. Otherwise the walk ends when
 * a page comes back empty, or when `startAt` has reached the reported
 * `total`, or when nothing in the response claims another page exists.
 *
 * `startAt` advances by the number of rows ACTUALLY RETURNED, never by the
 * page size requested. Jira clamps `maxResults` to its own per-endpoint
 * maximum and a clamped page is shorter than the one asked for; advancing by
 * the requested size would step over every row in the gap. This is the same
 * rule jira-search.js states for the JQL cursor - never infer anything from a
 * short page - applied to an offset API.
 *
 * *** A CAPPED WALK REPORTS ITSELF ***
 * `truncated: true` means the cap stopped the walk before Jira ran out, so
 * the caller holds a partial list. No caller may present or cache that as a
 * complete one; both /api/jira/metadata and /api/jira/projects turn it into a
 * visible error. Silently returning a short list is the bug being fixed here,
 * and re-introducing it one layer up would fix nothing.
 */

// Requested per page. Jira clamps this per endpoint and the walk copes with
// whatever it actually gets back, so this is a preference, not an assumption.
const PAGE_SIZE = 50;

// 50 x 40 = 2000 boards before the walk gives up and says so. High enough
// that no real Jira site reaches it, low enough that a misbehaving endpoint
// cannot turn one settings page into an unbounded request loop against the
// customer's shared rate limit.
const MAX_PAGES = 40;

function mapProject(project) {
  return {
    id: String(project.id),
    key: project.key,
    name: project.name,
    projectTypeKey: project.projectTypeKey || '',
  };
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * ONE page of a connection's visible Jira projects.
 *
 * Exported for the walk above it and for tests, which drive it through
 * `request` rather than through the network.
 *
 * @param {object} env
 * @param {object} connection                  a jira_connections row
 * @param {object} [options]
 * @param {string} [options.query]             Jira-side name/key filter
 * @param {number} [options.startAt]           offset of the first row wanted
 * @param {number} [options.maxResults]        rows requested; Jira may return fewer
 * @param {'interactive'|'background'} [options.kind]
 * @param {Function} [options.request]         injected in tests
 */
export async function listJiraProjectsPage(
  env,
  connection,
  {
    query = '',
    startAt = 0,
    maxResults = PAGE_SIZE,
    kind = 'interactive',
    request = jiraRequestForConnection,
  } = {}
) {
  const { data } = await request(env, connection, {
    path: '/rest/api/3/project/search',
    query: {
      startAt: Math.max(Number(startAt) || 0, 0),
      maxResults: Math.min(Math.max(Number(maxResults) || PAGE_SIZE, 1), PAGE_SIZE),
      query: query || undefined,
      orderBy: 'name',
    },
    kind,
  });

  const values = Array.isArray(data?.values) ? data.values : [];

  return {
    projects: values.map(mapProject),
    count: values.length,
    total: numberOrNull(data?.total),
    // Jira's own verdict, when it gives one. `null` means it did not, and the
    // walk then falls back to counting - it must never be read as `false`.
    isLast: typeof data?.isLast === 'boolean' ? data.isLast : null,
    nextPage: data?.nextPage || '',
  };
}

/**
 * EVERY Jira project one connection can see, across as many pages as it takes.
 *
 * Jira decides visibility from the credential, so the result is already
 * scoped to what that account may read - there is no filtering for SEOX to do
 * here, and none it could do more safely.
 *
 * @returns {Promise<{projects: object[], total: number, truncated: boolean, pages: number}>}
 *   `truncated` is true only when the page cap stopped the walk early.
 */
export async function listJiraProjects(
  env,
  connection,
  {
    query = '',
    pageSize = PAGE_SIZE,
    maxPages = MAX_PAGES,
    kind = 'interactive',
    request = jiraRequestForConnection,
  } = {}
) {
  // Keyed by Jira's project id so a board seen twice - which an offset walk
  // can produce if a project is created while it is running - is stored once.
  const byId = new Map();
  let startAt = 0;
  let reportedTotal = null;
  let pages = 0;

  const done = (truncated) => ({
    projects: [...byId.values()],
    // What Jira said the set contains, falling back to what was collected.
    total: reportedTotal === null ? byId.size : reportedTotal,
    truncated,
    pages,
  });

  while (pages < maxPages) {
    const page = await listJiraProjectsPage(env, connection, {
      query,
      startAt,
      maxResults: pageSize,
      kind,
      request,
    });
    pages += 1;

    if (page.total !== null) reportedTotal = page.total;
    for (const project of page.projects) {
      if (!byId.has(project.id)) byId.set(project.id, project);
    }

    // Jira said this was the end. Nothing else is authoritative over this.
    if (page.isLast === true) return done(false);
    // A page with no rows ends the walk whatever else the response claims.
    if (page.count === 0) return done(false);

    startAt += page.count;

    if (reportedTotal !== null && startAt >= reportedTotal) return done(false);
    // No `isLast`, no `total`, no `nextPage`: nothing in the response claims
    // there is more, so asking again would be a guess.
    if (page.isLast === null && reportedTotal === null && !page.nextPage) return done(false);
  }

  // The cap stopped the walk while Jira still had more. The list is partial
  // and says so; every caller is required to surface that rather than pass it
  // off as the complete set.
  return done(true);
}

/**
 * Every Jira project this SEOX user can reach, across all their connections.
 *
 * A user can connect Jira per SEOX project, and in practice several SEOX
 * projects point at the SAME Jira site with the same credential. Listing per
 * connection would therefore show the same 47 projects five times, so the
 * result is deduplicated on (site, project key) and each entry remembers one
 * connection that can reach it - which is the connection the ticket query
 * will then use.
 *
 * Failures are per connection, not fatal: one disconnected site must not
 * hide the projects of a working one. Each failure is reported so the UI can
 * say which site could not be listed.
 */
export async function listAllJiraProjectsForUser(env, userId, { query = '' } = {}) {
  const connections = await listConnectionsForUser(userId);
  const usable = connections.filter(
    (connection) =>
      connection.status !== 'disconnected' &&
      connection.status !== 'invalid_credentials' &&
      connection.api_token_encrypted
  );

  const mappings = await listMappingsForUser(userId);
  const mappedByKey = new Map();
  for (const mapping of mappings) {
    const key = String(mapping.jira_project_key || '').toUpperCase();
    if (!key) continue;
    if (!mappedByKey.has(key)) mappedByKey.set(key, []);
    mappedByKey.get(key).push(mapping.project_id);
  }

  const byKey = new Map();
  const errors = [];
  const sites = new Set();

  for (const connection of usable) {
    const baseUrl = String(connection.base_url || '').replace(/\/+$/, '');
    // Same site reached through two SEOX projects is one site to list.
    if (sites.has(baseUrl)) continue;
    sites.add(baseUrl);

    try {
      // Every page, not the first one. A site with 300 boards used to
      // contribute its first 100 and look complete.
      const { projects, truncated } = await listJiraProjects(env, connection, { query });
      if (truncated) {
        // Partial, and reported as such. It is listed among `errors` because
        // that is what every caller already inspects before trusting the
        // list, and because a partial list must never read as a whole one.
        errors.push({
          base_url: baseUrl,
          message:
            'This Jira site has more projects than SEOX will list in one pass, so the list below is incomplete.',
          code: 'JIRA_PROJECT_LIST_TRUNCATED',
        });
      }
      for (const project of projects) {
        const dedupeKey = `${baseUrl}::${project.key}`;
        if (byKey.has(dedupeKey)) continue;
        byKey.set(dedupeKey, {
          ...project,
          base_url: baseUrl,
          // Which stored credential to use when reading this project's
          // issues. Never sent to the browser as anything but an opaque id.
          connection_id: connection.id,
          // The SEOX project(s) mapped to this Jira project, if any. Purely
          // informational - it is not a precondition for reading tickets.
          seox_projects: mappedByKey.get(String(project.key).toUpperCase()) || [],
        });
      }
    } catch (error) {
      errors.push({
        base_url: baseUrl,
        message: error?.message || 'This Jira site could not be listed.',
        code:
          Number(error?.httpStatus || error?.status) === 401
            ? 'JIRA_AUTHENTICATION_FAILED'
            : 'JIRA_API_ERROR',
      });
    }
  }

  const projects = [...byKey.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key)
  );

  return { projects, errors, connectionCount: usable.length, siteCount: sites.size };
}

/** Find one listed project by key, so the ticket query knows its connection. */
export function findProjectByKey(projects, key) {
  const wanted = String(key || '').trim().toUpperCase();
  if (!wanted) return null;
  return projects.find((project) => String(project.key).toUpperCase() === wanted) || null;
}

/** Same, by Jira's numeric project id. */
export function findProjectById(projects, id) {
  const wanted = String(id || '').trim();
  if (!wanted) return null;
  return projects.find((project) => String(project.id) === wanted) || null;
}
