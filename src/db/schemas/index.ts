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

// Re-export all table definitions for easy access
import * as authTables from "./auth";
import * as tradingTables from "./trading";
import * as safetyTables from "./safety";
import * as patternTables from "./patterns";
import * as workflowTables from "./workflows";

// Grouped exports by domain
export const auth = authTables;
export const trading = tradingTables;
export const safety = safetyTables;
export const patterns = patternTables;
export const workflows = workflowTables;

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