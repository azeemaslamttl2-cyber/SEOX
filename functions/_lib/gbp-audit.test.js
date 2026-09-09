import test from 'node:test';
import assert from 'node:assert/strict';

import { CHECK_WEIGHTS, diffAudits, runAudit } from './gbp-audit.js';

const fullProfile = {
  title: 'ABC Plumbing',
  categories: {
    primaryCategory: { displayName: 'Plumber' },
    additionalCategories: [{ displayName: 'Drainage' }, { displayName: 'Leak repair' }],
  },
  phoneNumbers: { primaryPhone: '+92 42 111 2222' },
  websiteUri: 'https://abcplumbing.example',
  storefrontAddress: { addressLines: ['12 Main Road'], locality: 'Lahore' },
  regularHours: { periods: [{ openDay: 'MONDAY' }] },
  specialHours: { specialHourPeriods: [{ closed: true }] },
  profile: { description: 'x'.repeat(300) },
  serviceItems: Array.from({ length: 6 }, (_, index) => ({
    freeFormServiceItem: { label: { displayName: `Service ${index}` } },
  })),
};

const healthySignals = {
  profile: fullProfile,
  attributes: { attributes: Array.from({ length: 6 }, (_, i) => ({ name: `a${i}` })) },
  reviews: {
    averageRating: 4.8,
    totalReviews: 284,
    inspectedCount: 50,
    unansweredInRecent: 0,
    latest: [],
  },
  posts: { postsLast30Days: 5, lastPostAt: new Date() },
  media: { total: 30, byCategory: {} },
  qanda: { total: 10, answered: 10, unanswered: 0 },
  verificationStatus: 'VERIFIED',
  openStatus: 'OPEN',
  hasGoogleUpdates: false,
};

test('the scored weights sum to exactly 100', () => {
  const total = Object.values(CHECK_WEIGHTS).reduce((sum, value) => sum + value, 0);
  assert.equal(total, 100);
});

test('a healthy listing scores 100 with every check passing', () => {
  const result = runAudit(healthySignals);
  assert.equal(result.score, 100);
  assert.equal(result.pointsEarned, result.pointsPossible);
  assert.deepEqual(result.counts, { critical: 0, high: 0, medium: 0, low: 0, opportunity: 0 });
});

test('an unverified listing raises a critical issue first', () => {
  const result = runAudit({ ...healthySignals, verificationStatus: 'UNVERIFIED' });
  assert.equal(result.issues[0].severity, 'critical');
  assert.equal(result.issues[0].key, 'verification');
  assert.equal(result.counts.critical, 1);
  assert.equal(result.score, 88);
});

test('a skipped check is removed from the denominator, not scored as zero', () => {
  const withoutMedia = runAudit({ ...healthySignals, media: null });

  // photos is worth 8; dropping it must leave a perfect listing on 100, not 92.
  assert.equal(withoutMedia.score, 100);
  assert.equal(withoutMedia.pointsPossible, 100 - CHECK_WEIGHTS.photos);
  assert.ok(withoutMedia.skippedChecks.some((entry) => entry.key === 'photos'));
});

test('every unfetched signal is reported as skipped with a reason', () => {
  const bare = runAudit({
    ...healthySignals,
    attributes: null,
    reviews: null,
    posts: null,
    media: null,
    qanda: null,
  });

  const keys = bare.skippedChecks.map((entry) => entry.key).sort();
  assert.deepEqual(keys, [
    'attributes',
    'photos',
    'postingFrequency',
    'qandaActivity',
    'rankGrid',
    'reviewRating',
    'reviewResponseRate',
  ].sort());
  for (const entry of bare.skippedChecks) assert.ok(entry.reason);
});

test('RankGrid is always reported as not yet linked', () => {
  const result = runAudit(healthySignals);
  const rankGrid = result.skippedChecks.find((entry) => entry.key === 'rankGrid');
  assert.ok(rankGrid);
  assert.match(rankGrid.reason, /phase 4/);
});

test('unanswered negative reviews make the response check critical', () => {
  const result = runAudit({
    ...healthySignals,
    reviews: {
      averageRating: 4.1,
      totalReviews: 100,
      inspectedCount: 20,
      unansweredInRecent: 4,
      latest: [
        { starRating: 'ONE', replied: false },
        { starRating: 'FIVE', replied: true },
      ],
    },
  });

  const responseCheck = result.issues.find((issue) => issue.key === 'reviewResponseRate');
  assert.equal(responseCheck.severity, 'critical');
  assert.equal(responseCheck.passed, false);
  assert.equal(responseCheck.pointsEarned, 8); // 16 of 20 answered -> 80% of 10
});

test('partial credit is given for a partly complete profile', () => {
  const result = runAudit({
    ...healthySignals,
    profile: { ...fullProfile, serviceItems: [{ freeFormServiceItem: { label: { displayName: 'One' } } }] },
  });
  const services = result.issues.find((issue) => issue.key === 'services');
  assert.equal(services.passed, false);
  // 1 of the 5 expected services -> 20% of the 6 point weight.
  assert.equal(services.pointsEarned, 1);
});

test('a pending Google update halves the location status score', () => {
  const result = runAudit({ ...healthySignals, hasGoogleUpdates: true });
  const status = result.issues.find((issue) => issue.key === 'locationStatus');
  assert.equal(status.pointsEarned, 3);
  assert.equal(status.severity, 'critical');
  assert.match(status.title, /suggested a profile change/);
});

test('passing checks are listed after every failing one', () => {
  const result = runAudit({ ...healthySignals, verificationStatus: 'UNVERIFIED' });
  const firstPassing = result.issues.findIndex((issue) => issue.passed);
  const lastFailing = result.issues.map((issue) => issue.passed).lastIndexOf(false);
  assert.ok(lastFailing < firstPassing);
});

test('diffAudits reports score movement and the checks behind it', () => {
  const current = runAudit(healthySignals);
  const previous = { score: 88, breakdown: JSON.stringify({ verification: { earned: 0, possible: 12 } }), created_at: '2026-09-01' };

  const diff = diffAudits(current, previous);
  assert.equal(diff.scoreDelta, 12);
  assert.equal(diff.movements[0].key, 'verification');
  assert.equal(diff.movements[0].delta, 12);
});

test('diffAudits returns null without a previous run', () => {
  assert.equal(diffAudits(runAudit(healthySignals), null), null);
});
