// Passive WordPress fingerprinting.
//
// Everything here is read from pages the site serves publicly anyway: the
// homepage HTML, its response headers, and a small set of well-known files.
// Nothing probes for components that were not already referenced.
//
// This is deliberately the quiet half of what the WPScan CLI does. Its
// aggressive modes â€” bruteforcing plugin and theme slugs, enumerating users via
// ?author=N, password attacks â€” are not implemented here. From shared
// Cloudflare egress IPs that traffic reads as an attack and gets the range
// blocked, and user enumeration is reconnaissance for credential attacks rather
// than site auditing. What is left still finds the thing that actually matters:
// out-of-date components with published vulnerabilities.

import { fetchPublicHttpUrl, parsePublicHttpUrl } from './url-security.js';

const MAX_HTML_BYTES = 1_500_000;
const FETCH_TIMEOUT_MS = 15000;

// Well-known paths that are safe to request: every one is a file WordPress
// itself publishes, not a guess at a component that may not exist.
const KNOWN_PATHS = [
  { path: '/readme.html', key: 'readme', severity: 'low' },
  { path: '/wp-json/', key: 'restApi', severity: 'info' },
  { path: '/xmlrpc.php', key: 'xmlrpc', severity: 'medium', method: 'GET' },
  { path: '/wp-login.php', key: 'loginPage', severity: 'info' },
  { path: '/feed/', key: 'feed', severity: 'info' },
];

async function fetchText(url, { method = 'GET' } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchPublicHttpUrl(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'SEOX-SiteAudit/1.0 (+security scan of an owned site)' },
    });
    const text = method === 'HEAD' ? '' : (await response.text()).slice(0, MAX_HTML_BYTES);
    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      text,
    };
  } catch (error) {
    return { ok: false, status: 0, error: error?.message || 'fetch failed', headers: null, text: '' };
  } finally {
    clearTimeout(timeout);
  }
}

function metaContent(html, name) {
  const pattern = new RegExp(`<meta[^>]+name=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i');
  const reversed = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*name=["']${name}["']`, 'i');
  return (html.match(pattern) || html.match(reversed) || [])[1] || null;
}

/**
 * A WordPress version string, or null. Versions are only reported with the
 * source they came from, so a guess is never presented as a fact.
 */
