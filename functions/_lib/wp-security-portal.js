// Client for the SEOX security plugin's portal endpoint:
//
//   POST <site>/wp-json/seox/v1/security-portal/dashboard
//   { admin_token, project_id, scan_type, checks[] }
//
// The plugin runs the scan inside WordPress, where it can see what a passive
// HTTP scan never can: the real plugin and theme lists, the user roles, the
// database prefix, the files on disk. It answers with the finished dashboard
// in the same request, so there is nothing to poll in the normal case.
//
// Two rules hold everywhere in this file:
//
//   1. The admin token is a credential. It is sent in the request body and
//      never put in a URL, a log line, or a message that reaches the browser.
//      Anything the site echoes back is redacted before it is re-thrown.
//
//   2. The response is treated as untrusted input. Every field is normalised
//      with a safe default, because a site running an older plugin build will
//      answer with a shape that is close to, but not exactly, the current one.

import { fetchPublicHttpUrl, parsePublicHttpUrl } from './url-security.js';

export const PORTAL_PATH = '/wp-json/seox/v1/security-portal/dashboard';

export const PORTAL_CHECKS = [
  'core',
  'plugins',
  'themes',
  'users',
  'malware',
  'database',
  'server',
  'ssl',
  'backups',
  'monitoring',
];

export const PORTAL_SCAN_TYPES = ['full', 'quick'];

// A full run walks every PHP file on the site: the reference install takes
// about nine seconds, a large one considerably longer.
const DEFAULT_TIMEOUT_MS = 120_000;

// Statuses that mean the plugin has not finished. The endpoint answers
// synchronously today, so this only ever fires on a build that queues work.
const PENDING_STATUSES = new Set([
  'running',
  'queued',
  'processing',
  'pending',
  'in_progress',
  'started',
]);

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];

