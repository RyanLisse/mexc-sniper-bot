/**
 * Auto-Sniping Execution Engine
 *
 * Re-export from the optimized auto-sniping execution engine for compatibility.
 */

// Re-export everything from the optimized engine
export * from "../optimized-auto-sniping-execution-engine";

// Re-export the core auto-sniping module
export { AutoSnipingModule } from "../consolidated/core-trading/auto-sniping";

// Export for test compatibility
export { AutoSnipingModule as AutoSnipingExecutionEngine } from "../consolidated/core-trading/auto-sniping";

// Additional exports for testing compatibility
export type {
  AutoSnipeTarget,
  ServiceResponse,
  TradeResult,
} from "../consolidated/core-trading.types";