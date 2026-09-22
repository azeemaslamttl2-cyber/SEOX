// POST /api/jira/connect
//   connect                    validate credentials and store them
//   test                       re-verify the stored credential
//   disconnect                 remove the credential
//   regenerate-webhook-secret  rotate the webhook URL
//
// Session-authenticated (Authorization: Bearer <jwt>), scoped to a project
// the caller owns. The API token is validated against Jira BEFORE it is
// stored - an unverified credential is never persisted - and is never
// returned to the browser afterwards, in whole or in part.

import { randomBytes, createHash } from 'node:crypto';
import { configureMysqlConnection } from '../../_lib/mysql.js';
import {
  corsHeaders,
  emptyResponse,
  errorResponse,
  jsonResponse,
  readJson,
} from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { consumeRateLimit } from '../../_lib/rate-limit.js';
import { requireJiraProject, resolveAppUrl, httpError } from '../../_lib/jira-request.js';
import {
  clearConnectionSecrets,
  getConnection,
  jiraTablesReady,
  saveWebhookSecret,
  setConnectionStatus,
  setMappingStatus,
  upsertConnection,
} from '../../_lib/jira-repository.js';
import { cancelProjectJobs, logSync } from '../../_lib/jira-store.js';
import { toIso } from '../../_lib/jira-status-map.js';
import {
  fetchJiraSelf,
  jiraEncryptionConfigured,
  normalizeJiraBaseUrl,
  resetBreaker,
  decryptJiraSecret,
} from '../../_lib/jira-client.js';

const MAX_TOKEN_LENGTH = 1024;

function requireEncryption(env) {
  if (!jiraEncryptionConfigured(env)) {
    throw httpError(
      'Jira integration is not configured on this server. Ask an administrator to set JIRA_TOKEN_ENCRYPTION_KEY.',
      500,
      { code: 'NOT_CONFIGURED' }
    );
  }
}

function newWebhookSecret() {
  return randomBytes(32).toString('hex');
}

/**
 * The secret is stored encrypted, so it cannot be matched in a WHERE clause.
 * A non-reversible lookup hash is stored beside it purely so the webhook can
 * find its connection in one indexed read.
 */
export function webhookLookup(secret) {
  return createHash('sha256').update(String(secret), 'utf8').digest('hex');
}

function webhookUrl(appUrl, secret) {
  if (!appUrl || !secret) return '';
  return `${String(appUrl).replace(/\/+$/, '')}/api/jira/webhook?t=${secret}`;
}

async function handleConnect({ env, request, user, body }) {
  requireEncryption(env);

  // Reads degrade to "not connected" when the migration has not been run, but
  // a write cannot - and a bare ER_NO_SUCH_TABLE reaching the user as a 500
  // tells them nothing about what to do. Check once, up front, and say it.
  if (!(await jiraTablesReady())) {
    throw httpError(
      'The Jira database tables do not exist yet. Apply the Jira section of migration.txt, then connect again.',
      503,
      { code: 'MIGRATION_PENDING' }
    );
  }

  await consumeRateLimit(user.id, 'jira:connect');

  const project = await requireJiraProject(user.id, body.projectId);

  const baseUrl = normalizeJiraBaseUrl(body.baseUrl, env);
  const email = String(body.email || '').trim();
  const apiToken = String(body.apiToken || '').trim();

  if (!email || email.length > 255 || !email.includes('@')) {
    throw httpError('A valid Jira account email is required.', 400);
  }
  if (!apiToken) throw httpError('A Jira API token is required.', 400);
  if (apiToken.length > MAX_TOKEN_LENGTH) throw httpError('That Jira API token is not valid.', 400);

  const started = Date.now();
  let self;
  try {
    self = await fetchJiraSelf({ env, baseUrl, email, apiToken });
  } catch (error) {
    // Nothing is persisted on a failed validation: an unverified credential
    // in the database is worse than no credential.
    await logSync({
      userId: user.id,
      projectId: project.project_id,
      action: 'connection.connect',
      result: 'error',
      message: error?.message,
      httpStatus: error?.httpStatus || error?.status,
      durationMs: Date.now() - started,
      actorEmail: user.email,
      actorKind: 'user',
    });
    if (error?.status === 401 || error?.status === 403) {
      throw httpError('Jira rejected those credentials. Check the email address and API token.', 401);
    }
    throw error;
  }

  const connection = await upsertConnection(env, {
    userId: user.id,
    projectId: project.project_id,
    baseUrl,
    authType: 'api_token',
    accountEmail: email,
    accountId: self.accountId,
    accountDisplayName: self.displayName,
    apiToken,
    status: 'connected',
    statusDetail: null,
    authorizedByEmail: user.email,
  });

  resetBreaker(`conn:${connection.id}`);

  // Generate the webhook secret on first connect so the settings panel can
  // show the URL immediately.
  let secret = null;
  if (!connection.webhook_secret_encrypted) {
    secret = newWebhookSecret();
    await saveWebhookSecret(env, connection.id, secret, webhookLookup(secret));
  }

  await logSync({
    userId: user.id,
    projectId: project.project_id,
    action: 'connection.connect',
    result: 'success',
    message: `Connected to ${baseUrl} as ${self.displayName || email}.`,
    durationMs: Date.now() - started,
    actorEmail: user.email,
    actorKind: 'user',
  });

  return {
    connected: true,
    baseUrl,
    accountId: self.accountId,
    accountEmail: email,
    accountDisplayName: self.displayName,
    status: 'connected',
    connectedAt: toIso(connection.connected_at) || null,
    // Returned in full here and on regenerate only; every other read masks it.
    webhookUrl: secret ? webhookUrl(resolveAppUrl(env, request), secret) : null,
  };
}

