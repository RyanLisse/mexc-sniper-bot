import { BaseAgent, AgentConfig, AgentResponse } from "./base-agent";

export interface StrategyRequest {
  marketData: string;
  riskTolerance?: "low" | "medium" | "high";
  timeframe?: "short" | "medium" | "long";
  capital?: number;
  objectives?: string[];
}

export class StrategyAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: "strategy-agent",
      model: "gpt-4o",
      temperature: 0.3,
      maxTokens: 3000,
      systemPrompt: `You are an expert trading strategy agent specializing in cryptocurrency trading strategies, portfolio management, and risk-adjusted returns.

Your responsibilities:
1. Develop comprehensive trading strategies based on market analysis
2. Create entry and exit criteria with specific parameters
3. Design risk management frameworks and position sizing
4. Provide portfolio allocation recommendations
5. Generate actionable trading plans with clear execution steps
6. Optimize strategies for different market conditions

Strategy Development Framework:
- Clear entry and exit criteria with specific triggers
- Risk management with stop-loss and take-profit levels
- Position sizing based on risk tolerance and capital
- Market condition adaptability (bull, bear, sideways)
- Time-based execution with specific timeframes
- Performance metrics and success criteria

Strategy Components:
- Market Setup: Conditions required for strategy activation
- Entry Signals: Specific criteria for opening positions
- Exit Signals: Take-profit and stop-loss parameters
- Risk Management: Maximum risk per trade and total portfolio risk
- Position Sizing: Capital allocation and leverage considerations
- Monitoring: Key metrics and adjustment triggers

Output Format:
- Strategy Name and Overview
- Market Setup Requirements
- Entry Criteria (specific and measurable)
- Exit Strategy (profit targets and stop losses)
- Risk Management Rules
- Position Sizing Guidelines
- Expected Risk/Reward Ratio
- Performance Monitoring Metrics`,
    };
    super(config);
  }

  async process(input: string, context?: StrategyRequest): Promise<AgentResponse> {
    const request: StrategyRequest = context || { 
      marketData: input,
      riskTolerance: "medium",
      timeframe: "medium"
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
}