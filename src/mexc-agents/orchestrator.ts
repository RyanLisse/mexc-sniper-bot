// Re-export types for backward compatibility
export type {
  CalendarDiscoveryWorkflowRequest,
  SymbolAnalysisWorkflowRequest,
  PatternAnalysisWorkflowRequest,
  TradingStrategyWorkflowRequest,
  MexcWorkflowResult,
  AgentOrchestrationMetrics,
} from "./orchestrator-types";

import { AgentManager } from "./agent-manager";
import {
  type AgentRegistry,
  type EnhancedMexcOrchestrator,
  type PerformanceCollector,
  type WorkflowEngine,
  checkCoordinationSystemHealth,
  createCoordinationSystem,
  registerCommonAgents,
} from "./coordination";
import { DataFetcher } from "./data-fetcher";
import type {
  AgentOrchestrationMetrics,
  CalendarDiscoveryWorkflowRequest,
  MexcWorkflowResult,
  PatternAnalysisWorkflowRequest,
  SymbolAnalysisWorkflowRequest,
  TradingStrategyWorkflowRequest,
} from "./orchestrator-types";
import { WorkflowExecutor } from "./workflow-executor";

export class MexcOrchestrator {
  private agentManager: AgentManager;
  private dataFetcher: DataFetcher;
  private workflowExecutor: WorkflowExecutor;
  private metrics: AgentOrchestrationMetrics;

  // Enhanced coordination system (optional, for improved features)
  private coordinationSystem: {
    agentRegistry: AgentRegistry;
    workflowEngine: WorkflowEngine;
    performanceCollector: PerformanceCollector;
    orchestrator: EnhancedMexcOrchestrator;
  } | null = null;
  private useEnhancedCoordination = false;

  constructor(options?: { useEnhancedCoordination?: boolean }) {
    // Initialize core components (for backward compatibility)
    this.agentManager = new AgentManager();
    this.dataFetcher = new DataFetcher(this.agentManager.getMexcApiAgent());
    this.workflowExecutor = new WorkflowExecutor(this.agentManager, this.dataFetcher);

    // Initialize metrics
    this.metrics = {
      totalExecutions: 0,
      successRate: 0,
      averageDuration: 0,
      errorRate: 0,
      lastExecution: new Date().toISOString(),
    };

    // Optionally enable enhanced coordination
    this.useEnhancedCoordination = options?.useEnhancedCoordination || false;

    if (this.useEnhancedCoordination) {
      this.initializeCoordinationSystem().catch((error) => {
        console.warn(
          "[MexcOrchestrator] Failed to initialize coordination system, falling back to legacy mode:",
          error
        );
        this.useEnhancedCoordination = false;
      });
    }
  }

  /**
   * Initialize the enhanced coordination system
   */
  private async initializeCoordinationSystem(): Promise<void> {
    try {
      console.log("[MexcOrchestrator] Initializing enhanced coordination system...");

      // Create coordination system
      this.coordinationSystem = await createCoordinationSystem({
        healthCheckInterval: 30000, // 30 seconds
        performanceCollectionInterval: 60000, // 1 minute
        maxHistorySize: 1000,
      });

      // Register existing agents with the coordination system
      registerCommonAgents(this.coordinationSystem.agentRegistry, this.agentManager);

      console.log("[MexcOrchestrator] Enhanced coordination system initialized successfully");
    } catch (error) {
      console.error("[MexcOrchestrator] Failed to initialize coordination system:", error);
      throw error;
    }
  }

