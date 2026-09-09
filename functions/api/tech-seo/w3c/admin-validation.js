import { configureMysqlConnection, queryOne, update } from "../../../_lib/mysql.js";
import { jsonResponse, corsHeaders } from "../../../_lib/http.js";
import { mergeW3CValidationReport, normalizeW3CInputUrl, summarizeW3CResponse, buildW3CApiResult } from "./validate.js";

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

function parseProjectData(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function projectDomain(value) {
  try {
    return new URL(value).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

async function persistW3CValidationReport(env, projectId, sourceUrl, report) {
  configureMysqlConnection(env);
  const domain = projectDomain(sourceUrl);
  const row = projectId
    ? await queryOne(
        "SELECT project_id, project_data FROM user_projects WHERE project_id = ? LIMIT 1",
        [projectId]
      )
    : await queryOne(
        `SELECT project_id, project_data FROM user_projects
         WHERE LOWER(domain) = ? OR LOWER(full_url) LIKE ?
         ORDER BY updated_at DESC LIMIT 1`,
        [domain, `%${domain}%`]
      );

  if (!row) {
    const error = new Error("Project not found for W3C validation.");
    error.status = 404;
    throw error;
  }

  const merged = mergeW3CValidationReport(parseProjectData(row.project_data), report);
  await update(
    "UPDATE user_projects SET project_data = ?, updated_at = NOW() WHERE project_id = ?",
    [JSON.stringify(merged), row.project_id]
  );
  return row.project_id;
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
    const storedReport = {
      url: targetUrl.toString(),
      status: summary.status === "issues" || summary.status === "warning" ? "completed" : "completed",
      error_count: summary.totalErrors,
      warning_count: summary.totalWarnings,
      errors: summary.messages.filter((item) => item.type === "error"),
      warnings: summary.messages.filter((item) => item.type === "warning"),
      messages: summary.messages,
      total_messages: summary.totalMessages,
      validated_at: summary.generatedAt,
      validator: response.data.validator,
    };
    const savedProjectId = await persistW3CValidationReport(
      env,
      String(body?.project_id || body?.projectId || "").trim(),
      targetUrl.toString(),
      storedReport
    );

    response.message = "W3C validation completed and project data updated successfully";
    response.data.w3c_validation = storedReport;
    response.data.project_id = savedProjectId;
    response.data.saved_to_project_data = true;

    return jsonResponse(response, 200, headers);
  } catch (error) {
    const status = Number(error?.status) || 500;
    return errorResponse(error?.message || "Unable to validate the provided URL.", status, headers);
  }
}
