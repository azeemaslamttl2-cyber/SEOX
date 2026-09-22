// Applying Jira state to SEOX, and the operations SEOX performs back on Jira.
//
// SEOX writes to Jira in exactly four situations and never more: creating an
// issue, commenting with a verification result, transitioning an issue back
// open when a finding recurs, and performing a transition a user explicitly
// asked for on the Jira Tickets page (functions/api/jira/issues/status.js).
// It never changes the assignee, the priority after creation, or the sprint,
// and it never closes anything on its own initiative. A tool that silently
// closes a team's tickets loses their trust permanently - the fourth case is
// not an exception to that, because a human clicked it.

import { jiraRequestForConnection } from './jira-client.js';
import {
  applyRemoteState,
  logSync,
  parseJson,
  saveLatestComment,
  setLinkSeoxState,
  markLinkOrphaned,
} from './jira-store.js';
import {
  isStaleUpdate,
  mapJiraStateToSeox,
  readIssueFields,
  toEpochMs,
  SEOX_STATES,
} from './jira-status-map.js';
import { adfToPlainText, buildVerificationComment, buildRecurrenceComment } from './jira-issue-builder.js';
import { executeTransition, fetchTransitions, selectTransition } from './jira-transitions.js';

const SEARCH_FIELDS = 'status,resolution,assignee,priority,updated,created,summary';

/**
 * Apply one Jira issue's current state to its SEOX link row.
 *
 * @returns {{applied: boolean, stale?: boolean, seoxState?: string,
 *            shouldVerify?: boolean}}
 */
export async function applyIssueToLink(link, issue) {
  const remote = readIssueFields(issue);

  // Discarding anything not newer than what we hold is what makes duplicate
  // and out-of-order delivery harmless, so a webhook and a poll can race.
  if (isStaleUpdate(link.remote_updated_at, remote.remoteUpdatedAt)) {
    return { applied: false, stale: true };
  }

  const { seoxState, shouldVerify } = mapJiraStateToSeox({
    statusCategory: remote.statusCategory,
    resolution: remote.resolution,
    currentState: link.seox_state,
  });

  await applyRemoteState(link.id, { ...remote, seoxState });

  return { applied: true, seoxState, shouldVerify, remote };
}

/** Fetch one issue. A 404 means it was deleted or moved out of reach. */
export async function fetchIssue(env, connection, issueIdOrKey) {
  try {
    const { data } = await jiraRequestForConnection(env, connection, {
      path: `/rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}`,
      query: { fields: SEARCH_FIELDS },
      kind: 'interactive',
    });
    return data;
  } catch (error) {
    if (error?.httpStatus === 404) return null;
    throw error;
  }
}

/**
 * The reconciliation sweep.
 *
 * ONE JQL search per project, not one call per issue. That is what keeps the
 * cost O(projects) rather than O(linked findings) and keeps the integration
 * inside Jira's rate limit at scale.
 *
 * The lookback window deliberately overlaps the schedule, so a slow run or a
 * little clock skew cannot drop an update.
 */
export async function reconcileProject(env, { connection, mapping, links, lookbackMinutes = 40 }) {
  if (!links.length) return { checked: 0, updated: 0, verifyQueue: [], missing: [] };

  const jql = `project = "${mapping.jira_project_key}" AND labels = "seox" AND updated >= "-${lookbackMinutes}m" ORDER BY updated DESC`;

  const byIssueId = new Map(links.filter((link) => link.jira_issue_id).map((link) => [String(link.jira_issue_id), link]));

  const updated = [];
  const verifyQueue = [];
  let startAt = 0;
  let checked = 0;

  // Paged, and hard-capped: a reconcile must never turn into an unbounded
  // walk of a large project.
  for (let page = 0; page < 10; page += 1) {
    const { data } = await jiraRequestForConnection(env, connection, {
      path: '/rest/api/3/search',
      query: { jql, fields: SEARCH_FIELDS, maxResults: 100, startAt },
    });

    const issues = Array.isArray(data?.issues) ? data.issues : [];
    checked += issues.length;

    for (const issue of issues) {
      const link = byIssueId.get(String(issue.id));
      if (!link) continue;
      const result = await applyIssueToLink(link, issue);
      if (!result.applied) continue;
      updated.push({ linkId: link.id, seoxState: result.seoxState });
      if (result.shouldVerify) verifyQueue.push(link);
    }

    startAt += issues.length;
    if (issues.length === 0 || startAt >= Number(data?.total || 0)) break;
  }

  return { checked, updated, verifyQueue, missing: [] };
}

/**
 * Individually re-check links the sweep has not seen for a long time.
 *
 * A link the JQL window never returns is either simply quiet, or its issue
 * was deleted in Jira. Only the second case matters, and it is resolved by a
 * direct fetch rather than by guessing.
 */
