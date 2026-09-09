import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest, checkRobotsForBot, AI_CRAWLERS } from './ai-model-checker.js';

function request(body, options = {}) {
  const { method = 'POST', headers = {} } = options;
  return new Request('https://example.com/api/geo/ai-model-checker', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: method !== 'GET' && method !== 'OPTIONS' ? JSON.stringify(body) : undefined,
  });
}

test('checkRobotsForBot correctly evaluates Allow and Disallow rules', () => {
  const robots = `
User-agent: *
Disallow: /admin/
Allow: /

User-agent: GPTBot
Disallow: /

User-agent: Google-Extended
Disallow: /private/
`;

  // GPTBot should be completely blocked
  const gptResult = checkRobotsForBot(robots, 'GPTBot', '/');
  assert.equal(gptResult.allowed, false);

  // Google-Extended should be allowed on root but blocked on /private/
  const googleRoot = checkRobotsForBot(robots, 'Google-Extended', '/');
  assert.equal(googleRoot.allowed, true);
  const googlePrivate = checkRobotsForBot(robots, 'Google-Extended', '/private/doc');
  assert.equal(googlePrivate.allowed, false);

  // Other bots follow wildcard
  const otherBot = checkRobotsForBot(robots, 'ClaudeBot', '/admin/secret');
  assert.equal(otherBot.allowed, false);
  const otherBotPublic = checkRobotsForBot(robots, 'ClaudeBot', '/public/page');
  assert.equal(otherBotPublic.allowed, true);
});

test('checkRobotsForBot allows all if robots.txt is missing or empty', () => {
  const emptyResult = checkRobotsForBot('', 'GPTBot', '/');
  assert.equal(emptyResult.allowed, true);
  assert.match(emptyResult.reason, /no robots\.txt found/i);
});

test('AI Model Checker requires admin_token in the JSON body for external requests', async () => {
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

test('AI Model Checker rejects an invalid admin_token before URL processing', async () => {
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

test('AI Model Checker rejects missing URL after authenticating admin token', async () => {
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

test('AI Model Checker rejects private/local URLs before crawling', async () => {
  const response = await onRequest({
    request: request({ admin_token: 'valid-token', url: 'http://127.0.0.1:3000' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /private|local|metadata/i);
});

test('AI Model Checker handles OPTIONS method for CORS preflight', async () => {
  const response = await onRequest({
    request: request(null, { method: 'OPTIONS' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  assert.equal(response.status, 204);
});

test('AI Model Checker rejects non-POST requests with 405', async () => {
  const response = await onRequest({
    request: request(null, { method: 'GET' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  const payload = await response.json();
  assert.equal(response.status, 405);
  assert.equal(payload.success, false);
  assert.match(payload.message, /method not allowed/i);
});
