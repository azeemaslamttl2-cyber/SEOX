-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Jul 30, 2026 at 07:07 AM
-- Server version: 9.1.0
-- PHP Version: 8.3.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

--
-- Database: `code-step-mysql`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin_affiliates`
--

DROP TABLE IF EXISTS `admin_affiliates`;
CREATE TABLE IF NOT EXISTS `admin_affiliates` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `code` varchar(100) DEFAULT NULL,
  `referrals` int DEFAULT NULL,
  `earnings` decimal(12,2) DEFAULT NULL,
  `conversion_rate` decimal(6,4) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `joined_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `admin_niches`
--

DROP TABLE IF EXISTS `admin_niches`;
CREATE TABLE IF NOT EXISTS `admin_niches` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED DEFAULT NULL,
  `user_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `niche` varchar(255) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `keywords` int DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `admin_payments`
--

DROP TABLE IF EXISTS `admin_payments`;
CREATE TABLE IF NOT EXISTS `admin_payments` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED DEFAULT NULL,
  `user_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `plan` varchar(100) DEFAULT NULL,
  `amount` varchar(100) DEFAULT NULL,
  `payment_date` datetime DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `admin_settings`
--

DROP TABLE IF EXISTS `admin_settings`;
CREATE TABLE IF NOT EXISTS `admin_settings` (

  CREATE TABLE IF NOT EXISTS `deepseek_api_settings` (
    `user_id` varchar(128) NOT NULL,
    `api_key` text,
    `updated_at` datetime NOT NULL,
    PRIMARY KEY (`user_id`),
    CONSTRAINT `fk_deepseek_api_settings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` json DEFAULT NULL,
  `updated_at` datetime NOT NULL,
  `updated_by` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_admin_settings_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `content_writer_profiles`
--

DROP TABLE IF EXISTS `content_writer_profiles`;
CREATE TABLE IF NOT EXISTS `content_writer_profiles` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `profile_data` json NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_content_writer_profiles_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `gsc_connections`
--

DROP TABLE IF EXISTS `gsc_connections`;
CREATE TABLE IF NOT EXISTS `gsc_connections` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `access_token` text,
  `refresh_token` text,
  `expires_at` datetime DEFAULT NULL,
  `google_email` varchar(255) DEFAULT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gsc_connections_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stripe_connections`
--

DROP TABLE IF EXISTS `stripe_connections`;
CREATE TABLE IF NOT EXISTS `stripe_connections` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `stripe_account_id` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `last_onboarding_link_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stripe_connections_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tool_results`
--

DROP TABLE IF EXISTS `tool_results`;
CREATE TABLE IF NOT EXISTS `tool_results` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `tool_key` varchar(100) NOT NULL,
  `project_url` varchar(500) DEFAULT NULL,
  `result` json NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tool_result` (`user_id`,`project_id`,`tool_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL COMMENT 'Stored as bcrypt/Argon2 hash',
  `display_name` varchar(255) DEFAULT NULL,
  `username` varchar(100) DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `profile_image` varchar(500) DEFAULT NULL COMMENT 'URL to profile image',
  `profile_image_public_id` varchar(255) DEFAULT NULL COMMENT 'Cloudinary public ID for image management',
  `bio` text,
  `phone_number` varchar(50) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `timezone` varchar(50) DEFAULT 'UTC',
  `language` varchar(10) DEFAULT 'en',
  `provider` varchar(50) NOT NULL DEFAULT 'email' COMMENT 'email, google, github, facebook, etc.',
  `provider_id` varchar(255) DEFAULT NULL COMMENT 'ID from OAuth provider',
  `email_verified` tinyint(1) DEFAULT '0',
  `email_verified_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `is_admin` tinyint(1) DEFAULT '0',
  `role` varchar(50) DEFAULT 'user' COMMENT 'user, admin, moderator, etc.',
  `plan` varchar(50) DEFAULT 'free' COMMENT 'free, pro, enterprise, etc.',
  `subscription_status` varchar(50) DEFAULT 'inactive' COMMENT 'active, inactive, trial, expired, cancelled',
  `trial_ends_at` datetime DEFAULT NULL,
  `subscription_ends_at` datetime DEFAULT NULL,
  `two_factor_enabled` tinyint(1) DEFAULT '0',
  `two_factor_secret` varchar(255) DEFAULT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `last_login_ip` varchar(45) DEFAULT NULL COMMENT 'Supports IPv6',
  `failed_login_attempts` int DEFAULT '0',
  `locked_until` datetime DEFAULT NULL,
  `notification_preferences` json DEFAULT NULL COMMENT 'Email, push, SMS preferences',
  `theme_preference` varchar(50) DEFAULT 'light',
  `dashboard_preferences` json DEFAULT NULL,
  `google_id` varchar(255) DEFAULT NULL,
  `github_id` varchar(255) DEFAULT NULL,
  `facebook_id` varchar(255) DEFAULT NULL,
  `twitter_id` varchar(255) DEFAULT NULL,
  `metadata` json DEFAULT NULL COMMENT 'Additional user metadata',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_meta`
--

DROP TABLE IF EXISTS `user_meta`;
CREATE TABLE IF NOT EXISTS `user_meta` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `selected_project_id` varchar(255) DEFAULT NULL,
  `deleted_project_ids` json DEFAULT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_meta_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_projects`
--

DROP TABLE IF EXISTS `user_projects`;
CREATE TABLE IF NOT EXISTS `user_projects` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `project_id` varchar(255) NOT NULL,
  `project_name` varchar(255) NOT NULL,
  `domain` varchar(255) NOT NULL,
  `full_url` varchar(500) NOT NULL,
  `protocol` varchar(50) DEFAULT 'https-http',
  `scope` varchar(50) DEFAULT 'subdomains',
  `folder` varchar(255) DEFAULT 'none',
  `schedule` varchar(50) DEFAULT 'weekly',
  `user_agent` varchar(100) DEFAULT 'seox-desktop',
  `url_limit` bigint DEFAULT '10000',
  `total_urls` bigint DEFAULT '0',
  `compare_to` date DEFAULT NULL,
  `crawled_on` date DEFAULT NULL,
  `render_js` tinyint(1) DEFAULT '0',
  `respect_robots` tinyint(1) DEFAULT '1',
  `notify_email` tinyint(1) DEFAULT '1',
  `owner` varchar(255) DEFAULT NULL,
  `owner_email` varchar(255) DEFAULT NULL,
  `owner_uid` varchar(255) DEFAULT NULL,
  `project_data` json DEFAULT NULL,
  `selected_project_id` varchar(255) DEFAULT NULL,
  `deleted_project_ids` json DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_project` (`user_id`,`project_id`),
  UNIQUE KEY `uq_user_project_name` (`user_id`,`project_name`),
  KEY `idx_project_domain` (`domain`),
  KEY `idx_project_owner` (`owner_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `yandex_connections`
--

DROP TABLE IF EXISTS `yandex_connections`;
CREATE TABLE IF NOT EXISTS `yandex_connections` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `access_token` text,
  `refresh_token` text,
  `expires_at` datetime DEFAULT NULL,
  `yandex_email` varchar(255) DEFAULT NULL,
  `yandex_user_id` varchar(255) DEFAULT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_yandex_connections_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `content_writer_profiles`
--
ALTER TABLE `content_writer_profiles`
  ADD CONSTRAINT `fk_content_writer_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `gsc_connections`
--
ALTER TABLE `gsc_connections`
  ADD CONSTRAINT `fk_gsc_connections_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `stripe_connections`
--
ALTER TABLE `stripe_connections`
  ADD CONSTRAINT `fk_stripe_connections_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `tool_results`
--
ALTER TABLE `tool_results`
  ADD CONSTRAINT `fk_tool_results_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_meta`
--
ALTER TABLE `user_meta`
  ADD CONSTRAINT `fk_user_meta_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_projects`
--
ALTER TABLE `user_projects`
  ADD CONSTRAINT `fk_user_projects_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `yandex_connections`
--
ALTER TABLE `yandex_connections`
  ADD CONSTRAINT `fk_yandex_connections_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;
