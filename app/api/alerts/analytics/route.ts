import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { validateRequest } from "@/src/lib/api-auth";
import { handleApiError } from "@/src/lib/api-response";
import { AlertCorrelationEngine } from "@/src/services/notification/alert-correlation-engine";
import { AnomalyDetectionService } from "@/src/services/notification/anomaly-detection-service";
import { AutomatedAlertingService } from "@/src/services/notification/automated-alerting-service";

// Type definitions for analytics data
interface AlertAnalyticsItem {
  timestamp: string | Date;
  totalAlerts: number;
  resolvedAlerts: number;
  falsePositives: number;
  mttr: number;
  averageSeverity: number;
  notificationChannels: Record<string, number>;
  criticalAlerts?: number;
  highAlerts?: number;
  mediumAlerts?: number;
  lowAlerts?: number;
  infoAlerts?: number;
  emailNotifications?: number;
  slackNotifications?: number;
  webhookNotifications?: number;
  smsNotifications?: number;
  teamsNotifications?: number;
  failedNotifications?: number;
}

interface ModelStatistic {
  metricName: string;
  modelType: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  lastTraining: string;
  status: string;
  sampleCount?: number;
  queuedSamples?: number;
}

interface FormattedAnalyticsItem extends Omit<AlertAnalyticsItem, "timestamp"> {
  timestamp: string;
  alertRate: number;
  resolutionRate: number;
  falsePositiveRate: number;
}

// ==========================================
// GET /api/alerts/analytics - Get alerting analytics
// ==========================================

export async function GET(request: NextRequest) {
  try {
    const _user = await validateRequest(request);
    // validateRequest already throws if not authenticated, so if we reach here, user is authenticated

    const { searchParams } = new URL(request.url);
    const bucket =
      (searchParams.get("bucket") as "hourly" | "daily") || "hourly";
    const limit = parseInt(searchParams.get("limit") || "24");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Initialize services at runtime
    const alertingService = new AutomatedAlertingService(db);
    const anomalyService = new AnomalyDetectionService(db);
    const correlationEngine = new AlertCorrelationEngine(db);

    // Get alert analytics
    const analytics = await alertingService.getAlertAnalytics(bucket, limit);

    // Get ML model statistics
    const modelStats = await anomalyService.getAllModelStatistics();

    // Get active correlations
    const activeCorrelations = await correlationEngine.getActiveCorrelations();

    // Calculate additional metrics
    const additionalMetrics = await calculateAdditionalMetrics(
      alertingService,
      startDate ?? undefined,
      endDate ?? undefined
    );

    const analyticsData = {
      timeSeries: {
        bucket,
        limit,
        data: analytics.map(
          (item: AlertAnalyticsItem): FormattedAnalyticsItem => ({
            ...item,
            timestamp: new Date(item.timestamp).toISOString(),
            alertRate:
              item.totalAlerts > 0
                ? item.totalAlerts / (bucket === "hourly" ? 1 : 24)
                : 0,
            resolutionRate:
              item.totalAlerts > 0 ? item.resolvedAlerts / item.totalAlerts : 0,
            falsePositiveRate:
              item.totalAlerts > 0 ? item.falsePositives / item.totalAlerts : 0,
          })
        ),
      },

      summary: {
        totalAlerts: analytics.reduce(
          (sum: number, item: AlertAnalyticsItem) => sum + item.totalAlerts,
          0
        ),
        totalResolved: analytics.reduce(
          (sum: number, item: AlertAnalyticsItem) => sum + item.resolvedAlerts,
          0
        ),
        totalFalsePositives: analytics.reduce(
          (sum: number, item: AlertAnalyticsItem) => sum + item.falsePositives,
          0
        ),
        averageMTTR: calculateAverageMTTR(analytics),
        alertDistribution: calculateAlertDistribution(analytics),
        notificationStats: calculateNotificationStats(analytics),
      },

      anomalyDetection: {
        modelsActive: modelStats.length,
        models: modelStats.map((model: ModelStatistic) => ({
          metricName: model.metricName,
          modelType: model.modelType,
          sampleCount: model.sampleCount || 0,
          lastTrained: model.lastTraining,
          performance: {
            accuracy: model.accuracy,
            precision: model.precision,
            recall: model.recall,
            f1Score: model.f1Score,
          },
          queuedSamples: model.queuedSamples || 0,
          accuracy: model.accuracy,
          falsePositiveRate: 1 - model.precision, // Approximation
        })),
        overallPerformance: calculateOverallMLPerformance(modelStats),
      },

      correlations: {
        activeCount: activeCorrelations.length,
        correlations: activeCorrelations.map((correlation) => ({
          id: correlation.id,
          title: correlation.title,
          alertCount: correlation.alertCount,
          confidence: correlation.confidence,
          severity: correlation.severity,
          firstAlert: new Date(correlation.firstAlertAt).toISOString(),
          lastAlert: new Date(correlation.lastAlertAt).toISOString(),
          duration:
            new Date(correlation.lastAlertAt).getTime() -
            new Date(correlation.firstAlertAt).getTime(),
        })),
      },

      trends: {
        ...additionalMetrics.trends,
      },

      insights: generateInsights(analytics, modelStats, activeCorrelations),
    };

    return NextResponse.json({
      success: true,
      data: analyticsData,
    });
  } catch (error) {
    console.error("Error fetching alert analytics:", { error: error });
    return handleApiError(error);
  }
}

