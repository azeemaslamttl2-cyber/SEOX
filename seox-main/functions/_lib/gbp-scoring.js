// GBP profile completeness, health score, and the prioritised issue list shown
// under the overview dashboard.
//
// Pure functions with no I/O so they can be unit tested and reused later by the
// audit-history module. Everything scored here is derived from data the
// connection module actually fetches; checks that need the media, services, or
// Q&A endpoints are declared as "pending" rather than silently scored as zero,
// so a profile is never marked down for something SEOX has not looked at yet.

const STAR_VALUES = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

export function starRatingToNumber(starRating) {
  if (typeof starRating === 'number') return starRating;
  return STAR_VALUES[String(starRating || '').toUpperCase()] || 0;
}

// --- Profile completeness --------------------------------------------------

export function evaluateCompleteness(profile) {
  const location = profile || {};
  const categories = location.categories || {};
  const description = location.profile?.description || '';
  const hasAddress = Boolean(location.storefrontAddress?.addressLines?.length);
  const hasServiceArea = Boolean(location.serviceArea?.places?.placeInfos?.length);

  const checks = [
    { key: 'businessName', label: 'Business name', ok: Boolean(location.title) },
    {
      key: 'primaryCategory',
      label: 'Primary category',
      ok: Boolean(categories.primaryCategory?.displayName),
    },
    {
      key: 'additionalCategories',
      label: 'Additional categories',
      ok: (categories.additionalCategories || []).length > 0,
      hint: 'Add 2-3 secondary categories that match services you actually offer.',
    },
    { key: 'phone', label: 'Phone number', ok: Boolean(location.phoneNumbers?.primaryPhone) },
    { key: 'website', label: 'Website URL', ok: Boolean(location.websiteUri) },
    {
      key: 'address',
      label: 'Address or service area',
      ok: hasAddress || hasServiceArea,
    },
    {
      key: 'regularHours',
      label: 'Regular hours',
      ok: (location.regularHours?.periods || []).length > 0,
    },
    {
      key: 'specialHours',
      label: 'Holiday hours',
      ok: (location.specialHours?.specialHourPeriods || []).length > 0,
      hint: 'Holiday hours prevent "hours may differ" warnings on the listing.',
    },
    {
      key: 'description',
      label: 'Business description',
      ok: description.trim().length >= 250,
      hint: 'Google allows 750 characters. Aim for at least 250.',
    },
  ];

  const passed = checks.filter((check) => check.ok).length;
  return {
    checks,
    passed,
    total: checks.length,
    percent: Math.round((passed / checks.length) * 100),
    // Fetched by later phases; listed so the UI can say why they are absent.
    pending: ['Photos', 'Services', 'Attributes', 'Q&A'],
  };
}

// --- Health score ----------------------------------------------------------

const WEIGHTS = {
  completeness: 30,
  verification: 15,
  rating: 15,
  responseRate: 15,
  posting: 15,
  googleUpdates: 10,
};

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function daysSince(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000));
}

export function calculateHealthScore(input) {
  const { completenessPercent = 0, verificationStatus, averageRating, reviews, posts, hasGoogleUpdates } = input;

  const completeness = clamp01(completenessPercent / 100);
  const verification = verificationStatus === 'VERIFIED' ? 1 : 0;

  // 3.0 stars scores zero, 4.8 and above scores full.
  const rating = averageRating ? clamp01((Number(averageRating) - 3) / 1.8) : 0;

  const inspected = Number(reviews?.inspectedCount || 0);
  const unanswered = Number(reviews?.unansweredInRecent || 0);
  const responseRate = inspected > 0 ? clamp01((inspected - unanswered) / inspected) : 0;

  const sinceLastPost = daysSince(posts?.lastPostAt);
  let posting = 0;
  if (sinceLastPost !== null) {
    if (sinceLastPost <= 7) posting = 1;
    else if (sinceLastPost <= 14) posting = 0.7;
    else if (sinceLastPost <= 30) posting = 0.35;
  }

  const updates = hasGoogleUpdates ? 0 : 1;

  const breakdown = {
    completeness: Math.round(completeness * WEIGHTS.completeness),
    verification: Math.round(verification * WEIGHTS.verification),
    rating: Math.round(rating * WEIGHTS.rating),
    responseRate: Math.round(responseRate * WEIGHTS.responseRate),
    posting: Math.round(posting * WEIGHTS.posting),
    googleUpdates: Math.round(updates * WEIGHTS.googleUpdates),
  };

  const score = Object.values(breakdown).reduce((total, value) => total + value, 0);
  return { score: Math.min(100, score), breakdown, weights: WEIGHTS };
}

