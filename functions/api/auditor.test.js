import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './auditor.js';
import * as route from '../../app/api/auditor/route.js';
import { buildAuditorApiPayload } from '../_lib/auditor-engine.js';

function request(body, options = {}) {
  const { method = 'POST', headers = {} } = options;
  return new Request('https://example.com/api/auditor', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: method !== 'GET' && method !== 'OPTIONS' ? JSON.stringify(body) : undefined,
  });
}

test('Auditor App Router route exports POST and OPTIONS handlers', () => {
  assert.equal(typeof route.POST, 'function');
  assert.equal(typeof route.OPTIONS, 'function');
});

test('Auditor API handles OPTIONS preflight request', async () => {
  const response = await onRequest({
    request: request({}, { method: 'OPTIONS' }),
    env: {},
  });
  assert.equal(response.status, 200);
});

test('Auditor API rejects non-POST requests with 405', async () => {
  const response = await onRequest({
    request: request({}, { method: 'GET' }),
    env: {},
  });
  assert.equal(response.status, 405);
  const data = await response.json();
  assert.equal(data.success, false);
  assert.equal(data.status, 'method_not_allowed');
});

test('Auditor API requires admin_token or session for external requests in production', async () => {
  const origEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const response = await onRequest({
      request: request({ project_id: 'proj_123' }),
      env: { ADMIN_TOKEN: 'valid-token' },
    });
    const data = await response.json();
    assert.equal(response.status, 400);
    assert.equal(data.success, false);
    assert.match(data.message, /admin_token is required/i);
  } finally {
    process.env.NODE_ENV = origEnv;
  }
});

test('Auditor API validates missing project_id and url', async () => {
  const response = await onRequest({
    request: request({ admin_token: 'secret' }),
    env: { ADMIN_TOKEN: 'secret' },
  });
  const data = await response.json();
  assert.equal(response.status, 400);
  assert.equal(data.success, false);
  assert.match(data.message, /project_id or url is required/i);
});

