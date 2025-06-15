// ===========================================
// CONSOLIDATED SCHEMA - BACKWARD COMPATIBILITY
// ===========================================
// This file maintains backward compatibility while providing
// a modular structure internally.

// Import all table definitions from modular files
import { account, session, user, userPreferences, verification } from "./schemas/auth";

import {
  apiCredentials,
  executionHistory,
  snipeTargets,
  transactionLocks,
  transactionQueue,
  transactions,
} from "./schemas/trading";

import {
  errorIncidents,
  positionSnapshots,
  reconciliationReports,
  riskEvents,
  simulationSessions,
  simulationTrades,
  systemHealthMetrics,
} from "./schemas/safety";

import { monitoredListings, patternEmbeddings, patternSimilarityCache } from "./schemas/patterns";

import { workflowActivity, workflowSystemStatus } from "./schemas/workflows";

import {
  agentPerformanceMetrics,
  performanceAlerts,
  performanceBaselines,
  systemPerformanceSnapshots,
  workflowPerformanceMetrics,
} from "./schemas/performance";

import {
  alertAnalytics,
  alertCorrelations,
  alertInstances,
  alertNotifications,
  alertRules,
  alertSuppressions,
  anomalyModels,
  escalationPolicies,
  notificationChannels,
} from "./schemas/alerts";

import {
  strategyConfigBackups,
  strategyPerformanceMetrics,
  strategyPhaseExecutions,
  strategyTemplates,
  tradingStrategies,
} from "./schemas/strategies";

// Export all tables individually for backward compatibility
export {
  // Auth tables
  user,
  session,
  account,
  verification,
  userPreferences,
  // Trading tables
  apiCredentials,
  snipeTargets,
  executionHistory,
  transactions,
  transactionLocks,
  transactionQueue,
  // Safety tables
  simulationSessions,
  simulationTrades,
  riskEvents,
  positionSnapshots,
  reconciliationReports,
  errorIncidents,
  systemHealthMetrics,
  // Pattern tables
  monitoredListings,
  patternEmbeddings,
  patternSimilarityCache,
  // Workflow tables
  workflowSystemStatus,
  workflowActivity,
  // Performance tables
  agentPerformanceMetrics,
  workflowPerformanceMetrics,
  systemPerformanceSnapshots,
  performanceAlerts,
  performanceBaselines,
  // Alert tables
  alertRules,
  alertInstances,
  notificationChannels,
  escalationPolicies,
  alertNotifications,
  alertCorrelations,
  alertSuppressions,
  anomalyModels,
  alertAnalytics,
  // Strategy tables
  strategyTemplates,
  tradingStrategies,
  strategyPhaseExecutions,
  strategyPerformanceMetrics,
  strategyConfigBackups,
};

// Export all types
export type * from "./schemas/auth";
export type * from "./schemas/trading";
export type * from "./schemas/safety";
export type * from "./schemas/patterns";
export type * from "./schemas/workflows";
export type * from "./schemas/performance";
export type * from "./schemas/alerts";
export type * from "./schemas/strategies";

// Create a consolidated schema object for drizzle (required for proper table relationships)
const allTables = {
  // Auth tables
  user,
  session,
  account,
  verification,
  userPreferences,

  // Trading tables
  apiCredentials,
  snipeTargets,
  executionHistory,
  transactions,
  transactionLocks,
  transactionQueue,

  // Safety tables
  simulationSessions,
  simulationTrades,
  riskEvents,
  positionSnapshots,
  reconciliationReports,
  errorIncidents,
  systemHealthMetrics,

  // Pattern tables
  monitoredListings,
  patternEmbeddings,
  patternSimilarityCache,

  // Workflow tables
  workflowSystemStatus,
  workflowActivity,

  // Performance tables
  agentPerformanceMetrics,
  workflowPerformanceMetrics,
  systemPerformanceSnapshots,
  performanceAlerts,
  performanceBaselines,

  // Alert tables
  alertRules,
  alertInstances,
  notificationChannels,
  escalationPolicies,
  alertNotifications,
  alertCorrelations,
  alertSuppressions,
  anomalyModels,
  alertAnalytics,

  // Strategy tables
  strategyTemplates,
  tradingStrategies,
  strategyPhaseExecutions,
  strategyPerformanceMetrics,
  strategyConfigBackups,
};

// Default export for database initialization
export default allTables;
