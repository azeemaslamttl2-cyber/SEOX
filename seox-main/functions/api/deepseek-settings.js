import { verifyAccessToken } from "../_lib/mysql-storage.js";
import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from "../_lib/http.js";
import { queryOne } from "../_lib/mysql.js";

function maskSecret(value) {
  const secret = String(value || "");
  return secret ? `••••${secret.slice(-4)}` : "";
}

function publicSettings(row, env) {
  const savedKey = row?.api_key || "";
  return {
    hasSavedKey: Boolean(savedKey),
    apiKeyPreview: maskSecret(savedKey),
    envConfigured: Boolean(env.DEEPSEEK_API_KEY),
    updatedAt: row?.updated_at || "",
  };
}

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders("GET, POST, OPTIONS"), "Cache-Control": "no-store" };
  if (request.method === "OPTIONS") return emptyResponse(204, headers);

  try {
    const user = await verifyAccessToken(request, env);
    if (request.method === "GET") {
      const row = await queryOne(
        "SELECT api_key, updated_at FROM deepseek_api_settings WHERE user_id = ? ORDER BY id DESC LIMIT 1",
        [user.uid]
      );
      return jsonResponse(publicSettings(row, env), 200, headers);
    }

    if (request.method === "POST") {
      const body = await readJson(request);
      const apiKey = String(body.apiKey || "").trim();
      const clearApiKey = Boolean(body.clearApiKey);
      const existing = await queryOne(
        "SELECT id, api_key FROM deepseek_api_settings WHERE user_id = ? ORDER BY id DESC LIMIT 1",
        [user.uid]
      );
      const savedKey = clearApiKey ? "" : apiKey || existing?.api_key || "";

      if (existing?.id) {
        await queryOne(
          "UPDATE deepseek_api_settings SET api_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [savedKey, existing.id]
        );
      } else {
        await queryOne(
          "INSERT INTO deepseek_api_settings (user_id, api_key) VALUES (?, ?)",
          [user.uid, savedKey]
        );
      }
      const row = await queryOne(
        "SELECT api_key, updated_at FROM deepseek_api_settings WHERE user_id = ? ORDER BY id DESC LIMIT 1",
        [user.uid]
      );
      return jsonResponse(publicSettings(row, env), 200, headers);
    }

    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
