// Read-only assembly of every SEO finding that could become a Jira issue.
//
// The shape of the problem: SEOX stores findings as a handful of JSON result
// blobs per project (see jira-eligible-sources.js), and stores Jira links in
// `jira_issue_links`. This module joins the two and groups the result by
// project.
//
// THE QUERY BUDGET IS FIXED. Whether the request covers one project or two
// hundred, this module issues the same small number of statements - every
// lookup is a single batched query keyed on the whole project set, and the
// grouping happens in memory:
//
//   1  users                        (admin_token -> admin)
//   2  user_projects                (all | by project_id | by domain)
//   3  tool_results                 for every project at once
//   4  screaming_frog_url_reports   for every project at once
//   5  wp_security_scans            for every project at once
//   6  wp_security_findings         for the latest scan of each project
//   7  jira_issue_links             for every project at once
//   8  jira_connections             for every project at once
//   9  jira_project_mappings        for every project at once
//
// There is no per-project or per-issue query anywhere, and NO call to Jira:
// the Jira state served here is the state SEOX already stores, kept current
// by the webhook and the reconcile sweep. That is what keeps this endpoint
// fast and keeps it working while Jira is down.

import { query, queryOne } from './mysql.js';
import { buildFingerprint } from './jira-fingerprint.js';
import { normalizeSeverity, toIso } from './jira-status-map.js';
import { normalizeProjectDomain } from '../_handlers/project-details.js';
import {
  extractAuditIssueFindings,
  extractScreamingFrogFindings,
  extractToolFindings,
  extractWpSecurityFinding,
} from './jira-eligible-sources.js';

const MAX_TOKEN_LENGTH = 512;
const MAX_PROJECT_ID_LENGTH = 255;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
/** A ceiling on in-memory findings, so one enormous account cannot OOM Node. */
const MAX_TOTAL_FINDINGS = 50000;

const SEVERITY_RANK = { error: 0, warning: 1, notice: 2 };

export function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * The Jira tables are created by migration.txt, which an operator runs by
 * hand. If they are absent the endpoint still answers - every finding simply
 * reports as not linked - rather than failing the whole request.
 */
async function tolerant(run, fallback) {
  try {
    return await run();
  } catch (error) {
    if (isMissingTable(error)) return fallback;
    throw error;
  }
}

function isMissingTable(error) {
  return error?.code === 'ER_NO_SUCH_TABLE' || /doesn't exist/i.test(error?.message || '');
}

function parseJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function boolFilter(value) {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(raw)) return true;
  if (['false', '0', 'no'].includes(raw)) return false;
  return null;
}

// --- input -----------------------------------------------------------------

/**
 * A query string only ever yields strings, but a JSON body carries real
 * numbers and booleans ({"limit": 100}), so scalars are coerced rather than
 * ignored - otherwise a POSTed limit would silently fall back to the default.
 */
function pickScalar(params, key) {
  const value = params?.[key];
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return String(value);
  return '';
}

/**
 * The admin_token field, validated. Shared with the status-update endpoint so
 * both report a missing and an over-long token identically - a caller should
 * not be able to tell which Jira endpoint it hit from the auth error.
 */
export function readAdminToken(params = {}) {
  const adminToken = pickScalar(params, 'admin_token');
  if (!adminToken) throw httpError('admin_token is required', 400);
  if (adminToken.length > MAX_TOKEN_LENGTH) throw httpError('Invalid admin_token', 401);
  return adminToken;
}

/**
 * Validate and normalise the request parameters - the POST JSON body, or the
 * GET query string. Pure, so the precedence rules below are testable without
 * a database.
 */
export function parseEligibleQuery(params = {}) {
  const pick = (key) => pickScalar(params, key);

  const adminToken = readAdminToken(params);

  const projectId = pick('project_id');
  if (projectId.length > MAX_PROJECT_ID_LENGTH) throw httpError('project_id is too long', 400);

  const url = pick('url');
  const domain = url ? normalizeProjectDomain(url) : '';
  if (url && !domain) throw httpError('url is invalid', 400);

  const rawLimit = Number(pick('limit'));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_LIMIT) : DEFAULT_LIMIT;
  const rawPage = Number(pick('page'));
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  return {
    adminToken,
    projectId,
    url,
    domain,
    page,
    limit,
    filters: {
      issueType: pick('issue_type').toLowerCase(),
      severity: pick('severity') ? normalizeSeverity(pick('severity')) : '',
      status: pick('status').toLowerCase(),
      jiraCreated: boolFilter(params.jira_created),
      jiraEligible: boolFilter(params.jira_eligible),
    },
  };
}

