import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/**
 * Trading Schema
 * Contains tables for snipe targets, trading strategies, execution history,
 * transactions, position snapshots, and trading-related data
 */

export const snipeTargets = pgTable(
  "snipe_targets",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    vcoinId: text("vcoin_id").notNull(),
    symbolName: text("symbol_name").notNull(),
    entryStrategy: text("entry_strategy").default("market").notNull(),
    entryPrice: real("entry_price"),
    positionSizeUsdt: real("position_size_usdt").notNull(),
    takeProfitLevel: integer("take_profit_level").default(2).notNull(),
    takeProfitCustom: real("take_profit_custom"),
    stopLossPercent: real("stop_loss_percent").notNull(),
    status: text().default("pending").notNull(),
    priority: integer().default(1).notNull(),
    maxRetries: integer("max_retries").default(3).notNull(),
    currentRetries: integer("current_retries").default(0).notNull(),
    targetExecutionTime: timestamp("target_execution_time", { mode: "string" }),
    actualExecutionTime: timestamp("actual_execution_time", { mode: "string" }),
    executionPrice: real("execution_price"),
    actualPositionSize: real("actual_position_size"),
    executionStatus: text("execution_status"),
    errorMessage: text("error_message"),
    confidenceScore: real("confidence_score").default(0).notNull(),
    riskLevel: text("risk_level").default("medium").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("idx_snipe_targets_user_status").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.status.asc().nullsLast(),
      table.createdAt.asc().nullsLast()
    ),
    index("snipe_targets_status_execution_time_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.targetExecutionTime.asc().nullsLast()
    ),
  ]
);

export const tradingStrategies = pgTable(
  "trading_strategies",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    strategyTemplateId: integer("strategy_template_id"),
    name: text().notNull(),
    description: text(),
    symbol: text().notNull(),
    vcoinId: text("vcoin_id"),
    entryPrice: real("entry_price").notNull(),
    stopLoss: real("stop_loss").notNull(),
    takeProfitLevel1: real("take_profit_level_1").default(5).notNull(),
    takeProfitLevel2: real("take_profit_level_2").default(10).notNull(),
    takeProfitLevel3: real("take_profit_level_3").default(15).notNull(),
    takeProfitLevel4: real("take_profit_level_4").default(25).notNull(),
    positionSizeUsdt: real("position_size_usdt").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    riskLevel: text("risk_level").default("medium").notNull(),
    maxDrawdown: real("max_drawdown").default(10).notNull(),
    timeframe: text().default("1h").notNull(),
    indicators: text().default("{}").notNull(),
    conditions: text().default("{}").notNull(),
    exitStrategy: text("exit_strategy").default("profit_target").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("trading_strategies_user_active_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.isActive.asc().nullsLast()
    ),
  ]
);

export const executionHistory = pgTable(
  "execution_history",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    snipeTargetId: integer("snipe_target_id"),
    vcoinId: text("vcoin_id").notNull(),
    symbolName: text("symbol_name").notNull(),
    action: text().notNull(),
    orderType: text("order_type").notNull(),
    orderSide: text("order_side").notNull(),
    quantity: real().notNull(),
    price: real(),
    totalValue: real("total_value"),
    status: text().notNull(),
    exchange: text().default("mexc").notNull(),
    orderId: text("order_id"),
    executionTime: timestamp("execution_time", { mode: "string" }).notNull(),
    latency: integer(),
    fees: real(),
    errorMessage: text("error_message"),
    metadata: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.snipeTargetId],
      foreignColumns: [snipeTargets.id],
      name: "execution_history_snipe_target_id_snipe_targets_id_fk",
    }),
    index("execution_history_user_time_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.executionTime.desc().nullsLast()
    ),
  ]
);

export const transactions = pgTable(
  "transactions",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    transactionType: text("transaction_type").notNull(),
    symbolName: text("symbol_name").notNull(),
    vcoinId: text("vcoin_id"),
    buyPrice: real("buy_price"),
    buyQuantity: real("buy_quantity"),
    buyTotalCost: real("buy_total_cost"),
    sellPrice: real("sell_price"),
    sellQuantity: real("sell_quantity"),
    sellTotalRevenue: real("sell_total_revenue"),
    profitLoss: real("profit_loss"),
    profitLossPercent: real("profit_loss_percent"),
    fees: real(),
    netProfitLoss: real("net_profit_loss"),
    executionTime: timestamp("execution_time", { mode: "string" }).notNull(),
    holdingPeriod: integer("holding_period"),
    strategy: text().default("manual").notNull(),
    status: text().default("completed").notNull(),
    metadata: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("transactions_user_time_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.executionTime.desc().nullsLast()
    ),
  ]
);

