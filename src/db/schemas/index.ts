// ===========================================
// DATABASE SCHEMA BARREL EXPORTS
// ===========================================

// Authentication Schema
export * from "./auth";

// Trading Schema
export * from "./trading";

// Safety System Schema
export * from "./safety";

// Pattern Analysis Schema
export * from "./patterns";

// Workflow Orchestration Schema
export * from "./workflows";

// Performance Metrics Schema
export * from "./performance";

// Trading Strategies Schema
export * from "./strategies";

// Re-export all table definitions for easy access
import * as authTables from "./auth";
import * as patternTables from "./patterns";
import * as performanceTables from "./performance";
import * as safetyTables from "./safety";
import * as strategiesTables from "./strategies";
import * as tradingTables from "./trading";
import * as workflowTables from "./workflows";

// Grouped exports by domain
export const auth = authTables;
export const trading = tradingTables;
export const safety = safetyTables;
export const patterns = patternTables;
export const workflows = workflowTables;
export const performance = performanceTables;
export const strategies = strategiesTables;

// All tables for migration and database operations
export const allTables = {
  // Auth tables
  user: authTables.user,
  session: authTables.session,
  account: authTables.account,
  verification: authTables.verification,
  userPreferences: authTables.userPreferences,

  // Trading tables
  apiCredentials: tradingTables.apiCredentials,
  snipeTargets: tradingTables.snipeTargets,
  executionHistory: tradingTables.executionHistory,
  transactions: tradingTables.transactions,
  transactionLocks: tradingTables.transactionLocks,
  transactionQueue: tradingTables.transactionQueue,

  // Safety tables
  simulationSessions: safetyTables.simulationSessions,
  simulationTrades: safetyTables.simulationTrades,
  riskEvents: safetyTables.riskEvents,
  positionSnapshots: safetyTables.positionSnapshots,
  reconciliationReports: safetyTables.reconciliationReports,
  errorIncidents: safetyTables.errorIncidents,
  systemHealthMetrics: safetyTables.systemHealthMetrics,

  // Pattern tables
  monitoredListings: patternTables.monitoredListings,
  patternEmbeddings: patternTables.patternEmbeddings,
  patternSimilarityCache: patternTables.patternSimilarityCache,

  // Workflow tables
  workflowSystemStatus: workflowTables.workflowSystemStatus,
  workflowActivity: workflowTables.workflowActivity,

  // Performance tables
  agentPerformanceMetrics: performanceTables.agentPerformanceMetrics,
  workflowPerformanceMetrics: performanceTables.workflowPerformanceMetrics,
  systemPerformanceSnapshots: performanceTables.systemPerformanceSnapshots,
  performanceAlerts: performanceTables.performanceAlerts,
  performanceBaselines: performanceTables.performanceBaselines,

  // Strategy tables
  strategyTemplates: strategiesTables.strategyTemplates,
  tradingStrategies: strategiesTables.tradingStrategies,
  strategyPhaseExecutions: strategiesTables.strategyPhaseExecutions,
  strategyPerformanceMetrics: strategiesTables.strategyPerformanceMetrics,
  strategyConfigBackups: strategiesTables.strategyConfigBackups,
};

// All types for easy importing
export type {
  // Auth types
  User,
  NewUser,
  Session,
  NewSession,
  Account,
  NewAccount,
  Verification,
  NewVerification,
  UserPreferences,
  NewUserPreferences,
} from "./auth";

export type {
  // Trading types
  ApiCredentials,
  NewApiCredentials,
  SnipeTarget,
  NewSnipeTarget,
  ExecutionHistory,
  NewExecutionHistory,
  Transaction,
  NewTransaction,
  TransactionLock,
  NewTransactionLock,
  TransactionQueue,
  NewTransactionQueue,
} from "./trading";

export type {
  // Safety types
  SimulationSession,
  NewSimulationSession,
  SimulationTrade,
  NewSimulationTrade,
  RiskEvent,
  NewRiskEvent,
  PositionSnapshot,
  NewPositionSnapshot,
  ReconciliationReport,
  NewReconciliationReport,
  ErrorIncident,
  NewErrorIncident,
  SystemHealthMetric,
  NewSystemHealthMetric,
} from "./safety";

export type {
  // Pattern types
  MonitoredListing,
  NewMonitoredListing,
  PatternEmbedding,
  NewPatternEmbedding,
  PatternSimilarityCache,
  NewPatternSimilarityCache,
} from "./patterns";

export type {
  // Workflow types
  WorkflowSystemStatus,
  NewWorkflowSystemStatus,
  WorkflowActivity,
  NewWorkflowActivity,
} from "./workflows";

export type {
  // Performance types
  AgentPerformanceMetric,
  NewAgentPerformanceMetric,
  WorkflowPerformanceMetric,
  NewWorkflowPerformanceMetric,
  SystemPerformanceSnapshot,
  NewSystemPerformanceSnapshot,
  PerformanceAlert,
  NewPerformanceAlert,
  PerformanceBaseline,
  NewPerformanceBaseline,
} from "./performance";

export type {
  // Strategy types
  StrategyTemplate,
  NewStrategyTemplate,
  TradingStrategy,
  NewTradingStrategy,
  StrategyPhaseExecution,
  NewStrategyPhaseExecution,
  StrategyPerformanceMetrics,
  NewStrategyPerformanceMetrics,
  StrategyConfigBackup,
  NewStrategyConfigBackup,
} from "./strategies";
