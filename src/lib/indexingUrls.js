// URL validation shared by the Backlink Indexer page and its API.

export const MAX_URL_LENGTH = 2048;

/** Validates one URL for submission. Returns { ok, url, reason }. */
export function checkUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return { ok: false, url: value, reason: "Empty URL." };
  if (value.length > MAX_URL_LENGTH) return { ok: false, url: value, reason: `URL is longer than ${MAX_URL_LENGTH} characters.` };
  if (/\s/.test(value)) return { ok: false, url: value, reason: "URL contains whitespace." };
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, url: value, reason: "Not a valid URL. Include the scheme, e.g. https://example.com/page." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, url: value, reason: "Only http:// and https:// URLs can be submitted." };
  }
  if (parsed.username || parsed.password) return { ok: false, url: value, reason: "URLs with credentials are not allowed." };
  if (!parsed.hostname.includes(".") || /^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname) || parsed.hostname === "localhost") {
    return { ok: false, url: value, reason: "Use a public domain name, not localhost or an IP address." };
  }
  parsed.hash = "";
  return { ok: true, url: parsed.href, host: parsed.hostname.toLowerCase() };
}

/**
 * Splits raw input into unique valid URLs and a list of rejected entries.
 * Accepts an array or newline-separated text; duplicates are removed.
 */
export function prepareUrls(input) {
  const list = Array.isArray(input) ? input : String(input ?? "").split(/\r?\n/);
  const valid = [];
  const invalid = [];
  const duplicates = [];
  const seen = new Set();
  for (const entry of list) {
    const text = String(entry ?? "").trim();
    if (!text) continue;
    const checked = checkUrl(text);
    if (!checked.ok) {
      invalid.push({ url: text, reason: checked.reason });
      continue;
    }
    if (seen.has(checked.url)) {
      duplicates.push(checked.url);
      continue;
    }
    seen.add(checked.url);
    valid.push({ url: checked.url, host: checked.host });
  }
  return { valid, invalid, duplicates };
}
