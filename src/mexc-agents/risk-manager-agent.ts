import { createLogger } from "../lib/structured-logger";
import type { AgentConfig, AgentResponse } from "./base-agent";
import { SafetyBaseAgent, type SafetyConfig } from "./safety-base-agent";

export interface RiskMetrics {
  totalExposure: number; // Total USDT value of open positions
  dailyPnL: number;
  maxDrawdown: number;
  openPositions: number;
  averagePositionSize: number;
  riskPercentage: number; // Total risk as % of account
  volatilityIndex: number; // 0-100 scale
  lastUpdated: string;
}

export interface CircuitBreaker {
  id: string;
  name: string;
  type: "loss_limit" | "drawdown" | "position_count" | "volatility" | "exposure";
  threshold: number;
  currentValue: number;
  triggered: boolean;
  triggeredAt?: string;
  resetAt?: string;
  severity: "low" | "medium" | "high" | "critical";
  action: "warn" | "halt_new" | "halt_all" | "emergency_exit";
}

export interface RiskEvent {
  id: string;
  type: "threshold_breach" | "circuit_breaker" | "emergency_halt" | "risk_warning";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  circuitBreakerId?: string;
  metrics: Partial<RiskMetrics>;
  timestamp: string;
  actionTaken: string;
}

export interface TradeRiskAssessment {
  approved: boolean;
  riskScore: number; // 0-100
  reasons: string[];
  warnings: string[];
  maxAllowedSize: number;
  estimatedImpact: {
    newExposure: number;
    riskIncrease: number;
    portfolioImpact: number;
  };
}

export class RiskManagerAgent extends SafetyBaseAgent {
  private logger = createLogger("risk-manager-agent");

  private riskMetrics: RiskMetrics;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private riskEvents: RiskEvent[] = [];
  private emergencyHaltActive = false;
  private lastRiskUpdate = 0;

  constructor(safetyConfig?: Partial<SafetyConfig>) {
    const config: AgentConfig = {
      name: "risk-manager-agent",
      model: "gpt-4o",
      temperature: 0.1,
      maxTokens: 2500,
      systemPrompt: `You are an advanced risk management agent responsible for protecting trading capital and preventing catastrophic losses.

Your critical responsibilities:
1. Monitor real-time portfolio risk metrics and exposure
2. Implement dynamic circuit breakers that adapt to market conditions
3. Assess individual trade risk before execution approval
4. Coordinate emergency trading halts across all systems
5. Provide risk-adjusted position sizing recommendations

Risk Management Framework:
- Position Size Limits: Maximum risk per trade and total exposure
- Drawdown Limits: Maximum acceptable portfolio decline
- Volatility Adaptation: Adjust risk limits based on market conditions
- Circuit Breakers: Automatic halt triggers for various risk scenarios
- Emergency Protocols: Immediate halt and liquidation procedures

Assessment Criteria:
- Portfolio correlation and concentration risk
- Market volatility and liquidity conditions
- Historical performance and drawdown patterns
- Real-time P&L and exposure monitoring
- Cross-asset risk aggregation

Always prioritize capital preservation over profit maximization. When in doubt, recommend reduced position sizes or trading halts.`,
    };

    super(config, safetyConfig);

    this.riskMetrics = {
      totalExposure: 0,
      dailyPnL: 0,
      maxDrawdown: 0,
      openPositions: 0,
      averagePositionSize: 0,
      riskPercentage: 0,
      volatilityIndex: 0,
      lastUpdated: new Date().toISOString(),
    };

    this.initializeCircuitBreakers();
  }

  private initializeCircuitBreakers(): void {
    const breakers: CircuitBreaker[] = [
      {
        id: "daily_loss_limit",
        name: "Daily Loss Limit",
        type: "loss_limit",
        threshold: -this.safetyConfig.riskManagement.maxDailyLoss,
        currentValue: 0,
        triggered: false,
        severity: "critical",
        action: "halt_new",
      },
      {
        id: "max_drawdown",
        name: "Maximum Drawdown",
        type: "drawdown",
        threshold: -this.safetyConfig.riskManagement.circuitBreakerThreshold,
        currentValue: 0,
        triggered: false,
        severity: "high",
        action: "halt_new",
      },
      {
        id: "position_count",
        name: "Maximum Positions",
        type: "position_count",
        threshold: this.safetyConfig.riskManagement.maxConcurrentTrades,
        currentValue: 0,
        triggered: false,
        severity: "medium",
        action: "halt_new",
      },
      {
        id: "total_exposure",
        name: "Total Portfolio Exposure",
        type: "exposure",
        threshold: this.safetyConfig.riskManagement.maxPositionSize * 5, // 5x max position size
        currentValue: 0,
        triggered: false,
        severity: "high",
        action: "halt_new",
      },
      {
        id: "high_volatility",
        name: "High Market Volatility",
        type: "volatility",
        threshold: 80, // 80% volatility index
        currentValue: 0,
        triggered: false,
        severity: "medium",
        action: "warn",
      },
    ];

    for (const breaker of breakers) {
      this.circuitBreakers.set(breaker.id, breaker);
    }
  }

