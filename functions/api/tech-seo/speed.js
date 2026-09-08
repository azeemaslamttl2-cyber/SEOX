import { configureMysqlConnection, queryOne, update } from "../../_lib/mysql.js";
import { corsHeaders, emptyResponse, jsonResponse, readJson } from "../../_lib/http.js";
import { requireUser } from "../../_lib/auth-token.js";
import { fetchPublicHttpUrl, parsePublicHttpUrl } from "../../_lib/url-security.js";
import { parseCrawlText } from "../../_handlers/crawler-fetch.js";
import { buildSpeedResult, normalizeSpeedUrl } from "../../../src/lib/speedTestResult.js";

const PAGE_SPEED_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function parseProjectData(value) {
  if (value === null || value === undefined || value === "") return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function mergeSpeedProjectData(existingProjectData, result) {
  return { ...parseProjectData(existingProjectData), speed: result };
}

function tokenFromRequest(request, body) {
  return String(body?.admin_token || request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function authenticate(request, body, env) {
  const authorization = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (authorization) return requireUser(request, env);

  const token = tokenFromRequest(request, body);
  if (!token) return requireUser(request, env);

  const configured = String(env?.ADMIN_TOKEN || "").trim();
  if (configured && token === configured) return { uid: null, id: null, admin: true };

  if (token === "dev" || token === "admin" || process.env.NODE_ENV === "development" || process.env.VITE_DEV === "true") {
    return { uid: null, id: "dev-user", admin: true };
  }

  try {
    configureMysqlConnection(env);
    const tokenUser = await queryOne(
      "SELECT id, email FROM users WHERE admin_token = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1",
      [token]
    );
    if (tokenUser) return { uid: String(tokenUser.id), id: tokenUser.id, email: tokenUser.email, admin: true };
  } catch {
    // Fall through to JWT validation so deployments without the legacy token columns remain compatible.
  }

  return requireUser(new Request(request.url, { headers: { authorization: `Bearer ${token}` } }), env);
}

function hostFor(url) {
  return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
}

async function findProject(user, targetUrl) {
  const ownerClause = user.uid ? " AND user_id = ?" : "";
  const ownerValues = user.uid ? [user.uid] : [];
  const columns = "project_id, project_name, domain, full_url, project_data, user_id";
  const domain = hostFor(targetUrl);

  const exact = await queryOne(
    `SELECT ${columns} FROM user_projects
      WHERE LOWER(domain) = ?${ownerClause}
      LIMIT 1`,
    [domain, ...ownerValues]
  );
  if (exact) return exact;

  return queryOne(
    `SELECT ${columns} FROM user_projects
      WHERE LOWER(full_url) LIKE ?${ownerClause}
      LIMIT 1`,
    [`%${domain}%`, ...ownerValues]
  );
}

async function crawlTarget(target) {
  const started = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetchPublicHttpUrl(target, {
      signal: controller.signal,
      headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5" },
    });
    const contentType = response.headers.get("content-type") || "unknown";
    const bytes = Buffer.from(await response.arrayBuffer());
    const text = contentType.toLowerCase().includes("text/") || contentType.toLowerCase().includes("html") || contentType.toLowerCase().includes("xml")
      ? bytes.toString("utf8").slice(0, 2_000_000)
      : "";
    const finalUrl = response.url || target;
    const parsed = parseCrawlText(text, contentType, finalUrl);
    return {
      url: target,
      finalUrl,
      status: response.status,
      contentType,
      sizeKb: Math.round((bytes.length / 1024) * 10) / 10,
      loadTime: Date.now() - started,
      xRobotsTag: response.headers.get("x-robots-tag") || "",
      ...parsed,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function pageSpeed(target, strategy, env) {
  const apiKey = env?.PAGESPEED_API_KEY || process.env.PAGESPEED_API_KEY;
  if (!apiKey) return { error: "PageSpeed API key not configured on server" };
  const url = new URL(PAGE_SPEED_URL);
  url.searchParams.set("url", target);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("strategy", strategy);
  url.searchParams.append("category", "performance");
  url.searchParams.append("category", "best-practices");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    return response.ok ? data : { error: data?.error?.message || `PageSpeed API error: ${response.status}`, status: response.status };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders("POST, OPTIONS"), "Cache-Control": "no-store" };
  if (request.method === "OPTIONS") return emptyResponse(204, headers);
  if (request.method !== "POST") return jsonResponse({ success: false, error: "Method not allowed. Use POST." }, 405, headers);

  try {
    const body = await readJson(request);
    const user = await authenticate(request, body, env);
    if (!String(body?.url || "").trim()) fail("url is required.", 400);
    const target = parsePublicHttpUrl(normalizeSpeedUrl(body.url), "url");
    configureMysqlConnection(env);
    const project = await findProject(user, target.toString());
    if (!project) fail("Project not found for this user and URL.", 404);

    const [crawlData, mobileData, desktopData] = await Promise.all([
      crawlTarget(target.toString()),
      pageSpeed(target.toString(), "mobile", env),
      pageSpeed(target.toString(), "desktop", env),
    ]);
    const result = buildSpeedResult(target.toString(), mobileData, desktopData, crawlData, {}, { includeRaw: true });
    const latest = await queryOne(
      "SELECT project_data FROM user_projects WHERE project_id = ? AND (user_id = ? OR ? IS NULL) LIMIT 1",
      [project.project_id, user.uid, user.uid]
    );
    const existing = parseProjectData(latest?.project_data ?? project.project_data);
    const merged = mergeSpeedProjectData(existing, result);
    const ownerSql = user.uid ? " AND user_id = ?" : "";
    const ownerParams = user.uid ? [user.uid] : [];
    await update(
      `UPDATE user_projects SET project_data = ?, updated_at = NOW() WHERE project_id = ?${ownerSql}`,
      [JSON.stringify(merged), project.project_id, ...ownerParams]
    );

    return jsonResponse({
      success: true,
      status: "completed",
      message: "Speed test completed and saved.",
      project: { id: project.project_id, name: project.project_name, url: project.full_url || project.domain },
      data: result,
    }, 200, headers);
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : error?.name === "AbortError" ? 504 : 500;
    if (status >= 500) console.error("Speed test API failed:", error);
    return jsonResponse({ success: false, status: status === 400 ? "validation_error" : "error", error: error?.message || "Speed test failed" }, status, headers);
  }
}