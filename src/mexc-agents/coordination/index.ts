/**
 * Agent Coordination System
 *
 * This module provides centralized coordination for the multi-agent system including:
 * - Agent registry and health monitoring
 * - Workflow execution engine with dependency management
 * - Performance metrics collection and analysis
 * - Enhanced orchestration with backward compatibility
 */

export type {
  AgentHealth,
  AgentStatus,
  HealthCheckResult,
  RegisteredAgent,
} from "./agent-registry";
// Core coordination components
export {
  AgentRegistry,
  getGlobalAgentRegistry,
  initializeGlobalAgentRegistry,
  clearGlobalAgentRegistry,
} from "./agent-registry";
export { EnhancedMexcOrchestrator } from "./enhanced-orchestrator";
export type {
  AgentPerformanceMetrics,
  PerformanceReport,
  SystemPerformanceSnapshot,
  WorkflowPerformanceMetrics,
} from "./performance-collector";

export { PerformanceCollector } from "./performance-collector";
export type {
  FailureStrategy,
  WorkflowContext,
  WorkflowDefinition,
  WorkflowExecutionMode,
  WorkflowExecutionResult,
  WorkflowStepConfig,
  WorkflowStepResult,
  WorkflowStepStatus,
} from "./workflow-engine";
export { WorkflowEngine } from "./workflow-engine";

// Utility function to create a fully configured coordination system
export async function createCoordinationSystem(options?: {
  healthCheckInterval?: number;
  performanceCollectionInterval?: number;
  maxHistorySize?: number;
}): Promise<{
  agentRegistry: import("./agent-registry").AgentRegistry;
  workflowEngine: import("./workflow-engine").WorkflowEngine;
  performanceCollector: import("./performance-collector").PerformanceCollector;
  orchestrator: import("./enhanced-orchestrator").EnhancedMexcOrchestrator;
}> {
  // Create agent registry
  const { initializeGlobalAgentRegistry } = await import("./agent-registry");
  const agentRegistry = initializeGlobalAgentRegistry({
    healthCheckInterval: options?.healthCheckInterval || 30000,
    maxHealthHistorySize: options?.maxHistorySize || 100,
  });

  // Create workflow engine
  const workflowEngine = new (await import("./workflow-engine")).WorkflowEngine(agentRegistry);

  // Create performance collector
  const performanceCollector = new (await import("./performance-collector")).PerformanceCollector(
    agentRegistry,
    {
      collectionInterval: options?.performanceCollectionInterval || 60000,
      maxHistorySize: options?.maxHistorySize || 1000,
    }
  );

  // Create enhanced orchestrator
  const orchestrator = new (await import("./enhanced-orchestrator")).EnhancedMexcOrchestrator(
    agentRegistry,
    workflowEngine,
    performanceCollector
  );

  // Note: Orchestrator initialization is now handled by the coordination manager
  // to ensure proper timing with agent registration (prevents workflow validation warnings)

  return {
    agentRegistry,
    workflowEngine,
    performanceCollector,
    orchestrator,
  };
}

