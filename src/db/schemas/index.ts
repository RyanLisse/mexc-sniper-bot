// ===========================================
// DATABASE SCHEMA BARREL EXPORTS
// ===========================================

// Authentication Schema
export * from "./auth";
// Pattern Analysis Schema
export * from "./patterns";
// Performance Metrics Schema
export * from "./performance";
// Safety System Schema
export * from "./safety";
// Trading Strategies Schema
export * from "./strategies";
// Trading Schema
export * from "./trading";
// Workflow Orchestration Schema
export * from "./workflows";

// Re-export all table definitions for easy access
import * as authTables from "./auth";
import * as patternTables from "./patterns";
import * as performanceTables from "./performance";
import * as safetyTables from "./safety";
import * as strategiesTables from "./strategies";
import * as tradingTables from "./trading";
import * as workflowTables from "./workflows";

// Common table aliases for backward compatibility
// Note: For Supabase databases, 'users' is exported directly from supabase-auth schema
// For non-Supabase databases, we create an alias to the 'user' table from auth schema
export const users = authTables.user; // Plural alias for user table

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
  balanceSnapshots: tradingTables.balanceSnapshots,
  portfolioSummary: tradingTables.portfolioSummary,

  // Safety tables
  simulationSessions: safetyTables.simulationSessions,
  simulationTrades: safetyTables.simulationTrades,
  riskEvents: safetyTables.riskEvents,
  positionSnapshots: safetyTables.positionSnapshots,
  reconciliationReports: safetyTables.reconciliationReports,
  errorIncidents: safetyTables.errorIncidents,
  errorLogs: safetyTables.errorLogs,
  systemHealthMetrics: safetyTables.systemHealthMetrics,

  // Pattern tables
  coinActivities: patternTables.coinActivities,
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
  Account,
  NewAccount,
  NewSession,
  NewUser,
  NewUserPreferences,
  NewVerification,
  Session,
  // Auth types
  User,
  UserPreferences,
  Verification,
} from "./auth";
export type {
  // Pattern types
  CoinActivity,
  MonitoredListing,
  NewCoinActivity,
  NewMonitoredListing,
  NewPatternEmbedding,
  NewPatternSimilarityCache,
  PatternEmbedding,
  PatternSimilarityCache,
} from "./patterns";
export type {
  // Performance types
  AgentPerformanceMetric,
  NewAgentPerformanceMetric,
  NewPerformanceAlert,
  NewPerformanceBaseline,
  NewSystemPerformanceSnapshot,
  NewWorkflowPerformanceMetric,
  PerformanceAlert,
  PerformanceBaseline,
  SystemPerformanceSnapshot,
  WorkflowPerformanceMetric,
} from "./performance";
export type {
  ErrorIncident,
  ErrorLog,
  NewErrorIncident,
  NewErrorLog,
  NewPositionSnapshot,
  NewReconciliationReport,
  NewRiskEvent,
  NewSimulationSession,
  NewSimulationTrade,
  NewSystemHealthMetric,
  PositionSnapshot,
  ReconciliationReport,
  RiskEvent,
  // Safety types
  SimulationSession,
  SimulationTrade,
  SystemHealthMetric,
} from "./safety";
export type {
  NewStrategyConfigBackup,
  NewStrategyPerformanceMetrics,
  NewStrategyPhaseExecution,
  NewStrategyTemplate,
  NewTradingStrategy,
  StrategyConfigBackup,
  StrategyPerformanceMetrics,
  StrategyPhaseExecution,
  // Strategy types
  StrategyTemplate,
  TradingStrategy,
} from "./strategies";
export type {
  // Trading types
  ApiCredentials,
  BalanceSnapshot,
  ExecutionHistory,
  NewApiCredentials,
  NewBalanceSnapshot,
  NewExecutionHistory,
  NewPortfolioSummary,
  NewSnipeTarget,
  NewTransaction,
  NewTransactionLock,
  NewTransactionQueue,
  PortfolioSummary,
  SnipeTarget,
  Transaction,
  TransactionLock,
  TransactionQueue,
} from "./trading";
export type {
  NewWorkflowActivity,
  NewWorkflowSystemStatus,
  WorkflowActivity,
  // Workflow types
  WorkflowSystemStatus,
} from "./workflows";
