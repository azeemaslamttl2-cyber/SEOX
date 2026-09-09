// Gathers every signal the recommendations engine can see for one location,
// from the data SEOX already stores rather than by calling Google again.
//
// Every source reports whether it is connected. A source that is not is listed
// in `missing` with the reason, so the UI can say what the engine did not look
// at instead of quietly producing advice from a partial picture.

import { queryOne } from './mysql.js';
import { dailySeries, sumMetrics } from './gbp-repository.js';
import {
  allReviewsForLocation,
  latestAudit,
  listQuestions,
  listPosts,
  parseJson,
  topSearchKeywords,
} from './gbp-store.js';
import { groupMetricTotals, percentChange } from './gbp-scoring.js';
import { summarise } from './gbp-reviews.js';

const METRIC_LABELS = {
  searchViews: 'Search views',
  mapsViews: 'Maps views',
  calls: 'Calls',
  websiteClicks: 'Website clicks',
  directions: 'Directions',
  messages: 'Messages',
};

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function shiftDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function daysSince(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000));
}

/**
 * Read the cached Search Console result the GSC module already stores for this
 * project. No live GSC call is made here.
 */
async function readGscQueries(userId, projectId) {
  try {
    const row = await queryOne(
      "SELECT result, updated_at FROM tool_results WHERE user_id = ? AND project_id = ? AND tool_key = 'gsc' LIMIT 1",
      [userId, projectId]
    );
    if (!row) return null;

    const result = parseJson(row.result, null);
    if (!result) return null;

    // topQueries and quickWins both carry query + position + impressions.
    const queries = [...(result.topQueries || []), ...(result.quickWins || [])];
    const byQuery = new Map();
    for (const entry of queries) {
      if (!entry?.query) continue;
      byQuery.set(entry.query.toLowerCase(), entry);
    }

    return {
      siteUrl: result.siteUrl || null,
      fetchedAt: result.fetchedAt || row.updated_at,
      queries: [...byQuery.values()],
    };
  } catch {
    // tool_results may not exist on an older installation.
    return null;
  }
}

