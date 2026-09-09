import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest, generateFallbackResults, AI_MODELS, CHECK_CATEGORIES } from './ai-compatibility.js';

function request(body, options = {}) {
  const { method = 'POST', headers = {} } = options;
  return new Request('https://example.com/api/geo/ai-compatibility', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: method !== 'GET' && method !== 'OPTIONS' ? JSON.stringify(body) : undefined,
  });
}

test('generateFallbackResults produces all 6 models with complete category checks', () => {
  const models = generateFallbackResults('https://example.com');
  
  assert.equal(Object.keys(models).length, 6);
  AI_MODELS.forEach((m) => {
    assert.ok(models[m.id], `Model ${m.id} should exist in output`);
    assert.equal(typeof models[m.id].score, 'number');
    assert.ok(models[m.id].checks, `Model ${m.id} should have checks`);
    
    const expectedCats = CHECK_CATEGORIES[m.id];
    expectedCats.forEach((cat) => {
      assert.ok(models[m.id].checks[cat.id], `Check ${cat.id} should exist for model ${m.id}`);
      assert.equal(typeof models[m.id].checks[cat.id].passed, 'boolean');
      assert.equal(typeof models[m.id].checks[cat.id].reason, 'string');
    });
  });
});

test('AI Compatibility requires admin_token in the JSON body for external requests', async () => {
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

test('AI Compatibility rejects an invalid admin_token before URL processing', async () => {
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

test('AI Compatibility rejects missing URL after authenticating admin token', async () => {
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

test('AI Compatibility rejects private/local URLs before scraping', async () => {
  const response = await onRequest({
    request: request({ admin_token: 'valid-token', url: 'http://127.0.0.1:3000' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /private|local|metadata/i);
});

test('AI Compatibility handles OPTIONS method for CORS preflight', async () => {
  const response = await onRequest({
    request: request(null, { method: 'OPTIONS' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  assert.equal(response.status, 204);
});

test('AI Compatibility rejects non-POST requests with 405', async () => {
  const response = await onRequest({
    request: request(null, { method: 'GET' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  const payload = await response.json();
  assert.equal(response.status, 405);
  assert.equal(payload.success, false);
  assert.match(payload.message, /method not allowed/i);
});
