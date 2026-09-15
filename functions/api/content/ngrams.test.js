import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './ngrams.js';

const ENV = { AUTH_JWT_SECRET: '12345678901234567890123456789012', ADMIN_TOKEN: 'valid-token' };

const SAMPLE = `
  Technical SEO audits review crawl budget and index coverage.
  Technical SEO audits also review crawl budget problems.
  Crawl budget matters for technical SEO audits.
`;

const PAGE_HTML = `
  <html><head><title>Crawl Budget</title></head>
    <body><main><h1>Crawl Budget Guide</h1>
      <p>Technical SEO audits review crawl budget. Technical SEO audits review index coverage.</p>
    </main></body></html>
`;

function req(body, init = {}) {
  return new Request('https://example.com/api/content/ngrams', {
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
  const response = await onRequest({ request: req({ mode: 'text', text: SAMPLE }), env: ENV });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.equal(payload.errors.admin_token, 'admin_token is required.');
});

test('rejects an invalid admin_token', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'bogus', mode: 'text', text: SAMPLE }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.status, 'unauthorized');
  assert.equal(payload.message, 'Invalid admin token.');
});

test('accepts a valid admin_token', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'valid-token', mode: 'text', text: SAMPLE }),
    env: ENV,
  });

  assert.equal(response.status, 200);
});

test('an Authorization header is never accepted in place of admin_token', async () => {
  const response = await onRequest({
    request: req({ mode: 'text', text: SAMPLE }, { headers: { Authorization: 'Bearer valid-token' } }),
    env: ENV,
  });

  assert.equal(response.status, 400);
});

test('advertises Content-Type only - no Authorization header', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/content/ngrams', { method: 'OPTIONS' }),
    env: ENV,
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-headers'), 'Content-Type');
});

test('processing never runs before authentication succeeds', async () => {
  let fetched = false;
  await withStubbedFetch(
    async () => {
      fetched = true;
      return new Response(PAGE_HTML, { status: 200 });
    },
    () => onRequest({
      request: req({ admin_token: 'bogus', mode: 'url', url: 'https://example.com' }),
      env: ENV,
    })
  );

  assert.equal(fetched, false);
});

/* ── method / input validation ── */

test('rejects non-POST methods', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/content/ngrams', { method: 'GET' }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 405);
  assert.equal(payload.status, 'method_not_allowed');
});

test('rejects an empty payload', async () => {
  const response = await onRequest({ request: req({}), env: ENV });
  assert.equal(response.status, 400);
});

test('rejects text mode with empty text', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'valid-token', mode: 'text', text: '   ' }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.status, 'validation_error');
  assert.match(payload.errors.text, /text is required/i);
});

test('rejects a missing url in url mode', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'valid-token', mode: 'url' }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.errors.url, /url is required/i);
});

test('rejects an invalid n-gram size', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'valid-token', mode: 'text', text: SAMPLE, n: 7 }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.errors.n, /must be one of: 1, 2, 3/i);
});

test('accepts every supported n-gram size', async () => {
  for (const n of [1, 2, 3]) {
    const response = await onRequest({
      request: req({ admin_token: 'valid-token', mode: 'text', text: SAMPLE, n }),
      env: ENV,
    });
    const payload = await response.json();

    assert.equal(response.status, 200, `size ${n} should be accepted`);
    assert.deepEqual(payload.data.sizes, [n]);
  }
});

test('blocks private/internal network targets (SSRF guard)', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'valid-token', mode: 'url', url: 'http://127.0.0.1/admin' }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.message, /Private, local, and metadata network URLs are not allowed/i);
});

/* ── processing ── */

test('extracts n-grams from text with the page result shape', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'valid-token', mode: 'text', text: SAMPLE }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.message, 'N-grams extracted successfully.');

  const { data } = payload;
  assert.equal(data.mode, 'text');
  assert.deepEqual(data.sizes, [1, 2, 3]);
  assert.deepEqual(Object.keys(data.ngrams), ['unigrams', 'bigrams', 'trigrams']);

  for (const item of data.ngrams.unigrams) {
    assert.deepEqual(Object.keys(item).sort(), ['count', 'density', 'ngram']);
  }

  const trigram = data.ngrams.trigrams.find((i) => i.ngram === 'technical seo audits');
  assert.equal(trigram.count, 3);
});

