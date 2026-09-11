import { configureMysqlConnection, queryOne } from './mysql.js';
import { jsonResponse } from './http.js';

/**
 * Shared admin_token authentication for the content tool APIs.
 *
 * These endpoints authenticate with the `admin_token` body field ONLY - the
 * project's established mechanism, validated against users.admin_token. No
 * Authorization header, session cookie or OAuth token is read or accepted.
 *
 * The token itself is never echoed back or logged.
 */

const MAX_TOKEN_LENGTH = 512;

function authError(message, status, field = 'admin_token') {
  const error = new Error(message);
  error.status = status;
  error.field = field;
  return error;
}

function hasMysqlConfig(env = {}) {
  return Boolean(env?.MYSQL_HOST || env?.MYSQL_DATABASE || env?.MYSQL_USER);
}

export function normalizeAdminToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  if (!token) throw authError('admin_token is required.', 400);
  if (token.length > MAX_TOKEN_LENGTH) throw authError('Invalid admin token.', 401);
  return token;
}

export async function verifyAdminToken(token, env) {
  const configured = String(env?.ADMIN_TOKEN || '').trim();

  if (configured && token === configured) return { id: 'configured-admin' };

  if (!hasMysqlConfig(env)) throw authError('Invalid admin token.', 401);

  configureMysqlConnection(env);
  const admin = await queryOne(
    `SELECT id FROM users WHERE admin_token = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1`,
    [token]
  );

  if (!admin) throw authError('Invalid admin token.', 401);

  return admin;
}

/**
 * Validate the admin_token on a request body. Must succeed before any
 * business logic runs.
 * @returns {Promise<{id: string|number}>} the authenticated admin
 */
export async function requireAdminToken(body, env) {
  return verifyAdminToken(normalizeAdminToken(body?.admin_token), env);
}

/**
 * Build the project's standard JSON error envelope. Never includes stack
 * traces, credentials or the submitted token.
 */
export function apiErrorResponse(error, headers, fallbackMessage = 'Request failed.') {
  // Errors we raise deliberately carry a `status`, so their message is safe to
  // return. Anything without one is unexpected (driver/runtime failure) and is
  // reported generically so internals never reach the client.
  const authored = Number.isInteger(error?.status);
  const status = authored ? error.status : 500;
  const message = String(
    (authored && error?.message) || fallbackMessage || 'Validation failed'
  ).trim();

  const statusLabel =
    status === 400
      ? 'validation_error'
      : status === 401
      ? 'unauthorized'
      : status === 403
      ? 'forbidden'
      : status === 405
      ? 'method_not_allowed'
      : status === 502
      ? 'upstream_error'
      : 'error';

  const errors = status >= 500 ? { server: message } : { [error?.field || 'message']: message };

  if (status >= 500) console.error('API error:', error?.message);

  return jsonResponse({ success: false, status: statusLabel, message, errors }, status, headers);
}

/**
 * Headers for an admin_token-only JSON endpoint: Content-Type is the only
 * accepted header, since no Authorization header is used.
 */
export function adminApiHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };
}
