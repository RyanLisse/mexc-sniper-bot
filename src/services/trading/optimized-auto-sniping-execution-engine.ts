/**
 * Optimized Auto-Sniping Execution Engine
 *
 * Re-export module that provides the OptimizedAutoSnipingExecutionEngine interface
 * for compatibility with existing imports. This consolidates the auto-sniping functionality
 * from the core trading modules.
 */

import type {
  AutoSnipeTarget,
  ServiceResponse,
  TradeResult,
} from "./consolidated/core-trading.types";

// Re-export the AutoSnipingModule as OptimizedAutoSnipingExecutionEngine for compatibility
export { AutoSnipingModule as OptimizedAutoSnipingExecutionEngine } from "./consolidated/core-trading/auto-sniping";

// Export the interface that other modules expect
export interface OptimizedAutoSnipingExecutionEngine {
  /**
   * Start auto-sniping monitoring
   */
  start(): Promise<ServiceResponse<void>>;

  /**
   * Stop auto-sniping monitoring
   */
  stop(): Promise<ServiceResponse<void>>;

  /**
   * Pause auto-sniping monitoring
   */
  pause(): Promise<ServiceResponse<void>>;

  /**
   * Resume auto-sniping monitoring
   */
  resume(): Promise<ServiceResponse<void>>;

  /**
   * Get module status
   */
  getStatus(): {
    isActive: boolean;
    isHealthy: boolean;
    lastSnipeCheck: Date | null;
    processedTargets: number;
    successfulSnipes: number;
    failedSnipes: number;
    successRate: number;
  };

  /**
   * Process snipe targets manually
   */
  processSnipeTargets(): Promise<ServiceResponse<{ processedCount: number; successCount: number }>>;

  /**
   * Execute a specific snipe target
   */
  executeSnipeTarget(target: AutoSnipeTarget): Promise<TradeResult>;

  /**
   * Update configuration
   */
  updateConfig(config: any): Promise<void>;

  /**
   * Initialize the engine
   */
  initialize(): Promise<void>;

  /**
   * Shutdown the engine
   */
  shutdown(): Promise<void>;
}

// Export types for external use
export type { AutoSnipeTarget, ServiceResponse, TradeResult };
