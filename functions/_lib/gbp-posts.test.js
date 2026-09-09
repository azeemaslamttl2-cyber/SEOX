import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FAILURE_THRESHOLD,
  applyUtm,
  buildLocalPost,
  expandRecurrence,
  nextBlockState,
  postingBlocked,
  validatePost,
} from './gbp-posts.js';

const validStandard = {
  topicType: 'STANDARD',
  summary:
    'Our team handles emergency drain clearing across Lahore, usually the same day you call. Book a slot online and we confirm a two-hour arrival window.',
  ctaType: 'LEARN_MORE',
  ctaUrl: 'https://example.com/drains',
};

test('a well formed update post passes', () => {
  const result = validatePost(validStandard);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('a phone number in the body is rejected before it reaches Google', () => {
  const result = validatePost({ ...validStandard, summary: 'Call us on +92 300 1234567 today for help with drains.' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => message.includes('phone number')));
});

test('an all-caps body is rejected as spam', () => {
  const result = validatePost({
    ...validStandard,
    summary: 'EMERGENCY DRAIN CLEARING AVAILABLE RIGHT NOW ACROSS THE WHOLE CITY',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => message.includes('uppercase')));
});

test('a body over the 1500 character limit is rejected', () => {
  const result = validatePost({ ...validStandard, summary: 'a'.repeat(1501) });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => message.includes('1500')));
});

test('a short body is a warning, not an error', () => {
  const result = validatePost({ ...validStandard, summary: 'Drains cleared today.' });
  assert.equal(result.valid, true);
  assert.equal(result.warnings.length, 1);
});

test('every action except CALL needs a landing URL', () => {
  const withoutUrl = validatePost({ ...validStandard, ctaUrl: null });
  assert.equal(withoutUrl.valid, false);
  assert.ok(withoutUrl.errors.some((message) => message.includes('landing URL')));

  const call = validatePost({ ...validStandard, ctaType: 'CALL', ctaUrl: null });
  assert.equal(call.valid, true);
});

test('event posts require a title and a sane date range', () => {
  const missing = validatePost({ ...validStandard, topicType: 'EVENT' });
  assert.equal(missing.valid, false);
  assert.ok(missing.errors.some((message) => message.includes('require a title')));

  const backwards = validatePost({
    ...validStandard,
    topicType: 'EVENT',
    eventTitle: 'Open day',
    eventStart: '2026-10-10T10:00:00Z',
    eventEnd: '2026-10-09T10:00:00Z',
  });
  assert.equal(backwards.valid, false);
  assert.ok(backwards.errors.some((message) => message.includes('before the start')));
});

test('product posts are refused because the API cannot create them', () => {
  const result = validatePost({ ...validStandard, topicType: 'PRODUCT' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => message.includes('Product posts')));
});

test('a non-http image URL is rejected', () => {
  const result = validatePost({ ...validStandard, mediaUrl: 'file:///tmp/photo.jpg' });
  assert.equal(result.valid, false);
});

test('UTM parameters are added without overwriting existing ones', () => {
  const tagged = applyUtm('https://example.com/blog?utm_source=newsletter&x=1', {
    source: 'google',
    medium: 'gbp',
    campaign: 'autumn',
  });
  const url = new URL(tagged);
  assert.equal(url.searchParams.get('utm_source'), 'newsletter');
  assert.equal(url.searchParams.get('utm_medium'), 'gbp');
  assert.equal(url.searchParams.get('utm_campaign'), 'autumn');
  assert.equal(url.searchParams.get('x'), '1');
});

test('applyUtm leaves an unusable URL untouched', () => {
  assert.equal(applyUtm('not a url', { source: 'google' }), 'not a url');
});

test('the Google payload carries CALL without a URL', () => {
  const payload = buildLocalPost({ ...validStandard, ctaType: 'CALL', ctaUrl: 'https://example.com' });
  assert.equal(payload.callToAction.actionType, 'CALL');
  assert.equal(payload.callToAction.url, undefined);
});

test('the Google payload builds an offer with its schedule', () => {
  const payload = buildLocalPost({
    ...validStandard,
    topicType: 'OFFER',
    eventTitle: '20% off',
    eventStart: '2026-10-01T09:00:00Z',
    eventEnd: '2026-10-31T17:30:00Z',
    offerCoupon: 'AUTUMN20',
  });
  assert.equal(payload.topicType, 'OFFER');
  assert.deepEqual(payload.event.schedule.startDate, { year: 2026, month: 10, day: 1 });
  assert.deepEqual(payload.event.schedule.endTime, { hours: 17, minutes: 30 });
  assert.equal(payload.offer.couponCode, 'AUTUMN20');
});

test('the circuit breaker only trips on the second consecutive failure', () => {
  const first = nextBlockState({ posting_failures: 0 }, 'failure', 'rejected');
  assert.equal(first.postingFailures, 1);
  assert.equal(first.postingBlockedUntil, null);

  const second = nextBlockState({ posting_failures: 1 }, 'failure', 'rejected again');
  assert.equal(second.postingFailures, FAILURE_THRESHOLD);
  assert.ok(second.postingBlockedUntil instanceof Date);
  assert.ok(second.postingBlockReason.includes('rejected again'));
});

test('a success clears the failure count', () => {
  const state = nextBlockState({ posting_failures: 5 }, 'success');
  assert.equal(state.postingFailures, 0);
  assert.equal(state.postingBlockedUntil, null);
  assert.equal(state.incrementSuccess, true);
});

test('an expired block no longer blocks', () => {
  const past = new Date(Date.now() - 60000).toISOString().slice(0, 19).replace('T', ' ');
  assert.equal(postingBlocked({ posting_blocked_until: past }), null);

  const future = new Date(Date.now() + 3600000).toISOString().slice(0, 19).replace('T', ' ');
  const blocked = postingBlocked({ posting_blocked_until: future, posting_failures: 2 });
  assert.equal(blocked.failures, 2);
});

test('recurrence expands to individual dates at the right spacing', () => {
  const dates = expandRecurrence({
    startAt: '2026-09-07T10:00:00Z',
    cadence: 'weekly',
    occurrences: 4,
  });
  assert.equal(dates.length, 4);
  assert.equal(dates[0].toISOString(), '2026-09-07T10:00:00.000Z');
  assert.equal(dates[3].toISOString(), '2026-09-28T10:00:00.000Z');
});

test('recurrence is capped and rejects an unknown cadence', () => {
  assert.equal(
    expandRecurrence({ startAt: '2026-09-07T10:00:00Z', cadence: 'daily', occurrences: 999 }).length,
    52
  );
  assert.throws(
    () => expandRecurrence({ startAt: '2026-09-07T10:00:00Z', cadence: 'hourly', occurrences: 2 }),
    /not a supported cadence/
  );
});
