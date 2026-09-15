import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './outline.js';
import { extractMainContent, getPageTitle } from '../../../src/utils/fetchAndParse.js';

test('outline API rejects missing admin token', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/content/outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: ['https://example.com'] }),
    }),
    env: { AUTH_JWT_SECRET: '12345678901234567890123456789012', ADMIN_TOKEN: 'valid-token' },
  });

  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.match(String(payload.message || payload.error || ''), /admin_token/i);
});

test('outline API rejects invalid admin token', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/content/outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_token: 'bad-token', urls: ['https://example.com'] }),
    }),
    env: { AUTH_JWT_SECRET: '12345678901234567890123456789012', ADMIN_TOKEN: 'valid-token' },
  });

  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.match(String(payload.message || payload.error || ''), /invalid admin token|admin token/i);
});

test('outline API rejects missing required URL input', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/content/outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_token: 'valid-token' }),
    }),
    env: { AUTH_JWT_SECRET: '12345678901234567890123456789012', ADMIN_TOKEN: 'valid-token' },
  });

  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.match(String(payload.message || payload.error || ''), /urls|url/i);
});

test('content parsing falls back when DOMParser is unavailable in Node', () => {
  const previous = globalThis.DOMParser;
  delete globalThis.DOMParser;

  try {
    const html = `
      <html>
        <head><title>Example Title</title></head>
        <body>
          <main>
            <h1>Alpha Header</h1>
            <p>Some useful article text.</p>
            <h2>Beta Section</h2>
          </main>
        </body>
      </html>
    `;

    assert.equal(getPageTitle(html), 'Example Title');
    assert.match(extractMainContent(html), /Alpha Header|Some useful article text|Beta Section/);
  } finally {
    if (previous) globalThis.DOMParser = previous;
  }
});

const ENV = { AUTH_JWT_SECRET: '12345678901234567890123456789012', ADMIN_TOKEN: 'valid-token' };

const PAGE_HTML = `
  <html>
    <head><title>Competitor Page</title></head>
    <body>
      <h1>Digital Marketing Guide</h1>
      <h2>Channel Strategy</h2>
      <h3>Paid Search</h3>
    </body>
  </html>
`;

function outlineRequest(body) {
  return new Request('https://example.com/api/content/outline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

test('outline API rejects non-POST methods', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/content/outline', { method: 'GET' }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 405);
  assert.equal(payload.success, false);
  assert.equal(payload.status, 'method_not_allowed');
});

test('outline API answers CORS preflight', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/content/outline', { method: 'OPTIONS' }),
    env: ENV,
  });
  assert.equal(response.status, 204);
});

test('outline API rejects invalid URL values', async () => {
  const response = await onRequest({
    request: outlineRequest({ admin_token: 'valid-token', urls: ['javascript:alert(1)'] }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.status, 'validation_error');
  assert.match(payload.errors.urls, /Only HTTP and HTTPS/i);
});

test('outline API blocks private/internal network targets (SSRF guard)', async () => {
  const response = await onRequest({
    request: outlineRequest({ admin_token: 'valid-token', urls: ['http://127.0.0.1/admin'] }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /Private, local, and metadata network URLs are not allowed/i);
});

test('outline API returns JSON on upstream fetch failure', async () => {
  const response = await withStubbedFetch(
    async () => new Response('nope', { status: 503 }),
    () => onRequest({
      request: outlineRequest({ admin_token: 'valid-token', urls: ['https://example.com'] }),
      env: ENV,
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.equal(payload.success, false);
  assert.equal(payload.status, 'upstream_error');
  assert.match(payload.message, /Failed to fetch page content/i);
});

test('outline API generates an outline and reports the DeepSeek step', async () => {
  const calls = [];
  const response = await withStubbedFetch(
    async (url, init) => {
      calls.push(String(url));
      if (String(url).includes('api.deepseek.com')) {
        assert.match(init.headers.Authorization, /^Bearer env-key$/);
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    outline: [
                      { tag: 'h1', text: 'The Complete Digital Marketing Guide' },
                      { tag: 'h2', text: 'Channel Strategy' },
                    ],
                  }),
                },
              },
            ],
            usage: { total_tokens: 10 },
            model: 'deepseek-chat',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(PAGE_HTML, { status: 200, headers: { 'Content-Type': 'text/html' } });
    },
    () => onRequest({
      request: outlineRequest({ admin_token: 'valid-token', urls: ['https://example.com/guide'] }),
      env: { ...ENV, DEEPSEEK_API_KEY: 'env-key' },
    })
  );

  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.status, 'success');
  assert.equal(payload.data.ai.applied, true);
  assert.equal(payload.data.extractedCount, 3);
  assert.equal(payload.data.headingCount, 2);
  assert.deepEqual(payload.data.outline, [
    { tag: 'h1', text: 'The Complete Digital Marketing Guide' },
    { tag: 'h2', text: 'Channel Strategy' },
  ]);
  assert.ok(calls.some((url) => url.includes('api.deepseek.com')));
});

test('outline API degrades to extracted headings when DeepSeek fails', async () => {
  const response = await withStubbedFetch(
    async (url) => {
      if (String(url).includes('api.deepseek.com')) {
        return new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(PAGE_HTML, { status: 200, headers: { 'Content-Type': 'text/html' } });
    },
    () => onRequest({
      request: outlineRequest({ admin_token: 'valid-token', urls: ['https://example.com/guide'] }),
      env: { ...ENV, DEEPSEEK_API_KEY: 'env-key' },
    })
  );

  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.ai.applied, false);
  assert.match(payload.data.ai.reason, /quota exceeded/i);
  assert.equal(payload.data.headingCount, 3);
});

test('outline API reports when no headings exist on the page', async () => {
  const response = await withStubbedFetch(
    async () => new Response('<html><body><p>nothing</p></body></html>', { status: 200 }),
    () => onRequest({
      request: outlineRequest({ admin_token: 'valid-token', urls: ['https://example.com'] }),
      env: { ...ENV, DEEPSEEK_API_KEY: 'env-key' },
    })
  );

  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data.outline, []);
  assert.match(payload.message, /No headings were found/i);
});

test('outline API never leaks the DeepSeek key or stack traces', async () => {
  const response = await withStubbedFetch(
    async () => {
      throw new Error('socket hang up');
    },
    () => onRequest({
      request: outlineRequest({ admin_token: 'valid-token', urls: ['https://example.com'] }),
      env: { ...ENV, DEEPSEEK_API_KEY: 'super-secret-key' },
    })
  );

  const raw = await response.text();
  assert.doesNotMatch(raw, /super-secret-key/);
  assert.doesNotMatch(raw, /valid-token/);
  assert.doesNotMatch(raw, /at \w+ \(/);
  JSON.parse(raw);
});

test('outline API advertises admin_token only - no Authorization header', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/content/outline', { method: 'OPTIONS' }),
    env: ENV,
  });

  const allowed = response.headers.get('access-control-allow-headers') || '';
  assert.equal(allowed, 'Content-Type');
  assert.doesNotMatch(allowed, /authorization/i);
});

test('outline API ignores an Authorization header and still requires admin_token', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/content/outline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer some-session-token',
      },
      body: JSON.stringify({ urls: ['https://example.com'] }),
    }),
    env: ENV,
  });

  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.errors.admin_token, 'admin_token is required.');
});

test('a Bearer token is never accepted in place of admin_token', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/content/outline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ admin_token: 'bogus', urls: ['https://example.com'] }),
    }),
    env: ENV,
  });

  assert.equal(response.status, 401);
});
