/**
 * Pattern Strategy Orchestrator - Workflow Coordination Engine
 *
 * Coordinates the complete pattern discovery workflow preserving the 3.5+ hour
 * advance detection timeline and managing agent interactions.
 *
 * Workflow: Calendar → Pattern → Symbol → Strategy
 * - Calendar Agent discovers new listings
 * - Pattern Detection Engine analyzes patterns
 * - Symbol Analysis Agent validates readiness
 * - Strategy Agent creates trading plans
 */

import { db } from "../db";
import { monitoredListings } from "../db/schemas/patterns";
import type { AgentResponse } from "../mexc-agents/base-agent";
import { CalendarAgent } from "../mexc-agents/calendar-agent";
import { PatternDiscoveryAgent } from "../mexc-agents/pattern-discovery-agent";
import { StrategyAgent } from "../mexc-agents/strategy-agent";
import { SymbolAnalysisAgent } from "../mexc-agents/symbol-analysis-agent";
import type { CalendarEntry, SymbolEntry } from "./mexc-unified-exports";
import {
  type PatternAnalysisResult,
  type PatternMatch,
  patternDetectionEngine,
} from "./pattern-detection-engine";

// ============================================================================
// Orchestrator Types
// ============================================================================

export interface PatternWorkflowRequest {
  type: "discovery" | "monitoring" | "validation" | "strategy_creation";
  input: {
    calendarEntries?: CalendarEntry[];
    symbolData?: SymbolEntry[];
    vcoinId?: string;
    symbols?: string[];
  };
  options?: {
    confidenceThreshold?: number;
    includeAdvanceDetection?: boolean;
    enableAgentAnalysis?: boolean;
    maxExecutionTime?: number;
  };
}

export interface PatternWorkflowResult {
  success: boolean;
  type: PatternWorkflowRequest["type"];
  results: {
    patternAnalysis?: PatternAnalysisResult;
    agentResponses?: Record<string, AgentResponse>;
    strategicRecommendations?: StrategicRecommendation[];
    monitoringPlan?: MonitoringPlan;
  };
  performance: {
    executionTime: number;
    agentsUsed: string[];
    cacheHitRate?: number;
    patternsProcessed: number;
  };
  error?: string;
}

export interface StrategicRecommendation {
  vcoinId: string;
  symbol: string;
  action: "immediate_trade" | "prepare_position" | "monitor_closely" | "wait" | "avoid";
  confidence: number;
  reasoning: string;
  timing: {
    optimalEntry?: Date;
    monitoringStart?: Date;
    deadline?: Date;
  };
  riskManagement: {
    positionSize?: number;
    stopLoss?: number;
    takeProfit?: number;
    maxRisk?: number;
  };
}

export interface MonitoringPlan {
  targets: MonitoringTarget[];
  schedules: MonitoringSchedule[];
  alerts: AlertConfiguration[];
  resources: ResourceAllocation;
}

export interface MonitoringTarget {
  vcoinId: string;
  symbol: string;
  priority: "critical" | "high" | "medium" | "low";
  expectedReadyTime?: Date;
  currentStatus: string;
  requiredActions: string[];
}

export interface MonitoringSchedule {
  vcoinId: string;
  intervals: {
    current: number; // minutes
    approaching: number; // minutes (when close to ready)
    critical: number; // minutes (when very close)
  };
  escalationTriggers: string[];
}

export interface AlertConfiguration {
  type: "ready_state" | "pattern_change" | "time_threshold" | "confidence_change";
  condition: string;
  urgency: "immediate" | "high" | "medium" | "low";
  recipients: string[];
}

export interface ResourceAllocation {
  apiCallsPerHour: number;
  concurrentMonitoring: number;
  agentUtilization: Record<string, number>;
  estimatedCosts: Record<string, number>;
}

// ============================================================================
// Pattern Strategy Orchestrator
// ============================================================================

export class PatternStrategyOrchestrator {
  private static instance: PatternStrategyOrchestrator;

  // Agent instances for coordinated analysis
  private calendarAgent: CalendarAgent;
  private patternAgent: PatternDiscoveryAgent;
  private symbolAgent: SymbolAnalysisAgent;
  private strategyAgent: StrategyAgent;

  // Performance tracking
  private executionMetrics: Map<string, number> = new Map();
  private cacheMetrics: { hits: number; misses: number } = { hits: 0, misses: 0 };

  constructor() {
    this.calendarAgent = new CalendarAgent();
    this.patternAgent = new PatternDiscoveryAgent();
    this.symbolAgent = new SymbolAnalysisAgent();
    this.strategyAgent = new StrategyAgent();
  }

