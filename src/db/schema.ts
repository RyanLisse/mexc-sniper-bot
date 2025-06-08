import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Better Auth Tables
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
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
    userId: text("user_id").notNull().unique(),

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
    userId: text("user_id").notNull(),
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
    userId: text("user_id").notNull(),
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
  })
);

// Execution History Table
export const executionHistory = sqliteTable(
  "execution_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    snipeTargetId: integer("snipe_target_id").references(() => snipeTargets.id),

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
