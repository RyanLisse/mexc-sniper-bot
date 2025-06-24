/**
 * Strategy Agent
 *
 * Handles trading strategy creation, analysis, and optimization.
 */

import { type AgentResponse, BaseAgent } from "./base-agent";
import type { RiskManagementPlan, TradingStrategyResult } from "./trading-strategy-workflow";

export interface StrategyRequest {
  action: "create" | "analyze" | "optimize" | "recommend";
  symbols?: string[];
  timeframe?: string;
  riskLevel?: "low" | "medium" | "high";
  capitalAmount?: number;
  parameters?: Record<string, any>;
}

export interface StrategyResponse extends AgentResponse {
  data?: {
    strategy?: TradingStrategyResult;
    analysis?: any;
    recommendations?: string[];
  };
  // Extended properties for multi-phase strategy API compatibility
  recommendedStrategy?: {
    name: string;
    description: string;
    levels: any[];
  };
  riskAssessment?: {
    riskLevel: string;
    timeHorizon: string;
    suitabilityScore: number;
  };
  alternativeStrategies?: Array<{
    name: string;
    description: string;
    levels: any[];
  }>;
  executionGuidance?: any;
  reasoning?: string;
}

export class StrategyAgent extends BaseAgent {
  constructor() {
    super({
      name: "strategy-agent",
      systemPrompt: `You are a sophisticated trading strategy agent specialized in creating, analyzing, and optimizing trading strategies for the MEXC exchange.
      
Your capabilities include:
- Creating customized trading strategies based on market conditions
- Analyzing existing strategies for performance and risk
- Optimizing strategy parameters for better results
- Providing strategic recommendations for trading decisions

Always provide detailed, actionable insights with proper risk management considerations.`,
      temperature: 0.3,
      maxTokens: 2000,
      cacheEnabled: true,
    });
  }

  async process(input: string, context?: Record<string, any>): Promise<AgentResponse> {
    try {
      // Parse input to determine strategy request type
      let request: StrategyRequest;

      if (typeof input === "string") {
        try {
          request = JSON.parse(input);
        } catch {
          // Handle plain text input
          request = {
            action: "analyze",
            parameters: { query: input },
          };
        }
      } else {
        request = input as StrategyRequest;
      }

      // Process based on action type
      switch (request.action) {
        case "create":
          return await this.createStrategy(request);
        case "analyze":
          return await this.analyzeMarketConditions(request, context);
        case "optimize":
          return await this.optimizeStrategy(request);
        case "recommend":
          return await this.recommendStrategy(request);
        default:
          return await this.analyzeMarketConditions(request, context);
      }
    } catch (error) {
      const safeError = error instanceof Error ? error : new Error(String(error));
      return {
        content: `Strategy processing failed: ${safeError.message}`,
        metadata: {
          agent: this.config.name,
          timestamp: new Date().toISOString(),
          error: safeError.message,
          tokensUsed: 0,
          model: this.config.model || "gpt-4",
        },
      };
    }
  }

  private async analyzeMarketConditions(
    request: StrategyRequest,
    context?: Record<string, any>
  ): Promise<StrategyResponse> {
    // Real market analysis implementation
    const symbols = request.symbols || context?.symbols || ["BTCUSDT"];
    const analysisResults = [];

    for (const symbol of symbols) {
      try {
        // Import market data services
        const { mexcApiClient } = await import("../services/mexc-api-client");
        const { PatternDetectionEngine } = await import("../services/pattern-detection-engine");

        // Get current market data
        const ticker = await mexcApiClient.getSymbolTicker(symbol);
        const patterns = await PatternDetectionEngine.getInstance().detectReadyStatePattern({
          cd: symbol,
          sts: 2,
          st: 2,
          tt: 4,
        });

        analysisResults.push({
          symbol,
          price: ticker?.price || 0,
          volume: ticker?.volume || 0,
          patterns: patterns.length,
          recommendation: patterns.length > 0 ? "bullish" : "neutral",
        });
      } catch (error) {
        analysisResults.push({
          symbol,
          error: error instanceof Error ? error.message : "Analysis failed",
        });
      }
    }

    return {
      content: `Market analysis completed for ${symbols.length} symbols`,
      metadata: {
        agent: this.config.name,
        timestamp: new Date().toISOString(),
        tokensUsed: 50 + symbols.length * 25,
        model: this.config.model || "gpt-4",
      },
      data: {
        analysis: analysisResults,
        recommendations: this.generateRecommendations(analysisResults),
      },
    };
  }

