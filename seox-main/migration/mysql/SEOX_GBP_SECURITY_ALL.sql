-- ===========================================================================
-- SEOX — GBP module, WordPress security, worker infrastructure
--
-- Every table and column added in this build, in dependency order. Safe to run
-- as one file on a database that has the base SEOX schema (users, user_projects,
-- tool_results, deepseek_api_settings).
--
-- CREATE TABLE statements are IF NOT EXISTS and can be re-run. The ALTER TABLE
-- statements are NOT: MySQL has no ADD COLUMN IF NOT EXISTS, so running this
-- file twice will error on those. Each ALTER block is marked so it can be
-- skipped on a second run.
--
-- The individual migrations are also kept separately in this directory if you
-- prefer to apply them one at a time.
-- ===========================================================================

SET NAMES utf8mb4;



-- ===========================================================================
-- GBP Connection Module — connections, locations, metrics, quota, sync log
-- source: 20260908_gbp_connection_module.sql
-- ===========================================================================

-- GBP Connection Module + Overview Dashboard.
-- Run once. Existing website projects are untouched: they default to
-- project_type = 'WEBSITE_ONLY' and keep their current domain/full_url values.

-- ---------------------------------------------------------------------------
-- Project type. domain/full_url become nullable so a GBP-only project (no
-- website) can be created without inventing a placeholder domain.
-- ---------------------------------------------------------------------------
ALTER TABLE user_projects
  ADD COLUMN project_type VARCHAR(20) NOT NULL DEFAULT 'WEBSITE_ONLY' AFTER project_name,
  ADD INDEX idx_user_projects_type (project_type);

ALTER TABLE user_projects
  MODIFY COLUMN domain VARCHAR(255) NULL,
  MODIFY COLUMN full_url VARCHAR(500) NULL;

-- ---------------------------------------------------------------------------
-- One Google authorisation per (user, project). Tokens are stored AES-GCM
-- encrypted; see functions/_lib/gbp-crypto.js and GBP_TOKEN_ENCRYPTION_KEY.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbp_connections` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `google_user_id` varchar(255) DEFAULT NULL,
  `google_email` varchar(255) DEFAULT NULL,
  `account_id` varchar(255) DEFAULT NULL,
  `account_name` varchar(255) DEFAULT NULL,
  `account_type` varchar(64) DEFAULT NULL,
  `access_token_encrypted` text,
  `refresh_token_encrypted` text,
  `token_expiry` datetime DEFAULT NULL,
  `scope` text,
  `status` varchar(32) NOT NULL DEFAULT 'connected',
  `status_detail` varchar(500) DEFAULT NULL,
  `authorized_by_email` varchar(255) DEFAULT NULL,
  `connected_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gbp_connections_user_project` (`user_id`, `project_id`),
  KEY `idx_gbp_connections_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- Locations attached to a project. Multi-location from day one: a project may
-- hold many rows, one of which is flagged is_primary for dashboard defaults.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbp_locations` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `connection_id` bigint UNSIGNED NOT NULL,
  `account_id` varchar(255) NOT NULL,
  `location_id` varchar(255) NOT NULL,
  `place_id` varchar(255) DEFAULT NULL,
  `business_name` varchar(255) NOT NULL,
  `store_code` varchar(120) DEFAULT NULL,
  `primary_category` varchar(255) DEFAULT NULL,
  `formatted_address` varchar(500) DEFAULT NULL,
  `phone` varchar(64) DEFAULT NULL,
  `website_url` varchar(500) DEFAULT NULL,
  `maps_uri` varchar(500) DEFAULT NULL,
  `verification_status` varchar(40) NOT NULL DEFAULT 'UNKNOWN',
  `open_status` varchar(40) DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT '0',
  `has_google_updates` tinyint(1) NOT NULL DEFAULT '0',
  `average_rating` decimal(3,2) DEFAULT NULL,
  `total_reviews` int UNSIGNED DEFAULT NULL,
  `unanswered_reviews` int UNSIGNED DEFAULT NULL,
  `posts_last_30_days` int UNSIGNED DEFAULT NULL,
  `last_post_at` datetime DEFAULT NULL,
  `profile_completeness` tinyint UNSIGNED DEFAULT NULL,
  `health_score` tinyint UNSIGNED DEFAULT NULL,
  `raw_profile` json DEFAULT NULL,
  `last_sync_at` datetime DEFAULT NULL,
  `attached_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gbp_locations_project_location` (`user_id`, `project_id`, `location_id`),
  KEY `idx_gbp_locations_project` (`project_id`),
  KEY `idx_gbp_locations_connection` (`connection_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- Performance API daily values. Stored per day so the dashboard reads cached
