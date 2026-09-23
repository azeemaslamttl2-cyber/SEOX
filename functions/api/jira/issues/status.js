// GET  /api/jira/issues/status   the transitions Jira offers on one issue
// POST /api/jira/issues/status   perform one of them, and/or leave a review
//
// THE REVIEW IS A JIRA COMMENT, NOT A SEOX NOTE. `review` on the POST body is
// posted to /rest/api/3/issue/{key}/comment and appears in the ticket's own
// activity stream, where the team reading the board will actually see it.
// Storing it locally instead would be a private note dressed up as a reply.
//
// The two writes are ORDERED AND REPORTED SEPARATELY, because they can
// disagree:
//
//   - transition refused  -> no comment is posted at all, and the transition
//     error is returned. Commenting on a ticket that did not move would leave
//     a review describing a state change that never happened.
//   - transition applied, comment refused -> `statusUpdated: true` with
//     `commentAdded: false` and `success: false`. This is the case the split
//     flags exist for: the request must not be reported as wholly successful,
//     and it must not be reported as wholly failed either, because Jira HAS
//     moved and a retry would move it again.
//
// A review with no status is a comment on its own. That is only inferred when
// the request names no transition_id, status, action or intent - a bare POST
// with none of those and no review still means "resolve", which is what the
// Resolve button has always sent.
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
// AUTHORISATION is a separate question from authentication, because an
// admin_token identifies a SEOX user, not a right to drive somebody's Jira
// board. The rule is: THE ISSUE MUST LIVE IN A JIRA PROJECT THIS USER HAS
// MAPPED. That is established one of two ways:
//
//   a. the issue has a jira_issue_links row owned by this user (SEOX filed
//      it), and that row's project has a mapping; or
//   b. there is no link row but the request names an internal project, and
//      THAT project's mapping names the Jira project the issue key belongs
//      to; or
//   c. there is no link row and no project_id, and the issue key's project
//      prefix matches one of this user's rows in jira_project_mappings
//
// (b) and (c) exist because the Jira Tickets page shows the real contents of
// a mapped Jira project, and most of that was raised by hand in Jira rather
// than filed by SEOX. Those tickets have no link row but are still
// legitimately actionable - the mapping is precisely the user saying "this
// Jira project belongs to this SEOX project". Without them the Resolve button
// would 404 on almost every ticket on screen.
//
// (b) is separate from (c) and takes priority over it, because a project_id
// the caller supplied has to MEAN something. Resolved through (c) it would
// not: the mapping would be looked up from the issue key, so WPGC-1 sent with
// the internal project that maps to WUCP would be accepted - the key would
// find its own mapping and agree with itself. Under (b) the named project
// supplies the mapping and the key is checked against it, so that request is
// refused with WRONG_JIRA_PROJECT, which is the whole chain the endpoint
// promises: admin_token + internal project + mapping + issue.
//
// Any of the three, an arbitrary key such as OPS-9 on a board nobody mapped
// matches no mapping and is refused. Then:
//
//   - the connection behind that mapping must be usable
//   - the issue Jira actually SERVES must still be in that project, which
//     catches an issue MOVED between Jira projects after SEOX linked it
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
import {
  getConnectionById,
  getMapping,
  getMappingByJiraProjectKey,
} from '../../../_lib/jira-repository.js';
import { findProjectByKey, listAllJiraProjectsForUser } from '../../../_lib/jira-projects.js';
import { getLinkById, getOwnedLinkByIssueRef, logSync } from '../../../_lib/jira-store.js';
import { applyIssueToLink, fetchIssue, postComment } from '../../../_lib/jira-sync.js';
import { readReview, reviewToAdf } from '../../../_lib/jira-review.js';
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
  const issueKey =
    pick(params, 'jira_issue_key') || pick(params, 'issue_key') || pick(params, 'issueKey');
  const issueId =
    pick(params, 'jira_issue_id') || pick(params, 'issue_id') || pick(params, 'issueId');

  if (!issueKey && !issueId) {
    throw httpError('jira_issue_key is required', 400);
  }
  if (issueKey.length > MAX_ISSUE_REF_LENGTH || issueId.length > MAX_ISSUE_REF_LENGTH) {
    throw httpError('Jira issue not found', 404);
  }
  return { issueKey, issueId };
}

