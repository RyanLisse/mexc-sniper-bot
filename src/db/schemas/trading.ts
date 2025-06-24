import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// ===========================================
// TRADING SCHEMA MODULE
// ===========================================

// API Credentials Table
export const apiCredentials = pgTable(
  "api_credentials",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // "mexc", "binance", etc.

    // Encrypted credentials
    encryptedApiKey: text("encrypted_api_key").notNull(),
    encryptedSecretKey: text("encrypted_secret_key").notNull(),
    encryptedPassphrase: text("encrypted_passphrase"), // For some exchanges

    // Status
    isActive: boolean("is_active").notNull().default(true),
    lastUsed: timestamp("last_used"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userProviderIdx: index("api_credentials_user_provider_idx").on(table.userId, table.provider),
  })
);

// Snipe Targets Table
export const snipeTargets = pgTable(
  "snipe_targets",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    vcoinId: text("vcoin_id").notNull(),
    symbolName: text("symbol_name").notNull(),

    // Target Configuration
    entryStrategy: text("entry_strategy").notNull().default("market"), // "market", "limit"
    entryPrice: real("entry_price"), // For limit orders
    positionSizeUsdt: real("position_size_usdt").notNull(),

    // Take Profit Configuration
    takeProfitLevel: integer("take_profit_level").notNull().default(2), // Which level from user preferences
    takeProfitCustom: real("take_profit_custom"), // Custom take profit %
    stopLossPercent: real("stop_loss_percent").notNull(),

    // Execution Details
    status: text("status").notNull().default("pending"), // "pending", "ready", "executing", "completed", "failed", "cancelled"
    priority: integer("priority").notNull().default(1), // 1=highest, 5=lowest
    maxRetries: integer("max_retries").notNull().default(3),
    currentRetries: integer("current_retries").notNull().default(0),

    // Timing
    targetExecutionTime: timestamp("target_execution_time"),
    actualExecutionTime: timestamp("actual_execution_time"),

    // Results
    executionPrice: real("execution_price"),
    actualPositionSize: real("actual_position_size"),
    executionStatus: text("execution_status"), // "success", "partial", "failed"
    errorMessage: text("error_message"),

    // Metadata
    confidenceScore: real("confidence_score").notNull().default(0.0),
    riskLevel: text("risk_level").notNull().default("medium"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdx: index("snipe_targets_user_idx").on(table.userId),
    statusIdx: index("snipe_targets_status_idx").on(table.status),
    priorityIdx: index("snipe_targets_priority_idx").on(table.priority),
    executionTimeIdx: index("snipe_targets_execution_time_idx").on(table.targetExecutionTime),
    // Compound indexes for optimization
    userStatusPriorityIdx: index("snipe_targets_user_status_priority_idx").on(
      table.userId,
      table.status,
      table.priority
    ),
    statusExecutionTimeIdx: index("snipe_targets_status_execution_time_idx").on(
      table.status,
      table.targetExecutionTime
    ),
  })
);

