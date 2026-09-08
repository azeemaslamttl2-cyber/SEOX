import test from 'node:test';
import assert from 'node:assert/strict';
import { editUrls, estimateDaPa, generateRobots, viewAsBot } from './seo-tools.js';

test('URL editor operations match the page behavior', () => {
  assert.deepEqual(editUrls({ operation: 'dupes', text: 'a\na\nb' }).result, ['a', 'b']);
  assert.deepEqual(editUrls({ operation: 'serp', text: 'https://example.com/?utm_source=x&x=1' }).result, ['https://example.com/&x=1']);
  assert.deepEqual(editUrls({ operation: 'tld', text: 'https://example.com/page' }).result, ['com']);
});

test('DA/PA estimate matches the deterministic frontend calculation', () => {
  const result = estimateDaPa({ text: 'example.com' }).results[0];
  assert.deepEqual(result, { domain: 'example.com', da: 70, pa: 80, spam: 3 });
});

test('Bot Viewer and Robots Generator return frontend fields', () => {
  assert.equal(viewAsBot({ bot: 'Googlebot', url: 'https://example.com' }).status, 200);
  const robots = generateRobots({ wp: 'advanced', sitemap: 'https://example.com/sitemap.xml' }).robots;
  assert.match(robots, /Disallow: \/wp-content\/plugins\//);
  assert.match(robots, /Sitemap: https:\/\/example.com\/sitemap.xml/);
});

test('unsupported pure-tool input is rejected', () => {
  assert.throws(() => editUrls({ operation: 'unknown', text: 'x' }), /operation must be one of/);
  assert.throws(() => viewAsBot({ bot: 'Unknown', url: 'https://example.com' }), /Unsupported bot/);
});
