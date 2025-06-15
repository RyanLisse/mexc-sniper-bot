import type { 
  AgentRegistry, 
  RegisteredAgent 
} from "./agent-registry";
import type { 
  WorkflowEngine, 
  WorkflowDefinition, 
  WorkflowExecutionResult,
  WorkflowStepConfig 
} from "./workflow-engine";
import type { PerformanceCollector } from "./performance-collector";
import { AgentMonitoringService } from "../../services/agent-monitoring-service";
import type {
  CalendarDiscoveryWorkflowRequest,
  SymbolAnalysisWorkflowRequest,
  PatternAnalysisWorkflowRequest,
  TradingStrategyWorkflowRequest,
  MexcWorkflowResult,
  AgentOrchestrationMetrics,
} from "../orchestrator-types";

/**
 * Enhanced orchestrator that uses the new coordination system
 * while maintaining backward compatibility with existing interfaces
 */
export class EnhancedMexcOrchestrator {
  private agentRegistry: AgentRegistry;
  private workflowEngine: WorkflowEngine;
  private performanceCollector: PerformanceCollector;
  private monitoringService: AgentMonitoringService;
  private metrics: AgentOrchestrationMetrics;
  private isInitialized = false;

  constructor(
    agentRegistry: AgentRegistry,
    workflowEngine: WorkflowEngine,
    performanceCollector: PerformanceCollector
  ) {
    this.agentRegistry = agentRegistry;
    this.workflowEngine = workflowEngine;
    this.performanceCollector = performanceCollector;
    this.monitoringService = AgentMonitoringService.getInstance();

    // Initialize metrics
    this.metrics = {
      totalExecutions: 0,
      successRate: 0,
      averageDuration: 0,
      errorRate: 0,
      lastExecution: new Date().toISOString(),
    };
  }

  /**
   * Initialize the enhanced orchestrator with predefined workflows
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn("[EnhancedMexcOrchestrator] Already initialized");
      return;
    }

    try {
      // Register standard MEXC workflows
      await this.registerMexcWorkflows();

      // Start monitoring systems
      this.agentRegistry.startHealthMonitoring();
      this.performanceCollector.startCollection();
      this.monitoringService.start();

      this.isInitialized = true;
      console.log("[EnhancedMexcOrchestrator] Initialization completed with health monitoring");

    } catch (error) {
      console.error("[EnhancedMexcOrchestrator] Initialization failed:", error);
      throw error;
    }
  }

  /**
   * Execute calendar discovery workflow with enhanced coordination
   */
  async executeCalendarDiscoveryWorkflow(
    request: CalendarDiscoveryWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    const startTime = Date.now();
    this.metrics.totalExecutions++;

    try {
      // Check agent availability before starting
      const requiredAgents = ["mexc-api", "calendar", "pattern-discovery"];
      const availabilityCheck = this.checkAgentAvailability(requiredAgents);
      
      if (!availabilityCheck.allAvailable) {
        throw new Error(`Required agents not available: ${availabilityCheck.unavailableAgents.join(", ")}`);
      }

      // Execute workflow using enhanced engine
      const workflowResult = await this.workflowEngine.executeWorkflow(
        "calendar-discovery",
        request,
        new Map([
          ["trigger", request.trigger],
          ["force", String(request.force || false)],
        ])
      );

      // Record performance metrics
      this.performanceCollector.recordWorkflowExecution(workflowResult);

      // Convert to legacy format for backward compatibility
      const mexcResult = this.convertToMexcWorkflowResult(workflowResult);
      
      this.updateMetrics(mexcResult, startTime);
      return mexcResult;

    } catch (error) {
      console.error("[EnhancedMexcOrchestrator] Calendar discovery workflow failed:", error);
      
      const errorResult: MexcWorkflowResult = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          agentsUsed: ["mexc-api", "calendar", "pattern-discovery"],
          duration: Date.now() - startTime,
        },
      };

