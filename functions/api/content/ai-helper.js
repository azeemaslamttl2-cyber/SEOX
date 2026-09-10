import { corsHeaders, emptyResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { configureMysqlConnection, queryOne } from '../../_lib/mysql.js';
import { processAiHelperRequest } from '../../../src/lib/aiHelperService.js';

const MAX_TOKEN_LENGTH = 512;

function hasMysqlConfig(env = {}) {
  return Boolean(env?.MYSQL_HOST || env?.MYSQL_DATABASE || env?.MYSQL_USER);
}

function apiError(error, headers) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message = (status >= 500 ? error?.message || 'AI Helper request failed.' : error?.message || 'Validation failed').trim();

  return jsonResponse(
    {
      success: false,
      status: status === 400 ? 'validation_error' : status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : 'error',
      message,
      errors: status >= 500 ? { server: message } : { message },
    },
    status,
    headers
  );
}

function normalizeAdminToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  if (!token) {
    const error = new Error('admin_token is required.');
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
  const configured = String(env?.ADMIN_TOKEN || '').trim();
  if (!hasMysqlConfig(env)) {
    if (configured && token === configured) return { id: 'configured-admin' };
    const error = new Error('Invalid admin token.');
    error.status = 401;
    throw error;
  }

  if (configured && token === configured) return { id: 'configured-admin' };

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

async function resolveDeepSeekApiKeyForUser(user, env) {
  if (!user?.id) {
    const error = new Error('DeepSeek API is not configured. Please configure it from DeepSeek Settings.');
    error.status = 400;
    throw error;
  }

  try {
    configureMysqlConnection(env);
    const row = await queryOne(
      'SELECT api_key FROM deepseek_api_settings WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [user.id]
    );
    const apiKey = typeof row?.api_key === 'string' ? row.api_key.trim() : '';
    if (!apiKey) {
      const error = new Error('DeepSeek API is not configured. Please configure it from DeepSeek Settings.');
      error.status = 400;
      throw error;
    }
    return apiKey;
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      const error2 = new Error('DeepSeek API is not configured. Please configure it from DeepSeek Settings.');
      error2.status = 400;
      throw error2;
    }
    throw error;
  }
}

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders('POST, OPTIONS'), 'Cache-Control': 'no-store' };

  if (request.method === 'OPTIONS') return emptyResponse(204, headers);
  if (request.method !== 'POST') {
    return apiError(Object.assign(new Error('Method not allowed. Use POST.'), { status: 405 }), headers);
  }

  try {
    const body = await readJson(request);
    const adminToken = normalizeAdminToken(body?.admin_token);
    const adminUser = await verifyAdminToken(adminToken, env);
    const deepSeekApiKey = await resolveDeepSeekApiKeyForUser(adminUser, env);

    const action = String(body?.action || 'chat').trim();
    const keyword = String(body?.keyword || '').trim();
    const content = typeof body?.content === 'string' ? body.content : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const context = typeof body?.context === 'string' ? body.context.trim() : '';

    if (!keyword && !content && !message) {
      return apiError(Object.assign(new Error('keyword, content, or message is required.'), { status: 400 }), headers);
    }

    const result = await processAiHelperRequest({ action, keyword, content, message, context, apiKey: deepSeekApiKey });

    return jsonResponse(
      {
        success: true,
        status: 'success',
        message: 'AI Helper processed successfully',
        data: result,
      },
      200,
      headers
    );
  } catch (error) {
    return apiError(error, headers);
  }
}

export default onRequest;
