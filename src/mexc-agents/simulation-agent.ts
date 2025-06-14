import type { AgentConfig, AgentResponse } from "./base-agent";
import { SafetyBaseAgent, type SafetyConfig } from "./safety-base-agent";

export interface SimulationSession {
  id: string;
  userId: string;
  startTime: string;
  endTime?: string;
  virtualBalance: number;
  currentBalance: number;
  totalTrades: number;
  profitLoss: number;
  winRate: number;
  maxDrawdown: number;
  bestTrade: number;
  worstTrade: number;
  trades: SimulatedTrade[];
}

export interface SimulatedTrade {
  id: string;
  sessionId: string;
  symbol: string;
  type: "buy" | "sell";
  quantity: number;
  price: number;
  value: number; // quantity * price
  timestamp: string;
  fees: number;
  realized: boolean;
  profitLoss?: number;
  exitPrice?: number;
  exitTimestamp?: string;
  strategy: string;
}

export interface SimulationConfig {
  enabled: boolean;
  virtualBalance: number;
  tradingFees: number; // percentage
  slippage: number; // percentage
  marketImpact: number; // percentage for large orders
  delaySimulation: boolean; // simulate real-world delays
  paperTrading: boolean; // use real prices but no real trades
}

export class SimulationAgent extends SafetyBaseAgent {
  private currentSession: SimulationSession | null = null;
  private simulationConfig: SimulationConfig;
  private priceCache: Map<string, number> = new Map();

  constructor(safetyConfig?: Partial<SafetyConfig>) {
    const config: AgentConfig = {
      name: "simulation-agent",
      model: "gpt-4o",
      temperature: 0.1,
      maxTokens: 2000,
      systemPrompt: `You are a trading simulation agent responsible for creating realistic virtual trading environments.

Your responsibilities:
1. Simulate real trading conditions without executing actual trades
2. Apply realistic market conditions (fees, slippage, market impact)
3. Track performance metrics and provide detailed analysis
4. Validate trading strategies in a safe environment
5. Generate realistic market scenarios for strategy testing

Simulation Principles:
- Apply realistic trading fees and slippage
- Simulate market impact for large orders
- Include realistic delays and execution times
- Track comprehensive performance metrics
- Provide detailed trade analysis and recommendations

Always maintain the virtual environment integrity while providing realistic market simulation that helps validate trading strategies before production deployment.`,
    };

    super(config, safetyConfig);

    this.simulationConfig = {
      enabled: this.safetyConfig.simulation.enabled,
      virtualBalance: this.safetyConfig.simulation.virtualBalance,
      tradingFees: 0.001, // 0.1% fees
      slippage: 0.0005, // 0.05% slippage
      marketImpact: 0.001, // 0.1% market impact for large orders
      delaySimulation: true,
      paperTrading: false,
    };
  }

  async process(input: string, context?: Record<string, unknown>): Promise<AgentResponse> {
    const userMessage = `
Simulation Analysis Request:
Current Session: ${this.currentSession ? this.currentSession.id : "None"}
Virtual Balance: ${this.currentSession ? this.currentSession.currentBalance : this.simulationConfig.virtualBalance} USDT
Total Trades: ${this.currentSession ? this.currentSession.totalTrades : 0}

Request: ${input}

Simulation Context:
${JSON.stringify(context, null, 2)}

Please analyze this simulation scenario and provide detailed insights about trading performance, risk metrics, and strategy validation.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async startSimulationSession(
    userId: string,
    initialBalance?: number
  ): Promise<SimulationSession> {
    if (this.currentSession) {
      await this.endSimulationSession();
    }

    const session: SimulationSession = {
      id: `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      startTime: new Date().toISOString(),
      virtualBalance: initialBalance || this.simulationConfig.virtualBalance,
      currentBalance: initialBalance || this.simulationConfig.virtualBalance,
      totalTrades: 0,
      profitLoss: 0,
      winRate: 0,
      maxDrawdown: 0,
      bestTrade: 0,
      worstTrade: 0,
      trades: [],
    };

    this.currentSession = session;

    await this.emitSafetyEvent("simulation", "low", "Simulation session started", {
      sessionId: session.id,
      virtualBalance: session.virtualBalance,
    });