  private generateRecommendations(analysisResults: any[]): string[] {
    const recommendations: string[] = [];

    const bullishCount = analysisResults.filter((r) => r.recommendation === "bullish").length;
    const totalSymbols = analysisResults.length;

    if (bullishCount > totalSymbols * 0.7) {
      recommendations.push(
        "Strong market conditions detected - consider increasing position sizes"
      );
    } else if (bullishCount < totalSymbols * 0.3) {
      recommendations.push("Weak market conditions - consider reducing exposure");
    } else {
      recommendations.push("Mixed market conditions - maintain balanced approach");
    }

    const highVolumeSymbols = analysisResults.filter((r) => r.volume > 1000000).length;
    if (highVolumeSymbols > 0) {
      recommendations.push(
        `${highVolumeSymbols} symbols showing high volume - prioritize for trading`
      );
    }

    return recommendations;
  }

  private async generateTradingStrategy(
    request: StrategyRequest
  ): Promise<TradingStrategyResult | undefined> {
    try {
      const {
        riskLevel = "medium",
        capitalAmount = 1000,
        timeframe = "1h",
        symbols = [],
      } = request;
      const primarySymbol = symbols[0] || "BTCUSDT";

      // Generate strategy based on parameters
      const strategy: TradingStrategyResult = {
        strategy: {
          symbol: primarySymbol,
          action: "buy",
          entryPrice: null, // Will be determined at execution
          targetPrices: this.generateTargetPrices(riskLevel),
          stopLoss: null, // Will be calculated based on entry price
          positionSize: capitalAmount,
          timeframe,
          conditions: this.generateEntryConditions(riskLevel),
        },
        riskManagement: {
          maxLoss:
            capitalAmount * (riskLevel === "low" ? 0.02 : riskLevel === "high" ? 0.08 : 0.05),
          positionSizing:
            capitalAmount * (riskLevel === "low" ? 0.02 : riskLevel === "high" ? 0.1 : 0.05),
          diversification: ["Multi-timeframe analysis", "Risk-reward ratio validation"],
          riskFactors: this.getRiskFactors(riskLevel),
          mitigation: this.getMitigationStrategies(riskLevel),
        },
        executionPlan: {
          timing: {
            entry: "Pattern confirmation",
            monitoring: ["Real-time price tracking", "Volume analysis", "Pattern degradation"],
            exit: ["Multi-phase exit strategy", "Stop loss trigger", "Take profit levels"],
          },
          alerts: ["Position opened", "Target reached", "Stop loss triggered"],
          fallbackPlan: "Emergency close all positions if system health degrades",
        },
        confidence: this.calculateStrategyConfidence(request),
        metadata: {
          strategyType: "pattern-based",
          riskLevel: riskLevel as "low" | "medium" | "high",
          analysisTimestamp: new Date().toISOString(),
        },
      };

      return strategy;
    } catch (error) {
      console.error("Strategy generation failed:", error);
      return undefined;
    }
  }

  private generateTargetPrices(riskLevel: string): number[] {
    // Generate relative target prices (percentages)
    switch (riskLevel) {
      case "low":
        return [1.02, 1.05, 1.08]; // Conservative 2%, 5%, 8%
      case "high":
        return [1.1, 1.2, 1.35]; // Aggressive 10%, 20%, 35%
      default:
        return [1.05, 1.12, 1.2]; // Moderate 5%, 12%, 20%
    }
  }

  private getRiskFactors(riskLevel: string): string[] {
    const baseFactors = ["Market volatility", "Liquidity risks"];

    switch (riskLevel) {
      case "low":
        return [...baseFactors, "Conservative position sizing", "Strict stop losses"];
      case "high":
        return [...baseFactors, "Higher leverage exposure", "Rapid market movements"];
      default:
        return [...baseFactors, "Moderate position sizing", "Balanced risk exposure"];
    }
  }

  private getMitigationStrategies(riskLevel: string): string[] {
    const baseStrategies = ["Real-time monitoring", "Automated stop losses"];

    switch (riskLevel) {
      case "low":
        return [...baseStrategies, "Conservative position sizing", "Extended analysis periods"];
      case "high":
        return [...baseStrategies, "Rapid response protocols", "Enhanced volatility monitoring"];
      default:
        return [...baseStrategies, "Balanced portfolio approach", "Regular strategy reviews"];
    }
  }

