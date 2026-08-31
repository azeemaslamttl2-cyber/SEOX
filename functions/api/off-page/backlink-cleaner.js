import { configureMysqlConnection, queryOne } from "../../_lib/mysql.js";
import { classifyIssues, computeStats, normalizeRows } from "../../../src/lib/backlinkCleaner.js";

const MAX_TOKEN_LENGTH = 512;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function error(message, status = 400) {
  return json({ success: false, error: message }, status);
}

function validateAdminToken(value) {
  const adminToken = typeof value === "string" ? value.trim() : "";
  if (!adminToken || adminToken.length > MAX_TOKEN_LENGTH) return null;
  return adminToken;
}

async function requireAdminToken(value, env) {
  const adminToken = validateAdminToken(value);
  if (!adminToken) return error("Invalid or missing admin token.", 401);

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

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return error("Method not allowed", 405);

  try {
    if (!(request.headers.get("content-type") || "").toLowerCase().includes("multipart/form-data")) {
      return error("multipart/form-data with file and admin_token is required.", 400);
    }

    const form = await request.formData();
    const tokenError = await requireAdminToken(form.get("admin_token"), env);
    if (tokenError) return tokenError;

    const file = form.get("file");
    if (!file || typeof file === "string") return error("A backlink CSV file is required.", 400);
    if (file.size > MAX_FILE_BYTES) return error("The backlink CSV file must be 10 MB or smaller.", 400);

    const rows = normalizeRows(await file.text());
    if (!rows.length) return error("No valid backlink rows were found in the CSV file.", 422);

    const analyzedRows = rows.map((row) => ({ ...row, issues: classifyIssues({ ...row, issues: "Unknown" }) }));
    return json({
      success: true,
      data: analyzedRows,
      stats: computeStats(analyzedRows),
      fileName: file.name || "backlinks.csv",
    });
  } catch (caught) {
    return error(caught?.message || "Backlink cleaner request failed.", caught?.status || 500);
  }
}
