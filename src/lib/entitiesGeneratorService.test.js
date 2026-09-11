import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_KEYWORDS,
  MAX_KEYWORDS_INPUT_LENGTH,
  MAX_KEYWORD_LENGTH,
  generateEntityGroups,
  normalizeEntityGroups,
  normalizeKeywordsInput,
} from './entitiesGeneratorService.js';

function deepseekResponse(groups) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ groups }) } }],
      usage: { total_tokens: 10 },
      model: 'deepseek-chat',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

async function withStubbedFetch(impl, run) {
  const previous = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await run();
  } finally {
    globalThis.fetch = previous;
  }
}

/* ── validation ── */

test('splits keywords on commas and newlines, like the page textarea', () => {
  const { keywords } = normalizeKeywordsInput('seo tools, keyword research\ncontent optimization');
  assert.deepEqual(keywords, ['seo tools', 'keyword research', 'content optimization']);
});

test('trims and de-duplicates keywords case-insensitively', () => {
  const { keywords } = normalizeKeywordsInput('  seo tools , SEO Tools\nseo tools  ');
  assert.deepEqual(keywords, ['seo tools']);
});

test('accepts an array and applies the same splitting rules', () => {
  const { keywords } = normalizeKeywordsInput(['seo tools', 'keyword research, serp analysis']);
  assert.deepEqual(keywords, ['seo tools', 'keyword research', 'serp analysis']);
});

test('rejects missing or empty keywords', () => {
  assert.throws(() => normalizeKeywordsInput(undefined), /keywords is required/);
  assert.throws(() => normalizeKeywordsInput(''), /At least one keyword is required/);
  assert.throws(() => normalizeKeywordsInput('  ,  \n , '), /At least one keyword is required/);
});

test('rejects wrong data types', () => {
  assert.throws(() => normalizeKeywordsInput(42), /string or an array of strings/);
  assert.throws(() => normalizeKeywordsInput([{ keyword: 'x' }]), /string or an array of strings/);
});

test('enforces the keyword count, length and payload caps', () => {
  const tooMany = Array.from({ length: MAX_KEYWORDS + 1 }, (_, i) => `keyword ${i}`);
  assert.throws(() => normalizeKeywordsInput(tooMany), /maximum of 50 keywords/);
  assert.throws(
    () => normalizeKeywordsInput('x'.repeat(MAX_KEYWORD_LENGTH + 1)),
    /Each keyword must be 200 characters or fewer/
  );
  assert.throws(
    () => normalizeKeywordsInput('y'.repeat(MAX_KEYWORDS_INPUT_LENGTH + 1)),
    /10000 characters or fewer/
  );
});

test('validation errors carry status 400 and the keywords field', () => {
  try {
    normalizeKeywordsInput('');
    assert.fail('expected throw');
  } catch (error) {
    assert.equal(error.status, 400);
    assert.equal(error.field, 'keywords');
  }
});

test('normalizeEntityGroups drops blank keywords and blank entities', () => {
  assert.deepEqual(
    normalizeEntityGroups([
      { keyword: ' seo ', entities: [' Ahrefs ', '', null, 'Moz'] },
      { keyword: '', entities: ['x'] },
      { keyword: 'ppc', entities: 'not-an-array' },
    ]),
    [
      { keyword: 'seo', entities: ['Ahrefs', 'Moz'] },
      { keyword: 'ppc', entities: [] },
    ]
  );
});

/* ── generation ── */

test('returns DeepSeek entities when the AI call succeeds', async () => {
  const result = await withStubbedFetch(
    async (url, init) => {
      assert.match(String(url), /api\.deepseek\.com/);
      assert.equal(init.headers.Authorization, 'Bearer test-key');
      return deepseekResponse([
        { keyword: 'seo tools', entities: ['Ahrefs', 'SEMrush', 'Moz Pro'] },
        { keyword: 'keyword research', entities: ['Search Volume', 'CPC'] },
      ]);
    },
    () => generateEntityGroups({ keywords: 'seo tools, keyword research', apiKey: 'test-key' })
  );

  assert.equal(result.ai.applied, true);
  assert.equal(result.keywordCount, 2);
  assert.equal(result.entityCount, 5);
  assert.deepEqual(result.groups, [
    { keyword: 'seo tools', entities: ['Ahrefs', 'SEMrush', 'Moz Pro'] },
    { keyword: 'keyword research', entities: ['Search Volume', 'CPC'] },
  ]);
});

test('falls back to the local generator when DeepSeek fails', async () => {
  const result = await withStubbedFetch(
    async () =>
      new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    () => generateEntityGroups({ keywords: 'seo tools', apiKey: 'test-key' })
  );

  assert.equal(result.ai.applied, false);
  assert.match(result.ai.reason, /quota exceeded/i);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].keyword, 'seo tools');
  assert.ok(result.groups[0].entities.length > 0, 'local fallback should still produce entities');
});

test('falls back when no DeepSeek key is configured', async () => {
  const result = await generateEntityGroups({ keywords: 'seo tools' });

  assert.equal(result.ai.applied, false);
  assert.match(result.ai.reason, /DeepSeek API is not configured/i);
  assert.ok(result.groups[0].entities.length > 0);
});

test('keeps one group per submitted keyword even if DeepSeek omits some', async () => {
  const result = await withStubbedFetch(
    async () => deepseekResponse([{ keyword: 'seo tools', entities: ['Ahrefs'] }]),
    () => generateEntityGroups({ keywords: 'seo tools\nkeyword research', apiKey: 'test-key' })
  );

  assert.deepEqual(result.groups.map((g) => g.keyword), ['seo tools', 'keyword research']);
  assert.ok(result.groups[1].entities.length > 0, 'missing group falls back to local entities');
});

test('validation runs before any AI call', async () => {
  let called = false;
  await withStubbedFetch(
    async () => {
      called = true;
      return deepseekResponse([]);
    },
    async () => {
      await assert.rejects(generateEntityGroups({ keywords: '' }), /At least one keyword/);
    }
  );
  assert.equal(called, false);
});
