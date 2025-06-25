/**
 * Auto-Sniping Execution Service - Backward Compatibility Export
 *
 * This file provides backward compatibility for imports expecting
 * auto-sniping-execution-service.ts. The actual implementation has been
 * moved to optimized-auto-sniping-execution-engine.ts for better modularity.
 */

// Re-export the optimized implementation as the expected class name
export { OptimizedAutoSnipingExecutionEngine as AutoSnipingExecutionService } from "./optimized-auto-sniping-execution-engine";

// Re-export related types for convenience
export type {
  AutoSnipingConfig,
  ExecutionAlert,
  ExecutionPosition,
  ExecutionStats,
  PatternType,
} from "./optimized-auto-sniping-schemas";
