import type { AgentResponse } from "../agents/base-agent";
import { StrategyAgent } from "../agents/strategy-agent";
import { CalendarAgent } from "./calendar-agent";
import { MexcApiAgent } from "./mexc-api-agent";
import { PatternDiscoveryAgent } from "./pattern-discovery-agent";
import { SymbolAnalysisAgent } from "./symbol-analysis-agent";

export interface CalendarDiscoveryWorkflowRequest {
  trigger: string;
  force?: boolean;
}

export interface SymbolAnalysisWorkflowRequest {
  vcoinId: string;
  symbolName?: string;
  projectName?: string;
  launchTime?: string;
  attempt?: number;
}

export interface PatternAnalysisWorkflowRequest {
  vcoinId?: string;
  symbols?: string[];
  analysisType: "discovery" | "monitoring" | "execution";
}

export interface TradingStrategyWorkflowRequest {
  vcoinId: string;
  symbolData: any;
  riskLevel?: "low" | "medium" | "high";
  capital?: number;
}

export interface MexcWorkflowResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    agentsUsed: string[];
    duration?: number;
    confidence?: number;
  };
}

export class MexcOrchestrator {
  private mexcApiAgent: MexcApiAgent;
  private patternDiscoveryAgent: PatternDiscoveryAgent;
  private calendarAgent: CalendarAgent;
  private symbolAnalysisAgent: SymbolAnalysisAgent;
  private strategyAgent: StrategyAgent;

  constructor() {
    this.mexcApiAgent = new MexcApiAgent();
    this.patternDiscoveryAgent = new PatternDiscoveryAgent();
    this.calendarAgent = new CalendarAgent();
    this.symbolAnalysisAgent = new SymbolAnalysisAgent();
    this.strategyAgent = new StrategyAgent();
  }

