import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_OUTLINE_URLS,
  generateContentOutline,
  normalizeOutlineItems,
  normalizeOutlineUrls,
} from './outlineService.js';

const SAMPLE_HTML = `
  <html>
    <head><title>Sample Page</title></head>
    <body>
      <h1>Main Title</h1>
      <h2>First Section</h2>
      <h3>Nested Detail</h3>
    </body>
  </html>
`;

test('normalizeOutlineUrls upgrades bare domains like the page does', () => {
  assert.deepEqual(normalizeOutlineUrls('example.com'), ['https://example.com/']);
});

test('normalizeOutlineUrls trims, de-duplicates and keeps order', () => {
  assert.deepEqual(
    normalizeOutlineUrls(['  https://a.com/  ', 'https://a.com/', 'https://b.com/x']),
    ['https://a.com/', 'https://b.com/x']
  );
});

test('normalizeOutlineUrls rejects empty input', () => {
  assert.throws(() => normalizeOutlineUrls([]), /At least one valid URL is required/);
  assert.throws(() => normalizeOutlineUrls(['   ']), /At least one valid URL is required/);
  assert.throws(() => normalizeOutlineUrls(undefined), /urls is required/);
});

test('normalizeOutlineUrls rejects wrong data types', () => {
  assert.throws(() => normalizeOutlineUrls([{ url: 'https://a.com' }]), /array of strings/);
  assert.throws(() => normalizeOutlineUrls([42]), /array of strings/);
});

test('normalizeOutlineUrls rejects non-http schemes and malformed values', () => {
  assert.throws(() => normalizeOutlineUrls('javascript:alert(1)'), /Only HTTP and HTTPS/);
  assert.throws(() => normalizeOutlineUrls('ftp://files.example.com'), /Only HTTP and HTTPS/);
  assert.throws(() => normalizeOutlineUrls('not a url'), /Invalid URL/);
});

test('normalizeOutlineUrls enforces the URL limit', () => {
  const tooMany = Array.from({ length: MAX_OUTLINE_URLS + 1 }, (_, i) => `https://site${i}.com`);
  assert.throws(() => normalizeOutlineUrls(tooMany), /maximum of 20 URLs/);
});

test('validation errors carry a 400 status and field', () => {
  try {
    normalizeOutlineUrls([]);
    assert.fail('expected throw');
  } catch (error) {
    assert.equal(error.status, 400);
    assert.equal(error.field, 'urls');
  }
});

test('normalizeOutlineItems drops blank text and invalid tags', () => {
  assert.deepEqual(
    normalizeOutlineItems([
      { tag: 'H1', text: ' Title ' },
      { tag: 'h9', text: 'Bad tag' },
      { tag: 'h2', text: '   ' },
      { tag: 'h3', text: 'Kept' },
    ]),
    [
      { tag: 'h1', text: 'Title' },
      { tag: 'h3', text: 'Kept' },
    ]
  );
});

test('generateContentOutline extracts headings and degrades when AI is unavailable', async () => {
  const result = await generateContentOutline({
    urls: ['https://example.com'],
    fetchHtml: async () => SAMPLE_HTML,
  });

  assert.equal(result.ai.applied, false);
  assert.match(result.ai.reason, /DeepSeek API is not configured/i);
  assert.equal(result.extractedCount, 3);
  assert.deepEqual(result.outline, [
    { tag: 'h1', text: 'Main Title' },
    { tag: 'h2', text: 'First Section' },
    { tag: 'h3', text: 'Nested Detail' },
  ]);
});

test('generateContentOutline reports when no headings are found', async () => {
  const result = await generateContentOutline({
    urls: ['https://example.com'],
    fetchHtml: async () => '<html><body><p>no headings</p></body></html>',
  });

  assert.deepEqual(result.outline, []);
  assert.equal(result.headingCount, 0);
  assert.match(result.message, /No headings were found/i);
});

test('generateContentOutline surfaces fetch failures to the caller', async () => {
  await assert.rejects(
    generateContentOutline({
      urls: ['https://blocked.example.com'],
      fetchHtml: async () => {
        throw new Error('Failed to fetch page content');
      },
    }),
    /Failed to fetch page content/
  );
});

test('generateContentOutline fetches every supplied URL', async () => {
  const seen = [];
  await generateContentOutline({
    urls: ['https://a.com', 'b.com'],
    fetchHtml: async (url) => {
      seen.push(url);
      return SAMPLE_HTML;
    },
  });

  assert.deepEqual(seen, ['https://a.com/', 'https://b.com/']);
});
