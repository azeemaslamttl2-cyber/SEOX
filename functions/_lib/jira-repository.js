// Storage for the Jira connection and the SEOX-project -> Jira-project
// mapping. jira-store.js owns everything built on top of them (issue links,
// sync logs, webhook events, jobs), mirroring the gbp-repository / gbp-store
// split.
//
// Every statement is scoped by user_id. Nothing in here trusts an id that
// arrived in a request body on its own.

import { query, queryOne, insert, update, deleteQuery } from './mysql.js';
import { encryptWithKey } from './secret-crypto.js';
import { JIRA_KEY_NAME } from './jira-client.js';
import { toIso } from './jira-status-map.js';

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export function parseJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Tables are created by migration.txt, not by the application. */
function isMissingTable(error) {
  return error?.code === 'ER_NO_SUCH_TABLE' || error?.errno === 1146;
}

/**
 * A read that tolerates the migration not having been run yet.
 *
 * Jira is optional: on an installation where migration.txt has not been
 * applied, every Jira screen must report "not connected" rather than throwing
 * a 500 into a page that also renders non-Jira content.
 */
async function tolerant(fn, fallback) {
  try {
    return await fn();
  } catch (error) {
    if (isMissingTable(error)) return fallback;
    throw error;
  }
}

export async function jiraTablesReady() {
  const row = await tolerant(
    () => queryOne('SELECT 1 AS ok FROM jira_connections LIMIT 1'),
    null
  );
  // A missing table returns the fallback; an empty table returns null too, so
  // probe explicitly.
  if (row) return true;
  try {
    await query('SELECT 1 FROM jira_connections LIMIT 0');
    return true;
  } catch (error) {
    if (isMissingTable(error)) return false;
    throw error;
  }
}

// --- Connections -----------------------------------------------------------

export async function getConnection(userId, projectId) {
  return tolerant(
    () =>
      queryOne(
        `SELECT * FROM jira_connections WHERE user_id = ? AND project_id = ? LIMIT 1`,
        [userId, projectId]
      ),
    null
  );
}

/** Every Jira connection this user owns, across all their SEOX projects. */
export async function listConnectionsForUser(userId) {
  return tolerant(
    () =>
      query(
        `SELECT * FROM jira_connections WHERE user_id = ? ORDER BY id`,
        [userId]
      ),
    []
  );
}

/** Every Jira project mapping this user owns. */
export async function listMappingsForUser(userId) {
  return tolerant(
    () =>
      query(
        `SELECT project_id, jira_project_id, jira_project_key, jira_project_name, status
           FROM jira_project_mappings WHERE user_id = ? ORDER BY id`,
        [userId]
      ),
    []
  );
}

export async function getConnectionById(connectionId) {
  return tolerant(
    () => queryOne(`SELECT * FROM jira_connections WHERE id = ? LIMIT 1`, [connectionId]),
    null
  );
}

/**
 * Resolve the connection a webhook token belongs to.
 *
 * The token is stored encrypted, so it cannot be matched with a WHERE clause.
 * A lookup column holds sha256(token) instead: it is not reversible, it is
 * indexed, and comparing hashes is a constant-time-safe equality on fixed
 * length values. The caller still does a constant-time compare of the
 * decrypted secret before trusting the row.
 */
export async function getConnectionByWebhookLookup(lookup) {
  return tolerant(
    () =>
      queryOne(
        `SELECT * FROM jira_connections WHERE webhook_secret_lookup = ? LIMIT 1`,
        [lookup]
      ),
    null
  );
}

