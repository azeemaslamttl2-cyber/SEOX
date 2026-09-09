// Storage for the GBP content tables: profile snapshots, audits, posts,
// templates, automation rules and the job queue.
//
// gbp-repository.js owns connections, locations and metrics. This file owns
// everything built on top of them. Both scope every statement by user_id.

import { query, queryOne, insert, update, deleteQuery } from './mysql.js';

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function toMysqlDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function parseJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// --- Profile snapshots -----------------------------------------------------

export async function saveSnapshot(entry) {
  const result = await insert(
    `INSERT INTO gbp_profile_snapshots
       (user_id, project_id, location_row_id, source, profile, attributes, changed_fields, changed_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.userId,
      entry.projectId,
      entry.locationRowId,
      entry.source,
      entry.profile ? JSON.stringify(entry.profile) : null,
      entry.attributes ? JSON.stringify(entry.attributes) : null,
      entry.changedFields ? JSON.stringify(entry.changedFields) : null,
      entry.changedBy || null,
      now(),
    ]
  );
  return result.insertId;
}

export async function listSnapshots(userId, locationRowId, limit = 20) {
  return query(
    `SELECT id, source, changed_fields, changed_by, created_at
     FROM gbp_profile_snapshots
     WHERE user_id = ? AND location_row_id = ?
     ORDER BY created_at DESC LIMIT ?`,
    [userId, locationRowId, limit]
  );
}

export async function getSnapshot(userId, snapshotId) {
  return queryOne('SELECT * FROM gbp_profile_snapshots WHERE id = ? AND user_id = ? LIMIT 1', [
    snapshotId,
    userId,
  ]);
}

// --- Audits ----------------------------------------------------------------

export async function saveAudit(entry) {
  const counts = entry.counts || {};
  const result = await insert(
    `INSERT INTO gbp_audits
       (user_id, project_id, location_row_id, score, max_score, breakdown, signals,
        critical_count, high_count, medium_count, low_count, opportunity_count,
        skipped_checks, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.userId,
      entry.projectId,
      entry.locationRowId,
      entry.score,
      entry.maxScore || 100,
      entry.breakdown ? JSON.stringify(entry.breakdown) : null,
      entry.signals ? JSON.stringify(entry.signals) : null,
      counts.critical || 0,
      counts.high || 0,
      counts.medium || 0,
      counts.low || 0,
      counts.opportunity || 0,
      entry.skippedChecks ? JSON.stringify(entry.skippedChecks) : null,
      now(),
    ]
  );

  const auditId = result.insertId;
  const issues = entry.issues || [];
  if (issues.length) {
    const values = [];
    const placeholders = issues
      .map((issue) => {
        values.push(
          auditId,
          entry.userId,
          issue.key,
          issue.category,
          issue.severity,
          issue.passed ? 1 : 0,
          issue.title,
          issue.detail ? String(issue.detail).slice(0, 1000) : null,
          issue.actionLabel || null,
          issue.actionTarget || null,
          issue.pointsEarned || 0,
          issue.pointsPossible || 0
        );
        return '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
      })
      .join(', ');

    await insert(
      `INSERT INTO gbp_audit_issues
         (audit_id, user_id, check_key, category, severity, passed, title, detail,
          action_label, action_target, points_earned, points_possible)
       VALUES ${placeholders}`,
      values
    );
  }
  return auditId;
}

export async function getAudit(userId, auditId) {
  const audit = await queryOne('SELECT * FROM gbp_audits WHERE id = ? AND user_id = ? LIMIT 1', [
    auditId,
    userId,
  ]);
  if (!audit) return null;
  const issues = await query(
    'SELECT * FROM gbp_audit_issues WHERE audit_id = ? AND user_id = ? ORDER BY id ASC',
    [auditId, userId]
  );
  return { ...audit, issues };
}

export async function latestAudit(userId, locationRowId) {
  const audit = await queryOne(
    'SELECT * FROM gbp_audits WHERE user_id = ? AND location_row_id = ? ORDER BY created_at DESC LIMIT 1',
    [userId, locationRowId]
  );
  if (!audit) return null;
  const issues = await query(
    'SELECT * FROM gbp_audit_issues WHERE audit_id = ? AND user_id = ? ORDER BY id ASC',
    [audit.id, userId]
  );
  return { ...audit, issues };
}

export async function auditHistory(userId, locationRowId, limit = 30) {
  return query(
    `SELECT id, score, critical_count, high_count, medium_count, low_count,
            opportunity_count, signals, created_at
     FROM gbp_audits
     WHERE user_id = ? AND location_row_id = ?
     ORDER BY created_at DESC LIMIT ?`,
    [userId, locationRowId, limit]
  );
}

// --- Posts -----------------------------------------------------------------

const POST_COLUMNS = `id, user_id, project_id, location_row_id, google_post_name, topic_type,
  summary, cta_type, cta_url, media_url, event_title, event_start, event_end, offer_coupon,
  offer_terms, offer_redeem_url, status, scheduled_at, published_at, last_error, attempts,
  origin, source_url, template_id, created_at, updated_at`;

