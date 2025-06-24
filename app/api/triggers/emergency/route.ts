import { NextRequest, NextResponse } from "next/server";
import { createSafeLogger } from '../../../../src/lib/structured-logger';
import { inngest } from "../../../../src/inngest/client";

const logger = createSafeLogger('route');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      emergencyType = "system_overload",
      severity = "medium",
      data = {},
    } = body;

    // Validate emergency type
    const validTypes = [
      "api_failure",
      "database_failure", 
      "high_volatility",
      "system_overload",
      "trading_anomaly",
    ];

    if (!validTypes.includes(emergencyType)) {
      return NextResponse.json(
        { error: `Invalid emergency type. Valid types: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate severity
    const validSeverities = ["low", "medium", "high", "critical"];
    if (!validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Valid severities: ${validSeverities.join(", ")}` },
        { status: 400 }
      );
    }

    logger.info(`[Manual Trigger] Emergency: ${emergencyType} (${severity})`);

    // Trigger the emergency response workflow
    const result = await inngest.send({
      name: "mexc/emergency.detected",
      data: {
        emergencyType,
        severity,
        data,
        trigger: "manual",
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Emergency response triggered for ${emergencyType}`,
      eventId: result.ids[0],
      details: {
        emergencyType,
        severity,
        data,
        triggeredAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Failed to trigger emergency response:", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to trigger emergency response",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Emergency Response Trigger Endpoint",
    usage: "POST with { emergencyType, severity, data }",
    validEmergencyTypes: [
      "api_failure",
      "database_failure",
      "high_volatility", 
      "system_overload",
      "trading_anomaly",
    ],
    validSeverities: ["low", "medium", "high", "critical"],
    examples: [
      {
        emergencyType: "api_failure",
        severity: "high",
        data: { affectedAPIs: ["mexc", "openai"] },
      },
      {
        emergencyType: "high_volatility",
        severity: "medium", 
        data: { affectedSymbols: ["BTCUSDT", "ETHUSDT"], volatilityIncrease: "150%" },
      },
      {
        emergencyType: "system_overload",
        severity: "high",
        data: { memoryUsage: "95%", cpuUsage: "90%" },
      },
    ],
  });
}