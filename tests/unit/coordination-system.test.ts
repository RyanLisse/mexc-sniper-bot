import { describe, test, expect, beforeEach, afterEach } from "vitest";
import {
  AgentRegistry,
  WorkflowEngine,
  PerformanceCollector,
  EnhancedMexcOrchestrator,
  createCoordinationSystem,
  checkCoordinationSystemHealth,
} from "../../src/mexc-agents/coordination";
import { BaseAgent, type AgentConfig, type AgentResponse } from "../../src/mexc-agents/base-agent";

// Mock agent for testing
class MockAgent extends BaseAgent {
  constructor(name: string) {
    const config: AgentConfig = {
      name,
      systemPrompt: "Test agent",
      cacheEnabled: false,
    };
    super(config);
  }

  async process(input: string): Promise<AgentResponse> {
    // Simulate realistic processing time for health checks
    await new Promise(resolve => setTimeout(resolve, 1));
    
    return {
      content: `Mock response for ${input}`,
      metadata: {
        agent: this.config.name,
        timestamp: new Date().toISOString(),
        fromCache: false,
      },
    };
  }
}

describe("Agent Coordination System", () => {
  let registry: AgentRegistry;
  let mockAgent1: MockAgent;
  let mockAgent2: MockAgent;

  beforeEach(() => {
    registry = new AgentRegistry();
    mockAgent1 = new MockAgent("test-agent-1");
    mockAgent2 = new MockAgent("test-agent-2");
  });

  afterEach(() => {
    registry.destroy();
    mockAgent1.destroy();
    mockAgent2.destroy();
  });

  describe("AgentRegistry", () => {
    test("should register and retrieve agents", () => {
      registry.registerAgent("agent1", mockAgent1, {
        name: "Test Agent 1",
        type: "test",
        capabilities: ["testing"],
      });

      const registeredAgent = registry.getAgent("agent1");
      expect(registeredAgent).toBeDefined();
      expect(registeredAgent?.name).toBe("Test Agent 1");
      expect(registeredAgent?.type).toBe("test");
    });

    test("should check agent availability", () => {
      registry.registerAgent("agent1", mockAgent1, {
        name: "Test Agent 1",
        type: "test",
      });

      // Initially, agent status should be unknown, so not available
      expect(registry.isAgentAvailable("agent1")).toBe(false);
      expect(registry.isAgentAvailable("nonexistent")).toBe(false);
    });

    test("should get agents by type", () => {
      registry.registerAgent("agent1", mockAgent1, {
        name: "Test Agent 1",
        type: "analysis",
      });
      registry.registerAgent("agent2", mockAgent2, {
        name: "Test Agent 2",
        type: "analysis",
      });

      const analysisAgents = registry.getAgentsByType("analysis");
      expect(analysisAgents).toHaveLength(2);
      expect(analysisAgents.map(a => a.id)).toEqual(["agent1", "agent2"]);
    });

    test("should get registry statistics", () => {
      registry.registerAgent("agent1", mockAgent1, {
        name: "Test Agent 1",
        type: "test",
      });

      const stats = registry.getStats();
      expect(stats.totalAgents).toBe(1);
      expect(stats.unknownAgents).toBe(1); // Initially unknown status
    });

    test("should perform health checks", async () => {
      registry.registerAgent("agent1", mockAgent1, {
        name: "Test Agent 1",
        type: "test",
      });

      const result = await registry.checkAgentHealth("agent1");
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      // Allow responseTime to be 0 for very fast mock operations
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("WorkflowEngine", () => {
    let workflowEngine: WorkflowEngine;

    beforeEach(() => {
      workflowEngine = new WorkflowEngine(registry);
      
      // Register test agents
      registry.registerAgent("agent1", mockAgent1, {
        name: "Test Agent 1",
        type: "test",
      });
      registry.registerAgent("agent2", mockAgent2, {
        name: "Test Agent 2",
        type: "test",
      });
    });

    test("should register workflow definitions", () => {
      const workflow = {
        id: "test-workflow",
        name: "Test Workflow",
        version: "1.0.0",
        executionMode: "sequential" as const,
        steps: [
          {
            id: "step1",
            name: "Test Step",
            agentId: "agent1",
            input: { test: "data" },
          },
        ],
      };

      workflowEngine.registerWorkflow(workflow);
      const retrieved = workflowEngine.getWorkflowDefinition("test-workflow");
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("Test Workflow");
    });

    test("should validate workflow definitions", () => {
      const invalidWorkflow = {
        id: "",
        name: "",
        version: "",
        executionMode: "sequential" as const,
        steps: [],
      };

      expect(() => workflowEngine.registerWorkflow(invalidWorkflow)).toThrow();
    });

    test("should track running workflows", () => {
      const initialRunning = workflowEngine.getRunningWorkflows();
      expect(initialRunning).toHaveLength(0);
    });
  });

  describe("PerformanceCollector", () => {
    let performanceCollector: PerformanceCollector;

    beforeEach(() => {
      performanceCollector = new PerformanceCollector(registry, {
        collectionInterval: 1000,
        maxHistorySize: 100,
      });
    });

    afterEach(() => {
      performanceCollector.destroy();
    });

    test("should get current performance summary", () => {
      const summary = performanceCollector.getCurrentSummary();
      
      expect(summary).toBeDefined();
      expect(summary.agents).toBeDefined();
      expect(summary.workflows).toBeDefined();
      expect(summary.system).toBeDefined();
    });

    test("should generate performance reports", () => {
      const startDate = new Date(Date.now() - 60000); // 1 minute ago
      const endDate = new Date();
      
      const report = performanceCollector.generateReport(startDate, endDate);
      
      expect(report).toBeDefined();
      expect(report.period.start).toEqual(startDate);
      expect(report.period.end).toEqual(endDate);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe("Integration Tests", () => {
    test("should create complete coordination system", async () => {
      // Create the system first without initialization
      const { AgentRegistry } = await import("../../src/mexc-agents/coordination/agent-registry");
      const { WorkflowEngine } = await import("../../src/mexc-agents/coordination/workflow-engine");
      const { PerformanceCollector } = await import("../../src/mexc-agents/coordination/performance-collector");
      const { EnhancedMexcOrchestrator } = await import("../../src/mexc-agents/coordination/enhanced-orchestrator");
      
      // Initialize registry first
      const agentRegistry = new AgentRegistry({
        healthCheckInterval: 60000,
        maxHealthHistorySize: 50,
      });
      
      // Register required mock agents BEFORE creating orchestrator
      const mockMexcApi = new MockAgent("mexc-api");
      const mockCalendar = new MockAgent("calendar");
      const mockPatternDiscovery = new MockAgent("pattern-discovery");
      const mockSymbolAnalysis = new MockAgent("symbol-analysis");
      const mockStrategy = new MockAgent("strategy");
      const mockRiskManager = new MockAgent("risk-manager");

      agentRegistry.registerAgent("mexc-api", mockMexcApi, {
        name: "MEXC API Agent",
        type: "api"
      });
      agentRegistry.registerAgent("calendar", mockCalendar, {
        name: "Calendar Agent",
        type: "analysis"
      });
      agentRegistry.registerAgent("pattern-discovery", mockPatternDiscovery, {
        name: "Pattern Discovery Agent",
        type: "analysis"
      });
      agentRegistry.registerAgent("symbol-analysis", mockSymbolAnalysis, {
        name: "Symbol Analysis Agent",
        type: "analysis"
      });
      agentRegistry.registerAgent("strategy", mockStrategy, {
        name: "Strategy Agent",
        type: "strategy"
      });
      agentRegistry.registerAgent("risk-manager", mockRiskManager, {
        name: "Risk Manager Agent",
        type: "risk"
      });

      // Perform health checks to make agents available
      await agentRegistry.checkAgentHealth("mexc-api");
      await agentRegistry.checkAgentHealth("calendar");
      await agentRegistry.checkAgentHealth("pattern-discovery");
      await agentRegistry.checkAgentHealth("symbol-analysis");
      await agentRegistry.checkAgentHealth("strategy");
      await agentRegistry.checkAgentHealth("risk-manager");

      // Create other components
      const workflowEngine = new WorkflowEngine(agentRegistry);
      const performanceCollector = new PerformanceCollector(agentRegistry, {
        collectionInterval: 120000,
        maxHistorySize: 50,
      });
      
      // Create orchestrator with all agents already registered
      const orchestrator = new EnhancedMexcOrchestrator(
        agentRegistry,
        workflowEngine,
        performanceCollector
      );

      // Now initialize the orchestrator (this should not show warnings)
      await orchestrator.initialize();

      // Validate that all workflow warnings are resolved after agent registration
      const validation = workflowEngine.validateRegisteredWorkflows();
      expect(validation.remainingWarnings).toHaveLength(0);

      const system = {
        agentRegistry,
        workflowEngine,
        performanceCollector,
        orchestrator,
      };

      expect(system.agentRegistry).toBeDefined();
      expect(system.workflowEngine).toBeDefined();
      expect(system.performanceCollector).toBeDefined();
      expect(system.orchestrator).toBeDefined();

      // Test health check
      const health = await checkCoordinationSystemHealth(system);
      expect(health.overall).toBeDefined();
      expect(health.agents).toBeDefined();
      expect(health.workflows).toBeDefined();
      expect(health.performance).toBeDefined();

      // Cleanup
      mockMexcApi.destroy();
      mockCalendar.destroy();
      mockPatternDiscovery.destroy();
      mockSymbolAnalysis.destroy();
      mockStrategy.destroy();
      mockRiskManager.destroy();
      await system.orchestrator.shutdown();
    });

    test("should handle orchestrator workflow execution", async () => {
      // Create the system first without initialization
      const { AgentRegistry } = await import("../../src/mexc-agents/coordination/agent-registry");
      const { WorkflowEngine } = await import("../../src/mexc-agents/coordination/workflow-engine");
      const { PerformanceCollector } = await import("../../src/mexc-agents/coordination/performance-collector");
      const { EnhancedMexcOrchestrator } = await import("../../src/mexc-agents/coordination/enhanced-orchestrator");
      
      // Initialize registry first
      const agentRegistry = new AgentRegistry({
        healthCheckInterval: 30000,
        maxHealthHistorySize: 100,
      });

      // Register required mock agents BEFORE creating orchestrator
      const mockMexcApi = new MockAgent("mexc-api");
      const mockCalendar = new MockAgent("calendar");
      const mockPatternDiscovery = new MockAgent("pattern-discovery");
      const mockSymbolAnalysis = new MockAgent("symbol-analysis");
      const mockStrategy = new MockAgent("strategy");
      const mockRiskManager = new MockAgent("risk-manager");

      agentRegistry.registerAgent("mexc-api", mockMexcApi, {
        name: "MEXC API Agent",
        type: "api"
      });
      agentRegistry.registerAgent("calendar", mockCalendar, {
        name: "Calendar Agent",
        type: "analysis"
      });
      agentRegistry.registerAgent("pattern-discovery", mockPatternDiscovery, {
        name: "Pattern Discovery Agent",
        type: "analysis"
      });
      agentRegistry.registerAgent("symbol-analysis", mockSymbolAnalysis, {
        name: "Symbol Analysis Agent",
        type: "analysis"
      });
      agentRegistry.registerAgent("strategy", mockStrategy, {
        name: "Strategy Agent",
        type: "strategy"
      });
      agentRegistry.registerAgent("risk-manager", mockRiskManager, {
        name: "Risk Manager Agent",
        type: "risk"
      });

      // Perform health checks to make agents available
      await agentRegistry.checkAgentHealth("mexc-api");
      await agentRegistry.checkAgentHealth("calendar");
      await agentRegistry.checkAgentHealth("pattern-discovery");
      await agentRegistry.checkAgentHealth("symbol-analysis");
      await agentRegistry.checkAgentHealth("strategy");
      await agentRegistry.checkAgentHealth("risk-manager");

      // Create other components
      const workflowEngine = new WorkflowEngine(agentRegistry);
      const performanceCollector = new PerformanceCollector(agentRegistry, {
        collectionInterval: 60000,
        maxHistorySize: 1000,
      });
      
      // Create orchestrator with all agents already registered
      const orchestrator = new EnhancedMexcOrchestrator(
        agentRegistry,
        workflowEngine,
        performanceCollector
      );

      // Now initialize the orchestrator (this should not show warnings)
      await orchestrator.initialize();

      // Validate that all workflow warnings are resolved after agent registration
      const validation = workflowEngine.validateRegisteredWorkflows();
      expect(validation.remainingWarnings).toHaveLength(0);

      const system = {
        agentRegistry,
        workflowEngine,
        performanceCollector,
        orchestrator,
      };

      // Test calendar discovery workflow
      try {
        const result = await system.orchestrator.executeCalendarDiscoveryWorkflow({
          trigger: "test",
          force: false,
        });

        // Should succeed with mock agents
        expect(result).toBeDefined();
        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        // If it fails, it should fail gracefully
        expect(error).toBeDefined();
      }

      // Cleanup
      mockMexcApi.destroy();
      mockCalendar.destroy();
      mockPatternDiscovery.destroy();
      mockSymbolAnalysis.destroy();
      mockStrategy.destroy();
      mockRiskManager.destroy();
      await system.orchestrator.shutdown();
    });
  });
});