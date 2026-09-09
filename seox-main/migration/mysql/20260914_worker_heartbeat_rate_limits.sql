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
