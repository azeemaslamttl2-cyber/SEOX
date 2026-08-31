CREATE DATABASE IF NOT EXISTS `code-step-mysql`;
USE `code-step-mysql`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) DEFAULT NULL,
  `display_name` VARCHAR(255) DEFAULT NULL,
  `provider` VARCHAR(50) NOT NULL DEFAULT 'email',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `users` (
  `email`,
  `password_hash`,
  `display_name`,
  `provider`,
  `created_at`,
  `updated_at`
)
VALUES (
  'azeemaslamhh@gmail.co',
  'dummy-hash-for-abc123**',
  'azeem',
  'email',
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  `password_hash` = VALUES(`password_hash`),
  `display_name` = VALUES(`display_name`),
  `updated_at` = VALUES(`updated_at`);
