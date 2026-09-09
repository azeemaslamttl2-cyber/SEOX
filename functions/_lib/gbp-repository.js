// Direct SQL access for the GBP tables.
//
// The generic document store in mysql-repository.js maps one collection path to
// one table with hand-written serialise/deserialise branches. GBP data is
// relational (a connection owns many locations, a location owns many metric
// rows), so it gets its own repository instead of ~60 more branches there.
//
// Every read and write is scoped by user_id. Callers pass the uid resolved from
// the session; no function here trusts a client-supplied owner.

import { configureMysqlConnection, query, queryOne, insert, update, deleteQuery } from './mysql.js';

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function toMysqlDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function useDatabase(env) {
  configureMysqlConnection(env);
}

const CONNECTION_COLUMNS = `id, user_id, project_id, google_user_id, google_email, account_id,
  account_name, account_type, access_token_encrypted, refresh_token_encrypted, token_expiry,
  scope, status, status_detail, authorized_by_email, connected_at, updated_at`;

// --- Connections -----------------------------------------------------------

export async function getConnection(userId, projectId) {
  return queryOne(
    `SELECT ${CONNECTION_COLUMNS} FROM gbp_connections WHERE user_id = ? AND project_id = ? LIMIT 1`,
    [userId, projectId]
  );
}

export async function getConnectionById(userId, connectionId) {
  return queryOne(
    `SELECT ${CONNECTION_COLUMNS} FROM gbp_connections WHERE id = ? AND user_id = ? LIMIT 1`,
    [connectionId, userId]
  );
}

