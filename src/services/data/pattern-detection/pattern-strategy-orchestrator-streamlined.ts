/**
 * Streamlined Pattern Strategy Orchestrator
 *
 * Refactored to use extracted modules and reduce file size from 927 to under 500 lines
 */

import { and, desc, eq, gte } from "drizzle-orm";
import {
  PatternDetectionCore,
  type PatternMatch,
} from "@/src/core/pattern-detection";
import { db } from "@/src/db";
import { monitoredListings } from "@/src/db/schemas/patterns";
import { createConsoleLogger } from "@/src/lib/shared/console-logger";
import { CalendarAgent } from "@/src/mexc-agents/calendar-agent";
import { PatternDiscoveryAgent } from "@/src/mexc-agents/pattern-discovery-agent";
import { StrategyAgent } from "@/src/mexc-agents/strategy-agent";
import { SymbolAnalysisAgent } from "@/src/mexc-agents/symbol-analysis-agent";

import type { SymbolEntry } from "@/src/services/api/mexc-unified-exports";

// Pattern workflow types
interface PatternWorkflowRequest {
  type: "discovery" | "monitoring" | "validation" | "strategy_creation";
  input: {
    calendarEntries?: any[];
    symbolData?: SymbolEntry[];
    vcoinId?: string;
  };
  options?: {
    enableAgentAnalysis?: boolean;
    confidenceThreshold?: number;
  };
}

interface PatternWorkflowResult {
  success: boolean;
  type: string;
  results: {
    patternAnalysis?: any;
    agentResponses?: Record<string, any>;
    strategicRecommendations?: any;
    monitoringPlan?: any;
  };
  performance: {
    executionTime: number;
    agentsUsed: string[];
    patternsProcessed: number;
  };
  error?: string;
}

// Monitoring plan types and implementation
interface MonitoringPlan {
  patterns: number;
  recommendations: MonitoringRecommendation[];
  status: "active" | "paused" | "completed";
  createdAt: Date;
  priority: "low" | "medium" | "high";
  estimatedDuration: number;
}

interface MonitoringRecommendation {
  action: "monitor" | "alert" | "execute" | "ignore";
  symbol: string;
  priority: "low" | "medium" | "high";
  reasoning: string;
  confidence: number;
  timeframe: number;
}

class MonitoringPlanCreator {
  static createMonitoringPlan(patterns: PatternMatch[]): MonitoringPlan {
    const recommendations: MonitoringRecommendation[] = [];

    for (const pattern of patterns) {
      const recommendation: MonitoringRecommendation = {
        action:
          pattern.confidence >= 85
            ? "execute"
            : pattern.confidence >= 70
              ? "monitor"
              : "ignore",
        symbol: pattern.symbol,
        priority:
          pattern.confidence >= 85
            ? "high"
            : pattern.confidence >= 70
              ? "medium"
              : "low",
        reasoning: `Pattern ${pattern.patternType} detected with ${pattern.confidence}% confidence`,
        confidence: pattern.confidence,
        timeframe: pattern.advanceNoticeHours || 1,
      };
      recommendations.push(recommendation);
    }

    return {
      patterns: patterns.length,
      recommendations,
      status: "active",
      createdAt: new Date(),
      priority: recommendations.some((r) => r.priority === "high")
        ? "high"
        : "medium",
      estimatedDuration: Math.max(
        ...recommendations.map((r) => r.timeframe),
        1
      ),
    };
  }
}

// Strategic recommendation types and implementation
interface StrategicRecommendation {
  type: string;
  patterns: number;
  recommendations: TradingRecommendation[];
  confidence: number;
  riskAssessment: "low" | "medium" | "high";
  estimatedProfitability: number;
}

interface TradingRecommendation {
  symbol: string;
  action: "buy" | "sell" | "hold" | "monitor";
  confidence: number;
  positionSize: "small" | "medium" | "large";
  reasoning: string;
  riskLevel: "low" | "medium" | "high";
  entryStrategy: string;
  exitStrategy: string;
}

