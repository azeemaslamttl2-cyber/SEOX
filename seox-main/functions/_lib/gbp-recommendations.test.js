import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_KINDS,
  PRIORITIES,
  buildRecommendations,
  countByPriority,
  resolveAction,
} from './gbp-recommendations.js';
import { diffSignals } from './gbp-audit.js';

const healthy = {
  location: { serviceCount: 8 },
  reviews: { total: 100, unanswered: 0, urgent: 0, averageRating: 4.8 },
  questions: { total: 5, unanswered: 0 },
  posts: { daysSinceLastPost: 3, postsLast30Days: 4 },
  media: { total: 40 },
  metrics: [{ key: 'calls', label: 'Calls', current: 300, previous: 290, change: 3.4 }],
  searchKeywords: [],
  gsc: null,
  audit: { score: 95, failing: [] },
};

test('a healthy listing produces no recommendations', () => {
  assert.deepEqual(buildRecommendations(healthy), []);
});

test('a keyword with impressions and a weak website rank becomes the flagship item', () => {
  const result = buildRecommendations({
    ...healthy,
    searchKeywords: [{ keyword: 'emergency plumbing', impressions: 1340, isThreshold: false }],
    gsc: { queries: [{ query: 'emergency plumbing', position: 18, impressions: 200 }] },
  });

  const gap = result.find((entry) => entry.rule === 'keyword_gap');
  assert.ok(gap);
  assert.equal(gap.priority, 'high');
  assert.match(gap.title, /1,340 GBP impressions\/month/);
  assert.equal(gap.evidence.gbpImpressionsPerMonth, 1340);
  assert.equal(gap.evidence.websitePosition, 18);
  // Declared rather than omitted so the missing source is visible.
  assert.equal(gap.evidence.rankGridAverage, null);
});

test('a keyword the website already ranks well for is not raised', () => {
  const result = buildRecommendations({
    ...healthy,
    searchKeywords: [{ keyword: 'plumber lahore', impressions: 900, isThreshold: false }],
    gsc: { queries: [{ query: 'plumber lahore', position: 4, impressions: 800 }] },
  });
  assert.equal(result.filter((entry) => entry.rule === 'keyword_gap').length, 0);
});

test('threshold-only keyword counts are excluded from recommendations', () => {
  // Google reports "fewer than N" for low-volume keywords; that is a floor, not
  // a count, so it must never drive a numeric recommendation.
  const result = buildRecommendations({
    ...healthy,
    searchKeywords: [{ keyword: 'cheap plumber', impressions: 15, isThreshold: true }],
    gsc: { queries: [] },
  });
  assert.equal(result.filter((entry) => entry.rule === 'keyword_gap').length, 0);
});

test('unanswered negative reviews outrank ordinary unanswered ones', () => {
  const result = buildRecommendations({
    ...healthy,
    reviews: { total: 120, unanswered: 9, urgent: 2, averageRating: 4.6 },
  });

  const urgent = result.find((entry) => entry.rule === 'unanswered_negative_reviews');
  const ordinary = result.find((entry) => entry.rule === 'unanswered_reviews');
  assert.equal(urgent.priority, 'high');
  assert.ok(result.indexOf(urgent) < result.indexOf(ordinary));
  assert.equal(urgent.evidence.urgentUnanswered, 2);
});

test('a posting gap reports the real cadence and leaves competitor data null', () => {
  const result = buildRecommendations({
    ...healthy,
    posts: { daysSinceLastPost: 17, postsLast30Days: 1 },
  });

  const gap = result.find((entry) => entry.rule === 'posting_gap');
  assert.match(gap.title, /17 days ago/);
  assert.equal(gap.evidence.daysSinceLastPost, 17);
  // No competitor source is connected, so no average is invented.
  assert.equal(gap.evidence.competitorAverage, null);
  assert.deepEqual(gap.actions, ['generate', 'schedule', 'ignore']);
});

test('a metric drop is only raised on a base big enough to matter', () => {
  const small = buildRecommendations({
    ...healthy,
    metrics: [{ key: 'calls', label: 'Calls', current: 5, previous: 20, change: -75 }],
  });
  assert.equal(small.filter((entry) => entry.rule === 'metric_drop').length, 0);

  const real = buildRecommendations({
    ...healthy,
    metrics: [{ key: 'calls', label: 'Calls', current: 120, previous: 300, change: -60 }],
  });
  const drop = real.find((entry) => entry.rule === 'metric_drop');
  assert.equal(drop.priority, 'high');
  assert.equal(drop.evidence.previous, 300);
});

test('audit gaps only surface where enough points are at stake', () => {
  const result = buildRecommendations({
    ...healthy,
    audit: {
      score: 70,
      failing: [
        { key: 'photos', severity: 'medium', title: 'Few photos', pointsEarned: 2, pointsPossible: 8 },
        { key: 'specialHours', severity: 'low', title: 'No holiday hours', pointsEarned: 0, pointsPossible: 2 },
      ],
    },
  });

  const keys = result.filter((entry) => entry.rule === 'audit_gap').map((entry) => entry.evidence.check);
  assert.deepEqual(keys, ['photos']);
});

