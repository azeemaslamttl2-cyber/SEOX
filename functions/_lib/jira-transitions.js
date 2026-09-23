// Reading and executing Jira workflow transitions.
//
// THE RULE THIS MODULE EXISTS TO ENFORCE: a transition id is meaningless
// outside the workflow it belongs to. Jira workflows are per-project and
// fully customisable - "Done" might be transition 31 in one project, 5 in
// another, and simply not exist in a third, where the same outcome is called
// "Ship it" or "Закрыто". Anything that hardcodes an id, or assumes a status
// called "Resolved" exists, breaks the first time it meets a customer's real
// board.
//
// So every transition is resolved at call time, against the transitions Jira
// itself reports for that specific issue in its current status. What SEOX
// matches on is:
//
//   1. an explicit transition id the caller already read from this same list
//   2. the destination STATUS NAME, when the caller names one
//   3. failing both, the destination's statusCategory - the only part of a
//      Jira workflow that is stable across projects (jira-status-map.js
//      explains why at length)
//
// If none of those produce a transition, that is reported as an error. It is
// never approximated: moving a ticket to the wrong column is worse than
// telling the user their workflow has no such step.

import { jiraRequestForConnection } from './jira-client.js';
import { isNotFixedResolution } from './jira-status-map.js';

/** Intents SEOX understands, mapped onto the stable statusCategory keys. */
const INTENT_CATEGORIES = Object.freeze({
  resolve: ['done'],
  resolved: ['done'],
  done: ['done'],
  close: ['done'],
  closed: ['done'],
  complete: ['done'],
  completed: ['done'],
  fixed: ['done'],
  start: ['indeterminate'],
  'in progress': ['indeterminate'],
  'in-progress': ['indeterminate'],
  inprogress: ['indeterminate'],
  progress: ['indeterminate'],
  doing: ['indeterminate'],
  review: ['indeterminate'],
  open: ['new', 'indeterminate'],
  reopen: ['new', 'indeterminate'],
  reopened: ['new', 'indeterminate'],
  todo: ['new'],
  'to do': ['new'],
  backlog: ['new'],
  new: ['new'],
});

/** Strip everything that differs between two spellings of the same status. */
function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * The transition shape SEOX serves to its own UI. Deliberately small: Jira's
 * own payload carries the whole destination status resource and, when the
 * transition has a screen, every field on it.
 */
export function describeTransition(transition) {
  const to = transition?.to || {};
  return {
    id: String(transition?.id || ''),
    name: String(transition?.name || ''),
    to_status: to.name || '',
    to_status_category: to.statusCategory?.key || '',
    to_status_category_name: to.statusCategory?.name || '',
    // A transition with a required screen field cannot be executed blind, so
    // the UI can warn instead of letting Jira reject the POST.
    has_screen: Boolean(transition?.hasScreen),
    is_available: transition?.isAvailable !== false,
  };
}

/**
 * Every transition available on this issue RIGHT NOW.
 *
 * Jira computes this against the issue's current status and the caller's
 * permissions, which is exactly why it must be read per request rather than
 * cached per project: the same issue offers different transitions in "To Do"
 * than it does in "In Review".
 */
export async function fetchTransitions(env, connection, issueIdOrKey, { kind = 'interactive' } = {}) {
  const { data } = await jiraRequestForConnection(env, connection, {
    path: `/rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}/transitions`,
    // expand is what makes `hasScreen` meaningful.
    query: { expand: 'transitions.fields' },
    kind,
  });
  const transitions = Array.isArray(data?.transitions) ? data.transitions : [];
  return transitions.filter((item) => item && item.id);
}

/**
 * Of several transitions into the "done" category, the one that means the
 * work was actually done.
 *
 * A Jira workflow routinely offers "Done" and "Won't Do" side by side, and
 * both land in the done category. Picking the wrong one records a fix that
 * never happened, so the declining ones are filtered out first and only used
 * if nothing else is on offer - in which case the caller should be naming the
 * transition explicitly anyway.
 */
function preferGenuineResolution(candidates) {
  const genuine = candidates.filter(
    (item) => !isNotFixedResolution(item.name) && !isNotFixedResolution(item.to?.name)
  );
  return genuine[0] || null;
}

function byCategory(transitions, categories) {
  const wanted = new Set(categories);
  return transitions.filter((item) => wanted.has(item?.to?.statusCategory?.key));
}