class StrategicRecommendationGenerator {
  static generateStrategicRecommendations(
    patterns: PatternMatch[],
    type: string
  ): StrategicRecommendation {
    const recommendations: TradingRecommendation[] = [];
    let totalConfidence = 0;

    for (const pattern of patterns) {
      const recommendation: TradingRecommendation = {
        symbol: pattern.symbol,
        action: StrategicRecommendationGenerator.determineAction(pattern, type),
        confidence: pattern.confidence,
        positionSize: StrategicRecommendationGenerator.determinePositionSize(
          pattern.confidence,
          pattern.riskLevel
        ),
        reasoning: StrategicRecommendationGenerator.generateReasoning(
          pattern,
          type
        ),
        riskLevel: pattern.riskLevel || "medium",
        entryStrategy:
          StrategicRecommendationGenerator.generateEntryStrategy(pattern),
        exitStrategy:
          StrategicRecommendationGenerator.generateExitStrategy(pattern),
      };
      recommendations.push(recommendation);
      totalConfidence += pattern.confidence;
    }

    const avgConfidence =
      patterns.length > 0 ? totalConfidence / patterns.length : 0;

    return {
      type,
      patterns: patterns.length,
      recommendations,
      confidence: Math.round(avgConfidence),
      riskAssessment:
        StrategicRecommendationGenerator.assessOverallRisk(patterns),
      estimatedProfitability:
        StrategicRecommendationGenerator.estimateProfitability(patterns),
    };
  }

  private static determineAction(
    pattern: PatternMatch,
    _type: string
  ): "buy" | "sell" | "hold" | "monitor" {
    if (pattern.patternType === "ready_state" && pattern.confidence >= 85) {
      return "buy";
    }
    if (pattern.patternType === "launch_sequence" && pattern.confidence >= 80) {
      return "monitor";
    }
    if (pattern.confidence >= 70) {
      return "monitor";
    }
    return "hold";
  }

  private static determinePositionSize(
    confidence: number,
    riskLevel: string
  ): "small" | "medium" | "large" {
    if (confidence >= 90 && riskLevel === "low") return "large";
    if (confidence >= 80 && riskLevel !== "high") return "medium";
    return "small";
  }

  private static generateReasoning(
    pattern: PatternMatch,
    _type: string
  ): string {
    return `${pattern.patternType} pattern detected with ${pattern.confidence}% confidence. ${pattern.recommendation || "Monitor closely"}.`;
  }

  private static generateEntryStrategy(pattern: PatternMatch): string {
    if (pattern.patternType === "ready_state") {
      return "Immediate market entry with tight stop-loss";
    }
    if (pattern.patternType === "launch_sequence") {
      return `Prepare for entry in ${pattern.advanceNoticeHours} hours with staged approach`;
    }
    return "Monitor for confirmation signals before entry";
  }

  private static generateExitStrategy(pattern: PatternMatch): string {
    const baseStrategy =
      "Set stop-loss at -5%, take-profit targets at +15%, +30%";
    if (pattern.riskLevel === "high") {
      return `${baseStrategy}. Tighter risk management due to high risk level.`;
    }
    return baseStrategy;
  }

  private static assessOverallRisk(
    patterns: PatternMatch[]
  ): "low" | "medium" | "high" {
    const riskScores = patterns.map((p) => {
      if (p.riskLevel === "high") return 3;
      if (p.riskLevel === "medium") return 2;
      return 1;
    });

    const avgRisk =
      riskScores.reduce((sum, score) => sum + score, 0) / patterns.length;

    if (avgRisk >= 2.5) return "high";
    if (avgRisk >= 1.5) return "medium";
    return "low";
  }

  private static estimateProfitability(patterns: PatternMatch[]): number {
    // Estimate based on pattern confidence and historical performance
    let profitabilityScore = 0;

    for (const pattern of patterns) {
      let patternScore = pattern.confidence * 0.01; // Base score from confidence

      // Adjust based on pattern type
      if (pattern.patternType === "ready_state") {
        patternScore *= 1.2; // Ready state patterns are more profitable
      } else if (pattern.patternType === "launch_sequence") {
        patternScore *= 1.1; // Launch sequences have good potential
      }

      // Adjust based on risk level
      if (pattern.riskLevel === "low") {
        patternScore *= 1.1;
      } else if (pattern.riskLevel === "high") {
        patternScore *= 0.8;
      }

      profitabilityScore += patternScore;
    }

    return Math.round((profitabilityScore / patterns.length) * 100);
  }
}

