import { assertAdmin } from "../_lib/mysql-storage.js";
import {
  corsHeaders,
  emptyResponse,
  errorResponse,
  jsonResponse,
  readJson,
} from "../_lib/http.js";
import {
  getAdminSettingMeta,
  getAdminSettings,
  maskSecret,
  saveAdminSettings,
} from "../_lib/app-settings.js";

/**
 * Admin > APIs screen (DataForSEO credentials).
 *
 * This route predates the General Settings page and keeps its original request
 * and response contract, but it now reads and writes the same `admin_settings`
 * rows through the shared settings service. Both screens therefore edit one
 * credential rather than two copies of it.
 */
async function publicSettings(env) {
  const values = await getAdminSettings(["dataforseo_login", "dataforseo_password"], env);
  const login = values.dataforseo_login || "";
  const password = values.dataforseo_password || "";
  const loginMeta = await getAdminSettingMeta("dataforseo_login", env);
  const passwordMeta = await getAdminSettingMeta("dataforseo_password", env);

  return {
    dataforseo: {
      login,
      hasSavedCredentials: Boolean(login && password),
      hasSavedPassword: Boolean(password),
      passwordPreview: maskSecret(password),
      // "Configured from the environment" now means the value is still coming
      // from the .env migration fallback rather than from admin_settings.
      envConfigured: loginMeta.source === "env" || passwordMeta.source === "env",
      updatedAt: passwordMeta.updatedAt || loginMeta.updatedAt || "",
      updatedBy: passwordMeta.updatedBy || loginMeta.updatedBy || "",
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

    if (request.method === "GET") {
      return jsonResponse(await publicSettings(env), 200, headers);
    }

    if (request.method === "POST") {
      const body = await readJson(request);
      const login = String(body.dataforseoLogin || "").trim();
      const password = String(body.dataforseoPassword || "").trim();
      const clearPassword = Boolean(body.clearDataforseoPassword);

      const values = { dataforseo_login: login };
      // An empty password means "leave unchanged" unless the caller explicitly
      // asked to clear it, so the UI never has to echo the stored secret back.
      if (clearPassword) values.dataforseo_password = "";
      else if (password) values.dataforseo_password = password;

      await saveAdminSettings(values, {
        env,
        updatedBy: decoded.email || decoded.uid || "",
      });

      return jsonResponse(await publicSettings(env), 200, headers);
    }

    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
