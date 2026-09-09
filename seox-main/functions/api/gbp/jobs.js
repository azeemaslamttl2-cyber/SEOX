// POST /api/gbp/jobs  — drain due work. Called by the scheduler Worker.
// GET  /api/gbp/jobs?projectId=  — queue stats and open alerts (session auth).
// POST /api/gbp/jobs { action: 'acknowledge-alert' } — clear one alert.
//
// Cloudflare Pages Functions cannot run cron, so scheduled work is pulled by an
// external caller. Machine authentication is a shared secret; each job carries
// its own owner, and every database read below is scoped to that owner.
//
// One tick does three things:
//   1. publish posts whose scheduled_at has passed
//   2. enqueue any recurring sync that is due
//   3. run claimed jobs, with retry, dead letter and alert on exhaustion

import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { requireConnection } from '../../_lib/gbp-request.js';
import {
  getConnectionForLocation,
  getLocationById,
  usageSummary,
  useDatabase,
} from '../../_lib/gbp-repository.js';
import {
  acknowledgeJobAlert,
  duePosts,
  jobStats,
  listJobAlerts,
  raiseJobAlert,
  updatePost,
} from '../../_lib/gbp-store.js';
import { publishStoredPost } from '../../_lib/gbp-publish.js';
import { runDueJobs, scheduleRecurringSyncs } from '../../_lib/gbp-jobs.js';
import {
  HEARTBEAT_STALE_MINUTES,
  getHeartbeat,
  pruneRateLimits,
  rateLimitStatus,
  recordHeartbeat,
} from '../../_lib/rate-limit.js';

export const SCHEDULER_WORKER = 'gbp-scheduler';

const MAX_POSTS_PER_RUN = 20;
const MAX_JOBS_PER_RUN = 10;

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

function authoriseScheduler(request, env) {
  const expected = String(env.GBP_SCHEDULER_TOKEN || '').trim();
  if (!expected) {
    const error = new Error('GBP_SCHEDULER_TOKEN is not configured; the job runner is disabled.');
    error.status = 503;
    throw error;
  }
  const supplied =
    request.headers.get('x-gbp-scheduler-token') ||
    String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!timingSafeEqual(supplied, expected)) {
    const error = new Error('Unauthorized');
    error.status = 401;
    throw error;
  }
}

async function publishDuePosts(env) {
  const rows = await duePosts(MAX_POSTS_PER_RUN);
  const results = { attempted: rows.length, published: 0, failed: 0, blocked: 0 };

  for (const post of rows) {
    const location = await getLocationById(post.location_row_id);
    if (!location) {
      await updatePost(post.user_id, post.id, {
        status: 'failed',
        lastError: 'The location this post belongs to is no longer attached.',
      });
      results.failed += 1;
      continue;
    }

    const connection = await getConnectionForLocation(location);
    if (!connection || connection.status !== 'connected' || !connection.account_id) {
      const message = 'The Business Profile connection for this location needs to be re-authorised.';
      await updatePost(post.user_id, post.id, { status: 'failed', lastError: message });
      await raiseJobAlert({
        userId: post.user_id,
        projectId: post.project_id,
        locationRowId: location.id,
        jobType: 'publish_post',
        severity: 'action_required',
        message,
      });
      results.failed += 1;
      continue;
    }

    const outcome = await publishStoredPost(env, {
      connection,
      location,
      post,
      userId: post.user_id,
    });

    if (outcome.published) {
      results.published += 1;
    } else if (outcome.blocked) {
      results.blocked += 1;
    } else {
      results.failed += 1;
      // A scheduled post that Google rejected is worth surfacing: nobody is
      // watching the screen when the worker runs.
      await raiseJobAlert({
        userId: post.user_id,
        projectId: post.project_id,
        locationRowId: location.id,
        jobType: 'publish_post',
        message: (outcome.errors || ['Scheduled post failed to publish.']).join(' '),
        attempts: Number(post.attempts || 0) + 1,
      });
    }
  }

  return results;
}

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders('GET, POST, OPTIONS'), 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return emptyResponse(204, headers);

  try {
    useDatabase(env);

    if (request.method === 'GET') {
      const decoded = await verifyAccessToken(request, env);
      const url = new URL(request.url);
      const projectId = url.searchParams.get('projectId');
      await requireConnection(env, decoded.uid, projectId);

      const [stats, alerts, usage, heartbeat, limits] = await Promise.all([
        jobStats(decoded.uid, projectId),
        listJobAlerts(decoded.uid, projectId, {
          includeAcknowledged: url.searchParams.get('all') === '1',
        }),
        // The shared GBP quota is the constraint the whole system runs against;
        // it was being recorded and never shown.
        usageSummary(decoded.uid, 24),
        // Without this the only way to notice a dead scheduler is to notice
        // that nothing has happened.
        getHeartbeat(SCHEDULER_WORKER),
        rateLimitStatus(decoded.uid),
      ]);

      return jsonResponse(
        {
          stats: Object.fromEntries(stats.map((row) => [row.status, Number(row.total)])),
          heartbeat: { ...heartbeat, staleAfterMinutes: HEARTBEAT_STALE_MINUTES },
          rateLimits: limits,
          apiUsage24h: usage.map((row) => ({
            api: row.api,
            calls: Number(row.calls),
            errors: Number(row.errors || 0),
          })),
          alerts: alerts.map((alert) => ({
            id: alert.id,
            jobType: alert.job_type,
            severity: alert.severity,
            message: alert.message,
            attempts: alert.attempts,
            locationRowId: alert.location_row_id,
            acknowledgedAt: alert.acknowledged_at,
            createdAt: alert.created_at,
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

    // Acknowledging an alert is a user action, not a machine one.
    if (body.action === 'acknowledge-alert') {
      const decoded = await verifyAccessToken(request, env);
      await requireConnection(env, decoded.uid, body.projectId);
      const done = await acknowledgeJobAlert(decoded.uid, body.alertId, decoded.email || String(decoded.uid));
      return jsonResponse({ success: done }, done ? 200 : 404, headers);
    }

    authoriseScheduler(request, env);
    const startedAt = Date.now();

    const posts = await publishDuePosts(env);
    const scheduled = body.skipScheduling
      ? { queued: [], locationsChecked: 0 }
      : await scheduleRecurringSyncs({ maxJobs: Number(body.maxJobs) || 50 });
    const jobs = body.skipJobs
      ? { claimed: 0 }
      : await runDueJobs(env, {
          lockToken: crypto.randomUUID(),
          limit: Number(body.limit) || MAX_JOBS_PER_RUN,
        });

    const durationMs = Date.now() - startedAt;
    const summary = {
      postsPublished: posts.published,
      postsFailed: posts.failed,
      jobsCompleted: jobs.completed || 0,
      jobsDead: jobs.dead || 0,
      queued: scheduled.queued.length,
    };

    // Stamped last so the heartbeat reflects a tick that actually finished.
    await recordHeartbeat(SCHEDULER_WORKER, {
      status: (jobs.dead || 0) > 0 || posts.failed > 0 ? 'degraded' : 'ok',
      durationMs,
      summary,
    });
    await pruneRateLimits(3);

    return jsonResponse(
      {
        success: true,
        posts,
        scheduled: { queued: scheduled.queued.length, locationsChecked: scheduled.locationsChecked },
        jobs,
        durationMs,
      },
      200,
      headers
    );
  } catch (error) {
    return errorResponse(error, headers);
  }
}
