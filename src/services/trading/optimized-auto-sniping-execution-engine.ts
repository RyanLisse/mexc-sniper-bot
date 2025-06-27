/**
 * Optimized Auto-Sniping Execution Engine - Modular Entry Point
 *
 * This file serves as a clean entry point to the modular execution engine.
 * The original 959-line monolithic implementation has been refactored into focused modules:
 *
 * MODULES:
 * - auto-sniping/execution-engine.ts: Core execution logic (<500 lines)
 * - auto-sniping/schemas.ts: Type definitions and validation (172 lines)
 * - auto-sniping/config-manager.ts: Configuration management (<500 lines)
 * - auto-sniping/alert-manager.ts: Alert system (<500 lines)
 *
 * BENEFITS:
 * - Reduced from 959 lines to focused modules under 500 lines each
 * - Improved separation of concerns and testability
 * - Enhanced type safety with dedicated validation
 * - Better error handling and monitoring
 * - Cleaner code organization
 */

// ============================================================================
// Re-export Main Execution Engine for Backward Compatibility
// ============================================================================

export { AutoSnipingExecutionEngine as OptimizedAutoSnipingExecutionEngine } from "./auto-sniping/execution-engine";
export { AutoSnipingExecutionEngine as AutoSnipingExecutionService } from "./auto-sniping/execution-engine";

// ============================================================================
// Re-export Supporting Modules
// ============================================================================

export { AutoSnipingConfigManager } from "./auto-sniping/config-manager";
export { AutoSnipingAlertManager } from "./auto-sniping/alert-manager";

// ============================================================================
// Re-export Types and Schemas
// ============================================================================

export {
  type AutoSnipingConfig,
  type ExecutionPosition,
  type ExecutionStats,
  type ExecutionAlert,
  type ExecutionResult,
  type PatternType,
  type TradingOpportunity,
  type SystemHealth,
  
  // Validation functions
  validateAutoSnipingConfig,
  validateExecutionPosition,
  validateExecutionStats,
  validateExecutionAlert,
} from "./auto-sniping/schemas";

// ============================================================================
// Factory Functions
// ============================================================================

import { AutoSnipingExecutionEngine } from "./auto-sniping/execution-engine";
import { AutoSnipingConfigManager } from "./auto-sniping/config-manager";
import type { AutoSnipingConfig } from "./auto-sniping/schemas";

/**
 * Create a new execution engine instance with configuration
 */
export function createOptimizedAutoSnipingExecutionEngine(
  config?: Partial<AutoSnipingConfig>
): AutoSnipingExecutionEngine {
  const configManager = new AutoSnipingConfigManager(config);
  return new AutoSnipingExecutionEngine(configManager);
}

/**
 * Legacy type aliases for backward compatibility
 */
export type TradingContext = {
  requestId: string;
  startTime: number;
  userId: string;
};

export type TradeExecutionResult = {
  success: boolean;
  orderId?: string;
  executedPrice?: string;
  error?: string;
};

// ============================================================================
// Migration Guide
// ============================================================================

/**
 * MIGRATION GUIDE FOR OPTIMIZED EXECUTION ENGINE:
 *
 * The refactored implementation maintains API compatibility while improving architecture:
 *
 * OLD USAGE (still works):
 * ```typescript
 * import { OptimizedAutoSnipingExecutionEngine } from './optimized-auto-sniping-execution-engine';
 * const engine = OptimizedAutoSnipingExecutionEngine.getInstance();
 * ```
 *
 * NEW USAGE (recommended):
 * ```typescript
 * import { createOptimizedAutoSnipingExecutionEngine } from './optimized-auto-sniping-execution-engine';
 * const engine = createOptimizedAutoSnipingExecutionEngine(config);
 * ```
 *
 * IMPROVEMENTS:
 * 1. **Modular Architecture**: Split into focused modules under 500 lines each
 * 2. **Better Testing**: Each module can be tested in isolation
 * 3. **Enhanced Configuration**: Dedicated configuration management
 * 4. **Improved Error Handling**: Better error reporting and recovery
 * 5. **Type Safety**: Enhanced Zod validation throughout
 */