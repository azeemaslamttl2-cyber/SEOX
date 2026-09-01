// vite.config.js
import { defineConfig, loadEnv } from "file:///C:/Users/aleem/OneDrive/Documents/GitHub/seox/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/aleem/OneDrive/Documents/GitHub/seox/node_modules/@vitejs/plugin-react/dist/index.js";
import fs from "node:fs";

// functions/_lib/http.js
function corsHeaders(methods = "GET, POST, OPTIONS") {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}
function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}
function emptyResponse(status = 204, headers = {}) {
  return new Response(null, { status, headers });
}
async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
function errorResponse(error, headers = {}) {
  if ((error?.status || 500) >= 500) console.error(error);
  return jsonResponse(
    { error: error?.message || "Internal server error" },
    error?.status || 500,
    headers
  );
}

// functions/api/autocomplete.js
function parseGoogleSuggestions(value) {
  try {
    const data = JSON.parse(value);
    if (!Array.isArray(data) || !Array.isArray(data[1])) return [];
    return data[1].map((item) => {
      if (typeof item === "string") return item;
      if (Array.isArray(item) && typeof item[0] === "string") return item[0];
      return "";
    }).filter(Boolean);
  } catch {
    return [];
  }
}
async function onRequest({ request }) {
  const headers = {
    ...corsHeaders("GET, OPTIONS"),
    "Cache-Control": "no-store"
  };
  if (request.method === "OPTIONS") return emptyResponse(204, headers);
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  }
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  const hl = url.searchParams.get("hl") || "en";
  const gl = url.searchParams.get("gl") || "US";
  if (!query) {
    return jsonResponse({ error: 'Query parameter "q" is required' }, 400, headers);
  }
  try {
    const params = new URLSearchParams({
      q: query,
      hl,
      gl,
      client: "chrome",
      xhr: "t"
    });
    const response = await fetch(`https://www.google.com/complete/search?${params}`, {
      headers: {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": `${hl},en;q=0.8`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!response.ok) {
      return jsonResponse(
        { error: `Google autocomplete returned HTTP ${response.status}` },
        502,
        headers
      );
    }
    const text = await response.text();
    return jsonResponse(
      {
        query,
        hl,
        gl,
        suggestions: parseGoogleSuggestions(text)
      },
      200,
      headers
    );
  } catch (error) {
    return errorResponse(error, headers);
  }
}

// functions/_lib/firebase-rest.js
import {
  decodeProtectedHeader,
  importPKCS8,
  importX509,
  jwtVerify,
  SignJWT
} from "file:///C:/Users/aleem/OneDrive/Documents/GitHub/seox/node_modules/jose/dist/webapi/index.js";
var GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
var FIREBASE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
var GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/datastore",
  "https://www.googleapis.com/auth/identitytoolkit"
];
var DEFAULT_FIREBASE_PROJECT_ID = "codestap-9a0b2";
var accessTokenCache = null;
var certificateCache = null;
function configurationError(message) {
  const error = new Error(message);
  error.status = 500;
  return error;
}
function parseServiceAccount(env) {
  let account = {};
  if (env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } catch {
      throw configurationError("FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON");
    }
  }
  const projectId = account.project_id || account.projectId || env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT || DEFAULT_FIREBASE_PROJECT_ID;
  const clientEmail = account.client_email || account.clientEmail || env.FIREBASE_CLIENT_EMAIL;
  const privateKey = account.private_key || account.privateKey || env.FIREBASE_PRIVATE_KEY;
  return {
    projectId,
    clientEmail,
    privateKey: privateKey?.replace(/\\n/g, "\n")
  };
}
function getFirebaseProjectId(env) {
  const { projectId } = parseServiceAccount(env);
  if (!projectId) {
    throw configurationError("Firebase project id is not configured");
  }
  return projectId;
}
function getServiceAccount(env) {
  const account = parseServiceAccount(env);
  if (!account.projectId || !account.clientEmail || !account.privateKey) {
    throw configurationError("Firebase service account credentials are not configured");
  }
  return account;
}
function getBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}
function parseMaxAge(value) {
  const match = String(value || "").match(/max-age=(\d+)/i);
  return match ? Number(match[1]) : 3600;
}
async function getFirebaseCertificates() {
  const now = Date.now();
  if (certificateCache?.expiresAt > now) return certificateCache.certificates;
  const response = await fetch(FIREBASE_CERTS_URL);
  if (!response.ok) {
    const error = new Error("Could not load Firebase token verification keys");
    error.status = 502;
    throw error;
  }
  const certificates = await response.json();
  certificateCache = {
    certificates,
    expiresAt: now + parseMaxAge(response.headers.get("cache-control")) * 1e3
  };
  return certificates;
}
async function verifyFirebaseIdToken(request, env) {
  const token = getBearerToken(request);
  if (!token) {
    const error = new Error("Missing Firebase auth token");
    error.status = 401;
    throw error;
  }
  const projectId = getFirebaseProjectId(env);
  let protectedHeader;
  try {
    protectedHeader = decodeProtectedHeader(token);
  } catch {
    const error = new Error("Invalid Firebase auth token");
    error.status = 401;
    throw error;
  }
  const { alg, kid } = protectedHeader;
  if (alg !== "RS256" || !kid) {
    const error = new Error("Invalid Firebase auth token");
    error.status = 401;
    throw error;
  }
  const certificates = await getFirebaseCertificates();
  const certificate = certificates[kid];
  if (!certificate) {
    certificateCache = null;
    const error = new Error("Firebase auth token uses an unknown signing key");
    error.status = 401;
    throw error;
  }
  try {
    const key = await importX509(certificate, "RS256");
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["RS256"],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`
    });
    const now = Math.floor(Date.now() / 1e3);
    if (!payload.sub || payload.sub.length > 128 || Number(payload.auth_time) > now) {
      throw new Error("Invalid Firebase auth token claims");
    }
    return {
      ...payload,
      uid: payload.sub
    };
  } catch (cause) {
    const error = new Error("Invalid or expired Firebase auth token");
    error.status = 401;
    error.cause = cause;
    throw error;
  }
}
async function createGoogleAccessToken(env) {
  const account = getServiceAccount(env);
  const now = Math.floor(Date.now() / 1e3);
  const privateKey = await importPKCS8(account.privateKey, "RS256");
  const assertion = await new SignJWT({
    scope: GOOGLE_SCOPES.join(" ")
  }).setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuer(account.clientEmail).setAudience(GOOGLE_TOKEN_URL).setIssuedAt(now).setExpirationTime(now + 3600).sign(privateKey);
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    const error = new Error(
      data.error_description || data.error || "Could not authenticate Firebase service account"
    );
    error.status = 502;
    throw error;
  }
  accessTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in || 3600) - 60) * 1e3,
    clientEmail: account.clientEmail
  };
  return accessTokenCache.token;
}
async function getGoogleAccessToken(env) {
  const account = getServiceAccount(env);
  if (accessTokenCache?.expiresAt > Date.now() && accessTokenCache.clientEmail === account.clientEmail) {
    return accessTokenCache.token;
  }
  return createGoogleAccessToken(env);
}
async function googleRequest(env, url, options = {}, retry = true) {
  const token = await getGoogleAccessToken(env);
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.body ? { "Content-Type": "application/json" } : {},
      ...options.headers || {}
    }
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && retry) {
    accessTokenCache = null;
    return googleRequest(env, url, options, false);
  }
  if (!response.ok) {
    const error = new Error(
      data.error?.message || data.error_description || "Firebase API request failed"
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
function firestoreBaseUrl(env) {
  const projectId = getFirebaseProjectId(env);
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents`;
}
function encodeDocumentPath(path) {
  return String(path).split("/").map((part) => encodeURIComponent(part)).join("/");
}
function decodeFirestoreValue(value = {}) {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("referenceValue" in value) return value.referenceValue;
  if ("bytesValue" in value) return value.bytesValue;
  if ("geoPointValue" in value) return value.geoPointValue;
  if ("arrayValue" in value) {
    return (value.arrayValue.values || []).map(decodeFirestoreValue);
  }
  if ("mapValue" in value) {
    return decodeFirestoreFields(value.mapValue.fields || {});
  }
  return void 0;
}
function decodeFirestoreFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)])
  );
}
function decodeFirestoreDocument(document) {
  const nameParts = String(document.name || "").split("/");
  return {
    id: nameParts[nameParts.length - 1] || "",
    ...decodeFirestoreFields(document.fields || {})
  };
}
async function getFirestoreDocument(env, collection, documentId) {
  try {
    const data = await googleRequest(
      env,
      `${firestoreBaseUrl(env)}/${encodeDocumentPath(
        `${collection}/${documentId}`
      )}`
    );
    return decodeFirestoreDocument(data);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}
async function deleteFirestoreDocument(env, collection, documentId) {
  try {
    await googleRequest(
      env,
      `${firestoreBaseUrl(env)}/${encodeDocumentPath(
        `${collection}/${documentId}`
      )}`,
      { method: "DELETE" }
    );
    return true;
  } catch (error) {
    if (error.status === 404) return false;
    throw error;
  }
}
function encodeFirestoreValue(value) {
  if (value?.__firestoreType === "timestamp") {
    return { timestampValue: value.value };
  }
  if (value === null || value === void 0) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeFirestoreValue) } };
  }
  if (typeof value === "object") {
    return { mapValue: { fields: encodeFirestoreFields(value) } };
  }
  return { stringValue: String(value) };
}
function encodeFirestoreFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, encodeFirestoreValue(value)])
  );
}
async function patchFirestoreDocument(env, collection, documentId, fields) {
  const url = new URL(
    `${firestoreBaseUrl(env)}/${encodeDocumentPath(`${collection}/${documentId}`)}`
  );
  for (const field of Object.keys(fields)) {
    url.searchParams.append("updateMask.fieldPaths", field);
  }
  const data = await googleRequest(env, url.toString(), {
    method: "PATCH",
    body: JSON.stringify({ fields: encodeFirestoreFields(fields) })
  });
  return decodeFirestoreDocument(data);
}

