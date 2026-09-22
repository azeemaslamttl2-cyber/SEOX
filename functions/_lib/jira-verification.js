// Deriving the machine-checkable definition of "this finding is fixed".
//
// Why this exists at all
// ----------------------
// The SEOX crawler runs in the BROWSER (src/context/CrawlContext.jsx). When a
// developer moves a ticket to Done at 2am, no browser is open, so the server
// has to be able to re-check the finding on its own. It can only do that if,
// at the moment the Jira issue was created, we wrote down exactly what to
// look for. That record is the verification spec, stored on the link row.
//
// The spec is derived from the finding type by CODE, never by AI: a
// hallucinated check would produce a confident, wrong "verified", which is
// worse than no verification at all.
//
// Kinds are kept deliberately few. A finding with no reliable automatic check
// gets kind 'manual', and the UI says so plainly rather than showing a
// meaningless green tick.

export const VERIFICATION_KINDS = Object.freeze({
  HTTP_STATUS: 'http_status',
  REDIRECT_CHAIN: 'redirect_chain',
  HEAD_TAG: 'head_tag',
  ROBOTS_DIRECTIVE: 'robots_directive',
  CANONICAL_TARGET: 'canonical_target',
  IMAGE_ALT: 'image_alt',
  MANUAL: 'manual',
});

/**
 * Finding slug -> the checks that prove it is gone.
 *
 * Slugs are the ones src/lib/auditIssues.js emits, so this table and the
 * crawler share one vocabulary. An unknown slug falls through to 'manual',
 * which is the safe default.
 */
const AUDITOR_SPECS = {
  // --- Response codes ---
  '404-page': [{ type: 'http_status_ok' }],
  '4xx-page': [{ type: 'http_status_ok' }],
  '5xx-page': [{ type: 'http_status_ok' }],
  '500-page': [{ type: 'http_status_ok' }],
  'timed-out': [{ type: 'http_status_ok' }],
  'css-broken': [{ type: 'http_status_ok' }],
  'javascript-broken': [{ type: 'http_status_ok' }],
  'image-broken': [{ type: 'http_status_ok' }],
  'page-has-broken-css': [{ type: 'http_status_ok' }],
  'page-has-broken-javascript': [{ type: 'http_status_ok' }],
  'page-has-broken-image': [{ type: 'http_status_ok' }],

  // --- Redirects ---
  'broken-redirect': [{ type: 'redirect_resolves' }],
  'redirect-loop': [{ type: 'redirect_resolves' }],
  'redirect-chain-too-long': [{ type: 'redirect_chain_max', max: 2 }],
  'redirect-chain': [{ type: 'redirect_chain_max', max: 2 }],
  '3xx-redirect': [{ type: 'http_status_ok' }],
  '302-redirect': [{ type: 'http_status_ok' }],
  '3xx-redirect-sitemap': [{ type: 'http_status_ok' }],
  'https-to-http-redirect': [{ type: 'http_status_ok' }],
  'meta-refresh-redirect': [{ type: 'tag_absent', selector: 'meta-refresh' }],

  // --- Title ---
  'title-tag-missing-or-empty': [
    { type: 'tag_present', selector: 'title' },
  ],
  'multiple-title-tags': [{ type: 'tag_count', selector: 'title', max: 1, min: 1 }],
  'title-too-short': [{ type: 'tag_length', selector: 'title', min: 15 }],
  'title-too-long': [{ type: 'tag_length', selector: 'title', max: 70 }],

  // --- Meta description ---
  'meta-description-missing': [
    { type: 'tag_present', selector: 'meta-description' },
  ],
  'meta-description-tag-missing-or-empty': [
    { type: 'tag_present', selector: 'meta-description' },
  ],
  'multiple-meta-description-tags': [
    { type: 'tag_count', selector: 'meta-description', max: 1, min: 1 },
  ],

  // --- Headings ---
  'h1-tag-missing-or-empty': [{ type: 'tag_present', selector: 'h1' }],

  // --- Indexability ---
  'noindex-page': [{ type: 'robots_absent', directive: 'noindex' }],
  'noindex-page-sitemap': [{ type: 'robots_absent', directive: 'noindex' }],
  'nofollow-page': [{ type: 'robots_absent', directive: 'nofollow' }],
  'noindex-follow-page': [{ type: 'robots_absent', directive: 'noindex' }],
  'noindex-and-nofollow-page': [{ type: 'robots_absent', directive: 'noindex' }],
  'noindex-in-html-and-http-header': [{ type: 'robots_absent', directive: 'noindex' }],
  'nofollow-in-html-and-http-header': [{ type: 'robots_absent', directive: 'nofollow' }],

  // --- Canonical ---
  'non-canonical-page-specified-as-canonical-one': [{ type: 'canonical_self' }],
  'canonical-points-to-4xx': [{ type: 'canonical_resolves' }],
  'canonical-points-to-5xx': [{ type: 'canonical_resolves' }],
  'canonical-points-to-redirect': [{ type: 'canonical_resolves' }],
  'canonical-from-http-to-https': [{ type: 'canonical_self' }],
  'canonical-from-https-to-http': [{ type: 'canonical_self' }],

  // --- Social tags ---
  'open-graph-tags-missing': [{ type: 'tag_present', selector: 'og:title' }],
  'og-tags-incomplete': [{ type: 'tag_present', selector: 'og:title' }],
  'open-graph-tags-incomplete': [{ type: 'tag_present', selector: 'og:title' }],
  'x-twitter-card-missing': [{ type: 'tag_present', selector: 'twitter:card' }],
  'twitter-card-incomplete': [{ type: 'tag_present', selector: 'twitter:card' }],
  'x-twitter-card-incomplete': [{ type: 'tag_present', selector: 'twitter:card' }],

  // --- Images ---
  'missing-alt-text': [{ type: 'images_have_alt' }],

  // --- Links ---
  'page-has-no-outgoing-links': [{ type: 'has_links' }],

  // --- Mixed content ---
  'https-http-mixed-content': [{ type: 'no_mixed_content' }],
  'https-page-links-to-http-image': [{ type: 'no_mixed_content' }],
};

