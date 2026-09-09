import { requireUser } from '../../_lib/auth-token.js';
import { configureMysqlConnection, query, queryOne } from '../../_lib/mysql.js';
import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { buildArticleSeoReview, validateArticleInput, validateProjectId } from '../../_lib/article-analysis.js';

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders('POST, OPTIONS'), 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return emptyResponse(204, headers);
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, headers);
  try {
    configureMysqlConnection(env);
    const user = await requireUser(request, env);
    const body = await readJson(request);
    const projectId = validateProjectId(body?.projectId);
    const article = validateArticleInput(body?.article);
    const articleId = String(body?.articleId || '').trim();
    if (!articleId || !/^[A-Za-z0-9_-]{1,80}$/.test(articleId)) return jsonResponse({ error: 'articleId is required' }, 400, headers);
    const owned = await queryOne('SELECT id FROM articles WHERE id = ? AND user_id = ? AND project_id = ? LIMIT 1', [articleId, user.uid, projectId]);
    if (!owned) return jsonResponse({ error: 'Article was not found for this project' }, 404, headers);
    const started = Date.now();
    const data = buildArticleSeoReview(article);
    const requestId = `${user.id}-${Date.now()}`;
    const reviewId = `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await query('INSERT INTO article_seo_reviews (id, article_id, user_id, provider, review_type, score, normalized_result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())', [reviewId, articleId, user.uid, 'custom', 'seo', data.score, JSON.stringify(data)]);
    return jsonResponse({ success: true, data, metadata: { provider: 'custom', analysisDate: new Date().toISOString(), requestId, reviewId, cached: false, processingTime: Date.now() - started } }, 200, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}

export default onRequest;