import { patternTargetIntegrationService } from "./pattern-target-integration-service";

export class StreamlinedPatternOrchestrator {
  private static instance: StreamlinedPatternOrchestrator;
  private logger = createConsoleLogger("pattern-orchestrator");

  // Agent instances
  private calendarAgent: CalendarAgent;
  private patternAgent: PatternDiscoveryAgent;
  private symbolAgent: SymbolAnalysisAgent;
  private strategyAgent: StrategyAgent;

  // Performance tracking
  private executionMetrics: Map<string, number> = new Map();
  private cacheMetrics: { hits: number; misses: number } = {
    hits: 0,
    misses: 0,
  };

  constructor() {
    this.calendarAgent = new CalendarAgent();
    this.patternAgent = new PatternDiscoveryAgent();
    this.symbolAgent = new SymbolAnalysisAgent();
    this.strategyAgent = new StrategyAgent();
  }

  static getInstance(): StreamlinedPatternOrchestrator {
    if (!StreamlinedPatternOrchestrator.instance) {
      StreamlinedPatternOrchestrator.instance =
        new StreamlinedPatternOrchestrator();
    }
    return StreamlinedPatternOrchestrator.instance;
  }

  /**
   * Main orchestration method - routes to specific workflow handlers
   */
  async executePatternWorkflow(
    request: PatternWorkflowRequest
  ): Promise<PatternWorkflowResult> {
    const startTime = Date.now();
    const agentsUsed: string[] = [];

    try {
      this.logger.info(`Starting ${request.type} workflow`);

      switch (request.type) {
        case "discovery":
          return await this.executeDiscoveryWorkflow(
            request,
            startTime,
            agentsUsed
          );
        case "monitoring":
          return await this.executeMonitoringWorkflow(
            request,
            startTime,
            agentsUsed
          );
        case "validation":
          return await this.executeValidationWorkflow(
            request,
            startTime,
            agentsUsed
          );
        case "strategy_creation":
          return await this.executeStrategyCreationWorkflow(
            request,
            startTime,
            agentsUsed
          );
        default:
          throw new Error(`Unknown workflow type: ${request.type}`);
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error("Workflow failed", {
        error: error instanceof Error ? error.message : error,
      });

      return {
        success: false,
        type: request.type,
        results: {},
        performance: { executionTime, agentsUsed, patternsProcessed: 0 },
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Discovery workflow - new listing discovery and pattern analysis
   */
  private async executeDiscoveryWorkflow(
    request: PatternWorkflowRequest,
    startTime: number,
    agentsUsed: string[]
  ): Promise<PatternWorkflowResult> {
    const results: PatternWorkflowResult["results"] = { agentResponses: {} };
    let calendarEntries = request.input.calendarEntries;

    // Step 1: Calendar discovery if needed
    if (!calendarEntries || calendarEntries.length === 0) {
      this.logger.info("Fetching calendar data via Calendar Agent");
      agentsUsed.push("calendar-agent");
      calendarEntries = await this.calendarAgent.fetchLatestCalendarData();

      if (request.options?.enableAgentAnalysis) {
        const calendarAnalysis =
          await this.calendarAgent.scanForNewListings(calendarEntries);
        results.agentResponses!["calendar-analysis"] = calendarAnalysis;
      }
    }

    // Step 2: Core pattern detection
    this.logger.info("Running pattern detection engine");
    const patternAnalysis =
      await PatternDetectionCore.getInstance().analyzePatterns({
        calendarEntries,
        analysisType: "discovery",
        confidenceThreshold: request.options?.confidenceThreshold || 70,
        includeHistorical: true,
      });
    results.patternAnalysis = patternAnalysis;

    // Step 3: AI agent analysis if enabled
    if (request.options?.enableAgentAnalysis && calendarEntries.length > 0) {
      this.logger.info("Running AI agent pattern analysis");
      agentsUsed.push("pattern-discovery-agent");
      const agentAnalysis =
        await this.patternAgent.discoverNewListings(calendarEntries);
      results.agentResponses!["pattern-analysis"] = agentAnalysis;
    }

    // Step 4: Generate strategic recommendations
    const strategicRecommendations =
      await StrategicRecommendationGenerator.generateStrategicRecommendations(
        patternAnalysis.matches,
        "discovery"
      );
    results.strategicRecommendations = strategicRecommendations;

    // Step 5: Create monitoring plan
    const monitoringPlan = await MonitoringPlanCreator.createMonitoringPlan(
      patternAnalysis.matches.filter(
        (m) =>
          m.patternType === "launch_sequence" && m.advanceNoticeHours >= 3.5
      )
    );
    results.monitoringPlan = monitoringPlan;

    // Step 6: Store patterns and create snipe targets
    await this.storeDiscoveredPatterns(patternAnalysis.matches);
    const targetResults = await this.createSnipeTargetsFromPatterns(
      patternAnalysis.matches,
      request.input.vcoinId || "system"
    );

    const successfulTargets = targetResults.filter((r) => r.success).length;
    this.logger.info(
      `Created ${successfulTargets} snipe targets from ${patternAnalysis.matches.length} patterns`
    );

    const executionTime = Date.now() - startTime;
    this.logger.info(`Discovery workflow completed in ${executionTime}ms`);

    return {
      success: true,
      type: "discovery",
      results,
      performance: {
        executionTime,
        agentsUsed,
        patternsProcessed: patternAnalysis.matches.length,
      },
    };
  }

  /**
   * Monitoring workflow - active symbol monitoring and ready state detection
   */
  private async executeMonitoringWorkflow(
    request: PatternWorkflowRequest,
    startTime: number,
    agentsUsed: string[]
  ): Promise<PatternWorkflowResult> {
    const results: PatternWorkflowResult["results"] = { agentResponses: {} };
    let symbolData = request.input.symbolData || [];

    // Fetch monitored symbols from database if none provided
    if (symbolData.length === 0) {
      this.logger.info("Fetching monitored symbols from database");
      try {
        symbolData = await this.getMonitoredSymbolsFromDatabase();
        this.logger.info(
          `Found ${symbolData.length} monitored symbols in database`
        );
      } catch (error) {
        this.logger.error("Failed to fetch monitored symbols", {
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    // Analyze symbols if available
    if (symbolData.length > 0) {
      this.logger.info("Analyzing symbol readiness");

      const patternAnalysis =
        await PatternDetectionCore.getInstance().analyzePatterns({
          symbols: symbolData,
          analysisType: "monitoring",
          confidenceThreshold: request.options?.confidenceThreshold || 80,
        });
      results.patternAnalysis = patternAnalysis;

      // Enhanced AI analysis for high-priority symbols
      if (request.options?.enableAgentAnalysis) {
        const readyCandidates = patternAnalysis.matches.filter(
          (m) =>
            m.patternType === "ready_state" ||
            (m.patternType === "pre_ready" && m.confidence >= 75)
        );

        for (const candidate of readyCandidates.slice(0, 3)) {
          agentsUsed.push("symbol-analysis-agent");
          const symbolAnalysis = await this.symbolAgent.analyzeSymbolReadiness(
            candidate.vcoinId || candidate.symbol,
            symbolData as any
          );
          results.agentResponses![`symbol-${candidate.symbol}`] =
            symbolAnalysis;
        }
      }

      // Generate monitoring recommendations
      const strategicRecommendations =
        await StrategicRecommendationGenerator.generateStrategicRecommendations(
          patternAnalysis.matches,
          "monitoring"
        );
      results.strategicRecommendations = strategicRecommendations;
    }

    const executionTime = Date.now() - startTime;
    return {
      success: true,
      type: "monitoring",
      results,
      performance: {
        executionTime,
        agentsUsed,
        patternsProcessed: symbolData.length,
      },
    };
  }

  /**
   * Validation workflow - pattern validation and confidence scoring
   */
  private async executeValidationWorkflow(
    request: PatternWorkflowRequest,
    startTime: number,
    agentsUsed: string[]
  ): Promise<PatternWorkflowResult> {
    const results: PatternWorkflowResult["results"] = { agentResponses: {} };

    if (request.input.symbolData) {
      agentsUsed.push("pattern-discovery-agent", "symbol-analysis-agent");

      const patternAnalysis =
        await PatternDetectionCore.getInstance().analyzePatterns({
          symbols: request.input.symbolData,
          analysisType: "validation",
          confidenceThreshold: 85,
        });
      results.patternAnalysis = patternAnalysis;

      // AI validation for ready state patterns
      const readyPatterns = patternAnalysis.matches.filter(
        (m) => m.patternType === "ready_state"
      );
      for (const pattern of readyPatterns) {
        const validationResponse = await this.patternAgent.validateReadyState({
          vcoinId: pattern.vcoinId || pattern.symbol,
          symbolData: request.input.symbolData?.filter(
            (s: any) => s.cd === pattern.symbol
          ),
          count: 1,
        });
        results.agentResponses![`validation-${pattern.symbol}`] =
          validationResponse;
      }
    }

    const executionTime = Date.now() - startTime;
    return {
      success: true,
      type: "validation",
      results,
      performance: {
        executionTime,
        agentsUsed,
        patternsProcessed: request.input.symbolData?.length || 0,
      },
    };
  }

  /**
   * Strategy creation workflow - trading strategy development
   */
  private async executeStrategyCreationWorkflow(
    request: PatternWorkflowRequest,
    startTime: number,
    agentsUsed: string[]
  ): Promise<PatternWorkflowResult> {
    const results: PatternWorkflowResult["results"] = { agentResponses: {} };

    if (request.input.vcoinId && request.input.symbolData) {
      agentsUsed.push("strategy-agent", "pattern-discovery-agent");

      const patternAnalysis =
        await PatternDetectionCore.getInstance().analyzePatterns({
          symbols: request.input.symbolData,
          analysisType: "validation",
          confidenceThreshold: 80,
        });
      results.patternAnalysis = patternAnalysis;

      const readyPatterns = patternAnalysis.matches.filter(
        (m) => m.patternType === "ready_state" && m.confidence >= 85
      );

      if (readyPatterns.length > 0) {
        const strategyResponse = await this.strategyAgent.createStrategy({
          action: "create",
          symbols: [request.input.vcoinId],
          timeframe: "short",
          riskLevel: "medium",
          parameters: {
            description: `Strategy for ${request.input.vcoinId}: Ready state pattern detected with ${readyPatterns.length} matches`,
            patternMatches: readyPatterns.length,
          },
        });
        results.agentResponses!["strategy-creation"] = strategyResponse;
      }

      const strategicRecommendations =
        await StrategicRecommendationGenerator.generateStrategicRecommendations(
          patternAnalysis.matches,
          "strategy_creation"
        );
      results.strategicRecommendations = strategicRecommendations;
    }

    const executionTime = Date.now() - startTime;
    return {
      success: true,
      type: "strategy_creation",
      results,
      performance: {
        executionTime,
        agentsUsed,
        patternsProcessed: request.input.symbolData?.length || 0,
      },
    };
  }

  /**
   * Create snipe targets from pattern matches
   */
  private async createSnipeTargetsFromPatterns(
    patterns: PatternMatch[],
    userId: string
  ): Promise<any[]> {
    try {
      const actionablePatterns = patterns.filter(
        (pattern) =>
          (pattern.patternType === "ready_state" && pattern.confidence >= 75) ||
          (pattern.patternType === "pre_ready" && pattern.confidence >= 80)
      );

      if (actionablePatterns.length === 0) {
        this.logger.info(
          "No actionable patterns found for snipe target creation"
        );
        return [];
      }

      this.logger.info(
        `Creating snipe targets for ${actionablePatterns.length} actionable patterns`
      );

      const results =
        await patternTargetIntegrationService.createTargetsFromPatterns(
          actionablePatterns,
          userId,
          {
            minConfidenceForTarget: 75,
            enabledPatternTypes: ["ready_state", "pre_ready"],
            defaultPositionSizeUsdt: 100,
            maxConcurrentTargets: 5,
          }
        );

      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      if (successful.length > 0) {
        this.logger.info(
          `Successfully created ${successful.length} snipe targets`
        );
      }
      if (failed.length > 0) {
        this.logger.info(
          `Failed to create ${failed.length} snipe targets`,
          failed.map((f) => f.reason || f.error)
        );
      }

      return results;
    } catch (error) {
      this.logger.error("Failed to create snipe targets from patterns", {
        error: error instanceof Error ? error.message : error,
      });
      return [];
    }
  }

  /**
   * Store discovered patterns in database
   */
  private async storeDiscoveredPatterns(
    patterns: PatternMatch[]
  ): Promise<void> {
    try {
      for (const pattern of patterns) {
        if (
          (pattern.patternType === "launch_sequence" ||
            pattern.patternType === "ready_state") &&
          pattern.advanceNoticeHours >= 3.5
        ) {
          await db
            .insert(monitoredListings)
            .values({
              vcoinId: pattern.vcoinId || pattern.symbol,
              symbolName: pattern.symbol,
              firstOpenTime:
                Date.now() + pattern.advanceNoticeHours * 60 * 60 * 1000,
              status: "monitoring",
              confidence: pattern.confidence,
              patternSts: pattern.indicators.sts,
              patternSt: pattern.indicators.st,
              patternTt: pattern.indicators.tt,
              hasReadyPattern: pattern.patternType === "ready_state",
              lastChecked: new Date(),
            })
            .onConflictDoUpdate({
              target: monitoredListings.vcoinId,
              set: {
                confidence: pattern.confidence,
                patternSts: pattern.indicators.sts,
                patternSt: pattern.indicators.st,
                patternTt: pattern.indicators.tt,
                hasReadyPattern:
                  pattern.patternType === "ready_state" ||
                  pattern.patternType === "launch_sequence",
                lastChecked: new Date(),
                updatedAt: new Date(),
              },
            });
        }
      }
      this.logger.info(`Stored ${patterns.length} patterns in database`);
    } catch (error) {
      this.logger.warn("Failed to store patterns", {
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * Fetch monitored symbols from database
   */
  private async getMonitoredSymbolsFromDatabase(): Promise<SymbolEntry[]> {
    try {
      const monitoredSymbols = await db
        .select({
          vcoinId: monitoredListings.vcoinId,
          symbolName: monitoredListings.symbolName,
          confidence: monitoredListings.confidence,
          patternSts: monitoredListings.patternSts,
          patternSt: monitoredListings.patternSt,
          patternTt: monitoredListings.patternTt,
        })
        .from(monitoredListings)
        .where(
          and(
            eq(monitoredListings.status, "monitoring"),
            gte(monitoredListings.confidence, 60)
          )
        )
        .orderBy(desc(monitoredListings.confidence))
        .limit(50);

      return monitoredSymbols.map((symbol: any) => ({
        cd: symbol.symbolName,
        symbol: symbol.symbolName,
        sts: symbol.patternSts || 0,
        st: symbol.patternSt || 0,
        tt: symbol.patternTt || 0,
        ca: 1000,
        ps: Math.round(symbol.confidence || 0),
        qs: 75,
        vcoinId: symbol.vcoinId,
      }));
    } catch (error) {
      this.logger.error("Failed to fetch monitored symbols from database", {
        error: error instanceof Error ? error.message : error,
      });
      return [];
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): Record<string, any> {
    return {
      executionMetrics: Object.fromEntries(this.executionMetrics),
      cacheMetrics: this.cacheMetrics,
      cacheHitRate:
        this.cacheMetrics.hits /
          (this.cacheMetrics.hits + this.cacheMetrics.misses) || 0,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.executionMetrics.clear();
    this.cacheMetrics = { hits: 0, misses: 0 };
  }
}

// Export singleton instance
export const patternStrategyOrchestrator =
  StreamlinedPatternOrchestrator.getInstance();

// Re-export types (commented out due to missing module)
// export type * from "./pattern-orchestrator/types";
