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
 * NOTHING HERE DUPLICATES THE SERVER'S WORK. Ticket retrieval is the existing
 * POST /api/jira/issues feed (the same one documented in JIRA_INTEGRATION.md
 * §3.1) filtered to findings that already have a Jira issue; the page does not
 * re-derive findings, re-read jira_issue_links or call Jira itself.
 */

const FEED_URL = '/api/jira/issues';
const STATUS_URL = '/api/jira/issues/status';

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

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    const error = new Error(
      data?.error || data?.message || `The Jira request failed (${response.status}).`
    );
    error.status = response.status;
    error.code = data?.code || '';
    error.payload = data;
    throw error;
  }
  return data;
}

/**
 * Jira tickets for one project, or for every project the token owns.
 *
 * POST rather than GET, for the reason the endpoint documents: a query string
 * lands in access logs, proxy logs and browser history, and an admin
 * credential does not belong in any of them.
 *
 * `jira_created: true` is applied SERVER-SIDE, so a project with thousands of
 * unfiled findings does not ship them all to the browser to be filtered out.
 */
export async function fetchJiraTickets({
  projectId = '',
  url = '',
  severity = '',
  issueType = '',
  page = 1,
  limit = 100,
  signal,
} = {}) {
  const body = {
    admin_token: requireToken(),
    jira_created: true,
    page,
    limit,
  };
  if (projectId) body.project_id = projectId;
  if (url) body.url = url;
  if (severity) body.severity = severity;
  if (issueType) body.issue_type = issueType;

  const response = await fetch(FEED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  return readResponse(response);
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

  const response = await fetch(`${STATUS_URL}?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  return readResponse(response);
}

/**
 * Move a Jira issue.
 *
 * `transitionId` is preferred and is what the UI sends once it has read the
 * list above, because a transition id is only meaningful within one project's
 * workflow. `status` and `intent` exist for callers that have not read the
 * list; the server resolves both against the live transitions and refuses
 * rather than guessing.
 */
export async function updateJiraTicketStatus({
  issueKey,
  projectId = '',
  transitionId = '',
  status = '',
  intent = '',
} = {}) {
  const body = { admin_token: requireToken(), jira_issue_key: issueKey };
  if (projectId) body.project_id = projectId;
  if (transitionId) body.transition_id = String(transitionId);
  else if (status) body.status = status;
  else body.action = intent || 'resolve';

  const response = await fetch(STATUS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return readResponse(response);
}
