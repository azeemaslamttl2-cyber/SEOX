import test from 'node:test';
import assert from 'node:assert/strict';

import { extractContentNlpKeywords } from './nlpService.js';
import { generateGrammarRelationships, GRAMMAR_CATEGORIES } from './grammarService.js';
import { generateUniqueNgramPhrases } from './uniqueNgramsService.js';
import { generateSkipGramDominantWords } from './skipGramService.js';
import { analyzeContentForOptimization } from './optimizationService.js';
import { cleanAiWatermarks } from './watermarkService.js';
import { generateSemanticKeywordAnalysis } from './semanticGeneratorService.js';
import { analyzeCompetitorContent } from './contentAnalyzerService.js';

// The page-level functions, used for parity assertions.
import {
  analyzeContentOptimization,
  extractNlpKeywords,
  getSourceText,
  removeAiWatermarks,
} from './contentTools.js';

const ARTICLE = `
  Google announced improvements to Search Engine Optimization tooling.
  Google says the best technical audits improve crawl budget and growth.
  Search Engine Optimization teams at Moz track Google updates closely.
`;

const PAGE_HTML = `
  <html><head><title>SEO Guide</title></head>
    <body><main><h1>Google Ranking Factors</h1>
      <p>Google evaluates Search Engine Optimization signals and crawl budget.</p>
    </main></body></html>
`;

function aiJson(obj) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(obj) } }] }),
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

/* ───────────────────────── NLP ───────────────────────── */

test('NLP: extracts keywords with relevance, type and sentiment', async () => {
  const result = await extractContentNlpKeywords({ mode: 'text', text: ARTICLE });

  assert.equal(result.mode, 'text');
  assert.ok(result.keywordCount > 0);
  for (const kw of result.keywords) {
    assert.deepEqual(Object.keys(kw).sort(), ['keyword', 'relevance', 'sentiment', 'type']);
  }
  assert.ok(result.types.length > 0);
});

test('NLP: PARITY with the page pipeline', async () => {
  const source = await getSourceText({ mode: 'text', text: ARTICLE, url: '' });
  const expected = extractNlpKeywords(source);

  const result = await extractContentNlpKeywords({ mode: 'text', text: ARTICLE });
  assert.deepEqual(result.keywords, expected);
});

test('NLP: works in url mode and validates input', async () => {
  const result = await extractContentNlpKeywords({
    mode: 'url',
    url: 'https://example.com/x',
    fetchHtml: async () => PAGE_HTML,
  });
  assert.equal(result.url, 'https://example.com/x');
  assert.ok(result.keywordCount > 0);

  await assert.rejects(extractContentNlpKeywords({ mode: 'text' }), /text is required/);
  await assert.rejects(extractContentNlpKeywords({ mode: 'url' }), /url is required/);
  await assert.rejects(extractContentNlpKeywords({ mode: 'pdf' }), /mode must be one of/);
});

/* ─────────────────────── Grammar ─────────────────────── */

test('Grammar: returns all eight categories from DeepSeek', async () => {
  const result = await withStubbedFetch(
    async () => aiJson(Object.fromEntries(GRAMMAR_CATEGORIES.map((k) => [k, [`${k}-a`, `${k}-b`]]))),
    () => generateGrammarRelationships({ topic: 'technical seo', apiKey: 'k' })
  );

  assert.equal(result.ai.applied, true);
  assert.deepEqual(Object.keys(result.relations), GRAMMAR_CATEGORIES);
  assert.equal(result.totalTerms, GRAMMAR_CATEGORIES.length * 2);
});

test('Grammar: falls back locally when DeepSeek fails', async () => {
  const result = await generateGrammarRelationships({ topic: 'technical seo' });

  assert.equal(result.ai.applied, false);
  assert.match(result.ai.reason, /not configured/i);
  assert.ok(result.relations.synonyms.length > 0);
});

test('Grammar: validates topic', async () => {
  await assert.rejects(generateGrammarRelationships({}), /topic is required/);
  await assert.rejects(generateGrammarRelationships({ topic: '  ' }), /topic is required/);
  await assert.rejects(generateGrammarRelationships({ topic: 'x'.repeat(201) }), /200 characters/);
});

/* ──────────────────── Unique N-Grams ─────────────────── */

