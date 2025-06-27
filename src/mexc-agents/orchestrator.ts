// Re-export types for backward compatibility
export type {
  AgentOrchestrationMetrics,
  CalendarDiscoveryWorkflowRequest,
  MexcWorkflowResult,
  PatternAnalysisWorkflowRequest,
  SymbolAnalysisWorkflowRequest,
  TradingStrategyWorkflowRequest,
} from "./orchestrator-types";

// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import { AgentManager } from "./agent-manager";
import { type CoordinationSystemConfig, CoordinationSystemManager } from "./coordination-manager";
import { DataFetcher } from "./data-fetcher";
import { OrchestrationMetricsManager } from "./metrics-manager";
import type {
  AgentOrchestrationMetrics,
  CalendarDiscoveryWorkflowRequest,
  MexcWorkflowResult,
  PatternAnalysisWorkflowRequest,
  SymbolAnalysisWorkflowRequest,
  TradingStrategyWorkflowRequest,
} from "./orchestrator-types";
import { WorkflowExecutionService } from "./workflow-execution-service";

export interface MexcOrchestratorOptions {
  useEnhancedCoordination?: boolean;
  coordinationConfig?: CoordinationSystemConfig;
}

/**
 * Main orchestrator for MEXC trading workflows
 * Refactored to follow Single Responsibility Principle and reduce complexity
 */
