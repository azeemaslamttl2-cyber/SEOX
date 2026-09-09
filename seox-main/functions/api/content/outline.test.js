import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './outline.js';
import { extractMainContent, getPageTitle } from '../../../src/utils/fetchAndParse.js';

test('outline API rejects missing admin token', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/content/outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: ['https://example.com'] }),
    }),
    env: { AUTH_JWT_SECRET: '12345678901234567890123456789012', ADMIN_TOKEN: 'valid-token' },
  });

  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.match(String(payload.message || payload.error || ''), /admin_token/i);
});

test('outline API rejects invalid admin token', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/content/outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_token: 'bad-token', urls: ['https://example.com'] }),
    }),
    env: { AUTH_JWT_SECRET: '12345678901234567890123456789012', ADMIN_TOKEN: 'valid-token' },
  });

  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.match(String(payload.message || payload.error || ''), /invalid admin token|admin token/i);
});

test('outline API rejects missing required URL input', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/api/content/outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_token: 'valid-token' }),
    }),
    env: { AUTH_JWT_SECRET: '12345678901234567890123456789012', ADMIN_TOKEN: 'valid-token' },
  });

  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.match(String(payload.message || payload.error || ''), /urls|url/i);
});

test('content parsing falls back when DOMParser is unavailable in Node', () => {
  const previous = globalThis.DOMParser;
  delete globalThis.DOMParser;

  try {
    const html = `
      <html>
        <head><title>Example Title</title></head>
        <body>
          <main>
            <h1>Alpha Header</h1>
            <p>Some useful article text.</p>
            <h2>Beta Section</h2>
          </main>
        </body>
      </html>
    `;

    assert.equal(getPageTitle(html), 'Example Title');
    assert.match(extractMainContent(html), /Alpha Header|Some useful article text|Beta Section/);
  } finally {
    if (previous) globalThis.DOMParser = previous;
  }
});