export function detectCoreVersion(html, headers) {
  const generator = metaContent(html, 'generator');
  const fromGenerator = generator && generator.match(/WordPress\s+([\d.]+)/i);
  if (fromGenerator) return { version: fromGenerator[1], source: 'meta generator tag' };

  // wp-emoji and other core assets carry ?ver=<core version>.
  const fromEmoji = html.match(/wp-(?:includes|admin)\/[^"']*\?ver=([\d.]+)/i);
  if (fromEmoji) return { version: fromEmoji[1], source: 'core asset ?ver= parameter' };

  const link = headers?.get?.('link') || '';
  if (/wp-json/.test(link)) return { version: null, source: 'REST API link header (version not exposed)' };

  return { version: null, source: null };
}

export function detectWordPress(html, headers) {
  const signals = [];
  if (/wp-content\//i.test(html)) signals.push('wp-content asset paths');
  if (/wp-includes\//i.test(html)) signals.push('wp-includes asset paths');
  if (/\/wp-json\//i.test(html) || /wp-json/.test(headers?.get?.('link') || '')) {
    signals.push('REST API endpoint');
  }
  const generator = metaContent(html, 'generator');
  if (generator && /wordpress/i.test(generator)) signals.push('meta generator tag');
  if (/<link[^>]+rel=["']https:\/\/api\.w\.org\//i.test(html)) signals.push('api.w.org link relation');

  return {
    isWordPress: signals.length > 0,
    // Two or more independent signals is a safe call; one could be a themed
    // static export or a proxied asset path.
    confidence: signals.length >= 2 ? 'high' : signals.length === 1 ? 'low' : 'none',
    signals,
  };
}

function collectComponents(html, kind) {
  const pattern = new RegExp(`wp-content/${kind}/([a-z0-9][a-z0-9._-]*)/([^"')\\s]*)`, 'gi');
  const found = new Map();
  let match;

  while ((match = pattern.exec(html)) !== null) {
    const slug = match[1].toLowerCase();
    if (slug === 'index.php') continue;
    const tail = match[2] || '';
    const version = (tail.match(/[?&]ver=([\d][\w.-]*)/i) || [])[1] || null;

    const existing = found.get(slug);
    if (!existing) {
      found.set(slug, { slug, version, evidence: `wp-content/${kind}/${slug}/` });
    } else if (!existing.version && version) {
      existing.version = version;
    }
  }
  return [...found.values()];
}

/**
 * Plugins and themes referenced by the page's own asset URLs.
 *
 * A ?ver= value is the version the site advertises. It is often the WordPress
 * core version rather than the component's, and it can be stripped or faked, so
 * it is reported as "advertised" and every finding derived from it is labelled
 * as version-based rather than confirmed.
 */
export function detectComponents(html) {
  return {
    plugins: collectComponents(html, 'plugins'),
    themes: collectComponents(html, 'themes'),
  };
}

export function detectExposures(html, headers) {
  const exposures = [];

  const generator = metaContent(html, 'generator');
  if (generator && /WordPress\s+[\d.]+/i.test(generator)) {
    exposures.push({
      key: 'versionDisclosure',
      severity: 'low',
      title: 'WordPress version is published in the page source',
      detail:
        'The meta generator tag names the exact core version, which lets anyone match the site against published exploits without probing it.',
      evidence: generator,
    });
  }

  if (/\/\?author=\d/i.test(html)) {
    exposures.push({
      key: 'authorLinks',
      severity: 'info',
      title: 'Author archive links expose user IDs',
      detail: 'Author archives map numeric user IDs to display names, which is the first half of a credential attack.',
    });
  }

  const server = headers?.get?.('server');
  const poweredBy = headers?.get?.('x-powered-by');
  if (poweredBy) {
    exposures.push({
      key: 'poweredBy',
      severity: 'info',
      title: `X-Powered-By header discloses ${poweredBy}`,
      detail: 'Server software and version headers narrow down which exploits are worth trying.',
      evidence: poweredBy,
    });
  }
  if (server && /\d/.test(server)) {
    exposures.push({
      key: 'serverHeader',
      severity: 'info',
      title: `Server header discloses ${server}`,
      detail: 'A version in the Server header does the same job as X-Powered-By.',
      evidence: server,
    });
  }

  return exposures;
}

function exposureFromKnownPath(entry, response) {
  if (!response.ok) return null;

  if (entry.key === 'readme') {
    const version = (response.text.match(/Version\s+([\d.]+)/i) || [])[1];
    return {
      key: 'readme',
      severity: 'low',
      title: 'readme.html is publicly readable',
      detail: version
        ? `The file names WordPress ${version}. Deleting it after an upgrade removes a free version disclosure.`
        : 'Deleting readme.html after an upgrade removes a free version disclosure.',
      evidence: '/readme.html',
      version: version || null,
    };
  }

  if (entry.key === 'xmlrpc') {
    return {
      key: 'xmlrpc',
      severity: 'medium',
      title: 'xmlrpc.php is reachable',
      detail:
        'XML-RPC accepts many authentication attempts in a single request and is a common amplification target. Disable it unless something you use needs it.',
      evidence: '/xmlrpc.php',
    };
  }

  if (entry.key === 'restApi') {
    const usersExposed = /"slug"\s*:/.test(response.text) && /\/users/.test(response.text);
    return {
      key: 'restApi',
      severity: usersExposed ? 'medium' : 'info',
      title: usersExposed
        ? 'REST API is open and appears to list users'
        : 'REST API is publicly reachable',
      detail: usersExposed
        ? 'The /wp-json/wp/v2/users route publishes usernames, which is the first half of a credential attack.'
        : 'This is WordPress default behaviour and is only a problem if it exposes routes you did not intend.',
      evidence: '/wp-json/',
    };
  }

  return null;
}

/**
 * Passive fingerprint of one site.
 *
 * @returns {{ isWordPress, confidence, signals, coreVersion, plugins, themes,
 *   exposures, warnings, fetched }}
 */
export async function fingerprintSite(targetUrl) {
  const url = parsePublicHttpUrl(targetUrl, 'Target URL');
  const origin = url.origin;
  const warnings = [];

  const home = await fetchText(url.toString());
  if (!home.ok) {
    const error = new Error(
      home.error ? `Could not read ${origin}: ${home.error}` : `${origin} returned ${home.status}.`
    );
    error.status = 502;
    throw error;
  }

  const html = home.text;
  const { isWordPress, confidence, signals } = detectWordPress(html, home.headers);
  const coreVersion = detectCoreVersion(html, home.headers);
  const { plugins, themes } = detectComponents(html);
  const exposures = detectExposures(html, home.headers);

  // Only look at the well-known paths once the site actually looks like
  // WordPress: on anything else these are just noise requests.
  if (isWordPress) {
    for (const entry of KNOWN_PATHS) {
      const response = await fetchText(`${origin}${entry.path}`, { method: entry.method || 'GET' });
      const exposure = exposureFromKnownPath(entry, response);
      if (exposure) {
        if (exposure.key === 'readme' && exposure.version && !coreVersion.version) {
          coreVersion.version = exposure.version;
          coreVersion.source = 'readme.html';
        }
        exposures.push(exposure);
      }
    }
  }

  if (isWordPress && !coreVersion.version) {
    warnings.push(
      'The core version is not published anywhere readable, so core vulnerabilities could not be checked. That is good hardening, not a failure.'
    );
  }
  if (isWordPress && plugins.length === 0) {
    warnings.push(
      'No plugin assets were referenced on the homepage. Plugins that only load on inner pages are not visible to a passive scan.'
    );
  }

  return {
    origin,
    isWordPress,
    confidence,
    signals,
    coreVersion,
    plugins,
    themes,
    exposures,
    warnings,
  };
}


