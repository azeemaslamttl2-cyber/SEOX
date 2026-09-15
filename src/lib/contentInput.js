/**
 * Shared input validation and AI-fallback helpers for the content tool services.
 *
 * Several content tools follow the same two patterns:
 *   - a single required text/topic/word input, and
 *   - "try DeepSeek, fall back to the local generator", which every page does.
 *
 * Keeping both here stops each service from re-implementing them.
 */

export const DEFAULT_MAX_TEXT = 500_000;

export function validationError(message, field) {
  const error = new Error(message);
  error.status = 400;
  error.field = field;
  return error;
}

/**
 * Validate a required string field.
 * @param {unknown} value
 * @param {object} options
 * @param {string} options.field field name reported on errors
 * @param {number} [options.max] maximum length after trimming
 * @param {string} [options.label] human label, defaults to the field name
 */
export function normalizeRequiredText(value, { field, max = DEFAULT_MAX_TEXT, label } = {}) {
  const name = label || field;

  if (value === undefined || value === null) {
    throw validationError(`${name} is required.`, field);
  }
  if (typeof value !== "string") {
    throw validationError(`${name} is required and must be a string.`, field);
  }

  const text = value.trim();
  if (!text) throw validationError(`${name} is required.`, field);
  if (text.length > max) {
    throw validationError(`${name} must be ${max} characters or fewer.`, field);
  }

  return text;
}

export function normalizeOptionalBoolean(value, field) {
  if (value === undefined || value === null) return false;
  if (typeof value !== "boolean") {
    throw validationError(`${field} must be a boolean.`, field);
  }
  return value;
}

export const GENERIC_AI_FAILURE = "The AI request failed. Showing local fallback results.";

/**
 * Mark an error whose message is safe to show a caller: one we authored, or one
 * relayed from the AI provider's own error response.
 */
export function markSafeAiError(error) {
  if (error) error.safeMessage = true;
  return error;
}

/**
 * Pick a reason string that is safe to return to an API caller.
 *
 * Raw runtime errors (DNS/socket/driver failures) can carry hosts, ports and
 * credentials, so only deliberately-authored messages are surfaced; anything
 * else is reported generically.
 */
export function safeAiReason(error, fallback = GENERIC_AI_FAILURE) {
  if (error?.safeMessage || Number.isInteger(error?.status)) {
    return String(error.message || fallback);
  }
  return fallback;
}

/**
 * Run an AI generator with a local fallback, reproducing what the pages do:
 * show the AI result when it works, otherwise the local result plus the reason.
 *
 * @param {object} options
 * @param {() => Promise<any>} options.run the AI call
 * @param {() => any} options.fallback the local generator
 * @param {(value: any) => boolean} [options.isUsable] defaults to "non-empty"
 * @param {string} [options.emptyReason] reason used when the AI result is unusable
 * @returns {Promise<{ result: any, ai: { applied: boolean, reason: string } }>}
 */
export async function runWithAiFallback({ run, fallback, isUsable, emptyReason }) {
  const usable =
    typeof isUsable === "function"
      ? isUsable
      : (value) => {
          if (Array.isArray(value)) return value.length > 0;
          if (value && typeof value === "object") return Object.keys(value).length > 0;
          return Boolean(value);
        };

  try {
    const result = await run();
    if (usable(result)) {
      return { result, ai: { applied: true, reason: "" } };
    }
    return {
      result: fallback(),
      ai: { applied: false, reason: emptyReason || "DeepSeek returned no usable result." },
    };
  } catch (error) {
    return {
      result: fallback(),
      ai: { applied: false, reason: safeAiReason(error) },
    };
  }
}
