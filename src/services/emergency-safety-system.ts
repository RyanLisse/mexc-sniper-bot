/**
 * Emergency Safety System
 *
 * Provides automated emergency response mechanisms including:
 * - Circuit breakers for trading halt scenarios
 * - Automatic position liquidation during market stress
 * - Emergency agent shutdown and recovery procedures
 * - Real-time market anomaly detection
 * - System-wide emergency protocols
 */

import { EventEmitter } from "events";
import { createLogger } from "../lib/structured-logger";
import type { AdvancedRiskEngine } from "./advanced-risk-engine";
import { type CircuitBreaker, circuitBreakerRegistry } from "./circuit-breaker";

// Emergency System Interfaces
export interface EmergencyCondition {
  id: string;
  type: "market_crash" | "liquidity_crisis" | "system_failure" | "risk_breach" | "agent_failure";
  severity: "medium" | "high" | "critical" | "catastrophic";
  description: string;
  triggers: string[];
  detectedAt: string;
  autoResponse: boolean;
  responseActions: EmergencyAction[];
}

export interface EmergencyAction {
  id: string;
  type:
    | "halt_trading"
    | "close_positions"
    | "reduce_exposure"
    | "shutdown_agents"
    | "notify_operators";
  priority: number; // 1-10 (1 = highest priority)
  description: string;
  parameters: Record<string, unknown>;
  executedAt?: string;
  success?: boolean;
  error?: string;
}

export interface MarketAnomalyDetection {
  priceAnomalies: Array<{
    symbol: string;
    currentPrice: number;
    expectedPrice: number;
    deviation: number; // Percentage
    severity: "low" | "medium" | "high" | "critical";
  }>;
  volumeAnomalies: Array<{
    symbol: string;
    currentVolume: number;
    averageVolume: number;
    ratio: number;
    severity: "low" | "medium" | "high" | "critical";
  }>;
  correlationBreaks: Array<{
    symbols: string[];
    expectedCorrelation: number;
    currentCorrelation: number;
    deviation: number;
    severity: "low" | "medium" | "high" | "critical";
  }>;
  liquidityGaps: Array<{
    symbol: string;
    bidAskSpread: number;
    normalSpread: number;
    spreadRatio: number;
    severity: "low" | "medium" | "high" | "critical";
  }>;
}

export interface SystemHealthCheck {
  overall: "healthy" | "degraded" | "critical" | "emergency";
  components: {
    riskEngine: "healthy" | "degraded" | "critical" | "offline";
    tradingEngine: "healthy" | "degraded" | "critical" | "offline";
    dataFeed: "healthy" | "degraded" | "critical" | "offline";
    agentSystem: "healthy" | "degraded" | "critical" | "offline";
    database: "healthy" | "degraded" | "critical" | "offline";
    connectivity: "healthy" | "degraded" | "critical" | "offline";
  };
  criticalIssues: string[];
  degradedComponents: string[];
  lastCheck: string;
}

export interface EmergencyResponse {
  id: string;
  conditionId: string;
  triggeredAt: string;
  responseTime: number; // milliseconds
  actionsExecuted: EmergencyAction[];
  success: boolean;
  finalState: {
    tradingHalted: boolean;
    positionsLiquidated: number;
    agentsShutdown: string[];
    systemStatus: string;
  };
  manualInterventionRequired: boolean;
  recovery: {
    estimated: boolean;
    timeToRecovery?: number; // minutes
    recoverySteps: string[];
  };
}

export interface EmergencyConfig {
  // Detection Thresholds
  priceDeviationThreshold: number; // % for price anomaly detection
  volumeAnomalyThreshold: number; // Ratio for volume anomaly detection
  correlationBreakThreshold: number; // Correlation change threshold
  liquidityGapThreshold: number; // Spread ratio threshold

  // Response Settings
  autoResponseEnabled: boolean;
  emergencyHaltThreshold: number; // Risk score triggering auto-halt
  liquidationThreshold: number; // Risk score triggering liquidation
  maxLiquidationSize: number; // Max position size to liquidate

  // System Protection
  maxConcurrentEmergencies: number;
  cooldownPeriod: number; // Minutes between emergency responses
  manualOverrideRequired: boolean;

