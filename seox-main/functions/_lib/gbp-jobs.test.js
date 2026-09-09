import test from 'node:test';
import assert from 'node:assert/strict';

import { HANDLERS, RETRY_BACKOFF_SECONDS, SYNC_CADENCE_MINUTES, cadenceBucket } from './gbp-jobs.js';

test('a handler is registered for every recurring sync the scheduler queues', () => {
  for (const jobType of ['sync_reviews', 'sync_qanda', 'sync_metrics', 'sync_profile', 'sync_keywords']) {
    assert.equal(typeof HANDLERS[jobType], 'function', `${jobType} has no handler`);
  }
});

test('the scheduled-post and rule handlers exist', () => {
  assert.equal(typeof HANDLERS.publish_post, 'function');
  assert.equal(typeof HANDLERS.run_rule, 'function');
});

test('sync cadences are ordered from most to least frequent', () => {
  const { reviews, qanda, metrics, profile, keywords } = SYNC_CADENCE_MINUTES;
  assert.ok(reviews < qanda, 'reviews should poll more often than Q&A');
  assert.ok(qanda < metrics, 'Q&A should poll more often than daily metrics');
  assert.ok(metrics < profile, 'metrics should poll more often than the profile');
  assert.ok(profile < keywords, 'the profile should poll more often than monthly keywords');
});

test('keyword data is not polled more often than it is published', () => {
  // Google publishes search keyword impressions monthly; polling daily would
  // spend quota for identical data.
  assert.ok(SYNC_CADENCE_MINUTES.keywords >= 60 * 24 * 28);
});

test('retry backoff grows and is bounded', () => {
  assert.deepEqual(RETRY_BACKOFF_SECONDS, [60, 300, 1800]);
  for (let index = 1; index < RETRY_BACKOFF_SECONDS.length; index += 1) {
    assert.ok(RETRY_BACKOFF_SECONDS[index] > RETRY_BACKOFF_SECONDS[index - 1]);
  }
});

test('a job missing its scope fails loudly rather than acting on the wrong location', async () => {
  await assert.rejects(
    () => HANDLERS.sync_reviews({}, { id: 7, user_id: 1, project_id: null, location_row_id: null }),
    /missing its project or location scope/
  );
});

test('run_rule reaches the shared rule runner rather than reporting a run it did not do', async () => {
  // No database in a unit test, so the handler fails at the lookup. What
  // matters is that it never returns success without running the rule.
  await assert.rejects(() => HANDLERS.run_rule({}, { id: 1, user_id: 1, payload: '{}' }));
});

test('the idempotency key advances by exactly one window per interval', () => {
  // The bucket is a fixed grid from the epoch, so shifting by one interval
  // always crosses exactly one boundary. This is what stops the completed job
  // from the previous cycle colliding with the next enqueue.
  for (const [cadence, minutes] of Object.entries(SYNC_CADENCE_MINUTES)) {
    const at = Date.UTC(2026, 8, 8, 12, 0, 0);
    assert.equal(
      cadenceBucket(cadence, at + minutes * 60000),
      cadenceBucket(cadence, at) + 1,
      `${cadence} did not advance by one window`
    );
  }
});

test('ticks inside one window share a key, so a repeated tick cannot double the quota', () => {
  const minutes = SYNC_CADENCE_MINUTES.reviews;
  // Anchor to the start of a window so the whole interval is inside it.
  const windowStart = Math.ceil(Date.UTC(2026, 8, 8) / (minutes * 60000)) * minutes * 60000;

  for (const offset of [0, 5, 15, minutes - 1]) {
    assert.equal(
      cadenceBucket('reviews', windowStart + offset * 60000),
      cadenceBucket('reviews', windowStart),
      `minute ${offset} fell into a different window`
    );
  }
  assert.notEqual(
    cadenceBucket('reviews', windowStart + minutes * 60000),
    cadenceBucket('reviews', windowStart)
  );
});

test('every recurring job maps to a known cadence', () => {
  for (const cadence of ['reviews', 'qanda', 'metrics', 'profile', 'keywords']) {
    assert.equal(typeof cadenceBucket(cadence), 'number');
  }
  assert.throws(() => cadenceBucket('hourly'), /Unknown sync cadence/);
});
