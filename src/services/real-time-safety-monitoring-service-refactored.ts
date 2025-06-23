/**
 * Real-time Safety Monitoring Service - Refactored Implementation
 *
 * This file maintains 100% backward compatibility with the original
 * RealTimeSafetyMonitoringService while using the new modular architecture underneath.
 *
 * The modular implementation provides:
 * - Improved maintainability with focused modules under 500 lines each
 * - Better testability with isolated components
 * - Enhanced type safety with comprehensive Zod validation
 * - Cleaner separation of concerns
 * - Full backward compatibility with existing code
 *
 * Original file: 1552 lines → Modular implementation: 5 focused modules
 */

// Re-export everything from the modular implementation
export {
  RealTimeSafetyMonitoringService,
  createRealTimeSafetyMonitoringService,
  // Re-export types for backward compatibility
  type SafetyConfiguration,
  type SafetyThresholds,
  type RiskMetrics,
  type SafetyAlert,
  type SafetyAction,
  type SafetyMonitoringReport,
  type SystemHealth,
  type MonitoringStats,
  // Export individual modules for advanced usage
  CoreSafetyMonitoring,
  AlertManagement,
  EventHandling,
  RiskAssessment,
  ConfigurationManagement,
  // Export factory functions
  createCoreSafetyMonitoring,
  createAlertManagement,
  createEventHandling,
  createRiskAssessment,
  createConfigurationManagement,
  // Export module-specific types
  type CoreSafetyMonitoringConfig,
  type RiskAssessmentUpdate,
  type ThresholdCheckResult,
  type AlertManagementConfig,
  type AlertGenerationData,
  type AlertStatistics,
  type EventHandlingConfig,
  type OperationRegistration,
  type OperationStatus,
  type TimerCoordinatorStats,
  type RiskAssessmentConfig,
  type ComprehensiveRiskAssessment,
  type PortfolioRiskAssessment,
  type PerformanceRiskAssessment,
  type PatternRiskAssessment,
  type SystemRiskAssessment,
  type ConfigurationManagementConfig,
  type ConfigurationUpdate,
  type ConfigurationValidationResult,
  type ConfigurationPreset,
} from "./real-time-safety-monitoring-modules";

// For backward compatibility, also export the main class as default
import { RealTimeSafetyMonitoringService } from "./real-time-safety-monitoring-modules";
export default RealTimeSafetyMonitoringService;

/**
 * MIGRATION GUIDE FOR DEVELOPERS:
 *
 * The refactored RealTimeSafetyMonitoringService maintains 100% API compatibility.
 * Existing code will continue to work without any changes:
 *
 * ```typescript
 * // This code continues to work exactly as before
 * const safetyService = RealTimeSafetyMonitoringService.getInstance();
 * await safetyService.startMonitoring();
 * const report = await safetyService.getSafetyReport();
 * ```
 *
 * BENEFITS OF THE MODULAR REFACTORING:
 *
 * 1. **Improved Maintainability**:
 *    - Original: 1552-line monolithic file
 *    - Refactored: 5 focused modules, each < 500 lines
 *
 * 2. **Better Testability**:
 *    - Each module can be tested in isolation
 *    - Comprehensive test coverage for individual components
 *    - TDD approach for all new features
 *
 * 3. **Enhanced Type Safety**:
 *    - Comprehensive Zod validation schemas
 *    - Runtime type checking for all inputs
 *    - Better error messages and debugging
 *
 * 4. **Cleaner Architecture**:
 *    - Core Safety Monitoring: Main monitoring and risk metric updates
 *    - Alert Management: Alert generation, acknowledgment, and auto-action execution
 *    - Event Handling: Timer coordination and scheduled operations
 *    - Risk Assessment: Specialized risk calculations and assessments
 *    - Configuration Management: Configuration validation and management
 *
 * 5. **Advanced Usage Patterns**:
 *    - Direct access to individual modules for specialized use cases
 *    - Factory functions for flexible component instantiation
 *    - Comprehensive configuration options for each module
 *
 * ADVANCED USAGE EXAMPLES:
 *
 * ```typescript
 * // Use individual modules for specialized requirements
 * import { createCoreSafetyMonitoring } from './real-time-safety-monitoring-service';
 *
 * const coreMonitoring = createCoreSafetyMonitoring({
 *   configuration: customConfig,
 *   executionService: customExecutionService,
 *   patternMonitoring: customPatternMonitoring,
 * });
 *
 * const riskUpdate = await coreMonitoring.performMonitoringCycle();
 * ```
 *
 * ```typescript
 * // Create specialized instances for different risk profiles
 * import { createConfigurationManagement } from './real-time-safety-monitoring-service';
 *
 * const conservativeConfig = createConfigurationManagement({
 *   thresholds: {
 *     maxDrawdownPercentage: 5,
 *     minSuccessRatePercentage: 80,
 *     maxConsecutiveLosses: 2,
 *   },
 * });
 *
 * const aggressiveConfig = createConfigurationManagement({
 *   thresholds: {
 *     maxDrawdownPercentage: 25,
 *     minSuccessRatePercentage: 50,
 *     maxConsecutiveLosses: 8,
 *   },
 * });
 * ```
 *
 * ```typescript
 * // Advanced risk assessment usage
 * import { createRiskAssessment } from './real-time-safety-monitoring-service';
 *
 * const riskAssessment = createRiskAssessment(config);
 * const comprehensiveAssessment = await riskAssessment.performComprehensiveAssessment();
 *
 * // Access specific risk categories
 * console.log('Portfolio Risk:', comprehensiveAssessment.portfolio);
 * console.log('Performance Risk:', comprehensiveAssessment.performance);
 * console.log('Pattern Risk:', comprehensiveAssessment.pattern);
 * console.log('System Risk:', comprehensiveAssessment.system);
 * ```
 *
 * MODULE BREAKDOWN:
 *
 * 1. **Core Safety Monitoring** (core-safety-monitoring.ts)
 *    - Main monitoring cycle management
 *    - Risk metric updates and calculations
 *    - Threshold checking and violation detection
 *    - Overall risk score computation
 *
 * 2. **Alert Management** (alert-management.ts)
 *    - Alert generation and lifecycle management
 *    - Auto-action execution and tracking
 *    - Alert acknowledgment and cleanup
 *    - Alert statistics and filtering
 *
 * 3. **Event Handling** (event-handling.ts)
 *    - Timer coordination and operation scheduling
 *    - Prevents overlapping operations
 *    - Operation lifecycle management
 *    - Performance monitoring and statistics
 *
 * 4. **Risk Assessment** (risk-assessment.ts)
 *    - Specialized risk calculations across categories
 *    - Portfolio, performance, pattern, and system risk assessment
 *    - Comprehensive risk scoring and recommendations
 *    - Risk status determination
 *
 * 5. **Configuration Management** (configuration-management.ts)
 *    - Configuration validation and updates
 *    - Preset management (Conservative, Balanced, Aggressive, Emergency)
 *    - Configuration history tracking
 *    - Dynamic configuration updates with validation
 *
 * TESTING STRATEGY:
 *
 * Each module includes comprehensive tests covering:
 * - Unit tests for individual methods
 * - Integration tests for module interactions
 * - Error handling and edge cases
 * - Performance and reliability tests
 * - Backward compatibility verification
 *
 * Run tests with: `bun run test real-time-safety-monitoring`
 */
