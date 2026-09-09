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
