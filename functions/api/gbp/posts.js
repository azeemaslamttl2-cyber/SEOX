// GET  /api/gbp/posts?projectId=&locationRowId=&status=[&resource=templates]
// POST /api/gbp/posts
//   save | publish | schedule | schedule-recurring | delete
//   generate | save-template | delete-template | clear-block
//
// Publishing always runs through gbp-publish.js, so a "publish now" from the UI
// and a scheduled publish from the job runner behave identically.

import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { requireConnection, requireConnectionWithAccount, resolveLocation } from '../../_lib/gbp-request.js';
import {
  clearPostingBlock,
  useDatabase,
} from '../../_lib/gbp-repository.js';
import {
  attachPostsToSchedule,
  cancelPostSchedule,
  createPost,
  createPostSchedule,
  deletePost,
  listPostSchedules,
  deleteTemplate,
  getPost,
  listPosts,
  listTemplates,
  saveTemplate,
  updatePost,
} from '../../_lib/gbp-store.js';
import {
  CTA_TYPES,
  SUMMARY_LIMIT,
  TOPIC_TYPES,
  applyUtm,
  expandRecurrence,
  postingBlocked,
  validatePost,
} from '../../_lib/gbp-posts.js';
import { deleteStoredPost, publishStoredPost } from '../../_lib/gbp-publish.js';
import { generatePostCopy } from '../../_lib/gbp-ai.js';
import { parseJson } from '../../_lib/gbp-store.js';

function serializePost(row) {
  if (!row) return null;
  return {
    id: row.id,
    locationRowId: row.location_row_id,
    googlePostName: row.google_post_name,
    topicType: row.topic_type,
    summary: row.summary,
    ctaType: row.cta_type,
    ctaUrl: row.cta_url,
    mediaUrl: row.media_url,
    eventTitle: row.event_title,
    eventStart: row.event_start,
    eventEnd: row.event_end,
    offerCoupon: row.offer_coupon,
    offerTerms: row.offer_terms,
    offerRedeemUrl: row.offer_redeem_url,
    status: row.status,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    lastError: row.last_error,
    attempts: row.attempts,
    origin: row.origin,
    sourceUrl: row.source_url,
    templateId: row.template_id,
    createdAt: row.created_at,
  };
}

