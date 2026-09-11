import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './entities-extractor.js';

const ENV = { AUTH_JWT_SECRET: '12345678901234567890123456789012', ADMIN_TOKEN: 'valid-token' };

const ARTICLE = `
  Google announced a major update to Search Engine Optimization guidance.
  Google said the PageRank algorithm still matters. Search Engine Optimization
  experts at Moz and Ahrefs reviewed the Google announcement carefully.
`;

const PAGE_HTML = `
  <html><head><title>Ranking Factors</title></head>
    <body><main><h1>Google Ranking Factors</h1>
      <p>Google evaluates Search Engine Optimization signals. Google uses PageRank.</p>
    </main></body></html>
`;

function req(body, init = {}) {
  return new Request('https://example.com/api/content/entities-extractor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    body: JSON.stringify(body),
  });
}

async function withStubbedFetch(impl, run) {
  const previous = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await run();
  } finally {
    globalThis.fetch = previous;
  }
}

/* ── authentication ── */

test('rejects a request with no admin_token', async () => {
  const response = await onRequest({ request: req({ mode: 'text', content: ARTICLE }), env: ENV });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.equal(payload.errors.admin_token, 'admin_token is required.');
});

test('rejects an invalid admin_token', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'bogus', mode: 'text', content: ARTICLE }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.status, 'unauthorized');
  assert.equal(payload.message, 'Invalid admin token.');
});

test('rejects an over-long admin_token without touching the database', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'x'.repeat(600), mode: 'text', content: ARTICLE }),
    env: { ...ENV, MYSQL_HOST: 'db.invalid' },
  });

  assert.equal(response.status, 401);
});

test('accepts a valid admin_token', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'valid-token', mode: 'text', content: ARTICLE }),
    env: ENV,
  });

  assert.equal(response.status, 200);
});

test('an Authorization header is never accepted in place of admin_token', async () => {
  const response = await onRequest({
    request: req(
      { mode: 'text', content: ARTICLE },
      { headers: { Authorization: 'Bearer valid-token' } }
    ),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.errors.admin_token, 'admin_token is required.');
});

test('advertises Content-Type only - no Authorization header', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/content/entities-extractor', { method: 'OPTIONS' }),
    env: ENV,
  });

  assert.equal(response.status, 204);
  const allowed = response.headers.get('access-control-allow-headers') || '';
  assert.equal(allowed, 'Content-Type');
  assert.doesNotMatch(allowed, /authorization/i);
});

test('extraction never runs before authentication succeeds', async () => {
  let fetched = false;
  await withStubbedFetch(
    async () => {
      fetched = true;
      return new Response(PAGE_HTML, { status: 200 });
    },
    () => onRequest({
      request: req({ admin_token: 'bogus', mode: 'url', urls: ['https://example.com'] }),
      env: ENV,
    })
  );

  assert.equal(fetched, false, 'no page should be fetched for an unauthenticated caller');
});

/* ── method / input validation ── */

test('rejects non-POST methods', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/content/entities-extractor', { method: 'GET' }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 405);
  assert.equal(payload.status, 'method_not_allowed');
});

test('rejects an empty payload', async () => {
  const response = await onRequest({ request: req({}), env: ENV });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.errors.admin_token, 'admin_token is required.');
});

test('rejects text mode with no content', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'valid-token', mode: 'text' }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.status, 'validation_error');
  assert.match(payload.errors.content, /content is required/i);
});

test('rejects an invalid mode', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'valid-token', mode: 'pdf', content: 'x' }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.errors.mode, /mode must be one of/i);
});

test('rejects an invalid url', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'valid-token', mode: 'url', urls: ['javascript:alert(1)'] }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.errors.urls, /Only HTTP and HTTPS/i);
});

test('rejects an out-of-range limit', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'valid-token', mode: 'text', content: ARTICLE, limit: 9999 }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.errors.limit, /between 1 and 200/i);
});

test('blocks private/internal network targets (SSRF guard)', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'valid-token', mode: 'url', urls: ['http://169.254.169.254/latest/meta-data/'] }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.message, /Private, local, and metadata network URLs are not allowed/i);
});

/* ── processing ── */

test('extracts entities from text and returns the page result shape', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'valid-token', mode: 'text', content: ARTICLE }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.status, 'success');
  assert.equal(payload.message, 'Entities extracted successfully.');

  const { data } = payload;
  assert.equal(data.mode, 'text');
  assert.ok(data.entityCount > 0);
  assert.equal(data.entities.length, data.entityCount);
  assert.ok(Array.isArray(data.types) && data.types.length > 0);
  assert.equal(typeof data.averageSalience, 'number');

  for (const entity of data.entities) {
    assert.deepEqual(Object.keys(entity).sort(), ['entity', 'mentions', 'salience', 'type']);
  }
});

test('extracts entities from a URL', async () => {
  const response = await withStubbedFetch(
    async () => new Response(PAGE_HTML, { status: 200, headers: { 'Content-Type': 'text/html' } }),
    () => onRequest({
      request: req({ admin_token: 'valid-token', mode: 'url', urls: ['https://example.com/x'] }),
      env: ENV,
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.data.urls, ['https://example.com/x']);
  assert.ok(payload.data.entities.some((e) => e.entity === 'Google'));
});

test('defaults to url mode when mode is omitted, like the page', async () => {
  const response = await withStubbedFetch(
    async () => new Response(PAGE_HTML, { status: 200 }),
    () => onRequest({
      request: req({ admin_token: 'valid-token', urls: ['https://example.com'] }),
      env: ENV,
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.mode, 'url');
});

test('reports a JSON error when the target page cannot be fetched', async () => {
  const response = await withStubbedFetch(
    async () => new Response('nope', { status: 503 }),
    () => onRequest({
      request: req({ admin_token: 'valid-token', mode: 'url', urls: ['https://example.com'] }),
      env: ENV,
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.equal(payload.status, 'upstream_error');
  assert.match(payload.message, /Failed to fetch page content/i);
});

test('returns a clear message when nothing could be extracted', async () => {
  const response = await withStubbedFetch(
    async () => new Response('<html><body><p>.</p></body></html>', { status: 200 }),
    () => onRequest({
      request: req({ admin_token: 'valid-token', mode: 'url', urls: ['https://example.com'] }),
      env: ENV,
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data.entities, []);
  assert.match(payload.message, /No entities were found/i);
});

test('an unexpected failure returns generic JSON with no internals leaked', async () => {
  const response = await withStubbedFetch(
    async () => {
      const error = new Error('connect ECONNREFUSED 10.0.0.5:3306 password=hunter2');
      throw error;
    },
    () => onRequest({
      request: req({ admin_token: 'valid-token', mode: 'url', urls: ['https://example.com'] }),
      env: { ...ENV, DEEPSEEK_API_KEY: 'super-secret-key' },
    })
  );

  const raw = await response.text();
  assert.doesNotMatch(raw, /hunter2/);
  assert.doesNotMatch(raw, /super-secret-key/);
  assert.doesNotMatch(raw, /valid-token/);
  assert.doesNotMatch(raw, /at \w+ \(/);
  JSON.parse(raw);
});

test('the submitted admin_token is never echoed back', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'valid-token', mode: 'text', content: ARTICLE }),
    env: ENV,
  });

  const raw = await response.text();
  assert.doesNotMatch(raw, /valid-token/);
});
