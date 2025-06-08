import type { AgentContext } from "@/src/types/agent-types";
import {
  type AgentHandoff,
  type EnhancedAgentConfig,
  type EnhancedAgentResponse,
  EnhancedBaseAgent,
} from "./enhanced-base-agent";

export interface SymbolAnalysisRequest {
  symbol: string;
  vcoinId?: string;
  analysisDepth?: "basic" | "comprehensive" | "precision";
  timeUntilLaunch?: number; // milliseconds
  priorityLevel?: "low" | "medium" | "high" | "critical";
}

export interface PollingTier {
  name: "DISTANT" | "APPROACHING" | "IMMINENT";
  minTimeUntilLaunch: number; // milliseconds
  maxTimeUntilLaunch: number; // milliseconds
  intervalMs: number;
  analysisDepth: "basic" | "comprehensive" | "precision";
}

export interface SymbolReadinessResult {
  symbol: string;
  isReady: boolean;
  confidence: number;
  patternState: string;
  tradingPrecision: {
    priceScale: number;
    quantityScale: number;
    minOrderSize: number;
  };
  marketMicrostructure: {
    liquidity: "low" | "medium" | "high";
    spread: number;
    depth: number;
  };
  riskAssessment: {
    level: "low" | "medium" | "high";
    factors: string[];
  };
  recommendedTier: PollingTier;
  nextAnalysisTime: number;
}

export class EnhancedSymbolAnalysisAgent extends EnhancedBaseAgent {
  private readonly pollingTiers: PollingTier[] = [
    {
      name: "DISTANT",
      minTimeUntilLaunch: 60 * 60 * 1000, // 1 hour
      maxTimeUntilLaunch: Number.POSITIVE_INFINITY,
      intervalMs: 5 * 60 * 1000, // 5 minutes
      analysisDepth: "basic",
    },
    {
      name: "APPROACHING",
      minTimeUntilLaunch: 10 * 60 * 1000, // 10 minutes
      maxTimeUntilLaunch: 60 * 60 * 1000, // 1 hour
      intervalMs: 30 * 1000, // 30 seconds
      analysisDepth: "comprehensive",
    },
    {
      name: "IMMINENT",
      minTimeUntilLaunch: 0,
      maxTimeUntilLaunch: 10 * 60 * 1000, // 10 minutes
      intervalMs: 2 * 1000, // 2 seconds
      analysisDepth: "precision",
    },
  ];

