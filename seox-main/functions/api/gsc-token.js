import {
  deleteFirestoreDocument,
  getFirestoreDocument,
  patchFirestoreDocument,
  verifyFirebaseIdToken,
} from "../_lib/firebase-rest.js";
import {
  corsHeaders,
  emptyResponse,
  errorResponse,
  jsonResponse,
  readJson,
} from "../_lib/http.js";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function gscTokenCollection(userId) {
  return `users/${userId}/gscConnection`;
}

function cleanFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  );
}

function getOAuthConfig(env) {
  return {
    clientId: env.GOOGLE_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  };
}

function encodeState(payload) {
  const json = JSON.stringify(payload || {});
  if (typeof btoa === "function") return btoa(json);
  return Buffer.from(json, "utf8").toString("base64");
}

function createServerGscAuthUrl({ clientId, redirectUri, returnTo, source }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: `${GSC_SCOPE} https://www.googleapis.com/auth/userinfo.email`,
    access_type: "offline",
    prompt: "consent",
    state: encodeState({ source: source || "gsc-insights", returnTo: returnTo || "/gsc" }),
  });

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

async function fetchGoogleEmail(accessToken) {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return data.email || null;
}

async function refreshStoredTokens(env, userId, storedTokens) {
  if (!storedTokens?.refreshToken) {
    return jsonResponse(
      { error: "No refresh token available. Please reconnect Search Console." },
      400,
      corsHeaders("POST, OPTIONS")
    );
  }

  const { clientId, clientSecret } = getOAuthConfig(env);
  const refreshResponse = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: storedTokens.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  const data = await refreshResponse.json().catch(() => ({}));

  if (!refreshResponse.ok || !data.access_token) {
    await deleteFirestoreDocument(env, gscTokenCollection(userId), "tokens");
    return jsonResponse(
      {
        error: "Token refresh failed. Please reconnect Search Console.",
        details: data,
      },
      400,
      corsHeaders("POST, OPTIONS")
    );
  }

  const expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  const googleEmail = storedTokens.googleEmail || (await fetchGoogleEmail(data.access_token));

  await patchFirestoreDocument(env, gscTokenCollection(userId), "tokens", {
    ...storedTokens,
    accessToken: data.access_token,
    expiresAt,
    googleEmail,
    updatedAt: new Date().toISOString(),
  });

  return jsonResponse(
    {
      success: true,
      connected: true,
      accessToken: data.access_token,
      expiresAt,
      googleEmail,
    },
    200,
    corsHeaders("POST, OPTIONS")
  );
}

export async function onRequest({ request, env }) {
  const headers = {
    ...corsHeaders("POST, OPTIONS"),
    "Cache-Control": "no-store",
  };

  if (request.method === "OPTIONS") return emptyResponse(204, headers);
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  }

  try {
    const decoded = await verifyFirebaseIdToken(request, env);
    const body = await readJson(request);
    const { action, code, userId, redirectUri, returnTo, source } = body;
    const scopedUserId = decoded.uid;
    const { clientId, clientSecret } = getOAuthConfig(env);

    if (!clientId || (action !== "auth-url" && !clientSecret)) {
      return jsonResponse(
        { error: "Google OAuth credentials are not configured" },
        500,
        headers
      );
    }

    if (action === "auth-url") {
      if (!redirectUri) {
        return jsonResponse({ error: "Missing redirect URI" }, 400, headers);
      }

      return jsonResponse(
        {
          success: true,
          authUrl: createServerGscAuthUrl({
            clientId,
            redirectUri,
            returnTo,
            source,
          }),
        },
        200,
        headers
      );
    }

    if (action === "exchange") {
      if (!code || !redirectUri) {
        return jsonResponse({ error: "Missing required parameters" }, 400, headers);
      }
      if (userId && userId !== scopedUserId) {
        return jsonResponse({ error: "Cannot connect Search Console for another user" }, 403, headers);
      }

      const tokenResponse = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !tokens.access_token) {
        return jsonResponse(
          { error: "Token exchange failed", details: tokens },
          400,
          headers
        );
      }

      const previous = await getFirestoreDocument(
        env,
        gscTokenCollection(scopedUserId),
        "tokens"
      );
      const expiresAt = Date.now() + Number(tokens.expires_in || 3600) * 1000;
      const googleEmail = await fetchGoogleEmail(tokens.access_token);

      await patchFirestoreDocument(
        env,
        gscTokenCollection(scopedUserId),
        "tokens",
        cleanFields({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || previous?.refreshToken || null,
          expiresAt,
          googleEmail: googleEmail || previous?.googleEmail || null,
          updatedAt: new Date().toISOString(),
        })
      );

      return jsonResponse(
        {
          success: true,
          connected: true,
          accessToken: tokens.access_token,
          expiresAt,
          googleEmail: googleEmail || previous?.googleEmail || null,
        },
        200,
        headers
      );
    }

    if (action === "get") {
      if (userId && userId !== scopedUserId) {
        return jsonResponse({ error: "Cannot read Search Console tokens for another user" }, 403, headers);
      }

      const storedTokens = await getFirestoreDocument(
        env,
        gscTokenCollection(scopedUserId),
        "tokens"
      );

      if (!storedTokens?.accessToken) {
        return jsonResponse({ connected: false }, 200, headers);
      }

      if (Number(storedTokens.expiresAt || 0) <= Date.now() + 120000) {
        return refreshStoredTokens(env, scopedUserId, storedTokens);
      }

      return jsonResponse(
        {
          connected: true,
          accessToken: storedTokens.accessToken,
          expiresAt: storedTokens.expiresAt,
          googleEmail: storedTokens.googleEmail || null,
        },
        200,
        headers
      );
    }

    if (action === "refresh") {
      if (userId && userId !== scopedUserId) {
        return jsonResponse({ error: "Cannot refresh Search Console tokens for another user" }, 403, headers);
      }

      const storedTokens = await getFirestoreDocument(
        env,
        gscTokenCollection(scopedUserId),
        "tokens"
      );
      return refreshStoredTokens(env, scopedUserId, storedTokens);
    }

    if (action === "disconnect") {
      if (userId && userId !== scopedUserId) {
        return jsonResponse({ error: "Cannot disconnect Search Console for another user" }, 403, headers);
      }
      await deleteFirestoreDocument(env, gscTokenCollection(scopedUserId), "tokens");
      return jsonResponse({ success: true }, 200, headers);
    }

    return jsonResponse({ error: "Invalid action" }, 400, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