test('Unique N-Grams: returns AI phrases, else local fallback', async () => {
  const ok = await withStubbedFetch(
    async () => aiJson({ ngrams: ['crawl budget decay', 'index bloat signals'] }),
    () => generateUniqueNgramPhrases({ topic: 'technical seo', apiKey: 'k' })
  );
  assert.equal(ok.ai.applied, true);
  assert.deepEqual(ok.ngrams, ['crawl budget decay', 'index bloat signals']);

  const fallback = await generateUniqueNgramPhrases({ topic: 'technical seo' });
  assert.equal(fallback.ai.applied, false);
  assert.ok(fallback.ngramCount > 0);
});

test('Unique N-Grams: validates topic', async () => {
  await assert.rejects(generateUniqueNgramPhrases({}), /topic is required/);
});

/* ───────────────────── Skip-Gram ─────────────────────── */

test('Skip-Gram: returns AI words, else local fallback', async () => {
  const ok = await withStubbedFetch(
    async () => aiJson({ words: ['context', 'intent', 'salience'] }),
    () => generateSkipGramDominantWords({ word: 'jaguar', apiKey: 'k' })
  );
  assert.equal(ok.ai.applied, true);
  assert.equal(ok.word, 'jaguar');
  assert.deepEqual(ok.words, ['context', 'intent', 'salience']);

  const fallback = await generateSkipGramDominantWords({ word: 'jaguar' });
  assert.equal(fallback.ai.applied, false);
  assert.ok(fallback.wordCount > 0);
});

test('Skip-Gram: validates word', async () => {
  await assert.rejects(generateSkipGramDominantWords({}), /word is required/);
});

/* ──────────────────── Optimization ───────────────────── */

test('Optimization: returns score, checklist and derived stats', async () => {
  const result = await analyzeContentForOptimization({ content: ARTICLE });

  assert.equal(typeof result.score, 'number');
  assert.ok(Array.isArray(result.checklist) && result.checklist.length > 0);
  assert.equal(result.wordCount, ARTICLE.trim().split(/\s+/).filter(Boolean).length);
  assert.equal(result.readingTime, Math.max(1, Math.ceil(result.wordCount / 200)));
  assert.equal(result.advice.requested, false);
});

test('Optimization: PARITY with the page analysis', async () => {
  const expected = analyzeContentOptimization(ARTICLE.trim());
  const result = await analyzeContentForOptimization({ content: ARTICLE });

  assert.equal(result.score, expected.score);
  assert.deepEqual(result.checklist, expected.checklist);
  assert.equal(result.words, expected.words);
});

test('Optimization: advice is opt-in and degrades cleanly', async () => {
  const advice = await withStubbedFetch(
    async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'Add a stronger intro.' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    () => analyzeContentForOptimization({ content: ARTICLE, includeAdvice: true, apiKey: 'k' })
  );
  assert.equal(advice.advice.applied, true);
  assert.match(advice.advice.text, /stronger intro/);

  const failed = await analyzeContentForOptimization({ content: ARTICLE, includeAdvice: true });
  assert.equal(failed.advice.applied, false);
  assert.match(failed.advice.reason, /not configured/i);
});

test('Optimization: validates content', async () => {
  await assert.rejects(analyzeContentForOptimization({}), /content is required/);
  await assert.rejects(
    analyzeContentForOptimization({ content: 'x', includeAdvice: 'yes' }),
    /includeAdvice must be a boolean/
  );
});

/* ───────────────── Watermark Remover ─────────────────── */

test('Watermark: strips invisible characters and reports stats', () => {
  const dirty = 'Hello​world​, this﻿ is AI text.';
  const result = cleanAiWatermarks({ text: dirty });

  assert.equal(result.stats.invisibleCount, 3);
  assert.ok(!/[​﻿]/.test(result.cleaned));
  assert.equal(result.removedChars, result.stats.originalChars - result.stats.cleanedChars);
  assert.deepEqual(result.options, { normalizeWhitespace: true, normalizeQuotes: false });
});

test('Watermark: PARITY with the page defaults', () => {
  const dirty = 'Hello​world  "quoted"  text';
  const expected = removeAiWatermarks(dirty.trim(), {
    normalizeWhitespace: true,
    normalizeQuotes: false,
  });

  const result = cleanAiWatermarks({ text: dirty });
  assert.equal(result.cleaned, expected.cleaned);
  assert.deepEqual(result.stats, expected.stats);
});

test('Watermark: normalizeQuotes is opt-in', () => {
  const curly = 'He said “hello” and ‘bye’';

  assert.match(cleanAiWatermarks({ text: curly }).cleaned, /[“‘]/);
  assert.doesNotMatch(
    cleanAiWatermarks({ text: curly, normalizeQuotes: true }).cleaned,
    /[“”‘’]/
  );
});

