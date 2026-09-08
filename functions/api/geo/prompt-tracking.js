import { configureMysqlConnection, queryOne, update } from '../../_lib/mysql.js';
import { corsHeaders, emptyResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { fetchPublicHttpUrl, parsePublicHttpUrl } from '../../_lib/url-security.js';
import { parseCrawlText } from '../../_handlers/crawler-fetch.js';
import { requireUser } from '../../_lib/auth-token.js';

const MAX_TOKEN_LENGTH = 512;
const MAX_CONTENT_LENGTH = 50_000;
const MAX_KEYWORDS = 10;
const PROMPTS_PER_MODEL = 5;
const MODELS = ['chatgpt', 'gemini', 'claude', 'perplexity', 'grok'];
const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'because', 'being', 'could', 'from',
  'have', 'into', 'more', 'most', 'other', 'over', 'some', 'such', 'than',
  'that', 'their', 'there', 'these', 'they', 'this', 'what', 'when', 'where',
  'which', 'while', 'with', 'would', 'your', 'will', 'were', 'then', 'them',
  'website', 'page', 'home', 'using', 'used', 'user', 'users', 'http', 'https',
]);

function apiError(error, headers) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message = status >= 500 ? 'Prompt tracking failed.' : error.message;
  if (status >= 500) console.error(error);
  return jsonResponse({
    success: false,
    status: status === 400 ? 'validation_error' : status === 401 ? 'unauthorized' : status === 404 ? 'not_found' : 'error',
    message,
    data: null,
  }, status, headers);
}

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function normalizeAdminToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  if (!token) fail('admin_token is required.', 400);
  if (token.length > MAX_TOKEN_LENGTH) fail('Invalid admin token.', 401);
  return token;
}

function normalizeUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) fail('url is required.', 400);
  return parsePublicHttpUrl(raw, 'url');
}

function parseProjectData(value) {
  if (value === null || value === undefined || value === '') fail('Existing project_data is missing.', 500);
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail('Existing project_data is invalid.', 500);
  return parsed;
}

function hostFor(value) {
  try {
    return new URL(value).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractKeywords(text, headings = []) {
  const headingWords = headings
    .map((heading) => cleanText(heading?.text))
    .flatMap((heading) => heading.split(/[^a-z0-9]+/i));
  const words = `${headingWords.join(' ')} ${text}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word) && !/^\d+$/.test(word));
  const counts = new Map();
  words.forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, MAX_KEYWORDS)
    .map(([word]) => word);
}

function promptVariants(keyword, siteName) {
  return [
    `Where can I learn about ${keyword}?`,
    `What are the best ${keyword} resources${siteName ? ` from ${siteName}` : ''}?`,
    `Can you explain ${keyword} for a beginner?`,
    `Compare the main options for ${keyword}.`,
    `What should I look for when researching ${keyword}?`,
  ];
}

function generatePromptResults({ keywords, siteName }) {
  return keywords.map((keyword) => {
    const variants = promptVariants(keyword, siteName);
    return {
      keyword,
      prompts: Object.fromEntries(MODELS.map((model) => [model, variants.slice(0, PROMPTS_PER_MODEL)])),
    };
  });
}

async function authenticate(token, env) {
  const configuredAdminToken = String(env?.ADMIN_TOKEN || '').trim();
  if (configuredAdminToken && token === configuredAdminToken) return { id: 'configured-admin' };
  if (configuredAdminToken && token.split('.').length !== 3) fail('Invalid admin token.', 401);

  configureMysqlConnection(env);
  const admin = await queryOne(
    `SELECT id FROM users WHERE admin_token = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1`,
    [token]
  );
  if (admin) return admin;

  try {
    return await requireUser(new Request('http://prompt-tracking.internal', {
      headers: { authorization: `Bearer ${token}` },
    }), env);
  } catch {
    fail('Invalid admin token.', 401);
  }
}

async function findProject(adminId, targetUrl) {
  const targetHost = hostFor(targetUrl);
  const projects = await queryOne(
    `SELECT project_id, full_url, domain, project_data
     FROM user_projects
     WHERE user_id = ? AND (LOWER(domain) = ? OR LOWER(full_url) LIKE ?)
     ORDER BY updated_at DESC LIMIT 1`,
    [adminId, targetHost, `%${targetHost}%`]
  );
  return projects;
}

async function scrapePage(targetUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchPublicHttpUrl(targetUrl.toString(), {
      signal: controller.signal,
      headers: { accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5' },
    });
    if (!response.ok) fail(`Unable to scrape URL: HTTP ${response.status}.`, 502);
    const contentType = response.headers.get('content-type') || 'text/html';
    const html = (await response.text()).slice(0, 2_000_000);
    const finalUrl = response.url || targetUrl.toString();
    return { response, finalUrl, parsed: parseCrawlText(html, contentType, finalUrl) };
  } catch (error) {
    if (error?.name === 'AbortError') fail('Prompt tracking request timed out while scraping.', 504);
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
    const admin = await authenticate(normalizeAdminToken(body?.admin_token), env);
    const targetUrl = normalizeUrl(body?.url);
    const project = await findProject(admin.id, targetUrl.toString());
    const { finalUrl, parsed } = await scrapePage(targetUrl);
    const contentText = cleanText(parsed.contentText).slice(0, MAX_CONTENT_LENGTH);
    const siteName = cleanText(parsed.audit?.titleText || parsed.headings?.[0]?.text || hostFor(finalUrl));
    const extractedKeywords = extractKeywords(contentText, parsed.headings);
    const promptsByLlm = generatePromptResults({ keywords: extractedKeywords, siteName });
    const promptTracking = {
      url: targetUrl.toString(),
      finalUrl,
      siteName,
      analyzedAt: new Date().toISOString(),
      extractedKeywords,
      pageTextSample: contentText.slice(0, 2_000),
      promptsByLlm,
      source: {
        title: parsed.audit?.titleText || '',
        metaDescription: parsed.audit?.metaDescriptionText || '',
        canonicalUrl: parsed.audit?.canonicalUrl || '',
        robotsMeta: parsed.audit?.robotsMeta || '',
        wordCount: parsed.audit?.wordCount || contentText.split(/\s+/).filter(Boolean).length,
      },
    };
    if (project) {
      const existingProjectData = parseProjectData(project.project_data);
      const mergedProjectData = {
        ...existingProjectData,
        geo: {
          ...(existingProjectData.geo && typeof existingProjectData.geo === 'object' && !Array.isArray(existingProjectData.geo) ? existingProjectData.geo : {}),
          prompt_tracking: promptTracking,
        },
      };
      await update(
        `UPDATE user_projects SET project_data = ?, updated_at = NOW() WHERE user_id = ? AND project_id = ?`,
        [JSON.stringify(mergedProjectData), admin.id, project.project_id]
      );
    }
    return jsonResponse({
      success: true,
      status: 'success',
      message: 'Prompt tracking completed successfully.',
      data: { project_id: project?.project_id || null, url: targetUrl.toString(), prompt_tracking: promptTracking },
    }, 200, headers);
  } catch (error) {
    return apiError(error, headers);
  }
}

export default onRequest;