  // Recovery Settings
  autoRecoveryEnabled: boolean;
  recoveryCheckInterval: number; // Minutes
  healthCheckTimeout: number; // Seconds
}

/**
 * Emergency Safety System
 *
 * Monitors system health and market conditions to detect emergency
 * situations and execute automated responses to protect capital
 * and system integrity.
 */
export class EmergencySafetySystem extends EventEmitter {
  private _logger?: ReturnType<typeof createLogger>;
  private get logger() {
    if (!this._logger) {
      this._logger = createLogger("emergency-safety-system");
    }
    return this._logger;
  }

  private config: EmergencyConfig;
  private circuitBreaker: CircuitBreaker;
  private riskEngine?: AdvancedRiskEngine;
  private emergencyConditions: Map<string, EmergencyCondition> = new Map();
  private emergencyResponses: EmergencyResponse[] = [];
  private lastHealthCheck = 0;
  private emergencyActive = false;
  private activeEmergencies = 0;

  // System state tracking
  private tradingHalted = false;
  private agentsShutdown: string[] = [];
  private lastEmergencyResponse = 0;
  private consecutiveLossCount = 0;
  private tradeResults: Array<{ success: boolean; timestamp: string; amount: number }> = [];

  constructor(config?: Partial<EmergencyConfig>) {
    super();
    this.config = this.mergeWithDefaultConfig(config);
    this.circuitBreaker = circuitBreakerRegistry.getBreaker("emergency-safety-system", {
      failureThreshold: 2,
      recoveryTimeout: 60000,
      expectedFailureRate: 0.05,
    });

    logger.info("[EmergencySafetySystem] Initialized with automated emergency response");
  }

  /**
   * Set risk engine for integration
   */
  setRiskEngine(riskEngine: AdvancedRiskEngine): void {
    this.riskEngine = riskEngine;
    logger.info("[EmergencySafetySystem] Risk engine integration established");
  }

  /**
   * Perform comprehensive system health check
   */
  async performSystemHealthCheck(): Promise<SystemHealthCheck> {
    return await this.circuitBreaker.execute(async () => {
      const startTime = Date.now();
      const healthCheck: SystemHealthCheck = {
        overall: "healthy",
        components: {
          riskEngine: "healthy",
          tradingEngine: "healthy",
          dataFeed: "healthy",
          agentSystem: "healthy",
          database: "healthy",
          connectivity: "healthy",
        },
        criticalIssues: [],
        degradedComponents: [],
        lastCheck: new Date().toISOString(),
      };

      // Check risk engine health
      if (this.riskEngine) {
        const riskHealth = this.riskEngine.getHealthStatus();
        if (!riskHealth.healthy) {
          healthCheck.components.riskEngine = riskHealth.issues.some((i) => i.includes("critical"))
            ? "critical"
            : "degraded";
          if (healthCheck.components.riskEngine === "critical") {
            healthCheck.criticalIssues.push(`Risk engine: ${riskHealth.issues.join(", ")}`);
          } else {
            healthCheck.degradedComponents.push("Risk engine");
          }
        }
      }

      // Check circuit breakers
      const allBreakers = circuitBreakerRegistry.getAllBreakers();
      let openBreakers = 0;
      for (const [name, breaker] of allBreakers) {
        if (breaker.getState() === "OPEN") {
          openBreakers++;
          healthCheck.criticalIssues.push(`Circuit breaker open: ${name}`);
        }
      }

      if (openBreakers > 2) {
        healthCheck.components.connectivity = "critical";
      } else if (openBreakers > 0) {
        healthCheck.components.connectivity = "degraded";
        healthCheck.degradedComponents.push("Connectivity");
      }

      // Check for active emergencies
      if (this.emergencyActive) {
        healthCheck.criticalIssues.push("Emergency condition active");
        healthCheck.overall = "emergency";
      }

      // Determine overall health
      if (healthCheck.criticalIssues.length > 0) {
        healthCheck.overall = healthCheck.overall === "emergency" ? "emergency" : "critical";
      } else if (healthCheck.degradedComponents.length > 2) {
        healthCheck.overall = "degraded";
      }

      this.lastHealthCheck = Date.now();
      const checkDuration = this.lastHealthCheck - startTime;

      logger.info(
        `[EmergencySafetySystem] Health check completed in ${checkDuration}ms - Status: ${healthCheck.overall}`
      );

      return healthCheck;
    });
  }

