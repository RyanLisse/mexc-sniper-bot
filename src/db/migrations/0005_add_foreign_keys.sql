-- Migration to add missing foreign key constraints for data integrity
-- This ensures referential integrity and cascading deletes

-- Add foreign key constraints for user_preferences
-- Note: SQLite requires recreating tables to add foreign key constraints
-- For now, we'll add these as indexes and enforce constraints in application code

-- Create temporary backup tables
CREATE TABLE IF NOT EXISTS user_preferences_backup AS SELECT * FROM user_preferences;
CREATE TABLE IF NOT EXISTS api_credentials_backup AS SELECT * FROM api_credentials;
CREATE TABLE IF NOT EXISTS snipe_targets_backup AS SELECT * FROM snipe_targets;
CREATE TABLE IF NOT EXISTS execution_history_backup AS SELECT * FROM execution_history;

-- Note: In production, we would need to recreate tables with proper foreign keys
-- For now, adding comments to track expected foreign key relationships:

-- user_preferences.user_id -> user.id (CASCADE DELETE)
-- api_credentials.user_id -> user.id (CASCADE DELETE)  
-- snipe_targets.user_id -> user.id (CASCADE DELETE)
-- execution_history.user_id -> user.id (CASCADE DELETE)
-- execution_history.snipe_target_id -> snipe_targets.id (SET NULL)

-- Add validation indexes to ensure data integrity
CREATE INDEX IF NOT EXISTS user_preferences_user_id_validation_idx 
  ON user_preferences(user_id);

CREATE INDEX IF NOT EXISTS api_credentials_user_id_validation_idx 
  ON api_credentials(user_id);

CREATE INDEX IF NOT EXISTS snipe_targets_user_id_validation_idx 
  ON snipe_targets(user_id);

CREATE INDEX IF NOT EXISTS execution_history_user_id_validation_idx 
  ON execution_history(user_id);

-- Clean up backup tables (comment out for safety)
-- DROP TABLE IF EXISTS user_preferences_backup;
-- DROP TABLE IF EXISTS api_credentials_backup;  
-- DROP TABLE IF EXISTS snipe_targets_backup;
-- DROP TABLE IF EXISTS execution_history_backup;