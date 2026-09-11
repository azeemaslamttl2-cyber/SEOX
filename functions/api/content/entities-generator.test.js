import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './entities-generator.js';

const ENV = { AUTH_JWT_SECRET: '12345678901234567890123456789012', ADMIN_TOKEN: 'valid-token' };

function req(body, init = {}) {
  return new Request('https://example.com/api/content/entities-generator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    body: JSON.stringify(body),
  });
}

function deepseekResponse(groups) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ groups }) } }],
      usage: { total_tokens: 10 },
      model: 'deepseek-chat',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
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
  const response = await onRequest({ request: req({ keywords: 'seo tools' }), env: ENV });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.equal(payload.errors.admin_token, 'admin_token is required.');
});

test('rejects an invalid admin_token', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'bogus', keywords: 'seo tools' }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.status, 'unauthorized');
  assert.equal(payload.message, 'Invalid admin token.');
});

test('accepts a valid admin_token', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'valid-token', keywords: 'seo tools' }),
    env: ENV,
  });

  assert.equal(response.status, 200);
});

test('an Authorization header is never accepted in place of admin_token', async () => {
  const response = await onRequest({
    request: req({ keywords: 'seo tools' }, { headers: { Authorization: 'Bearer valid-token' } }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.errors.admin_token, 'admin_token is required.');
});

test('advertises Content-Type only - no Authorization header', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/content/entities-generator', { method: 'OPTIONS' }),
    env: ENV,
  });

  assert.equal(response.status, 204);
  const allowed = response.headers.get('access-control-allow-headers') || '';
  assert.equal(allowed, 'Content-Type');
  assert.doesNotMatch(allowed, /authorization/i);
});

test('no AI call is made before authentication succeeds', async () => {
  let called = false;
  await withStubbedFetch(
    async () => {
      called = true;
      return deepseekResponse([]);
    },
    () => onRequest({
      request: req({ admin_token: 'bogus', keywords: 'seo tools' }),
      env: { ...ENV, DEEPSEEK_API_KEY: 'env-key' },
    })
  );

  assert.equal(called, false, 'DeepSeek must not be called for an unauthenticated caller');
});

/* ── method / input validation ── */

test('rejects non-POST methods', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/content/entities-generator', { method: 'GET' }),
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

test('rejects missing keywords', async () => {
  const response = await onRequest({ request: req({ admin_token: 'valid-token' }), env: ENV });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.status, 'validation_error');
  assert.match(payload.errors.keywords, /keywords is required/i);
});

test('rejects blank keywords', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'valid-token', keywords: '  ,  \n ' }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.errors.keywords, /At least one keyword is required/i);
});

test('rejects a wrong keywords type', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'valid-token', keywords: 42 }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.errors.keywords, /string or an array of strings/i);
});

test('rejects too many keywords', async () => {
  const response = await onRequest({
    request: req({
      admin_token: 'valid-token',
      keywords: Array.from({ length: 60 }, (_, i) => `kw${i}`),
    }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.errors.keywords, /maximum of 50 keywords/i);
});

/* ── processing ── */

test('generates entities via DeepSeek with the resolved key', async () => {
  const response = await withStubbedFetch(
    async (url, init) => {
      assert.match(String(url), /api\.deepseek\.com/);
      assert.equal(init.headers.Authorization, 'Bearer env-key');
      return deepseekResponse([
        { keyword: 'seo tools', entities: ['Ahrefs', 'SEMrush', 'Moz Pro'] },
        { keyword: 'keyword research', entities: ['Search Volume', 'CPC'] },
      ]);
    },
    () => onRequest({
      request: req({ admin_token: 'valid-token', keywords: 'seo tools, keyword research' }),
      env: { ...ENV, DEEPSEEK_API_KEY: 'env-key' },
    })
  );

  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.status, 'success');
  assert.equal(payload.message, 'Entities generated successfully.');
  assert.equal(payload.data.ai.applied, true);
  assert.equal(payload.data.keywordCount, 2);
  assert.equal(payload.data.entityCount, 5);
  assert.deepEqual(payload.data.groups, [
    { keyword: 'seo tools', entities: ['Ahrefs', 'SEMrush', 'Moz Pro'] },
    { keyword: 'keyword research', entities: ['Search Volume', 'CPC'] },
  ]);
});

test('degrades to the local generator when DeepSeek fails', async () => {
  const response = await withStubbedFetch(
    async () =>
      new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    () => onRequest({
      request: req({ admin_token: 'valid-token', keywords: 'seo tools' }),
      env: { ...ENV, DEEPSEEK_API_KEY: 'env-key' },
    })
  );

  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.ai.applied, false);
  assert.match(payload.data.ai.reason, /quota exceeded/i);
  assert.match(payload.message, /local fallback/i);
  assert.ok(payload.data.groups[0].entities.length > 0);
});

test('reports a configuration failure when no DeepSeek key exists', async () => {
  const response = await onRequest({
    request: req({ admin_token: 'valid-token', keywords: 'seo tools' }),
    env: ENV,
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.ai.applied, false);
  assert.match(payload.data.ai.reason, /DeepSeek API is not configured/i);
  assert.ok(payload.data.groups[0].entities.length > 0, 'local fallback still returns entities');
});

test('handles malformed AI JSON by falling back', async () => {
  const response = await withStubbedFetch(
    async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'not json at all' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ),
    () => onRequest({
      request: req({ admin_token: 'valid-token', keywords: 'seo tools' }),
      env: { ...ENV, DEEPSEEK_API_KEY: 'env-key' },
    })
  );

  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.ai.applied, false);
  assert.ok(payload.data.groups[0].entities.length > 0);
});

test('never leaks secrets, the token, or stack traces', async () => {
  const response = await withStubbedFetch(
    async () => {
      throw new Error('connect ECONNREFUSED 10.0.0.5:3306 password=hunter2');
    },
    () => onRequest({
      request: req({ admin_token: 'valid-token', keywords: 'seo tools' }),
      env: { ...ENV, DEEPSEEK_API_KEY: 'super-secret-key' },
    })
  );

  const raw = await response.text();
  assert.doesNotMatch(raw, /super-secret-key/);
  assert.doesNotMatch(raw, /valid-token/);
  assert.doesNotMatch(raw, /at \w+ \(/);
  JSON.parse(raw);
});
