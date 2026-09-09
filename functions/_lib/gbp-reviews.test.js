import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REPLY_LIMIT,
  canAutoPublish,
  filterClause,
  replyAuthorization,
  sentimentOf,
  summarise,
  tierFor,
  validateReply,
} from './gbp-reviews.js';

const authorized = { reply_authorized: 1, reply_authorized_by: 'Ayesha Khan', auto_reply_enabled: 1, auto_reply_min_stars: 5 };

test('star ratings map onto the right reply tier', () => {
  assert.equal(tierFor(5).mode, 'ai_auto_allowed');
  assert.equal(tierFor(4).mode, 'ai_personalized');
  assert.equal(tierFor(3).mode, 'manual_approval');
  assert.equal(tierFor(2).mode, 'ai_draft_only');
  assert.equal(tierFor(1).mode, 'ai_draft_only');
  assert.equal(tierFor(1).urgency, 'urgent');
  assert.equal(tierFor(2).urgency, 'urgent');
});

test('an unknown rating falls back to manual approval, never to auto', () => {
  assert.equal(tierFor(0).mode, 'manual_approval');
  assert.equal(tierFor(undefined).mode, 'manual_approval');
});

test('sentiment buckets follow the star bands', () => {
  assert.equal(sentimentOf(5), 'positive');
  assert.equal(sentimentOf(4), 'positive');
  assert.equal(sentimentOf(3), 'neutral');
  assert.equal(sentimentOf(2), 'negative');
  assert.equal(sentimentOf(1), 'negative');
});

test('replying is refused until the client authorisation is recorded', () => {
  const blocked = replyAuthorization({ reply_authorized: 0 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.code, 'NOT_AUTHORIZED');

  assert.equal(replyAuthorization(authorized).allowed, true);
});

test('a missing location is treated as unauthorised', () => {
  assert.equal(replyAuthorization(null).allowed, false);
  assert.equal(replyAuthorization(undefined).allowed, false);
});

test('auto-publish needs authorisation, the switch, and a five-star tier', () => {
  assert.equal(canAutoPublish(authorized, 5).allowed, true);

  assert.equal(canAutoPublish({ ...authorized, reply_authorized: 0 }, 5).allowed, false);
  assert.equal(canAutoPublish({ ...authorized, auto_reply_enabled: 0 }, 5).allowed, false);
});

test('nothing below five stars can ever auto-publish', () => {
  for (const stars of [1, 2, 3, 4]) {
    const result = canAutoPublish(authorized, stars);
    assert.equal(result.allowed, false, `${stars} stars must not auto-publish`);
  }
});

test('the auto-reply star floor can never be pushed below four', () => {
  // Even with a tampered floor of 1, the tier check still refuses low ratings.
  const tampered = { ...authorized, auto_reply_min_stars: 1 };
  assert.equal(canAutoPublish(tampered, 2).allowed, false);
  assert.equal(canAutoPublish(tampered, 3).allowed, false);
});

test('an empty or over-long reply is rejected', () => {
  assert.equal(validateReply('').valid, false);
  assert.equal(validateReply('a'.repeat(REPLY_LIMIT + 1)).valid, false);
  assert.equal(validateReply('Thanks for the kind words, we appreciate it.').valid, true);
});

test('an all-caps reply is rejected as shouting', () => {
  const result = validateReply('THANK YOU SO MUCH FOR THIS WONDERFUL REVIEW');
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => message.includes('uppercase')));
});

test('phone numbers and URLs in a reply are warnings, not blockers', () => {
  const withPhone = validateReply('Thanks! Call us on +92 300 1234567 next time.');
  assert.equal(withPhone.valid, true);
  assert.equal(withPhone.warnings.length, 1);

  const withUrl = validateReply('Thanks! See https://example.com for more.');
  assert.equal(withUrl.valid, true);
  assert.equal(withUrl.warnings.length, 1);
});

test('each inbox filter produces a distinct SQL clause', () => {
  assert.equal(filterClause('unanswered').clause, 'reply_comment IS NULL');
  assert.equal(filterClause('positive').clause, 'star_rating >= 4');
  assert.equal(filterClause('negative').clause, 'star_rating BETWEEN 1 AND 2');
  assert.ok(filterClause('flagged').clause.includes('policy_violation'));
  assert.ok(filterClause('reply_pending').clause.includes('awaiting_approval'));
  assert.equal(filterClause('all').clause, '1 = 1');
});

test('an unknown filter falls back to showing everything', () => {
  assert.equal(filterClause('nonsense').clause, '1 = 1');
});

test('the inbox summary counts each bucket independently', () => {
  const reviews = [
    { star_rating: 5, reply_comment: 'Thanks!', draft_status: 'published' },
    { star_rating: 5, reply_comment: null, draft_status: 'draft' },
    { star_rating: 3, reply_comment: null, draft_status: 'none' },
    { star_rating: 1, reply_comment: null, draft_status: 'awaiting_approval' },
    { star_rating: 2, reply_comment: null, draft_status: 'none', flagged: 1 },
  ];

  const { counts, ratingBreakdown, averageRating } = summarise(reviews);
  assert.equal(counts.total, 5);
  assert.equal(counts.unanswered, 4);
  assert.equal(counts.replyPublished, 1);
  assert.equal(counts.positive, 2);
  assert.equal(counts.neutral, 1);
  assert.equal(counts.negative, 2);
  assert.equal(counts.flagged, 1);
  assert.equal(counts.replyPending, 2);
  // 1 and 2 star, both unanswered.
  assert.equal(counts.urgent, 2);
  assert.deepEqual(ratingBreakdown, { 1: 1, 2: 1, 3: 1, 4: 0, 5: 2 });
  assert.equal(averageRating, 3.2);
});

test('an answered low-star review is no longer urgent', () => {
  const { counts } = summarise([{ star_rating: 1, reply_comment: 'We are sorry.', draft_status: 'published' }]);
  assert.equal(counts.urgent, 0);
});

test('a policy violation counts as flagged even without the manual flag', () => {
  const { counts } = summarise([{ star_rating: 3, reply_comment: null, policy_violation: 'SPAM' }]);
  assert.equal(counts.flagged, 1);
});

test('summarising an empty inbox does not divide by zero', () => {
  const { counts, averageRating } = summarise([]);
  assert.equal(counts.total, 0);
  assert.equal(averageRating, null);
});
