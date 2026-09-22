// Translating a Jira issue's state into a SEOX finding state.
//
// The rule that matters: map on statusCategory, NEVER on the status name.
// Jira statuses are per-project and fully customisable - a team that renames
// "In Progress" to "Doing", adds "Blocked", or runs a localised Jira breaks
// any name-based mapping immediately. Every Jira status belongs to exactly
// one of three categories, and those are stable:
//
//   new           -> To Do
//   indeterminate -> In Progress
//   done          -> Done
//
// Resolutions are customisable too, so "was it actually fixed?" is decided by
// a pattern match with the raw value stored alongside, which means a
// mis-classification can be audited and the pattern tuned without a
// migration.

/** SEOX finding states. */
export const SEOX_STATES = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED_PENDING: 'resolved_pending',
  VERIFIED: 'verified',
  REOPENED: 'reopened',
  WONT_FIX: 'wont_fix',
  UNLINKED: 'unlinked',
});

export const SEOX_STATE_LABELS = Object.freeze({
  open: 'Open',
  in_progress: 'In progress',
  resolved_pending: 'Awaiting verification',
  verified: 'Verified fixed',
  reopened: 'Reopened - still present',
  wont_fix: "Won't fix",
  unlinked: 'Not linked',
});

// Resolutions that mean "this will not be fixed", so there is nothing to
// verify. Anything else that reaches a done category is treated as a genuine
// fix and gets re-checked.
const NOT_FIXED_RESOLUTION = /won.?t|declin|duplicat|cannot reproduce|can'?t reproduce|not a bug|invalid|abandon|obsolete/i;

export function isNotFixedResolution(resolutionName) {
  const value = String(resolutionName || '').trim();
  if (!value) return false;
  return NOT_FIXED_RESOLUTION.test(value);
}

/**
 * @param {object} input
 * @param {string} input.statusCategory  'new' | 'indeterminate' | 'done'
 * @param {string} [input.resolution]    the resolution NAME, or empty
 * @param {string} [input.currentState]  the SEOX state we already hold
 * @returns {{seoxState: string, shouldVerify: boolean}}
 */
export function mapJiraStateToSeox({ statusCategory, resolution, currentState } = {}) {
  const category = String(statusCategory || '').trim().toLowerCase();

  if (category === 'done') {
    if (isNotFixedResolution(resolution)) {
      return { seoxState: SEOX_STATES.WONT_FIX, shouldVerify: false };
    }
    // Already settled by a verification run - a later sync of the same
    // done state must not drag it back to "awaiting verification".
    if (currentState === SEOX_STATES.VERIFIED || currentState === SEOX_STATES.REOPENED) {
      return { seoxState: currentState, shouldVerify: false };
    }
    return { seoxState: SEOX_STATES.RESOLVED_PENDING, shouldVerify: true };
  }

  if (category === 'indeterminate') {
    return { seoxState: SEOX_STATES.IN_PROGRESS, shouldVerify: false };
  }

  // 'new', or an unrecognised category: treat as open. Being wrong in the
  // "open" direction is safe; being wrong in the "done" direction would
  // trigger a pointless re-crawl and possibly a misleading Jira comment.
  return { seoxState: SEOX_STATES.OPEN, shouldVerify: false };
}

/** Pull the fields SEOX cares about out of a Jira issue resource. */
export function readIssueFields(issue) {
  const fields = issue?.fields || {};
  return {
    id: String(issue?.id || ''),
    key: String(issue?.key || ''),
    status: fields.status?.name || null,
    statusCategory: fields.status?.statusCategory?.key || null,
    resolution: fields.resolution?.name || null,
    priority: fields.priority?.name || null,
    assigneeId: fields.assignee?.accountId || null,
    // Display name only. A Jira user's email address is third-party personal
    // data SEOX has no need for, so it is never persisted.
    assigneeName: fields.assignee?.displayName || null,
    remoteCreatedAt: toMysqlDatetime(fields.created),
    remoteUpdatedAt: toMysqlDatetime(fields.updated),
    summary: fields.summary || null,
  };
}

/**
 * Parse any timestamp shape that reaches this module into epoch milliseconds.
 *
 * Three shapes actually occur and they must not be confused:
 *   - a JS Date, because mysql2 returns DATETIME columns as Date objects
 *   - "2026-09-21 09:30:00", a bare MySQL datetime, which this schema stores
 *     in UTC and which `new Date()` would otherwise read as LOCAL time
 *   - "2026-09-21T09:30:00.000+0000" or "...Z", the ISO forms Jira sends
 *
 * Returns NaN for anything unparseable, so callers can fail open rather than
 * silently comparing against an Invalid Date.
 */
export function toEpochMs(value) {
  if (!value) return Number.NaN;
  if (value instanceof Date) return value.getTime();

  const raw = String(value).trim();
  if (!raw) return Number.NaN;

  // A bare MySQL datetime carries no zone. Everything this schema writes is
  // UTC, so say so explicitly instead of letting the host timezone decide.
  const bare = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/;
  const normalised = bare.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw;

  return new Date(normalised).getTime();
}

export function toMysqlDatetime(value) {
  const ms = toEpochMs(value);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

/** ISO 8601, for API responses. Never a host-local string. */
export function toIso(value) {
  const ms = toEpochMs(value);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toISOString();
}

/**
 * Has this update already been applied?
 *
 * Every inbound change carries the issue's `updated` timestamp. Discarding
 * anything not newer than what we hold makes duplicate delivery and
 * out-of-order delivery both harmless, so a webhook and a reconcile poll can
 * race freely.
 *
 * Fails open: if either side cannot be parsed the update is applied, because
 * applying a change twice is recoverable and dropping one silently is not.
 */
export function isStaleUpdate(storedUpdatedAt, incomingUpdatedAt) {
  const incoming = toEpochMs(incomingUpdatedAt);
  const stored = toEpochMs(storedUpdatedAt);
  if (Number.isNaN(incoming) || Number.isNaN(stored)) return false;
  return incoming <= stored;
}

/** Severity -> Jira priority id, from the project mapping. */
export function resolvePriorityId(severity, severityPriorityMap, fallbackPriorityId) {
  const key = String(severity || '').trim().toLowerCase();
  const mapped = severityPriorityMap?.[key];
  return mapped || fallbackPriorityId || null;
}

/**
 * Normalise the severity scales other SEOX modules use onto the auditor's
 * three (error / warning / notice), which is what the priority map keys on.
 */
export function normalizeSeverity(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (['critical', 'high', 'error', 'blocker', 'severe'].includes(raw)) return 'error';
  if (['medium', 'warning', 'warn', 'moderate'].includes(raw)) return 'warning';
  if (['low', 'info', 'notice', 'informational', 'minor'].includes(raw)) return 'notice';
  return 'warning';
}
