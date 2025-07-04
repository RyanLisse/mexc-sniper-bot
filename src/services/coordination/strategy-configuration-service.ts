/**
 * Strategy Configuration Service
 *
 * MISSION: Bridge the gap between UI strategy settings and agent execution
 *
 * Responsibilities:
 * 1. Propagate strategy changes to Core Trading Service
 * 2. Update agent configurations based on strategy settings
 * 3. Coordinate workflow parameters with selected strategies
 * 4. Provide real-time strategy performance feedback
 */

import type { UserTradingPreferences } from "@/src/hooks/use-user-preferences";
import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events";
import { toSafeError } from "../../lib/error-type-utils";
import type { EnhancedMexcOrchestrator } from "../../mexc-agents/coordination/enhanced-orchestrator";
import { getCoreTrading } from "../trading/consolidated/core-trading/base-service";
import { UserPreferencesService } from "../user/user-preferences-service";

export interface StrategyContext {
  strategyId: string;
  riskTolerance: "low" | "medium" | "high";
  maxPositions: number;
  positionSizeUsdt: number;
  stopLossPercent: number;
  takeProfitLevels: number[];
  confidenceThreshold: number;
  enableAutoSnipe: boolean;
  marketConditions?: {
    volatility: "low" | "medium" | "high";
    volume: "low" | "medium" | "high";
    trend: "bearish" | "neutral" | "bullish";
  };
}

export interface AgentConfiguration {
  [agentType: string]: {
    strategy: string;
    riskTolerance: string;
    maxConcurrentTasks: number;
    confidenceThreshold: number;
    timeoutMs: number;
    retryAttempts: number;
    [key: string]: unknown;
  };
}

export interface StrategyPerformanceMetrics {
  strategyId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  averagePnlPercent: number;
  totalPnlUsdt: number;
  averageExecutionTimeMs: number;
  lastUpdated: Date;
  activePositions: number;
  dailyPnL: number;
}

/**
 * Strategy Configuration Service
 *
 * Coordinates strategy settings across all system components
 */
export class StrategyConfigurationService extends BrowserCompatibleEventEmitter {
  private static instance: StrategyConfigurationService;
  private coreTrading: Record<string, unknown>;
  private orchestrator: EnhancedMexcOrchestrator;
  private userPrefsService: UserPreferencesService;
  private currentStrategyContext: Map<string, StrategyContext> = new Map();
  private performanceMetrics: Map<string, StrategyPerformanceMetrics> =
    new Map();

  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[strategy-config-service]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[strategy-config-service]", message, context || ""),
    error: (message: string, context?: unknown, error?: Error) =>
      console.error(
        "[strategy-config-service]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: unknown) =>
      console.debug("[strategy-config-service]", message, context || ""),
  };

  static getInstance(): StrategyConfigurationService {
    if (!StrategyConfigurationService.instance) {
      StrategyConfigurationService.instance =
        new StrategyConfigurationService();
    }
    return StrategyConfigurationService.instance;
  }

  private constructor() {
    super();
    this.coreTrading = getCoreTrading() as any;
    // Initialize orchestrator with proper fallback
    try {
      // EnhancedMexcOrchestrator requires dependencies that aren't available here
      // Use mock orchestrator for now to avoid dependency issues
      this.logger.warn(
        "Using mock orchestrator due to dependency requirements"
      );
      this.orchestrator = this.createMockOrchestrator();
    } catch (error) {
      this.logger.warn(
        "Failed to initialize EnhancedMexcOrchestrator, using mock",
        { error }
      );
      this.orchestrator = this.createMockOrchestrator();
    }
    this.userPrefsService = new UserPreferencesService();
    this.setupEventListeners();
  }