test('recommendations are ordered by priority', () => {
  const result = buildRecommendations({
    ...healthy,
    location: { serviceCount: 1 },
    reviews: { total: 50, unanswered: 12, urgent: 0, averageRating: 4.2 },
    posts: { daysSinceLastPost: 40, postsLast30Days: 0 },
  });

  const ranks = result.map((entry) => PRIORITIES.indexOf(entry.priority));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
});

test('counts are grouped by priority', () => {
  const counts = countByPriority([
    { priority: 'high' },
    { priority: 'high' },
    { priority: 'medium' },
    { priority: 'opportunity' },
  ]);
  assert.deepEqual(counts, { high: 2, medium: 1, low: 0, opportunity: 1 });
});

test('missing signals simply produce fewer recommendations, never guesses', () => {
  const result = buildRecommendations({ location: {}, reviews: null, posts: null, metrics: null });
  assert.deepEqual(result, []);
});

// --- Safe AI Actions -------------------------------------------------------

test('every generate and schedule action resolves to a draft, never a publish', () => {
  for (const [rule, actionKey] of [
    ['unanswered_reviews', 'generate'],
    ['unanswered_negative_reviews', 'generate'],
    ['unanswered_questions', 'generate'],
    ['posting_gap', 'generate'],
    ['posting_gap', 'schedule'],
    ['keyword_gap', 'generate'],
  ]) {
    const resolved = resolveAction(rule, actionKey);
    assert.equal(resolved.kind, 'draft', `${rule}/${actionKey} must produce a draft`);
    assert.ok(resolved.review, `${rule}/${actionKey} must say where to review`);
  }
});

test('fix actions only navigate', () => {
  assert.equal(resolveAction('audit_gap', 'fix').kind, 'navigate');
  assert.equal(resolveAction('metric_drop', 'fix').kind, 'navigate');
});

test('ignore is always available and dismisses', () => {
  assert.equal(resolveAction('anything_at_all', 'ignore').kind, 'dismiss');
});

test('an action a rule does not offer is refused', () => {
  assert.throws(() => resolveAction('audit_gap', 'generate'), /not an available action/);
  assert.throws(() => resolveAction('photo_gap', 'schedule'), /not an available action/);
});

test('no action kind is a publish', () => {
  for (const meta of Object.values(ACTION_KINDS)) {
    assert.notEqual(meta.kind, 'publish');
  }
});

// --- Audit history diff (module 19) ---------------------------------------

const auditWith = (score, snapshot, createdAt = '2026-09-01') => ({
  score,
  created_at: createdAt,
  signals: JSON.stringify({ snapshot }),
});

test('signal diff reports what changed on the listing, not just the score', () => {
  const previous = auditWith(72, {
    reviewCount: 278,
    averageRating: 4.6,
    serviceCount: 4,
    postsLast30Days: 0,
    completenessPercent: 78,
  }, '2026-09-01');
  const current = auditWith(81, {
    reviewCount: 284,
    averageRating: 4.7,
    serviceCount: 7,
    postsLast30Days: 4,
    completenessPercent: 89,
  }, '2026-09-08');

  const diff = diffSignals(current, previous);
  assert.equal(diff.scoreDelta, 9);

  const byKey = Object.fromEntries(diff.changes.map((change) => [change.key, change]));
  assert.equal(byKey.reviewCount.delta, 6);
  assert.equal(byKey.serviceCount.delta, 3);
  assert.equal(byKey.postsLast30Days.delta, 4);
  assert.equal(byKey.averageRating.from, '4.6');
  assert.equal(byKey.averageRating.to, '4.7');
  assert.equal(byKey.completenessPercent.suffix, '%');
  for (const change of diff.changes) assert.equal(change.improved, true);
});

test('a rise in unanswered reviews is reported as a regression', () => {
  const diff = diffSignals(
    auditWith(70, { unansweredReviews: 12 }),
    auditWith(75, { unansweredReviews: 3 })
  );
  assert.equal(diff.changes[0].key, 'unansweredReviews');
  assert.equal(diff.changes[0].improved, false);
});

test('a signal missing from either run is skipped rather than shown as a change', () => {
  const diff = diffSignals(
    auditWith(80, { reviewCount: 10, photoCount: 20 }),
    auditWith(75, { reviewCount: 8 })
  );
  assert.deepEqual(diff.changes.map((change) => change.key), ['reviewCount']);
});

test('unchanged signals produce no rows', () => {
  const diff = diffSignals(auditWith(80, { reviewCount: 10 }), auditWith(80, { reviewCount: 10 }));
  assert.deepEqual(diff.changes, []);
  assert.equal(diff.scoreDelta, 0);
});

test('there is nothing to diff against a first run', () => {
  assert.equal(diffSignals(auditWith(80, { reviewCount: 10 }), null), null);
});
