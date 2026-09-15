/**
 * Shared NLP Extractor business logic (/content/nlp and POST /api/content/nlp).
 * Fully local: getSourceText() then extractNlpKeywords(), exactly as the page does.
 */
import { extractNlpKeywords, getSourceText } from "./contentTools.js";
import { normalizeInputUrls } from "./urlInput.js";
import { normalizeRequiredText, validationError } from "./contentInput.js";

export const NLP_MODES = ["url", "text"];
export const MAX_TEXT_LENGTH = 500_000;

export function normalizeNlpInput({ mode, text, content, url } = {}) {
  const rawMode = mode === undefined || mode === null || mode === "" ? "url" : mode;
  if (typeof rawMode !== "string") throw validationError("mode must be a string.", "mode");
  const normalizedMode = rawMode.trim().toLowerCase();
  if (!NLP_MODES.includes(normalizedMode)) {
    throw validationError(`mode must be one of: ${NLP_MODES.join(", ")}.`, "mode");
  }

  if (normalizedMode === "text") {
    const source = text !== undefined && text !== null ? text : content;
    return {
      mode: normalizedMode,
      text: normalizeRequiredText(source, { field: "text", max: MAX_TEXT_LENGTH }),
      url: "",
    };
  }

  const [normalizedUrl] = normalizeInputUrls(url, { max: 1, field: "url" });
  return { mode: normalizedMode, text: "", url: normalizedUrl };
}

function joinSource(source) {
  if (Array.isArray(source)) return source.map((item) => item?.text || "").join(" ");
  return String(source || "");
}

export async function extractContentNlpKeywords(options = {}) {
  const { mode, text, url } = normalizeNlpInput(options);

  const source = await getSourceText({ mode, text, url, fetchHtml: options.fetchHtml });
  const joined = joinSource(source);
  const keywords = extractNlpKeywords(joined) || [];

  const types = Array.from(new Set(keywords.map((item) => item.type)));
  const sentiments = Array.from(new Set(keywords.map((item) => item.sentiment)));

  return {
    mode,
    url,
    characters: joined.length,
    keywords,
    keywordCount: keywords.length,
    types,
    sentiments,
  };
}
