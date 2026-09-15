/**
 * Shared N-Grams business logic.
 *
 * Used by BOTH the /content/ngrams page (browser) and the
 * POST /api/content/ngrams endpoint (server) so the two can never drift.
 *
 * The page performs two operations, both reproduced here:
 *   1. Extraction  - getSourceText() then extractNgramsFromText(), producing
 *      unigrams/bigrams/trigrams (stop-word filtered, top 50 each).
 *   2. Unique n-grams (optional "Generate Unique N-Grams" button) - DeepSeek
 *      via generateUniqueNgramsDeepSeek(), with the local generator as fallback.
 *
 * Browser callers use the default fetcher and reach DeepSeek through
 * /api/deepseek; server callers inject `fetchHtml` and pass `apiKey`.
 */
import {
  extractNgramsFromText,
  generateUniqueNgrams,
  getSourceText,
} from "./contentTools.js";
import { generateUniqueNgramsDeepSeek } from "./deepseekContent.js";
import { normalizeInputUrls } from "./urlInput.js";
import { safeAiReason } from "./contentInput.js";

export const NGRAM_MODES = ["url", "text"];
export const MAX_TEXT_LENGTH = 500_000;

/** The page computes exactly these three sizes and shows them as 1/2/3-gram tabs. */
export const NGRAM_SIZES = [1, 2, 3];
export const SIZE_KEYS = { 1: "unigrams", 2: "bigrams", 3: "trigrams" };

export const UNIQUE_FALLBACK_MESSAGE =
  "DeepSeek could not generate unique n-grams. Showing local fallback results.";

function validationError(message, field) {
  const error = new Error(message);
  error.status = 400;
  error.field = field;
  return error;
}

function normalizeMode(value) {
  if (value === undefined || value === null || value === "") return "url";
  if (typeof value !== "string") throw validationError("mode must be a string.", "mode");
  const mode = value.trim().toLowerCase();
  if (!NGRAM_MODES.includes(mode)) {
    throw validationError(`mode must be one of: ${NGRAM_MODES.join(", ")}.`, "mode");
  }
  return mode;
}

function normalizeText(value) {
  if (typeof value !== "string") {
    throw validationError("text is required and must be a string.", "text");
  }
  const text = value.trim();
  if (!text) throw validationError("text is required.", "text");
  if (text.length > MAX_TEXT_LENGTH) {
    throw validationError(`text must be ${MAX_TEXT_LENGTH} characters or fewer.`, "text");
  }
  return text;
}

/**
 * Which n-gram sizes to return. Defaults to all three, exactly what the page
 * computes. `n` is accepted as a single-size alias for `sizes`.
 */
function normalizeSizes(sizes, n) {
  const raw = sizes !== undefined && sizes !== null ? sizes : n;
  if (raw === undefined || raw === null || raw === "") return [...NGRAM_SIZES];

  const list = Array.isArray(raw) ? raw : [raw];
  if (!list.length) throw validationError("sizes must not be empty.", "sizes");

  const normalized = [];
  for (const item of list) {
    const size = Number(item);
    if (!Number.isInteger(size) || !NGRAM_SIZES.includes(size)) {
      throw validationError(
        `n-gram size must be one of: ${NGRAM_SIZES.join(", ")}.`,
        Array.isArray(raw) || sizes !== undefined ? "sizes" : "n"
      );
    }
    if (!normalized.includes(size)) normalized.push(size);
  }

  return normalized.sort();
}

export function normalizeNgramsInput({ mode, text, content, url, sizes, n, includeUnique } = {}) {
  const normalizedMode = normalizeMode(mode);
  const normalizedSizes = normalizeSizes(sizes, n);

  if (includeUnique !== undefined && typeof includeUnique !== "boolean") {
    throw validationError("includeUnique must be a boolean.", "includeUnique");
  }

  if (normalizedMode === "text") {
    const source = text !== undefined && text !== null ? text : content;
    return {
      mode: normalizedMode,
      text: normalizeText(source),
      url: "",
      sizes: normalizedSizes,
      includeUnique: Boolean(includeUnique),
    };
  }

  // The page's URL mode takes a single URL.
  const [normalizedUrl] = normalizeInputUrls(url, { max: 1, field: "url" });
  return {
    mode: normalizedMode,
    text: "",
    url: normalizedUrl,
    sizes: normalizedSizes,
    includeUnique: Boolean(includeUnique),
  };
}

function joinSource(source) {
  if (Array.isArray(source)) return source.map((item) => item?.text || "").join(" ");
  return String(source || "");
}

/**
 * Build the seed the page passes to the unique n-grams generator:
 * the raw text, else the URL, else the top extracted n-grams.
 */
export function buildUniqueSeed({ text, url, ngrams }) {
  const fromText = String(text || "").trim();
  if (fromText) return fromText;

  const fromUrl = String(url || "").trim();
  if (fromUrl) return fromUrl;

  return ["unigrams", "bigrams", "trigrams"]
    .flatMap((key) => (ngrams?.[key] || []).slice(0, 8).map((item) => item.ngram))
    .join(", ");
}

/**
 * Run the N-Grams pipeline.
 *
 * @param {object} options
 * @param {"url"|"text"} [options.mode] defaults to "url", like the page
 * @param {string} [options.text] raw text (mode "text"); `content` is an alias
 * @param {string} [options.url] target URL (mode "url")
 * @param {number|number[]} [options.sizes] 1|2|3, defaults to all three; `n` is an alias
 * @param {boolean} [options.includeUnique] also run the DeepSeek unique n-grams step
 * @param {string} [options.apiKey] resolved DeepSeek key (server-side only)
 * @param {(url: string) => Promise<string>} [options.fetchHtml] HTML fetcher override
 */
export async function extractContentNgrams(options = {}) {
  const { mode, text, url, sizes, includeUnique } = normalizeNgramsInput(options);

  const source = await getSourceText({
    mode,
    text,
    url,
    fetchHtml: options.fetchHtml,
  });

  const joined = joinSource(source);
  const all = extractNgramsFromText(joined);

  const ngrams = {};
  const counts = {};
  for (const size of sizes) {
    const key = SIZE_KEYS[size];
    ngrams[key] = all[key] || [];
    counts[key] = ngrams[key].length;
  }

  const result = {
    mode,
    url,
    sizes,
    characters: joined.length,
    ngrams,
    counts,
    unique: { requested: Boolean(includeUnique), applied: false, reason: "", ngrams: [] },
  };

  if (!includeUnique) return result;

  const seed = buildUniqueSeed({ text, url, ngrams: all });
  if (!seed.trim()) {
    result.unique.reason = "No seed available to generate unique n-grams.";
    return result;
  }

  try {
    result.unique.ngrams = await generateUniqueNgramsDeepSeek(seed, { apiKey: options.apiKey });
    result.unique.applied = true;
  } catch (error) {
    result.unique.ngrams = generateUniqueNgrams(seed);
    result.unique.reason = safeAiReason(error, UNIQUE_FALLBACK_MESSAGE);
  }

  return result;
}
