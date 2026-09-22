// Normalising and validating the finding payload a client submits.
//
// SEOX has no server-side table of individual SEO findings - the crawler runs
// in the browser and a finding is a (slug, url) pair inside the stats blob it
// produces (src/lib/auditIssues.js). So the server cannot look a finding up
// by id; the client describes it, and the server validates, normalises and
// snapshots it.
//
// The snapshot matters: it is what the Jira issue was filed from, and it must
// survive the crawl state being overwritten by the next crawl.

import { parsePublicHttpUrl } from './url-security.js';
import { buildFingerprint, hashScopeKey, normalizeScopeUrl } from './jira-fingerprint.js';
import { normalizeSeverity } from './jira-status-map.js';
import { deriveVerificationSpec } from './jira-verification.js';

const MAX_URLS = 250; // matches ISSUE_URL_LIMIT in src/lib/auditIssues.js
const MAX_TEXT = 2000;
const MAX_EVIDENCE_KEYS = 20;

function fail(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function clean(value, max = MAX_TEXT) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, max);
}

function cleanEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return {};
  const out = {};
  for (const [key, value] of Object.entries(evidence).slice(0, MAX_EVIDENCE_KEYS)) {
    const safeKey = String(key).slice(0, 60);
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) out[safeKey] = value.slice(0, 20).map((item) => clean(item, 300));
    else if (typeof value === 'object') out[safeKey] = clean(JSON.stringify(value), 500);
    else out[safeKey] = clean(value, 500);
  }
  return out;
}

/**
 * @param {object} raw          the `finding` object from the request body
 * @param {string} projectId
 * @returns the normalised finding, its fingerprint and its verification spec
 */
export function normalizeFindingPayload(raw, projectId) {
  if (!raw || typeof raw !== 'object') throw fail('A finding is required.');

  const scopeInput = raw.scope && typeof raw.scope === 'object' ? raw.scope : {};
  const scopeKind = String(scopeInput.kind || (raw.url ? 'url' : 'site')).toLowerCase();

  // Validate every URL before it is stored or later fetched. parsePublicHttpUrl
  // is the same guard the crawler and proxy endpoints use.
  let primaryUrl = '';
  let urls = [];

  if (scopeKind === 'url') {
    const candidate = scopeInput.url || raw.url;
    if (!candidate) throw fail('A finding scoped to a URL must include that URL.');
    primaryUrl = parsePublicHttpUrl(candidate, 'finding URL').toString();
    urls = [primaryUrl];
  } else if (scopeKind === 'batch') {
    const list = Array.isArray(scopeInput.urls) ? scopeInput.urls : [];
    if (!list.length) throw fail('A batched finding must include at least one URL.');
    urls = [
      ...new Set(
        list
          .slice(0, MAX_URLS)
          .map((value) => {
            try {
              return parsePublicHttpUrl(value, 'finding URL').toString();
            } catch {
              return '';
            }
          })
          .filter(Boolean)
      ),
    ];
    if (!urls.length) throw fail('None of the submitted URLs are valid public URLs.');
    primaryUrl = urls[0];
  } else if (scopeKind !== 'site') {
    throw fail('A finding scope must be "url", "batch" or "site".');
  }

  const { fingerprint, scopeKey, scopeKind: resolvedKind, sourceModule, findingType } =
    buildFingerprint({
      projectId,
      sourceModule: raw.sourceModule,
      findingType: raw.findingType,
      scope: scopeKind === 'batch' ? { kind: 'batch', urls } : scopeKind === 'site' ? { kind: 'site' } : { kind: 'url', url: primaryUrl },
    });

  const severity = normalizeSeverity(raw.severity);

  const finding = {
    sourceModule,
    findingType,
    title: clean(raw.title, 500) || findingType,
    severity,
    scopeKind: resolvedKind,
    url: primaryUrl || null,
    urls,
    affectedUrlCount: Number(raw.affectedUrlCount) > 0
      ? Math.min(Number(raw.affectedUrlCount), 100000)
      : urls.length || 1,
    description: clean(raw.description),
    currentValue: clean(raw.currentValue, 1000),
    expectedValue: clean(raw.expectedValue, 1000),
    recommendation: clean(raw.recommendation),
    seoImpact: clean(raw.seoImpact),
    evidence: cleanEvidence(raw.evidence),
    crawledAt: clean(raw.crawl?.crawledAt || raw.crawledAt, 40),
    seoxPath: normalizeSeoxPath(raw.seoxPath || raw.seoxUrl),
  };

  const verification = deriveVerificationSpec({
    sourceModule,
    findingType,
    scopeKind: resolvedKind,
    url: primaryUrl,
  });

  return {
    finding,
    fingerprint,
    scopeKey,
    scopeKeyHash: hashScopeKey(scopeKey),
    verification,
  };
}

/** Only an in-app path is accepted, so a finding cannot inject an external link. */
function normalizeSeoxPath(value) {
  const raw = clean(value, 300);
  if (!raw) return '';
  if (!raw.startsWith('/')) return '';
  if (raw.startsWith('//')) return '';
  return raw;
}

/** The compact record stored on the link row as finding_snapshot. */
export function buildFindingSnapshot(finding) {
  return {
    title: finding.title,
    severity: finding.severity,
    sourceModule: finding.sourceModule,
    findingType: finding.findingType,
    scopeKind: finding.scopeKind,
    url: finding.url,
    urlCount: finding.affectedUrlCount,
    // Only the first few URLs: the full list lives in the crawl state, and a
    // 250-entry copy on every link row is a lot of JSON for little value.
    urlSample: finding.urls.slice(0, 20),
    currentValue: finding.currentValue,
    expectedValue: finding.expectedValue,
    evidence: finding.evidence,
    crawledAt: finding.crawledAt,
    capturedAt: new Date().toISOString(),
  };
}

export { normalizeScopeUrl };