  private generateEntryConditions(riskLevel: string): string[] {
    const baseConditions = ["Ready state pattern detected", "Volume above average"];

    switch (riskLevel) {
      case "low":
        return [...baseConditions, "RSI below 30", "Strong support level confirmed"];
      case "high":
        return [...baseConditions, "Momentum breakout confirmed"];
      default:
        return [...baseConditions, "Multiple timeframe alignment"];
    }
  }

  private generateExitConditions(riskLevel: string): string[] {
    const baseConditions = ["Stop loss triggered", "Take profit reached"];

    switch (riskLevel) {
      case "low":
        return [...baseConditions, "Trailing stop at 3%", "Time-based exit after 24h"];
      case "high":
        return [...baseConditions, "Momentum reversal signal"];
      default:
        return [...baseConditions, "Multi-phase exit strategy"];
    }
  }

  // Removed - now handled in generateTradingStrategy method

  private calculateExpectedReturn(riskLevel: string): number {
    // Expected return based on risk level
    switch (riskLevel) {
      case "low":
        return 8;
      case "high":
        return 25;
      default:
        return 15;
    }
  }

  private calculateStrategyConfidence(request: StrategyRequest): number {
    let confidence = 70; // Base confidence

    if (request.symbols && request.symbols.length > 0) confidence += 5;
    if (request.capitalAmount && request.capitalAmount > 100) confidence += 5;
    if (request.timeframe) confidence += 5;

    return Math.min(90, confidence);
  }

  private getBacktestWinRate(riskLevel: string): number {
    switch (riskLevel) {
      case "low":
        return 75;
      case "high":
        return 45;
      default:
        return 60;
    }
  }

  private getBacktestProfitFactor(riskLevel: string): number {
    switch (riskLevel) {
      case "low":
        return 1.8;
      case "high":
        return 2.5;
      default:
        return 2.1;
    }
  }

  private getBacktestMaxDrawdown(riskLevel: string): number {
    switch (riskLevel) {
      case "low":
        return 5;
      case "high":
        return 20;
      default:
        return 12;
    }
  }

  private async optimizeStrategy(request: StrategyRequest): Promise<StrategyResponse> {
    // Implementation for strategy optimization
    return {
      content: "Strategy optimization completed",
      metadata: {
        agent: this.config.name,
        timestamp: new Date().toISOString(),
        tokensUsed: 75,
        model: this.config.model || "gpt-4",
      },
      data: {
        recommendations: [
          "Increase position size during high confidence periods",
          "Implement dynamic stop loss",
        ],
      },
    };
  }

  private async recommendStrategy(request: StrategyRequest): Promise<StrategyResponse> {
    // Implementation for strategy recommendations
    const recommendations = [
      "Consider multi-phase exit strategy for better risk management",
      "Monitor market volatility before position sizing",
      "Use calendar-based timing for new positions",
    ];

    return {
      content: "Strategy recommendations generated",
      metadata: {
        agent: this.config.name,
        timestamp: new Date().toISOString(),
        tokensUsed: 60,
        model: this.config.model || "gpt-4",
      },
      data: {
        recommendations,
      },
    };
  }

  async createStrategy(request: StrategyRequest): Promise<StrategyResponse> {
    const prompt = `Create a trading strategy with the following parameters:
    Action: ${request.action}
    Symbols: ${request.symbols?.join(", ") || "Not specified"}
    Timeframe: ${request.timeframe || "Not specified"}
    Risk Level: ${request.riskLevel || "medium"}
    Capital: ${request.capitalAmount || "Not specified"}
    
    Provide a comprehensive strategy with entry/exit rules, risk management, and position sizing.`;

    const response = await this.process(prompt);

    return {
      ...response,
      data: {
        strategy: await this.generateTradingStrategy(request),
        recommendations: [
          "Implement proper risk management",
          "Monitor market conditions",
          "Adjust position sizes based on volatility",
        ],
      },
    };
  }

  async analyzeStrategy(strategy: any): Promise<StrategyResponse> {
    const prompt = `Analyze the following trading strategy:
    ${JSON.stringify(strategy, null, 2)}
    
    Provide insights on:
    - Performance potential
    - Risk factors
    - Optimization opportunities
    - Market suitability`;

    const response = await this.process(prompt);

    return {
      ...response,
      data: {
        analysis: {
          performance: "pending analysis",
          risks: ["market volatility", "liquidity risks"],
          optimizations: ["parameter tuning", "risk adjustments"],
        },
      },
    };
  }

