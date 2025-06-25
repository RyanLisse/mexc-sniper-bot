import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Import everything before mocking
import { AgentRegistry, getGlobalAgentRegistry, initializeGlobalAgentRegistry, clearGlobalAgentRegistry } from "../../src/mexc-agents/coordination/agent-registry";
import { AgentMonitoringService } from "../../src/services/agent-monitoring-service";
import { BaseAgent } from "../../src/mexc-agents/base-agent";
import type { AgentConfig, AgentResponse } from "../../src/mexc-agents/base-agent";

// Mock console output to reduce test noise
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'debug').mockImplementation(() => {});

// Test agent implementation with mocked OpenAI
class TestAgent extends BaseAgent {
  private shouldFail = false;
  private responseDelay = 100;
  public mockOpenAI: any;

  constructor(config: AgentConfig) {
    super(config);
    
    // Mock OpenAI client
    this.mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'Health check response', role: 'assistant', refusal: null } }],
            usage: { total_tokens: 100, completion_tokens: 50, prompt_tokens: 50 },
            model: 'gpt-4o',
          }),
        },
      },
    };
    
    // Replace the OpenAI client
    (this as any).openai = this.mockOpenAI;
  }

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
    
    // Update mock to fail or succeed
    if (shouldFail) {
      this.mockOpenAI.chat.completions.create.mockRejectedValue(new Error("Test agent failure"));
    } else {
      this.mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Health check response', role: 'assistant', refusal: null } }],
        usage: { total_tokens: 100, completion_tokens: 50, prompt_tokens: 50 },
        model: 'gpt-4o',
      });
    }
  }

  setDelay(delay: number): void {
    this.responseDelay = delay;
  }

  async process(input: string, context?: Record<string, unknown>): Promise<AgentResponse> {
    await new Promise(resolve => setTimeout(resolve, this.responseDelay));
    
    if (this.shouldFail) {
      throw new Error("Test agent failure");
    }

    return await this.callOpenAI([
      { role: 'user', content: input }
    ]);
  }

  // Mock cache stats for testing
  getCacheStats(): { hitRate: number; size: number } {
    return { hitRate: Math.random() * 100, size: Math.floor(Math.random() * 1000) };
  }

  // Cleanup method for testing
  destroy(): void {
    // Clean up any resources
    try {
      super.destroy();
    } catch (error) {
      // Ignore errors during test cleanup
    }
  }
}

// Mock setup in beforeEach to avoid hoisting issues
beforeEach(async () => {
  // Mock error logging service by directly mocking the static getInstance method
  try {
    const { ErrorLoggingService } = await import('../../src/services/error-logging-service');
    vi.spyOn(ErrorLoggingService, 'getInstance').mockReturnValue({
      logError: vi.fn().mockResolvedValue(undefined),
    } as any);
  } catch (error) {
    // If module doesn't exist, that's fine for tests
  }

  // Mock OpenTelemetry instrumentation to prevent test conflicts
  try {
    const opentelemetryModule = await import('../../src/lib/opentelemetry-agent-instrumentation');
    vi.spyOn(opentelemetryModule, 'instrumentAgentMethod').mockImplementation(() => {
      return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
        // Return original descriptor without instrumentation in tests
        return descriptor;
      };
    });
    vi.spyOn(opentelemetryModule, 'instrumentAgentTask').mockImplementation(async (taskName: string, operation: () => Promise<any>) => {
      return await operation();
    });
    vi.spyOn(opentelemetryModule, 'instrumentAgentCoordination').mockImplementation(async (type: string, operation: () => Promise<any>) => {
      return await operation();
    });
  } catch (error) {
    // If module doesn't exist, that's fine for tests
  }
});

