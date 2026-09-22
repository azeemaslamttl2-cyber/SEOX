// Outbound HTTP to Jira. The single place in the codebase that calls Jira.
//
// It carries the same three guards google-fetch.js documents, for the same
// reason: this application host has no global IPv6 address and a high RTT to
// some third-party endpoints, so a bare fetch() can fail with ETIMEDOUT
// before it ever completes a handshake. A connect timeout, a bounded retry
// and an error that names its own cause are not optional here.
//
// What is deliberately NOT retried: an HTTP error. A 400 means the payload is
// wrong, a 401 means the credential is wrong and a 404 means the thing is
// gone - repeating any of them just burns the tenant's rate limit. A 429 is
// handled separately, because Jira tells us exactly how long to wait.
//
// Everything here fails closed: if the base URL is not a public https host,
// or the credential cannot be decrypted, no request is made.

import process from 'node:process';
import { decryptWithKey, secretKeyConfigured } from './secret-crypto.js';
import { isBlockedFetchHostname } from './url-security.js';

export const JIRA_KEY_NAME = 'JIRA_TOKEN_ENCRYPTION_KEY';
const CREDENTIAL_LABEL = 'Jira credential';

const DEFAULT_TIMEOUT_MS = 15000;
const INTERACTIVE_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 400;

// Connect-level failures: the request never reached Jira, so replaying it
// cannot double-apply anything.
const RETRYABLE_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EAI_AGAIN',
  'ENOTFOUND',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

const RETRYABLE_STATUSES = new Set([502, 503, 504]);

// Consecutive connect-level failures before the breaker opens, and for how
// long. Without this, a Jira outage plus a full job queue means thousands of
// 15-second timeouts inside the single Node process that also serves the UI -
// which is the one concrete way Jira could degrade SEOX.
const BREAKER_THRESHOLD = 5;
const BREAKER_OPEN_MS = 5 * 60 * 1000;
const breakers = new Map();

