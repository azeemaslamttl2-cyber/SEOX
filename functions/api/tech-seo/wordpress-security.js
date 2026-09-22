// GET  /api/tech-seo/wordpress-security?projectId=[&scanId=][&history=1]
// POST /api/tech-seo/wordpress-security  { action: 'portal-scan', projectId[, scanType, checks] }
//                                        { action: 'scan', projectId }
//                                        { action: 'save-token', projectId, token }
//                                        { action: 'clear-token', projectId }
//
// WordPress security audit for a site the user owns, from two sources:
//
//   * 'portal-scan' asks the SEOX plugin installed on the site to audit itself
//     and return its dashboard. It sees the real plugin, theme, user and file
//     state, because it runs inside WordPress.
//
//   * 'scan' is the passive fallback for a site with no plugin: it reads what
//     the site already serves publicly and checks components against the
//     WPScan vulnerability database.
//
// Three controls define the scope of this endpoint:
//
//   1. The target must be the domain of one of the caller's own projects. SEOX
//      will not scan an arbitrary URL on request, which is what separates a
//      site auditor from a scanning service.
//
//   2. Passive detection (wpscan-detect.js) reads the site's own asset URLs; it
//      does not bruteforce plugin slugs, enumerate users, or attempt any
//      authentication.
//
//   3. The portal scan authenticates with the account's admin token, which is
//      read server-side and never sent to the browser.
//
// Vulnerability data comes from the WPScan API. Its CLI is Ruby and cannot run
// on Pages Functions, so only the database half is used.

import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from '../../_lib/http.js';
import {
  getStoredDocument,
  upsertStoredDocument,
  verifyAccessToken,
} from '../../_lib/mysql-storage.js';
import { consumeRateLimit } from '../../_lib/rate-limit.js';
import { configureMysqlConnection, queryOne } from '../../_lib/mysql.js';
import { PORTAL_CHECKS, buildPortalEndpoint, runPortalScan } from '../../_lib/wp-security-portal.js';
import { parsePublicHttpUrl } from '../../_lib/url-security.js';
import { fingerprintSite } from '../../_lib/wpscan-detect.js';
import {
  getCoreVulnerabilities,
  getPluginVulnerabilities,
  getThemeVulnerabilities,
} from '../../_lib/wpscan-api.js';
import {
  TOKEN_SOURCE,
  clearWpscanToken,
  resolveWpscanToken,
  saveWpscanToken,
  tokenEncryptionAvailable,
} from '../../_lib/wpscan-token.js';
import {
  buildFinding,
  countBySeverity,
  filterReportable,
  sortFindings,
} from '../../_lib/wpscan-scoring.js';
import { getScan, latestScan, saveScan, scanHistory } from '../../_lib/wpscan-store.js';

// The free WPScan tier allows 25 requests a day. Even on a paid plan there is no
// point asking about forty plugins found on one page load.
const MAX_COMPONENT_LOOKUPS = 12;

// Where the plugin's dashboard is kept between visits, so the page opens on the
// last result instead of an empty shell.
const PORTAL_TOOL_KEY = 'wordpressSecurity';

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function normaliseHost(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim();
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * The project the selector at the top of the app is pointing at.
 *
 * Read straight from the row rather than through getStoredDocument(), which
 * returns only the project_data JSON blob - the website URL lives in the
 * `full_url` and `domain` columns, so a project that has one looks like it has
 * none when it is read through the document view.
 */
async function loadProjectRecord(userId, projectId) {
  if (!projectId) fail('A project must be selected.', 400);

  const row = await queryOne(
    `SELECT project_id, project_name, domain, full_url, project_data
       FROM user_projects
      WHERE user_id = ? AND project_id = ?
      LIMIT 1`,
    [userId, projectId]
  );
  if (!row) fail('Project was not found.', 404);
  return row;
}

/**
 * The project's own website URL, with its protocol kept as configured. Falls
 * back through the places older rows kept it before settling for the bare
 * domain, which the projects API requires and so is always present.
 */
export function projectSiteUrl(row) {
  const data = parseJson(row?.project_data, {});
  const candidate = String(
    row?.full_url || data.fullUrl || data.full_url || data.url || row?.domain || ''
  ).trim();
  if (!candidate) return null;

  return parsePublicHttpUrl(
    /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`,
    'Project URL'
  ).toString();
}

/**
 * Resolve the URL to scan from the caller's own project, and refuse anything
 * else. A caller-supplied URL is only accepted when it is on the project's own
 * host, so this endpoint cannot be pointed at a third party.
 */
export function resolveTargetUrl(row, requestedUrl) {
  const projectUrl = projectSiteUrl(row);
  if (!projectUrl) {
    fail('This project has no website URL, so there is nothing to scan.', 400);
  }

  const base = new URL(projectUrl);
  if (!requestedUrl) return base.toString();

  const requested = parsePublicHttpUrl(requestedUrl, 'Target URL');
  if (normaliseHost(requested.hostname) !== normaliseHost(base.hostname)) {
    fail(
      `SEOX only scans sites you have a project for. "${requested.hostname}" does not match this project's domain "${base.hostname}".`,
      403
    );
  }
  return requested.toString();
}

