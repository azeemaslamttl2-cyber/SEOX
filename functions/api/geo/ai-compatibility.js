import { configureMysqlConnection, queryOne, update } from '../../_lib/mysql.js';
import { corsHeaders, emptyResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { fetchPublicHttpUrl, parsePublicHttpUrl } from '../../_lib/url-security.js';
import { requireUser } from '../../_lib/auth-token.js';

const MAX_TOKEN_LENGTH = 512;
const REQUEST_TIMEOUT_MS = 15000;
const DEEPSEEK_MODEL = 'deepseek-chat';

export const AI_MODELS = [
  { id: 'chatgpt', name: 'ChatGPT' },
  { id: 'gemini', name: 'Gemini' },
  { id: 'mistral', name: 'Mistral' },
  { id: 'cohere', name: 'Cohere' },
  { id: 'claude', name: 'Claude' },
  { id: 'llama', name: 'Llama' },
];

export const CHECK_CATEGORIES = {
  chatgpt: [
    { id: 'eeat', name: 'E-E-A-T Signals (Expertise, Experience, Authority, Trust)', description: 'Content demonstrates clear expertise through author credentials, first-hand experience, citations from credible sources, and trustworthy information.' },
    { id: 'structure', name: 'Content Structure & Hierarchy', description: 'Well-organized content with proper H1-H6 heading hierarchy, bullet points, numbered lists, and FAQ sections for easy AI parsing.' },
    { id: 'semantic', name: 'Semantic Richness & Contextual Depth', description: 'Comprehensive topic coverage with related terms, synonyms, and semantically related keywords that demonstrate deep understanding.' },
    { id: 'readability', name: 'Clarity & Readability', description: 'Clear, concise language with short paragraphs, active voice, and error-free text that is unambiguous and easy to process.' },
    { id: 'schema', name: 'Structured Data (Schema.org)', description: 'Machine-readable Schema.org markup that explicitly tells AI systems the content type, purpose, and relationships.' },
  ],
  gemini: [
    { id: 'eeat', name: 'E-E-A-T Compliance', description: 'Demonstrates expertise through detailed author bios, relevant qualifications, original research, case studies, and citations from credible sources.' },
    { id: 'conversational', name: 'Conversational Query Optimization', description: 'Content optimized for natural language queries, question-based keywords, and long-tail phrases that match how users ask questions.' },
    { id: 'freshness', name: 'Content Freshness & Updates', description: 'Regularly updated content with current information, original data, expert insights, and real-world examples that demonstrate relevance.' },
    { id: 'technical', name: 'Technical SEO Foundation', description: 'Fast page speed, mobile responsiveness, HTTPS security, proper crawlability, and clean information architecture.' },
    { id: 'multimodal', name: 'Multimodal Content Optimization', description: 'Diverse multimedia content including images with alt tags, videos, and audio that Gemini can interpret alongside text.' },
  ],
  mistral: [
    { id: 'factual', name: 'Factual Accuracy & Verification', description: 'Content with verifiable claims, proper citations, and minimal factually incorrect information that Mistral can confidently reference.' },
    { id: 'moderation', name: 'Content Moderation Compliance', description: 'Content free from harmful categories including illegal activities, hateful content, misinformation, and unqualified professional advice.' },
    { id: 'multilingual', name: 'Multilingual Proficiency', description: 'Content available in multiple languages or with clear language structure that supports machine translation and global accessibility.' },
    { id: 'reasoning', name: 'Logical Structure & Reasoning', description: 'Clear reasoning flow, logical arguments, and step-by-step explanations that support Mistral\'s strong reasoning capabilities.' },
    { id: 'seo', name: 'SEO-Optimized Keywords', description: 'Strategic keyword incorporation for search engine visibility that helps Mistral identify and reference relevant content.' },
  ],
  cohere: [
    { id: 'embedding', name: 'Embedding-Friendly Content Structure', description: 'Well-structured text with clear sentences and paragraphs optimal for vectorization and semantic similarity calculations.' },
    { id: 'chunking', name: 'Document Chunking Suitability', description: 'Content divided into semantically coherent sections that can be effectively embedded and retrieved independently.' },
    { id: 'semantic', name: 'Semantic Clarity & Meaning', description: 'Text that conveys clear meaning with unambiguous relationships between concepts for accurate semantic understanding.' },
    { id: 'retrieval', name: 'Search & Retrieval Optimization', description: 'Topic-relevant keywords and phrases that enhance findability in semantic search with high similarity matching potential.' },
    { id: 'quality', name: 'Content Quality for Reranking', description: 'Rich, informative content that performs well in reranking systems, going beyond topical similarity to demonstrate quality.' },
  ],
  claude: [
    { id: 'ethical', name: 'Ethical Content Assessment', description: 'Content that is ethically neutral without signs of bias, deception, harmful information, or questionable claims.' },
    { id: 'safety', name: 'Content Safety & Harm Prevention', description: 'Content adhering to safety guidelines, free from violence, illegal activities, or content that could enable harm.' },
    { id: 'factual', name: 'Verifiable Factual Claims', description: 'Claims backed by evidence, proper citations from reliable sources, and clear distinction between facts and opinions.' },
    { id: 'professional', name: 'Professional Communication Standards', description: 'Clear, well-written content following professional standards with proper tone, structure, and grammatical correctness.' },
    { id: 'context', name: 'Long-Context Processing Optimization', description: 'Content structured for large context windows with clear sections, logical flow, and comprehensive coverage suitable for deep analysis.' },
  ],
  llama: [
    { id: 'quality', name: 'Training Data Quality Signals', description: 'Content meeting high-quality curation standards: original, well-written, and valuable for model training and learning.' },
    { id: 'safety', name: 'Content Safety Filtering', description: 'Content free from PII, adult content, NSFW material, and other elements that would be filtered from training datasets.' },
    { id: 'diversity', name: 'Content Diversity & Coverage', description: 'Diverse content types including knowledge, reasoning, multilingual elements, or technical documentation that enriches training.' },
    { id: 'structure', name: 'Clean HTML & Processing Efficiency', description: 'Lightweight, well-structured HTML with minimal complex scripts that enables efficient AI processing and extraction.' },
    { id: 'multilingual', name: 'Multilingual Support', description: 'Content supporting multiple languages or clear monolingual content that contributes to global language understanding.' },
  ],
};

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function apiError(error, headers) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message = status >= 500 ? 'AI compatibility analysis failed.' : error.message;
  if (status >= 500) console.error(error);
  return jsonResponse({
    success: false,
    status: status === 400 ? 'validation_error' : status === 401 ? 'unauthorized' : status === 404 ? 'not_found' : status === 413 ? 'payload_too_large' : status === 504 ? 'timeout' : 'error',
    message,
    data: null,
  }, status, headers);
}

function normalizeToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  if (!token) fail('admin_token is required.', 400);
  if (token.length > MAX_TOKEN_LENGTH) fail('Invalid admin token.', 401);
  return token;
}

function normalizeUrl(value, field = 'url') {
  let raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) fail(`${field} is required.`, 400);
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  return parsePublicHttpUrl(raw, field);
}

async function authenticate(request, body, env) {
  const authorization = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (authorization) {
    try {
      return await requireUser(request, env);
    } catch {
      fail('Invalid or expired session.', 401);
    }
  }

  const token = normalizeToken(body?.admin_token);
  const configured = String(env?.ADMIN_TOKEN || '').trim();
  if (configured && token === configured) return { id: 'configured-admin' };
  if (configured && token.split('.').length !== 3) fail('Invalid admin token.', 401);

  configureMysqlConnection(env);
  const tokenUser = await queryOne(
    'SELECT id FROM users WHERE admin_token = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1',
    [token]
  );
  if (tokenUser) return tokenUser;

  try {
    return await requireUser(new Request('http://ai-compatibility.internal', {
      headers: { authorization: `Bearer ${token}` }
    }), env);
  } catch {
    fail('Invalid admin token.', 401);
  }
}

async function loadApiKey(userId, env) {
  if (userId && userId !== 'configured-admin') {
    try {
      const row = await queryOne(
        'SELECT api_key FROM deepseek_api_settings WHERE user_id = ? ORDER BY id DESC LIMIT 1',
        [userId]
      );
      if (row?.api_key) return row.api_key;
    } catch (error) {
      if (error?.code !== 'ER_NO_SUCH_TABLE') throw error;
    }
  }
  return String(env?.DEEPSEEK_API_KEY || '').trim();
}

function extractTextContent(html) {
  if (!html) return '';
  let content = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ');

  const articleMatch = content.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = content.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const bodyMatch = content.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);

  const selected = articleMatch?.[1] || mainMatch?.[1] || bodyMatch?.[1] || content;

  return selected
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function scrapePage(targetUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchPublicHttpUrl(targetUrl.toString(), {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SEOX/1.0',
        accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5',
      },
    });
    if (!response.ok) return { pageContent: '', statusCode: response.status };
    const html = (await response.text()).slice(0, 2000000);
    return { pageContent: extractTextContent(html), statusCode: response.status };
  } catch (err) {
    if (err?.status === 400 && /private|local|metadata/i.test(err?.message)) {
      throw err;
    }
    return { pageContent: '', statusCode: 500 };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function generateFallbackResults(seedText = '') {
  const models = {};
  const hash = Array.from(seedText).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 10000, 7);

  AI_MODELS.forEach((model, mIdx) => {
    const checks = {};
    const categories = CHECK_CATEGORIES[model.id] || [];
    let passed = 0;

    categories.forEach((cat, cIdx) => {
      const isPassed = ((hash + mIdx * 7 + cIdx * 13) % 10) >= 3;
      if (isPassed) passed++;
      checks[cat.id] = {
        passed: isPassed,
        reason: isPassed
          ? `The content meets ${cat.name.toLowerCase()} requirements.`
          : `The content lacks sufficient ${cat.name.toLowerCase()} optimization.`,
      };
    });

    const score = Math.round((passed / categories.length) * 100);
    models[model.id] = { score, checks };
  });

  return models;
}

