import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
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
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!)
      : 50;
    const hours = searchParams.get("hours")
      ? parseInt(searchParams.get("hours")!)
      : 24;

    let alerts;

    if (status === "active" || !status) {
      // Get active alerts
      const severityFilter = severity ? [severity] : undefined;
      const sourceFilter = source ? [source] : undefined;

      alerts = await alertingService.getActiveAlerts({
        severity: severityFilter,
        source: sourceFilter,
        limit,
      });
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
      ...alert,
      labels: alert.labels ? JSON.parse(alert.labels) : {},
      additionalData: alert.additionalData
        ? JSON.parse(alert.additionalData)
        : {},
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
