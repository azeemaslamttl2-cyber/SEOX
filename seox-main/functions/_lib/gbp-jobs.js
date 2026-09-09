// Background worker: the job handler registry, the recurring sync scheduler,
// and the retry / dead-letter / alert path.
//
//   Scheduler -> Job queue -> Worker -> GBPService -> Google -> DB
//                                 |
//                                 +-> retry (backoff) -> dead letter -> alert
//
// Nothing here runs in a browser. The worker is driven by POST /api/gbp/jobs,
// which the Cloudflare cron Worker calls; job handlers enter GBPService exactly
// as the HTTP endpoints do.

import {
  getConnectionForLocation,
  getLocationById,
  getLocationRow,
  logSync,
} from './gbp-repository.js';
import { runRule, summariseRuleRun } from './gbp-automation-runner.js';
import {
  activeLocationsForSync,
  claimJobs,
  completeJob,
  deadLetterJob,
  enqueueJob,
  getPost,
  getRule,
  markRuleRun,
  lastSuccessfulSync,
  parseJson,
  pendingJobExists,
  raiseJobAlert,
  releaseStaleJobs,
  retryJob,
} from './gbp-store.js';
import {
  getPerformance,
  getQuestions,
  getReviews,
  getSearchKeywords,
  syncProfile,
} from './gbp-service.js';
import { publishStoredPost } from './gbp-publish.js';

// Retry spacing. A failure that is not the caller's fault (a 5xx, a network
// blip) is worth three tries; after that it is parked and alerted rather than
// retried forever.
export const RETRY_BACKOFF_SECONDS = [60, 300, 1800];

/**
 * How often each recurring sync runs, per location.
 *
 * These intervals are the whole reason the GBP quota survives a multi-tenant
 * install: reviews change often and are cheap, keyword data is monthly and is
 * pointless to poll daily.
 */
export const SYNC_CADENCE_MINUTES = {
  reviews: 30,
  qanda: 120,
  metrics: 60 * 24,
  profile: 60 * 24 * 7,
  keywords: 60 * 24 * 30,
};

// job_type -> the sync_type written to gbp_sync_logs, used to decide "is it due".
const RECURRING_JOBS = {
  sync_reviews: { syncType: 'reviews-sync', cadence: 'reviews' },
  sync_qanda: { syncType: 'qanda-sync', cadence: 'qanda' },
  sync_metrics: { syncType: 'metrics-sync', cadence: 'metrics' },
  sync_profile: { syncType: 'profile-sync', cadence: 'profile' },
  sync_keywords: { syncType: 'search-keywords', cadence: 'keywords' },
};

// --- Handlers --------------------------------------------------------------

/**
 * Every handler takes (env, job) and returns a small result object. A handler
 * throws to signal failure; the runner decides retry vs dead letter.
 */
