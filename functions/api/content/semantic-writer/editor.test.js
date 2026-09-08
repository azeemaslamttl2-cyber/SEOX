import test from 'node:test';
import assert from 'node:assert/strict';

import {
  onRequest,
  validateArticleId,
  stripHtml,
  markdownToHtml,
  extractTitleAndCleanHtml,
  calculateKeywordUsage,
  analyzeArticleContent,
  buildMegaPrompt,
  normalizeCompetitorUrl,
  SEO_RULES,
  AI_INSTRUCTIONS
} from './editor.js';

function request(body, options = {}) {
  const { method = 'POST', headers = {} } = options;
  return new Request('https://example.com/api/content/semantic-writer/editor', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: method !== 'GET' && method !== 'OPTIONS' ? JSON.stringify(body) : undefined,
  });
}

test('SEO_RULES and AI_INSTRUCTIONS contain the exact definitions from SemanticContentWriter', () => {
  assert.ok(SEO_RULES.length >= 15, 'Should have at least 15 SEO rules');
  const ruleIds = SEO_RULES.map(r => r.id);
  assert.ok(ruleIds.includes('answer_first'));
  assert.ok(ruleIds.includes('no_analogies'));
  assert.ok(ruleIds.includes('coreference'));
  assert.ok(ruleIds.includes('no_extra_sentences'));
  assert.ok(ruleIds.includes('abbreviations'));

  assert.ok(AI_INSTRUCTIONS.conciseWriting, 'Should have conciseWriting instruction');
  assert.ok(AI_INSTRUCTIONS.naturalLanguage, 'Should have naturalLanguage instruction');
  assert.ok(AI_INSTRUCTIONS.avoidAIPatterns, 'Should have avoidAIPatterns instruction');
});

test('validateArticleId enforces valid article ID format', () => {
  assert.equal(validateArticleId('article_1788853618379'), 'article_1788853618379');
  assert.equal(validateArticleId('test-article-123'), 'test-article-123');

  assert.throws(() => validateArticleId(''), /Article ID is required/i);
  assert.throws(() => validateArticleId('invalid/article?id'), /Invalid article ID format/i);
});

test('stripHtml removes HTML tags cleanly', () => {
  const html = '<p>Hello <strong>World</strong>!<br/>This is a <a href="#">test</a>.</p>';
  assert.equal(stripHtml(html), 'Hello World! This is a test.');
});

test('markdownToHtml converts markdown to semantic HTML correctly', () => {
  const md = '# Title\n\n## Subheading\n\nThis is **bold** and *italic* text.\n\n- Item 1\n- Item 2';
  const html = markdownToHtml(md);
  assert.ok(html.includes('<h1>Title</h1>'));
  assert.ok(html.includes('<h2>Subheading</h2>'));
  assert.ok(html.includes('<strong>bold</strong>'));
  assert.ok(html.includes('<em>italic</em>'));
  assert.ok(html.includes('<li>Item 1</li>'));
});

test('extractTitleAndCleanHtml extracts H1 and returns cleaned HTML', () => {
  const html = '<h1>My Great Article</h1><p>First paragraph.</p><h2>Section</h2><p>Second paragraph.</p>';
  const { title, html: cleaned } = extractTitleAndCleanHtml(html);
  assert.equal(title, 'My Great Article');
  assert.ok(!cleaned.includes('<h1>'));
  assert.ok(cleaned.includes('First paragraph'));
});

test('calculateKeywordUsage tracks keyword occurrences', () => {
  const content = '<p>SEO optimization is vital. High quality SEO content helps ranking.</p>';
  const results = calculateKeywordUsage(content, ['SEO', 'ranking', 'missing keyword']);
  assert.equal(results[0].keyword, 'SEO');
  assert.equal(results[0].count, 2);
  assert.equal(results[0].used, true);

  assert.equal(results[1].keyword, 'ranking');
  assert.equal(results[1].count, 1);
  assert.equal(results[1].used, true);

  assert.equal(results[2].keyword, 'missing keyword');
  assert.equal(results[2].count, 0);
  assert.equal(results[2].used, false);
});

test('analyzeArticleContent calculates metrics, keyword coverage and content score', () => {
  const sampleState = {
    mainKeyword: 'semantic seo',
    keywordData: {
      competitorEntities: ['search intent', 'knowledge graph'],
      aiEntities: ['topic clusters'],
      nlpKeywords: ['natural language processing', 'ranking signals'],
    },
    combinedOutline: [
      { level: 2, text: 'What is Semantic SEO?' },
      { level: 2, text: 'Benefits of Semantic SEO' },
      { level: 3, text: 'Search Intent Optimization' },
    ],
  };

  const sampleContent = `
    <h1>Understanding Semantic SEO</h1>
    <p>Semantic SEO is the process of building content around topic clusters rather than just isolated keywords. When search intent and knowledge graph connections are aligned, search engines can better understand your content.</p>
    <h2>What is Semantic SEO?</h2>
    <p>Semantic SEO improves your natural language processing visibility by targeting complete topics. Search intent is key to ranking signals.</p>
    <h2>Benefits of Semantic SEO</h2>
    <p>There are multiple benefits to implementing semantic SEO across your website hierarchy.</p>
  `;

  const analysis = analyzeArticleContent(sampleContent, sampleState);
  assert.ok(analysis.metrics.wordCount > 30);
  assert.ok(analysis.metrics.headingCount >= 2);
  assert.ok(analysis.contentScore > 50);
  assert.ok(analysis.keywordCoverage.totalTerms > 0);
  assert.ok(analysis.keywordCoverage.usedTerms > 0);
  assert.equal(analysis.keywordDetails.primaryKeyword.used, true);
});

