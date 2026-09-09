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
