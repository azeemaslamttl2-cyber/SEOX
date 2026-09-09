// GET  /api/gbp/recommendations?projectId=&locationRowId=[&status=][&priority=]
// POST /api/gbp/recommendations
//   run              rebuild recommendations from stored signals
//   sync-keywords    pull monthly GBP search keywords from the Performance API
//   execute          run a Safe AI Action on one recommendation
//   ignore           dismiss one recommendation
//
// Safe AI Actions never publish. `generate` and `schedule` produce drafts and
// return where to review them; the approval step lives in the module that owns
// the draft (Posts, Reviews, Q&A).

import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { consumeRateLimit } from '../../_lib/rate-limit.js';
import { requireConnection, requireConnectionWithAccount, resolveLocation } from '../../_lib/gbp-request.js';
import {
  logSync,
  useDatabase,
} from '../../_lib/gbp-repository.js';
import {
  closeMissingRecommendations,
  createPost,
  decidedRecommendationKeys,
  getRecommendation,
  latestRecommendationRun,
  listRecommendations,
  markRecommendation,
  parseJson,
  reviewsNeedingDraft,
  saveRecommendationRun,
  saveRecommendations,
  searchKeywordMonths,
  updateQuestion,
  updateReview,
  upsertSearchKeywords,
  listQuestions,
} from '../../_lib/gbp-store.js';
import { getSearchKeywords } from '../../_lib/gbp-service.js';
import { gatherSignals } from '../../_lib/gbp-signals.js';
import {
  buildRecommendations,
  countByPriority,
  resolveAction,
} from '../../_lib/gbp-recommendations.js';
import { generatePostCopy, generateQuestionAnswer, generateReviewReply } from '../../_lib/gbp-ai.js';
import { applyUtm } from '../../_lib/gbp-posts.js';
import { tierFor, validateReply } from '../../_lib/gbp-reviews.js';

const DRAFT_BATCH = 10;

function serializeRecommendation(row) {
  return {
    id: row.id,
    key: row.rec_key,
    rule: row.rule,
    priority: row.priority,
    title: row.title,
    detail: row.detail,
    recommended: row.recommended,
    evidence: parseJson(row.evidence, {}),
    actions: parseJson(row.actions, []),
    status: row.status,
    actionTaken: row.action_taken,
    actionResult: parseJson(row.action_result, null),
    actionedBy: row.actioned_by,
    actionedAt: row.actioned_at,
    createdAt: row.created_at,
  };
}

