import { configureMysqlConnection, queryOne } from '../../_lib/mysql.js';
import { corsHeaders, emptyResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { requireUser } from '../../_lib/auth-token.js';

const MAX_TOKEN_LENGTH = 512;
const MAX_MESSAGE_LENGTH = 12000;
const MAX_HISTORY_ITEMS = 20;
const MAX_HISTORY_LENGTH = 40000;
const MAX_CONTEXT_LENGTH = 30000;
const DEFAULT_MODEL = 'deepseek-chat';
const SYSTEM_PROMPT = `You are an SEO and GEO Search Console analyst. Answer using only the evidence supplied in the conversation and context. Clearly distinguish observations from estimates and recommendations. Never invent metrics, rankings, connected properties, or account access. Give concise, practical answers and acknowledge when the supplied data is insufficient.`;

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function apiError(error, headers) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message = status >= 500 ? 'AI chat request failed.' : error.message;
  if (status >= 500) console.error(error);
  return jsonResponse({ success: false, status: status === 400 ? 'validation_error' : status === 401 ? 'unauthorized' : status === 413 ? 'payload_too_large' : status === 504 ? 'timeout' : 'error', message, data: null }, status, headers);
}

function normalizeToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  if (!token) fail('admin_token is required.', 400);
  if (token.length > MAX_TOKEN_LENGTH) fail('Invalid admin token.', 401);
  return token;
}

function validateHistory(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail('history must be an array.', 400);
  if (value.length > MAX_HISTORY_ITEMS) fail(`history may contain at most ${MAX_HISTORY_ITEMS} messages.`, 413);
  const history = value.map((item) => {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string' || !item.content.trim()) fail('history contains an invalid message.', 400);
    return { role: item.role, content: item.content.trim() };
  });
  if (JSON.stringify(history).length > MAX_HISTORY_LENGTH) fail('history is too large.', 413);
  return history;
}

function validateContext(value) {
  if (value === undefined) return '';
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('context must be an object.', 400);
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_CONTEXT_LENGTH) fail('context is too large.', 413);
  return serialized;
}

async function authenticate(request, body, env) {
  const authorization = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (authorization) {
    try {
      return await requireUser(request, env);
    } catch {
      fail('Invalid or expired session.', 401);
    }
  }

  const token = normalizeToken(body?.admin_token);
  const configured = String(env?.ADMIN_TOKEN || '').trim();
  if (configured && token === configured) return { id: 'configured-admin' };
  if (configured && token.split('.').length !== 3) fail('Invalid admin token.', 401);

  configureMysqlConnection(env);
  const tokenUser = await queryOne('SELECT id FROM users WHERE admin_token = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1', [token]);
  if (tokenUser) return tokenUser;
  try {
    return await requireUser(new Request('http://ai-chat.internal', { headers: { authorization: `Bearer ${token}` } }), env);
  } catch {
    fail('Invalid admin token.', 401);
  }
}

async function loadDeepSeekKey(userId, env) {
  if (userId && userId !== 'configured-admin') {
    try {
      const settings = await queryOne('SELECT api_key FROM deepseek_api_settings WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
      if (settings?.api_key) return settings.api_key;
    } catch (error) {
      if (error?.code !== 'ER_NO_SUCH_TABLE') throw error;
    }
  }
  return String(env?.DEEPSEEK_API_KEY || '').trim();
}

async function callDeepSeek({ apiKey, history, message, context }) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  messages.push(...history);
  messages.push({ role: 'user', content: context ? `Evidence context:\n${context}\n\nUser request:\n${message}` : message });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: DEFAULT_MODEL, messages, temperature: 0.7, max_tokens: 4096, stream: false }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) fail(payload.error?.message || `DeepSeek API error: ${response.status}`, response.status >= 500 ? 502 : response.status);
    const reply = payload.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) fail('AI provider returned an invalid response.', 502);
    return { reply: reply.trim(), model: payload.model || DEFAULT_MODEL, usage: payload.usage || null };
  } catch (error) {
    if (error?.name === 'AbortError') fail('AI provider request timed out.', 504);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders('POST, OPTIONS'), 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return emptyResponse(204, headers);
  if (request.method !== 'POST') return apiError(Object.assign(new Error('Method not allowed. Use POST.'), { status: 405 }), headers);
  try {
    const body = await readJson(request);
    const user = await authenticate(request, body, env);
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) fail('message is required.', 400);
    if (message.length > MAX_MESSAGE_LENGTH) fail('message is too large.', 413);
    const history = validateHistory(body?.history ?? body?.messages);
    const context = validateContext(body?.context);
    const apiKey = await loadDeepSeekKey(user.id, env);
    if (!apiKey) fail('AI provider is not configured on the server.', 503);
    const result = await callDeepSeek({ apiKey, history, message, context });
    return jsonResponse({ success: true, status: 'success', message: 'AI response generated successfully.', data: { reply: result.reply, model: result.model, usage: result.usage, history: [...history, { role: 'user', content: message }, { role: 'assistant', content: result.reply }] } }, 200, headers);
  } catch (error) {
    return apiError(error, headers);
  }
}

export default onRequest;
