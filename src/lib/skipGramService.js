/**
 * Shared Skip-Gram business logic
 * (/content/skip-gram and POST /api/content/skip-gram).
 */
import { generateSkipGramWords } from "./contentTools.js";
import { generateSkipGramWordsDeepSeek } from "./deepseekContent.js";
import { normalizeRequiredText, runWithAiFallback } from "./contentInput.js";

export const MAX_WORD_LENGTH = 200;

export function normalizeSkipGramInput({ word } = {}) {
  return normalizeRequiredText(word, { field: "word", max: MAX_WORD_LENGTH });
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

export async function generateSkipGramDominantWords({ word, apiKey } = {}) {
  const normalizedWord = normalizeSkipGramInput({ word });

  const { result, ai } = await runWithAiFallback({
    run: () => generateSkipGramWordsDeepSeek(normalizedWord, { apiKey }),
    fallback: () => generateSkipGramWords(normalizedWord),
    isUsable: (value) => normalizeList(value).length > 0,
    emptyReason: "DeepSeek returned no usable skip-gram words.",
  });

  const words = normalizeList(result);
  return { word: normalizedWord, words, wordCount: words.length, ai };
}
