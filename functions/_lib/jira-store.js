// Storage for everything built on top of a Jira connection: the finding ->
// issue links, the activity log, the webhook inbox and the job queue.
//
// The claim / retry / dead-letter shape of the job helpers is deliberately
// the same as gbp-store.js, so operators have one model to understand and
// the runner logic could be lifted almost unchanged.

import { query, queryOne, insert, update, deleteQuery } from './mysql.js';

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

function isMissingTable(error) {
  return error?.code === 'ER_NO_SUCH_TABLE' || error?.errno === 1146;
}

export function isDuplicateKey(error) {
  return (
    error?.code === 'ER_DUP_ENTRY' ||
    error?.errno === 1062 ||
    /duplicate entry/i.test(String(error?.message || ''))
  );
}

async function tolerant(fn, fallback) {
  try {
    return await fn();
  } catch (error) {
    if (isMissingTable(error)) return fallback;
    throw error;
  }
}

// --- Issue links -----------------------------------------------------------

export async function getLinkByFingerprint(userId, fingerprint) {
  return tolerant(
    () =>
      queryOne(
        `SELECT * FROM jira_issue_links WHERE user_id = ? AND fingerprint = ? LIMIT 1`,
        [userId, fingerprint]
      ),
    null
  );
}

export async function getLinkById(userId, linkId) {
  // user_id in the WHERE clause is not optional: link ids are sequential
  // bigints, so without it this is a trivial IDOR.
  return tolerant(
    () => queryOne(`SELECT * FROM jira_issue_links WHERE id = ? AND user_id = ? LIMIT 1`, [linkId, userId]),
    null
  );
}

export async function getLinkByIssueId(connectionId, jiraIssueId) {
  return tolerant(
    () =>
      queryOne(
        `SELECT * FROM jira_issue_links WHERE connection_id = ? AND jira_issue_id = ? LIMIT 1`,
        [connectionId, jiraIssueId]
      ),
    null
  );
}

export async function getLinkByIssueKey(connectionId, jiraIssueKey) {
  return tolerant(
    () =>
      queryOne(
        `SELECT * FROM jira_issue_links WHERE connection_id = ? AND jira_issue_key = ? LIMIT 1`,
        [connectionId, jiraIssueKey]
      ),
    null
  );
}

export async function listLinks(userId, projectId, { states, limit = 500 } = {}) {
  const clauses = ['user_id = ?', 'project_id = ?'];
  const params = [userId, projectId];
  if (Array.isArray(states) && states.length) {
    clauses.push(`seox_state IN (${states.map(() => '?').join(',')})`);
    params.push(...states);
  }
  params.push(Number(limit));
  return tolerant(
    () =>
      query(
        `SELECT * FROM jira_issue_links
          WHERE ${clauses.join(' AND ')}
          ORDER BY updated_at DESC
          LIMIT ?`,
        params
      ),
    []
  );
}

export async function listLinksByFingerprints(userId, projectId, fingerprints) {
  if (!fingerprints?.length) return [];
  const placeholders = fingerprints.map(() => '?').join(',');
  return tolerant(
    () =>
      query(
        `SELECT * FROM jira_issue_links
          WHERE user_id = ? AND project_id = ? AND fingerprint IN (${placeholders})`,
        [userId, projectId, ...fingerprints]
      ),
    []
  );
}

export async function countLinksByState(userId, projectId) {
  const rows = await tolerant(
    () =>
      query(
        `SELECT seox_state, state, COUNT(*) AS total
           FROM jira_issue_links
          WHERE user_id = ? AND project_id = ?
          GROUP BY seox_state, state`,
        [userId, projectId]
      ),
    []
  );

  const counts = {
    linked: 0,
    open: 0,
    in_progress: 0,
    resolved_pending: 0,
    verified: 0,
    reopened: 0,
    wont_fix: 0,
    unlinked: 0,
    failed: 0,
  };

  for (const row of rows) {
    const total = Number(row.total || 0);
    if (row.state === 'failed') counts.failed += total;
    if (row.state === 'linked') counts.linked += total;
    if (row.state === 'linked' && counts[row.seox_state] !== undefined) {
      counts[row.seox_state] += total;
    }
  }
  return counts;
}

/**
 * Reserve the fingerprint before calling Jira.
 *
 * The UNIQUE index on (user_id, fingerprint) is what actually prevents
 * duplicates: two concurrent creates race here, one wins and the other gets
 * ER_DUP_ENTRY, which the caller treats as "already linked" rather than as a
 * failure. Application-level checking alone cannot give that guarantee.
 */
