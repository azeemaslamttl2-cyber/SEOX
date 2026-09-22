// Per-project WPScan API token, stored in user_projects.site_token.
//
// Why per project: the free WPScan tier is 25 requests a day and is licensed
// for non-commercial use. One install-wide WPSCAN_API_TOKEN cannot serve an
// agency running scans for several clients - they would share, and exhaust,
// one quota. Each project can now carry the token belonging to the site it
// scans, and the environment token stays as the fallback for single-site
// installs.
//
// At rest the value is encrypted with AES-256-GCM through the same helper the
// Business Profile tokens use, when GBP_TOKEN_ENCRYPTION_KEY is configured.
// An encrypted value is self-identifying - it starts with "v1." - so an
// install that has no key set stores the token as-is and keeps working, and
// one that adds a key later re-encrypts on the next save without a migration.

import { queryOne, update } from './mysql.js';
import { decryptSecret, encryptSecret, encryptionKeyConfigured } from './gbp-crypto.js';

const CIPHERTEXT_PREFIX = 'v1.';

/** Where a resolved token came from, for display on the page. */
export const TOKEN_SOURCE = {
  PROJECT: 'project',
  ENVIRONMENT: 'environment',
  NONE: null,
};

/**
 * Whether a saved project token would be encrypted at rest. Surfaced so the
 * page can say what actually happens rather than promising encryption on an
 * install that has no GBP_TOKEN_ENCRYPTION_KEY set.
 */
export function tokenEncryptionAvailable(env) {
  return encryptionKeyConfigured(env);
}

/**
 * Last four characters, for confirming which token is saved without ever
 * sending it back to the browser.
 */
export function maskToken(token) {
  const value = String(token || '').trim();
  if (!value) return null;
  if (value.length <= 4) return '*'.repeat(value.length);
  return `${'*'.repeat(Math.min(value.length - 4, 8))}${value.slice(-4)}`;
}

async function protect(env, token) {
  if (!encryptionKeyConfigured(env)) return token;
  return encryptSecret(env, token);
}

async function reveal(env, stored) {
  const value = String(stored || '').trim();
  if (!value) return '';
  // Stored before a key was configured, or on an install that has none.
  if (!value.startsWith(CIPHERTEXT_PREFIX)) return value;

  try {
    return await decryptSecret(env, value);
  } catch {
    // decryptSecret's message names the Business Profile, because that is what
    // it was written for. Replace it so the page tells the user about the
    // thing they can actually fix here.
    const error = new Error(
      'The WPScan token saved for this project could not be decrypted. It was encrypted with a different key. Enter the token again to replace it.'
    );
    error.status = 400;
    error.code = 'WPSCAN_TOKEN_UNREADABLE';
    throw error;
  }
}

/** The raw column value for one project, or '' when the project has none. */
async function readStored(userId, projectId) {
  const row = await queryOne(
    'SELECT site_token FROM user_projects WHERE user_id = ? AND project_id = ? LIMIT 1',
    [userId, projectId]
  );
  return String(row?.site_token || '').trim();
}

/**
 * The token to call the WPScan API with, and where it came from.
 *
 * A project token wins over the environment token, so a project configured
 * with its own paid token never spends the shared install quota.
 *
 * A project token that cannot be decrypted - the encryption key was rotated or
 * removed - must not silently fall back to the environment token and bill the
 * wrong account, so it surfaces as an error the page can act on.
 */
export async function resolveWpscanToken(env, userId, projectId) {
  let stored = '';
  if (projectId) {
    try {
      stored = await readStored(userId, projectId);
    } catch (cause) {
      // An install that has not run the site_token migration yet still gets
      // the environment token rather than a broken page.
      if (cause?.code !== 'ER_BAD_FIELD_ERROR') throw cause;
      stored = '';
    }
  }

  if (stored) {
    const token = await reveal(env, stored);
    if (token) return { token, source: TOKEN_SOURCE.PROJECT, preview: maskToken(token) };
  }

  const fallback = String(env?.WPSCAN_API_TOKEN || '').trim();
  if (fallback) {
    return { token: fallback, source: TOKEN_SOURCE.ENVIRONMENT, preview: maskToken(fallback) };
  }

  return { token: '', source: TOKEN_SOURCE.NONE, preview: null };
}

/** Saves a token for one project. Returns the masked value for display. */
export async function saveWpscanToken(env, userId, projectId, token) {
  const value = String(token || '').trim();
  if (!value) {
    const error = new Error('Enter a WPScan API token.');
    error.status = 400;
    throw error;
  }
  // WPScan issues opaque alphanumeric tokens. Rejecting whitespace and control
  // characters catches a pasted "Token token=..." header or a copied line
  // break before it becomes a confusing 401 from the API.
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    const error = new Error(
      'That does not look like a WPScan API token. Paste only the token itself, with no "Token token=" prefix.'
    );
    error.status = 400;
    throw error;
  }

  await update(
    'UPDATE user_projects SET site_token = ?, updated_at = NOW() WHERE user_id = ? AND project_id = ?',
    [await protect(env, value), userId, projectId]
  );

  return maskToken(value);
}

/** Removes the project token, so the project falls back to the environment. */
export async function clearWpscanToken(userId, projectId) {
  await update(
    'UPDATE user_projects SET site_token = NULL, updated_at = NOW() WHERE user_id = ? AND project_id = ?',
    [userId, projectId]
  );
}
