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
// MULTI-PHASE TRADING STRATEGIES SCHEMA
// ===========================================

// Trading Strategy Templates Table
export const strategyTemplates = pgTable(
  "strategy_templates",
  {
    id: serial("id").primaryKey(),
    strategyId: text("strategy_id").notNull().unique(), // e.g., "normal", "conservative", etc.
    name: text("name").notNull(),
    description: text("description"),

    // Strategy Classification
    type: text("type").notNull(), // "multi_phase", "single_target", "scalping", etc.
    riskLevel: text("risk_level").notNull(), // "low", "medium", "high"

    // Default Configuration
    defaultSettings: text("default_settings").notNull(), // JSON of default strategy settings

    // Template Status
    isActive: boolean("is_active").notNull().default(true),
    isBuiltIn: boolean("is_built_in").notNull().default(false),

    // Usage Statistics
    usageCount: integer("usage_count").notNull().default(0),
    successRate: real("success_rate").default(0.0),
    avgProfitPercent: real("avg_profit_percent").default(0.0),

    // Timestamps
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    strategyIdIdx: index("strategy_templates_strategy_id_idx").on(table.strategyId),
    typeIdx: index("strategy_templates_type_idx").on(table.type),
    riskLevelIdx: index("strategy_templates_risk_level_idx").on(table.riskLevel),
    usageCountIdx: index("strategy_templates_usage_count_idx").on(table.usageCount),
  })
);

// Active Trading Strategies Table
export const tradingStrategies = pgTable(
  "trading_strategies",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    strategyTemplateId: integer("strategy_template_id").references(() => strategyTemplates.id, {
      onDelete: "set null",
    }),

    // Strategy Identification
    name: text("name").notNull(),
    description: text("description"),

    // Trading Parameters
    symbol: text("symbol").notNull(), // e.g., "BTCUSDT"
    vcoinId: text("vcoin_id"), // MEXC coin ID

    // Entry Configuration
    entryPrice: real("entry_price").notNull(),
    positionSize: real("position_size").notNull(), // Amount in base currency
    positionSizeUsdt: real("position_size_usdt").notNull(), // Value in USDT

    // Strategy Configuration
    levels: text("levels").notNull(), // JSON array of PriceMultiplier objects
    stopLossPercent: real("stop_loss_percent").notNull(),

    // Execution Status
    status: text("status").notNull().default("pending"), // "pending", "active", "paused", "completed", "failed", "cancelled"

    // Performance Tracking
    currentPrice: real("current_price"),
    unrealizedPnl: real("unrealized_pnl").default(0.0),
    unrealizedPnlPercent: real("unrealized_pnl_percent").default(0.0),
    realizedPnl: real("realized_pnl").default(0.0),
    realizedPnlPercent: real("realized_pnl_percent").default(0.0),
    totalPnl: real("total_pnl").default(0.0),
    totalPnlPercent: real("total_pnl_percent").default(0.0),

    // Execution Metrics
    executedPhases: integer("executed_phases").notNull().default(0),
    totalPhases: integer("total_phases").notNull(),
    remainingPosition: real("remaining_position"),

    // Risk Metrics
    maxDrawdown: real("max_drawdown").default(0.0),
    riskRewardRatio: real("risk_reward_ratio").default(0.0),
    confidenceScore: real("confidence_score").default(0.0),

    // AI Integration
    aiInsights: text("ai_insights"),
    lastAiAnalysis: timestamp("last_ai_analysis"),

    // Timing
    activatedAt: timestamp("activated_at"),
    completedAt: timestamp("completed_at"),
    lastExecutionAt: timestamp("last_execution_at"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdx: index("trading_strategies_user_idx").on(table.userId),
    symbolIdx: index("trading_strategies_symbol_idx").on(table.symbol),
    statusIdx: index("trading_strategies_status_idx").on(table.status),
    templateIdx: index("trading_strategies_template_idx").on(table.strategyTemplateId),
    // Compound indexes for optimization
    userStatusIdx: index("trading_strategies_user_status_idx").on(table.userId, table.status),
    symbolStatusIdx: index("trading_strategies_symbol_status_idx").on(table.symbol, table.status),
    userSymbolIdx: index("trading_strategies_user_symbol_idx").on(table.userId, table.symbol),
  })
);

