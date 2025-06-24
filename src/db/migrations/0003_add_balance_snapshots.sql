-- Balance Snapshots Table for persistent balance data storage
CREATE TABLE "balance_snapshots" (
  "id" SERIAL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "asset" TEXT NOT NULL,
  "free_amount" REAL NOT NULL DEFAULT 0,
  "locked_amount" REAL NOT NULL DEFAULT 0,
  "total_amount" REAL NOT NULL DEFAULT 0,
  "usd_value" REAL NOT NULL DEFAULT 0,
  "price_source" TEXT NOT NULL DEFAULT 'mexc',
  "exchange_rate" REAL,
  "snapshot_type" TEXT NOT NULL DEFAULT 'periodic',
  "data_source" TEXT NOT NULL DEFAULT 'api',
  "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "balance_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

-- Portfolio Summary Table for aggregated balance tracking
CREATE TABLE "portfolio_summary" (
  "id" SERIAL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "total_usd_value" REAL NOT NULL DEFAULT 0,
  "asset_count" INTEGER NOT NULL DEFAULT 0,
  "performance_24h" REAL DEFAULT 0,
  "performance_7d" REAL DEFAULT 0,
  "performance_30d" REAL DEFAULT 0,
  "top_assets" TEXT,
  "last_balance_update" TIMESTAMP NOT NULL,
  "last_calculated" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "portfolio_summary_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

-- Indexes for balance_snapshots table
CREATE INDEX "balance_snapshots_user_idx" ON "balance_snapshots" ("user_id");
CREATE INDEX "balance_snapshots_asset_idx" ON "balance_snapshots" ("asset");
CREATE INDEX "balance_snapshots_timestamp_idx" ON "balance_snapshots" ("timestamp");
CREATE INDEX "balance_snapshots_user_time_idx" ON "balance_snapshots" ("user_id", "timestamp");
CREATE INDEX "balance_snapshots_user_asset_time_idx" ON "balance_snapshots" ("user_id", "asset", "timestamp");
CREATE INDEX "balance_snapshots_asset_time_idx" ON "balance_snapshots" ("asset", "timestamp");
CREATE INDEX "balance_snapshots_snapshot_type_idx" ON "balance_snapshots" ("snapshot_type");
CREATE INDEX "balance_snapshots_data_source_idx" ON "balance_snapshots" ("data_source");

-- Indexes for portfolio_summary table
CREATE INDEX "portfolio_summary_user_idx" ON "portfolio_summary" ("user_id");
CREATE INDEX "portfolio_summary_last_updated_idx" ON "portfolio_summary" ("last_balance_update");
CREATE INDEX "portfolio_summary_last_calculated_idx" ON "portfolio_summary" ("last_calculated");

-- Add constraint to ensure balance consistency
ALTER TABLE "balance_snapshots" 
ADD CONSTRAINT "balance_consistency_check" 
CHECK ("free_amount" + "locked_amount" = "total_amount");

-- Add constraint to ensure non-negative values
ALTER TABLE "balance_snapshots"
ADD CONSTRAINT "non_negative_amounts_check"
CHECK ("free_amount" >= 0 AND "locked_amount" >= 0 AND "total_amount" >= 0 AND "usd_value" >= 0);

-- Add constraint to ensure valid asset names
ALTER TABLE "balance_snapshots"
ADD CONSTRAINT "valid_asset_name_check"
CHECK (LENGTH("asset") >= 1 AND LENGTH("asset") <= 20);

-- Add constraint to ensure valid snapshot types
ALTER TABLE "balance_snapshots"
ADD CONSTRAINT "valid_snapshot_type_check"
CHECK ("snapshot_type" IN ('periodic', 'manual', 'triggered'));

-- Add constraint to ensure valid data sources
ALTER TABLE "balance_snapshots"
ADD CONSTRAINT "valid_data_source_check"
CHECK ("data_source" IN ('api', 'manual', 'calculated'));

-- Add constraint to ensure valid price sources
ALTER TABLE "balance_snapshots"
ADD CONSTRAINT "valid_price_source_check"
CHECK ("price_source" IN ('mexc', 'coingecko', 'manual', 'binance', 'coinbase'));