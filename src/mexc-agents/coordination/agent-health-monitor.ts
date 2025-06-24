import { createLogger } from "../../lib/structured-logger";
import type { AgentResponse } from "../base-agent";
import type { AgentHealth, AgentStatus, RegisteredAgent } from "./agent-registry-core";

export interface HealthCheckResult {
  success: boolean;
  responseTime: number;
  timestamp: Date;
  error?: string;
  metadata?: Record<string, unknown>;
  memoryUsage?: number;
  cpuUsage?: number;
  cacheHitRate?: number;
  requestCount?: number;
  healthScore?: number;
}

export interface AgentRegistryStats {
  totalAgents: number;
  healthyAgents: number;
  degradedAgents: number;
  unhealthyAgents: number;
  unknownAgents: number;
  averageResponseTime: number;
  totalHealthChecks: number;
  lastFullHealthCheck: Date | null;
}

/**
 * Agent health monitoring system
 */
export class AgentHealthMonitor {
  private logger = createLogger("agent-health-monitor");
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private healthHistory: Map<string, HealthCheckResult[]> = new Map();
  private maxHealthHistorySize = 100;
  private healthCheckIntervalMs = 30000; // 30 seconds

  constructor(
    private getAgents: () => Map<string, RegisteredAgent>,
    private updateAgentHealth: (id: string, result: HealthCheckResult) => void,
    options?: {
      healthCheckInterval?: number;
      maxHealthHistorySize?: number;
    }
  ) {
    if (options?.healthCheckInterval) {
      this.healthCheckIntervalMs = options.healthCheckInterval;
    }
    if (options?.maxHealthHistorySize) {
      this.maxHealthHistorySize = options.maxHealthHistorySize;
    }
  }

