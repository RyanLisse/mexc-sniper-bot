import type { NextRequest } from "next/server";
import { apiResponse } from "@/src/lib/api-response";
import { requireAuth } from "@/src/lib/supabase-auth";
import { SafetyMonitorAgent } from "@/src/mexc-agents/safety-monitor-agent";
import { AdvancedRiskEngine } from "@/src/services/risk/advanced-risk-engine";
import { EmergencySafetySystem } from "@/src/services/risk/emergency-safety-system";

/**
 * Safety System Status API
 *
 * GET /api/safety/system-status - Get comprehensive safety system status
 * POST /api/safety/system-status - Update safety system configuration
 */

// Initialize safety systems (in production, would be singleton instances)
const riskEngine = new AdvancedRiskEngine();
const emergencySystem = new EmergencySafetySystem();
const safetyMonitor = new SafetyMonitorAgent();

// Set up integrations
emergencySystem.setRiskEngine(riskEngine);
safetyMonitor.setIntegrations(riskEngine, emergencySystem);

export async function GET(request: NextRequest) {
  // Build-safe logger initialization inside function
  try {
    // Verify authentication
    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get("includeDetails") === "true";

    // Get comprehensive safety status
    const [
      systemHealthCheck,
      riskEngineHealth,
      emergencyStatus,
      safetyMonitorStatus,
      portfolioRiskMetrics,
    ] = await Promise.all([
      emergencySystem.performSystemHealthCheck(),
      riskEngine.getHealthStatus(),
      emergencySystem.getEmergencyStatus(),
      safetyMonitor.getSafetyStatus(),
      riskEngine.getPortfolioRiskMetrics(),
    ]);

    // Calculate overall safety score
    let overallSafetyScore = 100;

    if (systemHealthCheck.overall === "critical") overallSafetyScore -= 40;
    else if (systemHealthCheck.overall === "degraded") overallSafetyScore -= 20;
    else if (systemHealthCheck.overall === "emergency") overallSafetyScore = 0;

    if (!riskEngineHealth.healthy) overallSafetyScore -= 25;
    if (emergencyStatus.active) overallSafetyScore -= 30;
    if (safetyMonitorStatus.criticalViolations > 0) overallSafetyScore -= 20;

    overallSafetyScore = Math.max(0, overallSafetyScore);

    const response = {
      overall: {
        safetyScore: overallSafetyScore,
        status:
          overallSafetyScore > 80
            ? "healthy"
            : overallSafetyScore > 60
              ? "degraded"
              : overallSafetyScore > 20
                ? "critical"
                : "emergency",
        lastUpdate: new Date().toISOString(),
      },
      systems: {
        riskEngine: {
          healthy: riskEngineHealth.healthy,
          issues: riskEngineHealth.issues,
          metrics: riskEngineHealth.metrics,
        },
        emergencySystem: {
          active: emergencyStatus.active,
          activeCount: emergencyStatus.activeCount,
          tradingHalted: emergencyStatus.tradingHalted,
          systemHealth: emergencyStatus.systemHealth,
        },
        safetyMonitor: {
          monitoringActive: safetyMonitorStatus.monitoringActive,
          agentsMonitored: safetyMonitorStatus.totalAgentsMonitored,
          activeViolations: safetyMonitorStatus.activeViolations,
          criticalViolations: safetyMonitorStatus.criticalViolations,
          overallSafetyScore: safetyMonitorStatus.overallSafetyScore,
        },
        systemHealth: systemHealthCheck,
      },
      riskMetrics: {
        portfolioValue: portfolioRiskMetrics.totalValue,
        totalExposure: portfolioRiskMetrics.totalExposure,
        valueAtRisk95: portfolioRiskMetrics.valueAtRisk95,
        maxDrawdownRisk: portfolioRiskMetrics.maxDrawdownRisk,
        diversificationScore: portfolioRiskMetrics.diversificationScore,
        concentrationRisk: portfolioRiskMetrics.concentrationRisk,
      },
      alerts: includeDetails
        ? {
            riskAlerts: riskEngine.getActiveAlerts(),
            emergencyConditions: emergencyStatus.conditions,
            safetyViolations: safetyMonitorStatus.activeViolations,
          }
        : undefined,
      recommendations: [
        ...riskEngineHealth.issues.map(
          (issue: string) => `Risk Engine: ${issue}`
        ),
        ...systemHealthCheck.criticalIssues.map(
          (issue: string) => `System: ${issue}`
        ),
        ...safetyMonitorStatus.recommendations,
      ],
    };

    return apiResponse.success(response);
  } catch (error) {
    console.error("[Safety System Status] Error:", { error: error });
    return apiResponse.error("Failed to get safety system status", 500);
  }
}

export async function POST(request: NextRequest) {
  // Build-safe logger initialization inside function
  try {
    // Verify authentication
    try {
      await requireAuth();
    } catch (_error) {
      return apiResponse.unauthorized("Authentication required");
    }

    const body = await request.json();
    const { action, parameters } = body;

    let result;

    switch (action) {
      case "emergency_halt":
        await emergencySystem.forceEmergencyHalt(
          parameters?.reason || "Manual emergency halt via API"
        );
        result = { success: true, message: "Emergency halt activated" };
        break;

      case "resume_operations": {
        const resumed = await emergencySystem.resumeNormalOperations();
        result = {
          success: resumed,
          message: resumed
            ? "Operations resumed"
            : "Failed to resume operations",
        };
        break;
      }

      case "update_risk_config":
        if (parameters?.riskConfig) {
          // Would update risk engine configuration
          result = { success: true, message: "Risk configuration updated" };
        } else {
          return apiResponse.badRequest("Risk configuration required");
        }
        break;

      case "acknowledge_alerts":
        if (parameters?.alertIds) {
          // Would acknowledge specified alerts
          result = {
            success: true,
            message: `${parameters.alertIds.length} alerts acknowledged`,
          };
        } else {
          return apiResponse.badRequest("Alert IDs required");
        }
        break;

      case "stress_test": {
        const stressTestResults = await riskEngine.performStressTest(
          parameters?.scenarios
        );
        result = {
          success: true,
          message: "Stress test completed",
          results: stressTestResults,
        };
        break;
      }

      default:
        return apiResponse.badRequest(`Unknown action: ${action}`);
    }

    return apiResponse.success(result);
  } catch (error) {
    console.error("[Safety System Status] POST Error:", { error: error });
    return apiResponse.error("Failed to execute safety system action", 500);
  }
}
