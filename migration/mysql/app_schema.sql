CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(128) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'email',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  role VARCHAR(50) NULL,
  plan VARCHAR(50) NOT NULL DEFAULT 'free',
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS user_projects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id VARCHAR(128) NOT NULL,
  project_id VARCHAR(255) NOT NULL,
  project_data JSON NOT NULL,
  selected_project_id VARCHAR(255) NULL,
  deleted_project_ids JSON NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_project (user_id, project_id)
);

CREATE TABLE IF NOT EXISTS user_meta (
  user_id VARCHAR(128) NOT NULL,
  selected_project_id VARCHAR(255) NULL,
  deleted_project_ids JSON NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS tool_results (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id VARCHAR(128) NOT NULL,
  project_id VARCHAR(255) NOT NULL,
  tool_key VARCHAR(100) NOT NULL,
  project_url VARCHAR(500) NULL,
  result JSON NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tool_result (user_id, project_id, tool_key)
);

CREATE TABLE IF NOT EXISTS admin_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSON NULL,
  updated_at DATETIME NOT NULL,
  updated_by VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_settings_key (setting_key)
);

CREATE TABLE IF NOT EXISTS stripe_connections (
  user_id VARCHAR(128) NOT NULL,
  stripe_account_id VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  last_onboarding_link_at DATETIME NULL,
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS gsc_connections (
  user_id VARCHAR(128) NOT NULL,
  access_token TEXT NULL,
  refresh_token TEXT NULL,
  expires_at DATETIME NULL,
  google_email VARCHAR(255) NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS yandex_connections (
  user_id VARCHAR(128) NOT NULL,
  access_token TEXT NULL,
  refresh_token TEXT NULL,
  expires_at DATETIME NULL,
  yandex_email VARCHAR(255) NULL,
  yandex_user_id VARCHAR(255) NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS content_writer_profiles (
  user_id VARCHAR(128) NOT NULL,
  profile_data JSON NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id)
);
