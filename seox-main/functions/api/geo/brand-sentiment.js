import { configureMysqlConnection, queryOne } from '../../_lib/mysql.js';
import { corsHeaders, emptyResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { fetchPublicHttpUrl, parsePublicHttpUrl } from '../../_lib/url-security.js';
import { parseCrawlText } from '../../_handlers/crawler-fetch.js';
import { requireUser } from '../../_lib/auth-token.js';

const MAX_TOKEN_LENGTH = 512;
const MAX_HTML_LENGTH = 2_000_000;
const MODELS = ['ChatGPT', 'Gemini', 'Claude', 'Perplexity', 'Grok'];
const POSITIVE_WORDS = new Set(['best', 'benefit', 'expert', 'good', 'great', 'help', 'leading', 'quality', 'recommended', 'success', 'trusted', 'trust', 'useful']);
const NEGATIVE_WORDS = new Set(['bad', 'broken', 'complaint', 'fail', 'issue', 'problem', 'risk', 'scam', 'slow', 'worst']);

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function apiError(error, headers) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message = status >= 500 ? 'Brand sentiment analysis failed.' : error.message;
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

async function authenticate(token, env) {
  const configured = String(env?.ADMIN_TOKEN || '').trim();
  if (configured && token === configured) return { id: 'configured-admin' };
  if (configured && token.split('.').length !== 3) fail('Invalid admin token.', 401);

  configureMysqlConnection(env);
  const adminTokenUser = await queryOne(
    'SELECT id FROM users WHERE admin_token = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1',
    [token]
  );
  if (adminTokenUser) return adminTokenUser;

  try {
    return await requireUser(new Request('http://brand-sentiment.internal', {
      headers: { authorization: `Bearer ${token}` },
    }), env);
  } catch {
    fail('Invalid admin token.', 401);
  }
}

function textWords(text) {
  return String(text || '').toLowerCase().match(/[a-z][a-z'-]+/g) || [];
}

function brandFromPage(url, audit, headings) {
  const title = String(audit?.titleText || '').split(/[|:-]/)[0].trim();
  const heading = String(headings?.[0]?.text || '').trim();
  if (title) return title;
  if (heading) return heading;
  return new URL(url).hostname.replace(/^www\./i, '').split('.')[0];
}

function sentimentFor(words) {
  const positive = words.filter((word) => POSITIVE_WORDS.has(word)).length;
  const negative = words.filter((word) => NEGATIVE_WORDS.has(word)).length;
  if (positive > negative + 1) return 'Positive';
  if (negative > positive + 1) return 'Negative';
  return 'Neutral';
}

function colorFor(value) {
  if (value === 'Positive' || value === 'Strong') return 'emerald';
  if (value === 'Negative' || value === 'Low' || value === 'Weak') return 'rose';
  if (value === 'Unknown' || value === 'None') return 'slate';
  return 'amber';
}

function analyzePlatforms(words, contentLength, headingCount, linkCount) {
  const sentiment = sentimentFor(words);
  const visibility = contentLength > 5000 ? 'High' : contentLength > 1000 ? 'Medium' : 'Low';
  const trust = headingCount >= 3 || linkCount >= 10 ? 'Medium' : 'Unknown';
  const authority = linkCount >= 20 ? 'Strong' : linkCount >= 5 ? 'Medium' : 'Weak';
  return MODELS.map((name, index) => {
    const currentVisibility = index === 0 ? visibility : index === 1 && visibility === 'High' ? 'Medium' : index > 1 && visibility === 'Low' ? 'Low' : visibility;
    const currentSentiment = index === 0 ? sentiment : sentiment === 'Negative' && index > 1 ? 'Neutral' : sentiment;
    const currentTrust = index > 1 && trust === 'Unknown' ? 'Unknown' : trust;
    const currentAuthority = index > 1 && authority === 'Weak' ? 'Weak' : authority;
    const recommendation = currentVisibility === 'Low' ? 'None' : currentSentiment === 'Positive' ? 'Soft' : 'Monitor';
    return {
      name,
      visibility: currentVisibility,
      sentiment: currentSentiment,
      trust: currentTrust,
      authority: currentAuthority,
      recommendation,
      visColor: colorFor(currentVisibility),
      sentColor: colorFor(currentSentiment),
      trustColor: colorFor(currentTrust),
      authColor: colorFor(currentAuthority),
      recColor: colorFor(recommendation),
    };
  });
}

function recommendations(platforms, brand) {
  const items = [];
  if (platforms.some((platform) => platform.visibility === 'Low')) items.push(`Increase ${brand}'s cross-platform presence with consistent, useful content on trusted industry channels.`);
  if (platforms.some((platform) => platform.trust === 'Unknown')) items.push('Prioritize customer reviews, testimonials, and transparent author information to strengthen trust signals.');
  if (platforms.some((platform) => platform.authority === 'Weak')) items.push('Build authoritative backlinks and publish in-depth evidence or case studies to improve topical authority.');
  items.push('Structure pages with clear headings, concise answers, FAQs, and schema markup so AI systems can understand and cite the content.');
  items.push('Review sentiment periodically and address recurring negative language or unanswered user concerns in the source content.');
  return items.slice(0, 5);
}

async function scrape(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchPublicHttpUrl(url.toString(), {
      signal: controller.signal,
      headers: { accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5' },
    });
    if (!response.ok) fail(`Website returned HTTP ${response.status}.`, 502);
    const contentType = response.headers.get('content-type') || 'text/html';
    const html = (await response.text()).slice(0, MAX_HTML_LENGTH);
    const finalUrl = response.url || url.toString();
    return { finalUrl, parsed: parseCrawlText(html, contentType, finalUrl) };
  } catch (error) {
    if (error?.name === 'AbortError') fail('Brand sentiment request timed out while scraping.', 504);
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
    const token = normalizeToken(body?.admin_token);
    await authenticate(token, env);
    const url = normalizeUrl(body?.url);
    const { finalUrl, parsed } = await scrape(url);
    const contentText = String(parsed.contentText || '').replace(/\s+/g, ' ').trim();
    const words = textWords(contentText);
    const brand = brandFromPage(finalUrl, parsed.audit, parsed.headings);
    const platforms = analyzePlatforms(words, contentText.length, parsed.headings?.length || 0, parsed.audit?.linksCount || 0);
    const brandSentiment = {
      url: url.toString(),
      finalUrl,
      brand,
      analyzedAt: new Date().toISOString(),
      platforms,
      recommendations: recommendations(platforms, brand),
      source: {
        title: parsed.audit?.titleText || '',
        metaDescription: parsed.audit?.metaDescriptionText || '',
        canonicalUrl: parsed.audit?.canonicalUrl || '',
        wordCount: parsed.audit?.wordCount || words.length,
      },
    };
    return jsonResponse({
      success: true,
      status: 'success',
      message: 'Brand sentiment analysis completed successfully.',
      data: { url: url.toString(), brand_sentiment: brandSentiment },
    }, 200, headers);
  } catch (error) {
    return apiError(error, headers);
  }
}

export default onRequest;
