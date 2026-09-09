// GBP Health Audit.
//
// Mirrors the website auditor: a weighted score, a severity-ranked issue list,
// and an append-only history so two runs can be diffed.
//
// A check whose data could not be fetched is SKIPPED, not failed. Skipped
// weights are removed from the denominator, so a listing is never marked down
// for a signal SEOX did not manage to read — and the score cannot silently cap
// below 100 because one API was unavailable.

import { evaluateCompleteness, starRatingToNumber } from './gbp-scoring.js';

export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'opportunity'];

// Weights sum to 100 across all scored checks.
export const CHECK_WEIGHTS = {
  verification: 12,
  locationStatus: 6,
  profileCompleteness: 8,
  categorySetup: 8,
  description: 4,
  hours: 6,
  specialHours: 2,
  website: 4,
  phone: 4,
  services: 6,
  attributes: 2,
  photos: 8,
  reviewRating: 8,
  reviewResponseRate: 10,
  postingFrequency: 8,
  qandaActivity: 4,
};

const CATEGORY_OF = {
  verification: 'Status',
  locationStatus: 'Status',
  profileCompleteness: 'Profile',
  categorySetup: 'Profile',
  description: 'Profile',
  hours: 'Profile',
  specialHours: 'Profile',
  website: 'Profile',
  phone: 'Profile',
  services: 'Profile',
  attributes: 'Profile',
  photos: 'Media',
  reviewRating: 'Reputation',
  reviewResponseRate: 'Reputation',
  postingFrequency: 'Engagement',
  qandaActivity: 'Engagement',
  rankGrid: 'Visibility',
};

function daysSince(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000));
}

function ratio(value, target) {
  if (!target) return 0;
  return Math.min(1, Math.max(0, value / target));
}

function check(key, { passed, severity, title, detail, actionLabel, actionTarget, earnedRatio = passed ? 1 : 0 }) {
  const possible = CHECK_WEIGHTS[key];
  return {
    key,
    category: CATEGORY_OF[key],
    severity,
    passed: Boolean(passed),
    title,
    detail,
    actionLabel: actionLabel || null,
    actionTarget: actionTarget || null,
    pointsPossible: possible,
    pointsEarned: Math.round(possible * earnedRatio),
  };
}

function skipped(key, reason) {
  return {
    key,
    category: CATEGORY_OF[key] || 'Other',
    severity: 'low',
    passed: false,
    skipped: true,
    reason,
    title: `${key} not checked`,
    detail: reason,
    pointsPossible: 0,
    pointsEarned: 0,
  };
}

/**
 * @param signals {{
 *   profile: object, attributes: object|null,
 *   reviews: object|null, posts: object|null,
 *   media: object|null, qanda: object|null,
 *   rankGrid: object|null,
 *   verificationStatus: string, openStatus: string|null, hasGoogleUpdates: boolean
 * }}
 */