// Execution History Table
export const executionHistory = pgTable(
  "execution_history",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    snipeTargetId: integer("snipe_target_id").references(() => snipeTargets.id, {
      onDelete: "set null",
    }),

    // Execution Details
    vcoinId: text("vcoin_id").notNull(),
    symbolName: text("symbol_name").notNull(),
    action: text("action").notNull(), // "buy", "sell", "cancel"

    // Order Information
    orderType: text("order_type").notNull(), // "market", "limit"
    orderSide: text("order_side").notNull(), // "buy", "sell"
    requestedQuantity: real("requested_quantity").notNull(),
    requestedPrice: real("requested_price"),

    // Execution Results
    executedQuantity: real("executed_quantity"),
    executedPrice: real("executed_price"),
    totalCost: real("total_cost"),
    fees: real("fees"),

    // Exchange Response
    exchangeOrderId: text("exchange_order_id"),
    exchangeStatus: text("exchange_status"),
    exchangeResponse: text("exchange_response"), // JSON response from exchange

    // Performance Metrics
    executionLatencyMs: integer("execution_latency_ms"),
    slippagePercent: real("slippage_percent"),

    // Status
    status: text("status").notNull(), // "success", "partial", "failed", "cancelled"
    errorCode: text("error_code"),
    errorMessage: text("error_message"),

    // Timestamps
    requestedAt: timestamp("requested_at").notNull(),
    executedAt: timestamp("executed_at"),
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdx: index("execution_history_user_idx").on(table.userId),
    snipeTargetIdx: index("execution_history_snipe_target_idx").on(table.snipeTargetId),
    symbolIdx: index("execution_history_symbol_idx").on(table.symbolName),
    statusIdx: index("execution_history_status_idx").on(table.status),
    executedAtIdx: index("execution_history_executed_at_idx").on(table.executedAt),
    // Compound indexes for optimization
    userSymbolTimeIdx: index("execution_history_user_symbol_time_idx").on(
      table.userId,
      table.symbolName,
      table.executedAt
    ),
    userStatusActionIdx: index("execution_history_user_status_action_idx").on(
      table.userId,
      table.status,
      table.action
    ),
    snipeTargetActionStatusIdx: index("execution_history_snipe_target_action_status_idx").on(
      table.snipeTargetId,
      table.action,
      table.status
    ),
  })
);

// Transactions Table - Simplified profit/loss tracking
export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Transaction Details
    transactionType: text("transaction_type").notNull(), // "buy", "sell", "complete_trade"
    symbolName: text("symbol_name").notNull(),
    vcoinId: text("vcoin_id"),

    // Buy Transaction Details
    buyPrice: real("buy_price"),
    buyQuantity: real("buy_quantity"),
    buyTotalCost: real("buy_total_cost"), // Including fees
    buyTimestamp: timestamp("buy_timestamp"),
    buyOrderId: text("buy_order_id"),

    // Sell Transaction Details
    sellPrice: real("sell_price"),
    sellQuantity: real("sell_quantity"),
    sellTotalRevenue: real("sell_total_revenue"), // After fees
    sellTimestamp: timestamp("sell_timestamp"),
    sellOrderId: text("sell_order_id"),

    // Profit/Loss Calculation
    profitLoss: real("profit_loss"), // sellTotalRevenue - buyTotalCost
    profitLossPercentage: real("profit_loss_percentage"), // (profitLoss / buyTotalCost) * 100
    fees: real("fees"), // Total fees for the transaction

    // Transaction Status
    status: text("status").notNull().default("pending"), // "pending", "completed", "failed", "cancelled"

    // Metadata
    snipeTargetId: integer("snipe_target_id").references(() => snipeTargets.id, {
      onDelete: "set null",
    }),
    notes: text("notes"), // Optional notes about the transaction

    // Timestamps
    transactionTime: timestamp("transaction_time").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdx: index("transactions_user_idx").on(table.userId),
    symbolIdx: index("transactions_symbol_idx").on(table.symbolName),
    statusIdx: index("transactions_status_idx").on(table.status),
    transactionTimeIdx: index("transactions_transaction_time_idx").on(table.transactionTime),
    typeIdx: index("transactions_type_idx").on(table.transactionType),
    // Compound indexes for optimization
    userStatusIdx: index("transactions_user_status_idx").on(table.userId, table.status),
    userTimeIdx: index("transactions_user_time_idx").on(table.userId, table.transactionTime),
    symbolTimeIdx: index("transactions_symbol_time_idx").on(
      table.symbolName,
      table.transactionTime
    ),
  })
);

