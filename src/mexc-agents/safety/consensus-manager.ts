import {
  isBrowserEnvironment,
  isNodeEnvironment,
} from "@/src/lib/browser-compatible-events";
/**
 * Consensus Manager Module
 */

import { createLogger } from "../../lib/unified-logger";
import type {
  AgentConsensusRequest,
  AgentConsensusResponse,
  SafetyMonitorConfig,
} from "./types";

const logger = createLogger("consensus-manager", {
  enableStructuredLogging: process.env.NODE_ENV === "production",
  enablePerformanceLogging: true,
});

export class ConsensusManager {
  private consensusRequests: Map<string, AgentConsensusRequest> = new Map();
  private safetyConfig: SafetyMonitorConfig;

  constructor(config: SafetyMonitorConfig) {
    this.safetyConfig = config;
  }

  /**
   * Request multi-agent consensus for high-risk decisions
   */
  async requestAgentConsensus(
    request: AgentConsensusRequest
  ): Promise<AgentConsensusResponse> {
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
    const approvals = agentResponses.filter(
      (r) => r.response === "approve"
    ).length;
    const total = agentResponses.filter((r) => r.response !== "abstain").length;
    const approvalRate = total > 0 ? (approvals / total) * 100 : 0;

    const consensusAchieved = approvalRate >= request.consensusThreshold;
    const averageConfidence =
      agentResponses.length > 0
        ? agentResponses.reduce((sum, r) => sum + r.confidence, 0) /
          agentResponses.length
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

    const dissentingAgents = agentResponses.filter(
      (r) => r.response === "reject"
    );
    if (dissentingAgents.length > 0) {
      warnings.push(
        `Dissenting agents: ${dissentingAgents.map((a) => a.agentId).join(", ")}`
      );
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

    logger.info(
      `Consensus ${response.consensus.finalDecision}: ${request.type}`,
      {
        requestId: request.requestId,
        approvalRate,
        confidence: averageConfidence,
        processingTime: response.processingTime,
      }
    );

    return response;
  } /**
   * Analyze consensus request for risk level and complexity
   */
  private async analyzeConsensusRequest(
    request: AgentConsensusRequest
  ): Promise<{
    riskLevel: "low" | "medium" | "high" | "critical";
    complexity: number;
    recommendations: string[];
  }> {
    // Simplified analysis - in production would use AI
    let riskLevel: "low" | "medium" | "high" | "critical" = "medium";
    let complexity = 50;

    // Analyze based on request type
    switch (request.type) {
      case "trade_approval":
        riskLevel = "high";
        complexity = 80;
        break;
      case "emergency_response":
        riskLevel = "critical";
        complexity = 90;
        break;
      case "pattern_validation":
        riskLevel = "medium";
        complexity = 60;
        break;
      case "risk_assessment":
        riskLevel = "high";
        complexity = 70;
        break;
    }

    // Adjust based on priority
    if (request.priority === "critical") {
      riskLevel = "critical";
      complexity = Math.min(complexity + 20, 100);
    } else if (request.priority === "low") {
      complexity = Math.max(complexity - 20, 10);
    }

    const recommendations = [
      "Ensure all required agents participate",
      "Monitor consensus quality and confidence levels",
      "Review dissenting opinions carefully",
    ];

    return { riskLevel, complexity, recommendations };
  }

  /**
   * Simulate agent consensus response
   */
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

  /**
   * Get consensus statistics
   */
  getStats(): {
    activeConsensusRequests: number;
    pendingRequests: string[];
  } {
    return {
      activeConsensusRequests: this.consensusRequests.size,
      pendingRequests: Array.from(this.consensusRequests.keys()),
    };
  }

  /**
   * Clear all consensus requests
   */
  clearRequests(): void {
    this.consensusRequests.clear();
    logger.info("Consensus requests cleared");
  }
}
