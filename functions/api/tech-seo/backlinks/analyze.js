import { analyzeBacklinks } from "../../../../src/lib/backlinksAnalyzer.js";
import { configureMysqlConnection, queryOne } from "../../../_lib/mysql.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOKEN_LENGTH = 512;
const ALLOWED_EXTENSIONS = new Set(["csv", "tsv", "txt"]);

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function error(message, status = 400) {
  return json({ success: false, error: message }, status);
}

function extensionOf(name) {
  return String(name || "").toLowerCase().split(".").pop();
}

function parseDirectBacklinks(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function validateAdminToken(value) {
  const adminToken = typeof value === "string" ? value.trim() : "";
  if (!adminToken) throw Object.assign(new Error("admin_token is required"), { status: 400 });
  if (adminToken.length > MAX_TOKEN_LENGTH) throw Object.assign(new Error("admin_token is too long"), { status: 400 });
  return adminToken;
}

async function readInput(request) {
  const contentType = request.headers.get("content-type") || "";
  const queryAdminToken = new URL(request.url).searchParams.get("admin_token");
  if (contentType.toLowerCase().includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    const fileName = file && typeof file !== "string" ? file.name || "backlinks.csv" : "";
    if (file && typeof file !== "string") {
      if (file.size > MAX_FILE_BYTES) throw Object.assign(new Error("The CSV/TSV file must be 10 MB or smaller."), { status: 400 });
      if (!ALLOWED_EXTENSIONS.has(extensionOf(fileName))) throw Object.assign(new Error("The file must use a .csv, .tsv, or .txt extension."), { status: 400 });
      return {
        text: await file.text(),
        fileName,
        adminToken: form.get("admin_token") || queryAdminToken,
        keywords: String(form.get("keywords") || ""),
        checks: parseChecks(form.get("checks")),
      };
    }
    return {
      backlinks: parseDirectBacklinks(form.get("backlinks")),
      fileName: "Direct backlink data",
      adminToken: form.get("admin_token") || queryAdminToken,
      keywords: String(form.get("keywords") || ""),
      checks: parseChecks(form.get("checks")),
    };
  }

  const body = await request.json().catch(() => null);
  return {
    text: typeof body?.csv === "string" ? body.csv : typeof body?.tsv === "string" ? body.tsv : undefined,
    backlinks: body?.backlinks,
    fileName: String(body?.fileName || "Direct backlink data"),
    adminToken: body?.admin_token || queryAdminToken,
    keywords: String(body?.keywords || ""),
    checks: body?.checks,
  };
}

function parseChecks(value) {
  if (!value) return undefined;
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return error("Method not allowed", 405);

  try {
    const input = await readInput(request);
    const adminToken = validateAdminToken(input.adminToken);
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
    if (!admin) return error("Invalid admin token", 401);

    const hasText = typeof input.text === "string";
    const hasRows = Array.isArray(input.backlinks);
    if (!hasText && !hasRows) return error("Provide a CSV/TSV file or a backlinks JSON array.", 400);
    if (hasText && !input.text.trim()) return error("The CSV/TSV file is empty.", 422);
    if (hasRows && input.backlinks.length === 0) return error("The backlinks array must contain at least one record.", 422);

    const result = analyzeBacklinks(input);
    if (!result.backlinks.length) return error("No valid backlink records were found. Include a Domain, Referring Domain, URL, or Source URL column.", 422);

    return json({
      success: true,
      data: {
        ...result,
        fileName: input.fileName || "Direct backlink data",
      },
    });
  } catch (caught) {
    const status = caught?.status || 500;
    return error(caught?.message || "Backlink analysis failed.", status);
  }
}
