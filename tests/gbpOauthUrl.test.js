import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuthUrl } from '../functions/_lib/gbp-client.js';

const AUTH_URL = buildAuthUrl({
  clientId: 'test-client-id.apps.googleusercontent.com',
  redirectUri: 'http://localhost:3000/gbp/oauth-callback',
  state: { projectId: 'demo-project', returnTo: '/local-seo/gbp' },
});

test('GBP OAuth URL includes the required Google parameters and exact redirect URI', () => {
  const url = new URL(AUTH_URL);
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.pathname, '/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('client_id'), 'test-client-id.apps.googleusercontent.com');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:3000/gbp/oauth-callback');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.match(url.searchParams.get('scope'), /business\.manage/);
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent');
  assert.ok(url.searchParams.get('state'));
});
