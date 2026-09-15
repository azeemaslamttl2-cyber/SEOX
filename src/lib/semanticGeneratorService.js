/**
 * Shared Semantic Keyword Generator business logic
 * (/content/semantic-generator and POST /api/content/semantic-generator).
 *
 * The page runs six sequential AI operations against /api/ai-tools and feeds
 * each response through normalizeSemanticKeywordResult(). That backend route
 * does not exist in this repository, so the prompts live here instead; the
 * section schemas and the normalizer are the page's own, reused unchanged, so
 * the result shape is exactly what the UI expects.
 */
import { callDeepSeekJson } from "./deepseekContent.js";
import { normalizeSemanticKeywordResult } from "../semanticsx/lib/semanticKeywordResult.js";
import { normalizeRequiredText, safeAiReason, validationError } from "./contentInput.js";

export const MAX_KEYWORD_LENGTH = 200;

/** The six sections the page generates, in the order it generates them. */
export const SEMANTIC_SECTIONS = [
  "entities",
  "ngrams",
  "nlp",
  "grammar",
  "uniqueNgrams",
  "skipGrams",
];

const SECTION_PROMPTS = {
  entities: (keyword) => `List the semantic SEO entities for the topic: "${keyword}".

Return JSON only:
{
  "entities": ["entity", "entity"],
  "entityTypes": {
    "people": [], "organizations": [], "concepts": [], "products": [], "locations": []
  }
}

Rules:
- 20 to 40 items in "entities".
- Place each entity under the matching entityTypes group; leave a group empty if it does not apply.
- No explanations.`,

  ngrams: (keyword) => `Generate SEO n-grams for the topic: "${keyword}".

Return JSON only:
{ "bigrams": [], "trigrams": [], "fourgrams": [] }

Rules:
- 12 to 20 phrases per group, each with exactly that many words.
- Use phrases real searchers would use.
- No explanations.`,

  nlp: (keyword) => `Generate NLP keyword groups for the topic: "${keyword}".

Return JSON only:
{ "primaryKeywords": [], "secondaryKeywords": [], "lsiKeywords": [] }

Rules:
- 8 to 15 primary, 12 to 20 secondary, 15 to 25 LSI keywords.
- LSI keywords must be semantically related, not simple variations.
- No explanations.`,

  grammar: (keyword) => `Generate semantic grammar relationships for the term: "${keyword}".

Return JSON only with these exact keys:
{
  "proper_nouns": [], "common_nouns": [], "synonyms": [], "antonyms": [],
  "hyponyms": [], "hypernyms": [], "meronyms": [], "holonyms": []
}

Rules:
- 6 to 12 concise entries per key.
- No explanations.`,

  uniqueNgrams: (keyword) => `Generate unique, high-value n-grams for the term: "${keyword}", grouped by search intent.

Return JSON only:
{ "informational": [], "commercial": [], "longtail": [], "authority": [] }

Rules:
- 8 to 15 phrases per group.
- Avoid generic keyword stuffing; prefer phrases that could become subheadings.
- No explanations.`,

  skipGrams: (keyword) => `Generate skip-gram analysis for the term: "${keyword}".

Return JSON only:
{
  "word_sense_disambiguation": [
    { "sense": "a distinct meaning of the term", "dominant_words": ["word", "word"] }
  ],
  "document_summarization": [],
  "keyword_extraction": []
}

Rules:
- 2 to 5 senses, each with 8 to 15 dominant co-occurring words.
- 10 to 20 entries in document_summarization and keyword_extraction.
- No explanations.`,
};

const SECTION_TEMPERATURE = {
  entities: 0.35,
  ngrams: 0.45,
  nlp: 0.4,
  grammar: 0.35,
  uniqueNgrams: 0.55,
  skipGrams: 0.4,
};

export function normalizeSemanticInput({ keyword, sections } = {}) {
  const normalizedKeyword = normalizeRequiredText(keyword, {
    field: "keyword",
    max: MAX_KEYWORD_LENGTH,
  });

  if (sections === undefined || sections === null || sections === "") {
    return { keyword: normalizedKeyword, sections: [...SEMANTIC_SECTIONS] };
  }

  const list = Array.isArray(sections) ? sections : [sections];
  if (!list.length) throw validationError("sections must not be empty.", "sections");

  const normalized = [];
  for (const item of list) {
    const section = String(item ?? "").trim();
    if (!SEMANTIC_SECTIONS.includes(section)) {
      throw validationError(
        `sections must contain only: ${SEMANTIC_SECTIONS.join(", ")}.`,
        "sections"
      );
    }
    if (!normalized.includes(section)) normalized.push(section);
  }

  // Preserve the page's generation order.
  return {
    keyword: normalizedKeyword,
    sections: SEMANTIC_SECTIONS.filter((section) => normalized.includes(section)),
  };
}

/**
 * Generate the semantic keyword analysis.
 *
 * Each section is independent: a failing section is reported on `errors` while
 * the rest still return, so one bad AI response does not lose the whole run.
 */
export async function generateSemanticKeywordAnalysis({ keyword, sections, apiKey } = {}) {
  const { keyword: normalizedKeyword, sections: requested } = normalizeSemanticInput({
    keyword,
    sections,
  });

  const results = {};
  const errors = {};

  for (const section of requested) {
    try {
      const payload = await callDeepSeekJson({
        action: `semantic.${section}`,
        temperature: SECTION_TEMPERATURE[section] ?? 0.4,
        maxTokens: 4096,
        apiKey,
        prompt: SECTION_PROMPTS[section](normalizedKeyword),
      });
      results[section] = normalizeSemanticKeywordResult(section, payload);
    } catch (error) {
      errors[section] = safeAiReason(error, "Section could not be generated.");
    }
  }

  return {
    keyword: normalizedKeyword,
    sections: requested,
    generated: Object.keys(results),
    failed: Object.keys(errors),
    results,
    errors,
  };
}
