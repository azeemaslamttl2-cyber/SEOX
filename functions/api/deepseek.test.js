import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './deepseek.js';
import * as route from '../../app/api/deepseek/route.js';

function request(body, options = {}) {
  const { method = 'POST', headers = {} } = options;
  return new Request('https://example.com/api/deepseek', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: method !== 'GET' && method !== 'OPTIONS' ? JSON.stringify(body) : undefined,
  });
}

test('DeepSeek App Router route exports POST and OPTIONS handlers', () => {
  assert.equal(typeof route.POST, 'function');
  assert.equal(typeof route.OPTIONS, 'function');
});

test('DeepSeek route handles OPTIONS preflight request', async () => {
  const response = await onRequest({
    request: request({}, { method: 'OPTIONS' }),
    env: {},
  });
  assert.equal(response.status, 200);
});

test('DeepSeek route rejects unauthenticated request in production', async () => {
  const origEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const response = await onRequest({
      request: request({ prompt: 'Hello' }),
      env: {},
    });
    const payload = await response.json();
    assert.equal(response.status, 401);
    assert.equal(payload.error, 'Unauthorized');
  } finally {
    process.env.NODE_ENV = origEnv;
  }
});
