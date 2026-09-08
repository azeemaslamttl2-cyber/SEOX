import test from 'node:test';
import assert from 'node:assert/strict';
import { separateDomains, validateDomainSeparatorInput } from './domain-separator.js';

test('domain separator matches the frontend normalization and deduplication', () => {
  const processed = separateDomains({
    text: 'https://www.Example.com/path\nexample.com\nblog.example.com/page\nnot a domain\n\nhttps://www.Example.com',
  });

  assert.deepEqual(processed.result, [
    'example.com',
    'blog.example.com',
    'not a domain',
  ]);
  assert.equal(processed.inputLineCount, 5);
  assert.equal(processed.uniqueDomainCount, 3);
});

test('domain separator preserves empty input behavior', () => {
  const processed = separateDomains({ text: '' });
  assert.deepEqual(processed.result, []);
  assert.equal(processed.inputLineCount, 0);
});

test('domain separator validates the API input', () => {
  assert.throws(() => validateDomainSeparatorInput({}), /text is required/);
  assert.throws(() => validateDomainSeparatorInput({ text: 42 }), /text is required/);
  assert.throws(() => validateDomainSeparatorInput({ text: 'x'.repeat(2_000_001) }), /characters or fewer/);
});
