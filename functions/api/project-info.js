import { configureMysqlConnection, query, queryOne } from "../_lib/mysql.js";
import { requireUser } from "../_lib/auth-token.js";
import { corsHeaders, emptyResponse, errorResponse, jsonResponse } from "../_lib/http.js";
import { fetchPublicHttpUrl, parsePublicHttpUrl } from "../_lib/url-security.js";

const MAX_HTML_BYTES = 5_000_000;
const PAGESPEED_API_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const DEFAULT_PAGESPEED_STRATEGY = "mobile";
const DEFAULT_PAGESPEED_CATEGORIES = ["performance", "best-practices"];

function parseJsonField(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function buildProjectUrl(project) {
  const rawUrl = String(project?.full_url || project?.fullUrl || project?.url || project?.domain || "").trim();
  if (!rawUrl) return "";
  const candidate = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return candidate;
}

function normalizeRequestUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    const error = new Error("URL is required");
    error.status = 400;
    throw error;
  }
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return parsePublicHttpUrl(withProtocol);
}

function parseHtmlMeta(html) {
  const title = String(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

  const metaDescription = String(
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] ||
      ""
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);

  return { title, metaDescription };
}

async function fetchUrlMetaInfo(targetUrl) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetchPublicHttpUrl(targetUrl.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.8",
      },
    }).finally(() => clearTimeout(timeout));

    const statusCode = response.status;
    const contentType = response.headers.get("content-type") || "";
    const html =
      statusCode >= 200 && statusCode < 300
        ? (await response.text()).slice(0, MAX_HTML_BYTES)
        : "";

    if (html.length > MAX_HTML_BYTES) {
      return {
        url: targetUrl.toString(),
        finalUrl: response.url || targetUrl.toString(),
        statusCode,
        title: "",
        metaDescription: "",
        contentType,
        success: false,
        error: "Fetched response is too large",
      };
    }

    const { title, metaDescription } = parseHtmlMeta(html);
    return {
      url: targetUrl.toString(),
      finalUrl: response.url || targetUrl.toString(),
      statusCode,
      title,
      metaDescription,
      contentType,
      success: response.ok,
      error: response.ok ? undefined : `HTTP ${statusCode}`,
    };
  } catch (error) {
    return {
      url: targetUrl.toString(),
      finalUrl: targetUrl.toString(),
      statusCode: 0,
      title: "",
      metaDescription: "",
      contentType: "",
      success: false,
      error: error?.name === "AbortError" ? "Timeout" : error?.message || "Failed to fetch URL metadata",
    };
  }
}

async function fetchPageSpeedInfo(targetUrl, strategy = DEFAULT_PAGESPEED_STRATEGY) {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "PageSpeed API key not configured on server",
    };
  }

  const categories = DEFAULT_PAGESPEED_CATEGORIES.map((item) => `&category=${encodeURIComponent(item)}`).join("");
  const apiUrl = `${PAGESPEED_API_URL}?url=${encodeURIComponent(targetUrl.toString())}&key=${encodeURIComponent(
    apiKey
  )}&strategy=${encodeURIComponent(strategy)}${categories}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    }).finally(() => clearTimeout(timeout));

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: data?.error?.message || `PageSpeed API returned HTTP ${response.status}`,
        status: response.status,
        data,
      };
    }

    if (!data?.lighthouseResult) {
      return {
        success: false,
        error: "PageSpeed returned incomplete results. The website may be blocking analysis.",
        status: response.status,
        data,
      };
    }

    return {
      success: true,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error?.name === "AbortError"
          ? "PageSpeed analysis timed out"
          : error?.message || "Failed to analyze page performance",
    };
  }
}

async function loadUserProject(userId, projectId) {
  const row = await queryOne(
    `SELECT * FROM user_projects WHERE user_id = ? AND project_id = ? LIMIT 1`,
    [userId, projectId]
  );
  if (!row) return null;
  return {
    project_id: row.project_id,
    project_name: row.project_name,
    domain: row.domain,
    full_url: row.full_url,
    project_data: parseJsonField(row.project_data, {}),
    selected_project_id: row.selected_project_id,
    deleted_project_ids: parseJsonField(row.deleted_project_ids, []),
    owner: row.owner,
    owner_email: row.owner_email,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadSavedToolResults(userId, projectId, keys = []) {
  if (!keys.length) return {};
  const placeholders = keys.map(() => '?').join(', ');
  const rows = await query(
    `SELECT tool_key, result, project_url, updated_at
     FROM tool_results
     WHERE user_id = ? AND project_id = ? AND tool_key IN (${placeholders})`,
    [userId, projectId, ...keys]
  );

  return rows.reduce((acc, row) => {
    acc[row.tool_key] = {
      result: parseJsonField(row.result, {}),
      projectUrl: row.project_url || "",
      updatedAt: row.updated_at || null,
    };
    return acc;
  }, {});
}

export async function onRequest({ request, env }) {
  const headers = {
    ...corsHeaders("GET, OPTIONS"),
    "Cache-Control": "no-store",
  };

  if (request.method === "OPTIONS") return emptyResponse(204, headers);
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  }

  try {
    configureMysqlConnection(env);
    const decoded = await requireUser(request, env);
    const userId = decoded.uid;
    const url = new URL(request.url);
    const projectId = String(url.searchParams.get("projectId") || "").trim();
    const urlParam = url.searchParams.get("url") || "";
    const strategy = String(url.searchParams.get("strategy") || DEFAULT_PAGESPEED_STRATEGY).trim();

    if (!projectId && !urlParam) {
      return jsonResponse({ error: "projectId or url query parameter is required" }, 400, headers);
    }

    let project = null;
    if (projectId) {
      project = await loadUserProject(userId, projectId);
      if (!project) {
        return jsonResponse({ error: "Project not found" }, 404, headers);
      }
    }

    let targetUrl;
    try {
      targetUrl = urlParam ? normalizeRequestUrl(urlParam) : normalizeRequestUrl(buildProjectUrl(project));
    } catch (error) {
      return jsonResponse({ error: error?.message || "Invalid URL" }, error?.status || 400, headers);
    }

    const [urlMeta, pageSpeed] = await Promise.all([
      fetchUrlMetaInfo(targetUrl),
      fetchPageSpeedInfo(targetUrl, strategy),
    ]);

    const toolResults = projectId
      ? await loadSavedToolResults(userId, projectId, ["dashboardChecks", "gsc"])
      : {};

    return jsonResponse(
      {
        success: true,
        project,
        url: targetUrl.toString(),
        urlMeta,
        pageSpeed,
        toolResults,
      },
      200,
      headers
    );
  } catch (error) {
    return errorResponse(error, headers);
  }
}
