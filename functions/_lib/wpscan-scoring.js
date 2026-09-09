// Turns WPScan vulnerability records into SEOX findings.
//
// Two rules matter here:
//
//   1. A vulnerability only counts when the detected version is actually below
//      the version that fixed it. WPScan returns every vulnerability a
//      component has ever had; reporting all of them against a patched site
//      would be alarming and wrong.
//
//   2. When no version could be detected, the vulnerability is reported at
//      reduced severity and labelled unconfirmed, rather than either dropped or
//      claimed as a live finding.

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];

export function severityFromCvss(score) {
  // Number(null) and Number('') are both 0, which is finite; a missing score
  // must read as "unknown", not as a low-severity finding.
  if (score === null || score === undefined || score === '') return null;
  const value = Number(score);
  if (!Number.isFinite(value)) return null;
  if (value >= 9) return 'critical';
  if (value >= 7) return 'high';
  if (value >= 4) return 'medium';
  return 'low';
}

/**
 * Compare two dotted version strings. Returns -1, 0 or 1, or null when either
 * side is not comparable.
 */
export function compareVersions(a, b) {
  if (!a || !b) return null;
  // A segment must start with a digit. Number('') is 0, not NaN, so stripping
  // letters from "trunk" would otherwise parse it as version 0 and report the
  // site as older than every fix.
  const parse = (value) =>
    String(value)
      .split('.')
      .map((part) => (/^\d/.test(part) ? Number(part.replace(/\D.*$/, '')) : Number.NaN));

  const left = parse(a);
  const right = parse(b);
  if (left.some(Number.isNaN) || right.some(Number.isNaN)) return null;

  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const l = left[index] ?? 0;
    const r = right[index] ?? 0;
    if (l < r) return -1;
    if (l > r) return 1;
  }
  return 0;
}

/**
 * Is `installed` affected by a vulnerability fixed in `fixedIn`?
 * null means "cannot tell" â€” no version, or versions that will not parse.
 */
export function isAffected(installed, fixedIn) {
  if (!installed) return null;
  if (!fixedIn) return null;
  const comparison = compareVersions(installed, fixedIn);
  if (comparison === null) return null;
  return comparison < 0;
}

function referencesOf(vulnerability) {
  const references = vulnerability.references || {};
  return [
    ...(references.url || []),
    ...(references.cve || []).map((cve) => `https://nvd.nist.gov/vuln/detail/CVE-${cve}`),
    ...(references.wpvulndb || []).map((id) => `https://wpscan.com/vulnerability/${id}`),
  ].slice(0, 8);
}

export function buildFinding({ kind, slug, name, installedVersion, vulnerability }) {
  const fixedIn = vulnerability.fixed_in || null;
  const affected = isAffected(installedVersion, fixedIn);

  const cvss = vulnerability.cvss?.score ?? null;
  const baseSeverity = severityFromCvss(cvss) || 'medium';

  // Unconfirmed findings drop one step: still worth showing, not worth an alarm.
  const severity = affected === true ? baseSeverity : demote(baseSeverity);

  const cves = vulnerability.references?.cve || [];

  return {
    kind,
    componentSlug: slug,
    componentName: name || slug,
    installedVersion: installedVersion || null,
    fixedIn,
    severity,
    confirmed: affected === true,
    title: vulnerability.title || 'Known vulnerability',
    detail:
      affected === true
        ? `Affects versions before ${fixedIn}. The site reports ${installedVersion}.`
        : affected === false
          ? `Fixed in ${fixedIn}; the site reports ${installedVersion}.`
          : installedVersion
            ? `Reported version ${installedVersion} could not be compared against the fix in ${fixedIn || 'an unknown release'}.`
            : 'No version could be detected, so it is not known whether this site is affected.',
    cve: cves.length ? cves.map((value) => `CVE-${value}`).join(', ') : null,
    cvssScore: cvss,
    references: referencesOf(vulnerability),
  };
}

function demote(severity) {
  const index = SEVERITIES.indexOf(severity);
  if (index === -1) return 'info';
  return SEVERITIES[Math.min(index + 1, SEVERITIES.length - 1)];
}

/**
 * Keep the findings worth showing: everything confirmed, plus unconfirmed ones
 * that would be serious if they did apply. An unconfirmed low is noise.
 */
export function filterReportable(findings) {
  return findings.filter(
    (finding) =>
      finding.confirmed || finding.severity === 'critical' || finding.severity === 'high'
  );
}

export function countBySeverity(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of findings) counts[finding.severity] = (counts[finding.severity] || 0) + 1;
  return counts;
}

export function sortFindings(findings) {
  return [...findings].sort((a, b) => {
    const bySeverity = SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity);
    if (bySeverity !== 0) return bySeverity;
    // Confirmed before unconfirmed at the same severity.
    if (a.confirmed !== b.confirmed) return a.confirmed ? -1 : 1;
    return (b.cvssScore || 0) - (a.cvssScore || 0);
  });
}