/**
 * Post the review, and report rather than throw.
 *
 * By the time this is called in the status+review case, Jira has ALREADY been
 * changed. An exception here would unwind into an error response saying the
 * whole request failed - which would be false, and would invite a retry that
 * transitions the issue a second time.
 */
async function addReview(env, connection, issueRef, review) {
  try {
    const posted = await postComment(env, connection, issueRef, reviewToAdf(review));
    return { added: true, id: posted?.id || null, status: 200, error: '' };
  } catch (error) {
    const status = statusOf(error);
    console.error('Jira review/comment failed:', error?.message || error);
    return {
      added: false,
      id: null,
      // A Jira 4xx is the user's problem to see (no permission to comment, a
      // payload Jira rejected); anything else is ours and is not described.
      status: status >= 500 ? 502 : status,
      error: status >= 500 ? 'Jira did not accept the review/comment.' : error.message,
    };
  }
}

/**
 * Can this user's Jira credential see that project at all?
 *
 * Used only to choose between "you have not mapped this" and "no such
 * issue". It discloses nothing new: the caller is asking about a project
 * whose issues the tickets feed would already have listed for them.
 */
async function isProjectVisible(env, userId, projectKey) {
  try {
    const { projects } = await listAllJiraProjectsForUser(env, userId);
    return Boolean(findProjectByKey(projects, projectKey));
  } catch {
    // If Jira cannot be asked, fall back to the conservative answer.
    return false;
  }
}

/**
 * Everything the request needs, with every ownership check already applied.
 *
 * Shared by GET and POST on purpose: listing the transitions available on an
 * issue is itself a disclosure about somebody's Jira board, so it is gated
 * exactly as tightly as performing one.
 */
