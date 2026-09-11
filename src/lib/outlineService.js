/**
 * Shared Outline Creator business logic.
 *
 * Used by BOTH the /content/outline page (browser) and the
 * POST /api/content/outline endpoint (server) so the two can never drift.
 *
 * Browser callers rely on the default fetcher (proxy chain in fetchAndParse.js)
 * and on /api/deepseek for the AI step. Server callers inject `fetchHtml` and
 * pass the resolved DeepSeek `apiKey` explicitly.
 */
import { extractOutlineFromUrls } from "./contentTools.js";
import { improveOutlineWithDeepSeek } from "./deepseekContent.js";
import { normalizeInputUrls } from "./urlInput.js";
import { safeAiReason } from "./contentInput.js";

export const MAX_OUTLINE_URLS = 20;
export const NO_HEADINGS_MESSAGE = "No headings were found on the supplied URL(s).";

/**
 * Normalize and validate the URL list the Outline Creator accepts.
 * Mirrors the page: bare domains are allowed and upgraded to https://.
 * @param {string|string[]} value
 * @returns {string[]} de-duplicated absolute http(s) URLs
 */
export function normalizeOutlineUrls(value) {
  return normalizeInputUrls(value, { max: MAX_OUTLINE_URLS, field: "urls" });
}

/**
 * Coerce outline entries into the { tag, text } shape the UI and API both use.
 */
export function normalizeOutlineItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      tag: String(item?.tag || "h2").toLowerCase(),
      text: String(item?.text || "").trim(),
    }))
    .filter((item) => item.text && /^h[1-6]$/.test(item.tag));
}

/**
 * Run the full Outline Creator pipeline: extract competitor headings from the
 * supplied URLs, then combine/improve them with DeepSeek.
 *
 * Matches the page's degradation behaviour: if the AI step fails the extracted
 * headings are still returned, with the reason reported on `ai`.
 *
 * @param {object} options
 * @param {string|string[]} options.urls
 * @param {string} [options.apiKey] resolved DeepSeek key (server-side only)
 * @param {(url: string) => Promise<string>} [options.fetchHtml] HTML fetcher override
 */
export async function generateContentOutline({ urls, apiKey, fetchHtml } = {}) {
  const normalizedUrls = normalizeOutlineUrls(urls);
  const extracted = await extractOutlineFromUrls(normalizedUrls, { fetchHtml });
  const extractedOutline = normalizeOutlineItems(extracted);

  if (!extractedOutline.length) {
    return {
      urls: normalizedUrls,
      outline: [],
      headingCount: 0,
      extractedCount: 0,
      message: NO_HEADINGS_MESSAGE,
      ai: { applied: false, reason: NO_HEADINGS_MESSAGE },
    };
  }

  let outline = extractedOutline;
  let ai = { applied: true, reason: "" };

  try {
    const improved = await improveOutlineWithDeepSeek({
      urls: normalizedUrls,
      outline: extractedOutline,
      apiKey,
    });
    const normalizedImproved = normalizeOutlineItems(improved);
    if (normalizedImproved.length) {
      outline = normalizedImproved;
    } else {
      ai = { applied: false, reason: "DeepSeek returned no usable outline." };
    }
  } catch (error) {
    ai = {
      applied: false,
      reason: safeAiReason(
        error,
        "DeepSeek could not improve the outline. Showing extracted headings."
      ),
    };
  }

  return {
    urls: normalizedUrls,
    outline,
    headingCount: outline.length,
    extractedCount: extractedOutline.length,
    ai,
  };
}
