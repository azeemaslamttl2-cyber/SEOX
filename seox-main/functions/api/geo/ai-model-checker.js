import { configureMysqlConnection, queryOne, update } from '../../_lib/mysql.js';
import { corsHeaders, emptyResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { fetchPublicHttpUrl, parsePublicHttpUrl } from '../../_lib/url-security.js';
import { requireUser } from '../../_lib/auth-token.js';

const MAX_TOKEN_LENGTH = 512;
const MAX_URLS = 100;
const REQUEST_TIMEOUT_MS = 15000;

export const AI_CRAWLERS = [
  {
    id: 'google-gemini',
    name: 'Google Gemini',
    userAgent: 'Google-Extended',
    icon: '🟢',
  },
  {
    id: 'openai-gpt-user',
    name: 'OpenAI GPT',
    userAgent: 'ChatGPT-User',
    icon: '🔵',
  },
  {
    id: 'openai-gptbot',
    name: 'OpenAI GPT',
    userAgent: 'GPTBot',
    icon: '🟢',
  },
  {
    id: 'ccbot',
    name: 'CCBot',
    userAgent: 'CCBot',
    icon: '🔵',
  },
  {
    id: 'anthropic-claude',
    name: 'Anthropic Claude',
    userAgent: 'anthropic-ai',
    icon: '🟠',
  },
  {
    id: 'claudebot',
    name: 'Anthropic Claude',
    userAgent: 'ClaudeBot',
    icon: '🟠',
  },
  {
    id: 'perplexity',
    name: 'Perplexity AI',
    userAgent: 'PerplexityBot',
    icon: '🟣',
  },
];

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function apiError(error, headers) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message = status >= 500 ? 'AI model check failed.' : error.message;
  if (status >= 500) console.error(error);
  return jsonResponse({
    success: false,
    status: status === 400 ? 'validation_error' : status === 401 ? 'unauthorized' : status === 404 ? 'not_found' : status === 413 ? 'payload_too_large' : status === 504 ? 'timeout' : 'error',
    message,
    data: null,
  }, status, headers);
}

function normalizeToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  if (!token) fail('admin_token is required.', 400);
  if (token.length > MAX_TOKEN_LENGTH) fail('Invalid admin token.', 401);
  return token;
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
  const tokenUser = await queryOne(
    'SELECT id FROM users WHERE admin_token = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1',
    [token]
  );
  if (tokenUser) return tokenUser;

  try {
    return await requireUser(new Request('http://ai-model-checker.internal', {
      headers: { authorization: `Bearer ${token}` },
    }), env);
  } catch {
    fail('Invalid admin token.', 401);
  }
}

export function checkRobotsForBot(robotsTxt, userAgent, path = '/') {
  if (!robotsTxt) return { allowed: true, reason: 'No robots.txt found' };

  const lines = robotsTxt.split(/\r?\n/);
  let currentUserAgent = null;
  const specificRules = [];
  const wildcardRules = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const commentIndex = trimmed.indexOf('#');
    const cleanLine = commentIndex >= 0 ? trimmed.slice(0, commentIndex).trim() : trimmed;
    if (!cleanLine) continue;

    const lower = cleanLine.toLowerCase();
    if (lower.startsWith('user-agent:')) {
      currentUserAgent = lower.replace('user-agent:', '').trim();
    } else if (currentUserAgent) {
      if (lower.startsWith('disallow:') || lower.startsWith('allow:')) {
        const type = lower.startsWith('disallow:') ? 'disallow' : 'allow';
        const rulePath = cleanLine.slice(cleanLine.indexOf(':') + 1).trim();

        const rule = { type, path: rulePath };
        if (currentUserAgent === userAgent.toLowerCase()) {
          specificRules.push(rule);
        } else if (currentUserAgent === '*') {
          wildcardRules.push(rule);
        }
      }
    }
  }

  const rules = specificRules.length > 0 ? specificRules : wildcardRules;

  for (const rule of rules) {
    if (rule.path && path.startsWith(rule.path)) {
      if (rule.type === 'disallow') {
        return { allowed: false, reason: `Disallowed by rule: ${rule.path}` };
      }
      if (rule.type === 'allow') {
        return { allowed: true, reason: `Allowed by rule: ${rule.path}` };
      }
    }
    if (rule.path === '/' && rule.type === 'disallow') {
      return { allowed: false, reason: 'All paths disallowed' };
    }
  }

  return { allowed: true, reason: 'Allowed' };
}

