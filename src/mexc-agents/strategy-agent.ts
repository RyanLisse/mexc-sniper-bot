import {
  PREDEFINED_STRATEGIES,
  type TradingStrategyConfig,
} from "../services/multi-phase-trading-service";
import { type AgentConfig, type AgentResponse, BaseAgent } from "./base-agent";

export interface StrategyRequest {
  marketData: string;
  riskTolerance?: "low" | "medium" | "high";
  timeframe?: "short" | "medium" | "long";
  capital?: number;
  objectives?: string[];
  symbol?: string;
  entryPrice?: number;
  positionSize?: number;
  marketVolatility?: "low" | "medium" | "high";
  tradingStyle?: "conservative" | "balanced" | "aggressive" | "scalping" | "diamond";
}

export interface MultiPhaseStrategyRecommendation {
  recommendedStrategy: TradingStrategyConfig;
  alternativeStrategies: TradingStrategyConfig[];
  reasoning: string;
  riskAssessment: {
    riskLevel: "low" | "medium" | "high";
    maxDrawdownEstimate: number;
    timeHorizon: string;
    suitabilityScore: number;
  };
  executionGuidance: {
    optimalEntryConditions: string[];
    monitoringPoints: string[];
    exitCriteria: string[];
    riskManagement: string[];
  };
}

