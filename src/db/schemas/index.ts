/**
 * Modular Database Schema Index
 *
 * This file exports all database tables from modular schema files,
 * replacing the original monolithic schema.ts file while maintaining
 * backward compatibility with existing imports.
 *
 * Organized by functional domains for better maintainability.
 */

// Alert Management
export {
  alertAnalytics,
  alertCorrelations,
  alertInstances,
  alertNotifications,
  alertRules,
  alertSuppressions,
  escalationPolicies,
  notificationChannels,
} from "./alerts-schema";
// API & Credentials
export { apiCredentials } from "./api-schema";
// Authentication & User Management
export {
  account,
  session,
  user,
  userPreferences,
  verification,
} from "./auth-schema";
// Machine Learning & Pattern Detection
export {
  anomalyModels,
  patternEmbeddings,
  patternSimilarityCache,
} from "./ml-schema";

// Monitoring & Performance
export {
  agentPerformanceMetrics,
  performanceAlerts,
  performanceBaselines,
  systemHealthMetrics,
  systemPerformanceSnapshots,
} from "./monitoring-schema";
// Risk Management
export {
  errorIncidents,
  riskEvents,
} from "./risk-schema";
// Strategy Management
export {
  simulationSessions,
  simulationTrades,
  strategyConfigBackups,
  strategyPerformanceMetrics,
  strategyPhaseExecutions,
  strategyTemplates,
} from "./strategy-schema";
// Additional trading tables from legacy trading.ts
export {
  balanceSnapshots,
  portfolioSummary,
} from "./trading";
// Trading Operations
export {
  coinActivities,
  executionHistory,
  monitoredListings,
  positionSnapshots,
  reconciliationReports,
  snipeTargets,
  tradingStrategies,
  transactionLocks,
  transactionQueue,
  transactions,
} from "./trading-schema";
// Workflow Management
export {
  workflowActivity,
  workflowPerformanceMetrics,
  workflowSystemStatus,
} from "./workflow-schema";

import * as alertsTables from "./alerts-schema";
import * as apiTables from "./api-schema";
// Legacy imports for backward compatibility
import * as authTables from "./auth-schema";
import * as mlTables from "./ml-schema";
import * as monitoringTables from "./monitoring-schema";
import * as riskTables from "./risk-schema";
import * as strategyTables from "./strategy-schema";
import * as legacyTradingTables from "./trading";
import * as tradingTables from "./trading-schema";
import * as workflowTables from "./workflow-schema";

// Common table aliases for backward compatibility
export const users = authTables.user; // Plural alias for user table

// Grouped exports by domain
export const auth = authTables;
export const alerts = alertsTables;
export const trading = tradingTables;
export const strategy = strategyTables;
export const monitoring = monitoringTables;
export const workflows = workflowTables;
export const ml = mlTables;
export const risk = riskTables;
export const api = apiTables;

// All tables for migration and database operations
export const allTables = {
  // Auth tables
  user: authTables.user,
  account: authTables.account,
  session: authTables.session,
  verification: authTables.verification,
  userPreferences: authTables.userPreferences,

  // Alert tables
  alertAnalytics: alertsTables.alertAnalytics,
  alertCorrelations: alertsTables.alertCorrelations,
  alertSuppressions: alertsTables.alertSuppressions,
  alertRules: alertsTables.alertRules,
  alertInstances: alertsTables.alertInstances,
  notificationChannels: alertsTables.notificationChannels,
  alertNotifications: alertsTables.alertNotifications,
  escalationPolicies: alertsTables.escalationPolicies,

  // Trading tables
  snipeTargets: tradingTables.snipeTargets,
  tradingStrategies: tradingTables.tradingStrategies,
  executionHistory: tradingTables.executionHistory,
  transactions: tradingTables.transactions,
  positionSnapshots: tradingTables.positionSnapshots,
  transactionQueue: tradingTables.transactionQueue,
  transactionLocks: tradingTables.transactionLocks,
  monitoredListings: tradingTables.monitoredListings,
  coinActivities: tradingTables.coinActivities,
  reconciliationReports: tradingTables.reconciliationReports,

  // Legacy trading tables
  balanceSnapshots: legacyTradingTables.balanceSnapshots,
  portfolioSummary: legacyTradingTables.portfolioSummary,

  // Strategy tables
  strategyTemplates: strategyTables.strategyTemplates,
  strategyConfigBackups: strategyTables.strategyConfigBackups,
  strategyPerformanceMetrics: strategyTables.strategyPerformanceMetrics,
  strategyPhaseExecutions: strategyTables.strategyPhaseExecutions,
  simulationSessions: strategyTables.simulationSessions,
  simulationTrades: strategyTables.simulationTrades,

  // Monitoring tables
  systemHealthMetrics: monitoringTables.systemHealthMetrics,
  performanceBaselines: monitoringTables.performanceBaselines,
  performanceAlerts: monitoringTables.performanceAlerts,
  systemPerformanceSnapshots: monitoringTables.systemPerformanceSnapshots,
  agentPerformanceMetrics: monitoringTables.agentPerformanceMetrics,

  // Workflow tables
  workflowActivity: workflowTables.workflowActivity,
  workflowPerformanceMetrics: workflowTables.workflowPerformanceMetrics,
  workflowSystemStatus: workflowTables.workflowSystemStatus,

  // ML tables
  anomalyModels: mlTables.anomalyModels,
  patternEmbeddings: mlTables.patternEmbeddings,
  patternSimilarityCache: mlTables.patternSimilarityCache,

  // Risk tables
  riskEvents: riskTables.riskEvents,
  errorIncidents: riskTables.errorIncidents,

  // API tables
  apiCredentials: apiTables.apiCredentials,
};

// Re-export common Drizzle types for convenience
export type {
  InferInsertModel,
  InferSelectModel,
} from "drizzle-orm";

export {
  and,
  asc,
  between,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  not,
  notExists,
  notInArray,
  or,
  relations,
  sql,
} from "drizzle-orm";
