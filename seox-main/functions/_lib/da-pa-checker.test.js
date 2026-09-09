import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateDaPa } from './seo-tools.js';

test('DA/PA checker matches the frontend for domains and URLs', () => {
  const result = estimateDaPa({
    text: 'example.com\nhttps://www.example.org/path\n\nexample.com',
  });

  assert.deepEqual(result.results, [
    { domain: 'example.com', da: 70, pa: 80, spam: 3 },
    { domain: 'example.org', da: 79, pa: 60, spam: 0 },
    { domain: 'example.com', da: 70, pa: 80, spam: 3 },
  ]);
  assert.equal(result.count, 3);
});

test('DA/PA checker returns an empty result for empty text', () => {
  assert.deepEqual(estimateDaPa({ text: '' }), { results: [], count: 0 });
});

test('DA/PA checker rejects malformed API text input', () => {
  assert.throws(() => estimateDaPa({}), /text is required/);
  assert.throws(() => estimateDaPa({ text: 42 }), /text is required/);
});
