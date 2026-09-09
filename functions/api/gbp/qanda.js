// GET  /api/gbp/qanda?projectId=&locationRowId=&status=
// POST /api/gbp/qanda   sync | draft | draft-bulk | publish | delete-answer
//
// Answering a question is published under the business name, so the same
// authorisation gate the Reviews module uses applies here. The AI is fed only
// the profile SEOX already holds, and is told to say "contact us" rather than
// guess anything the profile does not contain.

import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { consumeRateLimit } from '../../_lib/rate-limit.js';
import { requireConnection, requireConnectionWithAccount, resolveLocation } from '../../_lib/gbp-request.js';
import { logSync, useDatabase } from '../../_lib/gbp-repository.js';
import {
  getQuestion,
  listQuestions,
  parseJson,
  updateQuestion,
} from '../../_lib/gbp-store.js';
import { deleteAnswer, getQuestions, replyQuestion } from '../../_lib/gbp-service.js';
import { replyAuthorization } from '../../_lib/gbp-reviews.js';
import { generateQuestionAnswer } from '../../_lib/gbp-ai.js';
import { periodsToDays } from '../../_lib/gbp-profile.js';

const ANSWER_LIMIT = 4096;

function serializeQuestion(row) {
  if (!row) return null;
  return {
    id: row.id,
    questionName: row.question_name,
    authorName: row.author_name,
    authorType: row.author_type,
    text: row.text,
    createTime: row.create_time,
    updateTime: row.update_time,
    upvoteCount: row.upvote_count,
    totalAnswerCount: row.total_answer_count,
    ownerAnswer: row.owner_answer,
    ownerAnswerTime: row.owner_answer_time,
    topAnswers: parseJson(row.top_answers, []),
    status: row.status,
    draftAnswer: row.draft_answer,
    draftStatus: row.draft_status,
    draftGeneratedAt: row.draft_generated_at,
    lastError: row.last_error,
  };
}

/**
 * Turn the stored profile into the facts the model is allowed to answer from.
 */
function businessContext(location) {
  const profile = parseJson(location.raw_profile, {}) || {};
  const hours = periodsToDays(profile.regularHours?.periods)
    .filter((day) => !day.closed)
    .map((day) => `${day.day}: ${day.ranges.map((range) => `${range.open}-${range.close}`).join(', ')}`)
    .join('; ');

  return {
    businessName: location.business_name,
    primaryCategory: location.primary_category,
    address: location.formatted_address,
    website: location.website_url,
    hours: hours || null,
    description: profile.profile?.description || null,
    services: (profile.serviceItems || [])
      .map(
        (item) =>
          item.freeFormServiceItem?.label?.displayName ||
          item.structuredServiceItem?.description ||
          item.structuredServiceItem?.serviceTypeId
      )
      .filter(Boolean),
  };
}

