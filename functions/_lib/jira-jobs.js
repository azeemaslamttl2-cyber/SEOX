// Background worker for the Jira integration: the handler registry, the
// retry / dead-letter path, and the periodic reconcile scheduler.
//
//   Scheduler -> jira_jobs -> Worker -> jira-client -> Jira -> DB
//                                |
//                                +-> retry (backoff) -> dead letter -> log
//
// Nothing here runs in a browser. The worker is driven by POST /api/jira/jobs,
// which an external timer calls; handlers enter the same service functions the
// HTTP endpoints use.
//
// The shape is deliberately the same as gbp-jobs.js so operators have one
// model to understand, with one improvement: a 429 reschedules WITHOUT
// consuming an attempt. Burning retries on a rate limit is how a brief
// throttle turns into a dead-lettered job.

import { randomUUID } from 'node:crypto';
import {
  claimJobs,
  claimPendingWebhookEvents,
  completeJob,
  countAutoCreatedSince,
  deadLetterJob,
  enqueueJob,
  getLinkById,
  getLinkByIssueId,
  linksNeedingSync,
  logSync,
  markWebhookEvent,
  parseJson,
  pruneJobs,
  pruneSyncLogs,
  pruneWebhookEvents,
  releaseStaleJobs,
  retryJob,
} from './jira-store.js';
import {
  getConnectionById,
  getMapping,
  listConnectionsForSync,
  touchConnectionSync,
} from './jira-repository.js';
import {
  applyIssueToLink,
  applyVerificationOutcome,
  detectOrphans,
  fetchIssue,
  postRecurrenceComment,
  reconcileProject,
  transitionToOpen,
} from './jira-sync.js';
import { runVerification } from './jira-verify.js';
import { SEOX_STATES, toEpochMs } from './jira-status-map.js';

// The same spacing gbp-jobs.js uses. A failure that is not the caller's fault
// is worth three tries; after that it is parked rather than retried forever.
export const RETRY_BACKOFF_SECONDS = [60, 300, 1800];

// How often a project is reconciled when webhooks are quiet. The reconcile
// query looks back 40 minutes against this 30-minute cadence, so the windows
// overlap and nothing can slip between them.
export const RECONCILE_INTERVAL_MINUTES = 30;
export const RECONCILE_LOOKBACK_MINUTES = 40;

const MAX_JOBS_PER_RUN = 10;
const MAX_WEBHOOK_EVENTS_PER_RUN = 25;

function nowSql(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString().slice(0, 19).replace('T', ' ');
}

// --- Enqueue helpers (used by the HTTP routes too) -------------------------

export function enqueueVerification({ link, mapping, delayMinutes }) {
  const minutes = Number(
    delayMinutes ?? mapping?.verification_delay_minutes ?? 10
  );
  return enqueueJob({
    userId: link.user_id,
    projectId: link.project_id,
    linkId: link.id,
    jobType: 'jira_verify',
    // Keyed on the link and the attempt count so a later re-resolution
    // enqueues a fresh job rather than colliding with the completed one.
    idempotencyKey: `verify:${link.id}:${link.verification_attempts || 0}:${link.reopened_count || 0}`,
    delaySeconds: Math.max(0, Math.min(minutes, 1440)) * 60,
    maxAttempts: 3,
  });
}

export function enqueueReconcile({ userId, projectId }) {
  const bucket = Math.floor(Date.now() / (RECONCILE_INTERVAL_MINUTES * 60000));
  return enqueueJob({
    userId,
    projectId,
    jobType: 'jira_reconcile',
    // The cadence window is part of the key, so each due period gets its own
    // job and two overlapping ticks collapse into one.
    idempotencyKey: `reconcile:${userId}:${projectId}:${bucket}`,
    maxAttempts: 2,
  });
}

export function enqueueWebhookProcessing() {
  const bucket = Math.floor(Date.now() / 60000);
  return enqueueJob({
    userId: 0,
    jobType: 'jira_webhook',
    idempotencyKey: `webhook-drain:${bucket}`,
    maxAttempts: 2,
  });
}

// --- Handlers --------------------------------------------------------------

/**
 * Every handler takes (env, job) and returns a small result object. Throwing
 * signals failure; the runner decides retry versus dead letter.
 */