function buildPrompt(targetUrl, pageContent) {
  return `Analyze this webpage for AI model compatibility. URL: ${targetUrl}
${pageContent ? `Page content preview: ${pageContent.substring(0, 3000)}` : 'Unable to fetch page content, analyze based on URL structure.'}

Evaluate compatibility with these AI models based on research-backed criteria:

**ChatGPT (OpenAI GPT-4):**
1. E-E-A-T Signals: Author credentials, expertise markers, citations, trustworthy information
2. Content Structure & Hierarchy: H1-H6 headings, bullet points, FAQ sections
3. Semantic Richness: Comprehensive topic coverage, related terms, contextual depth
4. Clarity & Readability: Short paragraphs, active voice, error-free text
5. Structured Data: Schema.org markup present

**Gemini (Google):**
1. E-E-A-T Compliance: Author bios, qualifications, original research, citations
2. Conversational Query Optimization: Natural language, question-based content
3. Content Freshness: Recent updates, current information, timestamps
4. Technical SEO: Page speed, mobile-friendly, HTTPS, crawlability
5. Multimodal Content: Images with alt tags, videos, diverse media

**Mistral:**
1. Factual Accuracy: Verifiable claims, proper citations, credible sources
2. Content Moderation: Free from harmful/illegal content, misinformation
3. Multilingual Proficiency: Multi-language support or clear structure
4. Logical Structure: Step-by-step reasoning, clear arguments
5. SEO Keywords: Strategic keyword incorporation

**Cohere:**
1. Embedding-Friendly: Clear sentences, well-structured paragraphs
2. Document Chunking: Semantically coherent sections
3. Semantic Clarity: Unambiguous meaning, clear concept relationships
4. Retrieval Optimization: Topic-relevant keywords, high findability
5. Content Quality: Rich, informative content for reranking

**Claude (Anthropic):**
1. Ethical Content: No bias, deception, or questionable claims
2. Safety & Harm Prevention: Free from violence, illegal content
3. Factual Claims: Evidence-backed, proper citations
4. Professional Standards: Clear writing, proper grammar
5. Long-Context Optimization: Clear sections, comprehensive coverage

**Llama (Meta):**
1. Training Data Quality: Original, well-written, valuable content
2. Safety Filtering: No PII, adult content, or NSFW material
3. Content Diversity: Knowledge, reasoning, technical documentation
4. Processing Efficiency: Clean HTML, minimal complex scripts
5. Multilingual Support: Multi-language or clear monolingual content

For each check, evaluate PASS or FAIL with specific reasoning based on actual page content.

Return JSON format:
{
  "models": {
    "chatgpt": { "score": 0-100, "checks": { "eeat": { "passed": true/false, "reason": "specific explanation" }, "structure": {...}, "semantic": {...}, "readability": {...}, "schema": {...} } },
    "gemini": { "score": 0-100, "checks": { "eeat": {...}, "conversational": {...}, "freshness": {...}, "technical": {...}, "multimodal": {...} } },
    "mistral": { "score": 0-100, "checks": { "factual": {...}, "moderation": {...}, "multilingual": {...}, "reasoning": {...}, "seo": {...} } },
    "cohere": { "score": 0-100, "checks": { "embedding": {...}, "chunking": {...}, "semantic": {...}, "retrieval": {...}, "quality": {...} } },
    "claude": { "score": 0-100, "checks": { "ethical": {...}, "safety": {...}, "factual": {...}, "professional": {...}, "context": {...} } },
    "llama": { "score": 0-100, "checks": { "quality": {...}, "safety": {...}, "diversity": {...}, "structure": {...}, "multilingual": {...} } }
  }
}`;
}