// Strategy Phase Executions Table
export const strategyPhaseExecutions = pgTable(
  "strategy_phase_executions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    strategyId: integer("strategy_id")
      .notNull()
      .references(() => tradingStrategies.id, { onDelete: "cascade" }),

    // Phase Details
    phaseNumber: integer("phase_number").notNull(),
    targetPercentage: real("target_percentage").notNull(),
    targetPrice: real("target_price").notNull(),
    targetMultiplier: real("target_multiplier").notNull(),
    plannedSellPercentage: real("planned_sell_percentage").notNull(),

    // Execution Details
    executionStatus: text("execution_status").notNull().default("pending"), // "pending", "triggered", "executed", "failed", "cancelled"
    triggerPrice: real("trigger_price"),
    executionPrice: real("execution_price"),
    executedQuantity: real("executed_quantity"),
    executedValue: real("executed_value"),

    // Performance
    profit: real("profit"),
    profitPercent: real("profit_percent"),
    fees: real("fees"),
    slippage: real("slippage"),

    // Exchange Integration
    exchangeOrderId: text("exchange_order_id"),
    exchangeResponse: text("exchange_response"), // JSON response from exchange

    // Timing
    triggeredAt: timestamp("triggered_at"),
    executedAt: timestamp("executed_at"),

    // Error Tracking
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").notNull().default(0),

    // Timestamps
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    strategyIdx: index("strategy_phase_executions_strategy_idx").on(table.strategyId),
    userIdx: index("strategy_phase_executions_user_idx").on(table.userId),
    statusIdx: index("strategy_phase_executions_status_idx").on(table.executionStatus),
    phaseIdx: index("strategy_phase_executions_phase_idx").on(table.phaseNumber),
    // Compound indexes
    strategyPhaseIdx: index("strategy_phase_executions_strategy_phase_idx").on(
      table.strategyId,
      table.phaseNumber
    ),
    strategyStatusIdx: index("strategy_phase_executions_strategy_status_idx").on(
      table.strategyId,
      table.executionStatus
    ),
    userStrategyIdx: index("strategy_phase_executions_user_strategy_idx").on(
      table.userId,
      table.strategyId
    ),
  })
);

// Strategy Performance Analytics Table
export const strategyPerformanceMetrics = pgTable(
  "strategy_performance_metrics",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    strategyId: integer("strategy_id")
      .notNull()
      .references(() => tradingStrategies.id, { onDelete: "cascade" }),

    // Performance Period
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    periodType: text("period_type").notNull(), // "1h", "4h", "1d", "1w", "1m"

    // Price Metrics
    highestPrice: real("highest_price"),
    lowestPrice: real("lowest_price"),
    avgPrice: real("avg_price"),
    priceVolatility: real("price_volatility"),

    // Performance Metrics
    pnl: real("pnl"),
    pnlPercent: real("pnl_percent"),
    maxDrawdown: real("max_drawdown"),
    maxDrawdownPercent: real("max_drawdown_percent"),

    // Risk Metrics
    sharpeRatio: real("sharpe_ratio"),
    sortRatio: real("sort_ratio"),
    calmarRatio: real("calmar_ratio"),
    valueAtRisk: real("value_at_risk"),

    // Execution Metrics
    phasesExecuted: integer("phases_executed"),
    avgExecutionTime: real("avg_execution_time"),
    totalSlippage: real("total_slippage"),
    totalFees: real("total_fees"),

    // Market Conditions
    marketTrend: text("market_trend"), // "bullish", "bearish", "sideways"
    marketVolatility: text("market_volatility"), // "low", "medium", "high"

    // Timestamps
    calculatedAt: timestamp("calculated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    strategyIdx: index("strategy_performance_metrics_strategy_idx").on(table.strategyId),
    userIdx: index("strategy_performance_metrics_user_idx").on(table.userId),
    periodIdx: index("strategy_performance_metrics_period_idx").on(
      table.periodStart,
      table.periodEnd
    ),
    periodTypeIdx: index("strategy_performance_metrics_period_type_idx").on(table.periodType),
    // Compound indexes
    strategyPeriodIdx: index("strategy_performance_metrics_strategy_period_idx").on(
      table.strategyId,
      table.periodStart
    ),
    userPeriodIdx: index("strategy_performance_metrics_user_period_idx").on(
      table.userId,
      table.periodStart
    ),
  })
);

// Strategy Configuration Backups Table (for version control)
export const strategyConfigBackups = pgTable(
  "strategy_config_backups",
  {
    id: serial("id").primaryKey(),
    strategyId: integer("strategy_id")
      .notNull()
      .references(() => tradingStrategies.id, { onDelete: "cascade" }),

    // Backup Information
    backupReason: text("backup_reason").notNull(), // "created", "updated", "performance_adjustment", "manual"
    configSnapshot: text("config_snapshot").notNull(), // Full JSON snapshot of strategy config

    // Version Control
    version: integer("version").notNull(),
    isActive: boolean("is_active").notNull().default(false),

    // Performance at time of backup
    performanceSnapshot: text("performance_snapshot"), // JSON of performance metrics

    // Timestamps
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    strategyIdx: index("strategy_config_backups_strategy_idx").on(table.strategyId),
    versionIdx: index("strategy_config_backups_version_idx").on(table.version),
    activeIdx: index("strategy_config_backups_active_idx").on(table.isActive),
    reasonIdx: index("strategy_config_backups_reason_idx").on(table.backupReason),
  })
);

// Export types for TypeScript
export type StrategyTemplate = typeof strategyTemplates.$inferSelect;
export type NewStrategyTemplate = typeof strategyTemplates.$inferInsert;

export type TradingStrategy = typeof tradingStrategies.$inferSelect;
export type NewTradingStrategy = typeof tradingStrategies.$inferInsert;

export type StrategyPhaseExecution = typeof strategyPhaseExecutions.$inferSelect;
export type NewStrategyPhaseExecution = typeof strategyPhaseExecutions.$inferInsert;

export type StrategyPerformanceMetrics = typeof strategyPerformanceMetrics.$inferSelect;
export type NewStrategyPerformanceMetrics = typeof strategyPerformanceMetrics.$inferInsert;

export type StrategyConfigBackup = typeof strategyConfigBackups.$inferSelect;
export type NewStrategyConfigBackup = typeof strategyConfigBackups.$inferInsert;
