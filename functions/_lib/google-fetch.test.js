import test from 'node:test';
import assert from 'node:assert/strict';

import { causeCode, googleFetch } from './google-fetch.js';

// The production failure this module exists for. Node reports a connect
// timeout as a TypeError whose message is the useless string "fetch failed",
// with the real code buried in an AggregateError one level down - one entry per
// address tried, which is how a host with a dead IPv6 route ends up here.
function connectTimeout() {
  const aggregate = new AggregateError(
    [Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' })],
    ''
  );
  aggregate.code = 'ETIMEDOUT';
  return Object.assign(new TypeError('fetch failed'), { cause: aggregate });
}

function withFetch(impl, run) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return Promise.resolve()
    .then(run)
    .finally(() => {
      globalThis.fetch = original;
    });
}

test('the code buried in an AggregateError cause is what gets reported', () => {
  assert.equal(causeCode(connectTimeout()), 'ETIMEDOUT');
  assert.equal(causeCode(new Error('plain')), '');
});

test('a connect timeout is retried, and a later attempt is allowed to succeed', async () => {
  let calls = 0;
  await withFetch(
    async () => {
      calls += 1;
      if (calls < 3) throw connectTimeout();
      return new Response('{}', { status: 200 });
    },
    async () => {
      const response = await googleFetch('https://oauth2.googleapis.com/token', { method: 'POST' });
      assert.equal(response.status, 200);
      assert.equal(calls, 3, 'should have retried twice before succeeding');
    }
  );
});

test('when every attempt fails the error names the host and the cause, not "fetch failed"', async () => {
  let calls = 0;
  await withFetch(
    async () => {
      calls += 1;
      throw connectTimeout();
    },
    async () => {
      const error = await googleFetch('https://oauth2.googleapis.com/token', {}, { retries: 1 }).then(
        () => null,
        (caught) => caught
      );

      assert.ok(error, 'should reject');
      assert.equal(calls, 2, 'initial attempt plus one retry');
      assert.match(error.message, /oauth2\.googleapis\.com/);
      assert.match(error.message, /ETIMEDOUT/);
      assert.doesNotMatch(error.message, /^fetch failed$/);
      assert.equal(error.code, 'NETWORK');
      assert.equal(error.status, 502);
    }
  );
});

test('an HTTP error is an answer: it is returned, never retried', async () => {
  // Retrying a 429 against a Business Profile API whose quota has not been
  // granted spends the quota to be told the same thing again.
  let calls = 0;
  await withFetch(
    async () => {
      calls += 1;
      return new Response('{"error":{"status":"RESOURCE_EXHAUSTED"}}', { status: 429 });
    },
    async () => {
      const response = await googleFetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts');
      assert.equal(response.status, 429);
      assert.equal(calls, 1, 'a 429 must not be retried');
    }
  );
});

test('an error with no network code is not retried', async () => {
  let calls = 0;
  await withFetch(
    async () => {
      calls += 1;
      throw new TypeError('Invalid URL');
    },
    async () => {
      await googleFetch('https://oauth2.googleapis.com/token').then(
        () => assert.fail('should reject'),
        () => {}
      );
      assert.equal(calls, 1);
    }
  );
});