test('buildMegaPrompt creates structured prompt incorporating keywords, outline, and rules', () => {
  const state = {
    mainKeyword: 'semantic writer',
    writerMode: 'express',
    combinedOutline: [
      { level: 2, text: 'Introduction to Semantic Writing' },
      { level: 2, text: 'How AI Content Writing Works' },
    ],
    keywordData: {
      aiPickedNgrams: ['semantic content strategy', 'search intent matching'],
      nlpKeywords: ['natural language', 'content scoring'],
    },
    selectedRules: ['answer_first', 'no_extra_sentences'],
  };

  const prompt = buildMegaPrompt(state);
  assert.ok(prompt.includes('# CONTENT WRITING ASSIGNMENT'));
  assert.ok(prompt.includes('"semantic writer"'));
  assert.ok(prompt.includes('H2: Introduction to Semantic Writing'));
  assert.ok(prompt.includes('semantic content strategy'));
  assert.ok(prompt.includes('Do not distance the question from the answer'));
  assert.ok(prompt.includes('BEGIN WRITING THE ARTICLE NOW:'));
});

test('Semantic Writer Editor rejects requests without admin_token for external callers', async () => {
  const response = await onRequest({
    request: request({ article: 'article_1788853618379' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /admin_token is required/i);
});

test('Semantic Writer Editor rejects invalid admin_token', async () => {
  const response = await onRequest({
    request: request({ admin_token: 'bad-token', article: 'article_1788853618379' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.equal(payload.success, false);
  assert.match(payload.message, /invalid admin token/i);
});

test('Semantic Writer Editor rejects missing article parameter', async () => {
  const response = await onRequest({
    request: request({ admin_token: 'valid-token' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /article id is required/i);
});

test('Semantic Writer Editor supports build_prompt action', async () => {
  const response = await onRequest({
    request: request({
      admin_token: 'valid-token',
      article: 'article_1788853618379',
      action: 'build_prompt',
      mainKeyword: 'ai seo tools',
      combinedOutline: [{ level: 2, text: 'Top AI Tools' }],
    }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.status, 'success');
  assert.ok(payload.data.prompt);
  assert.ok(payload.data.prompt.includes('ai seo tools'));
});

test('Semantic Writer Editor supports analyze action', async () => {
  const response = await onRequest({
    request: request({
      admin_token: 'valid-token',
      article: 'article_1788853618379',
      action: 'analyze',
      mainKeyword: 'content marketing',
      content: '<p>Content marketing is great for organic traffic and brand visibility.</p>',
    }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.status, 'success');
  assert.equal(payload.data.article, 'article_1788853618379');
  assert.ok(payload.data.contentScore !== undefined);
  assert.ok(payload.data.metrics);
  assert.equal(payload.data.metrics.wordCount, 10);
});

test('Semantic Writer Editor handles OPTIONS method for CORS preflight', async () => {
  const response = await onRequest({
    request: request(null, { method: 'OPTIONS' }),
    env: { ADMIN_TOKEN: 'valid-token' },
  });
  assert.equal(response.status, 204);
});

test('normalizeCompetitorUrl sanitizes URLs, strips markdown, and filters social/self domains', () => {
  assert.equal(normalizeCompetitorUrl('https://ahrefs.com/blog'), 'https://ahrefs.com');
  assert.equal(normalizeCompetitorUrl('semrush.com'), 'https://semrush.com');
  assert.equal(normalizeCompetitorUrl('[Moz](https://moz.com/blog)'), 'https://moz.com');
  assert.equal(normalizeCompetitorUrl('1. https://surferseo.com/'), 'https://surferseo.com');

  // Ignores target own domain
  assert.equal(normalizeCompetitorUrl('https://targetsite.com', 'targetsite.com'), null);

  // Ignores social media and search engines
  assert.equal(normalizeCompetitorUrl('https://facebook.com/page'), null);
  assert.equal(normalizeCompetitorUrl('https://twitter.com/user'), null);
  assert.equal(normalizeCompetitorUrl('https://google.com/search'), null);
  assert.equal(normalizeCompetitorUrl('https://youtube.com/watch?v=123'), null);
  assert.equal(normalizeCompetitorUrl('invalid-url-without-dot'), null);
});