export async function createPost(entry) {
  const timestamp = now();
  const result = await insert(
    `INSERT INTO gbp_posts
       (user_id, project_id, location_row_id, topic_type, summary, cta_type, cta_url, media_url,
        event_title, event_start, event_end, offer_coupon, offer_terms, offer_redeem_url,
        status, scheduled_at, origin, source_url, template_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.userId,
      entry.projectId,
      entry.locationRowId,
      entry.topicType || 'STANDARD',
      entry.summary,
      entry.ctaType || null,
      entry.ctaUrl || null,
      entry.mediaUrl || null,
      entry.eventTitle || null,
      toMysqlDate(entry.eventStart),
      toMysqlDate(entry.eventEnd),
      entry.offerCoupon || null,
      entry.offerTerms || null,
      entry.offerRedeemUrl || null,
      entry.status || 'draft',
      toMysqlDate(entry.scheduledAt),
      entry.origin || 'manual',
      entry.sourceUrl || null,
      entry.templateId || null,
      timestamp,
      timestamp,
    ]
  );
  return getPost(entry.userId, result.insertId);
}

export async function getPost(userId, postId) {
  return queryOne(`SELECT ${POST_COLUMNS} FROM gbp_posts WHERE id = ? AND user_id = ? LIMIT 1`, [
    postId,
    userId,
  ]);
}

export async function listPosts(userId, projectId, filters = {}) {
  const clauses = ['user_id = ?', 'project_id = ?'];
  const params = [userId, projectId];

  if (filters.locationRowId) {
    clauses.push('location_row_id = ?');
    params.push(filters.locationRowId);
  }
  if (filters.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }
  params.push(Math.min(200, Number(filters.limit) || 100));

  return query(
    `SELECT ${POST_COLUMNS} FROM gbp_posts WHERE ${clauses.join(' AND ')}
     ORDER BY COALESCE(scheduled_at, created_at) DESC LIMIT ?`,
    params
  );
}

const EDITABLE_POST_FIELDS = {
  topicType: 'topic_type',
  summary: 'summary',
  ctaType: 'cta_type',
  ctaUrl: 'cta_url',
  mediaUrl: 'media_url',
  eventTitle: 'event_title',
  offerCoupon: 'offer_coupon',
  offerTerms: 'offer_terms',
  offerRedeemUrl: 'offer_redeem_url',
  status: 'status',
  googlePostName: 'google_post_name',
  lastError: 'last_error',
  origin: 'origin',
  sourceUrl: 'source_url',
};

const DATE_POST_FIELDS = {
  eventStart: 'event_start',
  eventEnd: 'event_end',
  scheduledAt: 'scheduled_at',
  publishedAt: 'published_at',
};

export async function updatePost(userId, postId, fields) {
  const assignments = [];
  const params = [];

  for (const [key, column] of Object.entries(EDITABLE_POST_FIELDS)) {
    if (fields[key] === undefined) continue;
    assignments.push(`${column} = ?`);
    params.push(fields[key]);
  }
  for (const [key, column] of Object.entries(DATE_POST_FIELDS)) {
    if (fields[key] === undefined) continue;
    assignments.push(`${column} = ?`);
    params.push(toMysqlDate(fields[key]));
  }
  if (fields.incrementAttempts) assignments.push('attempts = attempts + 1');
  if (!assignments.length) return getPost(userId, postId);

  assignments.push('updated_at = ?');
  params.push(now(), postId, userId);
  await update(`UPDATE gbp_posts SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`, params);
  return getPost(userId, postId);
}

export async function deletePost(userId, postId) {
  const result = await deleteQuery('DELETE FROM gbp_posts WHERE id = ? AND user_id = ?', [
    postId,
    userId,
  ]);
  return Number(result?.affectedRows || 0) > 0;
}

export async function duePosts(limit = 25) {
  return query(
    `SELECT ${POST_COLUMNS} FROM gbp_posts
     WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= UTC_TIMESTAMP()
     ORDER BY scheduled_at ASC LIMIT ?`,
    [limit]
  );
}

// --- Templates -------------------------------------------------------------

export async function listTemplates(userId, projectId) {
  return query(
    'SELECT * FROM gbp_post_templates WHERE user_id = ? AND project_id = ? ORDER BY name ASC',
    [userId, projectId]
  );
}

export async function saveTemplate(entry) {
  const timestamp = now();
  if (entry.id) {
    await update(
      `UPDATE gbp_post_templates SET name = ?, topic_type = ?, summary = ?, cta_type = ?,
         cta_url = ?, media_url = ?, utm_source = ?, utm_medium = ?, utm_campaign = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [
        entry.name,
        entry.topicType || 'STANDARD',
        entry.summary || null,
        entry.ctaType || null,
        entry.ctaUrl || null,
        entry.mediaUrl || null,
        entry.utmSource || null,
        entry.utmMedium || null,
        entry.utmCampaign || null,
        timestamp,
        entry.id,
        entry.userId,
      ]
    );
    return queryOne('SELECT * FROM gbp_post_templates WHERE id = ? AND user_id = ?', [
      entry.id,
      entry.userId,
    ]);
  }

  const result = await insert(
    `INSERT INTO gbp_post_templates
       (user_id, project_id, name, topic_type, summary, cta_type, cta_url, media_url,
        utm_source, utm_medium, utm_campaign, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.userId,
      entry.projectId,
      entry.name,
      entry.topicType || 'STANDARD',
      entry.summary || null,
      entry.ctaType || null,
      entry.ctaUrl || null,
      entry.mediaUrl || null,
      entry.utmSource || null,
      entry.utmMedium || null,
      entry.utmCampaign || null,
      timestamp,
      timestamp,
    ]
  );
  return queryOne('SELECT * FROM gbp_post_templates WHERE id = ? AND user_id = ?', [
    result.insertId,
    entry.userId,
  ]);
}

export async function deleteTemplate(userId, templateId) {
  const result = await deleteQuery('DELETE FROM gbp_post_templates WHERE id = ? AND user_id = ?', [
    templateId,
    userId,
  ]);
  return Number(result?.affectedRows || 0) > 0;
}

// --- Automation rules ------------------------------------------------------

export async function listRules(userId, projectId) {
  return query(
    'SELECT * FROM gbp_automation_rules WHERE user_id = ? AND project_id = ? ORDER BY created_at ASC',
    [userId, projectId]
  );
}

export async function getRule(userId, ruleId) {
  return queryOne('SELECT * FROM gbp_automation_rules WHERE id = ? AND user_id = ? LIMIT 1', [
    ruleId,
    userId,
  ]);
}

export async function saveRule(entry) {
  const timestamp = now();
  if (entry.id) {
    await update(
      `UPDATE gbp_automation_rules SET name = ?, location_row_id = ?, enabled = ?, mode = ?,
         config = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [
        entry.name,
        entry.locationRowId || null,
        entry.enabled ? 1 : 0,
        entry.mode || 'approval',
        entry.config ? JSON.stringify(entry.config) : null,
        timestamp,
        entry.id,
        entry.userId,
      ]
    );
    return getRule(entry.userId, entry.id);
  }

  const result = await insert(
    `INSERT INTO gbp_automation_rules
       (user_id, project_id, location_row_id, rule_type, name, enabled, mode, config, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.userId,
      entry.projectId,
      entry.locationRowId || null,
      entry.ruleType,
      entry.name,
      entry.enabled === false ? 0 : 1,
      entry.mode || 'approval',
      entry.config ? JSON.stringify(entry.config) : null,
      timestamp,
      timestamp,
    ]
  );
  return getRule(entry.userId, result.insertId);
}

export async function deleteRule(userId, ruleId) {
  await deleteQuery('DELETE FROM gbp_automation_sources WHERE user_id = ? AND rule_id = ?', [
    userId,
    ruleId,
  ]);
  const result = await deleteQuery('DELETE FROM gbp_automation_rules WHERE id = ? AND user_id = ?', [
    ruleId,
    userId,
  ]);
  return Number(result?.affectedRows || 0) > 0;
}

export async function markRuleRun(userId, ruleId, status, message) {
  await update(
    `UPDATE gbp_automation_rules SET last_run_at = ?, last_run_status = ?, last_run_message = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [now(), status, message ? String(message).slice(0, 1000) : null, now(), ruleId, userId]
  );
}


