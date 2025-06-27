/**
 * Auto-Sniping Orchestrator - Modular Entry Point
 *
 * This file serves as a clean entry point to the modular auto-sniping orchestrator system.
 * The original 1142-line monolithic implementation has been refactored into focused modules:
 *
 * MODULES:
 * - orchestrator/core-orchestrator.ts: Main orchestrator class (<500 lines)
 * - orchestrator/pattern-processor.ts: Pattern detection and processing (<500 lines)
 * - orchestrator/trade-executor.ts: Trade execution and monitoring (<500 lines)
 * - orchestrator/position-monitor.ts: Position monitoring and management (<500 lines)
 * - orchestrator/safety-manager.ts: Safety checks and risk management (<500 lines)
 * - orchestrator/types.ts: Type definitions and schemas (<500 lines)
 *
 * BENEFITS:
 * - Reduced from 1142 lines to focused modules under 500 lines each
 * - Improved separation of concerns and testability
 * - Enhanced type safety with dedicated validation
 * - Better error handling and monitoring
 * - Cleaner code organization
 */

// ============================================================================
// Re-export Main Orchestrator Class for Backward Compatibility
// ============================================================================

export { AutoSnipingOrchestrator } from "./orchestrator/core-orchestrator";

// ============================================================================
// Re-export Supporting Modules
// ============================================================================

export { PatternProcessor } from "./orchestrator/pattern-processor";
export { PositionMonitor } from "./orchestrator/position-monitor";
export { SafetyManager } from "./orchestrator/safety-manager";
export { TradeExecutor } from "./orchestrator/trade-executor";

// ============================================================================
// Re-export Types and Schemas
// ============================================================================

export {
  type AutoSnipingConfig,
  // Validation schemas
  AutoSnipingConfigSchema,
  type AutoSnipingMetrics,
  type AutoSnipingStatus,
  AutoSnipingStatusSchema,
} from "./orchestrator/types";

// ============================================================================
// Factory Functions for Easy Initialization
// ============================================================================

import { AutoSnipingOrchestrator } from "./orchestrator/core-orchestrator";
import type { AutoSnipingConfig } from "./orchestrator/types";

/**
 * Get the singleton instance of the auto-sniping orchestrator
 */
export function getAutoSnipingOrchestrator(
  config?: Partial<AutoSnipingConfig>
): AutoSnipingOrchestrator {
  return AutoSnipingOrchestrator.getInstance(config);
}

/**
 * Create a new auto-sniping orchestrator instance (not singleton)
 */
export function createAutoSnipingOrchestrator(
  config?: Partial<AutoSnipingConfig>
): AutoSnipingOrchestrator {
  return new AutoSnipingOrchestrator(config);
}

// ============================================================================
// Migration Guide
// ============================================================================

/**
 * MIGRATION GUIDE FOR AUTO-SNIPING ORCHESTRATOR:
 *
 * The refactored implementation maintains API compatibility while improving architecture:
 *
 * OLD USAGE (still works):
 * ```typescript
 * import { AutoSnipingOrchestrator } from './auto-sniping-orchestrator';
 * const orchestrator = AutoSnipingOrchestrator.getInstance(config);
 * await orchestrator.startAutoSniping();
 * ```
 *
 * NEW USAGE (recommended for advanced users):
 * ```typescript
 * import {
 *   AutoSnipingOrchestrator,
 *   PatternProcessor,
 *   TradeExecutor
 * } from './auto-sniping-orchestrator';
 *
 * const orchestrator = new AutoSnipingOrchestrator(config);
 * await orchestrator.startAutoSniping();
 * ```
 *
 * IMPROVEMENTS:
 * 1. **Modular Architecture**: Split into 6 focused modules, each < 500 lines
 * 2. **Better Testing**: Each module can be tested in isolation
 * 3. **Enhanced Safety**: Dedicated safety management module
 * 4. **Improved Error Handling**: Better error reporting and recovery
 * 5. **Type Safety**: Enhanced Zod validation throughout
 */

// Default export for backward compatibility
export default AutoSnipingOrchestrator;
