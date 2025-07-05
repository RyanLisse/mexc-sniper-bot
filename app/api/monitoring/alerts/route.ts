import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get("severity");
    const category = searchParams.get("category");
    const acknowledged = searchParams.get("acknowledged");
    const limit = parseInt(searchParams.get("limit") || "50");

    const alerts = await getAlertsWithFilters({
      severity,
      category,
      acknowledged: acknowledged ? acknowledged === "true" : undefined,
      limit,
    });

    const alertSummary = await getAlertSummary();
    const criticalAlerts = alerts.filter(
      (a) => a.severity === "critical" && !a.acknowledged
    );
    const recentTrends = await getAlertTrends();

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      alerts,
      summary: alertSummary,
      criticalAlerts,
      trends: recentTrends,
      total: alerts.length,
      unacknowledged: alerts.filter((a) => !a.acknowledged).length,
    });
  } catch (error) {
    console.error("[Alerts API] Failed to fetch alerts:", { error: error });
    return NextResponse.json(
      {
        error: "Failed to fetch alerts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "acknowledge":
        return await acknowledgeAlert(body);
      case "create":
        return await createAlert(body);
      case "dismiss":
        return await dismissAlert(body);
      case "bulk_acknowledge":
        return await bulkAcknowledgeAlerts(body);
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[Alerts API] Action failed:", { error: error });
    return NextResponse.json(
      {
        error: "Alert action failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId, updates } = body;

    const updatedAlert = await updateAlert(alertId, updates);

    return NextResponse.json({
      success: true,
      alert: updatedAlert,
      message: "Alert updated successfully",
    });
  } catch (error) {
    console.error("[Alerts API] Update failed:", { error: error });
    return NextResponse.json(
      { error: "Failed to update alert" },
      { status: 500 }
    );
  }
}

// Helper functions
async function getAlertsWithFilters(filters: {
  severity?: string | null;
  category?: string | null;
  acknowledged?: boolean;
  limit: number;
}) {
  // Mock alert data - replace with actual database queries
  const mockAlerts = generateMockAlerts(100);

  let filteredAlerts = mockAlerts;

  if (filters.severity) {
    filteredAlerts = filteredAlerts.filter(
      (a) => a.severity === filters.severity
    );
  }

  if (filters.category) {
    filteredAlerts = filteredAlerts.filter(
      (a) => a.category === filters.category
    );
  }

  if (filters.acknowledged !== undefined) {
    filteredAlerts = filteredAlerts.filter(
      (a) => a.acknowledged === filters.acknowledged
    );
  }

  return filteredAlerts.slice(0, filters.limit);
}

function generateMockAlerts(count: number) {
  const severities = ["info", "warning", "error", "critical"];
  const categories = [
    "system",
    "agent",
    "trading",
    "websocket",
    "performance",
    "security",
  ];
  const sources = [
    "mexc-api-agent",
    "pattern-discovery-agent",
    "calendar-agent",
    "symbol-analysis-agent",
    "strategy-agent",
    "risk-manager-agent",
    "system-monitor",
    "websocket-service",
    "database",
    "circuit-breaker",
  ];

  const alerts = [];

  for (let i = 0; i < count; i++) {
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];

    alerts.push({
      id: `alert-${Date.now()}-${i}`,
      severity,
      category,
      source,
      title: generateAlertTitle(severity!, category!, source!),
      message: generateAlertMessage(severity!, category!, source!),
      timestamp: new Date(
        Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
      acknowledged: Math.random() > 0.6,
      acknowledgedBy: Math.random() > 0.5 ? "system" : "admin",
      acknowledgedAt:
        Math.random() > 0.5
          ? new Date(
              Date.now() - Math.random() * 24 * 60 * 60 * 1000
            ).toISOString()
          : null,
      resolved: Math.random() > 0.7,
      resolvedAt:
        Math.random() > 0.8
          ? new Date(
              Date.now() - Math.random() * 12 * 60 * 60 * 1000
            ).toISOString()
          : null,
      count: Math.floor(Math.random() * 10 + 1),
      tags: generateAlertTags(category!, source!),
      metadata: {
        affectedComponents: generateAffectedComponents(category!),
        impactLevel:
          severity === "critical"
            ? "high"
            : severity === "error"
              ? "medium"
              : "low",
        estimatedResolution: generateResolutionTime(severity!),
        relatedAlerts: Math.floor(Math.random() * 5),
      },
    });
  }

  return alerts.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

function generateAlertTitle(
  severity: string,
  category: string,
  _source: string
): string {
  const titles = {
    "critical-system": "System Critical Error",
    "critical-agent": "Agent Failure",
    "critical-trading": "Trading System Halt",
    "critical-websocket": "WebSocket Connection Failed",
    "critical-performance": "Performance Degradation Critical",
    "error-system": "System Error Detected",
    "error-agent": "Agent Error",
    "error-trading": "Trading Error",
    "error-websocket": "WebSocket Error",
    "error-performance": "Performance Issues",
    "warning-system": "System Warning",
    "warning-agent": "Agent Warning",
    "warning-trading": "Trading Warning",
    "warning-websocket": "WebSocket Warning",
    "warning-performance": "Performance Warning",
    "info-system": "System Information",
    "info-agent": "Agent Information",
    "info-trading": "Trading Information",
    "info-websocket": "WebSocket Information",
    "info-performance": "Performance Information",
  };

  const key = `${severity}-${category}`;
  return (
    titles[key as keyof typeof titles] ||
    `${severity.toUpperCase()}: ${category} issue`
  );
}

function generateAlertMessage(
  severity: string,
  category: string,
  source: string
): string {
  const messages = {
    critical: [
      `${source} has encountered a critical failure and requires immediate attention`,
      `Critical system failure detected in ${source} - service may be unavailable`,
      `Emergency: ${source} is not responding to health checks`,
    ],
    error: [
      `${source} reported an error in ${category} operations`,
      `Error detected in ${source}: operation failed with exception`,
      `${source} encountered an unexpected error during execution`,
    ],
    warning: [
      `${source} performance degraded in ${category} operations`,
      `Warning: ${source} response time exceeded threshold`,
      `${source} approaching resource limits in ${category}`,
    ],
    info: [
      `${source} completed ${category} operation successfully`,
      `Information: ${source} configuration updated`,
      `${source} status update: ${category} metrics collected`,
    ],
  };

  const severityMessages = messages[severity as keyof typeof messages] || [
    `${source} event in ${category}`,
  ];
  return severityMessages[Math.floor(Math.random() * severityMessages.length)] || "Unknown event";
}

function generateAlertTags(category: string, source: string): string[] {
  const baseTags = [category, source];
  const additionalTags = {
    system: ["infrastructure", "monitoring"],
    agent: ["ai", "workflow", "orchestration"],
    trading: ["finance", "automation", "risk"],
    websocket: ["connectivity", "realtime"],
    performance: ["optimization", "metrics"],
    security: ["auth", "access"],
  };

  return [
    ...baseTags,
    ...(additionalTags[category as keyof typeof additionalTags] || []),
  ];
}

function generateAffectedComponents(category: string): string[] {
  const components = {
    system: ["database", "server", "memory", "cpu"],
    agent: ["orchestrator", "workflow-engine", "ai-models"],
    trading: ["order-execution", "risk-management", "portfolio"],
    websocket: ["price-feeds", "order-updates", "market-data"],
    performance: ["response-time", "throughput", "cache"],
    security: ["authentication", "authorization", "encryption"],
  };

  const categoryComponents = components[
    category as keyof typeof components
  ] || ["unknown"];
  const numComponents = Math.floor(Math.random() * 3 + 1);

  return categoryComponents
    .sort(() => Math.random() - 0.5)
    .slice(0, numComponents);
}

function generateResolutionTime(severity: string): string {
  const times = {
    critical: ["5-15 minutes", "15-30 minutes", "30-60 minutes"],
    error: ["30-60 minutes", "1-2 hours", "2-4 hours"],
    warning: ["1-4 hours", "4-8 hours", "8-24 hours"],
    info: ["auto-resolved", "no action required", "24-48 hours"],
  };

  const severityTimes = times[severity as keyof typeof times] || ["unknown"];
  return severityTimes[Math.floor(Math.random() * severityTimes.length)] || "unknown";
}

async function getAlertSummary() {
  // Mock alert summary - replace with actual database aggregation
  return {
    total: 247,
    unacknowledged: 23,
    critical: 2,
    error: 8,
    warning: 31,
    info: 206,
    lastHour: 15,
    last24Hours: 89,
    topSources: [
      { source: "pattern-discovery-agent", count: 12 },
      { source: "mexc-api-agent", count: 8 },
      { source: "websocket-service", count: 6 },
      { source: "risk-manager-agent", count: 4 },
      { source: "system-monitor", count: 3 },
    ],
    topCategories: [
      { category: "performance", count: 45 },
      { category: "agent", count: 38 },
      { category: "system", count: 25 },
      { category: "trading", count: 18 },
      { category: "websocket", count: 12 },
    ],
  };
}

async function getAlertTrends() {
  // Mock alert trends - replace with actual database aggregation
  const hours = Array.from({ length: 24 }, (_, i) => {
    const hour = new Date();
    hour.setHours(hour.getHours() - i);
    return {
      hour: hour.toISOString().split("T")[1]?.split(":")[0] || "00",
      count: Math.floor(Math.random() * 20 + 5),
      critical: Math.floor(Math.random() * 3),
      error: Math.floor(Math.random() * 8),
      warning: Math.floor(Math.random() * 15),
      info: Math.floor(Math.random() * 30),
    };
  }).reverse();

  return {
    hourly: hours,
    patterns: [
      { pattern: "increased_errors_during_market_open", confidence: 0.85 },
      { pattern: "websocket_disconnections_correlation", confidence: 0.72 },
      { pattern: "agent_performance_degradation_trend", confidence: 0.68 },
    ],
    recommendations: [
      "Consider increasing agent timeout thresholds during high-traffic periods",
      "Monitor WebSocket connection stability more closely",
      "Review pattern discovery agent performance optimization",
    ],
  };
}

// Action handlers
interface AcknowledgeAlertData {
  alertId: string;
  acknowledgedBy: string;
  notes?: string;
}

async function acknowledgeAlert(data: AcknowledgeAlertData) {
  const { alertId, acknowledgedBy, notes } = data;

  // Mock acknowledgment - replace with actual database update
  console.info(`Alert ${alertId} acknowledged by ${acknowledgedBy}: ${notes}`);

  return NextResponse.json({
    success: true,
    alertId,
    acknowledgedAt: new Date().toISOString(),
    message: "Alert acknowledged successfully",
  });
}

interface CreateAlertData {
  severity: string;
  category: string;
  source: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

async function createAlert(data: CreateAlertData) {
  const { severity, category, source, title, message } = data;

  // Mock alert creation - replace with actual database insert
  const alertId = `alert-${Date.now()}`;

  console.info(`Creating alert ${alertId}:`, {
    severity,
    category,
    source,
    title,
    message,
  });

  return NextResponse.json({
    success: true,
    alertId,
    message: "Alert created successfully",
  });
}

interface DismissAlertData {
  alertId: string;
  dismissedBy: string;
  reason?: string;
}

async function dismissAlert(data: DismissAlertData) {
  const { alertId, dismissedBy, reason } = data;

  // Mock dismissal - replace with actual database update
  console.info(`Alert ${alertId} dismissed by ${dismissedBy}: ${reason}`);

  return NextResponse.json({
    success: true,
    alertId,
    dismissedAt: new Date().toISOString(),
    message: "Alert dismissed successfully",
  });
}

interface BulkAcknowledgeAlertsData {
  alertIds: string[];
  acknowledgedBy: string;
  notes?: string;
}

async function bulkAcknowledgeAlerts(data: BulkAcknowledgeAlertsData) {
  const { alertIds, acknowledgedBy } = data;

  // Mock bulk acknowledgment - replace with actual database update
  console.info(
    `Bulk acknowledging ${alertIds.length} alerts by ${acknowledgedBy}`
  );

  return NextResponse.json({
    success: true,
    acknowledged: alertIds.length,
    acknowledgedAt: new Date().toISOString(),
    message: `${alertIds.length} alerts acknowledged successfully`,
  });
}

async function updateAlert(alertId: string, updates: Record<string, unknown>) {
  // Mock alert update - replace with actual database update
  console.info(`Updating alert ${alertId}:`, updates);

  return {
    id: alertId,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}
