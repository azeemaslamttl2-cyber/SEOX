import { getSessionToken } from './authSession.js';

// Client for /api/gbp/*. Every call carries the SEOX session token; the server
// resolves the owner from it, so no user id is ever sent from the browser.

const BASE = '/api/gbp';

function authHeaders(json = false) {
  const headers = new Headers();
  const token = getSessionToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (json) headers.set('Content-Type', 'application/json');
  return headers;
}

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString().replace(window.location.origin, ''), {
    method,
    headers: authHeaders(Boolean(body)),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || `Request failed (${response.status}).`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

export function getGbpRedirectUri() {
  return `${window.location.origin}/gbp/oauth-callback`;
}

export function parseGbpOAuthState(rawState) {
  if (!rawState) return {};
  try {
    return JSON.parse(atob(rawState));
  } catch {
    return {};
  }
}

// --- Connection ------------------------------------------------------------

export function getConnectionStatus(projectId) {
  return request('/connect', { method: 'POST', body: { action: 'status', projectId } });
}

export async function getGbpAuthUrl(projectId, returnTo = '/local-seo/gbp') {
  const data = await request('/connect', {
    method: 'POST',
    body: { action: 'auth-url', projectId, returnTo, redirectUri: getGbpRedirectUri() },
  });
  return data.authUrl;
}

export function exchangeGbpCode({ projectId, code }) {
  return request('/connect', {
    method: 'POST',
    body: { action: 'exchange', projectId, code, redirectUri: getGbpRedirectUri() },
  });
}

export function disconnectGbp(projectId) {
  return request('/connect', { method: 'POST', body: { action: 'disconnect', projectId } });
}

// --- Accounts --------------------------------------------------------------

export function listGbpAccounts(projectId) {
  return request('/accounts', { params: { projectId } });
}

export function selectGbpAccount(projectId, account) {
  return request('/accounts', {
    method: 'POST',
    body: {
      projectId,
      accountId: account.accountId,
      accountName: account.accountName,
      accountType: account.accountType,
    },
  });
}

// --- Locations -------------------------------------------------------------

export function listAttachedLocations(projectId) {
  return request('/locations', { params: { projectId, source: 'attached' } });
}

export function listGoogleLocations(projectId) {
  return request('/locations', { params: { projectId, source: 'google' } });
}

export function attachLocations(projectId, locationIds) {
  return request('/locations', { method: 'POST', body: { action: 'attach', projectId, locationIds } });
}

export function resyncLocations(projectId) {
  return request('/locations', { method: 'POST', body: { action: 'resync', projectId } });
}

export function detachLocation(projectId, locationRowId) {
  return request('/locations', {
    method: 'POST',
    body: { action: 'detach', projectId, locationRowId },
  });
}

export function setPrimaryLocation(projectId, locationRowId) {
  return request('/locations', {
    method: 'POST',
    body: { action: 'set-primary', projectId, locationRowId },
  });
}

// --- Overview --------------------------------------------------------------

export function getGbpOverview({ projectId, locationRowId, days = 30 }) {
  return request('/overview', { params: { projectId, locationRowId, days } });
}

export function refreshGbpOverview({ projectId, locationRowId, days = 30 }) {
  return request('/overview', {
    method: 'POST',
    body: { action: 'refresh', projectId, locationRowId, days },
  });
}

// --- Profile Manager -------------------------------------------------------

export function getGbpProfile({ projectId, locationRowId }) {
  return request('/profile', { params: { projectId, locationRowId } });
}

export function searchGbpCategories({ projectId, locationRowId, q }) {
  return request('/profile', { params: { projectId, locationRowId, resource: 'categories', q } });
}

export function getGbpAttributeMetadata({ projectId, locationRowId, categoryId }) {
  return request('/profile', {
    params: { projectId, locationRowId, resource: 'attributes', categoryId },
  });
}

export function saveGbpSection({ projectId, locationRowId, section, value }) {
  return request('/profile', {
    method: 'POST',
    body: { action: 'save', projectId, locationRowId, section, value },
  });
}

export function saveGbpAttributes({ projectId, locationRowId, attributes }) {
  return request('/profile', {
    method: 'POST',
    body: { action: 'save-attributes', projectId, locationRowId, attributes },
  });
}

export function rollbackGbpProfile({ projectId, locationRowId, snapshotId, sections }) {
  return request('/profile', {
    method: 'POST',
    body: { action: 'rollback', projectId, locationRowId, snapshotId, sections },
  });
}

// --- Health Audit ----------------------------------------------------------

export function getGbpAudit({ projectId, locationRowId, auditId }) {
  return request('/audit', { params: { projectId, locationRowId, auditId } });
}

export function getGbpAuditHistory({ projectId, locationRowId }) {
  return request('/audit', { params: { projectId, locationRowId, history: 1 } });
}

export function runGbpAudit({ projectId, locationRowId }) {
  return request('/audit', { method: 'POST', body: { action: 'run', projectId, locationRowId } });
}

// --- Posts Manager ---------------------------------------------------------

export function listGbpPosts({ projectId, locationRowId, status }) {
  return request('/posts', { params: { projectId, locationRowId, status } });
}

export function listGbpTemplates(projectId) {
  return request('/posts', { params: { projectId, resource: 'templates' } });
}

export function saveGbpPost(payload) {
  return request('/posts', { method: 'POST', body: { action: 'save', ...payload } });
}

export function scheduleGbpPost(payload) {
  return request('/posts', { method: 'POST', body: { action: 'schedule', ...payload } });
}

export function publishGbpPost(payload) {
  return request('/posts', { method: 'POST', body: { action: 'publish', ...payload } });
}

export function scheduleRecurringGbpPost(payload) {
  return request('/posts', { method: 'POST', body: { action: 'schedule-recurring', ...payload } });
}

export function deleteGbpPost({ projectId, locationRowId, postId }) {
  return request('/posts', {
    method: 'POST',
    body: { action: 'delete', projectId, locationRowId, postId },
  });
}

export function generateGbpPost(payload) {
  return request('/posts', { method: 'POST', body: { action: 'generate', ...payload } });
}

export function saveGbpTemplate(payload) {
  return request('/posts', { method: 'POST', body: { action: 'save-template', ...payload } });
}

export function deleteGbpTemplate({ projectId, templateId }) {
  return request('/posts', {
    method: 'POST',
    body: { action: 'delete-template', projectId, templateId },
  });
}

export function clearGbpPostingBlock({ projectId, locationRowId }) {
  return request('/posts', {
    method: 'POST',
    body: { action: 'clear-block', projectId, locationRowId },
  });
}

// --- Automation ------------------------------------------------------------

export function listGbpRules(projectId) {
  return request('/automation', { params: { projectId } });
}

export function listGbpSources({ projectId, ruleId, status }) {
  return request('/automation', { params: { projectId, resource: 'sources', ruleId, status } });
}

export function saveGbpRule(payload) {
  return request('/automation', { method: 'POST', body: { action: 'save-rule', ...payload } });
}

export function deleteGbpRule({ projectId, ruleId }) {
  return request('/automation', {
    method: 'POST',
    body: { action: 'delete-rule', projectId, ruleId },
  });
}

export function runGbpRule({ projectId, ruleId }) {
  return request('/automation', { method: 'POST', body: { action: 'run-rule', projectId, ruleId } });
}

export function skipGbpSource({ projectId, sourceId, reason }) {
  return request('/automation', {
    method: 'POST',
    body: { action: 'skip-source', projectId, sourceId, reason },
  });
}

export function getGbpQueueStats(projectId, includeAcknowledged = false) {
  return request('/jobs', { params: { projectId, all: includeAcknowledged ? 1 : undefined } });
}

// --- Review Management -----------------------------------------------------

export function listGbpReviews({ projectId, locationRowId, filter, limit, offset }) {
  return request('/reviews', { params: { projectId, locationRowId, filter, limit, offset } });
}

export function syncGbpReviews({ projectId, locationRowId }) {
  return request('/reviews', { method: 'POST', body: { action: 'sync', projectId, locationRowId } });
}

export function draftGbpReply({ projectId, locationRowId, reviewRowId, tone }) {
  return request('/reviews', {
    method: 'POST',
    body: { action: 'draft', projectId, locationRowId, reviewRowId, tone, allowAutoPublish: false },
  });
}

export function draftGbpRepliesBulk({ projectId, locationRowId, limit, allowAutoPublish }) {
  return request('/reviews', {
    method: 'POST',
    body: { action: 'draft-bulk', projectId, locationRowId, limit, allowAutoPublish },
  });
}

export function publishGbpReply({ projectId, locationRowId, reviewRowId, comment }) {
  return request('/reviews', {
    method: 'POST',
    body: { action: 'publish-reply', projectId, locationRowId, reviewRowId, comment },
  });
}

export function deleteGbpReply({ projectId, locationRowId, reviewRowId }) {
  return request('/reviews', {
    method: 'POST',
    body: { action: 'delete-reply', projectId, locationRowId, reviewRowId },
  });
}

export function flagGbpReview({ projectId, locationRowId, reviewRowId, flagged }) {
  return request('/reviews', {
    method: 'POST',
    body: { action: 'flag', projectId, locationRowId, reviewRowId, flagged },
  });
}

export function authorizeGbpReplies({ projectId, locationRowId, authorized, authorizedBy, note }) {
  return request('/reviews', {
    method: 'POST',
    body: { action: 'authorize', projectId, locationRowId, authorized, authorizedBy, note },
  });
}

export function setGbpAutoReply({ projectId, locationRowId, enabled, minStars }) {
  return request('/reviews', {
    method: 'POST',
    body: { action: 'auto-reply-settings', projectId, locationRowId, enabled, minStars },
  });
}

// --- Review Intelligence ---------------------------------------------------

export function getGbpInsights({ projectId, locationRowId }) {
  return request('/insights', { params: { projectId, locationRowId } });
}

export function getGbpInsightHistory({ projectId, locationRowId }) {
  return request('/insights', { params: { projectId, locationRowId, history: 1 } });
}

export function analyseGbpReviews({ projectId, locationRowId }) {
  return request('/insights', {
    method: 'POST',
    body: { action: 'analyse', projectId, locationRowId },
  });
}

// --- Q&A Manager -----------------------------------------------------------

export function listGbpQuestions({ projectId, locationRowId, status }) {
  return request('/qanda', { params: { projectId, locationRowId, status } });
}

export function syncGbpQuestions({ projectId, locationRowId }) {
  return request('/qanda', { method: 'POST', body: { action: 'sync', projectId, locationRowId } });
}

export function draftGbpAnswer({ projectId, locationRowId, questionRowId }) {
  return request('/qanda', {
    method: 'POST',
    body: { action: 'draft', projectId, locationRowId, questionRowId },
  });
}

export function draftGbpAnswersBulk({ projectId, locationRowId, limit }) {
  return request('/qanda', {
    method: 'POST',
    body: { action: 'draft-bulk', projectId, locationRowId, limit },
  });
}

export function publishGbpAnswer({ projectId, locationRowId, questionRowId, answer }) {
  return request('/qanda', {
    method: 'POST',
    body: { action: 'publish', projectId, locationRowId, questionRowId, answer },
  });
}

export function deleteGbpAnswer({ projectId, locationRowId, questionRowId }) {
  return request('/qanda', {
    method: 'POST',
    body: { action: 'delete-answer', projectId, locationRowId, questionRowId },
  });
}

// --- Recommendations Engine + Safe AI Actions ------------------------------

export function listGbpRecommendations({ projectId, locationRowId, status, priority }) {
  return request('/recommendations', { params: { projectId, locationRowId, status, priority } });
}

export function runGbpRecommendations({ projectId, locationRowId, days }) {
  return request('/recommendations', {
    method: 'POST',
    body: { action: 'run', projectId, locationRowId, days },
  });
}

export function syncGbpSearchKeywords({ projectId, locationRowId }) {
  return request('/recommendations', {
    method: 'POST',
    body: { action: 'sync-keywords', projectId, locationRowId },
  });
}

export function executeGbpRecommendation({ projectId, recommendationId, actionKey, limit }) {
  return request('/recommendations', {
    method: 'POST',
    body: { action: 'execute', projectId, recommendationId, actionKey, limit },
  });
}

export function ignoreGbpRecommendation({ projectId, recommendationId }) {
  return request('/recommendations', {
    method: 'POST',
    body: { action: 'ignore', projectId, recommendationId },
  });
}

// --- Audit History ---------------------------------------------------------

export function getGbpHistory({ projectId, locationRowId, compare }) {
  return request('/history', { params: { projectId, locationRowId, compare } });
}

// --- Operations: queue, alerts, quota --------------------------------------

export function acknowledgeGbpAlert({ projectId, alertId }) {
  return request('/jobs', {
    method: 'POST',
    body: { action: 'acknowledge-alert', projectId, alertId },
  });
}

// --- Recurring post series -------------------------------------------------

export function listGbpPostSchedules({ projectId, locationRowId }) {
  return request('/posts', { params: { projectId, locationRowId, resource: 'schedules' } });
}

export function cancelGbpPostSeries({ projectId, locationRowId, scheduleId }) {
  return request('/posts', {
    method: 'POST',
    body: { action: 'cancel-series', projectId, locationRowId, scheduleId },
  });
}
