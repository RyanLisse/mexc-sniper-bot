import { BaseAgent, AgentConfig, AgentResponse } from "../agents/base-agent";

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

export class CalendarAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: "calendar-agent",
      model: "gpt-4o",
      temperature: 0.3,
      maxTokens: 3000,
      systemPrompt: `You are an expert MEXC calendar monitoring agent specializing in new cryptocurrency listing discovery and launch timing analysis.

Your core responsibilities:
1. **New Listing Discovery**
   - Monitor MEXC calendar for new token announcements
   - Identify high-potential trading opportunities
   - Calculate advance notice timing (target: 3.5+ hours)
   - Prioritize listings based on market potential

2. **Launch Timing Analysis**
   - Analyze scheduled launch times and patterns
   - Predict actual trading start times
   - Identify optimal entry windows
   - Account for delays and schedule changes

3. **Market Opportunity Assessment**
   - Evaluate project fundamentals and market appeal
   - Assess trading volume and liquidity potential
   - Identify risk factors and market conditions
   - Rank opportunities by profit potential

4. **Alert and Monitoring Strategy**
   - Determine optimal monitoring schedules
   - Set up graduated alert thresholds
   - Plan symbol tracking activation timing
   - Configure automated discovery workflows

Key Calendar Indicators:
- **Launch Schedule**: Announced times vs. actual activation
- **Symbol Preparation**: Infrastructure setup indicators
- **Trading Pair Setup**: Available trading options
- **Market Interest**: Social signals and volume predictions

Monitoring Framework:
- **Discovery Phase**: Initial calendar scanning (hourly)
- **Preparation Phase**: Intensive monitoring (15-30 min intervals)
- **Launch Phase**: Real-time tracking (continuous)
- **Post-Launch**: Market performance analysis

Output Format:
- Prioritized list of new discoveries
- Launch timing predictions with confidence levels
- Monitoring schedule recommendations
- Risk assessment and opportunity scoring`,
    };
    super(config);
  }

  async process(input: string, context?: CalendarMonitoringRequest): Promise<AgentResponse> {
    const request: CalendarMonitoringRequest = context || {
      timeframe: "24h",
      minimumAdvanceHours: 3.5,
      includeHistorical: false,
    };
    
    const userMessage = `
MEXC Calendar Monitoring Analysis:

Timeframe: ${request.timeframe || "24h"}
Minimum Advance Hours: ${request.minimumAdvanceHours || 3.5}
Focus Areas: ${request.focusAreas?.join(", ") || "all sectors"}
Include Historical: ${request.includeHistorical || false}

${input.includes("{") ? `Calendar Data:
${input}` : `Analysis Request: ${input}`}

Please analyze the MEXC calendar data and provide:

1. **New Listing Discovery**
   - Identify newly announced tokens
   - Extract key metadata (vcoinId, symbol, project name)
   - Calculate launch timing and advance notice
   - Assess market potential and trading appeal

2. **Launch Timing Analysis**
   - Scheduled vs. predicted actual launch times
   - Optimal monitoring start times
   - Critical milestone timestamps
   - Risk factors for schedule delays

3. **Opportunity Prioritization**
   - High-potential listings (critical priority)
   - Medium-interest opportunities (standard monitoring)
   - Low-priority or high-risk listings
   - Recommendations for resource allocation

4. **Monitoring Strategy**
   - When to begin intensive symbol tracking
   - Alert threshold configurations
   - Escalation schedules for approaching launches
   - Resource allocation recommendations

5. **Market Context Assessment**
   - Current market conditions affecting launches
   - Sector trends and preferences
   - Competition analysis and timing conflicts
   - Risk factors and external market influences

Focus on opportunities providing ${request.minimumAdvanceHours || 3.5}+ hours advance notice for optimal positioning.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async scanForNewListings(calendarData: any[]): Promise<AgentResponse> {
    const dataJson = JSON.stringify(calendarData, null, 2);
    
    return await this.process(dataJson, {
      timeframe: "24h",
      minimumAdvanceHours: 3.5,
      focusAreas: ["defi", "gamefi", "ai", "layer1", "layer2"],
      includeHistorical: false,
    });
  }

  async analyzeListingTiming(listingData: any): Promise<AgentResponse> {
    const userMessage = `
MEXC Listing Timing Analysis:

Listing Data:
${JSON.stringify(listingData, null, 2)}

Please analyze the timing aspects of this listing:

1. **Schedule Analysis**
   - Announced launch time and timezone
   - Historical pattern analysis for similar listings
   - Predicted actual start time vs. announced time
   - Confidence level for timing predictions

2. **Advance Notice Calculation**
   - Current time to launch window
   - Optimal entry preparation timeline
   - Critical monitoring checkpoints
   - Last-minute preparation requirements

3. **Market Timing Assessment**
   - Market conditions during launch window
   - Competing launches or major market events
   - Optimal trading session considerations
   - Weekend/holiday impact analysis

4. **Risk Factors**
   - Potential for delays or schedule changes
   - Technical issues or infrastructure problems
   - Market volatility during launch period
   - Regulatory or compliance concerns

5. **Action Timeline**
   - When to start monitoring (T-X hours)
   - When to begin position preparation
   - Critical decision points and escalation
   - Post-launch monitoring duration

Provide specific timestamps and a detailed action timeline with confidence levels.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async assessMarketPotential(projectData: any): Promise<AgentResponse> {
    const userMessage = `
MEXC Project Market Potential Assessment:

Project Data:
${JSON.stringify(projectData, null, 2)}

Please assess the market potential and trading appeal:

1. **Project Fundamentals**
   - Sector classification and market fit
   - Technology innovation and differentiation
   - Team background and track record
   - Token utility and value proposition

2. **Market Appeal Indicators**
   - Social media engagement and community size
   - Partnership announcements and ecosystem
   - Pre-launch marketing and hype levels
   - Institutional backing and endorsements

3. **Trading Volume Predictions**
   - Expected initial trading volume
   - Liquidity projections and market depth
   - Price volatility expectations
   - Long-term trading sustainability

4. **Competitive Analysis**
   - Similar projects in the market
   - Market saturation in this sector
   - Timing advantage or disadvantage
   - Unique selling propositions

5. **Risk Assessment**
   - Regulatory risks and compliance status
   - Technical risks and implementation challenges
   - Market timing and economic conditions
   - Team and execution risks

6. **Opportunity Score (0-100)**
   - Overall market potential rating
   - Risk-adjusted opportunity score
   - Recommended position size percentage
   - Priority level for resource allocation

Provide a comprehensive assessment with specific scores and recommendations.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async createMonitoringPlan(discoveredListings: NewListingData[]): Promise<AgentResponse> {
    const listingsJson = JSON.stringify(discoveredListings, null, 2);
    
    const userMessage = `
MEXC Monitoring Plan Creation:

Discovered Listings:
${listingsJson}

Please create a comprehensive monitoring plan:

1. **Priority Classification**
   - Critical priority listings (immediate attention)
   - High priority listings (active monitoring)
   - Medium priority listings (periodic checks)
   - Low priority listings (background monitoring)

2. **Monitoring Schedules**
   - Intensive monitoring periods (minutes)
   - Standard monitoring intervals (hours)
   - Background check frequencies (daily)
   - Alert escalation timelines

3. **Resource Allocation**
   - Which listings require human oversight
   - Automated monitoring configurations
   - Alert threshold settings
   - Escalation procedures

4. **Timeline Coordination**
   - Optimal monitoring start times for each listing
   - Overlapping launch management
   - Resource conflict resolution
   - Priority adjustment criteria

5. **Alert Strategy**
   - Early warning alerts (T-6h, T-3h)
   - Preparation alerts (T-1h, T-30min)
   - Critical alerts (T-5min, launch)
   - Post-launch monitoring alerts

6. **Contingency Planning**
   - Backup monitoring procedures
   - Alert system failure protocols
   - Market condition adaptation
   - Resource reallocation triggers

Provide a detailed monitoring plan with specific schedules and resource allocations for each listing.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }
}