function validateAnswer(text) {
  const errors = [];
  const value = String(text || '').trim();
  if (!value) errors.push('Answer text is required.');
  if (value.length > ANSWER_LIMIT) {
    errors.push(`Answer is ${value.length} characters; Google allows ${ANSWER_LIMIT}.`);
  }
  return { valid: errors.length === 0, errors };
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

      const rows = await listQuestions(userId, location.id, url.searchParams.get('status') || 'all');
      const answered = rows.filter((row) => row.owner_answer).length;
      const drafts = rows.filter((row) => row.draft_status === 'draft').length;

      return jsonResponse(
        {
          locationRowId: location.id,
          businessName: location.business_name,
          questions: rows.map(serializeQuestion),
          counts: {
            total: rows.length,
            answered,
            unanswered: rows.length - answered,
            drafts,
          },
          authorization: {
            authorized: Boolean(location.reply_authorized),
            authorizedBy: location.reply_authorized_by,
            authorizedAt: location.reply_authorized_at,
          },
          answerLimit: ANSWER_LIMIT,
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
    const connection = await requireConnectionWithAccount(env, userId, projectId);
    const location = await resolveLocation(userId, projectId, body.locationRowId);

    if (action === 'sync') {
      await consumeRateLimit(userId, 'gbp:sync-qanda');
      // One implementation, shared with the background sync_qanda job.
      const data = await getQuestions(env, { userId, projectId, locationRowId: location.id });
      return jsonResponse(
        { success: true, synced: data.questions.length, truncated: data.truncated },
        200,
        headers
      );
    }

    if (action === 'draft' || action === 'draft-bulk') {
      const rows =
        action === 'draft'
          ? [await getQuestion(userId, body.questionRowId)].filter(Boolean)
          : (await listQuestions(userId, location.id, 'unanswered')).slice(0, body.limit || 10);

      const context = businessContext(location);
      const drafted = [];
      const skipped = [];

      for (const question of rows) {
        if (question.location_row_id !== location.id) {
          skipped.push({ questionRowId: question.id, reason: 'Question belongs to another location.' });
          continue;
        }
        try {
          const draft = await generateQuestionAnswer(env, userId, {
            ...context,
            question: question.text,
          });

          const updated = await updateQuestion(userId, question.id, {
            draftAnswer: draft.answer,
            // A draft the model was not confident about is held for review
            // rather than presented as ready to publish.
            draftStatus: draft.confident ? 'draft' : 'awaiting_approval',
            draftGeneratedAt: new Date(),
            lastError: null,
          });

          drafted.push({
            question: serializeQuestion(updated),
            confident: draft.confident,
            missing: draft.missing,
          });
        } catch (error) {
          skipped.push({ questionRowId: question.id, reason: error?.message || 'Draft failed.' });
        }
      }

      return jsonResponse({ success: true, drafted, skipped }, 200, headers);
    }

    if (action === 'publish') {
      const auth = replyAuthorization(location);
      if (!auth.allowed) {
        return jsonResponse(
          {
            error:
              'Answering on this client’s behalf has not been authorised. Record the authorisation on the Reviews page first.',
            code: auth.code,
          },
          403,
          headers
        );
      }

      const question = await getQuestion(userId, body.questionRowId);
      if (!question || question.location_row_id !== location.id) {
        return jsonResponse({ error: 'Question was not found.' }, 404, headers);
      }

      const text = body.answer ?? question.draft_answer;
      const validation = validateAnswer(text);
      if (!validation.valid) {
        return jsonResponse({ error: 'Answer was not published.', validationErrors: validation.errors }, 422, headers);
      }

      try {
        await replyQuestion(env, {
          userId,
          projectId,
          questionName: question.question_name,
          text: String(text).trim(),
        });
        const updated = await updateQuestion(userId, question.id, {
          ownerAnswer: String(text).trim(),
          ownerAnswerTime: new Date(),
          status: 'answered',
          draftStatus: 'published',
          draftAnswer: null,
          lastError: null,
        });
        await logSync({
          userId,
          projectId,
          locationRowId: location.id,
          syncType: 'qanda-answer',
          status: 'success',
          message: `answered by ${decoded.email || userId}`,
        });
        return jsonResponse({ success: true, question: serializeQuestion(updated) }, 200, headers);
      } catch (error) {
        const message = error?.message || 'Google rejected the answer.';
        await updateQuestion(userId, question.id, { lastError: message, draftStatus: 'failed' });
        return jsonResponse({ success: false, errors: [message] }, 502, headers);
      }
    }

    if (action === 'delete-answer') {
      const auth = replyAuthorization(location);
      if (!auth.allowed) return jsonResponse({ error: auth.message, code: auth.code }, 403, headers);

      const question = await getQuestion(userId, body.questionRowId);
      if (!question || question.location_row_id !== location.id) {
        return jsonResponse({ error: 'Question was not found.' }, 404, headers);
      }

      await deleteAnswer(env, { userId, projectId, questionName: question.question_name });
      const updated = await updateQuestion(userId, question.id, {
        ownerAnswer: null,
        status: 'unanswered',
        draftStatus: 'none',
      });
      return jsonResponse({ success: true, question: serializeQuestion(updated) }, 200, headers);
    }

    return jsonResponse({ error: 'Invalid action' }, 400, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
