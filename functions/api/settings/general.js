import { assertAdmin } from "../../_lib/mysql-storage.js";
import {
  corsHeaders,
  emptyResponse,
  errorResponse,
  jsonResponse,
  readJson,
} from "../../_lib/http.js";
import {
  SETTING_DEFINITIONS,
  describeAppSettings,
  saveAdminSettings,
} from "../../_lib/app-settings.js";

const DEFINITION_BY_KEY = new Map(SETTING_DEFINITIONS.map((item) => [item.key, item]));

const URI_KEYS = new Set([
  "google_gsc_redirect_uri",
  "google_auth_redirect_uri",
  "google_gbp_redirect_uri",
]);

function validate(key, value) {
  if (!value) return "";
  if (value.length > 1000) return `${DEFINITION_BY_KEY.get(key).label} is too long.`;

  if (URI_KEYS.has(key)) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return `${DEFINITION_BY_KEY.get(key).label} must be an http(s) URL.`;
      }
    } catch {
      return `${DEFINITION_BY_KEY.get(key).label} must be a valid URL.`;
    }
  }

  return "";
}

/**
 * Admin-only General Settings API.
 *
 * GET  -> setting metadata (secrets are reported as configured/preview only)
 * POST -> persists submitted values to `admin_settings`
 *
 * Secret values are never returned in a response and never written to a log.
 */
export async function onRequest({ request, env }) {
  const headers = {
    ...corsHeaders("GET, POST, OPTIONS"),
    "Cache-Control": "no-store",
  };

  if (request.method === "OPTIONS") return emptyResponse(204, headers);

  try {
    const decoded = await assertAdmin(request, env);

    if (request.method === "GET") {
      return jsonResponse({ settings: await describeAppSettings(env) }, 200, headers);
    }

    if (request.method === "POST") {
      const body = await readJson(request);
      const submitted = body?.settings && typeof body.settings === "object" ? body.settings : {};
      const cleared = Array.isArray(body?.cleared) ? body.cleared : [];

      const values = {};
      const errors = {};

      for (const [key, rawValue] of Object.entries(submitted)) {
        const definition = DEFINITION_BY_KEY.get(key);
        if (!definition) continue;

        const value = typeof rawValue === "string" ? rawValue.trim() : "";
        // A secret submitted as an empty string means "leave unchanged" - the UI
        // never receives the current value, so it cannot echo it back.
        if (definition.secret && !value) continue;

        const problem = validate(key, value);
        if (problem) {
          errors[key] = problem;
          continue;
        }
        values[key] = value;
      }

      for (const key of cleared) {
        if (DEFINITION_BY_KEY.has(key)) values[key] = "";
      }

      if (Object.keys(errors).length) {
        return jsonResponse({ error: "Some settings are invalid.", errors }, 400, headers);
      }

      const updatedCount = await saveAdminSettings(values, {
        env,
        updatedBy: decoded.email || decoded.uid || "",
      });

      return jsonResponse(
        { success: true, updated: updatedCount, settings: await describeAppSettings(env) },
        200,
        headers
      );
    }

    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
