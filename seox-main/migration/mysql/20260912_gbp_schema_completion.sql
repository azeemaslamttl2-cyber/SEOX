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
