import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PORTAL_CHECKS,
  buildPortalEndpoint,
  normaliseChecks,
  normaliseDashboard,
  normaliseScanType,
  redactToken,
  runPortalScan,
} from './wp-security-portal.js';

const TOKEN = 'test-admin-token-value';

/** The shape the plugin documents, trimmed to one item per list. */
function samplePayload(overrides = {}) {
  return {
    success: true,
    status: 'success',
    message: 'Security data retrieved successfully.',
    data: {
      security_score: 88,
      risk_level: 'medium',
      summary: { critical: 0, high: 0, medium: 1, low: 9, info: 0 },
      last_scan: {
        scan_id: 'scan_20260918074111',
        status: 'completed',
        scan_type: 'full',
        started_at: '2026-09-18T07:41:11+00:00',
        completed_at: '2026-09-18T07:41:11+00:00',
        duration: '< 1 minute',
        scanner_version: '1.11.1',
      },
      top_issues: [
        {
          id: 'iss_0c7ee9c67a',
          category: 'users',
          severity: 'medium',
          title: 'Default admin username exists',
          description: 'A user with login "admin" exists.',
          evidence: '',
          remediation: { action: 'Create a uniquely named administrator.' },
          discovered_at: '2026-09-18T07:41:11+00:00',
        },
      ],
      categories: {
        core: { wordpress_version: '7.1.1', debug: false, xmlrpc: true, auto_updates: false },
        plugins: {
          installed: 16,
          active: 8,
          items: [
            {
              file: 'eps-301-redirects/eps-301-redirects.php',
              name: '301 Redirects',
              version: '2.85',
              author: 'WebFactory Ltd',
              status: 'inactive',
            },
          ],
        },
        themes: { active: { name: 'tower-security', version: '1.0.0', author: 'Towertech' } },
        users: {
          total: { total_users: 7, avail_roles: { administrator: 1, editor: 2, subscriber: 4, none: 0 } },
          admins: 1,
          default_admin: true,
        },
        malware: { status: 'portal_required', message: 'Deep malware scanning requires the portal.' },
        database: { server: '11.4.12-MariaDB', prefix: 'wp_' },
        server: {
          php: '8.2.30',
          wordpress: '7.1.1',
          https: true,
          headers_expected: ['X-Frame-Options', 'Referrer-Policy'],
        },
        ssl: { https_detected: true, home_url: 'https://example.com/' },
        backups: { status: 'integration_required', message: 'Backup status requires a provider.' },
        monitoring: { debug_log: false, cron: true },
      },
      ...overrides.data,
    },
    meta: {
      project_id: 'proj_1788773954218',
      site_url: 'https://example.com/',
      site_name: 'Example',
      wordpress: '7.1.1',
      php: '8.2.30',
      plugin_version: '1.11.7',
      generated_at: '2026-09-18T10:47:39+00:00',
    },
    ...overrides.top,
  };
}

