import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Better Auth Tables
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  username: text("username").unique(), // For username plugin
  displayUsername: text("displayUsername"), // For username plugin
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// User Preferences Table
export const userPreferences = sqliteTable(
  "user_preferences",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),

    // Trading Configuration
    defaultBuyAmountUsdt: real("default_buy_amount_usdt").notNull().default(100.0),
    maxConcurrentSnipes: integer("max_concurrent_snipes").notNull().default(3),

    // Take Profit Configuration (user configurable)
    takeProfitLevel1: real("take_profit_level_1").notNull().default(5.0), // 5%
    takeProfitLevel2: real("take_profit_level_2").notNull().default(10.0), // 10%
    takeProfitLevel3: real("take_profit_level_3").notNull().default(15.0), // 15%
    takeProfitLevel4: real("take_profit_level_4").notNull().default(25.0), // 25%
    takeProfitCustom: real("take_profit_custom"), // Custom %
    defaultTakeProfitLevel: integer("default_take_profit_level").notNull().default(2), // Use level 2 (10%) by default

    // Risk Management
    stopLossPercent: real("stop_loss_percent").notNull().default(5.0),
    riskTolerance: text("risk_tolerance").notNull().default("medium"), // "low", "medium", "high"

    // Pattern Discovery Settings
    readyStatePattern: text("ready_state_pattern").notNull().default("2,2,4"), // sts:2, st:2, tt:4
    targetAdvanceHours: real("target_advance_hours").notNull().default(3.5),
    autoSnipeEnabled: integer("auto_snipe_enabled", { mode: "boolean" }).notNull().default(true), // Auto-snipe by default

    // Exit Strategy Settings
    selectedExitStrategy: text("selected_exit_strategy").notNull().default("balanced"), // "conservative", "balanced", "aggressive", "custom"
    customExitStrategy: text("custom_exit_strategy"), // JSON string of custom strategy levels
    autoBuyEnabled: integer("auto_buy_enabled", { mode: "boolean" }).notNull().default(true), // Auto-buy on ready state
    autoSellEnabled: integer("auto_sell_enabled", { mode: "boolean" }).notNull().default(true), // Auto-sell at targets

    // Monitoring Intervals
    calendarPollIntervalSeconds: integer("calendar_poll_interval_seconds").notNull().default(300),
    symbolsPollIntervalSeconds: integer("symbols_poll_interval_seconds").notNull().default(30),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("user_preferences_user_id_idx").on(table.userId),
  })
);

// API Credentials Table
export const apiCredentials = sqliteTable(
  "api_credentials",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // "mexc", "binance", etc.

    // Encrypted credentials
    encryptedApiKey: text("encrypted_api_key").notNull(),
    encryptedSecretKey: text("encrypted_secret_key").notNull(),
    encryptedPassphrase: text("encrypted_passphrase"), // For some exchanges

    // Status
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    lastUsed: integer("last_used", { mode: "timestamp" }),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    userProviderIdx: index("api_credentials_user_provider_idx").on(table.userId, table.provider),
  })
);

// Monitored Listings Table
export const monitoredListings = sqliteTable(
  "monitored_listings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    vcoinId: text("vcoin_id").notNull().unique(),
    symbolName: text("symbol_name").notNull(),
    projectName: text("project_name"),

    // Launch Details
    firstOpenTime: integer("first_open_time").notNull(), // Unix timestamp in milliseconds
    estimatedLaunchTime: integer("estimated_launch_time"), // Calculated launch time

    // Status
    status: text("status").notNull().default("monitoring"), // "monitoring", "ready", "launched", "completed", "failed"
    confidence: real("confidence").notNull().default(0.0), // 0-100 confidence score

    // Pattern Data
    patternSts: integer("pattern_sts"), // Symbol trading status
    patternSt: integer("pattern_st"), // Symbol state
    patternTt: integer("pattern_tt"), // Trading time status
    hasReadyPattern: integer("has_ready_pattern", { mode: "boolean" }).notNull().default(false),

    // Discovery Information
    discoveredAt: integer("discovered_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    lastChecked: integer("last_checked", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),

    // Trading Data
    tradingPairs: text("trading_pairs"), // JSON array of trading pairs
    priceData: text("price_data"), // JSON price information
    volumeData: text("volume_data"), // JSON volume information

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    vcoinIdIdx: index("monitored_listings_vcoin_id_idx").on(table.vcoinId),
    statusIdx: index("monitored_listings_status_idx").on(table.status),
    launchTimeIdx: index("monitored_listings_launch_time_idx").on(table.firstOpenTime),
    readyPatternIdx: index("monitored_listings_ready_pattern_idx").on(table.hasReadyPattern),
  })
);