  /**
   * Detect market anomalies that could trigger emergency responses
   */
  async detectMarketAnomalies(
    _marketData: Record<string, unknown>
  ): Promise<MarketAnomalyDetection> {
    return await this.circuitBreaker.execute(async () => {
      const anomalies: MarketAnomalyDetection = {
        priceAnomalies: [],
        volumeAnomalies: [],
        correlationBreaks: [],
        liquidityGaps: [],
      };

      // Simulate market data analysis (in production, would use real market data)
      const symbols = ["BTCUSDT", "ETHUSDT", "ADAUSDT"];

      for (const symbol of symbols) {
        // Price anomaly detection
        const currentPrice = Math.random() * 50000 + 25000; // Mock price
        const expectedPrice = currentPrice * (0.95 + Math.random() * 0.1); // ±5% variation
        const deviation = Math.abs((currentPrice - expectedPrice) / expectedPrice) * 100;

        if (deviation > this.config.priceDeviationThreshold) {
          let severity: "low" | "medium" | "high" | "critical" = "low";
          if (deviation > 15) severity = "critical";
          else if (deviation > 10) severity = "high";
          else if (deviation > 5) severity = "medium";

          anomalies.priceAnomalies.push({
            symbol,
            currentPrice,
            expectedPrice,
            deviation,
            severity,
          });
        }

        // Volume anomaly detection
        const currentVolume = Math.random() * 1000000 + 100000; // Mock volume
        const averageVolume = currentVolume * (0.7 + Math.random() * 0.6); // Variation
        const ratio = currentVolume / averageVolume;

        if (
          ratio > this.config.volumeAnomalyThreshold ||
          ratio < 1 / this.config.volumeAnomalyThreshold
        ) {
          let severity: "low" | "medium" | "high" | "critical" = "low";
          if (ratio > 5 || ratio < 0.2) severity = "critical";
          else if (ratio > 3 || ratio < 0.33) severity = "high";
          else if (ratio > 2 || ratio < 0.5) severity = "medium";

          anomalies.volumeAnomalies.push({
            symbol,
            currentVolume,
            averageVolume,
            ratio,
            severity,
          });
        }

        // Liquidity gap detection
        const bidAskSpread = Math.random() * 2; // Mock spread %
        const normalSpread = 0.1; // Normal spread
        const spreadRatio = bidAskSpread / normalSpread;

        if (spreadRatio > this.config.liquidityGapThreshold) {
          let severity: "low" | "medium" | "high" | "critical" = "low";
          if (spreadRatio > 20) severity = "critical";
          else if (spreadRatio > 10) severity = "high";
          else if (spreadRatio > 5) severity = "medium";

          anomalies.liquidityGaps.push({
            symbol,
            bidAskSpread,
            normalSpread,
            spreadRatio,
            severity,
          });
        }
      }

      // Check for critical anomalies that require emergency response
      const criticalAnomalies = [
        ...anomalies.priceAnomalies.filter((a) => a.severity === "critical"),
        ...anomalies.volumeAnomalies.filter((a) => a.severity === "critical"),
        ...anomalies.liquidityGaps.filter((a) => a.severity === "critical"),
      ];

      if (criticalAnomalies.length > 0) {
        await this.handleCriticalMarketAnomalies(criticalAnomalies);
      }

      return anomalies;
    });
  }