async function handleTest({ env, user, body }) {
  await consumeRateLimit(user.id, 'jira:test');
  const project = await requireJiraProject(user.id, body.projectId);

  const connection = await getConnection(user.id, project.project_id);
  if (!connection || !connection.api_token_encrypted) {
    return { ok: false, status: 'not_connected', detail: 'Jira is not connected.' };
  }

  const started = Date.now();
  try {
    const apiToken = await decryptJiraSecret(env, connection.api_token_encrypted);
    const self = await fetchJiraSelf({
      env,
      baseUrl: connection.base_url,
      email: connection.account_email,
      apiToken,
    });
    await setConnectionStatus(connection.id, 'connected', null);
    resetBreaker(`conn:${connection.id}`);

    await logSync({
      userId: user.id,
      projectId: project.project_id,
      action: 'connection.test',
      result: 'success',
      message: 'Connection verified.',
      durationMs: Date.now() - started,
      actorEmail: user.email,
      actorKind: 'user',
    });

    return {
      ok: true,
      accountDisplayName: self.displayName,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    // A failed test is a RESULT, not an HTTP error - the UI wants to render
    // it in the connection card, not as a page-level failure.
    const invalid = error?.status === 401 || error?.status === 403;
    await setConnectionStatus(
      connection.id,
      invalid ? 'invalid_credentials' : 'error',
      error?.message
    );

    await logSync({
      userId: user.id,
      projectId: project.project_id,
      action: 'connection.test',
      result: 'error',
      message: error?.message,
      httpStatus: error?.httpStatus || error?.status,
      durationMs: Date.now() - started,
      actorEmail: user.email,
      actorKind: 'user',
    });

    return {
      ok: false,
      status: invalid ? 'invalid_credentials' : 'unreachable',
      detail: invalid
        ? 'Jira rejected the stored credentials. Reconnect Jira with a current API token.'
        : error?.message || 'Jira could not be reached.',
      checkedAt: new Date().toISOString(),
    };
  }
}

async function handleDisconnect({ env, user, body }) {
  const project = await requireJiraProject(user.id, body.projectId);
  const connection = await getConnection(user.id, project.project_id);
  if (!connection) return { disconnected: true, linksRetained: 0 };

  await clearConnectionSecrets(connection.id);
  await setMappingStatus(user.id, project.project_id, 'disabled', 'Jira was disconnected.');
  const cancelledJobs = await cancelProjectJobs(user.id, project.project_id);
  resetBreaker(`conn:${connection.id}`);

  // Issue links are deliberately kept: they are the record of what was filed
  // and when it was verified. They simply stop syncing. SEOX also never
  // deletes the Jira webhook - it cannot know who created it, and the
  // now-invalid secret makes it harmless either way.
  await logSync({
    userId: user.id,
    projectId: project.project_id,
    action: 'connection.disconnect',
    result: 'success',
    message: 'Jira credentials removed. Existing issue links were kept.',
    actorEmail: user.email,
    actorKind: 'user',
    context: { cancelledJobs },
  });

  return { disconnected: true, cancelledJobs };
}

async function handleRegenerate({ env, request, user, body }) {
  requireEncryption(env);
  const project = await requireJiraProject(user.id, body.projectId);
  const connection = await getConnection(user.id, project.project_id);
  if (!connection) throw httpError('Jira is not connected.', 409);

  const secret = newWebhookSecret();
  await saveWebhookSecret(env, connection.id, secret, webhookLookup(secret));

  await logSync({
    userId: user.id,
    projectId: project.project_id,
    action: 'connection.rotate',
    result: 'success',
    message: 'The Jira webhook secret was regenerated. The previous webhook URL no longer works.',
    actorEmail: user.email,
    actorKind: 'user',
  });

  return { webhookUrl: webhookUrl(resolveAppUrl(env, request), secret) };
}

export async function onRequest({ request, env }) {
  const headers = {
    ...corsHeaders('POST, OPTIONS'),
    'Cache-Control': 'no-store',
  };

  if (request.method === 'OPTIONS') return emptyResponse(204, headers);
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, headers);
  }

  try {
    configureMysqlConnection(env);
    const user = await verifyAccessToken(request, env);
    const body = await readJson(request);
    const action = String(body?.action || 'connect');

    switch (action) {
      case 'connect':
        return jsonResponse(await handleConnect({ env, request, user, body }), 200, headers);
      case 'test':
        return jsonResponse(await handleTest({ env, user, body }), 200, headers);
      case 'disconnect':
        return jsonResponse(await handleDisconnect({ env, user, body }), 200, headers);
      case 'regenerate-webhook-secret':
        return jsonResponse(await handleRegenerate({ env, request, user, body }), 200, headers);
      default:
        return jsonResponse({ error: 'Invalid action' }, 400, headers);
    }
  } catch (error) {
    return errorResponse(error, headers);
  }
}