export async function upsertConnection(fields) {
  const timestamp = now();
  const existing = await getConnection(fields.userId, fields.projectId);

  if (existing) {
    await update(
      `UPDATE gbp_connections SET
         google_user_id = ?, google_email = ?, access_token_encrypted = ?,
         refresh_token_encrypted = COALESCE(?, refresh_token_encrypted),
         token_expiry = ?, scope = ?, status = 'connected', status_detail = NULL,
         authorized_by_email = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [
        fields.googleUserId || existing.google_user_id || null,
        fields.googleEmail || existing.google_email || null,
        fields.accessTokenEncrypted,
        fields.refreshTokenEncrypted || null,
        toMysqlDate(fields.tokenExpiry),
        fields.scope || null,
        fields.authorizedByEmail || existing.authorized_by_email || null,
        timestamp,
        existing.id,
        fields.userId,
      ]
    );
    return getConnectionById(fields.userId, existing.id);
  }

  const result = await insert(
    `INSERT INTO gbp_connections
       (user_id, project_id, google_user_id, google_email, access_token_encrypted,
        refresh_token_encrypted, token_expiry, scope, status, authorized_by_email,
        connected_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'connected', ?, ?, ?)`,
    [
      fields.userId,
      fields.projectId,
      fields.googleUserId || null,
      fields.googleEmail || null,
      fields.accessTokenEncrypted,
      fields.refreshTokenEncrypted || null,
      toMysqlDate(fields.tokenExpiry),
      fields.scope || null,
      fields.authorizedByEmail || null,
      timestamp,
      timestamp,
    ]
  );
  return getConnectionById(fields.userId, result.insertId);
}

export async function updateConnectionTokens(userId, connectionId, fields) {
  await update(
    `UPDATE gbp_connections SET
       access_token_encrypted = ?,
       refresh_token_encrypted = COALESCE(?, refresh_token_encrypted),
       token_expiry = ?, status = 'connected', status_detail = NULL, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [
      fields.accessTokenEncrypted,
      fields.refreshTokenEncrypted || null,
      toMysqlDate(fields.tokenExpiry),
      now(),
      connectionId,
      userId,
    ]
  );
}

export async function setConnectionAccount(userId, connectionId, account) {
  await update(
    `UPDATE gbp_connections SET account_id = ?, account_name = ?, account_type = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [
      account?.accountId || null,
      account?.accountName || null,
      account?.accountType || null,
      now(),
      connectionId,
      userId,
    ]
  );
}

export async function markConnectionStatus(userId, connectionId, status, detail) {
  await update(
    `UPDATE gbp_connections SET status = ?, status_detail = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
    [status, detail ? String(detail).slice(0, 500) : null, now(), connectionId, userId]
  );
}

export async function deleteConnection(userId, projectId) {
  const connection = await getConnection(userId, projectId);
  if (!connection) return false;

  const owned = await query('SELECT id FROM gbp_locations WHERE user_id = ? AND connection_id = ?', [
    userId,
    connection.id,
  ]);
  for (const row of owned) {
    await deleteQuery('DELETE FROM gbp_daily_metrics WHERE user_id = ? AND location_row_id = ?', [
      userId,
      row.id,
    ]);
  }
  await deleteQuery('DELETE FROM gbp_locations WHERE user_id = ? AND connection_id = ?', [
    userId,
    connection.id,
  ]);
  await deleteQuery('DELETE FROM gbp_connections WHERE id = ? AND user_id = ?', [
    connection.id,
    userId,
  ]);
  return true;
}

// --- Locations -------------------------------------------------------------

export async function listLocations(userId, projectId) {
  return query(
    `SELECT * FROM gbp_locations WHERE user_id = ? AND project_id = ?
     ORDER BY is_primary DESC, business_name ASC`,
    [userId, projectId]
  );
}

export async function getLocationRow(userId, locationRowId) {
  return queryOne('SELECT * FROM gbp_locations WHERE id = ? AND user_id = ? LIMIT 1', [
    locationRowId,
    userId,
  ]);
}

export async function getPrimaryLocation(userId, projectId) {
  return queryOne(
    `SELECT * FROM gbp_locations WHERE user_id = ? AND project_id = ?
     ORDER BY is_primary DESC, business_name ASC LIMIT 1`,
    [userId, projectId]
  );
}

export async function countLocations(userId, projectId) {
  const row = await queryOne(
    'SELECT COUNT(*) AS total FROM gbp_locations WHERE user_id = ? AND project_id = ?',
    [userId, projectId]
  );
  return Number(row?.total || 0);
}

export async function attachLocation(userId, projectId, connectionId, location, options = {}) {
  const isPrimary = Boolean(options.isPrimary);
  const timestamp = now();
  const existing = await queryOne(
    'SELECT id FROM gbp_locations WHERE user_id = ? AND project_id = ? AND location_id = ? LIMIT 1',
    [userId, projectId, location.locationId]
  );

  const shared = [
    connectionId,
    location.accountId,
    location.placeId || null,
    location.businessName || location.locationId,
    location.storeCode || null,
    location.primaryCategory || null,
    location.formattedAddress || null,
    location.phone || null,
    location.websiteUrl || null,
    location.mapsUri || null,
    location.verificationStatus || 'UNKNOWN',
    location.openStatus || null,
    location.hasGoogleUpdates ? 1 : 0,
    location.raw ? JSON.stringify(location.raw) : null,
    timestamp,
  ];

  if (existing) {
    await update(
      `UPDATE gbp_locations SET
         connection_id = ?, account_id = ?, place_id = ?, business_name = ?, store_code = ?,
         primary_category = ?, formatted_address = ?, phone = ?, website_url = ?, maps_uri = ?,
         verification_status = ?, open_status = ?, has_google_updates = ?, raw_profile = ?,
         last_sync_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [...shared, timestamp, existing.id, userId]
    );
    if (isPrimary) await setPrimaryLocation(userId, projectId, existing.id);
    return getLocationRow(userId, existing.id);
  }

  const result = await insert(
    `INSERT INTO gbp_locations
       (user_id, project_id, connection_id, account_id, place_id, business_name, store_code,
        primary_category, formatted_address, phone, website_url, maps_uri, verification_status,
        open_status, has_google_updates, raw_profile, last_sync_at, location_id, is_primary,
        attached_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      projectId,
      ...shared,
      location.locationId,
      isPrimary ? 1 : 0,
      timestamp,
      timestamp,
    ]
  );

  // The first location attached to a project becomes the dashboard default.
  const total = await countLocations(userId, projectId);
  if (isPrimary || total === 1) await setPrimaryLocation(userId, projectId, result.insertId);
  return getLocationRow(userId, result.insertId);
}

export async function setPrimaryLocation(userId, projectId, locationRowId) {
  await update('UPDATE gbp_locations SET is_primary = 0 WHERE user_id = ? AND project_id = ?', [
    userId,
    projectId,
  ]);
  await update(
    'UPDATE gbp_locations SET is_primary = 1, updated_at = ? WHERE id = ? AND user_id = ? AND project_id = ?',
    [now(), locationRowId, userId, projectId]
  );
}

export async function detachLocation(userId, locationRowId) {
  const location = await getLocationRow(userId, locationRowId);
  if (!location) return false;

  await deleteQuery('DELETE FROM gbp_daily_metrics WHERE user_id = ? AND location_row_id = ?', [
    userId,
    locationRowId,
  ]);
  await deleteQuery('DELETE FROM gbp_locations WHERE id = ? AND user_id = ?', [
    locationRowId,
    userId,
  ]);

  if (location.is_primary) {
    const next = await queryOne(
      'SELECT id FROM gbp_locations WHERE user_id = ? AND project_id = ? ORDER BY business_name ASC LIMIT 1',
      [userId, location.project_id]
    );
    if (next) await setPrimaryLocation(userId, location.project_id, next.id);
  }
  return true;
}

export async function updateLocationSummary(userId, locationRowId, summary) {
  const columns = {
    average_rating: summary.averageRating,
    total_reviews: summary.totalReviews,
    unanswered_reviews: summary.unansweredReviews,
    posts_last_30_days: summary.postsLast30Days,
    profile_completeness: summary.profileCompleteness,
    health_score: summary.healthScore,
    verification_status: summary.verificationStatus,
    open_status: summary.openStatus,
    has_google_updates:
      summary.hasGoogleUpdates === undefined ? undefined : summary.hasGoogleUpdates ? 1 : 0,
  };

  const assignments = [];
  const params = [];
  for (const [column, value] of Object.entries(columns)) {
    if (value === undefined) continue;
    assignments.push(`${column} = ?`);
    params.push(value);
  }
  if (summary.lastPostAt !== undefined) {
    assignments.push('last_post_at = ?');
    params.push(toMysqlDate(summary.lastPostAt));
  }
  if (!assignments.length) return;

  const timestamp = now();
  assignments.push('last_sync_at = ?', 'updated_at = ?');
  params.push(timestamp, timestamp, locationRowId, userId);
  await update(
    `UPDATE gbp_locations SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`,
    params
  );
}

// --- Daily metrics ---------------------------------------------------------

export async function replaceDailyMetrics(userId, locationRowId, rows) {
  if (!rows.length) return 0;
  const timestamp = now();
  const values = [];
  const placeholders = rows
    .map((row) => {
      values.push(userId, locationRowId, row.date, row.metric, Number(row.value) || 0, timestamp);
      return '(?, ?, ?, ?, ?, ?)';
    })
    .join(', ');

  await insert(
    `INSERT INTO gbp_daily_metrics (user_id, location_row_id, metric_date, metric, value, updated_at)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)`,
    values
  );
  return rows.length;
}

export async function sumMetrics(userId, locationRowId, fromDate, toDate) {
  const rows = await query(
    `SELECT metric, SUM(value) AS total FROM gbp_daily_metrics
     WHERE user_id = ? AND location_row_id = ? AND metric_date BETWEEN ? AND ?
     GROUP BY metric`,
    [userId, locationRowId, fromDate, toDate]
  );
  return Object.fromEntries(rows.map((row) => [row.metric, Number(row.total || 0)]));
}

export async function dailySeries(userId, locationRowId, fromDate, toDate) {
  return query(
    `SELECT metric_date, metric, value FROM gbp_daily_metrics
     WHERE user_id = ? AND location_row_id = ? AND metric_date BETWEEN ? AND ?
     ORDER BY metric_date ASC`,
    [userId, locationRowId, fromDate, toDate]
  );
}

export async function metricsFreshness(userId, locationRowId) {
  return queryOne(
    'SELECT MAX(metric_date) AS latest FROM gbp_daily_metrics WHERE user_id = ? AND location_row_id = ?',
    [userId, locationRowId]
  );
}

// --- Observability ---------------------------------------------------------

export async function recordApiUsage(entry) {
  try {
    await insert(
      `INSERT INTO gbp_api_usage
         (user_id, project_id, api, endpoint, status_code, error_code, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId || null,
        entry.projectId || null,
        entry.api,
        String(entry.endpoint || '').slice(0, 255),
        entry.statusCode || null,
        entry.errorCode ? String(entry.errorCode).slice(0, 64) : null,
        entry.durationMs || null,
        now(),
      ]
    );
  } catch (error) {
    // Usage logging must never break the request it is measuring.
    console.error('GBP usage log failed:', error?.message || error);
  }
}

export async function usageSummary(userId, sinceHours = 24) {
  return query(
    `SELECT api, COUNT(*) AS calls, SUM(status_code >= 400) AS errors
     FROM gbp_api_usage
     WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR) AND user_id = ?
     GROUP BY api`,
    [sinceHours, userId]
  );
}

export async function logSync(entry) {
  try {
    await insert(
      `INSERT INTO gbp_sync_logs
         (user_id, project_id, location_row_id, sync_type, status, message, items_synced, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId,
        entry.projectId || null,
        entry.locationRowId || null,
        entry.syncType,
        entry.status,
        entry.message ? String(entry.message).slice(0, 1000) : null,
        entry.itemsSynced ?? null,
        entry.durationMs ?? null,
        now(),
      ]
    );
  } catch (error) {
    console.error('GBP sync log failed:', error?.message || error);
  }
}

export async function lastSync(userId, projectId) {
  return queryOne(
    `SELECT sync_type, status, message, created_at FROM gbp_sync_logs
     WHERE user_id = ? AND project_id = ? ORDER BY created_at DESC LIMIT 1`,
    [userId, projectId]
  );
}

// --- Posting circuit breaker ----------------------------------------------

export async function updatePostingState(userId, locationRowId, state) {
  const assignments = ['posting_failures = ?', 'posting_blocked_until = ?', 'posting_block_reason = ?'];
  const params = [
    state.postingFailures ?? 0,
    toMysqlDate(state.postingBlockedUntil),
    state.postingBlockReason || null,
  ];
  if (state.incrementSuccess) assignments.push('successful_posts = successful_posts + 1');

  assignments.push('updated_at = ?');
  params.push(now(), locationRowId, userId);
  await update(
    `UPDATE gbp_locations SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`,
    params
  );
}

export async function clearPostingBlock(userId, locationRowId) {
  await update(
    `UPDATE gbp_locations SET posting_failures = 0, posting_blocked_until = NULL,
       posting_block_reason = NULL, updated_at = ? WHERE id = ? AND user_id = ?`,
    [now(), locationRowId, userId]
  );
}

// Used by the job runner, which resolves the owner from the job row rather than
// from a session.
export async function getLocationById(locationRowId) {
  return queryOne('SELECT * FROM gbp_locations WHERE id = ? LIMIT 1', [locationRowId]);
}

export async function getConnectionForLocation(location) {
  return queryOne('SELECT * FROM gbp_connections WHERE id = ? AND user_id = ? LIMIT 1', [
    location.connection_id,
    location.user_id,
  ]);
}

// --- Review reply authorisation -------------------------------------------

export async function setReplyAuthorization(userId, locationRowId, fields) {
  await update(
    `UPDATE gbp_locations SET reply_authorized = ?, reply_authorized_by = ?,
       reply_authorized_at = ?, reply_authorization_note = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [
      fields.authorized ? 1 : 0,
      fields.authorized ? fields.authorizedBy || null : null,
      fields.authorized ? now() : null,
      fields.note ? String(fields.note).slice(0, 1000) : null,
      now(),
      locationRowId,
      userId,
    ]
  );
}

export async function setAutoReplySettings(userId, locationRowId, fields) {
  // The star floor never drops below 4 regardless of what the caller asks for;
  // low-star replies are a human decision.
  const floor = Math.min(5, Math.max(4, Number(fields.minStars) || 5));
  await update(
    `UPDATE gbp_locations SET auto_reply_enabled = ?, auto_reply_min_stars = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [fields.enabled ? 1 : 0, floor, now(), locationRowId, userId]
  );
}
