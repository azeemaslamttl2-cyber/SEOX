import { auth } from "./firebase.js";

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
export const GOOGLE_REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI || "";

export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export function getGoogleRedirectUri() {
  const runtimeRedirectUri = `${window.location.origin}/gsc/oauth-callback`;
  const hostname = window.location.hostname;
  const isLocalhost =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

  if (isLocalhost) return runtimeRedirectUri;
  if (GOOGLE_REDIRECT_URI) return GOOGLE_REDIRECT_URI;
  return runtimeRedirectUri;
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

export function createGscAuthUrl(payload = {}) {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Google OAuth client ID is not configured. Add VITE_GOOGLE_CLIENT_ID.");
  }

  const redirectUri = getGoogleRedirectUri();
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: `${GSC_SCOPE} https://www.googleapis.com/auth/userinfo.email`,
    access_type: "offline",
    prompt: "consent",
    state: encodeState(payload),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function getGscAuthUrl(payload = {}) {
  try {
    return createGscAuthUrl(payload);
  } catch (error) {
    if (!String(error?.message || "").includes("Google OAuth client ID")) {
      throw error;
    }
  }

  const headers = new Headers({ "Content-Type": "application/json" });
  if (auth.currentUser) {
    headers.set("Authorization", `Bearer ${await auth.currentUser.getIdToken()}`);
  }

  const response = await fetch("/api/gsc-token", {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "auth-url",
      redirectUri: getGoogleRedirectUri(),
      returnTo: payload.returnTo || "/gsc",
      source: payload.source || "gsc-insights",
    }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.authUrl) {
    throw new Error(
      data?.error ||
        "Google OAuth client ID is not configured. Add VITE_GOOGLE_CLIENT_ID or GOOGLE_CLIENT_ID."
    );
  }

  return data.authUrl;
}
