import { getAdminSetting } from "./app-settings.js";
import { googleFetch } from "./google-fetch.js";
import { checkUrl, prepareUrls, MAX_URL_LENGTH } from "../../src/lib/indexingUrls.js";

export { checkUrl, prepareUrls, MAX_URL_LENGTH };

// Google Indexing API client. Server-side only: the service-account key is read
// from admin_settings (env fallback GOOGLE_INDEXING_SERVICE_ACCOUNT_KEY) and is
// never returned to a caller. A successful publish means Google ACCEPTED the
// notification - it is not a statement that the URL is indexed.

export const INDEXING_SCOPE = "https://www.googleapis.com/auth/indexing";
export const PUBLISH_ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const EXPIRY_SKEW_MS = 120000;
export const NOTIFICATION_TYPES = ["URL_UPDATED", "URL_DELETED"];

function fail(code, message, status = 400, extra = {}) {
  return Object.assign(new Error(message), { code, status, ...extra });
}

function b64url(bytes) {
  let binary = "";
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const textBytes = (text) => new TextEncoder().encode(text);

function pemToDer(pem) {
  const body = String(pem).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const binary = atob(body);
  const der = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) der[i] = binary.charCodeAt(i);
  return der;
}

/** Parses the stored service-account JSON. Throws a human-readable config error. */
export function parseServiceAccount(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    throw fail(
      "NOT_CONFIGURED",
      "The Google Indexing API service account is not configured. An administrator must add it under Settings (Google Indexing API service account JSON).",
      503
    );
  }
  let account;
  try {
    account = JSON.parse(text);
  } catch {
    throw fail("BAD_CONFIG", "The configured Google Indexing API service account is not valid JSON.", 503);
  }
  if (!account?.client_email || !account?.private_key) {
    throw fail("BAD_CONFIG", "The configured service account JSON is missing client_email or private_key.", 503);
  }
  return account;
}

let tokenCache = { key: "", token: "", expiresAt: 0 };

/** Test hook. */
export function resetIndexingTokenCache() {
  tokenCache = { key: "", token: "", expiresAt: 0 };
}

async function signAssertion(account) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(textBytes(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = b64url(
    textBytes(
      JSON.stringify({
        iss: account.client_email,
        scope: INDEXING_SCOPE,
        aud: account.token_uri || DEFAULT_TOKEN_URI,
        iat: now,
        exp: now + 3600,
      })
    )
  );
  let key;
  try {
    key = await crypto.subtle.importKey(
      "pkcs8",
      pemToDer(account.private_key),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );
  } catch {
    throw fail("BAD_CONFIG", "The service account private_key could not be read. Re-paste the full JSON key file.", 503);
  }
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, textBytes(`${header}.${claims}`));
  return `${header}.${claims}.${b64url(signature)}`;
}

/** Exchanges a signed service-account assertion for an access token (cached). */
export async function getIndexingAccessToken(env = process.env) {
  const account = parseServiceAccount(await getAdminSetting("google_indexing_service_account", env));
  if (tokenCache.key === account.private_key_id && tokenCache.token && tokenCache.expiresAt > Date.now() + EXPIRY_SKEW_MS) {
    return { token: tokenCache.token, clientEmail: account.client_email };
  }

  const assertion = await signAssertion(account);
  const response = await googleFetch(
    account.token_uri || DEFAULT_TOKEN_URI,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    },
    { label: "Google OAuth service-account token" }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    const reason = data.error_description || data.error || `HTTP ${response.status}`;
    throw fail(
      "AUTH_FAILED",
      `Google rejected the service account credentials (${reason}). Check that the key is current and not disabled or deleted.`,
      502
    );
  }
  tokenCache = {
    key: account.private_key_id,
    token: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
  return { token: data.access_token, clientEmail: account.client_email };
}

/** Maps a Google API error response to a stable code and a human-readable message. */
export function classifyGoogleError(status, payload, { clientEmail = "", url = "" } = {}) {
  const google = payload?.error || {};
  const message = String(google.message || "").trim();
  const reason = String(google.details?.[0]?.reason || google.errors?.[0]?.reason || "").trim();
  const host = (() => {
    try {
      return new URL(url).origin;
    } catch {
      return "this site";
    }
  })();

  if (status === 429 || google.status === "RESOURCE_EXHAUSTED") {
    return {
      code: "QUOTA_EXCEEDED",
      retryable: false,
      stopBatch: true,
      message: `Google Indexing API quota or rate limit reached (${message || "429"}). The default is 200 publish requests per day and 600 per minute; try again later or request more quota in Google Cloud.`,
    };
  }
  if (status === 401 || google.status === "UNAUTHENTICATED") {
    return { code: "AUTH_FAILED", retryable: false, stopBatch: true, message: `Google rejected the service account credentials (${message || "401"}).` };
  }
  if (status === 403 && (reason === "SERVICE_DISABLED" || /has not been used|is disabled|not enabled/i.test(message))) {
    return {
      code: "API_DISABLED",
      retryable: false,
      stopBatch: true,
      message: `The Web Search Indexing API is not enabled for the service account's Google Cloud project. Enable it in Google Cloud Console, wait a few minutes, then retry. (${message})`,
    };
  }
  if (status === 403) {
    return {
      code: "PERMISSION_DENIED",
      retryable: false,
      stopBatch: false,
      message: `Permission denied for ${host}. Add ${clientEmail || "the service account"} as an Owner of this site in Google Search Console, then retry. (${message || "403"})`,
    };
  }
  if (status === 400) {
    return { code: "INVALID_REQUEST", retryable: false, stopBatch: false, message: `Google rejected the request as invalid (${message || "400"}).` };
  }
  if (status >= 500) {
    return { code: "GOOGLE_UNAVAILABLE", retryable: true, stopBatch: false, message: `Google Indexing API is temporarily unavailable (HTTP ${status}). Try again shortly.` };
  }
  return { code: "GOOGLE_ERROR", retryable: false, stopBatch: false, message: `Google Indexing API returned HTTP ${status}${message ? `: ${message}` : ""}.` };
}

/**
 * Publishes one URL notification. Always resolves with a result object; only
 * configuration/network problems for the whole batch are reported via `fatal`.
 */
export async function publishUrl({ url, type = "URL_UPDATED", token, clientEmail }) {
  if (!NOTIFICATION_TYPES.includes(type)) throw fail("INVALID_REQUEST", "Unknown notification type.", 400);
  let response;
  try {
    response = await googleFetch(
      PUBLISH_ENDPOINT,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, type }),
      },
      { label: "Google Indexing API", retries: 1 }
    );
  } catch (error) {
    return { ok: false, code: "NETWORK", message: error?.message || "Could not reach the Google Indexing API.", stopBatch: false };
  }
  const payload = await response.json().catch(() => null);
  if (response.ok) {
    const meta = payload?.urlNotificationMetadata || {};
    const latest = meta.latestUpdate || meta.latestRemove || {};
    return {
      ok: true,
      code: "SUBMITTED",
      message: `Google accepted the ${type === "URL_DELETED" ? "removal" : "update"} notification. This does not mean the URL is indexed.`,
      notifyTime: latest.notifyTime || null,
      response: payload,
    };
  }
  const classified = classifyGoogleError(response.status, payload, { clientEmail, url });
  return { ok: false, ...classified, httpStatus: response.status, response: payload };
}