  async executeCalendarDiscoveryWorkflow(
    request: CalendarDiscoveryWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    // Use enhanced coordination system if available
    if (this.useEnhancedCoordination && this.coordinationSystem) {
      try {
        return await this.coordinationSystem.orchestrator.executeCalendarDiscoveryWorkflow(request);
      } catch (error) {
        console.warn(
          "[MexcOrchestrator] Enhanced coordination failed, falling back to legacy mode:",
          error
        );
        // Fall through to legacy execution
      }
    }

    // Legacy execution path
    const startTime = Date.now();
    this.metrics.totalExecutions++;

    try {
      const result = await this.workflowExecutor.executeCalendarDiscoveryWorkflow(request);
      this.updateMetrics(result, startTime);
      return result;
    } catch (error) {
      console.error("[MexcOrchestrator] Calendar discovery workflow failed:", error);
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          agentsUsed: ["mexc-api", "calendar", "pattern-discovery"],
        },
      };
      this.updateMetrics(errorResult, startTime);
      return errorResult;
    }
  }

  async executeSymbolAnalysisWorkflow(
    request: SymbolAnalysisWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    // Use enhanced coordination system if available
    if (this.useEnhancedCoordination && this.coordinationSystem) {
      try {
        return await this.coordinationSystem.orchestrator.executeSymbolAnalysisWorkflow(request);
      } catch (error) {
        console.warn(
          "[MexcOrchestrator] Enhanced coordination failed, falling back to legacy mode:",
          error
        );
        // Fall through to legacy execution
      }
    }

    // Legacy execution path
    const startTime = Date.now();
    this.metrics.totalExecutions++;

    try {
      const result = await this.workflowExecutor.executeSymbolAnalysisWorkflow(request);
      this.updateMetrics(result, startTime);
      return result;
    } catch (error) {
      console.error(
        `[MexcOrchestrator] Symbol analysis workflow failed for ${request.vcoinId}:`,
        error
      );
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          agentsUsed: ["symbol-analysis", "pattern-discovery", "mexc-api"],
        },
      };
      this.updateMetrics(errorResult, startTime);
      return errorResult;
    }
  }

  async executePatternAnalysisWorkflow(
    request: PatternAnalysisWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    // Use enhanced coordination system if available
    if (this.useEnhancedCoordination && this.coordinationSystem) {
      try {
        return await this.coordinationSystem.orchestrator.executePatternAnalysisWorkflow(request);
      } catch (error) {
        console.warn(
          "[MexcOrchestrator] Enhanced coordination failed, falling back to legacy mode:",
          error
        );
        // Fall through to legacy execution
      }
    }

    // Legacy execution path
    const startTime = Date.now();
    this.metrics.totalExecutions++;

    try {
      const result = await this.workflowExecutor.executePatternAnalysisWorkflow(request);
      this.updateMetrics(result, startTime);
      return result;
    } catch (error) {
      console.error(`[MexcOrchestrator] Pattern analysis workflow failed:`, error);
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          agentsUsed: ["pattern-discovery"],
        },
      };
      this.updateMetrics(errorResult, startTime);
      return errorResult;
    }
  }

  async executeTradingStrategyWorkflow(
    request: TradingStrategyWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    // Use enhanced coordination system if available
    if (this.useEnhancedCoordination && this.coordinationSystem) {
      try {
        return await this.coordinationSystem.orchestrator.executeTradingStrategyWorkflow(request);
      } catch (error) {
        console.warn(
          "[MexcOrchestrator] Enhanced coordination failed, falling back to legacy mode:",
          error
        );
        // Fall through to legacy execution
      }
    }

    // Legacy execution path
    const startTime = Date.now();
    this.metrics.totalExecutions++;

    try {
      const result = await this.workflowExecutor.executeTradingStrategyWorkflow(request);
      this.updateMetrics(result, startTime);
      return result;
    } catch (error) {
      console.error(
        `[MexcOrchestrator] Trading strategy workflow failed for ${request.vcoinId}:`,
        error
      );
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          agentsUsed: ["strategy"],
        },
      };
      this.updateMetrics(errorResult, startTime);
      return errorResult;
    }
  }

  // Public utility methods
  async getAgentHealth(): Promise<{
    mexcApi: boolean;
    patternDiscovery: boolean;
    calendar: boolean;
    symbolAnalysis: boolean;
    strategy: boolean;
  }> {
    // Use enhanced coordination system if available
    if (this.useEnhancedCoordination && this.coordinationSystem) {
      try {
        const enhancedHealth = await this.coordinationSystem.orchestrator.getAgentHealth();
        return {
          mexcApi: enhancedHealth.mexcApi,
          patternDiscovery: enhancedHealth.patternDiscovery,
          calendar: enhancedHealth.calendar,
          symbolAnalysis: enhancedHealth.symbolAnalysis,
          strategy: enhancedHealth.strategy,
        };
      } catch (error) {
        console.warn(
          "[MexcOrchestrator] Enhanced health check failed, falling back to legacy mode:",
          error
        );
      }
    }

    // Legacy health check
    return await this.agentManager.checkAgentHealth();
  }

  getOrchestrationMetrics(): AgentOrchestrationMetrics {
    // Use enhanced coordination system if available
    if (this.useEnhancedCoordination && this.coordinationSystem) {
      try {
        const enhancedMetrics = this.coordinationSystem.orchestrator.getOrchestrationMetrics();
        // Return base metrics for backward compatibility
        return {
          totalExecutions: enhancedMetrics.totalExecutions,
          successRate: enhancedMetrics.successRate,
          averageDuration: enhancedMetrics.averageDuration,
          errorRate: enhancedMetrics.errorRate,
          lastExecution: enhancedMetrics.lastExecution,
        };
      } catch (error) {
        console.warn(
          "[MexcOrchestrator] Enhanced metrics failed, falling back to legacy mode:",
          error
        );
      }
    }

    return { ...this.metrics };
  }

  getAgentSummary(): {
    totalAgents: number;
    agentTypes: string[];
    initialized: boolean;
  } {
    // Use enhanced coordination system if available
    if (this.useEnhancedCoordination && this.coordinationSystem) {
      try {
        const enhancedSummary = this.coordinationSystem.orchestrator.getAgentSummary();
        return {
          totalAgents: enhancedSummary.totalAgents,
          agentTypes: enhancedSummary.agentTypes,
          initialized: enhancedSummary.initialized,
        };
      } catch (error) {
        console.warn(
          "[MexcOrchestrator] Enhanced summary failed, falling back to legacy mode:",
          error
        );
      }
    }

    return this.agentManager.getAgentSummary();
  }

  async healthCheck(): Promise<boolean> {
    // Use enhanced coordination system if available
    if (this.useEnhancedCoordination && this.coordinationSystem) {
      try {
        return await this.coordinationSystem.orchestrator.healthCheck();
      } catch (error) {
        console.warn(
          "[MexcOrchestrator] Enhanced health check failed, falling back to legacy mode:",
          error
        );
      }
    }

    // Legacy health check
    try {
      const agentHealth = await this.agentManager.checkAgentHealth();
      const dataFetcherHealth = await this.dataFetcher.healthCheck();

      return Object.values(agentHealth).some((healthy) => healthy) && dataFetcherHealth;
    } catch (error) {
      console.error("[MexcOrchestrator] Health check failed:", error);
      return false;
    }
  }

  /**
   * Enable enhanced coordination system
   */
  async enableEnhancedCoordination(): Promise<void> {
    if (this.useEnhancedCoordination) {
      console.warn("[MexcOrchestrator] Enhanced coordination is already enabled");
      return;
    }

    this.useEnhancedCoordination = true;
    await this.initializeCoordinationSystem();
  }

  /**
   * Disable enhanced coordination system
   */
  async disableEnhancedCoordination(): Promise<void> {
    if (!this.useEnhancedCoordination || !this.coordinationSystem) {
      console.warn("[MexcOrchestrator] Enhanced coordination is not enabled");
      return;
    }

    this.useEnhancedCoordination = false;
    await this.coordinationSystem.orchestrator.shutdown();
    this.coordinationSystem = null;

    console.log("[MexcOrchestrator] Enhanced coordination disabled, using legacy mode");
  }

  /**
   * Get coordination system health (if enabled)
   */
  async getCoordinationHealth(): Promise<any> {
    if (!this.useEnhancedCoordination || !this.coordinationSystem) {
      return { enabled: false, message: "Enhanced coordination not enabled" };
    }

    try {
      return await checkCoordinationSystemHealth(this.coordinationSystem);
    } catch (error) {
      return {
        enabled: true,
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Private utility methods
  private updateMetrics(result: MexcWorkflowResult, startTime: number): void {
    const duration = Date.now() - startTime;

    // Update success/error rates
    if (result.success) {
      const successCount = Math.round(
        this.metrics.successRate * (this.metrics.totalExecutions - 1)
      );
      this.metrics.successRate = (successCount + 1) / this.metrics.totalExecutions;
    } else {
      const errorCount = Math.round(this.metrics.errorRate * (this.metrics.totalExecutions - 1));
      this.metrics.errorRate = (errorCount + 1) / this.metrics.totalExecutions;
    }

    // Update average duration
    const totalDuration = this.metrics.averageDuration * (this.metrics.totalExecutions - 1);
    this.metrics.averageDuration = (totalDuration + duration) / this.metrics.totalExecutions;

    // Update last execution timestamp
    this.metrics.lastExecution = new Date().toISOString();
  }
}
