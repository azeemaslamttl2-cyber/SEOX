import { getSessionToken } from './authSession.js';

// Client for /api/jira/*. Every call carries the SEOX session token; the
// server resolves the owner from it, so no user id is ever sent from the
// browser.
//
// No Jira credential ever passes through here. The browser sends the API
// token exactly once, on connect, and never receives it back - all Jira
// traffic is server-to-server, which also means there is no CORS to
// negotiate with Atlassian.

const BASE = '/api/jira';

function authHeaders(json = false) {
  const headers = new Headers();
  const token = getSessionToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (json) headers.set('Content-Type', 'application/json');
  return headers;
}

/**
 * `signal` is threaded through so a caller can genuinely CANCEL a request,
 * not merely ignore its answer. Ignoring is enough for correctness - a
 * component that drops a stale response cannot be corrupted by it - but the
 * request still runs, still costs a Jira call against an hourly budget of 60,
 * and still holds a connection. Switching project three times quickly used to
 * leave three project-list walks in flight.
 */
async function request(path, { method = 'GET', body, params, signal } = {}) {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(key, String(item)));
    else url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString().replace(window.location.origin, ''), {
    method,
    headers: authHeaders(Boolean(body)),
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || data?.message || `Jira request failed (${response.status}).`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

// --- Connection ------------------------------------------------------------

export function getJiraStatus(projectId) {
  return request('/status', { params: { projectId } });
}

export function connectJira({ projectId, baseUrl, email, apiToken }) {
  return request('/connect', {
    method: 'POST',
    body: { action: 'connect', projectId, baseUrl, email, apiToken },
  });
}

export function testJiraConnection(projectId) {
  return request('/connect', { method: 'POST', body: { action: 'test', projectId } });
}

export function disconnectJira(projectId) {
  return request('/connect', { method: 'POST', body: { action: 'disconnect', projectId } });
}

export function regenerateJiraWebhookSecret(projectId) {
  return request('/connect', {
    method: 'POST',
    body: { action: 'regenerate-webhook-secret', projectId },
  });
}

// --- Metadata --------------------------------------------------------------

/**
 * Every Jira project the connection for `projectId` can see.
 *
 * The server walks Jira's pagination, so this is the complete list rather
 * than its first page - and it answers `complete: false` when it could not
 * finish the walk. A caller that ignores that field is displaying a partial
 * list as though it were whole, which is the failure this endpoint was fixed
 * to stop.
 */
export function listJiraProjects(projectId, query, { signal } = {}) {
  return request('/metadata', { params: { projectId, resource: 'projects', query }, signal });
}

export function listJiraIssueTypes(projectId, jiraProjectId) {
  return request('/metadata', { params: { projectId, resource: 'issue-types', jiraProjectId } });
}

export function listJiraStatuses(projectId, jiraProjectId) {
  return request('/metadata', { params: { projectId, resource: 'statuses', jiraProjectId } });
}

export function listJiraPriorities(projectId, { signal } = {}) {
  return request('/metadata', { params: { projectId, resource: 'priorities' }, signal });
}

export function listJiraAssignable(projectId, jiraProjectKey, query) {
  return request('/metadata', {
    params: { projectId, resource: 'assignable', jiraProjectKey, query },
  });
}

export function listJiraComponents(projectId, jiraProjectId) {
  return request('/metadata', { params: { projectId, resource: 'components', jiraProjectId } });
}

// --- Mapping ---------------------------------------------------------------

export function getJiraMapping(projectId) {
  return request('/mapping', { params: { projectId } });
}

export function saveJiraMapping(mapping) {
  return request('/mapping', { method: 'POST', body: mapping });
}

// --- Issues ----------------------------------------------------------------

export function listJiraLinks(projectId, { fingerprint, limit } = {}) {
  return request('/issues', { params: { projectId, fingerprint, limit } });
}

export function createJiraIssue({ projectId, finding, overrides, useAi }) {
  return request('/issues', {
    method: 'POST',
    body: { action: 'create', projectId, finding, overrides, useAi: Boolean(useAi) },
  });
}

export function syncJiraIssue({ projectId, linkId }) {
  return request('/issues', { method: 'POST', body: { action: 'sync', projectId, linkId } });
}

export function unlinkJiraIssue({ projectId, linkId }) {
  return request('/issues', { method: 'POST', body: { action: 'unlink', projectId, linkId } });
}

export function verifyJiraIssue({ projectId, linkId }) {
  return request('/issues', { method: 'POST', body: { action: 'verify', projectId, linkId } });
}

// --- Operations ------------------------------------------------------------

export function getJiraActivity(projectId, { limit, result } = {}) {
  return request('/jobs', { params: { projectId, limit, result } });
}

export function retryJiraJob({ projectId, jobId }) {
  return request('/jobs', { method: 'POST', body: { action: 'retry-job', projectId, jobId } });
}