// Transaction Lock Tables
export const transactionLocks = pgTable(
  "transaction_locks",
  {
    id: serial("id").primaryKey(),
    lockId: text("lock_id").notNull().unique(), // UUID for the lock
    resourceId: text("resource_id").notNull(), // What we're locking (e.g., "trade:BTCUSDT:BUY")
    idempotencyKey: text("idempotency_key").notNull().unique(), // Prevent duplicate requests

    // Lock ownership
    ownerId: text("owner_id").notNull(), // Who owns this lock (userId or sessionId)
    ownerType: text("owner_type").notNull(), // "user", "system", "workflow"

    // Lock timing
    acquiredAt: timestamp("acquired_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    expiresAt: timestamp("expires_at").notNull(),
    releasedAt: timestamp("released_at"),

    // Lock status
    status: text("status").notNull().default("active"), // "active", "released", "expired", "failed"
    lockType: text("lock_type").notNull().default("exclusive"), // "exclusive", "shared"

    // Transaction details
    transactionType: text("transaction_type").notNull(), // "trade", "cancel", "update"
    transactionData: text("transaction_data").notNull(), // JSON data about the transaction

    // Retry and timeout config
    maxRetries: integer("max_retries").notNull().default(3),
    currentRetries: integer("current_retries").notNull().default(0),
    timeoutMs: integer("timeout_ms").notNull().default(30000), // 30 seconds default

    // Result tracking
    result: text("result"), // JSON result of the transaction
    errorMessage: text("error_message"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    resourceIdIdx: index("transaction_locks_resource_id_idx").on(table.resourceId),
    statusIdx: index("transaction_locks_status_idx").on(table.status),
    expiresAtIdx: index("transaction_locks_expires_at_idx").on(table.expiresAt),
    idempotencyKeyIdx: index("transaction_locks_idempotency_key_idx").on(table.idempotencyKey),
    ownerIdIdx: index("transaction_locks_owner_id_idx").on(table.ownerId),
    // Compound indexes for common queries
    resourceStatusIdx: index("transaction_locks_resource_status_idx").on(
      table.resourceId,
      table.status
    ),
    ownerStatusIdx: index("transaction_locks_owner_status_idx").on(table.ownerId, table.status),
  })
);

// Transaction Queue Table
export const transactionQueue = pgTable(
  "transaction_queue",
  {
    id: serial("id").primaryKey(),
    queueId: text("queue_id").notNull().unique(), // UUID for the queue item
    lockId: text("lock_id").references(() => transactionLocks.lockId, { onDelete: "set null" }),

    // Queue item details
    resourceId: text("resource_id").notNull(),
    priority: integer("priority").notNull().default(5), // 1=highest, 10=lowest

    // Transaction details
    transactionType: text("transaction_type").notNull(),
    transactionData: text("transaction_data").notNull(), // JSON
    idempotencyKey: text("idempotency_key").notNull(),

    // Queue status
    status: text("status").notNull().default("pending"), // "pending", "processing", "completed", "failed", "cancelled"

    // Timing
    queuedAt: timestamp("queued_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    processingStartedAt: timestamp("processing_started_at"),
    completedAt: timestamp("completed_at"),

    // Result
    result: text("result"), // JSON result
    errorMessage: text("error_message"),
    attempts: integer("attempts").notNull().default(0),

    // Owner info
    ownerId: text("owner_id").notNull(),
    ownerType: text("owner_type").notNull(),

    // Timestamps
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    resourceIdIdx: index("transaction_queue_resource_id_idx").on(table.resourceId),
    statusIdx: index("transaction_queue_status_idx").on(table.status),
    priorityIdx: index("transaction_queue_priority_idx").on(table.priority),
    queuedAtIdx: index("transaction_queue_queued_at_idx").on(table.queuedAt),
    idempotencyKeyIdx: index("transaction_queue_idempotency_key_idx").on(table.idempotencyKey),
    // Compound indexes
    statusPriorityIdx: index("transaction_queue_status_priority_idx").on(
      table.status,
      table.priority,
      table.queuedAt
    ),
    resourceStatusIdx: index("transaction_queue_resource_status_idx").on(
      table.resourceId,
      table.status
    ),
  })
);

// Balance Snapshots Table - Critical for balance data persistence
export const balanceSnapshots = pgTable(
  "balance_snapshots",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    
    // Balance Details
    asset: text("asset").notNull(), // e.g., "USDT", "BTC", "ETH"
    freeAmount: real("free_amount").notNull().default(0),
    lockedAmount: real("locked_amount").notNull().default(0),
    totalAmount: real("total_amount").notNull().default(0),
    
    // USD Value
    usdValue: real("usd_value").notNull().default(0),
    priceSource: text("price_source").notNull().default("mexc"), // "mexc", "coingecko", "manual"
    exchangeRate: real("exchange_rate"), // Rate used for USD conversion
    
    // Snapshot Metadata
    snapshotType: text("snapshot_type").notNull().default("periodic"), // "periodic", "manual", "triggered"
    dataSource: text("data_source").notNull().default("api"), // "api", "manual", "calculated"
    
    // Timestamps
    timestamp: timestamp("timestamp").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    // Primary indexes for performance
    userIdx: index("balance_snapshots_user_idx").on(table.userId),
    assetIdx: index("balance_snapshots_asset_idx").on(table.asset),
    timestampIdx: index("balance_snapshots_timestamp_idx").on(table.timestamp),
    
    // Compound indexes for common queries
    userTimeIdx: index("balance_snapshots_user_time_idx").on(table.userId, table.timestamp),
    userAssetTimeIdx: index("balance_snapshots_user_asset_time_idx").on(
      table.userId, 
      table.asset, 
      table.timestamp
    ),
    assetTimeIdx: index("balance_snapshots_asset_time_idx").on(table.asset, table.timestamp),
    
    // Performance indexes
    snapshotTypeIdx: index("balance_snapshots_snapshot_type_idx").on(table.snapshotType),
    dataSourceIdx: index("balance_snapshots_data_source_idx").on(table.dataSource),
  })
);

