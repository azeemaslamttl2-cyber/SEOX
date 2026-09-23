/**
 * The admin token the Jira Tickets page authenticates with.
 *
 * WHY THIS IS A SEPARATE CREDENTIAL FROM THE SESSION, AND WHY THE USER TYPES
 * IT IN: every Jira ticket API - the ticket list on /api/jira/tickets and
 * the status update on /api/jira/issues/status - authenticates on
 * `users.admin_token` and refuses to fall back to the session, a cookie or
 * anything else. That is deliberate, and it means the browser has to hold a
 * real admin token; there is no endpoint that mints one from a session, and
 * adding one would quietly undo the separation those endpoints exist to keep.
 *
 * So the page asks for it once, the same way Settings asks for the DeepSeek
 * API key and the Jira API token, and remembers it here.
 *
 * Stored in localStorage, per origin. That is the same exposure the session
 * token already has (see authSession.js) - both are readable by anything that
 * can already run script on this origin, at which point the session is gone
 * anyway. It is never sent anywhere except SEOX's own /api/jira/* routes.
 */

const STORAGE_KEY = 'seox.jira.adminToken';

/** Any storage access can throw in a private window or with site data blocked. */
function safeRead() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function getJiraAdminToken() {
  if (typeof window === 'undefined') return '';
  return safeRead().trim();
}

export function setJiraAdminToken(token) {
  if (typeof window === 'undefined') return;
  const value = String(token || '').trim();
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, value);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* A page that cannot persist the token still works for this session. */
  }
}

export function clearJiraAdminToken() {
  setJiraAdminToken('');
}

/** Enough of the token to recognise it, never enough to use it. */
export function maskAdminToken(token) {
  const value = String(token || '').trim();
  if (!value) return '';
  if (value.length <= 8) return `${value.slice(0, 2)}${'.'.repeat(6)}`;
  return `${value.slice(0, 4)}${'.'.repeat(8)}${value.slice(-4)}`;
}