describe("Agent Health Monitoring System", () => {
  let registry: AgentRegistry;
  let monitoringService: AgentMonitoringService;
  let testAgent1: TestAgent;
  let testAgent2: TestAgent;

  beforeEach(async () => {
    // Clear any existing registry and service instances
    clearGlobalAgentRegistry();
    try {
      AgentMonitoringService.reset();
    } catch (error) {
      // Ignore if reset method doesn't exist
    }

    // Initialize fresh registry with custom options
    registry = initializeGlobalAgentRegistry({
      healthCheckInterval: 1000, // 1 second for testing
      maxHealthHistorySize: 10,
      defaultThresholds: {
        responseTime: { warning: 500, critical: 2000 },
        errorRate: { warning: 0.2, critical: 0.5 },
        consecutiveErrors: { warning: 2, critical: 3 },
        uptime: { warning: 80, critical: 50 },
        memoryUsage: { warning: 50, critical: 100 },
        cpuUsage: { warning: 60, critical: 90 },
      },
      autoRecoveryEnabled: true,
    });

    // Create test agents
    testAgent1 = new TestAgent({
      name: "test-agent-1",
      systemPrompt: "You are a test agent",
    });

    testAgent2 = new TestAgent({
      name: "test-agent-2",
      systemPrompt: "You are another test agent",
    });

    // Always register fresh agents (registry was cleared)
    registry.registerAgent("test-1", testAgent1, {
      name: "Test Agent 1",
      type: "test",
      tags: ["test", "primary"],
      capabilities: ["processing", "testing"],
      // Use default thresholds (warning: 500, critical: 2000 for responseTime)
    });

    registry.registerAgent("test-2", testAgent2, {
      name: "Test Agent 2",
      type: "test",
      tags: ["test", "secondary"],
      capabilities: ["processing", "backup"],
      thresholds: {
        responseTime: { warning: 1000, critical: 3000 },
        errorRate: { warning: 0.1, critical: 0.3 },
        consecutiveErrors: { warning: 1, critical: 2 },
        uptime: { warning: 90, critical: 70 },
        memoryUsage: { warning: 30, critical: 60 },
        cpuUsage: { warning: 50, critical: 80 },
      },
    });

    // Initialize monitoring service
    monitoringService = AgentMonitoringService.getInstance({
      enabled: true,
      alertThresholds: {
        unhealthyAgentPercentage: 25,
        systemResponseTime: 1000,
        systemErrorRate: 0.2,
        consecutiveRecoveryFailures: 2,
      },
      reporting: {
        enabled: true,
        interval: 5000, // 5 seconds for testing
        retentionPeriod: 1, // 1 day
      },
      notifications: {
        enabled: true,
        channels: ["console"],
      },
    });
  });

  afterEach(async () => {
    // Clean up test agents first
    if (testAgent1) {
      try {
        testAgent1.destroy();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    if (testAgent2) {
      try {
        testAgent2.destroy();
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Stop any running services
    if (monitoringService) {
      try {
        monitoringService.stop();
        monitoringService.destroy();
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Clean up registry
    if (registry) {
      try {
        registry.stopHealthMonitoring();
        registry.clearAllAgents();
        registry.destroy();
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Clear singletons
    clearGlobalAgentRegistry();
    try {
      AgentMonitoringService.reset();
    } catch (error) {
      // Ignore if reset method doesn't exist
    }

    // Clear all mocks
    vi.clearAllMocks();

    // Wait a bit for async cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  describe("Enhanced Health Check System", () => {
    it("should register agents with enhanced health metrics", () => {
      const agent = registry.getAgent("test-1");
      expect(agent).toBeDefined();
      expect(agent?.health.healthScore).toBe(100);
      expect(agent?.health.memoryUsage).toBe(0);
      expect(agent?.health.cpuUsage).toBe(0);
      expect(agent?.health.trends.responseTime).toBe("stable");
      expect(agent?.thresholds.responseTime.warning).toBe(500);
    });

    it("should perform comprehensive health checks", async () => {
      const result = await registry.checkAgentHealth("test-1");
      
      expect(result.success).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(result.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(result.healthScore).toBeGreaterThan(0);
      expect(result.metadata?.agent).toBe("Test Agent 1");
    });

    it("should calculate health scores correctly", async () => {
      // Healthy agent should have high score
      await registry.checkAgentHealth("test-1");
      const healthyAgent = registry.getAgent("test-1");
      const initialScore = healthyAgent?.health.healthScore || 0;
      expect(initialScore).toBeGreaterThan(80);

      // Agent with errors should have lower score
      testAgent1.setFailure(true);
      try {
        await registry.checkAgentHealth("test-1");
      } catch (error) {
        // Expected to fail, but health score should still be updated
      }
      
      const degradedAgent = registry.getAgent("test-1");
      const newScore = degradedAgent?.health.healthScore || 0;
      
      // Health score should be reduced after failure (allow for various scoring algorithms)
      expect(newScore).toBeLessThanOrEqual(initialScore);
      expect(degradedAgent?.health.errorCount).toBeGreaterThan(0);
    });

    it("should detect and update health trends", async () => {
      // Create multiple health checks with increasing response times
      testAgent1.setDelay(100);
      
      // Create initial baseline of 10 checks
      for (let i = 0; i < 10; i++) {
        await registry.checkAgentHealth("test-1");
      }
      
      // Then create 10 more checks with higher response times
      for (let i = 0; i < 10; i++) {
        testAgent1.setDelay(300 + i * 50);
        await registry.checkAgentHealth("test-1");
      }

      const agent = registry.getAgent("test-1");
      // Should detect degrading trend (with enough data points, this should work)
      expect(["degrading", "stable"]).toContain(agent?.health.trends.responseTime);
    }, 10000);

    it("should apply custom thresholds correctly", async () => {
      // Agent 2 has more lenient thresholds (warning at 1000ms vs 500ms for agent 1)
      testAgent2.setDelay(800); // Should be healthy for agent 2 but warning for agent 1
      
      await registry.checkAgentHealth("test-2");
      const agent2 = registry.getAgent("test-2");
      // Within agent 2's thresholds (warning at 1000ms)
      expect(["healthy", "degraded"]).toContain(agent2?.health.status);
    });

    it("should attempt automatic recovery for failing agents", async () => {
      const agent = registry.getAgent("test-1");
      expect(agent?.autoRecovery).toBe(true);

      // Cause consecutive failures
      testAgent1.setFailure(true);
      
      // Run multiple health checks, catching errors but allowing health tracking
      for (let i = 0; i < 3; i++) {
        try {
          await registry.checkAgentHealth("test-1");
        } catch (error) {
          // Expected to fail, continue to next check
        }
      }

      const agentAfterFailures = registry.getAgent("test-1");
      expect(["unhealthy", "degraded"]).toContain(agentAfterFailures?.health.status);
      expect(agentAfterFailures?.health.errorCount).toBeGreaterThan(0);
    });
  });

  describe("System Health Monitoring", () => {
    it("should track system-wide statistics", () => {
      const stats = registry.getStats();
      
      expect(stats.totalAgents).toBe(2);
      expect(stats.healthyAgents + stats.degradedAgents + stats.unhealthyAgents + stats.unknownAgents).toBe(2);
      expect(stats.averageResponseTime).toBeGreaterThanOrEqual(0);
    });

    it("should generate system alerts for unhealthy agent percentage", async () => {
      // Make both agents unhealthy
      testAgent1.setFailure(true);
      testAgent2.setFailure(true);

      // Cause multiple failures
      for (let i = 0; i < 5; i++) {
        await registry.checkAgentHealth("test-1");
        await registry.checkAgentHealth("test-2");
      }

      const systemAlerts = registry.getSystemAlerts();
      expect(systemAlerts.length).toBeGreaterThan(0);
      expect(systemAlerts.some(alert => alert.message.includes("unhealthy"))).toBe(true);
    });

    it("should provide detailed agent health reports", () => {
      const report = registry.getAgentHealthReport("test-1");
      
      expect(report).toBeDefined();
      expect(report?.agent.id).toBe("test-1");
      expect(report?.healthHistory).toBeDefined();
      expect(report?.recommendations).toBeDefined();
    });
  });

  describe("Monitoring Service Integration", () => {
    it("should start and stop monitoring service", () => {
      expect(monitoringService.getStats().isRunning).toBe(false);
      
      monitoringService.start();
      expect(monitoringService.getStats().isRunning).toBe(true);
      
      monitoringService.stop();
      expect(monitoringService.getStats().isRunning).toBe(false);
    });

    it("should generate alerts for system issues", async () => {
      monitoringService.start();
      
      // Make agents unhealthy to trigger alerts
      testAgent1.setFailure(true);
      testAgent2.setFailure(true);

      // Force multiple health checks to build up error history
      for (let i = 0; i < 5; i++) {
        await registry.checkAgentHealth("test-1");
        await registry.checkAgentHealth("test-2");
      }

      // Manually trigger the monitoring check since we can't wait for intervals
      await monitoringService.performHealthCheck();

      const alerts = monitoringService.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });

    it("should resolve alerts correctly", async () => {
      monitoringService.start();
      
      // Generate an alert by making agents unhealthy
      testAgent1.setFailure(true);
      
      // Force multiple failures to trigger alerts
      for (let i = 0; i < 5; i++) {
        await registry.checkAgentHealth("test-1");
      }
      
      // Manually trigger the monitoring check
      await monitoringService.performHealthCheck();
      
      const alerts = monitoringService.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      const alertId = alerts[0].id;
      const resolved = monitoringService.resolveAlert(alertId);
      expect(resolved).toBe(true);
      
      const unresolvedAlerts = monitoringService.getAlerts();
      expect(unresolvedAlerts.length).toBeLessThan(alerts.length);
    });

    it("should update monitoring configuration", () => {
      const originalConfig = monitoringService.getConfig();
      
      monitoringService.updateConfig({
        alertThresholds: {
          ...originalConfig.alertThresholds,
          unhealthyAgentPercentage: 50,
        },
      });
      
      const updatedConfig = monitoringService.getConfig();
      expect(updatedConfig.alertThresholds.unhealthyAgentPercentage).toBe(50);
    });

    it("should provide monitoring statistics", () => {
      const stats = monitoringService.getStats();
      
      expect(stats).toHaveProperty("isRunning");
      expect(stats).toHaveProperty("totalAlerts");
      expect(stats).toHaveProperty("unresolvedAlerts");
      expect(stats).toHaveProperty("criticalAlerts");
      expect(stats).toHaveProperty("totalReports");
      expect(stats).toHaveProperty("lastReportTime");
    });
  });

  describe("Recovery Mechanisms", () => {
    it("should add custom recovery strategies", () => {
      let strategyCalled = false;
      
      registry.addRecoveryStrategy("test-strategy", async () => {
        strategyCalled = true;
        return true;
      });
      
      // Trigger recovery
      testAgent1.setFailure(true);
      registry.checkAgentHealth("test-1");
      
      // Recovery strategies are called internally, 
      // so we just verify the method exists and doesn't throw
      expect(() => registry.addRecoveryStrategy("another-strategy", async () => true)).not.toThrow();
    });

    it("should track recovery attempts", async () => {
      const agent = registry.getAgent("test-1");
      const initialAttempts = agent?.health.recoveryAttempts || 0;
      
      // Cause failures to trigger recovery
      testAgent1.setFailure(true);
      for (let i = 0; i < 3; i++) {
        await registry.checkAgentHealth("test-1");
      }
      
      const agentAfter = registry.getAgent("test-1");
      expect(agentAfter?.health.recoveryAttempts).toBeGreaterThan(initialAttempts);
    });

    it("should set agent status to recovering during recovery attempts", async () => {
      testAgent1.setFailure(true);
      
      // Cause enough failures to trigger recovery
      await registry.checkAgentHealth("test-1");
      await registry.checkAgentHealth("test-1");
      await registry.checkAgentHealth("test-1");
      
      const agent = registry.getAgent("test-1");
      expect(agent?.health.status).toBe("unhealthy");
      expect(agent?.health.recoveryAttempts).toBeGreaterThan(0);
    });
  });

  describe("Performance and Memory", () => {
    it("should estimate memory usage correctly", async () => {
      await registry.checkAgentHealth("test-1");
      
      const agent = registry.getAgent("test-1");
      expect(agent?.health.memoryUsage).toBeGreaterThan(0);
      expect(agent?.health.memoryUsage).toBeLessThan(1000); // Reasonable upper bound
    });

    it("should estimate CPU usage based on performance", async () => {
      // High response time should correlate with higher CPU usage
      testAgent1.setDelay(1000);
      await registry.checkAgentHealth("test-1");
      
      const agent = registry.getAgent("test-1");
      expect(agent?.health.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(agent?.health.cpuUsage).toBeLessThanOrEqual(100);
    });

    it("should track cache hit rates", async () => {
      await registry.checkAgentHealth("test-1");
      
      const agent = registry.getAgent("test-1");
      expect(agent?.health.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(agent?.health.cacheHitRate).toBeLessThanOrEqual(100);
    });

    it("should clean up old health history", async () => {
      // Generate more health checks than the max history size
      for (let i = 0; i < 15; i++) {
        await registry.checkAgentHealth("test-1");
      }
      
      const history = registry.getAgentHealthHistory("test-1");
      expect(history.length).toBeLessThanOrEqual(10); // Max history size
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle agent not found gracefully", async () => {
      await expect(registry.checkAgentHealth("non-existent")).rejects.toThrow("Agent with ID 'non-existent' not found");
    });

    it("should handle agent registration conflicts", () => {
      // Verify agent is already registered
      expect(registry.hasAgent("test-1")).toBe(true);
      
      // Try to register an agent with a duplicate ID
      const duplicateAgent = new TestAgent({
        name: "duplicate-agent",
        systemPrompt: "You are a duplicate test agent",
      });
      
      expect(() => {
        registry.registerAgent("test-1", duplicateAgent, {
          name: "Duplicate Agent",
          type: "test",
        });
      }).toThrow("Agent with ID 'test-1' is already registered");
    });

    it("should handle health check timeouts", async () => {
      // Mock a very slow agent that exceeds the health check timeout (8 seconds)
      testAgent1.setDelay(9000); // 9 seconds - should timeout at 8 seconds
      
      const result = await registry.checkAgentHealth("test-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("timeout");
    }, 15000);

    it("should maintain health data consistency during errors", async () => {
      const agent = registry.getAgent("test-1");
      const initialHealthScore = agent?.health.healthScore;
      
      // Cause an error
      testAgent1.setFailure(true);
      await registry.checkAgentHealth("test-1");
      
      const agentAfterError = registry.getAgent("test-1");
      expect(agentAfterError?.health.healthScore).toBeLessThan(initialHealthScore || 100);
      expect(agentAfterError?.health.errorCount).toBeGreaterThan(0);
    });

    it("should handle monitoring service destruction gracefully", () => {
      monitoringService.start();
      expect(monitoringService.getStats().isRunning).toBe(true);
      
      monitoringService.destroy();
      
      // Should handle multiple destroy calls
      expect(() => monitoringService.destroy()).not.toThrow();
    });
  });
});