// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import type { RegisteredAgent } from "./agent-registry-core";

export interface RecoveryStrategy {
  name: string;
  description: string;
  execute: () => Promise<boolean>;
  priority: number;
  maxAttempts: number;
}

export interface RecoveryAttempt {
  agentId: string;
  strategy: string;
  timestamp: Date;
  success: boolean;
  error?: string;
  duration: number;
}

/**
 * Agent recovery strategies manager
 */
export class AgentRecoveryStrategies {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[agent-recovery-strategies]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[agent-recovery-strategies]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[agent-recovery-strategies]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[agent-recovery-strategies]", message, context || ""),
  };
  private recoveryStrategies: Map<string, () => Promise<boolean>> = new Map();
  private recoveryHistory: RecoveryAttempt[] = [];

  constructor() {
    this.setupDefaultRecoveryStrategies();
  }

  /**
   * Attempt automatic recovery for an agent
   */
  async attemptAgentRecovery(
    agent: RegisteredAgent,
    getUpdatedAgent: (id: string) => RegisteredAgent | null
  ): Promise<boolean> {
    agent.health.lastRecoveryAttempt = new Date();
    agent.health.recoveryAttempts++;
    agent.health.status = "recovering";

    this.logger.info(
      `Attempting recovery for agent ${agent.id} (attempt ${agent.health.recoveryAttempts})`
    );

    const startTime = Date.now();

    try {
      // Try different recovery strategies based on agent type and error pattern
      const strategies = this.selectRecoveryStrategies(agent);

      for (const strategyName of strategies) {
        const strategy = this.recoveryStrategies.get(strategyName);
        if (strategy) {
          const success = await strategy();
          const duration = Date.now() - startTime;

          this.recordRecoveryAttempt({
            agentId: agent.id,
            strategy: strategyName,
            timestamp: new Date(),
            success,
            duration,
          });

          if (success) {
            this.logger.info(
              `Recovery successful for agent ${agent.id} using strategy: ${strategyName}`
            );

            // Reset consecutive errors after successful recovery
            const updatedAgent = getUpdatedAgent(agent.id);
            if (updatedAgent) {
              updatedAgent.health.consecutiveErrors = Math.max(
                0,
                updatedAgent.health.consecutiveErrors - 2
              );
            }
            return true;
          }
        }
      }

      this.logger.info(`Recovery failed for agent ${agent.id} after trying all strategies`);
      return false;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.recordRecoveryAttempt({
        agentId: agent.id,
        strategy: "unknown",
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration,
      });

      this.logger.error(`Recovery attempt failed for agent ${agent.id}:`, error);
      return false;
    }
  }

  /**
   * Add a custom recovery strategy
   */
  addRecoveryStrategy(name: string, strategy: () => Promise<boolean>): void {
    this.recoveryStrategies.set(name, strategy);
    this.logger.info(`Added recovery strategy: ${name}`);
  }

  /**
   * Get available recovery strategies
   */
  getRecoveryStrategies(): string[] {
    return Array.from(this.recoveryStrategies.keys());
  }

  /**
   * Get recovery history for an agent
   */
  getRecoveryHistory(agentId?: string, limit = 50): RecoveryAttempt[] {
    let history = Array.from(this.recoveryHistory.values());

    if (agentId) {
      history = history.filter((attempt) => attempt.agentId === agentId);
    }

    return history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    totalAttempts: number;
    successfulRecoveries: number;
    successRate: number;
    averageDuration: number;
    strategiesUsed: Record<string, number>;
  } {
    const history = Array.from(this.recoveryHistory.values());
    const successful = history.filter((attempt) => attempt.success);

    const strategiesUsed = history.reduce(
      (acc, attempt) => {
        acc[attempt.strategy] = (acc[attempt.strategy] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const averageDuration =
      history.length > 0
        ? history.reduce((sum, attempt) => sum + attempt.duration, 0) / history.length
        : 0;

    return {
      totalAttempts: history.length,
      successfulRecoveries: successful.length,
      successRate: history.length > 0 ? successful.length / history.length : 0,
      averageDuration,
      strategiesUsed,
    };
  }

  /**
   * Select appropriate recovery strategies for an agent
   */
  private selectRecoveryStrategies(agent: RegisteredAgent): string[] {
    const strategies: string[] = [];

    // Always try health check retry first
    strategies.push("health_retry");

    // For high memory usage, try cache clearing
    if (agent.health.memoryUsage > agent.thresholds.memoryUsage.warning) {
      strategies.push("clear_cache");
    }

    // For persistent failures, try restart
    if (agent.health.consecutiveErrors >= 3) {
      strategies.push("restart");
    }

    // For specific agent types, add specialized strategies
    if (agent.type === "websocket") {
      strategies.push("reconnect_websocket");
    }

    if (agent.type === "api") {
      strategies.push("refresh_credentials");
    }

    return strategies;
  }

  /**
   * Setup default recovery strategies for common agent types
   */
  private setupDefaultRecoveryStrategies(): void {
    // Cache clearing strategy
    this.recoveryStrategies.set("clear_cache", async () => {
      this.logger.info("Executing cache clearing recovery strategy");
      // Simulate cache clearing
      await new Promise((resolve) => setTimeout(resolve, 100));
      return Math.random() > 0.3; // 70% success rate
    });

    // Restart strategy
    this.recoveryStrategies.set("restart", async () => {
      this.logger.info("Executing restart recovery strategy");
      // Simulate restart
      await new Promise((resolve) => setTimeout(resolve, 500));
      return Math.random() > 0.2; // 80% success rate
    });

    // Health check retry strategy
    this.recoveryStrategies.set("health_retry", async () => {
      this.logger.info("Executing health retry recovery strategy");
      // Simulate health check retry
      await new Promise((resolve) => setTimeout(resolve, 50));
      return Math.random() > 0.4; // 60% success rate
    });

    // WebSocket reconnection strategy
    this.recoveryStrategies.set("reconnect_websocket", async () => {
      this.logger.info("Executing WebSocket reconnection strategy");
      await new Promise((resolve) => setTimeout(resolve, 200));
      return Math.random() > 0.25; // 75% success rate
    });

    // API credentials refresh strategy
    this.recoveryStrategies.set("refresh_credentials", async () => {
      this.logger.info("Executing credentials refresh strategy");
      await new Promise((resolve) => setTimeout(resolve, 300));
      return Math.random() > 0.15; // 85% success rate
    });
  }

  /**
   * Record a recovery attempt
   */
  private recordRecoveryAttempt(attempt: RecoveryAttempt): void {
    this.recoveryHistory.push(attempt);

    // Keep only last 1000 attempts
    if (this.recoveryHistory.length > 1000) {
      this.recoveryHistory.splice(0, this.recoveryHistory.length - 1000);
    }
  }
}
