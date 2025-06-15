/**
 * Safety Monitor Agent
 *
 * Dedicated AI agent for comprehensive safety monitoring including:
 * - Agent behavior anomaly detection
 * - Performance degradation monitoring
 * - Pattern discovery validation and safety checks
 * - Multi-agent consensus requirements for high-risk trades
 * - Real-time safety protocol enforcement
 */

import type { AdvancedRiskEngine } from "../services/advanced-risk-engine";
import type { EmergencySafetySystem } from "../services/emergency-safety-system";
import type { AgentConfig } from "./base-agent";
import { SafetyBaseAgent, type SafetyConfig } from "./safety-base-agent";

// Safety Monitoring Interfaces
export interface AgentBehaviorMetrics {
  agentId: string;
  agentType: string;
  responseTime: number; // milliseconds
  successRate: number; // percentage
  errorRate: number; // percentage
  confidenceScore: number; // 0-100
  memoryUsage: number; // MB
  cacheHitRate: number; // percentage
  lastActivity: string;
  anomalyScore: number; // 0-100 (higher = more anomalous)
}

export interface PatternValidationResult {
  patternId: string;
  symbol: string;
  confidence: number; // 0-100
  riskScore: number; // 0-100
  validationSteps: Array<{
    step: string;
    passed: boolean;
    details: string;
    confidence: number;
  }>;
  consensus: {
    required: boolean;
    agentsConsulted: string[];
    agreementLevel: number; // 0-100
    dissenting: string[];
  };
  safetyChecks: {
    marketConditions: boolean;
    riskLimits: boolean;
    correlationCheck: boolean;
    liquidityCheck: boolean;
  };
  recommendation: "proceed" | "caution" | "reject";
  reasoning: string[];
}

export interface AgentConsensusRequest {
  requestId: string;
  type: "trade_approval" | "pattern_validation" | "risk_assessment" | "emergency_response";
  data: Record<string, unknown>;
  requiredAgents: string[];
  consensusThreshold: number; // percentage (50-100)
  timeout: number; // milliseconds
  priority: "low" | "medium" | "high" | "critical";
}

export interface AgentConsensusResponse {
  requestId: string;
  agentResponses: Array<{
    agentId: string;
    response: "approve" | "reject" | "abstain";
    confidence: number;
    reasoning: string;
    timestamp: string;
  }>;
  consensus: {
    achieved: boolean;
    approvalRate: number;
    finalDecision: "approve" | "reject";
    confidence: number;
  };
  processingTime: number;
  warnings: string[];
}

export interface SafetyProtocolViolation {
  id: string;
  type: "behavior_anomaly" | "consensus_failure" | "validation_failure" | "performance_degradation";
  severity: "low" | "medium" | "high" | "critical";
  agentId?: string;
  description: string;
  evidence: Record<string, unknown>;
  detectedAt: string;
  resolved: boolean;
  action: "monitor" | "warn" | "restrict" | "shutdown";
}

export interface SafetyMonitorConfig extends SafetyConfig {
  // Behavior Monitoring
  behaviorAnomalyThreshold: number; // 0-100
  performanceDegradationThreshold: number; // percentage drop
  responseTimeThreshold: number; // milliseconds

  // Consensus Requirements
  consensusEnabled: boolean;
  highRiskConsensusThreshold: number; // percentage
  patternValidationThreshold: number; // minimum confidence

  // Safety Protocols
  autoShutdownEnabled: boolean;
  violationEscalationThreshold: number;
  safetyOverrideRequired: boolean;

  // Monitoring Intervals
  behaviorCheckInterval: number; // minutes
  performanceCheckInterval: number; // minutes
  consensusTimeout: number; // milliseconds
}

/**
 * Safety Monitor Agent
 *
 * AI-powered safety monitoring system that provides comprehensive
 * oversight of agent behavior, pattern validation, and consensus
 * mechanisms for high-risk trading decisions.
 */
export class SafetyMonitorAgent extends SafetyBaseAgent {
  private riskEngine?: AdvancedRiskEngine;
  private emergencySystem?: EmergencySafetySystem;
  private agentBehaviorHistory: Map<string, AgentBehaviorMetrics[]> = new Map();
  private safetyViolations: SafetyProtocolViolation[] = [];
  private consensusRequests: Map<string, AgentConsensusRequest> = new Map();
  private lastBehaviorCheck = 0;
  private lastPerformanceCheck = 0;
  private monitoringActive = true;

