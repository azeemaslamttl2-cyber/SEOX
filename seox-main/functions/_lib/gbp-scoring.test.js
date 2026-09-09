import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildIssues,
  calculateHealthScore,
  evaluateCompleteness,
  groupMetricTotals,
  percentChange,
  starRatingToNumber,
} from './gbp-scoring.js';

const completeProfile = {
  title: 'ABC Plumbing',
  categories: {
    primaryCategory: { displayName: 'Plumber' },
    additionalCategories: [{ displayName: 'Drainage service' }],
  },
  phoneNumbers: { primaryPhone: '+92 300 1234567' },
  websiteUri: 'https://abcplumbing.example',
  storefrontAddress: { addressLines: ['12 Main Road'], locality: 'Lahore' },
  regularHours: { periods: [{ openDay: 'MONDAY' }] },
  specialHours: { specialHourPeriods: [{ closed: true }] },
  profile: { description: 'x'.repeat(300) },
};

test('a fully populated profile scores 100 percent complete', () => {
  const result = evaluateCompleteness(completeProfile);
  assert.equal(result.passed, result.total);
  assert.equal(result.percent, 100);
});

test('missing description and secondary categories are reported individually', () => {
  const result = evaluateCompleteness({
    ...completeProfile,
    categories: { primaryCategory: { displayName: 'Plumber' } },
    profile: { description: 'too short' },
  });

  const failed = result.checks.filter((check) => !check.ok).map((check) => check.key);
  assert.deepEqual(failed.sort(), ['additionalCategories', 'description']);
  assert.equal(result.percent, 78);
});

test('a service area business counts as having an address', () => {
  const result = evaluateCompleteness({
    ...completeProfile,
    storefrontAddress: undefined,
    serviceArea: { places: { placeInfos: [{ placeName: 'Lahore' }] } },
  });
  assert.equal(result.checks.find((check) => check.key === 'address').ok, true);
});

test('health score rewards a verified, answered, recently posted listing', () => {
  const { score, breakdown } = calculateHealthScore({
    completenessPercent: 100,
    verificationStatus: 'VERIFIED',
    averageRating: 4.8,
    reviews: { inspectedCount: 20, unansweredInRecent: 0 },
    posts: { lastPostAt: new Date() },
    hasGoogleUpdates: false,
  });

  assert.equal(score, 100);
  assert.equal(breakdown.verification, 15);
  assert.equal(breakdown.rating, 15);
});

test('an unverified listing with no reviews or posts scores only completeness', () => {
  const { score, breakdown } = calculateHealthScore({
    completenessPercent: 100,
    verificationStatus: 'UNVERIFIED',
    averageRating: null,
    reviews: { inspectedCount: 0, unansweredInRecent: 0 },
    posts: { lastPostAt: null },
    hasGoogleUpdates: true,
  });

  assert.equal(breakdown.completeness, 30);
  assert.equal(breakdown.verification, 0);
  assert.equal(breakdown.googleUpdates, 0);
  assert.equal(score, 30);
});

test('a stale post window loses posting points progressively', () => {
  const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const scoreFor = (days) =>
    calculateHealthScore({
      completenessPercent: 0,
      verificationStatus: 'UNVERIFIED',
      averageRating: null,
      reviews: {},
      posts: { lastPostAt: daysAgo(days) },
      hasGoogleUpdates: true,
    }).breakdown.posting;

  assert.equal(scoreFor(2), 15);
  assert.equal(scoreFor(10), 11);
  assert.equal(scoreFor(20), 5);
  assert.equal(scoreFor(60), 0);
});

test('unanswered one-star reviews are raised as critical, ahead of profile gaps', () => {
  const issues = buildIssues({
    completeness: evaluateCompleteness({ ...completeProfile, websiteUri: undefined }),
    verificationStatus: 'VERIFIED',
    averageRating: 4.7,
    reviews: {
      inspectedCount: 10,
      unansweredInRecent: 3,
      latest: [
        { starRating: 'ONE', replied: false },
        { starRating: 'TWO', replied: false },
        { starRating: 'FIVE', replied: false },
      ],
    },
    posts: { lastPostAt: new Date() },
    hasGoogleUpdates: false,
  });

  assert.equal(issues[0].severity, 'critical');
  assert.match(issues[0].title, /2 unanswered negative reviews/);
  assert.equal(issues[1].severity, 'high');
  assert.ok(issues.some((issue) => issue.title === 'Website URL is missing'));
});

test('an unverified location is always the first issue', () => {
  const issues = buildIssues({
    completeness: evaluateCompleteness(completeProfile),
    verificationStatus: 'UNVERIFIED',
    averageRating: 5,
    reviews: { inspectedCount: 5, unansweredInRecent: 0, latest: [] },
    posts: { lastPostAt: new Date() },
    hasGoogleUpdates: false,
  });

  assert.equal(issues[0].title, 'Location is not verified');
  assert.equal(issues[0].severity, 'critical');
});

test('desktop and mobile impressions are folded into search and maps views', () => {
  const grouped = groupMetricTotals({
    BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: 4000,
    BUSINESS_IMPRESSIONS_MOBILE_SEARCH: 4428,
    BUSINESS_IMPRESSIONS_DESKTOP_MAPS: 6000,
    BUSINESS_IMPRESSIONS_MOBILE_MAPS: 8622,
    CALL_CLICKS: 291,
  });

  assert.equal(grouped.searchViews, 8428);
  assert.equal(grouped.mapsViews, 14622);
  assert.equal(grouped.calls, 291);
  assert.equal(grouped.websiteClicks, 0);
});

test('percent change handles a zero baseline without dividing by zero', () => {
  assert.equal(percentChange(8428, 7109), 18.6);
  assert.equal(percentChange(0, 0), 0);
  assert.equal(percentChange(50, 0), null);
});

test('star rating enums map to numbers', () => {
  assert.equal(starRatingToNumber('FIVE'), 5);
  assert.equal(starRatingToNumber('one'), 1);
  assert.equal(starRatingToNumber(4), 4);
  assert.equal(starRatingToNumber('UNSPECIFIED'), 0);
});
