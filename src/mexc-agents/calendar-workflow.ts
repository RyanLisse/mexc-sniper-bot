import {
  type AnalysisResult,
  type CalendarEntry,
  calculateUrgencyLevel,
  categorizeOpportunity,
  combineConfidenceScores,
  extractConfidencePercentage,
  extractLiquidityScore,
  formatTimestamp,
  generateRecommendation,
  sanitizeSymbolName,
} from "./analysis-utils";
import type { AgentResponse } from "./base-agent";

export interface CalendarWorkflowResult {
  newListings: CalendarEntry[];
  readyTargets: CalendarEntry[];
  confidence: number;
  analysisTimestamp: string;
}

export class CalendarWorkflow {
  // Simple console logger to avoid webpack bundling issues
  private logger = {
    info: (message: string, context?: any) => console.info('[calendar-workflow]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[calendar-workflow]', message, context || ''),
    error: (message: string, context?: any) => console.error('[calendar-workflow]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[calendar-workflow]', message, context || ''),
  };

  async analyzeDiscoveryResults(
    calendarAnalysis: AgentResponse,
    patternAnalysis: AgentResponse,
    calendarData: any
  ): Promise<CalendarWorkflowResult> {
    console.info("[CalendarWorkflow] Analyzing discovery results");

    const calendarInsights = this.extractCalendarInsights(calendarAnalysis);
    const patternInsights = this.extractPatternInsights(patternAnalysis);

    const calendarEntries = calendarData?.success ? calendarData.data : [];
    const processedListings = await this.processListingsWithAIInsights(
      calendarEntries,
      calendarInsights,
      patternInsights
    );

    const categorizedOpportunities = this.categorizeOpportunities(processedListings);
    const recommendations = this.generateActionableRecommendations(categorizedOpportunities);
    const overallAssessment = this.calculateOverallAssessment(recommendations);

    return {
      newListings: categorizedOpportunities.newListings || [],
      readyTargets: categorizedOpportunities.readyTargets || [],
      confidence: overallAssessment.confidence,
      analysisTimestamp: new Date().toISOString(),
    };
  }

  private extractCalendarInsights(analysis: AgentResponse): AnalysisResult {
    const content = analysis.content || "";
    const confidence = extractConfidencePercentage(content);

    const insights: string[] = [];

    // Extract key insights from calendar analysis
    if (content.includes("new listing") || content.includes("upcoming launch")) {
      insights.push("New listing opportunities detected");
    }

    if (content.includes("high interest") || content.includes("strong potential")) {
      insights.push("High market interest indicators");
    }

    if (content.includes("ready state") || content.includes("sts:2, st:2, tt:4")) {
      insights.push("Ready state patterns identified");
    }

    const urgencyLevel = content.match(/urgency[:\s]*(\w+)/i)?.[1] || "medium";
    insights.push(`Urgency level: ${urgencyLevel}`);

    return {
      confidence,
      insights,
      actionable: confidence >= 60 && insights.length > 0,
      urgency: urgencyLevel,
    };
  }

  private extractPatternInsights(analysis: AgentResponse): AnalysisResult {
    const content = analysis.content || "";
    const confidence = extractConfidencePercentage(content);

    const insights: string[] = [];

    // Extract pattern-specific insights
    if (content.includes("pattern detected") || content.includes("signal identified")) {
      insights.push("Trading patterns detected");
    }

    if (content.includes("volume spike") || content.includes("increased activity")) {
      insights.push("Volume indicators present");
    }

    if (content.includes("3.5+ hour advance") || content.includes("optimal timing")) {
      insights.push("Optimal advance timing detected");
    }

    const liquidityScore = extractLiquidityScore(content);
    insights.push(`Liquidity assessment: ${liquidityScore}`);

    return {
      confidence,
      insights,
      actionable: confidence >= 70,
    };
  }

  private async processListingsWithAIInsights(
    calendarEntries: CalendarEntry[],
    calendarInsights: AnalysisResult,
    patternInsights: AnalysisResult
  ): Promise<CalendarEntry[]> {
    console.info("[CalendarWorkflow] Processing listings with AI insights");

    if (!Array.isArray(calendarEntries)) {
      console.warn("[CalendarWorkflow] Invalid calendar entries, using empty array");
      return [];
    }

    return calendarEntries.map((entry) => {
      const confidence = combineConfidenceScores([
        calendarInsights.confidence,
        patternInsights.confidence,
      ]);

      const urgency = calculateUrgencyLevel(entry);
      const category = categorizeOpportunity(entry, confidence);
      const recommendation = generateRecommendation(entry, confidence);

      return {
        ...entry,
        aiAnalysis: {
          confidence,
          urgency,
          category,
          recommendation,
          calendarInsights: calendarInsights.insights,
          patternInsights: patternInsights.insights,
          actionable: calendarInsights.actionable && patternInsights.actionable,
        },
      };
    });
  }

