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
} from "drizzle-orm/pg-core";

/**
 * Strategy Management Schema
 * Contains tables for strategy templates, configurations, performance metrics,
 * phase executions, and simulation data
 */

export const strategyTemplates = pgTable("strategy_templates", {
  id: serial().primaryKey().notNull(),
  name: text().notNull(),
  description: text(),
  category: text().notNull(),
  riskLevel: text("risk_level").default("medium").notNull(),
  timeframe: text().default("1h").notNull(),
  entryConditions: text("entry_conditions").notNull(),
  exitConditions: text("exit_conditions").notNull(),
  stopLossPercent: real("stop_loss_percent").default(5).notNull(),
  takeProfitLevel1: real("take_profit_level_1").default(5).notNull(),
  takeProfitLevel2: real("take_profit_level_2").default(10).notNull(),
  takeProfitLevel3: real("take_profit_level_3").default(15).notNull(),
  takeProfitLevel4: real("take_profit_level_4").default(25).notNull(),
  maxDrawdown: real("max_drawdown").default(10).notNull(),
  positionSizing: text("position_sizing").default("fixed").notNull(),
  indicators: text().default("{}").notNull(),
  parameters: text().default("{}").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  isPublic: boolean("is_public").default(false).notNull(),
  createdBy: text("created_by").notNull(),
  version: text().default("1.0").notNull(),
  createdAt: timestamp("created_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const strategyConfigBackups = pgTable(
  "strategy_config_backups",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    strategyId: integer("strategy_id"),
    backupName: text("backup_name").notNull(),
    configSnapshot: text("config_snapshot").notNull(),
    reason: text(),
    isAutoBackup: boolean("is_auto_backup").default(false),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("strategy_config_backups_user_strategy_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.strategyId.asc().nullsLast()
    ),
  ]
);

export const strategyPerformanceMetrics = pgTable(
  "strategy_performance_metrics",
  {
    id: serial().primaryKey().notNull(),
    strategyId: integer("strategy_id").notNull(),
    userId: text("user_id").notNull(),
    symbol: text().notNull(),
    timeframe: text().notNull(),
    totalTrades: integer("total_trades").default(0),
    winningTrades: integer("winning_trades").default(0),
    losingTrades: integer("losing_trades").default(0),
    winRate: real("win_rate").default(0),
    totalPnl: real("total_pnl").default(0),
    totalPnlPercent: real("total_pnl_percent").default(0),
    averageWin: real("average_win").default(0),
    averageLoss: real("average_loss").default(0),
    profitFactor: real("profit_factor").default(0),
    sharpeRatio: real("sharpe_ratio").default(0),
    maxDrawdown: real("max_drawdown").default(0),
    maxDrawdownPercent: real("max_drawdown_percent").default(0),
    calmarRatio: real("calmar_ratio").default(0),
    averageHoldingPeriod: real("average_holding_period").default(0),
    lastExecutionTime: timestamp("last_execution_time", { mode: "string" }),
    startDate: timestamp("start_date", { mode: "string" }).notNull(),
    endDate: timestamp("end_date", { mode: "string" }),
    isActive: boolean("is_active").default(true),
    metadata: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("strategy_performance_metrics_strategy_user_idx").using(
      "btree",
      table.strategyId.asc().nullsLast(),
      table.userId.asc().nullsLast()
    ),
  ]
);

export const strategyPhaseExecutions = pgTable(
  "strategy_phase_executions",
  {
    id: serial().primaryKey().notNull(),
    strategyId: integer("strategy_id").notNull(),
    userId: text("user_id").notNull(),
    phaseType: text("phase_type").notNull(),
    phaseName: text("phase_name").notNull(),
    status: text().default("pending").notNull(),
    startTime: timestamp("start_time", { mode: "string" }),
    endTime: timestamp("end_time", { mode: "string" }),
    duration: integer(),
    inputData: text("input_data"),
    outputData: text("output_data"),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").default(0),
    maxRetries: integer("max_retries").default(3),
    priority: integer().default(1),
    dependencies: text(),
    metadata: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("strategy_phase_executions_strategy_status_idx").using(
      "btree",
      table.strategyId.asc().nullsLast(),
      table.status.asc().nullsLast()
    ),
  ]
);

export const simulationSessions = pgTable(
  "simulation_sessions",
  {
    id: text().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    strategyId: integer("strategy_id"),
    sessionName: text("session_name").notNull(),
    startDate: timestamp("start_date", { mode: "string" }).notNull(),
    endDate: timestamp("end_date", { mode: "string" }).notNull(),
    initialBalance: real("initial_balance").notNull(),
    finalBalance: real("final_balance"),
    totalTrades: integer("total_trades").default(0),
    winningTrades: integer("winning_trades").default(0),
    losingTrades: integer("losing_trades").default(0),
    totalPnl: real("total_pnl").default(0),
    totalPnlPercent: real("total_pnl_percent").default(0),
    maxDrawdown: real("max_drawdown").default(0),
    sharpeRatio: real("sharpe_ratio").default(0),
    status: text().default("running").notNull(),
    symbols: text(),
    parameters: text(),
    metadata: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    completedAt: timestamp("completed_at", { mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.strategyId],
      foreignColumns: [strategyTemplates.id],
      name: "simulation_sessions_strategy_id_strategy_templates_id_fk",
    }),
    index("simulation_sessions_user_status_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.status.asc().nullsLast()
    ),
  ]
);

export const simulationTrades = pgTable(
  "simulation_trades",
  {
    id: serial().primaryKey().notNull(),
    sessionId: text("session_id").notNull(),
    tradeId: text("trade_id").notNull(),
    symbol: text().notNull(),
    side: text().notNull(),
    entryPrice: real("entry_price").notNull(),
    exitPrice: real("exit_price"),
    quantity: real().notNull(),
    entryTime: timestamp("entry_time", { mode: "string" }).notNull(),
    exitTime: timestamp("exit_time", { mode: "string" }),
    pnl: real(),
    pnlPercent: real("pnl_percent"),
    fees: real().default(0),
    reason: text(),
    metadata: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [simulationSessions.id],
      name: "simulation_trades_session_id_simulation_sessions_id_fk",
    }),
    index("simulation_trades_session_time_idx").using(
      "btree",
      table.sessionId.asc().nullsLast(),
      table.entryTime.desc().nullsLast()
    ),
  ]
);