function postFromBody(body, projectId, locationRowId, userId) {
  const utm = body.utm || null;
  return {
    userId,
    projectId,
    locationRowId,
    topicType: String(body.topicType || 'STANDARD').toUpperCase(),
    summary: String(body.summary || '').trim(),
    ctaType: body.ctaType ? String(body.ctaType).toUpperCase() : null,
    ctaUrl: body.ctaUrl ? applyUtm(body.ctaUrl, utm) : null,
    mediaUrl: body.mediaUrl || null,
    eventTitle: body.eventTitle || null,
    eventStart: body.eventStart || null,
    eventEnd: body.eventEnd || null,
    offerCoupon: body.offerCoupon || null,
    offerTerms: body.offerTerms || null,
    offerRedeemUrl: body.offerRedeemUrl ? applyUtm(body.offerRedeemUrl, utm) : null,
    scheduledAt: body.scheduledAt || null,
    origin: body.origin || 'manual',
    sourceUrl: body.sourceUrl || null,
    templateId: body.templateId || null,
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
      await requireConnection(env, userId, projectId);

      if (url.searchParams.get('resource') === 'templates') {
        return jsonResponse({ templates: await listTemplates(userId, projectId) }, 200, headers);
      }

      if (url.searchParams.get('resource') === 'schedules') {
        const location = await resolveLocation(userId, projectId, url.searchParams.get('locationRowId'));
        return jsonResponse(
          { schedules: await listPostSchedules(userId, location.id) },
          200,
          headers
        );
      }

      const locationRowId = url.searchParams.get('locationRowId');
      const location = await resolveLocation(userId, projectId, locationRowId);
      const rows = await listPosts(userId, projectId, {
        locationRowId: location.id,
        status: url.searchParams.get('status') || undefined,
        limit: url.searchParams.get('limit'),
      });

      return jsonResponse(
        {
          locationRowId: location.id,
          businessName: location.business_name,
          posts: rows.map(serializePost),
          blocked: postingBlocked(location),
          successfulPosts: location.successful_posts,
          limits: { summaryLimit: SUMMARY_LIMIT, topicTypes: TOPIC_TYPES, ctaTypes: CTA_TYPES },
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

    if (action === 'save-template') {
      await requireConnection(env, userId, projectId);
      if (!body.name) return jsonResponse({ error: 'Template name is required.' }, 400, headers);
      const template = await saveTemplate({ ...body, userId, projectId });
      return jsonResponse({ success: true, template }, 200, headers);
    }

    if (action === 'delete-template') {
      await requireConnection(env, userId, projectId);
      const removed = await deleteTemplate(userId, body.templateId);
      return jsonResponse({ success: removed }, removed ? 200 : 404, headers);
    }

    const connection = await requireConnectionWithAccount(env, userId, projectId);
    const location = await resolveLocation(userId, projectId, body.locationRowId);

    if (action === 'clear-block') {
      await clearPostingBlock(userId, location.id);
      return jsonResponse({ success: true }, 200, headers);
    }

    if (action === 'generate') {
      const profile = parseJson(location.raw_profile, {}) || {};
      const draft = await generatePostCopy(env, userId, {
        businessName: location.business_name,
        primaryCategory: location.primary_category,
        city: profile.storefrontAddress?.locality || null,
        topicType: body.topicType || 'STANDARD',
        topic: body.topic || null,
        keyword: body.keyword || null,
        tone: body.tone || null,
        services: (profile.serviceItems || [])
          .map(
            (item) =>
              item.freeFormServiceItem?.label?.displayName ||
              item.structuredServiceItem?.serviceTypeId
          )
          .filter(Boolean),
        source: body.source || null,
      });

      const validation = validatePost({ ...draft, topicType: body.topicType || 'STANDARD' });
      return jsonResponse(
        { success: true, draft, validation },
        200,
        headers
      );
    }

    if (action === 'save' || action === 'schedule' || action === 'publish') {
      const wantsPublish = action === 'publish';
      const wantsSchedule = action === 'schedule';

      const payload = postFromBody(body, projectId, location.id, userId);
      if (wantsSchedule && !payload.scheduledAt) {
        return jsonResponse({ error: 'A scheduled time is required.' }, 400, headers);
      }

      const validation = validatePost(payload);
      if (!validation.valid) {
        return jsonResponse(
          { error: 'The post did not pass the pre-publish checks.', validationErrors: validation.errors },
          422,
          headers
        );
      }

      let row;
      if (body.postId) {
        const existing = await getPost(userId, body.postId);
        if (!existing) return jsonResponse({ error: 'Post was not found.' }, 404, headers);
        row = await updatePost(userId, body.postId, {
          ...payload,
          status: wantsSchedule ? 'scheduled' : existing.status === 'published' ? 'published' : 'draft',
          lastError: null,
        });
      } else {
        row = await createPost({
          ...payload,
          status: wantsSchedule ? 'scheduled' : 'draft',
        });
      }

      if (!wantsPublish) {
        return jsonResponse(
          { success: true, post: serializePost(row), warnings: validation.warnings },
          200,
          headers
        );
      }

      const result = await publishStoredPost(env, { connection, location, post: row, userId });
      return jsonResponse(
        {
          success: result.published,
          post: serializePost(result.post),
          errors: result.errors || null,
          warnings: result.warnings || validation.warnings,
          blocked: result.blocked || null,
        },
        result.published ? 200 : result.blocked ? 423 : 502,
        headers
      );
    }

    if (action === 'schedule-recurring') {
      const payload = postFromBody(body, projectId, location.id, userId);
      const validation = validatePost(payload);
      if (!validation.valid) {
        return jsonResponse(
          { error: 'The post did not pass the pre-publish checks.', validationErrors: validation.errors },
          422,
          headers
        );
      }

      // Recurrence is expanded into individual scheduled rows so it works the
      // same regardless of whether the API exposes native recurring posts.
      const dates = expandRecurrence({
        startAt: body.scheduledAt,
        cadence: body.cadence,
        occurrences: body.occurrences,
      });

      // The series definition is stored above its occurrences, so the whole
      // recurrence can be cancelled instead of deleting posts one at a time.
      const scheduleId = await createPostSchedule({
        userId,
        projectId,
        locationRowId: location.id,
        name: body.name || `${body.cadence} post series`,
        cadence: body.cadence,
        occurrences: dates.length,
        startsAt: body.scheduledAt,
        template: { ...payload, userId: undefined, projectId: undefined, locationRowId: undefined },
      });

      const created = [];
      for (const date of dates) {
        created.push(
          await createPost({ ...payload, scheduledAt: date, status: 'scheduled', origin: 'recurring' })
        );
      }
      await attachPostsToSchedule(userId, scheduleId, created.map((post) => post.id));

      return jsonResponse(
        { success: true, scheduleId, posts: created.map(serializePost), count: created.length },
        200,
        headers
      );
    }

    if (action === 'cancel-series') {
      if (!body.scheduleId) return jsonResponse({ error: 'scheduleId is required.' }, 400, headers);
      // Only occurrences that have not published yet are removed; anything
      // already live on Google stays there.
      const removed = await cancelPostSchedule(userId, body.scheduleId);
      return jsonResponse({ success: true, removedUpcoming: removed }, 200, headers);
    }

    if (action === 'delete') {
      const post = await getPost(userId, body.postId);
      if (!post) return jsonResponse({ error: 'Post was not found.' }, 404, headers);
      await deleteStoredPost(env, { connection, post, userId });
      await deletePost(userId, body.postId);
      return jsonResponse({ success: true }, 200, headers);
    }

    return jsonResponse({ error: 'Invalid action' }, 400, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
