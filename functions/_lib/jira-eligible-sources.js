// Deriving candidate Jira findings from what SEOX has already stored.
//
// SEOX has no server-side table of individual SEO findings. The auditor
// crawler runs in the browser (src/context/CrawlContext.jsx), and every other
// module persists ONE JSON result blob per (user, project, tool) in
// `tool_results`, with a few legacy copies under `user_projects.project_data`.
// So a "finding" has to be derived from those blobs, and this module is the
// only place that does it.
//
// Everything here is pure - stored result in, findings out - so the
// extraction rules are unit-testable without a database, which matters
// because a change in here silently changes which findings are offered to
// Jira.
//
// NOTHING BELOW IS INVENTED. Every module key, field name and status value is
// what the stored results actually contain:
//
//   tool_key            issue carrier            values that mean "a problem"
//   -----------------   ----------------------   ---------------------------
//   eeat                sections[].checks[]      status 'fail'
//   robots              checks[]                 status 'fail' | 'notfound'
//   speed               sections[].checks[]      status 'fail'
//                       cwv[]                    good === false
//                       opportunities[]          every entry is an opportunity
//   crawlOptimization   sections[].checks[]      status 'found' (+ priority)
//   semantic            seoAnalysis[]            status 'fail' | 'warning'
//                       performance[]            status 'fail' | 'warning'
//   w3c-validation      messages[]               type 'error' | 'warning'
//   duplicate           duplicatePages[]         real overlap only
//   plagiarism          matches[]                non-empty
//
//   project_data.onPageAnalysis.sections[].checks[]   status 'fail'
//   project_data.auditIssues                          the browser crawl map
//   screaming_frog_url_reports.report_data.findings[] {check, count}
//   wp_security_findings rows                         severity column
//
// Modules deliberately NOT treated as issue sources, and why:
//   dashboardChecks  a meta-tool; its 'error'/'skipped' entries report that a
//                    check could not RUN (no GSC token, site unreachable).
//                    That is an operational problem, not an SEO defect, and
//                    filing it in Jira would be noise.
//   sitemap          an inventory of URLs, with no pass/fail verdict.
//   llmsTxt          a generator's output.
//   backlinks        stores the uploaded CSV plus filter settings; the audit
//                    verdicts are computed in the browser and not persisted.
//   aiModelChecker   crawler-reachability probes, not site defects.
//   aiCompatibility  per-model advisory scores with no stable check identity.
//   gsc / bing       metric time series; no per-finding records are stored.
// If any of these later persists real verdicts, add it here - do not guess.

import { normalizeSeverity } from './jira-status-map.js';
import { normalizeFindingType } from './jira-fingerprint.js';

/** Per source, so one pathological blob cannot dominate a response. */
const MAX_FINDINGS_PER_SOURCE = 500;

function text(value, max = 2000) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return '';
  return String(value).trim().slice(0, max);
}

function slug(value, max = 80) {
  return normalizeFindingType(String(value || '').slice(0, max));
}

/**
 * A check name alone is not unique across a module (two sections can both
 * carry "Meta Description"), so the section id - a code-level constant, not
 * user data - is folded in. Stable ids matter: the finding type is part of
 * the fingerprint, and a fingerprint change orphans an existing Jira link.
 */
