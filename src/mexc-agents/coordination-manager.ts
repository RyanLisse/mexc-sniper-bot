import type { AgentManager } from "./agent-manager";
import {
  type AgentRegistry,
  type EnhancedMexcOrchestrator,
  type PerformanceCollector,
  type WorkflowEngine,
  checkCoordinationSystemHealth,
  createCoordinationSystem,
  registerCommonAgents,
} from "./coordination";
import type {
  AgentOrchestrationMetrics,
  CalendarDiscoveryWorkflowRequest,
  MexcWorkflowResult,
  PatternAnalysisWorkflowRequest,
  SymbolAnalysisWorkflowRequest,
  TradingStrategyWorkflowRequest,
} from "./orchestrator-types";

export interface CoordinationSystemConfig {
  healthCheckInterval?: number;
  performanceCollectionInterval?: number;
  maxHistorySize?: number;
}

export interface CoordinationSystemHealth {
  enabled: boolean;
  healthy?: boolean;
  message?: string;
  error?: string;
}

/**
 * Manages enhanced coordination system
 * Extracted from MexcOrchestrator to follow Single Responsibility Principle
 */
export class CoordinationSystemManager {
  private coordinationSystem: {
    agentRegistry: AgentRegistry;
    workflowEngine: WorkflowEngine;
    performanceCollector: PerformanceCollector;
    orchestrator: EnhancedMexcOrchestrator;
  } | null = null;

  private isEnabled = false;

  /**
   * Initializes the enhanced coordination system
   */
  async initialize(
    agentManager: AgentManager,
    config: CoordinationSystemConfig = {}
  ): Promise<void> {
    if (this.isEnabled) {
      throw new Error("Coordination system is already initialized");
    }

    try {
      console.log("[CoordinationSystemManager] Initializing enhanced coordination system...");

      const systemConfig = {
        healthCheckInterval: config.healthCheckInterval ?? 30000, // 30 seconds
        performanceCollectionInterval: config.performanceCollectionInterval ?? 60000, // 1 minute
        maxHistorySize: config.maxHistorySize ?? 1000,
      };

      // Create coordination system
      this.coordinationSystem = await createCoordinationSystem(systemConfig);

      // Register existing agents with the coordination system
      registerCommonAgents(this.coordinationSystem.agentRegistry, agentManager);

      this.isEnabled = true;

      console.log(
        "[CoordinationSystemManager] Enhanced coordination system initialized successfully"
      );
    } catch (error) {
      console.error("[CoordinationSystemManager] Failed to initialize coordination system:", error);
      throw error;
    }
  }

  /**
   * Executes calendar discovery workflow using enhanced coordination
   */
  async executeCalendarDiscoveryWorkflow(
    request: CalendarDiscoveryWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    this.ensureInitialized();
    return await this.coordinationSystem!.orchestrator.executeCalendarDiscoveryWorkflow(request);
  }

  /**
   * Executes symbol analysis workflow using enhanced coordination
   */
  async executeSymbolAnalysisWorkflow(
    request: SymbolAnalysisWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    this.ensureInitialized();
    return await this.coordinationSystem!.orchestrator.executeSymbolAnalysisWorkflow(request);
  }

  /**
   * Executes pattern analysis workflow using enhanced coordination
   */
  async executePatternAnalysisWorkflow(
    request: PatternAnalysisWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    this.ensureInitialized();
    return await this.coordinationSystem!.orchestrator.executePatternAnalysisWorkflow(request);
  }

  /**
   * Executes trading strategy workflow using enhanced coordination
   */
  async executeTradingStrategyWorkflow(
    request: TradingStrategyWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    this.ensureInitialized();
    return await this.coordinationSystem!.orchestrator.executeTradingStrategyWorkflow(request);
  }

  /**
   * Gets agent health using enhanced coordination
   */
  async getAgentHealth(): Promise<{
    mexcApi: boolean;
    patternDiscovery: boolean;
    calendar: boolean;
    symbolAnalysis: boolean;
    strategy: boolean;
  }> {
    this.ensureInitialized();
    return await this.coordinationSystem!.orchestrator.getAgentHealth();
  }

  /**
   * Gets orchestration metrics using enhanced coordination
   */
  getOrchestrationMetrics(): AgentOrchestrationMetrics {
    this.ensureInitialized();
    return this.coordinationSystem!.orchestrator.getOrchestrationMetrics();
  }

  /**
   * Gets agent summary using enhanced coordination
   */
  getAgentSummary(): {
    totalAgents: number;
    agentTypes: string[];
    initialized: boolean;
  } {
    this.ensureInitialized();
    return this.coordinationSystem!.orchestrator.getAgentSummary();
  }

  /**
   * Performs health check using enhanced coordination
   */
  async healthCheck(): Promise<boolean> {
    this.ensureInitialized();
    return await this.coordinationSystem!.orchestrator.healthCheck();
  }

  /**
   * Gets coordination system health status
   */
  async getHealth(): Promise<CoordinationSystemHealth> {
    if (!this.isEnabled || !this.coordinationSystem) {
      return { enabled: false, message: "Enhanced coordination not enabled" };
    }

    try {
      const health = await checkCoordinationSystemHealth(this.coordinationSystem);
      return {
        enabled: true,
        healthy: true,
        ...health,
      };
    } catch (error) {
      return {
        enabled: true,
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Disables and shuts down the coordination system
   */
  async shutdown(): Promise<void> {
    if (!this.isEnabled || !this.coordinationSystem) {
      console.warn("[CoordinationSystemManager] Enhanced coordination is not enabled");
      return;
    }

    try {
      await this.coordinationSystem.orchestrator.shutdown();
      this.coordinationSystem = null;
      this.isEnabled = false;

      console.log("[CoordinationSystemManager] Enhanced coordination disabled");
    } catch (error) {
      console.error("[CoordinationSystemManager] Error during shutdown:", error);
      throw error;
    }
  }

  /**
   * Checks if the coordination system is enabled
   */
  isCoordinationEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Ensures the coordination system is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.isEnabled || !this.coordinationSystem) {
      throw new Error("Coordination system is not initialized");
    }
  }
}