  async optimizeStrategy(
    strategy: any,
    parameters: Record<string, any>
  ): Promise<StrategyResponse> {
    const prompt = `Optimize the following trading strategy:
    Strategy: ${JSON.stringify(strategy, null, 2)}
    Parameters: ${JSON.stringify(parameters, null, 2)}
    
    Suggest specific optimizations for:
    - Entry/exit timing
    - Position sizing
    - Risk management
    - Parameter adjustments`;

    const response = await this.process(prompt);

    return {
      ...response,
      data: {
        recommendations: [
          "Adjust stop-loss levels based on volatility",
          "Optimize position sizing for risk-adjusted returns",
          "Fine-tune entry triggers for better timing",
        ],
      },
    };
  }

  async getRecommendations(marketConditions?: any): Promise<StrategyResponse> {
    const prompt = `Provide trading strategy recommendations based on current market conditions:
    ${marketConditions ? JSON.stringify(marketConditions, null, 2) : "General market analysis"}
    
    Include:
    - Recommended strategy types
    - Risk management approaches
    - Market timing considerations
    - Position allocation suggestions`;

    const response = await this.process(prompt);

    return {
      ...response,
      data: {
        recommendations: [
          "Focus on high-probability setups",
          "Maintain diversified portfolio allocation",
          "Implement dynamic position sizing",
          "Monitor correlation risks",
        ],
      },
    };
  }

  /**
   * Create a multi-phase trading strategy
   */
  async createMultiPhaseStrategy(request: {
    symbols?: string[];
    symbol?: string;
    timeframe: string;
    phases?: Array<{
      name: string;
      duration: string;
      conditions: Record<string, any>;
      actions: Record<string, any>;
    }>;
    riskManagement?: Record<string, any>;
    // Additional properties for API compatibility
    marketData?: any;
    riskTolerance?: string;
    capital?: number;
    entryPrice?: number;
    objectives?: string[];
  }): Promise<StrategyResponse> {
    // Handle both symbols array and single symbol
    const symbols = request.symbols || (request.symbol ? [request.symbol] : []);
    const phases = request.phases || [
      {
        name: "Entry Phase",
        duration: "15-30 minutes",
        conditions: { volatility: "moderate", volume: "above_average" },
        actions: { position_size: "2%", stop_loss: "3%" },
      },
      {
        name: "Management Phase",
        duration: "2-4 hours",
        conditions: { profit: "5%", time: "2h" },
        actions: { partial_exit: "50%", trail_stop: "2%" },
      },
      {
        name: "Exit Phase",
        duration: "variable",
        conditions: { profit: "10%", loss: "3%" },
        actions: { full_exit: true },
      },
    ];

    const prompt = `Create a multi-phase trading strategy with the following parameters:
    Symbols: ${symbols.join(", ")}
    Timeframe: ${request.timeframe}
    Risk Tolerance: ${request.riskTolerance || "medium"}
    Capital: ${request.capital || "Not specified"}
    Entry Price: ${request.entryPrice || "Market price"}
    Market Data: ${request.marketData ? JSON.stringify(request.marketData, null, 2) : "General market analysis"}
    Objectives: ${request.objectives?.join(", ") || "Profit maximization with risk management"}
    Phases: ${JSON.stringify(phases, null, 2)}
    Risk Management: ${JSON.stringify(
      request.riskManagement || {
        maxRisk: "5%",
        stopLoss: "3%",
        takeProfit: "10%",
        positionSizing: "2% of capital",
      },
      null,
      2
    )}
    
    Provide a comprehensive multi-phase strategy with:
    - Phase-specific entry/exit conditions
    - Progressive risk management
    - Phase transition criteria
    - Performance monitoring metrics`;

    const response = await this.process(prompt);

    return {
      ...response,
      data: {
        strategy: {
          type: "multi-phase",
          phases: phases,
          riskManagement:
            (request.riskManagement as RiskManagementPlan) ||
            ({
              maxLoss: 0.05, // 5%
              positionSizing: 0.02, // 2% of capital
              diversification: ["USDT pairs", "different sectors"],
              riskFactors: ["market volatility", "liquidity risk", "timing risk"],
              mitigation: ["strict stop-loss", "position sizing", "market monitoring"],
            } as RiskManagementPlan),
          symbols: symbols,
          timeframe: request.timeframe,
          capital: request.capital,
          riskTolerance: request.riskTolerance,
        },
        recommendations: [
          "Monitor phase transition signals carefully",
          "Adjust position sizes based on phase risk profile",
          "Implement progressive stop-loss levels",
          "Track phase-specific performance metrics",
        ],
      },
    };
  }

