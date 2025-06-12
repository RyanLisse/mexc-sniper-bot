-- Performance optimization indexes based on CODEBASE_IMPROVEMENT_PLAN.md
-- Note: This migration contains a single compound index to avoid SQLite multi-statement issues
-- Additional indexes are in subsequent migration files

-- Price history queries optimization
CREATE INDEX IF NOT EXISTS monitored_listings_status_launch_idx 
  ON monitored_listings(status, first_open_time);