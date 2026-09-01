import {
  decodeProtectedHeader,
  importPKCS8,
  importX509,
  jwtVerify,
  SignJWT,
} from "jose";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIREBASE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/datastore",
  "https://www.googleapis.com/auth/identitytoolkit",
];
const DEFAULT_FIREBASE_PROJECT_ID = "codestap-9a0b2";

let accessTokenCache = null;
let certificateCache = null;

function configurationError(message) {
  const error = new Error(message);
  error.status = 500;
  return error;
}

function parseServiceAccountJson(value) {
  const raw = String(value || "").trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
  } catch {
    throw configurationError("FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON");
  }
}

function normalizePrivateKey(value) {
  if (!value) return "";

  let key = String(value).trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    try {
      key = JSON.parse(key);
    } catch {
      key = key.slice(1, -1);
    }
  }

  return String(key)
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();
}

function parseServiceAccount(env) {
  let account = {};

  if (env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    account = parseServiceAccountJson(env.FIREBASE_SERVICE_ACCOUNT_KEY);
  }

  const projectId =
    account.project_id ||
    account.projectId ||
    env.FIREBASE_PROJECT_ID ||
    env.VITE_FIREBASE_PROJECT_ID ||
    env.GCLOUD_PROJECT ||
    env.GOOGLE_CLOUD_PROJECT ||
    DEFAULT_FIREBASE_PROJECT_ID;
  const clientEmail =
    account.client_email || account.clientEmail || env.FIREBASE_CLIENT_EMAIL;
  const privateKey =
    account.private_key || account.privateKey || env.FIREBASE_PRIVATE_KEY;

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  };
}

export function getFirebaseProjectId(env) {
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
    expiresAt: now + parseMaxAge(response.headers.get("cache-control")) * 1000,
  };
  return certificates;
}

export async function verifyFirebaseIdToken(request, env) {
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
      issuer: `https://securetoken.google.com/${projectId}`,
    });
    const now = Math.floor(Date.now() / 1000);

    if (!payload.sub || payload.sub.length > 128 || Number(payload.auth_time) > now) {
      throw new Error("Invalid Firebase auth token claims");
    }

    return {
      ...payload,
      uid: payload.sub,
    };
  } catch (cause) {
    const error = new Error("Invalid or expired Firebase auth token");
    error.status = 401;
    error.cause = cause;
    throw error;
  }
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeTier(value) {
  const tier = String(value || "").trim().toLowerCase();
  if (tier === "admin") return "admin";
  return tier;
}

export async function assertAdmin(request, env) {
  const decoded = await verifyFirebaseIdToken(request, env);
  const allowedEmails = parseCsv(env.ADMIN_EMAILS);
  const email = String(decoded.email || "").trim().toLowerCase();

  if (
    decoded.admin ||
    normalizeTier(decoded.level || decoded.plan) === "admin" ||
    allowedEmails.includes(email)
  ) {
    return decoded;
  }

  const error = new Error("You do not have admin access");
  error.status = 403;
  throw error;
}

async function createGoogleAccessToken(env) {
  const account = getServiceAccount(env);
  const now = Math.floor(Date.now() / 1000);
  if (
    !account.privateKey.startsWith("-----BEGIN PRIVATE KEY-----") ||
    !account.privateKey.includes("-----END PRIVATE KEY-----")
  ) {
    throw configurationError(
      "Firebase private key is not a valid PKCS#8 key. Use the complete Firebase service-account JSON, or a private key that starts with -----BEGIN PRIVATE KEY-----."
    );
  }

  let privateKey;
  try {
    privateKey = await importPKCS8(account.privateKey, "RS256");
  } catch (cause) {
    const error = configurationError(
      "Firebase private key could not be parsed. Re-copy the service-account JSON from Firebase and make sure private_key is unchanged."
    );
    error.cause = cause;
    throw error;
  }
  const assertion = await new SignJWT({
    scope: GOOGLE_SCOPES.join(" "),
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.clientEmail)
    .setAudience(GOOGLE_TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
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
    expiresAt: Date.now() + (Number(data.expires_in || 3600) - 60) * 1000,
    clientEmail: account.clientEmail,
  };
  return accessTokenCache.token;
}

async function getGoogleAccessToken(env) {
  const account = getServiceAccount(env);
  if (
    accessTokenCache?.expiresAt > Date.now() &&
    accessTokenCache.clientEmail === account.clientEmail
  ) {
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
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
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

export async function listAuthUsers(env) {
  const projectId = getFirebaseProjectId(env);
  const users = [];
  let nextPageToken = "";

  do {
    const url = new URL(
      `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(
        projectId
      )}/accounts:batchGet`
    );
    url.searchParams.set("maxResults", "1000");
    if (nextPageToken) url.searchParams.set("nextPageToken", nextPageToken);

    const data = await googleRequest(env, url.toString());
    users.push(...(data.users || []));
    nextPageToken = data.nextPageToken || "";
  } while (nextPageToken);

  return users;
}

export async function lookupAuthUsers(env, localIds) {
  const projectId = getFirebaseProjectId(env);
  const users = [];

  for (let index = 0; index < localIds.length; index += 100) {
    const data = await googleRequest(
      env,
      `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(
        projectId
      )}/accounts:lookup`,
      {
        method: "POST",
        body: JSON.stringify({ localId: localIds.slice(index, index + 100) }),
      }
    );
    users.push(...(data.users || []));
  }

  return users;
}

function firestoreBaseUrl(env) {
  const projectId = getFirebaseProjectId(env);
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents`;
}

function encodeDocumentPath(path) {
  return String(path)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
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
  return undefined;
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
    ...decodeFirestoreFields(document.fields || {}),
  };
}

export async function listFirestoreCollection(env, collection, pageSize = 500) {
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

export async function readFirstCollection(env, envName, fallbacks, limit = 500) {
  const configured = env[envName];
  const names = [configured, ...fallbacks].filter(Boolean);

  for (const name of names) {
    const documents = await listFirestoreCollection(env, name, limit);
    if (documents.length || configured === name) return documents.slice(0, limit);
  }

  return [];
}

export async function getFirestoreDocument(env, collection, documentId) {
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

export async function deleteFirestoreDocument(env, collection, documentId) {
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

export function firestoreTimestamp(value = new Date()) {
  return {
    __firestoreType: "timestamp",
    value: value instanceof Date ? value.toISOString() : String(value),
  };
}

function encodeFirestoreValue(value) {
  if (value?.__firestoreType === "timestamp") {
    return { timestampValue: value.value };
  }
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
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

export async function patchFirestoreDocument(
  env,
  collection,
  documentId,
  fields
) {
  const url = new URL(
    `${firestoreBaseUrl(env)}/${encodeDocumentPath(`${collection}/${documentId}`)}`
  );
  for (const field of Object.keys(fields)) {
    url.searchParams.append("updateMask.fieldPaths", field);
  }

  const data = await googleRequest(env, url.toString(), {
    method: "PATCH",
    body: JSON.stringify({ fields: encodeFirestoreFields(fields) }),
  });
  return decodeFirestoreDocument(data);
}
