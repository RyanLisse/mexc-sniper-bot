/**
 * Core Trading Service - Modular Entry Point
 *
 * This file serves as a clean entry point to the modular core trading system.
 * The original 1292-line monolithic implementation has been refactored into focused modules:
 *
 * MODULES:
 * - core-trading/base-service.ts: Main orchestrator class (<500 lines)
 * - core-trading/manual-trading.ts: Manual trading operations (<500 lines) 
 * - core-trading/auto-sniping.ts: Auto-sniping execution (<500 lines)
 * - core-trading/position-manager.ts: Position management (<500 lines)
 * - core-trading/performance-tracker.ts: Performance analytics (<500 lines)
 * - core-trading/strategy-manager.ts: Strategy management (<500 lines)
 * - core-trading/types.ts: Type definitions and schemas (<500 lines)
 *
 * BENEFITS:
 * - Reduced from 1292 lines to focused modules under 500 lines each
 * - Improved separation of concerns and testability
 * - Enhanced type safety with dedicated validation
 * - Better error handling and monitoring
 * - Cleaner code organization
 */

// ============================================================================
// Re-export Main Service Class for Backward Compatibility
// ============================================================================

export { CoreTradingService } from "./core-trading/base-service";

// ============================================================================
// Re-export Supporting Modules
// ============================================================================

export { ManualTradingModule } from "./core-trading/manual-trading";
export { AutoSnipingModule } from "./core-trading/auto-sniping";
export { PositionManager } from "./core-trading/position-manager";
export { PerformanceTracker } from "./core-trading/performance-tracker";
export { StrategyManager } from "./core-trading/strategy-manager";

// ============================================================================
// Re-export Types and Schemas
// ============================================================================

export {
  type CoreTradingConfig,
  type CoreTradingEvents,
  type TradeParameters,
  type TradeResult,
  type Position,
  type ServiceResponse,
  type ServiceStatus,
  type PerformanceMetrics,
  type TradingStrategy,
  type MultiPhaseConfig,
  type MultiPhaseResult,
  type AutoSnipeTarget,
  
  // Validation schemas
  CoreTradingConfigSchema,
  TradeParametersSchema,
  ServiceStatusSchema,
} from "./core-trading/types";

// ============================================================================
// Factory Functions for Easy Initialization
// ============================================================================

import { CoreTradingService } from "./core-trading/base-service";
import type { CoreTradingConfig } from "./core-trading/types";

/**
 * Get the global Core Trading Service instance (singleton)
 */
export function getCoreTrading(config?: Partial<CoreTradingConfig>): CoreTradingService {
  return CoreTradingService.getInstance(config);
}

/**
 * Reset the global Core Trading Service instance
 */
export function resetCoreTrading(): void {
  CoreTradingService.resetInstance();
}

/**
 * Create a new Core Trading Service instance (not singleton)
 */
export function createCoreTrading(config: Partial<CoreTradingConfig>): CoreTradingService {
  return new CoreTradingService(config);
}

// ============================================================================
// Migration Guide
// ============================================================================

/**
 * MIGRATION GUIDE FOR CORE TRADING SERVICE:
 *
 * The refactored implementation maintains API compatibility while improving architecture:
 *
 * OLD USAGE (still works):
 * ```typescript
 * import { CoreTradingService, getCoreTrading } from './consolidated/core-trading.service';
 * const trading = getCoreTrading(config);
 * const result = await trading.executeTrade(params);
 * ```
 *
 * NEW USAGE (recommended for advanced users):
 * ```typescript
 * import { 
 *   CoreTradingService, 
 *   ManualTradingModule,
 *   PositionManager 
 * } from './consolidated/core-trading.service';
 * 
 * const trading = new CoreTradingService(config);
 * await trading.initialize();
 * ```
 *
 * IMPROVEMENTS:
 * 1. **Modular Architecture**: Split into 7 focused modules, each < 500 lines
 * 2. **Better Testing**: Each module can be tested in isolation
 * 3. **Enhanced Configuration**: Dedicated configuration management
 * 4. **Improved Error Handling**: Better error reporting and recovery
 * 5. **Type Safety**: Enhanced Zod validation throughout
 */

// Default export for backward compatibility
export default CoreTradingService;