function parseUrlList(body) {
  const raw = body?.urls ?? body?.url ?? body?.urlList ?? body?.project_url ?? body?.domain ?? body?.website;
  if (!raw) fail('URL is required.', 400);

  let list = [];
  if (Array.isArray(raw)) {
    list = raw.map((u) => (typeof u === 'string' ? u.trim() : '')).filter(Boolean);
  } else if (typeof raw === 'string') {
    list = raw
      .split(/[\r\n,]+/)
      .map((u) => u.trim())
      .filter(Boolean);
  }

  if (list.length === 0) fail('Please enter at least one URL to analyze', 400);
  if (list.length > MAX_URLS) fail('Maximum 100 URLs supported', 400);

  return list;
}

async function persist(userId, explicitProjectId, primaryUrl, results) {
  if (!userId || userId === 'configured-admin') return false;

  const projectId = explicitProjectId || (() => {
    try {
      return new URL(primaryUrl).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return '';
    }
  })();
  if (!projectId) return false;

  try {
    configureMysqlConnection();
  } catch {
    return false;
  }

  // 1. Save to tool_results
  try {
    await update(
      `INSERT INTO tool_results
         (user_id, project_id, tool_key, project_url, result, created_at, updated_at)
       VALUES (?, ?, 'aiModelChecker', ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         project_url = VALUES(project_url),
         result = VALUES(result),
         updated_at = NOW()`,
      [userId, projectId, primaryUrl, JSON.stringify(results)]
    );
  } catch (error) {
    if (error?.code !== 'ER_NO_SUCH_TABLE') {
      console.warn('Could not save to tool_results:', error?.message);
    }
  }

  // 2. Merge to user_projects.project_data
  try {
    const row = await queryOne(
      'SELECT project_data FROM user_projects WHERE user_id = ? AND project_id = ? LIMIT 1',
      [userId, projectId]
    );
    if (!row) return false;

    let existing = {};
    if (row.project_data) {
      existing = typeof row.project_data === 'string' ? JSON.parse(row.project_data) : row.project_data;
    }
    const merged = {
      ...(existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}),
      aiModelChecker: results,
    };
    await update(
      'UPDATE user_projects SET project_data = ?, updated_at = NOW() WHERE user_id = ? AND project_id = ?',
      [JSON.stringify(merged), userId, projectId]
    );
    return true;
  } catch (error) {
    console.warn('Could not save to user_projects:', error?.message);
    return false;
  }
}

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders('POST, OPTIONS'), 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return emptyResponse(204, headers);
  if (request.method !== 'POST') return apiError(Object.assign(new Error('Method not allowed. Use POST.'), { status: 405 }), headers);

  try {
    const body = await readJson(request);
    const user = await authenticate(request, body, env);
    const urlList = parseUrlList(body);

    const robotsCache = new Map();
    const analysisResults = [];

    for (const urlStr of urlList) {
      try {
        const candidate = urlStr.startsWith('http') ? urlStr : `https://${urlStr}`;
        const url = parsePublicHttpUrl(candidate, 'URL');
        const robotsUrl = `${url.protocol}//${url.hostname}/robots.txt`;

        let cached = robotsCache.get(robotsUrl);
        if (!cached) {
          let robotsTxt = '';
          let httpCode = 200;

          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
            const response = await fetchPublicHttpUrl(robotsUrl, {
              signal: controller.signal,
              headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SEOX/1.0',
                accept: 'text/plain,text/html,*/*',
              },
            });
            clearTimeout(timeoutId);
            httpCode = response.status;
            if (response.ok) {
              robotsTxt = (await response.text()).slice(0, 500000);
            }
          } catch (err) {
            if (err?.status === 400 && /private|local|metadata/i.test(err?.message)) {
              throw err;
            }
            robotsTxt = '';
            httpCode = err?.status || 404;
          }

          cached = { robotsTxt, httpCode };
          robotsCache.set(robotsUrl, cached);
        }

        const crawlerResults = AI_CRAWLERS.map((crawler) => {
          const check = checkRobotsForBot(cached.robotsTxt, crawler.userAgent, url.pathname || '/');
          return {
            ...crawler,
            status: check.allowed ? 'Allowed' : 'Blocked',
            httpCode: cached.httpCode,
            details: check.reason,
          };
        });

        analysisResults.push({
          url: url.href,
          crawlers: crawlerResults,
        });
      } catch (err) {
        if (err?.status === 400 && /private|local|metadata/i.test(err?.message)) {
          throw err;
        }
        analysisResults.push({
          url: urlStr,
          error: err?.message || 'Invalid URL format',
          crawlers: [],
        });
      }
    }

    const primaryUrl = analysisResults[0]?.url || urlList[0];
    const persisted = await persist(user?.id, body?.project_id, primaryUrl, analysisResults);

    return jsonResponse({
      success: true,
      status: 'success',
      message: 'AI model check completed successfully.',
      data: {
        results: analysisResults,
        totalUrls: analysisResults.length,
        persisted,
        checkedAt: new Date().toISOString(),
      },
    }, 200, headers);
  } catch (error) {
    return apiError(error, headers);
  }
}

export default onRequest;