export async function reserveLink(entry) {
  const timestamp = now();
  const result = await insert(
    `INSERT INTO jira_issue_links
       (user_id, project_id, connection_id, fingerprint, source_module,
        finding_type, scope_kind, scope_key, scope_key_hash, finding_title,
        severity, affected_url, affected_url_count, finding_snapshot,
        verification_spec, state, seox_state, created_by, creation_mode,
        ai_used, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'creating', 'open', ?, ?, ?, ?, ?)`,
    [
      entry.userId,
      entry.projectId,
      entry.connectionId,
      entry.fingerprint,
      entry.sourceModule,
      entry.findingType,
      entry.scopeKind,
      String(entry.scopeKey).slice(0, 1024),
      entry.scopeKeyHash,
      String(entry.findingTitle || '').slice(0, 500),
      entry.severity || 'warning',
      entry.affectedUrl ? String(entry.affectedUrl).slice(0, 2048) : null,
      Number(entry.affectedUrlCount || 1),
      entry.findingSnapshot ? JSON.stringify(entry.findingSnapshot) : null,
      entry.verificationSpec ? JSON.stringify(entry.verificationSpec) : null,
      entry.createdBy || null,
      entry.creationMode || 'manual',
      entry.aiUsed ? 1 : 0,
      timestamp,
      timestamp,
    ]
  );
  return result.insertId;
}

/** Re-arm a row that previously failed, or that the user detached. */
export async function reuseLink(linkId, entry) {
  await update(
    `UPDATE jira_issue_links
        SET state = 'creating', seox_state = 'open', last_error = NULL,
            finding_title = ?, severity = ?, affected_url = ?,
            affected_url_count = ?, finding_snapshot = ?, verification_spec = ?,
            created_by = ?, creation_mode = ?, ai_used = ?, updated_at = ?
      WHERE id = ?`,
    [
      String(entry.findingTitle || '').slice(0, 500),
      entry.severity || 'warning',
      entry.affectedUrl ? String(entry.affectedUrl).slice(0, 2048) : null,
      Number(entry.affectedUrlCount || 1),
      entry.findingSnapshot ? JSON.stringify(entry.findingSnapshot) : null,
      entry.verificationSpec ? JSON.stringify(entry.verificationSpec) : null,
      entry.createdBy || null,
      entry.creationMode || 'manual',
      entry.aiUsed ? 1 : 0,
      now(),
      linkId,
    ]
  );
}

export async function markLinkCreated(linkId, issue) {
  await update(
    `UPDATE jira_issue_links
        SET state = 'linked', seox_state = 'open', jira_issue_id = ?,
            jira_issue_key = ?, jira_issue_url = ?, jira_status = ?,
            jira_status_category = ?, jira_priority = ?, jira_assignee_id = ?,
            jira_assignee_name = ?, remote_created_at = ?, remote_updated_at = ?,
            last_error = NULL, last_synced_at = ?, updated_at = ?
      WHERE id = ?`,
    [
      issue.id,
      issue.key,
      issue.url || null,
      issue.status || null,
      issue.statusCategory || null,
      issue.priority || null,
      issue.assigneeId || null,
      issue.assigneeName || null,
      issue.remoteCreatedAt || null,
      issue.remoteUpdatedAt || null,
      now(),
      now(),
      linkId,
    ]
  );
}

export async function markLinkFailed(linkId, message) {
  await update(
    `UPDATE jira_issue_links
        SET state = 'failed', last_error = ?, updated_at = ?
      WHERE id = ?`,
    [message ? String(message).slice(0, 1000) : null, now(), linkId]
  );
}

export async function applyRemoteState(linkId, remote) {
  await update(
    `UPDATE jira_issue_links
        SET jira_status = ?, jira_status_category = ?, jira_resolution = ?,
            jira_priority = ?, jira_assignee_id = ?, jira_assignee_name = ?,
            seox_state = ?, remote_updated_at = ?, last_synced_at = ?,
            last_error = NULL, updated_at = ?
      WHERE id = ?`,
    [
      remote.status || null,
      remote.statusCategory || null,
      remote.resolution || null,
      remote.priority || null,
      remote.assigneeId || null,
      remote.assigneeName || null,
      remote.seoxState,
      remote.remoteUpdatedAt || null,
      now(),
      now(),
      linkId,
    ]
  );
}

