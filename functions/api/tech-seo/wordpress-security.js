// GET  /api/tech-seo/wordpress-security?projectId=[&scanId=][&history=1]
// POST /api/tech-seo/wordpress-security  { action: 'scan', projectId }
//
// WordPress security audit for a site the user owns.
//
// Two controls define the scope of this endpoint:
//
//   1. The target must be the domain of one of the caller's own projects. SEOX
//      will not scan an arbitrary URL on request, which is what separates a
//      site auditor from a scanning service.
//
//   2. Detection is passive (wpscan-detect.js). Component discovery reads the
//      site's own asset URLs; it does not bruteforce plugin slugs, enumerate
//      users, or attempt any authentication.
//
// Vulnerability data comes from the WPScan API. Its CLI is Ruby and cannot run
// on Pages Functions, so only the database half is used.

import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { getStoredDocument, verifyAccessToken } from '../../_lib/mysql-storage.js';
import { consumeRateLimit } from '../../_lib/rate-limit.js';
import { configureMysqlConnection } from '../../_lib/mysql.js';
import { parsePublicHttpUrl } from '../../_lib/url-security.js';
import { fingerprintSite } from '../../_lib/wpscan-detect.js';
import {
  getCoreVulnerabilities,
  getPluginVulnerabilities,
  getThemeVulnerabilities,
  hasApiToken,
} from '../../_lib/wpscan-api.js';
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

/**
 * Resolve the URL to scan from the caller's own project, and refuse anything
 * else. A caller-supplied URL is only accepted when it is on the project's own
 * host, so this endpoint cannot be pointed at a third party.
 */
async function resolveTarget(env, userId, projectId, requestedUrl) {
  if (!projectId) fail('A project must be selected.', 400);

  const project = await getStoredDocument(env, `users/${userId}/projects`, projectId);
  if (!project) fail('Project was not found.', 404);

  const projectUrl = project.fullUrl || project.full_url || project.domain;
  if (!projectUrl) {
    fail('This project has no website URL, so there is nothing to scan.', 400);
  }

  const base = parsePublicHttpUrl(
    String(projectUrl).startsWith('http') ? projectUrl : `https://${projectUrl}`,
    'Project URL'
  );

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

      return jsonResponse(
        {
          scan: serializeScan(scan),
          vulnDbConfigured: hasApiToken(env),
          needsFirstScan: !scan,
        },
        200,
        headers
      );
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, headers);
    }

    const body = await readJson(request);
    if (body.action !== 'scan') return jsonResponse({ error: 'Invalid action' }, 400, headers);
    // One scan can spend a dozen of the 25 daily WPScan requests the whole
    // install shares.
    await consumeRateLimit(userId, 'wpscan:scan');

    const targetUrl = await resolveTarget(env, userId, body.projectId, body.targetUrl);
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

    if (!hasApiToken(env)) {
      warnings.push(
        'No WPScan API token is configured, so components were listed but not checked against the vulnerability database.'
      );
      vulnDbStatus = 'not_configured';
    } else {
      vulnDbStatus = 'ok';

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
          if (lookup.kind === 'core') result = await getCoreVulnerabilities(env, lookup.version);
          else if (lookup.kind === 'plugin') result = await getPluginVulnerabilities(env, lookup.slug);
          else result = await getThemeVulnerabilities(env, lookup.slug);

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
      },
      200,
      headers
    );
  } catch (error) {
    return errorResponse(error, headers);
  }
}