test('Auditor API accepts configured admin token in the bearer header', async () => {
  const response = await onRequest({
    request: request({}, { headers: { Authorization: 'Bearer valid-token' } }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  const data = await response.json();
  assert.equal(response.status, 400);
  assert.equal(data.status, 'validation_error');
  assert.match(data.message, /project_id or url/i);
});

test('Auditor API accepts camelCase adminToken in the request body', async () => {
  const response = await onRequest({
    request: request({ adminToken: 'valid-token' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  const data = await response.json();
  assert.equal(response.status, 400);
  assert.equal(data.status, 'validation_error');
  assert.match(data.message, /project_id or url/i);
});

test('Auditor calculation engine produces all 24 menu sections with complete data', () => {
  const sampleProject = {
    id: 'proj_test_123',
    name: 'Example Site',
    domain: 'example.com',
    fullUrl: 'https://example.com',
    crawledOn: '2026-09-08T12:00:00.000Z',
    totalUrls: 5,
    urlLimit: 1000,
  };

  const sampleStats = {
    status: 'complete',
    crawledCount: 5,
    scheduled: 0,
    duration: 12,
    startedAt: '2026-09-08T12:00:00.000Z',
    finishedAt: '2026-09-08T12:00:12.000Z',
    byStatus: { '2xx': 4, '3xx': 1, '4xx': 0, '5xx': 0 },
    latestUrls: [
      {
        url: 'https://example.com/',
        status: 200,
        contentType: 'text/html; charset=utf-8',
        title: 'Example Domain Homepage',
        h1: 'Welcome to Example',
        metaDescription: 'A comprehensive website for example domain testing and SEO audit.',
        contentText: 'Welcome to Example. Here is our product line and services guide for everyone.',
        depth: 0,
        sizeKb: 45,
        loadTime: 230,
        links: [
          { url: 'https://example.com/about', anchor: 'About Us', nofollow: false },
          { url: 'https://example.com/services', anchor: 'Our Services', nofollow: false },
          { url: 'https://external-partner.com/info', anchor: 'Partner Site', nofollow: true },
        ],
        resources: [
          { url: 'https://example.com/logo.png', type: 'image' },
          { url: 'https://example.com/style.css', type: 'css' },
          { url: 'https://example.com/app.js', type: 'javascript' },
        ],
        audit: {
          wordCount: 150,
          titleCount: 1,
          titleText: 'Example Domain Homepage',
          metaDescriptionCount: 1,
          metaDescriptionText: 'A comprehensive website for example domain testing and SEO audit.',
          h1Count: 1,
          h1Text: 'Welcome to Example',
          ogTags: { 'og:title': 'Example Domain Homepage', 'og:type': 'website', 'og:image': 'https://example.com/logo.png', 'og:url': 'https://example.com/' },
          twitterTags: { 'twitter:card': 'summary_large_image', 'twitter:title': 'Example Domain', 'twitter:description': 'Example description', 'twitter:image': 'https://example.com/logo.png' },
        },
      },
      {
        url: 'https://example.com/about',
        status: 200,
        contentType: 'text/html; charset=utf-8',
        title: 'About Our Company',
        h1: 'About Us',
        metaDescription: 'Learn about our company background, mission, and leadership team.',
        contentText: 'About our company and our history in the SEO and software industry.',
        depth: 1,
        sizeKb: 38,
        loadTime: 180,
        links: [
          { url: 'https://example.com/', anchor: 'Home', nofollow: false },
          { url: 'https://example.com/services', anchor: 'Services', nofollow: false },
        ],
        resources: [
          { url: 'https://example.com/team.jpg', type: 'image' },
        ],
        audit: {
          wordCount: 120,
          titleCount: 1,
          titleText: 'About Our Company',
          metaDescriptionCount: 1,
          metaDescriptionText: 'Learn about our company background, mission, and leadership team.',
          h1Count: 1,
          h1Text: 'About Us',
        },
      },
      {
        url: 'https://example.com/services',
        status: 200,
        contentType: 'text/html; charset=utf-8',
        title: 'Our Services and Solutions',
        h1: 'Services',
        metaDescription: 'Explore our full range of enterprise and professional services.',
        contentText: 'Explore our professional services and software solutions for modern teams.',
        depth: 1,
        sizeKb: 52,
        loadTime: 310,
        links: [
          { url: 'https://example.com/', anchor: 'Home', nofollow: false },
          { url: 'https://example.com/old-page', anchor: 'Old Page', nofollow: false },
        ],
        resources: [
          { url: 'https://example.com/hero.webp', type: 'image' },
        ],
        audit: {
          wordCount: 200,
          titleCount: 1,
          titleText: 'Our Services and Solutions',
          metaDescriptionCount: 1,
          metaDescriptionText: 'Explore our full range of enterprise and professional services.',
          h1Count: 1,
          h1Text: 'Services',
        },
      },
      {
        url: 'https://example.com/old-page',
        status: 301,
        location: 'https://example.com/services',
        contentType: 'text/html; charset=utf-8',
        title: 'Redirecting...',
        depth: 1,
        sizeKb: 2,
        loadTime: 90,
        links: [],
        resources: [],
        audit: { redirectTarget: 'https://example.com/services' },
      },
      {
        url: 'https://example.com/logo.png',
        status: 200,
        contentType: 'image/png',
        depth: 1,
        sizeKb: 15,
        loadTime: 65,
        links: [],
        resources: [],
      },
    ],
    auditIssues: {
      '3xx-redirect': {
        severity: 'warning',
        title: '3XX redirect',
        fixable: true,
        urls: [{ url: 'https://example.com/old-page', status: 301, title: 'Redirecting...' }],
      },
      'missing-alt-text': {
        severity: 'warning',
        title: 'Image without alt text',
        fixable: true,
        urls: [{ url: 'https://example.com/', status: 200, title: 'Example Homepage' }],
      },
    },
  };

  const payload = buildAuditorApiPayload(sampleProject, sampleStats);

  // 1. Root & Project metadata
  assert.ok(payload.project);
  assert.equal(payload.project.id, 'proj_test_123');
  assert.equal(payload.project.domain, 'example.com');

  // 2. AUDIT section (5 items)
  assert.ok(payload.audit);
  assert.ok(payload.audit.overview, 'audit.overview must be present');
  assert.ok(payload.audit.overview.crawledUrls, 'audit.overview.crawledUrls must be present');
  assert.ok(payload.audit.overview.healthScore, 'audit.overview.healthScore must be present');
  assert.ok(Array.isArray(payload.audit.all_issues), 'audit.all_issues must be an array');
  assert.ok(payload.audit.bulk_export, 'audit.bulk_export must be present');
  assert.ok(Array.isArray(payload.audit.project_history), 'audit.project_history must be an array');
  assert.ok(payload.audit.crawl_log, 'audit.crawl_log must be present');
  assert.equal(payload.audit.crawl_log.urls.length, 5);

  // 3. TOOLS section (4 items)
  assert.ok(payload.tools);
  assert.ok(payload.tools.page_explorer, 'tools.page_explorer must be present');
  assert.equal(payload.tools.page_explorer.pages.length, 5);
  assert.ok(payload.tools.link_explorer, 'tools.link_explorer must be present');
  assert.ok(Array.isArray(payload.tools.link_explorer.links), 'tools.link_explorer.links must be an array');
  assert.ok(Array.isArray(payload.tools.internal_link_opportunities), 'tools.internal_link_opportunities must be an array');
  assert.ok(payload.tools.structure_explorer, 'tools.structure_explorer must be present');

  // 4. REPORTS section (15 items)
  assert.ok(payload.reports);
  assert.ok(payload.reports.internal_pages, 'reports.internal_pages must be present');
  assert.ok(payload.reports.indexability, 'reports.indexability must be present');
  assert.ok(payload.reports.links, 'reports.links must be present');
  assert.ok(payload.reports.redirects, 'reports.redirects must be present');
  assert.ok(payload.reports.content, 'reports.content must be present');
  assert.ok(payload.reports.social_tags, 'reports.social_tags must be present');
  assert.ok(payload.reports.duplicates, 'reports.duplicates must be present');
  assert.ok(payload.reports.localization, 'reports.localization must be present');
  assert.ok(payload.reports.performance, 'reports.performance must be present');
  assert.ok(payload.reports.images, 'reports.images must be present');
  assert.ok(payload.reports.javascript, 'reports.javascript must be present');
  assert.ok(payload.reports.css, 'reports.css must be present');
  assert.ok(payload.reports.external_pages, 'reports.external_pages must be present');
  assert.ok(payload.reports.sitemaps, 'reports.sitemaps must be present');
  assert.ok(payload.reports.other, 'reports.other must be present');
});
