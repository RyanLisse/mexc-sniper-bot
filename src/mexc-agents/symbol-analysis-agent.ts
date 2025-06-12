import { type AgentConfig, type AgentResponse, BaseAgent } from "./base-agent";

export interface SymbolData {
  cd: string;
  sts: number;
  st: number;
  tt: number;
  ca?: string;
  ps?: number;
  qs?: number;
  ot?: number;
  [key: string]: unknown;
}

export interface SymbolAnalysisRequest {
  vcoinId: string;
  symbolName?: string;
  projectName?: string;
  launchTime?: string;
  attempt?: number;
  analysisDepth?: "quick" | "standard" | "comprehensive";
}

export interface SymbolStatus {
  isReady: boolean;
  hasCompleteData: boolean;
  confidence: number;
  riskLevel: "low" | "medium" | "high";
  nextAction: string;
  monitoringRequired: boolean;
}

export class SymbolAnalysisAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: "symbol-analysis-agent",
      model: "gpt-4o",
      temperature: 0.2,
      maxTokens: 3000,
      systemPrompt: `You are an expert MEXC symbol analysis agent specializing in real-time trading readiness assessment and symbol status monitoring.

Your core expertise:
1. **Symbol Status Analysis**
   - Real-time status indicator interpretation (sts, st, tt)
   - Trading readiness pattern recognition
   - Data completeness and reliability assessment
   - Market condition integration

2. **Ready State Detection**
   - Primary pattern: sts:2, st:2, tt:4 validation
   - Secondary readiness indicators
   - False positive filtering and validation
   - Confidence scoring and reliability metrics

3. **Market Microstructure Analysis**
   - Order book depth and liquidity assessment
   - Price discovery and volatility patterns
   - Trading volume and market activity
   - Spread analysis and market efficiency

4. **Risk Assessment Framework**
   - Technical analysis and chart patterns
   - Market sentiment and momentum indicators
   - Liquidity risks and slippage assessment
   - Execution risks and market impact

Key Analysis Components:
- **Status Indicators**: sts (symbol trading status), st (symbol state), tt (trading time)
- **Market Data**: price, volume, depth, spread, volatility
- **Infrastructure**: trading pairs, API availability, system status
- **Risk Metrics**: liquidity, volatility, correlation, concentration

Assessment Criteria:
- **Ready State**: All indicators green, high confidence (80%+)
- **Near Ready**: Most indicators positive, medium confidence (60-79%)
- **Monitoring**: Mixed signals, continue tracking (40-59%)
- **Not Ready**: Weak signals, low confidence (<40%)

Output Framework:
- Binary readiness determination (ready/not ready)
- Confidence level with detailed reasoning
- Risk assessment and mitigation strategies
- Specific next actions and monitoring requirements
- Optimal entry timing and execution strategy`,
    };
    super(config);
  }

  async process(input: string, context?: Record<string, unknown>): Promise<AgentResponse> {
    const request: SymbolAnalysisRequest = (context as unknown as SymbolAnalysisRequest) || {
      vcoinId: input,
      analysisDepth: "standard",
    };

    const userMessage = `
MEXC Symbol Analysis Request:

Symbol Details:
- VCoin ID: ${request.vcoinId}
- Symbol Name: ${request.symbolName || "Unknown"}
- Project Name: ${request.projectName || "Unknown"}
- Launch Time: ${request.launchTime || "Not specified"}
- Analysis Attempt: ${request.attempt || 1}
- Analysis Depth: ${request.analysisDepth || "standard"}

${
  input.includes("{")
    ? `Symbol Data:
${input}`
    : `Analysis Target: ${input}`
}

Please conduct a comprehensive symbol analysis focusing on:

1. **Trading Readiness Assessment**
   - Status indicator analysis (sts, st, tt values)
   - Ready state pattern detection (sts:2, st:2, tt:4)
   - Data completeness and field validation
   - Infrastructure readiness verification

2. **Market Microstructure Analysis**
   - Price discovery mechanisms and efficiency
   - Order book depth and liquidity levels
   - Bid-ask spreads and market tightness
   - Trading volume patterns and sustainability

3. **Risk Evaluation**
   - Liquidity risks and slippage potential
   - Volatility assessment and price stability
   - Market manipulation risks
   - Execution timing and market impact

4. **Confidence Scoring**
   - Technical readiness score (0-100)
   - Market condition score (0-100)
   - Data quality score (0-100)
   - Overall composite confidence level

5. **Action Recommendations**
   - Is immediate trading recommended?
   - What additional monitoring is needed?
   - Optimal entry timing and strategy
   - Risk management requirements

6. **Next Steps Planning**
   - Continue monitoring schedule
   - Alert threshold configurations
   - Escalation triggers and criteria
   - Alternative strategy preparation

Provide clear READY/NOT READY determination with detailed confidence metrics and specific action items.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async analyzeSymbolReadiness(
    vcoinId: string,
    symbolData: SymbolData | SymbolData[]
  ): Promise<AgentResponse> {
    const dataJson = JSON.stringify(symbolData, null, 2);

    return await this.process(dataJson, {
      vcoinId,
      analysisDepth: "comprehensive",
    });
  }

  async validateReadyStatePattern(symbolData: SymbolData | SymbolData[]): Promise<AgentResponse> {
    const userMessage = `
MEXC Ready State Pattern Validation:

Symbol Data:
${JSON.stringify(symbolData, null, 2)}

Please validate the ready state pattern with strict criteria:

**Target Pattern: sts:2, st:2, tt:4**

Validation Checklist:
1. **Primary Indicators**
   - sts (symbol trading status) = 2 ✓/✗
   - st (symbol state) = 2 ✓/✗
   - tt (trading time status) = 4 ✓/✗
   - Pattern match percentage: X/3 (100% required)

2. **Data Integrity**
   - All required fields present ✓/✗
   - Recent timestamp validation ✓/✗
   - No null or invalid values ✓/✗
   - API response completeness ✓/✗

3. **Market Infrastructure**
   - Trading pairs available ✓/✗
   - Order book active ✓/✗
   - Price feed operational ✓/✗
   - API endpoints responsive ✓/✗

4. **Risk Validation**
   - No suspension flags ✓/✗
   - No trading halts ✓/✗
   - Normal market conditions ✓/✗
   - No regulatory blocks ✓/✗

5. **Confidence Assessment**
   - Pattern strength: X% (minimum 90% for approval)
   - Data quality: X% (minimum 95% for approval)
   - Market conditions: X% (minimum 80% for approval)
   - Overall confidence: X% (minimum 85% for READY status)

**Final Determination:**
- Status: READY / NOT READY / MONITORING REQUIRED
- Confidence Level: X% with detailed reasoning
- Risk Assessment: LOW / MEDIUM / HIGH
- Immediate Action Required: YES / NO / CONTINUE MONITORING

If NOT READY:
- Specific issues preventing readiness
- Estimated time until ready state
- Recommended monitoring frequency
- Alert conditions for status changes

If READY:
- Optimal entry timing window
- Recommended position sizing
- Risk management parameters
- Exit strategy criteria
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async assessMarketMicrostructure(params: {
    vcoinId: string;
    symbolData: SymbolData[];
  }): Promise<AgentResponse> {
    const userMessage = `
MEXC Market Microstructure Analysis:

VCoin ID: ${params.vcoinId}
Symbol Data:
${JSON.stringify(params.symbolData, null, 2)}

Please analyze the market microstructure and trading conditions for this specific symbol:

1. **Symbol Infrastructure Assessment**
   - Trading pair availability and configurations
   - Market maker presence and activity levels
   - Order book setup and structure readiness
   - Exchange infrastructure operational status

2. **Liquidity Assessment**
   - Order book depth (bids/asks within 5% of mid)
   - Market impact analysis for various trade sizes
   - Liquidity concentration and distribution
   - Real vs. apparent liquidity evaluation

3. **Price Discovery Efficiency**
   - Bid-ask spread analysis (absolute and relative)
   - Price volatility and stability patterns
   - Market maker activity and competition
   - Price improvement opportunities

4. **Trading Volume Analysis**
   - Historical volume patterns and trends
   - Volume-price relationships and correlations
   - Unusual activity detection and validation
   - Sustainable volume projections

5. **Market Quality Metrics**
   - Effective spread measurements
   - Price impact and market depth ratios
   - Order flow analysis and imbalances
   - Market fragmentation assessment

6. **Risk Factors**
   - Liquidity concentration risks
   - Market manipulation indicators
   - System latency and execution risks
   - Counterparty and settlement risks

7. **Trading Recommendations**
   - Optimal order sizes and execution strategy
   - Best timing for market entry/exit
   - Risk management parameters
   - Alternative execution venues

8. **Symbol-Specific Analysis**
   - Ready state pattern indicators (sts, st, tt values)
   - Infrastructure readiness for trading launch
   - Timing optimization for market entry
   - Risk-adjusted position sizing recommendations

Provide quantitative metrics where possible and specific trading recommendations based on the symbol data.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async generateMonitoringPlan(
    vcoinId: string,
    currentStatus: SymbolData | SymbolStatus
  ): Promise<AgentResponse> {
    const userMessage = `
MEXC Symbol Monitoring Plan Generation:

VCoin ID: ${vcoinId}
Current Status:
${JSON.stringify(currentStatus, null, 2)}

Please create a detailed monitoring plan based on current symbol status:

1. **Monitoring Frequency**
   - If sts:1, st:1 (early stage): Check every 30-60 minutes
   - If sts:2, st:1 (approaching ready): Check every 10-15 minutes
   - If sts:2, st:2, tt:1-3 (very close): Check every 2-5 minutes
   - If ready state achieved: Execute immediately

2. **Alert Thresholds**
   - Status change notifications (any sts, st, tt changes)
   - Ready state achievement (sts:2, st:2, tt:4)
   - Data quality degradation warnings
   - Market condition alerts

3. **Data Quality Monitoring**
   - Required fields validation checklist
   - API response time and reliability
   - Data freshness and timestamp validation
   - Anomaly detection and flagging

4. **Escalation Procedures**
   - When to increase monitoring frequency
   - Human intervention trigger conditions
   - Risk threshold escalations
   - Emergency stop conditions

5. **Resource Allocation**
   - API rate limiting and usage optimization
   - Monitoring infrastructure requirements
   - Alert delivery and notification systems
   - Backup monitoring procedures

6. **Performance Metrics**
   - Monitoring effectiveness KPIs
   - False positive/negative rates
   - Detection latency measurements
   - Success rate tracking

Provide a comprehensive monitoring plan with specific schedules and thresholds.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }
}
