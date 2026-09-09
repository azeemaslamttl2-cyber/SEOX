-- WordPress Security module: append-only scan history and per-user quota.
-- Safe to run multiple times; it neither removes nor modifies existing data.

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
