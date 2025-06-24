import { createSafeLogger } from "../lib/structured-logger";
import { validateCalendarEntry } from "../schemas/mexc-schemas";
import type { CalendarEntry } from "../services/mexc-unified-exports";
import { type AgentConfig, type AgentResponse, BaseAgent } from "./base-agent";
import { MexcApiAgent } from "./mexc-api-agent";

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

export interface ProcessedCalendarEntry extends CalendarEntry {
  launchTime: string;
  launchTimestamp: number;
  advanceHours: number;
  isUpcoming: boolean;
  isRecent: boolean;
  hasAdvanceNotice: boolean;
  urgency: string;
  tradingPairs: string[];
}

export class CalendarAgent extends BaseAgent {
  private _agentLogger?: ReturnType<typeof createSafeLogger>;
  protected get agentLogger() {
    if (!this._agentLogger) {
      this._agentLogger = createSafeLogger("calendar-agent");
    }
    return this._agentLogger;
  }

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

${
  input.includes("{")
    ? `Calendar Data:
${input}`
    : `Analysis Request: ${input}`
}

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

  async scanForNewListings(calendarData: CalendarEntry[]): Promise<AgentResponse> {
    try {
      this.agentLogger.info(
        `[CalendarAgent] Scanning ${calendarData.length} calendar entries for new listings`
      );

      // Validate and process input data
      if (!Array.isArray(calendarData) || calendarData.length === 0) {
        return {
          content: "No calendar data provided for analysis",
          metadata: {
            agent: this.config.name,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Process calendar data to identify new and upcoming listings
      const processedListings = this.preprocessCalendarData(calendarData);

      // Create comprehensive analysis prompt
      const userMessage = `
MEXC Calendar Analysis - New Listing Discovery

Calendar Data Analysis:
${JSON.stringify(processedListings, null, 2)}

**Task: Identify and analyze new cryptocurrency listings from MEXC calendar data**

Please provide a comprehensive analysis including:

1. **New Listing Discovery**
   - Identify newly announced tokens (within last 24-48 hours)
   - Extract critical metadata: vcoinId, symbol, project name, launch timing
   - Calculate advance notice hours from now until launch
   - Filter for listings providing 3.5+ hours advance notice

2. **Launch Timing Analysis**
   - Convert launch timestamps to readable dates/times
   - Calculate precise countdown to trading start
   - Identify optimal monitoring start times (T-4 hours)
   - Flag any scheduling conflicts or overlapping launches

3. **Market Opportunity Assessment**
   - Prioritize listings by sector appeal (DeFi, GameFi, AI, Layer1/Layer2)
   - Assess project legitimacy and market potential
   - Evaluate trading pair availability and liquidity expectations
   - Score opportunities (Critical/High/Medium/Low priority)

4. **Risk Factor Analysis**
   - Identify potential delays or schedule changes
   - Assess market timing risks (weekends, holidays)
   - Flag regulatory or compliance concerns
   - Evaluate technical implementation risks

5. **Action Plan Generation**
   - Recommend monitoring schedules for each listing
   - Suggest resource allocation priorities
   - Define alert thresholds and escalation procedures
   - Create timeline of critical decision points

**Output Requirements:**
- List of new listings with priority scores
- Specific launch times with countdown timers
- Monitoring recommendations with exact timing
- Risk assessments with mitigation strategies
- Structured data for automated processing

Focus on actionable intelligence for cryptocurrency trading preparation.
`;

      // Call OpenAI for intelligent analysis
      const aiResponse = await this.callOpenAI([
        {
          role: "user",
          content: userMessage,
        },
      ]);

      // Enhance response with structured analysis summary
      const summaryData = this.generateAnalysisSummary(processedListings);
      const enhancedContent = `${aiResponse.content}\n\n**Analysis Summary:**\n${summaryData}`;

      this.agentLogger.info(
        `[CalendarAgent] Successfully analyzed ${processedListings.length} listings`
      );
      return {
        content: enhancedContent,
        metadata: aiResponse.metadata,
      };
    } catch (error) {
      this.agentLogger.error(`[CalendarAgent] Error scanning new listings:`, error);
      return {
        content: `Calendar analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          agent: this.config.name,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // Preprocess calendar data for better analysis
  private isValidApiResponseStructure(
    response: unknown
  ): response is { success: boolean; data: unknown; error?: string } {
    return (
      typeof response === "object" &&
      response !== null &&
      "success" in response &&
      "data" in response &&
      typeof (response as { success: boolean; data: unknown; error?: string }).success === "boolean"
    );
  }

  private preprocessCalendarData(calendarData: CalendarEntry[]): ProcessedCalendarEntry[] {
    const now = Date.now();

    return calendarData
      .filter((entry) => {
        // Filter out invalid entries
        return entry?.vcoinId && entry.symbol && entry.firstOpenTime;
      })
      .map((entry) => {
        const launchTime = entry.firstOpenTime;
        const launchTimestamp =
          typeof launchTime === "number" ? launchTime : new Date(launchTime).getTime();
        const advanceHours = (launchTimestamp - now) / (1000 * 60 * 60);

        return {
          ...entry, // Spread the original entry to maintain type compatibility
          launchTime: new Date(launchTimestamp).toISOString(),
          launchTimestamp,
          advanceHours: Math.round(advanceHours * 100) / 100,
          isUpcoming: advanceHours > 0,
          isRecent: advanceHours > -24 && advanceHours < 0, // Launched within last 24 hours
          hasAdvanceNotice: advanceHours >= 3.5,
          urgency: this.calculateUrgency(advanceHours),
          tradingPairs: [`${entry.symbol}USDT`],
        };
      })
      .sort((a, b) => a.advanceHours - b.advanceHours); // Sort by launch time (soonest first)
  }

  // Calculate urgency level based on advance notice
  private calculateUrgency(advanceHours: number): string {
    if (advanceHours < 0) return "launched";
    if (advanceHours < 1) return "critical";
    if (advanceHours < 4) return "high";
    if (advanceHours < 12) return "medium";
    return "low";
  }

  // Generate analysis summary data
  private generateAnalysisSummary(processedListings: ProcessedCalendarEntry[]): string {
    const upcomingListings = processedListings.filter((l) => l.isUpcoming);
    const recentListings = processedListings.filter((l) => l.isRecent);
    const criticalListings = processedListings.filter((l) => l.urgency === "critical");
    const highPriorityListings = processedListings.filter(
      (l) => l.hasAdvanceNotice && l.isUpcoming
    );

    const nextLaunch = upcomingListings.length > 0 ? upcomingListings[0] : null;
    const recommendedActions = this.generateRecommendedActions(processedListings);

    return JSON.stringify(
      {
        totalEntries: processedListings.length,
        upcomingListings: upcomingListings.length,
        recentListings: recentListings.length,
        criticalListings: criticalListings.length,
        highPriorityListings: highPriorityListings.length,
        nextLaunch: nextLaunch
          ? {
              symbol: nextLaunch.symbol,
              launchTime: nextLaunch.launchTime,
              advanceHours: nextLaunch.advanceHours,
              urgency: nextLaunch.urgency,
            }
          : null,
        recommendedActions,
        analysisTimestamp: new Date().toISOString(),
      },
      null,
      2
    );
  }

  // Generate recommended actions based on listings analysis
  private generateRecommendedActions(listings: ProcessedCalendarEntry[]): string[] {
    const actions: string[] = [];

    const criticalListings = listings.filter((l) => l.urgency === "critical");
    const highUrgencyListings = listings.filter((l) => l.urgency === "high");
    const upcomingListings = listings.filter((l) => l.isUpcoming && l.hasAdvanceNotice);

    if (criticalListings.length > 0) {
      actions.push(
        `IMMEDIATE: Monitor ${criticalListings.length} critical listings launching within 1 hour`
      );
    }

    if (highUrgencyListings.length > 0) {
      actions.push(
        `HIGH PRIORITY: Prepare for ${highUrgencyListings.length} listings launching within 4 hours`
      );
    }

    if (upcomingListings.length > 0) {
      actions.push(
        `SCHEDULE: Set up monitoring for ${upcomingListings.length} upcoming listings with sufficient advance notice`
      );
    }

    if (actions.length === 0) {
      actions.push("MONITOR: Continue regular calendar scanning for new announcements");
    }

    return actions;
  }

  // Fetch fresh calendar data using MexcApiAgent
  async fetchLatestCalendarData(): Promise<CalendarEntry[]> {
    try {
      this.agentLogger.info(`[CalendarAgent] Fetching latest calendar data via MexcApiAgent`);

      const mexcApiAgent = new MexcApiAgent();
      const response = await mexcApiAgent.callMexcApi("/calendar");

      // Type guard for response structure
      if (!this.isValidApiResponseStructure(response) || !response.success) {
        const errorMsg = this.isValidApiResponseStructure(response)
          ? response.error
          : "Invalid response structure";
        throw new Error(`Failed to fetch calendar data: ${errorMsg}`);
      }

      // Validate calendar entries using Zod
      const validatedEntries = (Array.isArray(response.data) ? response.data : [])
        .map((entry: unknown) => {
          try {
            return validateCalendarEntry(entry);
          } catch (_error) {
            this.agentLogger.warn(`[CalendarAgent] Invalid calendar entry:`, entry);
            return null;
          }
        })
        .filter((entry: CalendarEntry | null): entry is CalendarEntry => entry !== null);

      this.agentLogger.info(
        `[CalendarAgent] Retrieved ${validatedEntries.length} valid calendar entries`
      );
      return validatedEntries;
    } catch (error) {
      this.agentLogger.error(`[CalendarAgent] Failed to fetch calendar data:`, error);
      return [];
    }
  }

  // Comprehensive calendar monitoring workflow
  async performCalendarMonitoring(_request?: CalendarMonitoringRequest): Promise<AgentResponse> {
    try {
      this.agentLogger.info(`[CalendarAgent] Starting comprehensive calendar monitoring`);

      // Fetch latest calendar data
      const calendarData = await this.fetchLatestCalendarData();

      if (calendarData.length === 0) {
        return {
          content: "No calendar data available for monitoring",
          metadata: {
            agent: this.config.name,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Perform new listings scan with AI analysis
      const scanResults = await this.scanForNewListings(calendarData);

      // If scan was successful, enhance with additional monitoring plan
      if (scanResults.content && !scanResults.content.includes("failed")) {
        // Extract processed data from content (since we can't use metadata)
        const upcomingListingsMatch = scanResults.content.match(/"upcomingListings":\s*(\d+)/);
        const upcomingCount = upcomingListingsMatch ? Number.parseInt(upcomingListingsMatch[1]) : 0;

        if (upcomingCount > 0) {
          // Generate a simple monitoring plan
          const monitoringPlan = await this.createMonitoringPlan([]);

          // Combine results in content
          return {
            content: `${scanResults.content}\n\n**Monitoring Plan:**\n${monitoringPlan.content}`,
            metadata: scanResults.metadata,
          };
        }
      }

      return scanResults;
    } catch (error) {
      this.agentLogger.error(`[CalendarAgent] Calendar monitoring workflow failed:`, error);
      return {
        content: `Calendar monitoring failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          agent: this.config.name,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async analyzeListingTiming(
    listingData: CalendarEntry | ProcessedCalendarEntry
  ): Promise<AgentResponse> {
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

  async assessMarketPotential(
    projectData: CalendarEntry | ProcessedCalendarEntry
  ): Promise<AgentResponse> {
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