      this.updateMetrics(errorResult, startTime);
      return errorResult;
    }
  }

  /**
   * Execute symbol analysis workflow with enhanced coordination
   */
  async executeSymbolAnalysisWorkflow(
    request: SymbolAnalysisWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    const startTime = Date.now();
    this.metrics.totalExecutions++;

    try {
      // Check agent availability
      const requiredAgents = ["symbol-analysis", "pattern-discovery", "mexc-api"];
      const availabilityCheck = this.checkAgentAvailability(requiredAgents);
      
      if (!availabilityCheck.allAvailable) {
        // Try to find alternative agents or use fallbacks
        const alternativeAgents = this.findAlternativeAgents(availabilityCheck.unavailableAgents);
        if (alternativeAgents.length === 0) {
          throw new Error(`No available agents for symbol analysis: ${availabilityCheck.unavailableAgents.join(", ")}`);
        }
      }

      // Execute workflow
      const workflowResult = await this.workflowEngine.executeWorkflow(
        "symbol-analysis",
        request,
        new Map([
          ["vcoinId", request.vcoinId],
          ["symbolName", request.symbolName || ""],
          ["projectName", request.projectName || ""],
          ["launchTime", request.launchTime || ""],
          ["attempt", String(request.attempt || 1)],
        ])
      );

      // Record performance metrics
      this.performanceCollector.recordWorkflowExecution(workflowResult);

      const mexcResult = this.convertToMexcWorkflowResult(workflowResult);
      this.updateMetrics(mexcResult, startTime);
      return mexcResult;

    } catch (error) {
      console.error(`[EnhancedMexcOrchestrator] Symbol analysis workflow failed for ${request.vcoinId}:`, error);
      
      const errorResult: MexcWorkflowResult = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          agentsUsed: ["symbol-analysis", "pattern-discovery", "mexc-api"],
          duration: Date.now() - startTime,
        },
      };

      this.updateMetrics(errorResult, startTime);
      return errorResult;
    }
  }

  /**
   * Execute pattern analysis workflow with enhanced coordination
   */
  async executePatternAnalysisWorkflow(
    request: PatternAnalysisWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    const startTime = Date.now();
    this.metrics.totalExecutions++;

    try {
      const workflowResult = await this.workflowEngine.executeWorkflow(
        "pattern-analysis",
        request,
        new Map([
          ["vcoinId", request.vcoinId || ""],
          ["symbols", JSON.stringify(request.symbols || [])],
          ["analysisType", request.analysisType],
        ])
      );

      // Record performance metrics
      this.performanceCollector.recordWorkflowExecution(workflowResult);

      const mexcResult = this.convertToMexcWorkflowResult(workflowResult);
      this.updateMetrics(mexcResult, startTime);
      return mexcResult;

    } catch (error) {
      console.error("[EnhancedMexcOrchestrator] Pattern analysis workflow failed:", error);
      
      const errorResult: MexcWorkflowResult = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          agentsUsed: ["pattern-discovery"],
          duration: Date.now() - startTime,
        },
      };

      this.updateMetrics(errorResult, startTime);
      return errorResult;
    }
  }

  /**
   * Execute trading strategy workflow with enhanced coordination
   */
  async executeTradingStrategyWorkflow(
    request: TradingStrategyWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    const startTime = Date.now();
    this.metrics.totalExecutions++;

    try {
      const workflowResult = await this.workflowEngine.executeWorkflow(
        "trading-strategy",
        request,
        new Map([
          ["vcoinId", request.vcoinId],
          ["symbolData", JSON.stringify(request.symbolData)],
          ["riskLevel", request.riskLevel || "medium"],
          ["capital", String(request.capital || 0)],
        ])
      );

      // Record performance metrics
      this.performanceCollector.recordWorkflowExecution(workflowResult);

      const mexcResult = this.convertToMexcWorkflowResult(workflowResult);
      this.updateMetrics(mexcResult, startTime);
      return mexcResult;

    } catch (error) {
      console.error(`[EnhancedMexcOrchestrator] Trading strategy workflow failed for ${request.vcoinId}:`, error);
      
      const errorResult: MexcWorkflowResult = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          agentsUsed: ["strategy"],
          duration: Date.now() - startTime,
        },
      };

      this.updateMetrics(errorResult, startTime);
      return errorResult;
    }
  }

  /**
   * Get enhanced agent health with coordination system data
   */
  async getAgentHealth(): Promise<{
    mexcApi: boolean;
    patternDiscovery: boolean;
    calendar: boolean;
    symbolAnalysis: boolean;
    strategy: boolean;
    coordination: {
      registryHealthy: boolean;
      workflowEngineHealthy: boolean;
      performanceCollectorHealthy: boolean;
      totalAgents: number;
      healthyAgents: number;
      degradedAgents: number;
      unhealthyAgents: number;
    };
  }> {
    const registryStats = this.agentRegistry.getStats();
    const allAgents = this.agentRegistry.getAllAgents();
    
    // Check core agents specifically
    const coreAgentHealth = {
      mexcApi: this.agentRegistry.isAgentAvailable("mexc-api"),
      patternDiscovery: this.agentRegistry.isAgentAvailable("pattern-discovery"),
      calendar: this.agentRegistry.isAgentAvailable("calendar"),
      symbolAnalysis: this.agentRegistry.isAgentAvailable("symbol-analysis"),
      strategy: this.agentRegistry.isAgentAvailable("strategy"),
    };

    return {
      ...coreAgentHealth,
      coordination: {
        registryHealthy: registryStats.healthyAgents > 0,
        workflowEngineHealthy: this.workflowEngine.getRunningWorkflows().length < 10, // Arbitrary threshold
        performanceCollectorHealthy: true, // Would need proper health check
        totalAgents: registryStats.totalAgents,
        healthyAgents: registryStats.healthyAgents,
        degradedAgents: registryStats.degradedAgents,
        unhealthyAgents: registryStats.unhealthyAgents,
      },
    };
  }

  /**
   * Get orchestration metrics with enhanced data
   */
  getOrchestrationMetrics(): AgentOrchestrationMetrics & {
    coordination: {
      workflowsExecuted: number;
      averageWorkflowDuration: number;
      performanceSummary: any;
    };
  } {
    const performanceSummary = this.performanceCollector.getCurrentSummary();
    const workflowHistory = this.workflowEngine.getExecutionHistory(100);
    
    const avgWorkflowDuration = workflowHistory.length > 0
      ? workflowHistory.reduce((sum, w) => sum + w.duration, 0) / workflowHistory.length
      : 0;

    return {
      ...this.metrics,
      coordination: {
        workflowsExecuted: workflowHistory.length,
        averageWorkflowDuration: avgWorkflowDuration,
        performanceSummary,
      },
    };
  }

  /**
   * Get comprehensive agent summary
   */
  getAgentSummary(): {
    totalAgents: number;
    agentTypes: string[];
    initialized: boolean;
    coordination: {
      registeredAgents: number;
      availableAgents: number;
      workflowDefinitions: number;
      recentPerformance: any;
    };
  } {
    const registryStats = this.agentRegistry.getStats();
    const allAgents = this.agentRegistry.getAllAgents();
    const availableAgents = allAgents.filter(agent => 
      this.agentRegistry.isAgentAvailable(agent.id)
    );

    return {
      totalAgents: registryStats.totalAgents,
      agentTypes: allAgents.map(agent => agent.type),
      initialized: this.isInitialized,
      coordination: {
        registeredAgents: registryStats.totalAgents,
        availableAgents: availableAgents.length,
        workflowDefinitions: 4, // Number of registered workflows
        recentPerformance: this.performanceCollector.getCurrentSummary(),
      },
    };
  }

  /**
   * Enhanced health check with coordination system status
   */
  async healthCheck(): Promise<boolean> {
    try {
      const registryStats = this.agentRegistry.getStats();
      const runningWorkflows = this.workflowEngine.getRunningWorkflows();
      const monitoringStats = this.monitoringService.getStats();
      
      // Check if we have at least some healthy agents
      const hasHealthyAgents = registryStats.healthyAgents > 0;
      
      // Check if workflow engine is not overloaded
      const workflowEngineHealthy = runningWorkflows.length < 20;
      
      // Check if monitoring service is running and not overloaded with alerts
      const monitoringHealthy = monitoringStats.isRunning && monitoringStats.criticalAlerts < 5;
      
      // Check if coordination system is responsive
      const coordinationHealthy = this.isInitialized && hasHealthyAgents;

      return coordinationHealthy && workflowEngineHealthy && monitoringHealthy;
      
    } catch (error) {
      console.error("[EnhancedMexcOrchestrator] Health check failed:", error);
      return false;
    }
  }

  /**
   * Get comprehensive health status including monitoring data
   */
  getComprehensiveHealthStatus(): {
    overall: "healthy" | "degraded" | "unhealthy" | "unknown";
    systems: {
      agentRegistry: any;
      workflowEngine: any;
      monitoring: any;
      coordination: any;
    };
    alerts: any[];
    recommendations: string[];
  } {
    const registryStats = this.agentRegistry.getStats();
    const monitoringStats = this.monitoringService.getStats();
    const alerts = this.monitoringService.getAlerts(false); // Only unresolved
    const runningWorkflows = this.workflowEngine.getRunningWorkflows();
    
    // Determine overall health status
    let overallStatus: "healthy" | "degraded" | "unhealthy" | "unknown" = "healthy";
    
    const unhealthyPercentage = registryStats.totalAgents > 0 
      ? (registryStats.unhealthyAgents / registryStats.totalAgents) * 100 
      : 0;
    
    if (unhealthyPercentage > 30 || monitoringStats.criticalAlerts > 3) {
      overallStatus = "unhealthy";
    } else if (unhealthyPercentage > 10 || monitoringStats.criticalAlerts > 1 || runningWorkflows.length > 15) {
      overallStatus = "degraded";
    }
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (registryStats.unhealthyAgents > 0) {
      recommendations.push(`${registryStats.unhealthyAgents} agents are unhealthy - investigate and resolve issues`);
    }
    
    if (monitoringStats.criticalAlerts > 0) {
      recommendations.push(`${monitoringStats.criticalAlerts} critical alerts need attention`);
    }
    
    if (runningWorkflows.length > 10) {
      recommendations.push(`High number of running workflows (${runningWorkflows.length}) - monitor for bottlenecks`);
    }
    
    if (registryStats.averageResponseTime > 3000) {
      recommendations.push("High average response time detected - consider performance optimization");
    }
    
    return {
      overall: overallStatus,
      systems: {
        agentRegistry: {
          status: registryStats.unhealthyAgents === 0 ? "healthy" : 
                  registryStats.unhealthyAgents < registryStats.totalAgents * 0.3 ? "degraded" : "unhealthy",
          totalAgents: registryStats.totalAgents,
          healthyAgents: registryStats.healthyAgents,
          degradedAgents: registryStats.degradedAgents,
          unhealthyAgents: registryStats.unhealthyAgents,
          averageResponseTime: registryStats.averageResponseTime,
        },
        workflowEngine: {
          status: runningWorkflows.length < 10 ? "healthy" : 
                  runningWorkflows.length < 20 ? "degraded" : "unhealthy",
          runningWorkflows: runningWorkflows.length,
          registeredWorkflows: 4, // Our registered workflows
        },
        monitoring: {
          status: monitoringStats.isRunning && monitoringStats.criticalAlerts < 3 ? "healthy" :
                  monitoringStats.isRunning && monitoringStats.criticalAlerts < 5 ? "degraded" : "unhealthy",
          isRunning: monitoringStats.isRunning,
          totalAlerts: monitoringStats.totalAlerts,
          unresolvedAlerts: monitoringStats.unresolvedAlerts,
          criticalAlerts: monitoringStats.criticalAlerts,
        },
        coordination: {
          status: this.isInitialized && registryStats.healthyAgents > 0 ? "healthy" : "unhealthy",
          initialized: this.isInitialized,
          totalExecutions: this.metrics.totalExecutions,
          successRate: this.metrics.successRate,
          errorRate: this.metrics.errorRate,
          averageDuration: this.metrics.averageDuration,
        },
      },
      alerts: alerts.slice(0, 10), // Last 10 alerts
      recommendations,
    };
  }

  /**
   * Shutdown coordination systems gracefully
   */
  async shutdown(): Promise<void> {
    console.log("[EnhancedMexcOrchestrator] Shutting down...");
    
    try {
      // Stop monitoring systems
      this.agentRegistry.stopHealthMonitoring();
      this.performanceCollector.stopCollection();
      
      // Cancel running workflows
      const runningWorkflows = this.workflowEngine.getRunningWorkflows();
      for (const workflowId of runningWorkflows) {
        this.workflowEngine.cancelWorkflow(workflowId);
      }
      
      // Cleanup registries
      this.agentRegistry.destroy();
      this.performanceCollector.destroy();
      
      this.isInitialized = false;
      console.log("[EnhancedMexcOrchestrator] Shutdown completed");
      
    } catch (error) {
      console.error("[EnhancedMexcOrchestrator] Shutdown error:", error);
    }
  }

  /**
   * Register standard MEXC workflows
   */
  private async registerMexcWorkflows(): Promise<void> {
    // Calendar Discovery Workflow
    const calendarWorkflow: WorkflowDefinition = {
      id: "calendar-discovery",
      name: "MEXC Calendar Discovery",
      description: "Discover new coin listings from MEXC calendar",
      version: "1.0.0",
      executionMode: "sequential",
      timeout: 60000, // 1 minute
      steps: [
        {
          id: "fetch-calendar",
          name: "Fetch Calendar Data",
          agentId: "mexc-api",
          input: { action: "get_calendar" },
          timeout: 20000,
          retries: 2,
          required: true,
        },
        {
          id: "analyze-listings",
          name: "Analyze Listings",
          agentId: "calendar",
          input: { action: "analyze_listings" },
          dependencies: ["fetch-calendar"],
          timeout: 15000,
          retries: 1,
          required: true,
        },
        {
          id: "detect-patterns",
          name: "Detect Ready Patterns",
          agentId: "pattern-discovery",
          input: { action: "detect_ready_patterns" },
          dependencies: ["analyze-listings"],
          timeout: 25000,
          retries: 1,
          required: false,
        },
      ],
    };

    // Symbol Analysis Workflow
    const symbolWorkflow: WorkflowDefinition = {
      id: "symbol-analysis",
      name: "MEXC Symbol Analysis",
      description: "Analyze symbol readiness and market conditions",
      version: "1.0.0",
      executionMode: "sequential",
      timeout: 45000,
      steps: [
        {
          id: "fetch-symbol-data",
          name: "Fetch Symbol Data",
          agentId: "mexc-api",
          input: { action: "get_symbol_data" },
          timeout: 15000,
          retries: 2,
          required: true,
        },
        {
          id: "analyze-symbol",
          name: "Analyze Symbol Readiness",
          agentId: "symbol-analysis",
          input: { action: "analyze_readiness" },
          dependencies: ["fetch-symbol-data"],
          timeout: 20000,
          retries: 1,
          required: true,
        },
        {
          id: "validate-patterns",
          name: "Validate Patterns",
          agentId: "pattern-discovery",
          input: { action: "validate_patterns" },
          dependencies: ["analyze-symbol"],
          timeout: 10000,
          retries: 1,
          required: false,
        },
      ],
    };

    // Pattern Analysis Workflow
    const patternWorkflow: WorkflowDefinition = {
      id: "pattern-analysis",
      name: "MEXC Pattern Analysis",
      description: "Analyze trading patterns and opportunities",
      version: "1.0.0",
      executionMode: "sequential",
      timeout: 30000,
      steps: [
        {
          id: "analyze-patterns",
          name: "Analyze Patterns",
          agentId: "pattern-discovery",
          input: { action: "analyze_patterns" },
          timeout: 25000,
          retries: 2,
          required: true,
        },
      ],
    };

    // Trading Strategy Workflow
    const strategyWorkflow: WorkflowDefinition = {
      id: "trading-strategy",
      name: "MEXC Trading Strategy",
      description: "Create and validate trading strategies",
      version: "1.0.0",
      executionMode: "sequential",
      timeout: 40000,
      steps: [
        {
          id: "create-strategy",
          name: "Create Trading Strategy",
          agentId: "strategy",
          input: { action: "create_strategy" },
          timeout: 30000,
          retries: 1,
          required: true,
        },
        {
          id: "validate-strategy",
          name: "Validate Strategy",
          agentId: "risk-manager",
          input: { action: "validate_strategy" },
          dependencies: ["create-strategy"],
          timeout: 10000,
          retries: 1,
          required: false,
          fallbackAgentId: "simulation",
        },
      ],
    };

    // Register all workflows
    this.workflowEngine.registerWorkflow(calendarWorkflow);
    this.workflowEngine.registerWorkflow(symbolWorkflow);
    this.workflowEngine.registerWorkflow(patternWorkflow);
    this.workflowEngine.registerWorkflow(strategyWorkflow);

    console.log("[EnhancedMexcOrchestrator] Registered 4 MEXC workflows");
  }

  /**
   * Check agent availability for required agents
   */
  private checkAgentAvailability(agentIds: string[]): {
    allAvailable: boolean;
    availableAgents: string[];
    unavailableAgents: string[];
  } {
    const availableAgents: string[] = [];
    const unavailableAgents: string[] = [];

    for (const agentId of agentIds) {
      if (this.agentRegistry.isAgentAvailable(agentId)) {
        availableAgents.push(agentId);
      } else {
        unavailableAgents.push(agentId);
      }
    }

    return {
      allAvailable: unavailableAgents.length === 0,
      availableAgents,
      unavailableAgents,
    };
  }

  /**
   * Find alternative agents for unavailable ones
   */
  private findAlternativeAgents(unavailableAgents: string[]): string[] {
    const alternatives: string[] = [];
    
    for (const agentId of unavailableAgents) {
      // Look for agents of the same type that are available
      const agent = this.agentRegistry.getAgent(agentId);
      if (agent) {
        const sameTypeAgents = this.agentRegistry.getAvailableAgentsByType(agent.type);
        if (sameTypeAgents.length > 0) {
          alternatives.push(sameTypeAgents[0].id);
        }
      }
    }

    return alternatives;
  }

  /**
   * Convert workflow result to legacy MEXC format
   */
  private convertToMexcWorkflowResult(workflowResult: WorkflowExecutionResult): MexcWorkflowResult {
    return {
      success: workflowResult.status === "completed",
      data: workflowResult.output,
      error: workflowResult.error,
      metadata: {
        agentsUsed: workflowResult.metadata.agentsUsed,
        duration: workflowResult.duration,
        confidence: 0.8, // Default confidence
      },
    };
  }

  /**
   * Update internal metrics
   */
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