export const HANDLERS = {
  /** Re-check one finding after Jira said it was done. */
  async jira_verify(env, job) {
    const link = await getLinkById(job.user_id, job.link_id);
    if (!link) return { skipped: 'The link no longer exists.' };
    if (link.state !== 'linked') return { skipped: `Link state is ${link.state}.` };
    if (link.seox_state !== SEOX_STATES.RESOLVED_PENDING) {
      return { skipped: `Link is ${link.seox_state}, not awaiting verification.` };
    }

    const mapping = await getMapping(link.user_id, link.project_id);
    if (!mapping) return { skipped: 'No Jira mapping for this project.' };
    const connection = await getConnectionById(link.connection_id);

    const spec = parseJson(link.verification_spec, null);
    const started = Date.now();
    const result = await runVerification(spec);

    const outcome = await applyVerificationOutcome({ link, result, mapping, env, connection });

    await logSync({
      userId: link.user_id,
      projectId: link.project_id,
      linkId: link.id,
      action: 'verify.run',
      direction: 'internal',
      result: result.outcome === 'failed' ? 'error' : result.outcome === 'unavailable' ? 'skipped' : 'success',
      jiraIssueKey: link.jira_issue_key,
      message:
        result.outcome === 'unavailable'
          ? `Could not re-check the page: ${result.error}`
          : result.outcome === 'manual'
            ? 'No automatic check is available for this finding type.'
            : result.outcome === 'passed'
              ? 'The finding is no longer present.'
              : 'The finding is still present.',
      durationMs: Date.now() - started,
      actorKind: 'system',
      context: {
        outcome: result.outcome,
        state: outcome.state,
        commented: outcome.commented,
        transition: outcome.transition || null,
        failedChecks: (result.checks || []).filter((check) => !check.passed).map((check) => check.type),
      },
    });

    // An unreachable site is retried on the normal backoff rather than being
    // treated as a verdict.
    if (result.outcome === 'unavailable') {
      const error = new Error(result.error || 'The page could not be reached.');
      error.retryable = true;
      throw error;
    }

    return { outcome: result.outcome, state: outcome.state };
  },

  /** One JQL sweep for a project, plus orphan detection. */
  async jira_reconcile(env, job) {
    const mapping = await getMapping(job.user_id, job.project_id);
    if (!mapping || mapping.status !== 'active' || !mapping.auto_sync_enabled) {
      return { skipped: 'Sync is disabled for this project.' };
    }

    const connection = await getConnectionById(mapping.connection_id);
    if (!connection || connection.status !== 'connected' || !connection.api_token_encrypted) {
      return { skipped: 'Jira is not connected for this project.' };
    }

    const links = await linksNeedingSync(job.user_id, job.project_id);
    if (!links.length) {
      await touchConnectionSync(connection.id);
      return { checked: 0, updated: 0 };
    }

    const started = Date.now();
    const result = await reconcileProject(env, {
      connection,
      mapping,
      links,
      lookbackMinutes: RECONCILE_LOOKBACK_MINUTES,
    });

    for (const link of result.verifyQueue) {
      await enqueueVerification({ link, mapping });
    }

    const orphaned = await detectOrphans(env, { connection, links });
    await touchConnectionSync(connection.id);

    await logSync({
      userId: job.user_id,
      projectId: job.project_id,
      action: 'issue.sync',
      direction: 'inbound',
      result: 'success',
      message: `Reconciled ${result.updated.length} of ${links.length} linked issue(s).`,
      durationMs: Date.now() - started,
      actorKind: 'scheduler',
      context: {
        checked: result.checked,
        updated: result.updated.length,
        queuedForVerification: result.verifyQueue.length,
        orphaned: orphaned.length,
      },
    });

    return {
      checked: result.checked,
      updated: result.updated.length,
      verifying: result.verifyQueue.length,
      orphaned: orphaned.length,
    };
  },

  /**
   * Apply stored webhook events.
   *
   * The endpoint stores and acknowledges within the request; the real work
   * happens here, so a slow Jira or a slow database can never make the
   * webhook endpoint time out and cause Jira to retry.
   */
  async jira_webhook(env) {
    const events = await claimPendingWebhookEvents(MAX_WEBHOOK_EVENTS_PER_RUN);
    const summary = { processed: 0, ignored: 0, failed: 0, verifying: 0 };

    for (const event of events) {
      try {
        const connection = await getConnectionById(event.connection_id);
        if (!connection) {
          await markWebhookEvent(event.id, 'ignored', 'The connection no longer exists.');
          summary.ignored += 1;
          continue;
        }

        const payload = parseJson(event.payload, {}) || {};
        const link = event.link_id
          ? await getLinkById(event.user_id, event.link_id)
          : await getLinkByIssueId(connection.id, event.jira_issue_id);

        if (!link || link.state === 'unlinked') {
          await markWebhookEvent(event.id, 'ignored', 'No active link for this issue.');
          summary.ignored += 1;
          continue;
        }

        if (event.event_type === 'jira:issue_deleted') {
          await markWebhookEvent(event.id, 'processed');
          summary.processed += 1;
          continue;
        }

        // The webhook payload carries the issue, but it is not trusted for
        // authorisation - only for content, and only after the link was
        // resolved from SEOX's own tables.
        const issue = payload.issue?.fields
          ? payload.issue
          : await fetchIssue(env, connection, event.jira_issue_id || event.jira_issue_key);

        if (!issue) {
          await markWebhookEvent(event.id, 'ignored', 'The issue could not be read.');
          summary.ignored += 1;
          continue;
        }

        const applied = await applyIssueToLink(link, issue);

        if (applied.applied && applied.shouldVerify) {
          const mapping = await getMapping(link.user_id, link.project_id);
          if (mapping) {
            const refreshed = await getLinkById(link.user_id, link.id);
            await enqueueVerification({ link: refreshed || link, mapping });
            summary.verifying += 1;
          }
        }

        await markWebhookEvent(event.id, 'processed');
        summary.processed += 1;

        await logSync({
          userId: link.user_id,
          projectId: link.project_id,
          linkId: link.id,
          action: 'webhook.receive',
          direction: 'inbound',
          result: 'success',
          jiraIssueKey: link.jira_issue_key,
          message: applied.stale
            ? 'Event ignored: an equal or newer update was already applied.'
            : `Applied ${event.event_type}.`,
          actorKind: 'webhook',
          context: { eventType: event.event_type, seoxState: applied.seoxState || link.seox_state },
        });
      } catch (error) {
        await markWebhookEvent(event.id, 'failed', error?.message);
        summary.failed += 1;
      }
    }

    return summary;
  },

  /** A finding recurred after its issue was closed. */
  async jira_reopen(env, job) {
    const link = await getLinkById(job.user_id, job.link_id);
    if (!link || link.state !== 'linked') return { skipped: 'No active link.' };

    const mapping = await getMapping(link.user_id, link.project_id);
    const connection = await getConnectionById(link.connection_id);
    if (!mapping || !connection) return { skipped: 'Jira is not connected.' };

    const behaviour = mapping.reopen_behaviour || 'reopen';
    if (behaviour === 'none') return { skipped: 'Reopen behaviour is set to none.' };

    let transition = null;
    if (behaviour === 'reopen') {
      transition = await transitionToOpen(env, connection, link);
    }
    // Comment either way: when no transition exists this IS the fallback,
    // and when one does it explains why the issue moved.
    await postRecurrenceComment(env, connection, link);

    await logSync({
      userId: link.user_id,
      projectId: link.project_id,
      linkId: link.id,
      action: transition?.transitioned ? 'issue.transition' : 'comment.post',
      result: 'success',
      jiraIssueKey: link.jira_issue_key,
      message: transition?.transitioned
        ? `Reopened in Jira (moved to ${transition.to}).`
        : 'Commented on the Jira issue; no reopen transition was available.',
      actorKind: 'system',
      context: { behaviour, transition },
    });

    return { transitioned: Boolean(transition?.transitioned) };
  },

  /** Housekeeping: retention for the two high-volume tables. */
  async jira_prune() {
    const logs = await pruneSyncLogs();
    const events = await pruneWebhookEvents();
    const jobs = await pruneJobs();
    return { logs, events, jobs };
  },
};

