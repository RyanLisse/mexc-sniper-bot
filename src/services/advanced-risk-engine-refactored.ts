/**
 * Advanced Risk Management Engine - Refactored Implementation
 *
 * This file maintains 100% backward compatibility with the original
 * AdvancedRiskEngine while using the new modular architecture underneath.
 *
 * The modular implementation provides:
 * - Improved maintainability with focused modules under 500 lines each
 * - Better testability with isolated components
 * - Enhanced type safety with comprehensive Zod validation
 * - Cleaner separation of concerns
 * - Full backward compatibility with existing code
 *
 * Original file: 1822 lines → Modular implementation: 5 focused modules
 */

// Re-export everything from the modular implementation
export {
  AdvancedRiskEngine,
  createAdvancedRiskEngine,
  // Re-export types for backward compatibility
  type MarketConditions,
  type PositionRiskProfile,
  type PortfolioRiskMetrics,
  type RiskEngineConfig,
  type RiskAlert,
  type StressTestScenario,
  // Export individual modules for advanced usage
  CoreRiskAssessment,
  MarketConditionsManager,
  DynamicCalculations,
  StressTestingValidation,
  EventManagementHealth,
  // Export factory functions
  createCoreRiskAssessment,
  createMarketConditionsManager,
  createDynamicCalculations,
  createStressTestingValidation,
  createEventManagementHealth,
  // Export module-specific types
  type CoreRiskAssessmentConfig,
  type MarketConditionsManagerConfig,
  type DynamicCalculationsConfig,
  type StressTestingConfig,
  type EventManagementConfig,
  type TradeRiskResult,
  type PortfolioUpdate,
  type StopLossRecommendation,
  type TakeProfitRecommendation,
  type PositionSizeValidation,
  type VolatilityAdjustment,
  type StopLossValidation,
  type DiversificationAssessment,
  type StressTestResult,
  type FlashCrashDetection,
  type ManipulationDetection,
  type LiquidityAssessment,
  type PortfolioRiskCalculation,
  type HealthStatus,
} from "./advanced-risk-engine-modules";

// For backward compatibility, also export the main class as default
import { AdvancedRiskEngine } from "./advanced-risk-engine-modules";
export default AdvancedRiskEngine;

/**
 * MIGRATION GUIDE FOR DEVELOPERS:
 *
 * The refactored AdvancedRiskEngine maintains 100% API compatibility.
 * Existing code will continue to work without any changes:
 *
 * ```typescript
 * // This code continues to work exactly as before
 * const riskEngine = new AdvancedRiskEngine(config);
 * const assessment = await riskEngine.assessTradeRisk('BTCUSDT', 'buy', 0.1, 45000);
 * ```
 *
 * BENEFITS OF THE MODULAR REFACTORING:
 *
 * 1. **Improved Maintainability**:
 *    - Original: 1822-line monolithic file
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
 *    - Core Risk Assessment: Main risk calculation logic
 *    - Market Conditions Manager: Market data and portfolio management
 *    - Dynamic Calculations: Stop-loss, take-profit, and adaptive calculations
 *    - Stress Testing Validation: Stress testing and emergency protocols
 *    - Event Management Health: Event emission and health monitoring
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
 * import { createCoreRiskAssessment } from './advanced-risk-engine';
 *
 * const coreRisk = createCoreRiskAssessment({
 *   riskConfig: customConfig,
 *   marketConditions: currentConditions,
 *   positions: positionMap,
 * });
 *
 * const assessment = await coreRisk.assessTradeRisk('BTCUSDT', 'buy', 0.1, 45000);
 * ```
 *
 * ```typescript
 * // Create specialized instances for different portfolios
 * import { createDynamicCalculations } from './advanced-risk-engine';
 *
 * const conservativeCalc = createDynamicCalculations({
 *   riskConfig: conservativeConfig,
 *   marketConditions,
 *   positions,
 * });
 *
 * const aggressiveCalc = createDynamicCalculations({
 *   riskConfig: aggressiveConfig,
 *   marketConditions,
 *   positions,
 * });
 * ```
 */
