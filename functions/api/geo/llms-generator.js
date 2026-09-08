import { configureMysqlConnection, queryOne, update } from '../../_lib/mysql.js';
import { corsHeaders, emptyResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { fetchPublicHttpUrl, parsePublicHttpUrl } from '../../_lib/url-security.js';
import { requireUser } from '../../_lib/auth-token.js';

const MAX_TOKEN_LENGTH = 512;
const MAX_URLS = 500;
const REQUEST_TIMEOUT_MS = 15000;
const DEEPSEEK_MODEL = 'deepseek-chat';
const SYSTEM_PROMPT = 'You are a helpful assistant that generates LLMs.txt files for websites. LLMs.txt is a file that helps AI models understand website content and structure.';

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function apiError(error, headers) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message = status >= 500 ? 'LLMs generation failed.' : error.message;
  if (status >= 500) console.error(error);
  return jsonResponse({
    success: false,
    status: status === 400 ? 'validation_error' : status === 401 ? 'unauthorized' : status === 404 ? 'not_found' : status === 413 ? 'payload_too_large' : status === 504 ? 'timeout' : 'error',
    message,
    data: null
  }, status, headers);
}

function normalizeToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  if (!token) fail('admin_token is required.', 400);
  if (token.length > MAX_TOKEN_LENGTH) fail('Invalid admin token.', 401);
  return token;
}

function normalizeUrl(value, field = 'url') {
  let raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) fail(`${field} is required.`, 400);
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  return parsePublicHttpUrl(raw, field);
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
    return await requireUser(new Request('http://llms-generator.internal', {
      headers: { authorization: `Bearer ${token}` }
    }), env);
  } catch {
    fail('Invalid admin token.', 401);
  }
}

async function loadApiKey(userId, env) {
  if (userId && userId !== 'configured-admin') {
    try {
      const row = await queryOne(
        'SELECT api_key FROM deepseek_api_settings WHERE user_id = ? ORDER BY id DESC LIMIT 1',
        [userId]
      );
      if (row?.api_key) return row.api_key;
    } catch (error) {
      if (error?.code !== 'ER_NO_SUCH_TABLE') throw error;
    }
  }
  return String(env?.DEEPSEEK_API_KEY || '').trim();
}