// --- Discovered source URLs ------------------------------------------------

export async function recordSources(userId, projectId, ruleId, entries) {
  if (!entries.length) return 0;
  const timestamp = now();
  const values = [];
  const placeholders = entries
    .map((entry) => {
      values.push(userId, projectId, ruleId, entry.url, entry.urlHash, entry.title || null, timestamp);
      return '(?, ?, ?, ?, ?, ?, ?)';
    })
    .join(', ');

  // IGNORE keeps the ledger idempotent: a URL already seen is never re-queued.
  const result = await insert(
    `INSERT IGNORE INTO gbp_automation_sources
       (user_id, project_id, rule_id, url, url_hash, title, discovered_at)
     VALUES ${placeholders}`,
    values
  );
  return Number(result?.affectedRows || 0);
}

export async function listSources(userId, projectId, filters = {}) {
  const clauses = ['user_id = ?', 'project_id = ?'];
  const params = [userId, projectId];
  if (filters.ruleId) {
    clauses.push('rule_id = ?');
    params.push(filters.ruleId);
  }
  if (filters.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }
  params.push(Math.min(200, Number(filters.limit) || 100));
  return query(
    `SELECT * FROM gbp_automation_sources WHERE ${clauses.join(' AND ')}
     ORDER BY discovered_at DESC LIMIT ?`,
    params
  );
}

export async function markSource(userId, sourceId, fields) {
  await update(
    `UPDATE gbp_automation_sources SET status = ?, post_id = ?, skip_reason = ?, processed_at = ?
     WHERE id = ? AND user_id = ?`,
    [
      fields.status,
      fields.postId || null,
      fields.skipReason ? String(fields.skipReason).slice(0, 500) : null,
      now(),
      sourceId,
      userId,
    ]
  );
}

// --- Job queue -------------------------------------------------------------

