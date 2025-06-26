/**
 * Real-time Safety Monitoring Service - Backward Compatibility Export
 *
 * This file provides backward compatibility for imports expecting
 * real-time-safety-monitoring-service.ts. The actual implementation has been
 * moved to real-time-safety-monitoring-modules/ for better modularity.
 */

// Re-export everything from the modular implementation
// Re-export default for backward compatibility
export {
  type AlertGenerationData,
  AlertManagement,
  type AlertManagementConfig,
  type AlertStatistics,
  type ComprehensiveRiskAssessment,
  ConfigurationManagement,
  type ConfigurationManagementConfig,
  type ConfigurationPreset,
  type ConfigurationUpdate,
  type ConfigurationValidationResult,
  // Export individual modules for advanced usage
  CoreSafetyMonitoring,
  // Export module types for advanced usage
  type CoreSafetyMonitoringConfig,
  createAlertManagement,
  createConfigurationManagement,
  // Export factory functions
  createCoreSafetyMonitoring,
  createEventHandling,
  createRealTimeSafetyMonitoringService,
  createRiskAssessment,
  default,
  EventHandling,
  type EventHandlingConfig,
  type MonitoringStats,
  type OperationRegistration,
  type OperationStatus,
  type PatternRiskAssessment,
  type PerformanceRiskAssessment,
  type PortfolioRiskAssessment,
  RealTimeSafetyMonitoringService,
  RiskAssessment,
  type RiskAssessmentConfig,
  type RiskAssessmentUpdate,
  type RiskMetrics,
  type SafetyAction,
  type SafetyAlert,
  // Export all types for backward compatibility
  type SafetyConfiguration,
  type SafetyMonitoringReport,
  type SafetyThresholds,
  type SystemHealth,
  type SystemRiskAssessment,
  type ThresholdCheckResult,
  type TimerCoordinatorStats,
} from "./real-time-safety-monitoring-modules";
