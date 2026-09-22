// GET  /api/jira/issues/status   the transitions Jira offers on one issue
// POST /api/jira/issues/status   perform one of them
//
// This is the only endpoint in SEOX that changes a Jira issue on a user's
// direct instruction, and it does it by calling Jira. It does NOT write a
// status into jira_issue_links and call the ticket resolved - the local row
// is updated afterwards, from what Jira reports back, and only if Jira
// actually accepted the transition. If Jira is down, nothing changes
// anywhere, which is the only honest outcome.
//
// AUTHENTICATION IS admin_token AND NOTHING ELSE, matching the read-only feed
// on /api/jira/issues. No Authorization header is read, no cookie, no
// session. `functions/_lib/jira-eligible.js` owns that lookup and this file
// calls it rather than repeating it.
//
// AUTHORISATION is a separate question from authentication and is answered in
// four steps, because an admin_token identifies a SEOX user, not a right to
// drive somebody's Jira board:
//
//   1. the issue must have a jira_issue_links row owned by this user
//   2. that row's project must still have a usable connection and an active
//      mapping
//   3. the issue key's project prefix must match the mapped Jira project
//   4. the issue Jira returns must be the one we looked up
//
// Step 3 is what stops a caller passing OPS-9 to close a ticket on a board
// SEOX was never pointed at. Step 4 catches the case where an issue was
// MOVED between Jira projects after SEOX linked it.
//
// WHY THE SEO FINDING IS NOT MARKED FIXED HERE: resolving a Jira ticket is a
// claim, not evidence. applyIssueToLink() moves the finding to
// 'resolved_pending' (Awaiting verification) and queues the re-check that
// decides between 'verified' and 'reopened'. The two concepts stay separate,
// exactly as they do when the same transition arrives over the webhook.

import { configureMysqlConnection } from '../../../_lib/mysql.js';
import {
  corsHeaders,
  emptyResponse,
  jsonResponse,
  readJson,
} from '../../../_lib/http.js';
import { consumeRateLimit } from '../../../_lib/rate-limit.js';
import { authenticateAdmin, readAdminToken } from '../../../_lib/jira-eligible.js';
import { getConnectionById, getMapping } from '../../../_lib/jira-repository.js';
import { getLinkById, getOwnedLinkByIssueRef, logSync } from '../../../_lib/jira-store.js';
import { applyIssueToLink, fetchIssue } from '../../../_lib/jira-sync.js';
import {
  describeTransition,
  executeTransition,
  fetchTransitions,
  projectKeyOfIssueKey,
  selectTransition,
} from '../../../_lib/jira-transitions.js';
import { SEOX_STATE_LABELS, readIssueFields, toIso } from '../../../_lib/jira-status-map.js';
import { enqueueVerification } from '../../../_lib/jira-jobs.js';

const MAX_ISSUE_REF_LENGTH = 64;