export async function setLinkSeoxState(linkId, seoxState, extra = {}) {
  const fields = ['seox_state = ?', 'updated_at = ?'];
  const params = [seoxState, now()];

  if (extra.verifiedAt !== undefined) {
    fields.push('verified_at = ?');
    params.push(extra.verifiedAt);
  }
  if (extra.verificationResult !== undefined) {
    fields.push('verification_result = ?');
    params.push(extra.verificationResult ? JSON.stringify(extra.verificationResult) : null);
  }
  if (extra.incrementReopened) fields.push('reopened_count = reopened_count + 1');
  if (extra.incrementVerificationAttempts) {
    fields.push('verification_attempts = verification_attempts + 1');
  }
  if (extra.resetVerificationAttempts) fields.push('verification_attempts = 0');

  params.push(linkId);
  await update(`UPDATE jira_issue_links SET ${fields.join(', ')} WHERE id = ?`, params);
}

export async function unlinkLink(userId, linkId) {
  await update(
    `UPDATE jira_issue_links
        SET state = 'unlinked', seox_state = 'unlinked', updated_at = ?
      WHERE id = ? AND user_id = ?`,
    [now(), linkId, userId]
  );
}

export async function markLinkOrphaned(linkId) {
  await update(
    `UPDATE jira_issue_links SET state = 'orphaned', updated_at = ? WHERE id = ?`,
    [now(), linkId]
  );
}

export async function pushPreviousIssueKey(linkId, issueKey) {
  const row = await queryOne(
    'SELECT previous_issue_keys FROM jira_issue_links WHERE id = ? LIMIT 1',
    [linkId]
  );
  const keys = parseJson(row?.previous_issue_keys, []) || [];
  if (issueKey && !keys.includes(issueKey)) keys.push(issueKey);
  await update(
    `UPDATE jira_issue_links SET previous_issue_keys = ?, updated_at = ? WHERE id = ?`,
    [JSON.stringify(keys.slice(-20)), now(), linkId]
  );
}

export async function saveLatestComment(linkId, comment, commentCount) {
  await update(
    `UPDATE jira_issue_links SET last_comment = ?, comment_count = ?, updated_at = ? WHERE id = ?`,
    [comment ? JSON.stringify(comment) : null, Number(commentCount || 0), now(), linkId]
  );
}

/** Links a reconcile sweep should look at. */
export async function linksNeedingSync(userId, projectId, limit = 500) {
  return tolerant(
    () =>
      query(
        `SELECT * FROM jira_issue_links
          WHERE user_id = ? AND project_id = ? AND state = 'linked'
            AND seox_state IN ('open','in_progress','resolved_pending','reopened')
          ORDER BY COALESCE(last_synced_at, created_at) ASC
          LIMIT ?`,
        [userId, projectId, limit]
      ),
    []
  );
}

export async function countAutoCreatedSince(userId, projectId, sinceSql) {
  const row = await tolerant(
    () =>
      queryOne(
        `SELECT COUNT(*) AS total FROM jira_issue_links
          WHERE user_id = ? AND project_id = ? AND creation_mode = 'auto'
            AND created_at >= ?`,
        [userId, projectId, sinceSql]
      ),
    { total: 0 }
  );
  return Number(row?.total || 0);
}

// --- Sync logs -------------------------------------------------------------

/**
 * Append-only activity and audit trail.
 *
 * Never pass a credential, a token or a webhook URL in `message` or
 * `context`. Logging is best-effort: a logging failure must never fail the
 * operation being logged.
 */
