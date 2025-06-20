/**
 * Parameter Optimization Engine - Simplified Implementation
 *
 * Simplified version of parameter optimization for bundle size optimization.
 * Complex optimization models (Bayesian, Genetic, RL) have been removed.
 * This maintains API compatibility while reducing code overhead.
 */

import { EventEmitter } from "node:events";
import { getParameterManager, type ParameterManager } from "../lib/parameter-management";
import { logger } from "../lib/utils";

export interface OptimizationObjective {
  name: string;
  weight: number;
  direction: "maximize" | "minimize";
  metric: (performance: PerformanceMetrics) => number;
}

export interface PerformanceMetrics {
  profitability: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  avgTradeDuration: number;
  systemLatency: number;
  errorRate: number;
  patternAccuracy: number;
  riskAdjustedReturn: number;
  volatility: number;
  calmarRatio: number;
  beta: number;
}

export interface OptimizationStrategy {
  algorithm: "simple" | "grid_search" | "random_search";
  maxIterations: number;
  convergenceThreshold: number;
  parallelEvaluations: number;
  explorationRate: number;
}

export interface OptimizationRequest {
  parameterCategories: string[];
  objectives: OptimizationObjective[];
  strategy: OptimizationStrategy;
  safetyConstraints: Record<string, any>;
  backtestingPeriod: {
    start: Date;
    end: Date;
  };
}

export interface OptimizationResult {
  optimizedParameters: Record<string, any>;
  performanceImprovement: number;
  confidenceInterval: [number, number];
  backtestResults: any;
  convergenceMetrics: {
    iterations: number;
    finalScore: number;
    convergenceRate: number;
  };
  safetyValidation: {
    passed: boolean;
    violations: string[];
  };
}

export class ParameterOptimizationEngine extends EventEmitter {
  private parameterManager: ParameterManager;
  private activeOptimizations = new Map<string, any>();
  private optimizationHistory: any[] = [];
  private performanceBaseline: PerformanceMetrics | null = null;

  constructor(parameterManager?: ParameterManager) {
    super();
    this.parameterManager = parameterManager || getParameterManager();
    
    // Skip initialization during build time
    if (!this.isBuildEnvironment()) {
      logger.info("Parameter Optimization Engine initialized (simplified mode)");
    }
  }

  /**
   * Check if we're in a build environment
   */
  private isBuildEnvironment(): boolean {
    // More comprehensive build environment detection
    return (
      // Next.js build phases
      process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.NEXT_PHASE === "phase-development-server" ||
      // Build flags
      process.env.NEXT_BUILD === "true" ||
      process.env.BUILD_ID !== undefined ||
      // Static generation
      process.env.STATIC_GENERATION === "true" ||
      process.env.__NEXT_ROUTER_BASEPATH !== undefined ||
      // Vercel build environment  
      (process.env.VERCEL === "1" && process.env.VERCEL_ENV === undefined) ||
      // General build indicators
      process.env.CI === "true" ||
      // Check if we're in webpack/module bundling context
      typeof window === "undefined" && typeof process !== "undefined" && 
      (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "development") &&
      !global.setImmediate // Node.js runtime check
    );
  }

  /**
   * Start optimization process
   */
  async startOptimization(request: OptimizationRequest): Promise<string> {
    const optimizationId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const optimization = {
      id: optimizationId,
      request,
      status: "running",
      startTime: new Date(),
      currentIteration: 0,
      maxIterations: request.strategy.maxIterations,
      bestScore: 0,
      parameters: {},
    };

    this.activeOptimizations.set(optimizationId, optimization);

    // Start simplified optimization process
    this.runSimplifiedOptimization(optimizationId);

    logger.info("Optimization started", { optimizationId, algorithm: request.strategy.algorithm });
    return optimizationId;
  }

  /**
   * Get optimization status
   */
  getOptimizationStatus(optimizationId: string): any {
    return this.activeOptimizations.get(optimizationId) || null;
  }