  async process(input: string, context?: Record<string, unknown>): Promise<AgentResponse> {
    const userMessage = `
Risk Management Analysis Request:
Current Risk Metrics:
- Total Exposure: ${this.riskMetrics.totalExposure} USDT
- Daily P&L: ${this.riskMetrics.dailyPnL} USDT  
- Open Positions: ${this.riskMetrics.openPositions}
- Risk Percentage: ${this.riskMetrics.riskPercentage}%
- Volatility Index: ${this.riskMetrics.volatilityIndex}

Circuit Breaker Status:
${Array.from(this.circuitBreakers.values())
  .map(
    (cb) =>
      `- ${cb.name}: ${cb.triggered ? "TRIGGERED" : "OK"} (${cb.currentValue}/${cb.threshold})`
  )
  .join("\n")}

Emergency Halt: ${this.emergencyHaltActive ? "ACTIVE" : "Inactive"}

Analysis Request: ${input}

Context Data:
${JSON.stringify(context, null, 2)}

Please provide detailed risk analysis, recommendations, and any necessary risk mitigation actions.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async updateRiskMetrics(
    totalExposure: number,
    dailyPnL: number,
    openPositions: number,
    volatilityIndex?: number
  ): Promise<void> {
    const previousMetrics = { ...this.riskMetrics };

    this.riskMetrics = {
      totalExposure,
      dailyPnL,
      maxDrawdown: Math.min(this.riskMetrics.maxDrawdown, dailyPnL),
      openPositions,
      averagePositionSize: openPositions > 0 ? totalExposure / openPositions : 0,
      riskPercentage: (totalExposure / 1000) * 100, // Assuming $1000 base capital
      volatilityIndex: volatilityIndex || this.riskMetrics.volatilityIndex,
      lastUpdated: new Date().toISOString(),
    };

    this.lastRiskUpdate = Date.now();

    // Update circuit breaker values
    this.updateCircuitBreakerValues();

    // Check for breaches
    await this.checkCircuitBreakers();

    // Emit risk update event
    await this.emitSafetyEvent("risk", "low", "Risk metrics updated", {
      previous: previousMetrics,
      current: this.riskMetrics,
      significantChange: this.hasSignificantRiskChange(previousMetrics, this.riskMetrics),
    });
  }

  private updateCircuitBreakerValues(): void {
    const breakers = Array.from(this.circuitBreakers.values());

    for (const breaker of breakers) {
      switch (breaker.type) {
        case "loss_limit":
          breaker.currentValue = this.riskMetrics.dailyPnL;
          break;
        case "drawdown":
          breaker.currentValue = this.riskMetrics.maxDrawdown;
          break;
        case "position_count":
          breaker.currentValue = this.riskMetrics.openPositions;
          break;
        case "exposure":
          breaker.currentValue = this.riskMetrics.totalExposure;
          break;
        case "volatility":
          breaker.currentValue = this.riskMetrics.volatilityIndex;
          break;
      }
    }
  }

  private async checkCircuitBreakers(): Promise<void> {
    const breakers = Array.from(this.circuitBreakers.values());

    for (const breaker of breakers) {
      const shouldTrigger = this.shouldTriggerBreaker(breaker);

      if (shouldTrigger && !breaker.triggered) {
        // Trigger the circuit breaker
        breaker.triggered = true;
        breaker.triggeredAt = new Date().toISOString();

        const riskEvent: RiskEvent = {
          id: `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "circuit_breaker",
          severity: breaker.severity,
          message: `Circuit breaker triggered: ${breaker.name}`,
          circuitBreakerId: breaker.id,
          metrics: this.riskMetrics,
          timestamp: new Date().toISOString(),
          actionTaken: breaker.action,
        };

        this.riskEvents.push(riskEvent);

