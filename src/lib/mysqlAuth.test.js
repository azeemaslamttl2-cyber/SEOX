import test from 'node:test';
import assert from 'node:assert/strict';
import { registerUser, signIn } from './mysqlAuth.js';

test('registerUser posts registration data to the auth API', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return {
      ok: true,
      async json() {
        return { ok: true, user: { id: 'user-1', email: 'demo@example.com', displayName: 'Demo User' } };
      },
    };
  };

  try {
    const result = await registerUser({ email: 'demo@example.com', password: 'secret123', displayName: 'Demo User' });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/auth/register');
    assert.equal(calls[0].init.method, 'POST');
    assert.match(calls[0].init.body, /demo@example.com/);
    assert.equal(result.user.email, 'demo@example.com');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('signIn posts credentials to the auth API', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return {
      ok: true,
      async json() {
        return { ok: true, user: { id: 'user-2', email: 'demo@example.com' } };
      },
    };
  };

  try {
    const result = await signIn({ email: 'demo@example.com', password: 'secret123' });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/auth/login');
    assert.equal(calls[0].init.method, 'POST');
    assert.match(calls[0].init.body, /demo@example.com/);
    assert.equal(result.user.email, 'demo@example.com');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
