import { requireUser } from '../../_lib/auth-token.js';
import { configureMysqlConnection, query, queryOne } from '../../_lib/mysql.js';
import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { validateProjectId } from '../../_lib/article-analysis.js';

function articleId(value) {
  const id = String(value || '').trim();
  if (!id || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw Object.assign(new Error('A valid article id is required'), { status: 400 });
  return id;
}

function articlePayload(body = {}) {
  const title = String(body.title || '').trim();
  const content = String(body.body || '');
  if (!title) throw Object.assign(new Error('Article title is required'), { status: 400 });
  if (title.length > 500) throw Object.assign(new Error('Article title must be 500 characters or fewer'), { status: 400 });
  if (content.length > 2_000_000) throw Object.assign(new Error('Article body must be 2 MB or smaller'), { status: 400 });
  return {
    title: title.slice(0, 500),
    topic: String(body.topic || '').trim().slice(0, 500) || null,
    body: content,
    status: ['draft', 'review', 'published', 'archived'].includes(body.status) ? body.status : 'draft',
    focus_keyword: String(body.focusKeyword || '').trim().slice(0, 255) || null,
    selected_keyword: String(body.selectedKeyword || '').trim().slice(0, 255) || null,
    meta_description: String(body.metaDescription || '').trim().slice(0, 300) || null,
  };
}

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders('GET, POST, PUT, DELETE, OPTIONS'), 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return emptyResponse(204, headers);
  try {
    const user = await requireUser(request, env);
    configureMysqlConnection(env);
    const url = new URL(request.url);
    const requestedId = url.searchParams.get('id');
    if (request.method === 'GET') {
      if (requestedId) {
        const row = await queryOne('SELECT * FROM articles WHERE id = ? AND user_id = ? LIMIT 1', [articleId(requestedId), user.uid]);
        return jsonResponse({ article: row || null }, row ? 200 : 404, headers);
      }
      const rows = await query('SELECT * FROM articles WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100', [user.uid]);
      return jsonResponse({ articles: rows }, 200, headers);
    }
    const body = await readJson(request);
    if (request.method === 'POST') {
      const id = articleId(body.id || `article_${Date.now()}`);
      const projectId = validateProjectId(body.projectId);
      const project = await queryOne('SELECT project_id FROM user_projects WHERE project_id = ? AND user_id = ? LIMIT 1', [projectId, user.uid]);
      if (!project) return jsonResponse({ error: 'Project was not found' }, 404, headers);
      const values = articlePayload(body);
      const wordCount = values.body.trim() ? values.body.trim().split(/\s+/).length : 0;
      await query(`INSERT INTO articles (id, user_id, project_id, title, topic, body, status, focus_keyword, selected_keyword, meta_description, word_count, reading_time, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`, [id, user.uid, projectId, values.title, values.topic, values.body, values.status, values.focus_keyword, values.selected_keyword, values.meta_description, wordCount, Math.max(1, Math.ceil(wordCount / 200))]);
      return jsonResponse({ success: true, articleId: id }, 201, headers);
    }
    if (request.method === 'PUT') {
      const id = articleId(body.id || requestedId);
      const values = articlePayload(body);
      const wordCount = values.body.trim() ? values.body.trim().split(/\s+/).length : 0;
      await query(`UPDATE articles SET title = ?, topic = ?, body = ?, status = ?, focus_keyword = ?, selected_keyword = ?, meta_description = ?, word_count = ?, reading_time = ?, updated_at = NOW() WHERE id = ? AND user_id = ?`, [values.title, values.topic, values.body, values.status, values.focus_keyword, values.selected_keyword, values.meta_description, wordCount, Math.max(1, Math.ceil(wordCount / 200)), id, user.uid]);
      return jsonResponse({ success: true, articleId: id }, 200, headers);
    }
    if (request.method === 'DELETE') {
      const id = articleId(body.id || requestedId);
      await query('DELETE FROM articles WHERE id = ? AND user_id = ?', [id, user.uid]);
      return jsonResponse({ success: true, articleId: id }, 200, headers);
    }
    return jsonResponse({ error: 'Method not allowed' }, 405, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}

export default onRequest;
