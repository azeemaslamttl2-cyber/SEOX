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
async function listFirestoreCollection(env, collection, pageSize = 500) {
  const documents = [];
  let pageToken = "";
  do {
    const url = new URL(
      `${firestoreBaseUrl(env)}/${encodeDocumentPath(collection)}`
    );
    url.searchParams.set("pageSize", String(pageSize));
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const data = await googleRequest(env, url.toString());
    documents.push(...(data.documents || []).map(decodeFirestoreDocument));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return documents;
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

// functions/api/projects.js
function userProjectsCollection(userId) {
  return `users/${userId}/projects`;
}
function userMetaCollection(userId) {
  return `users/${userId}/meta`;
}
function cleanFields2(fields) {
  return Object.fromEntries(
    Object.entries(fields || {}).filter(([, value]) => value !== void 0)
  );
}
function sanitizeProject(project, decoded) {
  if (!project?.id) {
    const error = new Error("Project id is required");
    error.status = 400;
    throw error;
  }
  const {
    stats: _stats,
    latestUrls: _latestUrls,
    auditIssues: _auditIssues,
    ...safe
  } = project;
  return cleanFields2({
    ...safe,
    ownerUid: decoded.uid,
    ownerEmail: decoded.email || safe.owner || "",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}
function normalizeDeletedProjectIds(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}
async function loadProjects(env, userId) {
  const [projects, meta] = await Promise.all([
    listFirestoreCollection(env, userProjectsCollection(userId)),
    getFirestoreDocument(env, userMetaCollection(userId), "crawl")
  ]);
  return {
    projects,
    selectedProjectId: meta?.selectedProjectId || null,
    deletedProjectIds: normalizeDeletedProjectIds(meta?.deletedProjectIds)
  };
}
async function saveMeta(env, userId, { selectedProjectId, deletedProjectIds }) {
  return patchFirestoreDocument(env, userMetaCollection(userId), "crawl", {
    selectedProjectId: selectedProjectId || null,
    deletedProjectIds: normalizeDeletedProjectIds(deletedProjectIds),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function onRequest3({ request, env }) {
  const headers = {
    ...corsHeaders("GET, POST, DELETE, OPTIONS"),
    "Cache-Control": "no-store"
  };
  if (request.method === "OPTIONS") return emptyResponse(204, headers);
  try {
    const decoded = await verifyFirebaseIdToken(request, env);
    const userId = decoded.uid;
    if (request.method === "GET") {
      return jsonResponse(await loadProjects(env, userId), 200, headers);
    }
    const body = await readJson(request);
    const action = body?.action || "";
    if (request.method === "POST") {
      if (action === "saveProjectWithMeta") {
        const project = sanitizeProject(body.project, decoded);
        await Promise.all([
          patchFirestoreDocument(env, userProjectsCollection(userId), project.id, project),
          saveMeta(env, userId, {
            selectedProjectId: body.selectedProjectId || project.id,
            deletedProjectIds: body.deletedProjectIds
          })
        ]);
        return jsonResponse({ success: true, project }, 200, headers);
      }
      if (action === "saveMeta") {
        await saveMeta(env, userId, {
          selectedProjectId: body.selectedProjectId,
          deletedProjectIds: body.deletedProjectIds
        });
        return jsonResponse({ success: true }, 200, headers);
      }
      return jsonResponse({ error: "Invalid action" }, 400, headers);
    }
    if (request.method === "DELETE") {
      const projectId = String(body.projectId || "").trim();
      if (!projectId) return jsonResponse({ error: "Project id is required" }, 400, headers);
      const writes = [
        deleteFirestoreDocument(env, userProjectsCollection(userId), projectId)
      ];
      if (Object.prototype.hasOwnProperty.call(body, "selectedProjectId") || Object.prototype.hasOwnProperty.call(body, "deletedProjectIds")) {
        writes.push(saveMeta(env, userId, {
          selectedProjectId: body.selectedProjectId,
          deletedProjectIds: body.deletedProjectIds
        }));
      }
      await Promise.all(writes);
      return jsonResponse({ success: true }, 200, headers);
    }
    return jsonResponse({ error: "Method not allowed" }, 405, headers);
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
function projectsApiPlugin() {
  return {
    name: "seox-projects-api",
    configureServer(server) {
      registerProjectsMiddleware(server);
    },
    configurePreviewServer(server) {
      registerProjectsMiddleware(server);
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
function registerProjectsMiddleware(server) {
  server.middlewares.use("/api/projects", async (req, res) => {
    try {
      const request = await createWebRequest(req, "/api/projects");
      const response = await onRequest3({
        request,
        env: loadDevApiEnv()
      });
      await sendWebResponse(res, response);
    } catch (error) {
      sendJson(res, error?.status || 500, {
        error: "Projects request failed",
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
  plugins: [react(), proxyApiPlugin(), deepseekApiPlugin(), fetchUrlMetaApiPlugin(), webmasterApiPlugin(), autocompleteApiPlugin(), gscTokenApiPlugin(), projectsApiPlugin(), crawlerApiPlugin()],
  server: {
    port: 5173,
    host: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiLCAiZnVuY3Rpb25zL19saWIvaHR0cC5qcyIsICJmdW5jdGlvbnMvYXBpL2F1dG9jb21wbGV0ZS5qcyIsICJmdW5jdGlvbnMvX2xpYi9maXJlYmFzZS1yZXN0LmpzIiwgImZ1bmN0aW9ucy9hcGkvZ3NjLXRva2VuLmpzIiwgImZ1bmN0aW9ucy9hcGkvcHJvamVjdHMuanMiLCAiZnVuY3Rpb25zL19saWIvcmVxdWVzdC1hdXRoLmpzIiwgImZ1bmN0aW9ucy9fbGliL3VybC1zZWN1cml0eS5qcyIsICJmdW5jdGlvbnMvX2hhbmRsZXJzL2ZldGNoLXVybC1tZXRhLmpzIiwgImZ1bmN0aW9ucy9faGFuZGxlcnMvd2VibWFzdGVyLWFwaS5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGFsZWVtXFxcXE9uZURyaXZlXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxcc2VveFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcYWxlZW1cXFxcT25lRHJpdmVcXFxcRG9jdW1lbnRzXFxcXEdpdEh1YlxcXFxzZW94XFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9hbGVlbS9PbmVEcml2ZS9Eb2N1bWVudHMvR2l0SHViL3Nlb3gvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IGZzIGZyb20gXCJub2RlOmZzXCI7XG5pbXBvcnQgeyBvblJlcXVlc3QgYXMgYXV0b2NvbXBsZXRlT25SZXF1ZXN0IH0gZnJvbSBcIi4vZnVuY3Rpb25zL2FwaS9hdXRvY29tcGxldGUuanNcIjtcbmltcG9ydCB7IG9uUmVxdWVzdCBhcyBnc2NUb2tlbk9uUmVxdWVzdCB9IGZyb20gXCIuL2Z1bmN0aW9ucy9hcGkvZ3NjLXRva2VuLmpzXCI7XG5pbXBvcnQgeyBvblJlcXVlc3QgYXMgcHJvamVjdHNPblJlcXVlc3QgfSBmcm9tIFwiLi9mdW5jdGlvbnMvYXBpL3Byb2plY3RzLmpzXCI7XG5pbXBvcnQgZmV0Y2hVcmxNZXRhSGFuZGxlciBmcm9tIFwiLi9mdW5jdGlvbnMvX2hhbmRsZXJzL2ZldGNoLXVybC1tZXRhLmpzXCI7XG5pbXBvcnQgd2VibWFzdGVyQXBpSGFuZGxlciBmcm9tIFwiLi9mdW5jdGlvbnMvX2hhbmRsZXJzL3dlYm1hc3Rlci1hcGkuanNcIjtcbmltcG9ydCB7IHZlcmlmeUZpcmViYXNlSWRUb2tlbiB9IGZyb20gXCIuL2Z1bmN0aW9ucy9fbGliL2ZpcmViYXNlLXJlc3QuanNcIjtcbmltcG9ydCB7IGZldGNoUHVibGljSHR0cFVybCwgcGFyc2VQdWJsaWNIdHRwVXJsIH0gZnJvbSBcIi4vZnVuY3Rpb25zL19saWIvdXJsLXNlY3VyaXR5LmpzXCI7XG5cbmNvbnN0IFRFWFRfVFlQRVMgPSBbXG4gIFwidGV4dC9cIixcbiAgXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gIFwiYXBwbGljYXRpb24vamF2YXNjcmlwdFwiLFxuICBcImFwcGxpY2F0aW9uL3htbFwiLFxuICBcImFwcGxpY2F0aW9uL3hodG1sK3htbFwiLFxuICBcImFwcGxpY2F0aW9uL3Jzcyt4bWxcIixcbiAgXCJhcHBsaWNhdGlvbi9hdG9tK3htbFwiLFxuICBcImltYWdlL3N2Zyt4bWxcIixcbl07XG5cbmFzeW5jIGZ1bmN0aW9uIHZlcmlmeURldkFwaVJlcXVlc3QocmVxKSB7XG4gIGNvbnN0IGhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuICBjb25zdCBhdXRob3JpemF0aW9uID0gcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbiB8fCByZXEuaGVhZGVycy5BdXRob3JpemF0aW9uO1xuICBpZiAoYXV0aG9yaXphdGlvbikgaGVhZGVycy5zZXQoXCJhdXRob3JpemF0aW9uXCIsIGF1dGhvcml6YXRpb24pO1xuICByZXR1cm4gdmVyaWZ5RmlyZWJhc2VJZFRva2VuKFxuICAgIG5ldyBSZXF1ZXN0KFwiaHR0cDovLzEyNy4wLjAuMS9hdXRoXCIsIHsgaGVhZGVycyB9KSxcbiAgICBwcm9jZXNzLmVudlxuICApO1xufVxuXG5mdW5jdGlvbiBwYXJzZUVudkZpbGUocGF0aG5hbWUpIHtcbiAgaWYgKCFmcy5leGlzdHNTeW5jKHBhdGhuYW1lKSkgcmV0dXJuIHt9O1xuXG4gIHJldHVybiBPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgZnNcbiAgICAgIC5yZWFkRmlsZVN5bmMocGF0aG5hbWUsIFwidXRmOFwiKVxuICAgICAgLnNwbGl0KC9cXHI/XFxuLylcbiAgICAgIC5tYXAoKGxpbmUpID0+IGxpbmUudHJpbSgpKVxuICAgICAgLmZpbHRlcigobGluZSkgPT4gbGluZSAmJiAhbGluZS5zdGFydHNXaXRoKFwiI1wiKSAmJiBsaW5lLmluY2x1ZGVzKFwiPVwiKSlcbiAgICAgIC5tYXAoKGxpbmUpID0+IHtcbiAgICAgICAgY29uc3Qgc2VwYXJhdG9yID0gbGluZS5pbmRleE9mKFwiPVwiKTtcbiAgICAgICAgY29uc3Qga2V5ID0gbGluZS5zbGljZSgwLCBzZXBhcmF0b3IpLnRyaW0oKTtcbiAgICAgICAgbGV0IHZhbHVlID0gbGluZS5zbGljZShzZXBhcmF0b3IgKyAxKS50cmltKCk7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAodmFsdWUuc3RhcnRzV2l0aCgnXCInKSAmJiB2YWx1ZS5lbmRzV2l0aCgnXCInKSkgfHxcbiAgICAgICAgICAodmFsdWUuc3RhcnRzV2l0aChcIidcIikgJiYgdmFsdWUuZW5kc1dpdGgoXCInXCIpKVxuICAgICAgICApIHtcbiAgICAgICAgICB2YWx1ZSA9IHZhbHVlLnNsaWNlKDEsIC0xKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gW2tleSwgdmFsdWVdO1xuICAgICAgfSlcbiAgKTtcbn1cblxuZnVuY3Rpb24gbG9hZERldkFwaUVudigpIHtcbiAgcmV0dXJuIHtcbiAgICAuLi5wcm9jZXNzLmVudixcbiAgICAuLi5sb2FkRW52KFwiZGV2ZWxvcG1lbnRcIiwgcHJvY2Vzcy5jd2QoKSwgXCJcIiksXG4gICAgLi4ucGFyc2VFbnZGaWxlKFwiLmRldi52YXJzXCIpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBzZW5kVW5hdXRob3JpemVkKHJlcywgZXJyb3IpIHtcbiAgc2VuZEpzb24ocmVzLCBlcnJvcj8uc3RhdHVzIHx8IDQwMSwge1xuICAgIGVycm9yOiBlcnJvcj8ubWVzc2FnZSB8fCBcIlVuYXV0aG9yaXplZFwiLFxuICB9KTtcbn1cblxuLyogXHUyNTAwXHUyNTAwIFByb3h5IEFQSSBtaWRkbGV3YXJlIChmb3IgY29udGVudCB0b29scyB0byBmZXRjaCBleHRlcm5hbCBVUkxzKSBcdTI1MDBcdTI1MDAgKi9cbmZ1bmN0aW9uIHByb3h5QXBpUGx1Z2luKCkge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IFwic2VveC1wcm94eS1hcGlcIixcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9wcm94eVwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdmVyaWZ5RGV2QXBpUmVxdWVzdChyZXEpO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gc2VuZFVuYXV0aG9yaXplZChyZXMsIGVycm9yKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCByZXF1ZXN0VXJsID0gbmV3IFVSTChyZXEudXJsIHx8IFwiXCIsIFwiaHR0cDovLzEyNy4wLjAuMVwiKTtcbiAgICAgICAgICBjb25zdCB0YXJnZXRVcmwgPSByZXF1ZXN0VXJsLnNlYXJjaFBhcmFtcy5nZXQoXCJ1cmxcIik7XG4gICAgICAgICAgaWYgKCF0YXJnZXRVcmwpIHtcbiAgICAgICAgICAgIHJldHVybiBzZW5kSnNvbihyZXMsIDQwMCwgeyBlcnJvcjogXCJVUkwgcGFyYW1ldGVyIGlzIHJlcXVpcmVkXCIgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgICAgICBjb25zdCB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgMTAwMDApO1xuXG4gICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaFB1YmxpY0h0dHBVcmwodGFyZ2V0VXJsLCB7XG4gICAgICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsLFxuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICBcIlVzZXItQWdlbnRcIjpcbiAgICAgICAgICAgICAgICBcIk1vemlsbGEvNS4wIChXaW5kb3dzIE5UIDEwLjA7IFdpbjY0OyB4NjQpIEFwcGxlV2ViS2l0LzUzNy4zNiAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8xMjAuMC4wLjAgU2FmYXJpLzUzNy4zNlwiLFxuICAgICAgICAgICAgICBBY2NlcHQ6XG4gICAgICAgICAgICAgICAgXCJ0ZXh0L2h0bWwsYXBwbGljYXRpb24veGh0bWwreG1sLGFwcGxpY2F0aW9uL3htbDtxPTAuOSx0ZXh0L3BsYWluO3E9MC44LCovKjtxPTAuN1wiLFxuICAgICAgICAgICAgICBcIkFjY2VwdC1MYW5ndWFnZVwiOiBcImVuLVVTLGVuO3E9MC41XCIsXG4gICAgICAgICAgICAgIENvbm5lY3Rpb246IFwia2VlcC1hbGl2ZVwiLFxuICAgICAgICAgICAgICBcIlVwZ3JhZGUtSW5zZWN1cmUtUmVxdWVzdHNcIjogXCIxXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pLmZpbmFsbHkoKCkgPT4gY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCkpO1xuXG4gICAgICAgICAgY29uc3QgY29udGVudFR5cGUgPSByZXNwb25zZS5oZWFkZXJzLmdldChcImNvbnRlbnQtdHlwZVwiKSB8fCBcIlwiO1xuICAgICAgICAgIGNvbnN0IHRleHQgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XG5cbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCIsIFwiKlwiKTtcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIGNvbnRlbnRUeXBlIHx8IFwidGV4dC9odG1sXCIpO1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gcmVzcG9uc2Uuc3RhdHVzO1xuICAgICAgICAgIHJlcy5lbmQodGV4dCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgc2VuZEpzb24ocmVzLCBlcnJvcj8uc3RhdHVzIHx8IDUwMCwge1xuICAgICAgICAgICAgZXJyb3I6IFwiRmFpbGVkIHRvIGZldGNoIFVSTFwiLFxuICAgICAgICAgICAgbWVzc2FnZTogZXJyb3I/Lm1lc3NhZ2UgfHwgXCJVbmtub3duIGVycm9yXCIsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG5cbi8qIFx1MjUwMFx1MjUwMCBEZWVwU2VlayBBUEkgbWlkZGxld2FyZSAoZm9yIEFJLXBvd2VyZWQgY29udGVudCB0b29scykgXHUyNTAwXHUyNTAwICovXG5mdW5jdGlvbiBkZWVwc2Vla0FwaVBsdWdpbigpIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBcInNlb3gtZGVlcHNlZWstYXBpXCIsXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvZGVlcHNlZWtcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIC8vIENPUlMgaGVhZGVyc1xuICAgICAgICByZXMuc2V0SGVhZGVyKFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCIsIFwiKlwiKTtcbiAgICAgICAgcmVzLnNldEhlYWRlcihcIkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHNcIiwgXCJQT1NULCBPUFRJT05TXCIpO1xuICAgICAgICByZXMuc2V0SGVhZGVyKFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVyc1wiLCBcIkNvbnRlbnQtVHlwZSwgQXV0aG9yaXphdGlvblwiKTtcblxuICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gXCJPUFRJT05TXCIpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcbiAgICAgICAgICByZXR1cm4gcmVzLmVuZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7XG4gICAgICAgICAgcmV0dXJuIHNlbmRKc29uKHJlcywgNDA1LCB7IGVycm9yOiBcIk1ldGhvZCBub3QgYWxsb3dlZFwiIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCB2ZXJpZnlEZXZBcGlSZXF1ZXN0KHJlcSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgcmV0dXJuIHNlbmRVbmF1dGhvcml6ZWQocmVzLCBlcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWFkIGVudiB1c2luZyBkb3RlbnYtc3R5bGUgbG9hZGluZ1xuICAgICAgICBjb25zdCBlbnYgPSBsb2FkRW52KFwiZGV2ZWxvcG1lbnRcIiwgcHJvY2Vzcy5jd2QoKSwgXCJcIik7XG4gICAgICAgIGNvbnN0IGFwaUtleSA9IGVudi5ERUVQU0VFS19BUElfS0VZIHx8IHByb2Nlc3MuZW52LkRFRVBTRUVLX0FQSV9LRVk7XG5cbiAgICAgICAgaWYgKCFhcGlLZXkpIHtcbiAgICAgICAgICByZXR1cm4gc2VuZEpzb24ocmVzLCA1MDAsIHtcbiAgICAgICAgICAgIGVycm9yOlxuICAgICAgICAgICAgICBcIkRlZXBTZWVrIEFQSSBrZXkgbm90IGNvbmZpZ3VyZWQuIEFkZCBERUVQU0VFS19BUElfS0VZIHRvIHlvdXIgLmVudiBmaWxlLlwiLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUGFyc2UgSlNPTiBib2R5XG4gICAgICAgIGNvbnN0IGJvZHkgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgIGxldCBkYXRhID0gXCJcIjtcbiAgICAgICAgICByZXEub24oXCJkYXRhXCIsIChjaHVuaykgPT4gKGRhdGEgKz0gY2h1bmspKTtcbiAgICAgICAgICByZXEub24oXCJlbmRcIiwgKCkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgcmVzb2x2ZShKU09OLnBhcnNlKGRhdGEpKTtcbiAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICByZXNvbHZlKHt9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3Qge1xuICAgICAgICAgIHByb21wdCxcbiAgICAgICAgICBzeXN0ZW1JbnN0cnVjdGlvbixcbiAgICAgICAgICByZXNwb25zZU1pbWVUeXBlLFxuICAgICAgICAgIHRlbXBlcmF0dXJlID0gMC43LFxuICAgICAgICAgIG1heFRva2VucyA9IDgxOTIsXG4gICAgICAgIH0gPSBib2R5O1xuXG4gICAgICAgIGlmICghcHJvbXB0KSB7XG4gICAgICAgICAgcmV0dXJuIHNlbmRKc29uKHJlcywgNDAwLCB7IGVycm9yOiBcIlByb21wdCBpcyByZXF1aXJlZFwiIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB3YW50c0pzb24gPSByZXNwb25zZU1pbWVUeXBlID09PSBcImFwcGxpY2F0aW9uL2pzb25cIjtcbiAgICAgICAgICBjb25zdCBzeXN0ZW1NZXNzYWdlcyA9IFtdO1xuICAgICAgICAgIGlmIChzeXN0ZW1JbnN0cnVjdGlvbikgc3lzdGVtTWVzc2FnZXMucHVzaChzeXN0ZW1JbnN0cnVjdGlvbik7XG4gICAgICAgICAgaWYgKHdhbnRzSnNvbikgc3lzdGVtTWVzc2FnZXMucHVzaChcIlJldHVybiB2YWxpZCBKU09OIG9ubHkuXCIpO1xuXG4gICAgICAgICAgY29uc3QgbWVzc2FnZXMgPSBbXTtcbiAgICAgICAgICBpZiAoc3lzdGVtTWVzc2FnZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbWVzc2FnZXMucHVzaCh7XG4gICAgICAgICAgICAgIHJvbGU6IFwic3lzdGVtXCIsXG4gICAgICAgICAgICAgIGNvbnRlbnQ6IHN5c3RlbU1lc3NhZ2VzLmpvaW4oXCJcXG5cXG5cIiksXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgbWVzc2FnZXMucHVzaCh7IHJvbGU6IFwidXNlclwiLCBjb250ZW50OiBwcm9tcHQgfSk7XG5cbiAgICAgICAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgICAgIGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCA2MDAwMCk7XG5cbiAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKFxuICAgICAgICAgICAgXCJodHRwczovL2FwaS5kZWVwc2Vlay5jb20vY2hhdC9jb21wbGV0aW9uc1wiLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke2FwaUtleX1gLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgbW9kZWw6IFwiZGVlcHNlZWstY2hhdFwiLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2VzLFxuICAgICAgICAgICAgICAgIHRlbXBlcmF0dXJlLFxuICAgICAgICAgICAgICAgIG1heF90b2tlbnM6IG1heFRva2VucyxcbiAgICAgICAgICAgICAgICBzdHJlYW06IGZhbHNlLFxuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICApO1xuICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuXG4gICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgY29uc3QgZXJyb3JEYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuICAgICAgICAgICAgcmV0dXJuIHNlbmRKc29uKHJlcywgcmVzcG9uc2Uuc3RhdHVzLCB7XG4gICAgICAgICAgICAgIGVycm9yOlxuICAgICAgICAgICAgICAgIGVycm9yRGF0YS5lcnJvcj8ubWVzc2FnZSB8fFxuICAgICAgICAgICAgICAgIGBEZWVwU2VlayBBUEkgZXJyb3I6ICR7cmVzcG9uc2Uuc3RhdHVzfWAsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgICAgIGNvbnN0IHRleHQgPSBkYXRhLmNob2ljZXM/LlswXT8ubWVzc2FnZT8uY29udGVudCB8fCBcIlwiO1xuXG4gICAgICAgICAgc2VuZEpzb24ocmVzLCAyMDAsIHtcbiAgICAgICAgICAgIHRleHQsXG4gICAgICAgICAgICB1c2FnZTogZGF0YS51c2FnZSxcbiAgICAgICAgICAgIG1vZGVsOiBkYXRhLm1vZGVsLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJEZWVwU2VlayBBUEkgZXJyb3I6XCIsIGVycm9yKTtcbiAgICAgICAgICBzZW5kSnNvbihyZXMsIDUwMCwge1xuICAgICAgICAgICAgZXJyb3I6IGVycm9yPy5tZXNzYWdlIHx8IFwiRmFpbGVkIHRvIGNhbGwgRGVlcFNlZWsgQVBJXCIsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG5cbi8qIFx1MjUwMFx1MjUwMCBDcmF3bGVyIEFQSSBtaWRkbGV3YXJlIChleGlzdGluZykgXHUyNTAwXHUyNTAwICovXG5mdW5jdGlvbiBjcmF3bGVyQXBpUGx1Z2luKCkge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IFwic2VveC1jcmF3bGVyLWFwaVwiLFxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgIHJlZ2lzdGVyQ3Jhd2xlck1pZGRsZXdhcmUoc2VydmVyKTtcbiAgICB9LFxuICAgIGNvbmZpZ3VyZVByZXZpZXdTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICByZWdpc3RlckNyYXdsZXJNaWRkbGV3YXJlKHNlcnZlcik7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZmV0Y2hVcmxNZXRhQXBpUGx1Z2luKCkge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IFwic2VveC1mZXRjaC11cmwtbWV0YS1hcGlcIixcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICByZWdpc3RlckZldGNoVXJsTWV0YU1pZGRsZXdhcmUoc2VydmVyKTtcbiAgICB9LFxuICAgIGNvbmZpZ3VyZVByZXZpZXdTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICByZWdpc3RlckZldGNoVXJsTWV0YU1pZGRsZXdhcmUoc2VydmVyKTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiB3ZWJtYXN0ZXJBcGlQbHVnaW4oKSB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogXCJzZW94LXdlYm1hc3Rlci1hcGlcIixcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICByZWdpc3RlcldlYm1hc3RlckFwaU1pZGRsZXdhcmUoc2VydmVyKTtcbiAgICB9LFxuICAgIGNvbmZpZ3VyZVByZXZpZXdTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICByZWdpc3RlcldlYm1hc3RlckFwaU1pZGRsZXdhcmUoc2VydmVyKTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBhdXRvY29tcGxldGVBcGlQbHVnaW4oKSB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogXCJzZW94LWF1dG9jb21wbGV0ZS1hcGlcIixcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICByZWdpc3RlckF1dG9jb21wbGV0ZU1pZGRsZXdhcmUoc2VydmVyKTtcbiAgICB9LFxuICAgIGNvbmZpZ3VyZVByZXZpZXdTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICByZWdpc3RlckF1dG9jb21wbGV0ZU1pZGRsZXdhcmUoc2VydmVyKTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBnc2NUb2tlbkFwaVBsdWdpbigpIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBcInNlb3gtZ3NjLXRva2VuLWFwaVwiLFxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgIHJlZ2lzdGVyR3NjVG9rZW5NaWRkbGV3YXJlKHNlcnZlcik7XG4gICAgfSxcbiAgICBjb25maWd1cmVQcmV2aWV3U2VydmVyKHNlcnZlcikge1xuICAgICAgcmVnaXN0ZXJHc2NUb2tlbk1pZGRsZXdhcmUoc2VydmVyKTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBwcm9qZWN0c0FwaVBsdWdpbigpIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBcInNlb3gtcHJvamVjdHMtYXBpXCIsXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgcmVnaXN0ZXJQcm9qZWN0c01pZGRsZXdhcmUoc2VydmVyKTtcbiAgICB9LFxuICAgIGNvbmZpZ3VyZVByZXZpZXdTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICByZWdpc3RlclByb2plY3RzTWlkZGxld2FyZShzZXJ2ZXIpO1xuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIG1vdW50ZWRVcmwocmVxLCBtb3VudFBhdGgpIHtcbiAgY29uc3QgcmF3ID0gcmVxLnVybCB8fCBcIlwiO1xuICBpZiAocmF3LnN0YXJ0c1dpdGgobW91bnRQYXRoKSkgcmV0dXJuIGBodHRwOi8vMTI3LjAuMC4xJHtyYXd9YDtcbiAgaWYgKHJhdy5zdGFydHNXaXRoKFwiLz9cIikpIHJldHVybiBgaHR0cDovLzEyNy4wLjAuMSR7bW91bnRQYXRofSR7cmF3LnNsaWNlKDEpfWA7XG4gIGlmIChyYXcuc3RhcnRzV2l0aChcIj9cIikpIHJldHVybiBgaHR0cDovLzEyNy4wLjAuMSR7bW91bnRQYXRofSR7cmF3fWA7XG4gIGlmICghcmF3IHx8IHJhdyA9PT0gXCIvXCIpIHJldHVybiBgaHR0cDovLzEyNy4wLjAuMSR7bW91bnRQYXRofWA7XG4gIHJldHVybiBgaHR0cDovLzEyNy4wLjAuMSR7bW91bnRQYXRofSR7cmF3LnN0YXJ0c1dpdGgoXCIvXCIpID8gcmF3IDogYC8ke3Jhd31gfWA7XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyRmV0Y2hVcmxNZXRhTWlkZGxld2FyZShzZXJ2ZXIpIHtcbiAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShcIi9hcGkvZmV0Y2gtdXJsLW1ldGFcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgY29uc3QgcmVxdWVzdFVybCA9IG5ldyBVUkwocmVxLnVybCB8fCBcIlwiLCBcImh0dHA6Ly8xMjcuMC4wLjFcIik7XG4gICAgY29uc3QgcXVlcnkgPSBPYmplY3QuZnJvbUVudHJpZXMocmVxdWVzdFVybC5zZWFyY2hQYXJhbXMuZW50cmllcygpKTtcbiAgICBjb25zdCBib2R5ID0gW1wiUE9TVFwiLCBcIlBVVFwiLCBcIlBBVENIXCJdLmluY2x1ZGVzKHJlcS5tZXRob2QgfHwgXCJcIilcbiAgICAgID8gYXdhaXQgcmVhZEpzb25Cb2R5KHJlcSlcbiAgICAgIDoge307XG5cbiAgICBhd2FpdCBmZXRjaFVybE1ldGFIYW5kbGVyKFxuICAgICAgeyBtZXRob2Q6IHJlcS5tZXRob2QgfHwgXCJHRVRcIiwgaGVhZGVyczogcmVxLmhlYWRlcnMsIHF1ZXJ5LCBib2R5IH0sXG4gICAgICBjcmVhdGVOb2RlSnNvblJlc3BvbnNlKHJlcylcbiAgICApO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJBdXRvY29tcGxldGVNaWRkbGV3YXJlKHNlcnZlcikge1xuICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9hdXRvY29tcGxldGVcIiwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXV0b2NvbXBsZXRlT25SZXF1ZXN0KHtcbiAgICAgICAgcmVxdWVzdDogbmV3IFJlcXVlc3QobW91bnRlZFVybChyZXEsIFwiL2FwaS9hdXRvY29tcGxldGVcIiksIHtcbiAgICAgICAgICBtZXRob2Q6IHJlcS5tZXRob2QgfHwgXCJHRVRcIixcbiAgICAgICAgICBoZWFkZXJzOiByZXEuaGVhZGVycyxcbiAgICAgICAgfSksXG4gICAgICB9KTtcbiAgICAgIGF3YWl0IHNlbmRXZWJSZXNwb25zZShyZXMsIHJlc3BvbnNlKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgc2VuZEpzb24ocmVzLCA1MDAsIHtcbiAgICAgICAgZXJyb3I6IFwiQXV0b2NvbXBsZXRlIHJlcXVlc3QgZmFpbGVkXCIsXG4gICAgICAgIG1lc3NhZ2U6IGVycm9yPy5tZXNzYWdlIHx8IFwiVW5rbm93biBlcnJvclwiLFxuICAgICAgfSk7XG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJHc2NUb2tlbk1pZGRsZXdhcmUoc2VydmVyKSB7XG4gIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL2dzYy10b2tlblwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVxdWVzdCA9IGF3YWl0IGNyZWF0ZVdlYlJlcXVlc3QocmVxLCBcIi9hcGkvZ3NjLXRva2VuXCIpO1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBnc2NUb2tlbk9uUmVxdWVzdCh7XG4gICAgICAgIHJlcXVlc3QsXG4gICAgICAgIGVudjogbG9hZERldkFwaUVudigpLFxuICAgICAgfSk7XG4gICAgICBhd2FpdCBzZW5kV2ViUmVzcG9uc2UocmVzLCByZXNwb25zZSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHNlbmRKc29uKHJlcywgZXJyb3I/LnN0YXR1cyB8fCA1MDAsIHtcbiAgICAgICAgZXJyb3I6IFwiR1NDIHRva2VuIHJlcXVlc3QgZmFpbGVkXCIsXG4gICAgICAgIG1lc3NhZ2U6IGVycm9yPy5tZXNzYWdlIHx8IFwiVW5rbm93biBlcnJvclwiLFxuICAgICAgfSk7XG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJQcm9qZWN0c01pZGRsZXdhcmUoc2VydmVyKSB7XG4gIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvYXBpL3Byb2plY3RzXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXF1ZXN0ID0gYXdhaXQgY3JlYXRlV2ViUmVxdWVzdChyZXEsIFwiL2FwaS9wcm9qZWN0c1wiKTtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcHJvamVjdHNPblJlcXVlc3Qoe1xuICAgICAgICByZXF1ZXN0LFxuICAgICAgICBlbnY6IGxvYWREZXZBcGlFbnYoKSxcbiAgICAgIH0pO1xuICAgICAgYXdhaXQgc2VuZFdlYlJlc3BvbnNlKHJlcywgcmVzcG9uc2UpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBzZW5kSnNvbihyZXMsIGVycm9yPy5zdGF0dXMgfHwgNTAwLCB7XG4gICAgICAgIGVycm9yOiBcIlByb2plY3RzIHJlcXVlc3QgZmFpbGVkXCIsXG4gICAgICAgIG1lc3NhZ2U6IGVycm9yPy5tZXNzYWdlIHx8IFwiVW5rbm93biBlcnJvclwiLFxuICAgICAgfSk7XG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJXZWJtYXN0ZXJBcGlNaWRkbGV3YXJlKHNlcnZlcikge1xuICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS93ZWJtYXN0ZXItYXBpXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB2ZXJpZnlEZXZBcGlSZXF1ZXN0KHJlcSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHJldHVybiBzZW5kVW5hdXRob3JpemVkKHJlcywgZXJyb3IpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlcXVlc3RVcmwgPSBuZXcgVVJMKHJlcS51cmwgfHwgXCJcIiwgXCJodHRwOi8vMTI3LjAuMC4xXCIpO1xuICAgIGNvbnN0IHF1ZXJ5ID0gT2JqZWN0LmZyb21FbnRyaWVzKHJlcXVlc3RVcmwuc2VhcmNoUGFyYW1zLmVudHJpZXMoKSk7XG5cbiAgICBhd2FpdCB3ZWJtYXN0ZXJBcGlIYW5kbGVyKFxuICAgICAgeyBtZXRob2Q6IHJlcS5tZXRob2QgfHwgXCJHRVRcIiwgcXVlcnkgfSxcbiAgICAgIGNyZWF0ZU5vZGVKc29uUmVzcG9uc2UocmVzKVxuICAgICk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiByZWdpc3RlckNyYXdsZXJNaWRkbGV3YXJlKHNlcnZlcikge1xuICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9jcmF3bGVyL2ZldGNoXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgIHRyeSB7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCB2ZXJpZnlEZXZBcGlSZXF1ZXN0KHJlcSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBzZW5kVW5hdXRob3JpemVkKHJlcywgZXJyb3IpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlcXVlc3RVcmwgPSBuZXcgVVJMKHJlcS51cmwgfHwgXCJcIiwgXCJodHRwOi8vMTI3LjAuMC4xXCIpO1xuICAgICAgY29uc3QgdGFyZ2V0UmF3ID0gcmVxdWVzdFVybC5zZWFyY2hQYXJhbXMuZ2V0KFwidXJsXCIpO1xuICAgICAgaWYgKCF0YXJnZXRSYXcpIHtcbiAgICAgICAgc2VuZEpzb24ocmVzLCA0MDAsIHsgZXJyb3I6IFwiTWlzc2luZyB1cmwgcGFyYW1ldGVyXCIgfSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdGFyZ2V0ID0gcGFyc2VQdWJsaWNIdHRwVXJsKHRhcmdldFJhdyk7XG5cbiAgICAgIGNvbnN0IHN0YXJ0ZWQgPSBEYXRlLm5vdygpO1xuICAgICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgMTIwMDApO1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaFB1YmxpY0h0dHBVcmwodGFyZ2V0LnRvU3RyaW5nKCksIHtcbiAgICAgICAgbWF4UmVkaXJlY3RzOiAwLFxuICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgXCJ1c2VyLWFnZW50XCI6XG4gICAgICAgICAgICBcIlNFT1hCb3QvMS4wICgraHR0cHM6Ly9zZW94LmxvY2FsL2NyYXdsZXI7IGNvbXBhdGlibGU7IHNpdGUtYXVkaXQpXCIsXG4gICAgICAgICAgYWNjZXB0OlxuICAgICAgICAgICAgXCJ0ZXh0L2h0bWwsYXBwbGljYXRpb24veGh0bWwreG1sLGFwcGxpY2F0aW9uL3htbDtxPTAuOSx0ZXh0L3BsYWluO3E9MC44LCovKjtxPTAuNVwiLFxuICAgICAgICB9LFxuICAgICAgfSkuZmluYWxseSgoKSA9PiBjbGVhclRpbWVvdXQodGltZW91dCkpO1xuXG4gICAgICBjb25zdCBjb250ZW50VHlwZSA9IHJlc3BvbnNlLmhlYWRlcnMuZ2V0KFwiY29udGVudC10eXBlXCIpIHx8IFwidW5rbm93blwiO1xuICAgICAgY29uc3QgbG9jYXRpb24gPSByZXNwb25zZS5oZWFkZXJzLmdldChcImxvY2F0aW9uXCIpO1xuICAgICAgY29uc3QgYnl0ZXMgPSBCdWZmZXIuZnJvbShhd2FpdCByZXNwb25zZS5hcnJheUJ1ZmZlcigpKTtcbiAgICAgIGNvbnN0IHRleHQgPSBpc1RleHRDb250ZW50KGNvbnRlbnRUeXBlKVxuICAgICAgICA/IGJ5dGVzLnRvU3RyaW5nKFwidXRmOFwiKS5zbGljZSgwLCAyXzAwMF8wMDApXG4gICAgICAgIDogXCJcIjtcbiAgICAgIGNvbnN0IGZpbmFsVXJsID0gcmVzcG9uc2UudXJsIHx8IHRhcmdldC50b1N0cmluZygpO1xuICAgICAgY29uc3QgcGFyc2VkID0gcGFyc2VDcmF3bFRleHQodGV4dCwgY29udGVudFR5cGUsIGZpbmFsVXJsKTtcbiAgICAgIGlmIChsb2NhdGlvbikge1xuICAgICAgICBwYXJzZWQubGlua3MgPSBbXG4gICAgICAgICAgLi4ubmV3IFNldChbXG4gICAgICAgICAgICAuLi4ocGFyc2VkLmxpbmtzIHx8IFtdKSxcbiAgICAgICAgICAgIHJlc29sdmVVcmwobG9jYXRpb24sIGZpbmFsVXJsKSxcbiAgICAgICAgICBdLmZpbHRlcihCb29sZWFuKSksXG4gICAgICAgIF07XG4gICAgICB9XG5cbiAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7XG4gICAgICAgIHVybDogdGFyZ2V0LnRvU3RyaW5nKCksXG4gICAgICAgIGZpbmFsVXJsLFxuICAgICAgICBzdGF0dXM6IHJlc3BvbnNlLnN0YXR1cyxcbiAgICAgICAgY29udGVudFR5cGUsXG4gICAgICAgIHJlZGlyZWN0ZWRUbzogbG9jYXRpb24gPyByZXNvbHZlVXJsKGxvY2F0aW9uLCBmaW5hbFVybCkgOiBudWxsLFxuICAgICAgICB4Um9ib3RzVGFnOiByZXNwb25zZS5oZWFkZXJzLmdldChcIngtcm9ib3RzLXRhZ1wiKSB8fCBcIlwiLFxuICAgICAgICBzaXplS2I6IE1hdGgucm91bmQoKGJ5dGVzLmxlbmd0aCAvIDEwMjQpICogMTApIC8gMTAsXG4gICAgICAgIGxvYWRUaW1lOiBEYXRlLm5vdygpIC0gc3RhcnRlZCxcbiAgICAgICAgLi4ucGFyc2VkLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnN0IHN0YXR1cyA9IGVycm9yPy5uYW1lID09PSBcIkFib3J0RXJyb3JcIiA/IDUwNCA6IGVycm9yPy5zdGF0dXMgfHwgNTAwO1xuICAgICAgc2VuZEpzb24ocmVzLCBzdGF0dXMsIHtcbiAgICAgICAgZXJyb3I6XG4gICAgICAgICAgZXJyb3I/Lm5hbWUgPT09IFwiQWJvcnRFcnJvclwiXG4gICAgICAgICAgICA/IFwiQ3Jhd2wgcmVxdWVzdCB0aW1lZCBvdXRcIlxuICAgICAgICAgICAgOiBlcnJvcj8ubWVzc2FnZSB8fCBcIkNyYXdsIHJlcXVlc3QgZmFpbGVkXCIsXG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBpc1RleHRDb250ZW50KGNvbnRlbnRUeXBlID0gXCJcIikge1xuICBjb25zdCBsb3dlcmVkID0gY29udGVudFR5cGUudG9Mb3dlckNhc2UoKTtcbiAgcmV0dXJuIFRFWFRfVFlQRVMuc29tZSgodHlwZSkgPT4gbG93ZXJlZC5pbmNsdWRlcyh0eXBlKSk7XG59XG5cbmZ1bmN0aW9uIHBhcnNlQ3Jhd2xUZXh0KHRleHQsIGNvbnRlbnRUeXBlLCBiYXNlVXJsKSB7XG4gIGNvbnN0IGxvd2VyZWQgPSBjb250ZW50VHlwZS50b0xvd2VyQ2FzZSgpO1xuICBpZiAoIXRleHQpIHJldHVybiB7IGxpbmtzOiBbXSwgcmVzb3VyY2VzOiBbXSwgc2l0ZW1hcHM6IFtdLCBkaXNhbGxvdzogW10gfTtcbiAgaWYgKGxvd2VyZWQuaW5jbHVkZXMoXCJ4bWxcIikpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbGlua3M6IGV4dHJhY3RTaXRlbWFwTG9jcyh0ZXh0LCBiYXNlVXJsKSxcbiAgICAgIHJlc291cmNlczogW10sXG4gICAgICBzaXRlbWFwczogW10sXG4gICAgICBkaXNhbGxvdzogW10sXG4gICAgfTtcbiAgfVxuICBpZiAoYmFzZVVybC5lbmRzV2l0aChcIi9yb2JvdHMudHh0XCIpIHx8IGxvd2VyZWQuaW5jbHVkZXMoXCJ0ZXh0L3BsYWluXCIpKSB7XG4gICAgY29uc3Qgcm9ib3RzID0gcGFyc2VSb2JvdHModGV4dCwgYmFzZVVybCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIGxpbmtzOiBbXSxcbiAgICAgIHJlc291cmNlczogW10sXG4gICAgICBzaXRlbWFwczogcm9ib3RzLnNpdGVtYXBzLFxuICAgICAgZGlzYWxsb3c6IHJvYm90cy5kaXNhbGxvdyxcbiAgICB9O1xuICB9XG4gIHJldHVybiBwYXJzZUh0bWwodGV4dCwgYmFzZVVybCk7XG59XG5cbmZ1bmN0aW9uIHBhcnNlSHRtbChodG1sLCBiYXNlVXJsKSB7XG4gIGNvbnN0IGxpbmtzID0gbmV3IFNldCgpO1xuICBjb25zdCByZXNvdXJjZXMgPSBuZXcgU2V0KCk7XG5cbiAgZm9yIChjb25zdCBocmVmIG9mIG1hdGNoQXR0cmlidXRlcyhodG1sLCBcImFcIiwgXCJocmVmXCIpKSB7XG4gICAgYWRkUmVzb2x2ZWQobGlua3MsIGhyZWYsIGJhc2VVcmwpO1xuICB9XG4gIGZvciAoY29uc3QgaHJlZiBvZiBtYXRjaEF0dHJpYnV0ZXMoaHRtbCwgXCJsaW5rXCIsIFwiaHJlZlwiKSkge1xuICAgIGFkZFJlc29sdmVkKHJlc291cmNlcywgaHJlZiwgYmFzZVVybCk7XG4gIH1cbiAgZm9yIChjb25zdCBzcmMgb2YgbWF0Y2hBdHRyaWJ1dGVzKGh0bWwsIFwic2NyaXB0XCIsIFwic3JjXCIpKSB7XG4gICAgYWRkUmVzb2x2ZWQocmVzb3VyY2VzLCBzcmMsIGJhc2VVcmwpO1xuICB9XG4gIGZvciAoY29uc3Qgc3JjIG9mIG1hdGNoQXR0cmlidXRlcyhodG1sLCBcImltZ1wiLCBcInNyY1wiKSkge1xuICAgIGFkZFJlc29sdmVkKHJlc291cmNlcywgc3JjLCBiYXNlVXJsKTtcbiAgfVxuICBmb3IgKGNvbnN0IHNyY3NldCBvZiBtYXRjaEF0dHJpYnV0ZXMoaHRtbCwgXCJzb3VyY2VcIiwgXCJzcmNzZXRcIikpIHtcbiAgICBmb3IgKGNvbnN0IHNyYyBvZiBwYXJzZVNyY1NldChzcmNzZXQpKSBhZGRSZXNvbHZlZChyZXNvdXJjZXMsIHNyYywgYmFzZVVybCk7XG4gIH1cbiAgZm9yIChjb25zdCBzcmNzZXQgb2YgbWF0Y2hBdHRyaWJ1dGVzKGh0bWwsIFwiaW1nXCIsIFwic3Jjc2V0XCIpKSB7XG4gICAgZm9yIChjb25zdCBzcmMgb2YgcGFyc2VTcmNTZXQoc3Jjc2V0KSkgYWRkUmVzb2x2ZWQocmVzb3VyY2VzLCBzcmMsIGJhc2VVcmwpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBsaW5rczogQXJyYXkuZnJvbShsaW5rcyksXG4gICAgcmVzb3VyY2VzOiBBcnJheS5mcm9tKHJlc291cmNlcyksXG4gICAgc2l0ZW1hcHM6IFtdLFxuICAgIGRpc2FsbG93OiBbXSxcbiAgICBhdWRpdDogZXh0cmFjdEh0bWxBdWRpdChodG1sLCBiYXNlVXJsLCB7XG4gICAgICBsaW5rczogQXJyYXkuZnJvbShsaW5rcyksXG4gICAgICByZXNvdXJjZXM6IEFycmF5LmZyb20ocmVzb3VyY2VzKSxcbiAgICB9KSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdEh0bWxBdWRpdChodG1sLCBiYXNlVXJsLCBkaXNjb3ZlcmVkKSB7XG4gIGNvbnN0IHRpdGxlVGFncyA9IG1hdGNoVGFncyhodG1sLCBcInRpdGxlXCIpLm1hcCgodGFnKSA9PiBzdHJpcFRhZ3ModGFnKSk7XG4gIGNvbnN0IGgxVGFncyA9IG1hdGNoVGFncyhodG1sLCBcImgxXCIpLm1hcCgodGFnKSA9PiBzdHJpcFRhZ3ModGFnKSk7XG4gIGNvbnN0IG1ldGFUYWdzID0gbWF0Y2hUYWdCbG9ja3MoaHRtbCwgXCJtZXRhXCIpLm1hcChwYXJzZUF0dHJpYnV0ZXMpO1xuICBjb25zdCBsaW5rVGFncyA9IG1hdGNoVGFnQmxvY2tzKGh0bWwsIFwibGlua1wiKS5tYXAocGFyc2VBdHRyaWJ1dGVzKTtcbiAgY29uc3QgaW1nVGFncyA9IG1hdGNoVGFnQmxvY2tzKGh0bWwsIFwiaW1nXCIpLm1hcChwYXJzZUF0dHJpYnV0ZXMpO1xuICBjb25zdCBjYW5vbmljYWwgPSBsaW5rVGFncy5maW5kKChhdHRycykgPT5cbiAgICBTdHJpbmcoYXR0cnMucmVsIHx8IFwiXCIpLnRvTG93ZXJDYXNlKCkuc3BsaXQoL1xccysvKS5pbmNsdWRlcyhcImNhbm9uaWNhbFwiKVxuICApO1xuICBjb25zdCByb2JvdHNNZXRhID0gbWV0YVRhZ3NcbiAgICAuZmlsdGVyKChhdHRycykgPT4gU3RyaW5nKGF0dHJzLm5hbWUgfHwgXCJcIikudG9Mb3dlckNhc2UoKSA9PT0gXCJyb2JvdHNcIilcbiAgICAubWFwKChhdHRycykgPT4gU3RyaW5nKGF0dHJzLmNvbnRlbnQgfHwgXCJcIikudG9Mb3dlckNhc2UoKSlcbiAgICAuam9pbihcIiwgXCIpO1xuICBjb25zdCBkZXNjcmlwdGlvbnMgPSBtZXRhVGFncy5maWx0ZXIoKGF0dHJzKSA9PlxuICAgIFtcImRlc2NyaXB0aW9uXCIsIFwib2c6ZGVzY3JpcHRpb25cIiwgXCJ0d2l0dGVyOmRlc2NyaXB0aW9uXCJdLmluY2x1ZGVzKFxuICAgICAgU3RyaW5nKGF0dHJzLm5hbWUgfHwgYXR0cnMucHJvcGVydHkgfHwgXCJcIikudG9Mb3dlckNhc2UoKVxuICAgIClcbiAgKTtcbiAgY29uc3QgbWV0YURlc2NyaXB0aW9ucyA9IG1ldGFUYWdzLmZpbHRlcigoYXR0cnMpID0+XG4gICAgU3RyaW5nKGF0dHJzLm5hbWUgfHwgXCJcIikudG9Mb3dlckNhc2UoKSA9PT0gXCJkZXNjcmlwdGlvblwiXG4gICk7XG4gIGNvbnN0IG9nVGFncyA9IE9iamVjdC5mcm9tRW50cmllcyhcbiAgICBtZXRhVGFnc1xuICAgICAgLmZpbHRlcigoYXR0cnMpID0+IFN0cmluZyhhdHRycy5wcm9wZXJ0eSB8fCBhdHRycy5uYW1lIHx8IFwiXCIpLnRvTG93ZXJDYXNlKCkuc3RhcnRzV2l0aChcIm9nOlwiKSlcbiAgICAgIC5tYXAoKGF0dHJzKSA9PiBbU3RyaW5nKGF0dHJzLnByb3BlcnR5IHx8IGF0dHJzLm5hbWUpLnRvTG93ZXJDYXNlKCksIGF0dHJzLmNvbnRlbnQgfHwgXCJcIl0pXG4gICk7XG4gIGNvbnN0IHR3aXR0ZXJUYWdzID0gT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgIG1ldGFUYWdzXG4gICAgICAuZmlsdGVyKChhdHRycykgPT4gU3RyaW5nKGF0dHJzLm5hbWUgfHwgYXR0cnMucHJvcGVydHkgfHwgXCJcIikudG9Mb3dlckNhc2UoKS5zdGFydHNXaXRoKFwidHdpdHRlcjpcIikpXG4gICAgICAubWFwKChhdHRycykgPT4gW1N0cmluZyhhdHRycy5uYW1lIHx8IGF0dHJzLnByb3BlcnR5KS50b0xvd2VyQ2FzZSgpLCBhdHRycy5jb250ZW50IHx8IFwiXCJdKVxuICApO1xuICBjb25zdCBpc0h0dHBzID0gYmFzZVVybC5zdGFydHNXaXRoKFwiaHR0cHM6XCIpO1xuICBjb25zdCBhbGxEaXNjb3ZlcmVkID0gWy4uLmRpc2NvdmVyZWQubGlua3MsIC4uLmRpc2NvdmVyZWQucmVzb3VyY2VzXTtcbiAgY29uc3QgaHR0cFVybHMgPSBhbGxEaXNjb3ZlcmVkLmZpbHRlcigodXJsKSA9PiB1cmwuc3RhcnRzV2l0aChcImh0dHA6Ly9cIikpO1xuICBjb25zdCBpbWFnZUh0dHBVcmxzID0gaW1nVGFnc1xuICAgIC5tYXAoKGF0dHJzKSA9PiBhdHRycy5zcmMpXG4gICAgLmZpbHRlcigoc3JjKSA9PiBzcmMgJiYgcmVzb2x2ZVVybChzcmMsIGJhc2VVcmwpPy5zdGFydHNXaXRoKFwiaHR0cDovL1wiKSk7XG4gIGNvbnN0IG1ldGFSZWZyZXNoID0gbWF0Y2hUYWdCbG9ja3MoaHRtbCwgXCJtZXRhXCIpLmZpbmQoKHRhZykgPT5cbiAgICAvaHR0cC1lcXVpdlxccyo9XFxzKltcIiddP3JlZnJlc2gvaS50ZXN0KHRhZylcbiAgKTtcblxuICByZXR1cm4ge1xuICAgIHRpdGxlQ291bnQ6IHRpdGxlVGFncy5sZW5ndGgsXG4gICAgdGl0bGVUZXh0OiB0aXRsZVRhZ3NbMF0gfHwgXCJcIixcbiAgICB0aXRsZUxlbmd0aDogKHRpdGxlVGFnc1swXSB8fCBcIlwiKS5sZW5ndGgsXG4gICAgaDFDb3VudDogaDFUYWdzLmxlbmd0aCxcbiAgICBoMVRleHQ6IGgxVGFnc1swXSB8fCBcIlwiLFxuICAgIG1ldGFEZXNjcmlwdGlvbkNvdW50OiBtZXRhRGVzY3JpcHRpb25zLmxlbmd0aCxcbiAgICBtZXRhRGVzY3JpcHRpb25UZXh0OiBtZXRhRGVzY3JpcHRpb25zWzBdPy5jb250ZW50IHx8IFwiXCIsXG4gICAgbWV0YURlc2NyaXB0aW9uTGVuZ3RoOiAobWV0YURlc2NyaXB0aW9uc1swXT8uY29udGVudCB8fCBcIlwiKS5sZW5ndGgsXG4gICAgYW55RGVzY3JpcHRpb25Db3VudDogZGVzY3JpcHRpb25zLmxlbmd0aCxcbiAgICBjYW5vbmljYWxVcmw6IGNhbm9uaWNhbD8uaHJlZiA/IHJlc29sdmVVcmwoY2Fub25pY2FsLmhyZWYsIGJhc2VVcmwpIDogXCJcIixcbiAgICByb2JvdHNNZXRhLFxuICAgIG5vaW5kZXg6IC9cXGJub2luZGV4XFxiL2kudGVzdChyb2JvdHNNZXRhKSxcbiAgICBub2ZvbGxvdzogL1xcYm5vZm9sbG93XFxiL2kudGVzdChyb2JvdHNNZXRhKSxcbiAgICBvZ1RhZ3MsXG4gICAgdHdpdHRlclRhZ3MsXG4gICAgb2dNaXNzaW5nQ291bnQ6IGNvdW50TWlzc2luZyhvZ1RhZ3MsIFtcIm9nOnRpdGxlXCIsIFwib2c6dHlwZVwiLCBcIm9nOmltYWdlXCIsIFwib2c6dXJsXCIsIFwib2c6ZGVzY3JpcHRpb25cIl0pLFxuICAgIHR3aXR0ZXJNaXNzaW5nQ291bnQ6IGNvdW50TWlzc2luZyh0d2l0dGVyVGFncywgW1widHdpdHRlcjpjYXJkXCIsIFwidHdpdHRlcjp0aXRsZVwiLCBcInR3aXR0ZXI6ZGVzY3JpcHRpb25cIiwgXCJ0d2l0dGVyOmltYWdlXCJdKSxcbiAgICBvZ01pc3NpbmdBbGw6IE9iamVjdC5rZXlzKG9nVGFncykubGVuZ3RoID09PSAwLFxuICAgIHR3aXR0ZXJNaXNzaW5nQWxsOiBPYmplY3Qua2V5cyh0d2l0dGVyVGFncykubGVuZ3RoID09PSAwLFxuICAgIGltYWdlQ291bnQ6IGltZ1RhZ3MubGVuZ3RoLFxuICAgIG1pc3NpbmdJbWFnZUFsdENvdW50OiBpbWdUYWdzLmZpbHRlcigoYXR0cnMpID0+ICFTdHJpbmcoYXR0cnMuYWx0IHx8IFwiXCIpLnRyaW0oKSkubGVuZ3RoLFxuICAgIG1peGVkQ29udGVudENvdW50OiBpc0h0dHBzID8gaHR0cFVybHMubGVuZ3RoIDogMCxcbiAgICBodHRwSW1hZ2VDb3VudDogaXNIdHRwcyA/IGltYWdlSHR0cFVybHMubGVuZ3RoIDogMCxcbiAgICBtZXRhUmVmcmVzaFJlZGlyZWN0OiBCb29sZWFuKG1ldGFSZWZyZXNoKSxcbiAgICBsaW5rc0NvdW50OiBkaXNjb3ZlcmVkLmxpbmtzLmxlbmd0aCxcbiAgICB3b3JkQ291bnQ6IHN0cmlwVGFncyhodG1sKS5zcGxpdCgvXFxzKy8pLmZpbHRlcihCb29sZWFuKS5sZW5ndGgsXG4gIH07XG59XG5cbmZ1bmN0aW9uIG1hdGNoQXR0cmlidXRlcyhodG1sLCB0YWcsIGF0dHIpIHtcbiAgY29uc3QgbWF0Y2hlcyA9IFtdO1xuICBjb25zdCB0YWdSZSA9IG5ldyBSZWdFeHAoYDwke3RhZ31cXFxcYltePl0qPmAsIFwiZ2lcIik7XG4gIGNvbnN0IGF0dHJSZSA9IG5ldyBSZWdFeHAoYCR7YXR0cn1cXFxccyo9XFxcXHMqKFtcXFwiJ10pKC4qPylcXFxcMWAsIFwiaVwiKTtcbiAgZm9yIChjb25zdCB0YWdNYXRjaCBvZiBodG1sLm1hdGNoQWxsKHRhZ1JlKSkge1xuICAgIGNvbnN0IGF0dHJNYXRjaCA9IHRhZ01hdGNoWzBdLm1hdGNoKGF0dHJSZSk7XG4gICAgaWYgKGF0dHJNYXRjaD8uWzJdKSBtYXRjaGVzLnB1c2goZGVjb2RlSHRtbChhdHRyTWF0Y2hbMl0udHJpbSgpKSk7XG4gIH1cbiAgcmV0dXJuIG1hdGNoZXM7XG59XG5cbmZ1bmN0aW9uIG1hdGNoVGFncyhodG1sLCB0YWcpIHtcbiAgY29uc3QgcmUgPSBuZXcgUmVnRXhwKGA8JHt0YWd9XFxcXGJbXj5dKj5bXFxcXHNcXFxcU10qPzxcXFxcLyR7dGFnfT5gLCBcImdpXCIpO1xuICByZXR1cm4gQXJyYXkuZnJvbShodG1sLm1hdGNoQWxsKHJlKSwgKG1hdGNoKSA9PiBtYXRjaFswXSk7XG59XG5cbmZ1bmN0aW9uIG1hdGNoVGFnQmxvY2tzKGh0bWwsIHRhZykge1xuICBjb25zdCByZSA9IG5ldyBSZWdFeHAoYDwke3RhZ31cXFxcYltePl0qPmAsIFwiZ2lcIik7XG4gIHJldHVybiBBcnJheS5mcm9tKGh0bWwubWF0Y2hBbGwocmUpLCAobWF0Y2gpID0+IG1hdGNoWzBdKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VBdHRyaWJ1dGVzKHRhZykge1xuICBjb25zdCBhdHRycyA9IHt9O1xuICBjb25zdCBhdHRyUmUgPSAvKFthLXpBLVpfOl1bLWEtekEtWjAtOV86Ll0qKVxccyo9XFxzKig/OlwiKFteXCJdKilcInwnKFteJ10qKSd8KFteXFxzXCInPTw+YF0rKSkvZztcbiAgZm9yIChjb25zdCBtYXRjaCBvZiB0YWcubWF0Y2hBbGwoYXR0clJlKSkge1xuICAgIGF0dHJzW21hdGNoWzFdLnRvTG93ZXJDYXNlKCldID0gZGVjb2RlSHRtbChtYXRjaFsyXSB8fCBtYXRjaFszXSB8fCBtYXRjaFs0XSB8fCBcIlwiKTtcbiAgfVxuICByZXR1cm4gYXR0cnM7XG59XG5cbmZ1bmN0aW9uIHN0cmlwVGFncyh2YWx1ZSkge1xuICByZXR1cm4gZGVjb2RlSHRtbChTdHJpbmcodmFsdWUpLnJlcGxhY2UoLzxbXj5dKz4vZywgXCIgXCIpLnJlcGxhY2UoL1xccysvZywgXCIgXCIpLnRyaW0oKSk7XG59XG5cbmZ1bmN0aW9uIGNvdW50TWlzc2luZyhzb3VyY2UsIGtleXMpIHtcbiAgcmV0dXJuIGtleXMuZmlsdGVyKChrZXkpID0+ICFTdHJpbmcoc291cmNlW2tleV0gfHwgXCJcIikudHJpbSgpKS5sZW5ndGg7XG59XG5cbmZ1bmN0aW9uIHBhcnNlU3JjU2V0KHNyY3NldCkge1xuICByZXR1cm4gU3RyaW5nKHNyY3NldClcbiAgICAuc3BsaXQoXCIsXCIpXG4gICAgLm1hcCgocGFydCkgPT4gcGFydC50cmltKCkuc3BsaXQoL1xccysvKVswXSlcbiAgICAuZmlsdGVyKEJvb2xlYW4pO1xufVxuXG5mdW5jdGlvbiBleHRyYWN0U2l0ZW1hcExvY3MoeG1sLCBiYXNlVXJsKSB7XG4gIGNvbnN0IHVybHMgPSBuZXcgU2V0KCk7XG4gIGZvciAoY29uc3QgbWF0Y2ggb2YgeG1sLm1hdGNoQWxsKC88bG9jW14+XSo+XFxzKihbXjxdKylcXHMqPFxcL2xvYz4vZ2kpKSB7XG4gICAgYWRkUmVzb2x2ZWQodXJscywgZGVjb2RlSHRtbChtYXRjaFsxXS50cmltKCkpLCBiYXNlVXJsKTtcbiAgfVxuICByZXR1cm4gQXJyYXkuZnJvbSh1cmxzKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VSb2JvdHModGV4dCwgYmFzZVVybCkge1xuICBjb25zdCBzaXRlbWFwcyA9IG5ldyBTZXQoKTtcbiAgY29uc3QgZGlzYWxsb3cgPSBuZXcgU2V0KCk7XG5cbiAgZm9yIChjb25zdCByYXdMaW5lIG9mIHRleHQuc3BsaXQoL1xccj9cXG4vKSkge1xuICAgIGNvbnN0IGxpbmUgPSByYXdMaW5lLnJlcGxhY2UoLyMuKi8sIFwiXCIpLnRyaW0oKTtcbiAgICBjb25zdCBzaXRlbWFwID0gbGluZS5tYXRjaCgvXnNpdGVtYXA6XFxzKiguKykkL2kpO1xuICAgIGlmIChzaXRlbWFwKSBhZGRSZXNvbHZlZChzaXRlbWFwcywgc2l0ZW1hcFsxXS50cmltKCksIGJhc2VVcmwpO1xuXG4gICAgY29uc3QgYmxvY2tlZCA9IGxpbmUubWF0Y2goL15kaXNhbGxvdzpcXHMqKC4rKSQvaSk7XG4gICAgaWYgKGJsb2NrZWQgJiYgYmxvY2tlZFsxXS50cmltKCkpIGRpc2FsbG93LmFkZChibG9ja2VkWzFdLnRyaW0oKSk7XG4gIH1cblxuICByZXR1cm4geyBzaXRlbWFwczogQXJyYXkuZnJvbShzaXRlbWFwcyksIGRpc2FsbG93OiBBcnJheS5mcm9tKGRpc2FsbG93KSB9O1xufVxuXG5mdW5jdGlvbiBhZGRSZXNvbHZlZChzZXQsIHZhbHVlLCBiYXNlVXJsKSB7XG4gIGlmICghdmFsdWUgfHwgL14obWFpbHRvOnx0ZWw6fGphdmFzY3JpcHQ6fGRhdGE6fGJsb2I6KS9pLnRlc3QodmFsdWUpKSByZXR1cm47XG4gIGNvbnN0IHJlc29sdmVkID0gcmVzb2x2ZVVybCh2YWx1ZSwgYmFzZVVybCk7XG4gIGlmIChyZXNvbHZlZCkgc2V0LmFkZChyZXNvbHZlZCk7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVVcmwodmFsdWUsIGJhc2VVcmwpIHtcbiAgaWYgKCF2YWx1ZSB8fCAvXihtYWlsdG86fHRlbDp8amF2YXNjcmlwdDp8ZGF0YTp8YmxvYjopL2kudGVzdCh2YWx1ZSkpIHJldHVybiBcIlwiO1xuICB0cnkge1xuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwodmFsdWUsIGJhc2VVcmwpO1xuICAgIHVybC5oYXNoID0gXCJcIjtcbiAgICByZXR1cm4gdXJsLnRvU3RyaW5nKCk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBcIlwiO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRlY29kZUh0bWwodmFsdWUpIHtcbiAgcmV0dXJuIFN0cmluZyh2YWx1ZSlcbiAgICAucmVwbGFjZSgvJmFtcDsvZywgXCImXCIpXG4gICAgLnJlcGxhY2UoLyZsdDsvZywgXCI8XCIpXG4gICAgLnJlcGxhY2UoLyZndDsvZywgXCI+XCIpXG4gICAgLnJlcGxhY2UoLyZxdW90Oy9nLCBcIlxcXCJcIilcbiAgICAucmVwbGFjZSgvJiMzOTsvZywgXCInXCIpO1xufVxuXG5mdW5jdGlvbiByZWFkSnNvbkJvZHkocmVxKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgIGxldCBkYXRhID0gXCJcIjtcbiAgICByZXEub24oXCJkYXRhXCIsIChjaHVuaykgPT4ge1xuICAgICAgZGF0YSArPSBjaHVuaztcbiAgICB9KTtcbiAgICByZXEub24oXCJlbmRcIiwgKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmVzb2x2ZShkYXRhID8gSlNPTi5wYXJzZShkYXRhKSA6IHt9KTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICByZXNvbHZlKHt9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHJlYWRSYXdCb2R5KHJlcSkge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICBjb25zdCBjaHVua3MgPSBbXTtcbiAgICByZXEub24oXCJkYXRhXCIsIChjaHVuaykgPT4gY2h1bmtzLnB1c2goQnVmZmVyLmZyb20oY2h1bmspKSk7XG4gICAgcmVxLm9uKFwiZW5kXCIsICgpID0+IHJlc29sdmUoQnVmZmVyLmNvbmNhdChjaHVua3MpLnRvU3RyaW5nKFwidXRmOFwiKSkpO1xuICB9KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gY3JlYXRlV2ViUmVxdWVzdChyZXEsIG1vdW50UGF0aCkge1xuICBjb25zdCBoZWFkZXJzID0gbmV3IEhlYWRlcnMoKTtcbiAgT2JqZWN0LmVudHJpZXMocmVxLmhlYWRlcnMgfHwge30pLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgaGVhZGVycy5zZXQoa2V5LCB2YWx1ZS5qb2luKFwiLCBcIikpO1xuICAgIGVsc2UgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIGhlYWRlcnMuc2V0KGtleSwgU3RyaW5nKHZhbHVlKSk7XG4gIH0pO1xuXG4gIGNvbnN0IG1ldGhvZCA9IHJlcS5tZXRob2QgfHwgXCJHRVRcIjtcbiAgY29uc3QgaW5pdCA9IHsgbWV0aG9kLCBoZWFkZXJzIH07XG4gIGlmICghW1wiR0VUXCIsIFwiSEVBRFwiXS5pbmNsdWRlcyhtZXRob2QpKSB7XG4gICAgaW5pdC5ib2R5ID0gYXdhaXQgcmVhZFJhd0JvZHkocmVxKTtcbiAgfVxuXG4gIHJldHVybiBuZXcgUmVxdWVzdChtb3VudGVkVXJsKHJlcSwgbW91bnRQYXRoKSwgaW5pdCk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU5vZGVKc29uUmVzcG9uc2UocmVzKSB7XG4gIHJldHVybiB7XG4gICAgc2V0SGVhZGVyKG5hbWUsIHZhbHVlKSB7XG4gICAgICByZXMuc2V0SGVhZGVyKG5hbWUsIHZhbHVlKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgc3RhdHVzKHN0YXR1c0NvZGUpIHtcbiAgICAgIHJlcy5zdGF0dXNDb2RlID0gc3RhdHVzQ29kZTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAganNvbihwYXlsb2FkKSB7XG4gICAgICByZXMuc2V0SGVhZGVyKFwiY29udGVudC10eXBlXCIsIFwiYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD11dGYtOFwiKTtcbiAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkocGF5bG9hZCkpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBlbmQocGF5bG9hZCkge1xuICAgICAgcmVzLmVuZChwYXlsb2FkKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNlbmRXZWJSZXNwb25zZShyZXMsIHJlc3BvbnNlKSB7XG4gIHJlcy5zdGF0dXNDb2RlID0gcmVzcG9uc2Uuc3RhdHVzO1xuICByZXNwb25zZS5oZWFkZXJzLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcbiAgICByZXMuc2V0SGVhZGVyKGtleSwgdmFsdWUpO1xuICB9KTtcbiAgcmVzLmVuZChCdWZmZXIuZnJvbShhd2FpdCByZXNwb25zZS5hcnJheUJ1ZmZlcigpKSk7XG59XG5cbmZ1bmN0aW9uIHNlbmRKc29uKHJlcywgc3RhdHVzLCBwYXlsb2FkKSB7XG4gIHJlcy5zdGF0dXNDb2RlID0gc3RhdHVzO1xuICByZXMuc2V0SGVhZGVyKFwiY29udGVudC10eXBlXCIsIFwiYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD11dGYtOFwiKTtcbiAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShwYXlsb2FkKSk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpLCBwcm94eUFwaVBsdWdpbigpLCBkZWVwc2Vla0FwaVBsdWdpbigpLCBmZXRjaFVybE1ldGFBcGlQbHVnaW4oKSwgd2VibWFzdGVyQXBpUGx1Z2luKCksIGF1dG9jb21wbGV0ZUFwaVBsdWdpbigpLCBnc2NUb2tlbkFwaVBsdWdpbigpLCBwcm9qZWN0c0FwaVBsdWdpbigpLCBjcmF3bGVyQXBpUGx1Z2luKCldLFxuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiA1MTczLFxuICAgIGhvc3Q6IHRydWUsXG4gIH0sXG59KTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcYWxlZW1cXFxcT25lRHJpdmVcXFxcRG9jdW1lbnRzXFxcXEdpdEh1YlxcXFxzZW94XFxcXGZ1bmN0aW9uc1xcXFxfbGliXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhbGVlbVxcXFxPbmVEcml2ZVxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXHNlb3hcXFxcZnVuY3Rpb25zXFxcXF9saWJcXFxcaHR0cC5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvYWxlZW0vT25lRHJpdmUvRG9jdW1lbnRzL0dpdEh1Yi9zZW94L2Z1bmN0aW9ucy9fbGliL2h0dHAuanNcIjtleHBvcnQgZnVuY3Rpb24gY29yc0hlYWRlcnMobWV0aG9kcyA9IFwiR0VULCBQT1NULCBPUFRJT05TXCIpIHtcbiAgcmV0dXJuIHtcbiAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpblwiOiBcIipcIixcbiAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHNcIjogbWV0aG9kcyxcbiAgICBcIkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnNcIjogXCJDb250ZW50LVR5cGUsIEF1dGhvcml6YXRpb25cIixcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGpzb25SZXNwb25zZShwYXlsb2FkLCBzdGF0dXMgPSAyMDAsIGhlYWRlcnMgPSB7fSkge1xuICByZXR1cm4gbmV3IFJlc3BvbnNlKEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLCB7XG4gICAgc3RhdHVzLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD11dGYtOFwiLFxuICAgICAgLi4uaGVhZGVycyxcbiAgICB9LFxuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVtcHR5UmVzcG9uc2Uoc3RhdHVzID0gMjA0LCBoZWFkZXJzID0ge30pIHtcbiAgcmV0dXJuIG5ldyBSZXNwb25zZShudWxsLCB7IHN0YXR1cywgaGVhZGVycyB9KTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlYWRKc29uKHJlcXVlc3QpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gYXdhaXQgcmVxdWVzdC5qc29uKCk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiB7fTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZXJyb3JSZXNwb25zZShlcnJvciwgaGVhZGVycyA9IHt9KSB7XG4gIGlmICgoZXJyb3I/LnN0YXR1cyB8fCA1MDApID49IDUwMCkgY29uc29sZS5lcnJvcihlcnJvcik7XG4gIHJldHVybiBqc29uUmVzcG9uc2UoXG4gICAgeyBlcnJvcjogZXJyb3I/Lm1lc3NhZ2UgfHwgXCJJbnRlcm5hbCBzZXJ2ZXIgZXJyb3JcIiB9LFxuICAgIGVycm9yPy5zdGF0dXMgfHwgNTAwLFxuICAgIGhlYWRlcnNcbiAgKTtcbn1cbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcYWxlZW1cXFxcT25lRHJpdmVcXFxcRG9jdW1lbnRzXFxcXEdpdEh1YlxcXFxzZW94XFxcXGZ1bmN0aW9uc1xcXFxhcGlcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGFsZWVtXFxcXE9uZURyaXZlXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxcc2VveFxcXFxmdW5jdGlvbnNcXFxcYXBpXFxcXGF1dG9jb21wbGV0ZS5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvYWxlZW0vT25lRHJpdmUvRG9jdW1lbnRzL0dpdEh1Yi9zZW94L2Z1bmN0aW9ucy9hcGkvYXV0b2NvbXBsZXRlLmpzXCI7aW1wb3J0IHtcbiAgY29yc0hlYWRlcnMsXG4gIGVtcHR5UmVzcG9uc2UsXG4gIGVycm9yUmVzcG9uc2UsXG4gIGpzb25SZXNwb25zZSxcbn0gZnJvbSBcIi4uL19saWIvaHR0cC5qc1wiO1xuXG5mdW5jdGlvbiBwYXJzZUdvb2dsZVN1Z2dlc3Rpb25zKHZhbHVlKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UodmFsdWUpO1xuICAgIGlmICghQXJyYXkuaXNBcnJheShkYXRhKSB8fCAhQXJyYXkuaXNBcnJheShkYXRhWzFdKSkgcmV0dXJuIFtdO1xuXG4gICAgcmV0dXJuIGRhdGFbMV1cbiAgICAgIC5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBpdGVtID09PSBcInN0cmluZ1wiKSByZXR1cm4gaXRlbTtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaXRlbSkgJiYgdHlwZW9mIGl0ZW1bMF0gPT09IFwic3RyaW5nXCIpIHJldHVybiBpdGVtWzBdO1xuICAgICAgICByZXR1cm4gXCJcIjtcbiAgICAgIH0pXG4gICAgICAuZmlsdGVyKEJvb2xlYW4pO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gW107XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9uUmVxdWVzdCh7IHJlcXVlc3QgfSkge1xuICBjb25zdCBoZWFkZXJzID0ge1xuICAgIC4uLmNvcnNIZWFkZXJzKFwiR0VULCBPUFRJT05TXCIpLFxuICAgIFwiQ2FjaGUtQ29udHJvbFwiOiBcIm5vLXN0b3JlXCIsXG4gIH07XG5cbiAgaWYgKHJlcXVlc3QubWV0aG9kID09PSBcIk9QVElPTlNcIikgcmV0dXJuIGVtcHR5UmVzcG9uc2UoMjA0LCBoZWFkZXJzKTtcbiAgaWYgKHJlcXVlc3QubWV0aG9kICE9PSBcIkdFVFwiKSB7XG4gICAgcmV0dXJuIGpzb25SZXNwb25zZSh7IGVycm9yOiBcIk1ldGhvZCBub3QgYWxsb3dlZFwiIH0sIDQwNSwgaGVhZGVycyk7XG4gIH1cblxuICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcXVlc3QudXJsKTtcbiAgY29uc3QgcXVlcnkgPSB1cmwuc2VhcmNoUGFyYW1zLmdldChcInFcIik/LnRyaW0oKTtcbiAgY29uc3QgaGwgPSB1cmwuc2VhcmNoUGFyYW1zLmdldChcImhsXCIpIHx8IFwiZW5cIjtcbiAgY29uc3QgZ2wgPSB1cmwuc2VhcmNoUGFyYW1zLmdldChcImdsXCIpIHx8IFwiVVNcIjtcblxuICBpZiAoIXF1ZXJ5KSB7XG4gICAgcmV0dXJuIGpzb25SZXNwb25zZSh7IGVycm9yOiAnUXVlcnkgcGFyYW1ldGVyIFwicVwiIGlzIHJlcXVpcmVkJyB9LCA0MDAsIGhlYWRlcnMpO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcbiAgICAgIHE6IHF1ZXJ5LFxuICAgICAgaGwsXG4gICAgICBnbCxcbiAgICAgIGNsaWVudDogXCJjaHJvbWVcIixcbiAgICAgIHhocjogXCJ0XCIsXG4gICAgfSk7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGBodHRwczovL3d3dy5nb29nbGUuY29tL2NvbXBsZXRlL3NlYXJjaD8ke3BhcmFtc31gLCB7XG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIFwiQWNjZXB0XCI6IFwiYXBwbGljYXRpb24vanNvbiwgdGV4dC9qYXZhc2NyaXB0LCAqLyo7IHE9MC4wMVwiLFxuICAgICAgICBcIkFjY2VwdC1MYW5ndWFnZVwiOiBgJHtobH0sZW47cT0wLjhgLFxuICAgICAgICBcIlVzZXItQWdlbnRcIjpcbiAgICAgICAgICBcIk1vemlsbGEvNS4wIChXaW5kb3dzIE5UIDEwLjA7IFdpbjY0OyB4NjQpIEFwcGxlV2ViS2l0LzUzNy4zNiAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8xMjAuMC4wLjAgU2FmYXJpLzUzNy4zNlwiLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoXG4gICAgICAgIHsgZXJyb3I6IGBHb29nbGUgYXV0b2NvbXBsZXRlIHJldHVybmVkIEhUVFAgJHtyZXNwb25zZS5zdGF0dXN9YCB9LFxuICAgICAgICA1MDIsXG4gICAgICAgIGhlYWRlcnNcbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3QgdGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcbiAgICByZXR1cm4ganNvblJlc3BvbnNlKFxuICAgICAge1xuICAgICAgICBxdWVyeSxcbiAgICAgICAgaGwsXG4gICAgICAgIGdsLFxuICAgICAgICBzdWdnZXN0aW9uczogcGFyc2VHb29nbGVTdWdnZXN0aW9ucyh0ZXh0KSxcbiAgICAgIH0sXG4gICAgICAyMDAsXG4gICAgICBoZWFkZXJzXG4gICAgKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZXJyb3JSZXNwb25zZShlcnJvciwgaGVhZGVycyk7XG4gIH1cbn1cbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcYWxlZW1cXFxcT25lRHJpdmVcXFxcRG9jdW1lbnRzXFxcXEdpdEh1YlxcXFxzZW94XFxcXGZ1bmN0aW9uc1xcXFxfbGliXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhbGVlbVxcXFxPbmVEcml2ZVxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXHNlb3hcXFxcZnVuY3Rpb25zXFxcXF9saWJcXFxcZmlyZWJhc2UtcmVzdC5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvYWxlZW0vT25lRHJpdmUvRG9jdW1lbnRzL0dpdEh1Yi9zZW94L2Z1bmN0aW9ucy9fbGliL2ZpcmViYXNlLXJlc3QuanNcIjtpbXBvcnQge1xuICBkZWNvZGVQcm90ZWN0ZWRIZWFkZXIsXG4gIGltcG9ydFBLQ1M4LFxuICBpbXBvcnRYNTA5LFxuICBqd3RWZXJpZnksXG4gIFNpZ25KV1QsXG59IGZyb20gXCJqb3NlXCI7XG5cbmNvbnN0IEdPT0dMRV9UT0tFTl9VUkwgPSBcImh0dHBzOi8vb2F1dGgyLmdvb2dsZWFwaXMuY29tL3Rva2VuXCI7XG5jb25zdCBGSVJFQkFTRV9DRVJUU19VUkwgPVxuICBcImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL3JvYm90L3YxL21ldGFkYXRhL3g1MDkvc2VjdXJldG9rZW5Ac3lzdGVtLmdzZXJ2aWNlYWNjb3VudC5jb21cIjtcbmNvbnN0IEdPT0dMRV9TQ09QRVMgPSBbXG4gIFwiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vYXV0aC9kYXRhc3RvcmVcIixcbiAgXCJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9hdXRoL2lkZW50aXR5dG9vbGtpdFwiLFxuXTtcbmNvbnN0IERFRkFVTFRfRklSRUJBU0VfUFJPSkVDVF9JRCA9IFwic2VveC04OTY2MVwiO1xuXG5sZXQgYWNjZXNzVG9rZW5DYWNoZSA9IG51bGw7XG5sZXQgY2VydGlmaWNhdGVDYWNoZSA9IG51bGw7XG5cbmZ1bmN0aW9uIGNvbmZpZ3VyYXRpb25FcnJvcihtZXNzYWdlKSB7XG4gIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xuICBlcnJvci5zdGF0dXMgPSA1MDA7XG4gIHJldHVybiBlcnJvcjtcbn1cblxuZnVuY3Rpb24gcGFyc2VTZXJ2aWNlQWNjb3VudChlbnYpIHtcbiAgbGV0IGFjY291bnQgPSB7fTtcblxuICBpZiAoZW52LkZJUkVCQVNFX1NFUlZJQ0VfQUNDT1VOVF9LRVkpIHtcbiAgICB0cnkge1xuICAgICAgYWNjb3VudCA9IEpTT04ucGFyc2UoZW52LkZJUkVCQVNFX1NFUlZJQ0VfQUNDT1VOVF9LRVkpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdGhyb3cgY29uZmlndXJhdGlvbkVycm9yKFwiRklSRUJBU0VfU0VSVklDRV9BQ0NPVU5UX0tFWSBpcyBub3QgdmFsaWQgSlNPTlwiKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBwcm9qZWN0SWQgPVxuICAgIGFjY291bnQucHJvamVjdF9pZCB8fFxuICAgIGFjY291bnQucHJvamVjdElkIHx8XG4gICAgZW52LkZJUkVCQVNFX1BST0pFQ1RfSUQgfHxcbiAgICBlbnYuVklURV9GSVJFQkFTRV9QUk9KRUNUX0lEIHx8XG4gICAgZW52LkdDTE9VRF9QUk9KRUNUIHx8XG4gICAgZW52LkdPT0dMRV9DTE9VRF9QUk9KRUNUIHx8XG4gICAgREVGQVVMVF9GSVJFQkFTRV9QUk9KRUNUX0lEO1xuICBjb25zdCBjbGllbnRFbWFpbCA9XG4gICAgYWNjb3VudC5jbGllbnRfZW1haWwgfHwgYWNjb3VudC5jbGllbnRFbWFpbCB8fCBlbnYuRklSRUJBU0VfQ0xJRU5UX0VNQUlMO1xuICBjb25zdCBwcml2YXRlS2V5ID1cbiAgICBhY2NvdW50LnByaXZhdGVfa2V5IHx8IGFjY291bnQucHJpdmF0ZUtleSB8fCBlbnYuRklSRUJBU0VfUFJJVkFURV9LRVk7XG5cbiAgcmV0dXJuIHtcbiAgICBwcm9qZWN0SWQsXG4gICAgY2xpZW50RW1haWwsXG4gICAgcHJpdmF0ZUtleTogcHJpdmF0ZUtleT8ucmVwbGFjZSgvXFxcXG4vZywgXCJcXG5cIiksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRGaXJlYmFzZVByb2plY3RJZChlbnYpIHtcbiAgY29uc3QgeyBwcm9qZWN0SWQgfSA9IHBhcnNlU2VydmljZUFjY291bnQoZW52KTtcbiAgaWYgKCFwcm9qZWN0SWQpIHtcbiAgICB0aHJvdyBjb25maWd1cmF0aW9uRXJyb3IoXCJGaXJlYmFzZSBwcm9qZWN0IGlkIGlzIG5vdCBjb25maWd1cmVkXCIpO1xuICB9XG4gIHJldHVybiBwcm9qZWN0SWQ7XG59XG5cbmZ1bmN0aW9uIGdldFNlcnZpY2VBY2NvdW50KGVudikge1xuICBjb25zdCBhY2NvdW50ID0gcGFyc2VTZXJ2aWNlQWNjb3VudChlbnYpO1xuICBpZiAoIWFjY291bnQucHJvamVjdElkIHx8ICFhY2NvdW50LmNsaWVudEVtYWlsIHx8ICFhY2NvdW50LnByaXZhdGVLZXkpIHtcbiAgICB0aHJvdyBjb25maWd1cmF0aW9uRXJyb3IoXCJGaXJlYmFzZSBzZXJ2aWNlIGFjY291bnQgY3JlZGVudGlhbHMgYXJlIG5vdCBjb25maWd1cmVkXCIpO1xuICB9XG4gIHJldHVybiBhY2NvdW50O1xufVxuXG5mdW5jdGlvbiBnZXRCZWFyZXJUb2tlbihyZXF1ZXN0KSB7XG4gIGNvbnN0IGhlYWRlciA9IHJlcXVlc3QuaGVhZGVycy5nZXQoXCJhdXRob3JpemF0aW9uXCIpIHx8IFwiXCI7XG4gIHJldHVybiBoZWFkZXIuc3RhcnRzV2l0aChcIkJlYXJlciBcIikgPyBoZWFkZXIuc2xpY2UoNykgOiBcIlwiO1xufVxuXG5mdW5jdGlvbiBwYXJzZU1heEFnZSh2YWx1ZSkge1xuICBjb25zdCBtYXRjaCA9IFN0cmluZyh2YWx1ZSB8fCBcIlwiKS5tYXRjaCgvbWF4LWFnZT0oXFxkKykvaSk7XG4gIHJldHVybiBtYXRjaCA/IE51bWJlcihtYXRjaFsxXSkgOiAzNjAwO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRGaXJlYmFzZUNlcnRpZmljYXRlcygpIHtcbiAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgaWYgKGNlcnRpZmljYXRlQ2FjaGU/LmV4cGlyZXNBdCA+IG5vdykgcmV0dXJuIGNlcnRpZmljYXRlQ2FjaGUuY2VydGlmaWNhdGVzO1xuXG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goRklSRUJBU0VfQ0VSVFNfVVJMKTtcbiAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKFwiQ291bGQgbm90IGxvYWQgRmlyZWJhc2UgdG9rZW4gdmVyaWZpY2F0aW9uIGtleXNcIik7XG4gICAgZXJyb3Iuc3RhdHVzID0gNTAyO1xuICAgIHRocm93IGVycm9yO1xuICB9XG5cbiAgY29uc3QgY2VydGlmaWNhdGVzID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICBjZXJ0aWZpY2F0ZUNhY2hlID0ge1xuICAgIGNlcnRpZmljYXRlcyxcbiAgICBleHBpcmVzQXQ6IG5vdyArIHBhcnNlTWF4QWdlKHJlc3BvbnNlLmhlYWRlcnMuZ2V0KFwiY2FjaGUtY29udHJvbFwiKSkgKiAxMDAwLFxuICB9O1xuICByZXR1cm4gY2VydGlmaWNhdGVzO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdmVyaWZ5RmlyZWJhc2VJZFRva2VuKHJlcXVlc3QsIGVudikge1xuICBjb25zdCB0b2tlbiA9IGdldEJlYXJlclRva2VuKHJlcXVlc3QpO1xuICBpZiAoIXRva2VuKSB7XG4gICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoXCJNaXNzaW5nIEZpcmViYXNlIGF1dGggdG9rZW5cIik7XG4gICAgZXJyb3Iuc3RhdHVzID0gNDAxO1xuICAgIHRocm93IGVycm9yO1xuICB9XG5cbiAgY29uc3QgcHJvamVjdElkID0gZ2V0RmlyZWJhc2VQcm9qZWN0SWQoZW52KTtcbiAgbGV0IHByb3RlY3RlZEhlYWRlcjtcbiAgdHJ5IHtcbiAgICBwcm90ZWN0ZWRIZWFkZXIgPSBkZWNvZGVQcm90ZWN0ZWRIZWFkZXIodG9rZW4pO1xuICB9IGNhdGNoIHtcbiAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihcIkludmFsaWQgRmlyZWJhc2UgYXV0aCB0b2tlblwiKTtcbiAgICBlcnJvci5zdGF0dXMgPSA0MDE7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cblxuICBjb25zdCB7IGFsZywga2lkIH0gPSBwcm90ZWN0ZWRIZWFkZXI7XG4gIGlmIChhbGcgIT09IFwiUlMyNTZcIiB8fCAha2lkKSB7XG4gICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoXCJJbnZhbGlkIEZpcmViYXNlIGF1dGggdG9rZW5cIik7XG4gICAgZXJyb3Iuc3RhdHVzID0gNDAxO1xuICAgIHRocm93IGVycm9yO1xuICB9XG5cbiAgY29uc3QgY2VydGlmaWNhdGVzID0gYXdhaXQgZ2V0RmlyZWJhc2VDZXJ0aWZpY2F0ZXMoKTtcbiAgY29uc3QgY2VydGlmaWNhdGUgPSBjZXJ0aWZpY2F0ZXNba2lkXTtcbiAgaWYgKCFjZXJ0aWZpY2F0ZSkge1xuICAgIGNlcnRpZmljYXRlQ2FjaGUgPSBudWxsO1xuICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKFwiRmlyZWJhc2UgYXV0aCB0b2tlbiB1c2VzIGFuIHVua25vd24gc2lnbmluZyBrZXlcIik7XG4gICAgZXJyb3Iuc3RhdHVzID0gNDAxO1xuICAgIHRocm93IGVycm9yO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBrZXkgPSBhd2FpdCBpbXBvcnRYNTA5KGNlcnRpZmljYXRlLCBcIlJTMjU2XCIpO1xuICAgIGNvbnN0IHsgcGF5bG9hZCB9ID0gYXdhaXQgand0VmVyaWZ5KHRva2VuLCBrZXksIHtcbiAgICAgIGFsZ29yaXRobXM6IFtcIlJTMjU2XCJdLFxuICAgICAgYXVkaWVuY2U6IHByb2plY3RJZCxcbiAgICAgIGlzc3VlcjogYGh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS8ke3Byb2plY3RJZH1gLFxuICAgIH0pO1xuICAgIGNvbnN0IG5vdyA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApO1xuXG4gICAgaWYgKCFwYXlsb2FkLnN1YiB8fCBwYXlsb2FkLnN1Yi5sZW5ndGggPiAxMjggfHwgTnVtYmVyKHBheWxvYWQuYXV0aF90aW1lKSA+IG5vdykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBGaXJlYmFzZSBhdXRoIHRva2VuIGNsYWltc1wiKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgLi4ucGF5bG9hZCxcbiAgICAgIHVpZDogcGF5bG9hZC5zdWIsXG4gICAgfTtcbiAgfSBjYXRjaCAoY2F1c2UpIHtcbiAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihcIkludmFsaWQgb3IgZXhwaXJlZCBGaXJlYmFzZSBhdXRoIHRva2VuXCIpO1xuICAgIGVycm9yLnN0YXR1cyA9IDQwMTtcbiAgICBlcnJvci5jYXVzZSA9IGNhdXNlO1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbmZ1bmN0aW9uIHBhcnNlQ3N2KHZhbHVlKSB7XG4gIHJldHVybiBTdHJpbmcodmFsdWUgfHwgXCJcIilcbiAgICAuc3BsaXQoXCIsXCIpXG4gICAgLm1hcCgoaXRlbSkgPT4gaXRlbS50cmltKCkpXG4gICAgLmZpbHRlcihCb29sZWFuKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplVGllcih2YWx1ZSkge1xuICBjb25zdCB0aWVyID0gU3RyaW5nKHZhbHVlIHx8IFwiXCIpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICBpZiAodGllciA9PT0gXCJhZG1pblwiKSByZXR1cm4gXCJhZG1pblwiO1xuICByZXR1cm4gdGllcjtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFzc2VydEFkbWluKHJlcXVlc3QsIGVudikge1xuICBjb25zdCBkZWNvZGVkID0gYXdhaXQgdmVyaWZ5RmlyZWJhc2VJZFRva2VuKHJlcXVlc3QsIGVudik7XG4gIGNvbnN0IGFsbG93ZWRFbWFpbHMgPSBwYXJzZUNzdihlbnYuQURNSU5fRU1BSUxTKTtcblxuICBpZiAoXG4gICAgZGVjb2RlZC5hZG1pbiB8fFxuICAgIG5vcm1hbGl6ZVRpZXIoZGVjb2RlZC5sZXZlbCB8fCBkZWNvZGVkLnBsYW4pID09PSBcImFkbWluXCIgfHxcbiAgICBhbGxvd2VkRW1haWxzLmluY2x1ZGVzKGRlY29kZWQuZW1haWwpXG4gICkge1xuICAgIHJldHVybiBkZWNvZGVkO1xuICB9XG5cbiAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoXCJZb3UgZG8gbm90IGhhdmUgYWRtaW4gYWNjZXNzXCIpO1xuICBlcnJvci5zdGF0dXMgPSA0MDM7XG4gIHRocm93IGVycm9yO1xufVxuXG5hc3luYyBmdW5jdGlvbiBjcmVhdGVHb29nbGVBY2Nlc3NUb2tlbihlbnYpIHtcbiAgY29uc3QgYWNjb3VudCA9IGdldFNlcnZpY2VBY2NvdW50KGVudik7XG4gIGNvbnN0IG5vdyA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApO1xuICBjb25zdCBwcml2YXRlS2V5ID0gYXdhaXQgaW1wb3J0UEtDUzgoYWNjb3VudC5wcml2YXRlS2V5LCBcIlJTMjU2XCIpO1xuICBjb25zdCBhc3NlcnRpb24gPSBhd2FpdCBuZXcgU2lnbkpXVCh7XG4gICAgc2NvcGU6IEdPT0dMRV9TQ09QRVMuam9pbihcIiBcIiksXG4gIH0pXG4gICAgLnNldFByb3RlY3RlZEhlYWRlcih7IGFsZzogXCJSUzI1NlwiLCB0eXA6IFwiSldUXCIgfSlcbiAgICAuc2V0SXNzdWVyKGFjY291bnQuY2xpZW50RW1haWwpXG4gICAgLnNldEF1ZGllbmNlKEdPT0dMRV9UT0tFTl9VUkwpXG4gICAgLnNldElzc3VlZEF0KG5vdylcbiAgICAuc2V0RXhwaXJhdGlvblRpbWUobm93ICsgMzYwMClcbiAgICAuc2lnbihwcml2YXRlS2V5KTtcblxuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKEdPT0dMRV9UT0tFTl9VUkwsIHtcbiAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgIGhlYWRlcnM6IHsgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWRcIiB9LFxuICAgIGJvZHk6IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgICAgZ3JhbnRfdHlwZTogXCJ1cm46aWV0ZjpwYXJhbXM6b2F1dGg6Z3JhbnQtdHlwZTpqd3QtYmVhcmVyXCIsXG4gICAgICBhc3NlcnRpb24sXG4gICAgfSksXG4gIH0pO1xuICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuXG4gIGlmICghcmVzcG9uc2Uub2sgfHwgIWRhdGEuYWNjZXNzX3Rva2VuKSB7XG4gICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoXG4gICAgICBkYXRhLmVycm9yX2Rlc2NyaXB0aW9uIHx8IGRhdGEuZXJyb3IgfHwgXCJDb3VsZCBub3QgYXV0aGVudGljYXRlIEZpcmViYXNlIHNlcnZpY2UgYWNjb3VudFwiXG4gICAgKTtcbiAgICBlcnJvci5zdGF0dXMgPSA1MDI7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cblxuICBhY2Nlc3NUb2tlbkNhY2hlID0ge1xuICAgIHRva2VuOiBkYXRhLmFjY2Vzc190b2tlbixcbiAgICBleHBpcmVzQXQ6IERhdGUubm93KCkgKyAoTnVtYmVyKGRhdGEuZXhwaXJlc19pbiB8fCAzNjAwKSAtIDYwKSAqIDEwMDAsXG4gICAgY2xpZW50RW1haWw6IGFjY291bnQuY2xpZW50RW1haWwsXG4gIH07XG4gIHJldHVybiBhY2Nlc3NUb2tlbkNhY2hlLnRva2VuO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRHb29nbGVBY2Nlc3NUb2tlbihlbnYpIHtcbiAgY29uc3QgYWNjb3VudCA9IGdldFNlcnZpY2VBY2NvdW50KGVudik7XG4gIGlmIChcbiAgICBhY2Nlc3NUb2tlbkNhY2hlPy5leHBpcmVzQXQgPiBEYXRlLm5vdygpICYmXG4gICAgYWNjZXNzVG9rZW5DYWNoZS5jbGllbnRFbWFpbCA9PT0gYWNjb3VudC5jbGllbnRFbWFpbFxuICApIHtcbiAgICByZXR1cm4gYWNjZXNzVG9rZW5DYWNoZS50b2tlbjtcbiAgfVxuICByZXR1cm4gY3JlYXRlR29vZ2xlQWNjZXNzVG9rZW4oZW52KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ29vZ2xlUmVxdWVzdChlbnYsIHVybCwgb3B0aW9ucyA9IHt9LCByZXRyeSA9IHRydWUpIHtcbiAgY29uc3QgdG9rZW4gPSBhd2FpdCBnZXRHb29nbGVBY2Nlc3NUb2tlbihlbnYpO1xuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgIC4uLm9wdGlvbnMsXG4gICAgaGVhZGVyczoge1xuICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3Rva2VufWAsXG4gICAgICAuLi4ob3B0aW9ucy5ib2R5ID8geyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9IDoge30pLFxuICAgICAgLi4uKG9wdGlvbnMuaGVhZGVycyB8fCB7fSksXG4gICAgfSxcbiAgfSk7XG4gIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XG5cbiAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDAxICYmIHJldHJ5KSB7XG4gICAgYWNjZXNzVG9rZW5DYWNoZSA9IG51bGw7XG4gICAgcmV0dXJuIGdvb2dsZVJlcXVlc3QoZW52LCB1cmwsIG9wdGlvbnMsIGZhbHNlKTtcbiAgfVxuXG4gIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihcbiAgICAgIGRhdGEuZXJyb3I/Lm1lc3NhZ2UgfHwgZGF0YS5lcnJvcl9kZXNjcmlwdGlvbiB8fCBcIkZpcmViYXNlIEFQSSByZXF1ZXN0IGZhaWxlZFwiXG4gICAgKTtcbiAgICBlcnJvci5zdGF0dXMgPSByZXNwb25zZS5zdGF0dXM7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cblxuICByZXR1cm4gZGF0YTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxpc3RBdXRoVXNlcnMoZW52KSB7XG4gIGNvbnN0IHByb2plY3RJZCA9IGdldEZpcmViYXNlUHJvamVjdElkKGVudik7XG4gIGNvbnN0IHVzZXJzID0gW107XG4gIGxldCBuZXh0UGFnZVRva2VuID0gXCJcIjtcblxuICBkbyB7XG4gICAgY29uc3QgdXJsID0gbmV3IFVSTChcbiAgICAgIGBodHRwczovL2lkZW50aXR5dG9vbGtpdC5nb29nbGVhcGlzLmNvbS92MS9wcm9qZWN0cy8ke2VuY29kZVVSSUNvbXBvbmVudChcbiAgICAgICAgcHJvamVjdElkXG4gICAgICApfS9hY2NvdW50czpiYXRjaEdldGBcbiAgICApO1xuICAgIHVybC5zZWFyY2hQYXJhbXMuc2V0KFwibWF4UmVzdWx0c1wiLCBcIjEwMDBcIik7XG4gICAgaWYgKG5leHRQYWdlVG9rZW4pIHVybC5zZWFyY2hQYXJhbXMuc2V0KFwibmV4dFBhZ2VUb2tlblwiLCBuZXh0UGFnZVRva2VuKTtcblxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBnb29nbGVSZXF1ZXN0KGVudiwgdXJsLnRvU3RyaW5nKCkpO1xuICAgIHVzZXJzLnB1c2goLi4uKGRhdGEudXNlcnMgfHwgW10pKTtcbiAgICBuZXh0UGFnZVRva2VuID0gZGF0YS5uZXh0UGFnZVRva2VuIHx8IFwiXCI7XG4gIH0gd2hpbGUgKG5leHRQYWdlVG9rZW4pO1xuXG4gIHJldHVybiB1c2Vycztcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvb2t1cEF1dGhVc2VycyhlbnYsIGxvY2FsSWRzKSB7XG4gIGNvbnN0IHByb2plY3RJZCA9IGdldEZpcmViYXNlUHJvamVjdElkKGVudik7XG4gIGNvbnN0IHVzZXJzID0gW107XG5cbiAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGxvY2FsSWRzLmxlbmd0aDsgaW5kZXggKz0gMTAwKSB7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IGdvb2dsZVJlcXVlc3QoXG4gICAgICBlbnYsXG4gICAgICBgaHR0cHM6Ly9pZGVudGl0eXRvb2xraXQuZ29vZ2xlYXBpcy5jb20vdjEvcHJvamVjdHMvJHtlbmNvZGVVUklDb21wb25lbnQoXG4gICAgICAgIHByb2plY3RJZFxuICAgICAgKX0vYWNjb3VudHM6bG9va3VwYCxcbiAgICAgIHtcbiAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBsb2NhbElkOiBsb2NhbElkcy5zbGljZShpbmRleCwgaW5kZXggKyAxMDApIH0pLFxuICAgICAgfVxuICAgICk7XG4gICAgdXNlcnMucHVzaCguLi4oZGF0YS51c2VycyB8fCBbXSkpO1xuICB9XG5cbiAgcmV0dXJuIHVzZXJzO1xufVxuXG5mdW5jdGlvbiBmaXJlc3RvcmVCYXNlVXJsKGVudikge1xuICBjb25zdCBwcm9qZWN0SWQgPSBnZXRGaXJlYmFzZVByb2plY3RJZChlbnYpO1xuICByZXR1cm4gYGh0dHBzOi8vZmlyZXN0b3JlLmdvb2dsZWFwaXMuY29tL3YxL3Byb2plY3RzLyR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICAgIHByb2plY3RJZFxuICApfS9kYXRhYmFzZXMvKGRlZmF1bHQpL2RvY3VtZW50c2A7XG59XG5cbmZ1bmN0aW9uIGVuY29kZURvY3VtZW50UGF0aChwYXRoKSB7XG4gIHJldHVybiBTdHJpbmcocGF0aClcbiAgICAuc3BsaXQoXCIvXCIpXG4gICAgLm1hcCgocGFydCkgPT4gZW5jb2RlVVJJQ29tcG9uZW50KHBhcnQpKVxuICAgIC5qb2luKFwiL1wiKTtcbn1cblxuZnVuY3Rpb24gZGVjb2RlRmlyZXN0b3JlVmFsdWUodmFsdWUgPSB7fSkge1xuICBpZiAoXCJudWxsVmFsdWVcIiBpbiB2YWx1ZSkgcmV0dXJuIG51bGw7XG4gIGlmIChcInN0cmluZ1ZhbHVlXCIgaW4gdmFsdWUpIHJldHVybiB2YWx1ZS5zdHJpbmdWYWx1ZTtcbiAgaWYgKFwiYm9vbGVhblZhbHVlXCIgaW4gdmFsdWUpIHJldHVybiB2YWx1ZS5ib29sZWFuVmFsdWU7XG4gIGlmIChcImludGVnZXJWYWx1ZVwiIGluIHZhbHVlKSByZXR1cm4gTnVtYmVyKHZhbHVlLmludGVnZXJWYWx1ZSk7XG4gIGlmIChcImRvdWJsZVZhbHVlXCIgaW4gdmFsdWUpIHJldHVybiBOdW1iZXIodmFsdWUuZG91YmxlVmFsdWUpO1xuICBpZiAoXCJ0aW1lc3RhbXBWYWx1ZVwiIGluIHZhbHVlKSByZXR1cm4gdmFsdWUudGltZXN0YW1wVmFsdWU7XG4gIGlmIChcInJlZmVyZW5jZVZhbHVlXCIgaW4gdmFsdWUpIHJldHVybiB2YWx1ZS5yZWZlcmVuY2VWYWx1ZTtcbiAgaWYgKFwiYnl0ZXNWYWx1ZVwiIGluIHZhbHVlKSByZXR1cm4gdmFsdWUuYnl0ZXNWYWx1ZTtcbiAgaWYgKFwiZ2VvUG9pbnRWYWx1ZVwiIGluIHZhbHVlKSByZXR1cm4gdmFsdWUuZ2VvUG9pbnRWYWx1ZTtcbiAgaWYgKFwiYXJyYXlWYWx1ZVwiIGluIHZhbHVlKSB7XG4gICAgcmV0dXJuICh2YWx1ZS5hcnJheVZhbHVlLnZhbHVlcyB8fCBbXSkubWFwKGRlY29kZUZpcmVzdG9yZVZhbHVlKTtcbiAgfVxuICBpZiAoXCJtYXBWYWx1ZVwiIGluIHZhbHVlKSB7XG4gICAgcmV0dXJuIGRlY29kZUZpcmVzdG9yZUZpZWxkcyh2YWx1ZS5tYXBWYWx1ZS5maWVsZHMgfHwge30pO1xuICB9XG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGRlY29kZUZpcmVzdG9yZUZpZWxkcyhmaWVsZHMgPSB7fSkge1xuICByZXR1cm4gT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgIE9iamVjdC5lbnRyaWVzKGZpZWxkcykubWFwKChba2V5LCB2YWx1ZV0pID0+IFtrZXksIGRlY29kZUZpcmVzdG9yZVZhbHVlKHZhbHVlKV0pXG4gICk7XG59XG5cbmZ1bmN0aW9uIGRlY29kZUZpcmVzdG9yZURvY3VtZW50KGRvY3VtZW50KSB7XG4gIGNvbnN0IG5hbWVQYXJ0cyA9IFN0cmluZyhkb2N1bWVudC5uYW1lIHx8IFwiXCIpLnNwbGl0KFwiL1wiKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogbmFtZVBhcnRzW25hbWVQYXJ0cy5sZW5ndGggLSAxXSB8fCBcIlwiLFxuICAgIC4uLmRlY29kZUZpcmVzdG9yZUZpZWxkcyhkb2N1bWVudC5maWVsZHMgfHwge30pLFxuICB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbGlzdEZpcmVzdG9yZUNvbGxlY3Rpb24oZW52LCBjb2xsZWN0aW9uLCBwYWdlU2l6ZSA9IDUwMCkge1xuICBjb25zdCBkb2N1bWVudHMgPSBbXTtcbiAgbGV0IHBhZ2VUb2tlbiA9IFwiXCI7XG5cbiAgZG8ge1xuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoXG4gICAgICBgJHtmaXJlc3RvcmVCYXNlVXJsKGVudil9LyR7ZW5jb2RlRG9jdW1lbnRQYXRoKGNvbGxlY3Rpb24pfWBcbiAgICApO1xuICAgIHVybC5zZWFyY2hQYXJhbXMuc2V0KFwicGFnZVNpemVcIiwgU3RyaW5nKHBhZ2VTaXplKSk7XG4gICAgaWYgKHBhZ2VUb2tlbikgdXJsLnNlYXJjaFBhcmFtcy5zZXQoXCJwYWdlVG9rZW5cIiwgcGFnZVRva2VuKTtcblxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBnb29nbGVSZXF1ZXN0KGVudiwgdXJsLnRvU3RyaW5nKCkpO1xuICAgIGRvY3VtZW50cy5wdXNoKC4uLihkYXRhLmRvY3VtZW50cyB8fCBbXSkubWFwKGRlY29kZUZpcmVzdG9yZURvY3VtZW50KSk7XG4gICAgcGFnZVRva2VuID0gZGF0YS5uZXh0UGFnZVRva2VuIHx8IFwiXCI7XG4gIH0gd2hpbGUgKHBhZ2VUb2tlbik7XG5cbiAgcmV0dXJuIGRvY3VtZW50cztcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlYWRGaXJzdENvbGxlY3Rpb24oZW52LCBlbnZOYW1lLCBmYWxsYmFja3MsIGxpbWl0ID0gNTAwKSB7XG4gIGNvbnN0IGNvbmZpZ3VyZWQgPSBlbnZbZW52TmFtZV07XG4gIGNvbnN0IG5hbWVzID0gW2NvbmZpZ3VyZWQsIC4uLmZhbGxiYWNrc10uZmlsdGVyKEJvb2xlYW4pO1xuXG4gIGZvciAoY29uc3QgbmFtZSBvZiBuYW1lcykge1xuICAgIGNvbnN0IGRvY3VtZW50cyA9IGF3YWl0IGxpc3RGaXJlc3RvcmVDb2xsZWN0aW9uKGVudiwgbmFtZSwgbGltaXQpO1xuICAgIGlmIChkb2N1bWVudHMubGVuZ3RoIHx8IGNvbmZpZ3VyZWQgPT09IG5hbWUpIHJldHVybiBkb2N1bWVudHMuc2xpY2UoMCwgbGltaXQpO1xuICB9XG5cbiAgcmV0dXJuIFtdO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0RmlyZXN0b3JlRG9jdW1lbnQoZW52LCBjb2xsZWN0aW9uLCBkb2N1bWVudElkKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IGdvb2dsZVJlcXVlc3QoXG4gICAgICBlbnYsXG4gICAgICBgJHtmaXJlc3RvcmVCYXNlVXJsKGVudil9LyR7ZW5jb2RlRG9jdW1lbnRQYXRoKFxuICAgICAgICBgJHtjb2xsZWN0aW9ufS8ke2RvY3VtZW50SWR9YFxuICAgICAgKX1gXG4gICAgKTtcbiAgICByZXR1cm4gZGVjb2RlRmlyZXN0b3JlRG9jdW1lbnQoZGF0YSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGVycm9yLnN0YXR1cyA9PT0gNDA0KSByZXR1cm4gbnVsbDtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZGVsZXRlRmlyZXN0b3JlRG9jdW1lbnQoZW52LCBjb2xsZWN0aW9uLCBkb2N1bWVudElkKSB7XG4gIHRyeSB7XG4gICAgYXdhaXQgZ29vZ2xlUmVxdWVzdChcbiAgICAgIGVudixcbiAgICAgIGAke2ZpcmVzdG9yZUJhc2VVcmwoZW52KX0vJHtlbmNvZGVEb2N1bWVudFBhdGgoXG4gICAgICAgIGAke2NvbGxlY3Rpb259LyR7ZG9jdW1lbnRJZH1gXG4gICAgICApfWAsXG4gICAgICB7IG1ldGhvZDogXCJERUxFVEVcIiB9XG4gICAgKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoZXJyb3Iuc3RhdHVzID09PSA0MDQpIHJldHVybiBmYWxzZTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZmlyZXN0b3JlVGltZXN0YW1wKHZhbHVlID0gbmV3IERhdGUoKSkge1xuICByZXR1cm4ge1xuICAgIF9fZmlyZXN0b3JlVHlwZTogXCJ0aW1lc3RhbXBcIixcbiAgICB2YWx1ZTogdmFsdWUgaW5zdGFuY2VvZiBEYXRlID8gdmFsdWUudG9JU09TdHJpbmcoKSA6IFN0cmluZyh2YWx1ZSksXG4gIH07XG59XG5cbmZ1bmN0aW9uIGVuY29kZUZpcmVzdG9yZVZhbHVlKHZhbHVlKSB7XG4gIGlmICh2YWx1ZT8uX19maXJlc3RvcmVUeXBlID09PSBcInRpbWVzdGFtcFwiKSB7XG4gICAgcmV0dXJuIHsgdGltZXN0YW1wVmFsdWU6IHZhbHVlLnZhbHVlIH07XG4gIH1cbiAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHJldHVybiB7IG51bGxWYWx1ZTogbnVsbCB9O1xuICBpZiAodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiKSByZXR1cm4geyBzdHJpbmdWYWx1ZTogdmFsdWUgfTtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJib29sZWFuXCIpIHJldHVybiB7IGJvb2xlYW5WYWx1ZTogdmFsdWUgfTtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJudW1iZXJcIikge1xuICAgIHJldHVybiBOdW1iZXIuaXNJbnRlZ2VyKHZhbHVlKVxuICAgICAgPyB7IGludGVnZXJWYWx1ZTogU3RyaW5nKHZhbHVlKSB9XG4gICAgICA6IHsgZG91YmxlVmFsdWU6IHZhbHVlIH07XG4gIH1cbiAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgcmV0dXJuIHsgYXJyYXlWYWx1ZTogeyB2YWx1ZXM6IHZhbHVlLm1hcChlbmNvZGVGaXJlc3RvcmVWYWx1ZSkgfSB9O1xuICB9XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIpIHtcbiAgICByZXR1cm4geyBtYXBWYWx1ZTogeyBmaWVsZHM6IGVuY29kZUZpcmVzdG9yZUZpZWxkcyh2YWx1ZSkgfSB9O1xuICB9XG4gIHJldHVybiB7IHN0cmluZ1ZhbHVlOiBTdHJpbmcodmFsdWUpIH07XG59XG5cbmZ1bmN0aW9uIGVuY29kZUZpcmVzdG9yZUZpZWxkcyhmaWVsZHMpIHtcbiAgcmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyhcbiAgICBPYmplY3QuZW50cmllcyhmaWVsZHMpLm1hcCgoW2tleSwgdmFsdWVdKSA9PiBba2V5LCBlbmNvZGVGaXJlc3RvcmVWYWx1ZSh2YWx1ZSldKVxuICApO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcGF0Y2hGaXJlc3RvcmVEb2N1bWVudChcbiAgZW52LFxuICBjb2xsZWN0aW9uLFxuICBkb2N1bWVudElkLFxuICBmaWVsZHNcbikge1xuICBjb25zdCB1cmwgPSBuZXcgVVJMKFxuICAgIGAke2ZpcmVzdG9yZUJhc2VVcmwoZW52KX0vJHtlbmNvZGVEb2N1bWVudFBhdGgoYCR7Y29sbGVjdGlvbn0vJHtkb2N1bWVudElkfWApfWBcbiAgKTtcbiAgZm9yIChjb25zdCBmaWVsZCBvZiBPYmplY3Qua2V5cyhmaWVsZHMpKSB7XG4gICAgdXJsLnNlYXJjaFBhcmFtcy5hcHBlbmQoXCJ1cGRhdGVNYXNrLmZpZWxkUGF0aHNcIiwgZmllbGQpO1xuICB9XG5cbiAgY29uc3QgZGF0YSA9IGF3YWl0IGdvb2dsZVJlcXVlc3QoZW52LCB1cmwudG9TdHJpbmcoKSwge1xuICAgIG1ldGhvZDogXCJQQVRDSFwiLFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgZmllbGRzOiBlbmNvZGVGaXJlc3RvcmVGaWVsZHMoZmllbGRzKSB9KSxcbiAgfSk7XG4gIHJldHVybiBkZWNvZGVGaXJlc3RvcmVEb2N1bWVudChkYXRhKTtcbn1cbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcYWxlZW1cXFxcT25lRHJpdmVcXFxcRG9jdW1lbnRzXFxcXEdpdEh1YlxcXFxzZW94XFxcXGZ1bmN0aW9uc1xcXFxhcGlcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGFsZWVtXFxcXE9uZURyaXZlXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxcc2VveFxcXFxmdW5jdGlvbnNcXFxcYXBpXFxcXGdzYy10b2tlbi5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvYWxlZW0vT25lRHJpdmUvRG9jdW1lbnRzL0dpdEh1Yi9zZW94L2Z1bmN0aW9ucy9hcGkvZ3NjLXRva2VuLmpzXCI7aW1wb3J0IHtcbiAgZGVsZXRlRmlyZXN0b3JlRG9jdW1lbnQsXG4gIGdldEZpcmVzdG9yZURvY3VtZW50LFxuICBwYXRjaEZpcmVzdG9yZURvY3VtZW50LFxuICB2ZXJpZnlGaXJlYmFzZUlkVG9rZW4sXG59IGZyb20gXCIuLi9fbGliL2ZpcmViYXNlLXJlc3QuanNcIjtcbmltcG9ydCB7XG4gIGNvcnNIZWFkZXJzLFxuICBlbXB0eVJlc3BvbnNlLFxuICBlcnJvclJlc3BvbnNlLFxuICBqc29uUmVzcG9uc2UsXG4gIHJlYWRKc29uLFxufSBmcm9tIFwiLi4vX2xpYi9odHRwLmpzXCI7XG5cbmNvbnN0IFRPS0VOX0VORFBPSU5UID0gXCJodHRwczovL29hdXRoMi5nb29nbGVhcGlzLmNvbS90b2tlblwiO1xuY29uc3QgVVNFUklORk9fRU5EUE9JTlQgPSBcImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL29hdXRoMi92Mi91c2VyaW5mb1wiO1xuY29uc3QgR09PR0xFX0FVVEhfRU5EUE9JTlQgPSBcImh0dHBzOi8vYWNjb3VudHMuZ29vZ2xlLmNvbS9vL29hdXRoMi92Mi9hdXRoXCI7XG5jb25zdCBHU0NfU0NPUEUgPSBcImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL2F1dGgvd2VibWFzdGVycy5yZWFkb25seVwiO1xuXG5mdW5jdGlvbiBnc2NUb2tlbkNvbGxlY3Rpb24odXNlcklkKSB7XG4gIHJldHVybiBgdXNlcnMvJHt1c2VySWR9L2dzY0Nvbm5lY3Rpb25gO1xufVxuXG5mdW5jdGlvbiBjbGVhbkZpZWxkcyhmaWVsZHMpIHtcbiAgcmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyhcbiAgICBPYmplY3QuZW50cmllcyhmaWVsZHMpLmZpbHRlcigoWywgdmFsdWVdKSA9PiB2YWx1ZSAhPT0gdW5kZWZpbmVkKVxuICApO1xufVxuXG5mdW5jdGlvbiBnZXRPQXV0aENvbmZpZyhlbnYpIHtcbiAgcmV0dXJuIHtcbiAgICBjbGllbnRJZDogZW52LkdPT0dMRV9DTElFTlRfSUQgfHwgZW52LlZJVEVfR09PR0xFX0NMSUVOVF9JRCxcbiAgICBjbGllbnRTZWNyZXQ6IGVudi5HT09HTEVfQ0xJRU5UX1NFQ1JFVCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZW5jb2RlU3RhdGUocGF5bG9hZCkge1xuICBjb25zdCBqc29uID0gSlNPTi5zdHJpbmdpZnkocGF5bG9hZCB8fCB7fSk7XG4gIGlmICh0eXBlb2YgYnRvYSA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4gYnRvYShqc29uKTtcbiAgcmV0dXJuIEJ1ZmZlci5mcm9tKGpzb24sIFwidXRmOFwiKS50b1N0cmluZyhcImJhc2U2NFwiKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlU2VydmVyR3NjQXV0aFVybCh7IGNsaWVudElkLCByZWRpcmVjdFVyaSwgcmV0dXJuVG8sIHNvdXJjZSB9KSB7XG4gIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgIGNsaWVudF9pZDogY2xpZW50SWQsXG4gICAgcmVkaXJlY3RfdXJpOiByZWRpcmVjdFVyaSxcbiAgICByZXNwb25zZV90eXBlOiBcImNvZGVcIixcbiAgICBzY29wZTogYCR7R1NDX1NDT1BFfSBodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9hdXRoL3VzZXJpbmZvLmVtYWlsYCxcbiAgICBhY2Nlc3NfdHlwZTogXCJvZmZsaW5lXCIsXG4gICAgcHJvbXB0OiBcImNvbnNlbnRcIixcbiAgICBzdGF0ZTogZW5jb2RlU3RhdGUoeyBzb3VyY2U6IHNvdXJjZSB8fCBcImdzYy1pbnNpZ2h0c1wiLCByZXR1cm5UbzogcmV0dXJuVG8gfHwgXCIvZ3NjXCIgfSksXG4gIH0pO1xuXG4gIHJldHVybiBgJHtHT09HTEVfQVVUSF9FTkRQT0lOVH0/JHtwYXJhbXMudG9TdHJpbmcoKX1gO1xufVxuXG5hc3luYyBmdW5jdGlvbiBmZXRjaEdvb2dsZUVtYWlsKGFjY2Vzc1Rva2VuKSB7XG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goVVNFUklORk9fRU5EUE9JTlQsIHtcbiAgICBoZWFkZXJzOiB7IEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHthY2Nlc3NUb2tlbn1gIH0sXG4gIH0pO1xuXG4gIGlmICghcmVzcG9uc2Uub2spIHJldHVybiBudWxsO1xuICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuICByZXR1cm4gZGF0YS5lbWFpbCB8fCBudWxsO1xufVxuXG5hc3luYyBmdW5jdGlvbiByZWZyZXNoU3RvcmVkVG9rZW5zKGVudiwgdXNlcklkLCBzdG9yZWRUb2tlbnMpIHtcbiAgaWYgKCFzdG9yZWRUb2tlbnM/LnJlZnJlc2hUb2tlbikge1xuICAgIHJldHVybiBqc29uUmVzcG9uc2UoXG4gICAgICB7IGVycm9yOiBcIk5vIHJlZnJlc2ggdG9rZW4gYXZhaWxhYmxlLiBQbGVhc2UgcmVjb25uZWN0IFNlYXJjaCBDb25zb2xlLlwiIH0sXG4gICAgICA0MDAsXG4gICAgICBjb3JzSGVhZGVycyhcIlBPU1QsIE9QVElPTlNcIilcbiAgICApO1xuICB9XG5cbiAgY29uc3QgeyBjbGllbnRJZCwgY2xpZW50U2VjcmV0IH0gPSBnZXRPQXV0aENvbmZpZyhlbnYpO1xuICBjb25zdCByZWZyZXNoUmVzcG9uc2UgPSBhd2FpdCBmZXRjaChUT0tFTl9FTkRQT0lOVCwge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiIH0sXG4gICAgYm9keTogbmV3IFVSTFNlYXJjaFBhcmFtcyh7XG4gICAgICByZWZyZXNoX3Rva2VuOiBzdG9yZWRUb2tlbnMucmVmcmVzaFRva2VuLFxuICAgICAgY2xpZW50X2lkOiBjbGllbnRJZCxcbiAgICAgIGNsaWVudF9zZWNyZXQ6IGNsaWVudFNlY3JldCxcbiAgICAgIGdyYW50X3R5cGU6IFwicmVmcmVzaF90b2tlblwiLFxuICAgIH0pLFxuICB9KTtcblxuICBjb25zdCBkYXRhID0gYXdhaXQgcmVmcmVzaFJlc3BvbnNlLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcblxuICBpZiAoIXJlZnJlc2hSZXNwb25zZS5vayB8fCAhZGF0YS5hY2Nlc3NfdG9rZW4pIHtcbiAgICBhd2FpdCBkZWxldGVGaXJlc3RvcmVEb2N1bWVudChlbnYsIGdzY1Rva2VuQ29sbGVjdGlvbih1c2VySWQpLCBcInRva2Vuc1wiKTtcbiAgICByZXR1cm4ganNvblJlc3BvbnNlKFxuICAgICAge1xuICAgICAgICBlcnJvcjogXCJUb2tlbiByZWZyZXNoIGZhaWxlZC4gUGxlYXNlIHJlY29ubmVjdCBTZWFyY2ggQ29uc29sZS5cIixcbiAgICAgICAgZGV0YWlsczogZGF0YSxcbiAgICAgIH0sXG4gICAgICA0MDAsXG4gICAgICBjb3JzSGVhZGVycyhcIlBPU1QsIE9QVElPTlNcIilcbiAgICApO1xuICB9XG5cbiAgY29uc3QgZXhwaXJlc0F0ID0gRGF0ZS5ub3coKSArIE51bWJlcihkYXRhLmV4cGlyZXNfaW4gfHwgMzYwMCkgKiAxMDAwO1xuICBjb25zdCBnb29nbGVFbWFpbCA9IHN0b3JlZFRva2Vucy5nb29nbGVFbWFpbCB8fCAoYXdhaXQgZmV0Y2hHb29nbGVFbWFpbChkYXRhLmFjY2Vzc190b2tlbikpO1xuXG4gIGF3YWl0IHBhdGNoRmlyZXN0b3JlRG9jdW1lbnQoZW52LCBnc2NUb2tlbkNvbGxlY3Rpb24odXNlcklkKSwgXCJ0b2tlbnNcIiwge1xuICAgIC4uLnN0b3JlZFRva2VucyxcbiAgICBhY2Nlc3NUb2tlbjogZGF0YS5hY2Nlc3NfdG9rZW4sXG4gICAgZXhwaXJlc0F0LFxuICAgIGdvb2dsZUVtYWlsLFxuICAgIHVwZGF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICB9KTtcblxuICByZXR1cm4ganNvblJlc3BvbnNlKFxuICAgIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBjb25uZWN0ZWQ6IHRydWUsXG4gICAgICBhY2Nlc3NUb2tlbjogZGF0YS5hY2Nlc3NfdG9rZW4sXG4gICAgICBleHBpcmVzQXQsXG4gICAgICBnb29nbGVFbWFpbCxcbiAgICB9LFxuICAgIDIwMCxcbiAgICBjb3JzSGVhZGVycyhcIlBPU1QsIE9QVElPTlNcIilcbiAgKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9uUmVxdWVzdCh7IHJlcXVlc3QsIGVudiB9KSB7XG4gIGNvbnN0IGhlYWRlcnMgPSB7XG4gICAgLi4uY29yc0hlYWRlcnMoXCJQT1NULCBPUFRJT05TXCIpLFxuICAgIFwiQ2FjaGUtQ29udHJvbFwiOiBcIm5vLXN0b3JlXCIsXG4gIH07XG5cbiAgaWYgKHJlcXVlc3QubWV0aG9kID09PSBcIk9QVElPTlNcIikgcmV0dXJuIGVtcHR5UmVzcG9uc2UoMjA0LCBoZWFkZXJzKTtcbiAgaWYgKHJlcXVlc3QubWV0aG9kICE9PSBcIlBPU1RcIikge1xuICAgIHJldHVybiBqc29uUmVzcG9uc2UoeyBlcnJvcjogXCJNZXRob2Qgbm90IGFsbG93ZWRcIiB9LCA0MDUsIGhlYWRlcnMpO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBkZWNvZGVkID0gYXdhaXQgdmVyaWZ5RmlyZWJhc2VJZFRva2VuKHJlcXVlc3QsIGVudik7XG4gICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRKc29uKHJlcXVlc3QpO1xuICAgIGNvbnN0IHsgYWN0aW9uLCBjb2RlLCB1c2VySWQsIHJlZGlyZWN0VXJpLCByZXR1cm5Ubywgc291cmNlIH0gPSBib2R5O1xuICAgIGNvbnN0IHNjb3BlZFVzZXJJZCA9IGRlY29kZWQudWlkO1xuICAgIGNvbnN0IHsgY2xpZW50SWQsIGNsaWVudFNlY3JldCB9ID0gZ2V0T0F1dGhDb25maWcoZW52KTtcblxuICAgIGlmICghY2xpZW50SWQgfHwgKGFjdGlvbiAhPT0gXCJhdXRoLXVybFwiICYmICFjbGllbnRTZWNyZXQpKSB7XG4gICAgICByZXR1cm4ganNvblJlc3BvbnNlKFxuICAgICAgICB7IGVycm9yOiBcIkdvb2dsZSBPQXV0aCBjcmVkZW50aWFscyBhcmUgbm90IGNvbmZpZ3VyZWRcIiB9LFxuICAgICAgICA1MDAsXG4gICAgICAgIGhlYWRlcnNcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKGFjdGlvbiA9PT0gXCJhdXRoLXVybFwiKSB7XG4gICAgICBpZiAoIXJlZGlyZWN0VXJpKSB7XG4gICAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoeyBlcnJvcjogXCJNaXNzaW5nIHJlZGlyZWN0IFVSSVwiIH0sIDQwMCwgaGVhZGVycyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoXG4gICAgICAgIHtcbiAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgIGF1dGhVcmw6IGNyZWF0ZVNlcnZlckdzY0F1dGhVcmwoe1xuICAgICAgICAgICAgY2xpZW50SWQsXG4gICAgICAgICAgICByZWRpcmVjdFVyaSxcbiAgICAgICAgICAgIHJldHVyblRvLFxuICAgICAgICAgICAgc291cmNlLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgICAyMDAsXG4gICAgICAgIGhlYWRlcnNcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKGFjdGlvbiA9PT0gXCJleGNoYW5nZVwiKSB7XG4gICAgICBpZiAoIWNvZGUgfHwgIXJlZGlyZWN0VXJpKSB7XG4gICAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoeyBlcnJvcjogXCJNaXNzaW5nIHJlcXVpcmVkIHBhcmFtZXRlcnNcIiB9LCA0MDAsIGhlYWRlcnMpO1xuICAgICAgfVxuICAgICAgaWYgKHVzZXJJZCAmJiB1c2VySWQgIT09IHNjb3BlZFVzZXJJZCkge1xuICAgICAgICByZXR1cm4ganNvblJlc3BvbnNlKHsgZXJyb3I6IFwiQ2Fubm90IGNvbm5lY3QgU2VhcmNoIENvbnNvbGUgZm9yIGFub3RoZXIgdXNlclwiIH0sIDQwMywgaGVhZGVycyk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHRva2VuUmVzcG9uc2UgPSBhd2FpdCBmZXRjaChUT0tFTl9FTkRQT0lOVCwge1xuICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkXCIgfSxcbiAgICAgICAgYm9keTogbmV3IFVSTFNlYXJjaFBhcmFtcyh7XG4gICAgICAgICAgY29kZSxcbiAgICAgICAgICBjbGllbnRfaWQ6IGNsaWVudElkLFxuICAgICAgICAgIGNsaWVudF9zZWNyZXQ6IGNsaWVudFNlY3JldCxcbiAgICAgICAgICByZWRpcmVjdF91cmk6IHJlZGlyZWN0VXJpLFxuICAgICAgICAgIGdyYW50X3R5cGU6IFwiYXV0aG9yaXphdGlvbl9jb2RlXCIsXG4gICAgICAgIH0pLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHRva2VucyA9IGF3YWl0IHRva2VuUmVzcG9uc2UuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuICAgICAgaWYgKCF0b2tlblJlc3BvbnNlLm9rIHx8ICF0b2tlbnMuYWNjZXNzX3Rva2VuKSB7XG4gICAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoXG4gICAgICAgICAgeyBlcnJvcjogXCJUb2tlbiBleGNoYW5nZSBmYWlsZWRcIiwgZGV0YWlsczogdG9rZW5zIH0sXG4gICAgICAgICAgNDAwLFxuICAgICAgICAgIGhlYWRlcnNcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcHJldmlvdXMgPSBhd2FpdCBnZXRGaXJlc3RvcmVEb2N1bWVudChcbiAgICAgICAgZW52LFxuICAgICAgICBnc2NUb2tlbkNvbGxlY3Rpb24oc2NvcGVkVXNlcklkKSxcbiAgICAgICAgXCJ0b2tlbnNcIlxuICAgICAgKTtcbiAgICAgIGNvbnN0IGV4cGlyZXNBdCA9IERhdGUubm93KCkgKyBOdW1iZXIodG9rZW5zLmV4cGlyZXNfaW4gfHwgMzYwMCkgKiAxMDAwO1xuICAgICAgY29uc3QgZ29vZ2xlRW1haWwgPSBhd2FpdCBmZXRjaEdvb2dsZUVtYWlsKHRva2Vucy5hY2Nlc3NfdG9rZW4pO1xuXG4gICAgICBhd2FpdCBwYXRjaEZpcmVzdG9yZURvY3VtZW50KFxuICAgICAgICBlbnYsXG4gICAgICAgIGdzY1Rva2VuQ29sbGVjdGlvbihzY29wZWRVc2VySWQpLFxuICAgICAgICBcInRva2Vuc1wiLFxuICAgICAgICBjbGVhbkZpZWxkcyh7XG4gICAgICAgICAgYWNjZXNzVG9rZW46IHRva2Vucy5hY2Nlc3NfdG9rZW4sXG4gICAgICAgICAgcmVmcmVzaFRva2VuOiB0b2tlbnMucmVmcmVzaF90b2tlbiB8fCBwcmV2aW91cz8ucmVmcmVzaFRva2VuIHx8IG51bGwsXG4gICAgICAgICAgZXhwaXJlc0F0LFxuICAgICAgICAgIGdvb2dsZUVtYWlsOiBnb29nbGVFbWFpbCB8fCBwcmV2aW91cz8uZ29vZ2xlRW1haWwgfHwgbnVsbCxcbiAgICAgICAgICB1cGRhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoXG4gICAgICAgIHtcbiAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgIGNvbm5lY3RlZDogdHJ1ZSxcbiAgICAgICAgICBhY2Nlc3NUb2tlbjogdG9rZW5zLmFjY2Vzc190b2tlbixcbiAgICAgICAgICBleHBpcmVzQXQsXG4gICAgICAgICAgZ29vZ2xlRW1haWw6IGdvb2dsZUVtYWlsIHx8IHByZXZpb3VzPy5nb29nbGVFbWFpbCB8fCBudWxsLFxuICAgICAgICB9LFxuICAgICAgICAyMDAsXG4gICAgICAgIGhlYWRlcnNcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKGFjdGlvbiA9PT0gXCJnZXRcIikge1xuICAgICAgaWYgKHVzZXJJZCAmJiB1c2VySWQgIT09IHNjb3BlZFVzZXJJZCkge1xuICAgICAgICByZXR1cm4ganNvblJlc3BvbnNlKHsgZXJyb3I6IFwiQ2Fubm90IHJlYWQgU2VhcmNoIENvbnNvbGUgdG9rZW5zIGZvciBhbm90aGVyIHVzZXJcIiB9LCA0MDMsIGhlYWRlcnMpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBzdG9yZWRUb2tlbnMgPSBhd2FpdCBnZXRGaXJlc3RvcmVEb2N1bWVudChcbiAgICAgICAgZW52LFxuICAgICAgICBnc2NUb2tlbkNvbGxlY3Rpb24oc2NvcGVkVXNlcklkKSxcbiAgICAgICAgXCJ0b2tlbnNcIlxuICAgICAgKTtcblxuICAgICAgaWYgKCFzdG9yZWRUb2tlbnM/LmFjY2Vzc1Rva2VuKSB7XG4gICAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoeyBjb25uZWN0ZWQ6IGZhbHNlIH0sIDIwMCwgaGVhZGVycyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChOdW1iZXIoc3RvcmVkVG9rZW5zLmV4cGlyZXNBdCB8fCAwKSA8PSBEYXRlLm5vdygpICsgMTIwMDAwKSB7XG4gICAgICAgIHJldHVybiByZWZyZXNoU3RvcmVkVG9rZW5zKGVudiwgc2NvcGVkVXNlcklkLCBzdG9yZWRUb2tlbnMpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ganNvblJlc3BvbnNlKFxuICAgICAgICB7XG4gICAgICAgICAgY29ubmVjdGVkOiB0cnVlLFxuICAgICAgICAgIGFjY2Vzc1Rva2VuOiBzdG9yZWRUb2tlbnMuYWNjZXNzVG9rZW4sXG4gICAgICAgICAgZXhwaXJlc0F0OiBzdG9yZWRUb2tlbnMuZXhwaXJlc0F0LFxuICAgICAgICAgIGdvb2dsZUVtYWlsOiBzdG9yZWRUb2tlbnMuZ29vZ2xlRW1haWwgfHwgbnVsbCxcbiAgICAgICAgfSxcbiAgICAgICAgMjAwLFxuICAgICAgICBoZWFkZXJzXG4gICAgICApO1xuICAgIH1cblxuICAgIGlmIChhY3Rpb24gPT09IFwicmVmcmVzaFwiKSB7XG4gICAgICBpZiAodXNlcklkICYmIHVzZXJJZCAhPT0gc2NvcGVkVXNlcklkKSB7XG4gICAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoeyBlcnJvcjogXCJDYW5ub3QgcmVmcmVzaCBTZWFyY2ggQ29uc29sZSB0b2tlbnMgZm9yIGFub3RoZXIgdXNlclwiIH0sIDQwMywgaGVhZGVycyk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHN0b3JlZFRva2VucyA9IGF3YWl0IGdldEZpcmVzdG9yZURvY3VtZW50KFxuICAgICAgICBlbnYsXG4gICAgICAgIGdzY1Rva2VuQ29sbGVjdGlvbihzY29wZWRVc2VySWQpLFxuICAgICAgICBcInRva2Vuc1wiXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlZnJlc2hTdG9yZWRUb2tlbnMoZW52LCBzY29wZWRVc2VySWQsIHN0b3JlZFRva2Vucyk7XG4gICAgfVxuXG4gICAgaWYgKGFjdGlvbiA9PT0gXCJkaXNjb25uZWN0XCIpIHtcbiAgICAgIGlmICh1c2VySWQgJiYgdXNlcklkICE9PSBzY29wZWRVc2VySWQpIHtcbiAgICAgICAgcmV0dXJuIGpzb25SZXNwb25zZSh7IGVycm9yOiBcIkNhbm5vdCBkaXNjb25uZWN0IFNlYXJjaCBDb25zb2xlIGZvciBhbm90aGVyIHVzZXJcIiB9LCA0MDMsIGhlYWRlcnMpO1xuICAgICAgfVxuICAgICAgYXdhaXQgZGVsZXRlRmlyZXN0b3JlRG9jdW1lbnQoZW52LCBnc2NUb2tlbkNvbGxlY3Rpb24oc2NvcGVkVXNlcklkKSwgXCJ0b2tlbnNcIik7XG4gICAgICByZXR1cm4ganNvblJlc3BvbnNlKHsgc3VjY2VzczogdHJ1ZSB9LCAyMDAsIGhlYWRlcnMpO1xuICAgIH1cblxuICAgIHJldHVybiBqc29uUmVzcG9uc2UoeyBlcnJvcjogXCJJbnZhbGlkIGFjdGlvblwiIH0sIDQwMCwgaGVhZGVycyk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIGVycm9yUmVzcG9uc2UoZXJyb3IsIGhlYWRlcnMpO1xuICB9XG59XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGFsZWVtXFxcXE9uZURyaXZlXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxcc2VveFxcXFxmdW5jdGlvbnNcXFxcYXBpXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhbGVlbVxcXFxPbmVEcml2ZVxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXHNlb3hcXFxcZnVuY3Rpb25zXFxcXGFwaVxcXFxwcm9qZWN0cy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvYWxlZW0vT25lRHJpdmUvRG9jdW1lbnRzL0dpdEh1Yi9zZW94L2Z1bmN0aW9ucy9hcGkvcHJvamVjdHMuanNcIjtpbXBvcnQge1xuICBkZWxldGVGaXJlc3RvcmVEb2N1bWVudCxcbiAgZ2V0RmlyZXN0b3JlRG9jdW1lbnQsXG4gIGxpc3RGaXJlc3RvcmVDb2xsZWN0aW9uLFxuICBwYXRjaEZpcmVzdG9yZURvY3VtZW50LFxuICB2ZXJpZnlGaXJlYmFzZUlkVG9rZW4sXG59IGZyb20gXCIuLi9fbGliL2ZpcmViYXNlLXJlc3QuanNcIjtcbmltcG9ydCB7XG4gIGNvcnNIZWFkZXJzLFxuICBlbXB0eVJlc3BvbnNlLFxuICBlcnJvclJlc3BvbnNlLFxuICBqc29uUmVzcG9uc2UsXG4gIHJlYWRKc29uLFxufSBmcm9tIFwiLi4vX2xpYi9odHRwLmpzXCI7XG5cbmZ1bmN0aW9uIHVzZXJQcm9qZWN0c0NvbGxlY3Rpb24odXNlcklkKSB7XG4gIHJldHVybiBgdXNlcnMvJHt1c2VySWR9L3Byb2plY3RzYDtcbn1cblxuZnVuY3Rpb24gdXNlck1ldGFDb2xsZWN0aW9uKHVzZXJJZCkge1xuICByZXR1cm4gYHVzZXJzLyR7dXNlcklkfS9tZXRhYDtcbn1cblxuZnVuY3Rpb24gY2xlYW5GaWVsZHMoZmllbGRzKSB7XG4gIHJldHVybiBPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgT2JqZWN0LmVudHJpZXMoZmllbGRzIHx8IHt9KS5maWx0ZXIoKFssIHZhbHVlXSkgPT4gdmFsdWUgIT09IHVuZGVmaW5lZClcbiAgKTtcbn1cblxuZnVuY3Rpb24gc2FuaXRpemVQcm9qZWN0KHByb2plY3QsIGRlY29kZWQpIHtcbiAgaWYgKCFwcm9qZWN0Py5pZCkge1xuICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKFwiUHJvamVjdCBpZCBpcyByZXF1aXJlZFwiKTtcbiAgICBlcnJvci5zdGF0dXMgPSA0MDA7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cblxuICBjb25zdCB7XG4gICAgc3RhdHM6IF9zdGF0cyxcbiAgICBsYXRlc3RVcmxzOiBfbGF0ZXN0VXJscyxcbiAgICBhdWRpdElzc3VlczogX2F1ZGl0SXNzdWVzLFxuICAgIC4uLnNhZmVcbiAgfSA9IHByb2plY3Q7XG5cbiAgcmV0dXJuIGNsZWFuRmllbGRzKHtcbiAgICAuLi5zYWZlLFxuICAgIG93bmVyVWlkOiBkZWNvZGVkLnVpZCxcbiAgICBvd25lckVtYWlsOiBkZWNvZGVkLmVtYWlsIHx8IHNhZmUub3duZXIgfHwgXCJcIixcbiAgICB1cGRhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZURlbGV0ZWRQcm9qZWN0SWRzKHZhbHVlKSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KHZhbHVlKSA/IHZhbHVlLmZpbHRlcihCb29sZWFuKS5tYXAoU3RyaW5nKSA6IFtdO1xufVxuXG5hc3luYyBmdW5jdGlvbiBsb2FkUHJvamVjdHMoZW52LCB1c2VySWQpIHtcbiAgY29uc3QgW3Byb2plY3RzLCBtZXRhXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBsaXN0RmlyZXN0b3JlQ29sbGVjdGlvbihlbnYsIHVzZXJQcm9qZWN0c0NvbGxlY3Rpb24odXNlcklkKSksXG4gICAgZ2V0RmlyZXN0b3JlRG9jdW1lbnQoZW52LCB1c2VyTWV0YUNvbGxlY3Rpb24odXNlcklkKSwgXCJjcmF3bFwiKSxcbiAgXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBwcm9qZWN0cyxcbiAgICBzZWxlY3RlZFByb2plY3RJZDogbWV0YT8uc2VsZWN0ZWRQcm9qZWN0SWQgfHwgbnVsbCxcbiAgICBkZWxldGVkUHJvamVjdElkczogbm9ybWFsaXplRGVsZXRlZFByb2plY3RJZHMobWV0YT8uZGVsZXRlZFByb2plY3RJZHMpLFxuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBzYXZlTWV0YShlbnYsIHVzZXJJZCwgeyBzZWxlY3RlZFByb2plY3RJZCwgZGVsZXRlZFByb2plY3RJZHMgfSkge1xuICByZXR1cm4gcGF0Y2hGaXJlc3RvcmVEb2N1bWVudChlbnYsIHVzZXJNZXRhQ29sbGVjdGlvbih1c2VySWQpLCBcImNyYXdsXCIsIHtcbiAgICBzZWxlY3RlZFByb2plY3RJZDogc2VsZWN0ZWRQcm9qZWN0SWQgfHwgbnVsbCxcbiAgICBkZWxldGVkUHJvamVjdElkczogbm9ybWFsaXplRGVsZXRlZFByb2plY3RJZHMoZGVsZXRlZFByb2plY3RJZHMpLFxuICAgIHVwZGF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICB9KTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9uUmVxdWVzdCh7IHJlcXVlc3QsIGVudiB9KSB7XG4gIGNvbnN0IGhlYWRlcnMgPSB7XG4gICAgLi4uY29yc0hlYWRlcnMoXCJHRVQsIFBPU1QsIERFTEVURSwgT1BUSU9OU1wiKSxcbiAgICBcIkNhY2hlLUNvbnRyb2xcIjogXCJuby1zdG9yZVwiLFxuICB9O1xuXG4gIGlmIChyZXF1ZXN0Lm1ldGhvZCA9PT0gXCJPUFRJT05TXCIpIHJldHVybiBlbXB0eVJlc3BvbnNlKDIwNCwgaGVhZGVycyk7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBkZWNvZGVkID0gYXdhaXQgdmVyaWZ5RmlyZWJhc2VJZFRva2VuKHJlcXVlc3QsIGVudik7XG4gICAgY29uc3QgdXNlcklkID0gZGVjb2RlZC51aWQ7XG5cbiAgICBpZiAocmVxdWVzdC5tZXRob2QgPT09IFwiR0VUXCIpIHtcbiAgICAgIHJldHVybiBqc29uUmVzcG9uc2UoYXdhaXQgbG9hZFByb2plY3RzKGVudiwgdXNlcklkKSwgMjAwLCBoZWFkZXJzKTtcbiAgICB9XG5cbiAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZEpzb24ocmVxdWVzdCk7XG4gICAgY29uc3QgYWN0aW9uID0gYm9keT8uYWN0aW9uIHx8IFwiXCI7XG5cbiAgICBpZiAocmVxdWVzdC5tZXRob2QgPT09IFwiUE9TVFwiKSB7XG4gICAgICBpZiAoYWN0aW9uID09PSBcInNhdmVQcm9qZWN0V2l0aE1ldGFcIikge1xuICAgICAgICBjb25zdCBwcm9qZWN0ID0gc2FuaXRpemVQcm9qZWN0KGJvZHkucHJvamVjdCwgZGVjb2RlZCk7XG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgICBwYXRjaEZpcmVzdG9yZURvY3VtZW50KGVudiwgdXNlclByb2plY3RzQ29sbGVjdGlvbih1c2VySWQpLCBwcm9qZWN0LmlkLCBwcm9qZWN0KSxcbiAgICAgICAgICBzYXZlTWV0YShlbnYsIHVzZXJJZCwge1xuICAgICAgICAgICAgc2VsZWN0ZWRQcm9qZWN0SWQ6IGJvZHkuc2VsZWN0ZWRQcm9qZWN0SWQgfHwgcHJvamVjdC5pZCxcbiAgICAgICAgICAgIGRlbGV0ZWRQcm9qZWN0SWRzOiBib2R5LmRlbGV0ZWRQcm9qZWN0SWRzLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdKTtcbiAgICAgICAgcmV0dXJuIGpzb25SZXNwb25zZSh7IHN1Y2Nlc3M6IHRydWUsIHByb2plY3QgfSwgMjAwLCBoZWFkZXJzKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGFjdGlvbiA9PT0gXCJzYXZlTWV0YVwiKSB7XG4gICAgICAgIGF3YWl0IHNhdmVNZXRhKGVudiwgdXNlcklkLCB7XG4gICAgICAgICAgc2VsZWN0ZWRQcm9qZWN0SWQ6IGJvZHkuc2VsZWN0ZWRQcm9qZWN0SWQsXG4gICAgICAgICAgZGVsZXRlZFByb2plY3RJZHM6IGJvZHkuZGVsZXRlZFByb2plY3RJZHMsXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4ganNvblJlc3BvbnNlKHsgc3VjY2VzczogdHJ1ZSB9LCAyMDAsIGhlYWRlcnMpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ganNvblJlc3BvbnNlKHsgZXJyb3I6IFwiSW52YWxpZCBhY3Rpb25cIiB9LCA0MDAsIGhlYWRlcnMpO1xuICAgIH1cblxuICAgIGlmIChyZXF1ZXN0Lm1ldGhvZCA9PT0gXCJERUxFVEVcIikge1xuICAgICAgY29uc3QgcHJvamVjdElkID0gU3RyaW5nKGJvZHkucHJvamVjdElkIHx8IFwiXCIpLnRyaW0oKTtcbiAgICAgIGlmICghcHJvamVjdElkKSByZXR1cm4ganNvblJlc3BvbnNlKHsgZXJyb3I6IFwiUHJvamVjdCBpZCBpcyByZXF1aXJlZFwiIH0sIDQwMCwgaGVhZGVycyk7XG5cbiAgICAgIGNvbnN0IHdyaXRlcyA9IFtcbiAgICAgICAgZGVsZXRlRmlyZXN0b3JlRG9jdW1lbnQoZW52LCB1c2VyUHJvamVjdHNDb2xsZWN0aW9uKHVzZXJJZCksIHByb2plY3RJZCksXG4gICAgICBdO1xuICAgICAgaWYgKFxuICAgICAgICBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYm9keSwgXCJzZWxlY3RlZFByb2plY3RJZFwiKSB8fFxuICAgICAgICBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYm9keSwgXCJkZWxldGVkUHJvamVjdElkc1wiKVxuICAgICAgKSB7XG4gICAgICAgIHdyaXRlcy5wdXNoKHNhdmVNZXRhKGVudiwgdXNlcklkLCB7XG4gICAgICAgICAgc2VsZWN0ZWRQcm9qZWN0SWQ6IGJvZHkuc2VsZWN0ZWRQcm9qZWN0SWQsXG4gICAgICAgICAgZGVsZXRlZFByb2plY3RJZHM6IGJvZHkuZGVsZXRlZFByb2plY3RJZHMsXG4gICAgICAgIH0pKTtcbiAgICAgIH1cbiAgICAgIGF3YWl0IFByb21pc2UuYWxsKHdyaXRlcyk7XG4gICAgICByZXR1cm4ganNvblJlc3BvbnNlKHsgc3VjY2VzczogdHJ1ZSB9LCAyMDAsIGhlYWRlcnMpO1xuICAgIH1cblxuICAgIHJldHVybiBqc29uUmVzcG9uc2UoeyBlcnJvcjogXCJNZXRob2Qgbm90IGFsbG93ZWRcIiB9LCA0MDUsIGhlYWRlcnMpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBlcnJvclJlc3BvbnNlKGVycm9yLCBoZWFkZXJzKTtcbiAgfVxufVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhbGVlbVxcXFxPbmVEcml2ZVxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXHNlb3hcXFxcZnVuY3Rpb25zXFxcXF9saWJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGFsZWVtXFxcXE9uZURyaXZlXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxcc2VveFxcXFxmdW5jdGlvbnNcXFxcX2xpYlxcXFxyZXF1ZXN0LWF1dGguanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2FsZWVtL09uZURyaXZlL0RvY3VtZW50cy9HaXRIdWIvc2VveC9mdW5jdGlvbnMvX2xpYi9yZXF1ZXN0LWF1dGguanNcIjtpbXBvcnQgeyB2ZXJpZnlGaXJlYmFzZUlkVG9rZW4gfSBmcm9tIFwiLi9maXJlYmFzZS1yZXN0LmpzXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBhdXRoSGVhZGVyc0Zyb21Ob2RlUmVxdWVzdChyZXEpIHtcbiAgY29uc3QgaGVhZGVycyA9IG5ldyBIZWFkZXJzKCk7XG4gIGNvbnN0IGF1dGhvcml6YXRpb24gPSByZXE/LmhlYWRlcnM/LmF1dGhvcml6YXRpb24gfHwgcmVxPy5oZWFkZXJzPy5BdXRob3JpemF0aW9uO1xuICBpZiAoYXV0aG9yaXphdGlvbikgaGVhZGVycy5zZXQoXCJhdXRob3JpemF0aW9uXCIsIGF1dGhvcml6YXRpb24pO1xuICByZXR1cm4gaGVhZGVycztcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlcXVpcmVGaXJlYmFzZUF1dGhGcm9tTm9kZVJlcXVlc3QocmVxLCBlbnYgPSBwcm9jZXNzLmVudikge1xuICByZXR1cm4gdmVyaWZ5RmlyZWJhc2VJZFRva2VuKFxuICAgIG5ldyBSZXF1ZXN0KFwiaHR0cHM6Ly9zZW94LmxvY2FsL2F1dGhcIiwge1xuICAgICAgaGVhZGVyczogYXV0aEhlYWRlcnNGcm9tTm9kZVJlcXVlc3QocmVxKSxcbiAgICB9KSxcbiAgICBlbnZcbiAgKTtcbn1cbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcYWxlZW1cXFxcT25lRHJpdmVcXFxcRG9jdW1lbnRzXFxcXEdpdEh1YlxcXFxzZW94XFxcXGZ1bmN0aW9uc1xcXFxfbGliXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhbGVlbVxcXFxPbmVEcml2ZVxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXHNlb3hcXFxcZnVuY3Rpb25zXFxcXF9saWJcXFxcdXJsLXNlY3VyaXR5LmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9hbGVlbS9PbmVEcml2ZS9Eb2N1bWVudHMvR2l0SHViL3Nlb3gvZnVuY3Rpb25zL19saWIvdXJsLXNlY3VyaXR5LmpzXCI7Y29uc3QgREVGQVVMVF9NQVhfUkVESVJFQ1RTID0gNTtcblxuY29uc3QgQkxPQ0tFRF9IT1NUUyA9IG5ldyBTZXQoW1xuICBcImxvY2FsaG9zdFwiLFxuICBcImxvY2FsaG9zdC5sb2NhbGRvbWFpblwiLFxuICBcIm1ldGFkYXRhLmdvb2dsZS5pbnRlcm5hbFwiLFxuXSk7XG5cbmZ1bmN0aW9uIG1ha2VIdHRwRXJyb3IobWVzc2FnZSwgc3RhdHVzID0gNDAwKSB7XG4gIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xuICBlcnJvci5zdGF0dXMgPSBzdGF0dXM7XG4gIHJldHVybiBlcnJvcjtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplSG9zdG5hbWUoaG9zdG5hbWUgPSBcIlwiKSB7XG4gIHJldHVybiBTdHJpbmcoaG9zdG5hbWUpLnRyaW0oKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL15cXFt8XFxdJC9nLCBcIlwiKS5yZXBsYWNlKC9cXC4kLywgXCJcIik7XG59XG5cbmZ1bmN0aW9uIHBhcnNlSXB2NChob3N0bmFtZSkge1xuICBjb25zdCBtYXRjaCA9IGhvc3RuYW1lLm1hdGNoKC9eKFxcZHsxLDN9KVxcLihcXGR7MSwzfSlcXC4oXFxkezEsM30pXFwuKFxcZHsxLDN9KSQvKTtcbiAgaWYgKCFtYXRjaCkgcmV0dXJuIG51bGw7XG5cbiAgY29uc3QgcGFydHMgPSBtYXRjaC5zbGljZSgxKS5tYXAoTnVtYmVyKTtcbiAgaWYgKHBhcnRzLnNvbWUoKHBhcnQpID0+IHBhcnQgPCAwIHx8IHBhcnQgPiAyNTUpKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIHBhcnRzO1xufVxuXG5mdW5jdGlvbiBpc1ByaXZhdGVJcHY0KHBhcnRzKSB7XG4gIGNvbnN0IFthLCBiXSA9IHBhcnRzO1xuICByZXR1cm4gKFxuICAgIGEgPT09IDAgfHxcbiAgICBhID09PSAxMCB8fFxuICAgIGEgPT09IDEyNyB8fFxuICAgIChhID09PSAxMDAgJiYgYiA+PSA2NCAmJiBiIDw9IDEyNykgfHxcbiAgICAoYSA9PT0gMTY5ICYmIGIgPT09IDI1NCkgfHxcbiAgICAoYSA9PT0gMTcyICYmIGIgPj0gMTYgJiYgYiA8PSAzMSkgfHxcbiAgICAoYSA9PT0gMTkyICYmIGIgPT09IDE2OCkgfHxcbiAgICAoYSA9PT0gMTkyICYmIGIgPT09IDApIHx8XG4gICAgKGEgPT09IDE5OCAmJiAoYiA9PT0gMTggfHwgYiA9PT0gMTkpKSB8fFxuICAgIGEgPj0gMjI0XG4gICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0Jsb2NrZWRGZXRjaEhvc3RuYW1lKGhvc3RuYW1lKSB7XG4gIGNvbnN0IGhvc3QgPSBub3JtYWxpemVIb3N0bmFtZShob3N0bmFtZSk7XG4gIGlmICghaG9zdCkgcmV0dXJuIHRydWU7XG4gIGlmIChCTE9DS0VEX0hPU1RTLmhhcyhob3N0KSB8fCBob3N0LmVuZHNXaXRoKFwiLmxvY2FsaG9zdFwiKSB8fCBob3N0LmVuZHNXaXRoKFwiLmxvY2FsXCIpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBjb25zdCBpcHY0ID0gcGFyc2VJcHY0KGhvc3QpO1xuICBpZiAoaXB2NCkgcmV0dXJuIGlzUHJpdmF0ZUlwdjQoaXB2NCk7XG5cbiAgaWYgKGhvc3QuaW5jbHVkZXMoXCI6XCIpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVB1YmxpY0h0dHBVcmwodmFsdWUsIGxhYmVsID0gXCJVUkxcIikge1xuICBsZXQgdXJsO1xuICB0cnkge1xuICAgIHVybCA9IG5ldyBVUkwoU3RyaW5nKHZhbHVlIHx8IFwiXCIpLnRyaW0oKSk7XG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG1ha2VIdHRwRXJyb3IoYEludmFsaWQgJHtsYWJlbH0gZm9ybWF0YCk7XG4gIH1cblxuICBpZiAoIVtcImh0dHA6XCIsIFwiaHR0cHM6XCJdLmluY2x1ZGVzKHVybC5wcm90b2NvbCkpIHtcbiAgICB0aHJvdyBtYWtlSHR0cEVycm9yKFwiT25seSBIVFRQIGFuZCBIVFRQUyBVUkxzIGFyZSBhbGxvd2VkXCIpO1xuICB9XG5cbiAgaWYgKHVybC51c2VybmFtZSB8fCB1cmwucGFzc3dvcmQpIHtcbiAgICB0aHJvdyBtYWtlSHR0cEVycm9yKFwiVVJMcyB3aXRoIGVtYmVkZGVkIGNyZWRlbnRpYWxzIGFyZSBub3QgYWxsb3dlZFwiKTtcbiAgfVxuXG4gIGlmIChpc0Jsb2NrZWRGZXRjaEhvc3RuYW1lKHVybC5ob3N0bmFtZSkpIHtcbiAgICB0aHJvdyBtYWtlSHR0cEVycm9yKFwiUHJpdmF0ZSwgbG9jYWwsIGFuZCBtZXRhZGF0YSBuZXR3b3JrIFVSTHMgYXJlIG5vdCBhbGxvd2VkXCIpO1xuICB9XG5cbiAgdXJsLmhhc2ggPSBcIlwiO1xuICByZXR1cm4gdXJsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZVB1YmxpY1JlZGlyZWN0KGxvY2F0aW9uLCBjdXJyZW50VXJsKSB7XG4gIGlmICghbG9jYXRpb24pIHJldHVybiBudWxsO1xuICByZXR1cm4gcGFyc2VQdWJsaWNIdHRwVXJsKG5ldyBVUkwobG9jYXRpb24sIGN1cnJlbnRVcmwpLnRvU3RyaW5nKCksIFwicmVkaXJlY3QgVVJMXCIpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmV0Y2hQdWJsaWNIdHRwVXJsKHZhbHVlLCBpbml0ID0ge30pIHtcbiAgY29uc3QgeyBtYXhSZWRpcmVjdHMgPSBERUZBVUxUX01BWF9SRURJUkVDVFMsIC4uLmZldGNoSW5pdCB9ID0gaW5pdDtcbiAgbGV0IGN1cnJlbnRVcmwgPSBwYXJzZVB1YmxpY0h0dHBVcmwodmFsdWUpO1xuXG4gIGZvciAobGV0IHJlZGlyZWN0Q291bnQgPSAwOyByZWRpcmVjdENvdW50IDw9IG1heFJlZGlyZWN0czsgcmVkaXJlY3RDb3VudCArPSAxKSB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChjdXJyZW50VXJsLnRvU3RyaW5nKCksIHtcbiAgICAgIC4uLmZldGNoSW5pdCxcbiAgICAgIHJlZGlyZWN0OiBcIm1hbnVhbFwiLFxuICAgIH0pO1xuXG4gICAgaWYgKCFbMzAxLCAzMDIsIDMwMywgMzA3LCAzMDhdLmluY2x1ZGVzKHJlc3BvbnNlLnN0YXR1cykpIHtcbiAgICAgIHJldHVybiByZXNwb25zZTtcbiAgICB9XG5cbiAgICBjb25zdCBsb2NhdGlvbiA9IHJlc3BvbnNlLmhlYWRlcnMuZ2V0KFwibG9jYXRpb25cIik7XG4gICAgaWYgKCFsb2NhdGlvbikgcmV0dXJuIHJlc3BvbnNlO1xuICAgIGlmIChyZWRpcmVjdENvdW50ID49IG1heFJlZGlyZWN0cykgcmV0dXJuIHJlc3BvbnNlO1xuICAgIGN1cnJlbnRVcmwgPSByZXNvbHZlUHVibGljUmVkaXJlY3QobG9jYXRpb24sIGN1cnJlbnRVcmwpO1xuICB9XG5cbiAgdGhyb3cgbWFrZUh0dHBFcnJvcihcIlRvbyBtYW55IHJlZGlyZWN0c1wiLCA1MDgpO1xufVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhbGVlbVxcXFxPbmVEcml2ZVxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXHNlb3hcXFxcZnVuY3Rpb25zXFxcXF9oYW5kbGVyc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcYWxlZW1cXFxcT25lRHJpdmVcXFxcRG9jdW1lbnRzXFxcXEdpdEh1YlxcXFxzZW94XFxcXGZ1bmN0aW9uc1xcXFxfaGFuZGxlcnNcXFxcZmV0Y2gtdXJsLW1ldGEuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2FsZWVtL09uZURyaXZlL0RvY3VtZW50cy9HaXRIdWIvc2VveC9mdW5jdGlvbnMvX2hhbmRsZXJzL2ZldGNoLXVybC1tZXRhLmpzXCI7aW1wb3J0IHsgcmVxdWlyZUZpcmViYXNlQXV0aEZyb21Ob2RlUmVxdWVzdCB9IGZyb20gXCIuLi9fbGliL3JlcXVlc3QtYXV0aC5qc1wiO1xuaW1wb3J0IHsgZmV0Y2hQdWJsaWNIdHRwVXJsLCBwYXJzZVB1YmxpY0h0dHBVcmwgfSBmcm9tIFwiLi4vX2xpYi91cmwtc2VjdXJpdHkuanNcIjtcblxuY29uc3QgTUFYX0hUTUxfQllURVMgPSA1XzAwMF8wMDA7XG5cbi8vIFNoYXJlZCBOb2RlLXN0eWxlIGhhbmRsZXIgdXNlZCBieSB0aGUgQ2xvdWRmbGFyZSBQYWdlcyBGdW5jdGlvbiB3cmFwcGVyLlxuZXhwb3J0IGRlZmF1bHQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlcihyZXEsIHJlcykge1xuICByZXMuc2V0SGVhZGVyKFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCIsIFwiKlwiKTtcbiAgcmVzLnNldEhlYWRlcihcIkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHNcIiwgXCJHRVQsIFBPU1QsIE9QVElPTlNcIik7XG4gIHJlcy5zZXRIZWFkZXIoXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzXCIsIFwiQ29udGVudC1UeXBlLCBBdXRob3JpemF0aW9uXCIpO1xuXG4gIGlmIChyZXEubWV0aG9kID09PSBcIk9QVElPTlNcIikgcmV0dXJuIHJlcy5zdGF0dXMoMjAwKS5lbmQoKTtcbiAgaWYgKCFbXCJHRVRcIiwgXCJQT1NUXCJdLmluY2x1ZGVzKHJlcS5tZXRob2QpKSB7XG4gICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA1KS5qc29uKHsgZXJyb3I6IFwiTWV0aG9kIG5vdCBhbGxvd2VkXCIgfSk7XG4gIH1cblxuICB0cnkge1xuICAgIGF3YWl0IHJlcXVpcmVGaXJlYmFzZUF1dGhGcm9tTm9kZVJlcXVlc3QocmVxKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gcmVzLnN0YXR1cyhlcnJvcj8uc3RhdHVzIHx8IDQwMSkuanNvbih7IGVycm9yOiBlcnJvcj8ubWVzc2FnZSB8fCBcIlVuYXV0aG9yaXplZFwiIH0pO1xuICB9XG5cbiAgY29uc3QgcGFyYW1zID0gcmVxLm1ldGhvZCA9PT0gXCJHRVRcIiA/IHJlcS5xdWVyeSB8fCB7fSA6IHJlcS5ib2R5IHx8IHt9O1xuICBjb25zdCB7IHVybCwgaW5jbHVkZU1ldGFEZXNjcmlwdGlvbiwgcmV0dXJuSHRtbCB9ID0gcGFyYW1zO1xuICBpZiAoIXVybCkgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6IFwiVVJMIGlzIHJlcXVpcmVkXCIgfSk7XG5cbiAgdHJ5IHtcbiAgICBwYXJzZVB1YmxpY0h0dHBVcmwodXJsKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gcmVzLnN0YXR1cyhlcnJvcj8uc3RhdHVzIHx8IDQwMCkuanNvbih7IGVycm9yOiBlcnJvcj8ubWVzc2FnZSB8fCBcIkludmFsaWQgVVJMIGZvcm1hdFwiIH0pO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgcmV0dXJuSHRtbCA/IDE1MDAwIDogMTAwMDApO1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2hQdWJsaWNIdHRwVXJsKHVybCwge1xuICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgXCJVc2VyLUFnZW50XCI6XG4gICAgICAgICAgXCJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOyBXaW42NDsgeDY0KSBBcHBsZVdlYktpdC81MzcuMzYgQ2hyb21lLzEyMCBTYWZhcmkvNTM3LjM2XCIsXG4gICAgICAgIEFjY2VwdDogXCJ0ZXh0L2h0bWwsYXBwbGljYXRpb24veGh0bWwreG1sLGFwcGxpY2F0aW9uL3htbDtxPTAuOSwqLyo7cT0wLjhcIixcbiAgICAgICAgXCJBY2NlcHQtTGFuZ3VhZ2VcIjogXCJlbi1VUyxlbjtxPTAuOFwiLFxuICAgICAgfSxcbiAgICB9KS5maW5hbGx5KCgpID0+IGNsZWFyVGltZW91dCh0aW1lb3V0KSk7XG5cbiAgICBjb25zdCBzdGF0dXNDb2RlID0gcmVzcG9uc2Uuc3RhdHVzO1xuICAgIGNvbnN0IGNvbnRlbnRMZW5ndGggPSBOdW1iZXIocmVzcG9uc2UuaGVhZGVycy5nZXQoXCJjb250ZW50LWxlbmd0aFwiKSB8fCAwKTtcbiAgICBpZiAoY29udGVudExlbmd0aCA+IE1BWF9IVE1MX0JZVEVTKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MTMpLmpzb24oeyBlcnJvcjogXCJGZXRjaGVkIHJlc3BvbnNlIGlzIHRvbyBsYXJnZVwiIH0pO1xuICAgIH1cbiAgICBjb25zdCBodG1sID1cbiAgICAgIHN0YXR1c0NvZGUgPj0gMjAwICYmIHN0YXR1c0NvZGUgPCAzMDBcbiAgICAgICAgPyAoYXdhaXQgcmVzcG9uc2UudGV4dCgpKS5zbGljZSgwLCBNQVhfSFRNTF9CWVRFUylcbiAgICAgICAgOiBcIlwiO1xuICAgIGlmIChyZXR1cm5IdG1sKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cygyMDApLmpzb24oe1xuICAgICAgICB1cmwsXG4gICAgICAgIHN0YXR1c0NvZGUsXG4gICAgICAgIGh0bWwsXG4gICAgICAgIHN1Y2Nlc3M6IEJvb2xlYW4oaHRtbCksXG4gICAgICAgIGVycm9yOiBodG1sID8gdW5kZWZpbmVkIDogYEhUVFAgJHtzdGF0dXNDb2RlfWAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB0aXRsZSA9IChodG1sLm1hdGNoKC88dGl0bGVbXj5dKj4oW1xcc1xcU10qPyk8XFwvdGl0bGU+L2kpPy5bMV0gfHwgXCJcIilcbiAgICAgIC5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKVxuICAgICAgLnRyaW0oKVxuICAgICAgLnNsaWNlKDAsIDIwMCk7XG4gICAgY29uc3QgbWV0YURlc2NyaXB0aW9uID0gaW5jbHVkZU1ldGFEZXNjcmlwdGlvblxuICAgICAgPyAoXG4gICAgICAgICAgaHRtbC5tYXRjaCgvPG1ldGFbXj5dK25hbWU9W1wiJ11kZXNjcmlwdGlvbltcIiddW14+XStjb250ZW50PVtcIiddKFteXCInXSopW1wiJ10vaSk/LlsxXSB8fFxuICAgICAgICAgIGh0bWwubWF0Y2goLzxtZXRhW14+XStjb250ZW50PVtcIiddKFteXCInXSopW1wiJ11bXj5dK25hbWU9W1wiJ11kZXNjcmlwdGlvbltcIiddL2kpPy5bMV0gfHxcbiAgICAgICAgICBcIlwiXG4gICAgICAgIClcbiAgICAgICAgICAucmVwbGFjZSgvXFxzKy9nLCBcIiBcIilcbiAgICAgICAgICAudHJpbSgpXG4gICAgICAgICAgLnNsaWNlKDAsIDMwMClcbiAgICAgIDogXCJcIjtcblxuICAgIHJldHVybiByZXMuc3RhdHVzKDIwMCkuanNvbih7IHVybCwgc3RhdHVzQ29kZSwgdGl0bGUsIG1ldGFEZXNjcmlwdGlvbiwgc3VjY2VzczogdHJ1ZSB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gcmVzLnN0YXR1cygyMDApLmpzb24oe1xuICAgICAgdXJsLFxuICAgICAgc3RhdHVzQ29kZTogMCxcbiAgICAgIHRpdGxlOiBcIlwiLFxuICAgICAgbWV0YURlc2NyaXB0aW9uOiBcIlwiLFxuICAgICAgaHRtbDogcmV0dXJuSHRtbCA/IFwiXCIgOiB1bmRlZmluZWQsXG4gICAgICBlcnJvcjogZXJyb3I/Lm5hbWUgPT09IFwiQWJvcnRFcnJvclwiID8gXCJUaW1lb3V0XCIgOiBlcnJvcj8ubWVzc2FnZSxcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgIH0pO1xuICB9XG59XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGFsZWVtXFxcXE9uZURyaXZlXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxcc2VveFxcXFxmdW5jdGlvbnNcXFxcX2hhbmRsZXJzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhbGVlbVxcXFxPbmVEcml2ZVxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXHNlb3hcXFxcZnVuY3Rpb25zXFxcXF9oYW5kbGVyc1xcXFx3ZWJtYXN0ZXItYXBpLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9hbGVlbS9PbmVEcml2ZS9Eb2N1bWVudHMvR2l0SHViL3Nlb3gvZnVuY3Rpb25zL19oYW5kbGVycy93ZWJtYXN0ZXItYXBpLmpzXCI7Y29uc3QgQklOR19BUElfQkFTRSA9IFwiaHR0cHM6Ly9zc2wuYmluZy5jb20vd2VibWFzdGVyL2FwaS5zdmMvanNvblwiO1xuXG5leHBvcnQgZGVmYXVsdCBhc3luYyBmdW5jdGlvbiBoYW5kbGVyKHJlcSwgcmVzKSB7XG4gIHJlcy5zZXRIZWFkZXIoXCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIiwgXCIqXCIpO1xuICByZXMuc2V0SGVhZGVyKFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kc1wiLCBcIkdFVCwgT1BUSU9OU1wiKTtcbiAgcmVzLnNldEhlYWRlcihcIkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnNcIiwgXCJDb250ZW50LVR5cGUsIEFjY2VwdCwgQXV0aG9yaXphdGlvblwiKTtcbiAgcmVzLnNldEhlYWRlcihcIkNhY2hlLUNvbnRyb2xcIiwgXCJuby1zdG9yZVwiKTtcblxuICBpZiAocmVxLm1ldGhvZCA9PT0gXCJPUFRJT05TXCIpIHJldHVybiByZXMuc3RhdHVzKDIwMCkuZW5kKCk7XG4gIGlmIChyZXEubWV0aG9kICE9PSBcIkdFVFwiKSByZXR1cm4gcmVzLnN0YXR1cyg0MDUpLmpzb24oeyBlcnJvcjogXCJNZXRob2Qgbm90IGFsbG93ZWRcIiB9KTtcblxuICBjb25zdCB7IHNlcnZpY2UsIGFjdGlvbiB9ID0gcmVxLnF1ZXJ5IHx8IHt9O1xuICBpZiAoc2VydmljZSAhPT0gXCJiaW5nXCIpIHtcbiAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogJ0ludmFsaWQgc2VydmljZS4gVXNlIFwiYmluZ1wiLicgfSk7XG4gIH1cbiAgaWYgKCFhY3Rpb24pIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiBcIkFjdGlvbiBpcyByZXF1aXJlZFwiIH0pO1xuXG4gIHJldHVybiBoYW5kbGVCaW5nKHJlcSwgcmVzLCBhY3Rpb24pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVCaW5nKHJlcSwgcmVzLCBhY3Rpb24pIHtcbiAgY29uc3QgeyBhcGlrZXksIHNpdGVVcmwgfSA9IHJlcS5xdWVyeSB8fCB7fTtcbiAgaWYgKCFhcGlrZXkpIHtcbiAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogXCJCaW5nIFdlYm1hc3RlciBBUEkga2V5IGlzIHJlcXVpcmVkXCIgfSk7XG4gIH1cblxuICBsZXQgZW5kcG9pbnQgPSBcIlwiO1xuICBpZiAoYWN0aW9uID09PSBcImdldFNpdGVzXCIpIHtcbiAgICBlbmRwb2ludCA9IGAke0JJTkdfQVBJX0JBU0V9L0dldFVzZXJTaXRlcz9hcGlrZXk9JHtlbmNvZGVVUklDb21wb25lbnQoYXBpa2V5KX1gO1xuICB9IGVsc2UgaWYgKGFjdGlvbiA9PT0gXCJnZXRTdGF0c1wiKSB7XG4gICAgaWYgKCFzaXRlVXJsKSByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogXCJzaXRlVXJsIGlzIHJlcXVpcmVkIGZvciBnZXRTdGF0c1wiIH0pO1xuICAgIGVuZHBvaW50ID0gYCR7QklOR19BUElfQkFTRX0vR2V0UXVlcnlTdGF0cz9hcGlrZXk9JHtlbmNvZGVVUklDb21wb25lbnQoYXBpa2V5KX0mc2l0ZVVybD0ke2VuY29kZVVSSUNvbXBvbmVudChzaXRlVXJsKX1gO1xuICB9IGVsc2UgaWYgKGFjdGlvbiA9PT0gXCJnZXRQYWdlU3RhdHNcIikge1xuICAgIGlmICghc2l0ZVVybCkgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6IFwic2l0ZVVybCBpcyByZXF1aXJlZCBmb3IgZ2V0UGFnZVN0YXRzXCIgfSk7XG4gICAgZW5kcG9pbnQgPSBgJHtCSU5HX0FQSV9CQVNFfS9HZXRQYWdlU3RhdHM/YXBpa2V5PSR7ZW5jb2RlVVJJQ29tcG9uZW50KGFwaWtleSl9JnNpdGVVcmw9JHtlbmNvZGVVUklDb21wb25lbnQoc2l0ZVVybCl9YDtcbiAgfSBlbHNlIGlmIChhY3Rpb24gPT09IFwiZ2V0Q3Jhd2xTdGF0c1wiKSB7XG4gICAgaWYgKCFzaXRlVXJsKSByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogXCJzaXRlVXJsIGlzIHJlcXVpcmVkIGZvciBnZXRDcmF3bFN0YXRzXCIgfSk7XG4gICAgZW5kcG9pbnQgPSBgJHtCSU5HX0FQSV9CQVNFfS9HZXRDcmF3bFN0YXRzP2FwaWtleT0ke2VuY29kZVVSSUNvbXBvbmVudChhcGlrZXkpfSZzaXRlVXJsPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHNpdGVVcmwpfWA7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6IFwiSW52YWxpZCBCaW5nIGFjdGlvblwiIH0pO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGVuZHBvaW50LCB7IGhlYWRlcnM6IHsgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIiB9IH0pO1xuICAgIGNvbnN0IHRleHQgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XG4gICAgY29uc3QgcGF5bG9hZCA9IHBhcnNlSnNvbih0ZXh0KSB8fCB7IHJhdzogdGV4dCB9O1xuXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDAxIHx8IHJlc3BvbnNlLnN0YXR1cyA9PT0gNDAzKSB7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMSkuanNvbih7IGVycm9yOiBcIkludmFsaWQgb3IgdW5hdXRob3JpemVkIEJpbmcgV2VibWFzdGVyIEFQSSBrZXlcIiB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXMuc3RhdHVzKHJlc3BvbnNlLnN0YXR1cykuanNvbih7XG4gICAgICAgIGVycm9yOiBgQmluZyBBUEkgZXJyb3I6IEhUVFAgJHtyZXNwb25zZS5zdGF0dXN9YCxcbiAgICAgICAgZGV0YWlsczogcGF5bG9hZCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiByZXMuc3RhdHVzKDIwMCkuanNvbihwYXlsb2FkKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDIpLmpzb24oe1xuICAgICAgZXJyb3I6IFwiRmFpbGVkIHRvIGZldGNoIGZyb20gQmluZyBXZWJtYXN0ZXIgQVBJXCIsXG4gICAgICBkZXRhaWxzOiBlcnJvcj8ubWVzc2FnZSB8fCBcIlVua25vd24gZXJyb3JcIixcbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwYXJzZUpzb24odmFsdWUpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZSh2YWx1ZSk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXVVLFNBQVMsY0FBYyxlQUFlO0FBQzdXLE9BQU8sV0FBVztBQUNsQixPQUFPLFFBQVE7OztBQ0ZrVyxTQUFTLFlBQVksVUFBVSxzQkFBc0I7QUFDcGEsU0FBTztBQUFBLElBQ0wsK0JBQStCO0FBQUEsSUFDL0IsZ0NBQWdDO0FBQUEsSUFDaEMsZ0NBQWdDO0FBQUEsRUFDbEM7QUFDRjtBQUVPLFNBQVMsYUFBYSxTQUFTLFNBQVMsS0FBSyxVQUFVLENB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QVU7QUFDN0IsUUFBTSxPQUFPLEVBQUUsUUFBUSxRQUFRO0FBQy9CLE1BQUksQ0FBQyxDQUFDLE9BQU8sTUFBTSxFQUFFLFNBQVMsTUFBTSxHQUFHO0FBQ3JDLFNBQUssT0FBTyxNQUFNLFlBQVksR0FBRztBQUFBLEVBQ25DO0FBRUEsU0FBTyxJQUFJLFFBQVEsV0FBVyxLQUFLLFNBQVMsR0FBRyxJQUFJO0FBQ3JEO0FBRUEsU0FBUyx1QkFBdUIsS0FBSztBQUNuQyxTQUFPO0FBQUEsSUFDTCxVQUFVLE1BQU0sT0FBTztBQUNyQixVQUFJLFVBQVUsTUFBTSxLQUFLO0FBQ3pCLGFBQU87QUFBQSxJQUNUO0FBQUEsSUFDQSxPQUFPLFlBQVk7QUFDakIsVUFBSSxhQUFhO0FBQ2pCLGFBQU87QUFBQSxJQUNUO0FBQUEsSUFDQSxLQUFLLFNBQVM7QUFDWixVQUFJLFVBQVUsZ0JBQWdCLGlDQUFpQztBQUMvRCxVQUFJLElBQUksS0FBSyxVQUFVLE9BQU8sQ0FBQztBQUMvQixhQUFPO0FBQUEsSUFDVDtBQUFBLElBQ0EsSUFBSSxTQUFTO0FBQ1gsVUFBSSxJQUFJLE9BQU87QUFDZixhQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0Y7QUFDRjtBQUVBLGVBQWUsZ0JBQWdCLEtBQUssVUFBVTtBQUM1QyxNQUFJLGFBQWEsU0FBUztBQUMxQixXQUFTLFFBQVEsUUFBUSxDQUFDLE9BQU8sUUFBUTtBQUN2QyxRQUFJLFVBQVUsS0FBSyxLQUFLO0FBQUEsRUFDMUIsQ0FBQztBQUNELE1BQUksSUFBSSxPQUFPLEtBQUssTUFBTSxTQUFTLFlBQVksQ0FBQyxDQUFDO0FBQ25EO0FBRUEsU0FBUyxTQUFTLEtBQUssUUFBUSxTQUFTO0FBQ3RDLE1BQUksYUFBYTtBQUNqQixNQUFJLFVBQVUsZ0JBQWdCLGlDQUFpQztBQUMvRCxNQUFJLElBQUksS0FBSyxVQUFVLE9BQU8sQ0FBQztBQUNqQztBQUVBLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLEdBQUcsZUFBZSxHQUFHLGtCQUFrQixHQUFHLHNCQUFzQixHQUFHLG1CQUFtQixHQUFHLHNCQUFzQixHQUFHLGtCQUFrQixHQUFHLGtCQUFrQixHQUFHLGlCQUFpQixDQUFDO0FBQUEsRUFDOUwsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLEVBQ1I7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJvblJlcXVlc3QiLCAiY2xlYW5GaWVsZHMiLCAib25SZXF1ZXN0IiwgImhhbmRsZXIiLCAib25SZXF1ZXN0IiwgImhhbmRsZXIiXQp9Cg==