// Snipe Targets Table
export const snipeTargets = sqliteTable(
  "snipe_targets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
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
    targetExecutionTime: integer("target_execution_time", { mode: "timestamp" }),
    actualExecutionTime: integer("actual_execution_time", { mode: "timestamp" }),

    // Results
    executionPrice: real("execution_price"),
    actualPositionSize: real("actual_position_size"),
    executionStatus: text("execution_status"), // "success", "partial", "failed"
    errorMessage: text("error_message"),

    // Metadata
    confidenceScore: real("confidence_score").notNull().default(0.0),
    riskLevel: text("risk_level").notNull().default("medium"),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
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
export const executionHistory = sqliteTable(
  "execution_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
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
    requestedAt: integer("requested_at", { mode: "timestamp" }).notNull(),
    executedAt: integer("executed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
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

// Workflow System Status Table
export const workflowSystemStatus = sqliteTable(
  "workflow_system_status",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull().default("default"), // Support multi-user in future

    // System Status
    systemStatus: text("system_status").notNull().default("stopped"), // "running", "stopped", "error"
    lastUpdate: integer("last_update", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),

    // Active Workflows
    activeWorkflows: text("active_workflows").notNull().default("[]"), // JSON array of workflow IDs

    // Metrics
    readyTokens: integer("ready_tokens").notNull().default(0),
    totalDetections: integer("total_detections").notNull().default(0),
    successfulSnipes: integer("successful_snipes").notNull().default(0),
    totalProfit: real("total_profit").notNull().default(0),
    successRate: real("success_rate").notNull().default(0),
    averageROI: real("average_roi").notNull().default(0),
    bestTrade: real("best_trade").notNull().default(0),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("workflow_system_status_user_id_idx").on(table.userId),
  })
);

// Workflow Activity Log Table
export const workflowActivity = sqliteTable(
  "workflow_activity",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull().default("default"),
    activityId: text("activity_id").notNull().unique(), // UUID

    // Activity Details
    type: text("type").notNull(), // "pattern", "calendar", "snipe", "analysis"
    message: text("message").notNull(),

    // Metadata
    workflowId: text("workflow_id"), // Associated workflow if any
    symbolName: text("symbol_name"), // Associated symbol if any
    vcoinId: text("vcoin_id"), // Associated vcoin if any

    // Status
    level: text("level").notNull().default("info"), // "info", "warning", "error", "success"

    // Timestamps
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("workflow_activity_user_id_idx").on(table.userId),
    activityIdIdx: index("workflow_activity_activity_id_idx").on(table.activityId),
    typeIdx: index("workflow_activity_type_idx").on(table.type),
    timestampIdx: index("workflow_activity_timestamp_idx").on(table.timestamp),
  })
);