function checkType(sectionId, name) {
  const base = sectionId ? `${sectionId}-${name}` : name;
  return slug(base, 120);
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

/** Every module stores its own "when did this run" field. */
function resultTimestamp(result) {
  return (
    text(result?.scannedAt, 40) ||
    text(result?.generatedAt, 40) ||
    text(result?.analyzedAt, 40) ||
    text(result?.updatedAt, 40) ||
    ''
  );
}

function compact(object) {
  const out = {};
  for (const [key, value] of Object.entries(object)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out;
}

// --- the shared sections[].checks[] shape ----------------------------------

const CHECK_SOURCES = {
  eeat: {
    module: 'eeat',
    category: 'E-E-A-T',
    label: 'E-E-A-T Audit',
    seoxPath: '/tech-seo/eeat',
    failing: new Set(['fail']),
    severity: () => 'warning',
  },
  robots: {
    module: 'robots',
    category: 'Robots.txt',
    label: 'Robots.txt Analyzer',
    seoxPath: '/tech-seo/robots',
    // 'notfound' is this module's way of saying the directive is absent,
    // which is exactly the thing to fix.
    failing: new Set(['fail', 'notfound']),
    severity: () => 'warning',
  },
  speed: {
    module: 'speed',
    category: 'Performance',
    label: 'Speed Optimization',
    seoxPath: '/tech-seo/speed',
    failing: new Set(['fail']),
    severity: () => 'warning',
  },
  crawlOptimization: {
    // Collapses onto 'auditor' exactly as jira-fingerprint.js aliases the
    // crawl modules: the same defect must map to ONE Jira issue.
    module: 'auditor',
    category: 'Crawl Optimization',
    label: 'Crawl Optimization',
    seoxPath: '/tech-seo/crawl',
    failing: new Set(['found', 'fail']),
    // This module is the only one that stores its own priority (HIGH/MEDIUM/
    // LOW), so use it rather than a flat default.
    severity: (check) => check?.priority || 'warning',
  },
  onPageAnalysis: {
    module: 'auditor',
    category: 'On-Page',
    label: 'On-Page Analyzer',
    seoxPath: '/on-page/analyzer',
    failing: new Set(['fail']),
    severity: () => 'warning',
  },
};

/**
 * Walk `checks[]` and `sections[].checks[]` for the modules that share that
 * shape.
 */
function extractChecks(toolKey, result, config) {
  const findings = [];
  const pageUrl = text(result?.url, 2048);
  const detectedAt = resultTimestamp(result);

  const consume = (section, check) => {
    if (findings.length >= MAX_FINDINGS_PER_SOURCE) return;
    const status = String(check?.status || '').trim().toLowerCase();
    if (!config.failing.has(status)) return;

    const name = text(check?.name, 300);
    if (!name) return; // no stable identity -> cannot be fingerprinted

    const type = checkType(section?.id, name);
    if (!type) return;

    // `badge` (eeat/robots) and `detail` (crawlOptimization/onPage) are the
    // same slot: what the module actually observed.
    const observed = text(check?.badge, 500) || text(check?.detail, 500);
    const affected = Number(check?.affected);

    findings.push({
      sourceModule: config.module,
      findingType: type,
      title: name,
      category: config.category,
      sourceLabel: config.label,
      severity: normalizeSeverity(config.severity(check)),
      description: text(check?.desc),
      recommendation: text(check?.desc),
      currentValue: observed,
      expectedValue: '',
      affectedElement: text(section?.title, 200),
      url: pageUrl,
      scopeKind: pageUrl ? 'url' : 'site',
      detectedAt,
      seoxPath: config.seoxPath,
      evidence: compact({
        toolKey,
        section: text(section?.id, 60),
        status,
        priority: text(check?.priority, 20),
        // speed records how many resources a failing audit covers.
        affected: Number.isFinite(affected) && affected > 0 ? affected : undefined,
      }),
    });
  };

  for (const check of arr(result?.checks)) consume(null, check);
  for (const section of arr(result?.sections)) {
    for (const check of arr(section?.checks)) consume(section, check);
  }

  return findings;
}

// --- modules with their own shape -----------------------------------------

/**
 * Speed stores three different carriers. The section checks come from the
 * generic walker; these are the other two.
 *
 * A failing Core Web Vital is rated 'error' rather than 'warning': the module
 * has explicitly judged it (`good: false`) and these are the measurements
 * Google ranks on, so they should sort above an optimisation hint.
 */
function extractSpeedMetrics(result) {
  const findings = [];
  const pageUrl = text(result?.url, 2048);
  const detectedAt = resultTimestamp(result);

  for (const metric of arr(result?.cwv)) {
    if (metric?.good !== false) continue;
    const key = text(metric?.metric, 40) || text(metric?.full, 80);
    if (!key) continue;
    const label = text(metric?.full, 120) || key;
    findings.push({
      sourceModule: 'speed',
      findingType: slug(`core-web-vitals-${key}`),
      title: `Core Web Vital below threshold: ${label}`,
      category: 'Core Web Vitals',
      sourceLabel: 'Speed Optimization',
      severity: 'error',
      description: `${label} is outside Google's "good" threshold.`,
      recommendation: `Bring ${label} into the "good" range.`,
      currentValue: text(metric?.value, 60),
      expectedValue: 'Within Google’s "good" Core Web Vitals threshold',
      affectedElement: key,
      url: pageUrl,
      scopeKind: pageUrl ? 'url' : 'site',
      detectedAt,
      seoxPath: '/tech-seo/speed',
      evidence: compact({ toolKey: 'speed', metric: key, value: text(metric?.value, 60) }),
    });
  }

  for (const opportunity of arr(result?.opportunities)) {
    const name = text(opportunity?.name, 300);
    if (!name) continue;
    findings.push({
      sourceModule: 'speed',
      findingType: slug(`speed-opportunity-${name}`),
      title: name,
      category: 'Performance',
      sourceLabel: 'Speed Optimization',
      severity: 'notice',
      description: 'PageSpeed Insights reported this as a load-time opportunity.',
      recommendation: name,
      currentValue: text(opportunity?.savings, 120),
      expectedValue: '',
      affectedElement: '',
      url: pageUrl,
      scopeKind: pageUrl ? 'url' : 'site',
      detectedAt,
      seoxPath: '/tech-seo/speed',
      evidence: compact({ toolKey: 'speed', savings: text(opportunity?.savings, 120) }),
    });
  }

  return findings.slice(0, MAX_FINDINGS_PER_SOURCE);
}

/** semantic stores verdicts in `seoAnalysis[]` and `performance[]`. */
function extractSemantic(result) {
  const findings = [];
  const pageUrl = text(result?.url, 2048);
  const detectedAt = resultTimestamp(result);

  const consume = (entry, { labelField, prefix, category }) => {
    const status = String(entry?.status || '').trim().toLowerCase();
    if (status !== 'fail' && status !== 'warning') return;
    const label = text(entry?.[labelField], 300);
    if (!label) return;
    findings.push({
      sourceModule: 'semantic',
      findingType: slug(`${prefix}-${label}`, 150),
      title: label,
      category,
      sourceLabel: 'Semantic Audit',
      // 'warning' here is this module's softer verdict, so it maps to the
      // auditor's lowest band rather than to a warning.
      severity: status === 'fail' ? 'warning' : 'notice',
      description: text(entry?.explanation) || text(entry?.note),
      recommendation: text(entry?.note) || text(entry?.explanation),
      currentValue: text(entry?.value, 500),
      expectedValue: '',
      affectedElement: label,
      url: pageUrl,
      scopeKind: pageUrl ? 'url' : 'site',
      detectedAt,
      seoxPath: '/tech-seo/semantic',
      evidence: compact({ toolKey: 'semantic', status, value: text(entry?.value, 200) }),
    });
  };

  for (const entry of arr(result?.seoAnalysis)) {
    consume(entry, { labelField: 'criterion', prefix: 'semantic', category: 'Content' });
  }
  for (const entry of arr(result?.performance)) {
    consume(entry, { labelField: 'metric', prefix: 'semantic-performance', category: 'Performance' });
  }

  return findings.slice(0, MAX_FINDINGS_PER_SOURCE);
}

/**
 * The W3C validator returns one message per occurrence - 308 of them in the
 * stored data - and one Jira issue per occurrence would be unusable. Messages
 * are therefore grouped by (type, message), which is the unit a developer
 * actually fixes, and the occurrence count and first line numbers ride along
 * as evidence.
 */
function extractW3c(result) {
  const pageUrl = text(result?.url, 2048);
  const detectedAt = resultTimestamp(result);
  const groups = new Map();

  for (const message of arr(result?.messages)) {
    const type = String(message?.type || '').trim().toLowerCase();
    // 'info' is the validator being chatty, not a defect.
    if (type !== 'error' && type !== 'warning') continue;
    const body = text(message?.message, 500);
    if (!body) continue;

    const key = `${type}|${body}`;
    let group = groups.get(key);
    if (!group) {
      if (groups.size >= MAX_FINDINGS_PER_SOURCE) continue;
      group = { type, body, count: 0, lines: [], sample: text(message?.extract, 300) };
      groups.set(key, group);
    }
    group.count += 1;
    const line = Number(message?.line);
    if (group.lines.length < 10 && Number.isFinite(line)) group.lines.push(line);
  }

  return [...groups.values()].map((group) => ({
    sourceModule: 'w3c',
    findingType: slug(`w3c-${group.type}-${group.body}`, 160),
    title: `W3C ${group.type}: ${group.body.slice(0, 200)}`,
    category: 'HTML Validation',
    sourceLabel: 'W3C Validator',
    severity: group.type === 'error' ? 'error' : 'warning',
    description: group.body,
    recommendation: 'Correct the markup so the W3C validator no longer reports it.',
    currentValue: group.count > 1 ? `${group.count} occurrences` : '1 occurrence',
    expectedValue: 'Valid HTML with no validator errors',
    affectedElement: group.sample,
    url: pageUrl,
    scopeKind: pageUrl ? 'url' : 'site',
    detectedAt,
    seoxPath: '/tech-seo/w3c',
    evidence: compact({
      toolKey: 'w3c-validation',
      type: group.type,
      occurrences: group.count,
      lines: group.lines.length ? group.lines : undefined,
      extract: group.sample,
    }),
  }));
}

/**
 * Only pages with measured overlap become findings.
 *
 * The stored results carry a `duplicatePages` array that also lists pages
 * with `duplicateWords: 0` and no `matches` - the module's own summary
 * reports `duplicatePercent: 0` for those. Emitting one finding per entry
 * would manufacture dozens of defects the module itself does not claim, so a
 * page must show real overlap to qualify.
 */
function extractDuplicate(result) {
  const detectedAt = resultTimestamp(result);
  const findings = [];

  for (const page of arr(result?.duplicatePages)) {
    if (findings.length >= MAX_FINDINGS_PER_SOURCE) break;
    const pageUrl = text(page?.url, 2048);
    if (!pageUrl) continue;

    const duplicateWords = Number(page?.duplicateWords || 0);
    const matches = arr(page?.matches).length;
    if (duplicateWords <= 0 && matches <= 0) continue;

    findings.push({
      sourceModule: 'duplicate',
      findingType: 'duplicate-content',
      title: 'Duplicate content detected',
      category: 'Content',
      sourceLabel: 'Duplicate Checker',
      severity: 'warning',
      description: 'This page repeats content found on other crawled pages.',
      recommendation:
        'Rewrite or consolidate the duplicated passages, or set a canonical URL to the preferred page.',
      currentValue: `${Number(page?.matchPercent || 0)}% matching text across ${Number(page?.matchPages || matches)} page(s)`,
      expectedValue: 'Substantially unique page content',
      affectedElement: text(page?.title, 300),
      url: pageUrl,
      scopeKind: 'url',
      detectedAt,
      seoxPath: '/tech-seo/duplicate',
      evidence: compact({
        toolKey: 'duplicate',
        matchPercent: Number(page?.matchPercent || 0),
        duplicateWords,
        matchPages: Number(page?.matchPages || 0),
        wordCount: Number(page?.wordCount || 0),
      }),
    });
  }

  return findings;
}

/** Plagiarism is only a finding when external matches were actually found. */
function extractPlagiarism(result) {
  const matches = arr(result?.matches);
  if (!matches.length) return [];
  const pageUrl = text(result?.sourceUrl, 2048);

  return [
    {
      sourceModule: 'duplicate',
      findingType: 'external-duplicate-content',
      title: 'Content matches other sites',
      category: 'Content',
      sourceLabel: 'Plagiarism Checker',
      severity: 'warning',
      description: `${matches.length} passage(s) of this page were found on other websites.`,
      recommendation: 'Rewrite the matching passages so the page offers original content.',
      currentValue: `${Number(result?.uniqueScore || 0)}% unique, ${Number(result?.phrasesWithMatches || matches.length)} matching phrase(s)`,
      expectedValue: 'Original content not duplicated from other sites',
      affectedElement: text(result?.sourceTitle, 300),
      url: pageUrl,
      scopeKind: pageUrl ? 'url' : 'site',
      detectedAt: resultTimestamp(result),
      seoxPath: '/tech-seo/plagiarism',
      evidence: compact({
        toolKey: 'plagiarism',
        uniqueScore: Number(result?.uniqueScore || 0),
        totalPhrases: Number(result?.totalPhrases || 0),
        phrasesWithMatches: Number(result?.phrasesWithMatches || 0),
      }),
    },
  ];
}

const SPECIAL_SOURCES = {
  semantic: extractSemantic,
  'w3c-validation': extractW3c,
  w3_validation: extractW3c, // the legacy project_data copy
  duplicate: extractDuplicate,
  plagiarism: extractPlagiarism,
};

/**
 * Findings from one `tool_results` row (or one legacy project_data blob).
 * An unknown tool key yields nothing rather than a guess.
 */
export function extractToolFindings(toolKey, result) {
  if (!result || typeof result !== 'object') return [];

  const key = String(toolKey || '').trim();
  const findings = [];

  const checkConfig = CHECK_SOURCES[key];
  if (checkConfig) findings.push(...extractChecks(key, result, checkConfig));
  if (key === 'speed') findings.push(...extractSpeedMetrics(result));

  const special = SPECIAL_SOURCES[key];
  if (special) findings.push(...special(result));

  return findings;
}

/**
 * The browser crawl's issue map, if a crawl has ever been persisted:
 *   auditIssues: { slug: { slug, title, severity, count, urls: [{ url, ... }] } }
 * This is the shape src/lib/auditIssues.js builds. It is read
 * opportunistically because the crawler keeps it in browser memory and only
 * some projects have it saved.
 */
export function extractAuditIssueFindings(auditIssues, { crawledAt = '' } = {}) {
  if (!auditIssues || typeof auditIssues !== 'object' || Array.isArray(auditIssues)) return [];
  const findings = [];

  for (const [key, issue] of Object.entries(auditIssues)) {
    if (findings.length >= MAX_FINDINGS_PER_SOURCE) break;
    if (!issue || typeof issue !== 'object') continue;

    const type = slug(issue.slug || key, 120);
    if (!type) continue;

    const base = {
      sourceModule: 'auditor',
      findingType: type,
      title: text(issue.title, 500) || type,
      category: 'Crawl',
      sourceLabel: 'Site Auditor',
      severity: normalizeSeverity(issue.severity),
      description: text(issue.description),
      recommendation: '',
      expectedValue: '',
      detectedAt: crawledAt,
      seoxPath: `/auditor/issues/${type}`,
    };

    const urls = arr(issue.urls);
    if (!urls.length) {
      findings.push({
        ...base,
        currentValue: '',
        affectedElement: '',
        url: '',
        scopeKind: 'site',
        evidence: compact({ toolKey: 'auditIssues', count: Number(issue.count || 0) }),
      });
      continue;
    }

    for (const row of urls) {
      if (findings.length >= MAX_FINDINGS_PER_SOURCE) break;
      const pageUrl = text(row?.url, 2048);
      if (!pageUrl) continue;
      const status = Number(row?.status);
      findings.push({
        ...base,
        currentValue: Number.isFinite(status) && status ? `HTTP ${status}` : '',
        affectedElement: text(row?.title, 300),
        url: pageUrl,
        scopeKind: 'url',
        evidence: compact({
          toolKey: 'auditIssues',
          status: Number.isFinite(status) && status ? status : undefined,
          indexable: typeof row?.indexable === 'boolean' ? row.indexable : undefined,
          noindex: typeof row?.noindex === 'boolean' ? row.noindex : undefined,
        }),
      });
    }
  }

  return findings;
}

/**
 * Screaming Frog uses its own check ids (functions/api/tech-seo/screaming-frog.js),
 * and the built-in crawl uses the auditor's slugs (src/lib/auditIssues.js).
 * Where the two name the SAME defect they are folded onto the auditor slug,
 * because the module alias alone is not enough: collapsing `screaming-frog`
 * onto `auditor` still leaves two different finding types, two fingerprints
 * and therefore two Jira issues for one problem - exactly what
 * jira-fingerprint.js says must not happen.
 *
 * Only exact equivalents are listed. Threshold checks (title_over_60 vs the
 * auditor's title-too-long at 70 characters) are deliberately NOT aliased:
 * they do not describe the same defect, and pretending otherwise would hide
 * one of them. Unlisted ids keep their Screaming Frog spelling, so they stay
 * traceable to the import they came from.
 */
const SCREAMING_FROG_SLUGS = Object.freeze({
  title_missing: 'title-tag-missing-or-empty',
  title_multiple: 'multiple-title-tags',
  meta_missing: 'meta-description-missing',
  meta_multiple: 'multiple-meta-description-tags',
  h1_missing: 'h1-tag-missing-or-empty',
  images_missing_alt: 'missing-alt-text',
});

/**
 * A Screaming Frog import: report_data is { url, findings: [{ check, count }] }
 * for one URL. The module collapses onto 'auditor' - the same alias
 * jira-fingerprint.js applies - because Screaming Frog and the built-in crawl
 * report the same defects and must not file two Jira issues for one problem.
 */
export function extractScreamingFrogFindings(reportData, { detectedAt = '' } = {}) {
  if (!reportData || typeof reportData !== 'object') return [];
  const pageUrl = text(reportData.url, 2048);
  if (!pageUrl) return [];

  const findings = [];
  for (const entry of arr(reportData.findings)) {
    if (findings.length >= MAX_FINDINGS_PER_SOURCE) break;
    const check = text(entry?.check, 191);
    const type = SCREAMING_FROG_SLUGS[check] || slug(check, 120);
    if (!type) continue;

    const count = Number(entry?.count || 1);
    findings.push({
      sourceModule: 'auditor',
      findingType: type,
      title: check.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      category: 'Crawl',
      sourceLabel: 'Screaming Frog Import',
      severity: 'warning',
      description: `The Screaming Frog import flagged "${check}" on this URL.`,
      recommendation: '',
      currentValue: count > 1 ? `${count} occurrences` : '',
      expectedValue: '',
      affectedElement: '',
      url: pageUrl,
      scopeKind: 'url',
      detectedAt,
      seoxPath: '/tech-seo/screaming-frog',
      evidence: compact({ toolKey: 'screamingFrog', check, count }),
    });
  }
  return findings;
}

/**
 * WordPress security findings are the one genuinely normalised finding table
 * in SEOX (wp_security_findings), so these map across directly. They are
 * site-scoped: a vulnerable plugin is a property of the installation, not of
 * one URL.
 */
export function extractWpSecurityFinding(row, { detectedAt = '' } = {}) {
  if (!row) return null;
  const title = text(row.title, 500);
  if (!title) return null;

  const component = text(row.component_slug, 191) || text(row.component_name, 255);
  const kind = text(row.kind, 24) || 'wordpress';
  const type = slug(`${kind}-${component || title}`, 150);
  if (!type) return null;

  const fixedIn = text(row.fixed_in, 32);
  const installed = text(row.installed_version, 32);

  return {
    sourceModule: 'wpscan',
    findingType: type,
    title,
    category: 'WordPress Security',
    sourceLabel: 'WordPress Security',
    severity: normalizeSeverity(row.severity),
    description: text(row.detail),
    recommendation: fixedIn
      ? `Update ${component || 'the affected component'} to ${fixedIn} or later.`
      : 'Apply the vendor fix or remove the affected component.',
    currentValue: installed ? `${component || 'component'} ${installed}` : component,
    expectedValue: fixedIn ? `${component || 'component'} ${fixedIn}` : '',
    affectedElement: component,
    url: '',
    scopeKind: 'site',
    detectedAt,
    seoxPath: '/tech-seo/wordpress-security',
    evidence: compact({
      toolKey: 'wpscan',
      kind,
      cve: text(row.cve, 120),
      cvssScore:
        row.cvss_score === null || row.cvss_score === undefined ? undefined : Number(row.cvss_score),
      confirmed: row.confirmed ? true : undefined,
      installedVersion: installed,
      fixedIn,
    }),
  };
}

/** The tool keys this module knows how to read, for documentation and tests. */
export const SUPPORTED_TOOL_KEYS = Object.freeze([
  ...Object.keys(CHECK_SOURCES),
  ...Object.keys(SPECIAL_SOURCES),
]);
