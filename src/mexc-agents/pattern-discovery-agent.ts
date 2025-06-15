import { type AgentConfig, type AgentResponse, BaseAgent } from "./base-agent";
import type { CalendarEntry, SymbolEntry } from "@/src/services/mexc-unified-exports";

// Extended calendar entry for pattern analysis
export interface PatternCalendarEntry extends CalendarEntry {
  // Pattern analysis properties
  isUpcoming?: boolean;
  patternConfidence?: number;
  hasOptimalAdvance?: boolean;
  projectType?: { category: string; marketAppeal: number };
  advanceHours?: number;
  urgencyLevel?: string;
}

// Alias for backward compatibility
export type SymbolData = SymbolEntry;

export interface PatternAnalysisRequest {
  symbolData?: SymbolData[];
  calendarData?: PatternCalendarEntry[];
  analysisType: "discovery" | "monitoring" | "execution";
  timeframe?: string;
  confidenceThreshold?: number;
}

export interface PatternMatch {
  patternType: string;
  confidence: number;
  indicators: Record<string, string | number | boolean>;
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

  async process(input: string, context?: Record<string, unknown>): Promise<AgentResponse> {
    const request: PatternAnalysisRequest = (context as unknown as PatternAnalysisRequest) || {
      analysisType: "discovery",
      confidenceThreshold: 70,
    };

    const userMessage = `
MEXC Pattern Discovery Analysis:

Analysis Type: ${request.analysisType}
Confidence Threshold: ${request.confidenceThreshold || 70}%
Timeframe: ${request.timeframe || "real-time"}

${
  request.symbolData
    ? `Symbol Data:
${JSON.stringify(request.symbolData, null, 2)}`
    : ""
}

${
  request.calendarData
    ? `Calendar Data:
${JSON.stringify(request.calendarData, null, 2)}`
    : ""
}

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

  async discoverNewListings(calendarEntries: CalendarEntry[]): Promise<AgentResponse> {
    try {
      console.log(
        `[PatternDiscoveryAgent] Starting discovery analysis on ${calendarEntries.length} calendar entries`
      );

      // Validate and preprocess calendar data
      if (!Array.isArray(calendarEntries) || calendarEntries.length === 0) {
        return {
          content: "No calendar data provided for pattern discovery analysis",
          metadata: {
            agent: this.config.name,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Extract patterns and early interest indicators from calendar data
      const processedData = this.extractPatternsFromCalendarData(calendarEntries);

      // Create enhanced analysis prompt with pattern focus
      const userMessage = `
MEXC Pattern Discovery - Calendar Analysis

Calendar Entries Analysis:
${JSON.stringify(processedData, null, 2)}

**Primary Task: Identify early-stage patterns indicating future price movements and trading opportunities**

Please analyze the calendar data for pattern-based trading signals:

1. **Launch Pattern Analysis**
   - Identify consistent timing patterns across listings
   - Detect pre-launch interest indicators (advance notice, project types)
   - Analyze launch sequence patterns that predict success
   - Calculate optimal entry timing based on historical patterns

2. **Interest Pattern Detection**
   - High-potential sectors (DeFi, AI, GameFi, Layer1/Layer2)
   - Project announcement patterns that correlate with trading volume
   - Social sentiment and market buzz indicators
   - Community engagement patterns pre-launch

3. **Ready State Preparation Patterns**
   - Identify listings likely to reach sts:2, st:2, tt:4 state
   - Predict which projects will have stable trading infrastructure
   - Assess liquidity preparation indicators
   - Timing patterns for optimal monitoring setup

4. **Risk Pattern Identification**
   - Launch delay patterns and warning signs
   - Projects with high failure/cancellation rates
   - Market timing risks (weekends, holidays, competing launches)
   - Technical implementation risk indicators

5. **Early Opportunity Scoring**
   - 3.5+ hour advance notice opportunities
   - High-confidence pattern matches (80%+ reliability)
   - Market timing advantage indicators
   - Optimal position preparation windows

6. **Pattern-Based Recommendations**
   - Specific listings to monitor intensively
   - Timing recommendations for each opportunity
   - Risk-adjusted position sizing suggestions
   - Alert threshold configurations based on patterns

**Focus Areas:**
- Pattern reliability and historical success rates
- Early interest indicators that predict trading volume
- Optimal timing sequences for maximum profit potential
- Risk mitigation through pattern recognition

Provide specific pattern matches with confidence scores and actionable recommendations for each identified opportunity.
`;

      // Call OpenAI for AI-driven pattern analysis
      const aiResponse = await this.callOpenAI([
        {
          role: "user",
          content: userMessage,
        },
      ]);

      // Enhance response with pattern summary data
      const patternSummary = this.generatePatternSummary(processedData);
      const enhancedContent = `${aiResponse.content}\n\n**Pattern Analysis Summary:**\n${JSON.stringify(patternSummary, null, 2)}`;

      console.log(
        `[PatternDiscoveryAgent] Successfully analyzed ${calendarEntries.length} entries, found ${patternSummary.totalOpportunities} opportunities`
      );

      return {
        content: enhancedContent,
        metadata: {
          ...aiResponse.metadata,
        },
      };
    } catch (error) {
      console.error(`[PatternDiscoveryAgent] Discovery analysis failed:`, error);
      return {
        content: `Pattern discovery analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          agent: this.config.name,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // Extract pattern-relevant data from calendar entries
  private extractPatternsFromCalendarData(calendarEntries: CalendarEntry[]): CalendarEntry[] {
    const now = Date.now();

    return calendarEntries
      .filter((entry) => {
        // Filter for valid entries with required fields
        return entry?.vcoinId && entry.symbol && entry.firstOpenTime;
      })
      .map((entry) => {
        const launchTime = entry.firstOpenTime;
        const launchTimestamp =
          typeof launchTime === "number"
            ? launchTime
            : launchTime
              ? new Date(launchTime).getTime()
              : Date.now();
        const advanceHours = (launchTimestamp - now) / (1000 * 60 * 60);

        // Extract pattern indicators
        const projectType = this.classifyProjectType(entry.projectName || entry.symbol);
        const marketTiming = this.assessMarketTiming(launchTimestamp);
        const advanceNoticeQuality = this.assessAdvanceNoticeQuality(advanceHours);

        return {
          ...entry,
          launchTime: new Date(launchTimestamp).toISOString(),
          launchTimestamp,
          advanceHours: Math.round(advanceHours * 100) / 100,

          // Pattern indicators
          projectType,
          marketTiming,
          advanceNoticeQuality,
          isUpcoming: advanceHours > 0,
          hasOptimalAdvance: advanceHours >= 3.5,
          urgencyLevel: this.calculateUrgencyLevel(advanceHours),

          // Trading readiness indicators
          expectedTradingPairs: entry.tradingPairs || [`${entry.symbol}USDT`],
          infrastructureReady: entry.sts === 2 && entry.st === 2,
          patternConfidence: this.calculatePatternConfidence(entry, advanceHours, projectType),

          // Risk indicators
          weekendLaunch: marketTiming.isWeekend,
          competingLaunches: 0, // To be calculated in batch analysis
          delayRisk: this.assessDelayRisk(entry, advanceHours),
        };
      })
      .sort((a, b) => a.advanceHours - b.advanceHours); // Sort by launch time
  }

  // Classify project type based on name/description
  private classifyProjectType(projectName: string): { category: string; marketAppeal: number } {
    const name = projectName.toLowerCase();

    if (
      name.includes("defi") ||
      name.includes("swap") ||
      name.includes("yield") ||
      name.includes("farm")
    ) {
      return { category: "DeFi", marketAppeal: 85 };
    }
    if (
      name.includes("ai") ||
      name.includes("artificial") ||
      name.includes("machine") ||
      name.includes("gpt")
    ) {
      return { category: "AI", marketAppeal: 90 };
    }
    if (
      name.includes("game") ||
      name.includes("gaming") ||
      name.includes("play") ||
      name.includes("metaverse")
    ) {
      return { category: "GameFi", marketAppeal: 80 };
    }
    if (
      name.includes("layer") ||
      name.includes("chain") ||
      name.includes("network") ||
      name.includes("protocol")
    ) {
      return { category: "Infrastructure", marketAppeal: 75 };
    }
    if (
      name.includes("meme") ||
      name.includes("dog") ||
      name.includes("cat") ||
      name.includes("pepe")
    ) {
      return { category: "Meme", marketAppeal: 70 };
    }

    return { category: "Other", marketAppeal: 60 };
  }

  // Assess market timing factors
  private assessMarketTiming(launchTimestamp: number): {
    isWeekend: boolean;
    isHoliday: boolean;
    marketSession: string;
  } {
    const launchDate = new Date(launchTimestamp);
    const dayOfWeek = launchDate.getDay();
    const hour = launchDate.getUTCHours();

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = false; // Could be enhanced with holiday calendar

    let marketSession = "off-hours";
    if (hour >= 0 && hour < 8) marketSession = "asia";
    else if (hour >= 8 && hour < 16) marketSession = "europe";
    else if (hour >= 16 && hour < 24) marketSession = "america";

    return { isWeekend, isHoliday, marketSession };
  }

  // Assess quality of advance notice timing
  private assessAdvanceNoticeQuality(advanceHours: number): { quality: string; score: number } {
    if (advanceHours < 0) return { quality: "expired", score: 0 };
    if (advanceHours < 1) return { quality: "critical", score: 30 };
    if (advanceHours < 3.5) return { quality: "poor", score: 50 };
    if (advanceHours < 12) return { quality: "good", score: 80 };
    if (advanceHours < 48) return { quality: "excellent", score: 95 };
    return { quality: "early", score: 70 };
  }

  // Calculate urgency level
  private calculateUrgencyLevel(advanceHours: number): string {
    if (advanceHours < 0) return "expired";
    if (advanceHours < 0.5) return "immediate";
    if (advanceHours < 2) return "critical";
    if (advanceHours < 6) return "high";
    if (advanceHours < 24) return "medium";
    return "low";
  }

  // Calculate pattern confidence score
  private calculatePatternConfidence(
    entry: CalendarEntry,
    advanceHours: number,
    projectType: { category: string; marketAppeal: number }
  ): number {
    let confidence = 50; // Base confidence

    // Advance notice quality
    if (advanceHours >= 3.5) confidence += 20;
    if (advanceHours >= 12) confidence += 10;

    // Project type appeal
    confidence += (projectType.marketAppeal - 60) / 4; // Scale market appeal to confidence

    // Data completeness
    if (entry.projectName) confidence += 5;
    if (entry.tradingPairs && entry.tradingPairs.length > 1) confidence += 5;
    if (entry.sts !== undefined) confidence += 10;

    return Math.min(Math.round(confidence), 95);
  }

  // Assess delay risk factors
  private assessDelayRisk(
    entry: CalendarEntry,
    advanceHours: number
  ): { level: string; factors: string[] } {
    const factors: string[] = [];
    let riskLevel = "low";

    if (advanceHours > 168) {
      // More than 7 days
      factors.push("long-advance-schedule-uncertainty");
      riskLevel = "medium";
    }

    if (!entry.projectName || entry.projectName === entry.symbol) {
      factors.push("incomplete-project-information");
      riskLevel = "medium";
    }

    if (entry.sts === undefined || entry.st === undefined) {
      factors.push("missing-technical-status");
      riskLevel = "high";
    }

    return { level: riskLevel, factors };
  }

  // Generate pattern analysis summary
  private generatePatternSummary(processedData: CalendarEntry[]): Record<string, unknown> {
    const upcomingOpportunities = processedData.filter((d) => d.isUpcoming);
    const highConfidenceMatches = processedData.filter((d) => (d.patternConfidence || 0) >= 80);
    const optimalAdvanceNotice = processedData.filter((d) => d.hasOptimalAdvance === true);

    const totalAdvanceHours = upcomingOpportunities.reduce(
      (sum, d) => sum + (d.advanceHours || 0),
      0
    );
    const averageAdvanceHours =
      upcomingOpportunities.length > 0
        ? Math.round((totalAdvanceHours / upcomingOpportunities.length) * 100) / 100
        : 0;

    const projectTypes = processedData.reduce(
      (acc, d) => {
        const category = d.projectType?.category || "Unknown";
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalEntries: processedData.length,
      totalOpportunities: upcomingOpportunities.length,
      highConfidenceMatches: highConfidenceMatches.length,
      optimalAdvanceNotice: optimalAdvanceNotice.length,
      averageAdvanceHours,
      projectTypeDistribution: projectTypes,
      urgencyLevels: {
        immediate: processedData.filter((d) => d.urgencyLevel === "immediate").length,
        critical: processedData.filter((d) => d.urgencyLevel === "critical").length,
        high: processedData.filter((d) => d.urgencyLevel === "high").length,
        medium: processedData.filter((d) => d.urgencyLevel === "medium").length,
        low: processedData.filter((d) => d.urgencyLevel === "low").length,
      },
      analysisTimestamp: new Date().toISOString(),
    };
  }

  async analyzeSymbolPatterns(symbolData: SymbolData[]): Promise<AgentResponse> {
    return await this.process("Analyze MEXC symbol patterns", {
      symbolData,
      analysisType: "monitoring",
      timeframe: "real-time",
      confidenceThreshold: 80,
    });
  }

  async validateReadyState(params: {
    vcoinId: string;
    symbolData: SymbolData[];
    count: number;
  }): Promise<AgentResponse> {
    const userMessage = `
MEXC Ready State Pattern Validation:

VCoin ID: ${params.vcoinId}
Data Count: ${params.count} entries
Symbol Data:
${JSON.stringify(params.symbolData, null, 2)}

Please perform comprehensive validation of the MEXC ready state pattern:

**Target Pattern: sts:2, st:2, tt:4**

Validation Framework:
1. **Primary Pattern Validation**
   - Exact match check: sts = 2, st = 2, tt = 4
   - Pattern completeness across all data entries
   - Consistency validation between data points
   - Temporal stability of pattern indicators

2. **Data Quality Assessment**
   - All required fields present and valid (sts, st, tt, cd, etc.)
   - Timestamps are recent and consistent
   - No null or invalid values detected
   - API response completeness verification

3. **Symbol Infrastructure Validation**
   - Trading pairs configuration and availability
   - Market infrastructure operational status
   - Order book setup and readiness
   - Exchange system status verification

4. **Risk and Reliability Assessment**
   - Pattern strength and consistency (0-100%)
   - Historical reliability of similar patterns
   - Market timing and conditions suitability
   - False positive probability assessment

5. **Confidence Scoring**
   - Technical pattern match score (0-100)
   - Data quality and completeness score (0-100)
   - Infrastructure readiness score (0-100)
   - Overall composite confidence level (minimum 85% for READY status)

6. **Execution Readiness**
   - Immediate trading recommendation (YES/NO)
   - Optimal entry timing window calculation
   - Risk management parameters setup
   - Position sizing recommendations

7. **Monitoring Requirements**
   - Continue monitoring needs assessment
   - Alert threshold configurations
   - Escalation triggers and criteria
   - Alternative strategy preparation

**Decision Framework:**
- READY: Pattern confirmed, confidence ≥85%, infrastructure ready
- NOT READY: Pattern incomplete, confidence <85%, issues detected
- MONITORING: Partial pattern, confidence 60-84%, continue tracking

For each determination, provide:
- Specific pattern match details (which indicators pass/fail)
- Confidence percentage with detailed reasoning
- Risk level assessment (LOW/MEDIUM/HIGH)
- Immediate actions required or recommended monitoring frequency
- Estimated time until ready state if not currently ready

Focus on precise pattern matching and actionable timing recommendations.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async identifyEarlyOpportunities(marketData: SymbolData | CalendarEntry): Promise<AgentResponse> {
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

  async assessPatternReliability(patternData: SymbolData | CalendarEntry): Promise<AgentResponse> {
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

  async analyzePatterns(params: {
    vcoinId: string;
    symbols?: string[];
    analysisType: "discovery" | "monitoring" | "execution";
  }): Promise<AgentResponse> {
    try {
      console.log(
        `[PatternDiscoveryAgent] Analyzing patterns for ${params.vcoinId} - type: ${params.analysisType}`
      );

      const userMessage = `
MEXC Multi-Symbol Pattern Analysis

Analysis Parameters:
- VCoin ID: ${params.vcoinId}
- Symbols: ${params.symbols?.join(", ") || "N/A"}
- Analysis Type: ${params.analysisType}

Please perform comprehensive pattern analysis focusing on:

1. **Ready State Pattern Detection**
   - Search for sts:2, st:2, tt:4 patterns across symbols
   - Validate pattern completeness and reliability
   - Calculate confidence scores for each pattern match

2. **Cross-Symbol Pattern Analysis**
   - Compare patterns across multiple symbols
   - Identify correlated movements and signals
   - Detect market-wide trends affecting all symbols

3. **Timing Pattern Recognition**
   - Launch sequence patterns and timing indicators
   - Pre-launch opportunity windows (3.5+ hour advance)
   - Optimal entry and exit timing recommendations

4. **Market Condition Assessment**
   - Overall market readiness and liquidity
   - Exchange infrastructure status
   - External factors affecting pattern reliability

5. **Risk Pattern Identification**
   - Warning signals and risk indicators
   - False positive detection and filtering
   - Market volatility and timing risks

6. **Actionable Recommendations**
   - Immediate actions required for each symbol
   - Monitoring schedule and alert configurations
   - Priority ranking of opportunities

Provide specific pattern matches with confidence levels, timing recommendations, and clear action items for each symbol analyzed.
`;

      const response = await this.callOpenAI([
        {
          role: "user",
          content: userMessage,
        },
      ]);

      console.log(`[PatternDiscoveryAgent] Pattern analysis completed for ${params.vcoinId}`);
      return response;
    } catch (error) {
      console.error(
        `[PatternDiscoveryAgent] Pattern analysis failed for ${params.vcoinId}:`,
        error
      );
      return {
        content: `Pattern analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          agent: this.config.name,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}