  /**
   * Stop optimization
   */
  async stopOptimization(optimizationId: string): Promise<void> {
    const optimization = this.activeOptimizations.get(optimizationId);
    if (optimization) {
      optimization.status = "stopped";
      optimization.endTime = new Date();
      this.activeOptimizations.delete(optimizationId);
      logger.info("Optimization stopped", { optimizationId });
    }
  }

  /**
   * Get performance baseline
   */
  getPerformanceBaseline(): PerformanceMetrics | null {
    return this.performanceBaseline;
  }

  /**
   * Set performance baseline
   */
  setPerformanceBaseline(metrics: PerformanceMetrics): void {
    this.performanceBaseline = metrics;
    logger.info("Performance baseline updated");
  }

  /**
   * Get optimization history
   */
  getOptimizationHistory(): any[] {
    return [...this.optimizationHistory];
  }

  /**
   * Simplified optimization implementation
   */
  private async runSimplifiedOptimization(optimizationId: string): Promise<void> {
    const optimization = this.activeOptimizations.get(optimizationId);
    if (!optimization) return;

    try {
      // Simple parameter search with random variations
      for (let i = 0; i < optimization.maxIterations; i++) {
        if (optimization.status !== "running") break;

        optimization.currentIteration = i + 1;

        // Generate random parameter variations
        const parameters = this.generateRandomParameters();

        // Simulate evaluation (in real implementation, this would test the parameters)
        const score = Math.random() * 0.8 + 0.1; // Random score between 0.1-0.9

        if (score > optimization.bestScore) {
          optimization.bestScore = score;
          optimization.parameters = parameters;
        }

        // Emit progress update
        this.emit("optimizationProgress", {
          optimizationId,
          iteration: i + 1,
          score,
          bestScore: optimization.bestScore,
        });

        // Check convergence
        if (score > optimization.request.strategy.convergenceThreshold) {
          break;
        }

        // Small delay to simulate processing
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Mark as completed
      optimization.status = "completed";
      optimization.endTime = new Date();

      // Add to history
      this.optimizationHistory.push({
        ...optimization,
        result: {
          optimizedParameters: optimization.parameters,
          performanceImprovement: optimization.bestScore,
          iterations: optimization.currentIteration,
        },
      });

      this.emit("optimizationCompleted", { optimizationId, result: optimization });
      logger.info("Optimization completed", { optimizationId, score: optimization.bestScore });
    } catch (error) {
      optimization.status = "failed";
      optimization.error = error;
      this.emit("optimizationFailed", { optimizationId, error });
      logger.error("Optimization failed", { optimizationId, error });
    }
  }

  /**
   * Generate random parameter variations
   */
  private generateRandomParameters(): Record<string, any> {
    return {
      pattern_confidence_threshold: 0.5 + Math.random() * 0.4, // 0.5-0.9
      risk_per_trade: 0.01 + Math.random() * 0.04, // 0.01-0.05
      take_profit_percentage: 0.05 + Math.random() * 0.15, // 0.05-0.20
      stop_loss_percentage: 0.02 + Math.random() * 0.08, // 0.02-0.10
      max_position_size: 0.05 + Math.random() * 0.15, // 0.05-0.20
      max_hold_time_hours: 12 + Math.random() * 36, // 12-48 hours
    };
  }
}

// ============================================================================
// Singleton Instance Management
// ============================================================================

let globalParameterOptimizationEngineInstance: ParameterOptimizationEngine | null = null;

/**
 * Get global parameter optimization engine instance with lazy initialization
 */
export function getParameterOptimizationEngine(): ParameterOptimizationEngine {
  if (!globalParameterOptimizationEngineInstance) {
    globalParameterOptimizationEngineInstance = new ParameterOptimizationEngine();
  }
  return globalParameterOptimizationEngineInstance;
}

/**
 * Reset global parameter optimization engine instance (for testing)
 */
export function resetParameterOptimizationEngine(): void {
  globalParameterOptimizationEngineInstance = null;
}