/**
 * admin_token only, against `users.admin_token` - the same statement
 * _handlers/project-details.js uses. No session, cookie or OAuth fallback.
 *
 * Exported so the status-update endpoint authenticates through this exact
 * function rather than its own copy. Two implementations of "who is this"
 * drift, and the one that drifts is the one that gets it wrong.
 */
export async function authenticateAdmin(adminToken) {
  const admin = await queryOne(
    `SELECT id
       FROM users
      WHERE admin_token = ?
        AND is_active = 1
        AND deleted_at IS NULL
      LIMIT 1`,
    [adminToken]
  );
  if (!admin) throw httpError('Invalid admin_token', 401);
  return admin;
}

/**
 * Resolve which projects the request covers.
 *
 * project_id and url together are VALIDATED, not silently reconciled: if they
 * name different projects the request is rejected. Quietly preferring one
 * would hand the caller another project's issues under the identifier it did
 * not choose, and a Jira ticket filed against the wrong site is expensive to
 * undo.
 */
async function resolveProjects(adminId, { projectId, url, domain }) {
  const columns = `id, user_id, project_id, project_name, domain, full_url,
                   total_urls, crawled_on, project_data, created_at, updated_at`;

  if (projectId) {
    const project = await queryOne(
      `SELECT ${columns} FROM user_projects WHERE user_id = ? AND project_id = ? LIMIT 1`,
      [adminId, projectId]
    );
    if (!project) throw httpError('Project not found', 404);

    if (domain && normalizeProjectDomain(project.full_url) !== domain) {
      throw httpError('project_id and url refer to different projects', 400);
    }
    return [project];
  }

  if (domain) {
    const project = await queryOne(
      `SELECT ${columns} FROM user_projects WHERE user_id = ? AND domain = ? LIMIT 1`,
      [adminId, domain]
    );
    if (!project) throw httpError('Project not found for the specified URL', 404);
    return [project];
  }

  // Deliberately unsorted in SQL. These rows carry the project_data JSON
  // blob, and MySQL's sort buffer cannot hold it - that is the documented
  // cause of the "Out of sort memory" 500 in SORT_BUFFER_FIX.md. Ordering a
  // handful of project rows in memory costs nothing and cannot blow the
  // buffer.
  const rows = await query(`SELECT ${columns} FROM user_projects WHERE user_id = ?`, [adminId]);
  return rows.sort((a, b) => Number(a.id) - Number(b.id));
}

// --- batched loads ---------------------------------------------------------

function placeholders(count) {
  return Array.from({ length: count }, () => '?').join(', ');
}

/** One query for every project's stored module results. */
async function loadToolResults(adminId, projectIds) {
  if (!projectIds.length) return new Map();
  const rows = await query(
    `SELECT project_id, tool_key, result, created_at, updated_at
       FROM tool_results
      WHERE user_id = ? AND project_id IN (${placeholders(projectIds.length)})`,
    [adminId, ...projectIds]
  );

  const byProject = new Map();
  for (const row of rows) {
    if (!byProject.has(row.project_id)) byProject.set(row.project_id, []);
    byProject.get(row.project_id).push(row);
  }
  return byProject;
}

/**
 * One query for every project's Screaming Frog rows. Only the newest scan per
 * project is used - an older import describes a site that has since changed.
 */
async function loadScreamingFrog(adminId, projectIds) {
  if (!projectIds.length) return new Map();
  const rows = await tolerant(
    () =>
      query(
        `SELECT id, project_id, scan_id, report_data, created_at, updated_at
           FROM screaming_frog_url_reports
          WHERE user_id = ? AND project_id IN (${placeholders(projectIds.length)})`,
        [String(adminId), ...projectIds]
      ),
    []
  );

  // Newest first, in memory: report_data is JSON, so sorting in SQL would hit
  // the same sort-buffer limit as the project query above.
  rows.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
      Number(b.id) - Number(a.id)
  );

  const byProject = new Map();
  const latestScan = new Map();
  for (const row of rows) {
    if (!latestScan.has(row.project_id)) latestScan.set(row.project_id, row.scan_id);
    if (latestScan.get(row.project_id) !== row.scan_id) continue;
    if (!byProject.has(row.project_id)) byProject.set(row.project_id, []);
    byProject.get(row.project_id).push(row);
  }
  return byProject;
}

