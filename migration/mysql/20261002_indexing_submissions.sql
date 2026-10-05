-- Google Indexing API submission history (Off-Page SEO > Backlink Indexer).
-- Safe to run multiple times. The API also creates this table on first use.

CREATE TABLE IF NOT EXISTS `indexing_submissions` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` varchar(128) NOT NULL,
  `project_id` varchar(255) DEFAULT NULL,
  `url` varchar(2048) NOT NULL,
  `host` varchar(255) NOT NULL,
  `notification_type` varchar(16) NOT NULL DEFAULT 'URL_UPDATED',
  `status` varchar(16) NOT NULL,
  `error_code` varchar(32) DEFAULT NULL,
  `message` text,
  `http_status` smallint DEFAULT NULL,
  `google_response` json DEFAULT NULL,
  `submitted_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_indexing_user_time` (`user_id`, `submitted_at`),
  KEY `idx_indexing_user_url` (`user_id`, `url`(255), `status`, `submitted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