  /**
   * Initialize the service and sync existing configurations
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info("Initializing Strategy Configuration Service...");

      // Ensure Core Trading Service is initialized
      await (this.coreTrading as any).initialize();

      this.logger.info("Strategy Configuration Service initialized");
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(
        "Failed to initialize Strategy Configuration Service",
        {
          error: safeError.message,
        },
        safeError
      );
      throw safeError;
    }
  }

  /**
   * Update strategy configuration for a user
   */
  async updateUserStrategy(
    userId: string,
    preferences: UserTradingPreferences
  ): Promise<void> {
    try {
      this.logger.info("Updating user strategy", {
        userId,
        strategy: preferences.selectedExitStrategy,
      });

      // 1. Convert preferences to strategy context
      const strategyContext = this.convertPreferencesToContext(preferences);
      this.currentStrategyContext.set(userId, strategyContext);

      // 2. Update Core Trading Service configuration
      await this.syncCoreTrading(userId, strategyContext);

      // 3. Update agent configurations
      await this.syncAgentConfigurations(strategyContext);

      // 4. Update workflow parameters
      await this.syncWorkflowParameters(strategyContext);

      // 5. Persist user preferences
      await this.userPrefsService.updateUserPreferences(userId, preferences);

      // 6. Emit strategy change event
      this.emit("strategy-updated", {
        userId,
        strategyContext,
        timestamp: new Date(),
      });

      this.logger.info("Strategy configuration updated successfully", {
        userId,
      });
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(
        "Failed to update user strategy",
        {
          userId,
          error: safeError.message,
        },
        safeError
      );
      throw safeError;
    }
  }

  /**
   * Get current strategy context for a user
   */
  getStrategyContext(userId: string): StrategyContext | null {
    return this.currentStrategyContext.get(userId) || null;
  }

  /**
   * Get strategy performance metrics
   */
  getStrategyPerformance(
    strategyId: string
  ): StrategyPerformanceMetrics | null {
    return this.performanceMetrics.get(strategyId) || null;
  }

  /**
   * Record strategy execution result
   */
  async recordStrategyExecution(execution: {
    userId: string;
    strategyId: string;
    symbol: string;
    entryPrice: number;
    currentPrice?: number;
    pnlPercent: number;
    pnlUsdt: number;
    success: boolean;
    executionTimeMs: number;
  }): Promise<void> {
    try {
      const { strategyId, success, pnlPercent, pnlUsdt, executionTimeMs } =
        execution;

      // Get or create performance metrics
      const metrics = this.performanceMetrics.get(strategyId) || {
        strategyId,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        successRate: 0,
        averagePnlPercent: 0,
        totalPnlUsdt: 0,
        averageExecutionTimeMs: 0,
        lastUpdated: new Date(),
        activePositions: 0,
        dailyPnL: 0,
      };

      // Update metrics
      metrics.totalExecutions++;
      if (success) {
        metrics.successfulExecutions++;
      } else {
        metrics.failedExecutions++;
      }

      metrics.successRate =
        (metrics.successfulExecutions / metrics.totalExecutions) * 100;
      metrics.totalPnlUsdt += pnlUsdt;
      metrics.averagePnlPercent =
        (metrics.averagePnlPercent * (metrics.totalExecutions - 1) +
          pnlPercent) /
        metrics.totalExecutions;
      metrics.averageExecutionTimeMs =
        (metrics.averageExecutionTimeMs * (metrics.totalExecutions - 1) +
          executionTimeMs) /
        metrics.totalExecutions;
      metrics.lastUpdated = new Date();

      this.performanceMetrics.set(strategyId, metrics);

      // Emit performance update event
      this.emit("performance-updated", {
        strategyId,
        metrics,
        execution,
      });

      this.logger.debug("Strategy execution recorded", {
        strategyId,
        success,
        pnlPercent,
      });
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(
        "Failed to record strategy execution",
        {
          strategyId: execution.strategyId,
          error: safeError.message,
        },
        safeError
      );
    }
  }

