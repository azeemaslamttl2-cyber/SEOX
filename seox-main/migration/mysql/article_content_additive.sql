-- Additive PHP-derived content domain. Existing tables are unchanged.
CREATE TABLE IF NOT EXISTS articles (
  id VARCHAR(36) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  project_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  topic VARCHAR(500) NULL,
  body LONGTEXT NULL,
  status ENUM('draft', 'review', 'published', 'archived') NOT NULL DEFAULT 'draft',
  focus_keyword VARCHAR(255) NULL,
  selected_keyword VARCHAR(255) NULL,
  meta_description VARCHAR(300) NULL,
  word_count INT NOT NULL DEFAULT 0,
  reading_time INT NOT NULL DEFAULT 0,
  seo_score INT NOT NULL DEFAULT 0,
  helpful_score INT NOT NULL DEFAULT 0,
  publish_status VARCHAR(50) NULL,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_articles_user_project (user_id, project_id),
  INDEX idx_articles_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS article_seo_reviews (
  id VARCHAR(36) NOT NULL,
  article_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  request_hash VARCHAR(64) NULL,
  review_type ENUM('seo', 'helpful_content', 'readability', 'comprehensive') NOT NULL DEFAULT 'seo',
  score INT NOT NULL DEFAULT 0,
  normalized_result JSON NOT NULL,
  raw_response JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_reviews_article (article_id),
  INDEX idx_reviews_user (user_id),
  INDEX idx_reviews_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS article_generations (
  id VARCHAR(36) NOT NULL,
  article_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  generation_type VARCHAR(40) NOT NULL,
  prompt_version VARCHAR(50) NULL,
  provider VARCHAR(100) NULL,
  result JSON NOT NULL,
  selected_value VARCHAR(500) NULL,
  selected_value_id VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_generations_article_type (article_id, generation_type),
  INDEX idx_generations_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS usage_ledger (
  id VARCHAR(36) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  project_id VARCHAR(255) NULL,
  feature VARCHAR(100) NOT NULL,
  units INT NOT NULL DEFAULT 1,
  provider VARCHAR(100) NULL,
  request_id VARCHAR(100) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_usage_user_feature (user_id, feature),
  INDEX idx_usage_project (project_id),
  INDEX idx_usage_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wordpress_connections (
  id VARCHAR(36) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  project_id VARCHAR(255) NOT NULL,
  site_url VARCHAR(500) NOT NULL,
  encrypted_credentials BLOB NOT NULL,
  status ENUM('active', 'error', 'disabled') NOT NULL DEFAULT 'active',
  last_error TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_wp_connections_user_project (user_id, project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wordpress_publications (
  id VARCHAR(36) NOT NULL,
  article_id VARCHAR(36) NOT NULL,
  connection_id VARCHAR(36) NOT NULL,
  remote_post_id BIGINT NULL,
  status ENUM('pending', 'published', 'updated', 'deleted', 'error') NOT NULL DEFAULT 'pending',
  remote_url VARCHAR(1000) NULL,
  request_hash VARCHAR(64) NULL,
  error_json JSON NULL,
  action VARCHAR(50) NULL,
  published_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_wp_publications_article (article_id),
  INDEX idx_wp_publications_connection (connection_id),
  INDEX idx_wp_publications_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gsc_history (
  id VARCHAR(36) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  project_id VARCHAR(255) NOT NULL,
  site_url VARCHAR(500) NOT NULL,
  query VARCHAR(500) NULL,
  page_url VARCHAR(1000) NULL,
  clicks INT NOT NULL DEFAULT 0,
  impressions INT NOT NULL DEFAULT 0,
  position DECIMAL(6,2) NOT NULL DEFAULT 0,
  ctr DECIMAL(5,2) NOT NULL DEFAULT 0,
  snapshot_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_gsc_history_user_project (user_id, project_id),
  INDEX idx_gsc_history_site_date (site_url, snapshot_date),
  INDEX idx_gsc_history_query (query(191)),
  INDEX idx_gsc_history_snapshot (site_url(120), query(120), page_url(120), snapshot_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_quotas (
  user_id VARCHAR(128) NOT NULL,
  features JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
