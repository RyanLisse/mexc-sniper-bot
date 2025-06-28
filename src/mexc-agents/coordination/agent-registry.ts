import { instrumentAgentMethod } from "../../lib/opentelemetry-agent-instrumentation";
// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import type { BaseAgent } from "../base-agent";
import {
  AgentHealthMonitor,
  type AgentRegistryStats,
  type HealthCheckResult,
} from "./agent-health-monitor";
import { AgentRecoveryStrategies } from "./agent-recovery-strategies";
import {
  type AgentHealth,
  AgentRegistryCore,
  type AgentRegistryOptions,
  type AgentStatus,
  type HealthThresholds,
  type RegisteredAgent,
} from "./agent-registry-core";

export type {
  AgentHealth,
  AgentRegistryOptions,
  AgentRegistryStats,
  AgentStatus,
  HealthCheckResult,
  HealthThresholds,
  RegisteredAgent,
};

/**
 * Enhanced agent registry with comprehensive health monitoring and recovery
 */
export class AgentRegistry extends AgentRegistryCore {
  // Simple console logger to avoid webpack bundling issues
  protected logger = {
    info: (message: string, context?: any) =>
      console.info("[agent-registry]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[agent-registry]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[agent-registry]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[agent-registry]", message, context || ""),
  };
  private healthMonitor: AgentHealthMonitor;
  private recoveryStrategies: AgentRecoveryStrategies;

  constructor(options?: AgentRegistryOptions) {
    super(options);

    this.healthMonitor = new AgentHealthMonitor(
      () => this.agents,
      (id, result) => this.updateAgentHealthFromResult(id, result),
      {
        healthCheckInterval: options?.healthCheckInterval,
        maxHealthHistorySize: options?.maxHealthHistorySize,
      }
    );

    this.recoveryStrategies = new AgentRecoveryStrategies();
  }

  /**
   * Register an agent with enhanced monitoring
   */
  @instrumentAgentMethod({
    agentType: "registry",
    operationType: "coordination",
    methodName: "registerAgent",
  })
  registerAgent(
    id: string,
    instance: BaseAgent,
    options: {
      name: string;
      type: string;
      dependencies?: string[];
      priority?: number;
      tags?: string[];
      capabilities?: string[];
      thresholds?: HealthThresholds;
      autoRecovery?: boolean;
    }
  ): void {
    super.registerAgent(id, instance, options);
    this.logger.info(`Enhanced agent registration completed: ${id}`);
  }

  /**
   * Start comprehensive health monitoring
   */
  startHealthMonitoring(): void {
    if (this.isRunning) {
      this.logger.warn("Health monitoring is already running");
      return;
    }

    this.isRunning = true;
    this.healthMonitor.startHealthMonitoring();
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    this.healthMonitor.stopHealthMonitoring();
    this.isRunning = false;
  }

  /**
   * Perform health check on a single agent
   */
  async checkAgentHealth(id: string): Promise<HealthCheckResult> {
    return this.healthMonitor.checkAgentHealth(id);
  }

  /**
   * Perform health check on all agents
   */
  async checkAllAgentsHealth(): Promise<Map<string, HealthCheckResult>> {
    return this.healthMonitor.checkAllAgentsHealth();
  }

  /**
   * Get registry statistics
   */
  getStats() {
    return this.healthMonitor.getStats();
  }

  /**
   * Get health history for an agent
   */
  getAgentHealthHistory(id: string, limit?: number): HealthCheckResult[] {
    return this.healthMonitor.getAgentHealthHistory(id, limit);
  }