export async function logSync(entry) {
  try {
    await insert(
      `INSERT INTO jira_sync_logs
         (user_id, project_id, link_id, action, direction, result,
          jira_issue_key, message, http_status, duration_ms, actor_email,
          actor_kind, context, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId,
        entry.projectId || null,
        entry.linkId || null,
        entry.action,
        entry.direction || 'outbound',
        entry.result || 'success',
        entry.jiraIssueKey || null,
        entry.message ? String(entry.message).slice(0, 1000) : null,
        entry.httpStatus || null,
        entry.durationMs || null,
        entry.actorEmail || null,
        entry.actorKind || 'system',
        entry.context ? JSON.stringify(entry.context) : null,
        now(),
      ]
    );
  } catch (error) {
    if (!isMissingTable(error)) {
      console.error('jira_sync_logs write failed:', error?.message || error);
    }
  }
}

export async function listSyncLogs(userId, { projectId, linkId, limit = 50, result } = {}) {
  const clauses = ['user_id = ?'];
  const params = [userId];
  if (projectId) {
    clauses.push('project_id = ?');
    params.push(projectId);
  }
  if (linkId) {
    clauses.push('link_id = ?');
    params.push(linkId);
  }
  if (result) {
    clauses.push('result = ?');
    params.push(result);
  }
  params.push(Number(limit));
  return tolerant(
    () =>
      query(
        `SELECT * FROM jira_sync_logs
          WHERE ${clauses.join(' AND ')}
          ORDER BY created_at DESC, id DESC
          LIMIT ?`,
        params
      ),
    []
  );
}

export async function countSyncErrors(userId, projectId, sinceSql) {
  const row = await tolerant(
    () =>
      queryOne(
        `SELECT COUNT(*) AS total FROM jira_sync_logs
          WHERE user_id = ? AND project_id = ? AND result = 'error' AND created_at >= ?`,
        [userId, projectId, sinceSql]
      ),
    { total: 0 }
  );
  return Number(row?.total || 0);
}

export async function pruneSyncLogs(successDays = 90, errorDays = 365) {
  const removed = await deleteQuery(
    `DELETE FROM jira_sync_logs
      WHERE (result <> 'error' AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY))
         OR (result = 'error' AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY))`,
    [successDays, errorDays]
  );
  return Number(removed?.affectedRows || 0);
}

// --- Webhook events --------------------------------------------------------

/**
 * Record an inbound event.
 *
 * Returns null when the event has already been seen: the UNIQUE index on
 * event_key is the idempotency guarantee, and ER_DUP_ENTRY is success.
 */
export async function recordWebhookEvent(entry) {
  try {
    const result = await insert(
      `INSERT INTO jira_webhook_events
         (connection_id, user_id, project_id, event_key, event_type,
          jira_issue_id, jira_issue_key, link_id, payload, status, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.connectionId,
        entry.userId,
        entry.projectId || null,
        entry.eventKey,
        entry.eventType,
        entry.jiraIssueId || null,
        entry.jiraIssueKey || null,
        entry.linkId || null,
        entry.payload ? JSON.stringify(entry.payload) : null,
        entry.status || 'pending',
        now(),
      ]
    );
    return result.insertId;
  } catch (error) {
    if (isDuplicateKey(error)) return null;
    throw error;
  }
}

export async function claimPendingWebhookEvents(limit = 25) {
  return tolerant(
    () =>
      query(
        `SELECT * FROM jira_webhook_events
          WHERE status = 'pending'
          ORDER BY received_at ASC
          LIMIT ?`,
        [limit]
      ),
    []
  );
}

export async function markWebhookEvent(eventId, status, errorMessage = null) {
  await update(
    `UPDATE jira_webhook_events
        SET status = ?, last_error = ?, attempts = attempts + 1, processed_at = ?
      WHERE id = ?`,
    [status, errorMessage ? String(errorMessage).slice(0, 1000) : null, now(), eventId]
  );
}

export async function countPendingWebhookEvents(connectionId) {
  const row = await tolerant(
    () =>
      queryOne(
        `SELECT COUNT(*) AS total FROM jira_webhook_events
          WHERE connection_id = ? AND status = 'pending'`,
        [connectionId]
      ),
    { total: 0 }
  );
  return Number(row?.total || 0);
}

export async function pruneWebhookEvents(processedDays = 30, failedDays = 90) {
  const removed = await deleteQuery(
    `DELETE FROM jira_webhook_events
      WHERE (status IN ('processed','ignored')
             AND received_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY))
         OR (status = 'failed'
             AND received_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY))`,
    [processedDays, failedDays]
  );
  return Number(removed?.affectedRows || 0);
}

// --- Jobs ------------------------------------------------------------------

export async function enqueueJob(entry) {
  const timestamp = now();
  try {
    const result = await insert(
      `INSERT INTO jira_jobs
         (user_id, project_id, link_id, job_type, payload, idempotency_key,
          status, attempts, max_attempts, run_after, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?,
               DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND), ?, ?)`,
      [
        entry.userId,
        entry.projectId || null,
        entry.linkId || null,
        entry.jobType,
        entry.payload ? JSON.stringify(entry.payload) : null,
        entry.idempotencyKey || null,
        Number(entry.maxAttempts || 3),
        Number(entry.delaySeconds || 0),
        timestamp,
        timestamp,
      ]
    );
    return result.insertId;
  } catch (error) {
    // A racing caller inserted the same key first. That is the constraint
    // doing its job, not a failure.
    if (isDuplicateKey(error)) return null;
    if (isMissingTable(error)) return null;
    throw error;
  }
}

