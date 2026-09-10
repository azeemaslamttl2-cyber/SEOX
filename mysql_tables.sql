-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               9.1.0 - MySQL Community Server - GPL
-- Server OS:                    Win64
-- HeidiSQL Version:             12.13.0.7147
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for code-step-mysql
CREATE DATABASE IF NOT EXISTS `code-step-mysql` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `code-step-mysql`;

-- Dumping structure for table code-step-mysql.admin_affiliates
CREATE TABLE IF NOT EXISTS `admin_affiliates` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `code` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `referrals` int DEFAULT NULL,
  `earnings` decimal(12,2) DEFAULT NULL,
  `conversion_rate` decimal(6,4) DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `joined_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.admin_niches
CREATE TABLE IF NOT EXISTS `admin_niches` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `user_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `niche` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `keywords` int DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.admin_payments
CREATE TABLE IF NOT EXISTS `admin_payments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `user_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `plan` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `amount` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `payment_date` datetime DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.admin_settings
CREATE TABLE IF NOT EXISTS `admin_settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `setting_value` json DEFAULT NULL,
  `updated_at` datetime NOT NULL,
  `updated_by` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_admin_settings_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.api_rate_limits
CREATE TABLE IF NOT EXISTS `api_rate_limits` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `bucket` varchar(64) COLLATE utf8mb4_general_ci NOT NULL,
  `window_start` datetime NOT NULL,
  `hits` int unsigned NOT NULL DEFAULT '0',
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rate_limit_window` (`user_id`,`bucket`,`window_start`),
  KEY `idx_rate_limit_cleanup` (`window_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.article_generations
CREATE TABLE IF NOT EXISTS `article_generations` (
  `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `article_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `user_id` varchar(128) COLLATE utf8mb4_general_ci NOT NULL,
  `generation_type` varchar(40) COLLATE utf8mb4_general_ci NOT NULL,
  `prompt_version` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `provider` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `result` json NOT NULL,
  `selected_value` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `selected_value_id` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_generations_article_type` (`article_id`,`generation_type`),
  KEY `idx_generations_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.article_seo_reviews
CREATE TABLE IF NOT EXISTS `article_seo_reviews` (
  `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `article_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `user_id` varchar(128) COLLATE utf8mb4_general_ci NOT NULL,
  `provider` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `request_hash` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `review_type` enum('seo','helpful_content','readability','comprehensive') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'seo',
  `score` int NOT NULL DEFAULT '0',
  `normalized_result` json NOT NULL,
  `raw_response` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reviews_article` (`article_id`),
  KEY `idx_reviews_user` (`user_id`),
  KEY `idx_reviews_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.articles
CREATE TABLE IF NOT EXISTS `articles` (
  `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `user_id` varchar(128) COLLATE utf8mb4_general_ci NOT NULL,
  `project_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `title` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `topic` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `body` longtext COLLATE utf8mb4_general_ci,
  `status` enum('draft','review','published','archived') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'draft',
  `focus_keyword` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `selected_keyword` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `meta_description` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `word_count` int NOT NULL DEFAULT '0',
  `reading_time` int NOT NULL DEFAULT '0',
  `seo_score` int NOT NULL DEFAULT '0',
  `helpful_score` int NOT NULL DEFAULT '0',
  `publish_status` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `published_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_articles_user_project` (`user_id`,`project_id`),
  KEY `idx_articles_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.content_writer_profiles
CREATE TABLE IF NOT EXISTS `content_writer_profiles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `profile_data` json NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_content_writer_profiles_user` (`user_id`),
  CONSTRAINT `fk_content_writer_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.deepseek_api_settings
CREATE TABLE IF NOT EXISTS `deepseek_api_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `api_key` text COLLATE utf8mb4_general_ci,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_deepseek_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.gsc_connections
CREATE TABLE IF NOT EXISTS `gsc_connections` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `project_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `access_token` text COLLATE utf8mb4_general_ci,
  `refresh_token` text COLLATE utf8mb4_general_ci,
  `expires_at` datetime DEFAULT NULL,
  `google_email` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gsc_connections_user_project` (`user_id`,`project_id`),
  CONSTRAINT `fk_gsc_connections_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.gsc_history
CREATE TABLE IF NOT EXISTS `gsc_history` (
  `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `user_id` varchar(128) COLLATE utf8mb4_general_ci NOT NULL,
  `project_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `site_url` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `query` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `page_url` varchar(1000) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `clicks` int NOT NULL DEFAULT '0',
  `impressions` int NOT NULL DEFAULT '0',
  `position` decimal(6,2) NOT NULL DEFAULT '0.00',
  `ctr` decimal(5,2) NOT NULL DEFAULT '0.00',
  `snapshot_date` date NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_gsc_history_user_project` (`user_id`,`project_id`),
  KEY `idx_gsc_history_site_date` (`site_url`,`snapshot_date`),
  KEY `idx_gsc_history_query` (`query`(191)),
  KEY `idx_gsc_history_snapshot` (`site_url`(120),`query`(120),`page_url`(120),`snapshot_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.screaming_frog_url_reports
CREATE TABLE IF NOT EXISTS `screaming_frog_url_reports` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `project_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `user_id` varchar(128) COLLATE utf8mb4_general_ci NOT NULL,
  `scan_id` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `url` varchar(2048) COLLATE utf8mb4_general_ci NOT NULL,
  `url_hash` char(64) COLLATE utf8mb4_general_ci NOT NULL,
  `source_file_ids` json DEFAULT NULL,
  `report_data` json NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sf_report_scan_url` (`user_id`,`project_id`,`scan_id`,`url_hash`),
  KEY `idx_sf_project_scan` (`project_id`,`scan_id`),
  KEY `idx_sf_user_scan` (`user_id`,`scan_id`),
  KEY `idx_sf_url` (`url`(512))
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.stripe_connections
CREATE TABLE IF NOT EXISTS `stripe_connections` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `stripe_account_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `last_onboarding_link_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stripe_connections_user` (`user_id`),
  CONSTRAINT `fk_stripe_connections_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.tool_results
CREATE TABLE IF NOT EXISTS `tool_results` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `project_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `tool_key` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `project_url` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `result` json NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tool_result` (`user_id`,`project_id`,`tool_key`),
  CONSTRAINT `fk_tool_results_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3045 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.usage_ledger
CREATE TABLE IF NOT EXISTS `usage_ledger` (
  `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `user_id` varchar(128) COLLATE utf8mb4_general_ci NOT NULL,
  `project_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `feature` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `units` int NOT NULL DEFAULT '1',
  `provider` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `request_id` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_usage_user_feature` (`user_id`,`feature`),
  KEY `idx_usage_project` (`project_id`),
  KEY `idx_usage_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.user_meta
CREATE TABLE IF NOT EXISTS `user_meta` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `selected_project_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `deleted_project_ids` json DEFAULT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_meta_user` (`user_id`),
  CONSTRAINT `fk_user_meta_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.user_projects
CREATE TABLE IF NOT EXISTS `user_projects` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `project_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `project_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `domain` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `full_url` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `protocol` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'https-http',
  `scope` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'subdomains',
  `folder` varchar(255) COLLATE utf8mb4_general_ci DEFAULT 'none',
  `schedule` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'weekly',
  `user_agent` varchar(100) COLLATE utf8mb4_general_ci DEFAULT 'seox-desktop',
  `url_limit` bigint DEFAULT '10000',
  `total_urls` bigint DEFAULT '0',
  `compare_to` date DEFAULT NULL,
  `crawled_on` date DEFAULT NULL,
  `render_js` tinyint(1) DEFAULT '0',
  `respect_robots` tinyint(1) DEFAULT '1',
  `notify_email` tinyint(1) DEFAULT '1',
  `owner` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `owner_email` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `owner_uid` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `project_data` json DEFAULT NULL,
  `selected_project_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `deleted_project_ids` json DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_project` (`user_id`,`project_id`),
  UNIQUE KEY `uq_user_project_name` (`user_id`,`project_name`),
  KEY `idx_project_domain` (`domain`),
  KEY `idx_project_owner` (`owner_uid`),
  KEY `idx_user_created` (`user_id`,`created_at` DESC),
  CONSTRAINT `fk_user_projects_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.user_quotas
CREATE TABLE IF NOT EXISTS `user_quotas` (
  `user_id` varchar(128) COLLATE utf8mb4_general_ci NOT NULL,
  `features` json NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Stored as bcrypt/Argon2 hash',
  `display_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `username` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `first_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `profile_image` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'URL to profile image',
  `profile_image_public_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Cloudinary public ID for image management',
  `bio` text COLLATE utf8mb4_general_ci,
  `phone_number` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `city` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `timezone` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'UTC',
  `language` varchar(10) COLLATE utf8mb4_general_ci DEFAULT 'en',
  `provider` varchar(50) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'email' COMMENT 'email, google, github, facebook, etc.',
  `provider_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'ID from OAuth provider',
  `email_verified` tinyint(1) DEFAULT '0',
  `email_verified_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `is_admin` tinyint(1) DEFAULT '0',
  `role` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'user' COMMENT 'user, admin, moderator, etc.',
  `plan` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'free' COMMENT 'free, pro, enterprise, etc.',
  `subscription_status` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'inactive' COMMENT 'active, inactive, trial, expired, cancelled',
  `trial_ends_at` datetime DEFAULT NULL,
  `subscription_ends_at` datetime DEFAULT NULL,
  `two_factor_enabled` tinyint(1) DEFAULT '0',
  `two_factor_secret` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `remember_token` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `last_login_ip` varchar(45) COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Supports IPv6',
  `failed_login_attempts` int DEFAULT '0',
  `locked_until` datetime DEFAULT NULL,
  `notification_preferences` json DEFAULT NULL COMMENT 'Email, push, SMS preferences',
  `theme_preference` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'light',
  `dashboard_preferences` json DEFAULT NULL,
  `google_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `github_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `facebook_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `twitter_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL COMMENT 'Additional user metadata',
  `admin_token` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_admin_token` (`admin_token`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.wordpress_connections
CREATE TABLE IF NOT EXISTS `wordpress_connections` (
  `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `user_id` varchar(128) COLLATE utf8mb4_general_ci NOT NULL,
  `project_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `site_url` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `encrypted_credentials` blob NOT NULL,
  `status` enum('active','error','disabled') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'active',
  `last_error` text COLLATE utf8mb4_general_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wp_connections_user_project` (`user_id`,`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.wordpress_publications
CREATE TABLE IF NOT EXISTS `wordpress_publications` (
  `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `article_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `connection_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `remote_post_id` bigint DEFAULT NULL,
  `status` enum('pending','published','updated','deleted','error') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `remote_url` varchar(1000) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `request_hash` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `error_json` json DEFAULT NULL,
  `action` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `published_at` datetime DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wp_publications_article` (`article_id`),
  KEY `idx_wp_publications_connection` (`connection_id`),
  KEY `idx_wp_publications_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.wp_security_findings
CREATE TABLE IF NOT EXISTS `wp_security_findings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `scan_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `kind` varchar(24) COLLATE utf8mb4_general_ci NOT NULL,
  `component_slug` varchar(191) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `component_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `installed_version` varchar(32) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `fixed_in` varchar(32) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `severity` varchar(16) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'info',
  `confirmed` tinyint(1) NOT NULL DEFAULT '0',
  `title` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `detail` text COLLATE utf8mb4_general_ci,
  `cve` varchar(120) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `cvss_score` decimal(3,1) DEFAULT NULL,
  `references_json` json DEFAULT NULL,
  `evidence` varchar(1000) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_wp_findings_scan` (`scan_id`,`severity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.wp_security_scans
CREATE TABLE IF NOT EXISTS `wp_security_scans` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `project_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `target_url` varchar(500) COLLATE utf8mb4_general_ci NOT NULL,
  `is_wordpress` tinyint(1) NOT NULL DEFAULT '0',
  `detection_confidence` varchar(16) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `core_version` varchar(32) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `core_version_source` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `plugins_found` smallint unsigned NOT NULL DEFAULT '0',
  `themes_found` smallint unsigned NOT NULL DEFAULT '0',
  `critical_count` smallint unsigned NOT NULL DEFAULT '0',
  `high_count` smallint unsigned NOT NULL DEFAULT '0',
  `medium_count` smallint unsigned NOT NULL DEFAULT '0',
  `low_count` smallint unsigned NOT NULL DEFAULT '0',
  `info_count` smallint unsigned NOT NULL DEFAULT '0',
  `fingerprint` json DEFAULT NULL,
  `vuln_db_status` varchar(32) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `vuln_db_remaining` int DEFAULT NULL,
  `warnings` json DEFAULT NULL,
  `duration_ms` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_wp_scans_project` (`user_id`,`project_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table code-step-mysql.yandex_connections
CREATE TABLE IF NOT EXISTS `yandex_connections` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `access_token` text COLLATE utf8mb4_general_ci,
  `refresh_token` text COLLATE utf8mb4_general_ci,
  `expires_at` datetime DEFAULT NULL,
  `yandex_email` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `yandex_user_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_yandex_connections_user` (`user_id`),
  CONSTRAINT `fk_yandex_connections_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