export const positionSnapshots = pgTable(
  "position_snapshots",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    snapshotId: text("snapshot_id").notNull(),
    symbolName: text("symbol_name").notNull(),
    vcoinId: text("vcoin_id"),
    quantity: real().notNull(),
    averageBuyPrice: real("average_buy_price").notNull(),
    currentPrice: real("current_price").notNull(),
    marketValue: real("market_value").notNull(),
    unrealizedPnl: real("unrealized_pnl").notNull(),
    unrealizedPnlPercent: real("unrealized_pnl_percent").notNull(),
    dayChange: real("day_change"),
    dayChangePercent: real("day_change_percent"),
    totalInvested: real("total_invested").notNull(),
    fees: real().default(0).notNull(),
    snapshotTime: timestamp("snapshot_time", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("position_snapshots_user_time_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.snapshotTime.desc().nullsLast()
    ),
    unique("position_snapshots_user_symbol_time_unique").on(
      table.userId,
      table.symbolName,
      table.snapshotTime
    ),
  ]
);

export const transactionQueue = pgTable(
  "transaction_queue",
  {
    id: serial().primaryKey().notNull(),
    queueId: text("queue_id").notNull(),
    lockId: text("lock_id"),
    userId: text("user_id").notNull(),
    transactionType: text("transaction_type").notNull(),
    symbolName: text("symbol_name").notNull(),
    vcoinId: text("vcoin_id"),
    quantity: real(),
    price: real(),
    orderType: text("order_type").default("market").notNull(),
    priority: integer().default(1).notNull(),
    status: text().default("queued").notNull(),
    maxRetries: integer("max_retries").default(3).notNull(),
    currentRetries: integer("current_retries").default(0).notNull(),
    scheduledAt: timestamp("scheduled_at", { mode: "string" }),
    processedAt: timestamp("processed_at", { mode: "string" }),
    errorMessage: text("error_message"),
    metadata: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("transaction_queue_status_priority_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.priority.desc().nullsLast(),
      table.scheduledAt.asc().nullsLast()
    ),
    unique("transaction_queue_queue_id_unique").on(table.queueId),
  ]
);

export const transactionLocks = pgTable(
  "transaction_locks",
  {
    id: serial().primaryKey().notNull(),
    lockId: text("lock_id").notNull(),
    resourceId: text("resource_id").notNull(),
    resourceType: text("resource_type").notNull(),
    ownerId: text("owner_id").notNull(),
    acquiredAt: timestamp("acquired_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    metadata: text(),
  },
  (table) => [
    index("transaction_locks_resource_active_idx").using(
      "btree",
      table.resourceId.asc().nullsLast(),
      table.isActive.asc().nullsLast()
    ),
    unique("transaction_locks_lock_id_unique").on(table.lockId),
  ]
);

export const monitoredListings = pgTable(
  "monitored_listings",
  {
    id: serial().primaryKey().notNull(),
    vcoinId: text("vcoin_id").notNull(),
    symbolName: text("symbol_name").notNull(),
    projectName: text("project_name"),
    firstOpenTime: integer("first_open_time").notNull(),
    estimatedLaunchTime: integer("estimated_launch_time"),
    status: text().default("monitoring").notNull(),
    confidence: real().default(0).notNull(),
    patternSts: integer("pattern_sts"),
    patternSt: integer("pattern_st"),
    patternTt: integer("pattern_tt"),
    hasReadyPattern: boolean("has_ready_pattern").default(false).notNull(),
    lastStatusUpdate: integer("last_status_update"),
    metadata: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("monitored_listings_status_confidence_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.confidence.desc().nullsLast()
    ),
    unique("monitored_listings_vcoin_id_unique").on(table.vcoinId),
  ]
);

export const coinActivities = pgTable(
  "coin_activities",
  {
    id: serial().primaryKey().notNull(),
    vcoinId: text("vcoin_id").notNull(),
    currency: text().notNull(),
    currencyFullName: text("currency_full_name").notNull(),
    availableAmount: real("available_amount").notNull(),
    freezeAmount: real("freeze_amount").notNull(),
    lockAmount: real("lock_amount").notNull(),
    withdrawAmount: real("withdraw_amount").notNull(),
    createTime: integer("create_time").notNull(),
    updateTime: integer("update_time").notNull(),
    activityType: text("activity_type").notNull(),
    status: text().default("active").notNull(),
    metadata: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("coin_activities_vcoin_status_idx").using(
      "btree",
      table.vcoinId.asc().nullsLast(),
      table.status.asc().nullsLast()
    ),
  ]
);

export const reconciliationReports = pgTable(
  "reconciliation_reports",
  {
    id: text().primaryKey().notNull(),
    userId: text("user_id").default("default").notNull(),
    startTime: timestamp("start_time", { mode: "string" }).notNull(),
    endTime: timestamp("end_time", { mode: "string" }).notNull(),
    reportType: text("report_type").notNull(),
    status: text().default("pending").notNull(),
    totalTransactions: integer("total_transactions"),
    reconciledTransactions: integer("reconciled_transactions"),
    discrepancies: integer(),
    summary: text(),
    details: text(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    completedAt: timestamp("completed_at", { mode: "string" }),
  },
  (table) => [
    index("reconciliation_reports_user_time_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.startTime.desc().nullsLast()
    ),
  ]
);