async function resolveTarget(userId, projectId, requestedUrl) {
  return resolveTargetUrl(await loadProjectRecord(userId, projectId), requestedUrl);
}

/**
 * The site's SEOX plugin is configured with the account's admin token, so that
 * is what proves the request comes from the account the site is connected to.
 * It is read here and used server-side only.
 */
async function loadAdminToken(userId) {
  const row = await queryOne(
    'SELECT admin_token FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [userId]
  );
  return String(row?.admin_token || '').trim();
}

/**
 * The website to scan for the selected project. The page passes the URL it is
 * showing in the project selector; it is honoured only when it is the same host
 * the project is registered under, so the endpoint still cannot be aimed
 * somewhere else.
 */
async function resolvePortalProject(userId, projectId, requestedUrl) {
  const row = await loadProjectRecord(userId, projectId);
  return { row, siteUrl: resolveTargetUrl(row, requestedUrl) };
}

async function loadPortalDashboard(userId, projectId) {
  try {
    const row = await queryOne(
      `SELECT result FROM tool_results
        WHERE user_id = ? AND project_id = ? AND tool_key = ?
        LIMIT 1`,
      [userId, projectId, PORTAL_TOOL_KEY]
    );

    // The column is JSON, but whether the driver hands back an object or the
    // raw text depends on the server it is talking to.
    const saved = typeof row?.result === 'string' ? JSON.parse(row.result) : row?.result;
    return saved && typeof saved === 'object' && saved.summary ? saved : null;
  } catch (error) {
    // A saved result that cannot be read must never stop the page loading: the
    // user can always run the scan again.
    console.warn('WordPress security: reading the saved portal scan failed:', error?.message);
    return null;
  }
}

async function savePortalDashboard(env, userId, projectId, dashboard, siteUrl) {
  try {
    await upsertStoredDocument(
      env,
      `users/${userId}/projects/${projectId}/toolResults`,
      PORTAL_TOOL_KEY,
      { result: dashboard, projectUrl: siteUrl }
    );
  } catch (error) {
    // Persistence is a convenience: the scan the user just ran is already in
    // the response, so a write failure is logged rather than surfaced.
    console.warn('WordPress security: saving the portal scan failed:', error?.message);
  }
}

