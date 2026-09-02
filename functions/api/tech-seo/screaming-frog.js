import { analyzeScreamingFrog, buildScreamingFrogData, parseScreamingFrogCsv } from "../../../src/lib/screamingFrogAnalyzer.js";
import { configureMysqlConnection, queryOne } from "../../_lib/mysql.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOKEN_LENGTH = 512;
const MAX_URLS = 10000;

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function failure(message, status, details = []) {
  return json({
    status: "error",
    success: false,
    message,
    total_urls_submitted: 0,
    total_urls_processed: 0,
    processed_urls: [],
    analysis_results: {},
    errors: details,
  }, status);
}

function validToken(value) {
  const token = typeof value === "string" ? value.trim() : "";
  if (!token) throw Object.assign(new Error("admin_token is required"), { status: 400 });
  if (token.length > MAX_TOKEN_LENGTH) throw Object.assign(new Error("admin_token is too long"), { status: 400 });
  return token;
}

async function verifyToken(token, env) {
  const configuredToken = String(env?.ADMIN_TOKEN || "").trim();
  if (configuredToken) {
    if (token !== configuredToken) throw Object.assign(new Error("Invalid admin token"), { status: 401 });
    return;
  }
  configureMysqlConnection(env);
  const admin = await queryOne(
    `SELECT id FROM users WHERE admin_token = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1`,
    [token]
  );
  if (!admin) throw Object.assign(new Error("Invalid admin token"), { status: 401 });
}

async function readBody(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.toLowerCase().includes("multipart/form-data")) {
    const form = await request.formData();
    const input = form.get("urls_csv");
    if (input && typeof input !== "string") {
      if (input.size > MAX_FILE_BYTES) throw Object.assign(new Error("urls_csv must be 10 MB or smaller"), { status: 413 });
      return { adminToken: form.get("admin_token"), csv: await input.text() };
    }
    return { adminToken: form.get("admin_token"), csv: typeof input === "string" ? input : "" };
  }
  const body = await request.json().catch(() => null);
  return { adminToken: body?.admin_token, csv: body?.urls_csv };
}

function urlError(value) {
  try {
    const parsed = new URL(String(value).trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
    return null;
  } catch {
    return "URL must be an absolute http or https URL";
  }
}

function prepareInput(csv) {
  if (typeof csv !== "string" || !csv.trim()) throw Object.assign(new Error("urls_csv is required and must not be empty"), { status: 422 });
  const parsed = parseScreamingFrogCsv(csv);
  const submitted = parsed.urls.length;
  if (!submitted) throw Object.assign(new Error("No URLs were found in urls_csv"), { status: 422 });
  if (submitted > MAX_URLS) throw Object.assign(new Error(`urls_csv contains more than ${MAX_URLS} URLs`), { status: 413 });

  const errors = [];
  const validRows = parsed.rows.filter((row, index) => {
    const value = row.Address || row.URL || row["Source URL"] || "";
    const message = urlError(value);
    if (message) errors.push({ row: index + 2, value, message });
    return !message;
  });
  if (!validRows.length) throw Object.assign(new Error("No valid URLs were found in urls_csv"), {
    status: 422,
    details: errors,
    submitted,
  });

  return {
    data: { [Object.keys(buildScreamingFrogData(csv))[0]]: { ...parsed, rows: validRows, urls: validRows.map((row) => row.Address || row.URL || row["Source URL"]) } },
    submitted,
    validRows,
    errors,
  };
}

function perUrlResults(urls, analysis) {
  return urls.map((url) => {
    const findings = Object.entries(analysis)
      .filter(([, result]) => result.urls.includes(url))
      .map(([check, result]) => ({ check, count: result.urls.filter((candidate) => candidate === url).length }));
    return { url, success: true, findings };
  });
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return failure("Method not allowed", 405);

  try {
    const input = await readBody(request);
    const token = validToken(input.adminToken);
    await verifyToken(token, env);
    const prepared = prepareInput(input.csv);
    const analysis = analyzeScreamingFrog(prepared.data);
    const processedUrls = prepared.validRows.map((row) => row.Address || row.URL || row["Source URL"]);
    return json({
      status: "success",
      success: true,
      message: prepared.errors.length ? "Analysis completed with URL validation errors" : "Analysis completed successfully",
      total_urls_submitted: prepared.submitted,
      total_urls_processed: processedUrls.length,
      processed_urls: processedUrls,
      analysis_results: analysis,
      results_by_url: perUrlResults(processedUrls, analysis),
      errors: prepared.errors,
    });
  } catch (caught) {
    return json({
      status: "error",
      success: false,
      message: caught?.message || "Screaming Frog analysis failed",
      total_urls_submitted: caught?.submitted || 0,
      total_urls_processed: 0,
      processed_urls: [],
      analysis_results: {},
      errors: caught?.details || [],
    }, caught?.status || 500);
  }
}