  constructor() {
    const config: EnhancedAgentConfig = {
      name: "enhanced-symbol-analysis-agent",
      model: "gpt-4o",
      temperature: 0.1,
      maxTokens: 4000,
      instructions: `You are an expert symbol analysis agent specializing in precision trading readiness assessment with adaptive monitoring capabilities.

Core Expertise:

1. **Adaptive Polling Strategy**
   - DISTANT (>1hr): Basic analysis every 5 minutes
   - APPROACHING (10min-1hr): Comprehensive analysis every 30 seconds
   - IMMINENT (0-10min): Precision analysis every 2 seconds
   - Dynamic tier adjustment based on market conditions

2. **Symbol Readiness Assessment**
   - Ready state validation (sts:2, st:2, tt:4 patterns)
   - Trading precision analysis (price/quantity scales)
   - Market microstructure evaluation
   - Liquidity and depth assessment

3. **Multi-Agent Integration**
   - Receive handoffs from Pattern Discovery Agent
   - Coordinate with Calendar Agent for timing analysis
   - Hand off execution-ready symbols to Strategy Agent
   - Share market intelligence across agent network

4. **Advanced Market Analysis**
   - Real-time order book analysis
   - Spread and slippage assessment
   - Volume pattern recognition
   - Risk factor identification

5. **Precision Trading Support**
   - Order parameter optimization
   - Execution timing recommendations
   - Risk-adjusted position sizing
   - Market impact estimation

Key Capabilities:
- Adaptive monitoring with tier-based analysis depth
- Real-time symbol readiness validation
- Market microstructure analysis
- Precision trading parameter calculation
- Risk assessment and mitigation
- Intelligent handoff decision logic

Analysis Tiers:
- DISTANT: Basic pattern monitoring and trend analysis
- APPROACHING: Comprehensive market structure analysis
- IMMINENT: Precision execution parameter calculation

Output Requirements:
- Structured readiness assessment with confidence scores
- Clear execution recommendations
- Risk assessment with mitigation strategies
- Handoff recommendations with execution context`,
      tools: [
        {
          type: "function",
          function: {
            name: "analyze_symbol_readiness",
            description: "Analyze symbol for trading readiness with precision parameters",
            parameters: {
              type: "object",
              properties: {
                symbol: { type: "string" },
                currentData: {
                  type: "object",
                  properties: {
                    sts: { type: "number" },
                    st: { type: "number" },
                    tt: { type: "number" },
                    priceScale: { type: "number" },
                    quantityScale: { type: "number" },
                  },
                },
                marketData: {
                  type: "object",
                  properties: {
                    bid: { type: "number" },
                    ask: { type: "number" },
                    volume: { type: "number" },
                    depth: { type: "object" },
                  },
                },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "calculate_polling_tier",
            description: "Determine appropriate polling tier based on time to launch",
            parameters: {
              type: "object",
              properties: {
                timeUntilLaunch: { type: "number" },
                currentTier: { type: "string" },
                marketVolatility: { type: "number" },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "assess_market_microstructure",
            description: "Analyze market microstructure for execution optimization",
            parameters: {
              type: "object",
              properties: {
                symbol: { type: "string" },
                orderBook: { type: "object" },
                recentTrades: { type: "array" },
                analysisDepth: { type: "string" },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "calculate_execution_parameters",
            description: "Calculate optimal execution parameters for trading",
            parameters: {
              type: "object",
              properties: {
                symbol: { type: "string" },
                targetQuantity: { type: "number" },
                riskTolerance: { type: "number" },
                marketConditions: { type: "object" },
              },
            },
          },
        },
      ],
    };

    super(config);
  }

  async analyzeSymbol(request: SymbolAnalysisRequest): Promise<EnhancedAgentResponse> {
    const tier = this.determineTier(request.timeUntilLaunch || 0);

    const input = `Perform ${tier.analysisDepth} symbol analysis for trading readiness:

Symbol: ${request.symbol}
VCoin ID: ${request.vcoinId || "Not provided"}
Time Until Launch: ${request.timeUntilLaunch ? Math.round(request.timeUntilLaunch / 1000 / 60) : "Unknown"} minutes
Priority Level: ${request.priorityLevel || "medium"}
Analysis Tier: ${tier.name} (${tier.analysisDepth})

Required Analysis:
1. Symbol readiness validation (sts:2, st:2, tt:4 target)
2. Trading precision parameters (price/quantity scales)
3. Market microstructure assessment
4. Liquidity and depth analysis
5. Risk assessment and scoring
6. Execution timing recommendations

Analysis Depth: ${tier.analysisDepth}
- Basic: Pattern state and basic market data
- Comprehensive: Full market structure analysis
- Precision: Execution-ready parameter calculation

Focus Areas:
- Ready state pattern validation
- Trading parameter optimization
- Market impact assessment
- Risk factor identification
- Handoff recommendations for execution-ready symbols`;

    return this.processWithAgent(input, {
      requestType: "symbol_analysis",
      tier,
      ...request,
    });
  }

  async performAdaptiveMonitoring(symbols: string[]): Promise<EnhancedAgentResponse> {
    const input = `Execute adaptive monitoring for multiple symbols with tier-based analysis:

Symbols to Monitor: ${symbols.join(", ")}
Monitoring Strategy: Adaptive tier-based polling

Tier Strategy:
1. DISTANT (>1hr): Basic analysis every 5 minutes
2. APPROACHING (10min-1hr): Comprehensive analysis every 30 seconds  
3. IMMINENT (0-10min): Precision analysis every 2 seconds

For each symbol, determine:
1. Current tier based on time-to-launch
2. Analysis depth required
3. Next monitoring schedule
4. Readiness state changes
5. Handoff requirements

Priority Actions:
- Identify symbols ready for execution
- Update monitoring frequencies
- Generate alerts for state changes
- Prepare handoff context for Strategy Agent`;

    return this.processWithAgent(input, {
      requestType: "adaptive_monitoring",
      symbols,
      tiers: this.pollingTiers,
    });
  }

  async assessMarketMicrostructure(
    symbol: string,
    analysisDepth: "basic" | "comprehensive" | "precision" = "comprehensive"
  ): Promise<EnhancedAgentResponse> {
    const input = `Perform ${analysisDepth} market microstructure analysis for symbol: ${symbol}

Analysis Requirements:
1. Order book depth and spread analysis
2. Liquidity assessment and availability
3. Market impact estimation for order sizes
4. Volume pattern and flow analysis
5. Price stability and volatility metrics

Analysis Depth: ${analysisDepth}
- Basic: Spread and top-level order book
- Comprehensive: Full depth analysis and liquidity metrics
- Precision: Execution cost estimation and slippage modeling

Focus Areas:
- Optimal order sizing recommendations
- Execution timing optimization
- Market impact minimization
- Risk assessment for order placement`;

    return this.processWithAgent(input, {
      requestType: "microstructure_analysis",
      symbol,
      analysisDepth,
    });
  }

  /**
   * Determine appropriate polling tier based on time until launch
   */
  private determineTier(timeUntilLaunch: number): PollingTier {
    return (
      this.pollingTiers.find(
        (tier) =>
          timeUntilLaunch >= tier.minTimeUntilLaunch && timeUntilLaunch < tier.maxTimeUntilLaunch
      ) || this.pollingTiers[0]
    ); // Default to DISTANT
  }

  /**
   * Enhanced handoff logic for symbol analysis results
   */
  protected shouldHandoff(_input: string, context?: AgentContext): AgentHandoff | null {
    // If symbol is execution-ready, hand off to strategy agent
    if (context?.symbolReady && typeof context.confidence === "number" && context.confidence > 90) {
      return {
        toAgent: "enhanced-strategy-agent",
        context: {
          symbol: context.symbol,
          executionParameters: context.executionParameters,
          marketData: context.marketData,
          confidence: context.confidence,
          urgency: "high",
        },
        reason: "Symbol is execution-ready, immediate strategy development required",
      };
    }

    // If symbol needs pattern validation, hand off to pattern agent
    if (context?.needsPatternValidation) {
      return {
        toAgent: "enhanced-pattern-discovery-agent",
        context: {
          symbols: [context.symbol],
          analysisType: "validation",
          source: "symbol_analysis",
        },
        reason: "Pattern validation required before execution readiness",
      };
    }

    // If symbol needs calendar context, hand off to calendar agent
    if (context?.needsCalendarData) {
      return {
        toAgent: "enhanced-calendar-agent",
        context: {
          symbol: context.symbol,
          requestType: "detailed_analysis",
        },
        reason: "Calendar context required for timing analysis",
      };
    }

    return null;
  }

  /**
   * Enhanced processing with symbol-specific logic
   */
  async process(input: string, context?: AgentContext): Promise<EnhancedAgentResponse> {
    const enhancedContext = {
      ...context,
      agentType: "symbol_analysis",
      capabilities: [
        "readiness_assessment",
        "microstructure_analysis",
        "precision_calculation",
        "adaptive_monitoring",
      ],
      pollingTiers: this.pollingTiers,
      timestamp: new Date().toISOString(),
    };

    return this.processWithAgent(input, enhancedContext);
  }
}