// ==========================================
// Helper Functions
// ==========================================

function calculateAverageMTTR(analytics: AlertAnalyticsItem[]): number {
  const validMTTRs = analytics
    .filter((item) => item.mttr > 0)
    .map((item) => item.mttr);
  return validMTTRs.length > 0
    ? validMTTRs.reduce((sum, mttr) => sum + mttr, 0) / validMTTRs.length
    : 0;
}

function calculateAlertDistribution(
  analytics: AlertAnalyticsItem[]
): Record<string, number> {
  const distribution = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  for (const item of analytics) {
    distribution.critical += item.criticalAlerts || 0;
    distribution.high += item.highAlerts || 0;
    distribution.medium += item.mediumAlerts || 0;
    distribution.low += item.lowAlerts || 0;
    distribution.info += item.infoAlerts || 0;
  }

  return distribution;
}

function calculateNotificationStats(
  analytics: AlertAnalyticsItem[]
): Record<string, number> {
  const stats = {
    email: 0,
    slack: 0,
    webhook: 0,
    sms: 0,
    teams: 0,
    failed: 0,
  };

  for (const item of analytics) {
    stats.email += item.emailNotifications || 0;
    stats.slack += item.slackNotifications || 0;
    stats.webhook += item.webhookNotifications || 0;
    stats.sms += item.smsNotifications || 0;
    stats.teams += item.teamsNotifications || 0;
    stats.failed += item.failedNotifications || 0;
  }

  return stats;
}

function calculateOverallMLPerformance(modelStats: ModelStatistic[]): {
  averageAccuracy: number;
  averagePrecision: number;
  averageRecall: number;
  averageF1Score: number;
  averageFalsePositiveRate: number;
} {
  if (modelStats.length === 0) {
    return {
      averageAccuracy: 0,
      averagePrecision: 0,
      averageRecall: 0,
      averageF1Score: 0,
      averageFalsePositiveRate: 0,
    };
  }

  const totals = modelStats.reduce(
    (acc, model) => {
      acc.accuracy += model.accuracy || 0;
      acc.precision += model.precision || 0;
      acc.recall += model.recall || 0;
      acc.f1Score += model.f1Score || 0;
      acc.falsePositiveRate += 1 - model.precision || 0; // Approximation
      return acc;
    },
    { accuracy: 0, precision: 0, recall: 0, f1Score: 0, falsePositiveRate: 0 }
  );

  return {
    averageAccuracy: totals.accuracy / modelStats.length,
    averagePrecision: totals.precision / modelStats.length,
    averageRecall: totals.recall / modelStats.length,
    averageF1Score: totals.f1Score / modelStats.length,
    averageFalsePositiveRate: totals.falsePositiveRate / modelStats.length,
  };
}