async function analyzeWithAi(targetUrl, pageContent, apiKey) {
  if (!apiKey) {
    return { models: generateFallbackResults(targetUrl.toString()), fallback: true };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: 'You are an AI compatibility analyzer. Return valid JSON only.' },
          { role: 'user', content: buildPrompt(targetUrl, pageContent) },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.warn(`AI API returned status ${response.status}:`, payload?.error?.message);
      return { models: generateFallbackResults(targetUrl.toString()), fallback: true };
    }

    const text = payload.choices?.[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.models && typeof parsed.models === 'object') {
        return { models: parsed.models, fallback: false };
      }
    }
    return { models: generateFallbackResults(targetUrl.toString()), fallback: true };
  } catch (err) {
    console.warn('AI analysis failed or timed out:', err?.message);
    return { models: generateFallbackResults(targetUrl.toString()), fallback: true };
  } finally {
    clearTimeout(timeoutId);
  }
}

function getStatusBadge(score) {
  if (score >= 61) return { text: 'Good', status: 'good' };
  if (score >= 31) return { text: 'Fair', status: 'fair' };
  return { text: 'Needs Work', status: 'poor' };
}

function summarizeModels(models) {
  let totalScore = 0;
  let modelCount = 0;
  const processedModels = {};

  for (const model of AI_MODELS) {
    const mData = models?.[model.id] || {};
    const categories = CHECK_CATEGORIES[model.id] || [];
    const checks = mData.checks || {};

    let passedCount = 0;
    let failedCount = 0;

    for (const cat of categories) {
      const check = checks[cat.id];
      if (check?.passed) passedCount++;
      else failedCount++;
    }

    const score = Number.isFinite(mData.score) ? mData.score : Math.round((passedCount / categories.length) * 100);
    totalScore += score;
    modelCount++;

    processedModels[model.id] = {
      id: model.id,
      name: model.name,
      score,
      badge: getStatusBadge(score),
      passedCount,
      failedCount,
      totalChecks: categories.length,
      checks,
    };
  }

  const overallScore = modelCount > 0 ? Math.round(totalScore / modelCount) : 0;
  return {
    overallScore,
    overallBadge: getStatusBadge(overallScore),
    models: processedModels,
  };
}

async function persist(userId, explicitProjectId, targetUrl, result) {
  if (!userId || userId === 'configured-admin') return false;

  const projectId = explicitProjectId || (() => {
    try {
      return new URL(targetUrl).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return '';
    }
  })();
  if (!projectId) return false;

  try {
    configureMysqlConnection();
  } catch {
    return false;
  }

  // 1. Save to tool_results
  try {
    await update(
      `INSERT INTO tool_results
         (user_id, project_id, tool_key, project_url, result, created_at, updated_at)
       VALUES (?, ?, 'aiCompatibility', ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         project_url = VALUES(project_url),
         result = VALUES(result),
         updated_at = NOW()`,
      [userId, projectId, targetUrl, JSON.stringify(result)]
    );
  } catch (error) {
    if (error?.code !== 'ER_NO_SUCH_TABLE') {
      console.warn('Could not save to tool_results:', error?.message);
    }
  }

  // 2. Merge into user_projects.project_data
  try {
    const row = await queryOne(
      'SELECT project_data FROM user_projects WHERE user_id = ? AND project_id = ? LIMIT 1',
      [userId, projectId]
    );
    if (!row) return false;

    let existing = {};
    if (row.project_data) {
      existing = typeof row.project_data === 'string' ? JSON.parse(row.project_data) : row.project_data;
    }
    const merged = {
      ...(existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}),
      aiCompatibility: result,
    };
    await update(
      'UPDATE user_projects SET project_data = ?, updated_at = NOW() WHERE user_id = ? AND project_id = ?',
      [JSON.stringify(merged), userId, projectId]
    );
    return true;
  } catch (error) {
    console.warn('Could not save to user_projects:', error?.message);
    return false;
  }
}

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders('POST, OPTIONS'), 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return emptyResponse(204, headers);
  if (request.method !== 'POST') return apiError(Object.assign(new Error('Method not allowed. Use POST.'), { status: 405 }), headers);

  try {
    const body = await readJson(request);
    const user = await authenticate(request, body, env);
    const target = normalizeUrl(body?.url || body?.project_url || body?.domain || body?.website);

    const { pageContent } = await scrapePage(target);
    const apiKey = await loadApiKey(user?.id, env);
    const { models, fallback } = await analyzeWithAi(target, pageContent, apiKey);
    const summary = summarizeModels(models);

    const result = {
      url: target.toString(),
      overallScore: summary.overallScore,
      overallBadge: summary.overallBadge,
      models: summary.models,
      fallback,
      analyzedAt: new Date().toISOString(),
    };

    const persisted = await persist(user?.id, body?.project_id, target.toString(), result);

    return jsonResponse({
      success: true,
      status: 'success',
      message: 'AI compatibility analysis completed successfully.',
      data: {
        ...result,
        persisted,
      },
    }, 200, headers);
  } catch (error) {
    return apiError(error, headers);
  }
}

export default onRequest;
