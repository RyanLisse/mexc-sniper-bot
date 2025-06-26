/**
 * Safety Monitor Agent
 *
 * AI-powered safety monitoring system that provides comprehensive
 * oversight of agent behavior, pattern validation, and consensus
 * mechanisms for high-risk trading decisions.
 */

import type { AdvancedRiskEngine } from "@/src/services/advanced-risk-engine";
import type { EmergencySafetySystem } from "@/src/services/emergency-safety-system";
import { createLogger } from "../../lib/unified-logger";
import type { AgentConfig } from "../base-agent";
import { SafetyBaseAgent } from "../safety-base-agent";

import { BehaviorMonitor } from "./behavior-monitor";
import { ConsensusManager } from "./consensus-manager";
import { PatternValidator } from "./pattern-validator";
import type {
  AgentBehaviorMetrics,
  AgentConsensusRequest,
  AgentConsensusResponse,
  PatternValidationResult,
  SafetyMonitorConfig,
  SafetyProtocolViolation,
} from "./types";

const logger = createLogger("safety-monitor-agent", {
  enableStructuredLogging: process.env.NODE_ENV === "production",
  enablePerformanceLogging: true,
});

export class SafetyMonitorAgent extends SafetyBaseAgent {
  private riskEngine?: AdvancedRiskEngine;
  private emergencySystem?: EmergencySafetySystem;

  // Component modules
  private behaviorMonitor: BehaviorMonitor;
  private patternValidator: PatternValidator;
  private consensusManager: ConsensusManager;

  private safetyViolations: SafetyProtocolViolation[] = [];
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

    // Initialize component modules with merged config
    const fullConfig = this.safetyConfig as SafetyMonitorConfig;
    this.behaviorMonitor = new BehaviorMonitor(fullConfig);
    this.patternValidator = new PatternValidator(fullConfig);
    this.consensusManager = new ConsensusManager(fullConfig);

