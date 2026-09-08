import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './ai-chat.js';

function request(body, headers = {}) {
  return new Request('https://example.com/api/geo/ai-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('AI Chat requires authentication for external requests', async () => {
  const response = await onRequest({ request: request({ message: 'Hello' }), env: { ADMIN_TOKEN: 'valid-token' } });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /admin_token/i);
});

test('AI Chat rejects an invalid external admin token', async () => {
  const response = await onRequest({ request: request({ admin_token: 'bad-token', message: 'Hello' }), env: { ADMIN_TOKEN: 'valid-token' } });
  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.equal(payload.success, false);
  assert.match(payload.message, /invalid admin token/i);
});

test('AI Chat validates the message after authentication', async () => {
  const response = await onRequest({ request: request({ admin_token: 'valid-token' }), env: { ADMIN_TOKEN: 'valid-token' } });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /message is required/i);
});

test('AI Chat validates history structure', async () => {
  const response = await onRequest({ request: request({ admin_token: 'valid-token', message: 'Hello', history: [{ role: 'system', content: 'bad' }] }), env: { ADMIN_TOKEN: 'valid-token' } });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /history contains an invalid message/i);
});

test('AI Chat returns provider configuration errors as JSON', async () => {
  const response = await onRequest({ request: request({ admin_token: 'valid-token', message: 'Hello' }), env: { ADMIN_TOKEN: 'valid-token' } });
  const payload = await response.json();
  assert.equal(response.status, 503);
  assert.equal(payload.success, false);
  assert.equal(payload.message, 'AI chat request failed.');
});