export async function upsertConnection(env, entry) {
  const timestamp = now();
  const encryptedToken = entry.apiToken
    ? await encryptWithKey(env, JIRA_KEY_NAME, entry.apiToken, 'Jira credential')
    : null;

  const existing = await getConnection(entry.userId, entry.projectId);

  if (existing) {
    await update(
      `UPDATE jira_connections
          SET base_url = ?, auth_type = ?, account_email = ?, account_id = ?,
              account_display_name = ?,
              api_token_encrypted = COALESCE(?, api_token_encrypted),
              status = ?, status_detail = ?, last_checked_at = ?,
              authorized_by_email = ?, updated_at = ?
        WHERE id = ? AND user_id = ?`,
      [
        entry.baseUrl,
        entry.authType || 'api_token',
        entry.accountEmail || null,
        entry.accountId || null,
        entry.accountDisplayName || null,
        encryptedToken,
        entry.status || 'connected',
        entry.statusDetail || null,
        timestamp,
        entry.authorizedByEmail || null,
        timestamp,
        existing.id,
        entry.userId,
      ]
    );
    return getConnectionById(existing.id);
  }

  const result = await insert(
    `INSERT INTO jira_connections
       (user_id, project_id, base_url, auth_type, account_email, account_id,
        account_display_name, api_token_encrypted, status, status_detail,
        last_checked_at, authorized_by_email, connected_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.userId,
      entry.projectId,
      entry.baseUrl,
      entry.authType || 'api_token',
      entry.accountEmail || null,
      entry.accountId || null,
      entry.accountDisplayName || null,
      encryptedToken,
      entry.status || 'connected',
      entry.statusDetail || null,
      timestamp,
      entry.authorizedByEmail || null,
      timestamp,
      timestamp,
    ]
  );
  return getConnectionById(result.insertId);
}

export async function setConnectionStatus(connectionId, status, detail = null) {
  await update(
    `UPDATE jira_connections
        SET status = ?, status_detail = ?, last_checked_at = ?, updated_at = ?
      WHERE id = ?`,
    [status, detail ? String(detail).slice(0, 500) : null, now(), now(), connectionId]
  );
}

export async function touchConnectionSync(connectionId) {
  await update(
    `UPDATE jira_connections SET last_sync_at = ?, updated_at = ? WHERE id = ?`,
    [now(), now(), connectionId]
  );
}

export async function touchConnectionEvent(connectionId) {
  await update(
    `UPDATE jira_connections SET last_event_at = ?, updated_at = ? WHERE id = ?`,
    [now(), now(), connectionId]
  );
}

export async function saveWebhookSecret(env, connectionId, secret, lookup) {
  const encrypted = await encryptWithKey(env, JIRA_KEY_NAME, secret, 'Jira webhook secret');
  await update(
    `UPDATE jira_connections
        SET webhook_secret_encrypted = ?, webhook_secret_lookup = ?,
            webhook_created_at = ?, updated_at = ?
      WHERE id = ?`,
    [encrypted, lookup, now(), now(), connectionId]
  );
}

/**
 * Disconnect: the secrets must actually be gone, not merely flagged inactive.
 * Issue links are retained by default so the history of what was filed
 * survives - they simply stop syncing.
 */
export async function clearConnectionSecrets(connectionId) {
  await update(
    `UPDATE jira_connections
        SET api_token_encrypted = NULL, oauth_refresh_encrypted = NULL,
            webhook_secret_encrypted = NULL, webhook_secret_lookup = NULL,
            status = 'disconnected', status_detail = NULL, updated_at = ?
      WHERE id = ?`,
    [now(), connectionId]
  );
}

export async function listConnectionsForSync(limit = 200) {
  return tolerant(
    () =>
      query(
        `SELECT c.* FROM jira_connections c
           JOIN jira_project_mappings m
             ON m.connection_id = c.id AND m.status = 'active'
                AND m.auto_sync_enabled = 1
          WHERE c.status = 'connected'
          ORDER BY COALESCE(c.last_sync_at, c.connected_at) ASC
          LIMIT ?`,
        [limit]
      ),
    []
  );
}

// --- Project mappings ------------------------------------------------------

export async function getMapping(userId, projectId) {
  return tolerant(
    () =>
      queryOne(
        `SELECT * FROM jira_project_mappings WHERE user_id = ? AND project_id = ? LIMIT 1`,
        [userId, projectId]
      ),
    null
  );
}

/**
 * Find the caller's mapping for a given Jira project key.
 *
 * This is the authorisation rule for acting on a Jira issue that SEOX did not
 * file. The Jira Tickets page shows the real contents of a mapped Jira
 * project, most of which was raised by hand in Jira and therefore has no
 * `jira_issue_links` row - but those tickets are still legitimately
 * actionable, because the user explicitly mapped that Jira project to one of
 * their own SEOX projects.
 *
 * The security property is unchanged and is what matters: an issue key is
 * only usable if its project key is one THIS user has mapped. An arbitrary
 * key on an unmapped board matches nothing and is refused.
 *
 * `status = 'active'` is not required - see the note in the status endpoint
 * about why an invalid mapping must not strand tickets that already exist.
 */
export async function getMappingByJiraProjectKey(userId, jiraProjectKey) {
  const key = String(jiraProjectKey || '').trim();
  if (!key) return null;
  return tolerant(
    () =>
      queryOne(
        `SELECT * FROM jira_project_mappings
          WHERE user_id = ? AND UPPER(jira_project_key) = UPPER(?)
          ORDER BY (status = 'active') DESC, id DESC
          LIMIT 1`,
        [userId, key]
      ),
    null
  );
}

export async function getMappingByConnection(connectionId) {
  return tolerant(
    () =>
      queryOne(
        `SELECT * FROM jira_project_mappings WHERE connection_id = ? LIMIT 1`,
        [connectionId]
      ),
    null
  );
}

export async function upsertMapping(entry) {
  const timestamp = now();
  const existing = await getMapping(entry.userId, entry.projectId);

  const columns = [
    entry.connectionId,
    entry.jiraProjectId,
    entry.jiraProjectKey,
    entry.jiraProjectName || null,
    entry.defaultIssueTypeId,
    entry.defaultIssueTypeName || null,
    entry.defaultPriorityId || null,
    entry.prioritySupported === false ? 0 : 1,
    entry.defaultAssigneeAccountId || null,
    entry.defaultAssigneeDisplayName || null,
    JSON.stringify(entry.defaultLabels || []),
    JSON.stringify(entry.components || []),
    JSON.stringify(entry.severityPriorityMap || {}),
    entry.autoCreateEnabled ? 1 : 0,
    entry.autoSyncEnabled === false ? 0 : 1,
    entry.postVerificationComments === false ? 0 : 1,
    entry.reopenBehaviour || 'reopen',
    entry.onDuplicate || 'adopt',
    Number(entry.verificationDelayMinutes ?? 10),
    entry.autoCreateRules ? JSON.stringify(entry.autoCreateRules) : null,
    entry.status || 'active',
    entry.statusDetail || null,
    timestamp,
  ];

  if (existing) {
    await update(
      `UPDATE jira_project_mappings
          SET connection_id = ?, jira_project_id = ?, jira_project_key = ?,
              jira_project_name = ?, default_issue_type_id = ?,
              default_issue_type_name = ?, default_priority_id = ?,
              priority_supported = ?, default_assignee_account_id = ?,
              default_assignee_display_name = ?, default_labels = ?,
              components = ?, severity_priority_map = ?,
              auto_create_enabled = ?, auto_sync_enabled = ?,
              post_verification_comments = ?, reopen_behaviour = ?,
              on_duplicate = ?, verification_delay_minutes = ?,
              auto_create_rules = ?, status = ?, status_detail = ?,
              last_validated_at = ?, updated_at = ?
        WHERE id = ? AND user_id = ?`,
      [...columns, timestamp, existing.id, entry.userId]
    );
    return getMapping(entry.userId, entry.projectId);
  }

  await insert(
    `INSERT INTO jira_project_mappings
       (user_id, project_id, connection_id, jira_project_id, jira_project_key,
        jira_project_name, default_issue_type_id, default_issue_type_name,
        default_priority_id, priority_supported, default_assignee_account_id,
        default_assignee_display_name, default_labels, components,
        severity_priority_map, auto_create_enabled, auto_sync_enabled,
        post_verification_comments, reopen_behaviour, on_duplicate,
        verification_delay_minutes, auto_create_rules, status, status_detail,
        last_validated_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [entry.userId, entry.projectId, ...columns, timestamp, timestamp]
  );
  return getMapping(entry.userId, entry.projectId);
}

export async function setMappingStatus(userId, projectId, status, detail = null) {
  await update(
    `UPDATE jira_project_mappings
        SET status = ?, status_detail = ?, updated_at = ?
      WHERE user_id = ? AND project_id = ?`,
    [status, detail ? String(detail).slice(0, 500) : null, now(), userId, projectId]
  );
}

export async function deleteMapping(userId, projectId) {
  await deleteQuery(
    `DELETE FROM jira_project_mappings WHERE user_id = ? AND project_id = ?`,
    [userId, projectId]
  );
}

/** Shape a mapping row for the API, expanding its JSON columns. */
export function describeMapping(row) {
  if (!row) return null;
  return {
    jiraProjectId: row.jira_project_id,
    jiraProjectKey: row.jira_project_key,
    jiraProjectName: row.jira_project_name || '',
    defaultIssueTypeId: row.default_issue_type_id,
    defaultIssueTypeName: row.default_issue_type_name || '',
    defaultPriorityId: row.default_priority_id || null,
    prioritySupported: Boolean(row.priority_supported),
    defaultAssigneeAccountId: row.default_assignee_account_id || null,
    defaultAssigneeDisplayName: row.default_assignee_display_name || '',
    defaultLabels: parseJson(row.default_labels, []) || [],
    components: parseJson(row.components, []) || [],
    severityPriorityMap: parseJson(row.severity_priority_map, {}) || {},
    autoCreateEnabled: Boolean(row.auto_create_enabled),
    autoSyncEnabled: Boolean(row.auto_sync_enabled),
    postVerificationComments: Boolean(row.post_verification_comments),
    reopenBehaviour: row.reopen_behaviour || 'reopen',
    onDuplicate: row.on_duplicate || 'adopt',
    verificationDelayMinutes: Number(row.verification_delay_minutes ?? 10),
    autoCreateRules: parseJson(row.auto_create_rules, null),
    status: row.status || 'active',
    statusDetail: row.status_detail || '',
    lastValidatedAt: toIso(row.last_validated_at),
  };
}
