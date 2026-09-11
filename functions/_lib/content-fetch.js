import { fetchPublicHttpUrl } from "./url-security.js";

/**
 * Server-side HTML fetcher shared by the content tool APIs
 * (Outline Creator, Entities Extractor).
 *
 * The browser pages reach target pages through /api/proxy; this reproduces that
 * same behaviour in-process (same User-Agent, timeout, size cap and SSRF guard)
 * so the APIs process exactly what the pages would have seen.
 */

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 5_000_000;

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function fetchPageHtml(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetchPublicHttpUrl(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
        "Accept-Language": "en-US,en;q=0.5",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    });
  } catch (error) {
    if (Number.isInteger(error?.status) && error.status < 500) throw error;
    const failure = new Error(
      `Failed to fetch page content — website may be blocking requests (${url})`
    );
    failure.status = 502;
    throw failure;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const failure = new Error(`Failed to fetch page content (HTTP ${response.status}) — ${url}`);
    failure.status = 502;
    throw failure;
  }

  const text = await response.text();
  return text.slice(0, MAX_BODY_BYTES);
}

// Back-compat alias for the Outline Creator API.
export const fetchOutlineHtml = fetchPageHtml;

export default fetchPageHtml;