// --- Issue list ------------------------------------------------------------

export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'opportunity'];

export function buildIssues(input) {
  const { completeness, verificationStatus, averageRating, reviews, posts, hasGoogleUpdates } = input;
  const issues = [];

  if (verificationStatus !== 'VERIFIED') {
    issues.push({
      severity: 'critical',
      title: 'Location is not verified',
      detail:
        verificationStatus === 'UNVERIFIED'
          ? 'An unverified listing does not appear in Maps results and cannot publish posts.'
          : 'Verification state could not be read from Google. Open the listing in Business Profile Manager to confirm.',
      action: 'Start verification',
    });
  }

  const negativeUnanswered = (reviews?.latest || []).filter(
    (review) => !review.replied && starRatingToNumber(review.starRating) <= 2
  ).length;
  if (negativeUnanswered > 0) {
    issues.push({
      severity: 'critical',
      title: `${negativeUnanswered} unanswered negative review${negativeUnanswered === 1 ? '' : 's'}`,
      detail: 'Reviews of 2 stars or lower are visible at the top of the listing until answered.',
      action: 'Reply now',
    });
  }

  const unanswered = Number(reviews?.unansweredInRecent || 0);
  if (unanswered > negativeUnanswered) {
    issues.push({
      severity: 'high',
      title: `${unanswered} unanswered reviews`,
      detail: `Out of the ${reviews?.inspectedCount || 0} most recent reviews fetched from Google.`,
      action: 'Open reviews',
    });
  }

  const sinceLastPost = daysSince(posts?.lastPostAt);
  if (sinceLastPost === null) {
    issues.push({
      severity: 'high',
      title: 'No Google posts found',
      detail: 'Posts keep the listing active and surface offers directly in search results.',
      action: 'Create first post',
    });
  } else if (sinceLastPost >= 14) {
    issues.push({
      severity: 'high',
      title: `No GBP post for ${sinceLastPost} days`,
      detail: 'Listings that post weekly hold interaction volume better than dormant ones.',
      action: 'Create post',
    });
  }

  if (hasGoogleUpdates) {
    issues.push({
      severity: 'high',
      title: 'Google has suggested a profile change',
      detail: 'Pending Google updates overwrite your data if they are left unreviewed.',
      action: 'Review update',
    });
  }

  for (const check of completeness?.checks || []) {
    if (check.ok) continue;
    issues.push({
      severity: 'medium',
      title: `${check.label} is missing`,
      detail: check.hint || `Add ${check.label.toLowerCase()} to complete the profile.`,
      action: 'Edit profile',
    });
  }

  if (averageRating && Number(averageRating) < 4.5) {
    issues.push({
      severity: 'opportunity',
      title: `Rating is ${Number(averageRating).toFixed(1)}`,
      detail: 'Listings at 4.5 and above convert noticeably better in the local pack.',
      action: 'Plan review campaign',
    });
  }

  return issues.sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );
}

// --- Metric shaping --------------------------------------------------------

export const METRIC_GROUPS = {
  searchViews: ['BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'],
  mapsViews: ['BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS'],
  calls: ['CALL_CLICKS'],
  websiteClicks: ['WEBSITE_CLICKS'],
  directions: ['BUSINESS_DIRECTION_REQUESTS'],
  messages: ['BUSINESS_CONVERSATIONS'],
};

export function groupMetricTotals(totals) {
  const grouped = {};
  for (const [key, metrics] of Object.entries(METRIC_GROUPS)) {
    grouped[key] = metrics.reduce((sum, metric) => sum + Number(totals?.[metric] || 0), 0);
  }
  return grouped;
}

export function percentChange(current, previous) {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
