// POST /api/jira/jobs   drain the queue. Called by an external timer.
// GET  /api/jira/jobs?projectId=  queue stats and recent activity (session).
//
// Vite preview has no scheduler and Pages Functions have no cron, so
// scheduled work is PULLED by an authenticated caller - the same arrangement
// /api/gbp/jobs uses. Machine authentication is a shared secret; each job
// carries its own owner and every database read below is scoped to it.
//
// One tick does three things:
//   1. drain any stored webhook events
//   2. enqueue a reconcile for every project that is due
//   3. run claimed jobs, with retry, dead letter and rate-limit handling

import { randomUUID } from 'node:crypto';
import { configureMysqlConnection } from '../../_lib/mysql.js';
import {
  corsHeaders,
  emptyResponse,
  errorResponse,
  jsonResponse,
  readJson,
} from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { requireJiraProject } from '../../_lib/jira-request.js';
import {
  jobStats,
  listDeadJobs,
  listSyncLogs,
  requeueJob,
} from '../../_lib/jira-store.js';
import { HANDLERS, runDueJobs, scheduleReconciles } from '../../_lib/jira-jobs.js';
import { toIso } from '../../_lib/jira-status-map.js';

function timingSafeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

/**
 * An unset token DISABLES the runner rather than leaving it open. An
 * unauthenticated job drain would let anyone spend the Jira rate limit.
 */
function authoriseScheduler(request, env) {
  const expected = String(env.JIRA_SCHEDULER_TOKEN || '').trim();
  if (!expected) {
    const error = new Error('JIRA_SCHEDULER_TOKEN is not configured; the Jira job runner is disabled.');
    error.status = 503;
    throw error;
  }
  const provided = request.headers.get('x-jira-scheduler-token') || '';
  if (!timingSafeEqual(provided, expected)) {
    const error = new Error('Unauthorized');
    error.status = 401;
    throw error;
  }
}

async function drain(env) {
  const lockToken = randomUUID();

  // Webhook events first: they are the freshest signal, and processing them
  // may enqueue verification work this same tick can pick up.
  let webhooks = { processed: 0, ignored: 0, failed: 0, verifying: 0 };
  try {
    webhooks = await HANDLERS.jira_webhook(env, {});
  } catch (error) {
    console.error('Jira webhook drain failed:', error?.message || error);
  }

  let scheduled = { queued: [], connectionsChecked: 0 };
  try {
    scheduled = await scheduleReconciles();
  } catch (error) {
    console.error('Jira reconcile scheduling failed:', error?.message || error);
  }

  const jobs = await runDueJobs(env, { lockToken });

  return {
    webhooks,
    scheduled: scheduled.queued.length,
    connectionsChecked: scheduled.connectionsChecked,
    ...jobs,
  };
}

export async function onRequest({ request, env }) {
  const headers = {
    ...corsHeaders('GET, POST, OPTIONS'),
    'Cache-Control': 'no-store',
  };

  if (request.method === 'OPTIONS') return emptyResponse(204, headers);

  try {
    configureMysqlConnection(env);

    // --- Operator view: queue stats and recent activity, session auth ---
    if (request.method === 'GET') {
      const user = await verifyAccessToken(request, env);
      const url = new URL(request.url);
      const project = await requireJiraProject(user.id, url.searchParams.get('projectId'));

      const stats = await jobStats(user.id, project.project_id);
      const dead = await listDeadJobs(user.id, project.project_id, 20);
      const logs = await listSyncLogs(user.id, {
        projectId: project.project_id,
        limit: Math.min(Number(url.searchParams.get('limit')) || 20, 100),
        result: url.searchParams.get('result') || undefined,
      });

      return jsonResponse(
        {
          queue: Object.fromEntries(stats.map((row) => [row.status, Number(row.total)])),
          deadJobs: dead.map((job) => ({
            id: job.id,
            jobType: job.job_type,
            linkId: job.link_id,
            attempts: Number(job.attempts || 0),
            lastError: job.last_error || '',
            updatedAt: toIso(job.updated_at),
          })),
          activity: logs.map((row) => ({
            id: row.id,
            action: row.action,
            direction: row.direction,
            result: row.result,
            message: row.message || '',
            jiraIssueKey: row.jira_issue_key || '',
            linkId: row.link_id,
            durationMs: row.duration_ms,
            actorEmail: row.actor_email || '',
            actorKind: row.actor_kind,
            createdAt: toIso(row.created_at),
          })),
        },
        200,
        headers
      );
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, headers);
    }

    const body = await readJson(request);

    // --- Operator action: retry one dead job, session auth ---
    if (body?.action === 'retry-job') {
      const user = await verifyAccessToken(request, env);
      await requireJiraProject(user.id, body.projectId);
      const requeued = await requeueJob(user.id, body.jobId);
      if (!requeued) return jsonResponse({ error: 'That job cannot be retried.' }, 409, headers);
      return jsonResponse({ requeued: true }, 200, headers);
    }

    // --- Machine: drain the queue ---
    authoriseScheduler(request, env);
    return jsonResponse(await drain(env), 200, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
