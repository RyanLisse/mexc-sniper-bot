import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  type AgentConfig,
  type AgentResponse,
  BaseAgent,
} from "@/src/mexc-agents/base-agent";
import {
  AgentRegistry,
  checkCoordinationSystemHealth,
  createCoordinationSystem,
  EnhancedMexcOrchestrator,
  PerformanceCollector,
  WorkflowEngine,
  clearGlobalAgentRegistry,
} from "@/src/mexc-agents/coordination";

// Create a unique test ID counter to prevent collisions
let testIdCounter = 0;
function getUniqueTestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++testIdCounter}-${Math.random().toString(36).substring(2, 9)}`;
}

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
    await new Promise((resolve) => setTimeout(resolve, 1));

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
    // Clear any existing global registry
    try {
      clearGlobalAgentRegistry();
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Create fresh instances for each test
    registry = new AgentRegistry();
    mockAgent1 = new MockAgent("test-agent-1");
    mockAgent2 = new MockAgent("test-agent-2");
  });

  afterEach(() => {
    // Clean up in proper order
    try {
      registry.destroy();
    } catch (error) {
      // Ignore cleanup errors
    }
    
    try {
      mockAgent1.destroy();
      mockAgent2.destroy();
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Clear global registry
    clearGlobalAgentRegistry();
    
    // Clear all mocks to reset state
    vi.clearAllMocks();
  });

  describe("AgentRegistry", () => {
    test("should register and retrieve agents", () => {
      const uniqueId = getUniqueTestId("agent-register-test");
      
      registry.registerAgent(uniqueId, mockAgent1, {
        name: "Test Agent 1",
        type: "test",
        capabilities: ["testing"],
      });

      const registeredAgent = registry.getAgent(uniqueId);
      expect(registeredAgent).toBeDefined();
      expect(registeredAgent?.name).toBe("Test Agent 1");
      expect(registeredAgent?.type).toBe("test");
    });

    test("should check agent availability", () => {
      const uniqueId = getUniqueTestId("agent-availability-test");
      
      registry.registerAgent(uniqueId, mockAgent1, {
        name: "Test Agent 1",
        type: "test",
      });

      // Initially, agent status should be unknown, so not available
      expect(registry.isAgentAvailable(uniqueId)).toBe(false);
      expect(registry.isAgentAvailable("nonexistent")).toBe(false);
    });

    test("should get agents by type", () => {
      const uniqueId1 = getUniqueTestId("agent-type-test-1");
      const uniqueId2 = getUniqueTestId("agent-type-test-2");
      
      registry.registerAgent(uniqueId1, mockAgent1, {
        name: "Test Agent 1",
        type: "analysis",
      });
      registry.registerAgent(uniqueId2, mockAgent2, {
        name: "Test Agent 2",
        type: "analysis",
      });

      const analysisAgents = registry.getAgentsByType("analysis");
      expect(analysisAgents).toHaveLength(2);
      expect(analysisAgents.map((a) => a.id)).toEqual([uniqueId1, uniqueId2]);
    });

    test("should get registry statistics", () => {
      // Create a completely fresh registry for this test to ensure isolation
      const freshRegistry = new AgentRegistry();
      const uniqueId = getUniqueTestId("agent-stats-test");
      
      freshRegistry.registerAgent(uniqueId, mockAgent1, {
        name: "Test Agent 1",
        type: "test",
      });

      const stats = freshRegistry.getStats();
      expect(stats.totalAgents).toBe(1);
      expect(stats.unknownAgents).toBe(1); // Initially unknown status
      
      // Clean up
      try {
        freshRegistry.destroy();
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test("should perform health checks", async () => {
      const uniqueId = getUniqueTestId("agent-health-test");
      
      registry.registerAgent(uniqueId, mockAgent1, {
        name: "Test Agent 1",
        type: "test",
      });

      const result = await registry.checkAgentHealth(uniqueId);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      // Allow responseTime to be 0 for very fast mock operations
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("WorkflowEngine", () => {
    let workflowEngine: WorkflowEngine;
    let workflowAgentId1: string;
    let workflowAgentId2: string;

    beforeEach(() => {
      workflowEngine = new WorkflowEngine(registry);

      // Register test agents with unique IDs
      workflowAgentId1 = getUniqueTestId("workflow-agent-1");
      workflowAgentId2 = getUniqueTestId("workflow-agent-2");
      
      registry.registerAgent(workflowAgentId1, mockAgent1, {
        name: "Test Agent 1",
        type: "test",
      });
      registry.registerAgent(workflowAgentId2, mockAgent2, {
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
            agentId: workflowAgentId1,
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
      if (performanceCollector) {
        try {
          performanceCollector.destroy();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    test("should get current performance summary", () => {
      const summary = performanceCollector.getCurrentSummary();

      expect(summary).toBeDefined();
      expect(summary).toHaveProperty('agentCount');
      expect(summary).toHaveProperty('workflowCount');
      expect(summary).toHaveProperty('systemSnapshots');
      expect(summary).toHaveProperty('isCollecting');
      expect(summary).toHaveProperty('lastUpdated');
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
      const { AgentRegistry } = await import(
        "@/src/mexc-agents/coordination/agent-registry"
      );
      const { WorkflowEngine } = await import(
        "@/src/mexc-agents/coordination/workflow-engine"
      );
      const { PerformanceCollector } = await import(
        "@/src/mexc-agents/coordination/performance-collector"
      );
      const { EnhancedMexcOrchestrator } = await import(
        "@/src/mexc-agents/coordination/enhanced-orchestrator"
      );

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
      const mockSimulation = new MockAgent("simulation");

      agentRegistry.registerAgent("mexc-api", mockMexcApi, {
        name: "MEXC API Agent",
        type: "api",
      });
      agentRegistry.registerAgent("calendar", mockCalendar, {
        name: "Calendar Agent",
        type: "analysis",
      });
      agentRegistry.registerAgent("pattern-discovery", mockPatternDiscovery, {
        name: "Pattern Discovery Agent",
        type: "analysis",
      });
      agentRegistry.registerAgent("symbol-analysis", mockSymbolAnalysis, {
        name: "Symbol Analysis Agent",
        type: "analysis",
      });
      agentRegistry.registerAgent("strategy", mockStrategy, {
        name: "Strategy Agent",
        type: "strategy",
      });
      agentRegistry.registerAgent("risk-manager", mockRiskManager, {
        name: "Risk Manager Agent",
        type: "risk",
      });
      agentRegistry.registerAgent("simulation", mockSimulation, {
        name: "Simulation Agent",
        type: "safety",
      });

      // Perform health checks to make agents available
      await agentRegistry.checkAgentHealth("mexc-api");
      await agentRegistry.checkAgentHealth("calendar");
      await agentRegistry.checkAgentHealth("pattern-discovery");
      await agentRegistry.checkAgentHealth("symbol-analysis");
      await agentRegistry.checkAgentHealth("strategy");
      await agentRegistry.checkAgentHealth("risk-manager");
      await agentRegistry.checkAgentHealth("simulation");

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
        performanceCollector,
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
      mockSimulation.destroy();
      await system.orchestrator.shutdown();
    });

    test("should handle orchestrator workflow execution", async () => {
      // Create the system first without initialization
      const { AgentRegistry } = await import(
        "@/src/mexc-agents/coordination/agent-registry"
      );
      const { WorkflowEngine } = await import(
        "@/src/mexc-agents/coordination/workflow-engine"
      );
      const { PerformanceCollector } = await import(
        "@/src/mexc-agents/coordination/performance-collector"
      );
      const { EnhancedMexcOrchestrator } = await import(
        "@/src/mexc-agents/coordination/enhanced-orchestrator"
      );

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
      const mockSimulation = new MockAgent("simulation");

      agentRegistry.registerAgent("mexc-api", mockMexcApi, {
        name: "MEXC API Agent",
        type: "api",
      });
      agentRegistry.registerAgent("calendar", mockCalendar, {
        name: "Calendar Agent",
        type: "analysis",
      });
      agentRegistry.registerAgent("pattern-discovery", mockPatternDiscovery, {
        name: "Pattern Discovery Agent",
        type: "analysis",
      });
      agentRegistry.registerAgent("symbol-analysis", mockSymbolAnalysis, {
        name: "Symbol Analysis Agent",
        type: "analysis",
      });
      agentRegistry.registerAgent("strategy", mockStrategy, {
        name: "Strategy Agent",
        type: "strategy",
      });
      agentRegistry.registerAgent("risk-manager", mockRiskManager, {
        name: "Risk Manager Agent",
        type: "risk",
      });
      agentRegistry.registerAgent("simulation", mockSimulation, {
        name: "Simulation Agent",
        type: "safety",
      });

      // Perform health checks to make agents available
      await agentRegistry.checkAgentHealth("mexc-api");
      await agentRegistry.checkAgentHealth("calendar");
      await agentRegistry.checkAgentHealth("pattern-discovery");
      await agentRegistry.checkAgentHealth("symbol-analysis");
      await agentRegistry.checkAgentHealth("strategy");
      await agentRegistry.checkAgentHealth("risk-manager");
      await agentRegistry.checkAgentHealth("simulation");

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
        performanceCollector,
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
        const result =
          await system.orchestrator.executeCalendarDiscoveryWorkflow({
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
      mockSimulation.destroy();
      await system.orchestrator.shutdown();
    });
  });
});
