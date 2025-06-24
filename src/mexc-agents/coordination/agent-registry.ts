import { DATA_CONSTANTS, RISK_CONSTANTS, SYSTEM_CONFIG, TIME_CONSTANTS } from "../../lib/constants";
// OpenTelemetry agent instrumentation
import { instrumentAgentMethod } from "../../lib/opentelemetry-agent-instrumentation";
import type { BaseAgent } from "../base-agent";
import { createLogger } from "../lib/structured-logger";

export type AgentStatus = "healthy" | "degraded" | "unhealthy" | "unknown" | "recovering";

export interface HealthThresholds {
  responseTime: {
    warning: number; // ms - degraded threshold
    critical: number; // ms - unhealthy threshold
  };
  errorRate: {
    warning: number; // % - degraded threshold (0-1)
    critical: number; // % - unhealthy threshold (0-1)
  };
  consecutiveErrors: {
    warning: number; // count - degraded threshold
    critical: number; // count - unhealthy threshold
  };
  uptime: {
    warning: number; // % - degraded threshold (0-100)
    critical: number; // % - unhealthy threshold (0-100)
  };
  memoryUsage: {
    warning: number; // MB - degraded threshold
    critical: number; // MB - unhealthy threshold
  };
  cpuUsage: {
    warning: number; // % - degraded threshold (0-100)
    critical: number; // % - unhealthy threshold (0-100)
  };
}

export interface AgentHealth {
  status: AgentStatus;
  lastChecked: Date;
  lastResponse: Date | null;
  responseTime: number;
  errorCount: number;
  errorRate: number;
  consecutiveErrors: number;
  uptime: number;
  lastError?: string;
  capabilities: string[];
  load: {
    current: number;
    peak: number;
    average: number;
  };
  // Enhanced health metrics
  memoryUsage: number; // MB
  cpuUsage: number; // %
  cacheHitRate: number; // %
  requestCount: number; // Total requests processed
  successCount: number; // Successful requests
  lastRecoveryAttempt?: Date;
  recoveryAttempts: number;
  healthScore: number; // Composite score 0-100
  trends: {
    responseTime: "improving" | "degrading" | "stable";
    errorRate: "improving" | "degrading" | "stable";
    throughput: "improving" | "degrading" | "stable";
  };
}

export interface RegisteredAgent {
  id: string;
  name: string;
  type: string;
  instance: BaseAgent;
  health: AgentHealth;
  registeredAt: Date;
  dependencies: string[];
  priority: number;
  tags: string[];
  thresholds: HealthThresholds;
  autoRecovery: boolean;
}

export interface HealthCheckResult {
  success: boolean;
  responseTime: number;
  timestamp: Date;
  error?: string;
  metadata?: Record<string, unknown>;
  // Enhanced metrics
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

export interface AgentRegistryOptions {
  healthCheckInterval?: number;
  maxHealthHistorySize?: number;
  defaultThresholds?: HealthThresholds;
  autoRecoveryEnabled?: boolean;
  alertThresholds?: {
    unhealthyAgentPercentage: number; // % of unhealthy agents that triggers system alert
    systemResponseTime: number; // ms - system-wide response time alert
    systemErrorRate: number; // % - system-wide error rate alert
  };
}

/**
 * Centralized registry for managing all agents with comprehensive health monitoring
 */
export class AgentRegistry {
  private logger = createLogger("agent-registry");

  private agents: Map<string, RegisteredAgent> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private healthCheckIntervalMs = TIME_CONSTANTS.INTERVALS.THIRTY_SECONDS;
  private healthHistory: Map<string, HealthCheckResult[]> = new Map();
  private maxHealthHistorySize = SYSTEM_CONFIG.AGENTS.MAX_HEALTH_HISTORY;
  private isRunning = false;
  private defaultThresholds: HealthThresholds;
  private autoRecoveryEnabled: boolean;
  private alertThresholds: {
    unhealthyAgentPercentage: number;
    systemResponseTime: number;
    systemErrorRate: number;
  };
  private recoveryStrategies: Map<string, () => Promise<boolean>> = new Map();

