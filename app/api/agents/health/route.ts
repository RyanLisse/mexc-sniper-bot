import { type NextRequest, NextResponse } from "next/server";
import type {
  AgentStatus,
  RegisteredAgent,
} from "@/src/mexc-agents/coordination/agent-registry";
import { getGlobalAgentRegistry } from "@/src/mexc-agents/coordination/agent-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Health status endpoint with comprehensive metrics
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId");
    const includeHistory = url.searchParams.get("includeHistory") === "true";
    const includeAlerts = url.searchParams.get("includeAlerts") === "true";
    const includeRecommendations =
      url.searchParams.get("includeRecommendations") === "true";
    const historyLimit = parseInt(url.searchParams.get("historyLimit") || "50");

    const registry = getGlobalAgentRegistry();

    // Single agent health report
    if (agentId) {
      const agent = registry.getAgent(agentId);
      if (!agent) {
        return NextResponse.json(
          { success: false, error: "Agent not found" },
          { status: 404 }
        );
      }

      const healthHistory = includeHistory
        ? registry.getAgentHealthHistory(agentId, historyLimit)
        : [];

      const report = includeRecommendations
        ? registry.getAgentHealthReport(agentId)
        : null;

      return NextResponse.json({
        success: true,
        data: {
          agent: {
            id: agent.id,
            name: agent.name,
            type: agent.type,
            registeredAt: agent.registeredAt,
            dependencies: agent.dependencies,
            priority: agent.priority,
            tags: agent.tags,
            health: agent.health,
            thresholds: agent.thresholds,
            autoRecovery: agent.autoRecovery,
          },
          healthHistory,
          recommendations: report?.recommendations || [],
          lastChecked: agent.health.lastChecked,
          nextCheckDue: new Date(Date.now() + 30000), // Assuming 30s interval
        },
      });
    }

    // System-wide health overview
    const stats = registry.getStats();
    const allAgents = registry.getAllAgents();
    const alerts = includeAlerts ? registry.getSystemAlerts() : [];

    // Group agents by status for overview
    const agentsByStatus: Record<AgentStatus, RegisteredAgent[]> = {
      healthy: [],
      degraded: [],
      unhealthy: [],
      unknown: [],
      recovering: [],
    };

    for (const agent of allAgents) {
      agentsByStatus[agent.health.status].push(agent);
    }

    // Calculate system-wide metrics
    const systemMetrics = {
      totalAgents: stats.totalAgents,
      healthyAgents: stats.healthyAgents,
      degradedAgents: stats.degradedAgents,
      unhealthyAgents: stats.unhealthyAgents,
      unknownAgents: stats.unknownAgents,
      averageResponseTime: stats.averageResponseTime,
      averageHealthScore:
        allAgents.reduce((sum, agent) => sum + agent.health.healthScore, 0) /
          allAgents.length || 0,
      systemUptime:
        allAgents.reduce((sum, agent) => sum + agent.health.uptime, 0) /
          allAgents.length || 0,
      totalRecoveryAttempts: allAgents.reduce(
        (sum, agent) => sum + agent.health.recoveryAttempts,
        0
      ),
      agentsWithErrors: allAgents.filter(
        (agent) => agent.health.consecutiveErrors > 0
      ).length,
      lastFullHealthCheck: stats.lastFullHealthCheck,
    };

    // Calculate trend analysis
    const trendAnalysis = {
      responseTime: {
        improving: allAgents.filter(
          (a) => a.health.trends.responseTime === "improving"
        ).length,
        degrading: allAgents.filter(
          (a) => a.health.trends.responseTime === "degrading"
        ).length,
        stable: allAgents.filter(
          (a) => a.health.trends.responseTime === "stable"
        ).length,
      },
      errorRate: {
        improving: allAgents.filter(
          (a) => a.health.trends.errorRate === "improving"
        ).length,
        degrading: allAgents.filter(
          (a) => a.health.trends.errorRate === "degrading"
        ).length,
        stable: allAgents.filter((a) => a.health.trends.errorRate === "stable")
          .length,
      },
      throughput: {
        improving: allAgents.filter(
          (a) => a.health.trends.throughput === "improving"
        ).length,
        degrading: allAgents.filter(
          (a) => a.health.trends.throughput === "degrading"
        ).length,
        stable: allAgents.filter((a) => a.health.trends.throughput === "stable")
          .length,
      },
    };

    // Top performing and struggling agents
    const sortedByHealth = [...allAgents].sort(
      (a, b) => b.health.healthScore - a.health.healthScore
    );
    const topPerformers = sortedByHealth.slice(0, 5).map((agent) => ({
      id: agent.id,
      name: agent.name,
      healthScore: agent.health.healthScore,
      status: agent.health.status,
      responseTime: agent.health.responseTime,
      uptime: agent.health.uptime,
    }));

    const strugglingAgents = sortedByHealth
      .slice(-5)
      .reverse()
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        healthScore: agent.health.healthScore,
        status: agent.health.status,
        responseTime: agent.health.responseTime,
        errorRate: agent.health.errorRate,
        consecutiveErrors: agent.health.consecutiveErrors,
        recoveryAttempts: agent.health.recoveryAttempts,
      }));

    return NextResponse.json({
      success: true,
      data: {
        systemMetrics,
        agentsByStatus: {
          healthy: agentsByStatus.healthy.map((a) => ({
            id: a.id,
            name: a.name,
            healthScore: a.health.healthScore,
          })),
          degraded: agentsByStatus.degraded.map((a) => ({
            id: a.id,
            name: a.name,
            healthScore: a.health.healthScore,
            issues: getHealthIssues(a),
          })),
          unhealthy: agentsByStatus.unhealthy.map((a) => ({
            id: a.id,
            name: a.name,
            healthScore: a.health.healthScore,
            issues: getHealthIssues(a),
          })),
          unknown: agentsByStatus.unknown.map((a) => ({
            id: a.id,
            name: a.name,
          })),
          recovering: agentsByStatus.recovering.map((a) => ({
            id: a.id,
            name: a.name,
            recoveryAttempts: a.health.recoveryAttempts,
          })),
        },
        trendAnalysis,
        topPerformers,
        strugglingAgents,
        alerts,
        lastUpdated: new Date(),
      },
    });
  } catch (error) {
    console.error("[API] Agent health check failed:", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve agent health status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Health check trigger endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId } = body;

    const registry = getGlobalAgentRegistry();

    if (agentId) {
      // Check specific agent
      const agent = registry.getAgent(agentId);
      if (!agent) {
        return NextResponse.json(
          { success: false, error: "Agent not found" },
          { status: 404 }
        );
      }

      const result = await registry.checkAgentHealth(agentId);

      return NextResponse.json({
        success: true,
        data: {
          agentId,
          agentName: agent.name,
          healthCheckResult: result,
          currentStatus: agent.health.status,
          healthScore: agent.health.healthScore,
          timestamp: new Date(),
        },
      });
    } else {
      // Check all agents
      const results = await registry.checkAllAgentsHealth();
      const stats = registry.getStats();

      return NextResponse.json({
        success: true,
        data: {
          healthCheckResults: Object.fromEntries(results),
          systemStats: stats,
          checkedAgents: results.size,
          timestamp: new Date(),
        },
      });
    }
  } catch (error) {
    console.error("[API] Agent health check trigger failed:", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to trigger health check",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Update agent health thresholds
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, thresholds, autoRecovery } = body;

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: "Agent ID is required" },
        { status: 400 }
      );
    }

    const registry = getGlobalAgentRegistry();
    const agent = registry.getAgent(agentId);

    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent not found" },
        { status: 404 }
      );
    }

    // Update thresholds if provided
    if (thresholds) {
      agent.thresholds = { ...agent.thresholds, ...thresholds };
    }

    // Update auto-recovery setting if provided
    if (typeof autoRecovery === "boolean") {
      agent.autoRecovery = autoRecovery;
    }

    return NextResponse.json({
      success: true,
      data: {
        agentId,
        agentName: agent.name,
        updatedThresholds: agent.thresholds,
        autoRecovery: agent.autoRecovery,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error("[API] Agent health configuration update failed:", {
      error: error,
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update agent health configuration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Helper function to identify health issues
function getHealthIssues(agent: RegisteredAgent): string[] {
  const issues: string[] = [];
  const health = agent.health;
  const thresholds = agent.thresholds;

  if (health.responseTime > thresholds.responseTime.warning) {
    issues.push("Slow response time");
  }

  if (health.errorRate > thresholds.errorRate.warning) {
    issues.push("High error rate");
  }

  if (health.consecutiveErrors > thresholds.consecutiveErrors.warning) {
    issues.push("Consecutive errors");
  }

  if (health.memoryUsage > thresholds.memoryUsage.warning) {
    issues.push("High memory usage");
  }

  if (health.cpuUsage > thresholds.cpuUsage.warning) {
    issues.push("High CPU usage");
  }

  if (health.uptime < thresholds.uptime.warning) {
    issues.push("Low uptime");
  }

  if (health.recoveryAttempts > 3) {
    issues.push("Multiple recovery attempts");
  }

  return issues;
}
