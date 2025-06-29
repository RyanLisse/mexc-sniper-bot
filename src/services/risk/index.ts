/**
 * Safety Systems - Main Export File
 *
 * Centralized export point for all safety monitoring components.
 * Provides easy access to core safety services and enhanced monitoring capabilities.
 */

export { AdvancedEmergencyCoordinator } from "./advanced-emergency-coordinator";
export type {
  ComprehensiveSafetyStatus,
  SafetyAlert,
  SafetyCoordinatorConfig,
  SafetyMetrics,
} from "./comprehensive-safety-coordinator";
// Core Safety Components
export { ComprehensiveSafetyCoordinator } from "./comprehensive-safety-coordinator";
// Enhanced Safety Systems
export { EnhancedRealTimeSafetyMonitor } from "./enhanced-real-time-safety-monitor";
export type {
  IntegratedSafetyConfig,
  SafetySystemMetrics,
  SafetySystemStatus,
} from "./integrated-safety-monitoring-system";
// Integrated Safety System
export {
  createIntegratedSafetyMonitoringSystem,
  DEFAULT_INTEGRATED_SAFETY_CONFIG,
  IntegratedSafetyMonitoringSystem,
} from "./integrated-safety-monitoring-system";
// Import for local use
import { createIntegratedSafetyMonitoringSystem } from "./integrated-safety-monitoring-system";
export type {
  AlertGenerationData,
  AlertManagementConfig,
} from "./real-time-safety-monitoring-modules/alert-management";
export {
  AlertManagement,
  createAlertManagement,
} from "./real-time-safety-monitoring-modules/alert-management";
export type {
  CoreSafetyMonitoringConfig,
  RiskAssessmentUpdate,
} from "./real-time-safety-monitoring-modules/core-safety-monitoring";
// Real-time Safety Monitoring Modules
export {
  CoreSafetyMonitoring,
  createCoreSafetyMonitoring,
} from "./real-time-safety-monitoring-modules/core-safety-monitoring";
export type {
  EventHandlingConfig,
  OperationRegistration,
} from "./real-time-safety-monitoring-modules/event-handling";
export {
  createEventHandling,
  EventHandling,
} from "./real-time-safety-monitoring-modules/event-handling";
export type {
  ComprehensiveRiskAssessment,
  RiskAssessmentConfig,
} from "./real-time-safety-monitoring-modules/risk-assessment";
export {
  createRiskAssessment,
  RiskAssessment,
} from "./real-time-safety-monitoring-modules/risk-assessment";

// Utility function for easy setup
export function createSafetySystem(config: any) {
  return createIntegratedSafetyMonitoringSystem(config);
}

/**
 * Safety Systems Documentation
 *
 * ARCHITECTURE:
 * - Modular design with single-responsibility components
 * - Real implementation logic (no placeholders)
 * - Comprehensive error handling and recovery
 * - Type-safe with Zod validation
 *
 * CORE MODULES:
 * - CoreSafetyMonitoring: Real-time metrics and threshold checking
 * - AlertManagement: Auto-actions and emergency responses
 * - RiskAssessment: Comprehensive risk analysis
 * - EventHandling: Timer coordination and operation management
 *
 * ENHANCED MODULES:
 * - EnhancedRealTimeSafetyMonitor: ML insights and anomaly detection
 * - AdvancedEmergencyCoordinator: Sophisticated emergency protocols
 *
 * INTEGRATION:
 * - IntegratedSafetyMonitoringSystem: Orchestrates all components
 * - Cross-module event coordination
 * - Unified monitoring cycles
 * - Emergency stop capabilities
 *
 * USAGE:
 * ```typescript
 * import { createSafetySystem } from '@/src/services/risk';
 *
 * const safetySystem = createSafetySystem({
 *   configuration: safetyConfig,
 *   executionService,
 *   patternMonitoring,
 *   emergencySystem,
 *   mexcService,
 *   enableEnhancedMonitoring: true
 * });
 *
 * await safetySystem.start();
 * ```
 */
