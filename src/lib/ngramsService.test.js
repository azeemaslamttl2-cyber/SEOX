import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_TEXT_LENGTH,
  buildUniqueSeed,
  extractContentNgrams,
  normalizeNgramsInput,
} from './ngramsService.js';
import { extractNgramsFromText, getSourceText } from './contentTools.js';

const SAMPLE = `
  Technical SEO audits review crawl budget and index coverage.
  Technical SEO audits also review crawl budget problems.
  Crawl budget matters for technical SEO audits.
`;

const PAGE_HTML = `
  <html><head><title>Crawl Budget</title></head>
    <body><main>
      <h1>Crawl Budget Guide</h1>
      <p>Technical SEO audits review crawl budget. Technical SEO audits review index coverage.
         Crawl budget optimisation helps technical SEO audits.</p>
    </main></body></html>
`;

/* ── validation ── */

test('mode defaults to url like the page', () => {
  assert.equal(normalizeNgramsInput({ url: 'https://a.com' }).mode, 'url');
});

test('defaults to all three sizes, which is what the page computes', () => {
  assert.deepEqual(normalizeNgramsInput({ mode: 'text', text: 'x' }).sizes, [1, 2, 3]);
});

test('rejects an unsupported mode', () => {
  assert.throws(() => normalizeNgramsInput({ mode: 'pdf' }), /mode must be one of: url, text/);
});

test('text mode requires text', () => {
  assert.throws(() => normalizeNgramsInput({ mode: 'text' }), /text is required/);
  assert.throws(() => normalizeNgramsInput({ mode: 'text', text: '   ' }), /text is required/);
  assert.throws(() => normalizeNgramsInput({ mode: 'text', text: 5 }), /must be a string/);
});

test('text mode accepts `content` as an alias', () => {
  assert.equal(normalizeNgramsInput({ mode: 'text', content: 'hello there' }).text, 'hello there');
});

test('text mode enforces the size cap', () => {
  assert.throws(
    () => normalizeNgramsInput({ mode: 'text', text: 'x'.repeat(MAX_TEXT_LENGTH + 1) }),
    /characters or fewer/
  );
});

test('url mode takes a single url and upgrades bare domains', () => {
  assert.equal(normalizeNgramsInput({ mode: 'url', url: 'moz.com' }).url, 'https://moz.com/');
  assert.throws(() => normalizeNgramsInput({ mode: 'url' }), /url is required/);
  assert.throws(() => normalizeNgramsInput({ mode: 'url', url: 'javascript:x' }), /Only HTTP and HTTPS/);
});

test('url mode rejects more than one url', () => {
  assert.throws(
    () => normalizeNgramsInput({ mode: 'url', url: ['https://a.com', 'https://b.com'] }),
    /maximum of 1 URLs/
  );
});

test('sizes accepts a subset and `n` as a single-size alias', () => {
  assert.deepEqual(normalizeNgramsInput({ mode: 'text', text: 'x', sizes: [2, 3] }).sizes, [2, 3]);
  assert.deepEqual(normalizeNgramsInput({ mode: 'text', text: 'x', n: 2 }).sizes, [2]);
  assert.deepEqual(normalizeNgramsInput({ mode: 'text', text: 'x', sizes: [3, 1, 3] }).sizes, [1, 3]);
});

test('rejects invalid n-gram sizes', () => {
  assert.throws(() => normalizeNgramsInput({ mode: 'text', text: 'x', n: 4 }), /must be one of: 1, 2, 3/);
  assert.throws(() => normalizeNgramsInput({ mode: 'text', text: 'x', n: 0 }), /must be one of: 1, 2, 3/);
  assert.throws(() => normalizeNgramsInput({ mode: 'text', text: 'x', sizes: [1, 9] }), /must be one of: 1, 2, 3/);
});

test('rejects a non-boolean includeUnique', () => {
  assert.throws(
    () => normalizeNgramsInput({ mode: 'text', text: 'x', includeUnique: 'yes' }),
    /includeUnique must be a boolean/
  );
});

test('validation errors carry status 400 and a field', () => {
  try {
    normalizeNgramsInput({ mode: 'text' });
    assert.fail('expected throw');
  } catch (error) {
    assert.equal(error.status, 400);
    assert.equal(error.field, 'text');
  }
});

/* ── extraction ── */