// Transactions Table - Simplified profit/loss tracking
export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
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
    buyTimestamp: integer("buy_timestamp", { mode: "timestamp" }),
    buyOrderId: text("buy_order_id"),

    // Sell Transaction Details
    sellPrice: real("sell_price"),
    sellQuantity: real("sell_quantity"),
    sellTotalRevenue: real("sell_total_revenue"), // After fees
    sellTimestamp: integer("sell_timestamp", { mode: "timestamp" }),
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
    transactionTime: integer("transaction_time", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
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
export const transactionLocks = sqliteTable(
  "transaction_locks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    lockId: text("lock_id").notNull().unique(), // UUID for the lock
    resourceId: text("resource_id").notNull(), // What we're locking (e.g., "trade:BTCUSDT:BUY")
    idempotencyKey: text("idempotency_key").notNull().unique(), // Prevent duplicate requests

    // Lock ownership
    ownerId: text("owner_id").notNull(), // Who owns this lock (userId or sessionId)
    ownerType: text("owner_type").notNull(), // "user", "system", "workflow"

    // Lock timing
    acquiredAt: integer("acquired_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    releasedAt: integer("released_at", { mode: "timestamp" }),

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
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
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
export const transactionQueue = sqliteTable(
  "transaction_queue",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    queueId: text("queue_id").notNull().unique(), // UUID for the queue item
    lockId: text("lock_id").references(() => transactionLocks.lockId),

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
    queuedAt: integer("queued_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    processingStartedAt: integer("processing_started_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),

    // Result
    result: text("result"), // JSON result
    errorMessage: text("error_message"),
    attempts: integer("attempts").notNull().default(0),

    // Owner info
    ownerId: text("owner_id").notNull(),
    ownerType: text("owner_type").notNull(),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
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

// Types for TypeScript

// Auth Types
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;

export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;

// App Types
export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;

export type ApiCredentials = typeof apiCredentials.$inferSelect;
export type NewApiCredentials = typeof apiCredentials.$inferInsert;

export type MonitoredListing = typeof monitoredListings.$inferSelect;
export type NewMonitoredListing = typeof monitoredListings.$inferInsert;

export type SnipeTarget = typeof snipeTargets.$inferSelect;
export type NewSnipeTarget = typeof snipeTargets.$inferInsert;

export type ExecutionHistory = typeof executionHistory.$inferSelect;
export type NewExecutionHistory = typeof executionHistory.$inferInsert;

export type WorkflowSystemStatus = typeof workflowSystemStatus.$inferSelect;
export type NewWorkflowSystemStatus = typeof workflowSystemStatus.$inferInsert;

export type WorkflowActivity = typeof workflowActivity.$inferSelect;
export type NewWorkflowActivity = typeof workflowActivity.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

// Transaction Lock Types
export type TransactionLock = typeof transactionLocks.$inferSelect;
export type NewTransactionLock = typeof transactionLocks.$inferInsert;

export type TransactionQueue = typeof transactionQueue.$inferSelect;
export type NewTransactionQueue = typeof transactionQueue.$inferInsert;

// ===========================================
// SAFETY SYSTEM TABLES
// ===========================================

// Simulation Sessions Table
export const simulationSessions = sqliteTable(
  "simulation_sessions",
  {
    id: text("id").primaryKey(), // sim-{timestamp}-{random}
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    
    // Session Configuration
    startTime: integer("start_time", { mode: "timestamp" }).notNull(),
    endTime: integer("end_time", { mode: "timestamp" }),
    virtualBalance: real("virtual_balance").notNull(), // Starting balance in USDT
    
    // Session Results
    currentBalance: real("current_balance").notNull(),
    finalBalance: real("final_balance"), // Set when session ends
    totalTrades: integer("total_trades").notNull().default(0),
    profitLoss: real("profit_loss").notNull().default(0),
    winRate: real("win_rate").notNull().default(0), // Percentage
    maxDrawdown: real("max_drawdown").notNull().default(0), // Percentage
    bestTrade: real("best_trade").notNull().default(0),
    worstTrade: real("worst_trade").notNull().default(0),
    
    // Session Status
    status: text("status").notNull().default("active"), // "active", "completed", "terminated"
    
    // Configuration
    tradingFees: real("trading_fees").notNull().default(0.001), // 0.1%
    slippage: real("slippage").notNull().default(0.0005), // 0.05%
    
    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("simulation_sessions_user_id_idx").on(table.userId),
    statusIdx: index("simulation_sessions_status_idx").on(table.status),
    startTimeIdx: index("simulation_sessions_start_time_idx").on(table.startTime),
  })
);

// Simulation Trades Table
export const simulationTrades = sqliteTable(
  "simulation_trades",
  {
    id: text("id").primaryKey(), // trade-{timestamp}-{random}
    sessionId: text("session_id")
      .notNull()
      .references(() => simulationSessions.id, { onDelete: "cascade" }),
    
    // Trade Details
    symbol: text("symbol").notNull(),
    type: text("type").notNull(), // "buy", "sell"
    quantity: real("quantity").notNull(),
    price: real("price").notNull(),
    value: real("value").notNull(), // quantity * price
    fees: real("fees").notNull(),
    
    // Execution Details
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
    strategy: text("strategy").notNull(), // Which strategy triggered this trade
    
    // P&L Tracking (for closed positions)
    realized: integer("realized", { mode: "boolean" }).notNull().default(false),
    profitLoss: real("profit_loss"), // Set when position is closed
    exitPrice: real("exit_price"), // Price when position was closed
    exitTimestamp: integer("exit_timestamp", { mode: "timestamp" }),
    
    // Metadata
    slippagePercent: real("slippage_percent"),
    marketImpactPercent: real("market_impact_percent"),
    
    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    sessionIdIdx: index("simulation_trades_session_id_idx").on(table.sessionId),
    symbolIdx: index("simulation_trades_symbol_idx").on(table.symbol),
    timestampIdx: index("simulation_trades_timestamp_idx").on(table.timestamp),
    typeIdx: index("simulation_trades_type_idx").on(table.type),
    realizedIdx: index("simulation_trades_realized_idx").on(table.realized),
  })
);

// Risk Events Table
export const riskEvents = sqliteTable(
  "risk_events",
  {
    id: text("id").primaryKey(), // risk-{timestamp}-{random}
    userId: text("user_id").notNull().default("default"),
    
    // Event Classification
    eventType: text("event_type").notNull(), // "circuit_breaker", "position_limit", "loss_limit", "volatility_spike"
    severity: text("severity").notNull(), // "low", "medium", "high", "critical"
    
    // Event Details
    description: text("description").notNull(),
    circuitBreakerId: text("circuit_breaker_id"), // If related to a specific circuit breaker
    
    // Risk Metrics at Time of Event
    totalExposure: real("total_exposure"),
    dailyPnL: real("daily_pnl"),
    openPositions: integer("open_positions"),
    riskPercentage: real("risk_percentage"),
    volatilityIndex: real("volatility_index"),
    
    // Action Taken
    actionTaken: text("action_taken").notNull(), // "warn", "halt_new", "halt_all", "emergency_exit"
    actionDetails: text("action_details"), // JSON with additional action details
    
    // Resolution
    resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    resolution: text("resolution"),
    
    // Timestamps
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("risk_events_user_id_idx").on(table.userId),
    eventTypeIdx: index("risk_events_event_type_idx").on(table.eventType),
    severityIdx: index("risk_events_severity_idx").on(table.severity),
    timestampIdx: index("risk_events_timestamp_idx").on(table.timestamp),
    resolvedIdx: index("risk_events_resolved_idx").on(table.resolved),
    // Compound indexes
    userSeverityIdx: index("risk_events_user_severity_idx").on(table.userId, table.severity),
    typeTimestampIdx: index("risk_events_type_timestamp_idx").on(table.eventType, table.timestamp),
  })
);

// Position Snapshots Table (for reconciliation)
export const positionSnapshots = sqliteTable(
  "position_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    
    // Snapshot Details
    snapshotId: text("snapshot_id").notNull().unique(), // UUID
    source: text("source").notNull(), // "local", "exchange"
    
    // Position Data
    symbol: text("symbol").notNull(),
    quantity: real("quantity").notNull(),
    averagePrice: real("average_price").notNull(),
    marketValue: real("market_value").notNull(),
    unrealizedPnL: real("unrealized_pnl").notNull(),
    
    // Balance Data (if this is a balance snapshot)
    currency: text("currency"), // USDT, BTC, etc.
    totalBalance: real("total_balance"),
    availableBalance: real("available_balance"),
    lockedBalance: real("locked_balance"),
    
    // Snapshot Metadata
    snapshotType: text("snapshot_type").notNull(), // "position", "balance", "full"
    reconciliationId: text("reconciliation_id"), // Links to reconciliation report
    
    // Timestamps
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("position_snapshots_user_id_idx").on(table.userId),
    snapshotIdIdx: index("position_snapshots_snapshot_id_idx").on(table.snapshotId),
    sourceIdx: index("position_snapshots_source_idx").on(table.source),
    symbolIdx: index("position_snapshots_symbol_idx").on(table.symbol),
    timestampIdx: index("position_snapshots_timestamp_idx").on(table.timestamp),
    reconciliationIdIdx: index("position_snapshots_reconciliation_id_idx").on(table.reconciliationId),
    // Compound indexes
    sourceTimestampIdx: index("position_snapshots_source_timestamp_idx").on(table.source, table.timestamp),
    userSymbolIdx: index("position_snapshots_user_symbol_idx").on(table.userId, table.symbol),
  })
);

