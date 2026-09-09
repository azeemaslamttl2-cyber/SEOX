import { configureMysqlConnection, queryOne } from '../../_lib/mysql.js';
import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { extractOutlineFromUrls } from '../../../src/lib/contentTools.js';
import { improveOutlineWithDeepSeek } from '../../../src/lib/deepseekContent.js';

const MAX_TOKEN_LENGTH = 512;

function hasMysqlConfig(env = {}) {
  return Boolean(env?.MYSQL_HOST || env?.MYSQL_DATABASE || env?.MYSQL_USER);
}

function normalizeAdminToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  if (!token) {
    const error = new Error('admin_token is required');
    error.status = 400;
    throw error;
  }
  if (token.length > MAX_TOKEN_LENGTH) {
    const error = new Error('Invalid admin token.');
    error.status = 401;
    throw error;
  }
  return token;
}

async function verifyAdminToken(token, env) {
  const override = String(env?.ADMIN_TOKEN || '').trim();
  if (!hasMysqlConfig(env)) {
    if (override && token === override) return { id: 'dev-admin' };
    const error = new Error('Invalid admin token.');
    error.status = 401;
    throw error;
  }

  configureMysqlConnection(env);
  const admin = await queryOne(
    `SELECT id FROM users WHERE admin_token = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1`,
    [token]
  );
  if (!admin) {
    const error = new Error('Invalid admin token.');
    error.status = 401;
    throw error;
  }
  return admin;
}

function sanitizeUrls(value) {
  const raw = Array.isArray(value) ? value : [value];
  const list = raw
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .filter((item) => /^https?:\/\//i.test(item));

  if (!list.length) {
    const error = new Error('At least one valid URL is required.');
    error.status = 400;
    throw error;
  }

  return list.slice(0, 20);
}

function normalizeOutlineResult(result) {
  if (!Array.isArray(result)) return [];
  return result.map((item) => ({
    tag: String(item?.tag || 'h2').toLowerCase(),
    text: String(item?.text || '').trim(),
  })).filter((item) => item.text && /^[h1-6]$/.test(item.tag));
}

export async function onRequest({ request, env }) {
  const headers = {
    ...corsHeaders('GET, POST, OPTIONS'),
    'Cache-Control': 'no-store',
  };

  if (request.method === 'OPTIONS') return emptyResponse(204, headers);
  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonResponse({ success: false, message: 'Method not allowed.' }, 405, headers);
  }

  try {
    const body = await readJson(request);
    const query = new URL(request.url).searchParams;
    const urls = sanitizeUrls(body?.urls ?? body?.url ?? query.getAll('url'));
    const adminToken = normalizeAdminToken(body?.admin_token ?? query.get('admin_token'));
    await verifyAdminToken(adminToken, env);

    const outline = await extractOutlineFromUrls(urls);

    if (!outline.length) {
      return jsonResponse({
        success: true,
        data: { outline: [], message: 'No headings were found on the supplied URL(s).' },
      }, 200, headers);
    }

    let improved = outline;
    try {
      improved = await improveOutlineWithDeepSeek({ urls, outline });
    } catch (error) {
      improved = outline;
    }

    const normalized = normalizeOutlineResult(improved);
    return jsonResponse({
      success: true,
      data: {
        urls,
        outline: normalized,
        headingCount: normalized.length,
      },
    }, 200, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}

export default onRequest;