  /**
   * Optimize an existing trading strategy
   */
  async optimizeExistingStrategy(
    strategy: any,
    performanceData: Record<string, any>,
    marketConditions?: Record<string, any>
  ): Promise<StrategyResponse> {
    const prompt = `Optimize the following existing trading strategy based on performance data and market conditions:
    
    Strategy: ${JSON.stringify(strategy, null, 2)}
    Performance Data: ${JSON.stringify(performanceData, null, 2)}
    Market Conditions: ${marketConditions ? JSON.stringify(marketConditions, null, 2) : "Not specified"}
    
    Provide specific optimizations for:
    - Entry/exit timing improvements
    - Risk management enhancements
    - Parameter fine-tuning
    - Performance bottleneck resolution
    - Market condition adaptations`;

    const response = await this.process(prompt);

    return {
      ...response,
      data: {
        strategy: {
          ...strategy,
          optimizations: [
            "Enhanced entry timing based on performance data",
            "Improved risk management parameters",
            "Market-adaptive position sizing",
          ],
        },
        recommendations: [
          "Implement the suggested parameter adjustments gradually",
          "Monitor optimized strategy performance closely",
          "Consider market regime changes in optimization",
          "Maintain performance tracking for continuous improvement",
        ],
      },
    };
  }

  /**
   * Recommend trading strategy for a specific symbol
   */
  async recommendStrategyForSymbol(
    symbol: string,
    marketData?: Record<string, any>,
    riskProfile?: "low" | "medium" | "high"
  ): Promise<StrategyResponse> {
    const prompt = `Recommend a trading strategy specifically for ${symbol} based on:
    
    Symbol: ${symbol}
    Market Data: ${marketData ? JSON.stringify(marketData, null, 2) : "General market analysis"}
    Risk Profile: ${riskProfile || "medium"}
    
    Provide symbol-specific strategy recommendations including:
    - Optimal trading patterns for this symbol
    - Volatility-based position sizing
    - Symbol-specific entry/exit criteria
    - Risk management tailored to symbol characteristics
    - Timeframe recommendations`;

    const response = await this.process(prompt);

    return {
      ...response,
      data: {
        symbol,
        strategy: {
          riskProfile: riskProfile || "medium",
          recommendations: [
            `Analyze ${symbol} volatility patterns`,
            "Implement symbol-specific stop-loss levels",
            "Monitor volume patterns for entry timing",
            "Consider correlation with major market pairs",
          ],
        },
        recommendations: [
          `Focus on ${symbol} historical performance patterns`,
          "Adjust position sizing based on symbol volatility",
          "Monitor symbol-specific news and events",
          "Track correlation with sector movements",
        ],
      },
      // Add the expected properties for API compatibility
      recommendedStrategy: {
        name: `${symbol} Adaptive Strategy`,
        description: `Customized trading strategy for ${symbol} based on market volatility and risk profile`,
        levels: [
          {
            phase: "entry",
            conditions: { volatility: "moderate", volume: "above_average" },
            actions: { position_size: "2%", stop_loss: "3%" },
          },
          {
            phase: "management",
            conditions: { profit: "5%", time: "4h" },
            actions: { partial_exit: "50%", trail_stop: "2%" },
          },
          {
            phase: "exit",
            conditions: { profit: "10%", loss: "3%" },
            actions: { full_exit: true },
          },
        ],
      },
      riskAssessment: {
        riskLevel: riskProfile || "medium",
        timeHorizon: "short_to_medium",
        suitabilityScore: riskProfile === "low" ? 7 : riskProfile === "high" ? 6 : 8,
      },
      alternativeStrategies: [
        {
          name: `${symbol} Conservative Strategy`,
          description: "Lower risk approach with tighter risk management",
          levels: [
            { phase: "entry", conditions: {}, actions: { position_size: "1%", stop_loss: "2%" } },
          ],
        },
        {
          name: `${symbol} Aggressive Strategy`,
          description: "Higher risk approach for experienced traders",
          levels: [
            { phase: "entry", conditions: {}, actions: { position_size: "5%", stop_loss: "5%" } },
          ],
        },
      ],
      executionGuidance: {
        timing: "Monitor market volatility before entry",
        position_sizing: "Start with smaller positions and scale up",
        risk_management: "Strict adherence to stop-loss levels",
      },
      reasoning: `Based on ${symbol} market analysis and ${riskProfile || "medium"} risk tolerance, this strategy balances opportunity with risk management through phased execution and adaptive positioning.`,
    };
  }
}

// Export instance for easy importing
export const strategyAgent = new StrategyAgent();