export async function enqueueJob(entry) {
  const timestamp = now();
  const result = await insert(
    `INSERT INTO gbp_jobs
       (user_id, project_id, location_row_id, job_type, payload, status, max_attempts, run_after,
        idempotency_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
    [
      entry.userId,
      entry.projectId || null,
      entry.locationRowId || null,
      entry.jobType,
      entry.payload ? JSON.stringify(entry.payload) : null,
      entry.maxAttempts || 3,
      toMysqlDate(entry.runAfter) || timestamp,
      entry.idempotencyKey || null,
      timestamp,
      timestamp,
    ]
  );
  return result.insertId;
}

// Claim by writing a token first, then reading back only rows carrying it. Two
// workers running the same cron minute cannot pick up the same job.
export async function claimJobs(lockToken, limit = 10) {
  await update(
    `UPDATE gbp_jobs SET status = 'running', locked_at = ?, lock_token = ?, attempts = attempts + 1, updated_at = ?
     WHERE status = 'pending' AND run_after <= UTC_TIMESTAMP()
     ORDER BY run_after ASC LIMIT ?`,
    [now(), lockToken, now(), limit]
  );
  return query('SELECT * FROM gbp_jobs WHERE lock_token = ? AND status = ?', [lockToken, 'running']);
}

export async function completeJob(jobId, status, errorMessage) {
  await update(
    `UPDATE gbp_jobs SET status = ?, last_error = ?, lock_token = NULL, locked_at = NULL, updated_at = ?
     WHERE id = ?`,
    [status, errorMessage ? String(errorMessage).slice(0, 1000) : null, now(), jobId]
  );
}

export async function retryJob(jobId, delaySeconds, errorMessage) {
  await update(
    `UPDATE gbp_jobs SET status = 'pending', run_after = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND),
       last_error = ?, lock_token = NULL, locked_at = NULL, updated_at = ?
     WHERE id = ?`,
    [delaySeconds, errorMessage ? String(errorMessage).slice(0, 1000) : null, now(), jobId]
  );
}

// A worker that dies mid-job leaves the row 'running' forever; release them.
export async function releaseStaleJobs(olderThanMinutes = 15) {
  const result = await update(
    `UPDATE gbp_jobs SET status = 'pending', lock_token = NULL, locked_at = NULL, updated_at = ?
     WHERE status = 'running' AND locked_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? MINUTE)`,
    [now(), olderThanMinutes]
  );
  return Number(result?.affectedRows || 0);
}

export async function jobStats(userId, projectId) {
  return query(
    `SELECT status, COUNT(*) AS total FROM gbp_jobs
     WHERE user_id = ? AND project_id = ? GROUP BY status`,
    [userId, projectId]
  );
}

// --- Reviews ---------------------------------------------------------------

const REVIEW_COLUMNS = `id, user_id, project_id, location_row_id, review_id, review_name,
  reviewer_name, reviewer_photo_url, is_anonymous, star_rating, comment, create_time, update_time,
  reply_comment, reply_update_time, reply_moderation_state, policy_violation, review_reply_uri,
  media_count, media, sentiment, flagged, draft_reply, draft_status, draft_generated_at,
  last_error, synced_at`;

export async function upsertReviews(userId, projectId, locationRowId, reviews) {
  if (!reviews.length) return 0;
  const timestamp = now();
  const values = [];
  const placeholders = reviews
    .map((review) => {
      values.push(
        userId,
        projectId,
        locationRowId,
        review.reviewId,
        review.reviewName || null,
        review.reviewerName || null,
        review.reviewerPhotoUrl || null,
        review.isAnonymous ? 1 : 0,
        review.starRating || 0,
        review.comment || null,
        toMysqlDate(review.createTime),
        toMysqlDate(review.updateTime),
        review.replyComment || null,
        toMysqlDate(review.replyUpdateTime),
        review.replyModerationState || null,
        review.policyViolation ? String(review.policyViolation).slice(0, 255) : null,
        review.reviewReplyUri || null,
        (review.media || []).length,
        review.media?.length ? JSON.stringify(review.media) : null,
        JSON.stringify(review.raw || {}),
        review.sentiment,
        timestamp
      );
      return '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    })
    .join(', ');

  // The draft columns are deliberately absent from the update list: a resync
  // must never discard a reply a human is still working on.
  const result = await insert(
    `INSERT INTO gbp_reviews
       (user_id, project_id, location_row_id, review_id, review_name, reviewer_name,
        reviewer_photo_url, is_anonymous, star_rating, comment, create_time, update_time,
        reply_comment, reply_update_time, reply_moderation_state, policy_violation,
        review_reply_uri, media_count, media, raw, sentiment, synced_at)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE
       reviewer_name = VALUES(reviewer_name),
       reviewer_photo_url = VALUES(reviewer_photo_url),
       star_rating = VALUES(star_rating),
       comment = VALUES(comment),
       update_time = VALUES(update_time),
       reply_comment = VALUES(reply_comment),
       reply_update_time = VALUES(reply_update_time),
       reply_moderation_state = VALUES(reply_moderation_state),
       policy_violation = VALUES(policy_violation),
       review_reply_uri = VALUES(review_reply_uri),
       media_count = VALUES(media_count),
       media = VALUES(media),
       raw = VALUES(raw),
       sentiment = VALUES(sentiment),
       synced_at = VALUES(synced_at)`,
    values
  );
  return Number(result?.affectedRows || 0);
}

export async function listReviews(
  userId,
  locationRowId,
  { clause = '1 = 1', params = [], limit = 100, offset = 0 } = {}
) {
  return query(
    `SELECT ${REVIEW_COLUMNS} FROM gbp_reviews
     WHERE user_id = ? AND location_row_id = ? AND (${clause})
     ORDER BY create_time DESC, id DESC
     LIMIT ? OFFSET ?`,
    [
      userId,
      locationRowId,
      ...params,
      Math.min(200, Number(limit) || 100),
      Math.max(0, Number(offset) || 0),
    ]
  );
}

export async function allReviewsForLocation(userId, locationRowId, limit = 500) {
  return query(
    `SELECT ${REVIEW_COLUMNS} FROM gbp_reviews
     WHERE user_id = ? AND location_row_id = ? ORDER BY create_time DESC LIMIT ?`,
    [userId, locationRowId, limit]
  );
}

export async function getReview(userId, reviewRowId) {
  return queryOne(`SELECT ${REVIEW_COLUMNS} FROM gbp_reviews WHERE id = ? AND user_id = ? LIMIT 1`, [
    reviewRowId,
    userId,
  ]);
}

const REVIEW_UPDATE_FIELDS = {
  draftReply: 'draft_reply',
  draftStatus: 'draft_status',
  replyComment: 'reply_comment',
  flagged: 'flagged',
  lastError: 'last_error',
};

export async function updateReview(userId, reviewRowId, fields) {
  const assignments = [];
  const params = [];
  for (const [key, column] of Object.entries(REVIEW_UPDATE_FIELDS)) {
    if (fields[key] === undefined) continue;
    assignments.push(`${column} = ?`);
    params.push(typeof fields[key] === 'boolean' ? (fields[key] ? 1 : 0) : fields[key]);
  }
  if (fields.draftGeneratedAt !== undefined) {
    assignments.push('draft_generated_at = ?');
    params.push(toMysqlDate(fields.draftGeneratedAt));
  }
  if (fields.replyUpdateTime !== undefined) {
    assignments.push('reply_update_time = ?');
    params.push(toMysqlDate(fields.replyUpdateTime));
  }
  if (!assignments.length) return getReview(userId, reviewRowId);

  params.push(reviewRowId, userId);
  await update(
    `UPDATE gbp_reviews SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`,
    params
  );
  return getReview(userId, reviewRowId);
}

export async function reviewsNeedingDraft(userId, locationRowId, limit = 20) {
  return query(
    `SELECT ${REVIEW_COLUMNS} FROM gbp_reviews
     WHERE user_id = ? AND location_row_id = ? AND reply_comment IS NULL AND draft_status = 'none'
     ORDER BY star_rating ASC, create_time DESC LIMIT ?`,
    [userId, locationRowId, Math.min(50, Number(limit) || 20)]
  );
}

export async function logReviewReply(entry) {
  await insert(
    `INSERT INTO gbp_review_replies
       (user_id, review_row_id, comment, source, status, approved_by, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.userId,
      entry.reviewRowId,
      entry.comment,
      entry.source,
      entry.status,
      entry.approvedBy || null,
      entry.error ? String(entry.error).slice(0, 1000) : null,
      now(),
    ]
  );
}

