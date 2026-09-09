// GET  /api/gbp/reviews?projectId=&locationRowId=&filter=&limit=&offset=
// POST /api/gbp/reviews
//   sync | draft | draft-bulk | publish-reply | delete-reply | flag
//   authorize | auto-reply-settings
//
// Replying speaks publicly as the business. Google's API policy requires the
// client's authorisation to act on their behalf, so every reply path checks
// replyAuthorization() first — including the auto path, which additionally
// refuses anything the star tier does not allow.

import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { consumeRateLimit } from '../../_lib/rate-limit.js';
import { requireConnection, requireConnectionWithAccount, resolveLocation } from '../../_lib/gbp-request.js';
import {
  getLocationRow,
  logSync,
  setAutoReplySettings,
  setReplyAuthorization,
  useDatabase,
} from '../../_lib/gbp-repository.js';
import {
  allReviewsForLocation,
  getReview,
  listReviews,
  logReviewReply,
  replyHistory,
  reviewsNeedingDraft,
  updateReview,
} from '../../_lib/gbp-store.js';
import { deleteReply, getReviews, replyReview } from '../../_lib/gbp-service.js';
import {
  FILTERS,
  REPLY_LIMIT,
  canAutoPublish,
  filterClause,
  replyAuthorization,
  summarise,
  tierFor,
  validateReply,
} from '../../_lib/gbp-reviews.js';
import { generateReviewReply } from '../../_lib/gbp-ai.js';

function serializeReview(row) {
  if (!row) return null;
  const tier = tierFor(row.star_rating);
  return {
    id: row.id,
    reviewId: row.review_id,
    reviewerName: row.is_anonymous ? 'Anonymous' : row.reviewer_name || 'Anonymous',
    reviewerPhotoUrl: row.reviewer_photo_url,
    starRating: row.star_rating,
    comment: row.comment,
    createTime: row.create_time,
    updateTime: row.update_time,
    replyComment: row.reply_comment,
    replyUpdateTime: row.reply_update_time,
    replyModerationState: row.reply_moderation_state,
    policyViolation: row.policy_violation,
    reviewReplyUri: row.review_reply_uri,
    mediaCount: row.media_count,
    sentiment: row.sentiment,
    flagged: Boolean(row.flagged),
    draftReply: row.draft_reply,
    draftStatus: row.draft_status,
    draftGeneratedAt: row.draft_generated_at,
    lastError: row.last_error,
    tier: { mode: tier.mode, urgency: tier.urgency, label: tier.label },
  };
}

function authorizationState(location) {
  return {
    authorized: Boolean(location.reply_authorized),
    authorizedBy: location.reply_authorized_by,
    authorizedAt: location.reply_authorized_at,
    note: location.reply_authorization_note,
    autoReplyEnabled: Boolean(location.auto_reply_enabled),
    autoReplyMinStars: location.auto_reply_min_stars,
  };
}

/**
 * Publish one reply. Shared by the single, bulk and auto paths so the
 * authorisation gate cannot be bypassed by taking a different route.
 */
