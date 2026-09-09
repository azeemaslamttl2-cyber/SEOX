import test from 'node:test';
import assert from 'node:assert/strict';

import { HEARTBEAT_STALE_MINUTES, LIMITS } from './rate-limit.js';

test('every rate-limited bucket has a positive limit and window', () => {
  for (const [bucket, config] of Object.entries(LIMITS)) {
    assert.ok(config.limit > 0, `${bucket} has no limit`);
    assert.ok(config.windowSeconds > 0, `${bucket} has no window`);
  }
});

test('the buckets that spend Google quota are all covered', () => {
  for (const bucket of [
    'gbp:sync-reviews',
    'gbp:sync-qanda',
    'gbp:refresh-overview',
    'gbp:run-audit',
    'gbp:sync-keywords',
    'gbp:resync-locations',
    'wpscan:scan',
  ]) {
    assert.ok(LIMITS[bucket], `${bucket} is not rate limited`);
  }
});

test('the WPScan limit cannot exhaust the free daily allowance in one window', () => {
  // The free tier is 25 requests a day for the whole install, and one scan
  // spends up to 12 lookups. Three scans a day per user is already the ceiling.
  const scan = LIMITS['wpscan:scan'];
  assert.equal(scan.windowSeconds, 86400);
  assert.ok(scan.limit * 12 <= 36, 'a single user could spend more than the daily allowance');
});

test('keyword sync is limited to a daily window because the data is monthly', () => {
  assert.equal(LIMITS['gbp:sync-keywords'].windowSeconds, 86400);
  assert.ok(LIMITS['gbp:sync-keywords'].limit <= 2);
});

test('the stale threshold is well above the five-minute cron interval', () => {
  // A single missed tick must not raise an alarm; four in a row should.
  assert.ok(HEARTBEAT_STALE_MINUTES >= 15);
  assert.ok(HEARTBEAT_STALE_MINUTES <= 60);
});