export async function gatherSignals(userId, projectId, location, { days = 30 } = {}) {
  const used = [];
  const missing = [];

  // --- Profile -------------------------------------------------------------
  const profile = parseJson(location.raw_profile, {}) || {};
  used.push('GBP profile');

  const locationSignals = {
    businessName: location.business_name,
    primaryCategory: location.primary_category,
    city: profile.storefrontAddress?.locality || null,
    verificationStatus: location.verification_status,
    serviceCount: (profile.serviceItems || []).length,
    categoryCount: 1 + (profile.categories?.additionalCategories || []).length,
    descriptionLength: (profile.profile?.description || '').length,
    completeness: location.profile_completeness,
    healthScore: location.health_score,
  };

  // --- Reviews -------------------------------------------------------------
  const reviewRows = await allReviewsForLocation(userId, location.id, 500);
  let reviews = null;
  if (reviewRows.length) {
    const { counts, averageRating } = summarise(reviewRows);
    reviews = {
      total: counts.total,
      unanswered: counts.unanswered,
      urgent: counts.urgent,
      averageRating,
      flagged: counts.flagged,
    };
    used.push('Reviews');
  } else {
    missing.push({ source: 'Reviews', reason: 'No reviews synced yet. Run a sync on the Reviews page.' });
  }

  // --- Q&A -----------------------------------------------------------------
  const questionRows = await listQuestions(userId, location.id, 'all');
  let questions = null;
  if (questionRows.length) {
    const answered = questionRows.filter((row) => row.owner_answer).length;
    questions = { total: questionRows.length, answered, unanswered: questionRows.length - answered };
    used.push('Q&A');
  } else {
    missing.push({ source: 'Q&A', reason: 'No questions synced yet.' });
  }

  // --- Posts ---------------------------------------------------------------
  const postRows = await listPosts(userId, projectId, { locationRowId: location.id, limit: 100 });
  const published = postRows.filter((row) => row.status === 'published' && row.published_at);
  const posts = {
    postsLast30Days: location.posts_last_30_days ?? published.filter(
      (row) => new Date(row.published_at).getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000
    ).length,
    daysSinceLastPost: daysSince(location.last_post_at || published[0]?.published_at),
    scheduled: postRows.filter((row) => row.status === 'scheduled').length,
    drafts: postRows.filter((row) => row.status === 'draft' || row.status === 'pending_approval').length,
  };
  used.push('Posts');

  // --- Performance ---------------------------------------------------------
  const end = shiftDays(new Date(), -3);
  const start = shiftDays(end, -(days - 1));
  const previousEnd = shiftDays(start, -1);
  const previousStart = shiftDays(previousEnd, -(days - 1));

  const [currentTotals, previousTotals, series] = await Promise.all([
    sumMetrics(userId, location.id, isoDate(start), isoDate(end)),
    sumMetrics(userId, location.id, isoDate(previousStart), isoDate(previousEnd)),
    dailySeries(userId, location.id, isoDate(start), isoDate(end)),
  ]);

  let metrics = null;
  if (series.length) {
    const current = groupMetricTotals(currentTotals);
    const previous = groupMetricTotals(previousTotals);
    metrics = Object.keys(current).map((key) => ({
      key,
      label: METRIC_LABELS[key] || key,
      current: current[key],
      previous: previous[key],
      change: percentChange(current[key], previous[key]),
    }));
    used.push('Performance');
  } else {
    missing.push({
      source: 'Performance',
      reason: 'No metrics stored yet. Sync the overview dashboard.',
    });
  }

  // --- Search keywords -----------------------------------------------------
  const searchKeywords = await topSearchKeywords(userId, location.id, 40);
  if (searchKeywords.length) {
    used.push('GBP search keywords');
  } else {
    missing.push({
      source: 'GBP search keywords',
      reason: 'Not synced yet. Run the recommendations engine after a keyword sync.',
    });
  }

  // --- Search Console ------------------------------------------------------
  const gsc = await readGscQueries(userId, projectId);
  if (gsc?.queries?.length) {
    used.push('Search Console');
  } else {
    missing.push({
      source: 'Search Console',
      reason: 'No cached GSC result for this project. Connect Search Console and run a fetch.',
    });
  }

  // --- Audit ---------------------------------------------------------------
  const auditRow = await latestAudit(userId, location.id);
  let audit = null;
  if (auditRow) {
    audit = {
      score: auditRow.score,
      createdAt: auditRow.created_at,
      failing: (auditRow.issues || [])
        .filter((issue) => !issue.passed)
        .map((issue) => ({
          key: issue.check_key,
          severity: issue.severity,
          title: issue.title,
          detail: issue.detail,
          actionLabel: issue.action_label,
          pointsEarned: issue.points_earned,
          pointsPossible: issue.points_possible,
        })),
    };
    used.push('Health audit');
  } else {
    missing.push({ source: 'Health audit', reason: 'No audit has been run for this location yet.' });
  }

  // --- Media ---------------------------------------------------------------
  const mediaTotal = parseJson(auditRow?.signals, {})?.media?.total ?? null;
  const media = mediaTotal === null ? null : { total: mediaTotal };
  if (media === null) {
    missing.push({ source: 'Photos', reason: 'Photo count comes from a health audit run.' });
  }

  // --- Sources SEOX cannot supply yet --------------------------------------
  missing.push({
    source: 'RankGrid',
    reason: 'RankGrid results are not linked to GBP locations yet, so grid rank is not considered.',
  });
  missing.push({
    source: 'Competitors',
    reason: 'No competitor source is connected, so competitor averages are not considered.',
  });

  return {
    location: locationSignals,
    reviews,
    questions,
    posts,
    metrics,
    searchKeywords,
    gsc,
    audit,
    media,
    range: { days, from: isoDate(start), to: isoDate(end) },
    sourcesUsed: used,
    sourcesMissing: missing,
  };
}
