// Storage for WordPress security scans. Append-only, like the GBP audits, so a
// site's exposure can be tracked across scans.

import { query, queryOne, insert } from './mysql.js';

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export async function saveScan(entry) {
  const counts = entry.counts || {};
  const result = await insert(
    `INSERT INTO wp_security_scans
       (user_id, project_id, target_url, is_wordpress, detection_confidence, core_version,
        core_version_source, plugins_found, themes_found, critical_count, high_count,
        medium_count, low_count, info_count, fingerprint, vuln_db_status, vuln_db_remaining,
        warnings, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.userId,
      entry.projectId,
      String(entry.targetUrl).slice(0, 500),
      entry.isWordPress ? 1 : 0,
      entry.confidence || null,
      entry.coreVersion || null,
      entry.coreVersionSource || null,
      entry.pluginsFound || 0,
      entry.themesFound || 0,
      counts.critical || 0,
      counts.high || 0,
      counts.medium || 0,
      counts.low || 0,
      counts.info || 0,
      entry.fingerprint ? JSON.stringify(entry.fingerprint) : null,
      entry.vulnDbStatus || null,
      entry.vulnDbRemaining ?? null,
      entry.warnings ? JSON.stringify(entry.warnings) : null,
      entry.durationMs ?? null,
      now(),
    ]
  );

  const scanId = result.insertId;
  const findings = entry.findings || [];
  if (findings.length) {
    const values = [];
    const placeholders = findings
      .map((finding) => {
        values.push(
          scanId,
          entry.userId,
          finding.kind,
          finding.componentSlug ? String(finding.componentSlug).slice(0, 191) : null,
          finding.componentName ? String(finding.componentName).slice(0, 255) : null,
          finding.installedVersion || null,
          finding.fixedIn || null,
          finding.severity,
          finding.confirmed ? 1 : 0,
          String(finding.title).slice(0, 500),
          finding.detail || null,
          finding.cve ? String(finding.cve).slice(0, 120) : null,
          finding.cvssScore ?? null,
          finding.references ? JSON.stringify(finding.references) : null,
          finding.evidence ? String(finding.evidence).slice(0, 1000) : null
        );
        return '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
      })
      .join(', ');

    await insert(
      `INSERT INTO wp_security_findings
         (scan_id, user_id, kind, component_slug, component_name, installed_version, fixed_in,
          severity, confirmed, title, detail, cve, cvss_score, references_json, evidence)
       VALUES ${placeholders}`,
      values
    );
  }

  return scanId;
}

export async function getScan(userId, scanId) {
  const scan = await queryOne('SELECT * FROM wp_security_scans WHERE id = ? AND user_id = ? LIMIT 1', [
    scanId,
    userId,
  ]);
  if (!scan) return null;
  const findings = await query(
    `SELECT * FROM wp_security_findings WHERE scan_id = ? AND user_id = ?
     ORDER BY FIELD(severity, 'critical', 'high', 'medium', 'low', 'info'), id ASC`,
    [scanId, userId]
  );
  return { ...scan, findings };
}

export async function latestScan(userId, projectId) {
  const scan = await queryOne(
    'SELECT * FROM wp_security_scans WHERE user_id = ? AND project_id = ? ORDER BY created_at DESC LIMIT 1',
    [userId, projectId]
  );
  if (!scan) return null;
  const findings = await query(
    `SELECT * FROM wp_security_findings WHERE scan_id = ? AND user_id = ?
     ORDER BY FIELD(severity, 'critical', 'high', 'medium', 'low', 'info'), id ASC`,
    [scan.id, userId]
  );
  return { ...scan, findings };
}

export async function scanHistory(userId, projectId, limit = 20) {
  return query(
    `SELECT id, target_url, is_wordpress, core_version, critical_count, high_count,
            medium_count, low_count, info_count, created_at
     FROM wp_security_scans
     WHERE user_id = ? AND project_id = ?
     ORDER BY created_at DESC LIMIT ?`,
    [userId, projectId, Math.min(50, Number(limit) || 20)]
  );
}