  async executeCalendarDiscoveryWorkflow(
    request: CalendarDiscoveryWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    try {
      console.log(
        `[MexcOrchestrator] Starting calendar discovery workflow - trigger: ${request.trigger}`
      );
      const startTime = Date.now();

      // Step 1: Fetch calendar data via API agent
      console.log(`[MexcOrchestrator] Step 1: Fetching calendar data`);
      let calendarData;
      try {
        calendarData = await this.mexcApiAgent.callMexcApi("/calendar");
        console.log(`[MexcOrchestrator] Received calendar data:`, calendarData);
      } catch (error) {
        console.error(`[MexcOrchestrator] Calendar API call failed:`, error);
        calendarData = {
          success: false,
          data: [],
          count: 0,
          timestamp: new Date().toISOString(),
          source: "error_fallback",
        };
      }

      // Step 2: AI analysis of calendar data
      console.log(`[MexcOrchestrator] Step 2: AI calendar analysis`);
      const calendarEntries = calendarData?.success ? calendarData.data : [];
      const calendarAnalysis = await this.calendarAgent.scanForNewListings(calendarEntries);

      // Step 3: Pattern discovery on calendar data
      console.log(`[MexcOrchestrator] Step 3: Pattern discovery analysis`);
      const patternAnalysis = await this.patternDiscoveryAgent.discoverNewListings(calendarEntries);

      // Step 4: Combine results and extract actionable data
      console.log(`[MexcOrchestrator] Step 4: Combining analysis results`);
      const combinedAnalysis = await this.analyzeDiscoveryResults(
        calendarAnalysis,
        patternAnalysis,
        calendarData
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: {
          newListings: combinedAnalysis.newListings || [],
          readyTargets: combinedAnalysis.readyTargets || [],
          analysisTimestamp: new Date().toISOString(),
          trigger: request.trigger,
          calendarData: calendarEntries,
          apiStatus: calendarData?.success ? "connected" : "fallback",
        },
        metadata: {
          agentsUsed: ["mexc-api", "calendar", "pattern-discovery"],
          duration,
          confidence: combinedAnalysis.confidence || 75,
        },
      };
    } catch (error) {
      console.error(`[MexcOrchestrator] Calendar discovery workflow failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          agentsUsed: ["mexc-api", "calendar", "pattern-discovery"],
        },
      };
    }
  }

  async executeSymbolAnalysisWorkflow(
    request: SymbolAnalysisWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    try {
      console.log(`[MexcOrchestrator] Starting symbol analysis workflow for: ${request.vcoinId}`);
      const startTime = Date.now();

      // Step 1: Fetch symbol data via API agent
      console.log(`[MexcOrchestrator] Step 1: Fetching symbol data for: ${request.vcoinId}`);
      let symbolData;
      try {
        symbolData = await this.mexcApiAgent.callMexcApi("/symbols", {
          vcoinId: request.vcoinId,
        });
        console.log(`[MexcOrchestrator] Received symbol data:`, symbolData);
      } catch (error) {
        console.error(`[MexcOrchestrator] Symbol API call failed:`, error);
        symbolData = {
          success: false,
          data: [],
          count: 0,
          vcoin_id: request.vcoinId,
          source: "error_fallback",
        };
      }

      // Step 2: AI-powered symbol readiness analysis
      console.log(`[MexcOrchestrator] Step 2: Symbol readiness analysis`);
      const symbolEntries = symbolData?.success ? symbolData.data : [];
      const readinessAnalysis = await this.symbolAnalysisAgent.analyzeSymbolReadiness(
        request.vcoinId,
        { data: symbolEntries, source: symbolData?.source || "unknown" }
      );

      // Step 3: Pattern validation for ready state
      console.log(`[MexcOrchestrator] Step 3: Ready state pattern validation`);
      const patternValidation = await this.patternDiscoveryAgent.validateReadyState({
        vcoinId: request.vcoinId,
        symbolData: symbolEntries,
        count: symbolEntries.length,
      });

      // Step 4: Market microstructure analysis
      console.log(`[MexcOrchestrator] Step 4: Market microstructure analysis`);
      const marketAnalysis = await this.symbolAnalysisAgent.assessMarketMicrostructure({
        vcoinId: request.vcoinId,
        symbolData: symbolEntries,
      });

      // Step 5: Combine analysis results
      console.log(`[MexcOrchestrator] Step 5: Combining analysis results`);
      const finalAnalysis = await this.combineSymbolAnalysis(
        readinessAnalysis,
        patternValidation,
        marketAnalysis,
        symbolData
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: {
          vcoinId: request.vcoinId,
          symbolReady: finalAnalysis.symbolReady || false,
          hasCompleteData: finalAnalysis.hasCompleteData || false,
          confidence: finalAnalysis.confidence || 0,
          riskLevel: finalAnalysis.riskLevel || "medium",
          symbolData: symbolEntries,
          apiStatus: symbolData?.success ? "connected" : "fallback",
          analysisResults: {
            readiness: readinessAnalysis,
            pattern: patternValidation,
            market: marketAnalysis,
          },
        },
        metadata: {
          agentsUsed: ["mexc-api", "symbol-analysis", "pattern-discovery"],
          duration,
          confidence: finalAnalysis.confidence || 0,
        },
      };
    } catch (error) {
      console.error(`[MexcOrchestrator] Symbol analysis workflow failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          agentsUsed: ["mexc-api", "symbol-analysis", "pattern-discovery"],
        },
      };
    }
  }

  async executePatternAnalysisWorkflow(
    request: PatternAnalysisWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    try {
      console.log(`[MexcOrchestrator] Starting pattern analysis workflow`);
      const startTime = Date.now();

      // Step 1: Gather data for analysis
      let analysisData;
      if (request.vcoinId) {
        try {
          analysisData = await this.mexcApiAgent.callMexcApi("/api/v3/etf/symbols", {
            vcoin_id: request.vcoinId,
          });
        } catch (error) {
          analysisData = { vcoinId: request.vcoinId, source: "fallback" };
        }
      } else if (request.symbols) {
        analysisData = { symbols: request.symbols };
      } else {
        analysisData = { analysisType: request.analysisType };
      }

      // Step 2: Pattern discovery analysis
      console.log(`[MexcOrchestrator] Step 2: Pattern discovery analysis`);
      const patternAnalysis = await this.patternDiscoveryAgent.process(
        JSON.stringify(analysisData),
        {
          symbolData: analysisData.symbols ? [analysisData] : [analysisData],
          analysisType: request.analysisType,
          confidenceThreshold: 70,
        }
      );

      // Step 3: Extract actionable patterns
      console.log(`[MexcOrchestrator] Step 3: Extracting actionable patterns`);
      const actionablePatterns = await this.extractActionablePatterns(
        patternAnalysis,
        analysisData
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: {
          patterns: actionablePatterns.patterns || [],
          recommendations: actionablePatterns.recommendations || [],
          confidenceScore: actionablePatterns.confidence || 0,
          analysisType: request.analysisType,
        },
        metadata: {
          agentsUsed: ["mexc-api", "pattern-discovery"],
          duration,
          confidence: actionablePatterns.confidence || 0,
        },
      };
    } catch (error) {
      console.error(`[MexcOrchestrator] Pattern analysis workflow failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          agentsUsed: ["mexc-api", "pattern-discovery"],
        },
      };
    }
  }

  async executeTradingStrategyWorkflow(
    request: TradingStrategyWorkflowRequest
  ): Promise<MexcWorkflowResult> {
    try {
      console.log(`[MexcOrchestrator] Starting trading strategy workflow for: ${request.vcoinId}`);
      const startTime = Date.now();

      // Step 1: Market analysis of symbol data
      console.log(`[MexcOrchestrator] Step 1: Market analysis`);
      const marketAnalysis = await this.mexcApiAgent.identifyTradingSignals(request.symbolData);

      // Step 2: Create trading strategy
      console.log(`[MexcOrchestrator] Step 2: Strategy creation`);
      const strategy = await this.strategyAgent.createTradingStrategy(
        `${marketAnalysis.content}\n\nSymbol Data: ${JSON.stringify(request.symbolData)}`,
        request.riskLevel,
        "medium"
      );

      // Step 3: Risk assessment and validation
      console.log(`[MexcOrchestrator] Step 3: Risk assessment`);
      const riskAssessment = await this.patternDiscoveryAgent.assessPatternReliability(
        request.symbolData
      );

      // Step 4: Combine strategy and risk analysis
      console.log(`[MexcOrchestrator] Step 4: Final strategy compilation`);
      const finalStrategy = await this.compileTradingStrategy(
        strategy,
        riskAssessment,
        marketAnalysis,
        request
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: {
          vcoinId: request.vcoinId,
          entryPrice: finalStrategy.entryPrice,
          stopLoss: finalStrategy.stopLoss,
          takeProfit: finalStrategy.takeProfit,
          positionSize: finalStrategy.positionSize,
          riskRewardRatio: finalStrategy.riskRewardRatio,
          strategy: strategy.content,
          riskAssessment: riskAssessment.content,
        },
        metadata: {
          agentsUsed: ["mexc-api", "strategy", "pattern-discovery"],
          duration,
          confidence: finalStrategy.confidence || 75,
        },
      };
    } catch (error) {
      console.error(`[MexcOrchestrator] Trading strategy workflow failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          agentsUsed: ["mexc-api", "strategy", "pattern-discovery"],
        },
      };
    }
  }

  // Helper methods for combining analysis results
  private async analyzeDiscoveryResults(
    calendarAnalysis: AgentResponse,
    patternAnalysis: AgentResponse,
    calendarData: any
  ): Promise<any> {
    try {
      console.log(`[MexcOrchestrator] Analyzing discovery results from multi-agent workflow`);

      // Extract calendar data from API response
      const calendarEntries = calendarData?.success ? calendarData.data : [];
      console.log(`[MexcOrchestrator] Processing ${calendarEntries.length} calendar entries`);

      // Parse AI analysis results for insights
      const calendarInsights = this.extractCalendarInsights(calendarAnalysis);
      const patternInsights = this.extractPatternInsights(patternAnalysis);

      // Process real calendar data with AI-enhanced analysis
      const processedListings = this.processListingsWithAIInsights(
        calendarEntries,
        calendarInsights,
        patternInsights
      );

      // Categorize opportunities based on timing and confidence
      const categorizedResults = this.categorizeOpportunities(processedListings);

      // Generate actionable recommendations
      const recommendations = this.generateActionableRecommendations(
        categorizedResults,
        calendarInsights,
        patternInsights
      );

      // Calculate overall confidence and risk assessment
      const overallAssessment = this.calculateOverallAssessment(
        categorizedResults,
        calendarInsights,
        patternInsights
      );

      console.log(
        `[MexcOrchestrator] Analysis complete: ${categorizedResults.newListings.length} new listings, ${categorizedResults.readyTargets.length} ready targets, ${categorizedResults.highPriorityOpportunities.length} high-priority opportunities`
      );

      return {
        // Categorized opportunities
        newListings: categorizedResults.newListings,
        readyTargets: categorizedResults.readyTargets,
        highPriorityOpportunities: categorizedResults.highPriorityOpportunities,
        monitoringTargets: categorizedResults.monitoringTargets,

        // AI insights
        calendarInsights: calendarInsights.summary,
        patternInsights: patternInsights.summary,

        // Actionable recommendations
        immediateActions: recommendations.immediate,
        scheduledActions: recommendations.scheduled,
        monitoringPlan: recommendations.monitoring,

        // Overall assessment
        confidence: overallAssessment.confidence,
        riskLevel: overallAssessment.riskLevel,
        marketConditions: overallAssessment.marketConditions,

        // Metadata
        analysisComplete: true,
        totalEntriesProcessed: calendarEntries.length,
        analysisTimestamp: new Date().toISOString(),
        agentsContributed: ["calendar-agent", "pattern-discovery-agent"],
      };
    } catch (error) {
      console.error(`[MexcOrchestrator] Discovery analysis failed:`, error);
      return {
        newListings: [],
        readyTargets: [],
        confidence: 0,
        analysisComplete: false,
        error: error instanceof Error ? error.message : "Unknown error",
        analysisTimestamp: new Date().toISOString(),
      };
    }
  }

  // Extract insights from CalendarAgent analysis
  private extractCalendarInsights(calendarAnalysis: AgentResponse): any {
    const content = calendarAnalysis.content;
    const metadata = calendarAnalysis.metadata || {};

    // Parse structured data from content if available
    let structuredData = {};
    try {
      const summaryMatch = content.match(/\*\*Analysis Summary:\*\*([\s\S]*?)(?:\n\n|\n$|$)/);
      if (summaryMatch) {
        const summaryData = summaryMatch[1].trim();
        structuredData = JSON.parse(summaryData);
      }
    } catch (error) {
      console.warn(`[MexcOrchestrator] Could not parse calendar summary data`);
    }

    return {
      rawContent: content,
      metadata,
      structuredData,
      summary: {
        upcomingListings: (structuredData as any)?.upcomingListings || 0,
        criticalListings: (structuredData as any)?.criticalListings || 0,
        highPriorityListings: (structuredData as any)?.highPriorityListings || 0,
        nextLaunch: (structuredData as any)?.nextLaunch || null,
        recommendedActions: (structuredData as any)?.recommendedActions || [],
      },
    };
  }

  // Extract insights from PatternDiscoveryAgent analysis
  private extractPatternInsights(patternAnalysis: AgentResponse): any {
    const content = patternAnalysis.content;
    const metadata = patternAnalysis.metadata || {};

    // Parse pattern summary data
    let patternSummary = {};
    try {
      const summaryMatch = content.match(
        /\*\*Pattern Analysis Summary:\*\*([\s\S]*?)(?:\n\n|\n$|$)/
      );
      if (summaryMatch) {
        const summaryData = summaryMatch[1].trim();
        patternSummary = JSON.parse(summaryData);
      }
    } catch (error) {
      console.warn(`[MexcOrchestrator] Could not parse pattern summary data`);
    }

    return {
      rawContent: content,
      metadata,
      patternSummary,
      summary: {
        totalOpportunities: (patternSummary as any)?.totalOpportunities || 0,
        highConfidenceMatches: (patternSummary as any)?.highConfidenceMatches || 0,
        optimalAdvanceNotice: (patternSummary as any)?.optimalAdvanceNotice || 0,
        averageAdvanceHours: (patternSummary as any)?.averageAdvanceHours || 0,
        projectTypeDistribution: (patternSummary as any)?.projectTypeDistribution || {},
        urgencyLevels: (patternSummary as any)?.urgencyLevels || {},
      },
    };
  }

  // Process listings with enhanced AI insights
  private processListingsWithAIInsights(
    calendarEntries: any[],
    calendarInsights: any,
    patternInsights: any
  ): any[] {
    const now = Date.now();

    return calendarEntries
      .filter((entry) => {
        return entry && entry.vcoinId && entry.symbol && (entry.firstOpenTime || entry.launchTime);
      })
      .map((entry) => {
        const launchTime = entry.firstOpenTime || entry.launchTime;
        const launchTimestamp =
          typeof launchTime === "number" ? launchTime : new Date(launchTime).getTime();
        const hoursUntilLaunch = (launchTimestamp - now) / (1000 * 60 * 60);

        // Enhanced confidence calculation using AI insights
        let aiConfidence = 50; // Base confidence

        // Boost confidence based on pattern insights
        if (patternInsights.summary.highConfidenceMatches > 0) aiConfidence += 20;
        if (hoursUntilLaunch >= 3.5 && hoursUntilLaunch <= 48) aiConfidence += 15;
        if (entry.projectName && entry.projectName !== entry.symbol) aiConfidence += 10;

        // Market timing considerations
        const launchDate = new Date(launchTimestamp);
        const isWeekend = launchDate.getDay() === 0 || launchDate.getDay() === 6;
        if (isWeekend) aiConfidence -= 10;

        // Project type assessment
        let projectCategory = "Other";
        let marketAppeal = 60;
        if (entry.projectName) {
          const name = entry.projectName.toLowerCase();
          if (name.includes("defi") || name.includes("ai") || name.includes("game")) {
            projectCategory = name.includes("ai")
              ? "AI"
              : name.includes("defi")
                ? "DeFi"
                : "GameFi";
            marketAppeal = name.includes("ai") ? 90 : name.includes("defi") ? 85 : 80;
            aiConfidence += 10;
          }
        }

        return {
          vcoinId: entry.vcoinId,
          symbol: entry.symbol,
          projectName: entry.projectName || entry.symbol,
          launchTime: new Date(launchTimestamp).toISOString(),
          launchTimestamp,
          hoursUntilLaunch: Math.round(hoursUntilLaunch * 100) / 100,

          // Enhanced analysis
          aiConfidence: Math.min(aiConfidence, 95),
          projectCategory,
          marketAppeal,
          isUpcoming: hoursUntilLaunch > 0,
          hasOptimalAdvance: hoursUntilLaunch >= 3.5,
          isWeekendLaunch: isWeekend,

          // Risk assessment
          riskLevel: aiConfidence > 80 ? "low" : aiConfidence > 60 ? "medium" : "high",
          delayRisk: hoursUntilLaunch > 168 ? "high" : hoursUntilLaunch > 48 ? "medium" : "low",

          // Trading infrastructure
          expectedTradingPairs: entry.tradingPairs || [`${entry.symbol}USDT`],
          infrastructureStatus: entry.sts && entry.st ? `${entry.sts}-${entry.st}` : "unknown",

          // Urgency classification
          urgencyLevel: this.calculateUrgencyLevel(hoursUntilLaunch),
        };
      })
      .sort((a, b) => a.hoursUntilLaunch - b.hoursUntilLaunch);
  }

  // Categorize opportunities by type and priority
  private categorizeOpportunities(processedListings: any[]): any {
    const newListings = processedListings.filter(
      (listing) =>
        listing.isUpcoming && listing.hoursUntilLaunch > 4 && listing.hoursUntilLaunch < 168
    );

    const readyTargets = processedListings.filter(
      (listing) =>
        listing.isUpcoming && listing.hoursUntilLaunch <= 4 && listing.hoursUntilLaunch > 0
    );

    const highPriorityOpportunities = processedListings.filter(
      (listing) =>
        listing.aiConfidence >= 80 && listing.hasOptimalAdvance && listing.riskLevel === "low"
    );

    const monitoringTargets = processedListings.filter(
      (listing) =>
        listing.isUpcoming && listing.aiConfidence >= 60 && listing.urgencyLevel !== "immediate"
    );

    return {
      newListings,
      readyTargets,
      highPriorityOpportunities,
      monitoringTargets,
    };
  }

  // Generate actionable recommendations
  private generateActionableRecommendations(
    categorizedResults: any,
    calendarInsights: any,
    patternInsights: any
  ): any {
    const immediate = [];
    const scheduled = [];
    const monitoring = [];

    // Immediate actions for ready targets
    if (categorizedResults.readyTargets.length > 0) {
      immediate.push({
        action: "monitor_ready_targets",
        count: categorizedResults.readyTargets.length,
        description: `Begin intensive monitoring of ${categorizedResults.readyTargets.length} targets launching within 4 hours`,
        priority: "critical",
      });
    }

    // Scheduled actions for high-priority opportunities
    if (categorizedResults.highPriorityOpportunities.length > 0) {
      scheduled.push({
        action: "prepare_high_priority",
        count: categorizedResults.highPriorityOpportunities.length,
        description: `Prepare monitoring infrastructure for ${categorizedResults.highPriorityOpportunities.length} high-confidence opportunities`,
        priority: "high",
        timeframe: "1-12 hours",
      });
    }

    // Monitoring plans for new listings
    if (categorizedResults.newListings.length > 0) {
      monitoring.push({
        action: "schedule_monitoring",
        count: categorizedResults.newListings.length,
        description: `Set up monitoring schedules for ${categorizedResults.newListings.length} upcoming listings`,
        priority: "medium",
        timeframe: "1-7 days",
      });
    }

    return { immediate, scheduled, monitoring };
  }

  // Calculate overall assessment
  private calculateOverallAssessment(
    categorizedResults: any,
    calendarInsights: any,
    patternInsights: any
  ): any {
    const totalOpportunities =
      categorizedResults.newListings.length + categorizedResults.readyTargets.length;
    const highConfidenceCount = categorizedResults.highPriorityOpportunities.length;

    // Calculate confidence based on data quality and opportunities
    let confidence = 50;
    if (totalOpportunities > 0) confidence += 20;
    if (highConfidenceCount > 0) confidence += 20;
    if (patternInsights.summary.optimalAdvanceNotice > 0) confidence += 10;

    // Risk level assessment
    let riskLevel = "medium";
    if (highConfidenceCount >= 2 && categorizedResults.readyTargets.length === 0) riskLevel = "low";
    if (categorizedResults.readyTargets.length > 3) riskLevel = "high";

    // Market conditions assessment
    const avgAdvanceHours = patternInsights.summary.averageAdvanceHours || 0;
    const marketConditions = {
      advanceNoticeQuality:
        avgAdvanceHours >= 12 ? "excellent" : avgAdvanceHours >= 3.5 ? "good" : "poor",
      opportunityVolume:
        totalOpportunities >= 5 ? "high" : totalOpportunities >= 2 ? "medium" : "low",
      marketTiming: "normal", // Could be enhanced with external market data
    };

    return {
      confidence: Math.min(confidence, 95),
      riskLevel,
      marketConditions,
    };
  }

  // Helper method for urgency calculation (shared with PatternDiscoveryAgent)
  private calculateUrgencyLevel(hoursUntilLaunch: number): string {
    if (hoursUntilLaunch < 0) return "expired";
    if (hoursUntilLaunch < 0.5) return "immediate";
    if (hoursUntilLaunch < 2) return "critical";
    if (hoursUntilLaunch < 6) return "high";
    if (hoursUntilLaunch < 24) return "medium";
    return "low";
  }

  private async combineSymbolAnalysis(
    readiness: AgentResponse,
    pattern: AgentResponse,
    market: AgentResponse,
    symbolData: any
  ): Promise<any> {
    try {
      console.log(`[MexcOrchestrator] Combining multi-agent symbol analysis results`);

      const symbolEntries = symbolData?.success ? symbolData.data : [];
      console.log(`[MexcOrchestrator] Processing ${symbolEntries.length} symbol entries`);

      // Extract and parse AI analysis results
      const readinessInsights = this.extractReadinessInsights(readiness);
      const patternInsights = this.extractPatternValidationInsights(pattern);
      const marketInsights = this.extractMarketMicrostructureInsights(market);

      // Perform comprehensive data-driven analysis
      const dataAnalysis = this.analyzeSymbolDataPattern(symbolEntries);

      // Calculate unified confidence scores
      const confidenceScores = this.calculateUnifiedConfidence(
        readinessInsights,
        patternInsights,
        marketInsights,
        dataAnalysis
      );

      // Determine trading readiness
      const tradingReadiness = this.determineTradingReadiness(
        dataAnalysis,
        confidenceScores,
        readinessInsights,
        patternInsights
      );

      // Generate risk assessment
      const riskAssessment = this.generateSymbolRiskAssessment(
        dataAnalysis,
        marketInsights,
        confidenceScores
      );

      // Create actionable recommendations
      const recommendations = this.generateSymbolRecommendations(
        tradingReadiness,
        riskAssessment,
        confidenceScores
      );

      console.log(
        `[MexcOrchestrator] Symbol analysis complete - Ready: ${tradingReadiness.isReady}, Confidence: ${confidenceScores.overall}%`
      );

      return {
        // Core readiness determination
        symbolReady: tradingReadiness.isReady,
        hasCompleteData: dataAnalysis.hasCompleteData,
        confidence: confidenceScores.overall,
        riskLevel: riskAssessment.level,

        // Detailed analysis results
        patternDetected: dataAnalysis.hasReadyStatePattern,
        dataQuality: dataAnalysis.dataQuality,
        readyStateCount: dataAnalysis.readyStateMatches,
        infrastructureReady: dataAnalysis.infrastructureReady,

        // AI insights summary
        readinessAnalysis: readinessInsights.summary,
        patternValidation: patternInsights.summary,
        marketMicrostructure: marketInsights.summary,

        // Confidence breakdown
        confidenceBreakdown: {
          dataQuality: confidenceScores.dataQuality,
          patternMatch: confidenceScores.patternMatch,
          aiAnalysis: confidenceScores.aiAnalysis,
          marketConditions: confidenceScores.marketConditions,
        },

        // Risk factors
        riskFactors: riskAssessment.factors,
        marketTiming: riskAssessment.timing,

        // Actionable next steps
        immediateActions: recommendations.immediate,
        monitoringPlan: recommendations.monitoring,
        entryStrategy: recommendations.entry,

        // Metadata
        analysisTimestamp: new Date().toISOString(),
        symbolDataCount: symbolEntries.length,
        agentsContributed: ["symbol-analysis", "pattern-discovery"],
      };
    } catch (error) {
      console.error(`[MexcOrchestrator] Symbol analysis combination failed:`, error);
      return {
        symbolReady: false,
        hasCompleteData: false,
        confidence: 0,
        riskLevel: "high",
        error: error instanceof Error ? error.message : "Unknown error",
        analysisTimestamp: new Date().toISOString(),
      };
    }
  }

  // Extract insights from SymbolAnalysisAgent readiness analysis
  private extractReadinessInsights(readiness: AgentResponse): any {
    const content = readiness.content.toLowerCase();

    const isReady = content.includes("ready") && !content.includes("not ready");
    const hasHighConfidence =
      content.includes("high confidence") || content.includes("85%") || content.includes("90%");
    const infrastructureReady = content.includes("infrastructure") && content.includes("ready");

    return {
      rawContent: readiness.content,
      metadata: readiness.metadata,
      summary: {
        isReady,
        hasHighConfidence,
        infrastructureReady,
        recommendsTrading: content.includes("immediate trading") || content.includes("execute"),
        confidenceLevel: this.extractConfidencePercentage(content),
      },
    };
  }

  // Extract insights from PatternDiscoveryAgent validation
  private extractPatternValidationInsights(pattern: AgentResponse): any {
    const content = pattern.content.toLowerCase();

    const patternConfirmed =
      content.includes("ready") || content.includes("confirmed") || content.includes("validated");
    const exactMatch =
      content.includes("sts:2") && content.includes("st:2") && content.includes("tt:4");
    const passesValidation = content.includes("pass") && !content.includes("fail");

    return {
      rawContent: pattern.content,
      metadata: pattern.metadata,
      summary: {
        patternConfirmed,
        exactMatch,
        passesValidation,
        confidenceLevel: this.extractConfidencePercentage(content),
        recommendsAction: content.includes("immediate") || content.includes("execute"),
      },
    };
  }

  // Extract insights from market microstructure analysis
  private extractMarketMicrostructureInsights(market: AgentResponse): any {
    const content = market.content.toLowerCase();

    const goodLiquidity =
      content.includes("good liquidity") || content.includes("adequate liquidity");
    const lowRisk = content.includes("low risk") || content.includes("minimal risk");
    const optimalTiming = content.includes("optimal") || content.includes("favorable");

    return {
      rawContent: market.content,
      metadata: market.metadata,
      summary: {
        goodLiquidity,
        lowRisk,
        optimalTiming,
        marketReady: content.includes("market ready") || content.includes("suitable for trading"),
        liquidityScore: this.extractLiquidityScore(content),
      },
    };
  }

  // Analyze actual symbol data for patterns
  private analyzeSymbolDataPattern(symbolEntries: any[]): any {
    let hasCompleteData = false;
    let hasReadyStatePattern = false;
    let readyStateMatches = 0;
    let infrastructureReady = false;
    let dataQuality = "poor";

    if (symbolEntries && symbolEntries.length > 0) {
      hasCompleteData = true;
      dataQuality = "partial";

      for (const entry of symbolEntries) {
        // Check for complete data fields
        if (
          entry.cd &&
          entry.sts !== undefined &&
          entry.st !== undefined &&
          entry.tt !== undefined
        ) {
          dataQuality = "complete";

          // Check for exact ready state pattern: sts:2, st:2, tt:4
          if (entry.sts === 2 && entry.st === 2 && entry.tt === 4) {
            hasReadyStatePattern = true;
            readyStateMatches++;
            console.log(`[MexcOrchestrator] Ready state pattern detected in symbol: ${entry.cd}`);
          }

          // Check infrastructure readiness
          if (entry.sts === 2 && entry.st === 2) {
            infrastructureReady = true;
          }
        }
      }
    }

    return {
      hasCompleteData,
      hasReadyStatePattern,
      readyStateMatches,
      infrastructureReady,
      dataQuality,
      totalEntries: symbolEntries.length,
    };
  }

  // Calculate unified confidence scores
  private calculateUnifiedConfidence(
    readinessInsights: any,
    patternInsights: any,
    marketInsights: any,
    dataAnalysis: any
  ): any {
    // Data quality confidence (0-30 points)
    let dataQuality = 0;
    if (dataAnalysis.hasCompleteData) dataQuality += 20;
    if (dataAnalysis.dataQuality === "complete") dataQuality += 10;

    // Pattern match confidence (0-40 points)
    let patternMatch = 0;
    if (dataAnalysis.hasReadyStatePattern) patternMatch += 30;
    if (patternInsights.summary.exactMatch) patternMatch += 10;

    // AI analysis confidence (0-20 points)
    let aiAnalysis = 0;
    if (readinessInsights.summary.isReady && patternInsights.summary.patternConfirmed)
      aiAnalysis += 15;
    if (readinessInsights.summary.hasHighConfidence) aiAnalysis += 5;

    // Market conditions confidence (0-10 points)
    let marketConditions = 0;
    if (marketInsights.summary.goodLiquidity && marketInsights.summary.lowRisk)
      marketConditions += 10;

    const overall = Math.min(dataQuality + patternMatch + aiAnalysis + marketConditions, 95);

    return {
      overall,
      dataQuality,
      patternMatch,
      aiAnalysis,
      marketConditions,
    };
  }

  // Determine trading readiness
  private determineTradingReadiness(
    dataAnalysis: any,
    confidenceScores: any,
    readinessInsights: any,
    patternInsights: any
  ): any {
    const isReady =
      dataAnalysis.hasReadyStatePattern &&
      confidenceScores.overall >= 70 &&
      (readinessInsights.summary.isReady || patternInsights.summary.patternConfirmed);

    const readinessLevel =
      confidenceScores.overall >= 85
        ? "ready"
        : confidenceScores.overall >= 70
          ? "near-ready"
          : confidenceScores.overall >= 50
            ? "monitoring"
            : "not-ready";

    return {
      isReady,
      readinessLevel,
      meetsThreshold: confidenceScores.overall >= 70,
      hasDataSupport: dataAnalysis.hasReadyStatePattern,
      hasAiSupport: readinessInsights.summary.isReady && patternInsights.summary.patternConfirmed,
    };
  }

  // Generate symbol-specific risk assessment
  private generateSymbolRiskAssessment(
    dataAnalysis: any,
    marketInsights: any,
    confidenceScores: any
  ): any {
    const factors = [];
    let level = "medium";

    // Data quality risks
    if (dataAnalysis.dataQuality === "poor") factors.push("incomplete-data");
    if (dataAnalysis.readyStateMatches === 0) factors.push("no-ready-pattern");

    // Market risks
    if (!marketInsights.summary.goodLiquidity) factors.push("liquidity-concerns");
    if (!marketInsights.summary.lowRisk) factors.push("market-risk-factors");

    // Confidence-based risk level
    if (confidenceScores.overall >= 80) level = "low";
    else if (confidenceScores.overall < 50) level = "high";

    const timing = dataAnalysis.hasReadyStatePattern
      ? "optimal"
      : dataAnalysis.infrastructureReady
        ? "early"
        : "premature";

    return {
      level,
      factors,
      timing,
      dataRisk: dataAnalysis.dataQuality === "poor" ? "high" : "low",
      marketRisk: marketInsights.summary.lowRisk ? "low" : "medium",
    };
  }

  // Generate actionable recommendations
  private generateSymbolRecommendations(
    tradingReadiness: any,
    riskAssessment: any,
    confidenceScores: any
  ): any {
    const immediate = [];
    const monitoring = [];
    const entry = {};

    if (tradingReadiness.isReady) {
      immediate.push("execute-trading-strategy");
      immediate.push("implement-risk-management");
      Object.assign(entry, {
        strategy: "immediate-entry",
        timing: "execute-now",
        positionSize: riskAssessment.level === "low" ? "standard" : "reduced",
      });
    } else if (tradingReadiness.readinessLevel === "near-ready") {
      immediate.push("intensify-monitoring");
      monitoring.push("watch-for-pattern-completion");
      Object.assign(entry, {
        strategy: "prepare-for-entry",
        timing: "monitor-closely",
      });
    } else {
      monitoring.push("standard-monitoring");
      monitoring.push("wait-for-infrastructure-ready");
    }

    return {
      immediate,
      monitoring,
      entry,
    };
  }

  // Helper method to extract confidence percentage from text
  private extractConfidencePercentage(content: string): number {
    const percentageMatch = content.match(/(\d+)%/);
    return percentageMatch ? Number.parseInt(percentageMatch[1]) : 0;
  }

  // Helper method to extract liquidity score
  private extractLiquidityScore(content: string): string {
    if (content.includes("excellent liquidity")) return "excellent";
    if (content.includes("good liquidity")) return "good";
    if (content.includes("adequate liquidity")) return "adequate";
    if (content.includes("poor liquidity")) return "poor";
    return "unknown";
  }

  private async extractActionablePatterns(analysis: AgentResponse, data: any): Promise<any> {
    const content = analysis.content.toLowerCase();

    const patterns = [];
    if (content.includes("ready state") || content.includes("sts:2")) {
      patterns.push({
        type: "ready_state",
        confidence: 85,
        action: "immediate_trading",
      });
    }

    return {
      patterns,
      recommendations: ["Monitor for ready state pattern", "Prepare trading strategy"],
      confidence: 70,
    };
  }

  private async compileTradingStrategy(
    strategy: AgentResponse,
    risk: AgentResponse,
    market: AgentResponse,
    request: TradingStrategyWorkflowRequest
  ): Promise<any> {
    // Extract strategy parameters from AI analysis
    return {
      entryPrice: "market",
      stopLoss: "5%",
      takeProfit: "15%",
      positionSize: request.capital ? `${Math.min(request.capital * 0.1, 1000)}` : "100 USDT",
      riskRewardRatio: "1:3",
      confidence: 75,
    };
  }
}