export class MexcOrchestrator {
  // Simple console logger to avoid webpack bundling issues
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[orchestrator]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[orchestrator]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[orchestrator]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[orchestrator]", message, context || ""),
  };

  private agentManager: AgentManager;
  private dataFetcher: DataFetcher;
  private coordinationManager: CoordinationSystemManager;
  private metricsManager: OrchestrationMetricsManager;
  private workflowExecutionService: WorkflowExecutionService;
  private enhancedCoordinationEnabled = false;
  private coordinationInitializationPromise: Promise<void> | null = null;

  constructor(options: MexcOrchestratorOptions = {}) {
    // Initialize core components
    this.agentManager = new AgentManager();
    this.dataFetcher = new DataFetcher(this.agentManager.getMexcApiAgent());
    this.coordinationManager = new CoordinationSystemManager();
    this.metricsManager = new OrchestrationMetricsManager();

    // Initialize workflow execution service with all dependencies
    this.workflowExecutionService = new WorkflowExecutionService(
      this.agentManager,
      this.dataFetcher,
      this.coordinationManager,
      this.metricsManager
    );

    // Optionally enable enhanced coordination with improved error handling
    if (options.useEnhancedCoordination) {
      this.coordinationInitializationPromise = this.initializeEnhancedCoordination(
        options.coordinationConfig
      )
        .then(() => {
          this.enhancedCoordinationEnabled = true;
          this.logger.info(
            "[MexcOrchestrator] Enhanced coordination system successfully activated"
          );
        })
        .catch((error) => {
          this.enhancedCoordinationEnabled = false;
          this.logger.warn(
            "[MexcOrchestrator] Failed to initialize coordination system, using legacy mode:",
            error
          );
        });
    }
  }

  /**
   * Initialize the enhanced coordination system
   */
  private async initializeEnhancedCoordination(config?: CoordinationSystemConfig): Promise<void> {
    await this.coordinationManager.initialize(this.agentManager, config);
  }

  /**
   * Executes calendar discovery workflow
   */
  async executeCalendarDiscoveryWorkflow(
    request: CalendarDiscoveryWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    return await this.workflowExecutionService.executeCalendarDiscoveryWorkflow(request);
  }

  /**
   * Executes symbol analysis workflow
   */
  async executeSymbolAnalysisWorkflow(
    request: SymbolAnalysisWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    return await this.workflowExecutionService.executeSymbolAnalysisWorkflow(request);
  }

  /**
   * Executes pattern analysis workflow
   */
  async executePatternAnalysisWorkflow(
    request: PatternAnalysisWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    return await this.workflowExecutionService.executePatternAnalysisWorkflow(request);
  }

  /**
   * Executes trading strategy workflow
   */
  async executeTradingStrategyWorkflow(
    request: TradingStrategyWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    return await this.workflowExecutionService.executeTradingStrategyWorkflow(request);
  }

  /**
   * Gets agent health status with enhanced/legacy fallback
   */
  async getAgentHealth(): Promise<{
    mexcApi: boolean;
    patternDiscovery: boolean;
    calendar: boolean;
    symbolAnalysis: boolean;
    strategy: boolean;
  }> {
    // Use enhanced coordination system if available
    if (this.coordinationManager.isCoordinationEnabled()) {
      try {
        return await this.coordinationManager.getAgentHealth();
      } catch (error) {
        this.logger.warn(
          "[MexcOrchestrator] Enhanced health check failed, falling back to legacy mode:",
          error
        );
      }
    }

    // Legacy health check
    return await this.agentManager.checkAgentHealth();
  }

  /**
   * Gets orchestration metrics
   */
  getOrchestrationMetrics(): AgentOrchestrationMetrics {
    // Use enhanced coordination system if available
    if (this.coordinationManager.isCoordinationEnabled()) {
      try {
        return this.coordinationManager.getOrchestrationMetrics();
      } catch (error) {
        this.logger.warn(
          "[MexcOrchestrator] Enhanced metrics failed, falling back to legacy mode:",
          error
        );
      }
    }

    return this.metricsManager.getMetrics();
  }

  /**
   * Gets agent summary
   */
  getAgentSummary(): {
    totalAgents: number;
    agentTypes: string[];
    initialized: boolean;
  } {
    // Use enhanced coordination system if available
    if (this.coordinationManager.isCoordinationEnabled()) {
      try {
        return this.coordinationManager.getAgentSummary();
      } catch (error) {
        this.logger.warn(
          "[MexcOrchestrator] Enhanced summary failed, falling back to legacy mode:",
          error
        );
      }
    }

    return this.agentManager.getAgentSummary();
  }

  /**
   * Performs overall health check
   */
  async healthCheck(): Promise<boolean> {
    // Use enhanced coordination system if available
    if (this.coordinationManager.isCoordinationEnabled()) {
      try {
        return await this.coordinationManager.healthCheck();
      } catch (error) {
        this.logger.warn(
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
      this.logger.error("[MexcOrchestrator] Health check failed:", error);
      return false;
    }
  }

  /**
   * Wait for enhanced coordination initialization to complete
   */
  async waitForCoordinationInitialization(): Promise<boolean> {
    if (this.coordinationInitializationPromise) {
      try {
        await this.coordinationInitializationPromise;
        return this.enhancedCoordinationEnabled;
      } catch (error) {
        this.logger.error("[MexcOrchestrator] Coordination initialization failed:", error);
        return false;
      }
    }
    return this.enhancedCoordinationEnabled;
  }

  /**
   * Check if enhanced coordination is available and fully initialized
   */
  isEnhancedCoordinationReady(): boolean {
    return this.enhancedCoordinationEnabled && this.coordinationManager.isCoordinationEnabled();
  }

  /**
   * Enable enhanced coordination system
   */
  async enableEnhancedCoordination(config?: CoordinationSystemConfig): Promise<void> {
    if (this.coordinationManager.isCoordinationEnabled()) {
      this.logger.warn("[MexcOrchestrator] Enhanced coordination is already enabled");
      return;
    }

    try {
      await this.coordinationManager.initialize(this.agentManager, config);
      this.enhancedCoordinationEnabled = true;
      this.logger.info("[MexcOrchestrator] Enhanced coordination system successfully enabled");
    } catch (error) {
      this.enhancedCoordinationEnabled = false;
      this.logger.error("[MexcOrchestrator] Failed to enable enhanced coordination:", error);
      throw error;
    }
  }

  /**
   * Disable enhanced coordination system
   */
  async disableEnhancedCoordination(): Promise<void> {
    try {
      await this.coordinationManager.shutdown();
      this.enhancedCoordinationEnabled = false;
      this.logger.info("[MexcOrchestrator] Enhanced coordination system disabled");
    } catch (error) {
      this.logger.error("[MexcOrchestrator] Failed to disable enhanced coordination:", error);
      throw error;
    }
  }

  /**
   * Get coordination system health status
   */
  async getCoordinationHealth() {
    return await this.coordinationManager.getHealth();
  }

  /**
   * Gets performance summary for monitoring
   */
  getPerformanceSummary() {
    return this.metricsManager.getPerformanceSummary();
  }

  /**
   * Resets metrics to initial state
   */
  resetMetrics(): void {
    this.metricsManager.reset();
  }
}