export async function replyHistory(userId, reviewRowId) {
  return query(
    `SELECT comment, source, status, approved_by, error, created_at
     FROM gbp_review_replies WHERE user_id = ? AND review_row_id = ?
     ORDER BY created_at DESC LIMIT 20`,
    [userId, reviewRowId]
  );
}

// --- Review intelligence ---------------------------------------------------

export async function saveInsight(entry) {
  const result = await insert(
    `INSERT INTO gbp_review_insights
       (user_id, project_id, location_row_id, reviews_analysed, average_rating,
        positive_themes, negative_themes, recommendation, rating_breakdown, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.userId,
      entry.projectId,
      entry.locationRowId,
      entry.reviewsAnalysed || 0,
      entry.averageRating ?? null,
      entry.positiveThemes ? JSON.stringify(entry.positiveThemes) : null,
      entry.negativeThemes ? JSON.stringify(entry.negativeThemes) : null,
      entry.recommendation || null,
      entry.ratingBreakdown ? JSON.stringify(entry.ratingBreakdown) : null,
      now(),
    ]
  );
  return result.insertId;
}

export async function latestInsight(userId, locationRowId) {
  return queryOne(
    `SELECT * FROM gbp_review_insights WHERE user_id = ? AND location_row_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [userId, locationRowId]
  );
}