  /**
   * Get real-time strategy metrics for UI
   */
  async getRealTimeStrategyMetrics(userId: string): Promise<{
    currentStrategy: string;
    activePositions: number;
    dailyPnL: number;
    successRate: number;
    performanceMetrics: StrategyPerformanceMetrics[];
  }> {
    try {
      const strategyContext = this.getStrategyContext(userId);
      const coreStatus = await (this.coreTrading as any).getStatus();
      const performanceData = await (
        this.coreTrading as any
      ).getPerformanceMetrics();

      return {
        currentStrategy: strategyContext?.strategyId || "unknown",
        activePositions: coreStatus.activePositions || 0,
        dailyPnL: performanceData.dailyPnL || 0,
        successRate: performanceData.successRate || 0,
        performanceMetrics: Array.from(this.performanceMetrics.values()),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(
        "Failed to get real-time metrics",
        {
          userId,
          error: safeError.message,
        },
        safeError
      );
      throw safeError;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private setupEventListeners(): void {
    // Listen for Core Trading Service events
    if (this.coreTrading && typeof this.coreTrading.on === "function") {
      this.coreTrading.on("execution-completed", (execution: any) => {
        this.recordStrategyExecution(execution);
      });
    }

    // Listen for agent performance updates
    // Note: EnhancedMexcOrchestrator doesn't extend EventEmitter, so we skip this for now
    // this.orchestrator.on?.("agent-performance-updated", (performance: any) => {
    //   this.handleAgentPerformanceUpdate(performance);
    // });
  }

  private convertPreferencesToContext(
    preferences: UserTradingPreferences
  ): StrategyContext {
    // Map UI preferences to strategy context
    const strategyMap = {
      conservative: {
        confidenceThreshold: 85,
        takeProfitLevels: [10, 20, 30],
        maxPositions: Math.min(preferences.maxConcurrentSnipes || 3, 3),
      },
      normal: {
        confidenceThreshold: 75,
        takeProfitLevels: [25, 50, 75, 100],
        maxPositions: Math.min(preferences.maxConcurrentSnipes || 5, 5),
      },
      aggressive: {
        confidenceThreshold: 65,
        takeProfitLevels: [50, 100, 150, 200],
        maxPositions: Math.min(preferences.maxConcurrentSnipes || 8, 8),
      },
      scalping: {
        confidenceThreshold: 70,
        takeProfitLevels: [5, 10, 15, 20],
        maxPositions: Math.min(preferences.maxConcurrentSnipes || 10, 10),
      },
      diamond: {
        confidenceThreshold: 90,
        takeProfitLevels: [200, 500, 1000, 2000],
        maxPositions: Math.min(preferences.maxConcurrentSnipes || 2, 2),
      },
    };

    const strategy =
      strategyMap[
        preferences.selectedExitStrategy as keyof typeof strategyMap
      ] || strategyMap.normal;

    return {
      strategyId: preferences.selectedExitStrategy || "normal",
      riskTolerance: preferences.riskTolerance || "medium",
      maxPositions: strategy.maxPositions,
      positionSizeUsdt: preferences.defaultBuyAmountUsdt || 100,
      stopLossPercent: preferences.stopLossPercent || 10,
      takeProfitLevels: strategy.takeProfitLevels,
      confidenceThreshold: strategy.confidenceThreshold,
      enableAutoSnipe: preferences.autoSnipeEnabled || false,
    };
  }

  private async syncCoreTrading(
    userId: string,
    context: StrategyContext
  ): Promise<void> {
    try {
      await (this.coreTrading as any).updateConfig({
        userId,
        tradingStrategy: context.strategyId,
        maxPositions: context.maxPositions,
        defaultPositionSizeUsdt: context.positionSizeUsdt,
        stopLossPercent: context.stopLossPercent,
        autoSnipingEnabled: context.enableAutoSnipe,
        confidenceThreshold: context.confidenceThreshold,
      });

      this.logger.debug("Core Trading Service synced", {
        userId,
        strategy: context.strategyId,
      });
    } catch (error) {
      throw new Error(
        `Failed to sync Core Trading Service: ${toSafeError(error).message}`
      );
    }
  }

  private async syncAgentConfigurations(
    context: StrategyContext
  ): Promise<void> {
    try {
      const agentConfigs: AgentConfiguration = {
        "strategy-agent": {
          strategy: context.strategyId,
          riskTolerance: context.riskTolerance,
          maxConcurrentTasks: Math.ceil(context.maxPositions / 2),
          confidenceThreshold: context.confidenceThreshold,
          timeoutMs: 30000,
          retryAttempts: 3,
          takeProfitLevels: context.takeProfitLevels,
        },
        "risk-manager-agent": {
          strategy: context.strategyId,
          riskTolerance: context.riskTolerance,
          maxConcurrentTasks: context.maxPositions,
          confidenceThreshold: context.confidenceThreshold + 5, // Risk manager needs higher confidence
          timeoutMs: 20000,
          retryAttempts: 2,
          maxPositionSize: context.positionSizeUsdt,
          stopLossPercent: context.stopLossPercent,
        },
        "pattern-discovery-agent": {
          strategy: context.strategyId,
          riskTolerance: context.riskTolerance,
          maxConcurrentTasks: context.maxPositions * 2, // Pattern discovery can handle more
          confidenceThreshold: context.confidenceThreshold,
          timeoutMs: 45000,
          retryAttempts: 3,
          strategyContext: context.strategyId,
        },
        "mexc-api-agent": {
          strategy: context.strategyId,
          riskTolerance: context.riskTolerance,
          maxConcurrentTasks: context.maxPositions,
          confidenceThreshold: context.confidenceThreshold,
          timeoutMs: 15000,
          retryAttempts: 5, // API calls need more retries
          defaultPositionSize: context.positionSizeUsdt,
          enableAutoExecution: context.enableAutoSnipe,
        },
      };

      // Update agent configurations with improved implementation
      try {
        if (typeof this.orchestrator.updateAgentConfigurations === "function") {
          await this.orchestrator.updateAgentConfigurations(agentConfigs);
        } else {
          // Fallback implementation for agent configuration
          this.updateAgentConfigurationsFallback(agentConfigs);
        }
      } catch (error) {
        this.logger.warn("Failed to update agent configurations", { error });
        this.updateAgentConfigurationsFallback(agentConfigs);
      }
      this.logger.debug("Agent configurations synced", {
        strategy: context.strategyId,
      });
    } catch (error) {
      throw new Error(
        `Failed to sync agent configurations: ${toSafeError(error).message}`
      );
    }
  }

  private async syncWorkflowParameters(
    context: StrategyContext
  ): Promise<void> {
    try {
      const workflowParams = {
        strategy: context.strategyId,
        confidenceThreshold: context.confidenceThreshold,
        maxConcurrentSymbols: context.maxPositions,
        riskTolerance: context.riskTolerance,
        enableParallelExecution: context.riskTolerance === "high",
        timeoutMs: context.riskTolerance === "low" ? 60000 : 30000,
      };

      // Update workflow parameters with improved implementation
      try {
        if (typeof this.orchestrator.updateWorkflowParameters === "function") {
          await this.orchestrator.updateWorkflowParameters(workflowParams);
        } else {
          // Fallback implementation for workflow parameters
          this.updateWorkflowParametersFallback(workflowParams);
        }
      } catch (error) {
        this.logger.warn("Failed to update workflow parameters", { error });
        this.updateWorkflowParametersFallback(workflowParams);
      }
      this.logger.debug("Workflow parameters synced", {
        strategy: context.strategyId,
      });
    } catch (error) {
      throw new Error(
        `Failed to sync workflow parameters: ${toSafeError(error).message}`
      );
    }
  }

  private handleAgentPerformanceUpdate(performance: any): void {
    // Update agent routing based on performance
    this.emit("agent-performance-updated", performance);
  }

  private createMockOrchestrator(): EnhancedMexcOrchestrator {
    return {
      updateAgentConfigurations: async (configs: AgentConfiguration) => {
        this.logger.debug("Mock updateAgentConfigurations called", { configs });
      },
      updateWorkflowParameters: async (params: any) => {
        this.logger.debug("Mock updateWorkflowParameters called", { params });
      },
      on: () => {}, // Mock event listener
    } as any;
  }

  private updateAgentConfigurationsFallback(
    agentConfigs: AgentConfiguration
  ): void {
    // Store configurations for future reference
    this.logger.info("Using fallback agent configuration storage", {
      agentTypes: Object.keys(agentConfigs),
      timestamp: new Date().toISOString(),
    });

    // Store in global state or environment for agents to pick up
    if (typeof globalThis !== "undefined") {
      (globalThis as any).agentConfigurations = {
        ...(globalThis as any).agentConfigurations,
        ...agentConfigs,
        lastUpdated: new Date().toISOString(),
      };
    }

    // Emit event for any listening agents
    this.emit("agent-configurations-updated", {
      configurations: agentConfigs,
      timestamp: new Date().toISOString(),
    });
  }

  private updateWorkflowParametersFallback(workflowParams: any): void {
    // Store workflow parameters for future reference
    this.logger.info("Using fallback workflow parameters storage", {
      strategy: workflowParams.strategy,
      confidenceThreshold: workflowParams.confidenceThreshold,
      maxConcurrentSymbols: workflowParams.maxConcurrentSymbols,
      timestamp: new Date().toISOString(),
    });

    // Store in global state for workflow engines to pick up
    if (typeof globalThis !== "undefined") {
      (globalThis as any).workflowParameters = {
        ...(globalThis as any).workflowParameters,
        ...workflowParams,
        lastUpdated: new Date().toISOString(),
      };
    }

    // Emit event for any listening workflow engines
    this.emit("workflow-parameters-updated", {
      parameters: workflowParams,
      timestamp: new Date().toISOString(),
    });
  }
}
