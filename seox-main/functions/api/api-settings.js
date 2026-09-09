import {
  assertAdmin,
  getStoredDocument,
  upsertStoredDocument,
} from "../_lib/mysql-storage.js";
import {
  corsHeaders,
  emptyResponse,
  errorResponse,
  jsonResponse,
  readJson,
} from "../_lib/http.js";

const SETTINGS_COLLECTION = "adminSettings";
const SETTINGS_DOCUMENT = "apis";

function settingsCollection(env) {
  return env.ADMIN_SETTINGS_COLLECTION || SETTINGS_COLLECTION;
}

function maskSecret(value) {
  const secret = String(value || "");
  if (!secret) return "";
  const suffix = secret.slice(-4);
  return suffix ? `••••${suffix}` : "••••";
}

function publicSettings(document = {}, env = {}) {
  const savedLogin = document.dataforseoLogin || "";
  const savedPassword = document.dataforseoPassword || "";
  const envLogin = env.DATAFORSEO_LOGIN || "";
  const envPassword = env.DATAFORSEO_PASSWORD || "";

  return {
    dataforseo: {
      login: savedLogin,
      hasSavedCredentials: Boolean(savedLogin && savedPassword),
      hasSavedPassword: Boolean(savedPassword),
      passwordPreview: maskSecret(savedPassword),
      envConfigured: Boolean(envLogin && envPassword),
      updatedAt: document.dataforseoUpdatedAt || "",
      updatedBy: document.dataforseoUpdatedBy || "",
    },
  };
}

export async function onRequest({ request, env }) {
  const headers = {
    ...corsHeaders("GET, POST, OPTIONS"),
    "Cache-Control": "no-store",
  };

  if (request.method === "OPTIONS") return emptyResponse(204, headers);

  try {
    const decoded = await assertAdmin(request, env);
    const collection = settingsCollection(env);

    if (request.method === "GET") {
      const document = await getStoredDocument(env, collection, SETTINGS_DOCUMENT);
      return jsonResponse(publicSettings(document || {}, env), 200, headers);
    }

    if (request.method === "POST") {
      const body = await readJson(request);
      const login = String(body.dataforseoLogin || "").trim();
      const password = String(body.dataforseoPassword || "").trim();
      const clearPassword = Boolean(body.clearDataforseoPassword);
      const existing = await getStoredDocument(env, collection, SETTINGS_DOCUMENT);

      const fields = {
        dataforseoLogin: login,
        dataforseoUpdatedAt: new Date().toISOString(),
        dataforseoUpdatedBy: decoded.email || decoded.uid || "",
      };

      if (password || clearPassword || !existing?.dataforseoPassword) {
        fields.dataforseoPassword = clearPassword ? "" : password;
      }

      const saved = await upsertStoredDocument(env, collection, SETTINGS_DOCUMENT, fields);
      return jsonResponse(publicSettings(saved, env), 200, headers);
    }

    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
