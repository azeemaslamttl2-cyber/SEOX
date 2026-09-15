/**
 * Shared Entities Extractor business logic.
 *
 * Used by BOTH the /content/entities-extractor page (browser) and the
 * POST /api/content/entities-extractor endpoint (server) so the two can never
 * drift. Extraction is fully local (no AI provider, no database) - it reuses
 * getSourceText() and extractEntitiesFromText() from contentTools.js, exactly
 * as the page does.
 *
 * Browser callers rely on the default fetcher (proxy chain in fetchAndParse.js);
 * server callers inject `fetchHtml`.
 */
import { extractEntitiesFromText, getSourceText } from "./contentTools.js";
import { normalizeInputUrls } from "./urlInput.js";

export const ENTITY_MODES = ["url", "text"];
export const MAX_ENTITY_URLS = 20;
export const MAX_TEXT_LENGTH = 500_000;
export const DEFAULT_ENTITY_LIMIT = 40;
export const MAX_ENTITY_LIMIT = 200;

function validationError(message, field) {
  const error = new Error(message);
  error.status = 400;
  error.field = field;
  return error;
}

function normalizeMode(value) {
  if (value === undefined || value === null || value === "") return "url";
  if (typeof value !== "string") {
    throw validationError("mode must be a string.", "mode");
  }
  const mode = value.trim().toLowerCase();
  if (!ENTITY_MODES.includes(mode)) {
    throw validationError(`mode must be one of: ${ENTITY_MODES.join(", ")}.`, "mode");
  }
  return mode;
}

function normalizeText(value) {
  if (typeof value !== "string") {
    throw validationError("content is required and must be a string.", "content");
  }
  const text = value.trim();
  if (!text) {
    throw validationError("content is required.", "content");
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw validationError(
      `content must be ${MAX_TEXT_LENGTH} characters or fewer.`,
      "content"
    );
  }
  return text;
}

function normalizeLimit(value) {
  if (value === undefined || value === null || value === "") return DEFAULT_ENTITY_LIMIT;
  const limit = Number(value);
  if (!Number.isInteger(limit)) {
    throw validationError("limit must be an integer.", "limit");
  }
  if (limit < 1 || limit > MAX_ENTITY_LIMIT) {
    throw validationError(`limit must be between 1 and ${MAX_ENTITY_LIMIT}.`, "limit");
  }
  return limit;
}

/**
 * Validate and normalize the Entities Extractor inputs.
 * `content` is the API-facing name for the page's free-text input; `text` is
 * accepted as an alias so both spellings work.
 */
export function normalizeEntitiesInput({ mode, content, text, url, urls, limit } = {}) {
  const normalizedMode = normalizeMode(mode);
  const normalizedLimit = normalizeLimit(limit);

  if (normalizedMode === "text") {
    const source = content !== undefined && content !== null ? content : text;
    return { mode: normalizedMode, text: normalizeText(source), urls: [], limit: normalizedLimit };
  }

  const rawUrls = urls !== undefined && urls !== null ? urls : url;
  return {
    mode: normalizedMode,
    text: "",
    urls: normalizeInputUrls(rawUrls, { max: MAX_ENTITY_URLS, field: "urls" }),
    limit: normalizedLimit,
  };
}

/**
 * Collapse whatever getSourceText() returns into the single string the page
 * feeds to extractEntitiesFromText().
 *
 * getSourceText returns a plain string for a single URL and an array of page
 * records for multiple URLs, so this mirrors the page's own join.
 */
function joinSource(source) {
  if (Array.isArray(source)) {
    return source.map((item) => item?.text || "").join(" ");
  }
  return String(source || "");
}

/**
 * Run the full Entities Extractor pipeline.
 *
 * @param {object} options
 * @param {"url"|"text"} [options.mode] defaults to "url", like the page
 * @param {string} [options.content] free text (mode "text")
 * @param {string} [options.text] alias for content
 * @param {string|string[]} [options.urls] target URLs (mode "url")
 * @param {string} [options.url] single target URL (mode "url")
 * @param {number} [options.limit] max entities returned, default 40 (page behaviour)
 * @param {(url: string) => Promise<string>} [options.fetchHtml] HTML fetcher override
 */
export async function extractContentEntities(options = {}) {
  const { mode, text, urls, limit } = normalizeEntitiesInput(options);

  const source = await getSourceText({
    mode,
    text,
    urls,
    fetchHtml: options.fetchHtml,
  });

  const joined = joinSource(source);
  const entities = extractEntitiesFromText(joined, limit) || [];

  const types = Array.from(new Set(entities.map((item) => item.type)));
  const averageSalience = entities.length
    ? Math.round(
        (entities.reduce((acc, item) => acc + (item.salience || 0), 0) / entities.length) * 100
      )
    : 0;

  return {
    mode,
    urls,
    limit,
    characters: joined.length,
    entities,
    entityCount: entities.length,
    types,
    averageSalience,
  };
}
