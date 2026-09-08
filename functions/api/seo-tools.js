import { corsHeaders, emptyResponse, jsonResponse, readJson } from '../_lib/http.js';
import { configureMysqlConnection, queryOne } from '../_lib/mysql.js';
import { parsePublicHttpUrl, fetchPublicHttpUrl } from '../_lib/url-security.js';
import { transformTextEditor } from '../_lib/text-editor.js';
import { separateDomains } from '../_lib/domain-separator.js';
import { calculateWordCounter } from '../_lib/word-counter.js';
import { editUrls, estimateDaPa, generateRobots, viewAsBot } from '../_lib/seo-tools.js';

const MAX_TOKEN_LENGTH = 512;
const TOOLS = ['url-editor', 'text-editor', 'domain-separator', 'word-counter', 'bot-viewer', 'da-pa-checker', 'sitemap-generator', 'robots-generator', 'sitemap-extractor', 'meta-extractor'];
const TOOL_CATALOG = [
  { tool: 'url-editor', name: 'Ultimate URL Editor', route: '/seo-tools/url-editor', description: 'Clean, trim, and manipulate URLs in bulk.', inputs: { text: 'string, one URL per line', operation: ['trim', 'params', 'dupes', 'serp', 'hash', 'amp', 'tld'] }, output: 'Transformed URL list and newline-joined text.' },
  { tool: 'text-editor', name: 'Universal Text Editor', route: '/seo-tools/text-editor', description: 'Clean and transform newline-separated text.', inputs: { text: 'string', operation: ['dedupe', 'brackets', 'empty', 'keep', 'upper', 'lower', 'title', 'single', 'replace', 'prefix', 'suffix'], filter: 'string, for keep', replaceWith: 'string, default comma', prefix: 'string', suffix: 'string' }, output: 'Transformed text and processing counts.' },
  { tool: 'domain-separator', name: 'Domain Separator', route: '/seo-tools/domain-separator', description: 'Extract unique hostnames from newline-separated domains or URLs.', inputs: { text: 'string, one value per line' }, output: 'Unique domain list and count.' },
  { tool: 'word-counter', name: 'Word Counter', route: '/seo-tools/word-counter', description: 'Count words, characters, sentences, paragraphs, and reading time.', inputs: { text: 'string' }, output: 'words, characters, sentences, paragraphs, reading.' },
  { tool: 'bot-viewer', name: 'Bot Viewer', route: '/seo-tools/bot-viewer', description: 'Show the configured crawler user-agent result for a URL.', inputs: { url: 'HTTP or HTTPS URL', bot: ['Googlebot', 'Bingbot', 'Facebook', 'Twitter', 'Baidu', 'Yandex', 'DuckDuckGo', 'GPTBot (OpenAI)'], defaults: { bot: 'Googlebot' } }, output: 'Bot, URL, userAgent, status, title, and meta.' },
  { tool: 'da-pa-checker', name: 'Bulk DA/PA Checker', route: '/seo-tools/da-pa-checker', description: 'Estimate DA, PA, and spam values for newline-separated domains.', inputs: { text: 'string, one domain per line' }, output: 'Result rows containing domain, da, pa, and spam.' },
  { tool: 'sitemap-generator', name: 'Sitemap Generator', route: '/seo-tools/sitemap-generator', description: 'Crawl a site and generate discovered sitemap page entries.', inputs: { url: 'HTTP or HTTPS website URL', maxPages: 'number, default 50, maximum 500' }, output: 'Crawled URL, count, and pages with loc, priority, and freq.' },
  { tool: 'robots-generator', name: 'Robots.txt Generator', route: '/seo-tools/robots-generator', description: 'Generate robots.txt directives for WordPress, duplicate content, WooCommerce, search bots, and social bots.', inputs: { wp: ['none', 'basic', 'advanced'], dup: 'object of json, search, params, feed, spam booleans', woo: 'object of cart, checkout, account, login, sort booleans', search: 'object of crawler names to allow, disallow, or off', social: 'object of crawler names to allow, disallow, or off', sitemap: 'optional URL', newsSitemap: 'optional URL' }, output: 'Generated robots text.' },
  { tool: 'sitemap-extractor', name: 'XML Sitemap Extractor', route: '/seo-tools/sitemap-extractor', description: 'Fetch a sitemap.xml URL and extract unique loc entries.', inputs: { url: 'HTTP or HTTPS sitemap URL' }, output: 'Sitemap URL, extracted urls, and count.' },
  { tool: 'meta-extractor', name: 'Bulk Meta Extractor', route: '/seo-tools/meta-extractor', description: 'Fetch multiple pages and extract title, description, canonical, robots, keywords, and word count.', inputs: { text: 'string, one URL per line', selected: 'optional booleans for title, desc, canonical, robots, keywords, wordCount' }, output: 'Result rows and selected fields.' },
];

