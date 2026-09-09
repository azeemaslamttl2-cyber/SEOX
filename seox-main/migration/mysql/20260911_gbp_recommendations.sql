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
