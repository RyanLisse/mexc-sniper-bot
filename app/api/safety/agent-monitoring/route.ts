import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../src/lib/kinde-auth";
import { apiResponse } from "../../../../src/lib/api-response";
import { SafetyMonitorAgent } from "../../../../src/mexc-agents/safety-monitor-agent";
import type { AgentBehaviorMetrics } from "../../../../src/mexc-agents/safety-monitor-agent";

/**
 * Agent Monitoring API
 * 
 * GET /api/safety/agent-monitoring - Get agent health and behavior status
 * POST /api/safety/agent-monitoring - Update agent metrics or trigger monitoring actions
 */

// Initialize safety monitor
const safetyMonitor = new SafetyMonitorAgent();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get("includeHistory") === "true";
    const agentId = searchParams.get("agentId");

    // Get current safety status
    const safetyStatus = safetyMonitor.getSafetyStatus();

    // Mock agent behavior data (in production, would get from actual agent manager)
    const mockAgentMetrics: AgentBehaviorMetrics[] = [
      {
        agentId: "pattern-discovery-agent",
        agentType: "Pattern Discovery",
        responseTime: 1200 + Math.random() * 500,
        successRate: 94 + Math.random() * 4,
        errorRate: 2 + Math.random() * 3,
        confidenceScore: 85 + Math.random() * 10,
        memoryUsage: 128 + Math.random() * 64,
        cacheHitRate: 75 + Math.random() * 20,
        lastActivity: new Date(Date.now() - Math.random() * 300000).toISOString(),
        anomalyScore: Math.random() * 30,
      },
      {
        agentId: "risk-manager-agent",
        agentType: "Risk Manager",
        responseTime: 800 + Math.random() * 300,
        successRate: 97 + Math.random() * 3,
        errorRate: 1 + Math.random() * 2,
        confidenceScore: 92 + Math.random() * 6,
        memoryUsage: 96 + Math.random() * 32,
        cacheHitRate: 85 + Math.random() * 12,
        lastActivity: new Date(Date.now() - Math.random() * 180000).toISOString(),
        anomalyScore: Math.random() * 20,
      },
      {
        agentId: "mexc-api-agent",
        agentType: "MEXC API",
        responseTime: 2500 + Math.random() * 1000,
        successRate: 88 + Math.random() * 8,
        errorRate: 5 + Math.random() * 5,
        confidenceScore: 78 + Math.random() * 15,
        memoryUsage: 156 + Math.random() * 48,
        cacheHitRate: 65 + Math.random() * 25,
        lastActivity: new Date(Date.now() - Math.random() * 400000).toISOString(),
        anomalyScore: 25 + Math.random() * 20,
      },
      {
        agentId: "strategy-agent",
        agentType: "Strategy",
        responseTime: 1800 + Math.random() * 600,
        successRate: 91 + Math.random() * 6,
        errorRate: 3 + Math.random() * 4,
        confidenceScore: 88 + Math.random() * 8,
        memoryUsage: 144 + Math.random() * 56,
        cacheHitRate: 72 + Math.random() * 18,
        lastActivity: new Date(Date.now() - Math.random() * 250000).toISOString(),
        anomalyScore: 15 + Math.random() * 25,
      },
      {
        agentId: "safety-monitor-agent",
        agentType: "Safety Monitor",
        responseTime: 750 + Math.random() * 250,
        successRate: 99 + Math.random() * 1,
        errorRate: 0.5 + Math.random() * 1,
        confidenceScore: 95 + Math.random() * 4,
        memoryUsage: 112 + Math.random() * 24,
        cacheHitRate: 88 + Math.random() * 10,
        lastActivity: new Date(Date.now() - Math.random() * 60000).toISOString(),
        anomalyScore: Math.random() * 10,
      },
    ];

    // Filter by specific agent if requested
    const agentMetrics = agentId ? 
      mockAgentMetrics.filter(m => m.agentId === agentId) : 
      mockAgentMetrics;

    // Perform behavior monitoring
    const behaviorAnalysis = await safetyMonitor.monitorAgentBehavior(agentMetrics);

    // Check for performance degradation
    const performanceCheck = await safetyMonitor.checkPerformanceDegradation();

    const response = {
      overview: {
        totalAgents: safetyStatus.totalAgentsMonitored,
        monitoringActive: safetyStatus.monitoringActive,
        overallSafetyScore: safetyStatus.overallSafetyScore,
        activeViolations: safetyStatus.activeViolations,
        criticalViolations: safetyStatus.criticalViolations,
        lastBehaviorCheck: safetyStatus.lastBehaviorCheck,
        lastPerformanceCheck: safetyStatus.lastPerformanceCheck,
      },
      agentMetrics: agentMetrics.map(agent => ({
        ...agent,
        status: agent.anomalyScore > 50 ? "critical" :
                agent.anomalyScore > 30 ? "degraded" :
                agent.successRate < 85 ? "degraded" :
                agent.responseTime > 3000 ? "degraded" : "healthy",
        recommendations: [
          ...(agent.anomalyScore > 30 ? [`High anomaly score (${agent.anomalyScore.toFixed(1)}) - investigate behavior`] : []),
          ...(agent.successRate < 90 ? [`Low success rate (${agent.successRate.toFixed(1)}%) - consider retraining`] : []),
          ...(agent.responseTime > 2000 ? [`High response time (${agent.responseTime.toFixed(0)}ms) - optimize performance`] : []),
          ...(agent.cacheHitRate < 70 ? [`Low cache hit rate (${agent.cacheHitRate.toFixed(1)}%) - review caching strategy`] : []),
        ],
      })),
      behaviorAnalysis: {
        anomaliesDetected: behaviorAnalysis.anomaliesDetected.length,
        newViolations: behaviorAnalysis.violations.length,
        recommendations: behaviorAnalysis.recommendations,
        anomalousAgents: behaviorAnalysis.anomaliesDetected.map(a => a.agentId),
      },
      performanceAnalysis: {
        degradedAgents: performanceCheck.degradedAgents,
        performanceViolations: performanceCheck.violations.length,
        recommendations: performanceCheck.recommendations,
      },
      consensusStatus: {
        pendingRequests: safetyStatus.consensusRequests,
        // Mock recent consensus results
        recentConsensusResults: [
          {
            requestId: "pattern-consensus-123",
            type: "pattern_validation",
            achieved: true,
            approvalRate: 85,
            timestamp: new Date(Date.now() - 300000).toISOString(),
          },
          {
            requestId: "trade-approval-456",
            type: "trade_approval",
            achieved: false,
            approvalRate: 45,
            timestamp: new Date(Date.now() - 600000).toISOString(),
          },
        ],
      },
      timestamp: new Date().toISOString(),
    };

    return apiResponse.success(response);

  } catch (error) {
    console.error("[Agent Monitoring] GET Error:", error);
    return apiResponse.error(
      "Failed to get agent monitoring data",
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    try {
      await requireAuth();
    } catch (error) {
      return apiResponse.unauthorized("Authentication required");
    }

    const body = await request.json();
    const { action, agentId, parameters } = body;

    let result;

    switch (action) {
      case "validate_pattern":
        if (!parameters?.patternId || !parameters?.symbol) {
          return apiResponse.badRequest("Pattern ID and symbol required");
        }

        const validation = await safetyMonitor.validatePatternDiscovery(
          parameters.patternId,
          parameters.symbol,
          parameters.confidence || 75,
          parameters.riskScore || 50,
          parameters.patternData || {}
        );

        result = {
          validation,
          approved: validation.recommendation === "proceed",
          confidence: validation.confidence,
          reasoning: validation.reasoning,
        };
        break;

      case "request_consensus":
        if (!parameters?.consensusRequest) {
          return apiResponse.badRequest("Consensus request required");
        }

        const consensusResponse = await safetyMonitor.requestAgentConsensus(
          parameters.consensusRequest
        );

        result = {
          consensusResponse,
          decision: consensusResponse.consensus.finalDecision,
          confidence: consensusResponse.consensus.confidence,
          processingTime: consensusResponse.processingTime,
        };
        break;

      case "update_agent_metrics":
        if (!parameters?.agentMetrics) {
          return apiResponse.badRequest("Agent metrics required");
        }

        // Update agent behavior metrics
        const behaviorAnalysis = await safetyMonitor.monitorAgentBehavior(
          parameters.agentMetrics
        );

        result = {
          success: true,
          anomaliesDetected: behaviorAnalysis.anomaliesDetected.length,
          violations: behaviorAnalysis.violations.length,
          recommendations: behaviorAnalysis.recommendations,
        };
        break;

      case "acknowledge_violations":
        if (!parameters?.violationIds) {
          return apiResponse.badRequest("Violation IDs required");
        }

        // Mock acknowledgment (in production, would update actual violations)
        result = {
          success: true,
          acknowledgedCount: parameters.violationIds.length,
          message: `${parameters.violationIds.length} violations acknowledged`,
        };
        break;

      case "restart_agent":
        if (!agentId) {
          return apiResponse.badRequest("Agent ID required");
        }

        // Mock agent restart (in production, would restart actual agent)
        console.log(`[Agent Monitoring] Restarting agent: ${agentId}`);
        result = {
          success: true,
          message: `Agent ${agentId} restart initiated`,
          estimatedDowntime: "30 seconds",
        };
        break;

      case "shutdown_agent":
        if (!agentId) {
          return apiResponse.badRequest("Agent ID required");
        }

        // Mock agent shutdown (in production, would shutdown actual agent)
        console.log(`[Agent Monitoring] Shutting down agent: ${agentId}`);
        result = {
          success: true,
          message: `Agent ${agentId} shutdown initiated`,
          reason: parameters?.reason || "Manual shutdown via API",
        };
        break;

      case "enable_monitoring":
        // Enable/disable monitoring
        result = {
          success: true,
          message: "Agent monitoring enabled",
          monitoringActive: true,
        };
        break;

      case "disable_monitoring":
        result = {
          success: true,
          message: "Agent monitoring disabled",
          monitoringActive: false,
        };
        break;

      default:
        return apiResponse.badRequest(`Unknown action: ${action}`);
    }

    return apiResponse.success(result);

  } catch (error) {
    console.error("[Agent Monitoring] POST Error:", error);
    return apiResponse.error(
      "Failed to execute agent monitoring action",
      500
    );
  }
}