import { configureMysqlConnection, query, queryOne } from '../../../_lib/mysql.js';
import { corsHeaders, errorResponse, jsonResponse, readJson } from '../../../_lib/http.js';
import { requireUser } from '../../../_lib/auth-token.js';
import { createHash } from 'node:crypto';

const MAX_REPORTS = 100000;
const INSERT_BATCH_SIZE = 250;

function text(value, limit) {
  return String(value || '').trim().slice(0, limit);
}

function validateInput(body) {
  const projectId = text(body?.projectId, 255);
  const scanId = text(body?.scanId, 100);
  const reports = Array.isArray(body?.reports) ? body.reports : [];
  if (!projectId) throw Object.assign(new Error('projectId is required to save a Screaming Frog scan'), { status: 400 });
  if (!scanId) throw Object.assign(new Error('scanId is required'), { status: 400 });
  if (!reports.length) throw Object.assign(new Error('At least one URL report is required'), { status: 422 });
  if (reports.length > MAX_REPORTS) throw Object.assign(new Error(`A scan may contain at most ${MAX_REPORTS} URL reports`), { status: 413 });

  const unique = new Map();
  reports.forEach((report) => {
    const url = text(report?.url, 2048);
    if (!/^https?:\/\//i.test(url)) return;
    unique.set(url, {
      url,
      urlHash: createHash('sha256').update(url).digest('hex'),
      sourceFileIds: Array.isArray(report?.sourceFileIds) ? report.sourceFileIds.map((item) => text(item, 255)).filter(Boolean).slice(0, 100) : [],
      reportData: report?.reportData && typeof report.reportData === 'object' && !Array.isArray(report.reportData) ? report.reportData : {},
    });
  });
  if (!unique.size) throw Object.assign(new Error('No valid URL reports were supplied'), { status: 422 });
  return { projectId, scanId, reports: [...unique.values()] };
}

async function ensureTable() {
  await query(`CREATE TABLE IF NOT EXISTS screaming_frog_url_reports (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    scan_id VARCHAR(100) NOT NULL,
    url VARCHAR(2048) NOT NULL,
    url_hash CHAR(64) NOT NULL,
    source_file_ids JSON NULL,
    report_data JSON NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_sf_report_scan_url (user_id, project_id, scan_id, url_hash),
    KEY idx_sf_project_scan (project_id, scan_id),
    KEY idx_sf_user_scan (user_id, scan_id),
    KEY idx_sf_url (url(512))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);
}

async function saveReports(userId, input) {
  for (let start = 0; start < input.reports.length; start += INSERT_BATCH_SIZE) {
    const batch = input.reports.slice(start, start + INSERT_BATCH_SIZE);
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, NOW(), NOW())').join(', ');
    const params = batch.flatMap((report) => [
      input.projectId, userId, input.scanId, report.url, report.urlHash,
      JSON.stringify(report.sourceFileIds), JSON.stringify(report.reportData),
    ]);
    await query(`INSERT INTO screaming_frog_url_reports
      (project_id, user_id, scan_id, url, url_hash, source_file_ids, report_data, created_at, updated_at)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE source_file_ids = VALUES(source_file_ids), report_data = VALUES(report_data), updated_at = NOW()`, params);
  }
}

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders('POST, OPTIONS'), 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, headers);
  try {
    const user = await requireUser(request, env);
    const input = validateInput(await readJson(request));
    configureMysqlConnection(env);
    const project = await queryOne('SELECT project_id FROM user_projects WHERE user_id = ? AND project_id = ? LIMIT 1', [user.uid, input.projectId]);
    if (!project) throw Object.assign(new Error('Project was not found or you do not have access to it'), { status: 403 });
    await ensureTable();
    await saveReports(user.uid, input);
    return jsonResponse({ success: true, scanId: input.scanId, savedUrls: input.reports.length }, 200, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