function httpError(message, status, code = '') {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

function pick(params, key) {
  const value = params?.[key];
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/**
 * The issue the caller named. A key ("SEO-123") or the numeric Jira id are
 * both accepted, because the read-only feed serves the key and the webhook
 * payloads carry the id.
 */
function readIssueRef(params) {
  const issueKey = pick(params, 'jira_issue_key') || pick(params, 'issue_key');
  const issueId = pick(params, 'jira_issue_id') || pick(params, 'issue_id');

  if (!issueKey && !issueId) {
    throw httpError('jira_issue_key is required', 400);
  }
  if (issueKey.length > MAX_ISSUE_REF_LENGTH || issueId.length > MAX_ISSUE_REF_LENGTH) {
    throw httpError('Jira issue not found', 404);
  }
  return { issueKey, issueId };
}

/**
 * Everything the request needs, with every ownership check already applied.
 *
 * Shared by GET and POST on purpose: listing the transitions available on an
 * issue is itself a disclosure about somebody's Jira board, so it is gated
 * exactly as tightly as performing one.
 */
async function resolveContext(params) {
  const adminToken = readAdminToken(params);
  const admin = await authenticateAdmin(adminToken);
  const { issueKey, issueId } = readIssueRef(params);

  // 1. Ownership. An issue SEOX never filed for this user has no row, and is
  //    reported as not found rather than as forbidden - saying "forbidden"
  //    would confirm the issue exists.
  const link = await getOwnedLinkByIssueRef(admin.id, { issueKey, issueId });
  if (!link) throw httpError('Jira issue not found', 404);
  if (link.state === 'unlinked') {
    throw httpError('That finding is no longer linked to a Jira issue.', 409, 'UNLINKED');
  }
  if (!link.jira_issue_key && !link.jira_issue_id) {
    throw httpError('Jira issue not found', 404);
  }

  // A project_id in the request is a claim to be checked, never a selector:
  // the link row already decided which project this is.
  const claimedProjectId = pick(params, 'project_id');
  if (claimedProjectId && claimedProjectId !== link.project_id) {
    throw httpError('That Jira issue does not belong to the specified project.', 403, 'WRONG_PROJECT');
  }

  // 2. A usable connection and an active mapping.
  // String-compared because mysql2 hands BIGINT back as a number or a string
  // depending on driver configuration, and a === between the two forms would
  // silently fail open into "connection belongs to someone else".
  const connection = await getConnectionById(link.connection_id);
  if (!connection || String(connection.user_id) !== String(link.user_id)) {
    throw httpError('Jira integration is not configured', 409, 'NOT_CONNECTED');
  }
  if (connection.status === 'disconnected' || !connection.api_token_encrypted) {
    throw httpError('Jira integration is not configured', 409, 'NOT_CONNECTED');
  }
  if (connection.status === 'invalid_credentials') {
    throw httpError(
      'The stored Jira credentials are no longer valid. Reconnect Jira in Settings.',
      401,
      'INVALID_CREDENTIALS'
    );
  }

  // A mapping is required, but its `status` is deliberately NOT required to
  // be 'active'. That flag reports whether the mapping can still CREATE an
  // issue - it goes invalid when an issue-type or component id stops
  // resolving. None of that bears on moving an issue that already exists,
  // and refusing here would strand every open ticket behind a settings fix.
  // requireJiraMapping() in jira-request.js does insist on 'active', which is
  // right for the create path and wrong for this one.
  const mapping = await getMapping(link.user_id, link.project_id);
  if (!mapping) {
    throw httpError(
      'No Jira project is mapped for this SEOX project.',
      409,
      'NO_MAPPING'
    );
  }

  // 3. The issue key must belong to the mapped Jira project. This is the
  //    check that makes an arbitrary issue key useless: a row is only ever
  //    found for issues SEOX filed, and those always carry the mapped prefix.
  const keyForCheck = link.jira_issue_key || issueKey;
  const prefix = projectKeyOfIssueKey(keyForCheck);
  const mapped = String(mapping.jira_project_key || '').toUpperCase();
  if (prefix && mapped && prefix !== mapped) {
    throw httpError(
      'That Jira issue does not belong to the Jira project mapped to this SEOX project.',
      403,
      'WRONG_JIRA_PROJECT'
    );
  }

  return { admin, link, connection, mapping };
}

/** Jira's own errors already carry a status; keep it and its message. */
function statusOf(error) {
  return Number.isInteger(error?.status) ? error.status : 500;
}

function issueUrlFor(link, connection, issueKey) {
  if (link?.jira_issue_url) return link.jira_issue_url;
  const base = String(connection?.base_url || '').replace(/\/+$/, '');
  return base && issueKey ? `${base}/browse/${issueKey}` : '';
}

// --- GET: what can this issue do right now? --------------------------------

async function handleList(env, params) {
  const { link, connection } = await resolveContext(params);
  const issueRef = link.jira_issue_id || link.jira_issue_key;

  const transitions = await fetchTransitions(env, connection, issueRef);

  return {
    success: true,
    data: {
      jira_issue_key: link.jira_issue_key,
      jira_issue_id: link.jira_issue_id,
      jira_issue_url: issueUrlFor(link, connection, link.jira_issue_key),
      current_status: link.jira_status || null,
      current_status_category: link.jira_status_category || null,
      seox_state: link.seox_state,
      seox_state_label: SEOX_STATE_LABELS[link.seox_state] || link.seox_state,
      transitions: transitions.map(describeTransition),
    },
  };
}

// --- POST: perform one -----------------------------------------------------

async function handleTransition(env, params) {
  const { admin, link, connection, mapping } = await resolveContext(params);
  await consumeRateLimit(admin.id, 'jira:transition');

  const issueRef = link.jira_issue_id || link.jira_issue_key;
  const started = Date.now();

  // What the caller asked for. An explicit transition_id wins; a status name
  // is next; with neither, "resolve" is the default because that is what the
  // Resolve button sends.
  const request = {
    transitionId: pick(params, 'transition_id'),
    status: pick(params, 'status'),
    intent: pick(params, 'action') || pick(params, 'intent') || 'resolve',
  };

  // Read the issue BEFORE transitioning, so "previous_status" is Jira's
  // truth at this moment rather than whatever SEOX last cached. It also
  // catches an issue deleted or moved out of reach since the link was made.
  const before = await fetchIssue(env, connection, issueRef);
  if (!before) {
    throw httpError('Jira issue not found', 404, 'ISSUE_GONE');
  }
  const previous = readIssueFields(before);

  // 4. The issue Jira served must be the one we authorised. An issue moved
  //    to another Jira project keeps its id and gains a new key.
  const servedPrefix = projectKeyOfIssueKey(previous.key);
  const mapped = String(mapping.jira_project_key || '').toUpperCase();
  if (servedPrefix && mapped && servedPrefix !== mapped) {
    throw httpError(
      `That Jira issue now lives in Jira project ${servedPrefix}, which is not mapped to this SEOX project.`,
      403,
      'ISSUE_MOVED'
    );
  }

  const transitions = await fetchTransitions(env, connection, issueRef);
  const selection = selectTransition(transitions, request);

  if (selection.error) {
    // Not a server fault and not a Jira fault - the workflow simply has no
    // such step. The available list is returned so the caller can offer what
    // does exist instead of guessing again.
    return {
      status: 400,
      payload: {
        success: false,
        error: selection.error,
        code: selection.code,
        data: {
          jira_issue_key: previous.key,
          current_status: previous.status,
          available_transitions: transitions.map(describeTransition),
        },
      },
    };
  }

  const transition = selection.transition;
  await executeTransition(env, connection, issueRef, transition.id);

  // Re-read rather than assume. A Jira post-function can set a resolution,
  // reassign the issue, or route it somewhere other than the transition's
  // nominal destination; SEOX stores what happened, not what it asked for.
  const after = await fetchIssue(env, connection, issueRef);
  const current = after ? readIssueFields(after) : previous;

  // Only now does the SEOX side move, and it moves to 'resolved_pending'
  // (Awaiting verification) - not 'verified'. The Jira ticket being closed is
  // not evidence the SEO problem is gone.
  let applied = { applied: false };
  let refreshed = link;
  if (after) {
    try {
      applied = await applyIssueToLink(link, after);
      refreshed = (await getLinkById(link.user_id, link.id)) || link;
    } catch (error) {
      // Jira HAS been changed by this point. Turning a database hiccup into
      // an error response would tell the user their transition did not
      // happen, which would be false and would invite them to retry it. The
      // reconcile sweep re-reads the issue within 30 minutes and repairs the
      // row, so the only real cost is a stale status until then.
      console.error('Jira transition succeeded but the local link update failed:', error?.message || error);
    }
  }

  if (applied.applied && applied.shouldVerify) {
    try {
      await enqueueVerification({ link: refreshed, mapping });
    } catch (error) {
      // Verification is a follow-up, not part of the transition. A queue that
      // is not installed must not turn a successful Jira change into a 500.
      console.warn('Could not queue SEOX verification after a Jira transition:', error?.message || error);
    }
  }

  await logSync({
    userId: link.user_id,
    projectId: link.project_id,
    linkId: link.id,
    action: 'issue.transition',
    direction: 'outbound',
    result: 'success',
    jiraIssueKey: current.key || link.jira_issue_key,
    message: `Transitioned ${current.key || link.jira_issue_key} from "${previous.status || 'unknown'}" to "${
      current.status || transition.to?.name || 'unknown'
    }" via "${transition.name}".`,
    durationMs: Date.now() - started,
    actorEmail: null,
    actorKind: 'user',
    context: {
      transitionId: String(transition.id),
      transitionName: transition.name,
      requested: request,
    },
  });

  return {
    status: 200,
    payload: {
      success: true,
      message: `Jira ticket ${current.key || link.jira_issue_key} updated successfully`,
      data: {
        jira_issue_key: current.key || link.jira_issue_key,
        jira_issue_id: current.id || link.jira_issue_id,
        jira_issue_url: issueUrlFor(refreshed, connection, current.key || link.jira_issue_key),
        previous_status: previous.status,
        previous_status_category: previous.statusCategory,
        new_status: current.status,
        new_status_category: current.statusCategory,
        jira_resolution: current.resolution,
        jira_priority: current.priority,
        jira_assignee: current.assigneeName,
        transition_id: String(transition.id),
        transition_name: transition.name,
        // The SEOX side, kept deliberately distinct from the Jira side.
        seox_state: refreshed.seox_state,
        seox_state_label: SEOX_STATE_LABELS[refreshed.seox_state] || refreshed.seox_state,
        awaiting_verification: Boolean(applied.shouldVerify),
        last_synced_at: toIso(refreshed.last_synced_at),
        updated_at: toIso(current.remoteUpdatedAt) || new Date().toISOString(),
      },
    },
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

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const payload = await handleList(env, Object.fromEntries(url.searchParams.entries()));
      return jsonResponse(payload, 200, headers);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method not allowed' }, 405, headers);
    }

    const body = await readJson(request);
    const result = await handleTransition(env, body || {});
    return jsonResponse(result.payload, result.status, headers);
  } catch (error) {
    const status = statusOf(error);
    // Errors raised here and by the Jira client carry a status, so their
    // message is safe. Anything else is a driver or runtime failure: log it,
    // and say nothing that could describe the server's internals.
    if (status >= 500) {
      console.error('Jira status update failed:', error?.message || error);
    }
    return jsonResponse(
      {
        success: false,
        error: status >= 500 ? 'Failed to update the Jira ticket' : error.message,
        ...(error?.code ? { code: error.code } : {}),
        ...(error?.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
      },
      status,
      headers
    );
  }
}
