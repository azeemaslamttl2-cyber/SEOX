// GET  /api/gbp/insights?projectId=&locationRowId=[&history=1]
// POST /api/gbp/insights   { action: 'analyse', projectId, locationRowId }
//
// Review Intelligence. Themes come from the AI, but the counts it reports are
// checked against the stored review text: a theme the model claims 63 mentions
// of is only kept at a count SEOX can actually find. Ratings and totals are
// computed locally, never asked of the model.

import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { requireConnection, resolveLocation } from '../../_lib/gbp-request.js';
import { logSync, useDatabase } from '../../_lib/gbp-repository.js';
import {
  allReviewsForLocation,
  insightHistory,
  latestInsight,
  parseJson,
  saveInsight,
} from '../../_lib/gbp-store.js';
import { summarise } from '../../_lib/gbp-reviews.js';
import { extractReviewThemes } from '../../_lib/gbp-ai.js';

const MAX_THEMES = 12;

/**
 * Count how many stored reviews actually mention a theme, so the number shown
 * to the user is one SEOX can stand behind rather than one the model guessed.
 */
function verifyThemes(themes, reviews) {
  if (!Array.isArray(themes)) return [];
  const bodies = reviews.map((review) => String(review.comment || '').toLowerCase());

  return themes
    .map((entry) => {
      const theme = String(entry?.theme || '').trim();
      if (!theme) return null;

      const words = theme
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length > 2);
      if (!words.length) return null;

      // A review counts as a mention when it contains the theme phrase, or all
      // of its significant words.
      const phrase = theme.toLowerCase();
      const mentions = bodies.filter(
        (body) => body.includes(phrase) || words.every((word) => body.includes(word))
      ).length;

      return { theme, mentions, claimed: Number(entry.mentions) || null };
    })
    .filter((entry) => entry && entry.mentions > 0)
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, MAX_THEMES);
}

function serializeInsight(row) {
  if (!row) return null;
  return {
    id: row.id,
    reviewsAnalysed: row.reviews_analysed,
    averageRating: row.average_rating === null ? null : Number(row.average_rating),
    positiveThemes: parseJson(row.positive_themes, []),
    negativeThemes: parseJson(row.negative_themes, []),
    ratingBreakdown: parseJson(row.rating_breakdown, {}),
    recommendation: row.recommendation,
    createdAt: row.created_at,
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
      const location = await resolveLocation(userId, projectId, url.searchParams.get('locationRowId'));

      if (url.searchParams.get('history') === '1') {
        const history = await insightHistory(userId, location.id, 12);
        return jsonResponse(
          {
            history: history.map((entry) => ({
              id: entry.id,
              reviewsAnalysed: entry.reviews_analysed,
              averageRating: entry.average_rating === null ? null : Number(entry.average_rating),
              createdAt: entry.created_at,
            })),
          },
          200,
          headers
        );
      }

      const stored = await allReviewsForLocation(userId, location.id, 500);
      return jsonResponse(
        {
          locationRowId: location.id,
          businessName: location.business_name,
          insight: serializeInsight(await latestInsight(userId, location.id)),
          reviewsAvailable: stored.length,
          summary: summarise(stored),
        },
        200,
        headers
      );
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, headers);
    }

    const { action, projectId, locationRowId } = await readJson(request);
    if (action !== 'analyse') return jsonResponse({ error: 'Invalid action' }, 400, headers);

    await requireConnection(env, userId, projectId);
    const location = await resolveLocation(userId, projectId, locationRowId);

    const reviews = await allReviewsForLocation(userId, location.id, 500);
    const withText = reviews.filter((review) => String(review.comment || '').trim());
    if (withText.length < 5) {
      return jsonResponse(
        {
          error: `Only ${withText.length} reviews have text. Sync reviews first, or wait until there are at least 5 written reviews to analyse.`,
        },
        409,
        headers
      );
    }

    const startedAt = Date.now();
    const themes = await extractReviewThemes(
      env,
      userId,
      withText.map((review) => ({ starRating: review.star_rating, comment: review.comment }))
    );
    if (!themes) {
      return jsonResponse(
        { error: 'No DeepSeek API key configured. Add one in Settings before running the analysis.' },
        400,
        headers
      );
    }

    const summary = summarise(reviews);
    const positive = verifyThemes(themes.positive, withText.filter((review) => review.star_rating >= 4));
    const negative = verifyThemes(themes.negative, withText.filter((review) => review.star_rating <= 3));

    const insightId = await saveInsight({
      userId,
      projectId,
      locationRowId: location.id,
      reviewsAnalysed: withText.length,
      averageRating: summary.averageRating,
      positiveThemes: positive,
      negativeThemes: negative,
      recommendation: themes.recommendation || null,
      ratingBreakdown: summary.ratingBreakdown,
    });

    await logSync({
      userId,
      projectId,
      locationRowId: location.id,
      syncType: 'review-intelligence',
      status: 'success',
      itemsSynced: withText.length,
      durationMs: Date.now() - startedAt,
    });

    const stored = await latestInsight(userId, location.id);
    return jsonResponse(
      {
        success: true,
        insightId,
        insight: serializeInsight(stored),
        summary,
        // Where the model's own count differed from what SEOX could verify.
        adjustedThemes: [...positive, ...negative]
          .filter((entry) => entry.claimed !== null && entry.claimed !== entry.mentions)
          .map((entry) => ({ theme: entry.theme, claimed: entry.claimed, verified: entry.mentions })),
      },
      200,
      headers
    );
  } catch (error) {
    return errorResponse(error, headers);
  }
}
