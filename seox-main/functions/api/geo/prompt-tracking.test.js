import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './prompt-tracking.js';

function request(body) {
  return new Request('https://example.com/api/geo/prompt-tracking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('Prompt Tracking requires admin_token in the JSON body', async () => {
  const response = await onRequest({
    request: request({ url: 'https://example.com' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });

  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /admin_token/i);
});

test('Prompt Tracking rejects an invalid body admin_token before scraping', async () => {
  const response = await onRequest({
    request: request({ admin_token: 'bad-token', url: 'https://example.com' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });

  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.equal(payload.success, false);
  assert.match(payload.message, /invalid admin token/i);
});

test('Prompt Tracking rejects missing URL after authenticating the body token', async () => {
  const response = await onRequest({
    request: request({ admin_token: 'valid-token' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });

  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /url is required/i);
});

