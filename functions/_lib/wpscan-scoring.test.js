import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SEVERITIES,
  buildFinding,
  compareVersions,
  countBySeverity,
  filterReportable,
  isAffected,
  severityFromCvss,
  sortFindings,
} from './wpscan-scoring.js';
import { detectComponents, detectCoreVersion, detectExposures, detectWordPress } from './wpscan-detect.js';

// --- Version comparison ----------------------------------------------------

test('version comparison handles unequal segment counts', () => {
  assert.equal(compareVersions('1.2', '1.2.0'), 0);
  assert.equal(compareVersions('1.2.3', '1.10.0'), -1);
  assert.equal(compareVersions('6.4.2', '6.4.1'), 1);
});

test('an unparseable version compares as unknown rather than guessing', () => {
  assert.equal(compareVersions('trunk', '1.0'), null);
  assert.equal(compareVersions(null, '1.0'), null);
});

test('a site is only affected when its version is below the fix', () => {
  assert.equal(isAffected('1.2.0', '1.3.0'), true);
  assert.equal(isAffected('1.3.0', '1.3.0'), false);
  assert.equal(isAffected('1.4.0', '1.3.0'), false);
});

test('no detected version means unknown, never affected', () => {
  assert.equal(isAffected(null, '1.3.0'), null);
  assert.equal(isAffected('1.2.0', null), null);
});

// --- Severity --------------------------------------------------------------

test('CVSS scores map onto the standard bands', () => {
  assert.equal(severityFromCvss(9.8), 'critical');
  assert.equal(severityFromCvss(7.5), 'high');
  assert.equal(severityFromCvss(5.3), 'medium');
  assert.equal(severityFromCvss(2.1), 'low');
  assert.equal(severityFromCvss(null), null);
});

// --- Findings --------------------------------------------------------------

const vulnerability = {
  title: 'Authenticated SQL injection',
  fixed_in: '2.5.0',
  cvss: { score: 9.1 },
  references: { cve: ['2024-1234'], url: ['https://example.com/advisory'] },
};

test('a version below the fix is a confirmed finding at full severity', () => {
  const finding = buildFinding({
    kind: 'plugin',
    slug: 'contact-form',
    installedVersion: '2.4.1',
    vulnerability,
  });
  assert.equal(finding.confirmed, true);
  assert.equal(finding.severity, 'critical');
  assert.match(finding.detail, /before 2\.5\.0/);
  assert.equal(finding.cve, 'CVE-2024-1234');
});

test('a patched version is reported but demoted, not shown as live', () => {
  const finding = buildFinding({
    kind: 'plugin',
    slug: 'contact-form',
    installedVersion: '3.0.0',
    vulnerability,
  });
  assert.equal(finding.confirmed, false);
  assert.equal(finding.severity, 'high'); // demoted one step from critical
  assert.match(finding.detail, /Fixed in 2\.5\.0/);
});

test('an undetectable version is demoted and says so', () => {
  const finding = buildFinding({
    kind: 'plugin',
    slug: 'contact-form',
    installedVersion: null,
    vulnerability,
  });
  assert.equal(finding.confirmed, false);
  assert.match(finding.detail, /No version could be detected/);
});

test('unconfirmed low-severity noise is filtered out, confirmed findings never are', () => {
  const findings = [
    { confirmed: true, severity: 'low' },
    { confirmed: false, severity: 'low' },
    { confirmed: false, severity: 'medium' },
    { confirmed: false, severity: 'critical' },
    { confirmed: false, severity: 'high' },
  ];
  const kept = filterReportable(findings);
  assert.equal(kept.length, 3);
  assert.ok(kept.some((f) => f.confirmed && f.severity === 'low'));
  assert.ok(!kept.some((f) => !f.confirmed && f.severity === 'medium'));
});

