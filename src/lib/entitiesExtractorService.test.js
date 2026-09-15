import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_ENTITY_LIMIT,
  MAX_ENTITY_LIMIT,
  MAX_TEXT_LENGTH,
  extractContentEntities,
  normalizeEntitiesInput,
} from './entitiesExtractorService.js';

const ARTICLE = `
  Google announced a major update to Search Engine Optimization guidance.
  Google said the PageRank algorithm still matters. Search Engine Optimization
  experts at Moz and Ahrefs reviewed the Google announcement carefully.
  Google published the documentation for Search Engine Optimization teams.
`;

const PAGE_HTML = `
  <html><head><title>Ranking Factors</title></head>
    <body><main>
      <h1>Google Ranking Factors</h1>
      <p>Google evaluates Search Engine Optimization signals. Google uses PageRank.
         Search Engine Optimization teams track Google updates closely.</p>
    </main></body>
  </html>
`;

/* ── validation ── */

test('mode defaults to url like the page', () => {
  const input = normalizeEntitiesInput({ urls: ['https://a.com'] });
  assert.equal(input.mode, 'url');
  assert.equal(input.limit, DEFAULT_ENTITY_LIMIT);
});

test('rejects an unsupported mode', () => {
  assert.throws(() => normalizeEntitiesInput({ mode: 'pdf' }), /mode must be one of: url, text/);
});

test('text mode requires content', () => {
  assert.throws(() => normalizeEntitiesInput({ mode: 'text' }), /content is required/);
  assert.throws(() => normalizeEntitiesInput({ mode: 'text', content: '   ' }), /content is required/);
});

test('text mode rejects a non-string content', () => {
  assert.throws(
    () => normalizeEntitiesInput({ mode: 'text', content: 42 }),
    /content is required and must be a string/
  );
});

test('text mode accepts `text` as an alias for `content`', () => {
  const input = normalizeEntitiesInput({ mode: 'text', text: 'hello world' });
  assert.equal(input.text, 'hello world');
});

test('text mode enforces the size cap', () => {
  assert.throws(
    () => normalizeEntitiesInput({ mode: 'text', content: 'x'.repeat(MAX_TEXT_LENGTH + 1) }),
    /characters or fewer/
  );
});

test('url mode requires at least one valid url', () => {
  assert.throws(() => normalizeEntitiesInput({ mode: 'url' }), /urls is required/);
  assert.throws(() => normalizeEntitiesInput({ mode: 'url', urls: [] }), /At least one valid URL/);
  assert.throws(() => normalizeEntitiesInput({ mode: 'url', urls: ['javascript:x'] }), /Only HTTP and HTTPS/);
});

test('url mode upgrades bare domains and accepts a single `url`', () => {
  assert.deepEqual(normalizeEntitiesInput({ mode: 'url', url: 'moz.com' }).urls, ['https://moz.com/']);
});

test('limit is validated', () => {
  assert.throws(() => normalizeEntitiesInput({ mode: 'text', content: 'x', limit: 0 }), /between 1 and/);
  assert.throws(() => normalizeEntitiesInput({ mode: 'text', content: 'x', limit: MAX_ENTITY_LIMIT + 1 }), /between 1 and/);
  assert.throws(() => normalizeEntitiesInput({ mode: 'text', content: 'x', limit: 2.5 }), /must be an integer/);
  assert.equal(normalizeEntitiesInput({ mode: 'text', content: 'x', limit: 5 }).limit, 5);
});

test('validation errors carry status 400 and a field', () => {
  try {
    normalizeEntitiesInput({ mode: 'text' });
    assert.fail('expected throw');
  } catch (error) {
    assert.equal(error.status, 400);
    assert.equal(error.field, 'content');
  }
});

/* ── extraction ── */

test('extracts entities from raw text with salience and mentions', async () => {
  const result = await extractContentEntities({ mode: 'text', content: ARTICLE });

  assert.equal(result.mode, 'text');
  assert.ok(result.entityCount > 0);
  assert.deepEqual(result.urls, []);

  const google = result.entities.find((e) => e.entity === 'Google');
  assert.ok(google, 'expected Google to be extracted');
  assert.ok(google.mentions >= 4);
  assert.ok(google.salience > 0 && google.salience <= 1);
  assert.ok(typeof google.type === 'string' && google.type.length);

  // sorted by mentions desc, and salience is normalised against the top entity
  assert.equal(result.entities[0].mentions >= result.entities[1].mentions, true);
  assert.equal(result.entities[0].salience, 1);
});

test('reports derived stats the page shows', async () => {
  const result = await extractContentEntities({ mode: 'text', content: ARTICLE });

  assert.deepEqual(result.types, Array.from(new Set(result.entities.map((e) => e.type))));
  const expectedAvg = Math.round(
    (result.entities.reduce((a, e) => a + e.salience, 0) / result.entities.length) * 100
  );
  assert.equal(result.averageSalience, expectedAvg);
  assert.equal(result.characters, ARTICLE.replace(/\s+/g, ' ').trim().length);
});

test('honours the limit', async () => {
  const result = await extractContentEntities({ mode: 'text', content: ARTICLE, limit: 3 });
  assert.equal(result.entities.length <= 3, true);
  assert.equal(result.limit, 3);
});

test('extracts from a single URL', async () => {
  const result = await extractContentEntities({
    mode: 'url',
    urls: ['https://example.com/ranking'],
    fetchHtml: async () => PAGE_HTML,
  });

  assert.deepEqual(result.urls, ['https://example.com/ranking']);
  assert.ok(result.entityCount > 0);
  assert.ok(result.entities.some((e) => e.entity === 'Google'));
});

test('merges text across multiple URLs', async () => {
  const seen = [];
  const result = await extractContentEntities({
    mode: 'url',
    urls: ['https://a.com', 'b.com'],
    fetchHtml: async (url) => {
      seen.push(url);
      return PAGE_HTML;
    },
  });

  assert.deepEqual(seen, ['https://a.com/', 'https://b.com/']);
  assert.ok(result.entityCount > 0);
  const google = result.entities.find((e) => e.entity === 'Google');
  assert.ok(google.mentions >= 6, 'mentions should accumulate across both pages');
});

test('returns an empty result set for contentless input rather than throwing', async () => {
  const result = await extractContentEntities({
    mode: 'url',
    urls: ['https://example.com'],
    fetchHtml: async () => '<html><body><p>.</p></body></html>',
  });

  assert.deepEqual(result.entities, []);
  assert.equal(result.entityCount, 0);
  assert.equal(result.averageSalience, 0);
});

test('propagates fetch failures', async () => {
  await assert.rejects(
    extractContentEntities({
      mode: 'url',
      urls: ['https://blocked.example.com'],
      fetchHtml: async () => {
        throw new Error('Failed to fetch page content');
      },
    }),
    /Failed to fetch page content/
  );
});
