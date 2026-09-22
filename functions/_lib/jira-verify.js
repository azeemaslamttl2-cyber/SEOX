// Executing a verification spec: re-fetch the affected URL and decide whether
// the SEO finding is genuinely gone.
//
// This is the part of the integration that no generic Jira connector can do,
// and it is also the part where being wrong is expensive. Two rules govern it:
//
//   1. A fetch failure is NOT a failed verification. If SEOX cannot reach the
//      site, it says so and leaves the finding awaiting verification. It must
//      never reopen a ticket because of its own network problem - that is a
//      false accusation aimed at a developer who may well have done the work.
//
//   2. The HTML is parsed with the same regex helpers the crawler already
//      uses rather than a second parser, so "present" means the same thing
//      here as it does during a crawl.

import { fetchPublicHttpUrl, parsePublicHttpUrl } from './url-security.js';
import { describeCheck } from './jira-verification.js';

const FETCH_TIMEOUT_MS = 20000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;

const USER_AGENT =
  'Mozilla/5.0 (compatible; SEOX-Verify/1.0; +https://seox.local/bot)';

function headOf(html) {
  const match = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  return match ? match[1] : html.slice(0, 200000);
}

function decodeEntities(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTitles(html) {
  const head = headOf(html);
  return [...head.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map((match) =>
    decodeEntities(match[1]).replace(/\s+/g, ' ').trim()
  );
}

function extractMeta(html, nameAttr, nameValue) {
  const head = headOf(html);
  const results = [];
  for (const match of head.matchAll(/<meta\s+([^>]*)>/gi)) {
    const attrs = match[1];
    const name = new RegExp(`${nameAttr}\\s*=\\s*["']([^"']+)["']`, 'i').exec(attrs);
    if (!name || name[1].trim().toLowerCase() !== nameValue) continue;
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(attrs);
    results.push(content ? decodeEntities(content[1]).trim() : '');
  }
  return results;
}

function extractH1s(html) {
  return [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) =>
    decodeEntities(match[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
  );
}

function extractCanonical(html) {
  const head = headOf(html);
  for (const match of head.matchAll(/<link\s+([^>]*)>/gi)) {
    const attrs = match[1];
    if (!/rel\s*=\s*["']canonical["']/i.test(attrs)) continue;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (href) return decodeEntities(href[1]).trim();
  }
  return '';
}

function extractImages(html) {
  return [...html.matchAll(/<img\s+([^>]*)>/gi)].map((match) => {
    const attrs = match[1];
    const src = /src\s*=\s*["']([^"']*)["']/i.exec(attrs);
    const alt = /alt\s*=\s*["']([^"']*)["']/i.exec(attrs);
    return { src: src ? src[1] : '', hasAlt: Boolean(alt && alt[1].trim()) };
  });
}

function selectorValues(html, selector) {
  switch (selector) {
    case 'title':
      return extractTitles(html);
    case 'meta-description':
      return extractMeta(html, 'name', 'description');
    case 'h1':
      return extractH1s(html);
    case 'og:title':
      return extractMeta(html, 'property', 'og:title');
    case 'twitter:card':
      return extractMeta(html, 'name', 'twitter:card');
    case 'meta-refresh':
      return extractMeta(html, 'http-equiv', 'refresh');
    default:
      return [];
  }
}

function robotsDirectives(html, headerValue) {
  const fromMeta = extractMeta(html, 'name', 'robots').join(',');
  return `${fromMeta},${headerValue || ''}`.toLowerCase();
}

/**
 * Fetch the page, following redirects manually so the chain can be inspected.
 * fetchPublicHttpUrl already enforces the public-URL guard on every hop.
 */
async function fetchTarget(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchPublicHttpUrl(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        // A verification that reads a stale CDN copy would report a fix that
        // has not shipped, or a failure that has already been fixed.
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      signal: controller.signal,
      maxRedirects: 8,
    });

    const contentType = response.headers.get('content-type') || '';
    let html = '';
    if (/text\/html|application\/xhtml|text\/plain/i.test(contentType)) {
      const text = await response.text();
      html = text.length > MAX_HTML_BYTES ? text.slice(0, MAX_HTML_BYTES) : text;
    }

    return {
      status: response.status,
      html,
      xRobotsTag: response.headers.get('x-robots-tag') || '',
      finalUrl: response.url || url,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Count the redirect hops between `url` and its final destination. */
async function traceRedirects(url, maxHops = 8) {
  const chain = [];
  let current = parsePublicHttpUrl(url).toString();

  for (let hop = 0; hop < maxHops; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': USER_AGENT, 'Cache-Control': 'no-cache' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    chain.push({ url: current, status: response.status });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { chain, finalStatus: response.status, looped: false };
    }

    const location = response.headers.get('location');
    if (!location) return { chain, finalStatus: response.status, looped: false };

    const next = parsePublicHttpUrl(new URL(location, current).toString(), 'redirect URL').toString();
    if (chain.some((entry) => entry.url === next)) {
      return { chain, finalStatus: response.status, looped: true };
    }
    current = next;
  }

  return { chain, finalStatus: chain[chain.length - 1]?.status || 0, looped: true };
}

function sameUrl(a, b) {
  try {
    const left = new URL(a);
    const right = new URL(b);
    left.hash = '';
    right.hash = '';
    if (left.pathname !== '/') left.pathname = left.pathname.replace(/\/+$/, '');
    if (right.pathname !== '/') right.pathname = right.pathname.replace(/\/+$/, '');
    return left.toString().toLowerCase() === right.toString().toLowerCase();
  } catch {
    return String(a) === String(b);
  }
}

async function runCheck(check, context) {
  const { status, html, xRobotsTag, url } = context;
  const describe = describeCheck(check);

  switch (check.type) {
    case 'http_status_ok':
      return {
        passed: status >= 200 && status < 300,
        expected: describe,
        actual: `HTTP ${status}`,
      };

    case 'redirect_resolves': {
      const trace = context.redirects || (await traceRedirects(url));
      context.redirects = trace;
      const ok = !trace.looped && trace.finalStatus >= 200 && trace.finalStatus < 300;
      return {
        passed: ok,
        expected: describe,
        actual: trace.looped
          ? 'the redirect still loops'
          : `the chain ends in HTTP ${trace.finalStatus}`,
      };
    }

    case 'redirect_chain_max': {
      const trace = context.redirects || (await traceRedirects(url));
      context.redirects = trace;
      const hops = Math.max(0, trace.chain.length - 1);
      return {
        passed: hops <= Number(check.max || 2) && !trace.looped,
        expected: describe,
        actual: `${hops} hop(s)`,
      };
    }

    case 'tag_present': {
      const values = selectorValues(html, check.selector).filter((value) => value.trim());
      return {
        passed: values.length > 0,
        expected: describe,
        actual: values.length ? `found "${values[0].slice(0, 120)}"` : 'still missing or empty',
      };
    }

    case 'tag_absent': {
      const values = selectorValues(html, check.selector).filter((value) => value.trim());
      return {
        passed: values.length === 0,
        expected: describe,
        actual: values.length ? `still present ("${values[0].slice(0, 120)}")` : 'removed',
      };
    }

    case 'tag_count': {
      const values = selectorValues(html, check.selector).filter((value) => value.trim());
      const min = Number(check.min ?? 1);
      const max = Number(check.max ?? 1);
      return {
        passed: values.length >= min && values.length <= max,
        expected: describe,
        actual: `found ${values.length}`,
      };
    }

    case 'tag_length': {
      const values = selectorValues(html, check.selector).filter((value) => value.trim());
      const length = values[0] ? values[0].length : 0;
      const min = check.min ? Number(check.min) : null;
      const max = check.max ? Number(check.max) : null;
      const ok = length > 0 && (min === null || length >= min) && (max === null || length <= max);
      return { passed: ok, expected: describe, actual: `${length} characters` };
    }

    case 'robots_absent': {
      const directives = robotsDirectives(html, xRobotsTag);
      const present = new RegExp(`\\b${check.directive}\\b`).test(directives);
      return {
        passed: !present,
        expected: describe,
        actual: present ? `still marked ${check.directive}` : `no ${check.directive} directive`,
      };
    }

    case 'canonical_self': {
      const canonical = extractCanonical(html);
      if (!canonical) {
        return { passed: false, expected: describe, actual: 'no canonical tag found' };
      }
      let absolute = canonical;
      try {
        absolute = new URL(canonical, url).toString();
      } catch {
        /* keep the raw value in the report */
      }
      return {
        passed: sameUrl(absolute, url),
        expected: describe,
        actual: `canonical points at ${absolute.slice(0, 200)}`,
      };
    }

    case 'canonical_resolves': {
      const canonical = extractCanonical(html);
      if (!canonical) {
        return { passed: false, expected: describe, actual: 'no canonical tag found' };
      }
      let target;
      try {
        target = new URL(canonical, url).toString();
      } catch {
        return { passed: false, expected: describe, actual: 'the canonical is not a valid URL' };
      }
      const probe = await fetchTarget(target).catch(() => null);
      if (!probe) {
        return { passed: false, expected: describe, actual: 'the canonical target could not be fetched' };
      }
      return {
        passed: probe.status >= 200 && probe.status < 300,
        expected: describe,
        actual: `the canonical target returns HTTP ${probe.status}`,
      };
    }

    case 'images_have_alt': {
      const images = extractImages(html);
      const missing = images.filter((image) => !image.hasAlt);
      return {
        passed: missing.length === 0,
        expected: describe,
        actual: missing.length
          ? `${missing.length} of ${images.length} image(s) still have no alt text`
          : `all ${images.length} image(s) have alt text`,
      };
    }

    case 'has_links': {
      const links = [...html.matchAll(/<a\s+[^>]*href\s*=\s*["'][^"']+["']/gi)].length;
      return { passed: links > 0, expected: describe, actual: `${links} link(s) found` };
    }

    case 'no_mixed_content': {
      const insecure = [...html.matchAll(/(?:src|href)\s*=\s*["']http:\/\/[^"']+["']/gi)].length;
      return {
        passed: insecure === 0,
        expected: describe,
        actual: insecure ? `${insecure} http:// resource(s) still referenced` : 'no http:// resources',
      };
    }

    default:
      return { passed: true, expected: describe, actual: 'no check was defined', skipped: true };
  }
}

/**
 * Run a verification spec.
 *
 * @returns {Promise<{outcome:'passed'|'failed'|'unavailable'|'manual',
 *                    checks: object[], url?: string, status?: number,
 *                    error?: string, checkedAt: string}>}
 */
export async function runVerification(spec) {
  const checkedAt = new Date().toISOString();

  if (!spec || spec.kind === 'manual') {
    return { outcome: 'manual', checks: [], reason: spec?.reason || '', checkedAt };
  }

  let page;
  try {
    page = await fetchTarget(spec.url);
  } catch (error) {
    // Could not reach the site. NOT a failed verification.
    return {
      outcome: 'unavailable',
      checks: [],
      url: spec.url,
      error: error?.name === 'AbortError' ? 'The page did not respond in time.' : error?.message || 'The page could not be fetched.',
      checkedAt,
    };
  }

  const context = { ...page, url: spec.url };
  const results = [];

  for (const check of spec.checks || []) {
    try {
      const result = await runCheck(check, context);
      results.push({ type: check.type, ...result });
    } catch (error) {
      // One check failing to RUN is an availability problem, not evidence
      // that the finding is still present.
      return {
        outcome: 'unavailable',
        checks: results,
        url: spec.url,
        status: page.status,
        error: error?.message || 'A verification check could not run.',
        checkedAt,
      };
    }
  }

  const failed = results.filter((result) => !result.passed && !result.skipped);

  return {
    outcome: failed.length ? 'failed' : 'passed',
    checks: results,
    url: spec.url,
    status: page.status,
    checkedAt,
  };
}
