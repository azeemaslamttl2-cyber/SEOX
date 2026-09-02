CREATE TABLE IF NOT EXISTS screaming_frog_url_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  scan_id VARCHAR(100) NOT NULL,
  url VARCHAR(2048) NOT NULL,
  url_hash CHAR(64) NOT NULL,
  source_file_ids JSON NULL,
  report_data JSON NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sf_report_scan_url (user_id, project_id, scan_id, url_hash),
  KEY idx_sf_project_scan (project_id, scan_id),
  KEY idx_sf_user_scan (user_id, scan_id),
  KEY idx_sf_url (url(512))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