async function resolveContext(env, params) {
  const adminToken = readAdminToken(params);
  const admin = await authenticateAdmin(adminToken);
  const { issueKey, issueId } = readIssueRef(params);

  // 1. Is this an issue SEOX filed? If so its link row decides everything.
  const link = await getOwnedLinkByIssueRef(admin.id, { issueKey, issueId });
  if (link && link.state === 'unlinked') {
    throw httpError('That finding is no longer linked to a Jira issue.', 409, 'UNLINKED');
  }

  // A project_id in the request is a claim to be checked, never a selector:
  // when a link row exists, it already decided which project this is.
  const claimedProjectId = pick(params, 'project_id');
  if (link && claimedProjectId && claimedProjectId !== link.project_id) {
    throw httpError('That Jira issue does not belong to the specified project.', 403, 'WRONG_PROJECT');
  }

  // 2. No link row is NOT the end of the road.
  //
  //    The Jira Tickets page shows the real contents of a mapped Jira
  //    project, and most of that was raised by hand in Jira rather than filed
  //    by SEOX, so it has no link row. Those tickets are still legitimately
  //    actionable: the user explicitly mapped that Jira project to one of
  //    their own SEOX projects, and that mapping is what grants SEOX the
  //    right to drive the board at all.
  //
  //    The security property is unchanged. Authorisation is still "this Jira
  //    project is one YOU mapped" - it is simply now checked against
  //    jira_project_mappings directly instead of only via a link row. An
  //    arbitrary key such as OPS-9, on a board nobody mapped, matches no
  //    mapping and is refused exactly as before.
  const referencedKey = link?.jira_issue_key || issueKey;
  const prefix = projectKeyOfIssueKey(referencedKey);

  let mapping;
  if (link) {
    // See the note below about why 'active' is not required.
    mapping = await getMapping(link.user_id, link.project_id);
    if (!mapping) {
      throw httpError('No Jira project is mapped for this SEOX project.', 409, 'NO_MAPPING');
    }
  } else if (claimedProjectId) {
    // *** THE CALLER NAMED AN INTERNAL PROJECT, SO THAT PROJECT DECIDES ***
    //
    // Without this branch a project_id on a ticket SEOX did not file is
    // decorative: the lookup below would find the mapping belonging to
    // whatever Jira project the KEY happens to name, and an issue on a board
    // mapped to a different site would be accepted under the identifier of
    // the site the user is actually looking at. The Jira project that may be
    // driven is the one THIS internal project is mapped to, and the issue
    // then has to belong to it - which step 3 checks, and which is the whole
    // chain: admin_token + internal project + mapping + issue.
    //
    // An issue ID with no key still cannot be authorised here, for the same
    // reason as below: the project key lives in the key.
    if (!prefix) throw httpError('Jira issue not found', 404);
    mapping = await getMapping(admin.id, claimedProjectId);
    if (!mapping || !mapping.jira_project_key) {
      throw httpError('No Jira project is mapped with this project.', 409, 'NO_MAPPING');
    }
  } else {
    // Without a link row an issue ID alone is not enough - the project key
    // lives in the KEY, and it is the key that gets authorised.
    if (!prefix) throw httpError('Jira issue not found', 404);
    mapping = await getMappingByJiraProjectKey(admin.id, prefix);
    if (!mapping) {
      // READING is broader than WRITING, deliberately.
      //
      // The Jira Tickets page lists every Jira project the user's own
      // credential can see, so they can browse a board SEOX was never
      // pointed at. Changing an issue is a different matter: it edits
      // somebody's board, and the mapping is the user's explicit statement
      // that SEOX may act on that project.
      //
      // So a visible-but-unmapped project is refused - but it is refused
      // HONESTLY. Saying "not found" about an issue the user is looking at
      // on screen sends them hunting for a typo that does not exist. The
      // extra listing call happens only on this error path.
      const visible = await isProjectVisible(env, admin.id, prefix);
      if (visible) {
        throw httpError(
          `SEOX can show tickets from Jira project ${prefix}, but can only change issues in a Jira project that is mapped to a SEOX project. Map ${prefix} in Settings > Jira to resolve its tickets from here.`,
          409,
          'JIRA_PROJECT_NOT_MAPPED'
        );
      }
      throw httpError('Jira issue not found', 404);
    }
  }

  // 3. The issue key must belong to the mapped Jira project. This is the
  //    check that makes an arbitrary issue key useless.
  const mapped = String(mapping.jira_project_key || '').toUpperCase();
  if (prefix && mapped && prefix !== mapped) {
    throw httpError(
      'That Jira issue does not belong to the Jira project mapped to this SEOX project.',
      403,
      'WRONG_JIRA_PROJECT'
    );
  }

  // 4. A usable connection.
  // String-compared because mysql2 hands BIGINT back as a number or a string
  // depending on driver configuration, and a === between the two forms would
  // silently fail open into "connection belongs to someone else".
  const connectionId = link?.connection_id || mapping.connection_id;
  const connection = await getConnectionById(connectionId);
  if (!connection || String(connection.user_id) !== String(admin.id)) {
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

  // The mapping's `status` is deliberately NOT required to be 'active'. That
  // flag reports whether the mapping can still CREATE an issue - it goes
  // invalid when an issue-type or component id stops resolving. None of that
  // bears on moving an issue that already exists, and refusing here would
  // strand every open ticket behind a settings fix. requireJiraMapping() in
  // jira-request.js does insist on 'active', which is right for the create
  // path and wrong for this one.

  return { admin, link, connection, mapping, issueKey: referencedKey };
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
  const { link, connection, issueKey } = await resolveContext(env, params);
  // A ticket SEOX did not file has no link row, so the key from the request
  // - already authorised against the mapping - is the reference.
  const issueRef = link?.jira_issue_id || link?.jira_issue_key || issueKey;

  const transitions = await fetchTransitions(env, connection, issueRef);

  return {
    success: true,
    data: {
      jira_issue_key: link?.jira_issue_key || issueKey,
      jira_issue_id: link?.jira_issue_id || null,
      jira_issue_url: issueUrlFor(link, connection, link?.jira_issue_key || issueKey),
      // Cached, and only present for a ticket SEOX filed. The authoritative
      // current status is whatever the transitions below are computed from.
      current_status: link?.jira_status || null,
      current_status_category: link?.jira_status_category || null,
      created_by_seox: Boolean(link),
      seox_state: link?.seox_state || null,
      seox_state_label: link ? SEOX_STATE_LABELS[link.seox_state] || link.seox_state : null,
      transitions: transitions.map(describeTransition),
    },
  };
}

// --- POST: perform one, and/or leave a review ------------------------------

async function handleUpdate(env, params) {
  const { admin, link, connection, mapping, issueKey } = await resolveContext(env, params);
  // One budget covers both writes. They are the same endpoint spending the
  // same Jira credential on the same ticket, and a separate, looser comment
  // bucket would just be a way around the transition limit.
  await consumeRateLimit(admin.id, 'jira:transition');

  const issueRef = link?.jira_issue_id || link?.jira_issue_key || issueKey;
  const started = Date.now();
  const review = readReview(params);

  // What the caller asked for. An explicit transition_id wins; a status name
  // is next.
  const request = {
    transitionId: pick(params, 'transition_id') || pick(params, 'transitionId'),
    status: pick(params, 'status'),
    intent: pick(params, 'action') || pick(params, 'intent'),
  };

  // Does this request move the ticket at all?
  //
  // Naming any of the three above says yes. Naming NONE of them says yes too
  // - UNLESS a review was supplied, which is the single case where silence
  // means "comment only". That asymmetry is deliberate backward
  // compatibility: the Resolve button has always POSTed nothing but an issue
  // key and meant "resolve", so a request that says nothing about the status
  // and carries no review must keep doing exactly what it did before.
  const wantsTransition =
    Boolean(request.transitionId || request.status || request.intent) || !review;
  if (wantsTransition) request.intent = request.intent || 'resolve';

  // Read the issue BEFORE anything is written, so "previous_status" is Jira's
  // truth at this moment rather than whatever SEOX last cached. It also
  // catches an issue deleted or moved out of reach since the link was made.
  const before = await fetchIssue(env, connection, issueRef);
  if (!before) {
    throw httpError('Jira issue not found', 404, 'ISSUE_GONE');
  }
  const previous = readIssueFields(before);

  // 4. The issue Jira served must be the one we authorised. An issue moved
  //    to another Jira project keeps its id and gains a new key. This guards
  //    the comment as much as the transition: a review is a write too, and
  //    must not land on a board nobody mapped.
  const servedPrefix = projectKeyOfIssueKey(previous.key);
  const mapped = String(mapping.jira_project_key || '').toUpperCase();
  if (servedPrefix && mapped && servedPrefix !== mapped) {
    throw httpError(
      `That Jira issue now lives in Jira project ${servedPrefix}, which is not mapped to this SEOX project.`,
      403,
      'ISSUE_MOVED'
    );
  }

  if (!wantsTransition) {
    return reviewOnly({ env, admin, link, connection, mapping, issueRef, before, previous, review, started });
  }

  const transitions = await fetchTransitions(env, connection, issueRef);
  const selection = selectTransition(transitions, request);

  if (selection.error) {
    // Not a server fault and not a Jira fault - the workflow simply has no
    // such step. NOTHING has been written at this point, and in particular
    // the review is NOT posted: a comment describing a move that did not
    // happen is worse than no comment.
    return {
      status: 400,
      payload: {
        success: false,
        statusUpdated: false,
        commentAdded: false,
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
  //
  // A ticket SEOX did not file has no link row and therefore no SEOX state to
  // move. That is not an error - it is a Jira ticket the team raised by hand,
  // and SEOX has no finding to verify. The Jira side still changed.
  let applied = { applied: false };
  let refreshed = link;
  if (after && link) {
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

  const resolvedKey = current.key || link?.jira_issue_key || issueKey;

  // 6. The review, and only now. The transition is settled, so the comment
  //    cannot describe a move that was refused.
  const reviewResult = review
    ? await addReview(env, connection, issueRef, review)
    : { added: false, id: null, error: '' };
  const commentFailed = Boolean(review) && !reviewResult.added;

  // Logged either way. The audit trail must record a change SEOX made in
  // somebody's Jira even when no SEOX finding was involved.
  await logSync({
    userId: admin.id,
    projectId: link?.project_id || mapping.project_id,
    linkId: link?.id || null,
    action: 'issue.transition',
    direction: 'outbound',
    result: 'success',
    jiraIssueKey: resolvedKey,
    message: `Transitioned ${resolvedKey} from "${previous.status || 'unknown'}" to "${
      current.status || transition.to?.name || 'unknown'
    }" via "${transition.name}".`,
    durationMs: Date.now() - started,
    actorEmail: null,
    actorKind: 'user',
    context: {
      transitionId: String(transition.id),
      transitionName: transition.name,
      requested: request,
      createdBySeox: Boolean(link),
      reviewRequested: Boolean(review),
    },
  });

  if (review) {
    await logReview({
      admin,
      link,
      mapping,
      issueKey: resolvedKey,
      result: reviewResult,
      durationMs: Date.now() - started,
      context: { withTransition: String(transition.id) },
    });
  }

  return {
    status: 200,
    payload: {
      // A PARTIAL application is not a success. The HTTP status stays 200 on
      // purpose: 4xx/5xx would mean "nothing happened, try again", and a
      // retry would transition an issue that has already moved. The split
      // flags below are what the caller reports from, and this project's
      // client treats `success: false` as a failure whatever the status is.
      success: !commentFailed,
      statusUpdated: true,
      commentAdded: reviewResult.added,
      message: commentFailed
        ? `Jira ticket ${resolvedKey} status was updated, but the review/comment could not be added.`
        : `Jira ticket ${resolvedKey} updated successfully`,
      ...(commentFailed
        ? {
            error: `Jira ticket ${resolvedKey} status was updated, but the review/comment could not be added. ${reviewResult.error}`.trim(),
            code: 'COMMENT_FAILED',
          }
        : {}),
      issue: describeIssue(refreshed, connection, resolvedKey, current, after),
      data: {
        jira_issue_key: resolvedKey,
        jira_issue_id: current.id || link?.jira_issue_id || null,
        jira_issue_url: issueUrlFor(refreshed, connection, resolvedKey),
        previous_status: previous.status,
        previous_status_category: previous.statusCategory,
        new_status: current.status,
        new_status_category: current.statusCategory,
        jira_resolution: current.resolution,
        jira_priority: current.priority,
        jira_assignee: current.assigneeName,
        transition_id: String(transition.id),
        transition_name: transition.name,
        status_updated: true,
        comment_added: reviewResult.added,
        comment_id: reviewResult.id,
        comment_error: commentFailed ? reviewResult.error : null,
        // The SEOX side, kept deliberately distinct from the Jira side, and
        // null for a ticket that has no SEOX finding behind it.
        created_by_seox: Boolean(link),
        seox_state: refreshed?.seox_state || null,
        seox_state_label: refreshed
          ? SEOX_STATE_LABELS[refreshed.seox_state] || refreshed.seox_state
          : null,
        awaiting_verification: Boolean(applied.shouldVerify),
        last_synced_at: refreshed ? toIso(refreshed.last_synced_at) : null,
        updated_at: toIso(current.remoteUpdatedAt) || new Date().toISOString(),
      },
    },
  };
}

/**
 * A review with no status change.
 *
 * Nothing about the workflow is touched, so nothing about the SEOX finding
 * moves either - there is no claim here that the problem was fixed, only a
 * note on the ticket. Unlike the combined case a failure is total: Jira is
 * exactly as it was, so this reports an ordinary error rather than a partial
 * success.
 */
async function reviewOnly({ env, admin, link, connection, mapping, issueRef, before, previous, review, started }) {
  const resolvedKey = previous.key || link?.jira_issue_key || '';
  const result = await addReview(env, connection, issueRef, review);

  await logReview({
    admin,
    link,
    mapping,
    issueKey: resolvedKey,
    result,
    durationMs: Date.now() - started,
    context: { withTransition: null },
  });

  if (!result.added) {
    return {
      status: result.status,
      payload: {
        success: false,
        statusUpdated: false,
        commentAdded: false,
        error: result.error,
        code: 'COMMENT_FAILED',
        message: `The review/comment could not be added to Jira ticket ${resolvedKey}.`,
      },
    };
  }

  return {
    status: 200,
    payload: {
      success: true,
      statusUpdated: false,
      commentAdded: true,
      message: `Review added to Jira ticket ${resolvedKey}.`,
      issue: describeIssue(link, connection, resolvedKey, previous, before),
      data: {
        jira_issue_key: resolvedKey,
        jira_issue_id: previous.id || link?.jira_issue_id || null,
        jira_issue_url: issueUrlFor(link, connection, resolvedKey),
        // Unchanged, and reported as such rather than omitted: the caller
        // renders a status either way and must not be left to guess.
        previous_status: previous.status,
        previous_status_category: previous.statusCategory,
        new_status: previous.status,
        new_status_category: previous.statusCategory,
        jira_resolution: previous.resolution,
        jira_priority: previous.priority,
        jira_assignee: previous.assigneeName,
        status_updated: false,
        comment_added: true,
        comment_id: result.id,
        comment_error: null,
        created_by_seox: Boolean(link),
        seox_state: link?.seox_state || null,
        seox_state_label: link ? SEOX_STATE_LABELS[link.seox_state] || link.seox_state : null,
        awaiting_verification: false,
        last_synced_at: link ? toIso(link.last_synced_at) : null,
        updated_at: toIso(previous.remoteUpdatedAt) || new Date().toISOString(),
      },
    },
  };
}

/** The comment write, in the same audit trail as the transition. */
function logReview({ admin, link, mapping, issueKey, result, durationMs, context }) {
  return logSync({
    userId: admin.id,
    projectId: link?.project_id || mapping.project_id,
    linkId: link?.id || null,
    action: 'comment.post',
    direction: 'outbound',
    result: result.added ? 'success' : 'error',
    jiraIssueKey: issueKey || null,
    message: result.added
      ? `Added a review to ${issueKey}.`
      : `Could not add a review to ${issueKey}: ${result.error}`,
    durationMs,
    actorEmail: null,
    actorKind: 'user',
    // The review text itself is NOT logged. It lives on the Jira ticket,
    // which is the whole point, and copying it into a log table would be a
    // second, unasked-for copy of whatever the user wrote.
    context: { ...context, commentId: result.id, createdBySeox: Boolean(link) },
  });
}

/** The documented `issue` block: key, link, and the status it ended on. */
function describeIssue(link, connection, issueKey, fields, raw) {
  return {
    key: issueKey,
    url: issueUrlFor(link, connection, issueKey),
    status: {
      id: String(raw?.fields?.status?.id || ''),
      name: fields?.status || '',
      category: fields?.statusCategory || '',
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
    const result = await handleUpdate(env, body || {});
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
