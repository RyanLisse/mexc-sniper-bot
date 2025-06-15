// ===========================================
// CONSOLIDATED SCHEMA - BACKWARD COMPATIBILITY
// ===========================================
// This file maintains backward compatibility while providing
// a modular structure internally.

// Import all table definitions from modular files
import {
  user,
  session,
  account,
  verification,
  userPreferences,
} from "./schemas/auth";

import {
  apiCredentials,
  snipeTargets,
  executionHistory,
  transactions,
  transactionLocks,
  transactionQueue,
} from "./schemas/trading";

import {
  simulationSessions,
  simulationTrades,
  riskEvents,
  positionSnapshots,
  reconciliationReports,
  errorIncidents,
  systemHealthMetrics,
} from "./schemas/safety";

import {
  monitoredListings,
  patternEmbeddings,
  patternSimilarityCache,
} from "./schemas/patterns";

import {
  workflowSystemStatus,
  workflowActivity,
} from "./schemas/workflows";

import {
  agentPerformanceMetrics,
  workflowPerformanceMetrics,
  systemPerformanceSnapshots,
  performanceAlerts,
  performanceBaselines,
} from "./schemas/performance";

import {
  alertRules,
  alertInstances,
  notificationChannels,
  escalationPolicies,
  alertNotifications,
  alertCorrelations,
  alertSuppressions,
  anomalyModels,
  alertAnalytics,
} from "./schemas/alerts";

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
};

// Export all types
export type * from "./schemas/auth";
export type * from "./schemas/trading";
export type * from "./schemas/safety";
export type * from "./schemas/patterns";
export type * from "./schemas/workflows";
export type * from "./schemas/performance";
export type * from "./schemas/alerts";

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
};

// Default export for database initialization
export default allTables;