// Portfolio Summary Table - Aggregated balance tracking
export const portfolioSummary = pgTable(
  "portfolio_summary",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    
    // Portfolio Metrics
    totalUsdValue: real("total_usd_value").notNull().default(0),
    assetCount: integer("asset_count").notNull().default(0),
    performance24h: real("performance_24h").default(0), // % change in 24h
    performance7d: real("performance_7d").default(0), // % change in 7 days
    performance30d: real("performance_30d").default(0), // % change in 30 days
    
    // Top Assets (JSON for flexibility)
    topAssets: text("top_assets"), // JSON array of top 5 assets by value
    
    // Update tracking
    lastBalanceUpdate: timestamp("last_balance_update").notNull(),
    lastCalculated: timestamp("last_calculated").notNull().default(sql`CURRENT_TIMESTAMP`),
    
    // Timestamps
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdx: index("portfolio_summary_user_idx").on(table.userId),
    lastUpdatedIdx: index("portfolio_summary_last_updated_idx").on(table.lastBalanceUpdate),
    lastCalculatedIdx: index("portfolio_summary_last_calculated_idx").on(table.lastCalculated),
  })
);

// Trading Types
export type ApiCredentials = typeof apiCredentials.$inferSelect;
export type NewApiCredentials = typeof apiCredentials.$inferInsert;

export type SnipeTarget = typeof snipeTargets.$inferSelect;
export type NewSnipeTarget = typeof snipeTargets.$inferInsert;

export type ExecutionHistory = typeof executionHistory.$inferSelect;
export type NewExecutionHistory = typeof executionHistory.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type TransactionLock = typeof transactionLocks.$inferSelect;
export type NewTransactionLock = typeof transactionLocks.$inferInsert;

export type TransactionQueue = typeof transactionQueue.$inferSelect;
export type NewTransactionQueue = typeof transactionQueue.$inferInsert;

export type BalanceSnapshot = typeof balanceSnapshots.$inferSelect;
export type NewBalanceSnapshot = typeof balanceSnapshots.$inferInsert;

export type PortfolioSummary = typeof portfolioSummary.$inferSelect;
export type NewPortfolioSummary = typeof portfolioSummary.$inferInsert;