export async function claimJobs(lockToken, limit = 10) {
  return tolerant(async () => {
    await update(
      `UPDATE jira_jobs
          SET status = 'running', locked_at = ?, lock_token = ?,
              attempts = attempts + 1, updated_at = ?
        WHERE status = 'pending' AND run_after <= UTC_TIMESTAMP()
        ORDER BY run_after ASC LIMIT ?`,
      [now(), lockToken, now(), limit]
    );
    return query('SELECT * FROM jira_jobs WHERE lock_token = ? AND status = ?', [
      lockToken,
      'running',
    ]);
  }, []);
}

export async function completeJob(jobId, status, errorMessage) {
  await update(
    `UPDATE jira_jobs
        SET status = ?, last_error = ?, lock_token = NULL, locked_at = NULL,
            idempotency_key = CASE WHEN ? = 'done' THEN NULL ELSE idempotency_key END,
            updated_at = ?
      WHERE id = ?`,
    [status, errorMessage ? String(errorMessage).slice(0, 1000) : null, status, now(), jobId]
  );
}

export async function retryJob(jobId, delaySeconds, errorMessage, { consumeAttempt = true } = {}) {
  // A rate limit is an instruction, not a failure: rescheduling for
  // Retry-After must not burn one of the three attempts, or a brief throttle
  // turns into a dead-lettered job.
  const attemptsClause = consumeAttempt ? '' : ', attempts = GREATEST(attempts - 1, 0)';
  await update(
    `UPDATE jira_jobs
        SET status = 'pending',
            run_after = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND),
            last_error = ?, lock_token = NULL, locked_at = NULL,
            updated_at = ?${attemptsClause}
      WHERE id = ?`,
    [delaySeconds, errorMessage ? String(errorMessage).slice(0, 1000) : null, now(), jobId]
  );
}

export async function deadLetterJob(jobId, errorMessage) {
  await update(
    `UPDATE jira_jobs
        SET status = 'dead', last_error = ?, lock_token = NULL, locked_at = NULL,
            idempotency_key = NULL, updated_at = ?
      WHERE id = ?`,
    [errorMessage ? String(errorMessage).slice(0, 1000) : null, now(), jobId]
  );
}

export async function releaseStaleJobs(olderThanMinutes = 15) {
  const result = await tolerant(
    () =>
      update(
        `UPDATE jira_jobs
            SET status = 'pending', lock_token = NULL, locked_at = NULL, updated_at = ?
          WHERE status = 'running'
            AND locked_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? MINUTE)`,
        [now(), olderThanMinutes]
      ),
    { affectedRows: 0 }
  );
  return Number(result?.affectedRows || 0);
}

export async function jobStats(userId, projectId) {
  return tolerant(
    () =>
      query(
        `SELECT status, COUNT(*) AS total FROM jira_jobs
          WHERE user_id = ? AND project_id = ? GROUP BY status`,
        [userId, projectId]
      ),
    []
  );
}

export async function listDeadJobs(userId, projectId, limit = 20) {
  return tolerant(
    () =>
      query(
        `SELECT * FROM jira_jobs
          WHERE user_id = ? AND project_id = ? AND status = 'dead'
          ORDER BY updated_at DESC LIMIT ?`,
        [userId, projectId, limit]
      ),
    []
  );
}

export async function requeueJob(userId, jobId) {
  const result = await update(
    `UPDATE jira_jobs
        SET status = 'pending', attempts = 0, last_error = NULL,
            run_after = UTC_TIMESTAMP(), updated_at = ?
      WHERE id = ? AND user_id = ? AND status IN ('dead','pending')`,
    [now(), jobId, userId]
  );
  return Number(result?.affectedRows || 0) > 0;
}

export async function cancelProjectJobs(userId, projectId) {
  const result = await tolerant(
    () =>
      deleteQuery(
        `DELETE FROM jira_jobs WHERE user_id = ? AND project_id = ? AND status IN ('pending','dead')`,
        [userId, projectId]
      ),
    { affectedRows: 0 }
  );
  return Number(result?.affectedRows || 0);
}

export async function pruneJobs(doneDays = 7, deadDays = 90) {
  const removed = await deleteQuery(
    `DELETE FROM jira_jobs
      WHERE (status = 'done' AND updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY))
         OR (status = 'dead' AND updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY))`,
    [doneDays, deadDays]
  );
  return Number(removed?.affectedRows || 0);
}
