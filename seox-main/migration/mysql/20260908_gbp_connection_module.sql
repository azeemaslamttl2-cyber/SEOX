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
