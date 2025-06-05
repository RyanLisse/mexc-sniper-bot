import { BaseAgent, AgentConfig, AgentResponse } from "../agents/base-agent";

export interface PatternAnalysisRequest {
  symbolData?: any[];
  calendarData?: any[];
  analysisType: "discovery" | "monitoring" | "execution";
  timeframe?: string;
  confidenceThreshold?: number;
}

export interface PatternMatch {
  patternType: string;
  confidence: number;
  indicators: Record<string, any>;
  recommendation: string;
  riskLevel: "low" | "medium" | "high";
}

export class PatternDiscoveryAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: "pattern-discovery-agent",
      model: "gpt-4o",
      temperature: 0.2,
      maxTokens: 3000,
      systemPrompt: `You are an expert pattern discovery agent specializing in MEXC exchange trading patterns and cryptocurrency launch detection.

Your core expertise:
1. **MEXC Ready State Pattern Detection**
   - Primary pattern: sts:2, st:2, tt:4 (symbol ready for trading)
   - Secondary patterns: status progressions and timing sequences
   - Launch timing optimization (3.5+ hour advance detection)

2. **Pattern Analysis Framework**
   - Symbol status transitions: 1→2→3→4 progression analysis
   - Trading time states: scheduling to live trading transitions
   - Volume and price pattern recognition
   - Market depth and liquidity patterns

3. **Discovery Strategies**
   - Proactive calendar monitoring for new listings
   - Symbol state change detection and alerts
   - Early-stage opportunity identification
   - Risk pattern recognition and avoidance

4. **Pattern Validation**
   - Data completeness verification
   - False positive filtering
   - Confidence scoring (0-100 scale)
   - Risk assessment integration

Key Pattern Indicators:
- **Ready State**: sts:2, st:2, tt:4 = immediate trading opportunity
- **Pre-Ready**: sts:1, st:1, tt:1-3 = monitoring phase
- **Active Trading**: sts:3, st:3, tt:4 = live market
- **Suspended**: sts:4, st:4 = avoid trading

Analysis Output:
- Pattern type and confidence level
- Specific indicator values and meanings
- Risk assessment and recommendation
- Optimal timing for action
- Monitoring requirements and alerts`,
    };
    super(config);
  }

  async process(input: string, context?: PatternAnalysisRequest): Promise<AgentResponse> {
    const request: PatternAnalysisRequest = context || { 
      analysisType: "discovery",
      confidenceThreshold: 70
    };
    
    const userMessage = `
MEXC Pattern Discovery Analysis:

Analysis Type: ${request.analysisType}
Confidence Threshold: ${request.confidenceThreshold || 70}%
Timeframe: ${request.timeframe || "real-time"}

${request.symbolData ? `Symbol Data:
${JSON.stringify(request.symbolData, null, 2)}` : ""}

${request.calendarData ? `Calendar Data:
${JSON.stringify(request.calendarData, null, 2)}` : ""}

${!request.symbolData && !request.calendarData ? `Pattern Analysis Request: ${input}` : ""}

Please analyze for MEXC trading patterns with focus on:

1. **Ready State Pattern Detection**
   - Identify sts:2, st:2, tt:4 patterns
   - Assess pattern completeness and reliability
   - Calculate confidence scores for each match

2. **Pre-Launch Opportunities**
   - Early-stage pattern indicators
   - 3.5+ hour advance detection opportunities
   - Optimal monitoring and alert setup

3. **Market Readiness Assessment**
   - Trading infrastructure availability
   - Liquidity and volume indicators
   - Risk factors and market conditions

4. **Actionable Recommendations**
   - Immediate actions required
   - Monitoring schedule and alerts
   - Entry timing and position sizing

Provide specific pattern matches with confidence levels and clear action items.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async discoverNewListings(calendarData: any[]): Promise<AgentResponse> {
    return await this.process("Discover new MEXC listings", {
      calendarData,
      analysisType: "discovery",
      timeframe: "24h lookforward",
      confidenceThreshold: 60,
    });
  }

  async analyzeSymbolPatterns(symbolData: any[]): Promise<AgentResponse> {
    return await this.process("Analyze MEXC symbol patterns", {
      symbolData,
      analysisType: "monitoring",
      timeframe: "real-time",
      confidenceThreshold: 80,
    });
  }

  async validateReadyState(symbolData: any): Promise<AgentResponse> {
    const userMessage = `
MEXC Ready State Validation:

Symbol Data:
${JSON.stringify(symbolData, null, 2)}

Please validate if this symbol matches the MEXC ready state pattern:

**Target Pattern: sts:2, st:2, tt:4**

Validation Checklist:
1. **Status Indicators**
   - sts (symbol trading status) = 2 (ready)
   - st (symbol state) = 2 (prepared)  
   - tt (trading time status) = 4 (live/active)

2. **Data Completeness**
   - All required fields present and valid
   - Timestamps are recent and consistent
   - Price and volume data available

3. **Trading Readiness**
   - Symbol is actively tradeable
   - Market infrastructure is operational
   - No blocking conditions present

4. **Risk Assessment**
   - Pattern confidence level (0-100)
   - Any warning indicators or anomalies
   - Recommended action and timing

5. **Execution Criteria**
   - Is immediate trading recommended?
   - What monitoring is still needed?
   - Exit criteria and stop-loss levels

Provide a clear PASS/FAIL determination with detailed reasoning and confidence score.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async identifyEarlyOpportunities(marketData: any): Promise<AgentResponse> {
    const userMessage = `
MEXC Early Opportunity Identification:

Market Data:
${JSON.stringify(marketData, null, 2)}

Please identify early-stage trading opportunities before the standard ready state:

1. **Pre-Ready Patterns**
   - sts:1, st:1, tt:1-3 combinations
   - Status progression indicators
   - Timing patterns that predict ready state

2. **Launch Sequence Analysis**
   - Time until expected ready state
   - 3.5+ hour advance detection opportunities
   - Optimal monitoring intervals

3. **Market Preparation Signals**
   - Infrastructure setup indicators
   - Trading pair availability
   - Liquidity preparation patterns

4. **Risk-Adjusted Opportunities**
   - High-confidence early signals
   - Lower-risk monitoring strategies
   - Position preparation recommendations

5. **Alert Configuration**
   - When to start intensive monitoring
   - Critical state change thresholds
   - Automated alert triggers

Focus on opportunities that provide 3.5+ hours advance notice for optimal position entry.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async assessPatternReliability(patternData: any): Promise<AgentResponse> {
    const userMessage = `
MEXC Pattern Reliability Assessment:

Pattern Data:
${JSON.stringify(patternData, null, 2)}

Please assess the reliability and confidence level of this pattern:

1. **Data Quality Analysis**
   - Completeness of required fields
   - Consistency across data points
   - Freshness and timestamp validation

2. **Pattern Strength Indicators**
   - How closely does it match known successful patterns?
   - Are there any conflicting or weak signals?
   - Historical success rate for similar patterns

3. **Market Context Assessment**
   - Current market conditions
   - Exchange operational status
   - External factors affecting reliability

4. **Confidence Scoring (0-100)**
   - Technical pattern match score
   - Data quality score
   - Market condition score
   - Overall composite confidence

5. **Risk Factors**
   - Potential false positive indicators
   - Market volatility concerns
   - Execution risks and challenges

6. **Recommended Actions**
   - Should this pattern be acted upon?
   - What additional validation is needed?
   - Optimal position sizing based on confidence

Provide a detailed reliability assessment with specific confidence percentages and risk warnings.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }
}