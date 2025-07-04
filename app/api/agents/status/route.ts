import { NextResponse } from "next/server";
import { getGlobalAgentRegistry } from "@/src/mexc-agents/coordination/agent-registry";
import { AgentMonitoringService } from "@/src/services/notification/agent-monitoring-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Quick status endpoint for all agents and monitoring
export async function GET() {
  // Build-safe logger - simple console implementation
  const logger = {
    info: (message: string, context?: Record<string, unknown> | string) =>
      console.info("[agents-status]", message, context || ""),
    warn: (message: string, context?: Record<string, unknown> | string) =>
      console.warn("[agents-status]", message, context || ""),
    error: (message: string, context?: Record<string, unknown> | string) =>
      console.error("[agents-status]", message, context || ""),
    debug: (message: string, context?: Record<string, unknown> | string) =>
      console.debug("[agents-status]", message, context || ""),
  };

  try {
    const registry = getGlobalAgentRegistry();
    const monitoringService = AgentMonitoringService.getInstance();

    // Get basic stats
    const registryStats = registry.getStats();
    const monitoringStats = monitoringService.getStats();
    const alerts = monitoringService.getAlerts();
    const recentReports = monitoringService.getReports(1);

    // Get all agents with basic health info
    const agents = registry.getAllAgents().map((agent) => ({
      id: agent.id,
      name: agent.name,
      type: agent.type,
      status: agent.health.status,
      healthScore: agent.health.healthScore,
      responseTime: agent.health.responseTime,
      errorRate: agent.health.errorRate,
      uptime: agent.health.uptime,
      lastChecked: agent.health.lastChecked,
      recoveryAttempts: agent.health.recoveryAttempts,
      memoryUsage: agent.health.memoryUsage,
      cpuUsage: agent.health.cpuUsage,
      trends: agent.health.trends,
    }));

    return NextResponse.json({
      success: true,
      timestamp: new Date(),
      data: {
        system: {
          registry: registryStats,
          monitoring: monitoringStats,
          healthStatus: getSystemHealthStatus(registryStats),
        },
        agents,
        alerts: alerts.slice(-5), // Last 5 alerts
        latestReport: recentReports[0] || null,
        summary: {
          totalAgents: agents.length,
          healthyAgents: agents.filter((a) => a.status === "healthy").length,
          degradedAgents: agents.filter((a) => a.status === "degraded").length,
          unhealthyAgents: agents.filter((a) => a.status === "unhealthy")
            .length,
          averageHealthScore:
            agents.reduce((sum, a) => sum + a.healthScore, 0) / agents.length ||
            0,
          systemUptime:
            agents.reduce((sum, a) => sum + a.uptime, 0) / agents.length || 0,
          activeAlerts: alerts.filter((a) => !a.resolved).length,
        },
      },
    });
  } catch (error) {
    logger.error("[API] Agent status request failed:", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve agent status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

interface RegistryStats {
  totalAgents: number;
  unhealthyAgents: number;
  degradedAgents: number;
}

function getSystemHealthStatus(
  stats: RegistryStats
): "healthy" | "degraded" | "unhealthy" | "unknown" {
  if (stats.totalAgents === 0) return "unknown";

  const unhealthyPercentage = (stats.unhealthyAgents / stats.totalAgents) * 100;
  const degradedPercentage = (stats.degradedAgents / stats.totalAgents) * 100;

  if (unhealthyPercentage > 30) return "unhealthy";
  if (unhealthyPercentage > 10 || degradedPercentage > 40) return "degraded";

  return "healthy";
}
