// GET  /api/gbp/audit?projectId=&locationRowId=[&auditId=][&history=1]
// POST /api/gbp/audit   { action: 'run', projectId, locationRowId }
//
// GET serves the last stored audit (no quota cost). POST gathers every signal
// from Google, scores them, and appends a new audit row — previous runs are
// never overwritten, so the history view can show movement over time.

import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { consumeRateLimit } from '../../_lib/rate-limit.js';
import { requireConnectionWithAccount, resolveLocation } from '../../_lib/gbp-request.js';
import { getAuditSignals } from '../../_lib/gbp-service.js';
import {
  logSync,
  updateLocationSummary,
  useDatabase,
} from '../../_lib/gbp-repository.js';
import { auditHistory, getAudit, latestAudit, saveAudit } from '../../_lib/gbp-store.js';
import { diffAudits, runAudit } from '../../_lib/gbp-audit.js';

function serializeAudit(audit) {
  if (!audit) return null;
  const parse = (value) => {
    if (!value) return null;
    return typeof value === 'object' ? value : JSON.parse(value);
  };
  return {
    id: audit.id,
    score: audit.score,
    maxScore: audit.max_score,
    breakdown: parse(audit.breakdown),
    signals: parse(audit.signals),
    skippedChecks: parse(audit.skipped_checks) || [],
    counts: {
      critical: audit.critical_count,
      high: audit.high_count,
      medium: audit.medium_count,
      low: audit.low_count,
      opportunity: audit.opportunity_count,
    },
    createdAt: audit.created_at,
    issues: (audit.issues || []).map((issue) => ({
      key: issue.check_key,
      category: issue.category,
      severity: issue.severity,
      passed: Boolean(issue.passed),
      title: issue.title,
      detail: issue.detail,
      actionLabel: issue.action_label,
      actionTarget: issue.action_target,
      pointsEarned: issue.points_earned,
      pointsPossible: issue.points_possible,
    })),
  };
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
      const auditId = url.searchParams.get('auditId');

      const location = await resolveLocation(userId, projectId, locationRowId);

      if (url.searchParams.get('history') === '1') {
        const history = await auditHistory(userId, location.id, 30);
        return jsonResponse(
          {
            history: history.map((entry) => ({
              id: entry.id,
              score: entry.score,
              counts: {
                critical: entry.critical_count,
                high: entry.high_count,
                medium: entry.medium_count,
                low: entry.low_count,
                opportunity: entry.opportunity_count,
              },
              createdAt: entry.created_at,
            })),
          },
          200,
          headers
        );
      }

      const audit = auditId ? await getAudit(userId, auditId) : await latestAudit(userId, location.id);
      const history = await auditHistory(userId, location.id, 2);
      const previous = history.find((entry) => audit && entry.id !== audit.id) || null;

      return jsonResponse(
        {
          locationRowId: location.id,
          businessName: location.business_name,
          audit: serializeAudit(audit),
          diff: audit && previous ? diffAudits({ ...serializeAudit(audit) }, previous) : null,
          needsFirstRun: !audit,
        },
        200,
        headers
      );
    }

    if (request.method === 'POST') {
      const { action, projectId, locationRowId } = await readJson(request);
      if (action !== 'run') return jsonResponse({ error: 'Invalid action' }, 400, headers);
      // An audit fans out to five Google endpoints.
      await consumeRateLimit(userId, 'gbp:run-audit');

      await requireConnectionWithAccount(env, userId, projectId);
      const location = await resolveLocation(userId, projectId, locationRowId);
      const startedAt = Date.now();

      // Gathering lives in the service: the profile is required, everything
      // else degrades to null with a warning so the audit skips rather than
      // fails that check.
      const { profile, attributes, reviews, posts, media, qanda, warnings } = await getAuditSignals(
        env,
        { userId, projectId, locationRowId: location.id }
      );

      const verificationStatus = profile.metadata?.hasVoiceOfMerchant ? 'VERIFIED' : 'UNVERIFIED';
      const result = runAudit({
        profile,
        attributes,
        reviews,
        posts,
        media,
        qanda,
        verificationStatus,
        openStatus: profile.openInfo?.status || null,
        hasGoogleUpdates: Boolean(profile.metadata?.hasPendingEdits),
      });

      const previous = await latestAudit(userId, location.id);

      const auditId = await saveAudit({
        userId,
        projectId,
        locationRowId: location.id,
        score: result.score,
        breakdown: result.breakdown,
        signals: {
          byCategory: result.byCategory,
          reviews: reviews
            ? { averageRating: reviews.averageRating, totalReviews: reviews.totalReviews }
            : null,
          media: media ? { total: media.total } : null,
          qanda,
          posts: posts ? { postsLast30Days: posts.postsLast30Days, lastPostAt: posts.lastPostAt } : null,
          warnings,
          // Flat snapshot the history view diffs against. Only signals that
          // were actually read are recorded; an unread one stays undefined so
          // a later diff skips it instead of reporting a fake change.
          snapshot: {
            reviewCount: reviews?.totalReviews ?? undefined,
            averageRating: reviews?.averageRating ?? undefined,
            unansweredReviews: reviews?.unansweredInRecent ?? undefined,
            serviceCount: (profile.serviceItems || []).length,
            photoCount: media?.total ?? undefined,
            categoryCount: 1 + (profile.categories?.additionalCategories || []).length,
            descriptionLength: (profile.profile?.description || '').length,
            postsLast30Days: posts?.postsLast30Days ?? undefined,
            questionsUnanswered: qanda?.unanswered ?? undefined,
            completenessPercent: result.completeness.percent,
          },
        },
        counts: result.counts,
        issues: result.issues,
        skippedChecks: result.skippedChecks,
      });

      await updateLocationSummary(userId, location.id, {
        healthScore: result.score,
        profileCompleteness: result.completeness.percent,
        verificationStatus,
        openStatus: profile.openInfo?.status || null,
        hasGoogleUpdates: Boolean(profile.metadata?.hasPendingEdits),
        ...(reviews
          ? {
              averageRating: reviews.averageRating ?? undefined,
              totalReviews: reviews.totalReviews ?? undefined,
              unansweredReviews: reviews.unansweredInRecent ?? undefined,
            }
          : {}),
        ...(posts
          ? { postsLast30Days: posts.postsLast30Days, lastPostAt: posts.lastPostAt }
          : {}),
      });

      await logSync({
        userId,
        projectId,
        locationRowId: location.id,
        syncType: 'audit',
        status: warnings.length ? 'partial' : 'success',
        message: warnings.join(' | ') || null,
        durationMs: Date.now() - startedAt,
      });

      const stored = await getAudit(userId, auditId);
      return jsonResponse(
        {
          success: true,
          audit: serializeAudit(stored),
          diff: previous ? diffAudits(result, previous) : null,
          warnings,
        },
        200,
        headers
      );
    }

    return jsonResponse({ error: 'Method not allowed' }, 405, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
