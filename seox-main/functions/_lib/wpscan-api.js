// WPScan vulnerability database client.
//
// https://wpscan.com/api — the CLI is Ruby and cannot run on Cloudflare Pages
// Functions, so SEOX uses the HTTP API for the part that actually matters: the
// vulnerability data. Fingerprinting is done by wpscan-detect.js.
//
// Licensing: the free tier is 25 requests a day and is for non-commercial use.
// A commercial SaaS needs a paid plan. Nothing here works around that, and the
// remaining-request count is surfaced so the limit is visible rather than hit
// silently.

const API_BASE = 'https://wpscan.com/api/v3';
const TIMEOUT_MS = 15000;

export function hasApiToken(env) {
  return Boolean(String(env?.WPSCAN_API_TOKEN || '').trim());
}

function configError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = 'WPSCAN_NOT_CONFIGURED';
  return error;
}

async function call(env, path) {
  const token = String(env?.WPSCAN_API_TOKEN || '').trim();
  if (!token) {
    throw configError(
      'No WPScan API token configured. Add WPSCAN_API_TOKEN to check components against the vulnerability database.'
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Token token=${token}`, Accept: 'application/json' },
      signal: controller.signal,
    });

    const remaining = Number(response.headers.get('x-ratelimit-remaining'));
    const payload = await response.json().catch(() => ({}));

    if (response.status === 404) {
      // The database simply has no record of this component. That is a normal
      // answer, not an error: most plugins have never had a published CVE.
      return { found: false, data: null, remaining };
    }
    if (response.status === 401 || response.status === 403) {
      const error = new Error('The WPScan API token was rejected. Check WPSCAN_API_TOKEN.');
      error.status = 401;
      error.code = 'WPSCAN_UNAUTHORIZED';
      throw error;
    }
    if (response.status === 429) {
      const error = new Error(
        'WPScan API daily limit reached. The free tier allows 25 requests a day; results below cover only the components checked before the limit.'
      );
      error.status = 429;
      error.code = 'WPSCAN_RATE_LIMITED';
      throw error;
    }
    if (!response.ok) {
      const error = new Error(payload?.error || `WPScan API returned ${response.status}.`);
      error.status = 502;
      error.code = 'WPSCAN_ERROR';
      throw error;
    }

    return { found: true, data: payload, remaining };
  } catch (cause) {
    if (cause.name === 'AbortError') {
      const error = new Error('WPScan API timed out.');
      error.status = 504;
      throw error;
    }
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getStatus(env) {
  const { data } = await call(env, '/status');
  return data;
}

function versionKey(version) {
  // The core endpoint keys releases without separators: 6.4.2 -> 642
  return String(version || '').replace(/\./g, '');
}

export async function getCoreVulnerabilities(env, version) {
  if (!version) return { vulnerabilities: [], remaining: null };
  const { found, data, remaining } = await call(env, `/wordpresses/${versionKey(version)}`);
  if (!found || !data) return { vulnerabilities: [], remaining };

  // The response is keyed by the version string.
  const entry = data[version] || Object.values(data)[0] || {};
  return { vulnerabilities: entry.vulnerabilities || [], releaseDate: entry.release_date, remaining };
}

export async function getPluginVulnerabilities(env, slug) {
  const { found, data, remaining } = await call(env, `/plugins/${encodeURIComponent(slug)}`);
  if (!found || !data) return { vulnerabilities: [], remaining, known: false };

  const entry = data[slug] || Object.values(data)[0] || {};
  return {
    vulnerabilities: entry.vulnerabilities || [],
    latestVersion: entry.latest_version || null,
    lastUpdated: entry.last_updated || null,
    popular: Boolean(entry.popular),
    remaining,
    known: true,
  };
}

export async function getThemeVulnerabilities(env, slug) {
  const { found, data, remaining } = await call(env, `/themes/${encodeURIComponent(slug)}`);
  if (!found || !data) return { vulnerabilities: [], remaining, known: false };

  const entry = data[slug] || Object.values(data)[0] || {};
  return {
    vulnerabilities: entry.vulnerabilities || [],
    latestVersion: entry.latest_version || null,
    remaining,
    known: true,
  };
}