// Utility function to register common agent types
export function registerCommonAgents(
  agentRegistry: import("./agent-registry").AgentRegistry,
  agentManager: {
    getMexcApiAgent: () => import("../base-agent").BaseAgent;
    getPatternDiscoveryAgent: () => import("../base-agent").BaseAgent;
    getCalendarAgent: () => import("../base-agent").BaseAgent;
    getSymbolAnalysisAgent: () => import("../base-agent").BaseAgent;
    getStrategyAgent: () => import("../base-agent").BaseAgent;
    getSimulationAgent: () => import("../base-agent").BaseAgent;
    getRiskManagerAgent: () => import("../base-agent").BaseAgent;
    getReconciliationAgent: () => import("../base-agent").BaseAgent;
    getErrorRecoveryAgent: () => import("../base-agent").BaseAgent;
  }
): void {
  // Build-safe logger - initialize inside function
  try {
    // Register core trading agents
    agentRegistry.registerAgent("mexc-api", agentManager.getMexcApiAgent(), {
      name: "MEXC API Agent",
      type: "api",
      dependencies: [],
      priority: 10,
      tags: ["core", "trading", "api"],
      capabilities: ["market_data", "trading", "account_info"],
    });

    agentRegistry.registerAgent("pattern-discovery", agentManager.getPatternDiscoveryAgent(), {
      name: "Pattern Discovery Agent",
      type: "analysis",
      dependencies: ["mexc-api"],
      priority: 8,
      tags: ["core", "analysis", "pattern"],
      capabilities: ["pattern_detection", "market_analysis", "signal_generation"],
    });

    agentRegistry.registerAgent("calendar", agentManager.getCalendarAgent(), {
      name: "Calendar Agent",
      type: "monitoring",
      dependencies: ["mexc-api"],
      priority: 7,
      tags: ["core", "monitoring", "calendar"],
      capabilities: ["listing_discovery", "launch_timing", "market_analysis"],
    });

    agentRegistry.registerAgent("symbol-analysis", agentManager.getSymbolAnalysisAgent(), {
      name: "Symbol Analysis Agent",
      type: "analysis",
      dependencies: ["mexc-api", "pattern-discovery"],
      priority: 8,
      tags: ["core", "analysis", "symbol"],
      capabilities: ["readiness_assessment", "risk_evaluation", "confidence_scoring"],
    });

    agentRegistry.registerAgent("strategy", agentManager.getStrategyAgent(), {
      name: "Strategy Agent",
      type: "strategy",
      dependencies: ["symbol-analysis"],
      priority: 6,
      tags: ["core", "strategy", "trading"],
      capabilities: ["strategy_creation", "risk_management", "position_sizing"],
    });

    // Register safety agents
    agentRegistry.registerAgent("simulation", agentManager.getSimulationAgent(), {
      name: "Simulation Agent",
      type: "safety",
      dependencies: [],
      priority: 9,
      tags: ["safety", "simulation", "testing"],
      capabilities: ["trade_simulation", "backtesting", "risk_assessment"],
    });

    agentRegistry.registerAgent("risk-manager", agentManager.getRiskManagerAgent(), {
      name: "Risk Manager Agent",
      type: "safety",
      dependencies: ["simulation"],
      priority: 10,
      tags: ["safety", "risk", "management"],
      capabilities: ["risk_monitoring", "position_limits", "stop_loss"],
    });

    agentRegistry.registerAgent("reconciliation", agentManager.getReconciliationAgent(), {
      name: "Reconciliation Agent",
      type: "safety",
      dependencies: [],
      priority: 5,
      tags: ["safety", "reconciliation", "audit"],
      capabilities: ["data_reconciliation", "trade_verification", "audit_trail"],
    });

    agentRegistry.registerAgent("error-recovery", agentManager.getErrorRecoveryAgent(), {
      name: "Error Recovery Agent",
      type: "safety",
      dependencies: [],
      priority: 9,
      tags: ["safety", "recovery", "monitoring"],
      capabilities: ["error_detection", "system_recovery", "health_monitoring"],
    });

    console.info("[Coordination] Registered 9 agents successfully");
  } catch (error) {
    console.error("[Coordination] Failed to register agents:", error);
    throw error;
  }
}

// Utility function to register agents and validate workflows
export function registerAgentsAndValidate(
  agentRegistry: import("./agent-registry").AgentRegistry,
  workflowEngine: import("./workflow-engine").WorkflowEngine,
  agentManager: {
    getMexcApiAgent: () => import("../base-agent").BaseAgent;
    getPatternDiscoveryAgent: () => import("../base-agent").BaseAgent;
    getCalendarAgent: () => import("../base-agent").BaseAgent;
    getSymbolAnalysisAgent: () => import("../base-agent").BaseAgent;
    getStrategyAgent: () => import("../base-agent").BaseAgent;
    getSimulationAgent: () => import("../base-agent").BaseAgent;
    getRiskManagerAgent: () => import("../base-agent").BaseAgent;
    getReconciliationAgent: () => import("../base-agent").BaseAgent;
    getErrorRecoveryAgent: () => import("../base-agent").BaseAgent;
  }
): void {
  // Register all agents first
  registerCommonAgents(agentRegistry, agentManager);

  // Then validate all registered workflows
  workflowEngine.validateRegisteredWorkflows();
}