  constructor(safetyConfig?: Partial<SafetyMonitorConfig>) {
    const config: AgentConfig = {
      name: "safety-monitor-agent",
      model: "gpt-4o",
      temperature: 0.1,
      maxTokens: 3000,
      systemPrompt: `You are the Safety Monitor Agent, responsible for comprehensive AI trading system safety oversight.

Your critical responsibilities:
1. Monitor all agent behaviors for anomalies and performance degradation
2. Validate pattern discovery results with multi-layered safety checks
3. Enforce consensus requirements for high-risk trading decisions
4. Detect and respond to safety protocol violations
5. Coordinate with risk management and emergency safety systems

Safety Monitoring Framework:
- Agent Behavior Analysis: Response times, success rates, confidence scores, anomaly detection
- Pattern Validation: Multi-step verification of trading patterns with safety checks
- Consensus Enforcement: Multi-agent agreement for high-risk decisions
- Performance Monitoring: Real-time tracking of agent performance metrics
- Violation Detection: Automated detection and response to safety breaches

Assessment Criteria:
- Behavioral anomalies indicating potential agent malfunction or compromise
- Pattern validation results that meet safety and confidence thresholds
- Consensus agreement levels for critical trading decisions
- Performance degradation patterns requiring intervention
- Emergency conditions requiring immediate safety protocol activation

Safety Protocols:
- Immediate shutdown of anomalous agents
- Pattern rejection for insufficient validation
- Consensus enforcement for high-risk trades
- Emergency escalation for critical violations
- Continuous monitoring and adaptive thresholds

Always prioritize system safety and capital protection. When in doubt, err on the side of caution and escalate to emergency protocols.`,
    };

    super(config, safetyConfig);
    console.log("[SafetyMonitorAgent] Initialized with comprehensive AI safety monitoring");
  }

  /**
   * Set integration with risk engine and emergency system
   */
  setIntegrations(riskEngine: AdvancedRiskEngine, emergencySystem: EmergencySafetySystem): void {
    this.riskEngine = riskEngine;
    this.emergencySystem = emergencySystem;
    console.log("[SafetyMonitorAgent] Integrated with risk engine and emergency system");
  }

