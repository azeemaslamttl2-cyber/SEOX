import { parsePublicHttpUrl } from "../../../_lib/url-security.js";
import { corsHeaders, errorResponse, jsonResponse } from "../../../_lib/http.js";
import { requireUser } from "../../../_lib/auth-token.js";

const W3C_VALIDATOR_URL = "https://validator.w3.org/nu/";
const W3C_TIMEOUT_MS = 25000;

export function normalizeW3CInputUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    const error = new Error("Website URL is required");
    error.status = 400;
    throw error;
  }

  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const parsed = parsePublicHttpUrl(normalized, "website URL");
  return parsed;
}

function normalizeSourceText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function summarizeW3CResponse(payload = {}) {
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const entries = messages.map((item) => {
    const type = String(item?.type || "info").toLowerCase();
    const message = String(item?.message || "");
    const location =
      item?.lastLine || item?.lastColumn
        ? `line ${Number(item?.lastLine || 0) || 0}, column ${Number(item?.lastColumn || 0) || 0}`
        : "";

    return {
      type,
      message,
      source: normalizeSourceText(item?.source?.code || item?.source || item?.extract || ""),
      extract: normalizeSourceText(item?.extract || ""),
      location: location || "",
      url: item?.url || payload?.url || "",
      line: Number(item?.lastLine || 0) || null,
      column: Number(item?.lastColumn || 0) || null,
      html: item?.html || undefined,
    };
  });

  const totalErrors = entries.filter((item) => item.type === "error").length;
  const totalWarnings = entries.filter((item) => item.type === "warning").length;
  const status = totalErrors > 0 ? "issues" : totalWarnings > 0 ? "warning" : "valid";

  return {
    status,
    totalErrors,
    totalWarnings,
    totalMessages: entries.length,
    url: payload?.url || "",
    generatedAt: new Date().toISOString(),
    messages: entries,
  };
}

async function validateWithW3C(url) {
  const requestUrl = new URL(W3C_VALIDATOR_URL);
  requestUrl.searchParams.set("out", "json");
  requestUrl.searchParams.set("doc", url.toString());

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), W3C_TIMEOUT_MS);

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

  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  }

  try {
    await requireUser(request, env);
    const url = new URL(request.url);
    const projectUrl = url.searchParams.get("url") || url.searchParams.get("projectUrl") || "";
    const targetUrl = normalizeW3CInputUrl(projectUrl);
    const payload = await validateWithW3C(targetUrl);
    const summary = summarizeW3CResponse(payload);

    return jsonResponse(
      {
        success: true,
        url: targetUrl.toString(),
        validator: {
          name: "W3C Nu Html Checker",
          docs: "https://validator.w3.org/nu/about.html",
        },
        ...summary,
      },
      200,
      headers
    );
  } catch (error) {
    return errorResponse(error, headers);
  }
}