export async function insightHistory(userId, locationRowId, limit = 12) {
  return query(
    `SELECT id, reviews_analysed, average_rating, created_at FROM gbp_review_insights
     WHERE user_id = ? AND location_row_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, locationRowId, limit]
  );
}

// --- Q&A -------------------------------------------------------------------

const QUESTION_COLUMNS = `id, user_id, project_id, location_row_id, question_name, author_name,
  author_type, text, create_time, update_time, upvote_count, total_answer_count, owner_answer,
  owner_answer_time, top_answers, status, draft_answer, draft_status, draft_generated_at,
  last_error, synced_at`;

export async function upsertQuestions(userId, projectId, locationRowId, questions) {
  if (!questions.length) return 0;
  const timestamp = now();
  const values = [];
  const placeholders = questions
    .map((question) => {
      values.push(
        userId,
        projectId,
        locationRowId,
        question.questionName,
        question.authorName || null,
        question.authorType || null,
        question.text || null,
        toMysqlDate(question.createTime),
        toMysqlDate(question.updateTime),
        question.upvoteCount || 0,
        question.totalAnswerCount || 0,
        question.ownerAnswer || null,
        toMysqlDate(question.ownerAnswerTime),
        JSON.stringify(question.topAnswers || []),
        question.ownerAnswer ? 'answered' : 'unanswered',
        JSON.stringify(question.raw || {}),
        timestamp
      );
      return '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    })
    .join(', ');

  const result = await insert(
    `INSERT INTO gbp_questions
       (user_id, project_id, location_row_id, question_name, author_name, author_type, text,
        create_time, update_time, upvote_count, total_answer_count, owner_answer,
        owner_answer_time, top_answers, status, raw, synced_at)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE
       text = VALUES(text),
       update_time = VALUES(update_time),
       upvote_count = VALUES(upvote_count),
       total_answer_count = VALUES(total_answer_count),
       owner_answer = VALUES(owner_answer),
       owner_answer_time = VALUES(owner_answer_time),
       top_answers = VALUES(top_answers),
       status = VALUES(status),
       raw = VALUES(raw),
       synced_at = VALUES(synced_at)`,
    values
  );
  return Number(result?.affectedRows || 0);
}

export async function listQuestions(userId, locationRowId, status) {
  const clauses = ['user_id = ?', 'location_row_id = ?'];
  const params = [userId, locationRowId];
  if (status && status !== 'all') {
    clauses.push('status = ?');
    params.push(status);
  }
  return query(
    `SELECT ${QUESTION_COLUMNS} FROM gbp_questions WHERE ${clauses.join(' AND ')}
     ORDER BY (owner_answer IS NULL) DESC, upvote_count DESC, create_time DESC LIMIT 200`,
    params
  );
}

export async function getQuestion(userId, questionRowId) {
  return queryOne(
    `SELECT ${QUESTION_COLUMNS} FROM gbp_questions WHERE id = ? AND user_id = ? LIMIT 1`,
    [questionRowId, userId]
  );
}

export async function updateQuestion(userId, questionRowId, fields) {
  const columns = {
    draftAnswer: 'draft_answer',
    draftStatus: 'draft_status',
    ownerAnswer: 'owner_answer',
    status: 'status',
    lastError: 'last_error',
  };
  const assignments = [];
  const params = [];
  for (const [key, column] of Object.entries(columns)) {
    if (fields[key] === undefined) continue;
    assignments.push(`${column} = ?`);
    params.push(fields[key]);
  }
  if (fields.draftGeneratedAt !== undefined) {
    assignments.push('draft_generated_at = ?');
    params.push(toMysqlDate(fields.draftGeneratedAt));
  }
  if (fields.ownerAnswerTime !== undefined) {
    assignments.push('owner_answer_time = ?');
    params.push(toMysqlDate(fields.ownerAnswerTime));
  }
  if (!assignments.length) return getQuestion(userId, questionRowId);

  params.push(questionRowId, userId);
  await update(
    `UPDATE gbp_questions SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`,
    params
  );
  return getQuestion(userId, questionRowId);
}

// --- Search keywords -------------------------------------------------------

export async function upsertSearchKeywords(userId, projectId, locationRowId, month, keywords) {
  if (!keywords.length) return 0;
  const timestamp = now();
  const values = [];
  const placeholders = keywords
    .map((entry) => {
      values.push(
        userId,
        projectId,
        locationRowId,
        month,
        String(entry.keyword).slice(0, 500),
        entry.keywordHash,
        entry.impressions || 0,
        entry.isThreshold ? 1 : 0,
        timestamp
      );
      return '(?, ?, ?, ?, ?, ?, ?, ?, ?)';
    })
    .join(', ');

  const result = await insert(
    `INSERT INTO gbp_search_keywords
       (user_id, project_id, location_row_id, month, keyword, keyword_hash, impressions,
        is_threshold, synced_at)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE
       impressions = VALUES(impressions),
       is_threshold = VALUES(is_threshold),
       synced_at = VALUES(synced_at)`,
    values
  );
  return Number(result?.affectedRows || 0);
}

/**
 * Highest-impression keywords from the most recent month that has data.
 */
export async function topSearchKeywords(userId, locationRowId, limit = 40) {
  const latest = await queryOne(
    'SELECT MAX(month) AS month FROM gbp_search_keywords WHERE user_id = ? AND location_row_id = ?',
    [userId, locationRowId]
  );
  if (!latest?.month) return [];

  const rows = await query(
    `SELECT keyword, impressions, is_threshold, month FROM gbp_search_keywords
     WHERE user_id = ? AND location_row_id = ? AND month = ?
     ORDER BY impressions DESC LIMIT ?`,
    [userId, locationRowId, latest.month, Math.min(200, Number(limit) || 40)]
  );

  return rows.map((row) => ({
    keyword: row.keyword,
    impressions: Number(row.impressions),
    isThreshold: Boolean(row.is_threshold),
    month: row.month,
  }));
}

export async function searchKeywordMonths(userId, locationRowId) {
  return query(
    `SELECT month, COUNT(*) AS keywords, SUM(impressions) AS impressions
     FROM gbp_search_keywords WHERE user_id = ? AND location_row_id = ?
     GROUP BY month ORDER BY month DESC LIMIT 12`,
    [userId, locationRowId]
  );
}

// --- Recommendations -------------------------------------------------------

export async function saveRecommendationRun(entry) {
  const counts = entry.counts || {};
  const result = await insert(
    `INSERT INTO gbp_recommendation_runs
       (user_id, project_id, location_row_id, signals, sources_used, sources_missing,
        high_count, medium_count, low_count, opportunity_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.userId,
      entry.projectId,
      entry.locationRowId,
      entry.signals ? JSON.stringify(entry.signals) : null,
      entry.sourcesUsed ? JSON.stringify(entry.sourcesUsed) : null,
      entry.sourcesMissing ? JSON.stringify(entry.sourcesMissing) : null,
      counts.high || 0,
      counts.medium || 0,
      counts.low || 0,
      counts.opportunity || 0,
      now(),
    ]
  );
  return result.insertId;
}

