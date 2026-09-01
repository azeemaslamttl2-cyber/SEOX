import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './admin-validation.js';

test('admin validation route rejects missing admin token and returns app-style error payload', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/tech-seo/w3c-validation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    }),
    env: { AUTH_JWT_SECRET: '12345678901234567890123456789012', MYSQL_HOST: 'localhost', MYSQL_PORT: 3306, MYSQL_USER: 'root', MYSQL_PASSWORD: '', MYSQL_DATABASE: 'test' },
  });

  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(String(payload.message || payload.error || ''), /admin_token/i);
});
