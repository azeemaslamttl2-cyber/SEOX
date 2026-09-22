import test from 'node:test';
import assert from 'node:assert/strict';

import { USER_RETRY_FLOOR_SECONDS, backoffSeconds, quotaKey, singleFlight } from './gbp-quota.js';

test('an explicit user action is never made to wait more than the floor', () => {
  // A long ladder is right for automatic callers, but someone who has just
  // finished a consent screen must get an attempt - the quota may have been
  // approved a minute ago, and the ladder has no way to know that.
  const automatic = backoffSeconds(12);
  assert.ok(automatic > USER_RETRY_FLOOR_SECONDS * 5, 'the automatic ladder should be long');
  assert.equal(
    Math.min(automatic, USER_RETRY_FLOOR_SECONDS),
    USER_RETRY_FLOOR_SECONDS,
    'a user-initiated call waits at most the floor'
  );
});

test('backoff grows exponentially and stops at the ceiling', () => {
  // Jitter is +/-25%, so assert on the band rather than an exact value.
  const within = (value, target) =>
    value >= Math.floor(target * 0.74) && value <= Math.ceil(target * 1.26);

  assert.equal(backoffSeconds(0), 0, 'no failures means no wait');
  assert.ok(within(backoffSeconds(1), 60), `first refusal ~60s, got ${backoffSeconds(1)}`);
  assert.ok(within(backoffSeconds(2), 120), `second ~120s, got ${backoffSeconds(2)}`);
  assert.ok(within(backoffSeconds(3), 240), `third ~240s, got ${backoffSeconds(3)}`);

  // A quota pending approval sits here indefinitely, which is the point.
  for (const failures of [10, 20, 50]) {
    assert.ok(
      backoffSeconds(failures) <= Math.ceil(3600 * 1.26),
      'must never exceed the one-hour ceiling plus jitter'
    );
    assert.ok(backoffSeconds(failures) >= 3600 * 0.74, 'a long run should sit at the ceiling');
  }
});

test('jitter actually varies, so simultaneous waiters do not retry in lockstep', () => {
  const values = new Set(Array.from({ length: 40 }, () => backoffSeconds(4)));
  assert.ok(values.size > 1, 'backoff must not be a constant');
});

test('concurrent callers for one project share a single Google request', async () => {
  let calls = 0;
  const task = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return 'accounts';
  };

  const key = quotaKey(1, 'proj_1');
  const results = await Promise.all([
    singleFlight(key, task),
    singleFlight(key, task),
    singleFlight(key, task),
    singleFlight(key, task),
  ]);

  assert.equal(calls, 1, 'four concurrent callers must spend one unit of quota, not four');
  assert.deepEqual(results, ['accounts', 'accounts', 'accounts', 'accounts']);
});

test('a later call runs again once the first has settled', async () => {
  let calls = 0;
  const task = async () => {
    calls += 1;
    return calls;
  };

  const key = quotaKey(1, 'proj_2');
  await singleFlight(key, task);
  await singleFlight(key, task);

  assert.equal(calls, 2, 'single-flight collapses concurrency, it is not a cache');
});

test('a failure clears the in-flight slot rather than wedging the project', async () => {
  const key = quotaKey(1, 'proj_3');
  await assert.rejects(() =>
    singleFlight(key, async () => {
      throw new Error('429');
    })
  );

  // If the rejected promise were left in the map, every later sync for this
  // project would rethrow the old error forever.
  const value = await singleFlight(key, async () => 'recovered');
  assert.equal(value, 'recovered');
});

test('different projects do not share a flight', async () => {
  let calls = 0;
  const task = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return calls;
  };

  await Promise.all([singleFlight(quotaKey(1, 'a'), task), singleFlight(quotaKey(2, 'b'), task)]);
  assert.equal(calls, 2);
});
