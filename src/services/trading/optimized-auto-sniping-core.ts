/**
 * Optimized Auto-Sniping Core Service - Modular Entry Point
 *
 * This file now serves as a clean entry point to the modular auto-sniping system.
 * The original 1314-line monolithic implementation has been split into focused modules:
 *
 * MODULES:
 * - auto-sniping/schemas.ts: Zod schemas and type definitions (172 lines)
 * - auto-sniping/core-orchestrator.ts: Main orchestrator class (<500 lines)
 * - auto-sniping/execution-engine.ts: Core execution logic (<500 lines)
 * - auto-sniping/config-manager.ts: Configuration management (<500 lines)
 * - auto-sniping/alert-manager.ts: Alert and notification system (<500 lines)
 *
 * BENEFITS:
 * - Improved maintainability with focused responsibilities
 * - Better testability with isolated components
 * - Enhanced type safety with dedicated schema validation
 * - Cleaner separation of concerns
 * - Each module under 500 lines for better readability
 */

// ============================================================================
// Re-export Schemas and Types for Backward Compatibility
// ============================================================================

export {
  // Zod Schemas
  PatternTypeSchema,
  AlertSeveritySchema,
  AlertTypeSchema,
  PositionStatusSchema,
  ExecutionStatusSchema,
  AutoSnipingConfigSchema,
  ExecutionPositionSchema,
  ExecutionStatsSchema,
  ExecutionAlertSchema,
  
  // Types
  type PatternType,
  type AutoSnipingConfig,
  type ExecutionPosition,
  type ExecutionStats,
  type ExecutionAlert,
  type ExecutionStatus,
  type AlertSeverity,
  type AlertType,
  type PositionStatus,
  type SystemHealth,
  type TradingOpportunity,
  type ExecutionResult,
} from "./auto-sniping/schemas";

// ============================================================================
// Re-export Main Orchestrator Class
// ============================================================================

export { OptimizedAutoSnipingCore } from "./auto-sniping/core-orchestrator";

// ============================================================================
// Re-export Individual Modules for Advanced Usage
// ============================================================================

export { AutoSnipingConfigManager } from "./auto-sniping/config-manager";
export { AutoSnipingExecutionEngine } from "./auto-sniping/execution-engine";
export { AutoSnipingAlertManager } from "./auto-sniping/alert-manager";

// ============================================================================
// Factory Functions for Easy Initialization
// ============================================================================

import { OptimizedAutoSnipingCore } from "./auto-sniping/core-orchestrator";
import type { AutoSnipingConfig } from "./auto-sniping/schemas";

/**
 * Create a new optimized auto-sniping core instance
 */
export function createOptimizedAutoSnipingCore(
  config?: Partial<AutoSnipingConfig>
): OptimizedAutoSnipingCore {
  return OptimizedAutoSnipingCore.getInstance(config);
}

/**
 * Get the singleton instance of the auto-sniping core
 */
export function getOptimizedAutoSnipingCore(): OptimizedAutoSnipingCore {
  return OptimizedAutoSnipingCore.getInstance();
}

// ============================================================================
// Type Guards and Validation Helpers
// ============================================================================

export {
  validateAutoSnipingConfig,
  validateExecutionPosition,
  validateExecutionStats,
  validateExecutionAlert,
} from "./auto-sniping/schemas";

// ============================================================================
// Migration Guide for Developers
// ============================================================================

/**
 * MIGRATION GUIDE - BREAKING CHANGES FROM MONOLITHIC VERSION:
 *
 * The refactored implementation maintains API compatibility but changes internal structure.
 * Existing code should continue to work:
 *
 * ```typescript
 * // This code continues to work exactly as before
 * import { OptimizedAutoSnipingCore, createOptimizedAutoSnipingCore } from './optimized-auto-sniping-core';
 * 
 * const core = createOptimizedAutoSnipingCore(config);
 * const stats = await core.getExecutionStats();
 * ```
 *
 * INTERNAL ARCHITECTURE IMPROVEMENTS:
 *
 * 1. **Modular Structure**:
 *    - Original: 1314-line monolithic file
 *    - Refactored: 5 focused modules, each < 500 lines
 *
 * 2. **Enhanced Testability**:
 *    - Each module can be tested in isolation
 *    - Comprehensive test coverage for individual components
 *    - Better mocking capabilities for unit tests
 *
 * 3. **Improved Maintainability**:
 *    - Clear separation of concerns
 *    - Dedicated schema validation
 *    - Easier debugging and feature development
 *
 * 4. **Better Type Safety**:
 *    - Comprehensive Zod validation schemas
 *    - Runtime type checking for all inputs
 *    - Enhanced error messages and debugging
 */