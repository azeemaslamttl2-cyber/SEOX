import { configureMysqlConnection, queryOne } from '../../_lib/mysql.js';
import { corsHeaders, emptyResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { fetchPublicHttpUrl, parsePublicHttpUrl } from '../../_lib/url-security.js';
import { parseCrawlText } from '../../_handlers/crawler-fetch.js';
import { requireUser } from '../../_lib/auth-token.js';

const MAX_TOKEN_LENGTH = 512;
const MAX_PAGES = 100;
const REQUEST_TIMEOUT_MS = 15000;
const TABS = ['Overview', 'Link Structure', 'Orphan Pages', 'Scoring'];

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function apiError(error, headers) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message = status >= 500 ? 'Internal links analysis failed.' : error.message;
  if (status >= 500) console.error(error);
  return jsonResponse({
    success: false,
    status: status === 400 ? 'validation_error' : status === 401 ? 'unauthorized' : status === 504 ? 'timeout' : 'error',
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

function normalizeUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) fail('url is required.', 400);
  return parsePublicHttpUrl(raw, 'url');
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
  const admin = await queryOne(
    'SELECT id FROM users WHERE admin_token = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1',
    [token]
  );
  if (admin) return admin;

  try {
    return await requireUser(new Request('http://internal-links.internal', {
      headers: { authorization: `Bearer ${token}` },
    }), env);
  } catch {
    fail('Invalid admin token.', 401);
  }
}

function normalizePageUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function extractLinks(parsed, currentUrl, rootHost) {
  return [...new Set((Array.isArray(parsed.links) ? parsed.links : [])
    .map((entry) => typeof entry === 'string' ? entry : entry?.url)
    .map((value) => {
      try {
        const url = new URL(value, currentUrl);
        url.hash = '';
        return url.protocol.startsWith('http') && url.hostname === rootHost ? url.toString() : '';
      } catch {
        return '';
      }
    })
    .filter(Boolean))];
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchPublicHttpUrl(url, {
      signal: controller.signal,
      headers: { accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5' },
    });
    const contentType = response.headers.get('content-type') || '';
    const html = (await response.text()).slice(0, 2_000_000);
    const finalUrl = normalizePageUrl(response.url || url) || url;
    return { response, finalUrl, parsed: parseCrawlText(html, contentType, finalUrl) };
  } catch (error) {
    if (error?.name === 'AbortError') fail(`Crawl request timed out for ${url}.`, 504);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function crawl(rootUrl, maxPages = MAX_PAGES) {
  const root = normalizePageUrl(rootUrl.toString());
  const rootHost = new URL(root).hostname;
  const queue = [{ url: root, depth: 0 }];
  const queued = new Set([root]);
  const pages = [];

  while (queue.length && pages.length < maxPages) {
    const current = queue.shift();
    let fetched;
    try {
      fetched = await fetchPage(current.url);
    } catch (error) {
      if (pages.length === 0) throw error;
      continue;
    }

    const outbound = extractLinks(fetched.parsed, fetched.finalUrl, rootHost);
    const isHtml = String(fetched.response.headers.get('content-type') || '').includes('html');
    if (isHtml || pages.length === 0) {
      pages.push({
        url: fetched.finalUrl,
        title: fetched.parsed.audit?.titleText || '',
        status: fetched.response.status,
        depth: current.depth,
        links: outbound.length,
        outbound: outbound.slice(0, 100),
      });
    }

    for (const link of outbound) {
      if (queued.size >= maxPages || queued.has(link)) continue;
      queued.add(link);
      queue.push({ url: link, depth: current.depth + 1 });
    }
  }

  const pageUrls = new Set(pages.map((page) => page.url));
  const inbound = new Map(pages.map((page) => [page.url, 0]));
  let internalLinks = 0;
  pages.forEach((page) => page.outbound.forEach((link) => {
    internalLinks += 1;
    if (inbound.has(link)) inbound.set(link, inbound.get(link) + 1);
  }));
  const orphanPages = pages.filter((page) => page.depth > 0 && pageUrls.has(page.url) && !inbound.get(page.url)).map((page) => page.url);
  const avgInternalLinks = pages.length ? Math.round((internalLinks / pages.length) * 10) / 10 : 0;
  const crawlCoverage = Math.min(1, pages.length / maxPages);
  const orphanRate = pages.length > 1 ? orphanPages.length / (pages.length - 1) : 0;
  const linkingScore = Math.max(0, Math.min(100, Math.round((crawlCoverage * 40) + ((1 - orphanRate) * 35) + (Math.min(1, avgInternalLinks / 10) * 25))));

  return {
    url: root,
    completedAt: new Date().toISOString(),
    summary: {
      pagesCrawled: pages.length,
      internalLinks,
      orphanPages: orphanPages.length,
      maxDepth: pages.reduce((max, page) => Math.max(max, page.depth), 0),
      avgInternalLinks,
      linkingScore: `${linkingScore}/100`,
    },
    tabs: TABS,
    pages,
    orphanPages,
  };
}

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders('POST, OPTIONS'), 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return emptyResponse(204, headers);
  if (request.method !== 'POST') return apiError(Object.assign(new Error('Method not allowed. Use POST.'), { status: 405 }), headers);

  try {
    const body = await readJson(request);
    await authenticate(request, body, env);
    const url = normalizeUrl(body?.url || body?.project_url);
    const requestedMaxPages = body?.max_pages === undefined ? MAX_PAGES : Number(body.max_pages);
    if (!Number.isInteger(requestedMaxPages) || requestedMaxPages < 1) fail('max_pages must be a positive integer.', 400);
    const data = await crawl(url, Math.min(requestedMaxPages, MAX_PAGES));
    return jsonResponse({ success: true, status: 'success', message: 'Internal links analysis completed successfully.', data }, 200, headers);
  } catch (error) {
    return apiError(error, headers);
  }
}

export default onRequest;