export async function latestRecommendationRun(userId, locationRowId) {
  return queryOne(
    `SELECT * FROM gbp_recommendation_runs WHERE user_id = ? AND location_row_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [userId, locationRowId]
  );
}

/**
 * Write this run's recommendations.
 *
 * A recommendation the user already ignored stays ignored, and one they already
 * actioned keeps its result: a re-run refreshes the facts, it does not reopen
 * decisions the user already made.
 */
export async function saveRecommendations(userId, projectId, locationRowId, runId, recommendations) {
  if (!recommendations.length) return 0;
  const timestamp = now();
  const values = [];
  const placeholders = recommendations
    .map((entry) => {
      values.push(
        userId,
        projectId,
        locationRowId,
        runId,
        entry.key,
        entry.rule,
        entry.priority,
        String(entry.title).slice(0, 500),
        entry.detail ? String(entry.detail).slice(0, 1000) : null,
        entry.recommended ? String(entry.recommended).slice(0, 1000) : null,
        JSON.stringify(entry.evidence || {}),
        JSON.stringify(entry.actions || []),
        timestamp
      );
      return '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    })
    .join(', ');

  const result = await insert(
    `INSERT INTO gbp_recommendations
       (user_id, project_id, location_row_id, run_id, rec_key, rule, priority, title, detail,
        recommended, evidence, actions, created_at)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE
       run_id = VALUES(run_id),
       priority = VALUES(priority),
       title = VALUES(title),
       detail = VALUES(detail),
       recommended = VALUES(recommended),
       evidence = VALUES(evidence),
       actions = VALUES(actions)`,
    values
  );
  return Number(result?.affectedRows || 0);
}

export async function listRecommendations(userId, locationRowId, { status, priority } = {}) {
  const clauses = ['user_id = ?', 'location_row_id = ?'];
  const params = [userId, locationRowId];
  if (status && status !== 'all') {
    clauses.push('status = ?');
    params.push(status);
  }
  if (priority && priority !== 'all') {
    clauses.push('priority = ?');
    params.push(priority);
  }
  return query(
    `SELECT * FROM gbp_recommendations WHERE ${clauses.join(' AND ')}
     ORDER BY FIELD(priority, 'high', 'medium', 'low', 'opportunity'), created_at DESC
     LIMIT 200`,
    params
  );
}

export async function getRecommendation(userId, recommendationId) {
  return queryOne('SELECT * FROM gbp_recommendations WHERE id = ? AND user_id = ? LIMIT 1', [
    recommendationId,
    userId,
  ]);
}

export async function markRecommendation(userId, recommendationId, fields) {
  await update(
    `UPDATE gbp_recommendations SET status = ?, action_taken = ?, action_result = ?,
       actioned_by = ?, actioned_at = ?
     WHERE id = ? AND user_id = ?`,
    [
      fields.status,
      fields.actionTaken || null,
      fields.actionResult ? JSON.stringify(fields.actionResult) : null,
      fields.actionedBy || null,
      now(),
      recommendationId,
      userId,
    ]
  );
  return getRecommendation(userId, recommendationId);
}

/**
 * Recommendations the user already decided on, so a re-run can leave them be.
 */
export async function decidedRecommendationKeys(userId, locationRowId) {
  const rows = await query(
    `SELECT rec_key FROM gbp_recommendations
     WHERE user_id = ? AND location_row_id = ? AND status IN ('ignored', 'actioned')`,
    [userId, locationRowId]
  );
  return new Set(rows.map((row) => row.rec_key));
}

export async function closeMissingRecommendations(userId, locationRowId, runId) {
  // Anything still open from an earlier run that this run did not reproduce has
  // been resolved by whatever changed on the listing.
  const result = await update(
    `UPDATE gbp_recommendations SET status = 'resolved'
     WHERE user_id = ? AND location_row_id = ? AND status = 'open' AND run_id <> ?`,
    [userId, locationRowId, runId]
  );
  return Number(result?.affectedRows || 0);
}

// --- Accounts --------------------------------------------------------------

export async function upsertAccounts(userId, projectId, connectionId, accounts) {
  if (!accounts.length) return 0;
  const timestamp = now();
  const values = [];
  const placeholders = accounts
    .map((account) => {
      values.push(
        userId,
        projectId,
        connectionId,
        account.accountId,
        account.accountName || null,
        account.accountType || null,
        account.role || null,
        account.verificationState || null,
        timestamp
      );
      return '(?, ?, ?, ?, ?, ?, ?, ?, ?)';
    })
    .join(', ');

  const result = await insert(
    `INSERT INTO gbp_accounts
       (user_id, project_id, connection_id, account_id, account_name, account_type, role,
        verification_state, synced_at)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE
       account_name = VALUES(account_name),
       account_type = VALUES(account_type),
       role = VALUES(role),
       verification_state = VALUES(verification_state),
       synced_at = VALUES(synced_at)`,
    values
  );
  return Number(result?.affectedRows || 0);
}


// --- Normalised profile children ------------------------------------------
//
// Each replace* is a full rewrite for one location: the projection always
// matches the profile that was just synced, with no stale rows left behind.

export async function replaceLocationCategories(userId, locationRowId, categories) {
  await deleteQuery('DELETE FROM gbp_categories WHERE user_id = ? AND location_row_id = ?', [
    userId,
    locationRowId,
  ]);
  if (!categories.length) return 0;

  const timestamp = now();
  const values = [];
  const placeholders = categories
    .map((category, index) => {
      values.push(
        userId,
        locationRowId,
        category.categoryId,
        category.displayName || null,
        category.isPrimary ? 1 : 0,
        index,
        timestamp
      );
      return '(?, ?, ?, ?, ?, ?, ?)';
    })
    .join(', ');

  await insert(
    `INSERT INTO gbp_categories
       (user_id, location_row_id, category_id, display_name, is_primary, position, synced_at)
     VALUES ${placeholders}`,
    values
  );
  return categories.length;
}

export async function replaceLocationServices(userId, locationRowId, services) {
  await deleteQuery('DELETE FROM gbp_services WHERE user_id = ? AND location_row_id = ?', [
    userId,
    locationRowId,
  ]);
  if (!services.length) return 0;

  const timestamp = now();
  const values = [];
  const placeholders = services
    .map((service, index) => {
      values.push(
        userId,
        locationRowId,
        service.serviceKey,
        service.serviceTypeId || null,
        service.label || null,
        service.description || null,
        service.categoryId || null,
        service.isStructured ? 1 : 0,
        service.priceUnits || null,
        service.priceCurrency || null,
        index,
        timestamp
      );
      return '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    })
    .join(', ');

  await insert(
    `INSERT INTO gbp_services
       (user_id, location_row_id, service_key, service_type_id, label, description, category_id,
        is_structured, price_units, price_currency, position, synced_at)
     VALUES ${placeholders}`,
    values
  );
  return services.length;
}

export async function replaceLocationAttributes(userId, locationRowId, attributes) {
  await deleteQuery('DELETE FROM gbp_attributes WHERE user_id = ? AND location_row_id = ?', [
    userId,
    locationRowId,
  ]);
  if (!attributes.length) return 0;

  const timestamp = now();
  const values = [];
  const placeholders = attributes
    .map((attribute) => {
      values.push(
        userId,
        locationRowId,
        attribute.attributeId,
        attribute.valueType || null,
        attribute.values === null || attribute.values === undefined
          ? null
          : JSON.stringify(attribute.values),
        timestamp
      );
      return '(?, ?, ?, ?, ?, ?)';
    })
    .join(', ');

  await insert(
    `INSERT INTO gbp_attributes
       (user_id, location_row_id, attribute_id, value_type, values_json, synced_at)
     VALUES ${placeholders}`,
    values
  );
  return attributes.length;
}

export async function listLocationServices(userId, locationRowId) {
  return query(
    'SELECT * FROM gbp_services WHERE user_id = ? AND location_row_id = ? ORDER BY position ASC',
    [userId, locationRowId]
  );
}


// --- Recurring post series -------------------------------------------------

export async function createPostSchedule(entry) {
  const timestamp = now();
  const result = await insert(
    `INSERT INTO gbp_post_schedule
       (user_id, project_id, location_row_id, name, cadence, occurrences, starts_at, template,
        status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    [
      entry.userId,
      entry.projectId,
      entry.locationRowId,
      entry.name || null,
      entry.cadence,
      entry.occurrences || 1,
      toMysqlDate(entry.startsAt),
      entry.template ? JSON.stringify(entry.template) : null,
      timestamp,
      timestamp,
    ]
  );
  return result.insertId;
}

export async function listPostSchedules(userId, locationRowId) {
  return query(
    `SELECT * FROM gbp_post_schedule WHERE user_id = ? AND location_row_id = ?
     ORDER BY created_at DESC LIMIT 100`,
    [userId, locationRowId]
  );
}

/**
 * Cancel a whole series: the definition is marked cancelled and every
 * occurrence that has not published yet is removed.
 */
export async function cancelPostSchedule(userId, scheduleId) {
  await update(
    `UPDATE gbp_post_schedule SET status = 'cancelled', updated_at = ? WHERE id = ? AND user_id = ?`,
    [now(), scheduleId, userId]
  );
  const result = await deleteQuery(
    `DELETE FROM gbp_posts WHERE user_id = ? AND schedule_id = ? AND status = 'scheduled'`,
    [userId, scheduleId]
  );
  return Number(result?.affectedRows || 0);
}

export async function attachPostsToSchedule(userId, scheduleId, postIds) {
  if (!postIds.length) return 0;
  const placeholders = postIds.map(() => '?').join(', ');
  const result = await update(
    `UPDATE gbp_posts SET schedule_id = ? WHERE user_id = ? AND id IN (${placeholders})`,
    [scheduleId, userId, ...postIds]
  );
  return Number(result?.affectedRows || 0);
}

// --- Worker alerts ---------------------------------------------------------

export async function raiseJobAlert(entry) {
  try {
    await insert(
      `INSERT INTO gbp_job_alerts
         (user_id, project_id, location_row_id, job_id, job_type, severity, message, attempts, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId,
        entry.projectId || null,
        entry.locationRowId || null,
        entry.jobId || null,
        entry.jobType,
        entry.severity || 'error',
        String(entry.message || 'Job failed.').slice(0, 1000),
        entry.attempts || 0,
        now(),
      ]
    );
  } catch (error) {
    console.error('GBP alert insert failed:', error?.message || error);
  }
}

export async function listJobAlerts(userId, projectId, { includeAcknowledged = false } = {}) {
  const clauses = ['user_id = ?', 'project_id = ?'];
  const params = [userId, projectId];
  if (!includeAcknowledged) clauses.push('acknowledged_at IS NULL');
  return query(
    `SELECT * FROM gbp_job_alerts WHERE ${clauses.join(' AND ')}
     ORDER BY created_at DESC LIMIT 100`,
    params
  );
}

export async function acknowledgeJobAlert(userId, alertId, acknowledgedBy) {
  const result = await update(
    'UPDATE gbp_job_alerts SET acknowledged_at = ?, acknowledged_by = ? WHERE id = ? AND user_id = ?',
    [now(), acknowledgedBy || null, alertId, userId]
  );
  return Number(result?.affectedRows || 0) > 0;
}

export async function deadLetterJob(jobId, message) {
  await update(
    `UPDATE gbp_jobs SET status = 'dead', dead_lettered_at = ?, last_error = ?,
       lock_token = NULL, locked_at = NULL, updated_at = ?
     WHERE id = ?`,
    [now(), String(message || '').slice(0, 1000), now(), jobId]
  );
}

/**
 * When a job last completed successfully, used to decide whether a recurring
 * sync is due. Read from the sync log so no extra bookkeeping table is needed.
 */
export async function lastSuccessfulSync(userId, locationRowId, syncType) {
  return queryOne(
    `SELECT created_at FROM gbp_sync_logs
     WHERE user_id = ? AND location_row_id = ? AND sync_type = ? AND status IN ('success', 'partial')
     ORDER BY created_at DESC LIMIT 1`,
    [userId, locationRowId, syncType]
  );
}

export async function activeLocationsForSync(limit = 200) {
  return query(
    `SELECT l.id, l.user_id, l.project_id, l.business_name
     FROM gbp_locations l
     JOIN gbp_connections c ON c.id = l.connection_id AND c.status = 'connected'
     WHERE c.account_id IS NOT NULL
     ORDER BY l.last_sync_at IS NULL DESC, l.last_sync_at ASC
     LIMIT ?`,
    [limit]
  );
}

export async function pendingJobExists(idempotencyKey) {
  const row = await queryOne(
    "SELECT id FROM gbp_jobs WHERE idempotency_key = ? AND status IN ('pending', 'running') LIMIT 1",
    [idempotencyKey]
  );
  return Boolean(row);
}
