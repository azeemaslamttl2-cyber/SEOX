import { getSessionToken } from './authSession.js';

/**
 * Google OAuth configuration for the browser.
 *
 * The client id, client secret and redirect URIs live in `admin_settings`.
 * Only the non-sensitive values are exposed, through `/api/settings/public`;
 * the client secret never reaches the browser. The Search Console
 * authorisation URL is always built by the server so the browser never needs
 * the client id at all.
 */
const PUBLIC_SETTINGS_ENDPOINT = "/api/settings/public";

export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

let publicSettingsPromise = null;
let publicSettingsCache = null;

/**
 * Fetches the public OAuth settings once per page load. Concurrent callers
 * share the same request.
 */
export function loadGooglePublicSettings() {
  if (publicSettingsCache) return Promise.resolve(publicSettingsCache);
  if (publicSettingsPromise) return publicSettingsPromise;

  publicSettingsPromise = fetch(PUBLIC_SETTINGS_ENDPOINT, { headers: { Accept: "application/json" } })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Settings API returned HTTP ${response.status}`);
      const payload = await response.json();
      publicSettingsCache = {
        googleClientId: payload.googleClientId || "",
        googleGscRedirectUri: payload.googleGscRedirectUri || "",
        googleAuthRedirectUri: payload.googleAuthRedirectUri || "",
        googleGbpRedirectUri: payload.googleGbpRedirectUri || "",
      };
      return publicSettingsCache;
    })
    .catch(() => {
      // A settings outage must not break the runtime-origin redirect fallback.
      publicSettingsCache = {
        googleClientId: "",
        googleGscRedirectUri: "",
        googleAuthRedirectUri: "",
        googleGbpRedirectUri: "",
      };
      return publicSettingsCache;
    })
    .finally(() => {
      publicSettingsPromise = null;
    });

  return publicSettingsPromise;
}

/** Clears the cached copy, e.g. after an administrator saves new settings. */
export function clearGooglePublicSettingsCache() {
  publicSettingsCache = null;
  publicSettingsPromise = null;
}

// Warm the cache as soon as the module loads so the synchronous accessor below
// has a configured value available for the common case.
if (typeof window !== "undefined") {
  loadGooglePublicSettings();
}

function runtimeRedirectUri() {
  return `${window.location.origin}/gsc/oauth-callback`;
}

function isLocalhost() {
  const hostname = window.location.hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/**
 * Search Console redirect URI.
 *
 * Localhost always uses the runtime origin, matching the previous behaviour;
 * elsewhere the configured value wins when one is set.
 */
export async function resolveGoogleRedirectUri() {
  if (isLocalhost()) return runtimeRedirectUri();
  const settings = await loadGooglePublicSettings();
  return settings.googleGscRedirectUri || runtimeRedirectUri();
}

/**
 * Synchronous redirect URI, for the OAuth callback page which must resolve the
 * value it was originally redirected with. Uses the cached settings when they
 * are already loaded and otherwise falls back to the runtime origin.
 */
export function getGoogleRedirectUri() {
  if (isLocalhost()) return runtimeRedirectUri();
  return publicSettingsCache?.googleGscRedirectUri || runtimeRedirectUri();
}

function encodeState(payload) {
  return btoa(JSON.stringify(payload || {}));
}

export function parseGscOAuthState(rawState) {
  if (!rawState) return {};

  try {
    return JSON.parse(atob(rawState));
  } catch {
    return { returnTo: "/keywords/new" };
  }
}

/**
 * Builds the Search Console authorisation URL on the server, which reads the
 * client id from `admin_settings`.
 */
export async function getGscAuthUrl(payload = {}) {
  const redirectUri = await resolveGoogleRedirectUri();

  const headers = new Headers({ "Content-Type": "application/json" });
  const token = getSessionToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch("/api/gsc-token", {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "auth-url",
      redirectUri,
      returnTo: payload.returnTo || "/gsc",
      source: payload.source || "gsc-insights",
      projectId: payload.projectId || null,
    }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.authUrl) {
    throw new Error(
      data?.error ||
        "Google OAuth is not configured. Add the Google Client ID in Settings > General."
    );
  }

  return data.authUrl;
}

/**
 * Client-side URL builder, kept for callers that already hold the client id.
 * Prefer `getGscAuthUrl`, which never needs the client id in the browser.
 */
export async function createGscAuthUrl(payload = {}) {
  const settings = await loadGooglePublicSettings();
  if (!settings.googleClientId) {
    throw new Error("Google OAuth is not configured. Add the Google Client ID in Settings > General.");
  }

  const params = new URLSearchParams({
    client_id: settings.googleClientId,
    redirect_uri: await resolveGoogleRedirectUri(),
    response_type: "code",
    scope: `${GSC_SCOPE} https://www.googleapis.com/auth/userinfo.email`,
    access_type: "offline",
    prompt: "consent",
    state: encodeState(payload),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
