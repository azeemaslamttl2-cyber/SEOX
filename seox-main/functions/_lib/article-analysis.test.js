import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildArticleSeoReview,
  buildHelpfulContentAnalysis,
  validateArticleInput,
  validateHelpfulContentInput,
  validateProjectId,
} from './article-analysis.js';

test('article SEO review returns normalized categories and metrics', () => {
  const result = buildArticleSeoReview({
    title: 'How to improve technical SEO',
    body: '# Technical SEO\n\nThis useful article includes an example and research.',
    focusKeyword: 'technical SEO checklist',
    relatedKeywords: ['site audit'],
  });

  assert.equal(Object.keys(result.categories).length, 7);
  assert.equal(typeof result.score, 'number');
  assert.equal(typeof result.keywordDensity, 'number');
  assert.equal(result.contentQuality.paragraphCount, 2);
});

test('helpful-content analysis returns all required categories', () => {
  const result = buildHelpfulContentAnalysis('This article provides useful examples and research for readers.', { contentType: 'tutorial' });

  assert.deepEqual(Object.keys(result.categories), [
    'expertise', 'authoritativeness', 'trustworthiness', 'usefulness',
    'comprehensiveness', 'readability', 'engagement',
  ]);
  assert.equal(typeof result.score, 'number');
  assert.equal(result.metadata.provider, 'custom');
});

test('new content inputs reject invalid and oversized values', () => {
  assert.equal(validateProjectId('project-1'), 'project-1');
  assert.throws(() => validateProjectId(''), /projectId/);
  assert.throws(() => validateArticleInput({ title: '', body: 'content' }), /title/);
  assert.throws(() => validateArticleInput({ title: 'Title', body: 'x'.repeat(2_000_001) }), /2 MB/);
  assert.equal(validateHelpfulContentInput('valid content'), 'valid content');
  assert.throws(() => validateHelpfulContentInput(''), /Content/);
});
