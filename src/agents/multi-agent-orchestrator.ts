import type { EnhancedAgentResponse, EnhancedBaseAgent } from "./enhanced-base-agent";
import { EnhancedCalendarAgent } from "./enhanced-calendar-agent";
import { EnhancedPatternAgent } from "./enhanced-pattern-agent";
import { EnhancedStrategyCreationAgent } from "./enhanced-strategy-creation-agent";
import { EnhancedSymbolAnalysisAgent } from "./enhanced-symbol-analysis-agent";

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
  finalResult?: EnhancedAgentResponse;
  executionPath: string[];
  totalExecutionTime: number;
  agentResults: Map<string, EnhancedAgentResponse>;
  error?: string;
}

export interface AgentMetrics {
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
}

export class MultiAgentOrchestrator {
  private agentRegistry: Map<string, EnhancedBaseAgent>;
  private executionHistory: Map<string, AgentWorkflowResult>;

  constructor() {
    this.agentRegistry = new Map();
    this.executionHistory = new Map();
    this.initializeAgents();
  }

  private initializeAgents() {
    // Initialize all enhanced agents
    this.agentRegistry.set("enhanced-calendar-agent", new EnhancedCalendarAgent());
    this.agentRegistry.set("enhanced-pattern-discovery-agent", new EnhancedPatternAgent());
    this.agentRegistry.set("enhanced-symbol-analysis-agent", new EnhancedSymbolAnalysisAgent());
    this.agentRegistry.set("enhanced-strategy-agent", new EnhancedStrategyCreationAgent());

    console.log(`[MultiAgent] Initialized ${this.agentRegistry.size} enhanced agents`);
  }

  /**
   * Execute a multi-agent workflow with automatic handoffs
   */
  async executeWorkflow(request: AgentWorkflowRequest): Promise<AgentWorkflowResult> {
    const startTime = Date.now();
    const executionId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result: AgentWorkflowResult = {
      success: false,
      executionPath: [],
      totalExecutionTime: 0,
      agentResults: new Map(),
    };

    try {
      // Determine starting agent based on workflow type
      const startingAgent = this.selectStartingAgent(request.type);
      if (!startingAgent) {
        throw new Error(`No suitable starting agent found for workflow type: ${request.type}`);
      }

      let currentAgent = startingAgent;
      let currentInput = request.input;
      let currentContext = request.context || {};
      let handoffCount = 0;
      const maxHandoffs = request.maxHandoffs || 5;

      // Execute workflow with handoffs
      while (currentAgent && handoffCount < maxHandoffs) {
        const agentName = this.getAgentName(currentAgent);
        result.executionPath.push(agentName);

        console.log(`[MultiAgent] Executing agent: ${agentName} (handoff ${handoffCount})`);

        // Execute current agent
        const agentResult = await currentAgent.executeWithHandoff(
          currentInput,
          currentContext,
          this.agentRegistry
        );

        result.agentResults.set(agentName, agentResult);

        // Check for handoff
        const handoff = currentAgent.checkHandoff(currentInput, {
          ...currentContext,
          ...this.extractContextFromResult(agentResult),
        });

        if (handoff && this.agentRegistry.has(handoff.toAgent)) {
          // Execute handoff
          console.log(
            `[MultiAgent] Handoff: ${agentName} -> ${handoff.toAgent} (${handoff.reason})`
          );

          const nextAgent = this.agentRegistry.get(handoff.toAgent);
          if (!nextAgent) {
            throw new Error(`Agent ${handoff.toAgent} not found in registry`);
          }
          currentAgent = nextAgent;
          currentContext = { ...currentContext, ...handoff.context };
          handoffCount++;

          // Update input for next agent based on previous result
          currentInput = this.prepareHandoffInput(agentResult, handoff);
        } else {
          // No more handoffs, workflow complete
          result.finalResult = agentResult;
          break;
        }
      }

      if (handoffCount >= maxHandoffs) {
        console.warn(
          `[MultiAgent] Maximum handoffs (${maxHandoffs}) reached for workflow ${executionId}`
        );
      }

      result.success = true;
      result.totalExecutionTime = Date.now() - startTime;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      result.totalExecutionTime = Date.now() - startTime;
      console.error(`[MultiAgent] Workflow execution failed:`, error);
    }

    // Store execution history
    this.executionHistory.set(executionId, result);

    return result;
  }

  /**
   * Execute a complete discovery and analysis pipeline
   */
  async executeFullPipeline(input?: string): Promise<AgentWorkflowResult> {
    const request: AgentWorkflowRequest = {
      type: "full_pipeline",
      input: input || "Execute complete MEXC discovery and analysis pipeline",
      context: {
        pipelineMode: true,
        timestamp: new Date().toISOString(),
      },
      maxHandoffs: 10,
    };

    return this.executeWorkflow(request);
  }

