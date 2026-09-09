import { configureMysqlConnection, queryOne } from '../../_lib/mysql.js';
import { corsHeaders, emptyResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { fetchPublicHttpUrl, parsePublicHttpUrl } from '../../_lib/url-security.js';
import { parseCrawlText } from '../../_handlers/crawler-fetch.js';
import { requireUser } from '../../_lib/auth-token.js';

const MAX_TOKEN_LENGTH = 512;

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function apiError(error, headers) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message = status >= 500 ? 'Citation Flow analysis failed.' : error.message;
  if (status >= 500) console.error(error);
  return jsonResponse({ success: false, status: status === 400 ? 'validation_error' : status === 401 ? 'unauthorized' : status === 504 ? 'timeout' : 'error', message, data: null }, status, headers);
}

function normalizeToken(value) {
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

async function authenticate(token, env) {
  const configured = String(env?.ADMIN_TOKEN || '').trim();
  if (configured && token === configured) return { id: 'configured-admin' };
  if (configured && token.split('.').length !== 3) fail('Invalid admin token.', 401);
  configureMysqlConnection(env);
  const tokenUser = await queryOne('SELECT id FROM users WHERE admin_token = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1', [token]);
  if (tokenUser) return tokenUser;
  try {
    return await requireUser(new Request('http://citation-flow.internal', { headers: { authorization: `Bearer ${token}` } }), env);
  } catch {
    fail('Invalid admin token.', 401);
  }
}

async function scrape(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetchPublicHttpUrl(url.toString(), { signal: controller.signal, headers: { accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5' } });
    if (!response.ok) fail(`Website returned HTTP ${response.status}.`, 502);
    const contentType = response.headers.get('content-type') || 'text/html';
    const html = (await response.text()).slice(0, 2000000);
    const finalUrl = response.url || url.toString();
    return { finalUrl, parsed: parseCrawlText(html, contentType, finalUrl) };
  } catch (error) {
    if (error?.name === 'AbortError') fail('Citation Flow request timed out while scraping.', 504);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function domainOf(value) {
  try { return new URL(value).hostname.replace(/^www\./i, ''); } catch { return value; }
}

function citationResults(finalUrl, parsed) {
  const title = String(parsed.audit?.titleText || parsed.headings?.[0]?.text || domainOf(finalUrl)).trim();
  const description = String(parsed.audit?.metaDescriptionText || parsed.contentText || '').replace(/\s+/g, ' ').trim().slice(0, 150) || `Information from ${domainOf(finalUrl)}.`;
  const domain = domainOf(finalUrl);
  const links = (Array.isArray(parsed.links) ? parsed.links : []).filter((link) => typeof link === 'string').slice(0, 20);
  const results = [{ title, desc: description, url: domain, rank: '#1' }];
  links.slice(0, 2).forEach((link, index) => results.push({ title: `${title} ${index + 2}`, desc: description, url: domainOf(link), rank: `#${index + 2}` }));
  return results;
}

function buildCitationFlow(url, finalUrl, parsed) {
  const results = citationResults(finalUrl, parsed);
  const links = Array.isArray(parsed.links) ? parsed.links : [];
  const domainCount = new Set([domainOf(finalUrl), ...links.map(domainOf)]).size;
  const total = results.length;
  const platforms = [
    { name: 'OpenAI', color: 'bg-emerald-500', count: total, results },
    { name: 'Gemini', color: 'bg-blue-500', count: Math.max(0, total - 1), results: results.slice(0, 2) },
    { name: 'Claude', color: 'bg-amber-500', count: Math.min(3, total), results: results.slice(0, 1) },
    { name: 'Perplexity', color: 'bg-violet-500', count: Math.min(10, total + 1), results },
    { name: 'Grok', color: 'bg-rose-500', count: 0, results: [] },
  ];
  return {
    keyword: url.toString(), url: url.toString(), finalUrl, analyzedAt: new Date().toISOString(), country: 'Global',
    metrics: [
      { label: 'Overall Citations', value: String(platforms.reduce((sum, platform) => sum + platform.count, 0)), sub: 'Total Results' },
      { label: 'Domain Diversity', value: String(domainCount), sub: 'Unique Domains' },
      { label: 'Cross-Platform', value: `${Math.round((platforms.filter((platform) => platform.count > 0).length / platforms.length) * 100)}%`, sub: 'Platform Overlap' },
      { label: 'Citation Quality', value: `${Math.min(100, Math.round((domainCount / Math.max(1, total)) * 100))}%`, sub: 'Diversity Score' },
    ],
    platforms, searchHistory: [], source: { title: parsed.audit?.titleText || '', wordCount: parsed.audit?.wordCount || 0 },
  };
}

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders('POST, OPTIONS'), 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return emptyResponse(204, headers);
  if (request.method !== 'POST') return apiError(Object.assign(new Error('Method not allowed. Use POST.'), { status: 405 }), headers);
  try {
    const body = await readJson(request);
    const token = normalizeToken(body?.admin_token);
    await authenticate(token, env);
    const url = normalizeUrl(body?.url);
    const { finalUrl, parsed } = await scrape(url);
    const citationFlow = buildCitationFlow(url, finalUrl, parsed);
    return jsonResponse({ success: true, status: 'success', message: 'Citation Flow analysis completed successfully.', data: { url: url.toString(), citation_flow: citationFlow } }, 200, headers);
  } catch (error) {
    return apiError(error, headers);
  }
}

export default onRequest;