test('extracts unigrams, bigrams and trigrams with counts and density', async () => {
  const result = await extractContentNgrams({ mode: 'text', text: SAMPLE });

  assert.deepEqual(Object.keys(result.ngrams), ['unigrams', 'bigrams', 'trigrams']);

  const top = result.ngrams.unigrams[0];
  assert.deepEqual(Object.keys(top).sort(), ['count', 'density', 'ngram']);
  assert.match(top.density, /^\d+\.\d{2}%$/);

  const trigram = result.ngrams.trigrams.find((i) => i.ngram === 'technical seo audits');
  assert.ok(trigram, 'expected the repeated trigram to be found');
  assert.equal(trigram.count, 3);
});

test('PARITY: service output matches the page pipeline exactly (text mode)', async () => {
  // What the page used to do inline.
  const source = await getSourceText({ mode: 'text', text: SAMPLE, url: '' });
  const expected = extractNgramsFromText(source);

  const result = await extractContentNgrams({ mode: 'text', text: SAMPLE });

  assert.deepEqual(result.ngrams, expected);
});

test('PARITY: service output matches the page pipeline exactly (url mode)', async () => {
  const fetchHtml = async () => PAGE_HTML;

  const source = await getSourceText({ mode: 'url', text: '', url: 'https://example.com/x', fetchHtml });
  const expected = extractNgramsFromText(source);

  const result = await extractContentNgrams({ mode: 'url', url: 'https://example.com/x', fetchHtml });

  assert.deepEqual(result.ngrams, expected);
});

test('returns only the requested sizes', async () => {
  const result = await extractContentNgrams({ mode: 'text', text: SAMPLE, sizes: [2] });

  assert.deepEqual(Object.keys(result.ngrams), ['bigrams']);
  assert.deepEqual(result.sizes, [2]);
  assert.equal(typeof result.counts.bigrams, 'number');
});

test('stop words are filtered out of every n-gram', async () => {
  const result = await extractContentNgrams({
    mode: 'text',
    text: 'the quick brown fox and the lazy dog with the quick brown fox',
  });

  const all = [
    ...result.ngrams.unigrams,
    ...result.ngrams.bigrams,
    ...result.ngrams.trigrams,
  ].map((i) => i.ngram);

  for (const stop of ['the', 'and', 'with']) {
    assert.ok(!all.some((g) => g.split(' ').includes(stop)), `"${stop}" should be filtered out`);
  }
});

test('returns empty n-grams for contentless input rather than throwing', async () => {
  const result = await extractContentNgrams({
    mode: 'url',
    url: 'https://example.com',
    fetchHtml: async () => '<html><body><p>.</p></body></html>',
  });

  assert.deepEqual(result.ngrams.unigrams, []);
  assert.equal(result.counts.unigrams, 0);
});

test('propagates fetch failures', async () => {
  await assert.rejects(
    extractContentNgrams({
      mode: 'url',
      url: 'https://blocked.example.com',
      fetchHtml: async () => {
        throw new Error('Failed to fetch page content');
      },
    }),
    /Failed to fetch page content/
  );
});

/* ── unique n-grams (optional AI step) ── */

test('the unique step is skipped unless requested', async () => {
  const result = await extractContentNgrams({ mode: 'text', text: SAMPLE });

  assert.deepEqual(result.unique, { requested: false, applied: false, reason: '', ngrams: [] });
});

test('buildUniqueSeed follows the page precedence: text, then url, then top n-grams', () => {
  assert.equal(buildUniqueSeed({ text: ' my topic ', url: 'https://a.com' }), 'my topic');
  assert.equal(buildUniqueSeed({ text: '', url: ' https://a.com ' }), 'https://a.com');
  assert.equal(
    buildUniqueSeed({ text: '', url: '', ngrams: { unigrams: [{ ngram: 'seo' }], bigrams: [], trigrams: [] } }),
    'seo'
  );
});

test('unique step falls back locally when DeepSeek is unavailable', async () => {
  const result = await extractContentNgrams({ mode: 'text', text: SAMPLE, includeUnique: true });

  assert.equal(result.unique.requested, true);
  assert.equal(result.unique.applied, false);
  assert.match(result.unique.reason, /DeepSeek API is not configured/i);
  assert.ok(result.unique.ngrams.length > 0, 'local fallback should still produce n-grams');
});
