function words(value) {
  return String(value || '').match(/[A-Za-z0-9']+/g) || [];
}

function sentences(value) {
  return String(value || '').split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
}

function paragraphs(value) {
  return String(value || '').split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
}

function scoreCategory(score, issues, suggestions, details = undefined) {
  return { score: Math.max(0, Math.min(100, Math.round(score))), issues, suggestions, ...(details ? { details } : {}) };
}

function firstThreeWords(value) {
  return words(value).slice(0, 3).join(' ');
}

export function validateProjectId(value) {
  const id = String(value || '').trim();
  if (!id || id.length > 255) throw Object.assign(new Error('A valid projectId is required'), { status: 400 });
  return id;
}

export function validateArticleInput(article = {}) {
  if (!article || typeof article !== 'object' || Array.isArray(article)) {
    throw Object.assign(new Error('Article must be an object'), { status: 400 });
  }
  const title = String(article.title || '').trim();
  const body = String(article.body || '').trim();
  if (!title || title.length > 500) throw Object.assign(new Error('Article title is required and must be 500 characters or fewer'), { status: 400 });
  if (!body || body.length > 2_000_000) throw Object.assign(new Error('Article body is required and must be 2 MB or smaller'), { status: 400 });
  const relatedKeywords = article.relatedKeywords == null ? [] : article.relatedKeywords;
  if (!Array.isArray(relatedKeywords) || relatedKeywords.length > 100 || relatedKeywords.some((item) => typeof item !== 'string' || item.length > 255)) {
    throw Object.assign(new Error('relatedKeywords must be an array of short strings'), { status: 400 });
  }
  return { ...article, title, body, relatedKeywords };
}

export function validateHelpfulContentInput(content) {
  const value = String(content || '').trim();
  if (!value || value.length > 2_000_000) throw Object.assign(new Error('Content is required and must be 2 MB or smaller'), { status: 400 });
  return value;
}

export function buildArticleSeoReview(article = {}) {
  const title = String(article.title || '').trim();
  const body = String(article.body || '').trim();
  const metaDescription = String(article.metaDescription || '').trim();
  const focusKeyword = firstThreeWords(article.focusKeyword || '');
  const relatedKeywords = Array.isArray(article.relatedKeywords) ? article.relatedKeywords : [];
  const bodyWords = words(body);
  const bodyText = body.toLowerCase();
  const keywordLower = focusKeyword.toLowerCase();
  const keywordFrequency = keywordLower ? bodyText.split(keywordLower).length - 1 : 0;
  const density = bodyWords.length && keywordLower ? (keywordFrequency / bodyWords.length) * 100 : 0;
  const headingCount = (body.match(/^#{1,6}\s+.+$/gm) || []).length + (body.match(/<h[1-6][^>]*>/gi) || []).length;
  const internalLinks = (body.match(/href=["'][^"']*["']/gi) || []).filter((item) => !/https?:\/\//i.test(item)).length;
  const sentenceList = sentences(body);
  const paragraphList = paragraphs(body);
  const titleIssues = [];
  const titleSuggestions = [];
  if (!title) titleIssues.push('Title is missing.');
  if (title && title.length < 30) titleSuggestions.push('Make the title more descriptive.');
  if (title.length > 60) titleIssues.push('Title is longer than the usual search snippet range.');
  if (focusKeyword && !title.toLowerCase().includes(keywordLower)) titleSuggestions.push('Include the focus keyword in the title.');
  const titleScore = title ? 100 - titleIssues.length * 25 - titleSuggestions.length * 10 : 0;

  const headingIssues = headingCount ? [] : ['No headings were detected.'];
  const headingSuggestions = headingCount ? [] : ['Break the article into descriptive sections.'];
  const headingScore = headingCount ? 90 : 35;
  const keywordIssues = focusKeyword && !keywordFrequency ? ['The focus keyword was not found in the body.'] : [];
  const keywordSuggestions = density > 3 ? ['Reduce repeated exact-match keyword usage.'] : [];
  const keywordScore = focusKeyword ? 85 - keywordIssues.length * 35 - keywordSuggestions.length * 10 : 0;
  const targetLength = Number(article.targetLength) || 900;
  const lengthScore = bodyWords.length ? Math.min(100, Math.round((bodyWords.length / targetLength) * 100)) : 0;
  const lengthIssues = bodyWords.length < 300 ? ['Content is very short for a complete article.'] : [];
  const lengthSuggestions = bodyWords.length < targetLength ? ['Add useful detail where the reader needs it.'] : [];
  const metaIssues = !metaDescription ? ['Meta description is missing.'] : metaDescription.length > 160 ? ['Meta description may be truncated in search results.'] : [];
  const metaSuggestions = metaDescription && focusKeyword && !metaDescription.toLowerCase().includes(keywordLower) ? ['Include the focus keyword naturally.'] : [];
  const metaScore = metaDescription ? 90 - metaIssues.length * 20 - metaSuggestions.length * 10 : 0;
  const readabilityScore = sentenceList.length && bodyWords.length ? Math.max(35, Math.min(100, 100 - Math.abs(bodyWords.length / sentenceList.length - 20) * 2)) : 0;
  const linkIssues = internalLinks ? [] : ['No internal links were detected.'];
  const linkSuggestions = internalLinks ? [] : ['Link to a relevant page in the same site.'];
  const categories = {
    title: scoreCategory(titleScore, titleIssues, titleSuggestions),
    headings: scoreCategory(headingScore, headingIssues, headingSuggestions, { count: headingCount }),
    keywordUse: scoreCategory(keywordScore, keywordIssues, keywordSuggestions, { density: Number(density.toFixed(2)), frequency: keywordFrequency, placement: [] }),
    contentLength: scoreCategory(lengthScore, lengthIssues, lengthSuggestions, { wordCount: bodyWords.length, targetLength }),
    readability: scoreCategory(readabilityScore, [], [], { fleschScore: Number(readabilityScore.toFixed(1)), gradeLevel: readabilityScore > 75 ? 'General audience' : 'Needs simplification' }),
    metaDescription: scoreCategory(metaScore, metaIssues, metaSuggestions, { length: metaDescription.length, keywordIncluded: Boolean(keywordLower && metaDescription.toLowerCase().includes(keywordLower)) }),
    internalLinks: scoreCategory(internalLinks ? 85 : 30, linkIssues, linkSuggestions, { count: internalLinks, recommendations: linkSuggestions }),
  };
  const scores = Object.values(categories).map((item) => item.score);
  const warnings = Object.entries(categories).flatMap(([type, item]) => item.issues.map((message) => ({ type, message })));
  const suggestions = Object.values(categories).flatMap((item) => item.suggestions);
  const score = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
  return {
    score,
    summary: score >= 80 ? 'The article has a solid SEO foundation.' : 'The article has clear opportunities for improvement.',
    categories,
    warnings,
    errors: [],
    feedback: suggestions.slice(0, 10),
    suggestions,
    wordCount: bodyWords.length,
    readingTime: Math.max(1, Math.ceil(bodyWords.length / 200)),
    keywordDensity: Number(density.toFixed(2)),
    contentQuality: {
      score: Math.round((readabilityScore + (paragraphList.length > 1 ? 80 : 45)) / 2),
      uniqueWords: new Set(bodyWords.map((word) => word.toLowerCase())).size,
      paragraphCount: paragraphList.length,
      sentenceVariety: new Set(sentenceList.map((sentence) => words(sentence).length)).size,
    },
    normalizedInput: { focusKeyword, relatedKeywords },
  };
}

export function buildHelpfulContentAnalysis(content = '', context = {}) {
  const value = String(content || '').trim();
  const contentWords = words(value);
  const sentenceList = sentences(value);
  const paragraphList = paragraphs(value);
  const hasHeadings = /^#{1,6}\s+.+$/m.test(value) || /<h[1-6][^>]*>/i.test(value);
  const hasEvidence = /\b(source|according to|study|research|data|example)\b/i.test(value);
  const base = Math.max(20, Math.min(100, 45 + (contentWords.length >= 500 ? 20 : 0) + (hasHeadings ? 10 : 0) + (hasEvidence ? 15 : 0) + (paragraphList.length > 3 ? 10 : 0)));
  const names = ['expertise', 'authoritativeness', 'trustworthiness', 'usefulness', 'comprehensiveness', 'readability', 'engagement'];
  const categories = Object.fromEntries(names.map((name, index) => {
    const score = Math.max(25, Math.min(100, base + (index % 3) * 3 - (name === 'trustworthiness' && !hasEvidence ? 15 : 0)));
    return [name, { score, feedback: score >= 70 ? 'Signals are present in the submitted content.' : 'More supporting detail would strengthen this area.', evidence: [hasEvidence ? 'Supporting evidence language detected.' : 'No clear evidence language detected.'], suggestions: score >= 70 ? [] : ['Add specific examples, sources, or actionable detail.'] }];
  }));
  const detailedFeedback = Object.entries(categories).flatMap(([category, item]) => item.suggestions.map((suggestion) => ({ category, type: 'warning', message: item.feedback, suggestion, context: context.contentType || 'article' })));
  return {
    score: Math.round(Object.values(categories).reduce((sum, item) => sum + item.score, 0) / names.length),
    overallFeedback: base >= 70 ? 'The content provides useful signals for its audience.' : 'The content needs more depth, evidence, and reader-focused detail.',
    categories,
    detailedFeedback,
    improvementSuggestions: detailedFeedback.map((item) => item.suggestion),
    strengths: [hasHeadings ? 'Uses section structure.' : '', hasEvidence ? 'Includes evidence-oriented language.' : ''].filter(Boolean),
    weaknesses: [contentWords.length < 500 ? 'Limited content depth.' : '', !hasEvidence ? 'Evidence and source signals are limited.' : ''].filter(Boolean),
    metadata: { provider: 'custom', analysisDate: new Date().toISOString(), contentLength: value.length, readingLevel: sentenceList.length && contentWords.length / sentenceList.length < 22 ? 'General audience' : 'Advanced', sentiment: 'neutral' },
  };
}