export class StrategyAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: "strategy-agent",
      model: "gpt-4o",
      temperature: 0.3,
      maxTokens: 3000,
      systemPrompt: `You are an expert multi-phase trading strategy agent specializing in cryptocurrency trading strategies, portfolio management, and advanced exit strategies.

Your core expertise:
1. Multi-Phase Take Profit Strategies - Design strategies that exit positions in multiple phases to optimize profit realization
2. Risk-Adjusted Position Sizing - Calculate optimal position sizes based on risk tolerance and market conditions
3. Dynamic Strategy Adaptation - Adapt strategies based on market volatility and trading timeframes
4. Advanced Exit Mechanisms - Create sophisticated exit criteria beyond simple take-profit/stop-loss

Multi-Phase Strategy Framework:
- Phase-Based Exits: Design 3-6 exit phases with specific price targets and position percentages
- Progressive Profit Taking: Balance early profit securing with upside potential
- Risk Management Integration: Incorporate stop-loss and trailing stops with multi-phase exits
- Market Condition Adaptation: Adjust targets based on volatility and trend strength
- Performance Optimization: Maximize risk-adjusted returns through strategic position sizing

Available Strategy Templates:
1. Conservative (10%, 20%, 30% targets) - Early profit taking, low risk
2. Normal (50%, 100%, 125%, 175% targets) - Balanced approach
3. Aggressive (100%, 150%, 200%, 300% targets) - High risk, high reward
4. Scalping (5%, 10%, 15%, 20% targets) - Quick profits, tight stops
5. Diamond Hands (200%, 500%, 1000%, 2000% targets) - Long-term holds

Strategy Recommendation Process:
1. Analyze market conditions and user preferences
2. Select appropriate base template or create custom strategy
3. Adjust targets based on volatility and risk tolerance
4. Provide specific entry criteria and monitoring guidelines
5. Include risk management and position sizing recommendations

Output Requirements:
- Recommended multi-phase strategy with specific targets and percentages
- Alternative strategy options for different risk profiles
- Detailed reasoning for strategy selection
- Risk assessment with estimated max drawdown and time horizon
- Execution guidance with entry/exit criteria and monitoring points

Always recommend strategies that:
- Have realistic and achievable targets based on market analysis
- Include proper risk management with position sizing
- Provide clear monitoring and adjustment criteria
- Balance profit potential with capital preservation`,
    };
    super(config);
  }

  async process(input: string, context?: Record<string, unknown>): Promise<AgentResponse> {
    const request: StrategyRequest = (context as unknown as StrategyRequest) || {
      marketData: input,
      riskTolerance: "medium",
      timeframe: "medium",
    };

    const userMessage = `
Strategy Development Request:
Risk Tolerance: ${request.riskTolerance || "medium"}
Timeframe: ${request.timeframe || "medium-term"}
${request.capital ? `Available Capital: $${request.capital}` : ""}
${request.objectives ? `Objectives: ${request.objectives.join(", ")}` : ""}

Market Data and Analysis:
${request.marketData}

Please develop a comprehensive trading strategy with specific entry/exit criteria, risk management, and execution guidelines.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async createTradingStrategy(
    marketData: string,
    riskTolerance: "low" | "medium" | "high" = "medium",
    timeframe: "short" | "medium" | "long" = "medium"
  ): Promise<AgentResponse> {
    return await this.process(marketData, {
      marketData,
      riskTolerance,
      timeframe,
      objectives: ["capital preservation", "consistent returns", "risk-adjusted growth"],
    });
  }

  async optimizePortfolio(marketData: string, capital: number): Promise<AgentResponse> {
    return await this.process(marketData, {
      marketData,
      capital,
      riskTolerance: "medium",
      timeframe: "long",
      objectives: ["diversification", "risk optimization", "return maximization"],
    });
  }

  async generateRiskManagement(marketData: string): Promise<AgentResponse> {
    return await this.process(marketData, {
      marketData,
      riskTolerance: "medium",
      objectives: ["capital preservation", "drawdown minimization", "risk control"],
    });
  }

  // New multi-phase strategy methods
  async createMultiPhaseStrategy(request: StrategyRequest): Promise<AgentResponse> {
    const userMessage = `
Multi-Phase Strategy Creation Request:

Market Analysis:
${request.marketData}

Trading Parameters:
- Symbol: ${request.symbol || "Not specified"}
- Entry Price: ${request.entryPrice ? `$${request.entryPrice}` : "Not specified"}
- Position Size: ${request.positionSize ? `${request.positionSize} units` : "Not specified"}
- Capital: ${request.capital ? `$${request.capital}` : "Not specified"}
- Risk Tolerance: ${request.riskTolerance || "medium"}
- Timeframe: ${request.timeframe || "medium"}
- Market Volatility: ${request.marketVolatility || "medium"}
- Preferred Style: ${request.tradingStyle || "balanced"}

Objectives: ${request.objectives?.join(", ") || "Balanced risk-reward optimization"}

Please create a comprehensive multi-phase trading strategy with:
1. Specific phase targets (percentage gains and position sizes to sell)
2. Risk assessment and management guidelines
3. Entry and monitoring criteria
4. Alternative strategy options
5. Execution guidance and best practices

Format your response as a structured strategy recommendation with clear actionable steps.
`;

    return await this.callOpenAI([{ role: "user", content: userMessage }]);
  }

  async optimizeExistingStrategy(
    currentStrategy: TradingStrategyConfig,
    marketConditions: string,
    performanceData?: string
  ): Promise<AgentResponse> {
    const userMessage = `
Strategy Optimization Request:

Current Strategy: ${currentStrategy.name}
Description: ${currentStrategy.description || "No description provided"}

Current Phases:
${currentStrategy.levels
  .map(
    (level, index) =>
      `Phase ${index + 1}: ${level.sellPercentage}% at +${level.percentage}% (${level.multiplier}x)`
  )
  .join("\n")}

Market Conditions:
${marketConditions}

Performance Data:
${performanceData || "No performance data available"}

Please analyze the current strategy and provide:
1. Optimization recommendations for better performance
2. Adjustments for current market conditions
3. Risk improvement suggestions
4. Alternative phase configurations
5. Specific changes with reasoning

Focus on maintaining the strategy's core philosophy while improving risk-adjusted returns.
`;

    return await this.callOpenAI([{ role: "user", content: userMessage }]);
  }

  async recommendStrategyForSymbol(
    symbol: string,
    marketData: string,
    userPreferences: {
      riskTolerance: "low" | "medium" | "high";
      capital: number;
      timeframe: "short" | "medium" | "long";
    }
  ): Promise<MultiPhaseStrategyRecommendation> {
    const request: StrategyRequest = {
      marketData,
      symbol,
      riskTolerance: userPreferences.riskTolerance,
      timeframe: userPreferences.timeframe,
      capital: userPreferences.capital,
      objectives: ["profit maximization", "risk management", "capital efficiency"],
    };

    const response = await this.createMultiPhaseStrategy(request);

    // Parse AI response and create structured recommendation
    // In a real implementation, you would parse the AI response more intelligently
    // For now, we'll create a recommendation based on user preferences

    let baseStrategy: TradingStrategyConfig;
    const alternatives: TradingStrategyConfig[] = [];

    // Select base strategy based on risk tolerance
    switch (userPreferences.riskTolerance) {
      case "low":
        baseStrategy = PREDEFINED_STRATEGIES.conservative;
        alternatives.push(PREDEFINED_STRATEGIES.normal, PREDEFINED_STRATEGIES.scalping);
        break;
      case "medium":
        baseStrategy = PREDEFINED_STRATEGIES.normal;
        alternatives.push(PREDEFINED_STRATEGIES.conservative, PREDEFINED_STRATEGIES.aggressive);
        break;
      case "high":
        baseStrategy = PREDEFINED_STRATEGIES.aggressive;
        alternatives.push(PREDEFINED_STRATEGIES.normal, PREDEFINED_STRATEGIES.diamond);
        break;
      default:
        baseStrategy = PREDEFINED_STRATEGIES.normal;
        alternatives.push(PREDEFINED_STRATEGIES.conservative, PREDEFINED_STRATEGIES.aggressive);
    }

    // Adjust strategy for timeframe
    if (userPreferences.timeframe === "short") {
      baseStrategy = PREDEFINED_STRATEGIES.scalping;
      alternatives.unshift(PREDEFINED_STRATEGIES.conservative);
    } else if (userPreferences.timeframe === "long") {
      if (userPreferences.riskTolerance === "high") {
        baseStrategy = PREDEFINED_STRATEGIES.diamond;
      }
    }

    return {
      recommendedStrategy: baseStrategy,
      alternativeStrategies: alternatives.slice(0, 3),
      reasoning: response.content,
      riskAssessment: {
        riskLevel: userPreferences.riskTolerance,
        maxDrawdownEstimate: this.estimateMaxDrawdown(baseStrategy, userPreferences.riskTolerance),
        timeHorizon: this.getTimeHorizon(baseStrategy, userPreferences.timeframe),
        suitabilityScore: this.calculateSuitabilityScore(baseStrategy, userPreferences),
      },
      executionGuidance: {
        optimalEntryConditions: this.getEntryConditions(baseStrategy),
        monitoringPoints: this.getMonitoringPoints(baseStrategy),
        exitCriteria: this.getExitCriteria(baseStrategy),
        riskManagement: this.getRiskManagement(baseStrategy, userPreferences.capital),
      },
    };
  }

  // Helper methods for strategy analysis
  private estimateMaxDrawdown(strategy: TradingStrategyConfig, riskLevel: string): number {
    const avgTarget =
      strategy.levels.reduce((sum, level) => sum + level.percentage, 0) / strategy.levels.length;
    const baseDrawdown = avgTarget * 0.2; // 20% of average target as baseline

    const riskMultipliers = { low: 0.5, medium: 1.0, high: 1.5 };
    return baseDrawdown * (riskMultipliers[riskLevel as keyof typeof riskMultipliers] || 1.0);
  }

  private getTimeHorizon(strategy: TradingStrategyConfig, timeframe: string): string {
    const maxTarget = Math.max(...strategy.levels.map((l) => l.percentage));

    if (timeframe === "short" || maxTarget < 50) return "1-7 days";
    if (timeframe === "medium" || maxTarget < 200) return "1-4 weeks";
    return "1-3 months";
  }

  private calculateSuitabilityScore(strategy: TradingStrategyConfig, preferences: any): number {
    let score = 80; // Base score

    const avgTarget =
      strategy.levels.reduce((sum, level) => sum + level.percentage, 0) / strategy.levels.length;

    // Adjust based on risk tolerance alignment
    if (preferences.riskTolerance === "low" && avgTarget < 50) score += 15;
    if (preferences.riskTolerance === "medium" && avgTarget >= 50 && avgTarget < 150) score += 15;
    if (preferences.riskTolerance === "high" && avgTarget >= 150) score += 15;

    // Adjust based on timeframe alignment
    if (preferences.timeframe === "short" && strategy.id === "scalping") score += 10;
    if (preferences.timeframe === "long" && avgTarget > 200) score += 10;

    return Math.min(100, score);
  }

  private getEntryConditions(strategy: TradingStrategyConfig): string[] {
    const conditions = [
      "Confirm upward trend with technical indicators",
      "Verify adequate volume and liquidity",
      "Check market sentiment and news catalysts",
    ];

    if (strategy.id === "scalping") {
      conditions.push("Ensure tight spreads and low slippage");
      conditions.push("Monitor for short-term momentum signals");
    } else if (strategy.id === "diamond") {
      conditions.push("Identify strong fundamental catalysts");
      conditions.push("Confirm long-term trend alignment");
    }

    return conditions;
  }

  private getMonitoringPoints(strategy: TradingStrategyConfig): string[] {
    const points = [
      "Track price progress toward phase targets",
      "Monitor volume and momentum indicators",
      "Watch for trend reversal signals",
    ];

    strategy.levels.forEach((level, index) => {
      points.push(`Phase ${index + 1}: Monitor at +${level.percentage}% target`);
    });

    return points;
  }

  private getExitCriteria(strategy: TradingStrategyConfig): string[] {
    const criteria = [
      "Execute phases automatically at target prices",
      "Monitor stop-loss levels continuously",
      "Watch for trend breakdown signals",
    ];

    const maxTarget = Math.max(...strategy.levels.map((l) => l.percentage));
    if (maxTarget > 500) {
      criteria.push("Consider partial exits on major resistance levels");
      criteria.push("Implement trailing stops for remaining position");
    }

    return criteria;
  }

  private getRiskManagement(strategy: TradingStrategyConfig, capital: number): string[] {
    const management = [
      `Risk no more than 2-5% of total capital ($${(capital * 0.05).toFixed(0)})`,
      "Use appropriate position sizing based on volatility",
      "Set stop-loss at 10-15% below entry price",
    ];

    const totalSellPercent = strategy.levels.reduce((sum, level) => sum + level.sellPercentage, 0);
    const remainingPercent = 100 - totalSellPercent;

    if (remainingPercent > 30) {
      management.push(`${remainingPercent}% remains for maximum upside potential`);
      management.push("Consider trailing stops for remaining position");
    }

    return management;
  }
}