    logger.info("Initialized with comprehensive AI safety monitoring");
  } /**
   * Set integration with risk engine and emergency system
   */
  setIntegrations(riskEngine: AdvancedRiskEngine, emergencySystem: EmergencySafetySystem): void {
    this.riskEngine = riskEngine;
    this.emergencySystem = emergencySystem;
    logger.info("Integrated with risk engine and emergency system");
  }

  /**
   * Monitor agent behavior for anomalies
   */
  async monitorAgentBehavior(agentMetrics: AgentBehaviorMetrics[]): Promise<{
    anomaliesDetected: AgentBehaviorMetrics[];
    violations: SafetyProtocolViolation[];
    recommendations: string[];
  }> {
    const result = await this.behaviorMonitor.monitorAgentBehavior(agentMetrics);

    // Store violations for tracking
    this.safetyViolations.push(...result.violations);

    // Handle violations
    for (const violation of result.violations) {
      await this.handleSafetyViolation(violation);
    }

    // Emit safety event if anomalies detected
    if (result.anomaliesDetected.length > 0) {
      await this.emitSafetyEvent(
        "error",
        result.anomaliesDetected.length > 2 ? "high" : "medium",
        `Agent behavior anomalies detected: ${result.anomaliesDetected.length} agents`,
        { anomalies: result.anomaliesDetected.map((a) => a.agentId) }
      );
    }

    return result;
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
    const result = await this.patternValidator.validatePatternDiscovery(
      patternId,
      symbol,
      confidence,
      riskScore,
      patternData
    );

    // Log validation result
    await this.emitSafetyEvent(
      "simulation",
      result.recommendation === "reject" ? "high" : "low",
      `Pattern validation ${result.recommendation}: ${symbol}`,
      {
        patternId,
        confidence: result.confidence,
        recommendation: result.recommendation,
        consensusRequired: result.consensus.required,
      }
    );

    return result;
  }

  /**
   * Request multi-agent consensus for high-risk decisions
   */
  async requestAgentConsensus(request: AgentConsensusRequest): Promise<AgentConsensusResponse> {
    const response = await this.consensusManager.requestAgentConsensus(request);

    // Log consensus result
    await this.emitSafetyEvent(
      "simulation",
      response.consensus.achieved ? "low" : "medium",
      `Consensus ${response.consensus.finalDecision}: ${request.type}`,
      {
        requestId: request.requestId,
        approvalRate: response.consensus.approvalRate,
        confidence: response.consensus.confidence,
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
    const result = await this.behaviorMonitor.checkPerformanceDegradation();

    // Store violations
    this.safetyViolations.push(...result.violations);

    // Handle violations
    for (const violation of result.violations) {
      await this.handleSafetyViolation(violation);
    }

    this.lastPerformanceCheck = Date.now();

    return result;
  } /**
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
    const behaviorStats = this.behaviorMonitor.getStats();
    if (now - behaviorStats.lastBehaviorCheck > 600000) safetyScore -= 10; // 10 minutes
    if (now - this.lastPerformanceCheck > 1800000) safetyScore -= 15; // 30 minutes

    safetyScore = Math.max(0, Math.min(100, safetyScore));

    const recommendations: string[] = [];
    if (criticalViolations.length > 0) {
      recommendations.push(
        `${criticalViolations.length} critical violations require immediate attention`
      );
    }

    const consensusStats = this.consensusManager.getStats();
    if (consensusStats.activeConsensusRequests > 5) {
      recommendations.push(
        "High number of pending consensus requests - review consensus efficiency"
      );
    }
    if (safetyScore < 70) {
      recommendations.push("Overall safety score is low - comprehensive system review needed");
    }

    return {
      monitoringActive: this.monitoringActive,
      totalAgentsMonitored: behaviorStats.totalAgentsMonitored,
      activeViolations: activeViolations.length,
      criticalViolations: criticalViolations.length,
      lastBehaviorCheck: behaviorStats.lastBehaviorCheck,
      lastPerformanceCheck: this.lastPerformanceCheck,
      consensusRequests: consensusStats.activeConsensusRequests,
      overallSafetyScore: safetyScore,
      recommendations,
    };
  }

  // Implementation of abstract methods from SafetyBaseAgent
  async performSafetyCheck(_data: unknown): Promise<{
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
    const behaviorStats = this.behaviorMonitor.getStats();
    if (now - behaviorStats.lastBehaviorCheck > 600000) {
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
      const consensusStats = this.consensusManager.getStats();
      if (consensusStats.activeConsensusRequests > 10) {
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

  /**
   * Handle safety violations
   */
  private async handleSafetyViolation(violation: SafetyProtocolViolation): Promise<void> {
    logger.info(`Handling violation: ${violation.id} - ${violation.description}`, {
      violationId: violation.id,
      severity: violation.severity,
      action: violation.action,
    });

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
        logger.warn(`Restricting agent: ${violation.agentId}`, { agentId: violation.agentId });
        // Would implement agent restriction logic
        break;

      case "warn":
        logger.warn(`Warning for agent: ${violation.agentId}`, { agentId: violation.agentId });
        break;

      case "monitor":
        logger.info(`Monitoring agent: ${violation.agentId}`, { agentId: violation.agentId });
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

  /**
   * Get all safety violations
   */
  getViolations(resolved?: boolean): SafetyProtocolViolation[] {
    if (resolved !== undefined) {
      return this.safetyViolations.filter((v) => v.resolved === resolved);
    }
    return [...this.safetyViolations];
  }

  /**
   * Mark violation as resolved
   */
  resolveViolation(violationId: string): boolean {
    const violation = this.safetyViolations.find((v) => v.id === violationId);
    if (violation) {
      violation.resolved = true;
      logger.info(`Violation resolved: ${violationId}`, { violationId });
      return true;
    }
    return false;
  }
}