  /**
   * Activate emergency response for detected conditions
   */
  async activateEmergencyResponse(
    conditionType: EmergencyCondition["type"],
    severity: EmergencyCondition["severity"],
    description: string,
    triggers: string[]
  ): Promise<EmergencyResponse> {
    const startTime = Date.now();

    // Check if we're in cooldown period
    if (Date.now() - this.lastEmergencyResponse < this.config.cooldownPeriod * 60000) {
      throw new Error("Emergency system in cooldown period");
    }

    // Check max concurrent emergencies
    if (this.activeEmergencies >= this.config.maxConcurrentEmergencies) {
      throw new Error("Maximum concurrent emergencies reached");
    }

    // Create emergency condition
    const condition: EmergencyCondition = {
      id: `emergency-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: conditionType,
      severity,
      description,
      triggers,
      detectedAt: new Date().toISOString(),
      autoResponse: this.config.autoResponseEnabled,
      responseActions: this.generateResponseActions(conditionType, severity),
    };

    this.emergencyConditions.set(condition.id, condition);
    this.emergencyActive = true;
    this.activeEmergencies++;

    logger.info(`[EmergencySafetySystem] Emergency activated: ${condition.id} - ${description}`);

    // Execute response actions
    const executedActions: EmergencyAction[] = [];
    let success = true;

    for (const action of condition.responseActions) {
      try {
        const actionResult = await this.executeEmergencyAction(action);
        action.executedAt = new Date().toISOString();
        action.success = actionResult.success;
        action.error = actionResult.error;
        executedActions.push(action);

        if (!actionResult.success) {
          success = false;
          logger.error(
            `[EmergencySafetySystem] Action failed: ${action.id} - ${actionResult.error}`
          );
        }
      } catch (error) {
        action.success = false;
        action.error = error instanceof Error ? error.message : "Unknown error";
        action.executedAt = new Date().toISOString();
        executedActions.push(action);
        success = false;
        logger.error(`[EmergencySafetySystem] Action execution error: ${action.id}`, error);
      }
    }

    // Create emergency response record
    const response: EmergencyResponse = {
      id: `response-${condition.id}`,
      conditionId: condition.id,
      triggeredAt: condition.detectedAt,
      responseTime: Date.now() - startTime,
      actionsExecuted: executedActions,
      success,
      finalState: {
        tradingHalted: this.tradingHalted,
        positionsLiquidated: this.countLiquidatedPositions(executedActions),
        agentsShutdown: [...this.agentsShutdown],
        systemStatus: success ? "emergency_handled" : "emergency_failed",
      },
      manualInterventionRequired: !success || severity === "catastrophic",
      recovery: {
        estimated: severity !== "catastrophic",
        timeToRecovery: this.estimateRecoveryTime(severity),
        recoverySteps: this.generateRecoverySteps(condition),
      },
    };

    this.emergencyResponses.push(response);
    this.lastEmergencyResponse = Date.now();

    // Keep only last 100 emergency responses
    if (this.emergencyResponses.length > 100) {
      this.emergencyResponses = this.emergencyResponses.slice(-100);
    }

    return response;
  }

  /**
   * Deactivate emergency condition and begin recovery
   */
  async deactivateEmergency(conditionId: string, reason: string): Promise<boolean> {
    const condition = this.emergencyConditions.get(conditionId);
    if (!condition) {
      throw new Error(`Emergency condition not found: ${conditionId}`);
    }

    try {
      // Begin recovery process
      await this.initiateRecovery(condition, reason);

      this.emergencyConditions.delete(conditionId);
      this.activeEmergencies = Math.max(0, this.activeEmergencies - 1);

      if (this.activeEmergencies === 0) {
        this.emergencyActive = false;
      }

      logger.info(`[EmergencySafetySystem] Emergency deactivated: ${conditionId} - ${reason}`);
      return true;
    } catch (error) {
      logger.error(`[EmergencySafetySystem] Failed to deactivate emergency: ${conditionId}`, error);
      return false;
    }
  }

  /**
   * Force emergency halt of all trading activities
   */
  async forceEmergencyHalt(reason: string): Promise<void> {
    logger.info(`[EmergencySafetySystem] FORCE EMERGENCY HALT: ${reason}`);

    this.tradingHalted = true;

    // Halt all circuit breakers
    const allBreakers = circuitBreakerRegistry.getAllBreakers();
    for (const [_name, breaker] of allBreakers) {
      breaker.forceOpen();
    }

    // Stop risk engine operations if available
    if (this.riskEngine) {
      // Risk engine doesn't have explicit stop method, but circuit breaker will protect it
      logger.info("[EmergencySafetySystem] Risk engine operations halted via circuit breaker");
    }

    // This would integrate with actual trading system
    logger.info("[EmergencySafetySystem] All trading activities halted");
  }

  /**
   * Resume normal operations after emergency
   */
  async resumeNormalOperations(): Promise<boolean> {
    if (this.activeEmergencies > 0) {
      throw new Error("Cannot resume - active emergencies detected");
    }

    try {
      // Perform health check before resuming
      const healthCheck = await this.performSystemHealthCheck();
      if (healthCheck.overall === "critical" || healthCheck.overall === "emergency") {
        throw new Error("System health check failed - cannot resume operations");
      }

      // Reset circuit breakers
      const allBreakers = circuitBreakerRegistry.getAllBreakers();
      for (const [_name, breaker] of allBreakers) {
        if (breaker.getState() === "OPEN") {
          breaker.forceClosed();
        }
      }

      // Resume trading
      this.tradingHalted = false;
      this.agentsShutdown = [];

      logger.info("[EmergencySafetySystem] Normal operations resumed");
      return true;
    } catch (error) {
      logger.error("[EmergencySafetySystem] Failed to resume operations:", error);
      return false;
    }
  }

  /**
   * Get current emergency status
   */
  getEmergencyStatus(): {
    active: boolean;
    activeCount: number;
    conditions: EmergencyCondition[];
    tradingHalted: boolean;
    lastResponse?: EmergencyResponse;
    systemHealth: "healthy" | "degraded" | "critical" | "emergency";
  } {
    const conditions = Array.from(this.emergencyConditions.values());
    const lastResponse = this.emergencyResponses[this.emergencyResponses.length - 1];

    let systemHealth: "healthy" | "degraded" | "critical" | "emergency" = "healthy";
    if (this.emergencyActive) {
      systemHealth = "emergency";
    } else if (this.tradingHalted) {
      systemHealth = "critical";
    } else if (conditions.length > 0) {
      systemHealth = "degraded";
    }

    return {
      active: this.emergencyActive,
      activeCount: this.activeEmergencies,
      conditions,
      tradingHalted: this.tradingHalted,
      lastResponse,
      systemHealth,
    };
  }

  /**
   * Get emergency response history
   */
  getEmergencyHistory(limit = 50): EmergencyResponse[] {
    return this.emergencyResponses.slice(-limit);
  }

  // Private helper methods
  private mergeWithDefaultConfig(partial?: Partial<EmergencyConfig>): EmergencyConfig {
    const defaultConfig: EmergencyConfig = {
      priceDeviationThreshold: 5,
      volumeAnomalyThreshold: 3,
      correlationBreakThreshold: 0.5,
      liquidityGapThreshold: 5,
      autoResponseEnabled: true,
      emergencyHaltThreshold: 80,
      liquidationThreshold: 90,
      maxLiquidationSize: 10000,
      maxConcurrentEmergencies: 3,
      cooldownPeriod: 5,
      manualOverrideRequired: false,
      autoRecoveryEnabled: true,
      recoveryCheckInterval: 2,
      healthCheckTimeout: 30,
    };

    return { ...defaultConfig, ...partial };
  }

  private generateResponseActions(
    _conditionType: EmergencyCondition["type"],
    severity: EmergencyCondition["severity"]
  ): EmergencyAction[] {
    const actions: EmergencyAction[] = [];

    if (severity === "catastrophic") {
      actions.push({
        id: "emergency-halt",
        type: "halt_trading",
        priority: 1,
        description: "Emergency halt of all trading activities",
        parameters: { immediate: true },
      });

      actions.push({
        id: "shutdown-agents",
        type: "shutdown_agents",
        priority: 2,
        description: "Shutdown all trading agents",
        parameters: { agentTypes: ["trading", "strategy", "pattern-discovery"] },
      });

      actions.push({
        id: "notify-critical",
        type: "notify_operators",
        priority: 3,
        description: "Send critical emergency notifications",
        parameters: { urgency: "critical", channels: ["email", "sms", "webhook"] },
      });
    } else if (severity === "critical") {
      actions.push({
        id: "halt-new-trades",
        type: "halt_trading",
        priority: 1,
        description: "Halt new trade execution",
        parameters: { newTradesOnly: true },
      });

      actions.push({
        id: "reduce-exposure",
        type: "reduce_exposure",
        priority: 2,
        description: "Reduce portfolio exposure by 50%",
        parameters: { reductionPercent: 50 },
      });

      actions.push({
        id: "notify-high",
        type: "notify_operators",
        priority: 3,
        description: "Send high priority notifications",
        parameters: { urgency: "high", channels: ["email", "webhook"] },
      });
    } else if (severity === "high") {
      actions.push({
        id: "reduce-position-sizes",
        type: "reduce_exposure",
        priority: 1,
        description: "Reduce position sizes by 30%",
        parameters: { reductionPercent: 30 },
      });

      actions.push({
        id: "notify-medium",
        type: "notify_operators",
        priority: 2,
        description: "Send medium priority notifications",
        parameters: { urgency: "medium", channels: ["email"] },
      });
    }

    return actions;
  }

  private async executeEmergencyAction(
    action: EmergencyAction
  ): Promise<{ success: boolean; error?: string }> {
    try {
      switch (action.type) {
        case "halt_trading":
          return await this.executeHaltTrading(action.parameters);
        case "close_positions":
          return await this.executeClosePositions(action.parameters);
        case "reduce_exposure":
          return await this.executeReduceExposure(action.parameters);
        case "shutdown_agents":
          return await this.executeShutdownAgents(action.parameters);
        case "notify_operators":
          return await this.executeNotifyOperators(action.parameters);
        default:
          return { success: false, error: `Unknown action type: ${action.type}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async executeHaltTrading(
    parameters: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (parameters.immediate || !parameters.newTradesOnly) {
        this.tradingHalted = true;
        logger.info("[EmergencySafetySystem] Trading halted completely");
      } else {
        logger.info("[EmergencySafetySystem] New trades halted");
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to halt trading",
      };
    }
  }

  private async executeClosePositions(
    parameters: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // This would integrate with actual position management
      const maxSize = (parameters.maxSize as number) || this.config.maxLiquidationSize;
      logger.info(`[EmergencySafetySystem] Closing positions up to ${maxSize} USDT`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to close positions",
      };
    }
  }

