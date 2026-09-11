/**
 * Shared Competitor Content Analyzer business logic
 * (/content/content-analyzer and POST /api/content/content-analyzer).
 *
 * The page fetches each competitor URL, extracts the page text and headings,
 * joins them into one truncated corpus, then runs three AI extractions against
 * /api/ai-tools. That backend route does not exist in this repository, so the
 * prompts live here; the section shapes are the page's own SECTIONS config, so
 * the result is exactly what the UI renders.
 */
import { callDeepSeekJson } from "./deepseekContent.js";
import { extractOutlineFromHtml } from "./contentTools.js";
import { extractMainContent, getPageTitle } from "../utils/fetchAndParse.js";
import { normalizeInputUrls } from "./urlInput.js";
import { safeAiReason, validationError } from "./contentInput.js";

export const MAX_ANALYZER_URLS = 10;

/** The page truncates the combined competitor corpus to 12,000 characters. */
export const MAX_COMBINED_CHARS = 12_000;

export const ANALYZER_SECTIONS = ["entities", "ngrams", "skipGrams"];

const SECTION_PROMPTS = {
  entities: (content) => `Extract the semantic entities competitors use in this content.

Content:
${content}

Return JSON only:
{
  "people": [], "organizations": [], "locations": [],
  "products": [], "concepts": [], "technologies": []
}

Rules:
- Only entities actually present in the content.
- Up to 25 per group; leave a group empty if it does not apply.
- No explanations.`,

  ngrams: (content) => `Extract the most meaningful SEO n-grams from this competitor content.

Content:
${content}

Return JSON only:
{ "bigrams": [], "trigrams": [], "fourgrams": [] }

Rules:
- 15 to 25 phrases per group, each with exactly that many words.
- Prefer phrases that carry topical meaning over generic filler.
- No explanations.`,

  skipGrams: (content) => `Perform a skip-gram analysis of this competitor content.

Content:
${content}

Return JSON only:
{
  "word_sense_disambiguation": [
    { "sense": "a distinct meaning present in the content", "dominant_words": ["word", "word"] }
  ],
  "document_summarization": [],
  "keyword_extraction": []
}

Rules:
- 2 to 5 senses, each with 8 to 15 dominant co-occurring words.
- 10 to 20 entries in document_summarization and keyword_extraction.
- No explanations.`,
};

const ENTITY_GROUPS = [
  "people",
  "organizations",
  "locations",
  "products",
  "concepts",
  "technologies",
];
const NGRAM_GROUPS = ["bigrams", "trigrams", "fourgrams"];

function cleanList(value, limit = 50) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const text = String(item ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function normalizeGroups(value, keys) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(keys.map((key) => [key, cleanList(source[key])]));
}

function normalizeSkipGrams(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const senses = Array.isArray(source.word_sense_disambiguation)
    ? source.word_sense_disambiguation
        .slice(0, 12)
        .map((item) => ({
          sense: String(item?.sense ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
          dominant_words: cleanList(item?.dominant_words),
        }))
        .filter((item) => item.sense && item.dominant_words.length > 0)
    : [];

  return {
    word_sense_disambiguation: senses,
    document_summarization: cleanList(source.document_summarization),
    keyword_extraction: cleanList(source.keyword_extraction),
  };
}

const SECTION_NORMALIZERS = {
  entities: (value) => normalizeGroups(value, ENTITY_GROUPS),
  ngrams: (value) => normalizeGroups(value, NGRAM_GROUPS),
  skipGrams: normalizeSkipGrams,
};

export function normalizeAnalyzerInput({ urls, url, sections } = {}) {
  const normalizedUrls = normalizeInputUrls(urls !== undefined && urls !== null ? urls : url, {
    max: MAX_ANALYZER_URLS,
    field: "urls",
  });

  if (sections === undefined || sections === null || sections === "") {
    return { urls: normalizedUrls, sections: [...ANALYZER_SECTIONS] };
  }

  const list = Array.isArray(sections) ? sections : [sections];
  if (!list.length) throw validationError("sections must not be empty.", "sections");

  const normalized = [];
  for (const item of list) {
    const section = String(item ?? "").trim();
    if (!ANALYZER_SECTIONS.includes(section)) {
      throw validationError(
        `sections must contain only: ${ANALYZER_SECTIONS.join(", ")}.`,
        "sections"
      );
    }
    if (!normalized.includes(section)) normalized.push(section);
  }

  return {
    urls: normalizedUrls,
    sections: ANALYZER_SECTIONS.filter((section) => normalized.includes(section)),
  };
}

/**
 * Analyze competitor URLs.
 *
 * Mirrors the page: a URL that cannot be fetched is skipped (and reported on
 * `failedUrls`) rather than failing the run, but every URL failing is an error.
 */
export async function analyzeCompetitorContent(options = {}) {
  const { urls, sections } = normalizeAnalyzerInput(options);
  const fetchHtml = options.fetchHtml;

  const pages = [];
  const failedUrls = [];

  for (const url of urls) {
    try {
      const html = await fetchHtml(url);
      pages.push({
        url,
        title: getPageTitle(html),
        text: extractMainContent(html),
        headings: extractOutlineFromHtml(html, getPageTitle(html)),
      });
    } catch (error) {
      failedUrls.push({ url, reason: safeAiReason(error, "Could not fetch this URL.") });
    }
  }

  if (!pages.length) {
    const error = new Error("Could not fetch any of the provided URLs.");
    error.status = 502;
    throw error;
  }

  const combined = pages
    .map((page) => `Source: ${page.title}\n${page.text}`)
    .join("\n\n---\n\n")
    .substring(0, MAX_COMBINED_CHARS);

  const results = {};
  const errors = {};

  for (const section of sections) {
    try {
      const payload = await callDeepSeekJson({
        action: `competitor-content.${section}`,
        temperature: 0.35,
        maxTokens: 4096,
        apiKey: options.apiKey,
        prompt: SECTION_PROMPTS[section](combined),
      });
      results[section] = SECTION_NORMALIZERS[section](payload);
    } catch (error) {
      errors[section] = safeAiReason(error, "Section could not be generated.");
    }
  }

  // The page builds the outline locally from the fetched headings.
  const outline = pages
    .filter((page) => page.headings.length > 0)
    .map((page) => ({ url: page.url, title: page.title, headings: page.headings }));

  return {
    urls,
    analyzedUrls: pages.map((page) => ({ url: page.url, title: page.title })),
    failedUrls,
    sections,
    generated: Object.keys(results),
    failed: Object.keys(errors),
    characters: combined.length,
    results,
    errors,
    outline,
  };
}