/**
 * Some checks want a bound that came from the finding rather than from the
 * table - a meta description length target, for example.
 */
function withEvidenceBounds(checks, findingType) {
  if (findingType === 'meta-description-missing' || findingType === 'meta-description-tag-missing-or-empty') {
    return [
      ...checks,
      { type: 'tag_length', selector: 'meta-description', min: 50, max: 320 },
    ];
  }
  return checks;
}

/**
 * Build the verification spec for a finding.
 *
 * @param {object} finding
 * @param {string} finding.sourceModule
 * @param {string} finding.findingType   normalised slug
 * @param {string} [finding.scopeKind]   'url' | 'site' | 'batch'
 * @param {string} [finding.url]         the affected URL
 * @returns {{kind: string, url?: string, checks?: object[], reason?: string}}
 */
export function deriveVerificationSpec(finding = {}) {
  const { sourceModule, findingType, scopeKind = 'url', url } = finding;

  // Only a single-URL finding can be re-checked by fetching one page. A
  // site-wide or batched finding needs a re-crawl, which is out of scope.
  if (scopeKind !== 'url' || !url) {
    return {
      kind: VERIFICATION_KINDS.MANUAL,
      reason:
        scopeKind === 'batch'
          ? 'This issue covers several URLs, so SEOX cannot confirm the fix from a single check. Re-run the audit to confirm.'
          : 'This is a site-wide finding. Re-run the audit to confirm the fix.',
    };
  }

  if (sourceModule !== 'auditor') {
    return {
      kind: VERIFICATION_KINDS.MANUAL,
      reason: 'Re-run the relevant SEOX tool to confirm this fix.',
    };
  }

  const checks = AUDITOR_SPECS[findingType];
  if (!checks || !checks.length) {
    return {
      kind: VERIFICATION_KINDS.MANUAL,
      reason: 'SEOX has no automatic check for this finding type. Re-run the audit to confirm.',
    };
  }

  return {
    kind: 'url_check',
    url,
    checks: withEvidenceBounds(checks, findingType),
  };
}

/** Plain-English description of a check, used in the Jira comment and the UI. */
export function describeCheck(check) {
  switch (check?.type) {
    case 'http_status_ok':
      return 'the URL returns a successful (2xx) response';
    case 'redirect_resolves':
      return 'the redirect resolves to a working page';
    case 'redirect_chain_max':
      return `the redirect chain is at most ${check.max} hop(s)`;
    case 'tag_present':
      return `the page has a non-empty ${describeSelector(check.selector)}`;
    case 'tag_absent':
      return `the page no longer has a ${describeSelector(check.selector)}`;
    case 'tag_count':
      return `the page has exactly one ${describeSelector(check.selector)}`;
    case 'tag_length':
      return `the ${describeSelector(check.selector)} is ${
        check.min && check.max
          ? `between ${check.min} and ${check.max} characters`
          : check.min
            ? `at least ${check.min} characters`
            : `at most ${check.max} characters`
      }`;
    case 'robots_absent':
      return `the page is no longer marked ${check.directive}`;
    case 'canonical_self':
      return 'the canonical points at this URL';
    case 'canonical_resolves':
      return 'the canonical target returns a successful response';
    case 'images_have_alt':
      return 'every image on the page has alt text';
    case 'has_links':
      return 'the page has outgoing links';
    case 'no_mixed_content':
      return 'the page loads no http:// resources';
    default:
      return 'the finding is no longer present';
  }
}

function describeSelector(selector) {
  switch (selector) {
    case 'title':
      return 'title tag';
    case 'meta-description':
      return 'meta description';
    case 'h1':
      return 'H1 heading';
    case 'meta-refresh':
      return 'meta refresh redirect';
    case 'og:title':
      return 'Open Graph title tag';
    case 'twitter:card':
      return 'Twitter card tag';
    default:
      return selector || 'tag';
  }
}