export function runAudit(signals) {
  const profile = signals.profile || {};
  const categories = profile.categories || {};
  const completeness = evaluateCompleteness(profile);
  const results = [];
  const skippedChecks = [];

  // --- Status --------------------------------------------------------------

  const verified = signals.verificationStatus === 'VERIFIED';
  results.push(
    check('verification', {
      passed: verified,
      severity: 'critical',
      title: verified ? 'Location is verified' : 'Location is not verified',
      detail: verified
        ? 'The listing is eligible to appear in Maps and to publish posts.'
        : 'Unverified listings do not rank in the local pack and cannot publish posts.',
      actionLabel: verified ? null : 'Start verification',
      actionTarget: verified ? null : '/local-seo/gbp',
    })
  );

  const openStatus = signals.openStatus;
  const statusHealthy = !openStatus || openStatus === 'OPEN';
  results.push(
    check('locationStatus', {
      passed: statusHealthy && !signals.hasGoogleUpdates,
      severity: 'critical',
      title: !statusHealthy
        ? `Listing status is ${openStatus}`
        : signals.hasGoogleUpdates
          ? 'Google has suggested a profile change'
          : 'Listing status is healthy',
      detail: !statusHealthy
        ? 'A closed or suspended listing stops receiving impressions entirely.'
        : signals.hasGoogleUpdates
          ? 'Pending Google updates overwrite your data if they are left unreviewed.'
          : 'The listing is open and has no pending Google edits.',
      actionLabel: statusHealthy && !signals.hasGoogleUpdates ? null : 'Review listing',
      actionTarget: '/local-seo/gbp/profile',
      earnedRatio: statusHealthy ? (signals.hasGoogleUpdates ? 0.5 : 1) : 0,
    })
  );

  // --- Profile -------------------------------------------------------------

  results.push(
    check('profileCompleteness', {
      passed: completeness.percent >= 90,
      severity: completeness.percent >= 70 ? 'medium' : 'high',
      title: `Profile is ${completeness.percent}% complete`,
      detail: completeness.checks
        .filter((entry) => !entry.ok)
        .map((entry) => entry.label)
        .join(', ') || 'All core profile fields are filled.',
      actionLabel: completeness.percent >= 90 ? null : 'Edit profile',
      actionTarget: '/local-seo/gbp/profile',
      earnedRatio: completeness.percent / 100,
    })
  );

  const additionalCategories = (categories.additionalCategories || []).length;
  const hasPrimary = Boolean(categories.primaryCategory?.displayName);
  results.push(
    check('categorySetup', {
      passed: hasPrimary && additionalCategories >= 2,
      severity: hasPrimary ? 'medium' : 'critical',
      title: !hasPrimary
        ? 'No primary category set'
        : additionalCategories >= 2
          ? `Primary category plus ${additionalCategories} secondary categories`
          : `Only ${additionalCategories} secondary categor${additionalCategories === 1 ? 'y' : 'ies'}`,
      detail: hasPrimary
        ? 'Categories are the strongest ranking signal on a listing. Two to five secondary categories that match real services is the usual target.'
        : 'The primary category decides which searches the listing is eligible for.',
      actionLabel: 'Edit categories',
      actionTarget: '/local-seo/gbp/profile',
      earnedRatio: !hasPrimary ? 0 : 0.6 + 0.4 * ratio(additionalCategories, 2),
    })
  );

  const description = (profile.profile?.description || '').trim();
  results.push(
    check('description', {
      passed: description.length >= 250,
      severity: 'medium',
      title: description
        ? `Description is ${description.length} characters`
        : 'No business description',
      detail: 'Google allows 750 characters. Descriptions under 250 leave most of the space unused.',
      actionLabel: 'Edit description',
      actionTarget: '/local-seo/gbp/profile',
      earnedRatio: ratio(description.length, 250),
    })
  );

  const hourPeriods = (profile.regularHours?.periods || []).length;
  results.push(
    check('hours', {
      passed: hourPeriods > 0,
      severity: 'high',
      title: hourPeriods ? 'Regular hours are set' : 'No regular hours set',
      detail: 'Listings without hours are filtered out of "open now" searches.',
      actionLabel: hourPeriods ? null : 'Set hours',
      actionTarget: '/local-seo/gbp/profile',
    })
  );

  const specialPeriods = (profile.specialHours?.specialHourPeriods || []).length;
  results.push(
    check('specialHours', {
      passed: specialPeriods > 0,
      severity: 'low',
      title: specialPeriods ? `${specialPeriods} special hour periods` : 'No holiday hours set',
      detail: 'Without holiday hours Google shows a "hours might differ" warning on the listing.',
      actionLabel: specialPeriods ? null : 'Add holiday hours',
      actionTarget: '/local-seo/gbp/profile',
    })
  );

  const website = profile.websiteUri || '';
  results.push(
    check('website', {
      passed: Boolean(website),
      severity: 'high',
      title: website ? 'Website URL is set' : 'No website URL',
      detail: website
        ? 'Website clicks are one of the highest-intent actions on a listing.'
        : 'Without a website URL the listing cannot convert search views into visits.',
      actionLabel: website ? null : 'Add website',
      actionTarget: '/local-seo/gbp/profile',
    })
  );

  const phone = profile.phoneNumbers?.primaryPhone || '';
  results.push(
    check('phone', {
      passed: Boolean(phone),
      severity: 'high',
      title: phone ? 'Phone number is set' : 'No phone number',
      detail: 'The call button is the primary conversion path for most local searches.',
      actionLabel: phone ? null : 'Add phone',
      actionTarget: '/local-seo/gbp/profile',
    })
  );

  const serviceCount = (profile.serviceItems || []).length;
  results.push(
    check('services', {
      passed: serviceCount >= 5,
      severity: 'medium',
      title: serviceCount ? `${serviceCount} services listed` : 'No services listed',
      detail: 'Services surface in the listing and match long-tail "service + city" searches. Five or more is a reasonable floor.',
      actionLabel: 'Manage services',
      actionTarget: '/local-seo/gbp/profile',
      earnedRatio: ratio(serviceCount, 5),
    })
  );

  if (signals.attributes === null || signals.attributes === undefined) {
    skippedChecks.push(skipped('attributes', 'Attributes could not be read from Google.'));
  } else {
    const attributeCount = (signals.attributes.attributes || []).length;
    results.push(
      check('attributes', {
        passed: attributeCount >= 5,
        severity: 'low',
        title: attributeCount ? `${attributeCount} attributes set` : 'No attributes set',
        detail: 'Attributes power Google’s filter chips (wheelchair accessible, online estimates, women-led).',
        actionLabel: 'Manage attributes',
        actionTarget: '/local-seo/gbp/profile',
        earnedRatio: ratio(attributeCount, 5),
      })
    );
  }

  // --- Media ---------------------------------------------------------------

  if (!signals.media) {
    skippedChecks.push(skipped('photos', 'Media could not be read from Google.'));
  } else {
    const total = Number(signals.media.total || 0);
    results.push(
      check('photos', {
        passed: total >= 20,
        severity: total === 0 ? 'high' : 'medium',
        title: total ? `${total} photos and videos` : 'No photos uploaded',
        detail: 'Listings with 20 or more photos consistently draw more direction requests and calls than sparse ones.',
        actionLabel: 'Upload media',
        actionTarget: '/local-seo/gbp/profile',
        earnedRatio: ratio(total, 20),
      })
    );
  }

  // --- Reputation ----------------------------------------------------------

  if (!signals.reviews) {
    skippedChecks.push(skipped('reviewRating', 'Reviews could not be read from Google.'));
    skippedChecks.push(skipped('reviewResponseRate', 'Reviews could not be read from Google.'));
  } else {
    const rating = Number(signals.reviews.averageRating || 0);
    const totalReviews = Number(signals.reviews.totalReviews || 0);
    results.push(
      check('reviewRating', {
        passed: rating >= 4.5,
        severity: rating && rating < 3.5 ? 'high' : 'opportunity',
        title: rating ? `Rating is ${rating.toFixed(1)} across ${totalReviews} reviews` : 'No reviews yet',
        detail: 'Listings at 4.5 and above convert noticeably better in the local pack.',
        actionLabel: rating >= 4.5 ? null : 'Plan review campaign',
        actionTarget: '/local-seo/gbp/posts',
        earnedRatio: rating ? Math.min(1, Math.max(0, (rating - 3) / 1.5)) : 0,
      })
    );

    const inspected = Number(signals.reviews.inspectedCount || 0);
    const unanswered = Number(signals.reviews.unansweredInRecent || 0);
    const answeredRate = inspected > 0 ? (inspected - unanswered) / inspected : 0;
    const negativeUnanswered = (signals.reviews.latest || []).filter(
      (review) => !review.replied && starRatingToNumber(review.starRating) <= 2
    ).length;

    results.push(
      check('reviewResponseRate', {
        passed: inspected > 0 && unanswered === 0,
        severity: negativeUnanswered > 0 ? 'critical' : unanswered > 0 ? 'high' : 'low',
        title:
          inspected === 0
            ? 'No reviews to respond to'
            : unanswered === 0
              ? 'Every recent review has a reply'
              : `${unanswered} of the ${inspected} most recent reviews are unanswered`,
        detail:
          negativeUnanswered > 0
            ? `${negativeUnanswered} of them are 2 stars or lower and sit at the top of the listing until answered.`
            : 'Replying to reviews is the cheapest trust signal on a listing.',
        actionLabel: unanswered > 0 ? 'Reply to reviews' : null,
        actionTarget: '/local-seo/gbp/overview',
        earnedRatio: inspected === 0 ? 0 : answeredRate,
      })
    );
  }

  // --- Engagement ----------------------------------------------------------

  if (!signals.posts) {
    skippedChecks.push(skipped('postingFrequency', 'Posts could not be read from Google.'));
  } else {
    const sinceLastPost = daysSince(signals.posts.lastPostAt);
    const postsLast30 = Number(signals.posts.postsLast30Days || 0);
    let earnedRatio = 0;
    if (sinceLastPost !== null) {
      if (sinceLastPost <= 7) earnedRatio = 1;
      else if (sinceLastPost <= 14) earnedRatio = 0.7;
      else if (sinceLastPost <= 30) earnedRatio = 0.35;
    }
    results.push(
      check('postingFrequency', {
        passed: sinceLastPost !== null && sinceLastPost <= 14,
        severity: sinceLastPost === null || sinceLastPost > 30 ? 'high' : 'medium',
        title:
          sinceLastPost === null
            ? 'No Google posts found'
            : `Last post ${sinceLastPost} day${sinceLastPost === 1 ? '' : 's'} ago`,
        detail: `${postsLast30} post${postsLast30 === 1 ? '' : 's'} in the last 30 days. Weekly posting is the usual cadence for an active listing.`,
        actionLabel: 'Create post',
        actionTarget: '/local-seo/gbp/posts',
        earnedRatio,
      })
    );
  }

  if (!signals.qanda) {
    skippedChecks.push(skipped('qandaActivity', 'Q&A could not be read from Google.'));
  } else {
    const unanswered = Number(signals.qanda.unanswered || 0);
    const total = Number(signals.qanda.total || 0);
    results.push(
      check('qandaActivity', {
        passed: total > 0 && unanswered === 0,
        severity: unanswered > 0 ? 'medium' : 'low',
        title:
          total === 0
            ? 'No questions asked yet'
            : unanswered === 0
              ? `All ${total} questions answered`
              : `${unanswered} unanswered question${unanswered === 1 ? '' : 's'}`,
        detail:
          total === 0
            ? 'Seeding your own common questions is allowed and fills the Q&A panel before customers do.'
            : 'Unanswered questions let other users answer on your behalf.',
        actionLabel: unanswered > 0 ? 'Answer questions' : null,
        actionTarget: '/local-seo/gbp/profile',
        earnedRatio: total === 0 ? 0.5 : (total - unanswered) / total,
      })
    );
  }

  // --- Visibility ----------------------------------------------------------

  skippedChecks.push(
    skipped('rankGrid', 'RankGrid results are not linked to GBP locations yet (phase 4).')
  );

  // --- Score ---------------------------------------------------------------

  const pointsPossible = results.reduce((total, entry) => total + entry.pointsPossible, 0);
  const pointsEarned = results.reduce((total, entry) => total + entry.pointsEarned, 0);
  const score = pointsPossible > 0 ? Math.round((pointsEarned / pointsPossible) * 100) : 0;

  const failing = results.filter((entry) => !entry.passed);
  const counts = { critical: 0, high: 0, medium: 0, low: 0, opportunity: 0 };
  for (const entry of failing) counts[entry.severity] = (counts[entry.severity] || 0) + 1;

  const breakdown = {};
  const byCategory = {};
  for (const entry of results) {
    breakdown[entry.key] = { earned: entry.pointsEarned, possible: entry.pointsPossible };
    const bucket = (byCategory[entry.category] ||= { earned: 0, possible: 0 });
    bucket.earned += entry.pointsEarned;
    bucket.possible += entry.pointsPossible;
  }

  return {
    score,
    pointsEarned,
    pointsPossible,
    breakdown,
    byCategory,
    counts,
    completeness,
    // Failing checks first, ranked by severity, then the passing ones so the UI
    // can render a full checklist rather than only problems.
    issues: [
      ...failing.sort(
        (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
      ),
      ...results.filter((entry) => entry.passed),
    ],
    skippedChecks,
  };
}

export function diffAudits(current, previous) {
  if (!previous) return null;
  const previousBreakdown = typeof previous.breakdown === 'string'
    ? JSON.parse(previous.breakdown)
    : previous.breakdown || {};

  const movements = [];
  for (const [key, value] of Object.entries(current.breakdown || {})) {
    const before = previousBreakdown[key]?.earned ?? null;
    if (before === null || before === value.earned) continue;
    movements.push({ key, from: before, to: value.earned, delta: value.earned - before });
  }

  return {
    scoreFrom: previous.score,
    scoreTo: current.score,
    scoreDelta: current.score - previous.score,
    movements: movements.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    since: previous.created_at,
  };
}

// --- Audit history diffing (module 19) -------------------------------------

// Signal-level movement between two audits. Score movement alone does not tell
// the user what changed on the listing; these lines do.
const SIGNAL_LABELS = {
  reviewCount: { label: 'Reviews', better: 'up' },
  averageRating: { label: 'Rating', better: 'up', decimals: 1 },
  unansweredReviews: { label: 'Unanswered reviews', better: 'down' },
  serviceCount: { label: 'Services', better: 'up' },
  photoCount: { label: 'Photos', better: 'up' },
  categoryCount: { label: 'Categories', better: 'up' },
  descriptionLength: { label: 'Description length', better: 'up' },
  postsLast30Days: { label: 'Posts in 30 days', better: 'up' },
  questionsUnanswered: { label: 'Unanswered questions', better: 'down' },
  completenessPercent: { label: 'Profile completeness', better: 'up', suffix: '%' },
};

function readSignals(audit) {
  if (!audit) return {};
  const signals = typeof audit.signals === 'string' ? JSON.parse(audit.signals) : audit.signals;
  return signals?.snapshot || {};
}

/**
 * @returns {{ scoreFrom, scoreTo, scoreDelta, since, changes: Array }}
 */
export function diffSignals(currentAudit, previousAudit) {
  if (!previousAudit) return null;

  const current = readSignals(currentAudit);
  const previous = readSignals(previousAudit);
  const changes = [];

  for (const [key, meta] of Object.entries(SIGNAL_LABELS)) {
    const to = current[key];
    const from = previous[key];
    if (to === undefined || to === null || from === undefined || from === null) continue;
    if (Number(to) === Number(from)) continue;

    const delta = Number(to) - Number(from);
    const improved = meta.better === 'up' ? delta > 0 : delta < 0;

    changes.push({
      key,
      label: meta.label,
      from: meta.decimals ? Number(from).toFixed(meta.decimals) : from,
      to: meta.decimals ? Number(to).toFixed(meta.decimals) : to,
      delta: meta.decimals ? Number(delta.toFixed(meta.decimals)) : delta,
      suffix: meta.suffix || '',
      improved,
    });
  }

  return {
    scoreFrom: previousAudit.score,
    scoreTo: currentAudit.score,
    scoreDelta: currentAudit.score - previousAudit.score,
    since: previousAudit.created_at,
    changes: changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
  };
}