function normalizePageUrl(value) {
  try {
    const url = parsePublicHttpUrl(value);
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function parseSitemap(xml) {
  return [...new Set(Array.from(String(xml).matchAll(/<loc[^>]*>\s*([^<]+)\s*<\/loc>/gi), (match) => match[1].trim()))]
    .filter((url) => !/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff|avif)(?:$|[?#])/i.test(url))
    .slice(0, MAX_URLS);
}

async function fetchText(url, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchPublicHttpUrl(url.toString(), {
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml,text/plain;q=0.8,*/*;q=0.5',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SEOX/1.0',
      }
    });
    if (!response.ok) fail(`Unable to fetch ${url}: HTTP ${response.status}.`, 502);
    return { response, content: (await response.text()).slice(0, 2000000) };
  } catch (error) {
    if (error?.name === 'AbortError') fail(`Request timed out for ${url}.`, 504);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function extractUrls(target, mode) {
  if (mode === 'sitemap') {
    const sitemap = await fetchText(target);
    let urls = parseSitemap(sitemap.content);
    if (/<sitemap\b/i.test(sitemap.content)) {
      const childUrls = urls.slice(0, 10);
      urls = [];
      for (const child of childUrls) {
        try {
          urls.push(...parseSitemap((await fetchText(normalizeUrl(child))).content));
        } catch {
          // match frontend: skip failed child sitemap
        }
      }
      urls = [...new Set(urls)].slice(0, MAX_URLS);
    }
    if (!urls.length) fail('No URLs found in sitemap. Make sure the URL points to a valid sitemap.xml.', 400);
    return urls.map(normalizePageUrl).filter(Boolean).slice(0, MAX_URLS);
  }

  const page = await fetchText(target);
  const base = target.toString();
  const links = Array.from(String(page.content).matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1/gi), (match) => match[2]);
  const urls = new Set([base]);
  for (const href of links) {
    try {
      const candidate = new URL(href, base);
      candidate.hash = '';
      if (candidate.hostname === target.hostname && ['http:', 'https:'].includes(candidate.protocol)) {
        urls.add(candidate.toString());
      }
    } catch {
      // ignore malformed links
    }
    if (urls.size >= MAX_URLS) break;
  }
  return [...urls].slice(0, MAX_URLS);
}

async function extractTitles(urls) {
  const MAX_TITLE_FETCHES = 30;
  const targetUrls = urls.slice(0, MAX_TITLE_FETCHES);
  const remainingUrls = urls.slice(MAX_TITLE_FETCHES);

  const fetchTitle = async (pageUrl) => {
    try {
      const page = await fetchText(normalizeUrl(pageUrl), 5000);
      const title = page.content.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || '';
      return { url: pageUrl, title };
    } catch {
      return { url: pageUrl, title: '' };
    }
  };

  const output = [];
  const batchSize = 10;
  for (let i = 0; i < targetUrls.length; i += batchSize) {
    const batch = targetUrls.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(fetchTitle));
    output.push(...results);
  }

  for (const pageUrl of remainingUrls) {
    output.push({ url: pageUrl, title: '' });
  }

  return output;
}

function buildPrompt(extractedUrls) {
  const urlList = extractedUrls.map((item) => `- ${item.title || item.url}: ${item.url}`).join('\n');
  return `Generate a proper LLMs.txt file for a website with the following pages:\n\n${urlList}\n\nThe LLMs.txt file should:\n1. Start with a clear description of what the website is about\n2. List the main sections/categories hierarchically\n3. **CRITICAL: You MUST include the actual URL for every single page listed. Use Markdown link format: [Page Title](URL)**\n4. Do NOT list pages without their corresponding URLs\n5. Provide context about the content structure\n6. Include information about the site's purpose\n7. Be formatted in a clean, readable way for AI models\n\nGenerate ONLY the LLMs.txt content, no explanations.`;
}

function fallback(extractedUrls, target) {
  const domain = extractedUrls[0]?.url ? new URL(extractedUrls[0].url).hostname : (target ? new URL(target).hostname : 'website');
  const sections = extractedUrls.map((item) => `  - [${item.title || 'Page'}](${item.url})`).join('\n');
  return `# LLMs.txt for ${domain}\n\n## About This Website\nThis website contains the following sections and content areas.\n\n## Main Sections\n${sections}\n\n## Content Guidelines\n- All content on this site is original and authoritative\n- The site is regularly updated with new information\n- For the most accurate information, refer to the original pages\n\n## Contact\nFor more information, visit the main website at ${extractedUrls[0]?.url || target || domain}\n`;
}

async function generate(extractedUrls, apiKey, target) {
  if (!apiKey) {
    return { text: fallback(extractedUrls, target), model: null, usage: null, fallback: true };
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildPrompt(extractedUrls) },
        ],
        temperature: 0.7,
        max_tokens: 8192,
        stream: false,
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.warn(`DeepSeek API returned error ${response.status}:`, payload.error?.message);
      return { text: fallback(extractedUrls, target), model: null, usage: null, fallback: true };
    }
    const text = payload.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
      return { text: fallback(extractedUrls, target), model: null, usage: null, fallback: true };
    }
    return {
      text: text.replace(/^```(?:text|txt)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim(),
      model: payload.model || DEEPSEEK_MODEL,
      usage: payload.usage || null,
      fallback: false,
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      console.warn('AI provider request timed out, using fallback');
      return { text: fallback(extractedUrls, target), model: null, usage: null, fallback: true };
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function persist(userId, explicitProjectId, targetUrl, result) {
  if (!userId || userId === 'configured-admin') return false;

  const projectId = explicitProjectId || (() => {
    try {
      return new URL(targetUrl).hostname.replace(/^www\./, '').toLowerCase();
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

  // 1. Save to tool_results table if present
  try {
    await update(
      `INSERT INTO tool_results
         (user_id, project_id, tool_key, project_url, result, created_at, updated_at)
       VALUES (?, ?, 'llmsTxt', ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         project_url = VALUES(project_url),
         result = VALUES(result),
         updated_at = NOW()`,
      [userId, projectId, targetUrl, JSON.stringify(result)]
    );
  } catch (error) {
    if (error?.code !== 'ER_NO_SUCH_TABLE') {
      console.warn('Could not save to tool_results:', error?.message);
    }
  }

  // 2. Persist to user_projects.project_data
  try {
    const row = await queryOne(
      'SELECT project_data FROM user_projects WHERE user_id = ? AND project_id = ? LIMIT 1',
      [userId, projectId]
    );
    if (!row) {
      if (explicitProjectId) {
        fail('Project was not found.', 404);
      }
      return false;
    }

    let existing = {};
    if (row.project_data) {
      existing = typeof row.project_data === 'string' ? JSON.parse(row.project_data) : row.project_data;
    }
    const merged = { ...(existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}), llmsTxt: result };
    await update(
      'UPDATE user_projects SET project_data = ?, updated_at = NOW() WHERE user_id = ? AND project_id = ?',
      [JSON.stringify(merged), userId, projectId]
    );
    return true;
  } catch (error) {
    if (error?.status) throw error;
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
    const target = normalizeUrl(body?.url || body?.project_url || body?.domain || body?.website);
    const mode = body?.mode === 'sitemap' ? 'sitemap' : body?.mode === 'crawl' || body?.mode === undefined ? 'crawl' : fail('mode must be crawl or sitemap.', 400);

    const extractedUrls = await extractUrls(target, mode);
    const urlsWithTitles = await extractTitles(extractedUrls);
    const apiKey = await loadApiKey(user?.id, env);
    const ai = await generate(urlsWithTitles, apiKey, target.toString());

    const result = {
      url: target.toString(),
      extractedUrls: urlsWithTitles,
      llmsTxt: ai.text,
      updatedAt: new Date().toISOString(),
    };

    const persisted = await persist(user?.id, body?.project_id, target.toString(), result);

    return jsonResponse({
      success: true,
      status: 'success',
      message: 'LLMs.txt generated successfully.',
      data: {
        ...result,
        mode,
        model: ai.model,
        usage: ai.usage,
        fallback: ai.fallback,
        persisted,
      }
    }, 200, headers);
  } catch (error) {
    return apiError(error, headers);
  }
}

export default onRequest;