test('Watermark: validates input', () => {
  assert.throws(() => cleanAiWatermarks({}), /text is required/);
  assert.throws(() => cleanAiWatermarks({ text: 'x', normalizeQuotes: 'yes' }), /must be a boolean/);
});

/* ────────────── Semantic Generator ───────────────────── */

const SEMANTIC_PAYLOADS = {
  'semantic.entities': {
    entities: ['Google', 'Moz'],
    entityTypes: { people: [], organizations: ['Google'], concepts: ['SEO'], products: [], locations: [] },
  },
  'semantic.ngrams': { bigrams: ['crawl budget'], trigrams: ['technical seo audit'], fourgrams: ['a b c d'] },
  'semantic.nlp': { primaryKeywords: ['seo'], secondaryKeywords: ['audit'], lsiKeywords: ['crawl'] },
  'semantic.grammar': {
    proper_nouns: ['Google'], common_nouns: ['audit'], synonyms: ['optimisation'], antonyms: ['neglect'],
    hyponyms: ['technical seo'], hypernyms: ['marketing'], meronyms: ['sitemap'], holonyms: ['campaign'],
  },
  'semantic.uniqueNgrams': {
    informational: ['what is crawl budget'], commercial: ['best seo audit tool'],
    longtail: ['how to fix crawl budget'], authority: ['google crawl budget docs'],
  },
  'semantic.skipGrams': {
    word_sense_disambiguation: [{ sense: 'search optimisation', dominant_words: ['ranking', 'crawl'] }],
    document_summarization: ['seo overview'], keyword_extraction: ['crawl budget'],
  },
};

test('Semantic Generator: generates all six sections in page order', async () => {
  const result = await withStubbedFetch(
    async (url, init) => {
      const body = JSON.parse(init.body);
      const action = body.messages ? null : null;
      // The action is not sent to DeepSeek, so key off the prompt content.
      const prompt = body.messages[body.messages.length - 1].content;
      if (prompt.includes('semantic SEO entities')) return aiJson(SEMANTIC_PAYLOADS['semantic.entities']);
      if (prompt.includes('Generate SEO n-grams')) return aiJson(SEMANTIC_PAYLOADS['semantic.ngrams']);
      if (prompt.includes('NLP keyword groups')) return aiJson(SEMANTIC_PAYLOADS['semantic.nlp']);
      if (prompt.includes('grammar relationships')) return aiJson(SEMANTIC_PAYLOADS['semantic.grammar']);
      if (prompt.includes('grouped by search intent')) return aiJson(SEMANTIC_PAYLOADS['semantic.uniqueNgrams']);
      if (prompt.includes('skip-gram analysis')) return aiJson(SEMANTIC_PAYLOADS['semantic.skipGrams']);
      throw new Error(`unexpected prompt: ${prompt.slice(0, 40)} ${action}`);
    },
    () => generateSemanticKeywordAnalysis({ keyword: 'technical seo', apiKey: 'k' })
  );

  assert.deepEqual(result.sections, ['entities', 'ngrams', 'nlp', 'grammar', 'uniqueNgrams', 'skipGrams']);
  assert.deepEqual(result.generated, result.sections);
  assert.deepEqual(result.failed, []);
  assert.deepEqual(result.results.entities.entityTypes.organizations, ['Google']);
  assert.deepEqual(result.results.ngrams.trigrams, ['technical seo audit']);
  assert.equal(result.results.skipGrams.word_sense_disambiguation[0].sense, 'search optimisation');
});

test('Semantic Generator: a failing section does not lose the others', async () => {
  const result = await withStubbedFetch(
    async (url, init) => {
      const prompt = JSON.parse(init.body).messages.slice(-1)[0].content;
      if (prompt.includes('semantic SEO entities')) return aiJson(SEMANTIC_PAYLOADS['semantic.entities']);
      return new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), { status: 429 });
    },
    () => generateSemanticKeywordAnalysis({ keyword: 'technical seo', apiKey: 'k' })
  );

  assert.deepEqual(result.generated, ['entities']);
  assert.equal(result.failed.length, 5);
  assert.match(result.errors.ngrams, /quota exceeded/i);
});

test('Semantic Generator: supports a section subset and validates input', async () => {
  const result = await withStubbedFetch(
    async () => aiJson(SEMANTIC_PAYLOADS['semantic.entities']),
    () => generateSemanticKeywordAnalysis({ keyword: 'seo', sections: ['entities'], apiKey: 'k' })
  );
  assert.deepEqual(result.sections, ['entities']);

  await assert.rejects(generateSemanticKeywordAnalysis({}), /keyword is required/);
  await assert.rejects(
    generateSemanticKeywordAnalysis({ keyword: 'seo', sections: ['nope'] }),
    /sections must contain only/
  );
});