function portalError(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/** Strip anything that looks like the credential out of text we did not write. */
export function redactToken(text, token) {
  const value = String(text ?? '');
  const secret = String(token ?? '').trim();
  if (!secret || secret.length < 6) return value;
  return value.split(secret).join('[redacted]');
}

/**
 * The REST route sits under the site's own home URL, so an install in a
 * subdirectory keeps its path.
 */
export function buildPortalEndpoint(siteUrl) {
  const raw = String(siteUrl || '').trim();
  if (!raw) throw portalError('This project has no website URL, so there is nothing to scan.', 400);

  const base = parsePublicHttpUrl(raw.startsWith('http') ? raw : `https://${raw}`, 'Site URL');
  return `${base.origin}${base.pathname.replace(/\/+$/, '')}${PORTAL_PATH}`;
}

export function normaliseChecks(checks) {
  if (!Array.isArray(checks) || checks.length === 0) return [...PORTAL_CHECKS];
  const allowed = checks
    .map((check) => String(check || '').trim().toLowerCase())
    .filter((check) => PORTAL_CHECKS.includes(check));
  return allowed.length ? [...new Set(allowed)] : [...PORTAL_CHECKS];
}

export function normaliseScanType(scanType) {
  const value = String(scanType || '').trim().toLowerCase();
  return PORTAL_SCAN_TYPES.includes(value) ? value : 'full';
}

// --- Value coercion --------------------------------------------------------

const asObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const asArray = (value) => (Array.isArray(value) ? value : []);

function asText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function asNumber(value, fallback = null) {
  const number = typeof value === 'string' ? Number(value.trim()) : value;
  return Number.isFinite(number) ? number : fallback;
}

function asCount(value) {
  return asNumber(value, 0) ?? 0;
}

/**
 * Tri-state on purpose: a check the plugin did not report is "unknown", which
 * the UI must not draw as "off".
 */
function asFlag(value) {
  if (value === true || value === 1 || value === '1' || value === 'true' || value === 'yes' || value === 'enabled') {
    return true;
  }
  if (value === false || value === 0 || value === '0' || value === 'false' || value === 'no' || value === 'disabled') {
    return false;
  }
  return null;
}

function normaliseSeverity(value) {
  const severity = asText(value).toLowerCase();
  return SEVERITIES.includes(severity) ? severity : 'info';
}

// --- Response normalisation -------------------------------------------------

function normaliseSummary(summary) {
  const source = asObject(summary);
  return SEVERITIES.reduce((acc, severity) => {
    acc[severity] = asCount(source[severity]);
    return acc;
  }, {});
}

function normaliseLastScan(lastScan) {
  const source = asObject(lastScan);
  return {
    scanId: asText(source.scan_id),
    status: asText(source.status).toLowerCase(),
    scanType: asText(source.scan_type),
    startedAt: asText(source.started_at),
    completedAt: asText(source.completed_at),
    duration: asText(source.duration),
    scannerVersion: asText(source.scanner_version),
  };
}

function normaliseIssue(issue, index) {
  const source = asObject(issue);
  // remediation is an object today and was a bare string in earlier builds.
  const remediation = source.remediation;
  return {
    id: asText(source.id) || `issue-${index}`,
    category: asText(source.category),
    severity: normaliseSeverity(source.severity),
    title: asText(source.title) || 'Untitled issue',
    description: asText(source.description),
    evidence: asText(source.evidence),
    remediation:
      typeof remediation === 'string' ? remediation.trim() : asText(asObject(remediation).action),
    discoveredAt: asText(source.discovered_at),
  };
}

function normaliseCore(core) {
  const source = asObject(core);
  return {
    wordpressVersion: asText(source.wordpress_version),
    debug: asFlag(source.debug),
    xmlrpc: asFlag(source.xmlrpc),
    autoUpdates: asFlag(source.auto_updates),
  };
}

function normalisePlugins(plugins) {
  const source = asObject(plugins);
  const items = asArray(source.items).map((entry, index) => {
    const item = asObject(entry);
    const status = asText(item.status).toLowerCase();
    return {
      file: asText(item.file),
      slug: asText(item.slug) || asText(item.file).split('/')[0] || `plugin-${index}`,
      name: asText(item.name) || asText(item.file) || 'Unknown plugin',
      version: asText(item.version) || asText(item.current_version),
      author: asText(item.author),
      status: status || 'unknown',
      updateAvailable: asFlag(item.update_available),
      updateVersion: asText(item.update_version),
    };
  });

  const installed = asNumber(source.installed);
  const active = asNumber(source.active);

  return {
    installed: installed ?? items.length,
    active: active ?? items.filter((item) => item.status === 'active').length,
    inactive:
      asNumber(source.inactive) ??
      (installed !== null && active !== null
        ? Math.max(installed - active, 0)
        : items.filter((item) => item.status !== 'active').length),
    items,
  };
}

function normaliseThemes(themes) {
  const source = asObject(themes);
  const fromItems = asArray(source.items).map((entry, index) => {
    const item = asObject(entry);
    return {
      slug: asText(item.slug) || asText(item.name) || `theme-${index}`,
      name: asText(item.name) || asText(item.slug) || 'Unknown theme',
      author: asText(item.author),
      status: asText(item.status).toLowerCase() || 'unknown',
      version: asText(item.current_version) || asText(item.version),
      updateVersion: asText(item.update_version),
      updateAvailable: asFlag(item.update_available),
    };
  });

  // Older builds report only the active theme, as a bare object.
  const activeSource = asObject(source.active);
  const activeFromObject = Object.keys(activeSource).length
    ? {
        slug: asText(activeSource.slug) || asText(activeSource.name) || 'active-theme',
        name: asText(activeSource.name) || asText(activeSource.slug) || 'Unknown theme',
        author: asText(activeSource.author),
        status: 'active',
        version: asText(activeSource.version) || asText(activeSource.current_version),
        updateVersion: asText(activeSource.update_version),
        updateAvailable: asFlag(activeSource.update_available),
      }
    : null;

  const items = fromItems.length ? fromItems : activeFromObject ? [activeFromObject] : [];
  const active = items.find((item) => item.status === 'active') || activeFromObject || null;

  return {
    installed: asNumber(source.installed) ?? items.length,
    activeCount: asNumber(source.active) ?? (active ? 1 : 0),
    inactive: asNumber(source.inactive) ?? Math.max(items.length - (active ? 1 : 0), 0),
    active,
    items,
  };
}

function normaliseUsers(users) {
  const source = asObject(users);
  // total is an object on current builds and was a plain count before that.
  const total = source.total;
  const totalObject = asObject(total);
  const roles = Object.entries(asObject(totalObject.avail_roles ?? source.avail_roles)).map(
    ([role, count]) => ({ role, count: asCount(count) })
  );

  return {
    totalUsers:
      asNumber(totalObject.total_users) ??
      asNumber(total) ??
      roles.reduce((sum, role) => sum + role.count, 0),
    admins: asNumber(source.admins),
    defaultAdmin: asFlag(source.default_admin),
    roles,
  };
}

function normaliseMalwareFinding(finding, index) {
  const source = asObject(finding);
  return {
    id: asText(source.id) || `malware-${index}`,
    severity: normaliseSeverity(source.severity),
    title: asText(source.title) || 'Suspicious file',
    description: asText(source.description),
    remediation:
      typeof source.remediation === 'string'
        ? source.remediation.trim()
        : asText(asObject(source.remediation).action),
    // The absolute server path is deliberately dropped: the relative one says
    // everything the user needs and the other leaks the hosting layout.
    path: asText(source.relative_path) || asText(source.path),
    modified: asText(source.modified),
    size: asNumber(source.size),
    signals: asArray(source.signals).map((signal) => asText(signal)).filter(Boolean),
  };
}

function normaliseMalware(malware) {
  const source = asObject(malware);
  const checksum = asObject(source.core_checksum);
  return {
    status: asText(source.status) || 'unknown',
    message: asText(source.message),
    scanner: asText(source.scanner),
    scannedFiles: asNumber(source.scanned_files),
    skippedFiles: asNumber(source.skipped_files),
    recentPhpFiles: asNumber(source.recent_php_files),
    uploadPhpFiles: asNumber(source.upload_php_files),
    durationSeconds: asNumber(source.duration_seconds),
    summary: normaliseSummary(source.summary),
    coreChecksum: {
      status: asText(checksum.status),
      modifiedFiles: asArray(checksum.modified_files).map((file) => asText(file)).filter(Boolean),
    },
    findings: asArray(source.findings).map(normaliseMalwareFinding),
  };
}

function normaliseCategories(categories) {
  const source = asObject(categories);
  const database = asObject(source.database);
  const server = asObject(source.server);
  const ssl = asObject(source.ssl);
  const backups = asObject(source.backups);
  const monitoring = asObject(source.monitoring);

  return {
    core: normaliseCore(source.core),
    plugins: normalisePlugins(source.plugins),
    themes: normaliseThemes(source.themes),
    users: normaliseUsers(source.users),
    malware: normaliseMalware(source.malware),
    database: {
      server: asText(database.server),
      prefix: asText(database.prefix),
    },
    server: {
      php: asText(server.php),
      wordpress: asText(server.wordpress),
      https: asFlag(server.https),
      headersExpected: asArray(server.headers_expected).map((header) => asText(header)).filter(Boolean),
    },
    ssl: {
      httpsDetected: asFlag(ssl.https_detected),
      homeUrl: asText(ssl.home_url),
    },
    backups: {
      status: asText(backups.status) || 'unknown',
      message: asText(backups.message),
    },
    monitoring: {
      debugLog: asFlag(monitoring.debug_log),
      cron: asFlag(monitoring.cron),
    },
  };
}

function normaliseMeta(meta) {
  const source = asObject(meta);
  return {
    projectId: asText(source.project_id),
    siteUrl: asText(source.site_url),
    siteName: asText(source.site_name),
    wordpress: asText(source.wordpress),
    php: asText(source.php),
    pluginVersion: asText(source.plugin_version),
    generatedAt: asText(source.generated_at),
  };
}

/**
 * Turn the plugin's payload into the shape the dashboard renders. Every field
 * is present afterwards, so no consumer has to guard for a missing branch.
 */
export function normaliseDashboard(payload) {
  const source = asObject(payload);
  const data = asObject(source.data);
  const lastScan = normaliseLastScan(data.last_scan);

  return {
    message: asText(source.message),
    securityScore: asNumber(data.security_score),
    riskLevel: asText(data.risk_level).toLowerCase(),
    summary: normaliseSummary(data.summary),
    lastScan,
    topIssues: asArray(data.top_issues).map(normaliseIssue),
    categories: normaliseCategories(data.categories),
    meta: normaliseMeta(source.meta),
    pending: PENDING_STATUSES.has(lastScan.status),
    receivedAt: new Date().toISOString(),
  };
}

// --- Request ---------------------------------------------------------------

function describeHttpFailure(status, payload, bodyText, host, token) {
  const source = asObject(payload);
  const reported = redactToken(asText(source.message) || asText(source.error), token);

  if (status === 401 || status === 403) {
    return portalError(
      reported ||
        `${host} did not accept this project's credentials. Check that the SEOX plugin on that site is connected to this account and to this project.`,
      403
    );
  }
  if (status === 404) {
    return portalError(
      `${host} has no SEOX security endpoint. Install or update the SEOX plugin on that site, then run the scan again.`,
      404
    );
  }
  if (status === 400 || status === 422) {
    return portalError(reported || `${host} rejected the scan request as invalid.`, 400);
  }
  if (status === 429) {
    return portalError(reported || `${host} is rate limiting scan requests. Try again shortly.`, 429);
  }
  if (status >= 500) {
    return portalError(
      reported || `${host} returned an error while running the scan (HTTP ${status}).`,
      502
    );
  }
  return portalError(
    reported ||
      redactToken(bodyText, token).slice(0, 200) ||
      `${host} returned an unexpected response (HTTP ${status}).`,
    502
  );
}

/**
 * Run a scan against the site's SEOX plugin and return the normalised
 * dashboard. Throws an Error carrying a `status` and a message that is safe to
 * show the user.
 */
export async function runPortalScan({
  siteUrl,
  adminToken,
  projectId,
  scanType,
  checks,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetchPublicHttpUrl,
} = {}) {
  const token = String(adminToken || '').trim();
  const project = String(projectId || '').trim();

  if (!token) {
    throw portalError(
      'This account has no SEOX admin token, so the site plugin cannot be authenticated. Generate one in Settings first.',
      409
    );
  }
  if (!project) throw portalError('A project must be selected.', 400);

  const endpoint = buildPortalEndpoint(siteUrl);
  const host = new URL(endpoint).host;

  const body = JSON.stringify({
    admin_token: token,
    project_id: project,
    scan_type: normaliseScanType(scanType),
    checks: normaliseChecks(checks),
  });

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    if (cause?.status) throw cause;
    if (cause?.name === 'TimeoutError' || cause?.name === 'AbortError') {
      throw portalError(
        `${host} did not finish the scan within ${Math.round(
          timeoutMs / 1000
        )} seconds. A large site can take longer - try again, or run a quick scan.`,
        504
      );
    }
    throw portalError(`${host} could not be reached for the security scan.`, 502);
  }

  const bodyText = await response.text().catch(() => '');
  let payload = null;
  try {
    payload = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) throw describeHttpFailure(response.status, payload, bodyText, host, token);

  if (!payload || typeof payload !== 'object') {
    throw portalError(`${host} returned a security response that could not be read.`, 502);
  }
  if (payload.success === false) {
    throw portalError(
      redactToken(asText(payload.message), token) || `${host} reported that the scan failed.`,
      502
    );
  }
  if (!payload.data || typeof payload.data !== 'object') {
    throw portalError(`${host} returned a security response with no scan data.`, 502);
  }

  // The endpoint travels with the result so the page can show which site was
  // scanned. It is derived from the project's own URL and carries no secret.
  return { ...normaliseDashboard(payload), endpoint };
}
