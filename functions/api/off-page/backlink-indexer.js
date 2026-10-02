import { configureMysqlConnection, query, queryOne, insert } from "../../_lib/mysql.js";
import { getAdminSetting } from "../../_lib/app-settings.js";
import {
  NOTIFICATION_TYPES,
  getIndexingAccessToken,
  parseServiceAccount,
  prepareUrls,
  publishUrl,
} from "../../_lib/google-indexing.js";

const MAX_TOKEN_LENGTH = 512;
const MAX_URLS_PER_REQUEST = 20;
const MAX_VALIDATE_URLS = 10000;
const RECENT_SUCCESS_HOURS = 24;
const HISTORY_PAGE_SIZE = 50;

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function error(message, status = 400, extra = {}) {
  return json({ success: false, error: message, ...extra }, status);
}

async function authenticate(value, env) {
  const adminToken = typeof value === "string" ? value.trim() : "";
  if (!adminToken || adminToken.length > MAX_TOKEN_LENGTH) return null;

  configureMysqlConnection(env);
  return queryOne(
    `SELECT id
     FROM users
     WHERE admin_token = ?
       AND is_active = 1
       AND deleted_at IS NULL
     LIMIT 1`,
    [adminToken]
  );
}

let tableReady = null;
function ensureTable() {
  if (!tableReady) {
    tableReady = query(`CREATE TABLE IF NOT EXISTS indexing_submissions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id VARCHAR(128) NOT NULL,
      project_id VARCHAR(255) NULL,
      url VARCHAR(2048) NOT NULL,
      host VARCHAR(255) NOT NULL,
      notification_type VARCHAR(16) NOT NULL DEFAULT 'URL_UPDATED',
      status VARCHAR(16) NOT NULL,
      error_code VARCHAR(32) NULL,
      message TEXT NULL,
      http_status SMALLINT NULL,
      google_response JSON NULL,
      submitted_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      KEY idx_indexing_user_time (user_id, submitted_at),
      KEY idx_indexing_user_url (user_id, url(255), status, submitted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`).catch((caught) => {
      tableReady = null;
      throw caught;
    });
  }
  return tableReady;
}

const sqlTime = (date = new Date()) => date.toISOString().slice(0, 19).replace("T", " ");

