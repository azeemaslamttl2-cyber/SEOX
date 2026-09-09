CREATE TABLE IF NOT EXISTS deepseek_api_settings (
  user_id VARCHAR(128) NOT NULL,
  api_key TEXT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_deepseek_api_settings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