export const HANDLERS = {
  async sync_profile(env, job) {
    const { userId, projectId, locationRowId } = jobScope(job);
    const result = await syncProfile(env, { userId, projectId, locationRowId });
    return { categories: result.categories.length, services: result.services.length };
  },

  async sync_reviews(env, job) {
    const { userId, projectId, locationRowId } = jobScope(job);
    const result = await getReviews(env, { userId, projectId, locationRowId });
    return { synced: result.synced, truncated: result.truncated };
  },

  async sync_qanda(env, job) {
    const { userId, projectId, locationRowId } = jobScope(job);
    const result = await getQuestions(env, { userId, projectId, locationRowId });
    return { synced: result.questions.length };
  },

  async sync_metrics(env, job) {
    const { userId, projectId, locationRowId } = jobScope(job);
    const payload = parseJson(job.payload, {}) || {};
    const result = await getPerformance(env, {
      userId,
      projectId,
      locationRowId,
      days: payload.days || 60,
    });
    return { rows: result.rows };
  },

  async sync_keywords(env, job) {
    const { userId, projectId, locationRowId } = jobScope(job);
    const result = await getSearchKeywords(env, { userId, projectId, locationRowId });
    return { month: result.month, keywords: result.keywords };
  },

  async publish_post(env, job) {
    const payload = parseJson(job.payload, {}) || {};
    const post = await getPost(job.user_id, payload.postId);
    if (!post) return { skipped: 'Post no longer exists.' };
    if (post.status === 'published') return { skipped: 'Already published.' };

    const location = await getLocationById(post.location_row_id);
    if (!location) throw new Error('The location this post belongs to is no longer attached.');

    const connection = await getConnectionForLocation(location);
    if (!connection || connection.status !== 'connected' || !connection.account_id) {
      throw new Error('The Business Profile connection for this location needs to be re-authorised.');
    }

    const outcome = await publishStoredPost(env, {
      connection,
      location,
      post,
      userId: post.user_id,
    });
    if (!outcome.published) {
      // A blocked location or a policy rejection is not a transient fault, so
      // it must not be retried into a strike.
      if (outcome.blocked || outcome.code === 'INVALID') {
        return { skipped: (outcome.errors || []).join(' ') };
      }
      throw new Error((outcome.errors || ['Publish failed.']).join(' '));
    }
    return { published: true, postId: post.id };
  },

  async run_rule(env, job) {
    const payload = parseJson(job.payload, {}) || {};
    const rule = await getRule(job.user_id, payload.ruleId);
    if (!rule) return { skipped: 'Rule no longer exists.' };
    if (!rule.enabled) return { skipped: 'Rule is disabled.' };

    const location = await getLocationRow(job.user_id, rule.location_row_id || job.location_row_id);
    if (!location) return { skipped: 'The rule has no attached location.' };

    const connection = await getConnectionForLocation(location);
    if (!connection || connection.status !== 'connected' || !connection.account_id) {
      throw new Error('The Business Profile connection for this location needs to be re-authorised.');
    }

    try {
      // The same runner the Automation page uses, so a scheduled run drafts
      // exactly what a manual run would.
      const result = await runRule(env, {
        userId: job.user_id,
        projectId: rule.project_id,
        rule,
        location,
        connection,
      });
      await markRuleRun(job.user_id, rule.id, 'success', summariseRuleRun(rule.rule_type, result));
      return result;
    } catch (error) {
      await markRuleRun(job.user_id, rule.id, 'error', error?.message);
      throw error;
    }
  },
};

function jobScope(job) {
  if (!job.project_id || !job.location_row_id) {
    throw new Error(`Job ${job.id} is missing its project or location scope.`);
  }
  return {
    userId: job.user_id,
    projectId: job.project_id,
    locationRowId: job.location_row_id,
  };
}

/**
 * The cadence window a moment falls in. Two ticks inside the same window
 * produce the same bucket, so the unique index collapses them into one job;
 * the next window produces a new bucket and a new job.
 */
export function cadenceBucket(cadence, at = Date.now()) {
  const minutes = SYNC_CADENCE_MINUTES[cadence];
  if (!minutes) throw new Error(`Unknown sync cadence "${cadence}".`);
  return Math.floor(at / (minutes * 60000));
}

function isDuplicateKey(error) {
  return (
    error?.code === 'ER_DUP_ENTRY' ||
    error?.errno === 1062 ||
    /duplicate entry/i.test(String(error?.message || ''))
  );
}

// --- Scheduler -------------------------------------------------------------

/**
 * Enqueue any recurring sync that is due, for every connected location.
 *
 * The idempotency key makes this safe to call on every tick: a job already
 * pending or running for the same location and type is not queued twice, so
 * two overlapping cron runs cannot double the quota spend.
 */