async function hashKeyword(value) {
  const data = new TextEncoder().encode(String(value).toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// --- Safe AI Actions -------------------------------------------------------

async function generateReviewDrafts(env, { userId, location, limit }) {
  const targets = await reviewsNeedingDraft(userId, location.id, limit);
  let drafted = 0;
  const failures = [];

  for (const review of targets) {
    try {
      const draft = await generateReviewReply(env, userId, {
        businessName: location.business_name,
        primaryCategory: location.primary_category,
        starRating: review.star_rating,
        reviewerName: review.is_anonymous ? null : review.reviewer_name,
        comment: review.comment,
      });
      const validation = validateReply(draft.reply);
      const tier = tierFor(review.star_rating);

      await updateReview(userId, review.id, {
        draftReply: draft.reply,
        // Anything urgent or at three stars is parked for approval, matching
        // the tier policy the Reviews module enforces.
        draftStatus:
          tier.urgency === 'urgent' || tier.mode === 'manual_approval' ? 'awaiting_approval' : 'draft',
        draftGeneratedAt: new Date(),
        lastError: validation.valid ? null : validation.errors.join(' '),
      });
      drafted += 1;
    } catch (error) {
      failures.push({ reviewRowId: review.id, reason: error?.message || 'Draft failed.' });
    }
  }

  return { drafted, failures, target: 'review_replies' };
}

async function generateAnswerDrafts(env, { userId, location, limit }) {
  const rows = (await listQuestions(userId, location.id, 'unanswered')).slice(0, limit);
  const profile = parseJson(location.raw_profile, {}) || {};
  let drafted = 0;
  const failures = [];

  for (const question of rows) {
    try {
      const draft = await generateQuestionAnswer(env, userId, {
        businessName: location.business_name,
        primaryCategory: location.primary_category,
        address: location.formatted_address,
        website: location.website_url,
        description: profile.profile?.description || null,
        services: (profile.serviceItems || [])
          .map(
            (item) =>
              item.freeFormServiceItem?.label?.displayName || item.structuredServiceItem?.description
          )
          .filter(Boolean),
        question: question.text,
      });

      await updateQuestion(userId, question.id, {
        draftAnswer: draft.answer,
        draftStatus: draft.confident ? 'draft' : 'awaiting_approval',
        draftGeneratedAt: new Date(),
        lastError: null,
      });
      drafted += 1;
    } catch (error) {
      failures.push({ questionRowId: question.id, reason: error?.message || 'Draft failed.' });
    }
  }

  return { drafted, failures, target: 'qanda_answers' };
}

async function generatePostDraft(env, { userId, projectId, location, recommendation, schedule }) {
  const evidence = parseJson(recommendation.evidence, {}) || {};
  const profile = parseJson(location.raw_profile, {}) || {};

  const draft = await generatePostCopy(env, userId, {
    businessName: location.business_name,
    primaryCategory: location.primary_category,
    city: profile.storefrontAddress?.locality || null,
    keyword: evidence.keyword || null,
    topic: evidence.keyword ? null : 'A service update for the listing',
    services: (profile.serviceItems || [])
      .map(
        (item) => item.freeFormServiceItem?.label?.displayName || item.structuredServiceItem?.description
      )
      .filter(Boolean),
  });

  const ctaUrl = location.website_url
    ? applyUtm(location.website_url, { source: 'google', medium: 'gbp', campaign: 'recommendation' })
    : null;

  const post = await createPost({
    userId,
    projectId,
    locationRowId: location.id,
    topicType: 'STANDARD',
    summary: draft.summary,
    ctaType: ctaUrl ? draft.ctaType || 'LEARN_MORE' : null,
    ctaUrl,
    origin: 'recommendation',
    // Scheduled two hours out, still as a row the user can edit or delete
    // before the scheduler picks it up.
    status: schedule ? 'scheduled' : 'draft',
    scheduledAt: schedule ? new Date(Date.now() + 2 * 60 * 60 * 1000) : null,
  });

  return { drafted: 1, postId: post.id, scheduled: Boolean(schedule), target: 'post', failures: [] };
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
      await requireConnection(env, userId, projectId);
      const location = await resolveLocation(userId, projectId, url.searchParams.get('locationRowId'));

      const rows = await listRecommendations(userId, location.id, {
        status: url.searchParams.get('status') || 'open',
        priority: url.searchParams.get('priority') || 'all',
      });
      const run = await latestRecommendationRun(userId, location.id);
      const keywordMonths = await searchKeywordMonths(userId, location.id);

      return jsonResponse(
        {
          locationRowId: location.id,
          businessName: location.business_name,
          recommendations: rows.map(serializeRecommendation),
          counts: countByPriority(rows.map((row) => ({ priority: row.priority }))),
          lastRun: run
            ? {
                id: run.id,
                createdAt: run.created_at,
                sourcesUsed: parseJson(run.sources_used, []),
                sourcesMissing: parseJson(run.sources_missing, []),
              }
            : null,
          keywordMonths: keywordMonths.map((entry) => ({
            month: entry.month,
            keywords: Number(entry.keywords),
            impressions: Number(entry.impressions),
          })),
          needsFirstRun: !run,
        },
        200,
        headers
      );
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, headers);
    }

    const body = await readJson(request);
    const { action, projectId } = body;

    if (action === 'ignore') {
      await requireConnection(env, userId, projectId);
      const recommendation = await getRecommendation(userId, body.recommendationId);
      if (!recommendation) return jsonResponse({ error: 'Recommendation was not found.' }, 404, headers);
      const updated = await markRecommendation(userId, recommendation.id, {
        status: 'ignored',
        actionTaken: 'ignore',
        actionedBy: decoded.email || String(userId),
      });
      return jsonResponse({ success: true, recommendation: serializeRecommendation(updated) }, 200, headers);
    }

    if (action === 'sync-keywords') {
      // Keyword data is published monthly; twice a day is already generous.
      await consumeRateLimit(userId, 'gbp:sync-keywords');
      await requireConnectionWithAccount(env, userId, projectId);
      const location = await resolveLocation(userId, projectId, body.locationRowId);
      // One implementation, shared with the background sync_keywords job.
      const result = await getSearchKeywords(env, {
        userId,
        projectId,
        locationRowId: location.id,
      });
      return jsonResponse({ success: true, ...result }, 200, headers);
    }

    if (action === 'run') {
      await requireConnection(env, userId, projectId);
      const location = await resolveLocation(userId, projectId, body.locationRowId);
      const startedAt = Date.now();

      const signals = await gatherSignals(userId, projectId, location, { days: body.days || 30 });
      const built = buildRecommendations(signals);

      // A recommendation the user already ignored or actioned stays as it is.
      const decided = await decidedRecommendationKeys(userId, location.id);
      const fresh = built.filter((entry) => !decided.has(entry.key));

      const runId = await saveRecommendationRun({
        userId,
        projectId,
        locationRowId: location.id,
        signals: {
          range: signals.range,
          location: signals.location,
          reviews: signals.reviews,
          posts: signals.posts,
          questions: signals.questions,
        },
        sourcesUsed: signals.sourcesUsed,
        sourcesMissing: signals.sourcesMissing,
        counts: countByPriority(fresh),
      });

      await saveRecommendations(userId, projectId, location.id, runId, fresh);
      const resolved = await closeMissingRecommendations(userId, location.id, runId);

      await logSync({
        userId,
        projectId,
        locationRowId: location.id,
        syncType: 'recommendations',
        status: 'success',
        itemsSynced: fresh.length,
        durationMs: Date.now() - startedAt,
      });

      const rows = await listRecommendations(userId, location.id, { status: 'open' });
      return jsonResponse(
        {
          success: true,
          runId,
          recommendations: rows.map(serializeRecommendation),
          counts: countByPriority(fresh),
          resolvedSinceLastRun: resolved,
          sourcesUsed: signals.sourcesUsed,
          sourcesMissing: signals.sourcesMissing,
          skippedBecauseDecided: built.length - fresh.length,
        },
        200,
        headers
      );
    }

    if (action === 'execute') {
      await requireConnection(env, userId, projectId);
      const recommendation = await getRecommendation(userId, body.recommendationId);
      if (!recommendation) return jsonResponse({ error: 'Recommendation was not found.' }, 404, headers);

      const location = await resolveLocation(userId, projectId, recommendation.location_row_id);
      const available = parseJson(recommendation.actions, []);
      if (!available.includes(body.actionKey)) {
        return jsonResponse(
          { error: `"${body.actionKey}" is not offered on this recommendation.` },
          400,
          headers
        );
      }

      const resolvedAction = resolveAction(recommendation.rule, body.actionKey);

      if (resolvedAction.kind === 'navigate') {
        const updated = await markRecommendation(userId, recommendation.id, {
          status: 'actioned',
          actionTaken: body.actionKey,
          actionResult: { kind: 'navigate', target: resolvedAction.review },
          actionedBy: decoded.email || String(userId),
        });
        return jsonResponse(
          {
            success: true,
            kind: 'navigate',
            reviewUrl: resolvedAction.review,
            recommendation: serializeRecommendation(updated),
          },
          200,
          headers
        );
      }

      let result;
      if (resolvedAction.target === 'review_replies') {
        result = await generateReviewDrafts(env, { userId, location, limit: body.limit || DRAFT_BATCH });
      } else if (resolvedAction.target === 'qanda_answers') {
        result = await generateAnswerDrafts(env, { userId, location, limit: body.limit || DRAFT_BATCH });
      } else if (resolvedAction.target === 'post') {
        result = await generatePostDraft(env, {
          userId,
          projectId,
          location,
          recommendation,
          schedule: Boolean(resolvedAction.schedule),
        });
      } else {
        return jsonResponse({ error: 'That action has no handler.' }, 400, headers);
      }

      const updated = await markRecommendation(userId, recommendation.id, {
        status: 'actioned',
        actionTaken: body.actionKey,
        actionResult: { ...result, reviewUrl: resolvedAction.review },
        actionedBy: decoded.email || String(userId),
      });

      return jsonResponse(
        {
          success: true,
          kind: 'draft',
          // Nothing was published: the count is drafts waiting for approval.
          drafted: result.drafted,
          failures: result.failures,
          reviewUrl: resolvedAction.review,
          recommendation: serializeRecommendation(updated),
        },
        200,
        headers
      );
    }

    return jsonResponse({ error: 'Invalid action' }, 400, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
