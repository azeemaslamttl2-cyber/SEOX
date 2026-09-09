// GET  /api/gbp/overview?projectId=...&locationRowId=...&days=30
// POST /api/gbp/overview   { action: 'refresh', projectId, locationRowId }
//
// GET is quota-free: it renders from the SEOX copy written by the last refresh.
// POST is the only path that talks to Google, so a user opening the dashboard
// twenty times in a row costs nothing against the shared GBP quota.

import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { consumeRateLimit } from '../../_lib/rate-limit.js';
import { requireConnection, requireConnectionWithAccount, resolveLocation } from '../../_lib/gbp-request.js';
import {
  attachLocation,
  dailySeries,
  getLocationRow,
  logSync,
  metricsFreshness,
  sumMetrics,
  updateLocationSummary,
  useDatabase,
} from '../../_lib/gbp-repository.js';
import { getLocationProfile, getPerformance, getRecentPosts } from '../../_lib/gbp-service.js';
import { allReviewsForLocation } from '../../_lib/gbp-store.js';
import { summarise } from '../../_lib/gbp-reviews.js';
import {
  buildIssues,
  calculateHealthScore,
  evaluateCompleteness,
  groupMetricTotals,
  percentChange,
} from '../../_lib/gbp-scoring.js';

// Performance data lands a couple of days late, so a window that ends today
// would always show an artificial drop at the right edge.
const METRIC_LAG_DAYS = 3;
const MAX_WINDOW_DAYS = 540;

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function shiftDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function windowFor(days, anchor) {
  const end = anchor ? new Date(`${anchor}T00:00:00Z`) : shiftDays(new Date(), -METRIC_LAG_DAYS);
  const start = shiftDays(end, -(days - 1));
  const previousEnd = shiftDays(start, -1);
  const previousStart = shiftDays(previousEnd, -(days - 1));
  return {
    current: { from: isoDate(start), to: isoDate(end) },
    previous: { from: isoDate(previousStart), to: isoDate(previousEnd) },
  };
}

function parseProfile(row) {
  if (!row.raw_profile) return {};
  if (typeof row.raw_profile === 'object') return row.raw_profile;
  try {
    return JSON.parse(row.raw_profile);
  } catch {
    return {};
  }
}

