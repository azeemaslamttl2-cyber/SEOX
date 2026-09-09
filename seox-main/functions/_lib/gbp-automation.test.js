import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RULE_MODES,
  RULE_TYPES,
  filterUrls,
  findServiceGaps,
  hashUrl,
  normaliseRuleConfig,
} from './gbp-automation.js';

const entries = [
  { url: 'https://example.com/blog/emergency-drains', lastmod: '2026-09-01' },
  { url: 'https://example.com/blog/tag/plumbing', lastmod: '2026-09-02' },
  { url: 'https://example.com/services/leak-repair', lastmod: '2026-08-01' },
  { url: 'https://example.com/about', lastmod: '2026-09-03' },
];

test('include and exclude filters are applied together', () => {
  const filtered = filterUrls(entries, { include: ['/blog/'], exclude: ['/tag/'] });
  assert.deepEqual(
    filtered.map((entry) => entry.url),
    ['https://example.com/blog/emergency-drains']
  );
});

test('an empty include list keeps everything that is not excluded', () => {
  const filtered = filterUrls(entries, { include: [], exclude: ['/about'] });
  assert.equal(filtered.length, 3);
});

test('the since filter drops pages last modified before the cutoff', () => {
  const filtered = filterUrls(entries, { since: '2026-09-01' });
  assert.equal(filtered.length, 3);
  assert.ok(!filtered.some((entry) => entry.url.includes('leak-repair')));
});

test('filters are plain substrings, so regex metacharacters cannot backtrack', () => {
  const filtered = filterUrls([{ url: 'https://example.com/a+b', lastmod: null }], {
    include: ['a+b'],
  });
  assert.equal(filtered.length, 1);
});

test('a service page missing from the GBP list is reported as a gap', () => {
  const gaps = findServiceGaps(
    [
      { url: 'https://example.com/services/leak-repair', title: 'Leak Repair | ABC Plumbing' },
      { url: 'https://example.com/services/drain-clearing', title: 'Drain Clearing' },
    ],
    [{ label: 'Drain clearing' }]
  );

  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].suggestedService, 'Leak Repair');
  assert.ok(gaps[0].url.includes('leak-repair'));
});

test('a service already listed on the profile is not reported', () => {
  const gaps = findServiceGaps(
    [{ url: 'https://example.com/services/leak-repair', title: 'Leak Repair' }],
    [{ label: 'Emergency leak repair services' }]
  );
  assert.equal(gaps.length, 0);
});

test('the page slug is used when a title could not be fetched', () => {
  const gaps = findServiceGaps(
    [{ url: 'https://example.com/services/water-heater-repair', title: null }],
    []
  );
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].suggestedService, 'water heater repair');
});

test('duplicate pages collapse to one gap', () => {
  const gaps = findServiceGaps(
    [
      { url: 'https://example.com/services/leak-repair', title: 'Leak Repair' },
      { url: 'https://example.com/services/leak-repair/', title: 'Leak Repair' },
    ],
    []
  );
  assert.equal(gaps.length, 1);
});

test('rule config is normalised with safe defaults and caps', () => {
  const config = normaliseRuleConfig('website_to_post', { maxPerRun: 99 });
  assert.equal(config.maxPerRun, 10);
  assert.deepEqual(config.include, ['/blog/']);
  assert.equal(config.utm.medium, 'gbp');
  assert.equal(config.useSourceImage, true);
});

test('an unknown rule type is refused', () => {
  assert.throws(() => normaliseRuleConfig('publish_everything', {}), /not a supported rule type/);
});

test('approval is a valid mode and the modes list is exported for the UI', () => {
  assert.deepEqual(RULE_MODES, ['manual', 'approval', 'auto']);
  assert.deepEqual(RULE_TYPES, ['website_to_post', 'service_gap']);
});

test('the URL hash is stable, so a page is only queued once', async () => {
  const first = await hashUrl('https://example.com/blog/post');
  const second = await hashUrl('https://example.com/blog/post');
  const other = await hashUrl('https://example.com/blog/other');

  assert.equal(first, second);
  assert.notEqual(first, other);
  assert.equal(first.length, 64);
});
