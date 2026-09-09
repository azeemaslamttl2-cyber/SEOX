import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './llms-generator.js';

function request(body, options = {}) {
  const { method = 'POST', headers = {} } = options;
  return new Request('https://example.com/api/geo/llms-generator', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: method !== 'GET' && method !== 'OPTIONS' ? JSON.stringify(body) : undefined,
  });
}

test('LLMs Generator requires admin_token in the JSON body for external requests', async () => {
  const response = await onRequest({
    request: request({ url: 'https://example.com' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.equal(payload.status, 'validation_error');
  assert.match(payload.message, /admin_token/i);
});

test('LLMs Generator rejects an invalid admin_token before URL processing', async () => {
  const response = await onRequest({
    request: request({ admin_token: 'bad-token', url: 'https://example.com' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.equal(payload.success, false);
  assert.equal(payload.status, 'unauthorized');
  assert.match(payload.message, /invalid admin token/i);
});

test('LLMs Generator rejects a missing URL after authenticating admin token', async () => {
  const response = await onRequest({
    request: request({ admin_token: 'valid-token' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.equal(payload.status, 'validation_error');
  assert.match(payload.message, /url is required/i);
});

test('LLMs Generator rejects private/local URLs before crawling', async () => {
  const response = await onRequest({
    request: request({ admin_token: 'valid-token', url: 'http://127.0.0.1:3000' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /private|local|metadata/i);
});

test('LLMs Generator rejects invalid mode', async () => {
  const response = await onRequest({
    request: request({ admin_token: 'valid-token', url: 'https://example.com', mode: 'invalid-mode' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /mode must be crawl or sitemap/i);
});

test('LLMs Generator handles OPTIONS method for CORS preflight', async () => {
  const response = await onRequest({
    request: request(null, { method: 'OPTIONS' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  assert.equal(response.status, 204);
});

test('LLMs Generator rejects non-POST requests with 405', async () => {
  const response = await onRequest({
    request: request(null, { method: 'GET' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  const payload = await response.json();
  assert.equal(response.status, 405);
  assert.equal(payload.success, false);
  assert.match(payload.message, /method not allowed/i);
});
