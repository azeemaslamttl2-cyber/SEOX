ALTER TABLE gsc_connections
  ADD COLUMN project_id VARCHAR(255) NULL AFTER user_id;

ALTER TABLE gsc_connections
  DROP INDEX uq_gsc_connections_user,
  ADD UNIQUE KEY uq_gsc_connections_user_project (user_id, project_id);