  constructor(options?: AgentRegistryOptions) {
    if (options?.healthCheckInterval) {
      this.healthCheckIntervalMs = options.healthCheckInterval;
    }
    if (options?.maxHealthHistorySize) {
      this.maxHealthHistorySize = options.maxHealthHistorySize;
    }

    this.autoRecoveryEnabled = options?.autoRecoveryEnabled ?? true;

    // Default health thresholds using centralized constants
    this.defaultThresholds = options?.defaultThresholds ?? {
      responseTime: {
        warning: RISK_CONSTANTS.HEALTH.RESPONSE_TIME_WARNING,
        critical: RISK_CONSTANTS.HEALTH.RESPONSE_TIME_CRITICAL,
      },
      errorRate: {
        warning: RISK_CONSTANTS.HEALTH.ERROR_RATE_WARNING,
        critical: RISK_CONSTANTS.HEALTH.ERROR_RATE_CRITICAL,
      },
      consecutiveErrors: {
        warning: SYSTEM_CONFIG.AGENTS.DEFAULT_RETRY_ATTEMPTS,
        critical: SYSTEM_CONFIG.AGENTS.DEFAULT_RETRY_ATTEMPTS + 2,
      },
      uptime: {
        warning: RISK_CONSTANTS.HEALTH.UPTIME_WARNING,
        critical: RISK_CONSTANTS.HEALTH.UPTIME_CRITICAL,
      },
      memoryUsage: {
        warning: RISK_CONSTANTS.HEALTH.MEMORY_WARNING,
        critical: RISK_CONSTANTS.HEALTH.MEMORY_CRITICAL,
      },
      cpuUsage: {
        warning: RISK_CONSTANTS.HEALTH.CPU_WARNING,
        critical: RISK_CONSTANTS.HEALTH.CPU_CRITICAL,
      },
    };

    // Default system alert thresholds using centralized constants
    this.alertThresholds = options?.alertThresholds ?? {
      unhealthyAgentPercentage: RISK_CONSTANTS.ALERTS.UNHEALTHY_AGENT_PERCENTAGE,
      systemResponseTime: RISK_CONSTANTS.ALERTS.SYSTEM_RESPONSE_TIME,
      systemErrorRate: RISK_CONSTANTS.ALERTS.SYSTEM_ERROR_RATE,
    };

    this.setupDefaultRecoveryStrategies();
  }

  /**
   * Register an agent in the registry
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
    if (this.agents.has(id)) {
      throw new Error(`Agent with ID '${id}' is already registered`);
    }

    const registeredAgent: RegisteredAgent = {
      id,
      name: options.name,
      type: options.type,
      instance,
      registeredAt: new Date(),
      dependencies: options.dependencies || [],
      priority: options.priority || SYSTEM_CONFIG.AGENTS.DEFAULT_PRIORITY,
      tags: options.tags || [],
      thresholds: options.thresholds || this.defaultThresholds,
      autoRecovery: options.autoRecovery ?? this.autoRecoveryEnabled,
      health: {
        status: "unknown",
        lastChecked: new Date(),
        lastResponse: null,
        responseTime: 0,
        errorCount: 0,
        errorRate: 0,
        consecutiveErrors: 0,
        uptime: SYSTEM_CONFIG.AGENTS.DEFAULT_UPTIME,
        capabilities: options.capabilities || [],
        load: {
          current: 0,
          peak: 0,
          average: 0,
        },
        // Enhanced health metrics
        memoryUsage: 0,
        cpuUsage: 0,
        cacheHitRate: 0,
        requestCount: 0,
        successCount: 0,
        recoveryAttempts: 0,
        healthScore: SYSTEM_CONFIG.AGENTS.DEFAULT_HEALTH_SCORE,
        trends: {
          responseTime: "stable",
          errorRate: "stable",
          throughput: "stable",
        },
      },
    };

    this.agents.set(id, registeredAgent);
    this.healthHistory.set(id, []);

    logger.info(`[AgentRegistry] Registered agent: ${id} (${options.name})`);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) {
      return false;
    }

    // Clean up the agent
    if (typeof agent.instance.destroy === "function") {
      agent.instance.destroy();
    }

    this.agents.delete(id);
    this.healthHistory.delete(id);

    logger.info(`[AgentRegistry] Unregistered agent: ${id}`);
    return true;
  }

  /**
   * Get an agent by ID
   */
  getAgent(id: string): RegisteredAgent | null {
    return this.agents.get(id) || null;
  }

