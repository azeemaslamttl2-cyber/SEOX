// The stable identity of an SEO finding, used to guarantee that one finding
// produces at most one Jira issue.
//
// Why a fingerprint and not the Jira issue title
// ----------------------------------------------
// SEOX has no server-side table of individual findings: the crawler runs in
// the browser (src/context/CrawlContext.jsx) and a finding is a (slug, url)
// pair inside the stats blob it produces. So there is no finding id the
// server can trust, and the Jira summary is no use either - users edit it,
// AI rewrites it, and it gets truncated.
//
// Instead the server derives a hash from four values it can recompute at any
// time, and a UNIQUE index on (user_id, fingerprint) in jira_issue_links is
// what actually enforces uniqueness. Two concurrent "Create Jira Issue"
// clicks race to INSERT; one wins, the other gets ER_DUP_ENTRY and is served
// the winner's row.
//
// Everything in this module is pure, so it is directly unit-testable - which
// matters, because a change in here silently breaks deduplication for every
// finding already linked.

import { createHash } from 'node:crypto';

// The same delimiter the MySQL pool uses for its connection key
// (functions/_lib/mysql.js). It cannot occur in a URL, a slug or a project id,
// so the concatenation is unambiguous.
const SEPARATOR = '';

export const SITE_SCOPE = '__site__';
export const BATCH_SCOPE_PREFIX = '__batch__';

/**
 * Modules that produce findings. `onpage` and `screaming-frog` deliberately
 * collapse onto `auditor`: all three can report "missing meta description on
 * /x", and they must map to ONE Jira issue rather than three.
 */
const MODULE_ALIASES = {
  onpage: 'auditor',
  'on-page': 'auditor',
  'screaming-frog': 'auditor',
  screamingfrog: 'auditor',
  crawl: 'auditor',
};

export const KNOWN_MODULES = new Set([
  'auditor',
  'speed',
  'wpscan',
  'robots',
  'schema',
  'w3c',
  'gsc',
  'gbp',
  'eeat',
  'semantic',
  'duplicate',
  'backlinks',
  'keywords',
]);

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function normalizeModule(value) {
  const raw = String(value || '').trim().toLowerCase();
  const mapped = MODULE_ALIASES[raw] || raw;
  return KNOWN_MODULES.has(mapped) ? mapped : 'auditor';
}

/**
 * The finding type, in the same vocabulary the auditor already uses for its
 * URLs (/auditor/issues/:slug). Kept to the slug character set so it is safe
 * as an index key and inside a Jira label.
 */
export function normalizeFindingType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 191);
}

/**
 * URL normalisation for scope keys.
 *
 * Mirrors normalizeEvidenceUrl() in src/lib/auditIssues.js - strip the
 * fragment and any trailing slash except on the root - and additionally
 * lowercases the host, because the client and the server must agree
 * byte-for-byte or the fingerprints diverge and duplicates appear.
 */
export function normalizeScopeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return raw;
  }
}

/**
 * Build the scope portion of the fingerprint.
 *
 *   { kind: 'url',   url }    one affected URL
 *   { kind: 'site' }          the whole site (robots.txt, a sitemap problem)
 *   { kind: 'batch', urls }   one issue covering many URLs; a different set
 *                             of URLs is a different issue, so the hash is
 *                             over the sorted, normalised list
 */
export function buildScopeKey(scope = {}) {
  const kind = String(scope.kind || 'url').toLowerCase();

  if (kind === 'site') return SITE_SCOPE;

  if (kind === 'batch') {
    const urls = Array.isArray(scope.urls) ? scope.urls : [];
    const normalized = [...new Set(urls.map(normalizeScopeUrl).filter(Boolean))].sort();
    if (!normalized.length) return SITE_SCOPE;
    return `${BATCH_SCOPE_PREFIX}${sha256(normalized.join('\n'))}`;
  }

  const url = normalizeScopeUrl(scope.url);
  if (!url) {
    const error = new Error('A finding scope must carry a URL, or be site-wide.');
    error.status = 400;
    throw error;
  }
  return url;
}

/**
 * The fingerprint itself.
 *
 * @param {object} input
 * @param {string} input.projectId     user_projects.project_id (varchar)
 * @param {string} input.sourceModule  see KNOWN_MODULES
 * @param {string} input.findingType   the issue slug
 * @param {object} input.scope         see buildScopeKey
 * @returns {{fingerprint: string, scopeKey: string, scopeKind: string,
 *            sourceModule: string, findingType: string}}
 */
export function buildFingerprint({ projectId, sourceModule, findingType, scope } = {}) {
  const project = String(projectId || '').trim();
  if (!project) {
    const error = new Error('A project is required to identify a finding.');
    error.status = 400;
    throw error;
  }

  const module = normalizeModule(sourceModule);
  const type = normalizeFindingType(findingType);
  if (!type) {
    const error = new Error('A finding type is required.');
    error.status = 400;
    throw error;
  }

  const scopeKey = buildScopeKey(scope);
  const scopeKind = scopeKey === SITE_SCOPE
    ? 'site'
    : scopeKey.startsWith(BATCH_SCOPE_PREFIX)
      ? 'batch'
      : 'url';

  return {
    fingerprint: sha256([project, module, type, scopeKey].join(SEPARATOR)),
    scopeKey,
    scopeKind,
    sourceModule: module,
    findingType: type,
  };
}

/** scope_key can be a 2048-character URL, which is too long to index directly. */
export function hashScopeKey(scopeKey) {
  return sha256(String(scopeKey || ''));
}