/** Two queries: the newest scan per project, then that scan's findings. */
async function loadWpSecurity(adminId, projectIds) {
  if (!projectIds.length) return new Map();
  const scans = await tolerant(
    () =>
      query(
        `SELECT id, project_id, created_at
           FROM wp_security_scans
          WHERE user_id = ? AND project_id IN (${placeholders(projectIds.length)})
          ORDER BY created_at DESC, id DESC`,
        [adminId, ...projectIds]
      ),
    []
  );

  const latest = new Map();
  for (const scan of scans) {
    if (!latest.has(scan.project_id)) latest.set(scan.project_id, scan);
  }
  if (!latest.size) return new Map();

  const scanIds = [...latest.values()].map((scan) => scan.id);
  const findings = await tolerant(
    () =>
      query(
        `SELECT scan_id, kind, component_slug, component_name, installed_version,
                fixed_in, severity, confirmed, title, detail, cve, cvss_score
           FROM wp_security_findings
          WHERE scan_id IN (${placeholders(scanIds.length)})`,
        scanIds
      ),
    []
  );

  const byScan = new Map();
  for (const row of findings) {
    if (!byScan.has(row.scan_id)) byScan.set(row.scan_id, []);
    byScan.get(row.scan_id).push(row);
  }

  const byProject = new Map();
  for (const [projectId, scan] of latest) {
    byProject.set(projectId, { scan, findings: byScan.get(scan.id) || [] });
  }
  return byProject;
}

/** One query for every existing Jira link, indexed by fingerprint. */
async function loadJiraLinks(adminId, projectIds) {
  if (!projectIds.length) return new Map();
  const rows = await tolerant(
    () =>
      query(
        `SELECT project_id, fingerprint, state, seox_state, jira_issue_key, jira_issue_url,
                jira_status, jira_status_category, jira_resolution, jira_priority,
                jira_assignee_name, connection_id, last_synced_at, created_at, updated_at
           FROM jira_issue_links
          WHERE user_id = ? AND project_id IN (${placeholders(projectIds.length)})`,
        [adminId, ...projectIds]
      ),
    []
  );

  const byFingerprint = new Map();
  for (const row of rows) byFingerprint.set(row.fingerprint, row);
  return byFingerprint;
}

/** One query each for the project's Jira connection and mapping. */
async function loadJiraProjectState(adminId, projectIds) {
  if (!projectIds.length) return { connections: new Map(), mappings: new Map() };

  const connectionRows = await tolerant(
    () =>
      query(
        `SELECT project_id, base_url, status, status_detail, last_sync_at
           FROM jira_connections
          WHERE user_id = ? AND project_id IN (${placeholders(projectIds.length)})`,
        [adminId, ...projectIds]
      ),
    []
  );
  const mappingRows = await tolerant(
    () =>
      query(
        `SELECT project_id, jira_project_key, jira_project_name, status, status_detail
           FROM jira_project_mappings
          WHERE user_id = ? AND project_id IN (${placeholders(projectIds.length)})`,
        [adminId, ...projectIds]
      ),
    []
  );

  const connections = new Map();
  for (const row of connectionRows) connections.set(row.project_id, row);
  const mappings = new Map();
  for (const row of mappingRows) mappings.set(row.project_id, row);
  return { connections, mappings };
}

// --- eligibility -----------------------------------------------------------

/**
 * Whether a finding may be filed in Jira now, and why.
 *
 * The rules, in order:
 *   1. no link           -> eligible. Nothing has been filed.
 *   2. seox_state wont_fix -> NOT eligible. Someone decided not to fix it;
 *                           re-offering it would re-file what was declined.
 *   3. state unlinked    -> eligible. The link was deliberately removed, so
 *                           the finding is available again.
 *   4. state failed      -> eligible. The create attempt errored; retrying is
 *                           the point.
 *   5. seox_state reopened -> eligible. The fix did not hold and reuse is
 *                           appropriate - this is the "unless reopening" case.
 *   6. state linked/creating -> NOT eligible. An issue already exists, and the
 *                           UNIQUE (user_id, fingerprint) index would reject a
 *                           second one anyway.
 */
