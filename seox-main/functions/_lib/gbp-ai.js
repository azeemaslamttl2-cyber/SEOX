// AI copy generation for GBP posts, on the DeepSeek key SEOX already stores.
//
// The model only ever produces a draft. Nothing here publishes: the caller
// decides whether the draft becomes a draft row, an approval item, or a
// scheduled post.

import { queryOne } from './mysql.js';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

export async function resolveDeepSeekKey(env, userId) {
  try {
    const row = await queryOne(
      'SELECT api_key FROM deepseek_api_settings WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [userId]
    );
    if (row?.api_key) return row.api_key;
  } catch {
    // Table may not exist on older installations; fall through to the env key.
  }
  return env?.DEEPSEEK_API_KEY || '';
}

async function callDeepSeek({ apiKey, systemInstruction, prompt, temperature = 0.7, maxTokens = 1200 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: `${systemInstruction}\n\nReturn valid JSON only.` },
          { role: 'user', content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
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

function parseJsonResponse(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const braced = candidate.match(/\{[\s\S]*\}/);
    if (braced) {
      try {
        return JSON.parse(braced[0]);
      } catch {
        /* fall through */
      }
    }
    const error = new Error('The AI response was not valid JSON.');
    error.status = 502;
    throw error;
  }
}

const SYSTEM = `You write Google Business Profile posts for local businesses.

Hard rules, because Google rejects posts that break them:
- Never put a phone number in the post body.
- Never write in all capitals.
- Keep the body between 150 and 280 characters.
- No URLs in the body; the link lives in the call-to-action button.
- Plain, concrete language. No emoji spam, no more than one exclamation mark.
- Do not invent prices, guarantees, awards or availability that were not given to you.

Respond with JSON: {"summary": string, "ctaType": one of BOOK|ORDER|SHOP|LEARN_MORE|SIGN_UP|CALL, "eventTitle": string or null}`;

/**
 * Draft a post from business context. `source` is set when the post is being
 * generated from a website page (the Website -> GBP automation).
 */
export async function generatePostCopy(env, userId, input) {
  const apiKey = await resolveDeepSeekKey(env, userId);
  if (!apiKey) {
    const error = new Error(
      'No DeepSeek API key configured. Add one in Settings before generating post copy.'
    );
    error.status = 400;
    throw error;
  }

  const lines = [
    `Business: ${input.businessName}`,
    input.primaryCategory ? `Category: ${input.primaryCategory}` : null,
    input.city ? `Serving: ${input.city}` : null,
    input.topicType && input.topicType !== 'STANDARD' ? `Post type: ${input.topicType}` : null,
    input.topic ? `Topic: ${input.topic}` : null,
    input.keyword ? `Target keyword to use naturally once: ${input.keyword}` : null,
    input.services?.length ? `Services offered: ${input.services.slice(0, 12).join(', ')}` : null,
    input.reviewThemes?.length
      ? `Phrases customers use in reviews: ${input.reviewThemes.slice(0, 6).join(', ')}`
      : null,
    input.source?.title ? `Source page title: ${input.source.title}` : null,
    input.source?.excerpt ? `Source page summary: ${input.source.excerpt.slice(0, 900)}` : null,
    input.tone ? `Tone: ${input.tone}` : null,
  ].filter(Boolean);

  const text = await callDeepSeek({
    apiKey,
    systemInstruction: SYSTEM,
    prompt: `${lines.join('\n')}\n\nWrite one Google Business Profile post.`,
  });

  const parsed = parseJsonResponse(text);
  return {
    summary: String(parsed.summary || '').trim(),
    ctaType: parsed.ctaType || (input.source?.url ? 'LEARN_MORE' : null),
    eventTitle: parsed.eventTitle || null,
  };
}

const THEME_SYSTEM = `You analyse Google reviews for a local business.
Return JSON: {"positive": [{"theme": string, "mentions": number}], "negative": [{"theme": string, "mentions": number}], "recommendation": string}
Themes are two or three words. Only count what actually appears in the reviews.`;

export async function extractReviewThemes(env, userId, reviews) {
  const apiKey = await resolveDeepSeekKey(env, userId);
  if (!apiKey) return null;

  const body = reviews
    .slice(0, 60)
    .map((review) => `[${review.starRating || '?'}] ${String(review.comment || '').slice(0, 300)}`)
    .join('\n');
  if (!body.trim()) return null;

  const text = await callDeepSeek({
    apiKey,
    systemInstruction: THEME_SYSTEM,
    prompt: body,
    temperature: 0.3,
  });
  return parseJsonResponse(text);
}

// --- Review replies --------------------------------------------------------

const REPLY_SYSTEM = `You write public replies to Google reviews, speaking as the business owner.

Hard rules:
- Reply in the same language the review is written in.
- 2 to 4 sentences. Never longer.
- Thank the reviewer by first name only if a name is given; never invent one.
- Never dispute facts, never blame the customer, never mention compensation,
  refunds, discounts or legal action.
- Never include phone numbers, email addresses or URLs.
- Do not claim anything about the business that was not given to you.
- For a negative review: acknowledge the specific problem the reviewer named,
  say briefly what will change, and invite them to continue privately. Do not
  apologise more than once.

Respond with JSON: {"reply": string, "tone": "warm"|"neutral"|"apologetic"}`;

export async function generateReviewReply(env, userId, input) {
  const apiKey = await resolveDeepSeekKey(env, userId);
  if (!apiKey) {
    const error = new Error(
      'No DeepSeek API key configured. Add one in Settings before generating review replies.'
    );
    error.status = 400;
    throw error;
  }

  const lines = [
    `Business: ${input.businessName}`,
    input.primaryCategory ? `Category: ${input.primaryCategory}` : null,
    `Rating given: ${input.starRating} out of 5`,
    input.reviewerName ? `Reviewer: ${input.reviewerName}` : 'Reviewer: anonymous',
    `Review text: ${String(input.comment || '(no text, rating only)').slice(0, 1200)}`,
    input.tone ? `Requested tone: ${input.tone}` : null,
  ].filter(Boolean);

  const text = await callDeepSeek({
    apiKey,
    systemInstruction: REPLY_SYSTEM,
    prompt: lines.join('\n'),
    temperature: 0.6,
    maxTokens: 600,
  });

  const parsed = parseJsonResponse(text);
  return { reply: String(parsed.reply || '').trim(), tone: parsed.tone || null };
}

// --- Q&A answers -----------------------------------------------------------

const ANSWER_SYSTEM = `You answer questions asked on a Google Business Profile, speaking as the business.

Hard rules:
- Answer only from the business details supplied. If the answer is not in them,
  reply with a short sentence saying to contact the business to confirm — do not
  guess hours, prices, stock or policies.
- 1 to 3 sentences.
- No URLs, no phone numbers, no email addresses.
- Plain, factual language.

Respond with JSON: {"answer": string, "confident": boolean, "missing": string or null}
Set confident to false and name what was missing when the supplied details do not
contain the answer.`;

export async function generateQuestionAnswer(env, userId, input) {
  const apiKey = await resolveDeepSeekKey(env, userId);
  if (!apiKey) {
    const error = new Error(
      'No DeepSeek API key configured. Add one in Settings before generating answers.'
    );
    error.status = 400;
    throw error;
  }

  const lines = [
    `Business: ${input.businessName}`,
    input.primaryCategory ? `Category: ${input.primaryCategory}` : null,
    input.address ? `Address: ${input.address}` : null,
    input.hours ? `Opening hours: ${input.hours}` : null,
    input.website ? `Website: ${input.website}` : null,
    input.description ? `About: ${String(input.description).slice(0, 700)}` : null,
    input.services?.length ? `Services: ${input.services.slice(0, 20).join(', ')}` : null,
    input.attributes?.length ? `Attributes: ${input.attributes.slice(0, 20).join(', ')}` : null,
    '',
    `Question: ${String(input.question || '').slice(0, 800)}`,
  ].filter((line) => line !== null);

  const text = await callDeepSeek({
    apiKey,
    systemInstruction: ANSWER_SYSTEM,
    prompt: lines.join('\n'),
    temperature: 0.3,
    maxTokens: 500,
  });

  const parsed = parseJsonResponse(text);
  return {
    answer: String(parsed.answer || '').trim(),
    confident: parsed.confident !== false,
    missing: parsed.missing || null,
  };
}
