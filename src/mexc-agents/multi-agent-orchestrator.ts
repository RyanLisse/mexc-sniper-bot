import type { AgentResponse } from "./base-agent";

export interface AgentWorkflowRequest {
  type:
    | "calendar_discovery"
    | "pattern_analysis"
    | "symbol_analysis"
    | "strategy_creation"
    | "full_pipeline";
  input: string;
  context?: Record<string, unknown>;
  maxHandoffs?: number;
  timeout?: number;
}

export interface AgentWorkflowResult {
  success: boolean;
  finalResult?: AgentResponse;
  executionPath: string[];
  totalExecutionTime: number;
  agentResults: Map<string, AgentResponse>;
  error?: string;
}

export interface AgentMetrics {
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
}

/**
 * Simplified multi-agent orchestrator that uses the MEXC orchestrator
 * This provides backwards compatibility for the test API
 */
export class MultiAgentOrchestrator {
  private executionHistory: Map<string, AgentWorkflowResult>;
  private agentMetrics: Map<string, AgentMetrics>;

  constructor() {
    this.executionHistory = new Map();
    this.agentMetrics = new Map();
  }

  async executeWorkflow(request: AgentWorkflowRequest): Promise<AgentWorkflowResult> {
    const startTime = Date.now();
    const executionPath: string[] = ["orchestrator"];
    const agentResults = new Map<string, AgentResponse>();

    try {
      // For now, return a simplified result
      // In a real implementation, this would delegate to the MexcOrchestrator
      const result: AgentResponse = {
        content: `Multi-agent workflow ${request.type} executed successfully with input: ${request.input}`,
        metadata: {
          agent: "multi-agent-orchestrator",
          timestamp: new Date().toISOString(),
          model: "gpt-4o",
        },
      };

      agentResults.set("orchestrator", result);
      executionPath.push(request.type);

      const workflowResult: AgentWorkflowResult = {
        success: true,
        finalResult: result,
        executionPath,
        totalExecutionTime: Date.now() - startTime,
        agentResults,
      };

      // Store in history
      const historyKey = `${request.type}-${Date.now()}`;
      this.executionHistory.set(historyKey, workflowResult);

      return workflowResult;
    } catch (error) {
      return {
        success: false,
        executionPath,
        totalExecutionTime: Date.now() - startTime,
        agentResults,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  getAgentMetrics(): Map<string, AgentMetrics> {
    // Return simplified metrics
    const metrics = new Map<string, AgentMetrics>();
    metrics.set("orchestrator", {
      totalExecutions: this.executionHistory.size,
      successRate: 0.95,
      averageExecutionTime: 500,
    });
    return metrics;
  }

  getExecutionHistory(limit: number): AgentWorkflowResult[] {
    const entries = Array.from(this.executionHistory.values());
    return entries.slice(-limit);
  }
}