// Reconciliation Reports Table
export const reconciliationReports = sqliteTable(
  "reconciliation_reports",
  {
    id: text("id").primaryKey(), // recon-{timestamp}-{random}
    userId: text("user_id").notNull().default("default"),
    
    // Report Details
    startTime: integer("start_time", { mode: "timestamp" }).notNull(),
    endTime: integer("end_time", { mode: "timestamp" }).notNull(),
    
    // Reconciliation Results
    totalChecks: integer("total_checks").notNull(),
    discrepanciesFound: integer("discrepancies_found").notNull(),
    criticalIssues: integer("critical_issues").notNull(),
    autoResolved: integer("auto_resolved").notNull(),
    manualReviewRequired: integer("manual_review_required").notNull(),
    
    // Overall Status
    overallStatus: text("overall_status").notNull(), // "clean", "minor_issues", "major_issues", "critical"
    
    // Report Data
    discrepancies: text("discrepancies").notNull(), // JSON array of discrepancy objects
    recommendations: text("recommendations").notNull(), // JSON array of recommendation strings
    
    // Processing Details
    triggeredBy: text("triggered_by").notNull().default("scheduled"), // "scheduled", "manual", "alert"
    processingTimeMs: integer("processing_time_ms"),
    
    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("reconciliation_reports_user_id_idx").on(table.userId),
    startTimeIdx: index("reconciliation_reports_start_time_idx").on(table.startTime),
    overallStatusIdx: index("reconciliation_reports_overall_status_idx").on(table.overallStatus),
    criticalIssuesIdx: index("reconciliation_reports_critical_issues_idx").on(table.criticalIssues),
  })
);