  /**
   * Get agent instance by ID
   */
  getAgentInstance(id: string): BaseAgent | null {
    const agent = this.agents.get(id);
    return agent?.instance || null;
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by type
   */
  getAgentsByType(type: string): RegisteredAgent[] {
    return Array.from(this.agents.values()).filter((agent) => agent.type === type);
  }

  /**
   * Get agents by tag
   */
  getAgentsByTag(tag: string): RegisteredAgent[] {
    return Array.from(this.agents.values()).filter((agent) => agent.tags.includes(tag));
  }

  /**
   * Check if an agent is available for workflows
   */
  isAgentAvailable(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) {
      return false;
    }

    return agent.health.status === "healthy" || agent.health.status === "degraded";
  }

  /**
   * Get available agents by type
   */
  getAvailableAgentsByType(type: string): RegisteredAgent[] {
    return this.getAgentsByType(type).filter((agent) => this.isAgentAvailable(agent.id));
  }

  /**
   * Perform health check on a single agent
   */
  async checkAgentHealth(id: string): Promise<HealthCheckResult> {
    const agent = this.agents.get(id);
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
          setTimeout(
            () => reject(new Error("Health check timeout")),
            TIME_CONSTANTS.TIMEOUTS.HEALTH_CHECK
          )
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

      // Update agent health
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

      // Update agent health with error
      this.updateAgentHealth(id, result);

      // Attempt auto-recovery if enabled
      if (
        agent.autoRecovery &&
        agent.health.consecutiveErrors >= RISK_CONSTANTS.HEALTH.CONSECUTIVE_ERRORS_WARNING - 1
      ) {
        await this.attemptAgentRecovery(id);
      }
    }

    // Store in history
    this.addToHealthHistory(id, result);

    return result;
  }

  /**
   * Perform health check on all agents
   */
  async checkAllAgentsHealth(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();
    const agentIds = Array.from(this.agents.keys());

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

    logger.info(`[AgentRegistry] Health check completed for ${agentIds.length} agents`);
    return results;
  }