  /**
   * Execute calendar discovery workflow
   */
  async executeCalendarDiscovery(params?: Record<string, unknown>): Promise<AgentWorkflowResult> {
    const request: AgentWorkflowRequest = {
      type: "calendar_discovery",
      input: "Discover and analyze new MEXC token listings",
      context: {
        discoveryParams: params,
        targetAdvanceHours: 3.5,
      },
    };

    return this.executeWorkflow(request);
  }

  /**
   * Execute pattern analysis workflow
   */
  async executePatternAnalysis(symbols?: string[]): Promise<AgentWorkflowResult> {
    const request: AgentWorkflowRequest = {
      type: "pattern_analysis",
      input: `Analyze pattern states for ${symbols?.length || "all"} symbols`,
      context: {
        symbols,
        analysisType: "comprehensive",
      },
    };

    return this.executeWorkflow(request);
  }

  /**
   * Execute symbol analysis workflow
   */
  async executeSymbolAnalysis(
    symbol: string,
    analysisDepth: "basic" | "comprehensive" | "precision" = "comprehensive",
    timeUntilLaunch?: number
  ): Promise<AgentWorkflowResult> {
    const request: AgentWorkflowRequest = {
      type: "symbol_analysis",
      input: `Perform ${analysisDepth} analysis for symbol ${symbol}`,
      context: {
        symbol,
        analysisDepth,
        timeUntilLaunch,
        priorityLevel: timeUntilLaunch && timeUntilLaunch < 600000 ? "high" : "medium", // High priority if < 10 minutes
      },
    };

    return this.executeWorkflow(request);
  }

  /**
   * Execute strategy creation workflow
   */
  async executeStrategyCreation(
    symbol: string,
    launchTime: string | number,
    executionParameters: Record<string, unknown>,
    marketData: Record<string, unknown>
  ): Promise<AgentWorkflowResult> {
    const request: AgentWorkflowRequest = {
      type: "strategy_creation",
      input: `Create high-precision execution strategy for ${symbol}`,
      context: {
        symbol,
        launchTime,
        executionParameters,
        marketData,
        riskProfile: {
          tolerance: "medium",
          maxPositionSize: 1000,
          stopLossPercent: 5,
          takeProfitLevels: [10, 15, 25],
        },
        timingPrecision: "high",
      },
    };

    return this.executeWorkflow(request);
  }

  /**
   * Get workflow execution history
   */
  getExecutionHistory(limit = 10): AgentWorkflowResult[] {
    const history = Array.from(this.executionHistory.values());
    return history.slice(-limit);
  }

  /**
   * Get agent performance metrics
   */
  getAgentMetrics(): Map<string, AgentMetrics> {
    const metrics = new Map();

    for (const [agentName] of this.agentRegistry) {
      const agentExecutions = Array.from(this.executionHistory.values()).filter((result) =>
        result.executionPath.includes(agentName)
      );

      metrics.set(agentName, {
        totalExecutions: agentExecutions.length,
        successRate: agentExecutions.filter((r) => r.success).length / agentExecutions.length || 0,
        averageExecutionTime:
          agentExecutions.reduce((sum, r) => sum + r.totalExecutionTime, 0) /
            agentExecutions.length || 0,
      });
    }

    return metrics;
  }

  private selectStartingAgent(workflowType: string): EnhancedBaseAgent | null {
    switch (workflowType) {
      case "calendar_discovery":
      case "full_pipeline":
        return this.agentRegistry.get("enhanced-calendar-agent") || null;
      case "pattern_analysis":
        return this.agentRegistry.get("enhanced-pattern-discovery-agent") || null;
      case "symbol_analysis":
        return this.agentRegistry.get("enhanced-symbol-analysis-agent") || null;
      case "strategy_creation":
        return this.agentRegistry.get("enhanced-strategy-agent") || null;
      default:
        console.warn(`[MultiAgent] Unknown workflow type: ${workflowType}`);
        return null;
    }
  }

  private getAgentName(agent: EnhancedBaseAgent): string {
    for (const [name, registeredAgent] of this.agentRegistry) {
      if (registeredAgent === agent) {
        return name;
      }
    }
    return "unknown-agent";
  }

  private extractContextFromResult(result: EnhancedAgentResponse): Record<string, unknown> {
    // Extract useful context from agent result for handoff
    return {
      agentOutput: result.content,
      toolCalls: result.toolCalls,
      reasoning: result.reasoning,
      executionTime: result.metadata.executionTime,
    };
  }

  private prepareHandoffInput(
    previousResult: EnhancedAgentResponse,
    handoff: { reason: string }
  ): string {
    return `Previous agent analysis: ${previousResult.content}\n\nHandoff context: ${handoff.reason}\n\nProceed with analysis based on the above context.`;
  }
}