// Utility function for graceful system shutdown
export async function shutdownCoordinationSystem(components: {
  agentRegistry: import("./agent-registry").AgentRegistry;
  workflowEngine: import("./workflow-engine").WorkflowEngine;
  performanceCollector: import("./performance-collector").PerformanceCollector;
  orchestrator: import("./enhanced-orchestrator").EnhancedMexcOrchestrator;
}): Promise<void> {
  // Build-safe logger - initialize inside function
  console.info("[Coordination] Initiating graceful shutdown...");

  try {
    // Shutdown orchestrator first (stops workflows)
    await components.orchestrator.shutdown();

    // Then shutdown individual components
    components.performanceCollector.destroy();
    components.agentRegistry.destroy();

    console.info("[Coordination] Graceful shutdown completed");
  } catch (error) {
    console.error("[Coordination] Shutdown error:", error);
    throw error;
  }
}

// Health check utility for the entire coordination system
export async function checkCoordinationSystemHealth(components: {
  agentRegistry: import("./agent-registry").AgentRegistry;
  workflowEngine: import("./workflow-engine").WorkflowEngine;
  performanceCollector: import("./performance-collector").PerformanceCollector;
  orchestrator: import("./enhanced-orchestrator").EnhancedMexcOrchestrator;
}): Promise<{
  overall: "healthy" | "degraded" | "unhealthy";
  agents: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  workflows: {
    running: number;
    total: number;
  };
  performance: {
    collecting: boolean;
    averageResponseTime: number;
    systemLoad: number;
  };
  orchestrator: boolean;
}> {
  // Build-safe logger - initialize inside function
  try {
    const registryStats = components.agentRegistry.getStats();
    const runningWorkflows = components.workflowEngine.getRunningWorkflows();
    const workflowHistory = components.workflowEngine.getExecutionHistory(100);
    const performanceSummary = components.performanceCollector.getCurrentSummary();
    const orchestratorHealth = await components.orchestrator.healthCheck();

    // Determine overall health
    const healthyRatio =
      registryStats.totalAgents > 0 ? registryStats.healthyAgents / registryStats.totalAgents : 0;

    let overall: "healthy" | "degraded" | "unhealthy";
    if (healthyRatio >= 0.8 && orchestratorHealth) {
      overall = "healthy";
    } else if (healthyRatio >= 0.5 && orchestratorHealth) {
      overall = "degraded";
    } else {
      overall = "unhealthy";
    }

    return {
      overall,
      agents: {
        total: registryStats.totalAgents,
        healthy: registryStats.healthyAgents,
        degraded: registryStats.degradedAgents,
        unhealthy: registryStats.unhealthyAgents,
      },
      workflows: {
        running: runningWorkflows.length,
        total: workflowHistory.length,
      },
      performance: {
        collecting: true, // Would need proper check
        averageResponseTime: performanceSummary.system.avgResponseTime,
        systemLoad: performanceSummary.system.throughput,
      },
      orchestrator: orchestratorHealth,
    };
  } catch (error) {
    console.error("[Coordination] Health check failed:", error);
    return {
      overall: "unhealthy",
      agents: { total: 0, healthy: 0, degraded: 0, unhealthy: 0 },
      workflows: { running: 0, total: 0 },
      performance: { collecting: false, averageResponseTime: 0, systemLoad: 0 },
      orchestrator: false,
    };
  }
}