-- rows instead of re-querying Google on every page view.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbp_daily_metrics` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `location_row_id` bigint UNSIGNED NOT NULL,
  `metric_date` date NOT NULL,
  `metric` varchar(64) NOT NULL,
  `value` bigint NOT NULL DEFAULT '0',
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gbp_daily_metrics` (`location_row_id`, `metric_date`, `metric`),
  KEY `idx_gbp_daily_metrics_range` (`location_row_id`, `metric_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- Quota counter. GBP quota is per Google Cloud project and shared by every
-- tenant, so every outbound call is recorded from day one.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbp_api_usage` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED DEFAULT NULL,
  `project_id` varchar(255) DEFAULT NULL,
  `api` varchar(64) NOT NULL,
  `endpoint` varchar(255) NOT NULL,
  `status_code` smallint DEFAULT NULL,
  `error_code` varchar(64) DEFAULT NULL,
  `duration_ms` int UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_gbp_api_usage_created` (`created_at`),
  KEY `idx_gbp_api_usage_api` (`api`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- Sync history. Kept append-only so a later audit-history module can diff.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbp_sync_logs` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) DEFAULT NULL,
  `location_row_id` bigint UNSIGNED DEFAULT NULL,
  `sync_type` varchar(64) NOT NULL,
  `status` varchar(32) NOT NULL,
  `message` varchar(1000) DEFAULT NULL,
  `items_synced` int UNSIGNED DEFAULT NULL,
  `duration_ms` int UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_gbp_sync_logs_project` (`user_id`, `project_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ===========================================================================
-- Profile Manager, Health Audit, Posts, Automation, Job queue
-- source: 20260909_gbp_profile_audit_posts.sql
-- ===========================================================================

-- GBP Profile Manager, Health Audit, Posts Manager and Website->GBP automation.
-- Requires 20260908_gbp_connection_module.sql.

-- ---------------------------------------------------------------------------
-- Posting circuit breaker. Repeated rejections from Google put a real client
-- listing at risk, so automation stops for that location until a human clears
-- it rather than retrying into a policy strike.
-- ---------------------------------------------------------------------------
ALTER TABLE gbp_locations
  ADD COLUMN posting_failures INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN posting_blocked_until DATETIME NULL,
  ADD COLUMN posting_block_reason VARCHAR(500) NULL,
  ADD COLUMN successful_posts INT UNSIGNED NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Every profile read and every edit writes a snapshot, so an edit can be rolled
