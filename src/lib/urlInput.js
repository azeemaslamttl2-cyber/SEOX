/**
 * Shared URL list validation for the content tool services.
 *
 * Mirrors what the content tool pages accept: bare domains are allowed and
 * upgraded to https://, values are trimmed and de-duplicated, and anything that
 * is not an http(s) URL is rejected.
 */

export const DEFAULT_MAX_URLS = 20;

function validationError(message, field) {
  const error = new Error(message);
  error.status = 400;
  error.field = field;
  return error;
}

/**
 * @param {string|string[]} value raw urls from a request body
 * @param {object} [options]
 * @param {number} [options.max] maximum number of URLs accepted
 * @param {string} [options.field] field name reported on validation errors
 * @returns {string[]} absolute, de-duplicated http(s) URLs
 */
export function normalizeInputUrls(value, { max = DEFAULT_MAX_URLS, field = "urls" } = {}) {
  if (value === undefined || value === null) {
    throw validationError(`${field} is required.`, field);
  }

  const raw = Array.isArray(value) ? value : [value];

  if (raw.some((item) => item !== null && item !== undefined && typeof item !== "string")) {
    throw validationError(`${field} must be a string or an array of strings.`, field);
  }

  const candidates = raw.map((item) => String(item ?? "").trim()).filter(Boolean);

  if (!candidates.length) {
    throw validationError("At least one valid URL is required.", field);
  }

  const seen = new Set();
  const normalized = [];

  for (const candidate of candidates) {
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(candidate) ? candidate : `https://${candidate}`;

    let parsed;
    try {
      parsed = new URL(withScheme);
    } catch {
      throw validationError(`Invalid URL: ${candidate}`, field);
    }

    if (!/^https?:$/i.test(parsed.protocol)) {
      throw validationError(`Only HTTP and HTTPS URLs are allowed: ${candidate}`, field);
    }

    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      throw validationError(`Invalid URL: ${candidate}`, field);
    }

    const key = parsed.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }

  if (!normalized.length) {
    throw validationError("At least one valid URL is required.", field);
  }

  if (normalized.length > max) {
    throw validationError(`A maximum of ${max} URLs is allowed per request.`, field);
  }

  return normalized;
}