/* ───────────────── Content Analyzer ──────────────────── */

const ANALYZER_PAYLOADS = {
  entities: { people: [], organizations: ['Google'], locations: [], products: [], concepts: ['SEO'], technologies: ['HTML'] },
  ngrams: { bigrams: ['crawl budget'], trigrams: ['technical seo audit'], fourgrams: [] },
  skipGrams: {
    word_sense_disambiguation: [{ sense: 'optimisation', dominant_words: ['ranking'] }],
    document_summarization: ['overview'], keyword_extraction: ['crawl'],
  },
};

function analyzerFetch() {
  return async (url, init) => {
    const prompt = JSON.parse(init.body).messages.slice(-1)[0].content;
    if (prompt.includes('semantic entities competitors')) return aiJson(ANALYZER_PAYLOADS.entities);
    if (prompt.includes('meaningful SEO n-grams')) return aiJson(ANALYZER_PAYLOADS.ngrams);
    if (prompt.includes('skip-gram analysis')) return aiJson(ANALYZER_PAYLOADS.skipGrams);
    throw new Error('unexpected prompt');
  };
}

test('Content Analyzer: analyzes URLs and builds the outline locally', async () => {
  const result = await withStubbedFetch(analyzerFetch(), () =>
    analyzeCompetitorContent({
      urls: ['https://a.com', 'https://b.com'],
      apiKey: 'k',
      fetchHtml: async () => PAGE_HTML,
    })
  );

  assert.equal(result.analyzedUrls.length, 2);
  assert.deepEqual(result.failedUrls, []);
  assert.deepEqual(result.generated, ['entities', 'ngrams', 'skipGrams']);
  assert.deepEqual(result.results.entities.organizations, ['Google']);
  assert.equal(result.outline.length, 2);
  assert.equal(result.outline[0].headings[0].tag, 'h1');
});

test('Content Analyzer: skips unfetchable URLs but keeps going', async () => {
  const result = await withStubbedFetch(analyzerFetch(), () =>
    analyzeCompetitorContent({
      urls: ['https://good.com', 'https://bad.com'],
      apiKey: 'k',
      fetchHtml: async (url) => {
        if (url.includes('bad.com')) {
          // The real fetcher marks its failures with a status, like this.
          throw Object.assign(new Error('Failed to fetch page content'), { status: 502 });
        }
        return PAGE_HTML;
      },
    })
  );

  assert.equal(result.analyzedUrls.length, 1);
  assert.equal(result.failedUrls.length, 1);
  assert.match(result.failedUrls[0].reason, /Failed to fetch page content/);
});

test('Content Analyzer: an unexpected fetch error is reported generically', async () => {
  const result = await withStubbedFetch(analyzerFetch(), () =>
    analyzeCompetitorContent({
      urls: ['https://good.com', 'https://bad.com'],
      apiKey: 'k',
      fetchHtml: async (url) => {
        if (url.includes('bad.com')) throw new Error('connect ECONNREFUSED 10.0.0.5 password=hunter2');
        return PAGE_HTML;
      },
    })
  );

  assert.equal(result.failedUrls.length, 1);
  assert.doesNotMatch(result.failedUrls[0].reason, /hunter2|10\.0\.0\.5/);
  assert.equal(result.failedUrls[0].reason, 'Could not fetch this URL.');
});

test('Content Analyzer: errors when every URL fails', async () => {
  await assert.rejects(
    analyzeCompetitorContent({
      urls: ['https://bad.com'],
      apiKey: 'k',
      fetchHtml: async () => {
        throw new Error('blocked');
      },
    }),
    /Could not fetch any of the provided URLs/
  );
});

test('Content Analyzer: truncates the combined corpus like the page', async () => {
  const huge = `<html><body><main><p>${'word '.repeat(20000)}</p></main></body></html>`;
  const result = await withStubbedFetch(analyzerFetch(), () =>
    analyzeCompetitorContent({ urls: ['https://a.com'], apiKey: 'k', fetchHtml: async () => huge })
  );

  assert.equal(result.characters, 12000);
});

test('Content Analyzer: validates urls', async () => {
  await assert.rejects(analyzeCompetitorContent({}), /urls is required/);
  await assert.rejects(analyzeCompetitorContent({ urls: [] }), /At least one valid URL/);
  await assert.rejects(analyzeCompetitorContent({ urls: ['javascript:x'] }), /Only HTTP and HTTPS/);
});
