-- Migration to add missing compound indexes for performance optimization
-- This fixes N+1 query issues and improves common query patterns

-- High-priority indexes for execution_history table
CREATE INDEX IF NOT EXISTS execution_history_user_symbol_time_idx 
  ON execution_history(user_id, symbol_name, executed_at DESC);

CREATE INDEX IF NOT EXISTS execution_history_user_status_action_idx 
  ON execution_history(user_id, status, action);

CREATE INDEX IF NOT EXISTS execution_history_snipe_target_action_status_idx 
  ON execution_history(snipe_target_id, action, status);

-- High-priority indexes for snipe_targets table
CREATE INDEX IF NOT EXISTS snipe_targets_user_status_priority_idx 
  ON snipe_targets(user_id, status, priority);

CREATE INDEX IF NOT EXISTS snipe_targets_status_execution_time_idx 
  ON snipe_targets(status, target_execution_time);

-- Indexes for monitored_listings table
CREATE INDEX IF NOT EXISTS monitored_listings_status_launch_idx 
  ON monitored_listings(status, first_open_time);

CREATE INDEX IF NOT EXISTS monitored_listings_ready_pattern_status_idx 
  ON monitored_listings(has_ready_pattern, status);

-- Indexes for workflow_activity table  
CREATE INDEX IF NOT EXISTS workflow_activity_user_timestamp_idx 
  ON workflow_activity(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS workflow_activity_type_timestamp_idx 
  ON workflow_activity(type, timestamp DESC);

-- Indexes for user_preferences table
CREATE INDEX IF NOT EXISTS user_preferences_user_auto_flags_idx 
  ON user_preferences(user_id, auto_snipe_enabled, auto_buy_enabled, auto_sell_enabled);