        await this.executeCircuitBreakerAction(breaker);
        await this.emitSafetyEvent(
          "risk",
          breaker.severity,
          `Circuit breaker triggered: ${breaker.name}`,
          {
            breakerId: breaker.id,
            threshold: breaker.threshold,
            currentValue: breaker.currentValue,
            action: breaker.action,
          }
        );
      } else if (!shouldTrigger && breaker.triggered) {
        // Reset the circuit breaker
        breaker.triggered = false;
        breaker.resetAt = new Date().toISOString();

        await this.emitSafetyEvent("risk", "low", `Circuit breaker reset: ${breaker.name}`, {
          breakerId: breaker.id,
        });
      }
    }
  }

  private shouldTriggerBreaker(breaker: CircuitBreaker): boolean {
    switch (breaker.type) {
      case "loss_limit":
      case "drawdown":
        return breaker.currentValue <= breaker.threshold;
      case "position_count":
      case "exposure":
      case "volatility":
        return breaker.currentValue >= breaker.threshold;
      default:
        return false;
    }
  }

  private async executeCircuitBreakerAction(breaker: CircuitBreaker): Promise<void> {
    switch (breaker.action) {
      case "warn":
        // Just emit warning - no trading restrictions
        logger.warn(`[RiskManager] Warning: ${breaker.name} threshold reached`);
        break;

      case "halt_new":
        // Halt new trades but allow existing ones to continue
        logger.warn(`[RiskManager] Halting new trades due to: ${breaker.name}`);
        // This would integrate with trading system to prevent new trades
        break;

      case "halt_all":
        // Halt all trading activity
        logger.error(`[RiskManager] Halting all trading due to: ${breaker.name}`);
        // This would integrate with trading system to halt everything
        break;

      case "emergency_exit":
        // Immediate emergency halt and potential liquidation
        await this.activateEmergencyHalt(`Circuit breaker: ${breaker.name}`);
        break;
    }
  }

  async assessTradeRisk(
    _symbol: string,
    _type: "buy" | "sell",
    quantity: number,
    price: number
  ): Promise<TradeRiskAssessment> {
    const tradeValue = quantity * price;
    const fees = tradeValue * 0.001; // Estimated fees
    const totalCost = tradeValue + fees;

    // Calculate risk score based on various factors
    let riskScore = 0;
    const reasons: string[] = [];
    const warnings: string[] = [];

    // Position size risk (0-30 points)
    const positionSizeRisk = Math.min(
      (totalCost / this.safetyConfig.riskManagement.maxPositionSize) * 30,
      30
    );
    riskScore += positionSizeRisk;
    if (positionSizeRisk > 20) {
      warnings.push(`Large position size: ${totalCost.toFixed(2)} USDT`);
    }

    // Portfolio concentration risk (0-25 points)
    const newExposure = this.riskMetrics.totalExposure + totalCost;
    const concentrationRisk = Math.min(
      (newExposure / (this.safetyConfig.riskManagement.maxPositionSize * 5)) * 25,
      25
    );
    riskScore += concentrationRisk;

    // Volatility risk (0-20 points)
    const volatilityRisk = (this.riskMetrics.volatilityIndex / 100) * 20;
    riskScore += volatilityRisk;
    if (this.riskMetrics.volatilityIndex > 70) {
      warnings.push("High market volatility detected");
    }

    // Daily P&L risk (0-25 points)
    const pnlRisk =
      (Math.abs(this.riskMetrics.dailyPnL) / this.safetyConfig.riskManagement.maxDailyLoss) * 25;
    riskScore += Math.min(pnlRisk, 25);

    // Check circuit breakers
    const activeBreakers = Array.from(this.circuitBreakers.values()).filter((cb) => cb.triggered);
    if (activeBreakers.length > 0) {
      riskScore += 50; // Major penalty for active circuit breakers
      reasons.push(`Active circuit breakers: ${activeBreakers.map((cb) => cb.name).join(", ")}`);
    }

    // Emergency halt check
    if (this.emergencyHaltActive) {
      return {
        approved: false,
        riskScore: 100,
        reasons: ["Emergency halt is active"],
        warnings: [],
        maxAllowedSize: 0,
        estimatedImpact: {
          newExposure: this.riskMetrics.totalExposure,
          riskIncrease: 0,
          portfolioImpact: 0,
        },
      };
    }

    // Determine approval
    const approved = riskScore < 70 && !this.hasBlockingCircuitBreakers();

    // Calculate max allowed size
    const maxAllowedSize = approved
      ? Math.min(
          this.safetyConfig.riskManagement.maxPositionSize,
          this.safetyConfig.riskManagement.maxPositionSize * 5 - this.riskMetrics.totalExposure
        )
      : 0;

    if (!approved) {
      reasons.push(`Risk score too high: ${riskScore.toFixed(1)}/100`);
    }

    return {
      approved,
      riskScore,
      reasons,
      warnings,
      maxAllowedSize,
      estimatedImpact: {
        newExposure,
        riskIncrease:
          ((newExposure - this.riskMetrics.totalExposure) / this.riskMetrics.totalExposure) * 100,
        portfolioImpact: (totalCost / newExposure) * 100,
      },
    };
  }

  private hasBlockingCircuitBreakers(): boolean {
    return Array.from(this.circuitBreakers.values()).some(
      (cb) =>
        cb.triggered &&
        (cb.action === "halt_new" || cb.action === "halt_all" || cb.action === "emergency_exit")
    );
  }

  async activateEmergencyHalt(reason: string): Promise<void> {
    this.emergencyHaltActive = true;

    const riskEvent: RiskEvent = {
      id: `emergency-${Date.now()}`,
      type: "emergency_halt",
      severity: "critical",
      message: `Emergency halt activated: ${reason}`,
      metrics: this.riskMetrics,
      timestamp: new Date().toISOString(),
      actionTaken: "emergency_halt",
    };

    this.riskEvents.push(riskEvent);

    await this.emitSafetyEvent("risk", "critical", `EMERGENCY HALT ACTIVATED: ${reason}`, {
      reason,
      riskMetrics: this.riskMetrics,
    });

    // Here you would integrate with the trading system to:
    // 1. Cancel all pending orders
    // 2. Close all positions (if configured)
    // 3. Disable all trading functionality
    logger.error(`[RiskManager] EMERGENCY HALT ACTIVATED: ${reason}`);
  }

  async deactivateEmergencyHalt(): Promise<void> {
    this.emergencyHaltActive = false;

    await this.emitSafetyEvent("risk", "medium", "Emergency halt deactivated", {
      riskMetrics: this.riskMetrics,
    });
  }

  private hasSignificantRiskChange(prev: RiskMetrics, current: RiskMetrics): boolean {
    const exposureChange =
      Math.abs(current.totalExposure - prev.totalExposure) / Math.max(prev.totalExposure, 1);
    const pnlChange = Math.abs(current.dailyPnL - prev.dailyPnL);
    const positionChange = current.openPositions !== prev.openPositions;

    return exposureChange > 0.1 || pnlChange > 10 || positionChange;
  }

  async performSafetyCheck(_data: unknown): Promise<{
    passed: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for stale risk data
    const dataAge = Date.now() - this.lastRiskUpdate;
    if (dataAge > 300000) {
      // 5 minutes
      issues.push("Risk metrics are stale (over 5 minutes old)");
      recommendations.push("Update risk metrics more frequently");
    }

    // Check for active circuit breakers
    const activeBreakers = Array.from(this.circuitBreakers.values()).filter((cb) => cb.triggered);
    if (activeBreakers.length > 0) {
      issues.push(`${activeBreakers.length} circuit breaker(s) active`);
      recommendations.push("Address circuit breaker triggers before resuming trading");
    }

    // Check emergency halt status
    if (this.emergencyHaltActive) {
      issues.push("Emergency halt is active");
      recommendations.push("Investigate emergency halt cause and resolve before continuing");
    }

    return {
      passed: issues.length === 0,
      issues,
      recommendations,
    };
  }

  async checkAgentHealth(): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      // Check circuit breaker functionality
      if (this.circuitBreakers.size === 0) {
        issues.push("No circuit breakers configured");
      }

      // Check risk metrics validity
      if (!this.riskMetrics || this.riskMetrics.lastUpdated === "") {
        issues.push("Risk metrics not initialized");
      }

      // Check for excessive risk events
      if (this.riskEvents.length > 1000) {
        issues.push("Excessive risk events - potential memory issue");
      }
    } catch (error) {
      issues.push(`Risk manager health check failed: ${error}`);
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  // Getter methods
  getRiskMetrics(): RiskMetrics {
    return { ...this.riskMetrics };
  }

  getCircuitBreakers(): CircuitBreaker[] {
    return Array.from(this.circuitBreakers.values()).map((cb) => ({ ...cb }));
  }

  getRiskEvents(limit = 50): RiskEvent[] {
    return this.riskEvents.slice(-limit);
  }

  isEmergencyHaltActive(): boolean {
    return this.emergencyHaltActive;
  }

  canExecuteTrade(): boolean {
    return !this.emergencyHaltActive && !this.hasBlockingCircuitBreakers();
  }
}