  static getInstance(): PatternStrategyOrchestrator {
    if (!PatternStrategyOrchestrator.instance) {
      PatternStrategyOrchestrator.instance = new PatternStrategyOrchestrator();
    }
    return PatternStrategyOrchestrator.instance;
  }

  /**
   * Main Orchestration Method - Complete Pattern Discovery Workflow
   * Preserves the 3.5+ hour advance detection timeline
   */
  async executePatternWorkflow(request: PatternWorkflowRequest): Promise<PatternWorkflowResult> {
    const startTime = Date.now();
    const agentsUsed: string[] = [];

    try {
      console.log(`[PatternOrchestrator] Starting ${request.type} workflow`);

      switch (request.type) {
        case "discovery":
          return await this.executeDiscoveryWorkflow(request, startTime, agentsUsed);

        case "monitoring":
          return await this.executeMonitoringWorkflow(request, startTime, agentsUsed);

        case "validation":
          return await this.executeValidationWorkflow(request, startTime, agentsUsed);

        case "strategy_creation":
          return await this.executeStrategyCreationWorkflow(request, startTime, agentsUsed);

        default:
          throw new Error(`Unknown workflow type: ${request.type}`);
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`[PatternOrchestrator] Workflow failed:`, error);

      return {
        success: false,
        type: request.type,
        results: {},
        performance: {
          executionTime,
          agentsUsed,
          patternsProcessed: 0,
        },
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Discovery Workflow - New Listing Discovery and Pattern Analysis
   * Calendar Agent → Pattern Detection → Early Opportunity Identification
   */
  private async executeDiscoveryWorkflow(
    request: PatternWorkflowRequest,
    startTime: number,
    agentsUsed: string[]
  ): Promise<PatternWorkflowResult> {
    const results: PatternWorkflowResult["results"] = { agentResponses: {} };
    let calendarEntries = request.input.calendarEntries;

    // Step 1: Calendar Discovery (if no calendar data provided)
    if (!calendarEntries || calendarEntries.length === 0) {
      console.log("[PatternOrchestrator] Fetching calendar data via Calendar Agent");
      agentsUsed.push("calendar-agent");

      const calendarData = await this.calendarAgent.fetchLatestCalendarData();
      calendarEntries = calendarData;

      if (request.options?.enableAgentAnalysis) {
        const calendarAnalysis = await this.calendarAgent.scanForNewListings(calendarData);
        results.agentResponses!["calendar-analysis"] = calendarAnalysis;
      }
    }

    // Step 2: Core Pattern Detection Engine Analysis
    console.log("[PatternOrchestrator] Running pattern detection engine");
    const patternAnalysis = await patternDetectionEngine.analyzePatterns({
      calendarEntries,
      analysisType: "discovery",
      confidenceThreshold: request.options?.confidenceThreshold || 70,
      includeHistorical: true,
    });

    results.patternAnalysis = patternAnalysis;

    // Step 3: AI Agent Enhanced Analysis (if enabled)
    if (request.options?.enableAgentAnalysis && calendarEntries.length > 0) {
      console.log("[PatternOrchestrator] Running AI agent pattern analysis");
      agentsUsed.push("pattern-discovery-agent");

      const agentAnalysis = await this.patternAgent.discoverNewListings(calendarEntries);
      results.agentResponses!["pattern-analysis"] = agentAnalysis;
    }

    // Step 4: Generate Strategic Recommendations
    const strategicRecommendations = await this.generateStrategicRecommendations(
      patternAnalysis.matches,
      "discovery"
    );
    results.strategicRecommendations = strategicRecommendations;

    // Step 5: Create Monitoring Plan for Discovered Opportunities
    const monitoringPlan = await this.createMonitoringPlan(
      patternAnalysis.matches.filter(
        (m) => m.patternType === "launch_sequence" && m.advanceNoticeHours >= 3.5
      )
    );
    results.monitoringPlan = monitoringPlan;

    // Step 6: Store Discovered Patterns in Database
    await this.storeDiscoveredPatterns(patternAnalysis.matches);

    const executionTime = Date.now() - startTime;
    console.log(`[PatternOrchestrator] Discovery workflow completed in ${executionTime}ms`);

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
   * Monitoring Workflow - Active Symbol Monitoring and Ready State Detection
   * Symbol Analysis → Pattern Validation → Ready State Detection
   */
  private async executeMonitoringWorkflow(
    request: PatternWorkflowRequest,
    startTime: number,
    agentsUsed: string[]
  ): Promise<PatternWorkflowResult> {
    const results: PatternWorkflowResult["results"] = { agentResponses: {} };
    const symbolData = request.input.symbolData || [];

    // Step 1: Symbol Status Analysis
    if (symbolData.length > 0) {
      console.log("[PatternOrchestrator] Analyzing symbol readiness");

      const patternAnalysis = await patternDetectionEngine.analyzePatterns({
        symbols: symbolData,
        analysisType: "monitoring",
        confidenceThreshold: request.options?.confidenceThreshold || 80,
      });

      results.patternAnalysis = patternAnalysis;

      // Enhanced AI analysis for high-priority symbols
      if (request.options?.enableAgentAnalysis) {
        const readyCandidates = patternAnalysis.matches.filter(
          (m) =>
            m.patternType === "ready_state" || (m.patternType === "pre_ready" && m.confidence >= 75)
        );

        for (const candidate of readyCandidates.slice(0, 3)) {
          // Limit to top 3
          agentsUsed.push("symbol-analysis-agent");

          const symbolAnalysis = await this.symbolAgent.analyzeSymbolReadiness(
            candidate.vcoinId || candidate.symbol,
            symbolData as any
          );

          results.agentResponses![`symbol-${candidate.symbol}`] = symbolAnalysis;
        }
      }

      // Generate monitoring recommendations
      const strategicRecommendations = await this.generateStrategicRecommendations(
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
   * Validation Workflow - Pattern Validation and Confidence Scoring
   * Detailed analysis of specific patterns for accuracy verification
   */
  private async executeValidationWorkflow(
    request: PatternWorkflowRequest,
    startTime: number,
    agentsUsed: string[]
  ): Promise<PatternWorkflowResult> {
    const results: PatternWorkflowResult["results"] = { agentResponses: {} };

    // Comprehensive pattern validation
    if (request.input.symbolData) {
      agentsUsed.push("pattern-discovery-agent", "symbol-analysis-agent");

      // Run pattern validation
      const patternAnalysis = await patternDetectionEngine.analyzePatterns({
        symbols: request.input.symbolData,
        analysisType: "validation",
        confidenceThreshold: 85, // Higher threshold for validation
      });

      results.patternAnalysis = patternAnalysis;

      // AI agent validation for ready state patterns
      const readyPatterns = patternAnalysis.matches.filter((m) => m.patternType === "ready_state");

      for (const pattern of readyPatterns) {
        const validationResponse = await this.patternAgent.validateReadyState({
          vcoinId: pattern.vcoinId || pattern.symbol,
          symbolData: request.input.symbolData?.filter((s) => s.cd === pattern.symbol),
          count: 1,
        });

        results.agentResponses![`validation-${pattern.symbol}`] = validationResponse;
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
   * Strategy Creation Workflow - Trading Strategy Development
   * Pattern Analysis → Risk Assessment → Strategy Creation
   */
  private async executeStrategyCreationWorkflow(
    request: PatternWorkflowRequest,
    startTime: number,
    agentsUsed: string[]
  ): Promise<PatternWorkflowResult> {
    const results: PatternWorkflowResult["results"] = { agentResponses: {} };

    if (request.input.vcoinId && request.input.symbolData) {
      agentsUsed.push("strategy-agent", "pattern-discovery-agent");

      // First validate the pattern
      const patternAnalysis = await patternDetectionEngine.analyzePatterns({
        symbols: request.input.symbolData,
        analysisType: "validation",
        confidenceThreshold: 80,
      });

      results.patternAnalysis = patternAnalysis;

      // Create trading strategy for validated patterns
      const readyPatterns = patternAnalysis.matches.filter(
        (m) => m.patternType === "ready_state" && m.confidence >= 85
      );

      if (readyPatterns.length > 0) {
        const strategyResponse = await this.strategyAgent.createTradingStrategy(
          `Strategy for ${request.input.vcoinId}: Ready state pattern detected with ${readyPatterns.length} matches`,
          "medium",
          "short"
        );

        results.agentResponses!["strategy-creation"] = strategyResponse;
      }

      // Generate final strategic recommendations
      const strategicRecommendations = await this.generateStrategicRecommendations(
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

  // ============================================================================
  // Strategic Recommendation Generation
  // ============================================================================

  private async generateStrategicRecommendations(
    patterns: PatternMatch[],
    workflowType: string
  ): Promise<StrategicRecommendation[]> {
    const recommendations: StrategicRecommendation[] = [];

    for (const pattern of patterns) {
      const recommendation: StrategicRecommendation = {
        vcoinId: pattern.vcoinId || pattern.symbol,
        symbol: pattern.symbol,
        action: this.determineAction(pattern, workflowType),
        confidence: pattern.confidence,
        reasoning: this.generateReasoning(pattern),
        timing: this.calculateOptimalTiming(pattern),
        riskManagement: this.calculateRiskManagement(pattern),
      };

      recommendations.push(recommendation);
    }

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  private determineAction(
    pattern: PatternMatch,
    _workflowType: string
  ): StrategicRecommendation["action"] {
    // Ready state patterns with high confidence
    if (pattern.patternType === "ready_state" && pattern.confidence >= 85) {
      return "immediate_trade";
    }

    // Pre-ready patterns close to ready state
    if (pattern.patternType === "pre_ready" && pattern.confidence >= 80) {
      return "prepare_position";
    }

    // Launch sequences with good advance notice
    if (
      pattern.patternType === "launch_sequence" &&
      pattern.advanceNoticeHours >= 3.5 &&
      pattern.confidence >= 75
    ) {
      return "monitor_closely";
    }

    // Low confidence or risky patterns
    if (pattern.confidence < 60 || pattern.riskLevel === "high") {
      return "avoid";
    }

    return "wait";
  }

  private generateReasoning(pattern: PatternMatch): string {
    const reasons: string[] = [];

    if (pattern.patternType === "ready_state") {
      reasons.push(
        `Ready state pattern detected (sts:${pattern.indicators.sts}, st:${pattern.indicators.st}, tt:${pattern.indicators.tt})`
      );
    }

    if (pattern.advanceNoticeHours >= 3.5) {
      reasons.push(`Excellent advance notice: ${pattern.advanceNoticeHours.toFixed(1)} hours`);
    }

    reasons.push(`${pattern.confidence.toFixed(1)}% confidence based on pattern analysis`);
    reasons.push(`${pattern.riskLevel} risk level assessed`);

    if (pattern.historicalSuccess) {
      reasons.push(`Historical success rate: ${pattern.historicalSuccess.toFixed(1)}%`);
    }

    return reasons.join(". ");
  }

  private calculateOptimalTiming(pattern: PatternMatch): StrategicRecommendation["timing"] {
    const now = new Date();
    const timing: StrategicRecommendation["timing"] = {};

    if (pattern.patternType === "ready_state") {
      timing.optimalEntry = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
    } else if (pattern.patternType === "pre_ready") {
      const estimatedHours = pattern.advanceNoticeHours || 2;
      timing.optimalEntry = new Date(now.getTime() + estimatedHours * 60 * 60 * 1000);
      timing.monitoringStart = new Date(now.getTime() + 30 * 60 * 1000); // Start monitoring in 30 min
    } else if (pattern.patternType === "launch_sequence") {
      const launchHours = pattern.advanceNoticeHours;
      timing.optimalEntry = new Date(now.getTime() + launchHours * 60 * 60 * 1000);
      timing.monitoringStart = new Date(
        now.getTime() + Math.max((launchHours - 1) * 60 * 60 * 1000, 0)
      );
    }

    return timing;
  }

  private calculateRiskManagement(
    pattern: PatternMatch
  ): StrategicRecommendation["riskManagement"] {
    const baseRisk =
      pattern.riskLevel === "low" ? 0.02 : pattern.riskLevel === "medium" ? 0.03 : 0.05;
    const confidenceMultiplier = pattern.confidence / 100;

    return {
      positionSize: Math.min(confidenceMultiplier * 0.1, 0.05), // Max 5% position
      maxRisk: baseRisk,
      stopLoss: 0.95, // 5% stop loss
      takeProfit: pattern.patternType === "ready_state" ? 1.15 : 1.1, // 10-15% take profit
    };
  }

  // ============================================================================
  // Monitoring Plan Creation
  // ============================================================================

  private async createMonitoringPlan(patterns: PatternMatch[]): Promise<MonitoringPlan> {
    const targets: MonitoringTarget[] = [];
    const schedules: MonitoringSchedule[] = [];
    const alerts: AlertConfiguration[] = [];

    for (const pattern of patterns) {
      // Create monitoring target
      targets.push({
        vcoinId: pattern.vcoinId || pattern.symbol,
        symbol: pattern.symbol,
        priority: this.determinePriority(pattern),
        expectedReadyTime:
          pattern.patternType === "launch_sequence"
            ? new Date(Date.now() + pattern.advanceNoticeHours * 60 * 60 * 1000)
            : undefined,
        currentStatus: `${pattern.patternType} (${pattern.confidence.toFixed(1)}% confidence)`,
        requiredActions: this.generateRequiredActions(pattern),
      });

      // Create monitoring schedule
      schedules.push({
        vcoinId: pattern.vcoinId || pattern.symbol,
        intervals: this.calculateMonitoringIntervals(pattern),
        escalationTriggers: this.generateEscalationTriggers(pattern),
      });

      // Create alert configuration
      alerts.push({
        type: "ready_state",
        condition: `sts:2 AND st:2 AND tt:4 for ${pattern.symbol}`,
        urgency: pattern.confidence >= 85 ? "immediate" : "high",
        recipients: ["trading-system", "alerts-channel"],
      });
    }

    const resources: ResourceAllocation = {
      apiCallsPerHour: targets.length * 30, // 30 calls per hour per target
      concurrentMonitoring: Math.min(targets.length, 10),
      agentUtilization: {
        "pattern-detection": 0.6,
        "symbol-analysis": 0.4,
        "calendar-monitoring": 0.2,
      },
      estimatedCosts: {
        "api-calls": targets.length * 0.001, // $0.001 per target per hour
        "agent-processing": targets.length * 0.01, // $0.01 per target per hour
      },
    };

    return { targets, schedules, alerts, resources };
  }

  private determinePriority(pattern: PatternMatch): MonitoringTarget["priority"] {
    if (pattern.patternType === "ready_state" && pattern.confidence >= 85) {
      return "critical";
    }
    if (pattern.confidence >= 80 || pattern.advanceNoticeHours <= 1) {
      return "high";
    }
    if (pattern.confidence >= 70) {
      return "medium";
    }
    return "low";
  }

  private generateRequiredActions(pattern: PatternMatch): string[] {
    const actions: string[] = [];

    if (pattern.patternType === "ready_state") {
      actions.push("Prepare immediate trading execution");
      actions.push("Validate order book liquidity");
      actions.push("Execute sniper strategy");
    } else if (pattern.patternType === "pre_ready") {
      actions.push("Monitor status transitions closely");
      actions.push("Prepare trading infrastructure");
      actions.push("Set up ready state alerts");
    } else if (pattern.patternType === "launch_sequence") {
      actions.push("Monitor calendar updates");
      actions.push("Track symbol activation timeline");
      actions.push("Prepare monitoring escalation");
    }

    return actions;
  }

  private calculateMonitoringIntervals(pattern: PatternMatch): MonitoringSchedule["intervals"] {
    if (pattern.patternType === "ready_state") {
      return { current: 1, approaching: 0.5, critical: 0.25 }; // Minutes
    }
    if (pattern.patternType === "pre_ready") {
      return { current: 5, approaching: 2, critical: 1 };
    }
    if (pattern.patternType === "launch_sequence") {
      const hours = pattern.advanceNoticeHours;
      if (hours <= 1) return { current: 5, approaching: 2, critical: 1 };
      if (hours <= 6) return { current: 15, approaching: 5, critical: 2 };
      return { current: 30, approaching: 15, critical: 5 };
    }
    return { current: 30, approaching: 15, critical: 5 };
  }

  private generateEscalationTriggers(_pattern: PatternMatch): string[] {
    return [
      "Status change detected",
      "Confidence drops below 60%",
      "Risk level increases",
      "Expected timing approaches",
      "Market conditions change significantly",
    ];
  }

  // ============================================================================
  // Pattern Storage and Database Operations
  // ============================================================================

  private async storeDiscoveredPatterns(patterns: PatternMatch[]): Promise<void> {
    try {
      for (const pattern of patterns) {
        if (
          (pattern.patternType === "launch_sequence" || pattern.patternType === "ready_state") &&
          pattern.advanceNoticeHours >= 3.5
        ) {
          // Store in monitored listings for tracking
          await db
            .insert(monitoredListings)
            .values({
              vcoinId: pattern.vcoinId || pattern.symbol,
              symbolName: pattern.symbol,
              firstOpenTime: Date.now() + pattern.advanceNoticeHours * 60 * 60 * 1000,
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

      console.log(`[PatternOrchestrator] Stored ${patterns.length} patterns in database`);
    } catch (error) {
      console.warn("[PatternOrchestrator] Failed to store patterns:", error);
    }
  }

  // ============================================================================
  // Performance and Caching
  // ============================================================================

  getPerformanceMetrics(): Record<string, any> {
    return {
      executionMetrics: Object.fromEntries(this.executionMetrics),
      cacheMetrics: this.cacheMetrics,
      cacheHitRate:
        this.cacheMetrics.hits / (this.cacheMetrics.hits + this.cacheMetrics.misses) || 0,
    };
  }

  clearCache(): void {
    this.executionMetrics.clear();
    this.cacheMetrics = { hits: 0, misses: 0 };
  }
}

// Export singleton instance
export const patternStrategyOrchestrator = PatternStrategyOrchestrator.getInstance();