// Error Incidents Table
export const errorIncidents = sqliteTable(
  "error_incidents",
  {
    id: text("id").primaryKey(), // incident-{timestamp}-{random}
    
    // Incident Classification
    type: text("type").notNull(), // "api_failure", "network_timeout", "rate_limit", "auth_failure", "data_corruption", "system_overload"
    severity: text("severity").notNull(), // "low", "medium", "high", "critical"
    service: text("service").notNull(), // "mexc_api", "database", "inngest", "openai"
    
    // Error Details
    errorMessage: text("error_message").notNull(),
    stackTrace: text("stack_trace"),
    context: text("context").notNull(), // JSON with error context
    
    // Occurrence Tracking
    firstOccurrence: integer("first_occurrence", { mode: "timestamp" }).notNull(),
    lastOccurrence: integer("last_occurrence", { mode: "timestamp" }).notNull(),
    occurrenceCount: integer("occurrence_count").notNull().default(1),
    
    // Recovery Status
    recovered: integer("recovered", { mode: "boolean" }).notNull().default(false),
    recoveryAttempts: integer("recovery_attempts").notNull().default(0),
    resolution: text("resolution"),
    preventionStrategy: text("prevention_strategy"),
    
    // Recovery Details
    lastRecoveryAttempt: integer("last_recovery_attempt", { mode: "timestamp" }),
    averageRecoveryTime: integer("average_recovery_time"), // milliseconds
    successfulRecoveries: integer("successful_recoveries").notNull().default(0),
    failedRecoveries: integer("failed_recoveries").notNull().default(0),
    
    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    typeIdx: index("error_incidents_type_idx").on(table.type),
    severityIdx: index("error_incidents_severity_idx").on(table.severity),
    serviceIdx: index("error_incidents_service_idx").on(table.service),
    firstOccurrenceIdx: index("error_incidents_first_occurrence_idx").on(table.firstOccurrence),
    lastOccurrenceIdx: index("error_incidents_last_occurrence_idx").on(table.lastOccurrence),
    recoveredIdx: index("error_incidents_recovered_idx").on(table.recovered),
    // Compound indexes
    serviceSeverityIdx: index("error_incidents_service_severity_idx").on(table.service, table.severity),
    typeOccurrenceIdx: index("error_incidents_type_occurrence_idx").on(table.type, table.lastOccurrence),
  })
);