export function evaluateEligibility(link) {
  if (!link) return { eligible: true, reason: 'not_linked' };
  if (link.seox_state === 'wont_fix') return { eligible: false, reason: 'marked_wont_fix' };
  if (link.state === 'unlinked') return { eligible: true, reason: 'previously_unlinked' };
  if (link.state === 'failed') return { eligible: true, reason: 'previous_attempt_failed' };
  if (link.seox_state === 'reopened') return { eligible: true, reason: 'reopened_still_present' };
  if (link.state === 'linked' || link.state === 'creating') {
    return { eligible: false, reason: 'already_linked' };
  }
  return { eligible: true, reason: 'not_linked' };
}

function describeJira(link, connection) {
  if (!link || link.state === 'unlinked' || !link.jira_issue_key) {
    return {
      jira_created: false,
      jira_issue_key: null,
      jira_issue_url: null,
      jira_status: null,
      jira_status_category: null,
      jira_resolution: null,
      jira_priority: null,
      jira_assignee: null,
      jira_synced_at: null,
    };
  }

  const baseUrl = connection?.base_url ? String(connection.base_url).replace(/\/+$/, '') : '';
  return {
    jira_created: true,
    jira_issue_key: link.jira_issue_key,
    jira_issue_url: link.jira_issue_url || (baseUrl ? `${baseUrl}/browse/${link.jira_issue_key}` : null),
    jira_status: link.jira_status || null,
    jira_status_category: link.jira_status_category || null,
    jira_resolution: link.jira_resolution || null,
    jira_priority: link.jira_priority || null,
    jira_assignee: link.jira_assignee_name || null,
    jira_synced_at: toIso(link.last_synced_at),
  };
}

// --- finding collection ----------------------------------------------------

/**
 * project_data keys that carry a module result, mapped to the tool key whose
 * extractor understands them. The legacy names are the ones documented in
 * MODULES_DATA_STRUCTURE.md.
 */
const PROJECT_DATA_SOURCES = Object.freeze({
  eeat: 'eeat',
  robots: 'robots',
  speed: 'speed',
  speed_test: 'speed',
  semantic: 'semantic',
  semantic_audit: 'semantic',
  duplicate: 'duplicate',
  plagiarism: 'plagiarism',
  crawlOptimization: 'crawlOptimization',
  crawl_optimization: 'crawlOptimization',
  onPageAnalysis: 'onPageAnalysis',
  'w3c-validation': 'w3c-validation',
  w3_validation: 'w3_validation',
});

/** Everything stored for one project, turned into raw findings. */
function collectProjectFindings(project, { toolRows, sfRows, wpSecurity }) {
  const findings = [];
  const projectData = parseJson(project.project_data, {}) || {};

  for (const row of toolRows) {
    const result = parseJson(row.result, null);
    const extracted = extractToolFindings(row.tool_key, result);
    const detectedAt = toIso(row.created_at);
    const lastDetectedAt = toIso(row.updated_at);
    for (const finding of extracted) {
      findings.push({ ...finding, detectedAt: finding.detectedAt || detectedAt, lastDetectedAt });
    }
  }

  // The copies that live on the project row rather than in tool_results.
  // Some modules only ever wrote here (onPageAnalysis, w3_validation), and
  // the legacy paths in MODULES_DATA_STRUCTURE.md still hold real results for
  // older projects - a project whose speed run predates tool_results would
  // otherwise report no findings at all. Results that appear in both places
  // collapse on the fingerprint, so reading both cannot double-count.
  const projectUpdatedAt = toIso(project.updated_at);
  for (const [key, toolKey] of Object.entries(PROJECT_DATA_SOURCES)) {
    const blob = projectData[key];
    if (!blob || typeof blob !== 'object') continue;
    // module-processor.js seeds these as {} and lets the browser fill them in,
    // so an empty placeholder is normal and simply yields nothing.
    for (const finding of extractToolFindings(toolKey, blob)) {
      findings.push({ ...finding, lastDetectedAt: projectUpdatedAt });
    }
  }

  // The browser crawl's issue map, when a crawl has been persisted.
  const auditIssues = projectData.auditIssues || projectData.auditor?.stats?.auditIssues;
  if (auditIssues) {
    const crawledAt = toIso(project.crawled_on) || projectUpdatedAt;
    for (const finding of extractAuditIssueFindings(auditIssues, { crawledAt })) {
      findings.push({ ...finding, lastDetectedAt: projectUpdatedAt });
    }
  }

  for (const row of sfRows) {
    const detectedAt = toIso(row.created_at);
    const reportData = parseJson(row.report_data, null);
    for (const finding of extractScreamingFrogFindings(reportData, { detectedAt })) {
      findings.push({ ...finding, lastDetectedAt: toIso(row.updated_at) });
    }
  }

  if (wpSecurity) {
    const detectedAt = toIso(wpSecurity.scan?.created_at);
    for (const row of wpSecurity.findings) {
      const finding = extractWpSecurityFinding(row, { detectedAt });
      if (finding) findings.push({ ...finding, lastDetectedAt: detectedAt });
    }
  }

  return findings;
}