  private categorizeOpportunities(processedListings: CalendarEntry[]): {
    newListings: CalendarEntry[];
    readyTargets: CalendarEntry[];
    highPotential: CalendarEntry[];
    monitoring: CalendarEntry[];
  } {
    console.info("[CalendarWorkflow] Categorizing opportunities");

    const newListings: CalendarEntry[] = [];
    const readyTargets: CalendarEntry[] = [];
    const highPotential: CalendarEntry[] = [];
    const monitoring: CalendarEntry[] = [];

    for (const listing of processedListings) {
      const analysis = listing.aiAnalysis as any;
      if (!analysis) continue;

      const confidence = analysis.confidence || 0;
      const urgency = analysis.urgency || "low";
      const category = analysis.category || "poor";

      // Categorize based on confidence and urgency
      if (category === "prime" && urgency === "high") {
        readyTargets.push(listing);
      } else if (category === "prime" || category === "strong") {
        newListings.push(listing);
      } else if (confidence >= 60) {
        highPotential.push(listing);
      } else {
        monitoring.push(listing);
      }
    }

    return {
      newListings,
      readyTargets,
      highPotential,
      monitoring,
    };
  }

  private generateActionableRecommendations(categorizedOpportunities: {
    newListings: CalendarEntry[];
    readyTargets: CalendarEntry[];
    highPotential: CalendarEntry[];
    monitoring: CalendarEntry[];
  }): {
    immediate: string[];
    planned: string[];
    watchlist: string[];
    total: number;
  } {
    console.info("[CalendarWorkflow] Generating actionable recommendations");

    const immediate: string[] = [];
    const planned: string[] = [];
    const watchlist: string[] = [];

    // Process ready targets for immediate action
    for (const target of categorizedOpportunities.readyTargets) {
      const symbol = sanitizeSymbolName(target.symbol);
      const analysis = target.aiAnalysis as any;
      immediate.push(`SNIPE ${symbol}: ${analysis?.recommendation || "High-priority target"}`);
    }

    // Process new listings for planned action
    for (const listing of categorizedOpportunities.newListings) {
      const symbol = sanitizeSymbolName(listing.symbol);
      const launchTime = formatTimestamp(listing.launchTime);
      planned.push(`PREPARE ${symbol}: Launch at ${launchTime} - Monitor for ready state`);
    }

    // Process high potential for watchlist
    for (const potential of categorizedOpportunities.highPotential) {
      const symbol = sanitizeSymbolName(potential.symbol);
      const analysis = potential.aiAnalysis as any;
      const confidence = analysis?.confidence || 0;
      watchlist.push(`WATCH ${symbol}: ${confidence}% confidence - Monitor conditions`);
    }

    const total = immediate.length + planned.length + watchlist.length;

    return {
      immediate,
      planned,
      watchlist,
      total,
    };
  }

  private calculateOverallAssessment(recommendations: {
    immediate: string[];
    planned: string[];
    watchlist: string[];
    total: number;
  }): {
    confidence: number;
    marketActivity: string;
    recommendation: string;
    summary: string;
  } {
    console.info("[CalendarWorkflow] Calculating overall assessment");

    const immediateCount = recommendations.immediate.length;
    const plannedCount = recommendations.planned.length;
    const watchlistCount = recommendations.watchlist.length;
    const totalCount = recommendations.total;

    // Calculate confidence based on opportunity distribution
    let confidence = 50; // Base confidence

    if (immediateCount > 0) confidence += 20;
    if (plannedCount > 0) confidence += 15;
    if (watchlistCount > 0) confidence += 10;
    if (totalCount >= 5) confidence += 10;

    confidence = Math.min(confidence, 95);

    // Determine market activity level
    let marketActivity = "low";
    if (totalCount >= 10) marketActivity = "very high";
    else if (totalCount >= 7) marketActivity = "high";
    else if (totalCount >= 4) marketActivity = "moderate";
    else if (totalCount >= 2) marketActivity = "low";

    // Generate overall recommendation
    let recommendation = "MONITOR";
    if (immediateCount >= 2) recommendation = "ACTIVE SNIPING";
    else if (immediateCount >= 1) recommendation = "SELECTIVE SNIPING";
    else if (plannedCount >= 3) recommendation = "PREPARE POSITIONS";
    else if (totalCount >= 3) recommendation = "MONITOR CLOSELY";

    const summary = `Found ${totalCount} opportunities: ${immediateCount} immediate, ${plannedCount} planned, ${watchlistCount} watching. Market activity: ${marketActivity}.`;

    return {
      confidence,
      marketActivity,
      recommendation,
      summary,
    };
  }
}