function fakeFetch(response, capture = {}) {
  return async (url, init) => {
    capture.url = url;
    capture.init = init;
    if (typeof response === 'function') return response(url, init);
    return response;
  };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

// --- Endpoint and request shape --------------------------------------------

test('the endpoint is built under the site home URL, keeping a subdirectory install', () => {
  assert.equal(
    buildPortalEndpoint('https://example.com'),
    'https://example.com/wp-json/seox/v1/security-portal/dashboard'
  );
  assert.equal(
    buildPortalEndpoint('https://example.com/blog/'),
    'https://example.com/blog/wp-json/seox/v1/security-portal/dashboard'
  );
  assert.equal(
    buildPortalEndpoint('example.com'),
    'https://example.com/wp-json/seox/v1/security-portal/dashboard'
  );
});

test('a trailing slash on the project URL never doubles up in the endpoint', () => {
  const expected = 'https://example.com/wp-json/seox/v1/security-portal/dashboard';
  for (const siteUrl of ['https://example.com', 'https://example.com/', 'https://example.com//', '  https://example.com/  ']) {
    assert.equal(buildPortalEndpoint(siteUrl), expected, siteUrl);
  }
});

test('the protocol the project is configured with is kept', () => {
  assert.equal(
    buildPortalEndpoint('http://example.com/'),
    'http://example.com/wp-json/seox/v1/security-portal/dashboard'
  );
  assert.equal(
    buildPortalEndpoint('https://sub.example.co.uk:8443/site/'),
    'https://sub.example.co.uk:8443/site/wp-json/seox/v1/security-portal/dashboard'
  );
});

test('a project with no website URL is refused before a request is built', () => {
  assert.throws(() => buildPortalEndpoint(''), /no website URL/i);
  assert.throws(() => buildPortalEndpoint(null), /no website URL/i);
});

test('a private or local host is refused as a scan target', () => {
  assert.throws(() => buildPortalEndpoint('http://127.0.0.1/'), /not allowed/i);
  assert.throws(() => buildPortalEndpoint('http://localhost/'), /not allowed/i);
});

test('unknown checks are dropped and an empty list means every check', () => {
  assert.deepEqual(normaliseChecks(['core', 'plugins']), ['core', 'plugins']);
  assert.deepEqual(normaliseChecks(['core', 'core']), ['core']);
  assert.deepEqual(normaliseChecks(['nonsense']), PORTAL_CHECKS);
  assert.deepEqual(normaliseChecks([]), PORTAL_CHECKS);
  assert.deepEqual(normaliseChecks(null), PORTAL_CHECKS);
});

test('an unrecognised scan type falls back to a full scan', () => {
  assert.equal(normaliseScanType('quick'), 'quick');
  assert.equal(normaliseScanType('FULL'), 'full');
  assert.equal(normaliseScanType('deep'), 'full');
  assert.equal(normaliseScanType(undefined), 'full');
});

test('the scan posts the documented payload, with the token in the body only', async () => {
  const capture = {};
  await runPortalScan({
    siteUrl: 'https://example.com',
    adminToken: TOKEN,
    projectId: 'proj_1',
    fetchImpl: fakeFetch(jsonResponse(200, samplePayload()), capture),
  });

  assert.equal(capture.url, 'https://example.com/wp-json/seox/v1/security-portal/dashboard');
  assert.equal(capture.init.method, 'POST');
  assert.ok(!capture.url.includes(TOKEN));

  // Echoed back so the page can show, and the logs can record, which site was
  // actually scanned.
  const scanned = await runPortalScan({
    siteUrl: 'https://example.com/',
    adminToken: TOKEN,
    projectId: 'proj_1',
    fetchImpl: fakeFetch(jsonResponse(200, samplePayload())),
  });
  assert.equal(scanned.endpoint, 'https://example.com/wp-json/seox/v1/security-portal/dashboard');

  const body = JSON.parse(capture.init.body);
  assert.deepEqual(body, {
    admin_token: TOKEN,
    project_id: 'proj_1',
    scan_type: 'full',
    checks: PORTAL_CHECKS,
  });
});

test('a missing admin token fails before any request is made', async () => {
  let called = false;
  await assert.rejects(
    runPortalScan({
      siteUrl: 'https://example.com',
      adminToken: '',
      projectId: 'proj_1',
      fetchImpl: async () => {
        called = true;
        return jsonResponse(200, samplePayload());
      },
    }),
    (error) => error.status === 409
  );
  assert.equal(called, false);
});

// --- Normalisation ----------------------------------------------------------

test('the documented response maps onto the dashboard the page renders', async () => {
  const portal = await runPortalScan({
    siteUrl: 'https://example.com',
    adminToken: TOKEN,
    projectId: 'proj_1',
    fetchImpl: fakeFetch(jsonResponse(200, samplePayload())),
  });

  assert.equal(portal.securityScore, 88);
  assert.equal(portal.riskLevel, 'medium');
  assert.deepEqual(portal.summary, { critical: 0, high: 0, medium: 1, low: 9, info: 0 });
  assert.equal(portal.lastScan.scanId, 'scan_20260918074111');
  assert.equal(portal.lastScan.scannerVersion, '1.11.1');
  assert.equal(portal.pending, false);

  assert.equal(portal.topIssues.length, 1);
  assert.equal(portal.topIssues[0].remediation, 'Create a uniquely named administrator.');
  assert.equal(portal.topIssues[0].severity, 'medium');

  assert.equal(portal.categories.core.wordpressVersion, '7.1.1');
  assert.equal(portal.categories.plugins.installed, 16);
  assert.equal(portal.categories.plugins.inactive, 8);
  assert.equal(portal.categories.users.totalUsers, 7);
  assert.deepEqual(portal.categories.users.roles[0], { role: 'administrator', count: 1 });
  assert.equal(portal.categories.database.prefix, 'wp_');
  assert.equal(portal.categories.ssl.httpsDetected, true);
  assert.equal(portal.meta.siteName, 'Example');
});

test('a themes block with only an active theme still produces a list', () => {
  const portal = normaliseDashboard(samplePayload());
  assert.equal(portal.categories.themes.active.name, 'tower-security');
  assert.equal(portal.categories.themes.items.length, 1);
  assert.equal(portal.categories.themes.items[0].status, 'active');
});

test('a themes block with items reports the active one out of the list', () => {
  const payload = samplePayload();
  payload.data.categories.themes = {
    installed: 2,
    active: 1,
    inactive: 1,
    items: [
      { slug: 'twentytwentyfour', name: 'Twenty Twenty-Four', status: 'inactive', current_version: '1.2' },
      { slug: 'tower', name: 'Tower', status: 'active', current_version: '1.0.0', author: 'Towertech' },
    ],
  };

  const themes = normaliseDashboard(payload).categories.themes;
  assert.equal(themes.items.length, 2);
  assert.equal(themes.active.slug, 'tower');
  assert.equal(themes.active.version, '1.0.0');
});

test('plugin counts are derived when the site reports only the list', () => {
  const payload = samplePayload();
  payload.data.categories.plugins = {
    items: [
      { file: 'a/a.php', name: 'A', status: 'active' },
      { file: 'b/b.php', name: 'B', status: 'inactive' },
    ],
  };

  const plugins = normaliseDashboard(payload).categories.plugins;
  assert.equal(plugins.installed, 2);
  assert.equal(plugins.active, 1);
  assert.equal(plugins.inactive, 1);
  assert.equal(plugins.items[0].slug, 'a');
});

test('a malware block that ran is kept with its findings, minus the absolute path', () => {
  const payload = samplePayload();
  payload.data.categories.malware = {
    status: 'completed',
    scanner: 'SEOX Built-in',
    scanned_files: 6715,
    duration_seconds: 8.66,
    summary: { critical: 1, high: 2 },
    core_checksum: { status: 'checked', modified_files: ['wp-admin/index.php'] },
    findings: [
      {
        id: 'mal_1',
        severity: 'high',
        title: 'Suspicious PHP file: legacy-widget.php',
        description: 'Detected: base64_decode().',
        remediation: 'Review the file.',
        relative_path: 'wp-includes/blocks/legacy-widget.php',
        path: '/www/site_189/public/wp-includes/blocks/legacy-widget.php',
        size: 4011,
        signals: ['base64_decode()'],
      },
    ],
  };

  const malware = normaliseDashboard(payload).categories.malware;
  assert.equal(malware.status, 'completed');
  assert.equal(malware.scannedFiles, 6715);
  assert.deepEqual(malware.summary, { critical: 1, high: 2, medium: 0, low: 0, info: 0 });
  assert.deepEqual(malware.coreChecksum.modifiedFiles, ['wp-admin/index.php']);
  assert.equal(malware.findings[0].path, 'wp-includes/blocks/legacy-widget.php');
  assert.equal(malware.findings[0].signals.length, 1);
});

test('a check the site did not report reads as unknown, never as off', () => {
  const payload = samplePayload();
  delete payload.data.categories.core.debug;
  payload.data.categories.monitoring = {};

  const categories = normaliseDashboard(payload).categories;
  assert.equal(categories.core.debug, null);
  assert.equal(categories.core.xmlrpc, true);
  assert.equal(categories.monitoring.cron, null);
  assert.equal(categories.monitoring.debugLog, null);
});

test('an empty or malformed payload normalises instead of throwing', () => {
  for (const payload of [{}, null, { data: null }, { data: { categories: 'nope', top_issues: 'nope' } }]) {
    const portal = normaliseDashboard(payload);
    assert.deepEqual(portal.summary, { critical: 0, high: 0, medium: 0, low: 0, info: 0 });
    assert.equal(portal.securityScore, null);
    assert.deepEqual(portal.topIssues, []);
    assert.deepEqual(portal.categories.plugins.items, []);
    assert.equal(portal.categories.themes.active, null);
    assert.equal(portal.categories.users.totalUsers, 0);
  }
});

test('a queued scan is reported as pending so the page can poll', () => {
  const payload = samplePayload();
  payload.data.last_scan.status = 'running';
  assert.equal(normaliseDashboard(payload).pending, true);
});

// --- Failure handling -------------------------------------------------------

test('rejected credentials surface the site message as a 403', async () => {
  await assert.rejects(
    runPortalScan({
      siteUrl: 'https://example.com',
      adminToken: TOKEN,
      projectId: 'proj_1',
      fetchImpl: fakeFetch(
        jsonResponse(403, {
          code: 'seox_security_invalid_credentials',
          message: 'The admin_token and project_id do not match this WordPress site.',
        })
      ),
    }),
    (error) => {
      assert.equal(error.status, 403);
      assert.match(error.message, /do not match this WordPress site/);
      return true;
    }
  );
});

test('a site without the plugin route is reported as a missing endpoint', async () => {
  await assert.rejects(
    runPortalScan({
      siteUrl: 'https://example.com',
      adminToken: TOKEN,
      projectId: 'proj_1',
      fetchImpl: fakeFetch(jsonResponse(404, { code: 'rest_no_route' })),
    }),
    (error) => error.status === 404 && /SEOX plugin/.test(error.message)
  );
});

test('success: false is treated as a failed scan, not as data', async () => {
  await assert.rejects(
    runPortalScan({
      siteUrl: 'https://example.com',
      adminToken: TOKEN,
      projectId: 'proj_1',
      fetchImpl: fakeFetch(jsonResponse(200, { success: false, message: 'Scan failed to start.' })),
    }),
    (error) => error.status === 502 && /Scan failed to start/.test(error.message)
  );
});

test('a response that is not JSON is reported rather than parsed', async () => {
  await assert.rejects(
    runPortalScan({
      siteUrl: 'https://example.com',
      adminToken: TOKEN,
      projectId: 'proj_1',
      fetchImpl: fakeFetch(jsonResponse(200, '<html>maintenance</html>')),
    }),
    (error) => error.status === 502 && /could not be read/.test(error.message)
  );
});

test('a 200 with no data block is refused', async () => {
  await assert.rejects(
    runPortalScan({
      siteUrl: 'https://example.com',
      adminToken: TOKEN,
      projectId: 'proj_1',
      fetchImpl: fakeFetch(jsonResponse(200, { success: true, message: 'ok' })),
    }),
    (error) => error.status === 502 && /no scan data/.test(error.message)
  );
});

test('a network failure and a timeout are told apart', async () => {
  await assert.rejects(
    runPortalScan({
      siteUrl: 'https://example.com',
      adminToken: TOKEN,
      projectId: 'proj_1',
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    }),
    (error) => error.status === 502 && /could not be reached/.test(error.message)
  );

  await assert.rejects(
    runPortalScan({
      siteUrl: 'https://example.com',
      adminToken: TOKEN,
      projectId: 'proj_1',
      timeoutMs: 1000,
      fetchImpl: async () => {
        const error = new Error('The operation was aborted due to timeout');
        error.name = 'TimeoutError';
        throw error;
      },
    }),
    (error) => error.status === 504 && /did not finish the scan/.test(error.message)
  );
});

test('a token echoed back by the site is redacted before it reaches the user', async () => {
  await assert.rejects(
    runPortalScan({
      siteUrl: 'https://example.com',
      adminToken: TOKEN,
      projectId: 'proj_1',
      fetchImpl: fakeFetch(jsonResponse(403, { message: `Token ${TOKEN} is not valid for this site.` })),
    }),
    (error) => {
      assert.ok(!error.message.includes(TOKEN), 'the token must not appear in the error');
      assert.match(error.message, /\[redacted\]/);
      return true;
    }
  );

  assert.equal(redactToken(`a ${TOKEN} b`, TOKEN), 'a [redacted] b');
  // Too short to redact safely - a three-character token would blank out
  // ordinary words in the message.
  assert.equal(redactToken('abc def', 'abc'), 'abc def');
});
