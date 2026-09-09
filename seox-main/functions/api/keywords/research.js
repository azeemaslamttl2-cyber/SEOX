import proxyHandler from "../../_handlers/proxy.js";
import { configureMysqlConnection, queryOne } from "../../_lib/mysql.js";
import { DATAFORSEO_LOCATIONS } from "../../../src/lib/keywordTools.js";

const MAX_TOKEN_LENGTH = 512;

function json(payload, status = 200) {
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

function error(message, status = 400) {
  return json({ success: false, error: message }, status);
}

function findLocation(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return DATAFORSEO_LOCATIONS.find(
    (item) => String(item.code) === raw || item.country.toLowerCase() === raw.toLowerCase()
  ) || null;
}

function responseAdapter() {
  let statusCode = 200;
  let body = {};
  return {
    status(code) { statusCode = code; return this; },
    setHeader() { return this; },
    json(payload) { body = payload; return this; },
    end() { return this; },
    result() { return { statusCode, body }; },
  };
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return error("Method not allowed", 405);

  try {
    const body = await request.json().catch(() => null);
    const adminToken = typeof body?.admin_token === "string" ? body.admin_token.trim() : "";
    if (!adminToken) return error("Admin token is required.", 401);
    if (adminToken.length > MAX_TOKEN_LENGTH) return error("Invalid admin token.", 401);

    configureMysqlConnection(env);
    const admin = await queryOne(
      `SELECT id FROM users
       WHERE admin_token = ? AND is_active = 1 AND deleted_at IS NULL
       LIMIT 1`,
      [adminToken]
    );
    if (!admin) return error("Invalid admin token.", 401);

    const mode = String(body?.mode || (body?.domain ? "domain" : "seed")).trim().toLowerCase();
    if (mode !== "seed" && mode !== "domain") return error("Mode must be seed or domain.", 400);

    const query = String(
      mode === "domain"
        ? body?.domain ?? body?.seed_keywords ?? ""
        : body?.seed_keywords ?? body?.keyword ?? ""
    ).trim();
    if (!query) return error(mode === "domain" ? "Domain is required." : "Seed keywords are required.", 400);

    const location = findLocation(body?.country);
    if (!location) return error("Country is required or invalid.", 422);

    const language = String(body?.language || "").trim().toLowerCase();
    if (!language) return error("Language is required.", 400);
    if (!/^[a-z]{2,3}$/.test(language) || language !== location.language) {
      return error("Language is required or invalid for the selected country.", 422);
    }

    const response = responseAdapter();
    await proxyHandler(
      {
        method: "POST",
        headers: {},
        body: {
          service: "dataforseo",
          action: mode === "domain" ? "keywords_for_site" : "keyword_suggestions",
          ...(mode === "domain" ? { domain: query } : { keyword: query }),
          location_code: location.code,
          language_code: language,
        },
        env,
        internalAdminAuthorized: true,
      },
      response
    );
    const result = response.result();
    if (result.statusCode >= 400 || result.body?.error) {
      return json({ success: false, error: result.body?.message || result.body?.error || "Keyword research failed." }, result.statusCode);
    }
    return json({ success: true, data: result.body });
  } catch (caught) {
    return error(caught?.message || "Keyword research failed.", caught?.status || 500);
  }
}