  /**
   * Add custom recovery strategy
   */
  addRecoveryStrategy(name: string, strategy: () => Promise<boolean>): void {
    this.recoveryStrategies.addRecoveryStrategy(name, strategy);
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats() {
    return this.recoveryStrategies.getRecoveryStats();
  }

  /**
   * Get system health alerts
   */
  getSystemAlerts(): { type: "warning" | "critical"; message: string; timestamp: Date }[] {
    const alerts: { type: "warning" | "critical"; message: string; timestamp: Date }[] = [];
    const stats = this.getStats();
    const now = new Date();

    // Check unhealthy agent percentage
    const unhealthyPercentage =
      stats.totalAgents > 0 ? (stats.unhealthyAgents / stats.totalAgents) * 100 : 0;
    if (unhealthyPercentage > 20) {
      alerts.push({
        type: unhealthyPercentage > 50 ? "critical" : "warning",
        message: `${unhealthyPercentage.toFixed(1)}% of agents are unhealthy (${stats.unhealthyAgents}/${stats.totalAgents})`,
        timestamp: now,
      });
    }

    // Check system response time
    if (stats.averageResponseTime > 2000) {
      alerts.push({
        type: stats.averageResponseTime > 5000 ? "critical" : "warning",
        message: `System average response time is ${stats.averageResponseTime.toFixed(0)}ms`,
        timestamp: now,
      });
    }

    return alerts;
  }

  /**
   * Get detailed agent health report
   */
  getAgentHealthReport(id: string): {
    agent: RegisteredAgent;
    healthHistory: HealthCheckResult[];
    recommendations: string[];
  } | null {
    const agent = this.getAgent(id);
    if (!agent) return null;

    const healthHistory = this.getAgentHealthHistory(id, 50);
    const recommendations: string[] = [];

    // Generate recommendations based on health metrics
    if (agent.health.errorRate > agent.thresholds.errorRate.warning) {
      recommendations.push(
        "High error rate detected. Consider reviewing agent configuration or dependencies."
      );
    }

    if (agent.health.responseTime > agent.thresholds.responseTime.warning) {
      recommendations.push(
        "Slow response times detected. Consider optimizing agent processing or caching."
      );
    }

    if (agent.health.memoryUsage > agent.thresholds.memoryUsage.warning) {
      recommendations.push(
        "High memory usage detected. Consider clearing cache or optimizing memory usage."
      );
    }

    if (agent.health.recoveryAttempts > 3) {
      recommendations.push(
        "Multiple recovery attempts detected. Consider investigating root cause of failures."
      );
    }

    if (agent.health.trends.responseTime === "degrading") {
      recommendations.push(
        "Response time trend is degrading. Monitor for potential performance issues."
      );
    }

    return {
      agent,
      healthHistory,
      recommendations,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopHealthMonitoring();

    // Destroy all registered agents
    for (const agent of this.agents.values()) {
      if (typeof agent.instance.destroy === "function") {
        try {
          agent.instance.destroy();
        } catch (error) {
          this.logger.warn(`Error destroying agent ${agent.id}:`, error);
        }
      }
    }

    this.agents.clear();
    this.isRunning = false;
    this.logger.info("Registry destroyed");
  }

  /**
   * Update agent health from check result
   */
  private updateAgentHealthFromResult(id: string, result: HealthCheckResult): void {
    const agent = this.agents.get(id);
    if (!agent) return;

    const health = agent.health;
    const _thresholds = agent.thresholds;

    health.lastChecked = result.timestamp;
    health.responseTime = result.responseTime;
    health.requestCount = result.requestCount || health.requestCount;

    // Update enhanced metrics
    if (result.memoryUsage !== undefined) health.memoryUsage = result.memoryUsage;
    if (result.cpuUsage !== undefined) health.cpuUsage = result.cpuUsage;
    if (result.cacheHitRate !== undefined) health.cacheHitRate = result.cacheHitRate;
    if (result.healthScore !== undefined) health.healthScore = result.healthScore;

    if (result.success) {
      health.lastResponse = result.timestamp;
      health.consecutiveErrors = 0;
      health.successCount++;
      this.updateHealthStatus(agent, false);
    } else {
      health.errorCount++;
      health.consecutiveErrors++;
      health.lastError = result.error;
      this.updateHealthStatus(agent, true);

      // Attempt auto-recovery if enabled and threshold reached
      if (agent.autoRecovery && health.consecutiveErrors >= 3) {
        // Run recovery asynchronously to avoid blocking health updates
        setImmediate(() => {
          this.attemptRecovery(agent).catch((error) => {
            this.logger.error(`Auto-recovery failed for agent ${agent.id}:`, error);
          });
        });
      }
    }

    // Calculate uptime
    const totalChecks = health.requestCount;
    health.uptime = totalChecks > 0 ? (health.successCount / totalChecks) * 100 : 0;
  }

  /**
   * Update agent health status based on metrics
   */
  private updateHealthStatus(agent: RegisteredAgent, hasError: boolean): void {
    const health = agent.health;
    const thresholds = agent.thresholds;

    if (hasError) {
      if (health.consecutiveErrors >= thresholds.consecutiveErrors.critical) {
        health.status = "unhealthy";
      } else if (health.consecutiveErrors >= thresholds.consecutiveErrors.warning) {
        health.status = "degraded";
      } else {
        health.status = "degraded";
      }
    } else {
      // Check all metrics for overall status
      const responseTimeOk = health.responseTime <= thresholds.responseTime.warning;
      const errorRateOk = health.errorRate <= thresholds.errorRate.warning;
      const memoryOk = health.memoryUsage <= thresholds.memoryUsage.warning;
      const cpuOk = health.cpuUsage <= thresholds.cpuUsage.warning;

      if (responseTimeOk && errorRateOk && memoryOk && cpuOk) {
        health.status = "healthy";
      } else {
        health.status = "degraded";
      }
    }
  }

  /**
   * Attempt recovery for an agent
   */
  private async attemptRecovery(agent: RegisteredAgent): Promise<void> {
    try {
      await this.recoveryStrategies.attemptAgentRecovery(agent, (id) => this.getAgent(id));
    } catch (error) {
      this.logger.error(`Recovery failed for agent ${agent.id}:`, error);
    }
  }
}

// Singleton instance for global access
let globalRegistry: AgentRegistry | null = null;

export function getGlobalAgentRegistry(): AgentRegistry {
  if (!globalRegistry) {
    globalRegistry = new AgentRegistry();
  }
  return globalRegistry;
}

export function initializeGlobalAgentRegistry(options?: AgentRegistryOptions): AgentRegistry {
  if (globalRegistry) {
    try {
      globalRegistry.destroy();
    } catch (error) {
      console.warn("Error destroying previous registry:", error);
    }
  }
  globalRegistry = new AgentRegistry(options);
  return globalRegistry;
}

export function clearGlobalAgentRegistry(): void {
  if (globalRegistry) {
    try {
      globalRegistry.destroy();
    } catch (error) {
      console.warn("Error destroying global registry:", error);
    }
    globalRegistry = null;
  }
}