async function buildOverview(userId, location, days, headers) {
  const freshness = await metricsFreshness(userId, location.id);
  const ranges = windowFor(days, freshness?.latest ? isoDate(new Date(freshness.latest)) : null);

  const [currentTotals, previousTotals, series] = await Promise.all([
    sumMetrics(userId, location.id, ranges.current.from, ranges.current.to),
    sumMetrics(userId, location.id, ranges.previous.from, ranges.previous.to),
    dailySeries(userId, location.id, ranges.current.from, ranges.current.to),
  ]);

  const current = groupMetricTotals(currentTotals);
  const previous = groupMetricTotals(previousTotals);

  const profile = parseProfile(location);
  const completeness = evaluateCompleteness(profile);
  const reviews = {
    inspectedCount: location.total_reviews ?? 0,
    unansweredInRecent: location.unanswered_reviews ?? 0,
    latest: [],
  };
  const posts = { lastPostAt: location.last_post_at, postsLast30Days: location.posts_last_30_days };

  const health = calculateHealthScore({
    completenessPercent: completeness.percent,
    verificationStatus: location.verification_status,
    averageRating: location.average_rating,
    reviews,
    posts,
    hasGoogleUpdates: Boolean(location.has_google_updates),
  });

  const issues = buildIssues({
    completeness,
    verificationStatus: location.verification_status,
    averageRating: location.average_rating,
    reviews,
    posts,
    hasGoogleUpdates: Boolean(location.has_google_updates),
  });

  const metrics = Object.keys(current).map((key) => ({
    key,
    current: current[key],
    previous: previous[key],
    change: percentChange(current[key], previous[key]),
  }));

  return jsonResponse(
    {
      location: {
        id: location.id,
        locationId: location.location_id,
        businessName: location.business_name,
        primaryCategory: location.primary_category,
        address: location.formatted_address,
        mapsUri: location.maps_uri,
        verificationStatus: location.verification_status,
        openStatus: location.open_status,
        hasGoogleUpdates: Boolean(location.has_google_updates),
        lastSyncAt: location.last_sync_at,
      },
      headline: {
        healthScore: health.score,
        averageRating: location.average_rating === null ? null : Number(location.average_rating),
        totalReviews: location.total_reviews,
        unansweredReviews: location.unanswered_reviews,
        postsLast30Days: location.posts_last_30_days,
        lastPostAt: location.last_post_at,
        // Filled in when RankGrid is wired to GBP locations (phase 4).
        localRankAverage: null,
      },
      health,
      completeness,
      metrics,
      series,
      range: { days, ...ranges, metricLagDays: METRIC_LAG_DAYS },
      issues,
      // Never synced: everything above is zeroed until the first refresh.
      needsFirstSync: !location.last_sync_at || !freshness?.latest,
    },
    200,
    headers
  );
}

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders('GET, POST, OPTIONS'), 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return emptyResponse(204, headers);

  try {
    const decoded = await verifyAccessToken(request, env);
    const userId = decoded.uid;
    useDatabase(env);

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const projectId = url.searchParams.get('projectId');
      const locationRowId = url.searchParams.get('locationRowId');
      const days = Math.min(
        MAX_WINDOW_DAYS,
        Math.max(7, Number(url.searchParams.get('days') || 30) || 30)
      );

      await requireConnection(env, userId, projectId);
      const location = await resolveLocation(userId, projectId, locationRowId);
      return buildOverview(userId, location, days, headers);
    }

    if (request.method === 'POST') {
      const { action, projectId, locationRowId, days = 30 } = await readJson(request);
      if (action !== 'refresh') return jsonResponse({ error: 'Invalid action' }, 400, headers);
      await consumeRateLimit(userId, 'gbp:refresh-overview');

      const connection = await requireConnectionWithAccount(env, userId, projectId);
      const location = await resolveLocation(userId, projectId, locationRowId);
      const startedAt = Date.now();
      const warnings = [];

      // Profile. A failure here is fatal for the refresh; the rest are not.
      const { profile: fresh } = await getLocationProfile(env, {
        userId,
        projectId,
        locationRowId: location.id,
      });
      await attachLocation(userId, projectId, connection.id, fresh, {
        isPrimary: Boolean(location.is_primary),
      });

      // Metrics through the service, so the manual refresh and the nightly
      // sync_metrics job pull and store them identically.
      let metricRows = 0;
      try {
        const performance = await getPerformance(env, {
          userId,
          projectId,
          locationRowId: location.id,
          days: Number(days) * 2,
        });
        metricRows = performance.rows;
      } catch (error) {
        warnings.push(`Performance: ${error.message}`);
      }

      // Reviews come from the stored set the Reviews module syncs, not from a
      // one-page peek: the two disagreed on the unanswered count, and the
      // stored set is the accurate one. It also costs no quota here.
      const storedReviews = await allReviewsForLocation(userId, location.id, 500);
      const reviews = storedReviews.length
        ? (() => {
            const { counts, averageRating } = summarise(storedReviews);
            return {
              averageRating,
              totalReviews: counts.total,
              inspectedCount: counts.total,
              unansweredInRecent: counts.unanswered,
              latest: [],
            };
          })()
        : null;
      if (!reviews) {
        warnings.push('Reviews: none stored yet. Sync them on the Reviews page.');
      }

      let posts = null;
      try {
        posts = await getRecentPosts(env, { userId, projectId, locationRowId: location.id });
      } catch (error) {
        warnings.push(`Posts: ${error.message}`);
      }

      const completeness = evaluateCompleteness(fresh.raw);
      const health = calculateHealthScore({
        completenessPercent: completeness.percent,
        verificationStatus: fresh.verificationStatus,
        averageRating: reviews?.averageRating,
        reviews: reviews || {},
        posts: posts || {},
        hasGoogleUpdates: fresh.hasGoogleUpdates,
      });

      await updateLocationSummary(userId, location.id, {
        averageRating: reviews?.averageRating ?? undefined,
        totalReviews: reviews?.totalReviews ?? undefined,
        unansweredReviews: reviews?.unansweredInRecent ?? undefined,
        postsLast30Days: posts?.postsLast30Days ?? undefined,
        lastPostAt: posts ? posts.lastPostAt : undefined,
        profileCompleteness: completeness.percent,
        healthScore: health.score,
        verificationStatus: fresh.verificationStatus,
        openStatus: fresh.openStatus,
        hasGoogleUpdates: fresh.hasGoogleUpdates,
      });

      await logSync({
        userId,
        projectId,
        locationRowId: location.id,
        syncType: 'overview-refresh',
        status: warnings.length ? 'partial' : 'success',
        message: warnings.join(' | ') || null,
        itemsSynced: metricRows,
        durationMs: Date.now() - startedAt,
      });

      const refreshed = await getLocationRow(userId, location.id);
      const response = await buildOverview(userId, refreshed, Number(days) || 30, headers);
      const payload = await response.json();
      return jsonResponse({ ...payload, warnings, refreshedAt: new Date().toISOString() }, 200, headers);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
