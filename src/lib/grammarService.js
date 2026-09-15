/**
 * Shared Grammar Generator business logic
 * (/content/grammar and POST /api/content/grammar).
 * DeepSeek semantic grammar relations with the page's local generator as fallback.
 */
import { generateGrammarRelations } from "./contentTools.js";
import { generateGrammarRelationsDeepSeek } from "./deepseekContent.js";
import { normalizeRequiredText, runWithAiFallback } from "./contentInput.js";

export const MAX_TOPIC_LENGTH = 200;

export const GRAMMAR_CATEGORIES = [
  "properNouns",
  "commonNouns",
  "synonyms",
  "antonyms",
  "hyponyms",
  "hypernyms",
  "meronyms",
  "holonyms",
];

export function normalizeGrammarInput({ topic } = {}) {
  return normalizeRequiredText(topic, { field: "topic", max: MAX_TOPIC_LENGTH });
}

function normalizeRelations(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    GRAMMAR_CATEGORIES.map((key) => [
      key,
      Array.isArray(source[key])
        ? source[key].map((item) => String(item ?? "").trim()).filter(Boolean)
        : [],
    ])
  );
}

export async function generateGrammarRelationships({ topic, apiKey } = {}) {
  const normalizedTopic = normalizeGrammarInput({ topic });

  const { result, ai } = await runWithAiFallback({
    run: () => generateGrammarRelationsDeepSeek(normalizedTopic, { apiKey }),
    fallback: () => generateGrammarRelations(normalizedTopic),
    isUsable: (value) => Object.values(normalizeRelations(value)).some((list) => list.length > 0),
    emptyReason: "DeepSeek returned no usable grammar relationships.",
  });

  const relations = normalizeRelations(result);

  return {
    topic: normalizedTopic,
    categories: GRAMMAR_CATEGORIES,
    relations,
    totalTerms: Object.values(relations).reduce((sum, list) => sum + list.length, 0),
    ai,
  };
}