// System Health Metrics Table
export const systemHealthMetrics = sqliteTable(
  "system_health_metrics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    
    // Service Identification
    service: text("service").notNull(), // "mexc_api", "database", "inngest", "openai", "overall"
    
    // Health Status
    status: text("status").notNull(), // "healthy", "degraded", "critical", "offline"
    
    // Performance Metrics
    responseTime: integer("response_time"), // milliseconds
    errorRate: real("error_rate"), // percentage
    uptime: real("uptime"), // percentage
    throughput: real("throughput"), // requests per second
    
    // Resource Utilization
    cpuUsage: real("cpu_usage"), // percentage
    memoryUsage: real("memory_usage"), // percentage
    diskUsage: real("disk_usage"), // percentage
    
    // Error Tracking
    totalErrors: integer("total_errors").notNull().default(0),
    criticalErrors: integer("critical_errors").notNull().default(0),
    
    // Circuit Breaker Status
    circuitBreakerOpen: integer("circuit_breaker_open", { mode: "boolean" }).notNull().default(false),
    circuitBreakerFailures: integer("circuit_breaker_failures").notNull().default(0),
    
    // Additional Metadata
    metadata: text("metadata"), // JSON with service-specific metrics
    alertsActive: integer("alerts_active").notNull().default(0),
    
    // Timestamps
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    serviceIdx: index("system_health_metrics_service_idx").on(table.service),
    statusIdx: index("system_health_metrics_status_idx").on(table.status),
    timestampIdx: index("system_health_metrics_timestamp_idx").on(table.timestamp),
    // Compound indexes
    serviceTimestampIdx: index("system_health_metrics_service_timestamp_idx").on(table.service, table.timestamp),
    serviceStatusIdx: index("system_health_metrics_service_status_idx").on(table.service, table.status),
  })
);

// Safety System Types
export type SimulationSession = typeof simulationSessions.$inferSelect;
export type NewSimulationSession = typeof simulationSessions.$inferInsert;

export type SimulationTrade = typeof simulationTrades.$inferSelect;
export type NewSimulationTrade = typeof simulationTrades.$inferInsert;

export type RiskEvent = typeof riskEvents.$inferSelect;
export type NewRiskEvent = typeof riskEvents.$inferInsert;

export type PositionSnapshot = typeof positionSnapshots.$inferSelect;
export type NewPositionSnapshot = typeof positionSnapshots.$inferInsert;

export type ReconciliationReport = typeof reconciliationReports.$inferSelect;
export type NewReconciliationReport = typeof reconciliationReports.$inferInsert;

export type ErrorIncident = typeof errorIncidents.$inferSelect;
export type NewErrorIncident = typeof errorIncidents.$inferInsert;

export type SystemHealthMetric = typeof systemHealthMetrics.$inferSelect;
export type NewSystemHealthMetric = typeof systemHealthMetrics.$inferInsert;