async function calculateAdditionalMetrics(
  alertingService: AutomatedAlertingService,
  startDate?: string,
  endDate?: string
): Promise<{
  trends: {
    alertVelocity: number;
    resolutionTrend: number;
    noiseReduction: number;
    systemReliability: number;
  };
}> {
  // Calculate trends over time
  const currentPeriodStart = startDate
    ? new Date(startDate).getTime()
    : Date.now() - 7 * 24 * 3600000; // 7 days
  const currentPeriodEnd = endDate ? new Date(endDate).getTime() : Date.now();
  const _previousPeriodStart =
    currentPeriodStart - (currentPeriodEnd - currentPeriodStart);
  const _previousPeriodEnd = currentPeriodStart;

  const [currentPeriodAnalytics, previousPeriodAnalytics] = await Promise.all([
    alertingService.getAlertAnalytics("daily", 7),
    alertingService.getAlertAnalytics("daily", 7), // Would need to adjust time range
  ]);

  const currentTotalAlerts = currentPeriodAnalytics.reduce(
    (sum: number, item: AlertAnalyticsItem) => sum + item.totalAlerts,
    0
  );
  const previousTotalAlerts = previousPeriodAnalytics.reduce(
    (sum: number, item: AlertAnalyticsItem) => sum + item.totalAlerts,
    0
  );

  const currentResolved = currentPeriodAnalytics.reduce(
    (sum: number, item: AlertAnalyticsItem) => sum + item.resolvedAlerts,
    0
  );
  const previousResolved = previousPeriodAnalytics.reduce(
    (sum: number, item: AlertAnalyticsItem) => sum + item.resolvedAlerts,
    0
  );

  const currentFalsePositives = currentPeriodAnalytics.reduce(
    (sum: number, item: AlertAnalyticsItem) => sum + item.falsePositives,
    0
  );
  const previousFalsePositives = previousPeriodAnalytics.reduce(
    (sum: number, item: AlertAnalyticsItem) => sum + item.falsePositives,
    0
  );

  return {
    trends: {
      alertVelocity: calculatePercentageChange(
        currentTotalAlerts,
        previousTotalAlerts
      ),
      resolutionTrend: calculatePercentageChange(
        currentTotalAlerts > 0 ? currentResolved / currentTotalAlerts : 0,
        previousTotalAlerts > 0 ? previousResolved / previousTotalAlerts : 0
      ),
      noiseReduction: calculatePercentageChange(
        previousTotalAlerts > 0
          ? previousFalsePositives / previousTotalAlerts
          : 0,
        currentTotalAlerts > 0 ? currentFalsePositives / currentTotalAlerts : 0
      ),
      systemReliability: calculateSystemReliability(currentPeriodAnalytics),
    },
  };
}

function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function calculateSystemReliability(analytics: AlertAnalyticsItem[]): number {
  // Calculate based on critical alert frequency and resolution time
  const criticalAlerts = analytics.reduce(
    (sum: number, item: AlertAnalyticsItem) => sum + (item.criticalAlerts || 0),
    0
  );
  const totalAlerts = analytics.reduce(
    (sum: number, item: AlertAnalyticsItem) => sum + item.totalAlerts,
    0
  );
  const avgMTTR = calculateAverageMTTR(analytics);

  // Simple reliability score (inverse of critical alert ratio and MTTR)
  const criticalRatio = totalAlerts > 0 ? criticalAlerts / totalAlerts : 0;
  const mttrScore = avgMTTR > 0 ? Math.max(0, 1 - avgMTTR / 3600000) : 1; // Normalize to 1 hour

  return Math.max(0, (1 - criticalRatio) * mttrScore * 100);
}

function generateInsights(
  analytics: AlertAnalyticsItem[],
  modelStats: ModelStatistic[],
  correlations: Array<{ id: string; alertCount: number; confidence: number }>
): string[] {
  const insights: string[] = [];

  const totalAlerts = analytics.reduce(
    (sum: number, item: AlertAnalyticsItem) => sum + item.totalAlerts,
    0
  );
  const criticalAlerts = analytics.reduce(
    (sum: number, item: AlertAnalyticsItem) => sum + (item.criticalAlerts || 0),
    0
  );
  const falsePositives = analytics.reduce(
    (sum: number, item: AlertAnalyticsItem) => sum + item.falsePositives,
    0
  );

  // Alert volume insights
  if (totalAlerts > 100) {
    insights.push(
      "High alert volume detected. Consider reviewing alert thresholds to reduce noise."
    );
  } else if (totalAlerts < 10) {
    insights.push(
      "Low alert activity. Verify that monitoring coverage is adequate."
    );
  }

  // Critical alerts insights
  if (criticalAlerts > totalAlerts * 0.2) {
    insights.push(
      "High percentage of critical alerts. Review severity classifications and thresholds."
    );
  }

  // False positive insights
  if (falsePositives > totalAlerts * 0.1) {
    insights.push(
      "High false positive rate detected. Consider tuning ML models and alert rules."
    );
  }

  // ML model insights
  const lowPerformingModels = modelStats.filter((m) => m.f1Score < 0.7);
  if (lowPerformingModels.length > 0) {
    insights.push(
      `${lowPerformingModels.length} ML models have low performance. Consider retraining with more data.`
    );
  }

  // Correlation insights
  if (correlations.length > 5) {
    insights.push(
      "Multiple alert correlations detected. Focus on resolving root causes to reduce alert noise."
    );
  }

  // Add positive insights
  if (falsePositives < totalAlerts * 0.05) {
    insights.push(
      "Low false positive rate indicates well-tuned alerting system."
    );
  }

  if (modelStats.every((m) => m.f1Score > 0.8)) {
    insights.push("All ML models are performing well with high accuracy.");
  }

  return insights;
}
