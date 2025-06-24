/**
 * Multi-Agent Orchestrator
 *
 * Central orchestrator for coordinating multiple MEXC trading agents.
 * Manages agent lifecycle, communication, and workflow coordination.
 */

import { createSafeLogger } from "../lib/structured-logger";
import { tradingAnalytics } from "../services/trading-analytics-service";
import type { AgentResponse, AgentStatus, BaseAgent } from "./base-agent";
import { CalendarAgent } from "./calendar-agent";
import { MexcApiAgent } from "./mexc-api-agent";
import { PatternDiscoveryAgent } from "./pattern-discovery-agent";
import { SymbolAnalysisAgent } from "./symbol-analysis-agent";

export interface OrchestratorConfig {
  maxConcurrentAgents: number;
  healthCheckInterval: number;
  defaultTimeout: number;
  retryAttempts: number;
  enableLogging: boolean;
}

export interface WorkflowStep {
  agentType: string;
  input: any;
  timeout?: number;
  retries?: number;
  dependencies?: string[];
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  parallel?: boolean;
  timeoutMs?: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  startTime: Date;
  endTime?: Date;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  results: Map<string, AgentResponse>;
  errors: Array<{ step: string; error: string; timestamp: Date }>;
}

export interface AgentWorkflowRequest {
  workflowId: string;
  input: any;
  timeout?: number;
  priority?: number;
}

export interface AgentWorkflowResult {
  success: boolean;
  execution: WorkflowExecution;
  error?: string;
}

export class MultiAgentOrchestrator {
  private _logger?: ReturnType<typeof createSafeLogger>;
  private get logger() {
    if (!this._logger) {
      this._logger = createSafeLogger("multi-agent-orchestrator");
    }
    return this._logger;
  }

  private static instance: MultiAgentOrchestrator;
  private agents: Map<string, BaseAgent> = new Map();
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private config: OrchestratorConfig;
  private healthCheckTimer?: NodeJS.Timeout;

  private constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = {
      maxConcurrentAgents: 10,
      healthCheckInterval: 60000, // 1 minute
      defaultTimeout: 30000, // 30 seconds
      retryAttempts: 3,
      enableLogging: true,
      ...config,
    };