// --- Scheduler -------------------------------------------------------------

/**
 * Enqueue a reconcile for every connected, sync-enabled project that is due.
 *
 * Safe to call on every tick: the cadence-window idempotency key means a job
 * already pending for the same window is not queued twice.
 */
export async function scheduleReconciles({ maxProjects = 50 } = {}) {
  const connections = await listConnectionsForSync(maxProjects);
  const queued = [];

  for (const connection of connections) {
    const lastSync = toEpochMs(connection.last_sync_at);
    const ageMinutes = Number.isNaN(lastSync) ? Infinity : (Date.now() - lastSync) / 60000;
    if (ageMinutes < RECONCILE_INTERVAL_MINUTES) continue;

    const jobId = await enqueueReconcile({
      userId: connection.user_id,
      projectId: connection.project_id,
    });
    if (jobId) queued.push({ jobId, projectId: connection.project_id });
  }

  return { queued, connectionsChecked: connections.length };
}

// --- Runner ----------------------------------------------------------------

export async function runDueJobs(env, { lockToken = randomUUID(), limit = MAX_JOBS_PER_RUN } = {}) {
  const released = await releaseStaleJobs(15);
  const jobs = await claimJobs(lockToken, limit);

  const results = {
    released,
    claimed: jobs.length,
    completed: 0,
    failed: 0,
    retried: 0,
    rateLimited: 0,
    dead: 0,
    details: [],
  };

  for (const job of jobs) {
    const handler = HANDLERS[job.job_type];

    if (!handler) {
      // An unknown type will never succeed, so it goes straight to the dead
      // letter rather than burning three attempts first.
      await deadLetterJob(job.id, `No handler registered for job type "${job.job_type}".`);
      results.dead += 1;
      continue;
    }

    const started = Date.now();
    try {
      const outcome = await handler(env, job);
      await completeJob(job.id, 'done', null);
      results.completed += 1;
      results.details.push({ jobId: job.id, type: job.job_type, outcome });
    } catch (error) {
      const message = error?.message || 'Job failed.';
      const attempts = Number(job.attempts || 0);

      // A rate limit is an instruction, not a failure. Wait exactly as long
      // as Jira asked, and do not consume one of the three attempts.
      if (error?.code === 'RATE_LIMITED' || error?.status === 429) {
        await retryJob(job.id, Number(error.retryAfterSeconds || 60), message, {
          consumeAttempt: false,
        });
        results.rateLimited += 1;
        results.details.push({ jobId: job.id, type: job.job_type, rateLimited: true });
        await logSync({
          userId: job.user_id,
          projectId: job.project_id,
          linkId: job.link_id,
          action: 'job.retry',
          result: 'rate_limited',
          message,
          durationMs: Date.now() - started,
          actorKind: 'scheduler',
        });
        continue;
      }

      // The breaker is open, or credentials are gone: waiting is the only
      // sensible response, and neither is fixed by burning attempts.
      const paused = error?.code === 'CIRCUIT_OPEN';
      if (paused) {
        await retryJob(job.id, Number(error.retryAfterSeconds || 300), message, {
          consumeAttempt: false,
        });
        results.retried += 1;
        continue;
      }

      const permanent = error?.code === 'INVALID_CREDENTIALS' || error?.code === 'NOT_CONNECTED';

      if (permanent || attempts >= Number(job.max_attempts || 3)) {
        await deadLetterJob(job.id, message);
        results.dead += 1;
        await logSync({
          userId: job.user_id,
          projectId: job.project_id,
          linkId: job.link_id,
          action: 'job.dead_letter',
          result: 'error',
          message,
          durationMs: Date.now() - started,
          actorKind: 'scheduler',
          context: { jobType: job.job_type, attempts },
        });
      } else {
        const delay =
          RETRY_BACKOFF_SECONDS[Math.min(attempts - 1, RETRY_BACKOFF_SECONDS.length - 1)] ||
          RETRY_BACKOFF_SECONDS[0];
        await retryJob(job.id, delay, message);
        results.retried += 1;
      }

      results.failed += 1;
      results.details.push({ jobId: job.id, type: job.job_type, error: message });
    }
  }

  return results;
}

export { nowSql, countAutoCreatedSince };
