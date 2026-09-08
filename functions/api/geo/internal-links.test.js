import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './internal-links.js';

function request(body, headers = {}) {
  return new Request('https://example.com/api/geo/internal-links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('Internal Links accepts external admin_token in the JSON body', async () => {
  const response = await onRequest({ request: request({ admin_token: 'valid-token' }), env: { ADMIN_TOKEN: 'valid-token' } });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /url is required/i);
});

test('Internal Links rejects missing external admin_token', async () => {
  const response = await onRequest({ request: request({ url: 'https://example.com' }), env: { ADMIN_TOKEN: 'valid-token' } });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /admin_token/i);
});

test('Internal Links rejects invalid external admin_token', async () => {
  const response = await onRequest({ request: request({ admin_token: 'bad-token', url: 'https://example.com' }), env: { ADMIN_TOKEN: 'valid-token' } });
  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.equal(payload.success, false);
  assert.match(payload.message, /invalid admin token/i);
});

test('Internal Links rejects private URLs before crawling', async () => {
  const response = await onRequest({ request: request({ admin_token: 'valid-token', url: 'http://127.0.0.1:3000' }), env: { ADMIN_TOKEN: 'valid-token' } });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /private|local|metadata/i);
});