  /**
   * Start periodic health monitoring
   */
  startHealthMonitoring(): void {
    if (this.isRunning) {
      logger.warn("[AgentRegistry] Health monitoring is already running");
      return;
    }

    this.isRunning = true;

    // Initial health check
    this.checkAllAgentsHealth().catch((error) => {
      logger.error("[AgentRegistry] Initial health check failed:", error);
    });

    // Set up periodic checks
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.checkAllAgentsHealth();
      } catch (error) {
        logger.error("[AgentRegistry] Periodic health check failed:", error);
      }
    }, this.healthCheckIntervalMs);

    logger.info(
      `[AgentRegistry] Started health monitoring (interval: ${this.healthCheckIntervalMs}ms)`
    );
  }

  /**
   * Stop periodic health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      this.isRunning = false;
      logger.info("[AgentRegistry] Stopped health monitoring");
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): AgentRegistryStats {
    const agents = Array.from(this.agents.values());
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
   * Update agent health based on check result with enhanced thresholds
   */
  private updateAgentHealth(id: string, result: HealthCheckResult): void {
    const agent = this.agents.get(id);
    if (!agent) {
      return;
    }

    const health = agent.health;
    const thresholds = agent.thresholds;

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

      // Calculate trends
      this.updateHealthTrends(id);

      // Determine status based on enhanced thresholds
      const responseTimeStatus = this.getMetricStatus(health.responseTime, thresholds.responseTime);
      const errorRateStatus = this.getMetricStatus(health.errorRate, thresholds.errorRate);
      const memoryStatus = this.getMetricStatus(health.memoryUsage, thresholds.memoryUsage);
      const cpuStatus = this.getMetricStatus(health.cpuUsage, thresholds.cpuUsage);
      const uptimeStatus = this.getMetricStatus(health.uptime, thresholds.uptime, true); // Reverse logic for uptime

      // Determine overall status (worst status wins)
      const statuses = [responseTimeStatus, errorRateStatus, memoryStatus, cpuStatus, uptimeStatus];
      if (statuses.includes("critical")) {
        health.status = "unhealthy";
      } else if (statuses.includes("warning")) {
        health.status = "degraded";
      } else {
        health.status = "healthy";
      }
    } else {
      health.errorCount++;
      health.consecutiveErrors++;
      health.lastError = result.error;

      // Calculate error rate from recent history
      const history = this.healthHistory.get(id) || [];
      const recentChecks = history.slice(-DATA_CONSTANTS.HISTORY.RECENT_CHECKS).concat([result]); // Last N checks + current
      const recentErrors = recentChecks.filter((check) => !check.success).length;
      health.errorRate = recentChecks.length > 0 ? recentErrors / recentChecks.length : 1;

      // Update trends
      this.updateHealthTrends(id);

      // Determine status based on enhanced thresholds
      const consecutiveErrorsStatus = this.getMetricStatus(
        health.consecutiveErrors,
        thresholds.consecutiveErrors
      );
      const errorRateStatus = this.getMetricStatus(health.errorRate, thresholds.errorRate);

      if (consecutiveErrorsStatus === "critical" || errorRateStatus === "critical") {
        health.status = "unhealthy";
      } else if (consecutiveErrorsStatus === "warning" || errorRateStatus === "warning") {
        health.status = "degraded";
      } else {
        health.status = "degraded"; // Any error puts agent in degraded state
      }
    }

    // Calculate uptime
    const totalChecks = (this.healthHistory.get(id) || []).length + 1;
    const successfulChecks = health.successCount;
    health.uptime = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0;

    // Update load metrics
    this.updateLoadMetrics(agent, result.responseTime);
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

  /**
   * Setup default recovery strategies for common agent types
   */
  private setupDefaultRecoveryStrategies(): void {
    // Cache clearing strategy
    this.recoveryStrategies.set("clear_cache", async () => {
      logger.info("[AgentRegistry] Executing cache clearing recovery strategy");
      return true; // Would implement cache clearing logic
    });

    // Restart strategy
    this.recoveryStrategies.set("restart", async () => {
      logger.info("[AgentRegistry] Executing restart recovery strategy");
      return true; // Would implement agent restart logic
    });

    // Health check retry strategy
    this.recoveryStrategies.set("health_retry", async () => {
      logger.info("[AgentRegistry] Executing health retry recovery strategy");
      return true; // Would implement health check retry logic
    });
  }

  /**
   * Get metric status based on thresholds
   */
  private getMetricStatus(
    value: number,
    thresholds: { warning: number; critical: number },
    reverseLogic = false
  ): "healthy" | "warning" | "critical" {
    if (reverseLogic) {
      // For metrics like uptime where lower values are worse
      if (value < thresholds.critical) return "critical";
      if (value < thresholds.warning) return "warning";
      return "healthy";
    }
    // For metrics like response time where higher values are worse
    if (value > thresholds.critical) return "critical";
    if (value > thresholds.warning) return "warning";
    return "healthy";
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
    if (hasError) return Math.max(0, agent.health.healthScore - 20); // Penalty for errors

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
   * Update health trends for an agent
   */
  private updateHealthTrends(id: string): void {
    const agent = this.agents.get(id);
    if (!agent) return;

    const history = this.healthHistory.get(id) || [];
    if (history.length < DATA_CONSTANTS.HISTORY.LAST_N_CHECKS) return; // Need at least N data points

    const recent = history.slice(-DATA_CONSTANTS.HISTORY.TOP_KEYS_LIMIT); // Last N checks
    const older = history.slice(
      -DATA_CONSTANTS.HISTORY.RECENT_CHECKS,
      -DATA_CONSTANTS.HISTORY.TOP_KEYS_LIMIT
    ); // Previous N checks

    if (older.length === 0) return;

    // Calculate averages
    const recentAvgResponseTime =
      recent.reduce((sum, h) => sum + h.responseTime, 0) / recent.length;
    const olderAvgResponseTime = older.reduce((sum, h) => sum + h.responseTime, 0) / older.length;

    const recentErrorRate = recent.filter((h) => !h.success).length / recent.length;
    const olderErrorRate = older.filter((h) => !h.success).length / older.length;

    const recentThroughput = recent.length; // Simplified throughput calculation
    const olderThroughput = older.length;

    // Determine trends (5% threshold for significance)
    const responseTimeDiff = (recentAvgResponseTime - olderAvgResponseTime) / olderAvgResponseTime;
    const errorRateDiff = recentErrorRate - olderErrorRate;
    const throughputDiff = (recentThroughput - olderThroughput) / olderThroughput;

    agent.health.trends.responseTime =
      Math.abs(responseTimeDiff) < 0.05
        ? "stable"
        : responseTimeDiff > 0
          ? "degrading"
          : "improving";

    agent.health.trends.errorRate =
      Math.abs(errorRateDiff) < 0.05 ? "stable" : errorRateDiff > 0 ? "degrading" : "improving";

    agent.health.trends.throughput =
      Math.abs(throughputDiff) < 0.05 ? "stable" : throughputDiff > 0 ? "improving" : "degrading";
  }

  /**
   * Update load metrics for an agent
   */
  private updateLoadMetrics(agent: RegisteredAgent, responseTime: number): void {
    const load = agent.health.load;

    // Update current load (simplified based on response time)
    load.current = Math.min(100, (responseTime / 1000) * 10); // 1s = 10% load

    // Update peak load
    if (load.current > load.peak) {
      load.peak = load.current;
    }

    // Update average load (exponential moving average)
    load.average = load.average * 0.9 + load.current * 0.1;
  }

  /**
   * Get agent memory usage
   */
  private getAgentMemoryUsage(agent: RegisteredAgent): number {
    const cacheStats = agent.instance.getCacheStats?.() || { size: 0 };
    // Base memory + cache size estimation
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

    // Simplified CPU estimation based on response time and error rate
    return Math.min(100, Math.max(0, avgResponseTime / 100 + agent.health.errorRate * 50));
  }

  /**
   * Attempt automatic recovery for an agent
   */
  private async attemptAgentRecovery(id: string): Promise<boolean> {
    const agent = this.agents.get(id);
    if (!agent) return false;

    agent.health.lastRecoveryAttempt = new Date();
    agent.health.recoveryAttempts++;
    agent.health.status = "recovering";

    logger.info(
      `[AgentRegistry] Attempting recovery for agent ${id} (attempt ${agent.health.recoveryAttempts})`
    );

    try {
      // Try different recovery strategies based on agent type and error pattern
      const strategies = ["health_retry", "clear_cache"];

      for (const strategyName of strategies) {
        const strategy = this.recoveryStrategies.get(strategyName);
        if (strategy) {
          const success = await strategy();
          if (success) {
            logger.info(
              `[AgentRegistry] Recovery successful for agent ${id} using strategy: ${strategyName}`
            );

            // Reset consecutive errors after successful recovery
            agent.health.consecutiveErrors = Math.max(
              0,
              agent.health.consecutiveErrors - RISK_CONSTANTS.HEALTH.CONSECUTIVE_ERRORS_WARNING + 1
            );
            return true;
          }
        }
      }

      logger.info(`[AgentRegistry] Recovery failed for agent ${id} after trying all strategies`);
      return false;
    } catch (error) {
      logger.error(`[AgentRegistry] Recovery attempt failed for agent ${id}:`, error);
      return false;
    }
  }

  /**
   * Add a custom recovery strategy
   */
  addRecoveryStrategy(name: string, strategy: () => Promise<boolean>): void {
    this.recoveryStrategies.set(name, strategy);
    logger.info(`[AgentRegistry] Added recovery strategy: ${name}`);
  }

  /**
   * Get system health alerts
   */
  getSystemAlerts(): { type: "warning" | "critical"; message: string; timestamp: Date }[] {
    const alerts: { type: "warning" | "critical"; message: string; timestamp: Date }[] = [];
    const stats = this.getStats();
    const now = new Date();

    // Check unhealthy agent percentage
    const unhealthyPercentage = (stats.unhealthyAgents / stats.totalAgents) * 100;
    if (unhealthyPercentage > this.alertThresholds.unhealthyAgentPercentage) {
      alerts.push({
        type:
          unhealthyPercentage > RISK_CONSTANTS.ALERTS.CRITICAL_UNHEALTHY_PERCENTAGE
            ? "critical"
            : "warning",
        message: `${unhealthyPercentage.toFixed(1)}% of agents are unhealthy (${stats.unhealthyAgents}/${stats.totalAgents})`,
        timestamp: now,
      });
    }

    // Check system response time
    if (stats.averageResponseTime > this.alertThresholds.systemResponseTime) {
      alerts.push({
        type:
          stats.averageResponseTime > RISK_CONSTANTS.ALERTS.CRITICAL_SYSTEM_RESPONSE_TIME
            ? "critical"
            : "warning",
        message: `System average response time is ${stats.averageResponseTime.toFixed(0)}ms`,
        timestamp: now,
      });
    }

    // Check for agents with high recovery attempts
    for (const agent of this.agents.values()) {
      if (agent.health.recoveryAttempts > RISK_CONSTANTS.ALERTS.RECOVERY_ATTEMPTS_WARNING) {
        alerts.push({
          type:
            agent.health.recoveryAttempts > RISK_CONSTANTS.ALERTS.RECOVERY_ATTEMPTS_CRITICAL
              ? "critical"
              : "warning",
          message: `Agent ${agent.name} has required ${agent.health.recoveryAttempts} recovery attempts`,
          timestamp: now,
        });
      }
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
    const agent = this.agents.get(id);
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

    if (agent.health.recoveryAttempts > SYSTEM_CONFIG.AGENTS.DEFAULT_RETRY_ATTEMPTS) {
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
          logger.warn(`[AgentRegistry] Error destroying agent ${agent.id}:`, error);
        }
      }
    }

    this.agents.clear();
    this.healthHistory.clear();
    this.recoveryStrategies.clear();

    // Reset to fresh state
    this.isRunning = false;
    this.healthCheckInterval = null;

    logger.info("[AgentRegistry] Registry destroyed");
  }

  /**
   * Force unregister all agents (for testing)
   */
  clearAllAgents(): void {
    for (const [id] of this.agents) {
      this.unregisterAgent(id);
    }
  }

  /**
   * Check if agent is already registered
   */
  hasAgent(id: string): boolean {
    return this.agents.has(id);
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
      logger.warn("[AgentRegistry] Error destroying previous registry:", error);
    }
  }
  globalRegistry = new AgentRegistry(options);
  return globalRegistry;
}

/**
 * Clear global registry (for testing)
 */
export function clearGlobalAgentRegistry(): void {
  if (globalRegistry) {
    try {
      globalRegistry.destroy();
    } catch (error) {
      logger.warn("[AgentRegistry] Error destroying global registry:", error);
    }
    globalRegistry = null;
  }
}