export function jiraError(message, status, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

function timeoutFor(env, kind) {
  if (kind === 'interactive') {
    return Number(env?.JIRA_INTERACTIVE_TIMEOUT_MS) || INTERACTIVE_TIMEOUT_MS;
  }
  return Number(env?.JIRA_DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
}

function maxRetriesFor(env) {
  const configured = Number(env?.JIRA_MAX_RETRIES);
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_RETRIES;
}

function insecureBaseUrlAllowed(env) {
  // Never honoured in production, whatever the variable says.
  if (String(env?.NODE_ENV || process.env.NODE_ENV || '') === 'production') return false;
  return String(env?.JIRA_ALLOW_INSECURE_BASE_URL || '') === 'true';
}

/**
 * Validate and canonicalise a Jira base URL.
 *
 * Users paste all sorts of things - a trailing slash, the /rest/api/3 path,
 * a browse URL. Normalising here means the stored value is always the origin
 * and every call site can simply append a path.
 */
export function normalizeJiraBaseUrl(value, env = {}) {
  const raw = String(value || '').trim();
  if (!raw) throw jiraError('A Jira URL is required.', 400);
  if (raw.length > 1000) throw jiraError('The Jira URL is too long.', 400);

  let url;
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    throw jiraError('That is not a valid Jira URL.', 400);
  }

  if (url.username || url.password) {
    throw jiraError('The Jira URL must not contain credentials.', 400);
  }

  const allowInsecure = insecureBaseUrlAllowed(env);
  if (url.protocol !== 'https:' && !allowInsecure) {
    throw jiraError('The Jira URL must use https.', 400);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw jiraError('The Jira URL must use https.', 400);
  }

  // SSRF: the user chooses this host and the server then calls it.
  if (isBlockedFetchHostname(url.hostname) && !allowInsecure) {
    throw jiraError('That Jira URL points at a private or local address.', 400);
  }

  // Keep only the origin plus any context path, dropping a pasted REST path.
  const path = url.pathname.replace(/\/+$/, '').replace(/\/rest(\/.*)?$/i, '').replace(/\/browse(\/.*)?$/i, '');
  return `${url.origin}${path}`;
}

/**
 * Basic auth header for Jira Cloud: base64(email:apiToken).
 * The token never leaves this module in any other form.
 */
function basicAuthHeader(email, apiToken) {
  const raw = `${email}:${apiToken}`;
  const encoded = typeof btoa === 'function'
    ? btoa(unescape(encodeURIComponent(raw)))
    : Buffer.from(raw, 'utf8').toString('base64');
  return `Basic ${encoded}`;
}

export function jiraEncryptionConfigured(env) {
  return secretKeyConfigured(env, JIRA_KEY_NAME);
}

export async function decryptJiraSecret(env, payload) {
  return decryptWithKey(env, JIRA_KEY_NAME, payload, CREDENTIAL_LABEL);
}

function breakerFor(connectionKey) {
  if (!breakers.has(connectionKey)) {
    breakers.set(connectionKey, { failures: 0, openUntil: 0 });
  }
  return breakers.get(connectionKey);
}

export function breakerState(connectionKey) {
  const state = breakers.get(connectionKey);
  if (!state) return { open: false, failures: 0, openUntil: 0 };
  return { open: state.openUntil > Date.now(), failures: state.failures, openUntil: state.openUntil };
}

export function resetBreaker(connectionKey) {
  breakers.delete(connectionKey);
}

function recordSuccess(connectionKey) {
  const state = breakerFor(connectionKey);
  state.failures = 0;
  state.openUntil = 0;
}

function recordConnectFailure(connectionKey) {
  const state = breakerFor(connectionKey);
  state.failures += 1;
  if (state.failures >= BREAKER_THRESHOLD) {
    state.openUntil = Date.now() + BREAKER_OPEN_MS;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeJiraFailure(status, body) {
  // Jira's error shape: { errorMessages: [...], errors: { field: msg } }.
  // The field-keyed form is the only way a user can fix a required custom
  // field, so it is surfaced rather than flattened into a generic message.
  const messages = [];
  if (Array.isArray(body?.errorMessages)) messages.push(...body.errorMessages);
  if (body?.errors && typeof body.errors === 'object') {
    for (const [field, message] of Object.entries(body.errors)) {
      messages.push(`${field}: ${message}`);
    }
  }
  if (!messages.length && typeof body?.message === 'string') messages.push(body.message);
  if (!messages.length) messages.push(`Jira returned ${status}.`);
  return messages.join(' ').slice(0, 500);
}

/**
 * One Jira REST call.
 *
 * @param {object} options
 * @param {object} options.env
 * @param {string} options.baseUrl        already normalised
 * @param {string} options.email
 * @param {string} options.apiToken       plaintext, resolved by the caller
 * @param {string} options.path           e.g. "/rest/api/3/myself"
 * @param {string} [options.method]
 * @param {object} [options.body]
 * @param {object} [options.query]
 * @param {'interactive'|'background'} [options.kind]
 * @param {string} [options.connectionKey] for the circuit breaker
 * @param {Function} [options.fetchImpl]   injected in tests
 */
export async function jiraRequest({
  env = {},
  baseUrl,
  email,
  apiToken,
  path,
  method = 'GET',
  body,
  query,
  kind = 'background',
  connectionKey = 'default',
  fetchImpl,
}) {
  if (!baseUrl) throw jiraError('Jira is not connected.', 409);
  if (!apiToken) throw jiraError('The stored Jira credential is missing. Reconnect Jira.', 401);

  const breaker = breakerState(connectionKey);
  if (breaker.open) {
    throw jiraError(
      'Jira is temporarily unreachable and requests are paused. It will be retried automatically.',
      503,
      { code: 'CIRCUIT_OPEN', retryAfterSeconds: Math.ceil((breaker.openUntil - Date.now()) / 1000) }
    );
  }

  // Re-validate on every call, not only at connect time: a hostname can be
  // re-pointed after it was stored (DNS rebinding).
  const base = normalizeJiraBaseUrl(baseUrl, env);

  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(key, String(item)));
    else url.searchParams.set(key, String(value));
  }

  const doFetch = fetchImpl || fetch;
  const timeoutMs = timeoutFor(env, kind);
  const maxRetries = maxRetriesFor(env);
  const startedAt = Date.now();
  let lastConnectError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await doFetch(url.toString(), {
        method,
        headers: {
          Authorization: basicAuthHeader(email, apiToken),
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
        // Jira does not redirect its REST API; following one would risk
        // replaying the Authorization header to another host.
        redirect: 'manual',
      });
    } catch (cause) {
      clearTimeout(timer);
      const code = cause?.cause?.code || cause?.code;
      const aborted = cause?.name === 'AbortError';
      const retryable = aborted || RETRYABLE_CODES.has(code);
      lastConnectError = cause;

      if (retryable && attempt < maxRetries) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }

      recordConnectFailure(connectionKey);
      throw jiraError(
        aborted ? 'Jira did not respond in time.' : 'Could not reach Jira.',
        aborted ? 504 : 502,
        { code: code || 'NETWORK', cause, durationMs: Date.now() - startedAt, retryable: true }
      );
    }
    clearTimeout(timer);

    if (response.status >= 300 && response.status < 400) {
      recordSuccess(connectionKey);
      throw jiraError(
        'The Jira URL redirected. Check that the Jira base URL is correct.',
        502,
        { httpStatus: response.status }
      );
    }

    const text = await response.text().catch(() => '');
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    if (response.ok) {
      recordSuccess(connectionKey);
      return { data: payload, status: response.status, durationMs: Date.now() - startedAt };
    }

    // 429 is an instruction, not a fault. The caller decides whether to wait.
    if (response.status === 429) {
      recordSuccess(connectionKey);
      const retryAfter = Number(response.headers.get('retry-after')) || 60;
      throw jiraError(
        'Jira rate limit reached. The operation will be retried.',
        429,
        {
          code: 'RATE_LIMITED',
          retryAfterSeconds: Math.min(Math.max(retryAfter, 60), 3600),
          httpStatus: 429,
          durationMs: Date.now() - startedAt,
        }
      );
    }

    if (RETRYABLE_STATUSES.has(response.status) && attempt < maxRetries) {
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
      continue;
    }

    // Jira answered. Do not retry.
    recordSuccess(connectionKey);
    const message = describeJiraFailure(response.status, payload);
    const status = response.status === 401 || response.status === 403
      ? response.status
      : RETRYABLE_STATUSES.has(response.status) ? 502 : 400;

    throw jiraError(message, status, {
      code: response.status === 401 || response.status === 403 ? 'INVALID_CREDENTIALS' : 'JIRA_REJECTED',
      httpStatus: response.status,
      jiraErrors: payload?.errors || null,
      durationMs: Date.now() - startedAt,
      retryable: RETRYABLE_STATUSES.has(response.status),
    });
  }

  recordConnectFailure(connectionKey);
  throw jiraError('Could not reach Jira.', 502, { cause: lastConnectError, retryable: true });
}

/**
 * Same call, with the credential resolved from a stored connection row.
 * Callers should prefer this - it keeps decryption inside this module.
 */
export async function jiraRequestForConnection(env, connection, options = {}) {
  const apiToken = await decryptJiraSecret(env, connection.api_token_encrypted);
  return jiraRequest({
    env,
    baseUrl: connection.base_url,
    email: connection.account_email,
    apiToken,
    connectionKey: `conn:${connection.id}`,
    ...options,
  });
}

/** GET /rest/api/3/myself - the cheapest call that proves a credential works. */
export async function fetchJiraSelf({ env, baseUrl, email, apiToken, fetchImpl }) {
  const { data, durationMs } = await jiraRequest({
    env,
    baseUrl,
    email,
    apiToken,
    path: '/rest/api/3/myself',
    kind: 'interactive',
    connectionKey: `probe:${baseUrl}`,
    fetchImpl,
  });
  return {
    accountId: data?.accountId || null,
    displayName: data?.displayName || null,
    // Deliberately not persisted anywhere; used only to echo back what the
    // user just authenticated as.
    emailAddress: data?.emailAddress || null,
    durationMs,
  };
}
