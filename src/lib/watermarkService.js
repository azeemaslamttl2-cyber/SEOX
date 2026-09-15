/**
 * Shared AI Watermark Remover business logic
 * (/content/watermark-remover and POST /api/content/watermark-remover).
 *
 * Fully local: removeAiWatermarks() strips zero-width/bidi/invisible unicode
 * markers. The page maps its checkboxes to the same two options.
 */
import { removeAiWatermarks } from "./contentTools.js";
import { normalizeRequiredText, validationError } from "./contentInput.js";

export const MAX_TEXT_LENGTH = 500_000;

/** Page defaults: whitespace normalisation on, quote normalisation off. */
export const DEFAULT_OPTIONS = { normalizeWhitespace: true, normalizeQuotes: false };

function normalizeFlag(value, field, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw validationError(`${field} must be a boolean.`, field);
  return value;
}

export function normalizeWatermarkInput({ text, content, normalizeWhitespace, normalizeQuotes } = {}) {
  const source = text !== undefined && text !== null ? text : content;
  return {
    text: normalizeRequiredText(source, { field: "text", max: MAX_TEXT_LENGTH }),
    normalizeWhitespace: normalizeFlag(
      normalizeWhitespace,
      "normalizeWhitespace",
      DEFAULT_OPTIONS.normalizeWhitespace
    ),
    normalizeQuotes: normalizeFlag(
      normalizeQuotes,
      "normalizeQuotes",
      DEFAULT_OPTIONS.normalizeQuotes
    ),
  };
}

export function cleanAiWatermarks(options = {}) {
  const { text, normalizeWhitespace, normalizeQuotes } = normalizeWatermarkInput(options);

  const { cleaned, stats } = removeAiWatermarks(text, { normalizeWhitespace, normalizeQuotes });

  return {
    cleaned,
    stats,
    options: { normalizeWhitespace, normalizeQuotes },
    removedChars: stats.originalChars - stats.cleanedChars,
  };
}
