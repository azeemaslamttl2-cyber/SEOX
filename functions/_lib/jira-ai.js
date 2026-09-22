// AI enrichment for a Jira issue, on the DeepSeek key SEOX already stores.
//
// This is a thin layer over the existing AI infrastructure, not a second AI
// system: the key comes from deepseek-key.js (per-user
// deepseek_api_settings, then the DEEPSEEK_API_KEY fallback) and the call
// shape follows gbp-ai.js. It also spends the existing 'ai:generate' rate
// limit bucket rather than adding a Jira-specific one.
//
// Hard rule: AI never blocks issue creation. If the key is missing, the
// model is slow, or the JSON comes back malformed, the caller falls back to
// the static template and the issue is filed anyway.

import { resolveDeepSeekApiKey } from './deepseek-key.js';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';
const TIMEOUT_MS = 60000;

// The model ignores length instructions often enough that every field is
// capped server-side before it can reach Jira.
const LIMITS = {
  summary: 200,
  technicalDescription: 1200,
  rootCause: 800,
  recommendedFix: 1500,
  seoImpact: 600,
  listItem: 400,
  listLength: 10,
};

const SYSTEM_INSTRUCTION = `You are a senior technical SEO engineer writing a ticket for a web developer who is not an SEO specialist.
Be concrete and specific to the page and the evidence you are given. Never invent facts, URLs, file names, framework names or metrics that were not provided.
If you cannot determine a root cause from the evidence, say what the most likely causes are and how to tell them apart.
Write plainly. No marketing language, no hype, no filler.
Return valid JSON only.`;

function clamp(value, max) {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/\s+/g, ' ').slice(0, max);
}

function clampList(value, max = LIMITS.listLength) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, max)
    .map((item) => clamp(item, LIMITS.listItem))
    .filter(Boolean);
}

function parseJsonResponse(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function buildPrompt(finding, project) {
  const lines = [
    `Website: ${project?.domain || project?.full_url || 'unknown'}`,
    `Finding type: ${finding.findingType}`,
    `Finding title: ${finding.title}`,
    `Severity: ${finding.severity}`,
  ];

  if (finding.url) lines.push(`Affected URL: ${finding.url}`);
  if (finding.affectedUrlCount > 1) lines.push(`Total affected URLs: ${finding.affectedUrlCount}`);
  if (finding.currentValue) lines.push(`Current value: ${finding.currentValue}`);
  if (finding.expectedValue) lines.push(`Expected value: ${finding.expectedValue}`);
  if (finding.description) lines.push(`SEOX description: ${finding.description}`);
  if (finding.recommendation) lines.push(`SEOX recommendation: ${finding.recommendation}`);

  const evidence = Object.entries(finding.evidence || {}).slice(0, 12);
  if (evidence.length) {
    lines.push('Evidence from the crawl:');
    for (const [key, value] of evidence) {
      lines.push(`  ${key}: ${Array.isArray(value) ? value.slice(0, 5).join(', ') : value}`);
    }
  }

  lines.push(
    '',
    'Produce a JSON object with exactly these keys:',
    '{"summary": string, "technicalDescription": string, "rootCause": string,',
    ' "recommendedFix": string, "developerInstructions": string[],',
    ' "acceptanceCriteria": string[], "seoImpact": string,',
    ' "testingInstructions": string[]}',
    '',
    'summary: a Jira issue title under 200 characters. Do not prefix it with [SEOX].',
    'technicalDescription: 2-4 sentences aimed at the developer who will fix it.',
    'acceptanceCriteria: objectively checkable statements, not aspirations.'
  );

  return lines.join('\n');
}

async function callDeepSeek({ apiKey, prompt }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1600,
        stream: false,
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error?.message || `DeepSeek returned ${response.status}.`);
      error.status = response.status === 401 ? 401 : 502;
      throw error;
    }
    return data.choices?.[0]?.message?.content || '';
  } catch (cause) {
    if (cause.name === 'AbortError') {
      const error = new Error('AI generation timed out.');
      error.status = 504;
      throw error;
    }
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Draft the AI-written parts of a Jira issue.
 *
 * Returns null - never throws - when AI is unavailable for any reason, so the
 * caller can fall back to the static template. The reason is returned
 * alongside so the UI can explain why the toggle produced nothing.
 *
 * @returns {Promise<{fields: object|null, reason: string}>}
 */
export async function draftJiraIssueContent({ env, user, finding, project }) {
  let apiKey = '';
  try {
    apiKey = await resolveDeepSeekApiKey(user, env);
  } catch {
    return { fields: null, reason: 'The DeepSeek key could not be read.' };
  }

  if (!apiKey) {
    return {
      fields: null,
      reason: 'DeepSeek is not configured, so the standard description was used.',
    };
  }

  let raw;
  try {
    raw = await callDeepSeek({ apiKey, prompt: buildPrompt(finding, project) });
  } catch (error) {
    // Logged, not surfaced: the issue still gets created.
    console.warn('Jira AI drafting failed:', error?.message || error);
    return { fields: null, reason: 'AI drafting was unavailable, so the standard description was used.' };
  }

  const parsed = parseJsonResponse(raw);
  if (!parsed || typeof parsed !== 'object') {
    return { fields: null, reason: 'The AI response could not be read, so the standard description was used.' };
  }

  const fields = {
    summary: clamp(parsed.summary, LIMITS.summary),
    technicalDescription: clamp(parsed.technicalDescription, LIMITS.technicalDescription),
    rootCause: clamp(parsed.rootCause, LIMITS.rootCause),
    recommendedFix: clamp(parsed.recommendedFix, LIMITS.recommendedFix),
    developerInstructions: clampList(parsed.developerInstructions),
    acceptanceCriteria: clampList(parsed.acceptanceCriteria),
    seoImpact: clamp(parsed.seoImpact, LIMITS.seoImpact),
    testingInstructions: clampList(parsed.testingInstructions),
  };

  const hasContent = Object.values(fields).some((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value)
  );

  return hasContent
    ? { fields, reason: '' }
    : { fields: null, reason: 'The AI response was empty, so the standard description was used.' };
}