async function recordSubmission(userId, entry) {
  await insert(
    `INSERT INTO indexing_submissions
       (user_id, project_id, url, host, notification_type, status, error_code, message, http_status, google_response, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(userId),
      entry.projectId || null,
      entry.url,
      entry.host,
      entry.type,
      entry.status,
      entry.code || null,
      entry.message ? String(entry.message).slice(0, 4000) : null,
      entry.httpStatus || null,
      entry.response ? JSON.stringify(entry.response) : null,
      sqlTime(new Date(entry.submittedAt)),
    ]
  );
}

async function handleStatus(env) {
  try {
    const account = parseServiceAccount(await getAdminSetting("google_indexing_service_account", env));
    return json({ success: true, data: { configured: true, clientEmail: account.client_email } });
  } catch (caught) {
    return json({ success: true, data: { configured: false, code: caught.code || "NOT_CONFIGURED", message: caught.message } });
  }
}

async function handleValidate(body) {
  const raw = body?.urls ?? body?.backlink_urls;
  const total = Array.isArray(raw) ? raw.length : String(raw ?? "").split(/\r?\n/).length;
  if (total > MAX_VALIDATE_URLS) return error(`A maximum of ${MAX_VALIDATE_URLS} URLs is allowed.`, 400);
  const { valid, invalid, duplicates } = prepareUrls(raw);
  return json({ success: true, data: { valid, invalid, duplicates } });
}

async function handleSubmit(body, userId, env) {
  const raw = body?.urls ?? body?.backlink_urls;
  const { valid, invalid, duplicates } = prepareUrls(raw);
  if (!valid.length && !invalid.length) return error("No backlink URLs were provided.", 400);
  if (valid.length > MAX_URLS_PER_REQUEST) {
    return error(`Send at most ${MAX_URLS_PER_REQUEST} URLs per request; the page batches larger lists automatically.`, 400);
  }
  const type = NOTIFICATION_TYPES.includes(body?.type) ? body.type : "URL_UPDATED";
  const force = body?.force === true;
  const projectId = typeof body?.project_id === "string" ? body.project_id.trim().slice(0, 255) : "";

  const results = [];
  if (valid.length) {
    // Fails the whole request with a clear message when the service account is
    // missing or Google rejects it - nothing is recorded as submitted.
    let access;
    try {
      access = await getIndexingAccessToken(env);
    } catch (caught) {
      return error(caught.message || "Could not authenticate with Google.", caught.status || 502, { code: caught.code || "AUTH_FAILED" });
    }

    await ensureTable();
    let halt = null;
    for (const item of valid) {
      const submittedAt = new Date().toISOString();
      const base = { url: item.url, host: item.host, type, submittedAt, projectId };

      if (halt) {
        results.push({ ...base, status: "failed", code: halt.code, message: halt.message });
        continue;
      }

      if (!force) {
        const recent = await queryOne(
          `SELECT submitted_at FROM indexing_submissions
            WHERE user_id = ? AND url = ? AND notification_type = ? AND status = 'submitted'
              AND submitted_at > (UTC_TIMESTAMP() - INTERVAL ${RECENT_SUCCESS_HOURS} HOUR)
            ORDER BY submitted_at DESC LIMIT 1`,
          [String(userId), item.url, type]
        );
        if (recent) {
          results.push({
            ...base,
            status: "already_submitted",
            code: "ALREADY_SUBMITTED",
            message: `Already submitted to Google in the last ${RECENT_SUCCESS_HOURS} hours. Tick "Resubmit anyway" to send it again.`,
          });
          continue;
        }
      }

      const outcome = await publishUrl({ url: item.url, type, token: access.token, clientEmail: access.clientEmail });
      const entry = {
        ...base,
        status: outcome.ok ? "submitted" : "failed",
        code: outcome.code,
        message: outcome.message,
        httpStatus: outcome.httpStatus || null,
        notifyTime: outcome.notifyTime || null,
        response: outcome.response || null,
      };
      if (outcome.stopBatch) halt = { code: outcome.code, message: outcome.message };
      try {
        await recordSubmission(userId, entry);
      } catch (caught) {
        console.error("indexing_submissions insert failed:", caught?.message);
      }
      results.push(entry);
    }
  }

  const summary = {
    total: valid.length + invalid.length + duplicates.length,
    submitted: results.filter((r) => r.status === "submitted").length,
    failed: results.filter((r) => r.status === "failed").length,
    alreadySubmitted: results.filter((r) => r.status === "already_submitted").length,
    invalid: invalid.length,
    duplicates: duplicates.length,
  };
  return json({ success: true, data: { results, invalid, duplicates, summary } });
}

async function handleHistory(body, userId) {
  await ensureTable();
  const limit = Math.min(Math.max(Number(body?.limit) || HISTORY_PAGE_SIZE, 1), 200);
  const offset = Math.max(Number(body?.offset) || 0, 0);
  const rows = await query(
    `SELECT id, url, host, notification_type, status, error_code, message, http_status,
            DATE_FORMAT(submitted_at, '%Y-%m-%dT%H:%i:%sZ') AS submitted_at
       FROM indexing_submissions
      WHERE user_id = ?
      ORDER BY submitted_at DESC, id DESC
      LIMIT ${limit} OFFSET ${offset}`,
    [String(userId)]
  );
  return json({
    success: true,
    data: {
      items: rows.map((row) => ({
        id: Number(row.id),
        url: row.url,
        host: row.host,
        type: row.notification_type,
        status: row.status,
        code: row.error_code,
        message: row.message,
        httpStatus: row.http_status,
        submittedAt: row.submitted_at, // stored as UTC; DATE_FORMAT keeps the driver from shifting it
      })),
      limit,
      offset,
    },
  });
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return error("Method not allowed", 405);

  try {
    const body = await request.json().catch(() => null);
    const admin = await authenticate(body?.admin_token, env);
    if (!admin) return error("Invalid or missing admin token.", 401);

    const action = typeof body?.action === "string" ? body.action : "submit";
    if (action === "status") return await handleStatus(env);
    if (action === "validate") return await handleValidate(body);
    if (action === "history") return await handleHistory(body, admin.id);
    if (action === "submit") return await handleSubmit(body, admin.id, env);
    return error(`Unknown action: ${action}`, 400);
  } catch (caught) {
    return error(caught?.message || "Backlink indexer request failed.", caught?.status || 500);
  }
}