function serializeScan(scan) {
  if (!scan) return null;
  const parse = (value, fallback) => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  return {
    id: scan.id,
    targetUrl: scan.target_url,
    isWordPress: Boolean(scan.is_wordpress),
    confidence: scan.detection_confidence,
    coreVersion: scan.core_version,
    coreVersionSource: scan.core_version_source,
    pluginsFound: scan.plugins_found,
    themesFound: scan.themes_found,
    counts: {
      critical: scan.critical_count,
      high: scan.high_count,
      medium: scan.medium_count,
      low: scan.low_count,
      info: scan.info_count,
    },
    fingerprint: parse(scan.fingerprint, null),
    vulnDbStatus: scan.vuln_db_status,
    vulnDbRemaining: scan.vuln_db_remaining,
    warnings: parse(scan.warnings, []),
    durationMs: scan.duration_ms,
    createdAt: scan.created_at,
    findings: (scan.findings || []).map((finding) => ({
      kind: finding.kind,
      componentSlug: finding.component_slug,
      componentName: finding.component_name,
      installedVersion: finding.installed_version,
      fixedIn: finding.fixed_in,
      severity: finding.severity,
      title: finding.title,
      detail: finding.detail,
      cve: finding.cve,
      cvssScore: finding.cvss_score === null ? null : Number(finding.cvss_score),
      references: parse(finding.references_json, []),
      evidence: finding.evidence,
      confirmed: Boolean(finding.confirmed),
    })),
  };
}

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders('GET, POST, OPTIONS'), 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return emptyResponse(204, headers);

  try {
    const decoded = await verifyAccessToken(request, env);
    const userId = decoded.uid;
    configureMysqlConnection(env);

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const projectId = url.searchParams.get('projectId');
      if (!projectId) fail('projectId is required.', 400);
      await getStoredDocument(env, `users/${userId}/projects`, projectId);

      if (url.searchParams.get('history') === '1') {
        const history = await scanHistory(userId, projectId, 20);
        return jsonResponse(
          {
            history: history.map((entry) => ({
              id: entry.id,
              targetUrl: entry.target_url,
              isWordPress: Boolean(entry.is_wordpress),
              coreVersion: entry.core_version,
              counts: {
                critical: entry.critical_count,
                high: entry.high_count,
                medium: entry.medium_count,
                low: entry.low_count,
                info: entry.info_count,
              },
              createdAt: entry.created_at,
            })),
          },
          200,
          headers
        );
      }

      const scanId = url.searchParams.get('scanId');
      const scan = scanId ? await getScan(userId, scanId) : await latestScan(userId, projectId);
      const portal = await loadPortalDashboard(userId, projectId);

      // A project token that will not decrypt must not read as "no token":
      // the fix is to re-enter it, not to add one.
      let token = { token: '', source: TOKEN_SOURCE.NONE, preview: null };
      let tokenError = null;
      try {
        token = await resolveWpscanToken(env, userId, projectId);
      } catch (cause) {
        tokenError = cause?.message || 'The saved WPScan token could not be read.';
      }

      return jsonResponse(
        {
          scan: serializeScan(scan),
          portal,
          vulnDbConfigured: Boolean(token.token),
          tokenSource: token.source,
          tokenPreview: token.preview,
          tokenEncrypted: tokenEncryptionAvailable(env),
          tokenError,
          needsFirstScan: !scan && !portal,
        },
        200,
        headers
      );
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, headers);
    }

    const body = await readJson(request);

    // Token management. Both actions confirm the project belongs to the
    // caller first, so a token can never be written onto someone else's row.
    if (body.action === 'save-token' || body.action === 'clear-token') {
      if (!body.projectId) fail('A project must be selected.', 400);
      const owned = await getStoredDocument(env, `users/${userId}/projects`, body.projectId);
      if (!owned) fail('Project was not found.', 404);

      if (body.action === 'clear-token') {
        await clearWpscanToken(userId, body.projectId);
      } else {
        await saveWpscanToken(env, userId, body.projectId, body.token);
      }

      const token = await resolveWpscanToken(env, userId, body.projectId);
      return jsonResponse(
        {
          success: true,
          vulnDbConfigured: Boolean(token.token),
          tokenSource: token.source,
          tokenPreview: token.preview,
          tokenEncrypted: tokenEncryptionAvailable(env),
          tokenError: null,
        },
        200,
        headers
      );
    }

    // The scan the site's own plugin runs. The admin token never leaves the
    // server: the browser asks for a scan, not for the credential.
    if (body.action === 'portal-scan') {
      const { row, siteUrl } = await resolvePortalProject(userId, body.projectId, body.siteUrl);
      const endpoint = buildPortalEndpoint(siteUrl);
      await consumeRateLimit(userId, 'wp-portal:scan');

      // Enough to follow a scan end to end in the logs. The admin token is not
      // part of it, here or anywhere else.
      console.log('WordPress security scan requested:', {
        projectId: row.project_id,
        projectName: row.project_name,
        siteUrl,
        endpoint,
      });

      const dashboard = await runPortalScan({
        siteUrl,
        adminToken: await loadAdminToken(userId),
        projectId: body.projectId,
        scanType: body.scanType,
        checks: Array.isArray(body.checks) ? body.checks : PORTAL_CHECKS,
      });

      console.log('WordPress security scan finished:', {
        projectId: row.project_id,
        endpoint,
        status: dashboard.lastScan.status || 'unknown',
        securityScore: dashboard.securityScore,
        riskLevel: dashboard.riskLevel,
      });

      await savePortalDashboard(env, userId, body.projectId, dashboard, siteUrl);

      return jsonResponse({ success: true, portal: dashboard }, 200, headers);
    }

    if (body.action !== 'scan') return jsonResponse({ error: 'Invalid action' }, 400, headers);
    // One scan can spend a dozen of the 25 daily WPScan requests the whole
    // install shares.
    await consumeRateLimit(userId, 'wpscan:scan');

    const targetUrl = await resolveTarget(userId, body.projectId, body.targetUrl);
    const startedAt = Date.now();

    const fingerprint = await fingerprintSite(targetUrl);
    const warnings = [...fingerprint.warnings];

    if (!fingerprint.isWordPress) {
      const scanId = await saveScan({
        userId,
        projectId: body.projectId,
        targetUrl,
        isWordPress: false,
        confidence: fingerprint.confidence,
        fingerprint: { signals: fingerprint.signals },
        warnings,
        durationMs: Date.now() - startedAt,
        counts: {},
        findings: [],
      });
      return jsonResponse(
        {
          success: true,
          scan: serializeScan(await getScan(userId, scanId)),
          message: 'This site does not look like WordPress, so no WordPress checks were run.',
        },
        200,
        headers
      );
    }

    // Exposures come from the fingerprint and need no API call.
    const findings = fingerprint.exposures.map((exposure) => ({
      kind: 'exposure',
      componentSlug: null,
      componentName: null,
      installedVersion: null,
      fixedIn: null,
      severity: exposure.severity,
      confirmed: true,
      title: exposure.title,
      detail: exposure.detail,
      cve: null,
      cvssScore: null,
      references: [],
      evidence: exposure.evidence || null,
    }));

    let vulnDbStatus = 'skipped';
    let remaining = null;

    // A token that cannot be read must not throw away a scan that has already
    // fingerprinted the site: the component list is still worth returning, and
    // the warning tells the user what to fix.
    let apiToken = '';
    let tokenSource = TOKEN_SOURCE.NONE;
    try {
      ({ token: apiToken, source: tokenSource } = await resolveWpscanToken(
        env,
        userId,
        body.projectId
      ));
    } catch (cause) {
      warnings.push(cause?.message || 'The saved WPScan token could not be read.');
    }

    if (!apiToken) {
      warnings.push(
        'No WPScan API token is configured, so components were listed but not checked against the vulnerability database.'
      );
      vulnDbStatus = 'not_configured';
    } else {
      vulnDbStatus = 'ok';
      if (tokenSource === TOKEN_SOURCE.ENVIRONMENT) {
        warnings.push(
          "This scan used the install-wide WPScan token and its shared daily quota. Add a token to this project to give it its own."
        );
      }

      const lookups = [
        ...(fingerprint.coreVersion.version
          ? [{ kind: 'core', slug: null, version: fingerprint.coreVersion.version }]
          : []),
        ...fingerprint.plugins.map((plugin) => ({ kind: 'plugin', slug: plugin.slug, version: plugin.version })),
        ...fingerprint.themes.map((theme) => ({ kind: 'theme', slug: theme.slug, version: theme.version })),
      ].slice(0, MAX_COMPONENT_LOOKUPS);

      const skipped =
        fingerprint.plugins.length + fingerprint.themes.length + 1 - lookups.length;
      if (skipped > 0) {
        warnings.push(
          `${skipped} components were detected but not checked: the scan stops at ${MAX_COMPONENT_LOOKUPS} lookups to stay inside the WPScan request limit.`
        );
      }

      for (const lookup of lookups) {
        try {
          let result;
          if (lookup.kind === 'core') result = await getCoreVulnerabilities(apiToken, lookup.version);
          else if (lookup.kind === 'plugin') result = await getPluginVulnerabilities(apiToken, lookup.slug);
          else result = await getThemeVulnerabilities(apiToken, lookup.slug);

          if (result.remaining !== null && Number.isFinite(result.remaining)) {
            remaining = result.remaining;
          }

          for (const vulnerability of result.vulnerabilities || []) {
            findings.push(
              buildFinding({
                kind: lookup.kind,
                slug: lookup.slug || 'wordpress-core',
                name: lookup.kind === 'core' ? 'WordPress core' : lookup.slug,
                installedVersion: lookup.version,
                vulnerability,
              })
            );
          }
        } catch (error) {
          if (error.code === 'WPSCAN_RATE_LIMITED') {
            vulnDbStatus = 'rate_limited';
            warnings.push(error.message);
            break;
          }
          if (error.code === 'WPSCAN_UNAUTHORIZED') {
            vulnDbStatus = 'unauthorized';
            warnings.push(error.message);
            break;
          }
          warnings.push(
            `${lookup.slug || 'WordPress core'}: ${error.message || 'vulnerability lookup failed'}`
          );
        }
      }
    }

    const reportable = sortFindings(filterReportable(findings));
    const counts = countBySeverity(reportable);

    const scanId = await saveScan({
      userId,
      projectId: body.projectId,
      targetUrl,
      isWordPress: true,
      confidence: fingerprint.confidence,
      coreVersion: fingerprint.coreVersion.version,
      coreVersionSource: fingerprint.coreVersion.source,
      pluginsFound: fingerprint.plugins.length,
      themesFound: fingerprint.themes.length,
      counts,
      fingerprint: {
        signals: fingerprint.signals,
        plugins: fingerprint.plugins,
        themes: fingerprint.themes,
      },
      vulnDbStatus,
      vulnDbRemaining: remaining,
      warnings,
      durationMs: Date.now() - startedAt,
      findings: reportable,
    });

    return jsonResponse(
      {
        success: true,
        scan: serializeScan(await getScan(userId, scanId)),
        suppressed: findings.length - reportable.length,
        // Echoed so a scan that consumed the last of a quota, or ran against a
        // token that turned out to be rejected, leaves the page's token panel
        // showing the truth without a second request.
        vulnDbConfigured: Boolean(apiToken),
        tokenSource,
      },
      200,
      headers
    );
  } catch (error) {
    return errorResponse(error, headers);
  }
}


