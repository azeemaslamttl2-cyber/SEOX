import { configureMysqlConnection, queryOne } from "../../_lib/mysql.js";

const MAX_TOKEN_LENGTH = 512;
const MAX_URLS = 10000;

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function error(message, status = 400) {
  return json({ success: false, error: message }, status);
}

async function validateAdminToken(value, env) {
  const adminToken = typeof value === "string" ? value.trim() : "";
  if (!adminToken || adminToken.length > MAX_TOKEN_LENGTH) {
    return error("Invalid or missing admin token.", 401);
  }

  configureMysqlConnection(env);
  const admin = await queryOne(
    `SELECT id
     FROM users
     WHERE admin_token = ?
       AND is_active = 1
       AND deleted_at IS NULL
     LIMIT 1`,
    [adminToken]
  );
  return admin ? null : error("Invalid or missing admin token.", 401);
}

function readUrls(value) {
  if (Array.isArray(value)) return value.map((url) => String(url || "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split("\n").map((url) => url.trim()).filter(Boolean);
  return [];
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return error("Method not allowed", 405);

  try {
    const body = await request.json().catch(() => null);
    const tokenError = await validateAdminToken(body?.admin_token, env);
    if (tokenError) return tokenError;

    const urls = readUrls(body?.urls ?? body?.backlink_urls);
    if (!urls.length) return error("No backlink URLs were provided.", 400);
    if (urls.length > MAX_URLS) return error(`A maximum of ${MAX_URLS} URLs is allowed.`, 400);

    const invalidUrls = urls.filter((url) => !isHttpUrl(url));
    if (invalidUrls.length) return error("One or more backlink URLs are invalid.", 422);

    // The existing page currently only counts URLs. Its ping/index buttons have
    // no handlers, so there are no external indexing results to execute here.
    return json({
      success: true,
      data: {
        urls,
        urlCount: urls.length,
        pinged: 0,
        googleApi: 0,
        results: [],
      },
    });
  } catch (caught) {
    return error(caught?.message || "Backlink indexer request failed.", caught?.status || 500);
  }
}
