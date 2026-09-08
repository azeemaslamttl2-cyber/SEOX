import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './competitor-research.js';

function request(body) {
  return new Request('https://example.com/api/geo/competitor-research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('Competitor Research requires admin_token in the JSON body', async () => {
  const response = await onRequest({ request: request({ project_url: 'https://example.com', competitors: [] }), env: { ADMIN_TOKEN: 'valid-token' } });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /admin_token/i);
});

test('Competitor Research rejects invalid tokens before analysis', async () => {
  const response = await onRequest({ request: request({ admin_token: 'bad-token', project_url: 'https://example.com', competitors: [] }), env: { ADMIN_TOKEN: 'valid-token' } });
  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.equal(payload.success, false);
  assert.match(payload.message, /invalid admin token/i);
});

test('Competitor Research validates the project URL and competitors array', async () => {
  const missingUrl = await onRequest({ request: request({ admin_token: 'valid-token', competitors: [] }), env: { ADMIN_TOKEN: 'valid-token' } });
  const missingPayload = await missingUrl.json();
  assert.equal(missingUrl.status, 400);
  assert.match(missingPayload.message, /project_url/i);

  const invalidCompetitors = await onRequest({ request: request({ admin_token: 'valid-token', project_url: 'https://example.com', competitors: 'https://competitor.example' }), env: { ADMIN_TOKEN: 'valid-token' } });
  const invalidPayload = await invalidCompetitors.json();
  assert.equal(invalidCompetitors.status, 400);
  assert.match(invalidPayload.message, /competitors must be an array/i);
});

test('Competitor Research rejects private URLs without analysis or database writes', async () => {
  const response = await onRequest({ request: request({ admin_token: 'valid-token', project_url: 'http://127.0.0.1:3000', competitors: [] }), env: { ADMIN_TOKEN: 'valid-token' } });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /private|local|metadata/i);
});
