/**
 * Shared Unique N-Grams business logic
 * (/content/unique-ngrams and POST /api/content/unique-ngrams).
 */
import { generateUniqueNgrams } from "./contentTools.js";
import { generateUniqueNgramsDeepSeek } from "./deepseekContent.js";
import { normalizeRequiredText, runWithAiFallback } from "./contentInput.js";

export const MAX_TOPIC_LENGTH = 200;

export function normalizeUniqueNgramsInput({ topic } = {}) {
  return normalizeRequiredText(topic, { field: "topic", max: MAX_TOPIC_LENGTH });
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

export async function generateUniqueNgramPhrases({ topic, apiKey } = {}) {
  const normalizedTopic = normalizeUniqueNgramsInput({ topic });

  const { result, ai } = await runWithAiFallback({
    run: () => generateUniqueNgramsDeepSeek(normalizedTopic, { apiKey }),
    fallback: () => generateUniqueNgrams(normalizedTopic),
    isUsable: (value) => normalizeList(value).length > 0,
    emptyReason: "DeepSeek returned no usable n-grams.",
  });

  const ngrams = normalizeList(result);
  return { topic: normalizedTopic, ngrams, ngramCount: ngrams.length, ai };
}
