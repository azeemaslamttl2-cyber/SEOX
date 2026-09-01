import { configureMysqlConnection, queryOne } from "../../../_lib/mysql.js";
import { jsonResponse, corsHeaders } from "../../../_lib/http.js";
import { normalizeW3CInputUrl, summarizeW3CResponse, buildW3CApiResult } from "./validate.js";

const MAX_TOKEN_LENGTH = 512;

function errorResponse(message, status, headers) {
  return jsonResponse({ success: false, message }, status, headers);
}

function parseBody(request) {
  return request.json().catch(() => ({}));
}

function validateAdminToken(value) {
  const token = typeof value === "string" ? value.trim() : "";
  if (!token) {
    const error = new Error("admin_token is required");
    error.status = 400;
    throw error;
  }
  if (token.length > MAX_TOKEN_LENGTH) {
    const error = new Error("Invalid admin token.");
    error.status = 401;
    throw error;
  }
  return token;
}

async function verifyAdminToken(token, env) {
  configureMysqlConnection(env);
  const admin = await queryOne(
    `SELECT id FROM users WHERE admin_token = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1`,
    [token]
  );
  if (!admin) {
    const error = new Error("Invalid admin token.");
    error.status = 401;
    throw error;
  }
  return admin;
}

async function validateWithW3C(url) {
  const requestUrl = new URL("https://validator.w3.org/nu/");
  requestUrl.searchParams.set("out", "json");
  requestUrl.searchParams.set("doc", url.toString());

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(requestUrl.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "CrawlUs-W3C-Validator/1.0",
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.message || payload?.error || `W3C validator returned HTTP ${response.status}`;
      const error = new Error(detail);
      error.status = response.status;
      throw error;
    }

    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function onRequest({ request, env }) {
  const headers = {
    ...corsHeaders("GET, POST, OPTIONS"),
    "Cache-Control": "no-store",
  };

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "GET" && request.method !== "POST") return jsonResponse({ success: false, message: "Method not allowed." }, 405, headers);

  try {
    const body = await parseBody(request);
    const queryAdminToken = new URL(request.url).searchParams.get("admin_token") || "";
    const adminToken = validateAdminToken(body?.admin_token || queryAdminToken);
    await verifyAdminToken(adminToken, env);

    const sourceUrl = String(body?.url || new URL(request.url).searchParams.get("url") || "").trim();
    if (!sourceUrl) {
      const error = new Error("URL is required.");
      error.status = 400;
      throw error;
    }

    const targetUrl = normalizeW3CInputUrl(sourceUrl);
    const payload = await validateWithW3C(targetUrl);
    const summary = summarizeW3CResponse(payload);
    const response = buildW3CApiResult(targetUrl.toString(), {
      ...summary,
      validator: {
        name: "W3C Nu Html Checker",
        docs: "https://validator.w3.org/nu/about.html",
      },
    });

    return jsonResponse(response, 200, headers);
  } catch (error) {
    const status = Number(error?.status) || 500;
    return errorResponse(error?.message || "Unable to validate the provided URL.", status, headers);
  }
}
