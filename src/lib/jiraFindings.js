import { issueSlug, slugifyIssueTitle } from './auditIssues.js';

/**
 * Turning what a SEOX page already has on screen into the `finding` payload
 * POST /api/jira/issues expects, and matching findings against the links the
 * server returned.
 *
 * Why the client describes the finding at all: SEOX has no server-side table
 * of individual findings. The crawler runs in the browser and a finding is a
 * (slug, url) pair inside the crawl state, so there is no id the server could
 * look up. The server re-derives and validates everything it is sent.
 *
 * Matching is done on (module, type, scope) rather than on the fingerprint
 * hash, so no async crypto is needed during render. The server still hashes
 * those same three values, so the two agree; if they ever drifted the visible
 * effect would be a missing badge, never a duplicate issue - the database
 * unique index is what actually prevents those.
 */

/**
 * Mirrors normalizeScopeUrl() in functions/_lib/jira-fingerprint.js: strip
 * the fragment, lowercase the host, drop a trailing slash except on the root.
 * Keep the two in step.
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

/** The client-side match key. */
export function findingKey({ sourceModule = 'auditor', findingType, url, scopeKind = 'url' }) {
  const scope = scopeKind === 'site' ? '__site__' : normalizeScopeUrl(url);
  return `${sourceModule}|${findingType}|${scope}`;
}

/** The same key, derived from a link row the API returned. */
export function linkKey(link) {
  return findingKey({
    sourceModule: link.sourceModule,
    findingType: link.findingType,
    url: link.affectedUrl,
    scopeKind: link.scopeKind,
  });
}

/** Map<key, link> for O(1) badge lookups across a long issues table. */
export function buildLinkIndex(links = []) {
  const index = new Map();
  for (const link of links) {
    if (!link || link.state === 'unlinked') continue;
    index.set(linkKey(link), link);
  }
  return index;
}

/**
 * Build the finding payload for one affected URL of an auditor issue.
 *
 * @param {object} issue  the shape AuditorIssueDetail's buildIssueDetail
 *                        returns: { slug, title, severity, total, urls[] }
 * @param {object} row    one entry from issue.urls
 * @param {object} [context]
 */
export function buildAuditorFinding(issue, row, context = {}) {
  const slug = issueSlug({ slug: issue.slug, title: issue.title }) || slugifyIssueTitle(issue.title);
  const url = normalizeScopeUrl(row?.url || '');

  return {
    sourceModule: 'auditor',
    findingType: slug,
    title: issue.title || slug,
    severity: issue.severity || 'warning',
    scope: { kind: 'url', url },
    url,
    affectedUrlCount: Number(issue.total || 1),
    description: issue.description || '',
    currentValue: describeCurrentValue(slug, row),
    expectedValue: EXPECTED_VALUES[slug] || '',
    evidence: buildEvidence(row),
    crawl: { crawledAt: context.crawledAt || '' },
    seoxPath: `/auditor/issues/${slug}`,
  };
}

/** What the crawl actually found, phrased for the developer reading the ticket. */
function describeCurrentValue(slug, row) {
  if (!row) return '';
  if (slug.includes('title')) {
    if (row.titleTagStatus) return `Title tag: ${row.titleTagStatus}`;
    if (row.titleTag) return `"${row.titleTag}" (${row.titleLength || row.titleTag.length} characters)`;
  }
  if (slug === 'missing-alt-text' && row.missingAltImageCount) {
    return `${row.missingAltImageCount} image(s) without alt text`;
  }
  if (typeof row.status === 'number' && row.status) return `HTTP ${row.status}`;
  return '';
}

const EXPECTED_VALUES = {
  'title-tag-missing-or-empty': 'A unique title tag of 15-70 characters',
  'title-too-short': 'A title tag of at least 15 characters',
  'title-too-long': 'A title tag of at most 70 characters',
  'multiple-title-tags': 'Exactly one title tag',
  'meta-description-missing': 'A unique meta description of roughly 70-158 characters',
  'multiple-meta-description-tags': 'Exactly one meta description tag',
  'h1-tag-missing-or-empty': 'One non-empty H1 heading',
  '404-page': 'HTTP 200, or a redirect to the correct replacement page',
  '4xx-page': 'HTTP 200, or a redirect to the correct replacement page',
  '5xx-page': 'HTTP 200',
  'timed-out': 'The page responds within the crawl timeout',
  'redirect-loop': 'The URL resolves to a single final destination',
  'redirect-chain-too-long': 'At most one redirect hop to the destination',
  'missing-alt-text': 'Every content image carries descriptive alt text',
  'noindex-page': 'The page is indexable (no noindex directive)',
  'non-canonical-page-specified-as-canonical-one': 'A self-referencing canonical URL',
};

/** A small, bounded evidence object - the server caps this again. */
function buildEvidence(row) {
  if (!row) return {};
  const evidence = {};
  const copy = [
    'status',
    'indexable',
    'noindex',
    'nofollow',
    'titleTag',
    'titleLength',
    'titleCount',
    'titleTagStatus',
    'missingAltImageCount',
    'headers',
  ];
  for (const key of copy) {
    const value = row[key];
    if (value === undefined || value === null || value === '') continue;
    evidence[key] = value;
  }
  if (Array.isArray(row.robots) && row.robots.length) evidence.robots = row.robots;
  if (Array.isArray(row.linkedImagesWithoutAltAttribute) && row.linkedImagesWithoutAltAttribute.length) {
    evidence.imagesWithoutAlt = row.linkedImagesWithoutAltAttribute.slice(0, 10);
  }
  return evidence;
}

/** Human labels for the SEOX-side state, matching jira-status-map.js. */
export const SEOX_STATE_LABELS = {
  open: 'Open',
  in_progress: 'In progress',
  resolved_pending: 'Awaiting verification',
  verified: 'Verified fixed',
  reopened: 'Reopened - still present',
  wont_fix: "Won't fix",
  unlinked: 'Not linked',
};

/** Tailwind classes per state, using the palette the auditor already uses. */
export const SEOX_STATE_TONE = {
  open: 'border-white/15 bg-white/[0.06] text-white/70',
  in_progress: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
  resolved_pending: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
  verified: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
  reopened: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
  wont_fix: 'border-white/10 bg-white/[0.04] text-white/40',
  unlinked: 'border-white/10 bg-white/[0.04] text-white/40',
};
