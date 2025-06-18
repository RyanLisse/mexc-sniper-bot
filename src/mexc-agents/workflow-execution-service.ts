import type { AgentManager } from "./agent-manager";
import type { CoordinationSystemManager } from "./coordination-manager";
import type { DataFetcher } from "./data-fetcher";
import type { OrchestrationMetricsManager } from "./metrics-manager";
import type {
  CalendarDiscoveryWorkflowRequest,
  MexcWorkflowResult,
  PatternAnalysisWorkflowRequest,
  SymbolAnalysisWorkflowRequest,
  TradingStrategyWorkflowRequest,
} from "./orchestrator-types";
import { WorkflowExecutor } from "./workflow-executor";

/**
 * Service for executing workflows with fallback between enhanced and legacy modes
 * Extracted from MexcOrchestrator to follow Single Responsibility Principle
 */
export class WorkflowExecutionService {
  private workflowExecutor: WorkflowExecutor;

  constructor(
    private agentManager: AgentManager,
    private dataFetcher: DataFetcher,
    private coordinationManager: CoordinationSystemManager,
    private metricsManager: OrchestrationMetricsManager
  ) {
    this.workflowExecutor = new WorkflowExecutor(this.agentManager, this.dataFetcher);
  }

  /**
   * Executes calendar discovery workflow with enhanced/legacy fallback
   */
  async executeCalendarDiscoveryWorkflow(
    request: CalendarDiscoveryWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    const startTime = Date.now();

    // Try enhanced coordination first if enabled
    if (this.coordinationManager.isCoordinationEnabled()) {
      try {
        const result = await this.coordinationManager.executeCalendarDiscoveryWorkflow(request);
        this.metricsManager.recordExecution(result, startTime);
        return result;
      } catch (error) {
        console.warn(
          "[WorkflowExecutionService] Enhanced coordination failed, falling back to legacy mode:",
          error
        );
        // Fall through to legacy execution
      }
    }

    // Legacy execution path
    try {
      const result = await this.workflowExecutor.executeCalendarDiscoveryWorkflow(request);
      this.metricsManager.recordExecution(result, startTime);
      return result;
    } catch (error) {
      const errorResult = this.createErrorResult(
        error,
        ["mexc-api", "calendar", "pattern-discovery"],
        "Calendar discovery workflow failed"
      );
      this.metricsManager.recordExecution(errorResult, startTime);
      return errorResult;
    }
  }

  /**
   * Executes symbol analysis workflow with enhanced/legacy fallback
   */
  async executeSymbolAnalysisWorkflow(
    request: SymbolAnalysisWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    const startTime = Date.now();

    // Try enhanced coordination first if enabled
    if (this.coordinationManager.isCoordinationEnabled()) {
      try {
        const result = await this.coordinationManager.executeSymbolAnalysisWorkflow(request);
        this.metricsManager.recordExecution(result, startTime);
        return result;
      } catch (error) {
        console.warn(
          "[WorkflowExecutionService] Enhanced coordination failed, falling back to legacy mode:",
          error
        );
        // Fall through to legacy execution
      }
    }

    // Legacy execution path
    try {
      const result = await this.workflowExecutor.executeSymbolAnalysisWorkflow(request);
      this.metricsManager.recordExecution(result, startTime);
      return result;
    } catch (error) {
      const errorResult = this.createErrorResult(
        error,
        ["symbol-analysis", "pattern-discovery", "mexc-api"],
        `Symbol analysis workflow failed for ${request.vcoinId}`
      );
      this.metricsManager.recordExecution(errorResult, startTime);
      return errorResult;
    }
  }

  /**
   * Executes pattern analysis workflow with enhanced/legacy fallback
   */
  async executePatternAnalysisWorkflow(
    request: PatternAnalysisWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    const startTime = Date.now();

    // Try enhanced coordination first if enabled
    if (this.coordinationManager.isCoordinationEnabled()) {
      try {
        const result = await this.coordinationManager.executePatternAnalysisWorkflow(request);
        this.metricsManager.recordExecution(result, startTime);
        return result;
      } catch (error) {
        console.warn(
          "[WorkflowExecutionService] Enhanced coordination failed, falling back to legacy mode:",
          error
        );
        // Fall through to legacy execution
      }
    }

    // Legacy execution path
    try {
      const result = await this.workflowExecutor.executePatternAnalysisWorkflow(request);
      this.metricsManager.recordExecution(result, startTime);
      return result;
    } catch (error) {
      const errorResult = this.createErrorResult(
        error,
        ["pattern-discovery"],
        "Pattern analysis workflow failed"
      );
      this.metricsManager.recordExecution(errorResult, startTime);
      return errorResult;
    }
  }

  /**
   * Executes trading strategy workflow with enhanced/legacy fallback
   */
  async executeTradingStrategyWorkflow(
    request: TradingStrategyWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    const startTime = Date.now();

    // Try enhanced coordination first if enabled
    if (this.coordinationManager.isCoordinationEnabled()) {
      try {
        const result = await this.coordinationManager.executeTradingStrategyWorkflow(request);
        this.metricsManager.recordExecution(result, startTime);
        return result;
      } catch (error) {
        console.warn(
          "[WorkflowExecutionService] Enhanced coordination failed, falling back to legacy mode:",
          error
        );
        // Fall through to legacy execution
      }
    }

    // Legacy execution path
    try {
      const result = await this.workflowExecutor.executeTradingStrategyWorkflow(request);
      this.metricsManager.recordExecution(result, startTime);
      return result;
    } catch (error) {
      const errorResult = this.createErrorResult(
        error,
        ["strategy"],
        `Trading strategy workflow failed for ${request.vcoinId}`
      );
      this.metricsManager.recordExecution(errorResult, startTime);
      return errorResult;
    }
  }

  /**
   * Creates a standardized error result
   */
  private createErrorResult(
    error: unknown,
    agentsUsed: string[],
    context: string
  ): MexcWorkflowResult {
    console.error(`[WorkflowExecutionService] ${context}:`, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      metadata: {
        agentsUsed,
        context,
        timestamp: new Date().toISOString(),
      },
    };
  }
}