  /**
   * Start periodic health monitoring
   */
  startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      this.logger.warn("Health monitoring is already running");
      return;
    }

    // Initial health check
    this.checkAllAgentsHealth().catch((error) => {
      this.logger.error("Initial health check failed:", error);
    });

    // Set up periodic checks
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.checkAllAgentsHealth();
      } catch (error) {
        this.logger.error("Periodic health check failed:", error);
      }
    }, this.healthCheckIntervalMs);

    this.logger.info(`Started health monitoring (interval: ${this.healthCheckIntervalMs}ms)`);
  }

  /**
   * Stop periodic health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      this.logger.info("Stopped health monitoring");
    }
  }

  /**
   * Perform health check on a single agent
   */
  async checkAgentHealth(id: string): Promise<HealthCheckResult> {
    const agents = this.getAgents();
    const agent = agents.get(id);

    if (!agent) {
      throw new Error(`Agent with ID '${id}' not found`);
    }

    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      // Collect enhanced metrics before health check
      const memoryUsage = this.getAgentMemoryUsage(agent);
      const cpuUsage = this.getAgentCpuUsage(agent);
      const cacheStats = agent.instance.getCacheStats?.() || { hitRate: 0, size: 0 };
      const cacheHitRate = typeof cacheStats.hitRate === "number" ? cacheStats.hitRate : 0;

      // Try a simple process call to test agent health
      const response = await Promise.race([
        agent.instance.process("health_check", {
          source: "registry",
          timestamp: new Date().toISOString(),
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Health check timeout")), 30000)
        ),
      ]);

      const responseTime = Date.now() - startTime;
      const healthScore = this.calculateHealthScore(agent, responseTime, memoryUsage, cpuUsage);

      result = {
        success: true,
        responseTime,
        timestamp: new Date(),
        memoryUsage,
        cpuUsage,
        cacheHitRate,
        requestCount: agent.health.requestCount + 1,
        healthScore,
        metadata: {
          agent: agent.name,
          agentType: agent.type,
          cacheSize: cacheStats.size,
          response: typeof response === "object" && response !== null ? response : {},
        },
      };

      this.updateAgentHealth(id, result);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const memoryUsage = this.getAgentMemoryUsage(agent);
      const cpuUsage = this.getAgentCpuUsage(agent);
      const cacheStats = agent.instance.getCacheStats?.() || { hitRate: 0, size: 0 };
      const cacheHitRate = typeof cacheStats.hitRate === "number" ? cacheStats.hitRate : 0;
      const healthScore = this.calculateHealthScore(
        agent,
        responseTime,
        memoryUsage,
        cpuUsage,
        true
      );

      result = {
        success: false,
        responseTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
        memoryUsage,
        cpuUsage,
        cacheHitRate,
        requestCount: agent.health.requestCount + 1,
        healthScore,
        metadata: {
          agent: agent.name,
          agentType: agent.type,
          cacheSize: cacheStats.size,
        },
      };

      this.updateAgentHealth(id, result);
    }

    this.addToHealthHistory(id, result);
    return result;
  }

  /**
   * Perform health check on all agents
   */
  async checkAllAgentsHealth(): Promise<Map<string, HealthCheckResult>> {
    const agents = this.getAgents();
    const results = new Map<string, HealthCheckResult>();
    const agentIds = Array.from(agents.keys());

    // Check all agents in parallel
    const healthChecks = agentIds.map(async (id) => {
      try {
        const result = await this.checkAgentHealth(id);
        results.set(id, result);
      } catch (error) {
        results.set(id, {
          success: false,
          responseTime: 0,
          timestamp: new Date(),
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    await Promise.allSettled(healthChecks);
    this.logger.info(`Health check completed for ${agentIds.length} agents`);
    return results;
  }

  /**
   * Get registry statistics
   */
  getStats(): AgentRegistryStats {
    const agents = Array.from(this.getAgents().values());
    const healthyCount = agents.filter((a) => a.health.status === "healthy").length;
    const degradedCount = agents.filter((a) => a.health.status === "degraded").length;
    const unhealthyCount = agents.filter((a) => a.health.status === "unhealthy").length;
    const unknownCount = agents.filter((a) => a.health.status === "unknown").length;

    const totalResponseTimes = agents.reduce((sum, a) => sum + a.health.responseTime, 0);
    const averageResponseTime = agents.length > 0 ? totalResponseTimes / agents.length : 0;

    const totalHealthChecks = Array.from(this.healthHistory.values()).reduce(
      (sum, history) => sum + history.length,
      0
    );

    const lastCheckTimes = agents.map((a) => a.health.lastChecked).filter(Boolean);
    const lastFullHealthCheck =
      lastCheckTimes.length > 0
        ? new Date(Math.max(...lastCheckTimes.map((d) => d.getTime())))
        : null;

    return {
      totalAgents: agents.length,
      healthyAgents: healthyCount,
      degradedAgents: degradedCount,
      unhealthyAgents: unhealthyCount,
      unknownAgents: unknownCount,
      averageResponseTime,
      totalHealthChecks,
      lastFullHealthCheck,
    };
  }

  /**
   * Get health history for an agent
   */
  getAgentHealthHistory(id: string, limit?: number): HealthCheckResult[] {
    const history = this.healthHistory.get(id) || [];
    return limit ? history.slice(-limit) : [...history];
  }

  /**
   * Calculate composite health score for an agent
   */
  private calculateHealthScore(
    agent: RegisteredAgent,
    responseTime: number,
    memoryUsage: number,
    cpuUsage: number,
    hasError = false
  ): number {
    if (hasError) return Math.max(0, agent.health.healthScore - 20);

    const thresholds = agent.thresholds;

    // Score components (0-100 each)
    const responseTimeScore = Math.max(
      0,
      100 - (responseTime / thresholds.responseTime.critical) * 100
    );
    const memoryScore = Math.max(0, 100 - (memoryUsage / thresholds.memoryUsage.critical) * 100);
    const cpuScore = Math.max(0, 100 - (cpuUsage / thresholds.cpuUsage.critical) * 100);
    const uptimeScore = agent.health.uptime;
    const errorRateScore = Math.max(0, 100 - agent.health.errorRate * 100);

    // Weighted composite score
    const score =
      responseTimeScore * 0.25 + // 25% weight
      memoryScore * 0.15 + // 15% weight
      cpuScore * 0.15 + // 15% weight
      uptimeScore * 0.25 + // 25% weight
      errorRateScore * 0.2; // 20% weight

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Get agent memory usage
   */
  private getAgentMemoryUsage(agent: RegisteredAgent): number {
    const cacheStats = agent.instance.getCacheStats?.() || { size: 0 };
    return Math.max(10, 20 + cacheStats.size * 0.001); // MB
  }

  /**
   * Get agent CPU usage estimation
   */
  private getAgentCpuUsage(agent: RegisteredAgent): number {
    const recentHistory = this.healthHistory.get(agent.id) || [];
    const recent = recentHistory.slice(-5); // Last 5 checks

    if (recent.length === 0) return 0;

    const avgResponseTime = recent.reduce((sum, h) => sum + h.responseTime, 0) / recent.length;
    return Math.min(100, Math.max(0, avgResponseTime / 100 + agent.health.errorRate * 50));
  }

  /**
   * Add result to health history
   */
  private addToHealthHistory(id: string, result: HealthCheckResult): void {
    const history = this.healthHistory.get(id) || [];
    history.push(result);

    // Keep only the most recent entries
    if (history.length > this.maxHealthHistorySize) {
      history.splice(0, history.length - this.maxHealthHistorySize);
    }

    this.healthHistory.set(id, history);
  }
}
