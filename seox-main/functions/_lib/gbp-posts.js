// Local post building, policy pre-checks and the posting circuit breaker.
//
// Google rejects posts that break its content policy, and repeated rejections
// put the client's real listing at risk. Everything here runs BEFORE the API
// call so a bad post never leaves SEOX, and a location that keeps being
// rejected stops posting automatically instead of accumulating strikes.

export const TOPIC_TYPES = ['STANDARD', 'EVENT', 'OFFER'];
export const CTA_TYPES = ['BOOK', 'ORDER', 'SHOP', 'LEARN_MORE', 'SIGN_UP', 'CALL'];

export const SUMMARY_LIMIT = 1500;
const SUMMARY_RECOMMENDED_MIN = 80;
const COUPON_LIMIT = 58;
const TERMS_LIMIT = 5000;

// Two consecutive rejections stop automation for the location until a human
// clears it. Google does not expose a strike count, so SEOX is deliberately
// more cautious than the API requires.
export const FAILURE_THRESHOLD = 2;
export const BLOCK_HOURS = 24;

function fail(errors, message) {
  errors.push(message);
}

function isHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Google strips or rejects posts whose body carries a phone number; the phone
// belongs in the profile and the CALL action, not the copy.
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/;

export function validatePost(post) {
  const errors = [];
  const warnings = [];

  const summary = String(post.summary || '').trim();
  if (!summary) fail(errors, 'Post text is required.');
  if (summary.length > SUMMARY_LIMIT) {
    fail(errors, `Post text is ${summary.length} characters; Google allows ${SUMMARY_LIMIT}.`);
  }
  if (summary && summary.length < SUMMARY_RECOMMENDED_MIN) {
    warnings.push(
      `Post text is only ${summary.length} characters. Posts under ${SUMMARY_RECOMMENDED_MIN} rarely hold attention.`
    );
  }
  if (PHONE_PATTERN.test(summary)) {
    fail(errors, 'Post text contains a phone number. Google rejects phone numbers in post copy — use the Call action instead.');
  }

  const letters = summary.replace(/[^A-Za-z]/g, '');
  if (letters.length > 20 && letters === letters.toUpperCase()) {
    fail(errors, 'Post text is entirely uppercase, which Google treats as spam.');
  }
  if (/(!|\?){3,}/.test(summary)) {
    warnings.push('Repeated exclamation or question marks read as spam to Google’s review systems.');
  }

  const topicType = String(post.topicType || 'STANDARD').toUpperCase();
  if (!TOPIC_TYPES.includes(topicType)) {
    fail(errors, `"${topicType}" is not a post type SEOX can create. Product posts cannot be created through the API.`);
  }

  const ctaType = post.ctaType ? String(post.ctaType).toUpperCase() : null;
  if (ctaType) {
    if (!CTA_TYPES.includes(ctaType)) fail(errors, `"${ctaType}" is not a valid call to action.`);
    // CALL uses the listing's phone number and takes no URL; everything else
    // is rejected without one.
    if (ctaType !== 'CALL' && !isHttpUrl(post.ctaUrl)) {
      fail(errors, `The ${ctaType} action needs a valid http(s) landing URL.`);
    }
  }

  if (post.mediaUrl && !isHttpUrl(post.mediaUrl)) {
    fail(errors, 'Image URL must be a public http(s) URL that Google can fetch.');
  }

  if (topicType === 'EVENT' || topicType === 'OFFER') {
    if (!String(post.eventTitle || '').trim()) {
      fail(errors, `${topicType} posts require a title.`);
    }
    if (!post.eventStart || !post.eventEnd) {
      fail(errors, `${topicType} posts require a start and an end date.`);
    } else {
      const start = new Date(post.eventStart).getTime();
      const end = new Date(post.eventEnd).getTime();
      if (Number.isNaN(start) || Number.isNaN(end)) fail(errors, 'Event dates are not valid.');
      else if (end < start) fail(errors, 'The event end date is before the start date.');
    }
  }

  if (topicType === 'OFFER') {
    if (post.offerCoupon && String(post.offerCoupon).length > COUPON_LIMIT) {
      fail(errors, `Coupon code is longer than ${COUPON_LIMIT} characters.`);
    }
    if (post.offerTerms && String(post.offerTerms).length > TERMS_LIMIT) {
      fail(errors, `Terms are longer than ${TERMS_LIMIT} characters.`);
    }
    if (post.offerRedeemUrl && !isHttpUrl(post.offerRedeemUrl)) {
      fail(errors, 'Offer redeem URL must be a valid http(s) URL.');
    }
  }

  if (post.scheduledAt) {
    const scheduled = new Date(post.scheduledAt).getTime();
    if (Number.isNaN(scheduled)) fail(errors, 'Scheduled time is not a valid date.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// --- UTM -------------------------------------------------------------------

export function applyUtm(url, utm) {
  if (!isHttpUrl(url) || !utm) return url;
  try {
    const target = new URL(url);
    const params = {
      utm_source: utm.source,
      utm_medium: utm.medium,
      utm_campaign: utm.campaign,
      utm_content: utm.content,
      utm_term: utm.term,
    };
    for (const [key, value] of Object.entries(params)) {
      if (!value) continue;
      // Never clobber tracking the user already put on the URL.
      if (target.searchParams.has(key)) continue;
      target.searchParams.set(key, String(value));
    }
    return target.toString();
  } catch {
    return url;
  }
}

// --- Google payload --------------------------------------------------------

function toDateParts(value) {
  const date = new Date(value);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function toTimeParts(value) {
  const date = new Date(value);
  return { hours: date.getUTCHours(), minutes: date.getUTCMinutes() };
}

export function buildLocalPost(post, { languageCode = 'en' } = {}) {
  const topicType = String(post.topicType || 'STANDARD').toUpperCase();
  const localPost = {
    languageCode,
    summary: String(post.summary || '').trim(),
    topicType,
  };

  if (post.ctaType) {
    const actionType = String(post.ctaType).toUpperCase();
    localPost.callToAction = {
      actionType,
      ...(actionType === 'CALL' ? {} : { url: post.ctaUrl }),
    };
  }

  if (post.mediaUrl) {
    localPost.media = [{ mediaFormat: 'PHOTO', sourceUrl: post.mediaUrl }];
  }

  if (topicType === 'EVENT' || topicType === 'OFFER') {
    localPost.event = {
      title: post.eventTitle,
      schedule: {
        startDate: toDateParts(post.eventStart),
        startTime: toTimeParts(post.eventStart),
        endDate: toDateParts(post.eventEnd),
        endTime: toTimeParts(post.eventEnd),
      },
    };
  }

  if (topicType === 'OFFER') {
    localPost.offer = {
      ...(post.offerCoupon ? { couponCode: post.offerCoupon } : {}),
      ...(post.offerRedeemUrl ? { redeemOnlineUrl: post.offerRedeemUrl } : {}),
      ...(post.offerTerms ? { termsConditions: post.offerTerms } : {}),
    };
  }

  return localPost;
}

// --- Circuit breaker -------------------------------------------------------

export function postingBlocked(location) {
  if (!location?.posting_blocked_until) return null;
  const until = new Date(`${location.posting_blocked_until}Z`).getTime();
  if (Number.isNaN(until) || until <= Date.now()) return null;
  return {
    until: location.posting_blocked_until,
    reason: location.posting_block_reason || 'Repeated post rejections.',
    failures: Number(location.posting_failures || 0),
  };
}

export function nextBlockState(location, outcome, errorMessage) {
  const failures = Number(location?.posting_failures || 0);

  if (outcome === 'success') {
    return { postingFailures: 0, postingBlockedUntil: null, postingBlockReason: null, incrementSuccess: true };
  }

  const nextFailures = failures + 1;
  if (nextFailures < FAILURE_THRESHOLD) {
    return { postingFailures: nextFailures, postingBlockedUntil: null, postingBlockReason: null };
  }

  return {
    postingFailures: nextFailures,
    postingBlockedUntil: new Date(Date.now() + BLOCK_HOURS * 60 * 60 * 1000),
    postingBlockReason: `${nextFailures} consecutive rejections. Last: ${String(errorMessage || '').slice(0, 300)}`,
  };
}

// --- Recurrence ------------------------------------------------------------

export const RECURRENCE = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

/**
 * Recurrence is expanded by SEOX into individual scheduled posts rather than
 * handed to Google, so it works the same whether or not the API exposes native
 * recurring posts on a given day.
 */
export function expandRecurrence({ startAt, cadence, occurrences }) {
  const step = RECURRENCE[cadence];
  if (!step) {
    const error = new Error(`"${cadence}" is not a supported cadence.`);
    error.status = 400;
    throw error;
  }
  const count = Math.min(52, Math.max(1, Number(occurrences) || 1));
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) {
    const error = new Error('Recurrence start date is not valid.');
    error.status = 400;
    throw error;
  }

  const dates = [];
  for (let index = 0; index < count; index += 1) {
    const date = new Date(start.getTime());
    date.setUTCDate(date.getUTCDate() + step * index);
    dates.push(date);
  }
  return dates;
}
