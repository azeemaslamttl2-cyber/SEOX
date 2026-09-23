// Reading a user's review off a request, and turning it into a Jira comment.
//
// Kept apart from the route so the two rules that matter can be tested
// without a Jira tenant, a database or an HTTP server:
//
//   1. WHAT COUNTS AS A REVIEW. Absent, blank and whitespace are all "no
//      review". A textarea the user tabbed through and left alone must not
//      post an empty comment onto somebody's ticket, and a request that
//      carries `review: ""` must behave exactly like one that omits the field
//      - otherwise a form that always sends the key would silently turn every
//      status change into a status change plus an empty comment.
//
//   2. WHAT REACHES JIRA. The text is carried as plain ADF text nodes and is
//      never interpreted: no wiki markup, no HTML, no mentions. What the user
//      typed is what appears on the ticket. Jira Cloud's v3 comment API takes
//      Atlassian Document Format rather than a string, so this conversion is
//      not optional cosmetics - it is the payload.

import { buildCommentAdf } from './jira-issue-builder.js';

// Jira's own limit on a text field is 32,767 characters. Refusing just under
// it means an over-long review is rejected by SEOX with an explanation the
// user can act on, rather than by Jira with a 400 they cannot.
export const MAX_REVIEW_LENGTH = 32000;

function reviewError(message, code) {
  const error = new Error(message);
  error.status = 400;
  error.code = code;
  return error;
}

/**
 * The review the caller wants left on the ticket, or '' for none.
 *
 * `comment` is accepted as a synonym because that is what the field is called
 * in Jira, and callers reach for the Jira word.
 *
 * @param {object} params  the parsed request body
 * @returns {string} the trimmed review, or '' when none was supplied
 */
export function readReview(params) {
  const raw = params?.review ?? params?.comment;
  if (raw === null || raw === undefined) return '';
  if (typeof raw !== 'string') {
    // An object or an array here is a caller bug, not a review. Coercing it
    // would post "[object Object]" to a customer's board.
    throw reviewError('review must be text.', 'INVALID_REVIEW');
  }
  const review = raw.trim();
  if (!review) return '';
  if (review.length > MAX_REVIEW_LENGTH) {
    throw reviewError(
      `A review must be ${MAX_REVIEW_LENGTH} characters or fewer.`,
      'REVIEW_TOO_LONG'
    );
  }
  return review;
}

/**
 * The review as Atlassian Document Format.
 *
 * Each line becomes its own paragraph rather than one text node holding
 * newlines: an ADF text node is not defined to carry a line break, and a
 * multi-line review posted as one would come back from Jira as a single
 * run-on sentence.
 */
export function reviewToAdf(review) {
  const lines = String(review ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return buildCommentAdf(lines.length ? lines : [String(review ?? '')]);
}
