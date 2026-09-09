// Website -> GBP automation.
//
// Two rule types:
//   website_to_post   new pages on the site become drafted GBP posts
//   service_gap       service pages on the site that are missing from the GBP
//                     service list become recommendations
//
// Discovery reads the site's own sitemap through fetchPublicHttpUrl, which
// carries the project's SSRF guard, so a rule can never be pointed at an
// internal address.

import { fetchPublicHttpUrl, parsePublicHttpUrl } from './url-security.js';

const MAX_SITEMAP_BYTES = 5 * 1024 * 1024;
const MAX_URLS = 500;
const MAX_CHILD_SITEMAPS = 10;

export async function hashUrl(url) {
  const data = new TextEncoder().encode(String(url));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function extractTags(xml, tag) {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  const values = [];
  let match;
  while ((match = pattern.exec(xml)) !== null) values.push(match[1]);
  return values;
}

function decodeXmlText(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

async function fetchText(url) {
  const response = await fetchPublicHttpUrl(url, {
    headers: { 'User-Agent': 'SEOX-GBP-Automation/1.0' },
    redirect: 'follow',
  });
  if (!response.ok) {
    const error = new Error(`${url} returned ${response.status}.`);
    error.status = response.status >= 500 ? 502 : 400;
    throw error;
  }
  const text = await response.text();
  return text.slice(0, MAX_SITEMAP_BYTES);
}

/**
 * Read a sitemap (or sitemap index) and return the page URLs it lists.
 */
export async function readSitemap(sitemapUrl) {
  const xml = await fetchText(sitemapUrl);

  // A sitemap index points at other sitemaps rather than pages.
  if (/<sitemapindex[\s>]/i.test(xml)) {
    const children = extractTags(xml, 'sitemap')
      .map((block) => decodeXmlText(extractTags(block, 'loc')[0] || ''))
      .filter(Boolean)
      .slice(0, MAX_CHILD_SITEMAPS);

    const collected = [];
    for (const child of children) {
      try {
        collected.push(...(await readSitemap(child)));
      } catch {
        // One unreadable child sitemap must not fail the whole discovery run.
      }
      if (collected.length >= MAX_URLS) break;
    }
    return collected.slice(0, MAX_URLS);
  }

  return extractTags(xml, 'url')
    .map((block) => ({
      url: decodeXmlText(extractTags(block, 'loc')[0] || ''),
      lastmod: decodeXmlText(extractTags(block, 'lastmod')[0] || '') || null,
    }))
    .filter((entry) => entry.url)
    .slice(0, MAX_URLS);
}

export function defaultSitemapUrl(siteUrl) {
  const url = parsePublicHttpUrl(siteUrl, 'Project URL');
  return `${url.origin}/sitemap.xml`;
}

/**
 * Filter discovered URLs down to the ones a rule cares about.
 * `include` and `exclude` are plain substrings, not regular expressions, so a
 * user-supplied pattern cannot become a catastrophic backtrack.
 */
export function filterUrls(entries, { include = [], exclude = [], since = null } = {}) {
  const includes = include.map((value) => String(value).toLowerCase()).filter(Boolean);
  const excludes = exclude.map((value) => String(value).toLowerCase()).filter(Boolean);
  const sinceTime = since ? new Date(since).getTime() : null;

  return entries.filter((entry) => {
    const url = String(entry.url).toLowerCase();
    if (includes.length && !includes.some((needle) => url.includes(needle))) return false;
    if (excludes.some((needle) => url.includes(needle))) return false;
    if (sinceTime && entry.lastmod) {
      const modified = new Date(entry.lastmod).getTime();
      if (!Number.isNaN(modified) && modified < sinceTime) return false;
    }
    return true;
  });
}

// --- Page metadata ---------------------------------------------------------

function matchMeta(html, attribute, value) {
  const pattern = new RegExp(
    `<meta[^>]+${attribute}=["']${value}["'][^>]*content=["']([^"']*)["']`,
    'i'
  );
  const reversed = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*${attribute}=["']${value}["']`,
    'i'
  );
  return (html.match(pattern) || html.match(reversed) || [])[1] || null;
}

export async function readPageMeta(url) {
  const html = (await fetchText(url)).slice(0, 400000);
  const title =
    decodeXmlText((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '') || null;
  const description =
    matchMeta(html, 'name', 'description') || matchMeta(html, 'property', 'og:description');
  const image = matchMeta(html, 'property', 'og:image');

  // First paragraph, tags stripped, as a fallback excerpt for the AI prompt.
  const paragraph = (html.match(/<p[^>]*>([\s\S]{40,1200}?)<\/p>/i) || [])[1] || '';
  const excerpt = decodeXmlText(paragraph.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');

  return {
    url,
    title,
    description: description ? decodeXmlText(description) : null,
    image: image || null,
    excerpt: description ? decodeXmlText(description) : excerpt.slice(0, 900),
  };
}

// --- Service gap -----------------------------------------------------------

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'our', 'your', 'with', 'services', 'service', 'best', 'top', 'in', 'of', 'a',
  'to', 'near', 'me', 'company', 'page', 'home', 'about', 'contact', 'blog',
]);

function slugToPhrase(url) {
  try {
    const parsed = new URL(url);
    const slug = parsed.pathname.split('/').filter(Boolean).pop() || '';
    return slug
      .replace(/\.(html?|php|aspx?)$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim()
      .toLowerCase();
  } catch {
    return '';
  }
}

function normalise(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !STOP_WORDS.has(word))
    .join(' ');
}

/**
 * Compare service pages found on the website against the services listed on the
 * GBP profile and report the ones that appear to be missing.
 */
export function findServiceGaps(pageEntries, gbpServices) {
  const listed = new Set(
    (gbpServices || [])
      .map((service) => normalise(service.label || service.description || ''))
      .filter(Boolean)
  );

  const gaps = [];
  const seen = new Set();

  for (const entry of pageEntries) {
    const phrase = slugToPhrase(entry.url);
    const key = normalise(entry.title || phrase);
    if (!key || key.length < 3 || seen.has(key)) continue;
    seen.add(key);

    // A service counts as listed if any GBP service shares its normalised form
    // or fully contains it.
    const covered = [...listed].some((service) => service === key || service.includes(key) || key.includes(service));
    if (covered) continue;

    gaps.push({
      url: entry.url,
      pageTitle: entry.title || null,
      suggestedService: (entry.title || phrase)
        .replace(/\s*[|\-–—].*$/, '')
        .trim()
        .slice(0, 120),
    });
  }

  return gaps;
}

// --- Rule config -----------------------------------------------------------

export const RULE_TYPES = ['website_to_post', 'service_gap'];
export const RULE_MODES = ['manual', 'approval', 'auto'];

export function normaliseRuleConfig(ruleType, config) {
  const base = config || {};
  if (ruleType === 'website_to_post') {
    return {
      sitemapUrl: base.sitemapUrl || null,
      include: Array.isArray(base.include) ? base.include.slice(0, 10) : ['/blog/'],
      exclude: Array.isArray(base.exclude) ? base.exclude.slice(0, 10) : ['/tag/', '/category/', '/author/'],
      ctaType: base.ctaType || 'LEARN_MORE',
      maxPerRun: Math.min(10, Math.max(1, Number(base.maxPerRun) || 3)),
      scheduleOffsetHours: Math.max(0, Number(base.scheduleOffsetHours) || 2),
      utm: {
        source: base.utm?.source || 'google',
        medium: base.utm?.medium || 'gbp',
        campaign: base.utm?.campaign || 'gbp_post',
      },
      useSourceImage: base.useSourceImage !== false,
    };
  }
  if (ruleType === 'service_gap') {
    return {
      sitemapUrl: base.sitemapUrl || null,
      include: Array.isArray(base.include) ? base.include.slice(0, 10) : ['/services/'],
      exclude: Array.isArray(base.exclude) ? base.exclude.slice(0, 10) : [],
    };
  }
  const error = new Error(`"${ruleType}" is not a supported rule type.`);
  error.status = 400;
  throw error;
}