test('findings sort by severity, then confirmed first', () => {
  const sorted = sortFindings([
    { severity: 'high', confirmed: false, cvssScore: 8 },
    { severity: 'critical', confirmed: false, cvssScore: 9 },
    { severity: 'high', confirmed: true, cvssScore: 7 },
  ]);
  assert.equal(sorted[0].severity, 'critical');
  assert.equal(sorted[1].confirmed, true);
  assert.deepEqual(SEVERITIES, ['critical', 'high', 'medium', 'low', 'info']);
});

test('counts are grouped by severity', () => {
  assert.deepEqual(
    countBySeverity([{ severity: 'high' }, { severity: 'high' }, { severity: 'info' }]),
    { critical: 0, high: 2, medium: 0, low: 0, info: 1 }
  );
});

// --- Passive detection -----------------------------------------------------

const wpHtml = `
<html><head>
<meta name="generator" content="WordPress 6.4.2" />
<link rel="https://api.w.org/" href="https://example.com/wp-json/" />
<link rel="stylesheet" href="/wp-content/themes/astra/style.css?ver=4.6.1" />
<script src="/wp-content/plugins/contact-form-7/includes/js/index.js?ver=5.8.4"></script>
<script src="/wp-content/plugins/woocommerce/assets/js/frontend.js?ver=8.5.1"></script>
<script src="/wp-includes/js/wp-emoji-release.min.js?ver=6.4.2"></script>
</head><body><a href="/?author=1">admin</a></body></html>`;

test('WordPress is detected from several independent signals', () => {
  const result = detectWordPress(wpHtml, null);
  assert.equal(result.isWordPress, true);
  assert.equal(result.confidence, 'high');
  assert.ok(result.signals.length >= 2);
});

test('a single weak signal is low confidence, not a call', () => {
  const result = detectWordPress('<img src="/wp-content/uploads/logo.png">', null);
  assert.equal(result.isWordPress, true);
  assert.equal(result.confidence, 'low');
});

test('a non-WordPress page is not claimed as WordPress', () => {
  const result = detectWordPress('<html><body>Hello</body></html>', null);
  assert.equal(result.isWordPress, false);
  assert.equal(result.confidence, 'none');
});

test('the core version is reported with the source it came from', () => {
  const result = detectCoreVersion(wpHtml, null);
  assert.equal(result.version, '6.4.2');
  assert.match(result.source, /generator/);
});

test('no version leaves both fields null rather than inventing one', () => {
  const result = detectCoreVersion('<html><body>nothing</body></html>', null);
  assert.equal(result.version, null);
  assert.equal(result.source, null);
});

test('plugins and themes come from the asset URLs the page already loads', () => {
  const { plugins, themes } = detectComponents(wpHtml);
  const bySlug = Object.fromEntries(plugins.map((p) => [p.slug, p.version]));

  assert.equal(bySlug['contact-form-7'], '5.8.4');
  assert.equal(bySlug.woocommerce, '8.5.1');
  assert.equal(plugins.length, 2);
  assert.equal(themes[0].slug, 'astra');
  assert.equal(themes[0].version, '4.6.1');
});

test('the same component referenced twice collapses to one entry', () => {
  const html = `
    <script src="/wp-content/plugins/jetpack/a.js"></script>
    <script src="/wp-content/plugins/jetpack/b.js?ver=13.1"></script>`;
  const { plugins } = detectComponents(html);
  assert.equal(plugins.length, 1);
  assert.equal(plugins[0].version, '13.1');
});

test('version disclosure and author links are raised as exposures', () => {
  const exposures = detectExposures(wpHtml, null);
  const keys = exposures.map((entry) => entry.key);
  assert.ok(keys.includes('versionDisclosure'));
  assert.ok(keys.includes('authorLinks'));
});

test('a server version header is reported as an information leak', () => {
  const headers = new Headers({ 'x-powered-by': 'PHP/8.1.2', server: 'Apache/2.4.41' });
  const keys = detectExposures('<html></html>', headers).map((entry) => entry.key);
  assert.ok(keys.includes('poweredBy'));
  assert.ok(keys.includes('serverHeader'));
});

test('a hardened site produces no exposures', () => {
  assert.deepEqual(detectExposures('<html><body>clean</body></html>', new Headers()), []);
});


