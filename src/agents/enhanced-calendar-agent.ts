import type { AgentContext } from "@/src/types/agent-types";
import {
  type AgentHandoff,
  type EnhancedAgentConfig,
  type EnhancedAgentResponse,
  EnhancedBaseAgent,
} from "./enhanced-base-agent";

export interface CalendarMonitoringRequest {
  timeframe?: "1h" | "6h" | "24h" | "7d";
  focusAreas?: string[];
  minimumAdvanceHours?: number;
  includeHistorical?: boolean;
}

export interface NewListingData {
  vcoinId: string;
  symbolName: string;
  projectName: string;
  launchTime: string;
  advanceHours: number;
  confidence: number;
  priority: "low" | "medium" | "high" | "critical";
}

export class EnhancedCalendarAgent extends EnhancedBaseAgent {
  constructor() {
    const config: EnhancedAgentConfig = {
      name: "enhanced-calendar-agent",
      model: "gpt-4o",
      temperature: 0.3,
      maxTokens: 3000,
      instructions: `You are an expert MEXC calendar monitoring agent with advanced multi-agent coordination capabilities.

Your core responsibilities:

1. **New Listing Discovery & Analysis**
   - Monitor MEXC calendar for new token announcements
   - Identify high-potential trading opportunities with 3.5+ hour advance notice
   - Evaluate project fundamentals, tokenomics, and market appeal
   - Calculate risk-adjusted profit potential

2. **Multi-Agent Coordination**
   - Collaborate with Pattern Discovery Agent for ready-state analysis
   - Handoff to Symbol Analysis Agent for detailed token evaluation
   - Coordinate with Strategy Agent for trading plan development
   - Share context and findings with the agent network

3. **Advanced Market Intelligence**
   - Cross-reference with market sentiment and social signals
   - Analyze historical launch patterns and performance data
   - Predict optimal entry/exit timing windows
   - Assess market conditions and liquidity forecasts

4. **Decision Framework**
   - Use structured decision trees for opportunity prioritization
   - Apply confidence scoring based on multiple data sources
   - Generate actionable recommendations with risk assessments
   - Provide clear handoff instructions for subsequent agents

Key Capabilities:
- Real-time calendar monitoring and analysis
- Multi-factor opportunity scoring (0-100 scale)
- Agent handoff decision logic
- Contextual information packaging for downstream agents
- Risk assessment and mitigation strategies

Output Format:
Always provide structured analysis with clear next steps and agent handoff recommendations.`,
      tools: [
        {
          type: "function",
          function: {
            name: "analyze_listing_opportunity",
            description: "Analyze a new token listing for trading potential",
            parameters: {
              type: "object",
              properties: {
                listing: {
                  type: "object",
                  properties: {
                    symbol: { type: "string" },
                    projectName: { type: "string" },
                    launchTime: { type: "string" },
                    description: { type: "string" },
                  },
                },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "calculate_advance_window",
            description: "Calculate time advantage for early detection",
            parameters: {
              type: "object",
              properties: {
                launchTime: { type: "string" },
                currentTime: { type: "string" },
              },
            },
          },
        },
      ],
    };

    super(config);
  }

  async discoverNewListings(request: CalendarMonitoringRequest): Promise<EnhancedAgentResponse> {
    const input = `Analyze MEXC calendar for new token listings with the following parameters:
    
Timeframe: ${request.timeframe || "24h"}
Focus Areas: ${request.focusAreas?.join(", ") || "All categories"}
Minimum Advance Hours: ${request.minimumAdvanceHours || 3.5}
Include Historical: ${request.includeHistorical || false}

Please provide:
1. List of new listings discovered
2. Opportunity scoring (0-100) for each listing
3. Recommended monitoring schedule
4. Agent handoff recommendations (Pattern Discovery, Symbol Analysis)
5. Risk assessment for each opportunity`;

    return this.processWithAgent(input, {
      requestType: "calendar_discovery",
      ...request,
    });
  }

  async analyzeMarketConditions(): Promise<EnhancedAgentResponse> {
    const input = `Analyze current market conditions affecting new token listings:

1. Overall market sentiment and volatility
2. Recent new listing performance patterns
3. Optimal timing windows for launches
4. Risk factors to consider
5. Liquidity and volume expectations

Provide recommendations for:
- Calendar monitoring frequency adjustments
- Risk threshold modifications
- Agent coordination strategies`;

    return this.processWithAgent(input, {
      requestType: "market_analysis",
    });
  }

  /**
   * Determine when to hand off to other agents
   */
  protected shouldHandoff(_input: string, context?: AgentContext): AgentHandoff | null {
    // If we found high-priority listings, hand off to pattern discovery
    if (
      context?.newListingsFound &&
      typeof context.highPriorityCount === "number" &&
      context.highPriorityCount > 0
    ) {
      return {
        toAgent: "enhanced-pattern-discovery-agent",
        context: {
          listings: context.newListings,
          analysisType: "ready_state_check",
          source: "calendar_discovery",
        },
        reason: "High-priority listings found, need ready-state pattern analysis",
      };
    }

    // If specific symbol analysis needed, hand off to symbol agent
    if (context?.requestType === "detailed_analysis" && context.symbol) {
      return {
        toAgent: "enhanced-symbol-analysis-agent",
        context: {
          symbol: context.symbol,
          projectData: context.projectData,
          analysisDepth: "comprehensive",
        },
        reason: "Detailed symbol analysis required for trading decision",
      };
    }

    return null;
  }

  /**
   * Enhanced processing with calendar-specific logic
   */
  async process(input: string, context?: AgentContext): Promise<EnhancedAgentResponse> {
    // Add calendar-specific context
    const enhancedContext = {
      ...context,
      agentType: "calendar",
      capabilities: ["listing_discovery", "timing_analysis", "market_assessment"],
      timestamp: new Date().toISOString(),
    };

    return this.processWithAgent(input, enhancedContext);
  }
}
