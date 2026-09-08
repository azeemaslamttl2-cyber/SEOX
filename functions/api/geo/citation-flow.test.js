import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './citation-flow.js';

function request(body) {
  return new Request('https://example.com/api/geo/citation-flow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('Citation Flow requires admin_token in the JSON body', async () => {
  const response = await onRequest({ request: request({ url: 'https://example.com' }), env: { ADMIN_TOKEN: 'valid-token' } });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /admin_token/i);
});

test('Citation Flow rejects an invalid token before URL processing', async () => {
  const response = await onRequest({ request: request({ admin_token: 'bad-token', url: 'https://example.com' }), env: { ADMIN_TOKEN: 'valid-token' } });
  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.equal(payload.success, false);
  assert.match(payload.message, /invalid admin token/i);
});

test('Citation Flow rejects a missing URL after authentication', async () => {
  const response = await onRequest({ request: request({ admin_token: 'valid-token' }), env: { ADMIN_TOKEN: 'valid-token' } });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /url is required/i);
});

test('Citation Flow rejects private URLs without scraping or database writes', async () => {
  const response = await onRequest({ request: request({ admin_token: 'valid-token', url: 'http://127.0.0.1:3000' }), env: { ADMIN_TOKEN: 'valid-token' } });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /private|local|metadata/i);
});