// functions/api/gsc-token.js
var TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
var USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";
var GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
var GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
function gscTokenCollection(userId) {
  return `users/${userId}/gscConnection`;
}
function cleanFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== void 0)
  );
}
function getOAuthConfig(env) {
  return {
    clientId: env.GOOGLE_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET
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
    state: encodeState({ source: source || "gsc-insights", returnTo: returnTo || "/gsc" })
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}
async function fetchGoogleEmail(accessToken) {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` }
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
      grant_type: "refresh_token"
    })
  });
  const data = await refreshResponse.json().catch(() => ({}));
  if (!refreshResponse.ok || !data.access_token) {
    await deleteFirestoreDocument(env, gscTokenCollection(userId), "tokens");
    return jsonResponse(
      {
        error: "Token refresh failed. Please reconnect Search Console.",
        details: data
      },
      400,
      corsHeaders("POST, OPTIONS")
    );
  }
  const expiresAt = Date.now() + Number(data.expires_in || 3600) * 1e3;
  const googleEmail = storedTokens.googleEmail || await fetchGoogleEmail(data.access_token);
  await patchFirestoreDocument(env, gscTokenCollection(userId), "tokens", {
    ...storedTokens,
    accessToken: data.access_token,
    expiresAt,
    googleEmail,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  return jsonResponse(
    {
      success: true,
      connected: true,
      accessToken: data.access_token,
      expiresAt,
      googleEmail
    },
    200,
    corsHeaders("POST, OPTIONS")
  );
}
async function onRequest2({ request, env }) {
  const headers = {
    ...corsHeaders("POST, OPTIONS"),
    "Cache-Control": "no-store"
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
    if (!clientId || action !== "auth-url" && !clientSecret) {
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
            source
          })
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
          grant_type: "authorization_code"
        })
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
      const expiresAt = Date.now() + Number(tokens.expires_in || 3600) * 1e3;
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
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        })
      );
      return jsonResponse(
        {
          success: true,
          connected: true,
          accessToken: tokens.access_token,
          expiresAt,
          googleEmail: googleEmail || previous?.googleEmail || null
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
      if (Number(storedTokens.expiresAt || 0) <= Date.now() + 12e4) {
        return refreshStoredTokens(env, scopedUserId, storedTokens);
      }
      return jsonResponse(
        {
          connected: true,
          accessToken: storedTokens.accessToken,
          expiresAt: storedTokens.expiresAt,
          googleEmail: storedTokens.googleEmail || null
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

// functions/_lib/request-auth.js
function authHeadersFromNodeRequest(req) {
  const headers = new Headers();
  const authorization = req?.headers?.authorization || req?.headers?.Authorization;
  if (authorization) headers.set("authorization", authorization);
  return headers;
}
async function requireFirebaseAuthFromNodeRequest(req, env = process.env) {
  return verifyFirebaseIdToken(
    new Request("https://seox.local/auth", {
      headers: authHeadersFromNodeRequest(req)
    }),
    env
  );
}

// functions/_lib/url-security.js
var DEFAULT_MAX_REDIRECTS = 5;
var BLOCKED_HOSTS = /* @__PURE__ */ new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal"
]);
function makeHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}
function normalizeHostname(hostname = "") {
  return String(hostname).trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}
function parseIpv4(hostname) {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part < 0 || part > 255)) return null;
  return parts;
}
function isPrivateIpv4(parts) {
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a === 100 && b >= 64 && b <= 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 192 && b === 0 || a === 198 && (b === 18 || b === 19) || a >= 224;
}
function isBlockedFetchHostname(hostname) {
  const host = normalizeHostname(hostname);
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local")) {
    return true;
  }
  const ipv4 = parseIpv4(host);
  if (ipv4) return isPrivateIpv4(ipv4);
  if (host.includes(":")) {
    return true;
  }
  return false;
}
function parsePublicHttpUrl(value, label = "URL") {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw makeHttpError(`Invalid ${label} format`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw makeHttpError("Only HTTP and HTTPS URLs are allowed");
  }
  if (url.username || url.password) {
    throw makeHttpError("URLs with embedded credentials are not allowed");
  }
  if (isBlockedFetchHostname(url.hostname)) {
    throw makeHttpError("Private, local, and metadata network URLs are not allowed");
  }
  url.hash = "";
  return url;
}
function resolvePublicRedirect(location, currentUrl) {
  if (!location) return null;
  return parsePublicHttpUrl(new URL(location, currentUrl).toString(), "redirect URL");
}
async function fetchPublicHttpUrl(value, init = {}) {
  const { maxRedirects = DEFAULT_MAX_REDIRECTS, ...fetchInit } = init;
  let currentUrl = parsePublicHttpUrl(value);
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetch(currentUrl.toString(), {
      ...fetchInit,
      redirect: "manual"
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }
    const location = response.headers.get("location");
    if (!location) return response;
    if (redirectCount >= maxRedirects) return response;
    currentUrl = resolvePublicRedirect(location, currentUrl);
  }
  throw makeHttpError("Too many redirects", 508);
}

// functions/_handlers/fetch-url-meta.js
var MAX_HTML_BYTES = 5e6;
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    await requireFirebaseAuthFromNodeRequest(req);
  } catch (error) {
    return res.status(error?.status || 401).json({ error: error?.message || "Unauthorized" });
  }
  const params = req.method === "GET" ? req.query || {} : req.body || {};
  const { url, includeMetaDescription, returnHtml } = params;
  if (!url) return res.status(400).json({ error: "URL is required" });
  try {
    parsePublicHttpUrl(url);
  } catch (error) {
    return res.status(error?.status || 400).json({ error: error?.message || "Invalid URL format" });
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), returnHtml ? 15e3 : 1e4);
    const response = await fetchPublicHttpUrl(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.8"
      }
    }).finally(() => clearTimeout(timeout));
    const statusCode = response.status;
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_HTML_BYTES) {
      return res.status(413).json({ error: "Fetched response is too large" });
    }
    const html = statusCode >= 200 && statusCode < 300 ? (await response.text()).slice(0, MAX_HTML_BYTES) : "";
    if (returnHtml) {
      return res.status(200).json({
        url,
        statusCode,
        html,
        success: Boolean(html),
        error: html ? void 0 : `HTTP ${statusCode}`
      });
    }
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim().slice(0, 200);
    const metaDescription = includeMetaDescription ? (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] || "").replace(/\s+/g, " ").trim().slice(0, 300) : "";
    return res.status(200).json({ url, statusCode, title, metaDescription, success: true });
  } catch (error) {
    return res.status(200).json({
      url,
      statusCode: 0,
      title: "",
      metaDescription: "",
      html: returnHtml ? "" : void 0,
      error: error?.name === "AbortError" ? "Timeout" : error?.message,
      success: false
    });
  }
}

// functions/_handlers/webmaster-api.js
var BING_API_BASE = "https://ssl.bing.com/webmaster/api.svc/json";
async function handler2(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { service, action } = req.query || {};
  if (service !== "bing") {
    return res.status(400).json({ error: 'Invalid service. Use "bing".' });
  }
  if (!action) return res.status(400).json({ error: "Action is required" });
  return handleBing(req, res, action);
}
async function handleBing(req, res, action) {
  const { apikey, siteUrl } = req.query || {};
  if (!apikey) {
    return res.status(400).json({ error: "Bing Webmaster API key is required" });
  }
  let endpoint = "";
  if (action === "getSites") {
    endpoint = `${BING_API_BASE}/GetUserSites?apikey=${encodeURIComponent(apikey)}`;
  } else if (action === "getStats") {
    if (!siteUrl) return res.status(400).json({ error: "siteUrl is required for getStats" });
    endpoint = `${BING_API_BASE}/GetQueryStats?apikey=${encodeURIComponent(apikey)}&siteUrl=${encodeURIComponent(siteUrl)}`;
  } else if (action === "getPageStats") {
    if (!siteUrl) return res.status(400).json({ error: "siteUrl is required for getPageStats" });
    endpoint = `${BING_API_BASE}/GetPageStats?apikey=${encodeURIComponent(apikey)}&siteUrl=${encodeURIComponent(siteUrl)}`;
  } else if (action === "getCrawlStats") {
    if (!siteUrl) return res.status(400).json({ error: "siteUrl is required for getCrawlStats" });
    endpoint = `${BING_API_BASE}/GetCrawlStats?apikey=${encodeURIComponent(apikey)}&siteUrl=${encodeURIComponent(siteUrl)}`;
  } else {
    return res.status(400).json({ error: "Invalid Bing action" });
  }
  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
    const text = await response.text();
    const payload = parseJson(text) || { raw: text };
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return res.status(401).json({ error: "Invalid or unauthorized Bing Webmaster API key" });
      }
      return res.status(response.status).json({
        error: `Bing API error: HTTP ${response.status}`,
        details: payload
      });
    }
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(502).json({
      error: "Failed to fetch from Bing Webmaster API",
      details: error?.message || "Unknown error"
    });
  }
}
function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// vite.config.js
var TEXT_TYPES = [
  "text/",
  "application/json",
  "application/javascript",
  "application/xml",
  "application/xhtml+xml",
  "application/rss+xml",
  "application/atom+xml",
  "image/svg+xml"
];
async function verifyDevApiRequest(req) {
  const headers = new Headers();
  const authorization = req.headers.authorization || req.headers.Authorization;
  if (authorization) headers.set("authorization", authorization);
  return verifyFirebaseIdToken(
    new Request("http://127.0.0.1/auth", { headers }),
    process.env
  );
}
function parseEnvFile(pathname) {
  if (!fs.existsSync(pathname)) return {};
  return Object.fromEntries(
    fs.readFileSync(pathname, "utf8").split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
      const separator = line.indexOf("=");
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      return [key, value];
    })
  );
}
function loadDevApiEnv() {
  return {
    ...process.env,
    ...loadEnv("development", process.cwd(), ""),
    ...parseEnvFile(".dev.vars")
  };
}
function sendUnauthorized(res, error) {
  sendJson(res, error?.status || 401, {
    error: error?.message || "Unauthorized"
  });
}
function proxyApiPlugin() {
  return {
    name: "seox-proxy-api",
    configureServer(server) {
      server.middlewares.use("/api/proxy", async (req, res) => {
        try {
          try {
            await verifyDevApiRequest(req);
          } catch (error) {
            return sendUnauthorized(res, error);
          }
          const requestUrl = new URL(req.url || "", "http://127.0.0.1");
          const targetUrl = requestUrl.searchParams.get("url");
          if (!targetUrl) {
            return sendJson(res, 400, { error: "URL parameter is required" });
          }
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1e4);
          const response = await fetchPublicHttpUrl(targetUrl, {
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
              "Accept-Language": "en-US,en;q=0.5",
              Connection: "keep-alive",
              "Upgrade-Insecure-Requests": "1"
            }
          }).finally(() => clearTimeout(timeoutId));
          const contentType = response.headers.get("content-type") || "";
          const text = await response.text();
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Type", contentType || "text/html");
          res.statusCode = response.status;
          res.end(text);
        } catch (error) {
          sendJson(res, error?.status || 500, {
            error: "Failed to fetch URL",
            message: error?.message || "Unknown error"
          });
        }
      });
    }
  };
}
function deepseekApiPlugin() {
  return {
    name: "seox-deepseek-api",
    configureServer(server) {
      server.middlewares.use("/api/deepseek", async (req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        if (req.method === "OPTIONS") {
          res.statusCode = 200;
          return res.end();
        }
        if (req.method !== "POST") {
          return sendJson(res, 405, { error: "Method not allowed" });
        }
        try {
          await verifyDevApiRequest(req);
        } catch (error) {
          return sendUnauthorized(res, error);
        }
        const env = loadEnv("development", process.cwd(), "");
        const apiKey = env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
          return sendJson(res, 500, {
            error: "DeepSeek API key not configured. Add DEEPSEEK_API_KEY to your .env file."
          });
        }
        const body = await new Promise((resolve) => {
          let data = "";
          req.on("data", (chunk) => data += chunk);
          req.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve({});
            }
          });
        });
        const {
          prompt,
          systemInstruction,
          responseMimeType,
          temperature = 0.7,
          maxTokens = 8192
        } = body;
        if (!prompt) {
          return sendJson(res, 400, { error: "Prompt is required" });
        }
        try {
          const wantsJson = responseMimeType === "application/json";
          const systemMessages = [];
          if (systemInstruction) systemMessages.push(systemInstruction);
          if (wantsJson) systemMessages.push("Return valid JSON only.");
          const messages = [];
          if (systemMessages.length > 0) {
            messages.push({
              role: "system",
              content: systemMessages.join("\n\n")
            });
          }
          messages.push({ role: "user", content: prompt });
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6e4);
          const response = await fetch(
            "https://api.deepseek.com/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                model: "deepseek-chat",
                messages,
                temperature,
                max_tokens: maxTokens,
                stream: false
              }),
              signal: controller.signal
            }
          );
          clearTimeout(timeoutId);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return sendJson(res, response.status, {
              error: errorData.error?.message || `DeepSeek API error: ${response.status}`
            });
          }
          const data = await response.json();
          const text = data.choices?.[0]?.message?.content || "";
          sendJson(res, 200, {
            text,
            usage: data.usage,
            model: data.model
          });
        } catch (error) {
          console.error("DeepSeek API error:", error);
          sendJson(res, 500, {
            error: error?.message || "Failed to call DeepSeek API"
          });
        }
      });
    }
  };
}
function crawlerApiPlugin() {
  return {
    name: "seox-crawler-api",
    configureServer(server) {
      registerCrawlerMiddleware(server);
    },
    configurePreviewServer(server) {
      registerCrawlerMiddleware(server);
    }
  };
}
function fetchUrlMetaApiPlugin() {
  return {
    name: "seox-fetch-url-meta-api",
    configureServer(server) {
      registerFetchUrlMetaMiddleware(server);
    },
    configurePreviewServer(server) {
      registerFetchUrlMetaMiddleware(server);
    }
  };
}
function webmasterApiPlugin() {
  return {
    name: "seox-webmaster-api",
    configureServer(server) {
      registerWebmasterApiMiddleware(server);
    },
    configurePreviewServer(server) {
      registerWebmasterApiMiddleware(server);
    }
  };
}
function autocompleteApiPlugin() {
  return {
    name: "seox-autocomplete-api",
    configureServer(server) {
      registerAutocompleteMiddleware(server);
    },
    configurePreviewServer(server) {
      registerAutocompleteMiddleware(server);
    }
  };
}
function gscTokenApiPlugin() {
  return {
    name: "seox-gsc-token-api",
    configureServer(server) {
      registerGscTokenMiddleware(server);
    },
    configurePreviewServer(server) {
      registerGscTokenMiddleware(server);
    }
  };
}
function mountedUrl(req, mountPath) {
  const raw = req.url || "";
  if (raw.startsWith(mountPath)) return `http://127.0.0.1${raw}`;
  if (raw.startsWith("/?")) return `http://127.0.0.1${mountPath}${raw.slice(1)}`;
  if (raw.startsWith("?")) return `http://127.0.0.1${mountPath}${raw}`;
  if (!raw || raw === "/") return `http://127.0.0.1${mountPath}`;
  return `http://127.0.0.1${mountPath}${raw.startsWith("/") ? raw : `/${raw}`}`;
}
function registerFetchUrlMetaMiddleware(server) {
  server.middlewares.use("/api/fetch-url-meta", async (req, res) => {
    const requestUrl = new URL(req.url || "", "http://127.0.0.1");
    const query = Object.fromEntries(requestUrl.searchParams.entries());
    const body = ["POST", "PUT", "PATCH"].includes(req.method || "") ? await readJsonBody(req) : {};
    await handler(
      { method: req.method || "GET", headers: req.headers, query, body },
      createNodeJsonResponse(res)
    );
  });
}
function registerAutocompleteMiddleware(server) {
  server.middlewares.use("/api/autocomplete", async (req, res) => {
    try {
      const response = await onRequest({
        request: new Request(mountedUrl(req, "/api/autocomplete"), {
          method: req.method || "GET",
          headers: req.headers
        })
      });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, 500, {
        error: "Autocomplete request failed",
        message: error?.message || "Unknown error"
      });
    }
  });
}
function registerGscTokenMiddleware(server) {
  server.middlewares.use("/api/gsc-token", async (req, res) => {
    try {
      const request = await createWebRequest(req, "/api/gsc-token");
      const response = await onRequest2({
        request,
        env: loadDevApiEnv()
      });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, error?.status || 500, {
        error: "GSC token request failed",
        message: error?.message || "Unknown error"
      });
    }
  });
}
function registerWebmasterApiMiddleware(server) {
  server.middlewares.use("/api/webmaster-api", async (req, res) => {
    try {
      await verifyDevApiRequest(req);
    } catch (error) {
      return sendUnauthorized(res, error);
    }
    const requestUrl = new URL(req.url || "", "http://127.0.0.1");
    const query = Object.fromEntries(requestUrl.searchParams.entries());
    await handler2(
      { method: req.method || "GET", query },
      createNodeJsonResponse(res)
    );
  });
}
function registerCrawlerMiddleware(server) {
  server.middlewares.use("/api/crawler/fetch", async (req, res) => {
    try {
      try {
        await verifyDevApiRequest(req);
      } catch (error) {
        sendUnauthorized(res, error);
        return;
      }
      const requestUrl = new URL(req.url || "", "http://127.0.0.1");
      const targetRaw = requestUrl.searchParams.get("url");
      if (!targetRaw) {
        sendJson(res, 400, { error: "Missing url parameter" });
        return;
      }
      const target = parsePublicHttpUrl(targetRaw);
      const started = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12e3);
      const response = await fetchPublicHttpUrl(target.toString(), {
        maxRedirects: 0,
        signal: controller.signal,
        headers: {
          "user-agent": "SEOXBot/1.0 (+https://seox.local/crawler; compatible; site-audit)",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5"
        }
      }).finally(() => clearTimeout(timeout));
      const contentType = response.headers.get("content-type") || "unknown";
      const location = response.headers.get("location");
      const bytes = Buffer.from(await response.arrayBuffer());
      const text = isTextContent(contentType) ? bytes.toString("utf8").slice(0, 2e6) : "";
      const finalUrl = response.url || target.toString();
      const parsed = parseCrawlText(text, contentType, finalUrl);
      if (location) {
        parsed.links = [
          ...new Set([
            ...parsed.links || [],
            resolveUrl(location, finalUrl)
          ].filter(Boolean))
        ];
      }
      sendJson(res, 200, {
        url: target.toString(),
        finalUrl,
        status: response.status,
        contentType,
        redirectedTo: location ? resolveUrl(location, finalUrl) : null,
        xRobotsTag: response.headers.get("x-robots-tag") || "",
        sizeKb: Math.round(bytes.length / 1024 * 10) / 10,
        loadTime: Date.now() - started,
        ...parsed
      });
    } catch (error) {
      const status = error?.name === "AbortError" ? 504 : error?.status || 500;
      sendJson(res, status, {
        error: error?.name === "AbortError" ? "Crawl request timed out" : error?.message || "Crawl request failed"
      });
    }
  });
}
function isTextContent(contentType = "") {
  const lowered = contentType.toLowerCase();
  return TEXT_TYPES.some((type) => lowered.includes(type));
}
function parseCrawlText(text, contentType, baseUrl) {
  const lowered = contentType.toLowerCase();
  if (!text) return { links: [], resources: [], sitemaps: [], disallow: [] };
  if (lowered.includes("xml")) {
    return {
      links: extractSitemapLocs(text, baseUrl),
      resources: [],
      sitemaps: [],
      disallow: []
    };
  }
  if (baseUrl.endsWith("/robots.txt") || lowered.includes("text/plain")) {
    const robots = parseRobots(text, baseUrl);
    return {
      links: [],
      resources: [],
      sitemaps: robots.sitemaps,
      disallow: robots.disallow
    };
  }
  return parseHtml(text, baseUrl);
}
function parseHtml(html, baseUrl) {
  const links = /* @__PURE__ */ new Set();
  const resources = /* @__PURE__ */ new Set();
  for (const href of matchAttributes(html, "a", "href")) {
    addResolved(links, href, baseUrl);
  }
  for (const href of matchAttributes(html, "link", "href")) {
    addResolved(resources, href, baseUrl);
  }
  for (const src of matchAttributes(html, "script", "src")) {
    addResolved(resources, src, baseUrl);
  }
  for (const src of matchAttributes(html, "img", "src")) {
    addResolved(resources, src, baseUrl);
  }
  for (const srcset of matchAttributes(html, "source", "srcset")) {
    for (const src of parseSrcSet(srcset)) addResolved(resources, src, baseUrl);
  }
  for (const srcset of matchAttributes(html, "img", "srcset")) {
    for (const src of parseSrcSet(srcset)) addResolved(resources, src, baseUrl);
  }
  return {
    links: Array.from(links),
    resources: Array.from(resources),
    sitemaps: [],
    disallow: [],
    audit: extractHtmlAudit(html, baseUrl, {
      links: Array.from(links),
      resources: Array.from(resources)
    })
  };
}
function extractHtmlAudit(html, baseUrl, discovered) {
  const titleTags = matchTags(html, "title").map((tag) => stripTags(tag));
  const h1Tags = matchTags(html, "h1").map((tag) => stripTags(tag));
  const metaTags = matchTagBlocks(html, "meta").map(parseAttributes);
  const linkTags = matchTagBlocks(html, "link").map(parseAttributes);
  const imgTags = matchTagBlocks(html, "img").map(parseAttributes);
  const canonical = linkTags.find(
    (attrs) => String(attrs.rel || "").toLowerCase().split(/\s+/).includes("canonical")
  );
  const robotsMeta = metaTags.filter((attrs) => String(attrs.name || "").toLowerCase() === "robots").map((attrs) => String(attrs.content || "").toLowerCase()).join(", ");
  const descriptions = metaTags.filter(
    (attrs) => ["description", "og:description", "twitter:description"].includes(
      String(attrs.name || attrs.property || "").toLowerCase()
    )
  );
  const metaDescriptions = metaTags.filter(
    (attrs) => String(attrs.name || "").toLowerCase() === "description"
  );
  const ogTags = Object.fromEntries(
    metaTags.filter((attrs) => String(attrs.property || attrs.name || "").toLowerCase().startsWith("og:")).map((attrs) => [String(attrs.property || attrs.name).toLowerCase(), attrs.content || ""])
  );
  const twitterTags = Object.fromEntries(
    metaTags.filter((attrs) => String(attrs.name || attrs.property || "").toLowerCase().startsWith("twitter:")).map((attrs) => [String(attrs.name || attrs.property).toLowerCase(), attrs.content || ""])
  );
  const isHttps = baseUrl.startsWith("https:");
  const allDiscovered = [...discovered.links, ...discovered.resources];
  const httpUrls = allDiscovered.filter((url) => url.startsWith("http://"));
  const imageHttpUrls = imgTags.map((attrs) => attrs.src).filter((src) => src && resolveUrl(src, baseUrl)?.startsWith("http://"));
  const metaRefresh = matchTagBlocks(html, "meta").find(
    (tag) => /http-equiv\s*=\s*["']?refresh/i.test(tag)
  );
  return {
    titleCount: titleTags.length,
    titleText: titleTags[0] || "",
    titleLength: (titleTags[0] || "").length,
    h1Count: h1Tags.length,
    h1Text: h1Tags[0] || "",
    metaDescriptionCount: metaDescriptions.length,
    metaDescriptionText: metaDescriptions[0]?.content || "",
    metaDescriptionLength: (metaDescriptions[0]?.content || "").length,
    anyDescriptionCount: descriptions.length,
    canonicalUrl: canonical?.href ? resolveUrl(canonical.href, baseUrl) : "",
    robotsMeta,
    noindex: /\bnoindex\b/i.test(robotsMeta),
    nofollow: /\bnofollow\b/i.test(robotsMeta),
    ogTags,
    twitterTags,
    ogMissingCount: countMissing(ogTags, ["og:title", "og:type", "og:image", "og:url", "og:description"]),
    twitterMissingCount: countMissing(twitterTags, ["twitter:card", "twitter:title", "twitter:description", "twitter:image"]),
    ogMissingAll: Object.keys(ogTags).length === 0,
    twitterMissingAll: Object.keys(twitterTags).length === 0,
    imageCount: imgTags.length,
    missingImageAltCount: imgTags.filter((attrs) => !String(attrs.alt || "").trim()).length,
    mixedContentCount: isHttps ? httpUrls.length : 0,
    httpImageCount: isHttps ? imageHttpUrls.length : 0,
    metaRefreshRedirect: Boolean(metaRefresh),
    linksCount: discovered.links.length,
    wordCount: stripTags(html).split(/\s+/).filter(Boolean).length
  };
}
function matchAttributes(html, tag, attr) {
  const matches = [];
  const tagRe = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  const attrRe = new RegExp(`${attr}\\s*=\\s*(["'])(.*?)\\1`, "i");
  for (const tagMatch of html.matchAll(tagRe)) {
    const attrMatch = tagMatch[0].match(attrRe);
    if (attrMatch?.[2]) matches.push(decodeHtml(attrMatch[2].trim()));
  }
  return matches;
}
function matchTags(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
  return Array.from(html.matchAll(re), (match) => match[0]);
}
function matchTagBlocks(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  return Array.from(html.matchAll(re), (match) => match[0]);
}
function parseAttributes(tag) {
  const attrs = {};
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(attrRe)) {
    attrs[match[1].toLowerCase()] = decodeHtml(match[2] || match[3] || match[4] || "");
  }
  return attrs;
}
function stripTags(value) {
  return decodeHtml(String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}
function countMissing(source, keys) {
  return keys.filter((key) => !String(source[key] || "").trim()).length;
}
function parseSrcSet(srcset) {
  return String(srcset).split(",").map((part) => part.trim().split(/\s+/)[0]).filter(Boolean);
}
function extractSitemapLocs(xml, baseUrl) {
  const urls = /* @__PURE__ */ new Set();
  for (const match of xml.matchAll(/<loc[^>]*>\s*([^<]+)\s*<\/loc>/gi)) {
    addResolved(urls, decodeHtml(match[1].trim()), baseUrl);
  }
  return Array.from(urls);
}
function parseRobots(text, baseUrl) {
  const sitemaps = /* @__PURE__ */ new Set();
  const disallow = /* @__PURE__ */ new Set();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const sitemap = line.match(/^sitemap:\s*(.+)$/i);
    if (sitemap) addResolved(sitemaps, sitemap[1].trim(), baseUrl);
    const blocked = line.match(/^disallow:\s*(.+)$/i);
    if (blocked && blocked[1].trim()) disallow.add(blocked[1].trim());
  }
  return { sitemaps: Array.from(sitemaps), disallow: Array.from(disallow) };
}
function addResolved(set, value, baseUrl) {
  if (!value || /^(mailto:|tel:|javascript:|data:|blob:)/i.test(value)) return;
  const resolved = resolveUrl(value, baseUrl);
  if (resolved) set.add(resolved);
}
function resolveUrl(value, baseUrl) {
  if (!value || /^(mailto:|tel:|javascript:|data:|blob:)/i.test(value)) return "";
  try {
    const url = new URL(value, baseUrl);
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}
function decodeHtml(value) {
  return String(value).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}
function readRawBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}
async function createWebRequest(req, mountPath) {
  const headers = new Headers();
  Object.entries(req.headers || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) headers.set(key, value.join(", "));
    else if (value !== void 0) headers.set(key, String(value));
  });
  const method = req.method || "GET";
  const init = { method, headers };
  if (!["GET", "HEAD"].includes(method)) {
    init.body = await readRawBody(req);
  }
  return new Request(mountedUrl(req, mountPath), init);
}
function createNodeJsonResponse(res) {
  return {
    setHeader(name, value) {
      res.setHeader(name, value);
      return this;
    },
    status(statusCode) {
      res.statusCode = statusCode;
      return this;
    },
    json(payload) {
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify(payload));
      return this;
    },
    end(payload) {
      res.end(payload);
      return this;
    }
  };
}
async function sendWebResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
}
function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}
var vite_config_default = defineConfig({
  plugins: [react(), proxyApiPlugin(), deepseekApiPlugin(), fetchUrlMetaApiPlugin(), webmasterApiPlugin(), autocompleteApiPlugin(), gscTokenApiPlugin(), crawlerApiPlugin()],
  server: {
    port: 5173,
    host: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiLCAiZnVuY3Rpb25zL19saWIvaHR0cC5qcyIsICJmdW5jdGlvbnMvYXBpL2F1dG9jb21wbGV0ZS5qcyIsICJmdW5jdGlvbnMvX2xpYi9maXJlYmFzZS1yZXN0LmpzIiwgImZ1bmN0aW9ucy9hcGkvZ3NjLXRva2VuLmpzIiwgImZ1bmN0aW9ucy9fbGliL3JlcXVlc3QtYXV0aC5qcyIsICJmdW5jdGlvbnMvX2xpYi91cmwtc2VjdXJpdHkuanMiLCAiZnVuY3Rpb25zL19oYW5kbGVycy9mZXRjaC11cmwtbWV0YS5qcyIsICJmdW5jdGlvbnMvX2hhbmRsZXJzL3dlYm1hc3Rlci1hcGkuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhbGVlbVxcXFxPbmVEcml2ZVxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXHNlb3hcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGFsZWVtXFxcXE9uZURyaXZlXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxcc2VveFxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvYWxlZW0vT25lRHJpdmUvRG9jdW1lbnRzL0dpdEh1Yi9zZW94L3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcbmltcG9ydCBmcyBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgb25SZXF1ZXN0IGFzIGF1dG9jb21wbGV0ZU9uUmVxdWVzdCB9IGZyb20gXCIuL2Z1bmN0aW9ucy9hcGkvYXV0b2NvbXBsZXRlLmpzXCI7XG5pbXBvcnQgeyBvblJlcXVlc3QgYXMgZ3NjVG9rZW5PblJlcXVlc3QgfSBmcm9tIFwiLi9mdW5jdGlvbnMvYXBpL2dzYy10b2tlbi5qc1wiO1xuaW1wb3J0IGZldGNoVXJsTWV0YUhhbmRsZXIgZnJvbSBcIi4vZnVuY3Rpb25zL19oYW5kbGVycy9mZXRjaC11cmwtbWV0YS5qc1wiO1xuaW1wb3J0IHdlYm1hc3RlckFwaUhhbmRsZXIgZnJvbSBcIi4vZnVuY3Rpb25zL19oYW5kbGVycy93ZWJtYXN0ZXItYXBpLmpzXCI7XG5pbXBvcnQgeyB2ZXJpZnlGaXJlYmFzZUlkVG9rZW4gfSBmcm9tIFwiLi9mdW5jdGlvbnMvX2xpYi9maXJlYmFzZS1yZXN0LmpzXCI7XG5pbXBvcnQgeyBmZXRjaFB1YmxpY0h0dHBVcmwsIHBhcnNlUHVibGljSHR0cFVybCB9IGZyb20gXCIuL2Z1bmN0aW9ucy9fbGliL3VybC1zZWN1cml0eS5qc1wiO1xuXG5jb25zdCBURVhUX1RZUEVTID0gW1xuICBcInRleHQvXCIsXG4gIFwiYXBwbGljYXRpb24vanNvblwiLFxuICBcImFwcGxpY2F0aW9uL2phdmFzY3JpcHRcIixcbiAgXCJhcHBsaWNhdGlvbi94bWxcIixcbiAgXCJhcHBsaWNhdGlvbi94aHRtbCt4bWxcIixcbiAgXCJhcHBsaWNhdGlvbi9yc3MreG1sXCIsXG4gIFwiYXBwbGljYXRpb24vYXRvbSt4bWxcIixcbiAgXCJpbWFnZS9zdmcreG1sXCIsXG5dO1xuXG5hc3luYyBmdW5jdGlvbiB2ZXJpZnlEZXZBcGlSZXF1ZXN0KHJlcSkge1xuICBjb25zdCBoZWFkZXJzID0gbmV3IEhlYWRlcnMoKTtcbiAgY29uc3QgYXV0aG9yaXphdGlvbiA9IHJlcS5oZWFkZXJzLmF1dGhvcml6YXRpb24gfHwgcmVxLmhlYWRlcnMuQXV0aG9yaXphdGlvbjtcbiAgaWYgKGF1dGhvcml6YXRpb24pIGhlYWRlcnMuc2V0KFwiYXV0aG9yaXphdGlvblwiLCBhdXRob3JpemF0aW9uKTtcbiAgcmV0dXJuIHZlcmlmeUZpcmViYXNlSWRUb2tlbihcbiAgICBuZXcgUmVxdWVzdChcImh0dHA6Ly8xMjcuMC4wLjEvYXV0aFwiLCB7IGhlYWRlcnMgfSksXG4gICAgcHJvY2Vzcy5lbnZcbiAgKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VFbnZGaWxlKHBhdGhuYW1lKSB7XG4gIGlmICghZnMuZXhpc3RzU3luYyhwYXRobmFtZSkpIHJldHVybiB7fTtcblxuICByZXR1cm4gT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgIGZzXG4gICAgICAucmVhZEZpbGVTeW5jKHBhdGhuYW1lLCBcInV0ZjhcIilcbiAgICAgIC5zcGxpdCgvXFxyP1xcbi8pXG4gICAgICAubWFwKChsaW5lKSA9PiBsaW5lLnRyaW0oKSlcbiAgICAgIC5maWx0ZXIoKGxpbmUpID0+IGxpbmUgJiYgIWxpbmUuc3RhcnRzV2l0aChcIiNcIikgJiYgbGluZS5pbmNsdWRlcyhcIj1cIikpXG4gICAgICAubWFwKChsaW5lKSA9PiB7XG4gICAgICAgIGNvbnN0IHNlcGFyYXRvciA9IGxpbmUuaW5kZXhPZihcIj1cIik7XG4gICAgICAgIGNvbnN0IGtleSA9IGxpbmUuc2xpY2UoMCwgc2VwYXJhdG9yKS50cmltKCk7XG4gICAgICAgIGxldCB2YWx1ZSA9IGxpbmUuc2xpY2Uoc2VwYXJhdG9yICsgMSkudHJpbSgpO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgKHZhbHVlLnN0YXJ0c1dpdGgoJ1wiJykgJiYgdmFsdWUuZW5kc1dpdGgoJ1wiJykpIHx8XG4gICAgICAgICAgKHZhbHVlLnN0YXJ0c1dpdGgoXCInXCIpICYmIHZhbHVlLmVuZHNXaXRoKFwiJ1wiKSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgdmFsdWUgPSB2YWx1ZS5zbGljZSgxLCAtMSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFtrZXksIHZhbHVlXTtcbiAgICAgIH0pXG4gICk7XG59XG5cbmZ1bmN0aW9uIGxvYWREZXZBcGlFbnYoKSB7XG4gIHJldHVybiB7XG4gICAgLi4ucHJvY2Vzcy5lbnYsXG4gICAgLi4ubG9hZEVudihcImRldmVsb3BtZW50XCIsIHByb2Nlc3MuY3dkKCksIFwiXCIpLFxuICAgIC4uLnBhcnNlRW52RmlsZShcIi5kZXYudmFyc1wiKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gc2VuZFVuYXV0aG9yaXplZChyZXMsIGVycm9yKSB7XG4gIHNlbmRKc29uKHJlcywgZXJyb3I/LnN0YXR1cyB8fCA0MDEsIHtcbiAgICBlcnJvcjogZXJyb3I/Lm1lc3NhZ2UgfHwgXCJVbmF1dGhvcml6ZWRcIixcbiAgfSk7XG59XG5cbi8qIFx1MjUwMFx1MjUwMCBQcm94eSBBUEkgbWlkZGxld2FyZSAoZm9yIGNvbnRlbnQgdG9vbHMgdG8gZmV0Y2ggZXh0ZXJuYWwgVVJMcykgXHUyNTAwXHUyNTAwICovXG5mdW5jdGlvbiBwcm94eUFwaVBsdWdpbigpIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBcInNlb3gtcHJveHktYXBpXCIsXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvcHJveHlcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHZlcmlmeURldkFwaVJlcXVlc3QocmVxKTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHNlbmRVbmF1dGhvcml6ZWQocmVzLCBlcnJvcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcmVxdWVzdFVybCA9IG5ldyBVUkwocmVxLnVybCB8fCBcIlwiLCBcImh0dHA6Ly8xMjcuMC4wLjFcIik7XG4gICAgICAgICAgY29uc3QgdGFyZ2V0VXJsID0gcmVxdWVzdFVybC5zZWFyY2hQYXJhbXMuZ2V0KFwidXJsXCIpO1xuICAgICAgICAgIGlmICghdGFyZ2V0VXJsKSB7XG4gICAgICAgICAgICByZXR1cm4gc2VuZEpzb24ocmVzLCA0MDAsIHsgZXJyb3I6IFwiVVJMIHBhcmFtZXRlciBpcyByZXF1aXJlZFwiIH0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgICAgICAgY29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIDEwMDAwKTtcblxuICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2hQdWJsaWNIdHRwVXJsKHRhcmdldFVybCwge1xuICAgICAgICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgXCJVc2VyLUFnZW50XCI6XG4gICAgICAgICAgICAgICAgXCJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOyBXaW42NDsgeDY0KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMTIwLjAuMC4wIFNhZmFyaS81MzcuMzZcIixcbiAgICAgICAgICAgICAgQWNjZXB0OlxuICAgICAgICAgICAgICAgIFwidGV4dC9odG1sLGFwcGxpY2F0aW9uL3hodG1sK3htbCxhcHBsaWNhdGlvbi94bWw7cT0wLjksdGV4dC9wbGFpbjtxPTAuOCwqLyo7cT0wLjdcIixcbiAgICAgICAgICAgICAgXCJBY2NlcHQtTGFuZ3VhZ2VcIjogXCJlbi1VUyxlbjtxPTAuNVwiLFxuICAgICAgICAgICAgICBDb25uZWN0aW9uOiBcImtlZXAtYWxpdmVcIixcbiAgICAgICAgICAgICAgXCJVcGdyYWRlLUluc2VjdXJlLVJlcXVlc3RzXCI6IFwiMVwiLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KS5maW5hbGx5KCgpID0+IGNsZWFyVGltZW91dCh0aW1lb3V0SWQpKTtcblxuICAgICAgICAgIGNvbnN0IGNvbnRlbnRUeXBlID0gcmVzcG9uc2UuaGVhZGVycy5nZXQoXCJjb250ZW50LXR5cGVcIikgfHwgXCJcIjtcbiAgICAgICAgICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuXG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiLCBcIipcIik7XG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBjb250ZW50VHlwZSB8fCBcInRleHQvaHRtbFwiKTtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IHJlc3BvbnNlLnN0YXR1cztcbiAgICAgICAgICByZXMuZW5kKHRleHQpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIHNlbmRKc29uKHJlcywgZXJyb3I/LnN0YXR1cyB8fCA1MDAsIHtcbiAgICAgICAgICAgIGVycm9yOiBcIkZhaWxlZCB0byBmZXRjaCBVUkxcIixcbiAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yPy5tZXNzYWdlIHx8IFwiVW5rbm93biBlcnJvclwiLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG4vKiBcdTI1MDBcdTI1MDAgRGVlcFNlZWsgQVBJIG1pZGRsZXdhcmUgKGZvciBBSS1wb3dlcmVkIGNvbnRlbnQgdG9vbHMpIFx1MjUwMFx1MjUwMCAqL1xuZnVuY3Rpb24gZGVlcHNlZWtBcGlQbHVnaW4oKSB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogXCJzZW94LWRlZXBzZWVrLWFwaVwiLFxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL2RlZXBzZWVrXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgICAgICAvLyBDT1JTIGhlYWRlcnNcbiAgICAgICAgcmVzLnNldEhlYWRlcihcIkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiLCBcIipcIik7XG4gICAgICAgIHJlcy5zZXRIZWFkZXIoXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzXCIsIFwiUE9TVCwgT1BUSU9OU1wiKTtcbiAgICAgICAgcmVzLnNldEhlYWRlcihcIkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnNcIiwgXCJDb250ZW50LVR5cGUsIEF1dGhvcml6YXRpb25cIik7XG5cbiAgICAgICAgaWYgKHJlcS5tZXRob2QgPT09IFwiT1BUSU9OU1wiKSB7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSAyMDA7XG4gICAgICAgICAgcmV0dXJuIHJlcy5lbmQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikge1xuICAgICAgICAgIHJldHVybiBzZW5kSnNvbihyZXMsIDQwNSwgeyBlcnJvcjogXCJNZXRob2Qgbm90IGFsbG93ZWRcIiB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYXdhaXQgdmVyaWZ5RGV2QXBpUmVxdWVzdChyZXEpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIHJldHVybiBzZW5kVW5hdXRob3JpemVkKHJlcywgZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVhZCBlbnYgdXNpbmcgZG90ZW52LXN0eWxlIGxvYWRpbmdcbiAgICAgICAgY29uc3QgZW52ID0gbG9hZEVudihcImRldmVsb3BtZW50XCIsIHByb2Nlc3MuY3dkKCksIFwiXCIpO1xuICAgICAgICBjb25zdCBhcGlLZXkgPSBlbnYuREVFUFNFRUtfQVBJX0tFWSB8fCBwcm9jZXNzLmVudi5ERUVQU0VFS19BUElfS0VZO1xuXG4gICAgICAgIGlmICghYXBpS2V5KSB7XG4gICAgICAgICAgcmV0dXJuIHNlbmRKc29uKHJlcywgNTAwLCB7XG4gICAgICAgICAgICBlcnJvcjpcbiAgICAgICAgICAgICAgXCJEZWVwU2VlayBBUEkga2V5IG5vdCBjb25maWd1cmVkLiBBZGQgREVFUFNFRUtfQVBJX0tFWSB0byB5b3VyIC5lbnYgZmlsZS5cIixcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFBhcnNlIEpTT04gYm9keVxuICAgICAgICBjb25zdCBib2R5ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICBsZXQgZGF0YSA9IFwiXCI7XG4gICAgICAgICAgcmVxLm9uKFwiZGF0YVwiLCAoY2h1bmspID0+IChkYXRhICs9IGNodW5rKSk7XG4gICAgICAgICAgcmVxLm9uKFwiZW5kXCIsICgpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHJlc29sdmUoSlNPTi5wYXJzZShkYXRhKSk7XG4gICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgcmVzb2x2ZSh7fSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHtcbiAgICAgICAgICBwcm9tcHQsXG4gICAgICAgICAgc3lzdGVtSW5zdHJ1Y3Rpb24sXG4gICAgICAgICAgcmVzcG9uc2VNaW1lVHlwZSxcbiAgICAgICAgICB0ZW1wZXJhdHVyZSA9IDAuNyxcbiAgICAgICAgICBtYXhUb2tlbnMgPSA4MTkyLFxuICAgICAgICB9ID0gYm9keTtcblxuICAgICAgICBpZiAoIXByb21wdCkge1xuICAgICAgICAgIHJldHVybiBzZW5kSnNvbihyZXMsIDQwMCwgeyBlcnJvcjogXCJQcm9tcHQgaXMgcmVxdWlyZWRcIiB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3Qgd2FudHNKc29uID0gcmVzcG9uc2VNaW1lVHlwZSA9PT0gXCJhcHBsaWNhdGlvbi9qc29uXCI7XG4gICAgICAgICAgY29uc3Qgc3lzdGVtTWVzc2FnZXMgPSBbXTtcbiAgICAgICAgICBpZiAoc3lzdGVtSW5zdHJ1Y3Rpb24pIHN5c3RlbU1lc3NhZ2VzLnB1c2goc3lzdGVtSW5zdHJ1Y3Rpb24pO1xuICAgICAgICAgIGlmICh3YW50c0pzb24pIHN5c3RlbU1lc3NhZ2VzLnB1c2goXCJSZXR1cm4gdmFsaWQgSlNPTiBvbmx5LlwiKTtcblxuICAgICAgICAgIGNvbnN0IG1lc3NhZ2VzID0gW107XG4gICAgICAgICAgaWYgKHN5c3RlbU1lc3NhZ2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIG1lc3NhZ2VzLnB1c2goe1xuICAgICAgICAgICAgICByb2xlOiBcInN5c3RlbVwiLFxuICAgICAgICAgICAgICBjb250ZW50OiBzeXN0ZW1NZXNzYWdlcy5qb2luKFwiXFxuXFxuXCIpLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIG1lc3NhZ2VzLnB1c2goeyByb2xlOiBcInVzZXJcIiwgY29udGVudDogcHJvbXB0IH0pO1xuXG4gICAgICAgICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgICAgICBjb25zdCB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgNjAwMDApO1xuXG4gICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChcbiAgICAgICAgICAgIFwiaHR0cHM6Ly9hcGkuZGVlcHNlZWsuY29tL2NoYXQvY29tcGxldGlvbnNcIixcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHthcGlLZXl9YCxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIG1vZGVsOiBcImRlZXBzZWVrLWNoYXRcIixcbiAgICAgICAgICAgICAgICBtZXNzYWdlcyxcbiAgICAgICAgICAgICAgICB0ZW1wZXJhdHVyZSxcbiAgICAgICAgICAgICAgICBtYXhfdG9rZW5zOiBtYXhUb2tlbnMsXG4gICAgICAgICAgICAgICAgc3RyZWFtOiBmYWxzZSxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgICAgICAgICB9XG4gICAgICAgICAgKTtcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcblxuICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgIGNvbnN0IGVycm9yRGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcbiAgICAgICAgICAgIHJldHVybiBzZW5kSnNvbihyZXMsIHJlc3BvbnNlLnN0YXR1cywge1xuICAgICAgICAgICAgICBlcnJvcjpcbiAgICAgICAgICAgICAgICBlcnJvckRhdGEuZXJyb3I/Lm1lc3NhZ2UgfHxcbiAgICAgICAgICAgICAgICBgRGVlcFNlZWsgQVBJIGVycm9yOiAke3Jlc3BvbnNlLnN0YXR1c31gLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgICBjb25zdCB0ZXh0ID0gZGF0YS5jaG9pY2VzPy5bMF0/Lm1lc3NhZ2U/LmNvbnRlbnQgfHwgXCJcIjtcblxuICAgICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7XG4gICAgICAgICAgICB0ZXh0LFxuICAgICAgICAgICAgdXNhZ2U6IGRhdGEudXNhZ2UsXG4gICAgICAgICAgICBtb2RlbDogZGF0YS5tb2RlbCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRGVlcFNlZWsgQVBJIGVycm9yOlwiLCBlcnJvcik7XG4gICAgICAgICAgc2VuZEpzb24ocmVzLCA1MDAsIHtcbiAgICAgICAgICAgIGVycm9yOiBlcnJvcj8ubWVzc2FnZSB8fCBcIkZhaWxlZCB0byBjYWxsIERlZXBTZWVrIEFQSVwiLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG4vKiBcdTI1MDBcdTI1MDAgQ3Jhd2xlciBBUEkgbWlkZGxld2FyZSAoZXhpc3RpbmcpIFx1MjUwMFx1MjUwMCAqL1xuZnVuY3Rpb24gY3Jhd2xlckFwaVBsdWdpbigpIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBcInNlb3gtY3Jhd2xlci1hcGlcIixcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICByZWdpc3RlckNyYXdsZXJNaWRkbGV3YXJlKHNlcnZlcik7XG4gICAgfSxcbiAgICBjb25maWd1cmVQcmV2aWV3U2VydmVyKHNlcnZlcikge1xuICAgICAgcmVnaXN0ZXJDcmF3bGVyTWlkZGxld2FyZShzZXJ2ZXIpO1xuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIGZldGNoVXJsTWV0YUFwaVBsdWdpbigpIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBcInNlb3gtZmV0Y2gtdXJsLW1ldGEtYXBpXCIsXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgcmVnaXN0ZXJGZXRjaFVybE1ldGFNaWRkbGV3YXJlKHNlcnZlcik7XG4gICAgfSxcbiAgICBjb25maWd1cmVQcmV2aWV3U2VydmVyKHNlcnZlcikge1xuICAgICAgcmVnaXN0ZXJGZXRjaFVybE1ldGFNaWRkbGV3YXJlKHNlcnZlcik7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gd2VibWFzdGVyQXBpUGx1Z2luKCkge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IFwic2VveC13ZWJtYXN0ZXItYXBpXCIsXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgcmVnaXN0ZXJXZWJtYXN0ZXJBcGlNaWRkbGV3YXJlKHNlcnZlcik7XG4gICAgfSxcbiAgICBjb25maWd1cmVQcmV2aWV3U2VydmVyKHNlcnZlcikge1xuICAgICAgcmVnaXN0ZXJXZWJtYXN0ZXJBcGlNaWRkbGV3YXJlKHNlcnZlcik7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gYXV0b2NvbXBsZXRlQXBpUGx1Z2luKCkge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IFwic2VveC1hdXRvY29tcGxldGUtYXBpXCIsXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgcmVnaXN0ZXJBdXRvY29tcGxldGVNaWRkbGV3YXJlKHNlcnZlcik7XG4gICAgfSxcbiAgICBjb25maWd1cmVQcmV2aWV3U2VydmVyKHNlcnZlcikge1xuICAgICAgcmVnaXN0ZXJBdXRvY29tcGxldGVNaWRkbGV3YXJlKHNlcnZlcik7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ3NjVG9rZW5BcGlQbHVnaW4oKSB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogXCJzZW94LWdzYy10b2tlbi1hcGlcIixcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICByZWdpc3RlckdzY1Rva2VuTWlkZGxld2FyZShzZXJ2ZXIpO1xuICAgIH0sXG4gICAgY29uZmlndXJlUHJldmlld1NlcnZlcihzZXJ2ZXIpIHtcbiAgICAgIHJlZ2lzdGVyR3NjVG9rZW5NaWRkbGV3YXJlKHNlcnZlcik7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gbW91bnRlZFVybChyZXEsIG1vdW50UGF0aCkge1xuICBjb25zdCByYXcgPSByZXEudXJsIHx8IFwiXCI7XG4gIGlmIChyYXcuc3RhcnRzV2l0aChtb3VudFBhdGgpKSByZXR1cm4gYGh0dHA6Ly8xMjcuMC4wLjEke3Jhd31gO1xuICBpZiAocmF3LnN0YXJ0c1dpdGgoXCIvP1wiKSkgcmV0dXJuIGBodHRwOi8vMTI3LjAuMC4xJHttb3VudFBhdGh9JHtyYXcuc2xpY2UoMSl9YDtcbiAgaWYgKHJhdy5zdGFydHNXaXRoKFwiP1wiKSkgcmV0dXJuIGBodHRwOi8vMTI3LjAuMC4xJHttb3VudFBhdGh9JHtyYXd9YDtcbiAgaWYgKCFyYXcgfHwgcmF3ID09PSBcIi9cIikgcmV0dXJuIGBodHRwOi8vMTI3LjAuMC4xJHttb3VudFBhdGh9YDtcbiAgcmV0dXJuIGBodHRwOi8vMTI3LjAuMC4xJHttb3VudFBhdGh9JHtyYXcuc3RhcnRzV2l0aChcIi9cIikgPyByYXcgOiBgLyR7cmF3fWB9YDtcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJGZXRjaFVybE1ldGFNaWRkbGV3YXJlKHNlcnZlcikge1xuICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9mZXRjaC11cmwtbWV0YVwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICBjb25zdCByZXF1ZXN0VXJsID0gbmV3IFVSTChyZXEudXJsIHx8IFwiXCIsIFwiaHR0cDovLzEyNy4wLjAuMVwiKTtcbiAgICBjb25zdCBxdWVyeSA9IE9iamVjdC5mcm9tRW50cmllcyhyZXF1ZXN0VXJsLnNlYXJjaFBhcmFtcy5lbnRyaWVzKCkpO1xuICAgIGNvbnN0IGJvZHkgPSBbXCJQT1NUXCIsIFwiUFVUXCIsIFwiUEFUQ0hcIl0uaW5jbHVkZXMocmVxLm1ldGhvZCB8fCBcIlwiKVxuICAgICAgPyBhd2FpdCByZWFkSnNvbkJvZHkocmVxKVxuICAgICAgOiB7fTtcblxuICAgIGF3YWl0IGZldGNoVXJsTWV0YUhhbmRsZXIoXG4gICAgICB7IG1ldGhvZDogcmVxLm1ldGhvZCB8fCBcIkdFVFwiLCBoZWFkZXJzOiByZXEuaGVhZGVycywgcXVlcnksIGJvZHkgfSxcbiAgICAgIGNyZWF0ZU5vZGVKc29uUmVzcG9uc2UocmVzKVxuICAgICk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiByZWdpc3RlckF1dG9jb21wbGV0ZU1pZGRsZXdhcmUoc2VydmVyKSB7XG4gIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL2F1dG9jb21wbGV0ZVwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBhdXRvY29tcGxldGVPblJlcXVlc3Qoe1xuICAgICAgICByZXF1ZXN0OiBuZXcgUmVxdWVzdChtb3VudGVkVXJsKHJlcSwgXCIvYXBpL2F1dG9jb21wbGV0ZVwiKSwge1xuICAgICAgICAgIG1ldGhvZDogcmVxLm1ldGhvZCB8fCBcIkdFVFwiLFxuICAgICAgICAgIGhlYWRlcnM6IHJlcS5oZWFkZXJzLFxuICAgICAgICB9KSxcbiAgICAgIH0pO1xuICAgICAgYXdhaXQgc2VuZFdlYlJlc3BvbnNlKHJlcywgcmVzcG9uc2UpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBzZW5kSnNvbihyZXMsIDUwMCwge1xuICAgICAgICBlcnJvcjogXCJBdXRvY29tcGxldGUgcmVxdWVzdCBmYWlsZWRcIixcbiAgICAgICAgbWVzc2FnZTogZXJyb3I/Lm1lc3NhZ2UgfHwgXCJVbmtub3duIGVycm9yXCIsXG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiByZWdpc3RlckdzY1Rva2VuTWlkZGxld2FyZShzZXJ2ZXIpIHtcbiAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvZ3NjLXRva2VuXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXF1ZXN0ID0gYXdhaXQgY3JlYXRlV2ViUmVxdWVzdChyZXEsIFwiL2FwaS9nc2MtdG9rZW5cIik7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGdzY1Rva2VuT25SZXF1ZXN0KHtcbiAgICAgICAgcmVxdWVzdCxcbiAgICAgICAgZW52OiBsb2FkRGV2QXBpRW52KCksXG4gICAgICB9KTtcbiAgICAgIGF3YWl0IHNlbmRXZWJSZXNwb25zZShyZXMsIHJlc3BvbnNlKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgc2VuZEpzb24ocmVzLCBlcnJvcj8uc3RhdHVzIHx8IDUwMCwge1xuICAgICAgICBlcnJvcjogXCJHU0MgdG9rZW4gcmVxdWVzdCBmYWlsZWRcIixcbiAgICAgICAgbWVzc2FnZTogZXJyb3I/Lm1lc3NhZ2UgfHwgXCJVbmtub3duIGVycm9yXCIsXG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiByZWdpc3RlcldlYm1hc3RlckFwaU1pZGRsZXdhcmUoc2VydmVyKSB7XG4gIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3dlYm1hc3Rlci1hcGlcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHZlcmlmeURldkFwaVJlcXVlc3QocmVxKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIHNlbmRVbmF1dGhvcml6ZWQocmVzLCBlcnJvcik7XG4gICAgfVxuXG4gICAgY29uc3QgcmVxdWVzdFVybCA9IG5ldyBVUkwocmVxLnVybCB8fCBcIlwiLCBcImh0dHA6Ly8xMjcuMC4wLjFcIik7XG4gICAgY29uc3QgcXVlcnkgPSBPYmplY3QuZnJvbUVudHJpZXMocmVxdWVzdFVybC5zZWFyY2hQYXJhbXMuZW50cmllcygpKTtcblxuICAgIGF3YWl0IHdlYm1hc3RlckFwaUhhbmRsZXIoXG4gICAgICB7IG1ldGhvZDogcmVxLm1ldGhvZCB8fCBcIkdFVFwiLCBxdWVyeSB9LFxuICAgICAgY3JlYXRlTm9kZUpzb25SZXNwb25zZShyZXMpXG4gICAgKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQ3Jhd2xlck1pZGRsZXdhcmUoc2VydmVyKSB7XG4gIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL2NyYXdsZXIvZmV0Y2hcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHZlcmlmeURldkFwaVJlcXVlc3QocmVxKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHNlbmRVbmF1dGhvcml6ZWQocmVzLCBlcnJvcik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVxdWVzdFVybCA9IG5ldyBVUkwocmVxLnVybCB8fCBcIlwiLCBcImh0dHA6Ly8xMjcuMC4wLjFcIik7XG4gICAgICBjb25zdCB0YXJnZXRSYXcgPSByZXF1ZXN0VXJsLnNlYXJjaFBhcmFtcy5nZXQoXCJ1cmxcIik7XG4gICAgICBpZiAoIXRhcmdldFJhdykge1xuICAgICAgICBzZW5kSnNvbihyZXMsIDQwMCwgeyBlcnJvcjogXCJNaXNzaW5nIHVybCBwYXJhbWV0ZXJcIiB9KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB0YXJnZXQgPSBwYXJzZVB1YmxpY0h0dHBVcmwodGFyZ2V0UmF3KTtcblxuICAgICAgY29uc3Qgc3RhcnRlZCA9IERhdGUubm93KCk7XG4gICAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgY29uc3QgdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCAxMjAwMCk7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoUHVibGljSHR0cFVybCh0YXJnZXQudG9TdHJpbmcoKSwge1xuICAgICAgICBtYXhSZWRpcmVjdHM6IDAsXG4gICAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICBcInVzZXItYWdlbnRcIjpcbiAgICAgICAgICAgIFwiU0VPWEJvdC8xLjAgKCtodHRwczovL3Nlb3gubG9jYWwvY3Jhd2xlcjsgY29tcGF0aWJsZTsgc2l0ZS1hdWRpdClcIixcbiAgICAgICAgICBhY2NlcHQ6XG4gICAgICAgICAgICBcInRleHQvaHRtbCxhcHBsaWNhdGlvbi94aHRtbCt4bWwsYXBwbGljYXRpb24veG1sO3E9MC45LHRleHQvcGxhaW47cT0wLjgsKi8qO3E9MC41XCIsXG4gICAgICAgIH0sXG4gICAgICB9KS5maW5hbGx5KCgpID0+IGNsZWFyVGltZW91dCh0aW1lb3V0KSk7XG5cbiAgICAgIGNvbnN0IGNvbnRlbnRUeXBlID0gcmVzcG9uc2UuaGVhZGVycy5nZXQoXCJjb250ZW50LXR5cGVcIikgfHwgXCJ1bmtub3duXCI7XG4gICAgICBjb25zdCBsb2NhdGlvbiA9IHJlc3BvbnNlLmhlYWRlcnMuZ2V0KFwibG9jYXRpb25cIik7XG4gICAgICBjb25zdCBieXRlcyA9IEJ1ZmZlci5mcm9tKGF3YWl0IHJlc3BvbnNlLmFycmF5QnVmZmVyKCkpO1xuICAgICAgY29uc3QgdGV4dCA9IGlzVGV4dENvbnRlbnQoY29udGVudFR5cGUpXG4gICAgICAgID8gYnl0ZXMudG9TdHJpbmcoXCJ1dGY4XCIpLnNsaWNlKDAsIDJfMDAwXzAwMClcbiAgICAgICAgOiBcIlwiO1xuICAgICAgY29uc3QgZmluYWxVcmwgPSByZXNwb25zZS51cmwgfHwgdGFyZ2V0LnRvU3RyaW5nKCk7XG4gICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUNyYXdsVGV4dCh0ZXh0LCBjb250ZW50VHlwZSwgZmluYWxVcmwpO1xuICAgICAgaWYgKGxvY2F0aW9uKSB7XG4gICAgICAgIHBhcnNlZC5saW5rcyA9IFtcbiAgICAgICAgICAuLi5uZXcgU2V0KFtcbiAgICAgICAgICAgIC4uLihwYXJzZWQubGlua3MgfHwgW10pLFxuICAgICAgICAgICAgcmVzb2x2ZVVybChsb2NhdGlvbiwgZmluYWxVcmwpLFxuICAgICAgICAgIF0uZmlsdGVyKEJvb2xlYW4pKSxcbiAgICAgICAgXTtcbiAgICAgIH1cblxuICAgICAgc2VuZEpzb24ocmVzLCAyMDAsIHtcbiAgICAgICAgdXJsOiB0YXJnZXQudG9TdHJpbmcoKSxcbiAgICAgICAgZmluYWxVcmwsXG4gICAgICAgIHN0YXR1czogcmVzcG9uc2Uuc3RhdHVzLFxuICAgICAgICBjb250ZW50VHlwZSxcbiAgICAgICAgcmVkaXJlY3RlZFRvOiBsb2NhdGlvbiA/IHJlc29sdmVVcmwobG9jYXRpb24sIGZpbmFsVXJsKSA6IG51bGwsXG4gICAgICAgIHhSb2JvdHNUYWc6IHJlc3BvbnNlLmhlYWRlcnMuZ2V0KFwieC1yb2JvdHMtdGFnXCIpIHx8IFwiXCIsXG4gICAgICAgIHNpemVLYjogTWF0aC5yb3VuZCgoYnl0ZXMubGVuZ3RoIC8gMTAyNCkgKiAxMCkgLyAxMCxcbiAgICAgICAgbG9hZFRpbWU6IERhdGUubm93KCkgLSBzdGFydGVkLFxuICAgICAgICAuLi5wYXJzZWQsXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc3Qgc3RhdHVzID0gZXJyb3I/Lm5hbWUgPT09IFwiQWJvcnRFcnJvclwiID8gNTA0IDogZXJyb3I/LnN0YXR1cyB8fCA1MDA7XG4gICAgICBzZW5kSnNvbihyZXMsIHN0YXR1cywge1xuICAgICAgICBlcnJvcjpcbiAgICAgICAgICBlcnJvcj8ubmFtZSA9PT0gXCJBYm9ydEVycm9yXCJcbiAgICAgICAgICAgID8gXCJDcmF3bCByZXF1ZXN0IHRpbWVkIG91dFwiXG4gICAgICAgICAgICA6IGVycm9yPy5tZXNzYWdlIHx8IFwiQ3Jhd2wgcmVxdWVzdCBmYWlsZWRcIixcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGlzVGV4dENvbnRlbnQoY29udGVudFR5cGUgPSBcIlwiKSB7XG4gIGNvbnN0IGxvd2VyZWQgPSBjb250ZW50VHlwZS50b0xvd2VyQ2FzZSgpO1xuICByZXR1cm4gVEVYVF9UWVBFUy5zb21lKCh0eXBlKSA9PiBsb3dlcmVkLmluY2x1ZGVzKHR5cGUpKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VDcmF3bFRleHQodGV4dCwgY29udGVudFR5cGUsIGJhc2VVcmwpIHtcbiAgY29uc3QgbG93ZXJlZCA9IGNvbnRlbnRUeXBlLnRvTG93ZXJDYXNlKCk7XG4gIGlmICghdGV4dCkgcmV0dXJuIHsgbGlua3M6IFtdLCByZXNvdXJjZXM6IFtdLCBzaXRlbWFwczogW10sIGRpc2FsbG93OiBbXSB9O1xuICBpZiAobG93ZXJlZC5pbmNsdWRlcyhcInhtbFwiKSkge1xuICAgIHJldHVybiB7XG4gICAgICBsaW5rczogZXh0cmFjdFNpdGVtYXBMb2NzKHRleHQsIGJhc2VVcmwpLFxuICAgICAgcmVzb3VyY2VzOiBbXSxcbiAgICAgIHNpdGVtYXBzOiBbXSxcbiAgICAgIGRpc2FsbG93OiBbXSxcbiAgICB9O1xuICB9XG4gIGlmIChiYXNlVXJsLmVuZHNXaXRoKFwiL3JvYm90cy50eHRcIikgfHwgbG93ZXJlZC5pbmNsdWRlcyhcInRleHQvcGxhaW5cIikpIHtcbiAgICBjb25zdCByb2JvdHMgPSBwYXJzZVJvYm90cyh0ZXh0LCBiYXNlVXJsKTtcbiAgICByZXR1cm4ge1xuICAgICAgbGlua3M6IFtdLFxuICAgICAgcmVzb3VyY2VzOiBbXSxcbiAgICAgIHNpdGVtYXBzOiByb2JvdHMuc2l0ZW1hcHMsXG4gICAgICBkaXNhbGxvdzogcm9ib3RzLmRpc2FsbG93LFxuICAgIH07XG4gIH1cbiAgcmV0dXJuIHBhcnNlSHRtbCh0ZXh0LCBiYXNlVXJsKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VIdG1sKGh0bWwsIGJhc2VVcmwpIHtcbiAgY29uc3QgbGlua3MgPSBuZXcgU2V0KCk7XG4gIGNvbnN0IHJlc291cmNlcyA9IG5ldyBTZXQoKTtcblxuICBmb3IgKGNvbnN0IGhyZWYgb2YgbWF0Y2hBdHRyaWJ1dGVzKGh0bWwsIFwiYVwiLCBcImhyZWZcIikpIHtcbiAgICBhZGRSZXNvbHZlZChsaW5rcywgaHJlZiwgYmFzZVVybCk7XG4gIH1cbiAgZm9yIChjb25zdCBocmVmIG9mIG1hdGNoQXR0cmlidXRlcyhodG1sLCBcImxpbmtcIiwgXCJocmVmXCIpKSB7XG4gICAgYWRkUmVzb2x2ZWQocmVzb3VyY2VzLCBocmVmLCBiYXNlVXJsKTtcbiAgfVxuICBmb3IgKGNvbnN0IHNyYyBvZiBtYXRjaEF0dHJpYnV0ZXMoaHRtbCwgXCJzY3JpcHRcIiwgXCJzcmNcIikpIHtcbiAgICBhZGRSZXNvbHZlZChyZXNvdXJjZXMsIHNyYywgYmFzZVVybCk7XG4gIH1cbiAgZm9yIChjb25zdCBzcmMgb2YgbWF0Y2hBdHRyaWJ1dGVzKGh0bWwsIFwiaW1nXCIsIFwic3JjXCIpKSB7XG4gICAgYWRkUmVzb2x2ZWQocmVzb3VyY2VzLCBzcmMsIGJhc2VVcmwpO1xuICB9XG4gIGZvciAoY29uc3Qgc3Jjc2V0IG9mIG1hdGNoQXR0cmlidXRlcyhodG1sLCBcInNvdXJjZVwiLCBcInNyY3NldFwiKSkge1xuICAgIGZvciAoY29uc3Qgc3JjIG9mIHBhcnNlU3JjU2V0KHNyY3NldCkpIGFkZFJlc29sdmVkKHJlc291cmNlcywgc3JjLCBiYXNlVXJsKTtcbiAgfVxuICBmb3IgKGNvbnN0IHNyY3NldCBvZiBtYXRjaEF0dHJpYnV0ZXMoaHRtbCwgXCJpbWdcIiwgXCJzcmNzZXRcIikpIHtcbiAgICBmb3IgKGNvbnN0IHNyYyBvZiBwYXJzZVNyY1NldChzcmNzZXQpKSBhZGRSZXNvbHZlZChyZXNvdXJjZXMsIHNyYywgYmFzZVVybCk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGxpbmtzOiBBcnJheS5mcm9tKGxpbmtzKSxcbiAgICByZXNvdXJjZXM6IEFycmF5LmZyb20ocmVzb3VyY2VzKSxcbiAgICBzaXRlbWFwczogW10sXG4gICAgZGlzYWxsb3c6IFtdLFxuICAgIGF1ZGl0OiBleHRyYWN0SHRtbEF1ZGl0KGh0bWwsIGJhc2VVcmwsIHtcbiAgICAgIGxpbmtzOiBBcnJheS5mcm9tKGxpbmtzKSxcbiAgICAgIHJlc291cmNlczogQXJyYXkuZnJvbShyZXNvdXJjZXMpLFxuICAgIH0pLFxuICB9O1xufVxuXG5mdW5jdGlvbiBleHRyYWN0SHRtbEF1ZGl0KGh0bWwsIGJhc2VVcmwsIGRpc2NvdmVyZWQpIHtcbiAgY29uc3QgdGl0bGVUYWdzID0gbWF0Y2hUYWdzKGh0bWwsIFwidGl0bGVcIikubWFwKCh0YWcpID0+IHN0cmlwVGFncyh0YWcpKTtcbiAgY29uc3QgaDFUYWdzID0gbWF0Y2hUYWdzKGh0bWwsIFwiaDFcIikubWFwKCh0YWcpID0+IHN0cmlwVGFncyh0YWcpKTtcbiAgY29uc3QgbWV0YVRhZ3MgPSBtYXRjaFRhZ0Jsb2NrcyhodG1sLCBcIm1ldGFcIikubWFwKHBhcnNlQXR0cmlidXRlcyk7XG4gIGNvbnN0IGxpbmtUYWdzID0gbWF0Y2hUYWdCbG9ja3MoaHRtbCwgXCJsaW5rXCIpLm1hcChwYXJzZUF0dHJpYnV0ZXMpO1xuICBjb25zdCBpbWdUYWdzID0gbWF0Y2hUYWdCbG9ja3MoaHRtbCwgXCJpbWdcIikubWFwKHBhcnNlQXR0cmlidXRlcyk7XG4gIGNvbnN0IGNhbm9uaWNhbCA9IGxpbmtUYWdzLmZpbmQoKGF0dHJzKSA9PlxuICAgIFN0cmluZyhhdHRycy5yZWwgfHwgXCJcIikudG9Mb3dlckNhc2UoKS5zcGxpdCgvXFxzKy8pLmluY2x1ZGVzKFwiY2Fub25pY2FsXCIpXG4gICk7XG4gIGNvbnN0IHJvYm90c01ldGEgPSBtZXRhVGFnc1xuICAgIC5maWx0ZXIoKGF0dHJzKSA9PiBTdHJpbmcoYXR0cnMubmFtZSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpID09PSBcInJvYm90c1wiKVxuICAgIC5tYXAoKGF0dHJzKSA9PiBTdHJpbmcoYXR0cnMuY29udGVudCB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpKVxuICAgIC5qb2luKFwiLCBcIik7XG4gIGNvbnN0IGRlc2NyaXB0aW9ucyA9IG1ldGFUYWdzLmZpbHRlcigoYXR0cnMpID0+XG4gICAgW1wiZGVzY3JpcHRpb25cIiwgXCJvZzpkZXNjcmlwdGlvblwiLCBcInR3aXR0ZXI6ZGVzY3JpcHRpb25cIl0uaW5jbHVkZXMoXG4gICAgICBTdHJpbmcoYXR0cnMubmFtZSB8fCBhdHRycy5wcm9wZXJ0eSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpXG4gICAgKVxuICApO1xuICBjb25zdCBtZXRhRGVzY3JpcHRpb25zID0gbWV0YVRhZ3MuZmlsdGVyKChhdHRycykgPT5cbiAgICBTdHJpbmcoYXR0cnMubmFtZSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpID09PSBcImRlc2NyaXB0aW9uXCJcbiAgKTtcbiAgY29uc3Qgb2dUYWdzID0gT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgIG1ldGFUYWdzXG4gICAgICAuZmlsdGVyKChhdHRycykgPT4gU3RyaW5nKGF0dHJzLnByb3BlcnR5IHx8IGF0dHJzLm5hbWUgfHwgXCJcIikudG9Mb3dlckNhc2UoKS5zdGFydHNXaXRoKFwib2c6XCIpKVxuICAgICAgLm1hcCgoYXR0cnMpID0+IFtTdHJpbmcoYXR0cnMucHJvcGVydHkgfHwgYXR0cnMubmFtZSkudG9Mb3dlckNhc2UoKSwgYXR0cnMuY29udGVudCB8fCBcIlwiXSlcbiAgKTtcbiAgY29uc3QgdHdpdHRlclRhZ3MgPSBPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgbWV0YVRhZ3NcbiAgICAgIC5maWx0ZXIoKGF0dHJzKSA9PiBTdHJpbmcoYXR0cnMubmFtZSB8fCBhdHRycy5wcm9wZXJ0eSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpLnN0YXJ0c1dpdGgoXCJ0d2l0dGVyOlwiKSlcbiAgICAgIC5tYXAoKGF0dHJzKSA9PiBbU3RyaW5nKGF0dHJzLm5hbWUgfHwgYXR0cnMucHJvcGVydHkpLnRvTG93ZXJDYXNlKCksIGF0dHJzLmNvbnRlbnQgfHwgXCJcIl0pXG4gICk7XG4gIGNvbnN0IGlzSHR0cHMgPSBiYXNlVXJsLnN0YXJ0c1dpdGgoXCJodHRwczpcIik7XG4gIGNvbnN0IGFsbERpc2NvdmVyZWQgPSBbLi4uZGlzY292ZXJlZC5saW5rcywgLi4uZGlzY292ZXJlZC5yZXNvdXJjZXNdO1xuICBjb25zdCBodHRwVXJscyA9IGFsbERpc2NvdmVyZWQuZmlsdGVyKCh1cmwpID0+IHVybC5zdGFydHNXaXRoKFwiaHR0cDovL1wiKSk7XG4gIGNvbnN0IGltYWdlSHR0cFVybHMgPSBpbWdUYWdzXG4gICAgLm1hcCgoYXR0cnMpID0+IGF0dHJzLnNyYylcbiAgICAuZmlsdGVyKChzcmMpID0+IHNyYyAmJiByZXNvbHZlVXJsKHNyYywgYmFzZVVybCk/LnN0YXJ0c1dpdGgoXCJodHRwOi8vXCIpKTtcbiAgY29uc3QgbWV0YVJlZnJlc2ggPSBtYXRjaFRhZ0Jsb2NrcyhodG1sLCBcIm1ldGFcIikuZmluZCgodGFnKSA9PlxuICAgIC9odHRwLWVxdWl2XFxzKj1cXHMqW1wiJ10/cmVmcmVzaC9pLnRlc3QodGFnKVxuICApO1xuXG4gIHJldHVybiB7XG4gICAgdGl0bGVDb3VudDogdGl0bGVUYWdzLmxlbmd0aCxcbiAgICB0aXRsZVRleHQ6IHRpdGxlVGFnc1swXSB8fCBcIlwiLFxuICAgIHRpdGxlTGVuZ3RoOiAodGl0bGVUYWdzWzBdIHx8IFwiXCIpLmxlbmd0aCxcbiAgICBoMUNvdW50OiBoMVRhZ3MubGVuZ3RoLFxuICAgIGgxVGV4dDogaDFUYWdzWzBdIHx8IFwiXCIsXG4gICAgbWV0YURlc2NyaXB0aW9uQ291bnQ6IG1ldGFEZXNjcmlwdGlvbnMubGVuZ3RoLFxuICAgIG1ldGFEZXNjcmlwdGlvblRleHQ6IG1ldGFEZXNjcmlwdGlvbnNbMF0/LmNvbnRlbnQgfHwgXCJcIixcbiAgICBtZXRhRGVzY3JpcHRpb25MZW5ndGg6IChtZXRhRGVzY3JpcHRpb25zWzBdPy5jb250ZW50IHx8IFwiXCIpLmxlbmd0aCxcbiAgICBhbnlEZXNjcmlwdGlvbkNvdW50OiBkZXNjcmlwdGlvbnMubGVuZ3RoLFxuICAgIGNhbm9uaWNhbFVybDogY2Fub25pY2FsPy5ocmVmID8gcmVzb2x2ZVVybChjYW5vbmljYWwuaHJlZiwgYmFzZVVybCkgOiBcIlwiLFxuICAgIHJvYm90c01ldGEsXG4gICAgbm9pbmRleDogL1xcYm5vaW5kZXhcXGIvaS50ZXN0KHJvYm90c01ldGEpLFxuICAgIG5vZm9sbG93OiAvXFxibm9mb2xsb3dcXGIvaS50ZXN0KHJvYm90c01ldGEpLFxuICAgIG9nVGFncyxcbiAgICB0d2l0dGVyVGFncyxcbiAgICBvZ01pc3NpbmdDb3VudDogY291bnRNaXNzaW5nKG9nVGFncywgW1wib2c6dGl0bGVcIiwgXCJvZzp0eXBlXCIsIFwib2c6aW1hZ2VcIiwgXCJvZzp1cmxcIiwgXCJvZzpkZXNjcmlwdGlvblwiXSksXG4gICAgdHdpdHRlck1pc3NpbmdDb3VudDogY291bnRNaXNzaW5nKHR3aXR0ZXJUYWdzLCBbXCJ0d2l0dGVyOmNhcmRcIiwgXCJ0d2l0dGVyOnRpdGxlXCIsIFwidHdpdHRlcjpkZXNjcmlwdGlvblwiLCBcInR3aXR0ZXI6aW1hZ2VcIl0pLFxuICAgIG9nTWlzc2luZ0FsbDogT2JqZWN0LmtleXMob2dUYWdzKS5sZW5ndGggPT09IDAsXG4gICAgdHdpdHRlck1pc3NpbmdBbGw6IE9iamVjdC5rZXlzKHR3aXR0ZXJUYWdzKS5sZW5ndGggPT09IDAsXG4gICAgaW1hZ2VDb3VudDogaW1nVGFncy5sZW5ndGgsXG4gICAgbWlzc2luZ0ltYWdlQWx0Q291bnQ6IGltZ1RhZ3MuZmlsdGVyKChhdHRycykgPT4gIVN0cmluZyhhdHRycy5hbHQgfHwgXCJcIikudHJpbSgpKS5sZW5ndGgsXG4gICAgbWl4ZWRDb250ZW50Q291bnQ6IGlzSHR0cHMgPyBodHRwVXJscy5sZW5ndGggOiAwLFxuICAgIGh0dHBJbWFnZUNvdW50OiBpc0h0dHBzID8gaW1hZ2VIdHRwVXJscy5sZW5ndGggOiAwLFxuICAgIG1ldGFSZWZyZXNoUmVkaXJlY3Q6IEJvb2xlYW4obWV0YVJlZnJlc2gpLFxuICAgIGxpbmtzQ291bnQ6IGRpc2NvdmVyZWQubGlua3MubGVuZ3RoLFxuICAgIHdvcmRDb3VudDogc3RyaXBUYWdzKGh0bWwpLnNwbGl0KC9cXHMrLykuZmlsdGVyKEJvb2xlYW4pLmxlbmd0aCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gbWF0Y2hBdHRyaWJ1dGVzKGh0bWwsIHRhZywgYXR0cikge1xuICBjb25zdCBtYXRjaGVzID0gW107XG4gIGNvbnN0IHRhZ1JlID0gbmV3IFJlZ0V4cChgPCR7dGFnfVxcXFxiW14+XSo+YCwgXCJnaVwiKTtcbiAgY29uc3QgYXR0clJlID0gbmV3IFJlZ0V4cChgJHthdHRyfVxcXFxzKj1cXFxccyooW1xcXCInXSkoLio/KVxcXFwxYCwgXCJpXCIpO1xuICBmb3IgKGNvbnN0IHRhZ01hdGNoIG9mIGh0bWwubWF0Y2hBbGwodGFnUmUpKSB7XG4gICAgY29uc3QgYXR0ck1hdGNoID0gdGFnTWF0Y2hbMF0ubWF0Y2goYXR0clJlKTtcbiAgICBpZiAoYXR0ck1hdGNoPy5bMl0pIG1hdGNoZXMucHVzaChkZWNvZGVIdG1sKGF0dHJNYXRjaFsyXS50cmltKCkpKTtcbiAgfVxuICByZXR1cm4gbWF0Y2hlcztcbn1cblxuZnVuY3Rpb24gbWF0Y2hUYWdzKGh0bWwsIHRhZykge1xuICBjb25zdCByZSA9IG5ldyBSZWdFeHAoYDwke3RhZ31cXFxcYltePl0qPltcXFxcc1xcXFxTXSo/PFxcXFwvJHt0YWd9PmAsIFwiZ2lcIik7XG4gIHJldHVybiBBcnJheS5mcm9tKGh0bWwubWF0Y2hBbGwocmUpLCAobWF0Y2gpID0+IG1hdGNoWzBdKTtcbn1cblxuZnVuY3Rpb24gbWF0Y2hUYWdCbG9ja3MoaHRtbCwgdGFnKSB7XG4gIGNvbnN0IHJlID0gbmV3IFJlZ0V4cChgPCR7dGFnfVxcXFxiW14+XSo+YCwgXCJnaVwiKTtcbiAgcmV0dXJuIEFycmF5LmZyb20oaHRtbC5tYXRjaEFsbChyZSksIChtYXRjaCkgPT4gbWF0Y2hbMF0pO1xufVxuXG5mdW5jdGlvbiBwYXJzZUF0dHJpYnV0ZXModGFnKSB7XG4gIGNvbnN0IGF0dHJzID0ge307XG4gIGNvbnN0IGF0dHJSZSA9IC8oW2EtekEtWl86XVstYS16QS1aMC05XzouXSopXFxzKj1cXHMqKD86XCIoW15cIl0qKVwifCcoW14nXSopJ3woW15cXHNcIic9PD5gXSspKS9nO1xuICBmb3IgKGNvbnN0IG1hdGNoIG9mIHRhZy5tYXRjaEFsbChhdHRyUmUpKSB7XG4gICAgYXR0cnNbbWF0Y2hbMV0udG9Mb3dlckNhc2UoKV0gPSBkZWNvZGVIdG1sKG1hdGNoWzJdIHx8IG1hdGNoWzNdIHx8IG1hdGNoWzRdIHx8IFwiXCIpO1xuICB9XG4gIHJldHVybiBhdHRycztcbn1cblxuZnVuY3Rpb24gc3RyaXBUYWdzKHZhbHVlKSB7XG4gIHJldHVybiBkZWNvZGVIdG1sKFN0cmluZyh2YWx1ZSkucmVwbGFjZSgvPFtePl0rPi9nLCBcIiBcIikucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikudHJpbSgpKTtcbn1cblxuZnVuY3Rpb24gY291bnRNaXNzaW5nKHNvdXJjZSwga2V5cykge1xuICByZXR1cm4ga2V5cy5maWx0ZXIoKGtleSkgPT4gIVN0cmluZyhzb3VyY2Vba2V5XSB8fCBcIlwiKS50cmltKCkpLmxlbmd0aDtcbn1cblxuZnVuY3Rpb24gcGFyc2VTcmNTZXQoc3Jjc2V0KSB7XG4gIHJldHVybiBTdHJpbmcoc3Jjc2V0KVxuICAgIC5zcGxpdChcIixcIilcbiAgICAubWFwKChwYXJ0KSA9PiBwYXJ0LnRyaW0oKS5zcGxpdCgvXFxzKy8pWzBdKVxuICAgIC5maWx0ZXIoQm9vbGVhbik7XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RTaXRlbWFwTG9jcyh4bWwsIGJhc2VVcmwpIHtcbiAgY29uc3QgdXJscyA9IG5ldyBTZXQoKTtcbiAgZm9yIChjb25zdCBtYXRjaCBvZiB4bWwubWF0Y2hBbGwoLzxsb2NbXj5dKj5cXHMqKFtePF0rKVxccyo8XFwvbG9jPi9naSkpIHtcbiAgICBhZGRSZXNvbHZlZCh1cmxzLCBkZWNvZGVIdG1sKG1hdGNoWzFdLnRyaW0oKSksIGJhc2VVcmwpO1xuICB9XG4gIHJldHVybiBBcnJheS5mcm9tKHVybHMpO1xufVxuXG5mdW5jdGlvbiBwYXJzZVJvYm90cyh0ZXh0LCBiYXNlVXJsKSB7XG4gIGNvbnN0IHNpdGVtYXBzID0gbmV3IFNldCgpO1xuICBjb25zdCBkaXNhbGxvdyA9IG5ldyBTZXQoKTtcblxuICBmb3IgKGNvbnN0IHJhd0xpbmUgb2YgdGV4dC5zcGxpdCgvXFxyP1xcbi8pKSB7XG4gICAgY29uc3QgbGluZSA9IHJhd0xpbmUucmVwbGFjZSgvIy4qLywgXCJcIikudHJpbSgpO1xuICAgIGNvbnN0IHNpdGVtYXAgPSBsaW5lLm1hdGNoKC9ec2l0ZW1hcDpcXHMqKC4rKSQvaSk7XG4gICAgaWYgKHNpdGVtYXApIGFkZFJlc29sdmVkKHNpdGVtYXBzLCBzaXRlbWFwWzFdLnRyaW0oKSwgYmFzZVVybCk7XG5cbiAgICBjb25zdCBibG9ja2VkID0gbGluZS5tYXRjaCgvXmRpc2FsbG93OlxccyooLispJC9pKTtcbiAgICBpZiAoYmxvY2tlZCAmJiBibG9ja2VkWzFdLnRyaW0oKSkgZGlzYWxsb3cuYWRkKGJsb2NrZWRbMV0udHJpbSgpKTtcbiAgfVxuXG4gIHJldHVybiB7IHNpdGVtYXBzOiBBcnJheS5mcm9tKHNpdGVtYXBzKSwgZGlzYWxsb3c6IEFycmF5LmZyb20oZGlzYWxsb3cpIH07XG59XG5cbmZ1bmN0aW9uIGFkZFJlc29sdmVkKHNldCwgdmFsdWUsIGJhc2VVcmwpIHtcbiAgaWYgKCF2YWx1ZSB8fCAvXihtYWlsdG86fHRlbDp8amF2YXNjcmlwdDp8ZGF0YTp8YmxvYjopL2kudGVzdCh2YWx1ZSkpIHJldHVybjtcbiAgY29uc3QgcmVzb2x2ZWQgPSByZXNvbHZlVXJsKHZhbHVlLCBiYXNlVXJsKTtcbiAgaWYgKHJlc29sdmVkKSBzZXQuYWRkKHJlc29sdmVkKTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVVybCh2YWx1ZSwgYmFzZVVybCkge1xuICBpZiAoIXZhbHVlIHx8IC9eKG1haWx0bzp8dGVsOnxqYXZhc2NyaXB0OnxkYXRhOnxibG9iOikvaS50ZXN0KHZhbHVlKSkgcmV0dXJuIFwiXCI7XG4gIHRyeSB7XG4gICAgY29uc3QgdXJsID0gbmV3IFVSTCh2YWx1ZSwgYmFzZVVybCk7XG4gICAgdXJsLmhhc2ggPSBcIlwiO1xuICAgIHJldHVybiB1cmwudG9TdHJpbmcoKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gZGVjb2RlSHRtbCh2YWx1ZSkge1xuICByZXR1cm4gU3RyaW5nKHZhbHVlKVxuICAgIC5yZXBsYWNlKC8mYW1wOy9nLCBcIiZcIilcbiAgICAucmVwbGFjZSgvJmx0Oy9nLCBcIjxcIilcbiAgICAucmVwbGFjZSgvJmd0Oy9nLCBcIj5cIilcbiAgICAucmVwbGFjZSgvJnF1b3Q7L2csIFwiXFxcIlwiKVxuICAgIC5yZXBsYWNlKC8mIzM5Oy9nLCBcIidcIik7XG59XG5cbmZ1bmN0aW9uIHJlYWRKc29uQm9keShyZXEpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgbGV0IGRhdGEgPSBcIlwiO1xuICAgIHJlcS5vbihcImRhdGFcIiwgKGNodW5rKSA9PiB7XG4gICAgICBkYXRhICs9IGNodW5rO1xuICAgIH0pO1xuICAgIHJlcS5vbihcImVuZFwiLCAoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICByZXNvbHZlKGRhdGEgPyBKU09OLnBhcnNlKGRhdGEpIDoge30pO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIHJlc29sdmUoe30pO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gcmVhZFJhd0JvZHkocmVxKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgIGNvbnN0IGNodW5rcyA9IFtdO1xuICAgIHJlcS5vbihcImRhdGFcIiwgKGNodW5rKSA9PiBjaHVua3MucHVzaChCdWZmZXIuZnJvbShjaHVuaykpKTtcbiAgICByZXEub24oXCJlbmRcIiwgKCkgPT4gcmVzb2x2ZShCdWZmZXIuY29uY2F0KGNodW5rcykudG9TdHJpbmcoXCJ1dGY4XCIpKSk7XG4gIH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBjcmVhdGVXZWJSZXF1ZXN0KHJlcSwgbW91bnRQYXRoKSB7XG4gIGNvbnN0IGhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuICBPYmplY3QuZW50cmllcyhyZXEuaGVhZGVycyB8fCB7fSkuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSBoZWFkZXJzLnNldChrZXksIHZhbHVlLmpvaW4oXCIsIFwiKSk7XG4gICAgZWxzZSBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkgaGVhZGVycy5zZXQoa2V5LCBTdHJpbmcodmFsdWUpKTtcbiAgfSk7XG5cbiAgY29uc3QgbWV0aG9kID0gcmVxLm1ldGhvZCB8fCBcIkdFVFwiO1xuICBjb25zdCBpbml0ID0geyBtZXRob2QsIGhlYWRlcnMgfTtcbiAgaWYgKCFbXCJHRVRcIiwgXCJIRUFEXCJdLmluY2x1ZGVzKG1ldGhvZCkpIHtcbiAgICBpbml0LmJvZHkgPSBhd2FpdCByZWFkUmF3Qm9keShyZXEpO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBSZXF1ZXN0KG1vdW50ZWRVcmwocmVxLCBtb3VudFBhdGgpLCBpbml0KTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlTm9kZUpzb25SZXNwb25zZShyZXMpIHtcbiAgcmV0dXJuIHtcbiAgICBzZXRIZWFkZXIobmFtZSwgdmFsdWUpIHtcbiAgICAgIHJlcy5zZXRIZWFkZXIobmFtZSwgdmFsdWUpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBzdGF0dXMoc3RhdHVzQ29kZSkge1xuICAgICAgcmVzLnN0YXR1c0NvZGUgPSBzdGF0dXNDb2RlO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBqc29uKHBheWxvYWQpIHtcbiAgICAgIHJlcy5zZXRIZWFkZXIoXCJjb250ZW50LXR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PXV0Zi04XCIpO1xuICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShwYXlsb2FkKSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIGVuZChwYXlsb2FkKSB7XG4gICAgICByZXMuZW5kKHBheWxvYWQpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2VuZFdlYlJlc3BvbnNlKHJlcywgcmVzcG9uc2UpIHtcbiAgcmVzLnN0YXR1c0NvZGUgPSByZXNwb25zZS5zdGF0dXM7XG4gIHJlc3BvbnNlLmhlYWRlcnMuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuICAgIHJlcy5zZXRIZWFkZXIoa2V5LCB2YWx1ZSk7XG4gIH0pO1xuICByZXMuZW5kKEJ1ZmZlci5mcm9tKGF3YWl0IHJlc3BvbnNlLmFycmF5QnVmZmVyKCkpKTtcbn1cblxuZnVuY3Rpb24gc2VuZEpzb24ocmVzLCBzdGF0dXMsIHBheWxvYWQpIHtcbiAgcmVzLnN0YXR1c0NvZGUgPSBzdGF0dXM7XG4gIHJlcy5zZXRIZWFkZXIoXCJjb250ZW50LXR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PXV0Zi04XCIpO1xuICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHBheWxvYWQpKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCksIHByb3h5QXBpUGx1Z2luKCksIGRlZXBzZWVrQXBpUGx1Z2luKCksIGZldGNoVXJsTWV0YUFwaVBsdWdpbigpLCB3ZWJtYXN0ZXJBcGlQbHVnaW4oKSwgYXV0b2NvbXBsZXRlQXBpUGx1Z2luKCksIGdzY1Rva2VuQXBpUGx1Z2luKCksIGNyYXdsZXJBcGlQbHVnaW4oKV0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDUxNzMsXG4gICAgaG9zdDogdHJ1ZSxcbiAgfSxcbn0pO1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhbGVlbVxcXFxPbmVEcml2ZVxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXHNlb3hcXFxcZnVuY3Rpb25zXFxcXF9saWJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGFsZWVtXFxcXE9uZURyaXZlXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxcc2VveFxcXFxmdW5jdGlvbnNcXFxcX2xpYlxcXFxodHRwLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9hbGVlbS9PbmVEcml2ZS9Eb2N1bWVudHMvR2l0SHViL3Nlb3gvZnVuY3Rpb25zL19saWIvaHR0cC5qc1wiO2V4cG9ydCBmdW5jdGlvbiBjb3JzSGVhZGVycyhtZXRob2RzID0gXCJHRVQsIFBPU1QsIE9QVElPTlNcIikge1xuICByZXR1cm4ge1xuICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCI6IFwiKlwiLFxuICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kc1wiOiBtZXRob2RzLFxuICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVyc1wiOiBcIkNvbnRlbnQtVHlwZSwgQXV0aG9yaXphdGlvblwiLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24ganNvblJlc3BvbnNlKHBheWxvYWQsIHN0YXR1cyA9IDIwMCwgaGVhZGVycyA9IHt9KSB7XG4gIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkocGF5bG9hZCksIHtcbiAgICBzdGF0dXMsXG4gICAgaGVhZGVyczoge1xuICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PXV0Zi04XCIsXG4gICAgICAuLi5oZWFkZXJzLFxuICAgIH0sXG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZW1wdHlSZXNwb25zZShzdGF0dXMgPSAyMDQsIGhlYWRlcnMgPSB7fSkge1xuICByZXR1cm4gbmV3IFJlc3BvbnNlKG51bGwsIHsgc3RhdHVzLCBoZWFkZXJzIH0pO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVhZEpzb24ocmVxdWVzdCkge1xuICB0cnkge1xuICAgIHJldHVybiBhd2FpdCByZXF1ZXN0Lmpzb24oKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHt9O1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlcnJvclJlc3BvbnNlKGVycm9yLCBoZWFkZXJzID0ge30pIHtcbiAgaWYgKChlcnJvcj8uc3RhdHVzIHx8IDUwMCkgPj0gNTAwKSBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgcmV0dXJuIGpzb25SZXNwb25zZShcbiAgICB7IGVycm9yOiBlcnJvcj8ubWVzc2FnZSB8fCBcIkludGVybmFsIHNlcnZlciBlcnJvclwiIH0sXG4gICAgZXJyb3I/LnN0YXR1cyB8fCA1MDAsXG4gICAgaGVhZGVyc1xuICApO1xufVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhbGVlbVxcXFxPbmVEcml2ZVxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXHNlb3hcXFxcZnVuY3Rpb25zXFxcXGFwaVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcYWxlZW1cXFxcT25lRHJpdmVcXFxcRG9jdW1lbnRzXFxcXEdpdEh1YlxcXFxzZW94XFxcXGZ1bmN0aW9uc1xcXFxhcGlcXFxcYXV0b2NvbXBsZXRlLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9hbGVlbS9PbmVEcml2ZS9Eb2N1bWVudHMvR2l0SHViL3Nlb3gvZnVuY3Rpb25zL2FwaS9hdXRvY29tcGxldGUuanNcIjtpbXBvcnQge1xuICBjb3JzSGVhZGVycyxcbiAgZW1wdHlSZXNwb25zZSxcbiAgZXJyb3JSZXNwb25zZSxcbiAganNvblJlc3BvbnNlLFxufSBmcm9tIFwiLi4vX2xpYi9odHRwLmpzXCI7XG5cbmZ1bmN0aW9uIHBhcnNlR29vZ2xlU3VnZ2VzdGlvbnModmFsdWUpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZSh2YWx1ZSk7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGRhdGEpIHx8ICFBcnJheS5pc0FycmF5KGRhdGFbMV0pKSByZXR1cm4gW107XG5cbiAgICByZXR1cm4gZGF0YVsxXVxuICAgICAgLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGl0ZW0gPT09IFwic3RyaW5nXCIpIHJldHVybiBpdGVtO1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShpdGVtKSAmJiB0eXBlb2YgaXRlbVswXSA9PT0gXCJzdHJpbmdcIikgcmV0dXJuIGl0ZW1bMF07XG4gICAgICAgIHJldHVybiBcIlwiO1xuICAgICAgfSlcbiAgICAgIC5maWx0ZXIoQm9vbGVhbik7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBbXTtcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gb25SZXF1ZXN0KHsgcmVxdWVzdCB9KSB7XG4gIGNvbnN0IGhlYWRlcnMgPSB7XG4gICAgLi4uY29yc0hlYWRlcnMoXCJHRVQsIE9QVElPTlNcIiksXG4gICAgXCJDYWNoZS1Db250cm9sXCI6IFwibm8tc3RvcmVcIixcbiAgfTtcblxuICBpZiAocmVxdWVzdC5tZXRob2QgPT09IFwiT1BUSU9OU1wiKSByZXR1cm4gZW1wdHlSZXNwb25zZSgyMDQsIGhlYWRlcnMpO1xuICBpZiAocmVxdWVzdC5tZXRob2QgIT09IFwiR0VUXCIpIHtcbiAgICByZXR1cm4ganNvblJlc3BvbnNlKHsgZXJyb3I6IFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIgfSwgNDA1LCBoZWFkZXJzKTtcbiAgfVxuXG4gIGNvbnN0IHVybCA9IG5ldyBVUkwocmVxdWVzdC51cmwpO1xuICBjb25zdCBxdWVyeSA9IHVybC5zZWFyY2hQYXJhbXMuZ2V0KFwicVwiKT8udHJpbSgpO1xuICBjb25zdCBobCA9IHVybC5zZWFyY2hQYXJhbXMuZ2V0KFwiaGxcIikgfHwgXCJlblwiO1xuICBjb25zdCBnbCA9IHVybC5zZWFyY2hQYXJhbXMuZ2V0KFwiZ2xcIikgfHwgXCJVU1wiO1xuXG4gIGlmICghcXVlcnkpIHtcbiAgICByZXR1cm4ganNvblJlc3BvbnNlKHsgZXJyb3I6ICdRdWVyeSBwYXJhbWV0ZXIgXCJxXCIgaXMgcmVxdWlyZWQnIH0sIDQwMCwgaGVhZGVycyk7XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgICAgcTogcXVlcnksXG4gICAgICBobCxcbiAgICAgIGdsLFxuICAgICAgY2xpZW50OiBcImNocm9tZVwiLFxuICAgICAgeGhyOiBcInRcIixcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vd3d3Lmdvb2dsZS5jb20vY29tcGxldGUvc2VhcmNoPyR7cGFyYW1zfWAsIHtcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgXCJBY2NlcHRcIjogXCJhcHBsaWNhdGlvbi9qc29uLCB0ZXh0L2phdmFzY3JpcHQsICovKjsgcT0wLjAxXCIsXG4gICAgICAgIFwiQWNjZXB0LUxhbmd1YWdlXCI6IGAke2hsfSxlbjtxPTAuOGAsXG4gICAgICAgIFwiVXNlci1BZ2VudFwiOlxuICAgICAgICAgIFwiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV2luNjQ7IHg2NCkgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzEyMC4wLjAuMCBTYWZhcmkvNTM3LjM2XCIsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgcmV0dXJuIGpzb25SZXNwb25zZShcbiAgICAgICAgeyBlcnJvcjogYEdvb2dsZSBhdXRvY29tcGxldGUgcmV0dXJuZWQgSFRUUCAke3Jlc3BvbnNlLnN0YXR1c31gIH0sXG4gICAgICAgIDUwMixcbiAgICAgICAgaGVhZGVyc1xuICAgICAgKTtcbiAgICB9XG5cbiAgICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuICAgIHJldHVybiBqc29uUmVzcG9uc2UoXG4gICAgICB7XG4gICAgICAgIHF1ZXJ5LFxuICAgICAgICBobCxcbiAgICAgICAgZ2wsXG4gICAgICAgIHN1Z2dlc3Rpb25zOiBwYXJzZUdvb2dsZVN1Z2dlc3Rpb25zKHRleHQpLFxuICAgICAgfSxcbiAgICAgIDIwMCxcbiAgICAgIGhlYWRlcnNcbiAgICApO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBlcnJvclJlc3BvbnNlKGVycm9yLCBoZWFkZXJzKTtcbiAgfVxufVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhbGVlbVxcXFxPbmVEcml2ZVxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXHNlb3hcXFxcZnVuY3Rpb25zXFxcXF9saWJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGFsZWVtXFxcXE9uZURyaXZlXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxcc2VveFxcXFxmdW5jdGlvbnNcXFxcX2xpYlxcXFxmaXJlYmFzZS1yZXN0LmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9hbGVlbS9PbmVEcml2ZS9Eb2N1bWVudHMvR2l0SHViL3Nlb3gvZnVuY3Rpb25zL19saWIvZmlyZWJhc2UtcmVzdC5qc1wiO2ltcG9ydCB7XG4gIGRlY29kZVByb3RlY3RlZEhlYWRlcixcbiAgaW1wb3J0UEtDUzgsXG4gIGltcG9ydFg1MDksXG4gIGp3dFZlcmlmeSxcbiAgU2lnbkpXVCxcbn0gZnJvbSBcImpvc2VcIjtcblxuY29uc3QgR09PR0xFX1RPS0VOX1VSTCA9IFwiaHR0cHM6Ly9vYXV0aDIuZ29vZ2xlYXBpcy5jb20vdG9rZW5cIjtcbmNvbnN0IEZJUkVCQVNFX0NFUlRTX1VSTCA9XG4gIFwiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vcm9ib3QvdjEvbWV0YWRhdGEveDUwOS9zZWN1cmV0b2tlbkBzeXN0ZW0uZ3NlcnZpY2VhY2NvdW50LmNvbVwiO1xuY29uc3QgR09PR0xFX1NDT1BFUyA9IFtcbiAgXCJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9hdXRoL2RhdGFzdG9yZVwiLFxuICBcImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL2F1dGgvaWRlbnRpdHl0b29sa2l0XCIsXG5dO1xuY29uc3QgREVGQVVMVF9GSVJFQkFTRV9QUk9KRUNUX0lEID0gXCJzZW94LTg5NjYxXCI7XG5cbmxldCBhY2Nlc3NUb2tlbkNhY2hlID0gbnVsbDtcbmxldCBjZXJ0aWZpY2F0ZUNhY2hlID0gbnVsbDtcblxuZnVuY3Rpb24gY29uZmlndXJhdGlvbkVycm9yKG1lc3NhZ2UpIHtcbiAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IobWVzc2FnZSk7XG4gIGVycm9yLnN0YXR1cyA9IDUwMDtcbiAgcmV0dXJuIGVycm9yO1xufVxuXG5mdW5jdGlvbiBwYXJzZVNlcnZpY2VBY2NvdW50KGVudikge1xuICBsZXQgYWNjb3VudCA9IHt9O1xuXG4gIGlmIChlbnYuRklSRUJBU0VfU0VSVklDRV9BQ0NPVU5UX0tFWSkge1xuICAgIHRyeSB7XG4gICAgICBhY2NvdW50ID0gSlNPTi5wYXJzZShlbnYuRklSRUJBU0VfU0VSVklDRV9BQ0NPVU5UX0tFWSk7XG4gICAgfSBjYXRjaCB7XG4gICAgICB0aHJvdyBjb25maWd1cmF0aW9uRXJyb3IoXCJGSVJFQkFTRV9TRVJWSUNFX0FDQ09VTlRfS0VZIGlzIG5vdCB2YWxpZCBKU09OXCIpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHByb2plY3RJZCA9XG4gICAgYWNjb3VudC5wcm9qZWN0X2lkIHx8XG4gICAgYWNjb3VudC5wcm9qZWN0SWQgfHxcbiAgICBlbnYuRklSRUJBU0VfUFJPSkVDVF9JRCB8fFxuICAgIGVudi5WSVRFX0ZJUkVCQVNFX1BST0pFQ1RfSUQgfHxcbiAgICBlbnYuR0NMT1VEX1BST0pFQ1QgfHxcbiAgICBlbnYuR09PR0xFX0NMT1VEX1BST0pFQ1QgfHxcbiAgICBERUZBVUxUX0ZJUkVCQVNFX1BST0pFQ1RfSUQ7XG4gIGNvbnN0IGNsaWVudEVtYWlsID1cbiAgICBhY2NvdW50LmNsaWVudF9lbWFpbCB8fCBhY2NvdW50LmNsaWVudEVtYWlsIHx8IGVudi5GSVJFQkFTRV9DTElFTlRfRU1BSUw7XG4gIGNvbnN0IHByaXZhdGVLZXkgPVxuICAgIGFjY291bnQucHJpdmF0ZV9rZXkgfHwgYWNjb3VudC5wcml2YXRlS2V5IHx8IGVudi5GSVJFQkFTRV9QUklWQVRFX0tFWTtcblxuICByZXR1cm4ge1xuICAgIHByb2plY3RJZCxcbiAgICBjbGllbnRFbWFpbCxcbiAgICBwcml2YXRlS2V5OiBwcml2YXRlS2V5Py5yZXBsYWNlKC9cXFxcbi9nLCBcIlxcblwiKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEZpcmViYXNlUHJvamVjdElkKGVudikge1xuICBjb25zdCB7IHByb2plY3RJZCB9ID0gcGFyc2VTZXJ2aWNlQWNjb3VudChlbnYpO1xuICBpZiAoIXByb2plY3RJZCkge1xuICAgIHRocm93IGNvbmZpZ3VyYXRpb25FcnJvcihcIkZpcmViYXNlIHByb2plY3QgaWQgaXMgbm90IGNvbmZpZ3VyZWRcIik7XG4gIH1cbiAgcmV0dXJuIHByb2plY3RJZDtcbn1cblxuZnVuY3Rpb24gZ2V0U2VydmljZUFjY291bnQoZW52KSB7XG4gIGNvbnN0IGFjY291bnQgPSBwYXJzZVNlcnZpY2VBY2NvdW50KGVudik7XG4gIGlmICghYWNjb3VudC5wcm9qZWN0SWQgfHwgIWFjY291bnQuY2xpZW50RW1haWwgfHwgIWFjY291bnQucHJpdmF0ZUtleSkge1xuICAgIHRocm93IGNvbmZpZ3VyYXRpb25FcnJvcihcIkZpcmViYXNlIHNlcnZpY2UgYWNjb3VudCBjcmVkZW50aWFscyBhcmUgbm90IGNvbmZpZ3VyZWRcIik7XG4gIH1cbiAgcmV0dXJuIGFjY291bnQ7XG59XG5cbmZ1bmN0aW9uIGdldEJlYXJlclRva2VuKHJlcXVlc3QpIHtcbiAgY29uc3QgaGVhZGVyID0gcmVxdWVzdC5oZWFkZXJzLmdldChcImF1dGhvcml6YXRpb25cIikgfHwgXCJcIjtcbiAgcmV0dXJuIGhlYWRlci5zdGFydHNXaXRoKFwiQmVhcmVyIFwiKSA/IGhlYWRlci5zbGljZSg3KSA6IFwiXCI7XG59XG5cbmZ1bmN0aW9uIHBhcnNlTWF4QWdlKHZhbHVlKSB7XG4gIGNvbnN0IG1hdGNoID0gU3RyaW5nKHZhbHVlIHx8IFwiXCIpLm1hdGNoKC9tYXgtYWdlPShcXGQrKS9pKTtcbiAgcmV0dXJuIG1hdGNoID8gTnVtYmVyKG1hdGNoWzFdKSA6IDM2MDA7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldEZpcmViYXNlQ2VydGlmaWNhdGVzKCkge1xuICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICBpZiAoY2VydGlmaWNhdGVDYWNoZT8uZXhwaXJlc0F0ID4gbm93KSByZXR1cm4gY2VydGlmaWNhdGVDYWNoZS5jZXJ0aWZpY2F0ZXM7XG5cbiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChGSVJFQkFTRV9DRVJUU19VUkwpO1xuICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoXCJDb3VsZCBub3QgbG9hZCBGaXJlYmFzZSB0b2tlbiB2ZXJpZmljYXRpb24ga2V5c1wiKTtcbiAgICBlcnJvci5zdGF0dXMgPSA1MDI7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cblxuICBjb25zdCBjZXJ0aWZpY2F0ZXMgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gIGNlcnRpZmljYXRlQ2FjaGUgPSB7XG4gICAgY2VydGlmaWNhdGVzLFxuICAgIGV4cGlyZXNBdDogbm93ICsgcGFyc2VNYXhBZ2UocmVzcG9uc2UuaGVhZGVycy5nZXQoXCJjYWNoZS1jb250cm9sXCIpKSAqIDEwMDAsXG4gIH07XG4gIHJldHVybiBjZXJ0aWZpY2F0ZXM7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB2ZXJpZnlGaXJlYmFzZUlkVG9rZW4ocmVxdWVzdCwgZW52KSB7XG4gIGNvbnN0IHRva2VuID0gZ2V0QmVhcmVyVG9rZW4ocmVxdWVzdCk7XG4gIGlmICghdG9rZW4pIHtcbiAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihcIk1pc3NpbmcgRmlyZWJhc2UgYXV0aCB0b2tlblwiKTtcbiAgICBlcnJvci5zdGF0dXMgPSA0MDE7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cblxuICBjb25zdCBwcm9qZWN0SWQgPSBnZXRGaXJlYmFzZVByb2plY3RJZChlbnYpO1xuICBsZXQgcHJvdGVjdGVkSGVhZGVyO1xuICB0cnkge1xuICAgIHByb3RlY3RlZEhlYWRlciA9IGRlY29kZVByb3RlY3RlZEhlYWRlcih0b2tlbik7XG4gIH0gY2F0Y2gge1xuICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKFwiSW52YWxpZCBGaXJlYmFzZSBhdXRoIHRva2VuXCIpO1xuICAgIGVycm9yLnN0YXR1cyA9IDQwMTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuXG4gIGNvbnN0IHsgYWxnLCBraWQgfSA9IHByb3RlY3RlZEhlYWRlcjtcbiAgaWYgKGFsZyAhPT0gXCJSUzI1NlwiIHx8ICFraWQpIHtcbiAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihcIkludmFsaWQgRmlyZWJhc2UgYXV0aCB0b2tlblwiKTtcbiAgICBlcnJvci5zdGF0dXMgPSA0MDE7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cblxuICBjb25zdCBjZXJ0aWZpY2F0ZXMgPSBhd2FpdCBnZXRGaXJlYmFzZUNlcnRpZmljYXRlcygpO1xuICBjb25zdCBjZXJ0aWZpY2F0ZSA9IGNlcnRpZmljYXRlc1traWRdO1xuICBpZiAoIWNlcnRpZmljYXRlKSB7XG4gICAgY2VydGlmaWNhdGVDYWNoZSA9IG51bGw7XG4gICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoXCJGaXJlYmFzZSBhdXRoIHRva2VuIHVzZXMgYW4gdW5rbm93biBzaWduaW5nIGtleVwiKTtcbiAgICBlcnJvci5zdGF0dXMgPSA0MDE7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IGtleSA9IGF3YWl0IGltcG9ydFg1MDkoY2VydGlmaWNhdGUsIFwiUlMyNTZcIik7XG4gICAgY29uc3QgeyBwYXlsb2FkIH0gPSBhd2FpdCBqd3RWZXJpZnkodG9rZW4sIGtleSwge1xuICAgICAgYWxnb3JpdGhtczogW1wiUlMyNTZcIl0sXG4gICAgICBhdWRpZW5jZTogcHJvamVjdElkLFxuICAgICAgaXNzdWVyOiBgaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tLyR7cHJvamVjdElkfWAsXG4gICAgfSk7XG4gICAgY29uc3Qgbm93ID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG5cbiAgICBpZiAoIXBheWxvYWQuc3ViIHx8IHBheWxvYWQuc3ViLmxlbmd0aCA+IDEyOCB8fCBOdW1iZXIocGF5bG9hZC5hdXRoX3RpbWUpID4gbm93KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIEZpcmViYXNlIGF1dGggdG9rZW4gY2xhaW1zXCIpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAuLi5wYXlsb2FkLFxuICAgICAgdWlkOiBwYXlsb2FkLnN1YixcbiAgICB9O1xuICB9IGNhdGNoIChjYXVzZSkge1xuICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKFwiSW52YWxpZCBvciBleHBpcmVkIEZpcmViYXNlIGF1dGggdG9rZW5cIik7XG4gICAgZXJyb3Iuc3RhdHVzID0gNDAxO1xuICAgIGVycm9yLmNhdXNlID0gY2F1c2U7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn1cblxuZnVuY3Rpb24gcGFyc2VDc3YodmFsdWUpIHtcbiAgcmV0dXJuIFN0cmluZyh2YWx1ZSB8fCBcIlwiKVxuICAgIC5zcGxpdChcIixcIilcbiAgICAubWFwKChpdGVtKSA9PiBpdGVtLnRyaW0oKSlcbiAgICAuZmlsdGVyKEJvb2xlYW4pO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVUaWVyKHZhbHVlKSB7XG4gIGNvbnN0IHRpZXIgPSBTdHJpbmcodmFsdWUgfHwgXCJcIikudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gIGlmICh0aWVyID09PSBcImFkbWluXCIpIHJldHVybiBcImFkbWluXCI7XG4gIHJldHVybiB0aWVyO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXNzZXJ0QWRtaW4ocmVxdWVzdCwgZW52KSB7XG4gIGNvbnN0IGRlY29kZWQgPSBhd2FpdCB2ZXJpZnlGaXJlYmFzZUlkVG9rZW4ocmVxdWVzdCwgZW52KTtcbiAgY29uc3QgYWxsb3dlZEVtYWlscyA9IHBhcnNlQ3N2KGVudi5BRE1JTl9FTUFJTFMpO1xuXG4gIGlmIChcbiAgICBkZWNvZGVkLmFkbWluIHx8XG4gICAgbm9ybWFsaXplVGllcihkZWNvZGVkLmxldmVsIHx8IGRlY29kZWQucGxhbikgPT09IFwiYWRtaW5cIiB8fFxuICAgIGFsbG93ZWRFbWFpbHMuaW5jbHVkZXMoZGVjb2RlZC5lbWFpbClcbiAgKSB7XG4gICAgcmV0dXJuIGRlY29kZWQ7XG4gIH1cblxuICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihcIllvdSBkbyBub3QgaGF2ZSBhZG1pbiBhY2Nlc3NcIik7XG4gIGVycm9yLnN0YXR1cyA9IDQwMztcbiAgdGhyb3cgZXJyb3I7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUdvb2dsZUFjY2Vzc1Rva2VuKGVudikge1xuICBjb25zdCBhY2NvdW50ID0gZ2V0U2VydmljZUFjY291bnQoZW52KTtcbiAgY29uc3Qgbm93ID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG4gIGNvbnN0IHByaXZhdGVLZXkgPSBhd2FpdCBpbXBvcnRQS0NTOChhY2NvdW50LnByaXZhdGVLZXksIFwiUlMyNTZcIik7XG4gIGNvbnN0IGFzc2VydGlvbiA9IGF3YWl0IG5ldyBTaWduSldUKHtcbiAgICBzY29wZTogR09PR0xFX1NDT1BFUy5qb2luKFwiIFwiKSxcbiAgfSlcbiAgICAuc2V0UHJvdGVjdGVkSGVhZGVyKHsgYWxnOiBcIlJTMjU2XCIsIHR5cDogXCJKV1RcIiB9KVxuICAgIC5zZXRJc3N1ZXIoYWNjb3VudC5jbGllbnRFbWFpbClcbiAgICAuc2V0QXVkaWVuY2UoR09PR0xFX1RPS0VOX1VSTClcbiAgICAuc2V0SXNzdWVkQXQobm93KVxuICAgIC5zZXRFeHBpcmF0aW9uVGltZShub3cgKyAzNjAwKVxuICAgIC5zaWduKHByaXZhdGVLZXkpO1xuXG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goR09PR0xFX1RPS0VOX1VSTCwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiIH0sXG4gICAgYm9keTogbmV3IFVSTFNlYXJjaFBhcmFtcyh7XG4gICAgICBncmFudF90eXBlOiBcInVybjppZXRmOnBhcmFtczpvYXV0aDpncmFudC10eXBlOmp3dC1iZWFyZXJcIixcbiAgICAgIGFzc2VydGlvbixcbiAgICB9KSxcbiAgfSk7XG4gIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XG5cbiAgaWYgKCFyZXNwb25zZS5vayB8fCAhZGF0YS5hY2Nlc3NfdG9rZW4pIHtcbiAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihcbiAgICAgIGRhdGEuZXJyb3JfZGVzY3JpcHRpb24gfHwgZGF0YS5lcnJvciB8fCBcIkNvdWxkIG5vdCBhdXRoZW50aWNhdGUgRmlyZWJhc2Ugc2VydmljZSBhY2NvdW50XCJcbiAgICApO1xuICAgIGVycm9yLnN0YXR1cyA9IDUwMjtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuXG4gIGFjY2Vzc1Rva2VuQ2FjaGUgPSB7XG4gICAgdG9rZW46IGRhdGEuYWNjZXNzX3Rva2VuLFxuICAgIGV4cGlyZXNBdDogRGF0ZS5ub3coKSArIChOdW1iZXIoZGF0YS5leHBpcmVzX2luIHx8IDM2MDApIC0gNjApICogMTAwMCxcbiAgICBjbGllbnRFbWFpbDogYWNjb3VudC5jbGllbnRFbWFpbCxcbiAgfTtcbiAgcmV0dXJuIGFjY2Vzc1Rva2VuQ2FjaGUudG9rZW47XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldEdvb2dsZUFjY2Vzc1Rva2VuKGVudikge1xuICBjb25zdCBhY2NvdW50ID0gZ2V0U2VydmljZUFjY291bnQoZW52KTtcbiAgaWYgKFxuICAgIGFjY2Vzc1Rva2VuQ2FjaGU/LmV4cGlyZXNBdCA+IERhdGUubm93KCkgJiZcbiAgICBhY2Nlc3NUb2tlbkNhY2hlLmNsaWVudEVtYWlsID09PSBhY2NvdW50LmNsaWVudEVtYWlsXG4gICkge1xuICAgIHJldHVybiBhY2Nlc3NUb2tlbkNhY2hlLnRva2VuO1xuICB9XG4gIHJldHVybiBjcmVhdGVHb29nbGVBY2Nlc3NUb2tlbihlbnYpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnb29nbGVSZXF1ZXN0KGVudiwgdXJsLCBvcHRpb25zID0ge30sIHJldHJ5ID0gdHJ1ZSkge1xuICBjb25zdCB0b2tlbiA9IGF3YWl0IGdldEdvb2dsZUFjY2Vzc1Rva2VuKGVudik7XG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgLi4ub3B0aW9ucyxcbiAgICBoZWFkZXJzOiB7XG4gICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dG9rZW59YCxcbiAgICAgIC4uLihvcHRpb25zLmJvZHkgPyB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0gOiB7fSksXG4gICAgICAuLi4ob3B0aW9ucy5oZWFkZXJzIHx8IHt9KSxcbiAgICB9LFxuICB9KTtcbiAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcblxuICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MDEgJiYgcmV0cnkpIHtcbiAgICBhY2Nlc3NUb2tlbkNhY2hlID0gbnVsbDtcbiAgICByZXR1cm4gZ29vZ2xlUmVxdWVzdChlbnYsIHVybCwgb3B0aW9ucywgZmFsc2UpO1xuICB9XG5cbiAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKFxuICAgICAgZGF0YS5lcnJvcj8ubWVzc2FnZSB8fCBkYXRhLmVycm9yX2Rlc2NyaXB0aW9uIHx8IFwiRmlyZWJhc2UgQVBJIHJlcXVlc3QgZmFpbGVkXCJcbiAgICApO1xuICAgIGVycm9yLnN0YXR1cyA9IHJlc3BvbnNlLnN0YXR1cztcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuXG4gIHJldHVybiBkYXRhO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbGlzdEF1dGhVc2VycyhlbnYpIHtcbiAgY29uc3QgcHJvamVjdElkID0gZ2V0RmlyZWJhc2VQcm9qZWN0SWQoZW52KTtcbiAgY29uc3QgdXNlcnMgPSBbXTtcbiAgbGV0IG5leHRQYWdlVG9rZW4gPSBcIlwiO1xuXG4gIGRvIHtcbiAgICBjb25zdCB1cmwgPSBuZXcgVVJMKFxuICAgICAgYGh0dHBzOi8vaWRlbnRpdHl0b29sa2l0Lmdvb2dsZWFwaXMuY29tL3YxL3Byb2plY3RzLyR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICAgICAgICBwcm9qZWN0SWRcbiAgICAgICl9L2FjY291bnRzOmJhdGNoR2V0YFxuICAgICk7XG4gICAgdXJsLnNlYXJjaFBhcmFtcy5zZXQoXCJtYXhSZXN1bHRzXCIsIFwiMTAwMFwiKTtcbiAgICBpZiAobmV4dFBhZ2VUb2tlbikgdXJsLnNlYXJjaFBhcmFtcy5zZXQoXCJuZXh0UGFnZVRva2VuXCIsIG5leHRQYWdlVG9rZW4pO1xuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IGdvb2dsZVJlcXVlc3QoZW52LCB1cmwudG9TdHJpbmcoKSk7XG4gICAgdXNlcnMucHVzaCguLi4oZGF0YS51c2VycyB8fCBbXSkpO1xuICAgIG5leHRQYWdlVG9rZW4gPSBkYXRhLm5leHRQYWdlVG9rZW4gfHwgXCJcIjtcbiAgfSB3aGlsZSAobmV4dFBhZ2VUb2tlbik7XG5cbiAgcmV0dXJuIHVzZXJzO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9va3VwQXV0aFVzZXJzKGVudiwgbG9jYWxJZHMpIHtcbiAgY29uc3QgcHJvamVjdElkID0gZ2V0RmlyZWJhc2VQcm9qZWN0SWQoZW52KTtcbiAgY29uc3QgdXNlcnMgPSBbXTtcblxuICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgbG9jYWxJZHMubGVuZ3RoOyBpbmRleCArPSAxMDApIHtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgZ29vZ2xlUmVxdWVzdChcbiAgICAgIGVudixcbiAgICAgIGBodHRwczovL2lkZW50aXR5dG9vbGtpdC5nb29nbGVhcGlzLmNvbS92MS9wcm9qZWN0cy8ke2VuY29kZVVSSUNvbXBvbmVudChcbiAgICAgICAgcHJvamVjdElkXG4gICAgICApfS9hY2NvdW50czpsb29rdXBgLFxuICAgICAge1xuICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGxvY2FsSWQ6IGxvY2FsSWRzLnNsaWNlKGluZGV4LCBpbmRleCArIDEwMCkgfSksXG4gICAgICB9XG4gICAgKTtcbiAgICB1c2Vycy5wdXNoKC4uLihkYXRhLnVzZXJzIHx8IFtdKSk7XG4gIH1cblxuICByZXR1cm4gdXNlcnM7XG59XG5cbmZ1bmN0aW9uIGZpcmVzdG9yZUJhc2VVcmwoZW52KSB7XG4gIGNvbnN0IHByb2plY3RJZCA9IGdldEZpcmViYXNlUHJvamVjdElkKGVudik7XG4gIHJldHVybiBgaHR0cHM6Ly9maXJlc3RvcmUuZ29vZ2xlYXBpcy5jb20vdjEvcHJvamVjdHMvJHtlbmNvZGVVUklDb21wb25lbnQoXG4gICAgcHJvamVjdElkXG4gICl9L2RhdGFiYXNlcy8oZGVmYXVsdCkvZG9jdW1lbnRzYDtcbn1cblxuZnVuY3Rpb24gZW5jb2RlRG9jdW1lbnRQYXRoKHBhdGgpIHtcbiAgcmV0dXJuIFN0cmluZyhwYXRoKVxuICAgIC5zcGxpdChcIi9cIilcbiAgICAubWFwKChwYXJ0KSA9PiBlbmNvZGVVUklDb21wb25lbnQocGFydCkpXG4gICAgLmpvaW4oXCIvXCIpO1xufVxuXG5mdW5jdGlvbiBkZWNvZGVGaXJlc3RvcmVWYWx1ZSh2YWx1ZSA9IHt9KSB7XG4gIGlmIChcIm51bGxWYWx1ZVwiIGluIHZhbHVlKSByZXR1cm4gbnVsbDtcbiAgaWYgKFwic3RyaW5nVmFsdWVcIiBpbiB2YWx1ZSkgcmV0dXJuIHZhbHVlLnN0cmluZ1ZhbHVlO1xuICBpZiAoXCJib29sZWFuVmFsdWVcIiBpbiB2YWx1ZSkgcmV0dXJuIHZhbHVlLmJvb2xlYW5WYWx1ZTtcbiAgaWYgKFwiaW50ZWdlclZhbHVlXCIgaW4gdmFsdWUpIHJldHVybiBOdW1iZXIodmFsdWUuaW50ZWdlclZhbHVlKTtcbiAgaWYgKFwiZG91YmxlVmFsdWVcIiBpbiB2YWx1ZSkgcmV0dXJuIE51bWJlcih2YWx1ZS5kb3VibGVWYWx1ZSk7XG4gIGlmIChcInRpbWVzdGFtcFZhbHVlXCIgaW4gdmFsdWUpIHJldHVybiB2YWx1ZS50aW1lc3RhbXBWYWx1ZTtcbiAgaWYgKFwicmVmZXJlbmNlVmFsdWVcIiBpbiB2YWx1ZSkgcmV0dXJuIHZhbHVlLnJlZmVyZW5jZVZhbHVlO1xuICBpZiAoXCJieXRlc1ZhbHVlXCIgaW4gdmFsdWUpIHJldHVybiB2YWx1ZS5ieXRlc1ZhbHVlO1xuICBpZiAoXCJnZW9Qb2ludFZhbHVlXCIgaW4gdmFsdWUpIHJldHVybiB2YWx1ZS5nZW9Qb2ludFZhbHVlO1xuICBpZiAoXCJhcnJheVZhbHVlXCIgaW4gdmFsdWUpIHtcbiAgICByZXR1cm4gKHZhbHVlLmFycmF5VmFsdWUudmFsdWVzIHx8IFtdKS5tYXAoZGVjb2RlRmlyZXN0b3JlVmFsdWUpO1xuICB9XG4gIGlmIChcIm1hcFZhbHVlXCIgaW4gdmFsdWUpIHtcbiAgICByZXR1cm4gZGVjb2RlRmlyZXN0b3JlRmllbGRzKHZhbHVlLm1hcFZhbHVlLmZpZWxkcyB8fCB7fSk7XG4gIH1cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gZGVjb2RlRmlyZXN0b3JlRmllbGRzKGZpZWxkcyA9IHt9KSB7XG4gIHJldHVybiBPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgT2JqZWN0LmVudHJpZXMoZmllbGRzKS5tYXAoKFtrZXksIHZhbHVlXSkgPT4gW2tleSwgZGVjb2RlRmlyZXN0b3JlVmFsdWUodmFsdWUpXSlcbiAgKTtcbn1cblxuZnVuY3Rpb24gZGVjb2RlRmlyZXN0b3JlRG9jdW1lbnQoZG9jdW1lbnQpIHtcbiAgY29uc3QgbmFtZVBhcnRzID0gU3RyaW5nKGRvY3VtZW50Lm5hbWUgfHwgXCJcIikuc3BsaXQoXCIvXCIpO1xuICByZXR1cm4ge1xuICAgIGlkOiBuYW1lUGFydHNbbmFtZVBhcnRzLmxlbmd0aCAtIDFdIHx8IFwiXCIsXG4gICAgLi4uZGVjb2RlRmlyZXN0b3JlRmllbGRzKGRvY3VtZW50LmZpZWxkcyB8fCB7fSksXG4gIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsaXN0RmlyZXN0b3JlQ29sbGVjdGlvbihlbnYsIGNvbGxlY3Rpb24sIHBhZ2VTaXplID0gNTAwKSB7XG4gIGNvbnN0IGRvY3VtZW50cyA9IFtdO1xuICBsZXQgcGFnZVRva2VuID0gXCJcIjtcblxuICBkbyB7XG4gICAgY29uc3QgdXJsID0gbmV3IFVSTChcbiAgICAgIGAke2ZpcmVzdG9yZUJhc2VVcmwoZW52KX0vJHtlbmNvZGVEb2N1bWVudFBhdGgoY29sbGVjdGlvbil9YFxuICAgICk7XG4gICAgdXJsLnNlYXJjaFBhcmFtcy5zZXQoXCJwYWdlU2l6ZVwiLCBTdHJpbmcocGFnZVNpemUpKTtcbiAgICBpZiAocGFnZVRva2VuKSB1cmwuc2VhcmNoUGFyYW1zLnNldChcInBhZ2VUb2tlblwiLCBwYWdlVG9rZW4pO1xuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IGdvb2dsZVJlcXVlc3QoZW52LCB1cmwudG9TdHJpbmcoKSk7XG4gICAgZG9jdW1lbnRzLnB1c2goLi4uKGRhdGEuZG9jdW1lbnRzIHx8IFtdKS5tYXAoZGVjb2RlRmlyZXN0b3JlRG9jdW1lbnQpKTtcbiAgICBwYWdlVG9rZW4gPSBkYXRhLm5leHRQYWdlVG9rZW4gfHwgXCJcIjtcbiAgfSB3aGlsZSAocGFnZVRva2VuKTtcblxuICByZXR1cm4gZG9jdW1lbnRzO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVhZEZpcnN0Q29sbGVjdGlvbihlbnYsIGVudk5hbWUsIGZhbGxiYWNrcywgbGltaXQgPSA1MDApIHtcbiAgY29uc3QgY29uZmlndXJlZCA9IGVudltlbnZOYW1lXTtcbiAgY29uc3QgbmFtZXMgPSBbY29uZmlndXJlZCwgLi4uZmFsbGJhY2tzXS5maWx0ZXIoQm9vbGVhbik7XG5cbiAgZm9yIChjb25zdCBuYW1lIG9mIG5hbWVzKSB7XG4gICAgY29uc3QgZG9jdW1lbnRzID0gYXdhaXQgbGlzdEZpcmVzdG9yZUNvbGxlY3Rpb24oZW52LCBuYW1lLCBsaW1pdCk7XG4gICAgaWYgKGRvY3VtZW50cy5sZW5ndGggfHwgY29uZmlndXJlZCA9PT0gbmFtZSkgcmV0dXJuIGRvY3VtZW50cy5zbGljZSgwLCBsaW1pdCk7XG4gIH1cblxuICByZXR1cm4gW107XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRGaXJlc3RvcmVEb2N1bWVudChlbnYsIGNvbGxlY3Rpb24sIGRvY3VtZW50SWQpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgZ29vZ2xlUmVxdWVzdChcbiAgICAgIGVudixcbiAgICAgIGAke2ZpcmVzdG9yZUJhc2VVcmwoZW52KX0vJHtlbmNvZGVEb2N1bWVudFBhdGgoXG4gICAgICAgIGAke2NvbGxlY3Rpb259LyR7ZG9jdW1lbnRJZH1gXG4gICAgICApfWBcbiAgICApO1xuICAgIHJldHVybiBkZWNvZGVGaXJlc3RvcmVEb2N1bWVudChkYXRhKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoZXJyb3Iuc3RhdHVzID09PSA0MDQpIHJldHVybiBudWxsO1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBkZWxldGVGaXJlc3RvcmVEb2N1bWVudChlbnYsIGNvbGxlY3Rpb24sIGRvY3VtZW50SWQpIHtcbiAgdHJ5IHtcbiAgICBhd2FpdCBnb29nbGVSZXF1ZXN0KFxuICAgICAgZW52LFxuICAgICAgYCR7ZmlyZXN0b3JlQmFzZVVybChlbnYpfS8ke2VuY29kZURvY3VtZW50UGF0aChcbiAgICAgICAgYCR7Y29sbGVjdGlvbn0vJHtkb2N1bWVudElkfWBcbiAgICAgICl9YCxcbiAgICAgIHsgbWV0aG9kOiBcIkRFTEVURVwiIH1cbiAgICApO1xuICAgIHJldHVybiB0cnVlO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChlcnJvci5zdGF0dXMgPT09IDQwNCkgcmV0dXJuIGZhbHNlO1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmaXJlc3RvcmVUaW1lc3RhbXAodmFsdWUgPSBuZXcgRGF0ZSgpKSB7XG4gIHJldHVybiB7XG4gICAgX19maXJlc3RvcmVUeXBlOiBcInRpbWVzdGFtcFwiLFxuICAgIHZhbHVlOiB2YWx1ZSBpbnN0YW5jZW9mIERhdGUgPyB2YWx1ZS50b0lTT1N0cmluZygpIDogU3RyaW5nKHZhbHVlKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZW5jb2RlRmlyZXN0b3JlVmFsdWUodmFsdWUpIHtcbiAgaWYgKHZhbHVlPy5fX2ZpcmVzdG9yZVR5cGUgPT09IFwidGltZXN0YW1wXCIpIHtcbiAgICByZXR1cm4geyB0aW1lc3RhbXBWYWx1ZTogdmFsdWUudmFsdWUgfTtcbiAgfVxuICBpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHsgbnVsbFZhbHVlOiBudWxsIH07XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIpIHJldHVybiB7IHN0cmluZ1ZhbHVlOiB2YWx1ZSB9O1xuICBpZiAodHlwZW9mIHZhbHVlID09PSBcImJvb2xlYW5cIikgcmV0dXJuIHsgYm9vbGVhblZhbHVlOiB2YWx1ZSB9O1xuICBpZiAodHlwZW9mIHZhbHVlID09PSBcIm51bWJlclwiKSB7XG4gICAgcmV0dXJuIE51bWJlci5pc0ludGVnZXIodmFsdWUpXG4gICAgICA/IHsgaW50ZWdlclZhbHVlOiBTdHJpbmcodmFsdWUpIH1cbiAgICAgIDogeyBkb3VibGVWYWx1ZTogdmFsdWUgfTtcbiAgfVxuICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICByZXR1cm4geyBhcnJheVZhbHVlOiB7IHZhbHVlczogdmFsdWUubWFwKGVuY29kZUZpcmVzdG9yZVZhbHVlKSB9IH07XG4gIH1cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIikge1xuICAgIHJldHVybiB7IG1hcFZhbHVlOiB7IGZpZWxkczogZW5jb2RlRmlyZXN0b3JlRmllbGRzKHZhbHVlKSB9IH07XG4gIH1cbiAgcmV0dXJuIHsgc3RyaW5nVmFsdWU6IFN0cmluZyh2YWx1ZSkgfTtcbn1cblxuZnVuY3Rpb24gZW5jb2RlRmlyZXN0b3JlRmllbGRzKGZpZWxkcykge1xuICByZXR1cm4gT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgIE9iamVjdC5lbnRyaWVzKGZpZWxkcykubWFwKChba2V5LCB2YWx1ZV0pID0+IFtrZXksIGVuY29kZUZpcmVzdG9yZVZhbHVlKHZhbHVlKV0pXG4gICk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwYXRjaEZpcmVzdG9yZURvY3VtZW50KFxuICBlbnYsXG4gIGNvbGxlY3Rpb24sXG4gIGRvY3VtZW50SWQsXG4gIGZpZWxkc1xuKSB7XG4gIGNvbnN0IHVybCA9IG5ldyBVUkwoXG4gICAgYCR7ZmlyZXN0b3JlQmFzZVVybChlbnYpfS8ke2VuY29kZURvY3VtZW50UGF0aChgJHtjb2xsZWN0aW9ufS8ke2RvY3VtZW50SWR9YCl9YFxuICApO1xuICBmb3IgKGNvbnN0IGZpZWxkIG9mIE9iamVjdC5rZXlzKGZpZWxkcykpIHtcbiAgICB1cmwuc2VhcmNoUGFyYW1zLmFwcGVuZChcInVwZGF0ZU1hc2suZmllbGRQYXRoc1wiLCBmaWVsZCk7XG4gIH1cblxuICBjb25zdCBkYXRhID0gYXdhaXQgZ29vZ2xlUmVxdWVzdChlbnYsIHVybC50b1N0cmluZygpLCB7XG4gICAgbWV0aG9kOiBcIlBBVENIXCIsXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBmaWVsZHM6IGVuY29kZUZpcmVzdG9yZUZpZWxkcyhmaWVsZHMpIH0pLFxuICB9KTtcbiAgcmV0dXJuIGRlY29kZUZpcmVzdG9yZURvY3VtZW50KGRhdGEpO1xufVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhbGVlbVxcXFxPbmVEcml2ZVxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXHNlb3hcXFxcZnVuY3Rpb25zXFxcXGFwaVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcYWxlZW1cXFxcT25lRHJpdmVcXFxcRG9jdW1lbnRzXFxcXEdpdEh1YlxcXFxzZW94XFxcXGZ1bmN0aW9uc1xcXFxhcGlcXFxcZ3NjLXRva2VuLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9hbGVlbS9PbmVEcml2ZS9Eb2N1bWVudHMvR2l0SHViL3Nlb3gvZnVuY3Rpb25zL2FwaS9nc2MtdG9rZW4uanNcIjtpbXBvcnQge1xuICBkZWxldGVGaXJlc3RvcmVEb2N1bWVudCxcbiAgZ2V0RmlyZXN0b3JlRG9jdW1lbnQsXG4gIHBhdGNoRmlyZXN0b3JlRG9jdW1lbnQsXG4gIHZlcmlmeUZpcmViYXNlSWRUb2tlbixcbn0gZnJvbSBcIi4uL19saWIvZmlyZWJhc2UtcmVzdC5qc1wiO1xuaW1wb3J0IHtcbiAgY29yc0hlYWRlcnMsXG4gIGVtcHR5UmVzcG9uc2UsXG4gIGVycm9yUmVzcG9uc2UsXG4gIGpzb25SZXNwb25zZSxcbiAgcmVhZEpzb24sXG59IGZyb20gXCIuLi9fbGliL2h0dHAuanNcIjtcblxuY29uc3QgVE9LRU5fRU5EUE9JTlQgPSBcImh0dHBzOi8vb2F1dGgyLmdvb2dsZWFwaXMuY29tL3Rva2VuXCI7XG5jb25zdCBVU0VSSU5GT19FTkRQT0lOVCA9IFwiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vb2F1dGgyL3YyL3VzZXJpbmZvXCI7XG5jb25zdCBHT09HTEVfQVVUSF9FTkRQT0lOVCA9IFwiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tL28vb2F1dGgyL3YyL2F1dGhcIjtcbmNvbnN0IEdTQ19TQ09QRSA9IFwiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vYXV0aC93ZWJtYXN0ZXJzLnJlYWRvbmx5XCI7XG5cbmZ1bmN0aW9uIGdzY1Rva2VuQ29sbGVjdGlvbih1c2VySWQpIHtcbiAgcmV0dXJuIGB1c2Vycy8ke3VzZXJJZH0vZ3NjQ29ubmVjdGlvbmA7XG59XG5cbmZ1bmN0aW9uIGNsZWFuRmllbGRzKGZpZWxkcykge1xuICByZXR1cm4gT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgIE9iamVjdC5lbnRyaWVzKGZpZWxkcykuZmlsdGVyKChbLCB2YWx1ZV0pID0+IHZhbHVlICE9PSB1bmRlZmluZWQpXG4gICk7XG59XG5cbmZ1bmN0aW9uIGdldE9BdXRoQ29uZmlnKGVudikge1xuICByZXR1cm4ge1xuICAgIGNsaWVudElkOiBlbnYuR09PR0xFX0NMSUVOVF9JRCB8fCBlbnYuVklURV9HT09HTEVfQ0xJRU5UX0lELFxuICAgIGNsaWVudFNlY3JldDogZW52LkdPT0dMRV9DTElFTlRfU0VDUkVULFxuICB9O1xufVxuXG5mdW5jdGlvbiBlbmNvZGVTdGF0ZShwYXlsb2FkKSB7XG4gIGNvbnN0IGpzb24gPSBKU09OLnN0cmluZ2lmeShwYXlsb2FkIHx8IHt9KTtcbiAgaWYgKHR5cGVvZiBidG9hID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiBidG9hKGpzb24pO1xuICByZXR1cm4gQnVmZmVyLmZyb20oanNvbiwgXCJ1dGY4XCIpLnRvU3RyaW5nKFwiYmFzZTY0XCIpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVTZXJ2ZXJHc2NBdXRoVXJsKHsgY2xpZW50SWQsIHJlZGlyZWN0VXJpLCByZXR1cm5Ubywgc291cmNlIH0pIHtcbiAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7XG4gICAgY2xpZW50X2lkOiBjbGllbnRJZCxcbiAgICByZWRpcmVjdF91cmk6IHJlZGlyZWN0VXJpLFxuICAgIHJlc3BvbnNlX3R5cGU6IFwiY29kZVwiLFxuICAgIHNjb3BlOiBgJHtHU0NfU0NPUEV9IGh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL2F1dGgvdXNlcmluZm8uZW1haWxgLFxuICAgIGFjY2Vzc190eXBlOiBcIm9mZmxpbmVcIixcbiAgICBwcm9tcHQ6IFwiY29uc2VudFwiLFxuICAgIHN0YXRlOiBlbmNvZGVTdGF0ZSh7IHNvdXJjZTogc291cmNlIHx8IFwiZ3NjLWluc2lnaHRzXCIsIHJldHVyblRvOiByZXR1cm5UbyB8fCBcIi9nc2NcIiB9KSxcbiAgfSk7XG5cbiAgcmV0dXJuIGAke0dPT0dMRV9BVVRIX0VORFBPSU5UfT8ke3BhcmFtcy50b1N0cmluZygpfWA7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGZldGNoR29vZ2xlRW1haWwoYWNjZXNzVG9rZW4pIHtcbiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChVU0VSSU5GT19FTkRQT0lOVCwge1xuICAgIGhlYWRlcnM6IHsgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke2FjY2Vzc1Rva2VufWAgfSxcbiAgfSk7XG5cbiAgaWYgKCFyZXNwb25zZS5vaykgcmV0dXJuIG51bGw7XG4gIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XG4gIHJldHVybiBkYXRhLmVtYWlsIHx8IG51bGw7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlZnJlc2hTdG9yZWRUb2tlbnMoZW52LCB1c2VySWQsIHN0b3JlZFRva2Vucykge1xuICBpZiAoIXN0b3JlZFRva2Vucz8ucmVmcmVzaFRva2VuKSB7XG4gICAgcmV0dXJuIGpzb25SZXNwb25zZShcbiAgICAgIHsgZXJyb3I6IFwiTm8gcmVmcmVzaCB0b2tlbiBhdmFpbGFibGUuIFBsZWFzZSByZWNvbm5lY3QgU2VhcmNoIENvbnNvbGUuXCIgfSxcbiAgICAgIDQwMCxcbiAgICAgIGNvcnNIZWFkZXJzKFwiUE9TVCwgT1BUSU9OU1wiKVxuICAgICk7XG4gIH1cblxuICBjb25zdCB7IGNsaWVudElkLCBjbGllbnRTZWNyZXQgfSA9IGdldE9BdXRoQ29uZmlnKGVudik7XG4gIGNvbnN0IHJlZnJlc2hSZXNwb25zZSA9IGF3YWl0IGZldGNoKFRPS0VOX0VORFBPSU5ULCB7XG4gICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkXCIgfSxcbiAgICBib2R5OiBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcbiAgICAgIHJlZnJlc2hfdG9rZW46IHN0b3JlZFRva2Vucy5yZWZyZXNoVG9rZW4sXG4gICAgICBjbGllbnRfaWQ6IGNsaWVudElkLFxuICAgICAgY2xpZW50X3NlY3JldDogY2xpZW50U2VjcmV0LFxuICAgICAgZ3JhbnRfdHlwZTogXCJyZWZyZXNoX3Rva2VuXCIsXG4gICAgfSksXG4gIH0pO1xuXG4gIGNvbnN0IGRhdGEgPSBhd2FpdCByZWZyZXNoUmVzcG9uc2UuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuXG4gIGlmICghcmVmcmVzaFJlc3BvbnNlLm9rIHx8ICFkYXRhLmFjY2Vzc190b2tlbikge1xuICAgIGF3YWl0IGRlbGV0ZUZpcmVzdG9yZURvY3VtZW50KGVudiwgZ3NjVG9rZW5Db2xsZWN0aW9uKHVzZXJJZCksIFwidG9rZW5zXCIpO1xuICAgIHJldHVybiBqc29uUmVzcG9uc2UoXG4gICAgICB7XG4gICAgICAgIGVycm9yOiBcIlRva2VuIHJlZnJlc2ggZmFpbGVkLiBQbGVhc2UgcmVjb25uZWN0IFNlYXJjaCBDb25zb2xlLlwiLFxuICAgICAgICBkZXRhaWxzOiBkYXRhLFxuICAgICAgfSxcbiAgICAgIDQwMCxcbiAgICAgIGNvcnNIZWFkZXJzKFwiUE9TVCwgT1BUSU9OU1wiKVxuICAgICk7XG4gIH1cblxuICBjb25zdCBleHBpcmVzQXQgPSBEYXRlLm5vdygpICsgTnVtYmVyKGRhdGEuZXhwaXJlc19pbiB8fCAzNjAwKSAqIDEwMDA7XG4gIGNvbnN0IGdvb2dsZUVtYWlsID0gc3RvcmVkVG9rZW5zLmdvb2dsZUVtYWlsIHx8IChhd2FpdCBmZXRjaEdvb2dsZUVtYWlsKGRhdGEuYWNjZXNzX3Rva2VuKSk7XG5cbiAgYXdhaXQgcGF0Y2hGaXJlc3RvcmVEb2N1bWVudChlbnYsIGdzY1Rva2VuQ29sbGVjdGlvbih1c2VySWQpLCBcInRva2Vuc1wiLCB7XG4gICAgLi4uc3RvcmVkVG9rZW5zLFxuICAgIGFjY2Vzc1Rva2VuOiBkYXRhLmFjY2Vzc190b2tlbixcbiAgICBleHBpcmVzQXQsXG4gICAgZ29vZ2xlRW1haWwsXG4gICAgdXBkYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gIH0pO1xuXG4gIHJldHVybiBqc29uUmVzcG9uc2UoXG4gICAge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIGNvbm5lY3RlZDogdHJ1ZSxcbiAgICAgIGFjY2Vzc1Rva2VuOiBkYXRhLmFjY2Vzc190b2tlbixcbiAgICAgIGV4cGlyZXNBdCxcbiAgICAgIGdvb2dsZUVtYWlsLFxuICAgIH0sXG4gICAgMjAwLFxuICAgIGNvcnNIZWFkZXJzKFwiUE9TVCwgT1BUSU9OU1wiKVxuICApO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gb25SZXF1ZXN0KHsgcmVxdWVzdCwgZW52IH0pIHtcbiAgY29uc3QgaGVhZGVycyA9IHtcbiAgICAuLi5jb3JzSGVhZGVycyhcIlBPU1QsIE9QVElPTlNcIiksXG4gICAgXCJDYWNoZS1Db250cm9sXCI6IFwibm8tc3RvcmVcIixcbiAgfTtcblxuICBpZiAocmVxdWVzdC5tZXRob2QgPT09IFwiT1BUSU9OU1wiKSByZXR1cm4gZW1wdHlSZXNwb25zZSgyMDQsIGhlYWRlcnMpO1xuICBpZiAocmVxdWVzdC5tZXRob2QgIT09IFwiUE9TVFwiKSB7XG4gICAgcmV0dXJuIGpzb25SZXNwb25zZSh7IGVycm9yOiBcIk1ldGhvZCBub3QgYWxsb3dlZFwiIH0sIDQwNSwgaGVhZGVycyk7XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IGRlY29kZWQgPSBhd2FpdCB2ZXJpZnlGaXJlYmFzZUlkVG9rZW4ocmVxdWVzdCwgZW52KTtcbiAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZEpzb24ocmVxdWVzdCk7XG4gICAgY29uc3QgeyBhY3Rpb24sIGNvZGUsIHVzZXJJZCwgcmVkaXJlY3RVcmksIHJldHVyblRvLCBzb3VyY2UgfSA9IGJvZHk7XG4gICAgY29uc3Qgc2NvcGVkVXNlcklkID0gZGVjb2RlZC51aWQ7XG4gICAgY29uc3QgeyBjbGllbnRJZCwgY2xpZW50U2VjcmV0IH0gPSBnZXRPQXV0aENvbmZpZyhlbnYpO1xuXG4gICAgaWYgKCFjbGllbnRJZCB8fCAoYWN0aW9uICE9PSBcImF1dGgtdXJsXCIgJiYgIWNsaWVudFNlY3JldCkpIHtcbiAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoXG4gICAgICAgIHsgZXJyb3I6IFwiR29vZ2xlIE9BdXRoIGNyZWRlbnRpYWxzIGFyZSBub3QgY29uZmlndXJlZFwiIH0sXG4gICAgICAgIDUwMCxcbiAgICAgICAgaGVhZGVyc1xuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAoYWN0aW9uID09PSBcImF1dGgtdXJsXCIpIHtcbiAgICAgIGlmICghcmVkaXJlY3RVcmkpIHtcbiAgICAgICAgcmV0dXJuIGpzb25SZXNwb25zZSh7IGVycm9yOiBcIk1pc3NpbmcgcmVkaXJlY3QgVVJJXCIgfSwgNDAwLCBoZWFkZXJzKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGpzb25SZXNwb25zZShcbiAgICAgICAge1xuICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgYXV0aFVybDogY3JlYXRlU2VydmVyR3NjQXV0aFVybCh7XG4gICAgICAgICAgICBjbGllbnRJZCxcbiAgICAgICAgICAgIHJlZGlyZWN0VXJpLFxuICAgICAgICAgICAgcmV0dXJuVG8sXG4gICAgICAgICAgICBzb3VyY2UsXG4gICAgICAgICAgfSksXG4gICAgICAgIH0sXG4gICAgICAgIDIwMCxcbiAgICAgICAgaGVhZGVyc1xuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAoYWN0aW9uID09PSBcImV4Y2hhbmdlXCIpIHtcbiAgICAgIGlmICghY29kZSB8fCAhcmVkaXJlY3RVcmkpIHtcbiAgICAgICAgcmV0dXJuIGpzb25SZXNwb25zZSh7IGVycm9yOiBcIk1pc3NpbmcgcmVxdWlyZWQgcGFyYW1ldGVyc1wiIH0sIDQwMCwgaGVhZGVycyk7XG4gICAgICB9XG4gICAgICBpZiAodXNlcklkICYmIHVzZXJJZCAhPT0gc2NvcGVkVXNlcklkKSB7XG4gICAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoeyBlcnJvcjogXCJDYW5ub3QgY29ubmVjdCBTZWFyY2ggQ29uc29sZSBmb3IgYW5vdGhlciB1c2VyXCIgfSwgNDAzLCBoZWFkZXJzKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdG9rZW5SZXNwb25zZSA9IGF3YWl0IGZldGNoKFRPS0VOX0VORFBPSU5ULCB7XG4gICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgIGhlYWRlcnM6IHsgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWRcIiB9LFxuICAgICAgICBib2R5OiBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcbiAgICAgICAgICBjb2RlLFxuICAgICAgICAgIGNsaWVudF9pZDogY2xpZW50SWQsXG4gICAgICAgICAgY2xpZW50X3NlY3JldDogY2xpZW50U2VjcmV0LFxuICAgICAgICAgIHJlZGlyZWN0X3VyaTogcmVkaXJlY3RVcmksXG4gICAgICAgICAgZ3JhbnRfdHlwZTogXCJhdXRob3JpemF0aW9uX2NvZGVcIixcbiAgICAgICAgfSksXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgdG9rZW5zID0gYXdhaXQgdG9rZW5SZXNwb25zZS5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XG4gICAgICBpZiAoIXRva2VuUmVzcG9uc2Uub2sgfHwgIXRva2Vucy5hY2Nlc3NfdG9rZW4pIHtcbiAgICAgICAgcmV0dXJuIGpzb25SZXNwb25zZShcbiAgICAgICAgICB7IGVycm9yOiBcIlRva2VuIGV4Y2hhbmdlIGZhaWxlZFwiLCBkZXRhaWxzOiB0b2tlbnMgfSxcbiAgICAgICAgICA0MDAsXG4gICAgICAgICAgaGVhZGVyc1xuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwcmV2aW91cyA9IGF3YWl0IGdldEZpcmVzdG9yZURvY3VtZW50KFxuICAgICAgICBlbnYsXG4gICAgICAgIGdzY1Rva2VuQ29sbGVjdGlvbihzY29wZWRVc2VySWQpLFxuICAgICAgICBcInRva2Vuc1wiXG4gICAgICApO1xuICAgICAgY29uc3QgZXhwaXJlc0F0ID0gRGF0ZS5ub3coKSArIE51bWJlcih0b2tlbnMuZXhwaXJlc19pbiB8fCAzNjAwKSAqIDEwMDA7XG4gICAgICBjb25zdCBnb29nbGVFbWFpbCA9IGF3YWl0IGZldGNoR29vZ2xlRW1haWwodG9rZW5zLmFjY2Vzc190b2tlbik7XG5cbiAgICAgIGF3YWl0IHBhdGNoRmlyZXN0b3JlRG9jdW1lbnQoXG4gICAgICAgIGVudixcbiAgICAgICAgZ3NjVG9rZW5Db2xsZWN0aW9uKHNjb3BlZFVzZXJJZCksXG4gICAgICAgIFwidG9rZW5zXCIsXG4gICAgICAgIGNsZWFuRmllbGRzKHtcbiAgICAgICAgICBhY2Nlc3NUb2tlbjogdG9rZW5zLmFjY2Vzc190b2tlbixcbiAgICAgICAgICByZWZyZXNoVG9rZW46IHRva2Vucy5yZWZyZXNoX3Rva2VuIHx8IHByZXZpb3VzPy5yZWZyZXNoVG9rZW4gfHwgbnVsbCxcbiAgICAgICAgICBleHBpcmVzQXQsXG4gICAgICAgICAgZ29vZ2xlRW1haWw6IGdvb2dsZUVtYWlsIHx8IHByZXZpb3VzPy5nb29nbGVFbWFpbCB8fCBudWxsLFxuICAgICAgICAgIHVwZGF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICB9KVxuICAgICAgKTtcblxuICAgICAgcmV0dXJuIGpzb25SZXNwb25zZShcbiAgICAgICAge1xuICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgY29ubmVjdGVkOiB0cnVlLFxuICAgICAgICAgIGFjY2Vzc1Rva2VuOiB0b2tlbnMuYWNjZXNzX3Rva2VuLFxuICAgICAgICAgIGV4cGlyZXNBdCxcbiAgICAgICAgICBnb29nbGVFbWFpbDogZ29vZ2xlRW1haWwgfHwgcHJldmlvdXM/Lmdvb2dsZUVtYWlsIHx8IG51bGwsXG4gICAgICAgIH0sXG4gICAgICAgIDIwMCxcbiAgICAgICAgaGVhZGVyc1xuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAoYWN0aW9uID09PSBcImdldFwiKSB7XG4gICAgICBpZiAodXNlcklkICYmIHVzZXJJZCAhPT0gc2NvcGVkVXNlcklkKSB7XG4gICAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoeyBlcnJvcjogXCJDYW5ub3QgcmVhZCBTZWFyY2ggQ29uc29sZSB0b2tlbnMgZm9yIGFub3RoZXIgdXNlclwiIH0sIDQwMywgaGVhZGVycyk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHN0b3JlZFRva2VucyA9IGF3YWl0IGdldEZpcmVzdG9yZURvY3VtZW50KFxuICAgICAgICBlbnYsXG4gICAgICAgIGdzY1Rva2VuQ29sbGVjdGlvbihzY29wZWRVc2VySWQpLFxuICAgICAgICBcInRva2Vuc1wiXG4gICAgICApO1xuXG4gICAgICBpZiAoIXN0b3JlZFRva2Vucz8uYWNjZXNzVG9rZW4pIHtcbiAgICAgICAgcmV0dXJuIGpzb25SZXNwb25zZSh7IGNvbm5lY3RlZDogZmFsc2UgfSwgMjAwLCBoZWFkZXJzKTtcbiAgICAgIH1cblxuICAgICAgaWYgKE51bWJlcihzdG9yZWRUb2tlbnMuZXhwaXJlc0F0IHx8IDApIDw9IERhdGUubm93KCkgKyAxMjAwMDApIHtcbiAgICAgICAgcmV0dXJuIHJlZnJlc2hTdG9yZWRUb2tlbnMoZW52LCBzY29wZWRVc2VySWQsIHN0b3JlZFRva2Vucyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoXG4gICAgICAgIHtcbiAgICAgICAgICBjb25uZWN0ZWQ6IHRydWUsXG4gICAgICAgICAgYWNjZXNzVG9rZW46IHN0b3JlZFRva2Vucy5hY2Nlc3NUb2tlbixcbiAgICAgICAgICBleHBpcmVzQXQ6IHN0b3JlZFRva2Vucy5leHBpcmVzQXQsXG4gICAgICAgICAgZ29vZ2xlRW1haWw6IHN0b3JlZFRva2Vucy5nb29nbGVFbWFpbCB8fCBudWxsLFxuICAgICAgICB9LFxuICAgICAgICAyMDAsXG4gICAgICAgIGhlYWRlcnNcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKGFjdGlvbiA9PT0gXCJyZWZyZXNoXCIpIHtcbiAgICAgIGlmICh1c2VySWQgJiYgdXNlcklkICE9PSBzY29wZWRVc2VySWQpIHtcbiAgICAgICAgcmV0dXJuIGpzb25SZXNwb25zZSh7IGVycm9yOiBcIkNhbm5vdCByZWZyZXNoIFNlYXJjaCBDb25zb2xlIHRva2VucyBmb3IgYW5vdGhlciB1c2VyXCIgfSwgNDAzLCBoZWFkZXJzKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc3RvcmVkVG9rZW5zID0gYXdhaXQgZ2V0RmlyZXN0b3JlRG9jdW1lbnQoXG4gICAgICAgIGVudixcbiAgICAgICAgZ3NjVG9rZW5Db2xsZWN0aW9uKHNjb3BlZFVzZXJJZCksXG4gICAgICAgIFwidG9rZW5zXCJcbiAgICAgICk7XG4gICAgICByZXR1cm4gcmVmcmVzaFN0b3JlZFRva2VucyhlbnYsIHNjb3BlZFVzZXJJZCwgc3RvcmVkVG9rZW5zKTtcbiAgICB9XG5cbiAgICBpZiAoYWN0aW9uID09PSBcImRpc2Nvbm5lY3RcIikge1xuICAgICAgaWYgKHVzZXJJZCAmJiB1c2VySWQgIT09IHNjb3BlZFVzZXJJZCkge1xuICAgICAgICByZXR1cm4ganNvblJlc3BvbnNlKHsgZXJyb3I6IFwiQ2Fubm90IGRpc2Nvbm5lY3QgU2VhcmNoIENvbnNvbGUgZm9yIGFub3RoZXIgdXNlclwiIH0sIDQwMywgaGVhZGVycyk7XG4gICAgICB9XG4gICAgICBhd2FpdCBkZWxldGVGaXJlc3RvcmVEb2N1bWVudChlbnYsIGdzY1Rva2VuQ29sbGVjdGlvbihzY29wZWRVc2VySWQpLCBcInRva2Vuc1wiKTtcbiAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoeyBzdWNjZXNzOiB0cnVlIH0sIDIwMCwgaGVhZGVycyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGpzb25SZXNwb25zZSh7IGVycm9yOiBcIkludmFsaWQgYWN0aW9uXCIgfSwgNDAwLCBoZWFkZXJzKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZXJyb3JSZXNwb25zZShlcnJvciwgaGVhZGVycyk7XG4gIH1cbn1cbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcYWxlZW1cXFxcT25lRHJpdmVcXFxcRG9jdW1lbnRzXFxcXEdpdEh1YlxcXFxzZW94XFxcXGZ1bmN0aW9uc1xcXFxfbGliXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhbGVlbVxcXFxPbmVEcml2ZVxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXHNlb3hcXFxcZnVuY3Rpb25zXFxcXF9saWJcXFxccmVxdWVzdC1hdXRoLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9hbGVlbS9PbmVEcml2ZS9Eb2N1bWVudHMvR2l0SHViL3Nlb3gvZnVuY3Rpb25zL19saWIvcmVxdWVzdC1hdXRoLmpzXCI7aW1wb3J0IHsgdmVyaWZ5RmlyZWJhc2VJZFRva2VuIH0gZnJvbSBcIi4vZmlyZWJhc2UtcmVzdC5qc1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gYXV0aEhlYWRlcnNGcm9tTm9kZVJlcXVlc3QocmVxKSB7XG4gIGNvbnN0IGhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuICBjb25zdCBhdXRob3JpemF0aW9uID0gcmVxPy5oZWFkZXJzPy5hdXRob3JpemF0aW9uIHx8IHJlcT8uaGVhZGVycz8uQXV0aG9yaXphdGlvbjtcbiAgaWYgKGF1dGhvcml6YXRpb24pIGhlYWRlcnMuc2V0KFwiYXV0aG9yaXphdGlvblwiLCBhdXRob3JpemF0aW9uKTtcbiAgcmV0dXJuIGhlYWRlcnM7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXF1aXJlRmlyZWJhc2VBdXRoRnJvbU5vZGVSZXF1ZXN0KHJlcSwgZW52ID0gcHJvY2Vzcy5lbnYpIHtcbiAgcmV0dXJuIHZlcmlmeUZpcmViYXNlSWRUb2tlbihcbiAgICBuZXcgUmVxdWVzdChcImh0dHBzOi8vc2VveC5sb2NhbC9hdXRoXCIsIHtcbiAgICAgIGhlYWRlcnM6IGF1dGhIZWFkZXJzRnJvbU5vZGVSZXF1ZXN0KHJlcSksXG4gICAgfSksXG4gICAgZW52XG4gICk7XG59XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGFsZWVtXFxcXE9uZURyaXZlXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxcc2VveFxcXFxmdW5jdGlvbnNcXFxcX2xpYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcYWxlZW1cXFxcT25lRHJpdmVcXFxcRG9jdW1lbnRzXFxcXEdpdEh1YlxcXFxzZW94XFxcXGZ1bmN0aW9uc1xcXFxfbGliXFxcXHVybC1zZWN1cml0eS5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvYWxlZW0vT25lRHJpdmUvRG9jdW1lbnRzL0dpdEh1Yi9zZW94L2Z1bmN0aW9ucy9fbGliL3VybC1zZWN1cml0eS5qc1wiO2NvbnN0IERFRkFVTFRfTUFYX1JFRElSRUNUUyA9IDU7XG5cbmNvbnN0IEJMT0NLRURfSE9TVFMgPSBuZXcgU2V0KFtcbiAgXCJsb2NhbGhvc3RcIixcbiAgXCJsb2NhbGhvc3QubG9jYWxkb21haW5cIixcbiAgXCJtZXRhZGF0YS5nb29nbGUuaW50ZXJuYWxcIixcbl0pO1xuXG5mdW5jdGlvbiBtYWtlSHR0cEVycm9yKG1lc3NhZ2UsIHN0YXR1cyA9IDQwMCkge1xuICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgZXJyb3Iuc3RhdHVzID0gc3RhdHVzO1xuICByZXR1cm4gZXJyb3I7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUhvc3RuYW1lKGhvc3RuYW1lID0gXCJcIikge1xuICByZXR1cm4gU3RyaW5nKGhvc3RuYW1lKS50cmltKCkudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9eXFxbfFxcXSQvZywgXCJcIikucmVwbGFjZSgvXFwuJC8sIFwiXCIpO1xufVxuXG5mdW5jdGlvbiBwYXJzZUlwdjQoaG9zdG5hbWUpIHtcbiAgY29uc3QgbWF0Y2ggPSBob3N0bmFtZS5tYXRjaCgvXihcXGR7MSwzfSlcXC4oXFxkezEsM30pXFwuKFxcZHsxLDN9KVxcLihcXGR7MSwzfSkkLyk7XG4gIGlmICghbWF0Y2gpIHJldHVybiBudWxsO1xuXG4gIGNvbnN0IHBhcnRzID0gbWF0Y2guc2xpY2UoMSkubWFwKE51bWJlcik7XG4gIGlmIChwYXJ0cy5zb21lKChwYXJ0KSA9PiBwYXJ0IDwgMCB8fCBwYXJ0ID4gMjU1KSkgcmV0dXJuIG51bGw7XG4gIHJldHVybiBwYXJ0cztcbn1cblxuZnVuY3Rpb24gaXNQcml2YXRlSXB2NChwYXJ0cykge1xuICBjb25zdCBbYSwgYl0gPSBwYXJ0cztcbiAgcmV0dXJuIChcbiAgICBhID09PSAwIHx8XG4gICAgYSA9PT0gMTAgfHxcbiAgICBhID09PSAxMjcgfHxcbiAgICAoYSA9PT0gMTAwICYmIGIgPj0gNjQgJiYgYiA8PSAxMjcpIHx8XG4gICAgKGEgPT09IDE2OSAmJiBiID09PSAyNTQpIHx8XG4gICAgKGEgPT09IDE3MiAmJiBiID49IDE2ICYmIGIgPD0gMzEpIHx8XG4gICAgKGEgPT09IDE5MiAmJiBiID09PSAxNjgpIHx8XG4gICAgKGEgPT09IDE5MiAmJiBiID09PSAwKSB8fFxuICAgIChhID09PSAxOTggJiYgKGIgPT09IDE4IHx8IGIgPT09IDE5KSkgfHxcbiAgICBhID49IDIyNFxuICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNCbG9ja2VkRmV0Y2hIb3N0bmFtZShob3N0bmFtZSkge1xuICBjb25zdCBob3N0ID0gbm9ybWFsaXplSG9zdG5hbWUoaG9zdG5hbWUpO1xuICBpZiAoIWhvc3QpIHJldHVybiB0cnVlO1xuICBpZiAoQkxPQ0tFRF9IT1NUUy5oYXMoaG9zdCkgfHwgaG9zdC5lbmRzV2l0aChcIi5sb2NhbGhvc3RcIikgfHwgaG9zdC5lbmRzV2l0aChcIi5sb2NhbFwiKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgY29uc3QgaXB2NCA9IHBhcnNlSXB2NChob3N0KTtcbiAgaWYgKGlwdjQpIHJldHVybiBpc1ByaXZhdGVJcHY0KGlwdjQpO1xuXG4gIGlmIChob3N0LmluY2x1ZGVzKFwiOlwiKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQdWJsaWNIdHRwVXJsKHZhbHVlLCBsYWJlbCA9IFwiVVJMXCIpIHtcbiAgbGV0IHVybDtcbiAgdHJ5IHtcbiAgICB1cmwgPSBuZXcgVVJMKFN0cmluZyh2YWx1ZSB8fCBcIlwiKS50cmltKCkpO1xuICB9IGNhdGNoIHtcbiAgICB0aHJvdyBtYWtlSHR0cEVycm9yKGBJbnZhbGlkICR7bGFiZWx9IGZvcm1hdGApO1xuICB9XG5cbiAgaWYgKCFbXCJodHRwOlwiLCBcImh0dHBzOlwiXS5pbmNsdWRlcyh1cmwucHJvdG9jb2wpKSB7XG4gICAgdGhyb3cgbWFrZUh0dHBFcnJvcihcIk9ubHkgSFRUUCBhbmQgSFRUUFMgVVJMcyBhcmUgYWxsb3dlZFwiKTtcbiAgfVxuXG4gIGlmICh1cmwudXNlcm5hbWUgfHwgdXJsLnBhc3N3b3JkKSB7XG4gICAgdGhyb3cgbWFrZUh0dHBFcnJvcihcIlVSTHMgd2l0aCBlbWJlZGRlZCBjcmVkZW50aWFscyBhcmUgbm90IGFsbG93ZWRcIik7XG4gIH1cblxuICBpZiAoaXNCbG9ja2VkRmV0Y2hIb3N0bmFtZSh1cmwuaG9zdG5hbWUpKSB7XG4gICAgdGhyb3cgbWFrZUh0dHBFcnJvcihcIlByaXZhdGUsIGxvY2FsLCBhbmQgbWV0YWRhdGEgbmV0d29yayBVUkxzIGFyZSBub3QgYWxsb3dlZFwiKTtcbiAgfVxuXG4gIHVybC5oYXNoID0gXCJcIjtcbiAgcmV0dXJuIHVybDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVQdWJsaWNSZWRpcmVjdChsb2NhdGlvbiwgY3VycmVudFVybCkge1xuICBpZiAoIWxvY2F0aW9uKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIHBhcnNlUHVibGljSHR0cFVybChuZXcgVVJMKGxvY2F0aW9uLCBjdXJyZW50VXJsKS50b1N0cmluZygpLCBcInJlZGlyZWN0IFVSTFwiKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZldGNoUHVibGljSHR0cFVybCh2YWx1ZSwgaW5pdCA9IHt9KSB7XG4gIGNvbnN0IHsgbWF4UmVkaXJlY3RzID0gREVGQVVMVF9NQVhfUkVESVJFQ1RTLCAuLi5mZXRjaEluaXQgfSA9IGluaXQ7XG4gIGxldCBjdXJyZW50VXJsID0gcGFyc2VQdWJsaWNIdHRwVXJsKHZhbHVlKTtcblxuICBmb3IgKGxldCByZWRpcmVjdENvdW50ID0gMDsgcmVkaXJlY3RDb3VudCA8PSBtYXhSZWRpcmVjdHM7IHJlZGlyZWN0Q291bnQgKz0gMSkge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goY3VycmVudFVybC50b1N0cmluZygpLCB7XG4gICAgICAuLi5mZXRjaEluaXQsXG4gICAgICByZWRpcmVjdDogXCJtYW51YWxcIixcbiAgICB9KTtcblxuICAgIGlmICghWzMwMSwgMzAyLCAzMDMsIDMwNywgMzA4XS5pbmNsdWRlcyhyZXNwb25zZS5zdGF0dXMpKSB7XG4gICAgICByZXR1cm4gcmVzcG9uc2U7XG4gICAgfVxuXG4gICAgY29uc3QgbG9jYXRpb24gPSByZXNwb25zZS5oZWFkZXJzLmdldChcImxvY2F0aW9uXCIpO1xuICAgIGlmICghbG9jYXRpb24pIHJldHVybiByZXNwb25zZTtcbiAgICBpZiAocmVkaXJlY3RDb3VudCA+PSBtYXhSZWRpcmVjdHMpIHJldHVybiByZXNwb25zZTtcbiAgICBjdXJyZW50VXJsID0gcmVzb2x2ZVB1YmxpY1JlZGlyZWN0KGxvY2F0aW9uLCBjdXJyZW50VXJsKTtcbiAgfVxuXG4gIHRocm93IG1ha2VIdHRwRXJyb3IoXCJUb28gbWFueSByZWRpcmVjdHNcIiwgNTA4KTtcbn1cbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcYWxlZW1cXFxcT25lRHJpdmVcXFxcRG9jdW1lbnRzXFxcXEdpdEh1YlxcXFxzZW94XFxcXGZ1bmN0aW9uc1xcXFxfaGFuZGxlcnNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGFsZWVtXFxcXE9uZURyaXZlXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxcc2VveFxcXFxmdW5jdGlvbnNcXFxcX2hhbmRsZXJzXFxcXGZldGNoLXVybC1tZXRhLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9hbGVlbS9PbmVEcml2ZS9Eb2N1bWVudHMvR2l0SHViL3Nlb3gvZnVuY3Rpb25zL19oYW5kbGVycy9mZXRjaC11cmwtbWV0YS5qc1wiO2ltcG9ydCB7IHJlcXVpcmVGaXJlYmFzZUF1dGhGcm9tTm9kZVJlcXVlc3QgfSBmcm9tIFwiLi4vX2xpYi9yZXF1ZXN0LWF1dGguanNcIjtcbmltcG9ydCB7IGZldGNoUHVibGljSHR0cFVybCwgcGFyc2VQdWJsaWNIdHRwVXJsIH0gZnJvbSBcIi4uL19saWIvdXJsLXNlY3VyaXR5LmpzXCI7XG5cbmNvbnN0IE1BWF9IVE1MX0JZVEVTID0gNV8wMDBfMDAwO1xuXG4vLyBTaGFyZWQgTm9kZS1zdHlsZSBoYW5kbGVyIHVzZWQgYnkgdGhlIENsb3VkZmxhcmUgUGFnZXMgRnVuY3Rpb24gd3JhcHBlci5cbmV4cG9ydCBkZWZhdWx0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZXIocmVxLCByZXMpIHtcbiAgcmVzLnNldEhlYWRlcihcIkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiLCBcIipcIik7XG4gIHJlcy5zZXRIZWFkZXIoXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzXCIsIFwiR0VULCBQT1NULCBPUFRJT05TXCIpO1xuICByZXMuc2V0SGVhZGVyKFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVyc1wiLCBcIkNvbnRlbnQtVHlwZSwgQXV0aG9yaXphdGlvblwiKTtcblxuICBpZiAocmVxLm1ldGhvZCA9PT0gXCJPUFRJT05TXCIpIHJldHVybiByZXMuc3RhdHVzKDIwMCkuZW5kKCk7XG4gIGlmICghW1wiR0VUXCIsIFwiUE9TVFwiXS5pbmNsdWRlcyhyZXEubWV0aG9kKSkge1xuICAgIHJldHVybiByZXMuc3RhdHVzKDQwNSkuanNvbih7IGVycm9yOiBcIk1ldGhvZCBub3QgYWxsb3dlZFwiIH0pO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBhd2FpdCByZXF1aXJlRmlyZWJhc2VBdXRoRnJvbU5vZGVSZXF1ZXN0KHJlcSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIHJlcy5zdGF0dXMoZXJyb3I/LnN0YXR1cyB8fCA0MDEpLmpzb24oeyBlcnJvcjogZXJyb3I/Lm1lc3NhZ2UgfHwgXCJVbmF1dGhvcml6ZWRcIiB9KTtcbiAgfVxuXG4gIGNvbnN0IHBhcmFtcyA9IHJlcS5tZXRob2QgPT09IFwiR0VUXCIgPyByZXEucXVlcnkgfHwge30gOiByZXEuYm9keSB8fCB7fTtcbiAgY29uc3QgeyB1cmwsIGluY2x1ZGVNZXRhRGVzY3JpcHRpb24sIHJldHVybkh0bWwgfSA9IHBhcmFtcztcbiAgaWYgKCF1cmwpIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiBcIlVSTCBpcyByZXF1aXJlZFwiIH0pO1xuXG4gIHRyeSB7XG4gICAgcGFyc2VQdWJsaWNIdHRwVXJsKHVybCk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIHJlcy5zdGF0dXMoZXJyb3I/LnN0YXR1cyB8fCA0MDApLmpzb24oeyBlcnJvcjogZXJyb3I/Lm1lc3NhZ2UgfHwgXCJJbnZhbGlkIFVSTCBmb3JtYXRcIiB9KTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBjb25zdCB0aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIHJldHVybkh0bWwgPyAxNTAwMCA6IDEwMDAwKTtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoUHVibGljSHR0cFVybCh1cmwsIHtcbiAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIFwiVXNlci1BZ2VudFwiOlxuICAgICAgICAgIFwiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV2luNjQ7IHg2NCkgQXBwbGVXZWJLaXQvNTM3LjM2IENocm9tZS8xMjAgU2FmYXJpLzUzNy4zNlwiLFxuICAgICAgICBBY2NlcHQ6IFwidGV4dC9odG1sLGFwcGxpY2F0aW9uL3hodG1sK3htbCxhcHBsaWNhdGlvbi94bWw7cT0wLjksKi8qO3E9MC44XCIsXG4gICAgICAgIFwiQWNjZXB0LUxhbmd1YWdlXCI6IFwiZW4tVVMsZW47cT0wLjhcIixcbiAgICAgIH0sXG4gICAgfSkuZmluYWxseSgoKSA9PiBjbGVhclRpbWVvdXQodGltZW91dCkpO1xuXG4gICAgY29uc3Qgc3RhdHVzQ29kZSA9IHJlc3BvbnNlLnN0YXR1cztcbiAgICBjb25zdCBjb250ZW50TGVuZ3RoID0gTnVtYmVyKHJlc3BvbnNlLmhlYWRlcnMuZ2V0KFwiY29udGVudC1sZW5ndGhcIikgfHwgMCk7XG4gICAgaWYgKGNvbnRlbnRMZW5ndGggPiBNQVhfSFRNTF9CWVRFUykge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDEzKS5qc29uKHsgZXJyb3I6IFwiRmV0Y2hlZCByZXNwb25zZSBpcyB0b28gbGFyZ2VcIiB9KTtcbiAgICB9XG4gICAgY29uc3QgaHRtbCA9XG4gICAgICBzdGF0dXNDb2RlID49IDIwMCAmJiBzdGF0dXNDb2RlIDwgMzAwXG4gICAgICAgID8gKGF3YWl0IHJlc3BvbnNlLnRleHQoKSkuc2xpY2UoMCwgTUFYX0hUTUxfQllURVMpXG4gICAgICAgIDogXCJcIjtcbiAgICBpZiAocmV0dXJuSHRtbCkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoMjAwKS5qc29uKHtcbiAgICAgICAgdXJsLFxuICAgICAgICBzdGF0dXNDb2RlLFxuICAgICAgICBodG1sLFxuICAgICAgICBzdWNjZXNzOiBCb29sZWFuKGh0bWwpLFxuICAgICAgICBlcnJvcjogaHRtbCA/IHVuZGVmaW5lZCA6IGBIVFRQICR7c3RhdHVzQ29kZX1gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdGl0bGUgPSAoaHRtbC5tYXRjaCgvPHRpdGxlW14+XSo+KFtcXHNcXFNdKj8pPFxcL3RpdGxlPi9pKT8uWzFdIHx8IFwiXCIpXG4gICAgICAucmVwbGFjZSgvXFxzKy9nLCBcIiBcIilcbiAgICAgIC50cmltKClcbiAgICAgIC5zbGljZSgwLCAyMDApO1xuICAgIGNvbnN0IG1ldGFEZXNjcmlwdGlvbiA9IGluY2x1ZGVNZXRhRGVzY3JpcHRpb25cbiAgICAgID8gKFxuICAgICAgICAgIGh0bWwubWF0Y2goLzxtZXRhW14+XStuYW1lPVtcIiddZGVzY3JpcHRpb25bXCInXVtePl0rY29udGVudD1bXCInXShbXlwiJ10qKVtcIiddL2kpPy5bMV0gfHxcbiAgICAgICAgICBodG1sLm1hdGNoKC88bWV0YVtePl0rY29udGVudD1bXCInXShbXlwiJ10qKVtcIiddW14+XStuYW1lPVtcIiddZGVzY3JpcHRpb25bXCInXS9pKT8uWzFdIHx8XG4gICAgICAgICAgXCJcIlxuICAgICAgICApXG4gICAgICAgICAgLnJlcGxhY2UoL1xccysvZywgXCIgXCIpXG4gICAgICAgICAgLnRyaW0oKVxuICAgICAgICAgIC5zbGljZSgwLCAzMDApXG4gICAgICA6IFwiXCI7XG5cbiAgICByZXR1cm4gcmVzLnN0YXR1cygyMDApLmpzb24oeyB1cmwsIHN0YXR1c0NvZGUsIHRpdGxlLCBtZXRhRGVzY3JpcHRpb24sIHN1Y2Nlc3M6IHRydWUgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIHJlcy5zdGF0dXMoMjAwKS5qc29uKHtcbiAgICAgIHVybCxcbiAgICAgIHN0YXR1c0NvZGU6IDAsXG4gICAgICB0aXRsZTogXCJcIixcbiAgICAgIG1ldGFEZXNjcmlwdGlvbjogXCJcIixcbiAgICAgIGh0bWw6IHJldHVybkh0bWwgPyBcIlwiIDogdW5kZWZpbmVkLFxuICAgICAgZXJyb3I6IGVycm9yPy5uYW1lID09PSBcIkFib3J0RXJyb3JcIiA/IFwiVGltZW91dFwiIDogZXJyb3I/Lm1lc3NhZ2UsXG4gICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICB9KTtcbiAgfVxufVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhbGVlbVxcXFxPbmVEcml2ZVxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXHNlb3hcXFxcZnVuY3Rpb25zXFxcXF9oYW5kbGVyc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcYWxlZW1cXFxcT25lRHJpdmVcXFxcRG9jdW1lbnRzXFxcXEdpdEh1YlxcXFxzZW94XFxcXGZ1bmN0aW9uc1xcXFxfaGFuZGxlcnNcXFxcd2VibWFzdGVyLWFwaS5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvYWxlZW0vT25lRHJpdmUvRG9jdW1lbnRzL0dpdEh1Yi9zZW94L2Z1bmN0aW9ucy9faGFuZGxlcnMvd2VibWFzdGVyLWFwaS5qc1wiO2NvbnN0IEJJTkdfQVBJX0JBU0UgPSBcImh0dHBzOi8vc3NsLmJpbmcuY29tL3dlYm1hc3Rlci9hcGkuc3ZjL2pzb25cIjtcblxuZXhwb3J0IGRlZmF1bHQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlcihyZXEsIHJlcykge1xuICByZXMuc2V0SGVhZGVyKFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCIsIFwiKlwiKTtcbiAgcmVzLnNldEhlYWRlcihcIkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHNcIiwgXCJHRVQsIE9QVElPTlNcIik7XG4gIHJlcy5zZXRIZWFkZXIoXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzXCIsIFwiQ29udGVudC1UeXBlLCBBY2NlcHQsIEF1dGhvcml6YXRpb25cIik7XG4gIHJlcy5zZXRIZWFkZXIoXCJDYWNoZS1Db250cm9sXCIsIFwibm8tc3RvcmVcIik7XG5cbiAgaWYgKHJlcS5tZXRob2QgPT09IFwiT1BUSU9OU1wiKSByZXR1cm4gcmVzLnN0YXR1cygyMDApLmVuZCgpO1xuICBpZiAocmVxLm1ldGhvZCAhPT0gXCJHRVRcIikgcmV0dXJuIHJlcy5zdGF0dXMoNDA1KS5qc29uKHsgZXJyb3I6IFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIgfSk7XG5cbiAgY29uc3QgeyBzZXJ2aWNlLCBhY3Rpb24gfSA9IHJlcS5xdWVyeSB8fCB7fTtcbiAgaWYgKHNlcnZpY2UgIT09IFwiYmluZ1wiKSB7XG4gICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6ICdJbnZhbGlkIHNlcnZpY2UuIFVzZSBcImJpbmdcIi4nIH0pO1xuICB9XG4gIGlmICghYWN0aW9uKSByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogXCJBY3Rpb24gaXMgcmVxdWlyZWRcIiB9KTtcblxuICByZXR1cm4gaGFuZGxlQmluZyhyZXEsIHJlcywgYWN0aW9uKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gaGFuZGxlQmluZyhyZXEsIHJlcywgYWN0aW9uKSB7XG4gIGNvbnN0IHsgYXBpa2V5LCBzaXRlVXJsIH0gPSByZXEucXVlcnkgfHwge307XG4gIGlmICghYXBpa2V5KSB7XG4gICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6IFwiQmluZyBXZWJtYXN0ZXIgQVBJIGtleSBpcyByZXF1aXJlZFwiIH0pO1xuICB9XG5cbiAgbGV0IGVuZHBvaW50ID0gXCJcIjtcbiAgaWYgKGFjdGlvbiA9PT0gXCJnZXRTaXRlc1wiKSB7XG4gICAgZW5kcG9pbnQgPSBgJHtCSU5HX0FQSV9CQVNFfS9HZXRVc2VyU2l0ZXM/YXBpa2V5PSR7ZW5jb2RlVVJJQ29tcG9uZW50KGFwaWtleSl9YDtcbiAgfSBlbHNlIGlmIChhY3Rpb24gPT09IFwiZ2V0U3RhdHNcIikge1xuICAgIGlmICghc2l0ZVVybCkgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6IFwic2l0ZVVybCBpcyByZXF1aXJlZCBmb3IgZ2V0U3RhdHNcIiB9KTtcbiAgICBlbmRwb2ludCA9IGAke0JJTkdfQVBJX0JBU0V9L0dldFF1ZXJ5U3RhdHM/YXBpa2V5PSR7ZW5jb2RlVVJJQ29tcG9uZW50KGFwaWtleSl9JnNpdGVVcmw9JHtlbmNvZGVVUklDb21wb25lbnQoc2l0ZVVybCl9YDtcbiAgfSBlbHNlIGlmIChhY3Rpb24gPT09IFwiZ2V0UGFnZVN0YXRzXCIpIHtcbiAgICBpZiAoIXNpdGVVcmwpIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiBcInNpdGVVcmwgaXMgcmVxdWlyZWQgZm9yIGdldFBhZ2VTdGF0c1wiIH0pO1xuICAgIGVuZHBvaW50ID0gYCR7QklOR19BUElfQkFTRX0vR2V0UGFnZVN0YXRzP2FwaWtleT0ke2VuY29kZVVSSUNvbXBvbmVudChhcGlrZXkpfSZzaXRlVXJsPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHNpdGVVcmwpfWA7XG4gIH0gZWxzZSBpZiAoYWN0aW9uID09PSBcImdldENyYXdsU3RhdHNcIikge1xuICAgIGlmICghc2l0ZVVybCkgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6IFwic2l0ZVVybCBpcyByZXF1aXJlZCBmb3IgZ2V0Q3Jhd2xTdGF0c1wiIH0pO1xuICAgIGVuZHBvaW50ID0gYCR7QklOR19BUElfQkFTRX0vR2V0Q3Jhd2xTdGF0cz9hcGlrZXk9JHtlbmNvZGVVUklDb21wb25lbnQoYXBpa2V5KX0mc2l0ZVVybD0ke2VuY29kZVVSSUNvbXBvbmVudChzaXRlVXJsKX1gO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiBcIkludmFsaWQgQmluZyBhY3Rpb25cIiB9KTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChlbmRwb2ludCwgeyBoZWFkZXJzOiB7IEFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSB9KTtcbiAgICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuICAgIGNvbnN0IHBheWxvYWQgPSBwYXJzZUpzb24odGV4dCkgfHwgeyByYXc6IHRleHQgfTtcblxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQwMSB8fCByZXNwb25zZS5zdGF0dXMgPT09IDQwMykge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDEpLmpzb24oeyBlcnJvcjogXCJJbnZhbGlkIG9yIHVuYXV0aG9yaXplZCBCaW5nIFdlYm1hc3RlciBBUEkga2V5XCIgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyhyZXNwb25zZS5zdGF0dXMpLmpzb24oe1xuICAgICAgICBlcnJvcjogYEJpbmcgQVBJIGVycm9yOiBIVFRQICR7cmVzcG9uc2Uuc3RhdHVzfWAsXG4gICAgICAgIGRldGFpbHM6IHBheWxvYWQsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzLnN0YXR1cygyMDApLmpzb24ocGF5bG9hZCk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAyKS5qc29uKHtcbiAgICAgIGVycm9yOiBcIkZhaWxlZCB0byBmZXRjaCBmcm9tIEJpbmcgV2VibWFzdGVyIEFQSVwiLFxuICAgICAgZGV0YWlsczogZXJyb3I/Lm1lc3NhZ2UgfHwgXCJVbmtub3duIGVycm9yXCIsXG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcGFyc2VKc29uKHZhbHVlKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UodmFsdWUpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF1VSxTQUFTLGNBQWMsZUFBZTtBQUM3VyxPQUFPLFdBQVc7QUFDbEIsT0FBTyxRQUFROzs7QUNGa1csU0FBUyxZQUFZLFVBQVUsc0JBQXNCO0FBQ3BhLFNBQU87QUFBQSxJQUNMLCtCQUErQjtBQUFBLElBQy9CLGdDQUFnQztBQUFBLElBQ2hDLGdDQUFnQztBQUFBLEVBQ2xDO0FBQ0Y7QUFFTyxTQUFTLGFBQWEsU0FBUyxTQUFTLEtBQUssVUFBVSxDQUFDLEdBQUc7QUFDaEUsU0FBTyxJQUFJLFNBQVMsS0FBSyxVQUFVLE9BQU8sR0FBRztBQUFBLElBQzNDO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUCxnQkFBZ0I7QUFBQSxNQUNoQixHQUFHO0FBQUEsSUFDTDtBQUFBLEVBQ0YsQ0FBQztBQUNIO0FBRU8sU0FBUyxjQUFjLFNBQVMsS0FBSyxVQUFVLENBQUMsR0FBRztBQUN4RCxTQUFPLElBQUksU0FBUyxNQUFNLEVBQUUsUUFBUSxRQUFRLENBQUM7QUFDL0M7QUFFQSxlQUFzQixTQUFTLFNBQVM7QUFDdEMsTUFBSTtBQUNGLFdBQU8sTUFBTSxRQUFRLEtBQUs7QUFBQSxFQUM1QixRQUFRO0FBQ04sV0FB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QUNqQixhQUFPO0FBQUEsSUFDVDtBQUFBLElBQ0EsS0FBSyxTQUFTO0FBQ1osVUFBSSxVQUFVLGdCQUFnQixpQ0FBaUM7QUFDL0QsVUFBSSxJQUFJLEtBQUssVUFBVSxPQUFPLENBQUM7QUFDL0IsYUFBTztBQUFBLElBQ1Q7QUFBQSxJQUNBLElBQUksU0FBUztBQUNYLFVBQUksSUFBSSxPQUFPO0FBQ2YsYUFBTztBQUFBLElBQ1Q7QUFBQSxFQUNGO0FBQ0Y7QUFFQSxlQUFlLGdCQUFnQixLQUFLLFVBQVU7QUFDNUMsTUFBSSxhQUFhLFNBQVM7QUFDMUIsV0FBUyxRQUFRLFFBQVEsQ0FBQyxPQUFPLFFBQVE7QUFDdkMsUUFBSSxVQUFVLEtBQUssS0FBSztBQUFBLEVBQzFCLENBQUM7QUFDRCxNQUFJLElBQUksT0FBTyxLQUFLLE1BQU0sU0FBUyxZQUFZLENBQUMsQ0FBQztBQUNuRDtBQUVBLFNBQVMsU0FBUyxLQUFLLFFBQVEsU0FBUztBQUN0QyxNQUFJLGFBQWE7QUFDakIsTUFBSSxVQUFVLGdCQUFnQixpQ0FBaUM7QUFDL0QsTUFBSSxJQUFJLEtBQUssVUFBVSxPQUFPLENBQUM7QUFDakM7QUFFQSxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxHQUFHLGVBQWUsR0FBRyxrQkFBa0IsR0FBRyxzQkFBc0IsR0FBRyxtQkFBbUIsR0FBRyxzQkFBc0IsR0FBRyxrQkFBa0IsR0FBRyxpQkFBaUIsQ0FBQztBQUFBLEVBQ3pLLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNSO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFsib25SZXF1ZXN0IiwgImhhbmRsZXIiLCAib25SZXF1ZXN0IiwgImhhbmRsZXIiXQp9Cg==