-- back and the audit module can diff two points in time.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbp_profile_snapshots` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `location_row_id` bigint UNSIGNED NOT NULL,
  `source` varchar(32) NOT NULL,
  `profile` json DEFAULT NULL,
  `attributes` json DEFAULT NULL,
  `changed_fields` json DEFAULT NULL,
  `changed_by` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_gbp_snapshots_location` (`location_row_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- Audit runs are append-only: a new run never overwrites the previous score.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbp_audits` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `location_row_id` bigint UNSIGNED NOT NULL,
  `score` tinyint UNSIGNED NOT NULL,
  `max_score` smallint UNSIGNED NOT NULL DEFAULT 100,
  `breakdown` json DEFAULT NULL,
  `signals` json DEFAULT NULL,
  `critical_count` smallint UNSIGNED NOT NULL DEFAULT 0,
  `high_count` smallint UNSIGNED NOT NULL DEFAULT 0,
  `medium_count` smallint UNSIGNED NOT NULL DEFAULT 0,
  `low_count` smallint UNSIGNED NOT NULL DEFAULT 0,
  `opportunity_count` smallint UNSIGNED NOT NULL DEFAULT 0,
  `skipped_checks` json DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_gbp_audits_location` (`location_row_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `gbp_audit_issues` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `audit_id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `check_key` varchar(64) NOT NULL,
  `category` varchar(64) NOT NULL,
  `severity` varchar(20) NOT NULL,
  `passed` tinyint(1) NOT NULL DEFAULT '0',
  `title` varchar(255) NOT NULL,
  `detail` varchar(1000) DEFAULT NULL,
  `action_label` varchar(120) DEFAULT NULL,
  `action_target` varchar(255) DEFAULT NULL,
  `points_earned` tinyint NOT NULL DEFAULT '0',
  `points_possible` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_gbp_audit_issues_audit` (`audit_id`, `severity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- Posts. A row is the SEOX copy; google_post_name is filled once published.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbp_posts` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `location_row_id` bigint UNSIGNED NOT NULL,
  `google_post_name` varchar(255) DEFAULT NULL,
  `topic_type` varchar(20) NOT NULL DEFAULT 'STANDARD',
  `summary` text NOT NULL,
  `cta_type` varchar(32) DEFAULT NULL,
  `cta_url` varchar(1000) DEFAULT NULL,
  `media_url` varchar(1000) DEFAULT NULL,
  `event_title` varchar(255) DEFAULT NULL,
  `event_start` datetime DEFAULT NULL,
  `event_end` datetime DEFAULT NULL,
  `offer_coupon` varchar(120) DEFAULT NULL,
  `offer_terms` varchar(1000) DEFAULT NULL,
  `offer_redeem_url` varchar(1000) DEFAULT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'draft',
  `scheduled_at` datetime DEFAULT NULL,
  `published_at` datetime DEFAULT NULL,
  `last_error` varchar(1000) DEFAULT NULL,
  `attempts` tinyint UNSIGNED NOT NULL DEFAULT '0',
  `origin` varchar(32) NOT NULL DEFAULT 'manual',
  `source_url` varchar(1000) DEFAULT NULL,
  `template_id` bigint UNSIGNED DEFAULT NULL,
  `recurrence_rule_id` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_gbp_posts_location_status` (`location_row_id`, `status`),
  KEY `idx_gbp_posts_due` (`status`, `scheduled_at`),
  KEY `idx_gbp_posts_project` (`user_id`, `project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `gbp_post_templates` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `name` varchar(160) NOT NULL,
  `topic_type` varchar(20) NOT NULL DEFAULT 'STANDARD',
  `summary` text,
  `cta_type` varchar(32) DEFAULT NULL,
  `cta_url` varchar(1000) DEFAULT NULL,
  `media_url` varchar(1000) DEFAULT NULL,
  `utm_source` varchar(120) DEFAULT NULL,
  `utm_medium` varchar(120) DEFAULT NULL,
  `utm_campaign` varchar(120) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_gbp_templates_project` (`user_id`, `project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- Automation. mode is manual | approval | auto; approval is the default so a
-- generated post always waits for a human unless the user opts out.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbp_automation_rules` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `location_row_id` bigint UNSIGNED DEFAULT NULL,
  `rule_type` varchar(40) NOT NULL,
  `name` varchar(160) NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `mode` varchar(16) NOT NULL DEFAULT 'approval',
  `config` json DEFAULT NULL,
  `last_run_at` datetime DEFAULT NULL,
  `last_run_status` varchar(32) DEFAULT NULL,
  `last_run_message` varchar(1000) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_gbp_rules_project` (`user_id`, `project_id`, `enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Seen-URL ledger so a blog post is only turned into a GBP post once.
CREATE TABLE IF NOT EXISTS `gbp_automation_sources` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `rule_id` bigint UNSIGNED NOT NULL,
  `url` varchar(1000) NOT NULL,
  `url_hash` char(64) NOT NULL,
  `title` varchar(500) DEFAULT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'new',
  `post_id` bigint UNSIGNED DEFAULT NULL,
  `skip_reason` varchar(500) DEFAULT NULL,
  `discovered_at` datetime NOT NULL,
  `processed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gbp_source_url` (`rule_id`, `url_hash`),
  KEY `idx_gbp_sources_status` (`user_id`, `project_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- Durable job queue. Pages Functions cannot run cron, so jobs are drained by
-- POST /api/gbp/jobs (called by the scheduler Worker, or any external cron).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbp_jobs` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) DEFAULT NULL,
  `location_row_id` bigint UNSIGNED DEFAULT NULL,
  `job_type` varchar(40) NOT NULL,
  `payload` json DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `attempts` tinyint UNSIGNED NOT NULL DEFAULT '0',
  `max_attempts` tinyint UNSIGNED NOT NULL DEFAULT '3',
  `run_after` datetime NOT NULL,
  `locked_at` datetime DEFAULT NULL,
  `lock_token` char(36) DEFAULT NULL,
  `last_error` varchar(1000) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_gbp_jobs_claim` (`status`, `run_after`),
  KEY `idx_gbp_jobs_owner` (`user_id`, `project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ===========================================================================
-- Review Management, Review Intelligence, Q&A
-- source: 20260910_gbp_reviews_qanda.sql
-- ===========================================================================

-- Review Management, Review Intelligence and Q&A Manager.
-- Requires 20260908_gbp_connection_module.sql and 20260909_gbp_profile_audit_posts.sql.

-- ---------------------------------------------------------------------------
-- Replying to a review speaks as the business, so SEOX records an explicit
-- authorisation from the client before any reply can leave the system. Auto
-- publishing is a second, narrower opt-in on top of that.
-- ---------------------------------------------------------------------------
ALTER TABLE gbp_locations
  ADD COLUMN reply_authorized TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN reply_authorized_by VARCHAR(255) NULL,
  ADD COLUMN reply_authorized_at DATETIME NULL,
  ADD COLUMN reply_authorization_note VARCHAR(1000) NULL,
  ADD COLUMN auto_reply_enabled TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN auto_reply_min_stars TINYINT UNSIGNED NOT NULL DEFAULT 5;

-- ---------------------------------------------------------------------------
-- Reviews. review_id is Google's id; the row is SEOX's cached copy so the
-- inbox can be filtered and counted without spending quota.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbp_reviews` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `location_row_id` bigint UNSIGNED NOT NULL,
  `review_id` varchar(255) NOT NULL,
  `review_name` varchar(500) DEFAULT NULL,
  `reviewer_name` varchar(255) DEFAULT NULL,
  `reviewer_photo_url` varchar(1000) DEFAULT NULL,
  `is_anonymous` tinyint(1) NOT NULL DEFAULT '0',
  `star_rating` tinyint UNSIGNED NOT NULL DEFAULT '0',
  `comment` text,
  `create_time` datetime DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  `reply_comment` text,
  `reply_update_time` datetime DEFAULT NULL,
  -- Fields Google added to the review resource over time. Stored when present
  -- and left null when the API does not return them.
  `reply_moderation_state` varchar(64) DEFAULT NULL,
  `policy_violation` varchar(255) DEFAULT NULL,
  `review_reply_uri` varchar(1000) DEFAULT NULL,
  `media_count` smallint UNSIGNED NOT NULL DEFAULT '0',
  `media` json DEFAULT NULL,
  `raw` json DEFAULT NULL,
  `sentiment` varchar(16) NOT NULL DEFAULT 'neutral',
  `flagged` tinyint(1) NOT NULL DEFAULT '0',
  `draft_reply` text,
  `draft_status` varchar(24) NOT NULL DEFAULT 'none',
  `draft_generated_at` datetime DEFAULT NULL,
  `last_error` varchar(1000) DEFAULT NULL,
  `synced_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gbp_review` (`location_row_id`, `review_id`),
  KEY `idx_gbp_reviews_inbox` (`user_id`, `location_row_id`, `star_rating`),
  KEY `idx_gbp_reviews_draft` (`location_row_id`, `draft_status`),
  KEY `idx_gbp_reviews_time` (`location_row_id`, `create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Append-only log of every reply SEOX drafted or published, and who approved it.
CREATE TABLE IF NOT EXISTS `gbp_review_replies` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `review_row_id` bigint UNSIGNED NOT NULL,
  `comment` text NOT NULL,
  `source` varchar(24) NOT NULL,
  `status` varchar(24) NOT NULL,
  `approved_by` varchar(255) DEFAULT NULL,
  `error` varchar(1000) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_gbp_review_replies_review` (`review_row_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- Review Intelligence. One row per analysis run, kept so themes can be tracked
-- over time rather than overwritten.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbp_review_insights` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `location_row_id` bigint UNSIGNED NOT NULL,
  `reviews_analysed` int UNSIGNED NOT NULL DEFAULT '0',
  `average_rating` decimal(3,2) DEFAULT NULL,
  `positive_themes` json DEFAULT NULL,
  `negative_themes` json DEFAULT NULL,
  `recommendation` text,
  `rating_breakdown` json DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_gbp_insights_location` (`location_row_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- Q&A. Answers written by the business are upserted, so one row holds the
-- owner answer while top_answers keeps what other users wrote.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbp_questions` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `location_row_id` bigint UNSIGNED NOT NULL,
  `question_name` varchar(500) NOT NULL,
  `author_name` varchar(255) DEFAULT NULL,
  `author_type` varchar(32) DEFAULT NULL,
  `text` text,
  `create_time` datetime DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  `upvote_count` int UNSIGNED NOT NULL DEFAULT '0',
  `total_answer_count` int UNSIGNED NOT NULL DEFAULT '0',
  `owner_answer` text,
  `owner_answer_time` datetime DEFAULT NULL,
  `top_answers` json DEFAULT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'unanswered',
  `draft_answer` text,
  `draft_status` varchar(24) NOT NULL DEFAULT 'none',
  `draft_generated_at` datetime DEFAULT NULL,
  `last_error` varchar(1000) DEFAULT NULL,
  `raw` json DEFAULT NULL,
  `synced_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gbp_question` (`location_row_id`, `question_name`),
  KEY `idx_gbp_questions_status` (`user_id`, `location_row_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ===========================================================================
-- Search keywords, AI Recommendations, Safe AI Actions
-- source: 20260911_gbp_recommendations.sql
-- ===========================================================================

-- AI Recommendations Engine, Safe AI Actions and richer Audit History.
-- Requires the three earlier GBP migrations.

-- ---------------------------------------------------------------------------
-- Monthly search keyword impressions from the Performance API.
--
-- Google returns either an exact value or a threshold ("fewer than N"). Both
-- are stored, and is_threshold marks which, so a floor is never displayed or
-- reasoned about as if it were an exact count.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbp_search_keywords` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `location_row_id` bigint UNSIGNED NOT NULL,
  `month` char(7) NOT NULL,
  `keyword` varchar(500) NOT NULL,
  `keyword_hash` char(64) NOT NULL,
  `impressions` int UNSIGNED NOT NULL DEFAULT '0',
  `is_threshold` tinyint(1) NOT NULL DEFAULT '0',
  `synced_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gbp_search_keyword` (`location_row_id`, `month`, `keyword_hash`),
  KEY `idx_gbp_search_keywords_top` (`location_row_id`, `month`, `impressions`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- One row per engine run, holding the signals the recommendations were derived
-- from and which sources were unavailable at the time.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbp_recommendation_runs` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `location_row_id` bigint UNSIGNED NOT NULL,
  `signals` json DEFAULT NULL,
  `sources_used` json DEFAULT NULL,
  `sources_missing` json DEFAULT NULL,
  `high_count` smallint UNSIGNED NOT NULL DEFAULT '0',
  `medium_count` smallint UNSIGNED NOT NULL DEFAULT '0',
  `low_count` smallint UNSIGNED NOT NULL DEFAULT '0',
  `opportunity_count` smallint UNSIGNED NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_gbp_rec_runs_location` (`location_row_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- Recommendations. A recommendation is data plus the evidence it was derived
-- from; `actions` lists what the user may safely trigger from it.
--
-- status: open | actioned | ignored | resolved
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbp_recommendations` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `location_row_id` bigint UNSIGNED NOT NULL,
  `run_id` bigint UNSIGNED NOT NULL,
  `rec_key` varchar(120) NOT NULL,
  `rule` varchar(64) NOT NULL,
  `priority` varchar(20) NOT NULL,
  `title` varchar(500) NOT NULL,
  `detail` varchar(1000) DEFAULT NULL,
  `recommended` varchar(1000) DEFAULT NULL,
  `evidence` json DEFAULT NULL,
  `actions` json DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'open',
  `action_taken` varchar(40) DEFAULT NULL,
  `action_result` json DEFAULT NULL,
  `actioned_by` varchar(255) DEFAULT NULL,
  `actioned_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gbp_recommendation` (`location_row_id`, `rec_key`),
  KEY `idx_gbp_recommendations_open` (`user_id`, `location_row_id`, `status`, `priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ===========================================================================
-- Accounts, normalised profile children, post series, worker alerts
-- source: 20260912_gbp_schema_completion.sql
-- ===========================================================================

-- Schema completion, background worker hardening.
-- Requires the four earlier GBP migrations.

-- ---------------------------------------------------------------------------
-- Accounts. Previously the chosen account was a column on gbp_connections,
-- which cannot hold the several accounts one Google identity may manage. The
-- column on gbp_connections stays as the *selected* account.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbp_accounts` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `connection_id` bigint UNSIGNED NOT NULL,
  `account_id` varchar(255) NOT NULL,
  `account_name` varchar(255) DEFAULT NULL,
  `account_type` varchar(64) DEFAULT NULL,
  `role` varchar(64) DEFAULT NULL,
  `verification_state` varchar(64) DEFAULT NULL,
  `location_count` int UNSIGNED DEFAULT NULL,
  `synced_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gbp_account` (`connection_id`, `account_id`),
  KEY `idx_gbp_accounts_owner` (`user_id`, `project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- Profile children, normalised out of gbp_locations.raw_profile.
--
-- They were readable as JSON, but the recommendation engine and the service-gap
-- rule both want to query across them ("which locations are missing this
-- service?"), which JSON columns make awkward. raw_profile stays as the
-- verbatim copy of what Google returned; these are the queryable projection,
-- rewritten on every profile sync.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbp_categories` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `location_row_id` bigint UNSIGNED NOT NULL,
  `category_id` varchar(255) NOT NULL,
  `display_name` varchar(255) DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT '0',
  `position` smallint UNSIGNED NOT NULL DEFAULT '0',
  `synced_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gbp_category` (`location_row_id`, `category_id`),
  KEY `idx_gbp_categories_lookup` (`user_id`, `category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `gbp_services` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `location_row_id` bigint UNSIGNED NOT NULL,
  `service_key` varchar(255) NOT NULL,
  `service_type_id` varchar(255) DEFAULT NULL,
  `label` varchar(255) DEFAULT NULL,
  `description` text,
  `category_id` varchar(255) DEFAULT NULL,
  `is_structured` tinyint(1) NOT NULL DEFAULT '0',
  `price_units` varchar(64) DEFAULT NULL,
  `price_currency` varchar(8) DEFAULT NULL,
  `position` smallint UNSIGNED NOT NULL DEFAULT '0',
  `synced_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gbp_service` (`location_row_id`, `service_key`),
  KEY `idx_gbp_services_label` (`user_id`, `label`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `gbp_attributes` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `location_row_id` bigint UNSIGNED NOT NULL,
  `attribute_id` varchar(255) NOT NULL,
  `value_type` varchar(32) DEFAULT NULL,
  `values_json` json DEFAULT NULL,
  `synced_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gbp_attribute` (`location_row_id`, `attribute_id`),
  KEY `idx_gbp_attributes_lookup` (`user_id`, `attribute_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- Recurring post series.
--
-- gbp_posts already holds each occurrence with its own scheduled_at, which is
-- what the worker publishes from. This table holds the *definition* of a
-- series, so a whole recurrence can be paused or cancelled instead of deleting
-- occurrences one at a time.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gbp_post_schedule` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `location_row_id` bigint UNSIGNED NOT NULL,
  `name` varchar(160) DEFAULT NULL,
  `cadence` varchar(20) NOT NULL,
  `occurrences` smallint UNSIGNED NOT NULL DEFAULT '1',
  `starts_at` datetime NOT NULL,
  `template` json DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_gbp_post_schedule_owner` (`user_id`, `location_row_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE gbp_posts
  ADD COLUMN schedule_id BIGINT UNSIGNED NULL AFTER recurrence_rule_id,
  ADD INDEX idx_gbp_posts_schedule (schedule_id);

-- ---------------------------------------------------------------------------
-- Worker hardening: a job that exhausts its retries is parked as dead, and an
-- alert row is written so a failure is visible rather than silent.
-- ---------------------------------------------------------------------------
ALTER TABLE gbp_jobs
  ADD COLUMN dead_lettered_at DATETIME NULL,
  ADD COLUMN idempotency_key VARCHAR(191) NULL,
  ADD UNIQUE KEY uq_gbp_jobs_idempotency (idempotency_key);

CREATE TABLE IF NOT EXISTS `gbp_job_alerts` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) DEFAULT NULL,
  `location_row_id` bigint UNSIGNED DEFAULT NULL,
  `job_id` bigint UNSIGNED DEFAULT NULL,
  `job_type` varchar(40) NOT NULL,
  `severity` varchar(20) NOT NULL DEFAULT 'error',
  `message` varchar(1000) NOT NULL,
  `attempts` tinyint UNSIGNED NOT NULL DEFAULT '0',
  `acknowledged_at` datetime DEFAULT NULL,
  `acknowledged_by` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_gbp_job_alerts_open` (`user_id`, `acknowledged_at`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ===========================================================================
-- WordPress security scanning (WPScan)
-- source: 20260913_wp_security.sql
-- ===========================================================================

-- WordPress security scanning (WPScan vulnerability database).
--
-- Scans are append-only so a site's exposure can be tracked over time, the way
-- gbp_audits works.

CREATE TABLE IF NOT EXISTS `wp_security_scans` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `target_url` varchar(500) NOT NULL,
  `is_wordpress` tinyint(1) NOT NULL DEFAULT '0',
  `detection_confidence` varchar(16) DEFAULT NULL,
  `core_version` varchar(32) DEFAULT NULL,
  `core_version_source` varchar(64) DEFAULT NULL,
  `plugins_found` smallint UNSIGNED NOT NULL DEFAULT '0',
  `themes_found` smallint UNSIGNED NOT NULL DEFAULT '0',
  `critical_count` smallint UNSIGNED NOT NULL DEFAULT '0',
  `high_count` smallint UNSIGNED NOT NULL DEFAULT '0',
  `medium_count` smallint UNSIGNED NOT NULL DEFAULT '0',
  `low_count` smallint UNSIGNED NOT NULL DEFAULT '0',
  `info_count` smallint UNSIGNED NOT NULL DEFAULT '0',
  `fingerprint` json DEFAULT NULL,
  `vuln_db_status` varchar(32) DEFAULT NULL,
  `vuln_db_remaining` int DEFAULT NULL,
  `warnings` json DEFAULT NULL,
  `duration_ms` int UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_wp_scans_project` (`user_id`, `project_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `wp_security_findings` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `scan_id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `kind` varchar(24) NOT NULL,
  `component_slug` varchar(191) DEFAULT NULL,
  `component_name` varchar(255) DEFAULT NULL,
  `installed_version` varchar(32) DEFAULT NULL,
  `fixed_in` varchar(32) DEFAULT NULL,
  `severity` varchar(16) NOT NULL DEFAULT 'info',
  `confirmed` tinyint(1) NOT NULL DEFAULT '0',
  `title` varchar(500) NOT NULL,
  `detail` text,
  `cve` varchar(120) DEFAULT NULL,
  `cvss_score` decimal(3,1) DEFAULT NULL,
  `references_json` json DEFAULT NULL,
  `evidence` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_wp_findings_scan` (`scan_id`, `severity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ===========================================================================
-- Worker heartbeat and per-user rate limiting
-- source: 20260914_worker_heartbeat_rate_limits.sql
-- ===========================================================================

-- Worker heartbeat and per-user rate limiting.
--
-- Both address failures that were previously invisible: a scheduler that stops
-- calling in, and a user burning the shared Google quota by hammering a sync
-- button.

-- ---------------------------------------------------------------------------
-- One row per worker. The drain endpoint stamps it on every tick, so "when did
-- the scheduler last run" becomes a fact rather than an assumption.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `worker_heartbeats` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `worker` varchar(64) NOT NULL,
  `last_seen_at` datetime NOT NULL,
  `last_status` varchar(24) NOT NULL DEFAULT 'ok',
  `last_message` varchar(1000) DEFAULT NULL,
  `runs_total` bigint UNSIGNED NOT NULL DEFAULT '0',
  `last_duration_ms` int UNSIGNED DEFAULT NULL,
  `last_summary` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_worker_heartbeat` (`worker`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- Fixed-window rate limiting, keyed by user and bucket.
--
-- The GBP and WPScan quotas are per Google Cloud project and shared by every
-- tenant, so one user repeatedly pressing "Sync reviews" spends everyone's
-- allowance. window_start is the start of the current window; a new window
-- makes a new row and the old ones age out.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `api_rate_limits` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `bucket` varchar(64) NOT NULL,
  `window_start` datetime NOT NULL,
  `hits` int UNSIGNED NOT NULL DEFAULT '0',
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rate_limit_window` (`user_id`, `bucket`, `window_start`),
  KEY `idx_rate_limit_cleanup` (`window_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