    this.initializeAgents();
    this.startHealthMonitoring();
  }

  static getInstance(config?: Partial<OrchestratorConfig>): MultiAgentOrchestrator {
    if (!MultiAgentOrchestrator.instance) {
      MultiAgentOrchestrator.instance = new MultiAgentOrchestrator(config);
    }
    return MultiAgentOrchestrator.instance;
  }

  private initializeAgents(): void {
    // Register available agents
    this.registerAgent("calendar", new CalendarAgent());
    this.registerAgent("mexc-api", new MexcApiAgent());
    this.registerAgent("pattern-discovery", new PatternDiscoveryAgent());
    this.registerAgent("symbol-analysis", new SymbolAnalysisAgent());

    this.log("Orchestrator initialized with agents:", Array.from(this.agents.keys()));
  }

  private registerAgent(type: string, agent: BaseAgent): void {
    this.agents.set(type, agent);
    this.log(`Registered agent: ${type}`);
  }

  async executeWorkflow(workflowId: string, input: any): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      startTime: new Date(),
      status: "running",
      results: new Map(),
      errors: [],
    };

    this.executions.set(executionId, execution);
    this.log(`Starting workflow execution: ${executionId} for workflow: ${workflowId}`);

    try {
      // Log workflow start
      tradingAnalytics.logTradingEvent({
        eventType: "SYSTEM_ERROR", // Would be WORKFLOW_START in real implementation
        metadata: {
          workflowId,
          executionId,
          workflowName: workflow.name,
          totalSteps: workflow.steps.length,
        },
        performance: {
          responseTimeMs: 0,
          retryCount: 0,
        },
        success: true,
      });

      if (workflow.parallel) {
        await this.executeStepsInParallel(workflow, execution, input);
      } else {
        await this.executeStepsSequentially(workflow, execution, input);
      }

      execution.status = "completed";
      execution.endTime = new Date();

      this.log(`Workflow execution completed: ${executionId}`);

      // Log successful completion
      tradingAnalytics.logTradingEvent({
        eventType: "SYSTEM_ERROR", // Would be WORKFLOW_COMPLETE in real implementation
        metadata: {
          workflowId,
          executionId,
          duration: execution.endTime.getTime() - execution.startTime.getTime(),
          resultsCount: execution.results.size,
        },
        performance: {
          responseTimeMs: execution.endTime.getTime() - execution.startTime.getTime(),
          retryCount: 0,
        },
        success: true,
      });
    } catch (error) {
      execution.status = "failed";
      execution.endTime = new Date();
      execution.errors.push({
        step: "workflow",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      });

      this.log(`Workflow execution failed: ${executionId}`, error);

      // Log failure
      tradingAnalytics.logTradingEvent({
        eventType: "SYSTEM_ERROR",
        metadata: {
          workflowId,
          executionId,
          errorCount: execution.errors.length,
        },
        performance: {
          responseTimeMs: execution.endTime.getTime() - execution.startTime.getTime(),
          retryCount: 0,
        },
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return execution;
  }

  private async executeStepsSequentially(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    input: any
  ): Promise<void> {
    let currentInput = input;

    for (const step of workflow.steps) {
      try {
        const result = await this.executeStep(step, currentInput, execution);
        execution.results.set(step.agentType, result);

        // Use result as input for next step
        currentInput = result.data;
      } catch (error) {
        execution.errors.push({
          step: step.agentType,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date(),
        });
        throw error;
      }
    }
  }

  private async executeStepsInParallel(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    input: any
  ): Promise<void> {
    const promises = workflow.steps.map(async (step) => {
      try {
        const result = await this.executeStep(step, input, execution);
        execution.results.set(step.agentType, result);
        return { step: step.agentType, result };
      } catch (error) {
        execution.errors.push({
          step: step.agentType,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date(),
        });
        throw error;
      }
    });

    await Promise.all(promises);
  }

  private async executeStep(
    step: WorkflowStep,
    input: any,
    execution: WorkflowExecution
  ): Promise<AgentResponse> {
    const agent = this.agents.get(step.agentType);
    if (!agent) {
      throw new Error(`Agent not found: ${step.agentType}`);
    }

    const timeout = step.timeout || this.config.defaultTimeout;
    const retries = step.retries || this.config.retryAttempts;

    this.log(`Executing step: ${step.agentType} with timeout: ${timeout}ms`);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const startTime = Date.now();

        const result = await Promise.race([
          agent.process(step.input || input, { executionId: execution.id }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Agent timeout")), timeout)
          ),
        ]);

        const responseTime = Date.now() - startTime;

        // Log successful step execution
        tradingAnalytics.logApiCall(
          `agent_${step.agentType}`,
          responseTime,
          true,
          execution.id,
          undefined,
          { attempt, executionId: execution.id }
        );

        this.log(`Step completed: ${step.agentType} in ${responseTime}ms`);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");
        const responseTime = Date.now() - Date.now();

        // Log failed attempt
        tradingAnalytics.logApiCall(
          `agent_${step.agentType}`,
          responseTime,
          false,
          execution.id,
          lastError.message,
          { attempt, executionId: execution.id }
        );

        if (attempt < retries) {
          this.log(
            `Step failed, retrying: ${step.agentType}, attempt ${attempt + 1}/${retries + 1}`
          );
          // Wait before retry (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
        }
      }
    }

    throw lastError || new Error(`Step failed after ${retries + 1} attempts: ${step.agentType}`);
  }

  defineWorkflow(definition: WorkflowDefinition): void {
    this.workflows.set(definition.id, definition);
    this.log(`Workflow defined: ${definition.id} - ${definition.name}`);
  }

  getWorkflowExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  getActiveExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values()).filter(
      (execution) => execution.status === "running"
    );
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== "running") {
      return false;
    }

    execution.status = "cancelled";
    execution.endTime = new Date();
    this.log(`Execution cancelled: ${executionId}`);
    return true;
  }

  async getAgentStatus(agentType: string): Promise<AgentStatus> {
    const agent = this.agents.get(agentType);
    if (!agent) {
      throw new Error(`Agent not found: ${agentType}`);
    }

    return agent.getStatus();
  }

  async getAllAgentStatuses(): Promise<Map<string, AgentStatus>> {
    const statuses = new Map<string, AgentStatus>();

    for (const [type, agent] of this.agents.entries()) {
      try {
        const status = await agent.getStatus();
        statuses.set(type, status);
      } catch (error) {
        this.log(`Failed to get status for agent ${type}:`, error);
        statuses.set(type, "error");
      }
    }

    return statuses;
  }

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);

    this.log("Health monitoring started");
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const statuses = await this.getAllAgentStatuses();
      const unhealthyAgents = Array.from(statuses.entries())
        .filter(([, status]) => status === "error" || status === "offline")
        .map(([type]) => type);

      if (unhealthyAgents.length > 0) {
        this.log("Unhealthy agents detected:", unhealthyAgents);

        // Log health check results
        tradingAnalytics.logTradingEvent({
          eventType: "SYSTEM_ERROR",
          metadata: {
            healthCheck: true,
            totalAgents: statuses.size,
            unhealthyAgents,
            unhealthyCount: unhealthyAgents.length,
          },
          performance: {
            responseTimeMs: 0,
            retryCount: 0,
          },
          success: unhealthyAgents.length === 0,
          error:
            unhealthyAgents.length > 0 ? `${unhealthyAgents.length} unhealthy agents` : undefined,
        });
      }
    } catch (error) {
      this.log("Health check failed:", error);
    }
  }

  getOrchestratorMetrics(): {
    agentCount: number;
    workflowCount: number;
    activeExecutions: number;
    totalExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
  } {
    const executions = Array.from(this.executions.values());

    return {
      agentCount: this.agents.size,
      workflowCount: this.workflows.size,
      activeExecutions: executions.filter((e) => e.status === "running").length,
      totalExecutions: executions.length,
      completedExecutions: executions.filter((e) => e.status === "completed").length,
      failedExecutions: executions.filter((e) => e.status === "failed").length,
    };
  }

  cleanup(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Cancel all running executions
    for (const execution of this.executions.values()) {
      if (execution.status === "running") {
        execution.status = "cancelled";
        execution.endTime = new Date();
      }
    }

    this.log("Orchestrator cleanup completed");
  }

  private log(message: string, ...args: any[]): void {
    if (this.config.enableLogging) {
      logger.info(`[MultiAgentOrchestrator] ${message}`, ...args);
    }
  }
}