export async function scheduleRecurringSyncs({ maxLocations = 100, maxJobs = 50 } = {}) {
  const locations = await activeLocationsForSync(maxLocations);
  const queued = [];

  for (const location of locations) {
    for (const [jobType, config] of Object.entries(RECURRING_JOBS)) {
      if (queued.length >= maxJobs) return { queued, locationsChecked: locations.length, capped: true };

      const last = await lastSuccessfulSync(location.user_id, location.id, config.syncType);
      if (last?.created_at) {
        const ageMinutes = (Date.now() - new Date(`${last.created_at}Z`).getTime()) / 60000;
        if (ageMinutes < SYNC_CADENCE_MINUTES[config.cadence]) continue;
      }

      // The key carries the cadence window, so each due period gets its own
      // key. A fixed `type:location` key would collide with the completed job
      // from the previous cycle and the unique index would reject every
      // subsequent enqueue.
      const idempotencyKey = `${jobType}:${location.id}:${cadenceBucket(config.cadence)}`;
      if (await pendingJobExists(idempotencyKey)) continue;

      try {
        const jobId = await enqueueJob({
          userId: location.user_id,
          projectId: location.project_id,
          locationRowId: location.id,
          jobType,
          idempotencyKey,
          maxAttempts: 3,
        });
        queued.push({ jobId, jobType, locationRowId: location.id });
      } catch (error) {
        // A racing tick may have inserted the same key between the check and
        // the insert. That is the constraint doing its job, not a failure.
        if (!isDuplicateKey(error)) throw error;
      }
    }
  }

  return { queued, locationsChecked: locations.length, capped: false };
}

// --- Runner ----------------------------------------------------------------

export async function runDueJobs(env, { lockToken, limit = 10 } = {}) {
  const released = await releaseStaleJobs(15);
  const jobs = await claimJobs(lockToken, limit);

  const results = { released, claimed: jobs.length, completed: 0, failed: 0, retried: 0, dead: 0, details: [] };

  for (const job of jobs) {
    const handler = HANDLERS[job.job_type];

    if (!handler) {
      // An unknown type will never succeed, so it goes straight to the dead
      // letter rather than burning three attempts first.
      await deadLetterJob(job.id, `No handler registered for job type "${job.job_type}".`);
      await raiseJobAlert({
        userId: job.user_id,
        projectId: job.project_id,
        locationRowId: job.location_row_id,
        jobId: job.id,
        jobType: job.job_type,
        message: `No handler registered for job type "${job.job_type}".`,
        attempts: job.attempts,
      });
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

      // Re-authorisation and quota exhaustion are not fixed by retrying
      // immediately; the first is a human action, the second a waiting game.
      const permanent = error?.code === 'NEEDS_REAUTH';
      const quota = error?.code === 'QUOTA_EXCEEDED' || error?.status === 429;

      if (permanent || attempts >= Number(job.max_attempts || 3)) {
        await deadLetterJob(job.id, message);
        await raiseJobAlert({
          userId: job.user_id,
          projectId: job.project_id,
          locationRowId: job.location_row_id,
          jobId: job.id,
          jobType: job.job_type,
          severity: permanent ? 'action_required' : 'error',
          message,
          attempts,
        });
        results.dead += 1;
      } else {
        // Quota errors wait for the longest backoff rather than hammering.
        const delay = quota
          ? RETRY_BACKOFF_SECONDS[RETRY_BACKOFF_SECONDS.length - 1]
          : RETRY_BACKOFF_SECONDS[Math.min(attempts - 1, RETRY_BACKOFF_SECONDS.length - 1)] ||
            RETRY_BACKOFF_SECONDS[0];
        await retryJob(job.id, delay, message);
        results.retried += 1;
      }

      results.failed += 1;
      results.details.push({ jobId: job.id, type: job.job_type, error: message });

      await logSync({
        userId: job.user_id,
        projectId: job.project_id,
        locationRowId: job.location_row_id,
        syncType: `job:${job.job_type}`,
        status: 'error',
        message,
        durationMs: Date.now() - started,
      });
    }
  }

  return results;
}
