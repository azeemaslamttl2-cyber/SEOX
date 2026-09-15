/**
 * Shared Entities Generator business logic.
 *
 * Used by BOTH the /content/entities-generator page (browser) and the
 * POST /api/content/entities-generator endpoint (server) so the two can never
 * drift.
 *
 * The page sends keywords to DeepSeek via generateEntityGroupsDeepSeek() and
 * falls back to the local generateEntitiesForKeywords() when that fails. This
 * service reproduces that exactly, reporting which path produced the result.
 *
 * Browser callers reach DeepSeek through /api/deepseek; server callers pass the
 * resolved `apiKey` explicitly.
 */
import { generateEntitiesForKeywords } from "./contentTools.js";
import { generateEntityGroupsDeepSeek } from "./deepseekContent.js";
import { safeAiReason } from "./contentInput.js";

export const MAX_KEYWORDS = 50;
export const MAX_KEYWORD_LENGTH = 200;
export const MAX_KEYWORDS_INPUT_LENGTH = 10_000;
export const AI_FALLBACK_MESSAGE =
  "DeepSeek could not generate entities. Showing local fallback results.";

function validationError(message, field = "keywords") {
  const error = new Error(message);
  error.status = 400;
  error.field = field;
  return error;
}

/**
 * Normalize the keywords input the page accepts.
 *
 * The page uses a single textarea whose value is split on commas and newlines.
 * An array is also accepted here and joined with newlines so it goes through
 * exactly the same splitting rules.
 *
 * @param {string|string[]} value
 * @returns {{ raw: string, keywords: string[] }}
 */
export function normalizeKeywordsInput(value) {
  if (value === undefined || value === null) {
    throw validationError("keywords is required.");
  }

  let raw;
  if (Array.isArray(value)) {
    if (value.some((item) => item !== null && item !== undefined && typeof item !== "string")) {
      throw validationError("keywords must be a string or an array of strings.");
    }
    raw = value.map((item) => String(item ?? "").trim()).filter(Boolean).join("\n");
  } else if (typeof value === "string") {
    raw = value;
  } else {
    throw validationError("keywords must be a string or an array of strings.");
  }

  if (raw.length > MAX_KEYWORDS_INPUT_LENGTH) {
    throw validationError(
      `keywords must be ${MAX_KEYWORDS_INPUT_LENGTH} characters or fewer.`
    );
  }

  // Same split the page's DeepSeek helper performs: comma or newline.
  const seen = new Set();
  const keywords = [];
  for (const part of String(raw).split(/[,\n]/)) {
    const keyword = part.trim();
    if (!keyword) continue;
    if (keyword.length > MAX_KEYWORD_LENGTH) {
      throw validationError(
        `Each keyword must be ${MAX_KEYWORD_LENGTH} characters or fewer: "${keyword.slice(0, 40)}..."`
      );
    }
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(keyword);
  }

  if (!keywords.length) {
    throw validationError("At least one keyword is required.");
  }

  if (keywords.length > MAX_KEYWORDS) {
    throw validationError(`A maximum of ${MAX_KEYWORDS} keywords is allowed per request.`);
  }

  return { raw: keywords.join("\n"), keywords };
}

/**
 * Coerce entity groups into the { keyword, entities: string[] } shape the UI
 * and API both use.
 */
export function normalizeEntityGroups(groups) {
  if (!Array.isArray(groups)) return [];
  return groups
    .map((group) => ({
      keyword: String(group?.keyword || "").trim(),
      entities: Array.isArray(group?.entities)
        ? group.entities.map((entity) => String(entity ?? "").trim()).filter(Boolean)
        : [],
    }))
    .filter((group) => group.keyword);
}

/**
 * Run the full Entities Generator pipeline.
 *
 * Matches the page's degradation behaviour: if DeepSeek fails, the locally
 * generated entities are still returned, with the reason reported on `ai`.
 *
 * @param {object} options
 * @param {string|string[]} options.keywords
 * @param {string} [options.apiKey] resolved DeepSeek key (server-side only)
 */
export async function generateEntityGroups({ keywords, apiKey } = {}) {
  const { raw, keywords: keywordList } = normalizeKeywordsInput(keywords);

  let groups;
  let ai = { applied: true, reason: "" };

  try {
    const generated = await generateEntityGroupsDeepSeek(raw, { apiKey });
    groups = normalizeEntityGroups(generated);
    if (!groups.length) {
      groups = normalizeEntityGroups(generateEntitiesForKeywords(raw));
      ai = { applied: false, reason: "DeepSeek returned no usable entities." };
    }
  } catch (error) {
    groups = normalizeEntityGroups(generateEntitiesForKeywords(raw));
    ai = { applied: false, reason: safeAiReason(error, AI_FALLBACK_MESSAGE) };
  }

  return {
    keywords: keywordList,
    keywordCount: keywordList.length,
    groups,
    entityCount: groups.reduce((total, group) => total + group.entities.length, 0),
    ai,
  };
}
