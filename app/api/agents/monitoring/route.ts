import { NextRequest, NextResponse } from "next/server";
import { AgentMonitoringService } from "@/src/services/agent-monitoring-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Get monitoring status and alerts
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const includeResolved = url.searchParams.get("includeResolved") === "true";
    const limit = parseInt(url.searchParams.get("limit") || "10");

    const monitoringService = AgentMonitoringService.getInstance();

    switch (action) {
      case "alerts":
        const alerts = monitoringService.getAlerts(includeResolved);
        return NextResponse.json({
          success: true,
          data: {
            alerts,
            totalAlerts: alerts.length,
            unresolvedAlerts: alerts.filter(a => !a.resolved).length,
          },
        });

      case "reports":
        const reports = monitoringService.getReports(limit);
        return NextResponse.json({
          success: true,
          data: {
            reports,
            totalReports: reports.length,
            latestReport: reports[reports.length - 1] || null,
          },
        });

      case "stats":
        const stats = monitoringService.getStats();
        return NextResponse.json({
          success: true,
          data: stats,
        });

      case "config":
        const config = monitoringService.getConfig();
        return NextResponse.json({
          success: true,
          data: config,
        });

      default:
        // Default: return comprehensive monitoring overview
        const overview = {
          stats: monitoringService.getStats(),
          recentAlerts: monitoringService.getAlerts(false).slice(-10),
          latestReport: monitoringService.getReports(1)[0] || null,
          config: monitoringService.getConfig(),
        };

        return NextResponse.json({
          success: true,
          data: overview,
        });
    }

  } catch (error) {
    console.error("[API] Monitoring service request failed:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to retrieve monitoring data",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// Control monitoring service and resolve alerts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    const monitoringService = AgentMonitoringService.getInstance();

    switch (action) {
      case "start":
        monitoringService.start();
        return NextResponse.json({
          success: true,
          message: "Monitoring service started",
          timestamp: new Date(),
        });

      case "stop":
        monitoringService.stop();
        return NextResponse.json({
          success: true,
          message: "Monitoring service stopped",
          timestamp: new Date(),
        });

      case "resolve_alert":
        const { alertId } = params;
        if (!alertId) {
          return NextResponse.json(
            { success: false, error: "Alert ID is required" },
            { status: 400 }
          );
        }

        const resolved = monitoringService.resolveAlert(alertId);
        return NextResponse.json({
          success: resolved,
          message: resolved ? "Alert resolved successfully" : "Alert not found or already resolved",
          alertId,
          timestamp: new Date(),
        });

      case "generate_report":
        // Force generation of a new report
        const report = await monitoringService.generateReport();
        return NextResponse.json({
          success: true,
          data: report,
          message: "Report generated successfully",
        });

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error("[API] Monitoring service action failed:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to execute monitoring action",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// Update monitoring configuration
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const monitoringService = AgentMonitoringService.getInstance();

    monitoringService.updateConfig(body);

    return NextResponse.json({
      success: true,
      message: "Monitoring configuration updated",
      config: monitoringService.getConfig(),
      timestamp: new Date(),
    });

  } catch (error) {
    console.error("[API] Monitoring configuration update failed:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to update monitoring configuration",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}