async function publishReply(env, { connection, location, review, comment, userId, source, approvedBy }) {
  const auth = replyAuthorization(location);
  if (!auth.allowed) {
    return { published: false, code: auth.code, errors: [auth.message] };
  }

  const validation = validateReply(comment);
  if (!validation.valid) {
    return { published: false, code: 'INVALID', errors: validation.errors };
  }

  try {
    await replyReview(env, {
      userId,
      projectId: location.project_id,
      locationRowId: location.id,
      reviewId: review.review_id,
      comment: comment.trim(),
    });

    const updated = await updateReview(userId, review.id, {
      replyComment: comment.trim(),
      replyUpdateTime: new Date(),
      draftStatus: 'published',
      draftReply: null,
      lastError: null,
    });
    await logReviewReply({
      userId,
      reviewRowId: review.id,
      comment: comment.trim(),
      source,
      status: 'published',
      approvedBy,
    });
    return { published: true, review: updated, warnings: validation.warnings };
  } catch (error) {
    const message = error?.message || 'Google rejected the reply.';
    await updateReview(userId, review.id, { lastError: message, draftStatus: 'failed' });
    await logReviewReply({
      userId,
      reviewRowId: review.id,
      comment: comment.trim(),
      source,
      status: 'failed',
      approvedBy,
      error: message,
    });
    return { published: false, code: 'GOOGLE_ERROR', errors: [message] };
  }
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

      const filter = FILTERS.includes(url.searchParams.get('filter'))
        ? url.searchParams.get('filter')
        : 'all';
      const { clause, params } = filterClause(filter);

      const [rows, everything] = await Promise.all([
        listReviews(userId, location.id, {
          clause,
          params,
          limit: url.searchParams.get('limit'),
          offset: url.searchParams.get('offset'),
        }),
        allReviewsForLocation(userId, location.id, 500),
      ]);

      return jsonResponse(
        {
          locationRowId: location.id,
          businessName: location.business_name,
          filter,
          filters: FILTERS,
          reviews: rows.map(serializeReview),
          summary: summarise(everything),
          authorization: authorizationState(location),
          replyLimit: REPLY_LIMIT,
          lastSyncAt: rows[0]?.synced_at || null,
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

    // Authorisation and settings do not touch Google, so they only need the
    // connection to exist.
    if (action === 'authorize' || action === 'auto-reply-settings') {
      await requireConnection(env, userId, projectId);
      const location = await resolveLocation(userId, projectId, body.locationRowId);

      if (action === 'authorize') {
        if (body.authorized && !String(body.authorizedBy || '').trim()) {
          return jsonResponse(
            { error: 'Record who at the client granted the authorisation.' },
            400,
            headers
          );
        }
        await setReplyAuthorization(userId, location.id, {
          authorized: Boolean(body.authorized),
          authorizedBy: body.authorizedBy,
          note: body.note,
        });
        // Withdrawing authorisation must also stop the automatic path.
        if (!body.authorized) {
          await setAutoReplySettings(userId, location.id, { enabled: false, minStars: 5 });
        }
        await logSync({
          userId,
          projectId,
          locationRowId: location.id,
          syncType: 'review-authorization',
          status: 'success',
          message: `${body.authorized ? 'granted' : 'withdrawn'} by ${decoded.email || userId}`,
        });
        const refreshed = await getLocationRow(userId, location.id);
        return jsonResponse({ success: true, authorization: authorizationState(refreshed) }, 200, headers);
      }

      if (!location.reply_authorized && body.enabled) {
        return jsonResponse(
          { error: 'Record the client’s authorisation before switching on auto-reply.' },
          409,
          headers
        );
      }
      await setAutoReplySettings(userId, location.id, {
        enabled: Boolean(body.enabled),
        minStars: body.minStars,
      });
      const refreshed = await getLocationRow(userId, location.id);
      return jsonResponse({ success: true, authorization: authorizationState(refreshed) }, 200, headers);
    }

    const connection = await requireConnectionWithAccount(env, userId, projectId);
    const location = await resolveLocation(userId, projectId, body.locationRowId);

    if (action === 'sync') {
      // Every sync spends the shared Google quota, so a held-down button costs
      // every other tenant.
      await consumeRateLimit(userId, 'gbp:sync-reviews');
      // One implementation, shared with the background sync_reviews job.
      const result = await getReviews(env, { userId, projectId, locationRowId: location.id });
      return jsonResponse(
        {
          success: true,
          synced: result.synced,
          truncated: result.truncated,
          summary: result.summary,
          averageRating: result.averageRating,
          totalReviewCount: result.totalReviewCount,
        },
        200,
        headers
      );
    }

    if (action === 'draft' || action === 'draft-bulk') {
      const targets =
        action === 'draft'
          ? [await getReview(userId, body.reviewRowId)].filter(Boolean)
          : await reviewsNeedingDraft(userId, location.id, body.limit || 10);

      if (!targets.length) {
        return jsonResponse({ success: true, drafted: [], skipped: [] }, 200, headers);
      }

      const drafted = [];
      const skipped = [];
      const autoPublished = [];

      for (const review of targets) {
        if (review.location_row_id !== location.id) {
          skipped.push({ reviewRowId: review.id, reason: 'Review belongs to another location.' });
          continue;
        }
        try {
          const draft = await generateReviewReply(env, userId, {
            businessName: location.business_name,
            primaryCategory: location.primary_category,
            starRating: review.star_rating,
            reviewerName: review.is_anonymous ? null : review.reviewer_name,
            comment: review.comment,
            tone: body.tone || null,
          });

          const validation = validateReply(draft.reply);
          const tier = tierFor(review.star_rating);
          const auto = canAutoPublish(location, review.star_rating);

          // Only a five-star tier with authorisation and auto-reply on may
          // publish itself. Everything else stops at a draft.
          if (validation.valid && auto.allowed && body.allowAutoPublish !== false) {
            const result = await publishReply(env, {
              connection,
              location,
              review,
              comment: draft.reply,
              userId,
              source: 'ai_auto',
              approvedBy: null,
            });
            if (result.published) {
              autoPublished.push({ reviewRowId: review.id, comment: draft.reply });
              continue;
            }
            skipped.push({ reviewRowId: review.id, reason: (result.errors || []).join(' ') });
            continue;
          }

          const draftStatus = tier.mode === 'manual_approval' || tier.urgency === 'urgent'
            ? 'awaiting_approval'
            : 'draft';

          const updated = await updateReview(userId, review.id, {
            draftReply: draft.reply,
            draftStatus,
            draftGeneratedAt: new Date(),
            lastError: validation.valid ? null : validation.errors.join(' '),
          });
          await logReviewReply({
            userId,
            reviewRowId: review.id,
            comment: draft.reply,
            source: 'ai_draft',
            status: draftStatus,
          });

          drafted.push({
            review: serializeReview(updated),
            tier: tier.label,
            autoBlockedBecause: auto.allowed ? null : auto.reason,
            validation,
          });
        } catch (error) {
          skipped.push({ reviewRowId: review.id, reason: error?.message || 'Draft failed.' });
        }
      }

      return jsonResponse({ success: true, drafted, autoPublished, skipped }, 200, headers);
    }

    if (action === 'publish-reply') {
      const review = await getReview(userId, body.reviewRowId);
      if (!review || review.location_row_id !== location.id) {
        return jsonResponse({ error: 'Review was not found.' }, 404, headers);
      }

      const comment = body.comment ?? review.draft_reply;
      if (!comment) return jsonResponse({ error: 'There is no reply text to publish.' }, 400, headers);

      const result = await publishReply(env, {
        connection,
        location,
        review,
        comment,
        userId,
        source: body.comment ? 'manual' : 'ai_approved',
        approvedBy: decoded.email || String(userId),
      });

      const status = result.published ? 200 : result.code === 'NOT_AUTHORIZED' ? 403 : result.code === 'INVALID' ? 422 : 502;
      return jsonResponse(
        {
          success: result.published,
          review: result.review ? serializeReview(result.review) : null,
          errors: result.errors || null,
          warnings: result.warnings || null,
          code: result.code || null,
        },
        status,
        headers
      );
    }

    if (action === 'delete-reply') {
      const review = await getReview(userId, body.reviewRowId);
      if (!review || review.location_row_id !== location.id) {
        return jsonResponse({ error: 'Review was not found.' }, 404, headers);
      }
      const auth = replyAuthorization(location);
      if (!auth.allowed) return jsonResponse({ error: auth.message }, 403, headers);

      await deleteReply(env, {
        userId,
        projectId,
        locationRowId: location.id,
        reviewId: review.review_id,
      });
      const updated = await updateReview(userId, review.id, {
        replyComment: null,
        draftStatus: 'none',
      });
      await logReviewReply({
        userId,
        reviewRowId: review.id,
        comment: review.reply_comment || '',
        source: 'manual',
        status: 'deleted',
        approvedBy: decoded.email || String(userId),
      });
      return jsonResponse({ success: true, review: serializeReview(updated) }, 200, headers);
    }

    if (action === 'flag') {
      const review = await getReview(userId, body.reviewRowId);
      if (!review || review.location_row_id !== location.id) {
        return jsonResponse({ error: 'Review was not found.' }, 404, headers);
      }
      const updated = await updateReview(userId, review.id, { flagged: Boolean(body.flagged) });
      return jsonResponse({ success: true, review: serializeReview(updated) }, 200, headers);
    }

    if (action === 'history') {
      return jsonResponse(
        { history: await replyHistory(userId, body.reviewRowId) },
        200,
        headers
      );
    }

    return jsonResponse({ error: 'Invalid action' }, 400, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
