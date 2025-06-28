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
// SAFETY SYSTEM SCHEMA MODULE
// ===========================================

// Simulation Sessions Table
export const simulationSessions = pgTable(
  "simulation_sessions",
  {
    id: text("id").primaryKey(), // sim-{timestamp}-{random}
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Session Configuration
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time"),
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
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdIdx: index("simulation_sessions_user_id_idx").on(table.userId),
    statusIdx: index("simulation_sessions_status_idx").on(table.status),
    startTimeIdx: index("simulation_sessions_start_time_idx").on(table.startTime),
  })
);

// Simulation Trades Table
export const simulationTrades = pgTable(
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
    timestamp: timestamp("timestamp").notNull(),
    strategy: text("strategy").notNull(), // Which strategy triggered this trade

    // P&L Tracking (for closed positions)
    realized: boolean("realized").notNull().default(false),
    profitLoss: real("profit_loss"), // Set when position is closed
    exitPrice: real("exit_price"), // Price when position was closed
    exitTimestamp: timestamp("exit_timestamp"),

    // Metadata
    slippagePercent: real("slippage_percent"),
    marketImpactPercent: real("market_impact_percent"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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
export const riskEvents = pgTable(
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
    resolved: boolean("resolved").notNull().default(false),
    resolvedAt: timestamp("resolved_at"),
    resolution: text("resolution"),

    // Timestamps
    timestamp: timestamp("timestamp").notNull(),
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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
export const positionSnapshots = pgTable(
  "position_snapshots",
  {
    id: serial("id").primaryKey(),
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
    timestamp: timestamp("timestamp").notNull(),
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdIdx: index("position_snapshots_user_id_idx").on(table.userId),
    snapshotIdIdx: index("position_snapshots_snapshot_id_idx").on(table.snapshotId),
    sourceIdx: index("position_snapshots_source_idx").on(table.source),
    symbolIdx: index("position_snapshots_symbol_idx").on(table.symbol),
    timestampIdx: index("position_snapshots_timestamp_idx").on(table.timestamp),
    reconciliationIdIdx: index("position_snapshots_reconciliation_id_idx").on(
      table.reconciliationId
    ),
    // Compound indexes
    sourceTimestampIdx: index("position_snapshots_source_timestamp_idx").on(
      table.source,
      table.timestamp
    ),
    userSymbolIdx: index("position_snapshots_user_symbol_idx").on(table.userId, table.symbol),
  })
);

// Reconciliation Reports Table
export const reconciliationReports = pgTable(
  "reconciliation_reports",
  {
    id: text("id").primaryKey(), // recon-{timestamp}-{random}
    userId: text("user_id").notNull().default("default"),

    // Report Details
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),

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
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdIdx: index("reconciliation_reports_user_id_idx").on(table.userId),
    startTimeIdx: index("reconciliation_reports_start_time_idx").on(table.startTime),
    overallStatusIdx: index("reconciliation_reports_overall_status_idx").on(table.overallStatus),
    criticalIssuesIdx: index("reconciliation_reports_critical_issues_idx").on(table.criticalIssues),
  })
);

// Error Incidents Table
export const errorIncidents = pgTable(
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
    firstOccurrence: timestamp("first_occurrence").notNull(),
    lastOccurrence: timestamp("last_occurrence").notNull(),
    occurrenceCount: integer("occurrence_count").notNull().default(1),

    // Recovery Status
    recovered: boolean("recovered").notNull().default(false),
    recoveryAttempts: integer("recovery_attempts").notNull().default(0),
    resolution: text("resolution"),
    preventionStrategy: text("prevention_strategy"),

    // Recovery Details
    lastRecoveryAttempt: timestamp("last_recovery_attempt"),
    averageRecoveryTime: integer("average_recovery_time"), // milliseconds
    successfulRecoveries: integer("successful_recoveries").notNull().default(0),
    failedRecoveries: integer("failed_recoveries").notNull().default(0),

    // Timestamps
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    typeIdx: index("error_incidents_type_idx").on(table.type),
    severityIdx: index("error_incidents_severity_idx").on(table.severity),
    serviceIdx: index("error_incidents_service_idx").on(table.service),
    firstOccurrenceIdx: index("error_incidents_first_occurrence_idx").on(table.firstOccurrence),
    lastOccurrenceIdx: index("error_incidents_last_occurrence_idx").on(table.lastOccurrence),
    recoveredIdx: index("error_incidents_recovered_idx").on(table.recovered),
    // Compound indexes
    serviceSeverityIdx: index("error_incidents_service_severity_idx").on(
      table.service,
      table.severity
    ),
    typeOccurrenceIdx: index("error_incidents_type_occurrence_idx").on(
      table.type,
      table.lastOccurrence
    ),
  })
);

// System Health Metrics Table
export const systemHealthMetrics = pgTable(
  "system_health_metrics",
  {
    id: serial("id").primaryKey(),

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
    circuitBreakerOpen: boolean("circuit_breaker_open").notNull().default(false),
    circuitBreakerFailures: integer("circuit_breaker_failures").notNull().default(0),

    // Additional Metadata
    metadata: text("metadata"), // JSON with service-specific metrics
    alertsActive: integer("alerts_active").notNull().default(0),

    // Timestamps
    timestamp: timestamp("timestamp").notNull(),
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    serviceIdx: index("system_health_metrics_service_idx").on(table.service),
    statusIdx: index("system_health_metrics_status_idx").on(table.status),
    timestampIdx: index("system_health_metrics_timestamp_idx").on(table.timestamp),
    // Compound indexes
    serviceTimestampIdx: index("system_health_metrics_service_timestamp_idx").on(
      table.service,
      table.timestamp
    ),
    serviceStatusIdx: index("system_health_metrics_service_status_idx").on(
      table.service,
      table.status
    ),
  })
);

// Error Logs Table - For detailed error logging
export const errorLogs = pgTable(
  "error_logs",
  {
    id: serial("id").primaryKey(),

    // Log Details
    level: text("level").notNull(), // "debug", "info", "warn", "error", "fatal"
    message: text("message").notNull(),
    error_code: text("error_code"),
    stack_trace: text("stack_trace"),

    // Context Information
    user_id: text("user_id"),
    session_id: text("session_id"),
    metadata: text("metadata"), // JSON string
    context: text("context"), // JSON string

    // Source Information
    service: text("service").notNull().default("unknown"), // "mexc_api", "database", "inngest", etc.
    component: text("component"), // specific component or module

    // Timing
    timestamp: timestamp("timestamp").notNull(),
    created_at: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updated_at: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    levelIdx: index("error_logs_level_idx").on(table.level),
    serviceIdx: index("error_logs_service_idx").on(table.service),
    timestampIdx: index("error_logs_timestamp_idx").on(table.timestamp),
    userIdIdx: index("error_logs_user_id_idx").on(table.user_id),
    sessionIdIdx: index("error_logs_session_id_idx").on(table.session_id),
    errorCodeIdx: index("error_logs_error_code_idx").on(table.error_code),
    // Compound indexes for common queries
    levelTimestampIdx: index("error_logs_level_timestamp_idx").on(table.level, table.timestamp),
    serviceTimestampIdx: index("error_logs_service_timestamp_idx").on(
      table.service,
      table.timestamp
    ),
    userLevelIdx: index("error_logs_user_level_idx").on(table.user_id, table.level),
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

export type ErrorLog = typeof errorLogs.$inferSelect;
export type NewErrorLog = typeof errorLogs.$inferInsert;
