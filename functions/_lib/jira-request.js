// Shared request guards for the /api/jira/* endpoints.
//
// These exist so the ownership check cannot be forgotten on a new route - the
// same role gbp-request.js plays for the Business Profile endpoints. Link ids
// are sequential bigints, so an endpoint that queries by id without also
// pinning user_id is a trivial IDOR.

import { queryOne } from './mysql.js';
import { getConnection, getMapping } from './jira-repository.js';

export function httpError(message, status, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

/** The project must exist AND belong to the signed-in user. */
export async function requireJiraProject(userId, projectId) {
  const id = String(projectId || '').trim();
  if (!id) throw httpError('A project must be selected first.', 400);

  const project = await queryOne(
    `SELECT project_id, project_name, domain, full_url
       FROM user_projects
      WHERE user_id = ? AND project_id = ?
      LIMIT 1`,
    [userId, id]
  );
  if (!project) throw httpError('You do not have access to this project.', 403);
  return project;
}

/** A usable connection: present, owned, and not in an error state. */
export async function requireJiraConnection(userId, projectId) {
  const connection = await getConnection(userId, projectId);
  if (!connection) throw httpError('Jira is not connected.', 409, { code: 'NOT_CONNECTED' });
  if (connection.status === 'disconnected') {
    throw httpError('Jira is not connected.', 409, { code: 'NOT_CONNECTED' });
  }
  if (connection.status === 'invalid_credentials') {
    throw httpError(
      connection.status_detail || 'The Jira credentials are no longer valid. Reconnect Jira.',
      401,
      { code: 'INVALID_CREDENTIALS' }
    );
  }
  if (!connection.api_token_encrypted) {
    throw httpError('The stored Jira credential is missing. Reconnect Jira.', 401, {
      code: 'INVALID_CREDENTIALS',
    });
  }
  return connection;
}

/** A connection plus an active project mapping. */
export async function requireJiraMapping(userId, projectId) {
  const connection = await requireJiraConnection(userId, projectId);
  const mapping = await getMapping(userId, projectId);
  if (!mapping) {
    throw httpError(
      'No Jira project is mapped for this SEOX project. Set one in Settings > Jira.',
      409,
      { code: 'NO_MAPPING' }
    );
  }
  if (mapping.status !== 'active') {
    throw httpError(
      mapping.status_detail || 'The Jira project mapping is not usable. Re-save it in Settings > Jira.',
      409,
      { code: 'INVALID_MAPPING' }
    );
  }
  return { connection, mapping };
}

/**
 * The base URL SEOX is reachable at, used for the webhook URL and for deep
 * links back into the app from a Jira issue.
 */
export function resolveAppUrl(env, request) {
  const configured = String(env?.APP_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  try {
    return new URL(request.url).origin;
  } catch {
    return '';
  }
}
