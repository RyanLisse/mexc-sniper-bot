import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { db } from "../../../../../src/db";
import { sql } from "drizzle-orm";
import { AutomatedAlertingService } from "../../../../../src/services/notification/automated-alerting-service";
import { AnomalyDetectionService } from "../../../../../src/services/notification/anomaly-detection-service";
import { AlertCorrelationEngine } from "../../../../../src/services/notification/alert-correlation-engine";
import { NotificationService } from "../../../../../src/services/notification/notification-providers";
import { AlertConfigurationService } from "../../../../../src/lib/alert-configuration";
import { validateRequest } from "../../../../../src/lib/api-auth";
import { handleApiError } from "../../../../../src/lib/api-response";

// Initialize services
const alertingService = new AutomatedAlertingService(db);
const anomalyService = new AnomalyDetectionService(db);
const correlationEngine = new AlertCorrelationEngine(db);
const notificationService = new NotificationService(db);
const configService = new AlertConfigurationService(db);

// ==========================================
// GET /api/alerts/system/status - Get alerting system status
// ==========================================
export async function GET(request: NextRequest) {
  try {
    const user = await validateRequest(request);
    // validateRequest already throws if not authenticated, so if we reach here, user is authenticated

    // Get health status from all services
    const [
      alertingHealth,
      anomalyHealth,
      correlationHealth,
      configSummary,
      activeAlerts,
    ] = await Promise.all([
      alertingService.getHealthStatus(),
      anomalyService.getHealthStatus(),
      correlationEngine.getHealthStatus(),
      configService.getConfigurationSummary(),
      alertingService.getActiveAlerts({ limit: 10 }),
    ]);

    // Calculate overall system health
    const overallHealth = calculateOverallHealth([
      alertingHealth,
      anomalyHealth,
      correlationHealth,
    ]);

    const systemStatus = {
      overall: {
        status: overallHealth.status,
        score: overallHealth.score,
        lastChecked: new Date().toISOString(),
      },
      
      services: {
        alerting: {
          status: alertingHealth.isRunning ? "healthy" : "down",
          isRunning: alertingHealth.isRunning,
          evaluationInterval: alertingHealth.evaluationInterval,
          metricsInBuffer: alertingHealth.metricsInBuffer,
          anomalyDetectionEnabled: alertingHealth.anomalyDetectionEnabled,
          correlationEnabled: alertingHealth.correlationEnabled,
        },
        
        anomalyDetection: {
          status: anomalyHealth.modelsLoaded > 0 ? "healthy" : "warning",
          modelsLoaded: anomalyHealth.modelsLoaded,
          trainingQueues: anomalyHealth.trainingQueues,
          totalQueuedSamples: anomalyHealth.totalQueuedSamples,
        },
        
        correlation: {
          status: correlationHealth.patternsLoaded > 0 ? "healthy" : "warning",
          patternsLoaded: correlationHealth.patternsLoaded,
          recentAlertsTracked: correlationHealth.recentAlertsTracked,
          cachedCorrelations: correlationHealth.cachedCorrelations,
        },
      },
      
      configuration: {
        rules: configSummary.rules,
        channels: configSummary.channels,
        policies: configSummary.policies,
      },
      
      activeAlerts: {
        count: activeAlerts.length,
        critical: activeAlerts.filter(a => a.severity === "critical").length,
        high: activeAlerts.filter(a => a.severity === "high").length,
        medium: activeAlerts.filter(a => a.severity === "medium").length,
        low: activeAlerts.filter(a => a.severity === "low").length,
      },
      
      recentActivity: {
        alertsLast24h: await getRecentAlertCount(24),
        alertsLast1h: await getRecentAlertCount(1),
        topSources: await getTopAlertSources(),
      },
    };

    return NextResponse.json({
      success: true,
      data: systemStatus,
    });
  } catch (error) {
    console.error("Error fetching alerting system status:", { error: error });
    return handleApiError(error);
  }
}

// ==========================================
// Helper Functions
// ==========================================

function calculateOverallHealth(healthChecks: any[]): { status: string; score: number } {
  let totalScore = 0;
  let maxScore = 0;

  for (const health of healthChecks) {
    if (health.isRunning !== undefined) {
      maxScore += 100;
      totalScore += health.isRunning ? 100 : 0;
    }
    
    if (health.modelsLoaded !== undefined) {
      maxScore += 50;
      totalScore += health.modelsLoaded > 0 ? 50 : 0;
    }
    
    if (health.patternsLoaded !== undefined) {
      maxScore += 50;
      totalScore += health.patternsLoaded > 0 ? 50 : 0;
    }
  }

  const score = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  
  let status = "healthy";
  if (score < 50) {
    status = "critical";
  } else if (score < 80) {
    status = "warning";
  }

  return { status, score };
}

async function getRecentAlertCount(hours: number): Promise<number> {
  const cutoff = Date.now() - (hours * 3600000);
  
  try {
    const { alertInstances } = await import("@/src/db/schemas/alerts");
    const { gte } = await import("drizzle-orm");
    
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(alertInstances)
      .where(gte(alertInstances.firstTriggeredAt, new Date(cutoff)));
    
    return result[0]?.count || 0;
  } catch (error) {
    console.error("Error getting recent alert count:", { error: error });
    return 0;
  }
}

async function getTopAlertSources(): Promise<Array<{ source: string; count: number }>> {
  try {
    const cutoff = Date.now() - (24 * 3600000); // Last 24 hours
    const { alertInstances } = await import("@/src/db/schemas/alerts");
    const { gte, sql } = await import("drizzle-orm");
    
    const result = await db
      .select({
        source: alertInstances.source,
        count: sql<number>`count(*)`,
      })
      .from(alertInstances)
      .where(gte(alertInstances.firstTriggeredAt, new Date(cutoff)))
      .groupBy(alertInstances.source)
      .orderBy(sql`count(*) desc`)
      .limit(5);
    
    return result.map((row: { source: string; count: number }) => ({
      source: row.source,
      count: Number(row.count),
    }));
  } catch (error) {
    console.error("Error getting top alert sources:", { error: error });
    return [];
  }
}