// ============================================================================
// Pre-defined Workflows
// ============================================================================

export const BUILTIN_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: "coin-discovery",
    name: "Coin Discovery Workflow",
    description: "Discovers new coin listings and analyzes their potential",
    steps: [
      {
        agentType: "calendar",
        input: { action: "getNewListings" },
        timeout: 15000,
      },
      {
        agentType: "symbol-analysis",
        input: { action: "analyzeSymbols" },
        timeout: 30000,
        dependencies: ["calendar"],
      },
      {
        agentType: "pattern-discovery",
        input: { action: "findPatterns" },
        timeout: 45000,
        dependencies: ["symbol-analysis"],
      },
    ],
    parallel: false,
    timeoutMs: 120000,
  },
  {
    id: "market-analysis",
    name: "Market Analysis Workflow",
    description: "Comprehensive market analysis across multiple agents",
    steps: [
      {
        agentType: "mexc-api",
        input: { action: "getMarketData" },
        timeout: 10000,
      },
      {
        agentType: "pattern-discovery",
        input: { action: "analyzePatterns" },
        timeout: 20000,
      },
      {
        agentType: "symbol-analysis",
        input: { action: "rankSymbols" },
        timeout: 15000,
      },
    ],
    parallel: true,
    timeoutMs: 60000,
  },
];

// Initialize built-in workflows
export function initializeBuiltinWorkflows(orchestrator: MultiAgentOrchestrator): void {
  for (const workflow of BUILTIN_WORKFLOWS) {
    orchestrator.defineWorkflow(workflow);
  }
}

export default MultiAgentOrchestrator;