/**
 * Resolve a request into one concrete transition.
 *
 * Pure: it is handed the list Jira returned and the caller's request, and
 * makes no network call of its own. That is what lets the precedence rules be
 * tested against real-world workflow shapes without a Jira tenant.
 *
 * @param {Array}  transitions  raw transitions from fetchTransitions()
 * @param {object} request
 * @param {string} [request.transitionId]  an id read from this same list
 * @param {string} [request.status]        a destination status name
 * @param {string} [request.intent]        'resolve' | 'open' | 'in progress' | ...
 * @returns {{transition: object}|{error: string, code: string}}
 */
export function selectTransition(transitions, { transitionId, status, intent } = {}) {
  const available = Array.isArray(transitions) ? transitions.filter(Boolean) : [];
  if (!available.length) {
    return {
      error: 'Jira offers no transitions on this issue for the connected account.',
      code: 'NO_TRANSITIONS',
    };
  }

  // 1. An explicit id. Still validated against the live list - an id from a
  //    different project's workflow, or one that was valid before the issue
  //    moved, must not be sent to Jira.
  if (transitionId) {
    const wanted = String(transitionId).trim();
    const match = available.find((item) => String(item.id) === wanted);
    if (match) return { transition: match };
    return {
      error: 'The requested Jira status transition is not available',
      code: 'TRANSITION_UNAVAILABLE',
    };
  }

  // 2. A named destination. Matched on the destination status first, because
  //    that is what the user sees on the board; the transition's own label
  //    ("Start progress") is tried second.
  if (status) {
    const wanted = normalizeName(status);
    const match =
      available.find((item) => normalizeName(item?.to?.name) === wanted) ||
      available.find((item) => normalizeName(item?.name) === wanted);
    if (match) return { transition: match };

    // 3. The name did not match any status in THIS workflow, but it may still
    //    describe an outcome - "Resolved" on a board whose done column is
    //    called "Shipped". Fall through to the category only when the word is
    //    one SEOX recognises; an unknown word is an error, not a guess.
    const categories = INTENT_CATEGORIES[String(status).trim().toLowerCase()];
    if (!categories) {
      return {
        error: 'The requested Jira status transition is not available',
        code: 'TRANSITION_UNAVAILABLE',
      };
    }
    return fromCategories(available, categories, status);
  }

  const categories = INTENT_CATEGORIES[String(intent || 'resolve').trim().toLowerCase()];
  if (!categories) {
    return { error: 'That is not a Jira status SEOX knows how to request.', code: 'UNKNOWN_INTENT' };
  }
  return fromCategories(available, categories, intent || 'resolve');
}

function fromCategories(available, categories, label) {
  for (const category of categories) {
    const candidates = byCategory(available, [category]);
    if (!candidates.length) continue;
    const chosen = category === 'done' ? preferGenuineResolution(candidates) : candidates[0];
    if (chosen) return { transition: chosen };
    // Only declining transitions are on offer for "done" - say so rather than
    // recording a "Won't Do" as a resolution.
    return {
      error:
        'The only Jira transitions available close this issue without fixing it. Choose one explicitly if that is intended.',
      code: 'ONLY_DECLINING_TRANSITIONS',
    };
  }

  return {
    error:
      String(label).toLowerCase().includes('resolve') || categories.includes('done')
        ? 'No valid Jira transition is available to resolve this issue.'
        : 'The requested Jira status transition is not available',
    code: 'TRANSITION_UNAVAILABLE',
  };
}

/**
 * Execute one transition.
 *
 * Jira answers 204 with no body, so this returns nothing useful - the caller
 * re-reads the issue to learn what the workflow actually did with it. That
 * matters: a post-function can set a resolution, reassign, or route the issue
 * somewhere other than the transition's nominal destination, and SEOX must
 * store what happened rather than what it asked for.
 */
export async function executeTransition(env, connection, issueIdOrKey, transitionId) {
  await jiraRequestForConnection(env, connection, {
    path: `/rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}/transitions`,
    method: 'POST',
    body: { transition: { id: String(transitionId) } },
    kind: 'interactive',
  });
}

/** The Jira project key an issue key belongs to: "SEO-123" -> "SEO". */
export function projectKeyOfIssueKey(issueKey) {
  const match = /^([A-Za-z][A-Za-z0-9_]*)-\d+$/.exec(String(issueKey || '').trim());
  return match ? match[1].toUpperCase() : '';
}