function errorResponse(error, headers, tool = null) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message = status >= 500 ? 'SEO tool processing failed.' : error.message;
  if (status >= 500) console.error(error);
  return jsonResponse({ success: false, status: status === 401 ? 'unauthorized' : status === 400 ? 'validation_error' : 'error', message, tool, data: null, error: { code: status === 401 ? 'UNAUTHORIZED' : status === 400 ? 'INVALID_REQUEST' : 'SEO_TOOL_ERROR', details: status >= 500 ? undefined : error.message } }, status, headers);
}

function normalizeUrl(value, field = 'url') {
  const raw = String(value || '').trim();
  if (!raw) { const error = new Error(`${field} is required.`); error.status = 400; throw error; }
  return parsePublicHttpUrl(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`, field);
}

function htmlText(html) { return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim(); }
function titleFromHtml(html) { return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() || ''; }
function metaFromHtml(html, name) { return html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'))?.[1] || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, 'i'))?.[1] || ''; }
function sitemapLocs(xml) { return [...new Set(Array.from(String(xml).matchAll(/<loc[^>]*>\s*([^<]+)\s*<\/loc>/gi), (match) => match[1].trim()))]; }

async function fetchMetaHtml(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetchPublicHttpUrl(url, { signal: controller.signal });
    return { response, html: await response.text() };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function extractSitemap(input) {
  const target = normalizeUrl(input.url, 'sitemap URL');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let response;
  let xml;
  try {
    response = await fetchPublicHttpUrl(target, { signal: controller.signal });
    xml = await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
  if (!response.ok) { const error = new Error(`Sitemap returned HTTP ${response.status}.`); error.status = response.status; throw error; }
  const urls = sitemapLocs(xml);
  return { url: target.toString(), urls, count: urls.length };
}

export async function extractMeta(input) {
  if (typeof input.text !== 'string') { const error = new Error('text is required and must be a string.'); error.status = 400; throw error; }
  const urls = input.text.split('\n').map((value) => value.trim()).filter(Boolean);
  if (!urls.length) { const error = new Error('At least one URL is required.'); error.status = 400; throw error; }
  const selected = input.selected && typeof input.selected === 'object' ? input.selected : { title: true, desc: true, canonical: true, robots: true, keywords: false, wordCount: true };
  const results = await Promise.all(urls.map(async (raw) => {
    const url = normalizeUrl(raw);
    try {
      const { response, html } = await fetchMetaHtml(url);
      return { url: url.toString(), title: titleFromHtml(html), desc: metaFromHtml(html, 'description'), canonical: html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || '', robots: metaFromHtml(html, 'robots') || 'index, follow', keywords: metaFromHtml(html, 'keywords'), wordCount: htmlText(html).split(/\s+/).filter(Boolean).length, httpStatus: response.status };
    } catch (error) { return { url: url.toString(), title: 'Fetch failed', desc: error.message, canonical: '', robots: '', keywords: '', wordCount: 0 }; }
  }));
  return { results, selected };
}

async function generateSitemap(input) {
  const root = normalizeUrl(input.url, 'website URL');
  const maxPages = Math.min(Math.max(Number(input.maxPages || 50) || 50, 1), 500);
  const rootHost = root.hostname.replace(/^www\./, '').toLowerCase();
  const queue = [root.toString()]; const seen = new Set(queue); const pages = [];
  while (queue.length && pages.length < maxPages) {
    const next = queue.shift();
    try {
      const response = await fetchPublicHttpUrl(next);
      const body = await response.text();
      if ((response.headers.get('content-type') || '').includes('html') || next.endsWith('.xml')) pages.push({ loc: response.url || next, priority: pages.length === 0 ? 1.0 : 0.7, freq: pages.length === 0 ? 'daily' : 'weekly' });
      for (const href of body.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
        try { const resolved = new URL(href[1], next); resolved.hash = ''; if (resolved.hostname.replace(/^www\./, '').toLowerCase() === rootHost && ['http:', 'https:'].includes(resolved.protocol)) { const normalized = parsePublicHttpUrl(resolved.toString()).toString(); if (!seen.has(normalized) && seen.size < maxPages * 3) { seen.add(normalized); queue.push(normalized); } } } catch { /* ignore malformed links */ }
      }
    } catch { /* frontend continues on crawl failures */ }
  }
  return { url: root.toString(), count: pages.length, pages };
}

async function executeTool(tool, input) {
  switch (tool) {
    case 'url-editor': return editUrls(input);
    case 'text-editor': return transformTextEditor(input);
    case 'domain-separator': return { domains: separateDomains(input).result, count: separateDomains(input).uniqueDomainCount };
    case 'word-counter': return calculateWordCounter(input);
    case 'bot-viewer': return viewAsBot(input);
    case 'da-pa-checker': return estimateDaPa(input);
    case 'robots-generator': return generateRobots(input);
    case 'sitemap-extractor': return extractSitemap(input);
    case 'meta-extractor': return extractMeta(input);
    case 'sitemap-generator': return generateSitemap(input);
    default: { const error = new Error(`Unsupported tool. Use one of: ${TOOLS.join(', ')}.`); error.status = 400; throw error; }
  }
}

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders('GET, POST, OPTIONS'), 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return emptyResponse(204, headers);
  if (request.method === 'GET') {
    return jsonResponse({ success: true, status: 'success', message: 'SEO tools catalog retrieved successfully.', tool: null, data: { count: TOOL_CATALOG.length, tools: TOOL_CATALOG } }, 200, headers);
  }
  if (request.method !== 'POST') return errorResponse(Object.assign(new Error('Method not allowed. Use POST.'), { status: 405 }), headers);
  let tool = null;
  try {
    const input = await readJson(request);
    tool = String(input?.tool || '').trim().toLowerCase();
    const authorizationToken = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const adminToken = typeof input?.admin_token === 'string' ? input.admin_token.trim() : authorizationToken;
    if (!adminToken) return errorResponse(Object.assign(new Error('Admin token is required.'), { status: 401 }), headers, tool || null);
    if (adminToken.length > MAX_TOKEN_LENGTH) return errorResponse(Object.assign(new Error('Invalid admin token.'), { status: 401 }), headers, tool || null);
    configureMysqlConnection(env);
    const admin = await queryOne('SELECT id FROM users WHERE admin_token = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1', [adminToken]);
    if (!admin) return errorResponse(Object.assign(new Error('Invalid admin token.'), { status: 401 }), headers, tool || null);
    if (!TOOLS.includes(tool)) return errorResponse(Object.assign(new Error(`Unsupported tool. Use one of: ${TOOLS.join(', ')}.`), { status: 400 }), headers, tool || null);
    const data = await executeTool(tool, input);
    return jsonResponse({ success: true, status: 'success', message: 'SEO tool executed successfully.', tool, data, meta: { adminId: admin.id, processedAt: new Date().toISOString() } }, 200, headers);
  } catch (error) { return errorResponse(error, headers, tool); }
}

export default onRequest;
