-- Add index to improve project sorting performance
-- This index helps the query: SELECT ... FROM user_projects WHERE user_id = ? ORDER BY created_at DESC

ALTER TABLE user_projects ADD INDEX idx_user_created (user_id, created_at DESC);

-- Verify the index was created
SHOW INDEX FROM user_projects WHERE Key_name = 'idx_user_created';