/**
 * Attach the fingerprint and the Jira state, and drop anything that cannot be
 * identified. The fingerprint is computed with the SAME function the create
 * path uses, so a caller can POST one of these findings straight to
 * /api/jira/issues and land on the very row reported here.
 */
function describeIssue(project, finding, links, connection) {
  let identity;
  try {
    identity = buildFingerprint({
      projectId: project.project_id,
      sourceModule: finding.sourceModule,
      findingType: finding.findingType,
      scope: finding.scopeKind === 'url' && finding.url
        ? { kind: 'url', url: finding.url }
        : { kind: 'site' },
    });
  } catch {
    // No stable identity means it could never be de-duplicated in Jira, so it
    // is not offered at all rather than offered as a possible duplicate.
    return null;
  }

  const link = links.get(identity.fingerprint) || null;
  const { eligible, reason } = evaluateEligibility(link);
  const severity = normalizeSeverity(finding.severity);

  return {
    issue_id: identity.fingerprint,
    finding_id: `${identity.sourceModule}:${identity.findingType}:${identity.scopeKey}`,
    fingerprint: identity.fingerprint,
    issue_type: identity.findingType,
    category: finding.category,
    title: finding.title,
    description: finding.description || '',
    url: finding.url || null,
    scope_kind: identity.scopeKind,
    severity,
    priority: severity,
    status: link ? link.seox_state : 'open',
    recommendation: finding.recommendation || '',
    suggested_fix: finding.recommendation || '',
    affected_element: finding.affectedElement || '',
    source_module: identity.sourceModule,
    source_label: finding.sourceLabel || '',
    detected_at: finding.detectedAt || null,
    last_detected_at: finding.lastDetectedAt || null,
    current_value: finding.currentValue || '',
    expected_value: finding.expectedValue || '',
    evidence: finding.evidence || {},
    seox_path: finding.seoxPath || '',
    jira_eligible: eligible,
    jira_eligibility_reason: reason,
    ...describeJira(link, connection),
  };
}

function matchesFilters(issue, filters) {
  if (filters.issueType && issue.issue_type !== filters.issueType) return false;
  if (filters.severity && issue.severity !== filters.severity) return false;
  if (filters.status && issue.status !== filters.status) return false;
  if (filters.jiraCreated !== null && issue.jira_created !== filters.jiraCreated) return false;
  if (filters.jiraEligible !== null && issue.jira_eligible !== filters.jiraEligible) return false;
  return true;
}

function sortIssues(issues) {
  return issues.sort(
    (a, b) =>
      (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3) ||
      a.source_module.localeCompare(b.source_module) ||
      a.issue_type.localeCompare(b.issue_type) ||
      String(a.url || '').localeCompare(String(b.url || ''))
  );
}

function describeProject(project, connection, mapping, counts) {
  return {
    project_id: project.project_id,
    project_name: project.project_name,
    project_url: project.full_url,
    domain: project.domain,
    total_urls: Number(project.total_urls || 0),
    last_crawled_on: toIso(project.crawled_on) || null,
    created_at: toIso(project.created_at) || null,
    updated_at: toIso(project.updated_at) || null,
    jira_connected: Boolean(connection && connection.status === 'connected'),
    jira_connection_status: connection?.status || 'not_connected',
    jira_project_key: mapping?.jira_project_key || null,
    jira_project_name: mapping?.jira_project_name || null,
    jira_mapping_status: mapping?.status || 'not_mapped',
    issue_count: counts.total,
    jira_eligible_issue_count: counts.eligible,
    jira_created_issue_count: counts.created,
    returned_issue_count: 0,
    issues: [],
  };
}