test('extracts n-grams from a URL', async () => {
  const response = await withStubbedFetch(
    async () => new Response(PAGE_HTML, { status: 200, headers: { 'Content-Type': 'text/html' } }),
    () => onRequest({
      request: req({ admin_token: 'valid-token', mode: 'url', url: 'https://example.com/x' }),
      env: ENV,
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.url, 'https://example.com/x');
  assert.ok(payload.data.ngrams.bigrams.length > 0);
});

test('handles a large body of text', async () => {
  const large = `${SAMPLE} `.repeat(2000);
  const response = await onRequest({
    request: req({ admin_token: 'valid-token', mode: 'text', text: large }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.ngrams.unigrams.length > 0, true);
  // countNgrams caps each size at 50 entries
  assert.ok(payload.data.ngrams.unigrams.length <= 50);
});

test('the unique step is skipped by default and makes no AI call', async () => {
  let called = false;
  const response = await withStubbedFetch(
    async (url) => {
      if (String(url).includes('api.deepseek.com')) called = true;
      return new Response('{}', { status: 200 });
    },
    () => onRequest({
      request: req({ admin_token: 'valid-token', mode: 'text', text: SAMPLE }),
      env: { ...ENV, DEEPSEEK_API_KEY: 'env-key' },
    })
  );
  const payload = await response.json();

  assert.equal(called, false);
  assert.equal(payload.data.unique.requested, false);
});

test('runs the unique step via DeepSeek when requested', async () => {
  const response = await withStubbedFetch(
    async (url, init) => {
      assert.match(String(url), /api\.deepseek\.com/);
      assert.equal(init.headers.Authorization, 'Bearer env-key');
      return new Response(
        JSON.stringify({
          choices: [
            { message: { content: JSON.stringify({ ngrams: ['crawl budget decay', 'index bloat signals'] }) } },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    },
    () => onRequest({
      request: req({ admin_token: 'valid-token', mode: 'text', text: SAMPLE, includeUnique: true }),
      env: { ...ENV, DEEPSEEK_API_KEY: 'env-key' },
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.unique.requested, true);
  assert.equal(payload.data.unique.applied, true);
  assert.deepEqual(payload.data.unique.ngrams, ['crawl budget decay', 'index bloat signals']);
});

test('the unique step degrades locally when DeepSeek fails', async () => {
  const response = await withStubbedFetch(
    async () =>
      new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    () => onRequest({
      request: req({ admin_token: 'valid-token', mode: 'text', text: SAMPLE, includeUnique: true }),
      env: { ...ENV, DEEPSEEK_API_KEY: 'env-key' },
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.unique.applied, false);
  assert.match(payload.data.unique.reason, /quota exceeded/i);
  assert.ok(payload.data.unique.ngrams.length > 0);
});

test('reports a JSON error when the target page cannot be fetched', async () => {
  const response = await withStubbedFetch(
    async () => new Response('nope', { status: 503 }),
    () => onRequest({
      request: req({ admin_token: 'valid-token', mode: 'url', url: 'https://example.com' }),
      env: ENV,
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.equal(payload.status, 'upstream_error');
});

test('reports when no n-grams could be extracted', async () => {
  const response = await withStubbedFetch(
    async () => new Response('<html><body><p>.</p></body></html>', { status: 200 }),
    () => onRequest({
      request: req({ admin_token: 'valid-token', mode: 'url', url: 'https://example.com' }),
      env: ENV,
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.match(payload.message, /No n-grams were found/i);
});

test('never leaks secrets, the token, or stack traces', async () => {
  const response = await withStubbedFetch(
    async () => {
      throw new Error('connect ECONNREFUSED 10.0.0.5:3306 password=hunter2');
    },
    () => onRequest({
      request: req({ admin_token: 'valid-token', mode: 'url', url: 'https://example.com' }),
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
