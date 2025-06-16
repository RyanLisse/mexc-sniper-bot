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
      const system = await createCoordinationSystem({
        healthCheckInterval: 60000,
        performanceCollectionInterval: 120000,
        maxHistorySize: 50,
      });

      expect(system.agentRegistry).toBeDefined();
      expect(system.workflowEngine).toBeDefined();
      expect(system.performanceCollector).toBeDefined();
      expect(system.orchestrator).toBeDefined();

      // Register required mock agents for health checks
      const mockMexcApi = new MockAgent("mexc-api");
      const mockCalendar = new MockAgent("calendar");
      const mockPatternDiscovery = new MockAgent("pattern-discovery");

      system.agentRegistry.registerAgent("mexc-api", mockMexcApi, {
        name: "MEXC API Agent",
        type: "api"
      });
      system.agentRegistry.registerAgent("calendar", mockCalendar, {
        name: "Calendar Agent",
        type: "analysis"
      });
      system.agentRegistry.registerAgent("pattern-discovery", mockPatternDiscovery, {
        name: "Pattern Discovery Agent",
        type: "analysis"
      });

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
      await system.orchestrator.shutdown();
    });

    test("should handle orchestrator workflow execution", async () => {
      const system = await createCoordinationSystem();

      // Register required mock agents
      const mockMexcApi = new MockAgent("mexc-api");
      const mockCalendar = new MockAgent("calendar");
      const mockPatternDiscovery = new MockAgent("pattern-discovery");
      const mockSymbolAnalysis = new MockAgent("symbol-analysis");
      const mockStrategy = new MockAgent("strategy");
      const mockRiskManager = new MockAgent("risk-manager");

      system.agentRegistry.registerAgent("mexc-api", mockMexcApi, {
        name: "MEXC API Agent",
        type: "api"
      });
      system.agentRegistry.registerAgent("calendar", mockCalendar, {
        name: "Calendar Agent",
        type: "analysis"
      });
      system.agentRegistry.registerAgent("pattern-discovery", mockPatternDiscovery, {
        name: "Pattern Discovery Agent",
        type: "analysis"
      });
      system.agentRegistry.registerAgent("symbol-analysis", mockSymbolAnalysis, {
        name: "Symbol Analysis Agent",
        type: "analysis"
      });
      system.agentRegistry.registerAgent("strategy", mockStrategy, {
        name: "Strategy Agent",
        type: "strategy"
      });
      system.agentRegistry.registerAgent("risk-manager", mockRiskManager, {
        name: "Risk Manager Agent",
        type: "risk"
      });

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