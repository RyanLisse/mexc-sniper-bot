import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import type { SelectAlertInstance } from "@/src/db/schemas";
import { validateRequest } from "@/src/lib/api-auth";
import { handleApiError } from "@/src/lib/api-response";
import { AutomatedAlertingService } from "@/src/services/notification/automated-alerting-service";

const alertingService = new AutomatedAlertingService(db);

// ==========================================
// GET /api/alerts/instances - List alert instances
// ==========================================
export async function GET(request: NextRequest) {
  try {
    const _user = await validateRequest(request);
    // validateRequest already throws if not authenticated, so if we reach here, user is authenticated

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const severity = searchParams.get("severity") || undefined;
    const source = searchParams.get("source") || undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam) : 50;
    const hoursParam = searchParams.get("hours");
    const hours = hoursParam ? parseInt(hoursParam) : 24;

    let alerts: Array<SelectAlertInstance>;

    if (status === "active" || !status) {
      // Get active alerts
      const severityFilter = severity ? [severity] : undefined;
      const sourceFilter = source ? [source] : undefined;

      const activeAlertsFilters: {
        severity?: string[];
        source?: string[];
        limit: number;
      } = {
        limit,
      };

      if (severityFilter) activeAlertsFilters.severity = severityFilter;
      if (sourceFilter) activeAlertsFilters.source = sourceFilter;

      alerts = await alertingService.getActiveAlerts(activeAlertsFilters);
    } else {
      // Get historical alerts
      alerts = await alertingService.getAlertHistory(hours);

      // Apply filters
      if (severity) {
        alerts = alerts.filter((a) => a.severity === severity);
      }
      if (source) {
        alerts = alerts.filter((a) => a.source === source);
      }
      if (status && status !== "all") {
        alerts = alerts.filter((a) => a.status === status);
      }

      // Apply limit
      alerts = alerts.slice(0, limit);
    }

    // Format alerts for client consumption
    const formattedAlerts = alerts.map((alert) => ({
      id: alert.id,
      ruleId: alert.ruleId,
      severity: alert.severity,
      source: alert.source,
      status: alert.status,
      message: alert.message,
      description: alert.description,
      metricValue: alert.metricValue,
      threshold: alert.threshold,
      anomalyScore: alert.anomalyScore,
      sourceId: alert.sourceId,
      environment: alert.environment,
      correlationId: alert.correlationId,
      escalationLevel: alert.escalationLevel,
      labels: alert.labels ? JSON.parse(alert.labels) : {},
      additionalData: alert.additionalData
        ? JSON.parse(alert.additionalData)
        : {},
      firstTriggeredAt: alert.firstTriggeredAt,
      lastTriggeredAt: alert.lastTriggeredAt,
      resolvedAt: alert.resolvedAt,
      resolvedBy: alert.resolvedBy,
      resolutionNotes: alert.resolutionNotes,
      formattedTimestamp: new Date(alert.firstTriggeredAt).toISOString(),
      formattedLastTriggered: new Date(alert.lastTriggeredAt).toISOString(),
      isResolved: !!alert.resolvedAt,
      resolutionTime: alert.resolvedAt
        ? new Date(alert.resolvedAt).getTime() -
          new Date(alert.firstTriggeredAt).getTime()
        : null,
    }));

    return NextResponse.json({
      success: true,
      data: formattedAlerts,
      count: formattedAlerts.length,
      filters: {
        status,
        severity,
        source,
        limit,
        hours,
      },
    });
  } catch (error) {
    console.error("Error fetching alert instances:", { error: error });
    return handleApiError(error);
  }
}

// ==========================================
// POST /api/alerts/instances - Test alert creation
// ==========================================
export async function POST(request: NextRequest) {
  try {
    const user = await validateRequest(request);
    // validateRequest already throws if not authenticated, so if we reach here, user is authenticated

    const body = await request.json();
    const { metricName, value, source, sourceId, features } = z
      .object({
        metricName: z.string(),
        value: z.number(),
        source: z.string(),
        sourceId: z.string().optional(),
        features: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(body);

    // Create test alert metric
    const testMetric = {
      name: metricName,
      value,
      source,
      sourceId,
      timestamp: Date.now(),
      labels: { test: "true", triggeredBy: user.id },
      additionalData: features,
    };

    await alertingService.ingestMetric(testMetric);

    return NextResponse.json(
      {
        success: true,
        message: "Test metric ingested successfully",
        data: { metric: testMetric },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating test alert:", { error: error });
    return handleApiError(error);
  }
}