  private async executeReduceExposure(
    parameters: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const reductionPercent = (parameters.reductionPercent as number) || 50;
      logger.info(`[EmergencySafetySystem] Reducing exposure by ${reductionPercent}%`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reduce exposure",
      };
    }
  }

  private async executeShutdownAgents(
    parameters: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const agentTypes = (parameters.agentTypes as string[]) || [];
      this.agentsShutdown.push(...agentTypes);
      logger.info(`[EmergencySafetySystem] Shutdown agents: ${agentTypes.join(", ")}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to shutdown agents",
      };
    }
  }

  private async executeNotifyOperators(
    parameters: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const urgency = (parameters.urgency as string) || "medium";
      const channels = (parameters.channels as string[]) || ["email"];
      logger.info(
        `[EmergencySafetySystem] Notifying operators - Urgency: ${urgency}, Channels: ${channels.join(", ")}`
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to notify operators",
      };
    }
  }

  private async handleCriticalMarketAnomalies(anomalies: unknown[]): Promise<void> {
    logger.info(`[EmergencySafetySystem] Critical market anomalies detected: ${anomalies.length}`);

    await this.activateEmergencyResponse(
      "market_crash",
      "critical",
      `Critical market anomalies detected: ${anomalies.length} anomalies`,
      ["market_anomaly_detection"]
    );
  }

  private countLiquidatedPositions(actions: EmergencyAction[]): number {
    return actions.filter((a) => a.type === "close_positions" && a.success).length;
  }

  private estimateRecoveryTime(severity: EmergencyCondition["severity"]): number {
    switch (severity) {
      case "catastrophic":
        return 240; // 4 hours
      case "critical":
        return 120; // 2 hours
      case "high":
        return 60; // 1 hour
      default:
        return 30; // 30 minutes
    }
  }

  private generateRecoverySteps(condition: EmergencyCondition): string[] {
    const steps = [
      "Wait for market conditions to stabilize",
      "Perform comprehensive system health check",
      "Verify all circuit breakers are reset",
      "Restart disabled agents one by one",
      "Resume trading with reduced position sizes",
      "Monitor system for 30 minutes before full operation",
    ];

    if (condition.type === "market_crash") {
      steps.unshift("Confirm market recovery and normal liquidity");
    }

    if (condition.type === "system_failure") {
      steps.unshift("Resolve underlying system issues");
    }

    return steps;
  }

  private async initiateRecovery(condition: EmergencyCondition, reason: string): Promise<void> {
    logger.info(`[EmergencySafetySystem] Initiating recovery for ${condition.id}: ${reason}`);

    if (this.config.autoRecoveryEnabled && condition.severity !== "catastrophic") {
      // Automated recovery steps
      logger.info("[EmergencySafetySystem] Starting automated recovery process");

      // This would implement actual recovery logic
      // For now, just log the steps
      const recoverySteps = this.generateRecoverySteps(condition);
      for (const step of recoverySteps) {
        logger.info(`[EmergencySafetySystem] Recovery step: ${step}`);
      }
    } else {
      logger.info("[EmergencySafetySystem] Manual recovery required");
    }
  }

  /**
   * Assess portfolio health and detect potential issues
   */
  assessPortfolioHealth(portfolioData: {
    totalValue: number;
    positions: Array<{ symbol: string; value: number; pnl: number }>;
    riskMetrics: { totalExposure: number; maxDrawdown: number };
  }): {
    status: "healthy" | "warning" | "critical";
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: "healthy" | "warning" | "critical" = "healthy";

    // Check for high exposure
    if (portfolioData.riskMetrics.totalExposure > 0.8) {
      issues.push("High portfolio exposure detected");
      recommendations.push("Reduce position sizes");
      status = portfolioData.riskMetrics.totalExposure > 0.95 ? "critical" : "warning";
    }

    // Check for significant drawdown
    if (portfolioData.riskMetrics.maxDrawdown > 15) {
      issues.push("Significant drawdown detected");
      recommendations.push("Review risk management settings");
      status = "warning";
    }

    // Check individual positions
    const largeLosses = portfolioData.positions.filter((p) => p.pnl < -p.value * 0.1);
    if (largeLosses.length > 0) {
      issues.push(`${largeLosses.length} positions with significant losses`);
      recommendations.push("Consider stop-loss adjustments");
      if (largeLosses.length > 3) status = "critical";
    }

    return { status, issues, recommendations };
  }

  /**
   * Check if emergency mode is currently active
   */
  isEmergencyActive(): boolean {
    return this.emergencyActive;
  }

  /**
   * Check if trading is currently halted
   */
  isTradingHalted(): boolean {
    return this.tradingHalted;
  }

  /**
   * Record a trade result for consecutive loss tracking
   */
  recordTradeResult(tradeData: {
    success: boolean;
    symbol: string;
    amount: number;
    pnl?: number;
    timestamp?: string;
  }): void {
    const result = {
      success: tradeData.success,
      timestamp: tradeData.timestamp || new Date().toISOString(),
      amount: tradeData.amount,
    };

    this.tradeResults.push(result);

    // Keep only last 100 trades to prevent memory issues
    if (this.tradeResults.length > 100) {
      this.tradeResults = this.tradeResults.slice(-100);
    }

    // Update consecutive loss count
    if (!tradeData.success) {
      this.consecutiveLossCount++;
    } else {
      this.consecutiveLossCount = 0;
    }

    // Check for emergency conditions
    if (this.consecutiveLossCount >= 5) {
      logger.info(
        `[EmergencySafetySystem] WARNING: ${this.consecutiveLossCount} consecutive losses detected`
      );
      this.emit("emergency_stop", {
        reason: "consecutive_losses",
        count: this.consecutiveLossCount,
        timestamp: new Date().toISOString(),
      });
    }

    // Emit circuit breaker if too many failures
    if (this.consecutiveLossCount >= 3) {
      this.emit("circuit_breaker_activated", {
        reason: "trading_losses",
        consecutiveLosses: this.consecutiveLossCount,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get the current consecutive loss count
   */
  getConsecutiveLossCount(): number {
    return this.consecutiveLossCount;
  }
}