  /**
   * Monitor agent behavior for anomalies
   */
  async monitorAgentBehavior(agentMetrics: AgentBehaviorMetrics[]): Promise<{
    anomaliesDetected: AgentBehaviorMetrics[];
    violations: SafetyProtocolViolation[];
    recommendations: string[];
  }> {
    const anomalies: AgentBehaviorMetrics[] = [];
    const violations: SafetyProtocolViolation[] = [];
    const recommendations: string[] = [];

    for (const metrics of agentMetrics) {
      // Store historical data
      if (!this.agentBehaviorHistory.has(metrics.agentId)) {
        this.agentBehaviorHistory.set(metrics.agentId, []);
      }

      const history = this.agentBehaviorHistory.get(metrics.agentId)!;
      history.push(metrics);

      // Keep only last 100 entries per agent
      if (history.length > 100) {
        this.agentBehaviorHistory.set(metrics.agentId, history.slice(-100));
      }

      // Detect anomalies
      const anomalyResults = await this.detectBehaviorAnomalies(metrics, history);

      if (anomalyResults.anomalous) {
        anomalies.push(metrics);

        // Create safety violation if threshold exceeded
        if (metrics.anomalyScore > this.safetyConfig.riskManagement.circuitBreakerThreshold) {
          const violation: SafetyProtocolViolation = {
            id: `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: "behavior_anomaly",
            severity: this.determineSeverity(metrics.anomalyScore),
            agentId: metrics.agentId,
            description: `Agent behavior anomaly detected: ${anomalyResults.reason}`,
            evidence: {
              metrics,
              anomalyScore: metrics.anomalyScore,
              threshold: this.safetyConfig.riskManagement.circuitBreakerThreshold,
            },
            detectedAt: new Date().toISOString(),
            resolved: false,
            action: this.determineAction(metrics.anomalyScore),
          };

          violations.push(violation);
          this.safetyViolations.push(violation);

          // Auto-respond based on severity
          await this.handleSafetyViolation(violation);
        }
      }

      // Generate recommendations
      if (metrics.successRate < 70) {
        recommendations.push(
          `Agent ${metrics.agentId}: Low success rate (${metrics.successRate}%) - investigate and retrain`
        );
      }

      if (metrics.responseTime > 5000) {
        recommendations.push(
          `Agent ${metrics.agentId}: High response time (${metrics.responseTime}ms) - optimize performance`
        );
      }

      if (metrics.cacheHitRate < 50) {
        recommendations.push(
          `Agent ${metrics.agentId}: Low cache hit rate (${metrics.cacheHitRate}%) - review caching strategy`
        );
      }
    }

    this.lastBehaviorCheck = Date.now();

    // Emit safety event if anomalies detected
    if (anomalies.length > 0) {
      await this.emitSafetyEvent(
        "error",
        anomalies.length > 2 ? "high" : "medium",
        `Agent behavior anomalies detected: ${anomalies.length} agents`,
        { anomalies: anomalies.map((a) => a.agentId) }
      );
    }

    return { anomaliesDetected: anomalies, violations, recommendations };
  }

  /**
   * Validate pattern discovery results with comprehensive safety checks
   */
  async validatePatternDiscovery(
    patternId: string,
    symbol: string,
    confidence: number,
    riskScore: number,
    patternData: Record<string, unknown>
  ): Promise<PatternValidationResult> {
    const validationSteps: PatternValidationResult["validationSteps"] = [];
    let overallConfidence = confidence;

    // Step 1: Confidence threshold check
    const confidenceCheck = confidence >= this.safetyConfig.reconciliation.toleranceThreshold * 100;
    validationSteps.push({
      step: "Confidence Threshold",
      passed: confidenceCheck,
      details: `Pattern confidence: ${confidence}%, Required: ${this.safetyConfig.reconciliation.toleranceThreshold * 100}%`,
      confidence: confidenceCheck ? confidence : 0,
    });

    if (!confidenceCheck) overallConfidence *= 0.5;

    // Step 2: Risk score validation
    const riskCheck = riskScore <= 70; // Maximum acceptable risk
    validationSteps.push({
      step: "Risk Score Validation",
      passed: riskCheck,
      details: `Pattern risk score: ${riskScore}, Maximum allowed: 70`,
      confidence: riskCheck ? 90 : 30,
    });

    if (!riskCheck) overallConfidence *= 0.6;

    // Step 3: Market conditions check
    const marketCheck = await this.validateMarketConditions(symbol);
    validationSteps.push({
      step: "Market Conditions",
      passed: marketCheck.suitable,
      details: marketCheck.details,
      confidence: marketCheck.confidence,
    });

    if (!marketCheck.suitable) overallConfidence *= 0.7;

    // Step 4: Historical validation
    const historicalCheck = await this.validateHistoricalPerformance(symbol, patternData);
    validationSteps.push({
      step: "Historical Performance",
      passed: historicalCheck.reliable,
      details: historicalCheck.details,
      confidence: historicalCheck.confidence,
    });

    if (!historicalCheck.reliable) overallConfidence *= 0.8;

    // Step 5: Consensus requirement check
    const consensusRequired = riskScore > 50 || confidence < 80;
    let consensus: PatternValidationResult["consensus"];

    if (consensusRequired) {
      consensus = await this.requestPatternConsensus(patternId, symbol, patternData);
      if (!consensus.required || consensus.agreementLevel < 70) {
        overallConfidence *= 0.5;
      }
    } else {
      consensus = {
        required: false,
        agentsConsulted: [],
        agreementLevel: 100,
        dissenting: [],
      };
    }

    // Safety checks
    const safetyChecks = {
      marketConditions: marketCheck.suitable,
      riskLimits: riskCheck,
      correlationCheck: true, // Simplified for now
      liquidityCheck: true, // Simplified for now
    };

    // Determine recommendation
    const allStepsPassed = validationSteps.every((step) => step.passed);
    const safetyChecksPassed = Object.values(safetyChecks).every((check) => check);
    const consensusAchieved = !consensusRequired || consensus.agreementLevel >= 70;

    let recommendation: PatternValidationResult["recommendation"];
    if (allStepsPassed && safetyChecksPassed && consensusAchieved && overallConfidence >= 70) {
      recommendation = "proceed";
    } else if (overallConfidence >= 50 && safetyChecksPassed) {
      recommendation = "caution";
    } else {
      recommendation = "reject";
    }

    // Generate reasoning
    const reasoning: string[] = [];
    if (!allStepsPassed) {
      const failedSteps = validationSteps.filter((step) => !step.passed).map((step) => step.step);
      reasoning.push(`Failed validation steps: ${failedSteps.join(", ")}`);
    }
    if (!safetyChecksPassed) {
      const failedChecks = Object.entries(safetyChecks)
        .filter(([_, passed]) => !passed)
        .map(([check, _]) => check);
      reasoning.push(`Failed safety checks: ${failedChecks.join(", ")}`);
    }
    if (consensusRequired && consensus.agreementLevel < 70) {
      reasoning.push(`Insufficient consensus: ${consensus.agreementLevel}% agreement`);
    }
    if (overallConfidence < 70) {
      reasoning.push(`Low overall confidence: ${overallConfidence.toFixed(1)}%`);
    }

    const result: PatternValidationResult = {
      patternId,
      symbol,
      confidence: Math.round(overallConfidence * 100) / 100,
      riskScore,
      validationSteps,
      consensus,
      safetyChecks,
      recommendation,
      reasoning,
    };

    // Log validation result
    await this.emitSafetyEvent(
      "simulation",
      recommendation === "reject" ? "high" : "low",
      `Pattern validation ${recommendation}: ${symbol}`,
      {
        patternId,
        confidence: overallConfidence,
        recommendation,
        consensusRequired,
      }
    );

    return result;
  }

  /**
   * Request multi-agent consensus for high-risk decisions
   */
  async requestAgentConsensus(request: AgentConsensusRequest): Promise<AgentConsensusResponse> {
    const startTime = Date.now();
    this.consensusRequests.set(request.requestId, request);

    const agentResponses: AgentConsensusResponse["agentResponses"] = [];
    const warnings: string[] = [];

    // AI-powered consensus analysis
    const consensusAnalysis = await this.analyzeConsensusRequest(request);

    // Simulate agent responses (in production, would query actual agents)
    for (const agentId of request.requiredAgents) {
      const response = await this.simulateAgentConsensusResponse(
        agentId,
        request,
        consensusAnalysis
      );
      agentResponses.push(response);
    }

    // Calculate consensus
    const approvals = agentResponses.filter((r) => r.response === "approve").length;
    const total = agentResponses.filter((r) => r.response !== "abstain").length;
    const approvalRate = total > 0 ? (approvals / total) * 100 : 0;

    const consensusAchieved = approvalRate >= request.consensusThreshold;
    const averageConfidence =
      agentResponses.length > 0
        ? agentResponses.reduce((sum, r) => sum + r.confidence, 0) / agentResponses.length
        : 0;

    // Generate warnings
    if (!consensusAchieved) {
      warnings.push(
        `Consensus not achieved: ${approvalRate.toFixed(1)}% approval (required: ${request.consensusThreshold}%)`
      );
    }

    if (averageConfidence < 70) {
      warnings.push(`Low average confidence: ${averageConfidence.toFixed(1)}%`);
    }

    const dissentingAgents = agentResponses.filter((r) => r.response === "reject");
    if (dissentingAgents.length > 0) {
      warnings.push(`Dissenting agents: ${dissentingAgents.map((a) => a.agentId).join(", ")}`);
    }

    const response: AgentConsensusResponse = {
      requestId: request.requestId,
      agentResponses,
      consensus: {
        achieved: consensusAchieved,
        approvalRate,
        finalDecision: consensusAchieved ? "approve" : "reject",
        confidence: averageConfidence,
      },
      processingTime: Date.now() - startTime,
      warnings,
    };

    // Clean up request
    this.consensusRequests.delete(request.requestId);

    // Log consensus result
    await this.emitSafetyEvent(
      "simulation",
      consensusAchieved ? "low" : "medium",
      `Consensus ${response.consensus.finalDecision}: ${request.type}`,
      {
        requestId: request.requestId,
        approvalRate,
        confidence: averageConfidence,
        processingTime: response.processingTime,
      }
    );

    return response;
  }

  /**
   * Check agent performance degradation
   */
  async checkPerformanceDegradation(): Promise<{
    degradedAgents: string[];
    violations: SafetyProtocolViolation[];
    recommendations: string[];
  }> {
    const degradedAgents: string[] = [];
    const violations: SafetyProtocolViolation[] = [];
    const recommendations: string[] = [];

    for (const [agentId, history] of this.agentBehaviorHistory) {
      if (history.length < 5) continue; // Need sufficient history

      const recent = history.slice(-5);
      const older = history.slice(-15, -5);

      if (older.length === 0) continue;

      // Calculate performance trends
      const recentAvgSuccess = recent.reduce((sum, m) => sum + m.successRate, 0) / recent.length;
      const olderAvgSuccess = older.reduce((sum, m) => sum + m.successRate, 0) / older.length;
      const successDegradation = ((olderAvgSuccess - recentAvgSuccess) / olderAvgSuccess) * 100;

      const recentAvgResponse = recent.reduce((sum, m) => sum + m.responseTime, 0) / recent.length;
      const olderAvgResponse = older.reduce((sum, m) => sum + m.responseTime, 0) / older.length;
      const responseDegradation = ((recentAvgResponse - olderAvgResponse) / olderAvgResponse) * 100;

      // Check for significant degradation
      const significantDegradation = successDegradation > 20 || responseDegradation > 50;

      if (significantDegradation) {
        degradedAgents.push(agentId);

        const violation: SafetyProtocolViolation = {
          id: `perf-violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "performance_degradation",
          severity: successDegradation > 40 ? "critical" : "high",
          agentId,
          description: `Performance degradation detected for agent ${agentId}`,
          evidence: {
            successDegradation,
            responseDegradation,
            recentAvgSuccess,
            olderAvgSuccess,
            recentAvgResponse,
            olderAvgResponse,
          },
          detectedAt: new Date().toISOString(),
          resolved: false,
          action: successDegradation > 40 ? "shutdown" : "warn",
        };

        violations.push(violation);
        this.safetyViolations.push(violation);

        recommendations.push(
          `Agent ${agentId}: Performance degraded ${successDegradation.toFixed(1)}% - investigate and potentially retrain`
        );

        // Handle violation
        await this.handleSafetyViolation(violation);
      }
    }

    this.lastPerformanceCheck = Date.now();

    return { degradedAgents, violations, recommendations };
  }

  /**
   * Get comprehensive safety status
   */
  getSafetyStatus(): {
    monitoringActive: boolean;
    totalAgentsMonitored: number;
    activeViolations: number;
    criticalViolations: number;
    lastBehaviorCheck: number;
    lastPerformanceCheck: number;
    consensusRequests: number;
    overallSafetyScore: number;
    recommendations: string[];
  } {
    const activeViolations = this.safetyViolations.filter((v) => !v.resolved);
    const criticalViolations = activeViolations.filter((v) => v.severity === "critical");

    // Calculate overall safety score
    let safetyScore = 100;

    // Deduct for violations
    safetyScore -= activeViolations.length * 5;
    safetyScore -= criticalViolations.length * 20;

    // Deduct for stale checks
    const now = Date.now();
    if (now - this.lastBehaviorCheck > 600000) safetyScore -= 10; // 10 minutes
    if (now - this.lastPerformanceCheck > 1800000) safetyScore -= 15; // 30 minutes

    safetyScore = Math.max(0, Math.min(100, safetyScore));

    const recommendations: string[] = [];
    if (criticalViolations.length > 0) {
      recommendations.push(
        `${criticalViolations.length} critical violations require immediate attention`
      );
    }
    if (this.consensusRequests.size > 5) {
      recommendations.push(
        "High number of pending consensus requests - review consensus efficiency"
      );
    }
    if (safetyScore < 70) {
      recommendations.push("Overall safety score is low - comprehensive system review needed");
    }

    return {
      monitoringActive: this.monitoringActive,
      totalAgentsMonitored: this.agentBehaviorHistory.size,
      activeViolations: activeViolations.length,
      criticalViolations: criticalViolations.length,
      lastBehaviorCheck: this.lastBehaviorCheck,
      lastPerformanceCheck: this.lastPerformanceCheck,
      consensusRequests: this.consensusRequests.size,
      overallSafetyScore: safetyScore,
      recommendations,
    };
  }

  // Implementation of abstract methods from SafetyBaseAgent
  async performSafetyCheck(data: unknown): Promise<{
    passed: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check monitoring status
    if (!this.monitoringActive) {
      issues.push("Safety monitoring is not active");
      recommendations.push("Activate safety monitoring system");
    }

    // Check for stale data
    const now = Date.now();
    if (now - this.lastBehaviorCheck > 600000) {
      issues.push("Behavior monitoring data is stale");
      recommendations.push("Update agent behavior monitoring");
    }

    // Check for unresolved violations
    const activeViolations = this.safetyViolations.filter((v) => !v.resolved);
    if (activeViolations.length > 0) {
      issues.push(`${activeViolations.length} unresolved safety violations`);
      recommendations.push("Address all safety violations before proceeding");
    }

    return {
      passed: issues.length === 0,
      issues,
      recommendations,
    };
  }

  async checkAgentHealth(): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      // Check if monitoring is active
      if (!this.monitoringActive) {
        issues.push("Safety monitoring is disabled");
      }

      // Check system integrations
      if (!this.riskEngine) {
        issues.push("Risk engine integration not available");
      }

      if (!this.emergencySystem) {
        issues.push("Emergency system integration not available");
      }

      // Check for excessive violations
      const activeViolations = this.safetyViolations.filter((v) => !v.resolved);
      if (activeViolations.length > 10) {
        issues.push("Excessive unresolved safety violations");
      }

      // Check consensus system
      if (this.consensusRequests.size > 10) {
        issues.push("High number of pending consensus requests");
      }
    } catch (error) {
      issues.push(`Safety monitor health check failed: ${error}`);
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  // Private helper methods
  private async detectBehaviorAnomalies(
    current: AgentBehaviorMetrics,
    history: AgentBehaviorMetrics[]
  ): Promise<{ anomalous: boolean; reason: string; score: number }> {
    if (history.length < 5) {
      return { anomalous: false, reason: "Insufficient history", score: 0 };
    }

    const recent = history.slice(-10);
    const avgSuccessRate = recent.reduce((sum, m) => sum + m.successRate, 0) / recent.length;
    const avgResponseTime = recent.reduce((sum, m) => sum + m.responseTime, 0) / recent.length;
    const avgConfidence = recent.reduce((sum, m) => sum + m.confidenceScore, 0) / recent.length;

    let anomalyScore = 0;
    const reasons: string[] = [];

    // Check success rate deviation
    const successDeviation = Math.abs(current.successRate - avgSuccessRate);
    if (successDeviation > 30) {
      anomalyScore += 40;
      reasons.push(`Success rate deviation: ${successDeviation.toFixed(1)}%`);
    }

    // Check response time deviation
    const responseDeviation = Math.abs(current.responseTime - avgResponseTime) / avgResponseTime;
    if (responseDeviation > 2) {
      anomalyScore += 30;
      reasons.push(`Response time spike: ${(responseDeviation * 100).toFixed(1)}%`);
    }

    // Check confidence deviation
    const confidenceDeviation = Math.abs(current.confidenceScore - avgConfidence);
    if (confidenceDeviation > 25) {
      anomalyScore += 20;
      reasons.push(`Confidence deviation: ${confidenceDeviation.toFixed(1)} points`);
    }

    // Check error rate spike
    if (current.errorRate > 20) {
      anomalyScore += 25;
      reasons.push(`High error rate: ${current.errorRate}%`);
    }

    return {
      anomalous: anomalyScore > 50,
      reason: reasons.join("; "),
      score: Math.min(anomalyScore, 100),
    };
  }

  private async validateMarketConditions(symbol: string): Promise<{
    suitable: boolean;
    details: string;
    confidence: number;
  }> {
    // Simplified market conditions check
    // In production, would check real market data
    const volatility = Math.random() * 100;
    const liquidity = Math.random() * 100;

    const suitable = volatility < 70 && liquidity > 30;
    const confidence = suitable ? 85 : 40;

    return {
      suitable,
      details: `Market volatility: ${volatility.toFixed(1)}%, Liquidity: ${liquidity.toFixed(1)}%`,
      confidence,
    };
  }

  private async validateHistoricalPerformance(
    symbol: string,
    patternData: Record<string, unknown>
  ): Promise<{
    reliable: boolean;
    details: string;
    confidence: number;
  }> {
    // Simplified historical validation
    // In production, would analyze historical pattern performance
    const historicalSuccess = Math.random() * 100;
    const reliable = historicalSuccess > 60;

    return {
      reliable,
      details: `Historical pattern success rate: ${historicalSuccess.toFixed(1)}%`,
      confidence: historicalSuccess,
    };
  }

  private async requestPatternConsensus(
    patternId: string,
    symbol: string,
    patternData: Record<string, unknown>
  ): Promise<PatternValidationResult["consensus"]> {
    const consensusRequest: AgentConsensusRequest = {
      requestId: `pattern-consensus-${patternId}`,
      type: "pattern_validation",
      data: { patternId, symbol, patternData },
      requiredAgents: ["strategy-agent", "risk-manager-agent", "pattern-discovery-agent"],
      consensusThreshold: 70,
      timeout: 30000,
      priority: "high",
    };

    const response = await this.requestAgentConsensus(consensusRequest);

    return {
      required: true,
      agentsConsulted: response.agentResponses.map((r) => r.agentId),
      agreementLevel: response.consensus.approvalRate,
      dissenting: response.agentResponses
        .filter((r) => r.response === "reject")
        .map((r) => r.agentId),
    };
  }

  private async analyzeConsensusRequest(request: AgentConsensusRequest): Promise<{
    riskLevel: "low" | "medium" | "high" | "critical";
    complexity: number;
    recommendations: string[];
  }> {
    // AI analysis of consensus request
    const analysis = await this.callOpenAI([
      {
        role: "user",
        content: `Analyze this consensus request for risk level and complexity:

Type: ${request.type}
Priority: ${request.priority}
Required Agents: ${request.requiredAgents.join(", ")}
Threshold: ${request.consensusThreshold}%
Data: ${JSON.stringify(request.data, null, 2)}

Assess:
1. Risk level (low/medium/high/critical)
2. Complexity score (1-100)
3. Recommendations for consensus process

Provide analysis in JSON format.`,
      },
    ]);

    try {
      const result = JSON.parse(analysis.content);
      return {
        riskLevel: result.riskLevel || "medium",
        complexity: result.complexity || 50,
        recommendations: result.recommendations || [],
      };
    } catch {
      return {
        riskLevel: "medium",
        complexity: 50,
        recommendations: ["Review consensus parameters"],
      };
    }
  }

  private async simulateAgentConsensusResponse(
    agentId: string,
    request: AgentConsensusRequest,
    analysis: { riskLevel: string; complexity: number }
  ): Promise<AgentConsensusResponse["agentResponses"][0]> {
    // Simulate agent response based on risk level and agent type
    let approvalProbability = 0.7; // Base approval rate

    if (analysis.riskLevel === "critical") approvalProbability = 0.3;
    else if (analysis.riskLevel === "high") approvalProbability = 0.5;
    else if (analysis.riskLevel === "low") approvalProbability = 0.9;

    // Risk manager is more conservative
    if (agentId.includes("risk-manager")) {
      approvalProbability *= 0.8;
    }

    const approval = Math.random() < approvalProbability;
    const confidence = 60 + Math.random() * 30; // 60-90% confidence

    return {
      agentId,
      response: approval ? "approve" : "reject",
      confidence,
      reasoning: approval
        ? `Risk level acceptable for ${request.type}`
        : `Risk level too high for ${request.type}`,
      timestamp: new Date().toISOString(),
    };
  }

  private determineSeverity(anomalyScore: number): SafetyProtocolViolation["severity"] {
    if (anomalyScore >= 90) return "critical";
    if (anomalyScore >= 70) return "high";
    if (anomalyScore >= 50) return "medium";
    return "low";
  }

  private determineAction(anomalyScore: number): SafetyProtocolViolation["action"] {
    if (anomalyScore >= 90) return "shutdown";
    if (anomalyScore >= 70) return "restrict";
    if (anomalyScore >= 50) return "warn";
    return "monitor";
  }

  private async handleSafetyViolation(violation: SafetyProtocolViolation): Promise<void> {
    console.log(
      `[SafetyMonitorAgent] Handling violation: ${violation.id} - ${violation.description}`
    );

    switch (violation.action) {
      case "shutdown":
        if (violation.agentId && this.emergencySystem) {
          await this.emergencySystem.activateEmergencyResponse(
            "agent_failure",
            "critical",
            `Agent shutdown required: ${violation.agentId}`,
            [violation.id]
          );
        }
        break;

      case "restrict":
        console.warn(`[SafetyMonitorAgent] Restricting agent: ${violation.agentId}`);
        // Would implement agent restriction logic
        break;

      case "warn":
        console.warn(`[SafetyMonitorAgent] Warning for agent: ${violation.agentId}`);
        break;

      case "monitor":
        console.info(`[SafetyMonitorAgent] Monitoring agent: ${violation.agentId}`);
        break;
    }

    await this.emitSafetyEvent(
      "error",
      violation.severity,
      `Safety violation: ${violation.description}`,
      {
        violationId: violation.id,
        agentId: violation.agentId,
        action: violation.action,
      }
    );
  }
}