    return session;
  }

  async endSimulationSession(): Promise<SimulationSession | null> {
    if (!this.currentSession) {
      return null;
    }

    this.currentSession.endTime = new Date().toISOString();

    // Calculate final metrics
    this.updateSessionMetrics();

    const completedSession = { ...this.currentSession };

    await this.emitSafetyEvent("simulation", "low", "Simulation session ended", {
      sessionId: completedSession.id,
      duration: Date.parse(completedSession.endTime!) - Date.parse(completedSession.startTime),
      totalTrades: completedSession.totalTrades,
      finalPnL: completedSession.profitLoss,
      winRate: completedSession.winRate,
    });

    this.currentSession = null;
    return completedSession;
  }

  async simulateTrade(
    symbol: string,
    type: "buy" | "sell",
    quantity: number,
    price: number,
    strategy: string
  ): Promise<{
    success: boolean;
    trade?: SimulatedTrade;
    error?: string;
  }> {
    if (!this.currentSession) {
      return {
        success: false,
        error: "No active simulation session",
      };
    }

    // Apply realistic market conditions
    const adjustedPrice = this.applyMarketConditions(price, quantity, type);
    const value = quantity * adjustedPrice;
    const fees = value * this.simulationConfig.tradingFees;
    const totalCost = type === "buy" ? value + fees : value - fees;

    // Check balance for buy orders
    if (type === "buy" && this.currentSession.currentBalance < totalCost) {
      return {
        success: false,
        error: "Insufficient virtual balance",
      };
    }

    // Simulate execution delay
    if (this.simulationConfig.delaySimulation) {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000 + 500));
    }

    const trade: SimulatedTrade = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionId: this.currentSession.id,
      symbol,
      type,
      quantity,
      price: adjustedPrice,
      value,
      timestamp: new Date().toISOString(),
      fees,
      realized: false,
      strategy,
    };

    // Update balance
    if (type === "buy") {
      this.currentSession.currentBalance -= totalCost;
    } else {
      this.currentSession.currentBalance += totalCost;
    }

    this.currentSession.trades.push(trade);
    this.currentSession.totalTrades++;

    this.updateSessionMetrics();

    await this.emitSafetyEvent("simulation", "low", `Simulated ${type} trade executed`, {
      symbol,
      quantity,
      price: adjustedPrice,
      value,
      fees,
      strategy,
    });

    return {
      success: true,
      trade,
    };
  }

  private applyMarketConditions(price: number, quantity: number, type: "buy" | "sell"): number {
    let adjustedPrice = price;

    // Apply slippage
    const slippageAmount = price * this.simulationConfig.slippage;
    adjustedPrice += type === "buy" ? slippageAmount : -slippageAmount;

    // Apply market impact for large orders (simplified)
    const normalOrderSize = 100; // Assume normal order is $100
    if (quantity * price > normalOrderSize * 10) {
      const impactAmount = price * this.simulationConfig.marketImpact;
      adjustedPrice += type === "buy" ? impactAmount : -impactAmount;
    }

    return Math.max(adjustedPrice, 0); // Ensure price doesn't go negative
  }

  private updateSessionMetrics(): void {
    if (!this.currentSession) return;

    const trades = this.currentSession.trades;
    if (trades.length === 0) return;

    // Calculate P&L
    const initialBalance = this.currentSession.virtualBalance;
    this.currentSession.profitLoss = this.currentSession.currentBalance - initialBalance;

    // Calculate win rate (simplified - assumes trades are closed)
    const realizedTrades = trades.filter((t) => t.realized && t.profitLoss !== undefined);
    if (realizedTrades.length > 0) {
      const winners = realizedTrades.filter((t) => (t.profitLoss || 0) > 0);
      this.currentSession.winRate = (winners.length / realizedTrades.length) * 100;

      // Best and worst trades
      const pnls = realizedTrades.map((t) => t.profitLoss || 0);
      this.currentSession.bestTrade = Math.max(...pnls);
      this.currentSession.worstTrade = Math.min(...pnls);
    }

    // Calculate max drawdown (simplified)
    let peak = initialBalance;
    let maxDrawdown = 0;
    for (const _trade of trades) {
      const currentBalance = this.currentSession.currentBalance; // Simplified
      if (currentBalance > peak) {
        peak = currentBalance;
      }
      const drawdown = ((peak - currentBalance) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    this.currentSession.maxDrawdown = maxDrawdown;
  }

  async getCurrentSession(): Promise<SimulationSession | null> {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  async getSessionHistory(_userId: string): Promise<SimulationSession[]> {
    // In a real implementation, this would query the database
    // For now, return empty array as we only track current session
    return [];
  }

  async performSafetyCheck(_data: unknown): Promise<{
    passed: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if simulation mode is properly configured
    if (!this.simulationConfig.enabled && this.currentSession) {
      issues.push("Simulation session active but simulation mode disabled");
      recommendations.push("Enable simulation mode or end current session");
    }

    // Check for unrealistic virtual balance
    if (this.currentSession && this.currentSession.virtualBalance > 100000) {
      issues.push("Virtual balance extremely high - may not reflect realistic conditions");
      recommendations.push("Consider using more realistic virtual balance amounts");
    }

    // Check for too many trades in session
    if (this.currentSession && this.currentSession.totalTrades > 1000) {
      issues.push("Excessive number of trades in simulation session");
      recommendations.push("Consider ending session and analyzing results");
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
      // Check if agent can process requests
      const testResponse = await this.process("Health check test");
      if (!testResponse.content) {
        issues.push("Agent unable to process requests");
      }

      // Check simulation configuration
      if (!this.simulationConfig) {
        issues.push("Simulation configuration not loaded");
      }

      // Check for memory issues with large session
      if (this.currentSession && this.currentSession.trades.length > 10000) {
        issues.push("Current session has excessive trades - potential memory issue");
      }
    } catch (error) {
      issues.push(`Agent health check failed: ${error}`);
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  // Utility methods for integration with existing system
  isSimulationEnabled(): boolean {
    return this.simulationConfig.enabled;
  }

  toggleSimulation(enabled: boolean): void {
    this.simulationConfig.enabled = enabled;
    this.emitSafetyEvent(
      "simulation",
      "low",
      `Simulation mode ${enabled ? "enabled" : "disabled"}`,
      { enabled }
    );
  }

  updateSimulationConfig(config: Partial<SimulationConfig>): void {
    this.simulationConfig = { ...this.simulationConfig, ...config };
    this.emitSafetyEvent("simulation", "low", "Simulation configuration updated", {
      newConfig: this.simulationConfig,
    });
  }

  getSimulationConfig(): SimulationConfig {
    return { ...this.simulationConfig };
  }
}