// --- entry point -----------------------------------------------------------

/**
 * Build the whole response for one request.
 *
 * @param {object} params  the raw query string, as a plain object
 * @returns {Promise<object>} the JSON payload
 */
export async function getJiraEligibleIssues(params) {
  const input = parseEligibleQuery(params);
  const admin = await authenticateAdmin(input.adminToken);

  const projects = await resolveProjects(admin.id, input);
  const projectIds = projects.map((project) => project.project_id);

  // Everything below is batched across the whole project set - see the query
  // budget at the top of this file.
  const [toolResults, screamingFrog, wpSecurity, links, jiraState] = await Promise.all([
    loadToolResults(admin.id, projectIds),
    loadScreamingFrog(admin.id, projectIds),
    loadWpSecurity(admin.id, projectIds),
    loadJiraLinks(admin.id, projectIds),
    loadJiraProjectState(admin.id, projectIds),
  ]);

  const described = [];
  let truncated = false;
  let totalIssues = 0;
  let totalEligible = 0;
  let totalCreated = 0;

  for (const project of projects) {
    const connection = jiraState.connections.get(project.project_id) || null;
    const mapping = jiraState.mappings.get(project.project_id) || null;

    const raw = truncated
      ? []
      : collectProjectFindings(project, {
          toolRows: toolResults.get(project.project_id) || [],
          sfRows: screamingFrog.get(project.project_id) || [],
          wpSecurity: wpSecurity.get(project.project_id) || null,
        });

    const seen = new Set();
    const issues = [];
    for (const finding of raw) {
      const issue = describeIssue(project, finding, links, connection);
      if (!issue) continue;
      // Two modules can report the same defect on the same URL; the
      // fingerprint is what Jira de-duplicates on, so collapse here too.
      if (seen.has(issue.issue_id)) continue;
      seen.add(issue.issue_id);
      if (!matchesFilters(issue, input.filters)) continue;
      issues.push(issue);
    }

    sortIssues(issues);

    const counts = {
      total: issues.length,
      eligible: issues.filter((issue) => issue.jira_eligible).length,
      created: issues.filter((issue) => issue.jira_created).length,
    };
    totalIssues += counts.total;
    totalEligible += counts.eligible;
    totalCreated += counts.created;
    if (totalIssues >= MAX_TOTAL_FINDINGS) truncated = true;

    described.push({ project: describeProject(project, connection, mapping, counts), issues });
  }

  // Pagination is GLOBAL across the flattened, project-ordered issue list in
  // every mode, so `page`/`limit` mean one thing rather than two. A project
  // whose issues all fall outside the window still appears, with its full
  // counts and an empty `issues` array, so the caller can see it was covered.
  const offset = (input.page - 1) * input.limit;
  const end = offset + input.limit;
  let cursor = 0;

  for (const entry of described) {
    const start = cursor;
    cursor += entry.issues.length;
    if (cursor <= offset || start >= end) {
      entry.project.issues = [];
      entry.project.returned_issue_count = 0;
      continue;
    }
    const slice = entry.issues.slice(Math.max(0, offset - start), Math.max(0, end - start));
    entry.project.issues = slice;
    entry.project.returned_issue_count = slice.length;
  }

  const returned = described.reduce((sum, entry) => sum + entry.project.returned_issue_count, 0);

  return {
    success: true,
    filters: {
      project_id: input.projectId || null,
      url: input.url || null,
      issue_type: input.filters.issueType || null,
      severity: input.filters.severity || null,
      status: input.filters.status || null,
      jira_created: input.filters.jiraCreated,
      jira_eligible: input.filters.jiraEligible,
    },
    pagination: {
      page: input.page,
      limit: input.limit,
      returned_issues: returned,
      total_issues: totalIssues,
      total_pages: Math.max(1, Math.ceil(totalIssues / input.limit)),
      has_more: end < totalIssues,
      scope: 'global',
    },
    total_projects: described.length,
    total_issues: totalIssues,
    total_jira_eligible_issues: totalEligible,
    total_jira_created_issues: totalCreated,
    truncated,
    projects: described.map((entry) => entry.project),
  };
}
