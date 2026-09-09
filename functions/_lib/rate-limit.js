// Fixed-window rate limiting for endpoints that spend a shared external quota.
//
// The GBP and WPScan quotas belong to the Google Cloud project, not to the
// user, so one tenant holding down a sync button spends every tenant's
// allowance. These limits are about protecting that shared resource, not about
// protecting the server.

import { query, queryOne, insert, update, deleteQuery } from './mysql.js';

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Per-bucket limits. Each is a deliberate call about how often a human could
 * genuinely need the operation, not a technical ceiling.
 */
export const LIMITS = {
  // Every one of these spends Google quota.
  'gbp:sync-reviews': { limit: 6, windowSeconds: 3600 },
  'gbp:sync-qanda': { limit: 6, windowSeconds: 3600 },
  'gbp:refresh-overview': { limit: 10, windowSeconds: 3600 },
  'gbp:run-audit': { limit: 6, windowSeconds: 3600 },
  'gbp:sync-keywords': { limit: 2, windowSeconds: 86400 },
  'gbp:resync-locations': { limit: 6, windowSeconds: 3600 },
  // WPScan's free tier is 25 requests a day for the whole install, and one scan
  // can spend a dozen.
  'wpscan:scan': { limit: 3, windowSeconds: 86400 },
  // AI generation costs money rather than quota, but runs away just as easily.
  'ai:generate': { limit: 60, windowSeconds: 3600 },
};

function windowStart(windowSeconds, at = Date.now()) {
  const size = windowSeconds * 1000;
  return new Date(Math.floor(at / size) * size).toISOString().slice(0, 19).replace('T', ' ');
}

function limitError(bucket, config, resetsAt) {
  const error = new Error(
    `Rate limit reached for this action (${config.limit} per ${
      config.windowSeconds >= 86400
        ? 'day'
        : `${Math.round(config.windowSeconds / 60)} minutes`
    }). This protects the shared Google API quota. Try again after ${resetsAt}.`
  );
  error.status = 429;
  error.code = 'RATE_LIMITED';
  error.bucket = bucket;
  return error;
}

/**
 * Count one hit against a bucket, throwing 429 when the window is full.
 *
 * The insert-then-read order matters: two concurrent requests both increment
 * before either reads, so the limit cannot be beaten by racing.
 */
export async function consumeRateLimit(userId, bucket) {
  const config = LIMITS[bucket];
  if (!config) return { allowed: true, remaining: null };

  const start = windowStart(config.windowSeconds);
  const timestamp = now();

  await insert(
    `INSERT INTO api_rate_limits (user_id, bucket, window_start, hits, updated_at)
     VALUES (?, ?, ?, 1, ?)
     ON DUPLICATE KEY UPDATE hits = hits + 1, updated_at = VALUES(updated_at)`,
    [userId, bucket, start, timestamp]
  );

  const row = await queryOne(
    'SELECT hits FROM api_rate_limits WHERE user_id = ? AND bucket = ? AND window_start = ? LIMIT 1',
    [userId, bucket, start]
  );
  const hits = Number(row?.hits || 1);

  if (hits > config.limit) {
    const resetsAt = new Date(
      new Date(`${start}Z`).getTime() + config.windowSeconds * 1000
    ).toLocaleTimeString();
    throw limitError(bucket, config, resetsAt);
  }

  return { allowed: true, remaining: Math.max(0, config.limit - hits), limit: config.limit };
}

export async function rateLimitStatus(userId, buckets = Object.keys(LIMITS)) {
  const out = [];
  for (const bucket of buckets) {
    const config = LIMITS[bucket];
    if (!config) continue;
    const row = await queryOne(
      'SELECT hits FROM api_rate_limits WHERE user_id = ? AND bucket = ? AND window_start = ? LIMIT 1',
      [userId, bucket, windowStart(config.windowSeconds)]
    );
    const hits = Number(row?.hits || 0);
    out.push({
      bucket,
      used: hits,
      limit: config.limit,
      remaining: Math.max(0, config.limit - hits),
      windowSeconds: config.windowSeconds,
    });
  }
  return out;
}

/**
 * Drop windows that have long since closed. Called from the worker drain so it
 * costs nothing on a user request.
 */
export async function pruneRateLimits(olderThanDays = 3) {
  const result = await deleteQuery(
    'DELETE FROM api_rate_limits WHERE window_start < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)',
    [olderThanDays]
  );
  return Number(result?.affectedRows || 0);
}

// --- Worker heartbeat ------------------------------------------------------

export const HEARTBEAT_STALE_MINUTES = 20;

export async function recordHeartbeat(worker, { status = 'ok', message = null, durationMs = null, summary = null } = {}) {
  await insert(
    `INSERT INTO worker_heartbeats (worker, last_seen_at, last_status, last_message, runs_total, last_duration_ms, last_summary)
     VALUES (?, ?, ?, ?, 1, ?, ?)
     ON DUPLICATE KEY UPDATE
       last_seen_at = VALUES(last_seen_at),
       last_status = VALUES(last_status),
       last_message = VALUES(last_message),
       runs_total = runs_total + 1,
       last_duration_ms = VALUES(last_duration_ms),
       last_summary = VALUES(last_summary)`,
    [
      worker,
      now(),
      status,
      message ? String(message).slice(0, 1000) : null,
      durationMs,
      summary ? JSON.stringify(summary) : null,
    ]
  );
}

/**
 * When the worker last called in, and whether that is long enough ago to mean
 * nothing is being scheduled or published.
 */
export async function getHeartbeat(worker) {
  const row = await queryOne('SELECT * FROM worker_heartbeats WHERE worker = ? LIMIT 1', [worker]);
  if (!row) {
    return {
      worker,
      everRan: false,
      stale: true,
      lastSeenAt: null,
      minutesSince: null,
      message:
        'The scheduler has never called in. Until it does, nothing syncs and no scheduled post publishes.',
    };
  }

  const minutesSince = Math.floor(
    (Date.now() - new Date(`${row.last_seen_at}Z`).getTime()) / 60000
  );
  const stale = minutesSince > HEARTBEAT_STALE_MINUTES;

  return {
    worker,
    everRan: true,
    stale,
    lastSeenAt: row.last_seen_at,
    minutesSince,
    status: row.last_status,
    runsTotal: Number(row.runs_total),
    lastDurationMs: row.last_duration_ms,
    lastMessage: row.last_message,
    message: stale
      ? `The scheduler last ran ${minutesSince} minutes ago. It should run every 5 minutes â€” nothing is syncing or publishing while it is down.`
      : null,
  };
}

export async function listHeartbeats() {
  return query('SELECT * FROM worker_heartbeats ORDER BY worker ASC');
}


