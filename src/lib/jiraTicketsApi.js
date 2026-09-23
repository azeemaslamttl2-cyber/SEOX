import { getJiraAdminToken } from './jiraAdminToken.js';

/**
 * Client for the two admin_token Jira endpoints the Tickets page uses.
 *
 * Kept apart from jiraApi.js on purpose: that client sends the session Bearer
 * token to the session-authenticated /api/jira/* routes, and these two routes
 * accept admin_token and nothing else. One module that sometimes sends one
 * credential and sometimes the other is how a request ends up carrying the
 * wrong one.
 *
 * NOTHING HERE DUPLICATES THE SERVER'S WORK. Ticket retrieval is
 * `POST /api/jira/tickets`, which resolves the internal project, its Jira
 * mapping and the Jira project key server-side and queries Jira through the
 * existing Jira client. The browser never talks to Jira and never sees a Jira
 * credential, a bearer header or an encryption key.
 */

/**
 * The ticket list.
 *
 * Was `POST /api/jira/issues` with `mode: "tickets"` - a mode of a route
 * whose other modes are about SEOX's own findings and the finding-to-issue
 * links. The ticket list now has a URL that says what it returns, and no
 * caller needs to know a magic `mode` string to reach it.
 */
const TICKETS_URL = '/api/jira/tickets';
const STATUS_URL = '/api/jira/issues/status';
const PROJECTS_URL = '/api/jira/projects';

function requireToken() {
  const token = getJiraAdminToken();
  if (!token) {
    const error = new Error('An admin token is required to load Jira tickets.');
    error.code = 'NO_ADMIN_TOKEN';
    error.status = 400;
    throw error;
  }
  return token;
}

/**
 * Turn any failure into an Error carrying the server's own `code`.
 *
 * The code is what the page switches on to explain the problem, so it is
 * preserved rather than flattened into a string. A transport failure gets a
 * code too - without one the page could not tell "SEOX is unreachable" from
 * "Jira is unreachable", and those need different advice.
 */
async function readResponse(response) {
  let data = {};
  try {
    data = await response.json();
  } catch {
    const error = new Error(
      `SEOX returned a response that could not be read (HTTP ${response.status}).`
    );
    error.status = response.status;
    error.code = 'BAD_RESPONSE';
    throw error;
  }

  if (!response.ok || data?.success === false) {
    const error = new Error(
      data?.error || data?.message || `The Jira request failed (HTTP ${response.status}).`
    );
    error.status = response.status;
    error.code = data?.code || '';
    error.payload = data;
    throw error;
  }
  return data;
}

async function postJson(url, body, signal) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (cause?.name === 'AbortError') throw cause;
    // The request never reached SEOX. This is NOT a Jira problem and must not
    // be reported as one.
    const error = new Error('Could not reach SEOX. Check your connection and try again.');
    error.code = 'NETWORK_ERROR';
    error.status = 0;
    throw error;
  }
  return readResponse(response);
}

/**
 * The Jira projects this admin token can read.
 *
 * These are JIRA projects (WUCP / "Web - UCP"), not SEOX projects
 * (https://ucp.edu.pk/). The list comes from Jira itself via the stored
 * credential - it is never hardcoded and never derived from a website URL.
 */
export function fetchJiraProjects({ query = '', signal } = {}) {
  const body = { admin_token: requireToken() };
  if (query) body.query = query;
  return postJson(PROJECTS_URL, body, signal);
}

/**
 * Tickets for a Jira project, selected by its Jira key.
 *
 * `jiraProjectKey` is the stable identifier Jira reported, so the server
 * queries `project = "<key>"` directly. It never infers a Jira project from
 * a SEOX project's URL.
 *
 * `projectId`/`url` remain supported for the SEOX-project route through the
 * same endpoint (SEOX project -> mapping -> Jira project), which is what the
 * auditor's deep links use.
 *
 * POST rather than GET, for the reason the endpoint documents: a query string
 * lands in access logs, proxy logs and browser history, and an admin
 * credential does not belong in any of them.
 *
 * *** THE SERVER EXCLUDES RESOLVED TICKETS UNLESS ASKED ***
 * With no `statusCategory` and no `includeResolved`, the response contains
 * only tickets that still need attention - the exclusion is a JQL clause, so
 * it applies across the whole Jira project rather than to the page that
 * happened to come back. A caller that wants the finished ones asks:
 * `statusCategory: 'done'` for those alone, `includeResolved: true` (or
 * `statusCategory: 'all'`) for the whole board. Filtering the response here
 * instead would page through years of closed tickets to find this week's.
 */
export function fetchJiraTickets({
  jiraProjectKey = '',
  jiraProjectId = '',
  projectId = '',
  url = '',
  statusCategory = '',
  includeResolved = false,
  limit = 50,
  pageToken = '',
  signal,
} = {}) {
  const body = { admin_token: requireToken(), limit };
  if (jiraProjectKey) body.jira_project_key = jiraProjectKey;
  else if (jiraProjectId) body.jira_project_id = jiraProjectId;
  else if (projectId) body.project_id = projectId;
  else if (url) body.url = url;
  if (statusCategory) body.status_category = statusCategory;
  if (includeResolved) body.include_resolved = true;
  if (pageToken) body.page_token = pageToken;

  return postJson(TICKETS_URL, body, signal);
}

/**
 * The transitions this issue can actually make right now.
 *
 * Read from Jira per issue, because a Jira workflow offers different steps
 * depending on the status the issue is currently in - there is no per-project
 * list that would be correct to cache.
 */
export async function fetchJiraTransitions({ issueKey, projectId = '', signal } = {}) {
  const params = new URLSearchParams({
    admin_token: requireToken(),
    jira_issue_key: issueKey,
  });
  if (projectId) params.set('project_id', projectId);

  let response;
  try {
    response = await fetch(`${STATUS_URL}?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (cause) {
    if (cause?.name === 'AbortError') throw cause;
    const error = new Error('Could not reach SEOX. Check your connection and try again.');
    error.code = 'NETWORK_ERROR';
    throw error;
  }
  return readResponse(response);
}

/**
 * Move a Jira issue, leave a review on it, or both in one request.
 *
 * `transitionId` is preferred and is what the UI sends once it has read the
 * list above, because a transition id is only meaningful within one project's
 * workflow. `status` and `intent` exist for callers that have not read the
 * list; the server resolves both against the live transitions and refuses
 * rather than guessing.
 *
 * `review` is posted to the Jira ticket as a Jira comment, by the server,
 * using the stored Jira credential. It is not stored in SEOX.
 *
 * WHY `action` IS NOT ALWAYS SENT: the server reads a request that names no
 * transition, status or intent as "resolve", which is what the bare Resolve
 * POST has always meant. Sending `action: 'resolve'` alongside a review the
 * user wrote with the status dropdown left alone would therefore close their
 * ticket for them. So the fallback is omitted exactly when a review is the
 * only thing being asked for.
 */
export function updateJiraTicketStatus({
  issueKey,
  projectId = '',
  transitionId = '',
  status = '',
  intent = '',
  review = '',
} = {}) {
  const body = { admin_token: requireToken(), jira_issue_key: issueKey };
  if (projectId) body.project_id = projectId;

  const text = String(review || '').trim();
  if (text) body.review = text;

  if (transitionId) body.transition_id = String(transitionId);
  else if (status) body.status = status;
  else if (intent) body.action = intent;
  else if (!text) body.action = 'resolve';

  return postJson(STATUS_URL, body);
}
