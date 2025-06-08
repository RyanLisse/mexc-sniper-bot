import type { AgentContext, CalendarListing } from "@/src/types/agent-types";
import {
  type AgentHandoff,
  type EnhancedAgentConfig,
  type EnhancedAgentResponse,
  EnhancedBaseAgent,
} from "./enhanced-base-agent";

export interface PatternAnalysisRequest {
  symbols?: string[];
  analysisType?: "discovery" | "monitoring" | "execution";
  targetPattern?: string;
  confidence_threshold?: number;
}

export interface PatternResult {
  symbol: string;
  patternState: string;
  confidence: number;
  readyState: boolean;
  estimatedTimeToReady?: number;
  riskLevel: "low" | "medium" | "high";
}

export class EnhancedPatternAgent extends EnhancedBaseAgent {
  constructor() {
    const config: EnhancedAgentConfig = {
      name: "enhanced-pattern-discovery-agent",
      model: "gpt-4o",
      temperature: 0.2,
      maxTokens: 4000,
      instructions: `You are an expert pattern discovery agent specializing in MEXC trading signal detection with advanced multi-agent coordination.

Core Expertise:

1. **Ready State Pattern Detection**
   - Target pattern: sts:2, st:2, tt:4 (optimal for execution)
   - Secondary patterns: sts:1, st:1, tt:3 (monitoring phase)
   - Pattern evolution analysis and prediction
   - Confidence scoring based on historical accuracy

2. **Multi-Agent Intelligence Network**
   - Receive listings from Calendar Agent for pattern validation
   - Collaborate with Symbol Analysis Agent for comprehensive evaluation
   - Coordinate with Strategy Agent for execution planning
   - Share pattern insights across the agent network

3. **Advanced Pattern Analysis**
   - Real-time pattern state monitoring
   - Historical pattern performance correlation
   - Market condition impact on pattern reliability
   - Cross-symbol pattern correlation analysis

4. **Decision Logic & Handoffs**
   - Determine when patterns are ready for trading
   - Identify symbols requiring deeper analysis
   - Trigger strategy development for ready patterns
   - Escalate complex cases to specialized agents

Key Capabilities:
- Pattern state classification with 95%+ accuracy
- Multi-timeframe pattern analysis
- Risk-adjusted confidence scoring
- Intelligent agent handoff decisions
- Real-time pattern evolution tracking

Pattern States:
- Ready (sts:2, st:2, tt:4): Execute immediately
- Near-Ready (sts:1, st:1, tt:3): Monitor closely
- Developing: Continue monitoring
- Degrading: Risk assessment required

Output Requirements:
- Structured pattern analysis with confidence scores
- Clear ready/not-ready determination
- Agent handoff recommendations with context
- Risk assessment and timing predictions`,
      tools: [
        {
          type: "function",
          function: {
            name: "analyze_pattern_state",
            description: "Analyze current pattern state for a symbol",
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
                    timestamp: { type: "string" },
                  },
                },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "predict_pattern_evolution",
            description: "Predict how pattern will evolve based on historical data",
            parameters: {
              type: "object",
              properties: {
                currentPattern: { type: "string" },
                marketConditions: { type: "string" },
                timeWindow: { type: "string" },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "calculate_pattern_confidence",
            description: "Calculate confidence score for pattern reliability",
            parameters: {
              type: "object",
              properties: {
                patternData: { type: "object" },
                historicalAccuracy: { type: "number" },
                marketVolatility: { type: "number" },
              },
            },
          },
        },
      ],
    };

    super(config);
  }

  async analyzePatterns(request: PatternAnalysisRequest): Promise<EnhancedAgentResponse> {
    const input = `Analyze pattern states for trading opportunities:

Symbols: ${request.symbols?.join(", ") || "All monitored symbols"}
Analysis Type: ${request.analysisType || "discovery"}
Target Pattern: ${request.targetPattern || "sts:2, st:2, tt:4"}
Confidence Threshold: ${request.confidence_threshold || 85}%

Required Analysis:
1. Current pattern state classification for each symbol
2. Ready state determination (sts:2, st:2, tt:4)
3. Confidence scoring and risk assessment
4. Time-to-ready predictions for developing patterns
5. Agent handoff recommendations

Focus on:
- Symbols showing ready state patterns (immediate action)
- Near-ready patterns (monitoring priority)
- Pattern evolution predictions
- Risk factors and market condition impacts`;

    return this.processWithAgent(input, {
      requestType: "pattern_analysis",
      ...request,
    });
  }

  async validateCalendarListings(listings: CalendarListing[]): Promise<EnhancedAgentResponse> {
    const input = `Validate new calendar listings for pattern potential:

Listings to analyze: ${listings.length} new tokens
Analysis Focus:
1. Pattern development potential for each listing
2. Historical performance of similar tokens
3. Optimal monitoring schedule recommendations
4. Risk assessment for each opportunity

For each listing, determine:
- Pattern development timeline
- Monitoring frequency needed
- Expected ready state timing
- Handoff requirements to Symbol Analysis Agent`;

    return this.processWithAgent(input, {
      requestType: "calendar_validation",
      listings,
      source: "calendar_agent",
    });
  }

  async continuousMonitoring(): Promise<EnhancedAgentResponse> {
    const input = `Execute continuous pattern monitoring cycle:

1. Scan all active symbols for pattern state changes
2. Identify newly ready patterns (sts:2, st:2, tt:4)
3. Update confidence scores based on market conditions
4. Flag symbols requiring immediate attention
5. Generate handoff recommendations for ready symbols

Priority Actions:
- Alert on ready state achievements
- Update monitoring frequencies
- Trigger strategy development for ready patterns
- Coordinate with other agents for comprehensive analysis`;

    return this.processWithAgent(input, {
      requestType: "continuous_monitoring",
    });
  }

  /**
   * Enhanced handoff logic for pattern analysis results
   */
  protected shouldHandoff(_input: string, context?: AgentContext): AgentHandoff | null {
    // If patterns are ready, hand off to strategy agent
    if (
      context?.readyPatterns &&
      Array.isArray(context.readyPatterns) &&
      context.readyPatterns.length > 0
    ) {
      return {
        toAgent: "enhanced-strategy-agent",
        context: {
          readySymbols: context.readyPatterns,
          patternData: context.patternAnalysis,
          confidence: context.averageConfidence,
          urgency: "high",
        },
        reason: "Ready patterns detected, immediate strategy development required",
      };
    }

    // If symbols need detailed analysis, hand off to symbol agent
    if (
      context?.complexSymbols &&
      Array.isArray(context.complexSymbols) &&
      context.complexSymbols.length > 0
    ) {
      return {
        toAgent: "enhanced-symbol-analysis-agent",
        context: {
          symbols: context.complexSymbols,
          analysisType: "detailed_pattern_validation",
          priority: "medium",
        },
        reason: "Complex patterns require detailed symbol analysis",
      };
    }

    return null;
  }

  /**
   * Enhanced processing with pattern-specific logic
   */
  async process(input: string, context?: AgentContext): Promise<EnhancedAgentResponse> {
    const enhancedContext = {
      ...context,
      agentType: "pattern_discovery",
      capabilities: ["pattern_detection", "ready_state_analysis", "confidence_scoring"],
      targetPattern: "sts:2,st:2,tt:4",
      timestamp: new Date().toISOString(),
    };

    return this.processWithAgent(input, enhancedContext);
  }
}