export async function detectOrphans(env, { connection, links, staleDays = 7, limit = 10 }) {
  const cutoff = Date.now() - staleDays * 24 * 60 * 60 * 1000;
  const candidates = links
    .filter((link) => {
      const seen = toEpochMs(link.last_synced_at);
      return !Number.isNaN(seen) && seen < cutoff;
    })
    .slice(0, limit);

  const orphaned = [];
  for (const link of candidates) {
    const issue = await fetchIssue(env, connection, link.jira_issue_id || link.jira_issue_key);
    if (issue === null) {
      await markLinkOrphaned(link.id);
      orphaned.push(link.id);
      await logSync({
        userId: link.user_id,
        projectId: link.project_id,
        linkId: link.id,
        action: 'issue.sync',
        direction: 'inbound',
        result: 'error',
        jiraIssueKey: link.jira_issue_key,
        message: 'The Jira issue no longer exists.',
        actorKind: 'system',
      });
    } else {
      await applyIssueToLink(link, issue);
    }
  }
  return orphaned;
}

// --- Writes back to Jira ---------------------------------------------------

export async function postComment(env, connection, issueIdOrKey, adfBody) {
  const { data, durationMs } = await jiraRequestForConnection(env, connection, {
    path: `/rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}/comment`,
    method: 'POST',
    body: { body: adfBody },
  });
  return { id: data?.id || null, durationMs };
}

export async function postVerificationComment(env, connection, link, result, passed) {
  const body = buildVerificationComment(result, {
    url: result.url || link.affected_url || '',
    passed,
  });
  return postComment(env, connection, link.jira_issue_id || link.jira_issue_key, body);
}

export async function postRecurrenceComment(env, connection, link) {
  const body = buildRecurrenceComment({
    url: link.affected_url || '',
    when: new Date().toISOString().slice(0, 10),
  });
  return postComment(env, connection, link.jira_issue_id || link.jira_issue_key, body);
}

/**
 * Move an issue back to an open status.
 *
 * Many Jira workflows forbid Done -> To Do outright. When no suitable
 * transition is available this reports that rather than failing, and the
 * caller falls back to a comment - which is the honest outcome.
 */
export async function transitionToOpen(env, connection, link) {
  const issueId = link.jira_issue_id || link.jira_issue_key;

  // Same resolution rules the user-initiated status endpoint uses, so an
  // automatic reopen and a manual one cannot disagree about which transition
  // "open" means on a given board.
  const transitions = await fetchTransitions(env, connection, issueId, { kind: 'background' });
  const selection = selectTransition(transitions, { intent: 'reopen' });

  if (selection.error) {
    return { transitioned: false, reason: 'no_transition_available' };
  }

  await executeTransition(env, connection, issueId, selection.transition.id);

  return { transitioned: true, to: selection.transition.to?.name || '' };
}

/**
 * Cache the most recent Jira comment against the link, for display in SEOX.
 *
 * Only the latest comment is kept: Jira owns the thread and is one click
 * away, and storing every comment means retaining arbitrary third-party user
 * content indefinitely for no real benefit. The body is flattened to plain
 * text - third-party rich text is never rendered as HTML in the SEOX UI.
 */
export async function cacheLatestComment(link, comment, commentCount) {
  if (!comment) return;
  await saveLatestComment(
    link.id,
    {
      id: String(comment.id || ''),
      authorDisplayName: comment.author?.displayName || 'Someone',
      authorAccountId: comment.author?.accountId || null,
      createdAt: comment.created || comment.updated || null,
      bodyText: adfToPlainText(comment.body).replace(/\n{2,}/g, '\n').trim().slice(0, 500),
    },
    commentCount
  );
}

/** Settle a link after a verification run. */
export async function applyVerificationOutcome({ link, result, mapping, env, connection }) {
  if (result.outcome === 'manual') {
    await setLinkSeoxState(link.id, SEOX_STATES.VERIFIED, {
      verifiedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      verificationResult: { outcome: 'manual', reason: result.reason || '', checkedAt: result.checkedAt },
      resetVerificationAttempts: true,
    });
    return { state: SEOX_STATES.VERIFIED, commented: false };
  }

  if (result.outcome === 'unavailable') {
    // SEOX could not reach the site. That is not evidence the fix failed, so
    // the finding stays awaiting verification and nothing is said in Jira.
    await setLinkSeoxState(link.id, SEOX_STATES.RESOLVED_PENDING, {
      verificationResult: result,
      incrementVerificationAttempts: true,
    });
    return { state: SEOX_STATES.RESOLVED_PENDING, commented: false, unavailable: true };
  }

  const passed = result.outcome === 'passed';

  await setLinkSeoxState(link.id, passed ? SEOX_STATES.VERIFIED : SEOX_STATES.REOPENED, {
    verifiedAt: passed ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
    verificationResult: result,
    incrementReopened: !passed,
    resetVerificationAttempts: true,
  });

  let commented = false;
  const shouldComment = passed
    ? mapping.post_verification_comments !== 0
    : true; // a failed verification is always worth saying out loud

  if (shouldComment && connection) {
    try {
      await postVerificationComment(env, connection, link, result, passed);
      commented = true;
    } catch (error) {
      console.warn('Jira verification comment failed:', error?.message || error);
    }
  }

  let transition = null;
  if (!passed && connection && mapping.reopen_behaviour === 'reopen') {
    try {
      transition = await transitionToOpen(env, connection, link);
    } catch (error) {
      transition = { transitioned: false, reason: error?.message || 'transition_failed' };
    }
  }

  return { state: passed ? SEOX_STATES.VERIFIED : SEOX_STATES.REOPENED, commented, transition };
}

export { parseJson };
