// Review reply policy, classification and inbox filters.
//
// Two rules are enforced here rather than left to the UI:
//
//   1. Authorisation. Replying speaks as the business. Google's API policy
//      requires the client's authorisation to act on their behalf, so no reply
//      leaves SEOX until that authorisation is recorded against the location.
//
//   2. Star tiers. A five-star reply is low risk; a one-star reply is a public
//      response to an unhappy customer. The tier decides whether a draft may
//      ever publish itself, and nothing at two stars or below can.

export const REPLY_LIMIT = 4096;

export const SENTIMENTS = { positive: [4, 5], neutral: [3, 3], negative: [1, 2] };

/**
 * mode:
 *   ai_auto_allowed   AI drafts, and may publish itself when the location has
 *                     auto-reply switched on
 *   ai_personalized   AI drafts; a human presses publish
 *   manual_approval   AI drafts, but the draft is marked for review first
 *   ai_draft_only     AI drafts and nothing else — never auto-publishes
 */
export const STAR_TIERS = {
  5: { mode: 'ai_auto_allowed', urgency: 'none', label: 'Auto-reply eligible' },
  4: { mode: 'ai_personalized', urgency: 'none', label: 'AI personalised reply' },
  3: { mode: 'manual_approval', urgency: 'attention', label: 'Manual approval' },
  2: { mode: 'ai_draft_only', urgency: 'urgent', label: 'Urgent — draft only' },
  1: { mode: 'ai_draft_only', urgency: 'urgent', label: 'Urgent — draft only' },
};

export function tierFor(starRating) {
  return STAR_TIERS[Number(starRating)] || STAR_TIERS[3];
}

export function sentimentOf(starRating) {
  const stars = Number(starRating) || 0;
  if (stars >= 4) return 'positive';
  if (stars === 3) return 'neutral';
  if (stars >= 1) return 'negative';
  return 'neutral';
}

export function isUrgent(review) {
  return tierFor(review.starRating ?? review.star_rating).urgency === 'urgent';
}

// --- Authorisation ---------------------------------------------------------

/**
 * Returns null when replying is allowed, or a reason object when it is not.
 * Called before every reply, whether a human pressed publish or a rule did.
 */
export function replyAuthorization(location) {
  if (!location?.reply_authorized) {
    return {
      allowed: false,
      code: 'NOT_AUTHORIZED',
      message:
        'Replying on this client’s behalf has not been authorised. Record the client’s authorisation on the Reviews page before publishing any reply.',
    };
  }
  return { allowed: true, authorizedBy: location.reply_authorized_by, at: location.reply_authorized_at };
}

/**
 * Whether a drafted reply may publish itself with no human in the loop.
 * Every condition must hold; the star floor can be raised but never below 4.
 */
export function canAutoPublish(location, starRating) {
  if (!location?.reply_authorized) return { allowed: false, reason: 'Client authorisation is not recorded.' };
  if (!location?.auto_reply_enabled) return { allowed: false, reason: 'Auto-reply is switched off for this location.' };

  const tier = tierFor(starRating);
  if (tier.mode !== 'ai_auto_allowed') {
    return { allowed: false, reason: `${starRating}-star reviews are never auto-published (${tier.label}).` };
  }

  const floor = Math.max(4, Number(location.auto_reply_min_stars) || 5);
  if (Number(starRating) < floor) {
    return { allowed: false, reason: `Auto-reply is limited to ${floor} stars and above.` };
  }
  return { allowed: true };
}

// --- Reply validation ------------------------------------------------------

const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/;

export function validateReply(comment) {
  const errors = [];
  const warnings = [];
  const text = String(comment || '').trim();

  if (!text) errors.push('Reply text is required.');
  if (text.length > REPLY_LIMIT) {
    errors.push(`Reply is ${text.length} characters; Google allows ${REPLY_LIMIT}.`);
  }

  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length > 20 && letters === letters.toUpperCase()) {
    errors.push('Reply is entirely uppercase, which reads as shouting at the reviewer.');
  }
  if (PHONE_PATTERN.test(text)) {
    warnings.push('The reply contains a phone number. Public replies are visible to everyone.');
  }
  if (/https?:\/\//i.test(text)) {
    warnings.push('The reply contains a URL. Google may strip links from review replies.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// --- Inbox filters ---------------------------------------------------------

export const FILTERS = [
  'all',
  'unanswered',
  'positive',
  'neutral',
  'negative',
  'flagged',
  'reply_pending',
  'reply_published',
];

/**
 * Translate an inbox filter into SQL. Returns { clause, params } so the caller
 * can append it to a scoped query.
 */
export function filterClause(filter) {
  switch (filter) {
    case 'unanswered':
      return { clause: 'reply_comment IS NULL', params: [] };
    case 'positive':
      return { clause: 'star_rating >= 4', params: [] };
    case 'neutral':
      return { clause: 'star_rating = 3', params: [] };
    case 'negative':
      return { clause: 'star_rating BETWEEN 1 AND 2', params: [] };
    case 'flagged':
      // Flagged by SEOX, or carrying a policy signal from Google.
      return { clause: '(flagged = 1 OR policy_violation IS NOT NULL)', params: [] };
    case 'reply_pending':
      return { clause: "draft_status IN ('draft', 'awaiting_approval')", params: [] };
    case 'reply_published':
      return { clause: 'reply_comment IS NOT NULL', params: [] };
    case 'all':
    default:
      return { clause: '1 = 1', params: [] };
  }
}

export function summarise(reviews) {
  const counts = {
    total: reviews.length,
    unanswered: 0,
    positive: 0,
    neutral: 0,
    negative: 0,
    flagged: 0,
    replyPending: 0,
    replyPublished: 0,
    urgent: 0,
  };
  const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingSum = 0;
  let rated = 0;

  for (const review of reviews) {
    const stars = Number(review.star_rating ?? review.starRating ?? 0);
    const replied = Boolean(review.reply_comment ?? review.replyComment);
    const draftStatus = review.draft_status ?? review.draftStatus ?? 'none';

    if (stars >= 1 && stars <= 5) {
      ratingBreakdown[stars] += 1;
      ratingSum += stars;
      rated += 1;
    }
    if (!replied) counts.unanswered += 1;
    else counts.replyPublished += 1;

    const sentiment = sentimentOf(stars);
    counts[sentiment] += 1;

    if (review.flagged || review.policy_violation) counts.flagged += 1;
    if (draftStatus === 'draft' || draftStatus === 'awaiting_approval') counts.replyPending += 1;
    if (!replied && tierFor(stars).urgency === 'urgent') counts.urgent += 1;
  }

  return {
    counts,
    ratingBreakdown,
    averageRating: rated ? Math.round((ratingSum / rated) * 10) / 10 : null,
  };
}
