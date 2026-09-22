// Quota-aware scheduling for the Google Business Profile APIs.
//
// What the quota actually is here
// -------------------------------
// Worth stating plainly, because it changes what "fix the quota problem" means:
// this Cloud project's Business Profile quota is *zero*, not merely small. The
// APIs ship with a requests-per-minute limit of 0 until Google approves the API
// access request, so the first call of the day is refused exactly like the
// thousandth. Measured on production: 27 calls in five days, every one of them
// 429. No amount of caching makes a zero-quota call succeed.
//
// So this module is not here to slow down a runaway caller - there wasn't one.
// It is here so that a quota that never opens cannot turn into a slow drip of
// pointless requests, and so the page stays useful while it stays shut.
//
// Three things:
//
//   1. Backoff state lives in the database. `gbp_api_usage` already records
//      every call, so the block is derived from it - surviving restarts and
//      shared by every process. A Map in module scope did neither.
//   2. Exponential backoff with jitter, as Google's own guidance asks for. The
//      jitter matters once more than one tenant is waiting on the same window:
//      without it they all retry on the same tick.
//   3. Single-flight. Concurrent callers for one project share one request
//      instead of each spending a unit of quota to learn the same thing.

import { recentApiCalls } from './gbp-repository.js';

// First refusal waits a minute; each consecutive one doubles, to an hour. A
// quota that is pending approval will sit at the ceiling, which is correct -
// nothing changes until Google acts.
const BASE_BACKOFF_SECONDS = 60;
const MAX_BACKOFF_SECONDS = 3600;
const JITTER_RATIO = 0.25;

/** Full jitter on the upper quarter, so simultaneous waiters spread out. */
function withJitter(seconds) {
  const jitter = seconds * JITTER_RATIO * Math.random();
  return Math.round(seconds - seconds * JITTER_RATIO + jitter * 2);
}

export function backoffSeconds(consecutiveFailures) {
  if (consecutiveFailures <= 0) return 0;
  const raw = BASE_BACKOFF_SECONDS * 2 ** (consecutiveFailures - 1);
  return withJitter(Math.min(raw, MAX_BACKOFF_SECONDS));
}

function isQuotaRefusal(row) {
  return Number(row?.status_code) === 429 || row?.error_code === 'RESOURCE_EXHAUSTED';
}

/**
 * Whether a live call is allowed right now, and for how long it is not.
 *
 * Counts the unbroken run of 429s ending at the newest call: one success
 * anywhere in the recent history resets the ladder, which is what makes this
 * recover on its own the moment Google grants quota.
 *
 * @returns {{ blocked: boolean, retryAfterSeconds: number, consecutiveFailures: number,
 *             lastFailureAt: Date|null }}
 */
// An explicit action - finishing a consent screen, pressing Refresh - is worth
// one attempt even mid-backoff, because the user may have just had the quota
// approved and the ladder cannot know that. The floor stops that becoming a
// hammer: repeated clicking still costs at most one request a minute, and an
// automatic caller never gets this concession at all.
export const USER_RETRY_FLOOR_SECONDS = 60;

/**
 * @param {{ api?: string, endpoint?: string, userInitiated?: boolean }} options
 */
export async function quotaState(
  userId,
  projectId,
  { api = 'accountManagement', endpoint = '/accounts', userInitiated = false } = {}
) {
  let rows = [];
  try {
    rows = await recentApiCalls(userId, projectId, api, endpoint);
  } catch (error) {
    // Never let the guard itself break the request it is guarding.
    console.error('GBP quota state unavailable:', error?.message || error);
    return { blocked: false, retryAfterSeconds: 0, consecutiveFailures: 0, lastFailureAt: null };
  }

  let consecutiveFailures = 0;
  for (const row of rows) {
    if (!isQuotaRefusal(row)) break;
    consecutiveFailures += 1;
  }
  if (consecutiveFailures === 0) {
    return { blocked: false, retryAfterSeconds: 0, consecutiveFailures: 0, lastFailureAt: null };
  }

  // Age comes from SQL, not from subtracting a parsed DATETIME from Date.now():
  // the stored values are UTC strings read back through a non-UTC session, so
  // the JavaScript arithmetic was wrong by the server's UTC offset. See the
  // note on recentApiCalls().
  const waited = Number(rows[0].age_seconds);
  const required = userInitiated
    ? Math.min(backoffSeconds(consecutiveFailures), USER_RETRY_FLOOR_SECONDS)
    : backoffSeconds(consecutiveFailures);
  const remaining = Number.isFinite(waited) ? Math.ceil(required - waited) : 0;

  return {
    blocked: remaining > 0,
    retryAfterSeconds: Math.max(remaining, 0),
    consecutiveFailures,
    lastFailureAt: rows[0].created_at || null,
    waitedSeconds: Number.isFinite(waited) ? waited : null,
  };
}

// --- Single flight ---------------------------------------------------------
//
// Deliberately in-process. It exists to collapse the burst a single page load
// can produce - several components, several tabs, a double-clicked button -
// which all arrive at one Node process. Cross-process safety is the database
// backoff above; this is the cheap guard against the common case.

const inFlight = new Map();

/**
 * Runs `task` once per key, handing every concurrent caller the same promise.
 */
export function singleFlight(key, task) {
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => task())().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

export function quotaKey(userId, projectId, suffix = 'accounts') {
  return `${userId}:${projectId}:${suffix}`;
}
